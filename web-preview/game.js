import { createPreviewRenderer } from './render3d.js?v=seated-rider-thumbnails-v3';
import {mountV1Dashboard} from './v1-dashboard.mjs';
import { createLiveMinimap } from './live-minimap.mjs';
import { createRaceAudio } from './race-audio.mjs';
import { createDemoInput, demoElapsedMilliseconds } from './demo-input.mjs';
import {readAccountSession} from './account-session.mjs';
import {applyKartPhysics} from './kart-physics.mjs';
import {updateExceedDashboard} from './v1-dashboard.mjs';

const $ = (selector) => document.querySelector(selector);
const view = createPreviewRenderer($('#world'));
const liveMinimap = createLiveMinimap($('#minimap'));
mountV1Dashboard($('.tacho')).catch(error=>console.error('원본 V1 계기판:',error));
const raceAudio = createRaceAudio();
const lobby = $('#lobby');
const raceUi = $('#race-ui');
const status = $('#load-status');
const accountState = $('#account-state');
const accountLink = $('#account-link');
const kartChoice = $('#kart-choice');
const characterChoice = $('#character-choice');
const trackChoice = $('#track-choice');
const trackNames = { beach_I01: '비치 I01', beach_I02: '비치 I02', village_R01: '빌리지 R01' };
// _rhoOut/track/common/track@zz.xml: item tracks have three laps; R01 has two.
const trackLaps = { beach_I01: 3, beach_I02: 3, village_R01: 2 };
const courseIndices = { beach_I01: 0, beach_I02: 1, village_R01: 2 };
let localCatalog, playerProfile, lapNotices;
let kartPhysics;
function applySelectedKartPhysics(){
  applyKartPhysics(wasm,kartPhysics.karts[kartChoice.value]);
  const fit=view.getKartCollisionFit();
  if(!fit || !wasm.demo_fit_body(...fit.half,...fit.center))throw new Error('카트 충돌 범위 연결 실패');
  syncState();
}
let raceTicket, rewardSubmitted=false;
async function loadLocalCatalog() {
  const response=await fetch('./assets/catalog.json',{cache:'no-store'});
  if(response.status===404)return;
  if(!response.ok)throw new Error('로컬 모델 목록을 읽을 수 없습니다');
  localCatalog=await response.json();
  if(localCatalog.format!=='p5136-local-catalog-v1')throw new Error('로컬 모델 목록 형식 오류');
  for(const [kind,select] of [['tracks',trackChoice],['karts',kartChoice],['characters',characterChoice]]) {
    const selected=select.value;
    select.replaceChildren(...localCatalog[kind].map(entry=>{
      const option=new Option(entry.label+(entry.ready?'':' · 준비 필요'),entry.id);
      option.disabled=!entry.ready;
      if(kind==='tracks') {trackNames[entry.id]=entry.label;trackLaps[entry.id]=entry.laps;courseIndices[entry.id]=entry.courseIndex;}
      return option;
    }));
    select.value=[...select.options].some(o=>o.value===selected&&!o.disabled)?selected:[...select.options].find(o=>!o.disabled)?.value??'';
  }
  populateOwnedKarts();
  selectedTrack=trackChoice.value;
}
let wasm, statePointer, current, previous, visual;
let active = 'lobby';
let announcedLap=0, lapNoticeUntil=0;
let boostBlur=true;
try {boostBlur=localStorage.getItem('kart.boostBlur')!=='false';} catch {}
view.setBoostBlur(boostBlur);
$('#boost-blur-setting').checked=boostBlur;
$('#boost-blur-setting').addEventListener('change',event=>{boostBlur=event.target.checked;view.setBoostBlur(boostBlur);try{localStorage.setItem('kart.boostBlur',String(boostBlur));}catch{}});
for(const button of document.querySelectorAll('[data-open-settings]'))button.addEventListener('click',()=>{input.clear();$('#settings-dialog').classList.remove('hidden');});
let lastFrame = 0;
let requestId = 0;
let itemType = 'kart';
let selectedTrack = trackChoice.value;
let signedIn = false;
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false, exceed: false };
const input = createDemoInput(() => wasm, controls);
const keyMap = {
  ArrowUp: 'throttle', Numpad8: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', Numpad2: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', Numpad4: 'left', KeyA: 'left',
  ArrowRight: 'right', Numpad6: 'right', KeyD: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift',
  ControlLeft: 'boost', ControlRight: 'boost',
  Space: 'exceed', KeyX: 'exceed',
};

async function refreshAccount() {
  try {
    const session=await readAccountSession();
    if(!session){location.replace('login.html');return;}
    applyProfile(session.profile);
    signedIn = true;

    accountLink.textContent = '로그아웃';
    accountLink.href = '#';
    accountLink.dataset.loggedIn = 'true';
  } catch(error) { signedIn=false;showError(error); }
}

accountLink.addEventListener('click', async (event) => {
  if (accountLink.dataset.loggedIn !== 'true') return;
  event.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  location.replace('login.html');
});

const playerErrors={NOT_ENOUGH_LUCCI:'루찌가 부족합니다.',ALREADY_OWNED:'이미 보유한 카트입니다.',NICKNAME_TAKEN:'이미 사용 중인 닉네임입니다.',INVALID_NICKNAME:'닉네임은 한글·영문·숫자·밑줄 2~16자로 입력해 주세요.',NICKNAME_UNCHANGED:'현재와 다른 닉네임을 입력해 주세요.',RENAME_TICKET_REQUIRED:'닉네임 변경권이 필요합니다.',DAILY_ALREADY_CLAIMED:'오늘 출석 보상은 이미 받았습니다.'};
async function playerRequest(action,fields) {
  const response=await fetch('/api/player/'+action,{credentials:'same-origin',cache:'no-store',...(fields!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)}:{})});
  const result=await response.json();if(!response.ok)throw new Error(playerErrors[result.error]||result.error||'요청 실패');return result;
}
function populateOwnedKarts() {
  if(!localCatalog||!playerProfile)return;
  const owned=new Set(playerProfile.inventory.filter(i=>i.kind==='kart').map(i=>i.id));
  kartChoice.replaceChildren(...localCatalog.karts.filter(k=>owned.has(k.id)).map(k=>{const option=new Option(k.label,k.id);option.disabled=!k.ready;return option;}));
  kartChoice.value=playerProfile.equippedKart;
  if(!kartChoice.value)kartChoice.value=[...kartChoice.options].find(o=>!o.disabled)?.value??'';
  $('#setup-kart-name').textContent=kartChoice.selectedOptions[0]?.textContent??'카트 준비 필요';
}
function applyProfile(profile) {
  playerProfile=profile;accountState.textContent=profile.nickname;
  $('#menu-account').textContent=$('#race-rider-name').textContent=profile.nickname;
  $('#player-level').textContent=`Lv.${profile.level}`;$('#lucci').textContent=profile.lucci.toLocaleString('ko-KR');
  const progress=$('#experience');progress.max=profile.nextLevelExperience-profile.levelStartExperience;progress.value=profile.experience-profile.levelStartExperience;
  progress.title=`경험치 ${profile.experience} / ${profile.nextLevelExperience}`;
  $('#daily-reward').disabled=!profile.dailyAvailable;
  $('#rename-tickets').textContent=profile.inventory.find(i=>i.id==='nickname-change')?.quantity??0;
  populateOwnedKarts();
}
async function openShop() {
  closeAllDialogs();$('#shop-dialog').classList.remove('hidden');$('#shop-status').textContent='';
  const shop=await playerRequest('shop');renderShop(shop);
}
function renderShop(shop) {
  const search=$('#shop-search').value.trim().toLowerCase();
  $('#shop-items').replaceChildren(...shop.items.filter(i=>(i.label+' '+i.id).toLowerCase().includes(search)).map(item=>{
    const row=document.createElement('div');row.className='shop-row';const label=document.createElement('span');label.textContent=`${item.label} · ${item.price.toLocaleString('ko-KR')} 루찌`;
    const button=document.createElement('button');button.textContent=item.owned?'보유 중':'구매';button.disabled=item.owned||playerProfile.lucci<item.price;
    button.addEventListener('click',async()=>{button.disabled=true;try{applyProfile(await playerRequest('purchase',{id:item.id,kind:item.kind}));$('#shop-status').textContent=`${item.label} 구매 완료`;renderShop(await playerRequest('shop'));}catch(error){$('#shop-status').textContent=error.message;button.disabled=false;}});
    row.append(label,button);return row;
  }));
}
$('#shop-search').addEventListener('input',async()=>{try{renderShop(await playerRequest('shop'));}catch(error){$('#shop-status').textContent=error.message;}});
$('#daily-reward').addEventListener('click',async()=>{try{applyProfile(await playerRequest('daily',{}));$('#shop-status').textContent='출석 보상 500 루찌를 받았습니다.';renderShop(await playerRequest('shop'));}catch(error){$('#shop-status').textContent=error.message;}});
$('#rename-form').addEventListener('submit',async event=>{event.preventDefault();try{applyProfile(await playerRequest('rename',{nickname:$('#new-nickname').value}));$('#shop-status').textContent='닉네임을 변경했습니다.';$('#new-nickname').value='';}catch(error){$('#shop-status').textContent=error.message;}});
async function claimRaceReward(state) {
  const result=await playerRequest('race/finish',{id:raceTicket,milliseconds:Math.floor(state[24]*1000),completedLaps:Math.max(0,Math.round(state[21])-1)});
  applyProfile(result.profile);$('#result-reward').textContent=`완주 보상 +${result.reward.lucci} 루찌 · +${result.reward.experience} 경험치`;
}

const accountReady=refreshAccount();

function syncState() {
  current.set(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  previous.set(current);
  visual.set(current);
  view.resetCamera();
}

function showError(error) {
  console.error(error);
  $('#error').textContent = `실행 실패: ${error.message}`;
  $('#error').classList.remove('hidden');
  status.textContent = '로딩 실패';
}

async function loadSelectedTrack() {
  const name = trackChoice.value;
  const serial = ++requestId;
  $('#start').disabled = true;
  const info=localCatalog?.tracks.find(t=>t.id===name);
  const cardAvailable=info?.card!==false;
  $('#track-card').hidden=$('#setup-track-image').hidden=!cardAvailable;
  if(cardAvailable) {
    $('#track-card').src = `./assets/tracks/${name}/xt_trackCard.png`;
    $('#setup-track-image').src = `./assets/tracks/${name}/xt_trackCard.png`;
  }
  if(info?.minimap!==false)$('#minimap').src = `./assets/tracks/${name}/xt_minimap.png`;
  $('#track-name').textContent = $('#map-label').textContent = trackNames[name];
  $('#setup-track-name').textContent = trackNames[name];
  $('#lap-total').textContent = trackLaps[name];
  status.textContent = `${trackNames[name]} 메시 로딩 중…`;
  await view.setTrackDrive(name);
  const response = await fetch(`./assets/usd/${name}/collision.ktrk`);
  if (!response.ok) throw new Error(`${name} 로컬 충돌 메시 없음 (${response.status}). prepare-local-usd.ps1 실행 필요`);
  const binary = new Uint8Array(await response.arrayBuffer());
  if (serial !== requestId) return;
  const pointer = wasm.demo_track_alloc(binary.byteLength);
  if (!pointer) throw new Error('트랙 충돌 메모리 할당 실패');
  try {
    new Uint8Array(wasm.memory.buffer, pointer, binary.byteLength).set(binary);
    const triangles = wasm.demo_track_load(pointer, binary.byteLength);
    if (!triangles) throw new Error('트랙 충돌 메시 파싱 실패');
    await liveMinimap.load(binary,name,info?.minimap!==false);
    if (serial !== requestId) return;
    // The original ToRoad course supplies the actual spawn immediately below.
    // Enable the already-loaded triangle scene without an obsolete manual pose.
    if (!wasm.demo_track_enable(0, 0, 0, 0)) throw new Error('트랙 활성화 실패');
    const gates = wasm.demo_set_5136_course(courseIndices[name]);
    if (!gates) throw new Error(`${name} 원본 체크포인트 그래프를 생성하지 못함`);
    syncState();
    view.setLobbyMode(true);
    status.textContent = `원본 3D 트랙 · ${triangles.toLocaleString()}개 트랙 삼각형 · 체크포인트 ${gates}개`;
    $('#start').disabled = false;
    $('#setup-start').disabled = false;
  } finally {
    wasm.demo_track_free_buffer(pointer);
  }
}

async function changeModel(kind) {
  if (!wasm) return;
  const name = kind === 'kart' ? kartChoice.value : characterChoice.value;
  try {
    if (kind === 'kart') {applyProfile(await playerRequest('equip',{id:name}));await view.setKart(name);applySelectedKartPhysics();}
    else await view.setCharacter(name);
    view.renderPreview($('#setup-model'));
    view.renderPreview($('#items-model'));
  } catch (error) {
    showError(error);
  }
}

async function startRace() {
  if (!wasm || !signedIn || $('#start').disabled) return;
  $('#start').disabled=$('#setup-start').disabled=true;
  try {raceTicket=(await playerRequest('race/start',{track:trackChoice.value})).id;}
  catch(error){showError(error);return;}
  finally{$('#start').disabled=$('#setup-start').disabled=false;}
  rewardSubmitted=false;$('#result-reward').textContent='';
  raceAudio.start(trackChoice.value);
  announcedLap=0;lapNoticeUntil=0;
  wasm.demo_start_race();
  syncState();
  view.setLobbyMode(false);
  $('#lobby-backdrop').classList.add('hidden');
  $('#selection-panel').classList.add('hidden');
  closeAllDialogs();
  lobby.classList.add('hidden');
  raceUi.classList.remove('hidden');
  $('#race-result').classList.add('hidden');
  active = 'race';
}

function goLobby() {
  raceAudio.stop();
  active = 'lobby';
  input.clear();
  wasm.demo_reset();
  syncState();
  view.setLobbyMode(true);
  $('#lobby-backdrop').classList.remove('hidden');
  raceUi.classList.add('hidden');
  $('#race-result').classList.add('hidden');
  lobby.classList.remove('hidden');
  $('#single-setup').classList.remove('hidden');
}

function closeAllDialogs() {
  for (const id of ['single-setup', 'items-dialog', 'tracks-dialog', 'nexon-menu','shop-dialog']) {
    document.getElementById(id).classList.add('hidden');
  }
}

function openSetup() {
  closeAllDialogs();
  $('#single-setup').classList.remove('hidden');
  view.renderPreview($('#setup-model'));
}

function openItems() {
  $('#nexon-menu').classList.add('hidden');
  $('#items-dialog').classList.remove('hidden');
  renderItems();
  view.renderPreview($('#items-model'));
}

let itemImages;
function renderItems() {
  itemImages?.disconnect();
  const kind=itemType;
  itemImages=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const button=entry.target;
      if(!entry.isIntersecting || button.dataset.loading)return;
      button.dataset.loading='true';
      const image=button.querySelector('img'),note=button.querySelector('.item-image-status');
      view.renderAssetThumbnail(button.dataset.model,kind,()=>button.isConnected&&!$('#items-dialog').classList.contains('hidden')).then(url=>{
        if(!url||!button.isConnected)return;
        image.src=url;image.hidden=false;note.hidden=true;itemImages?.unobserve(button);
      }).catch(()=>{if(button.isConnected)note.textContent='미리보기 불러오기 실패';});
    }
  },{root:$('#item-cards'),rootMargin:'100px'});
  const select = itemType === 'kart' ? kartChoice : characterChoice;
  $('#item-cards').replaceChildren(...[...select.options].map((option) => {
    const button = document.createElement('button');
    button.className = `item-card ${select.value === option.value ? 'selected' : ''}`;
    button.disabled=option.disabled;
    button.dataset.model=option.value;
    const image=document.createElement('img');image.alt=option.textContent+' 원본 3D 미리보기';image.hidden=true;
    const label=document.createElement('span');label.textContent=option.textContent;
    const note=document.createElement('small');note.className='item-image-status';note.textContent=option.disabled?'모델 준비 필요':'미리보기 불러오는 중…';
    button.append(image,note,label);
    if(!option.disabled)itemImages.observe(button);
    button.addEventListener('click', async () => {
      select.value = option.value;
      await changeModel(itemType);
      $('#setup-kart-name').textContent = kartChoice.selectedOptions[0].textContent;
      $('#items-current-name').textContent = option.textContent;
      renderItems();
      view.renderPreview($('#items-model'));
    });
    return button;
  }));
  $('#items-current-name').textContent = select.selectedOptions[0].textContent;
}

function openTracks() {
  $('#nexon-menu').classList.add('hidden');
  $('#tracks-dialog').classList.remove('hidden');
  selectedTrack = trackChoice.value;
  renderTracks();
}

function renderTracks() {
  const search = $('#track-search').value.trim();
  const theme = $('.track-themes .active').dataset.theme;
  $('#track-cards').replaceChildren(...[...trackChoice.options]
    .filter((option) => (theme === 'all' || option.value.startsWith(theme)) && option.textContent.includes(search))
    .map((option) => {
      const button = document.createElement('button');
      button.className = `track-card-button ${selectedTrack === option.value ? 'selected' : ''}`;
      button.disabled=option.disabled;
      const label = document.createElement('span');
      label.textContent = option.textContent;
      if(!localCatalog || localCatalog.tracks.find(t=>t.id===option.value)?.card) {
        const image=document.createElement('img');
        image.loading='lazy';image.decoding='async';image.alt='';
        image.src=`./assets/tracks/${option.value}/xt_trackCard.png`;
        button.append(image);
      }
      button.append(label);
      button.addEventListener('click', () => { selectedTrack = option.value; renderTracks(); });
      return button;
    }));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds) % 60;
  const hundredths = Math.floor((seconds % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}:${String(hundredths).padStart(2, '0')}`;
}

function renderSpriteDigits(element, value, className, glyphWidth, columns) {
  if (element.dataset.value === value) return;
  element.dataset.value = value;
  element.replaceChildren(...[...value].map((character, index) => {
    const span = document.createElement('span');
    span.className = className;
    const digit = character === ':' ? 10 : Number(character);
    span.style.backgroundPosition = `${-(digit % columns) * glyphWidth}px ${-Math.floor(digit / columns) * (className === 'speed-digit' ? 44 : 22)}px`;
    if (className === 'time-digit') span.style.left = `${[85, 99, 111, 122, 136, 148, 159, 173][index]}px`;
    return span;
  }));
}

function draw(state, frameMs) {
  view.render(visual, frameMs);
  if (active === 'race') raceAudio.update(state);
  if (active === 'race') liveMinimap.draw(visual);
  if (active !== 'race') return;
  updateExceedDashboard($('.tacho'),state);
  const speed = Math.max(0, Math.round(state[6] * 3.6));
  const speedNode = $('#speed');
  if (speedNode.dataset.value !== String(speed)) speedNode.replaceChildren(...String(Math.min(speed,999)).split('').map(digit => {
    const glyph=document.createElement('span');
    glyph.className='v1-speed-digit';
    const width=Number(speedNode.dataset.fontWidth)||34,height=Number(speedNode.dataset.fontHeight)||42;
    glyph.style.width=width+'px';glyph.style.height=height+'px';
    glyph.style.backgroundPositionX=`-${((Number(digit)+9)%10)*width}px`;
    return glyph;
  }));
  speedNode.dataset.value = String(speed);
  $('#speed').setAttribute('aria-label', `속도 ${speed} km/h`);
  $('#gauge').style.width = `${Math.min(100, Math.max(0, state[7]))}%`;
  const boostIcon=$('#v1-boost-icon');
  if(boostIcon){
    const active=state[48]?'2':'1';
    if(boostIcon.dataset.active!==active){boostIcon.dataset.active=active;boostIcon.src=`./assets/ui/gui/tachometer/v1_exceed/tacho_v1_icon_boost_0${active}.png`;}
  }
  const nitroCount = Math.max(0, Math.floor(state[32]));
  $('#nitro-count').setAttribute('aria-label', `보유 부스터 ${nitroCount}개`);
  if($('#nitro-count').dataset.count!==String(nitroCount)){
    $('#nitro-count').dataset.count=String(nitroCount);
    $('#nitro-count').replaceChildren(...Array.from({length:Math.min(2,nitroCount)},()=>{const icon=document.createElement('img');icon.src='./assets/effects/stage/timeAttackReady/boostTex_0.png';icon.alt='개인전 부스터';return icon;}));
  }
  $('.nitro-inventory').classList.toggle('has-nitro', nitroCount > 0);
  const timeText = formatTime(state[23]);
  renderSpriteDigits($('#timer'), timeText, 'time-digit', 18, 11);
  $('#race-time').textContent = timeText;
  $('#best-time').textContent = formatTime(state[18]);
  $('#lap-number').textContent = Math.min(trackLaps[trackChoice.value], Math.max(1, Math.round(state[21])));
  $('#collision-count').textContent = Math.round(state[11]);
  $('#timer').setAttribute('aria-label', `주행 시간 ${timeText}`);
  const countdown = state[19] === 1 && state[20] <= 3 ? Math.ceil(state[20]) : 0;
  $('#countdown').classList.toggle('visible', Boolean(countdown));
  if (countdown) $('#countdown').style.backgroundPosition = `${-countdown * 64}px 0`;
  $('#lap').textContent = state[19] === 1 ? '출발 준비' :
    state[19] === 3 ? '완주' : '원본 체크포인트 레이스';
  const currentLap=Math.max(1,Math.round(state[21]));
  if(state[19]===2 && currentLap!==announcedLap && currentLap<=trackLaps[trackChoice.value]) {
    announcedLap=currentLap;
    const panel=currentLap>1?lapNotices?.[currentLap===trackLaps[trackChoice.value]?'finallap':`${currentLap}lap`]:null;
    lapNoticeUntil=panel?performance.now()+panel.fadeIn+panel.hold+panel.fadeOut:0;
    if(panel){const [x,y,right,bottom]=panel.rect;const node=$('#lap-notice');
      node.style.backgroundImage=`url("./assets/ui/${panel.image}")`;node.style.backgroundPosition=`-${x}px -${y}px`;
      node.style.width=`${right-x}px`;node.style.height=`${bottom-y}px`;
      node.style.left=`calc(50% + ${panel.adjust[0]}px)`;node.style.top=`calc(50% + ${panel.adjust[1]}px)`;
      node.setAttribute('aria-label',currentLap===trackLaps[trackChoice.value]?'마지막 바퀴!!':`${currentLap}번째 바퀴`);
      node.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.8)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:panel.fadeIn/(panel.fadeIn+panel.hold+panel.fadeOut)},{opacity:1,offset:(panel.fadeIn+panel.hold)/(panel.fadeIn+panel.hold+panel.fadeOut)},{opacity:0}],{duration:panel.fadeIn+panel.hold+panel.fadeOut});
    }
  }
  $('#lap-notice').classList.toggle('hidden',state[19]!==2 || performance.now()>lapNoticeUntil);
  const finished = state[19] === 3;
  $('#race-result').classList.toggle('hidden', !finished);
  if (finished) {
    if(!rewardSubmitted){rewardSubmitted=true;claimRaceReward(state).catch(error=>{$('#result-reward').textContent=error.message;});}
    $('#result-time').textContent = formatTime(state[24]);
    $('#result-best').textContent = formatTime(state[18]);
  }
}

function frame(time) {
  if (!lastFrame) lastFrame = time;
  const elapsed = demoElapsedMilliseconds(lastFrame, time);
  lastFrame = time;
  if (active === 'race' && elapsed > 0) {
    wasm.demo_exceed_input(+controls.exceed);
    wasm.demo_step(elapsed, +controls.throttle, +controls.brake,
      input.steering(), +controls.drift, +controls.boost);
    current.set(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  }
  visual.set(current); // C owns the chase filter; render the actual latest pose.
  draw(current, elapsed);
  requestAnimationFrame(frame);
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (type === 'keydown' && event.code === 'F3') {
      event.preventDefault(); view.toggleCollision().catch(showError); return;
    }
    if (active !== 'race' || !$('#settings-dialog').classList.contains('hidden')) return;
    if (type === 'keydown' && event.code === 'KeyR') {
      wasm.demo_request_reset();
      syncState();
      return;
    }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    input.set(control, type === 'keydown', event.code);
  });
}
window.addEventListener('blur', () => {
  input.clear();
});
for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  const press = (value) => { input.set(control, value, button); button.classList.toggle('active', value); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); press(true); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => press(false));
}
kartChoice.addEventListener('change', () => changeModel('kart'));
characterChoice.addEventListener('change', () => changeModel('character'));
trackChoice.addEventListener('change', () => loadSelectedTrack().catch(showError));
$('#start').addEventListener('click', startRace);
$('#setup-start').addEventListener('click', startRace);
$('#mode-speed').addEventListener('click', openSetup);
$('#setup-items').addEventListener('click', openItems);
$('#setup-tracks').addEventListener('click', openTracks);
$('#items-confirm').addEventListener('click', () => $('#items-dialog').classList.add('hidden'));
$('#tracks-confirm').addEventListener('click', () => {
  trackChoice.value = selectedTrack;
  loadSelectedTrack().catch(showError);
  $('#tracks-dialog').classList.add('hidden');
});
$('#track-search').addEventListener('input', renderTracks);
for (const button of document.querySelectorAll('[data-item-type]')) button.addEventListener('click', () => {
  itemType = button.dataset.itemType;
  for (const tab of document.querySelectorAll('[data-item-type]')) tab.classList.toggle('active', tab === button);
  renderItems();
});
for (const button of document.querySelectorAll('[data-theme]')) button.addEventListener('click', () => {
  for (const tab of document.querySelectorAll('[data-theme]')) tab.classList.toggle('active', tab === button);
  renderTracks();
});
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
  document.getElementById(button.dataset.close).classList.add('hidden');
});
for (const button of document.querySelectorAll('[data-menu-action]')) button.addEventListener('click', async () => {
  const action = button.dataset.menuAction;
  if (action === 'single') openSetup();
  if (action === 'items') openItems();
  if (action === 'tracks') openTracks();
  if (action === 'logout') {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    location.replace('login.html');
  }
});
for (const item of document.querySelectorAll('[data-lobby-action]')) {
  item.addEventListener('click', () => {
    const action = item.dataset.lobbyAction;
    if (action === 'home') closeAllDialogs();
    if (action === 'menu') $('#nexon-menu').classList.toggle('hidden');
    if (action === 'select') openSetup();
    if (action === 'kart') { itemType = 'kart'; openItems(); }
    if (action === 'character') { itemType = 'character'; openItems(); }
    if (action === 'shop') openShop().catch(showError);
  });
}
$('#close-selection').addEventListener('click', () => $('#selection-panel').classList.add('hidden'));
for (const button of document.querySelectorAll('[data-cycle]')) {
  button.addEventListener('click', () => {
    const select = document.getElementById(button.dataset.cycle);
    const step = Number(button.dataset.direction);
    select.selectedIndex = (select.selectedIndex + step + select.options.length) % select.options.length;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
$('#back-lobby').addEventListener('click', goLobby);
$('#result-retry').addEventListener('click', startRace);
$('#result-lobby').addEventListener('click', goLobby);
$('#reset').addEventListener('click', () => { wasm.demo_request_reset(); syncState(); });

try {
  const response = await fetch('./demo_physics.wasm', { cache: 'no-store' });
  if (!response.ok) throw new Error(`데모 물리 Wasm 없음 (${response.status})`);
  const module = await WebAssembly.instantiate(await response.arrayBuffer(), {
    wasi_snapshot_preview1: { proc_exit: () => {}, random_get: () => 0 },
  });
  wasm = module.instance.exports;
  statePointer = wasm.demo_new();
  if (!statePointer) throw new Error('Wasm 초기화 실패');
  // Use the original demo gauge; V1-specific automatic charge is experimental.
  wasm.demo_configure_v1_charger(0, 25, 2);
  await accountReady;
  lapNotices=await (await fetch('./assets/ui/lap-notices.json',{cache:'no-store'})).json();
  await loadLocalCatalog();
  const physicsResponse=await fetch('./assets/kart-physics.json',{cache:'no-store'});
  if(!physicsResponse.ok)throw new Error('카트별 성능 파일 없음: prepare-local-kart-physics.py 실행 필요');
  kartPhysics=await physicsResponse.json();
  current = new Float32Array(wasm.demo_state_count());
  previous = new Float32Array(wasm.demo_state_count());
  visual = new Float32Array(wasm.demo_state_count());
  syncState();
  await Promise.all([view.setKart(kartChoice.value), view.setCharacter(characterChoice.value)]);
  applySelectedKartPhysics();
  await loadSelectedTrack();
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}
