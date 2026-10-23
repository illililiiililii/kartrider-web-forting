import { createPreviewRenderer } from './render3d.js?v=race-effects57';
import { boostLabel } from './race-effects.mjs';
import { createLiveMinimap, lapAnnouncement } from './live-minimap.mjs';
import { createRaceAudio } from './race-audio.mjs';
import { createDemoInput, demoElapsedMilliseconds } from './demo-input.mjs';

const $ = (selector) => document.querySelector(selector);
const view = createPreviewRenderer($('#world'));
const liveMinimap = createLiveMinimap($('#minimap'));
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
let localCatalog;
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
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false };
const input = createDemoInput(() => wasm, controls);
const keyMap = {
  ArrowUp: 'throttle', Numpad8: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', Numpad2: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', Numpad4: 'left', KeyA: 'left',
  ArrowRight: 'right', Numpad6: 'right', KeyD: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift',
  ControlLeft: 'boost', ControlRight: 'boost',
};

async function refreshAccount() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      location.replace('login.html');
      return;
    }
    const { user } = await response.json();
    if (!user) { location.replace('login.html'); return; }
    signedIn = true;
    accountState.textContent = user.handle;
    $('#menu-account').textContent = user.handle;
    $('#race-rider-name').textContent = user.handle;
    accountLink.textContent = '로그아웃';
    accountLink.href = '#';
    accountLink.dataset.loggedIn = 'true';
  } catch { location.replace('login.html'); }
}

accountLink.addEventListener('click', async (event) => {
  if (accountLink.dataset.loggedIn !== 'true') return;
  event.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  location.replace('login.html');
});
refreshAccount();

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
    if (kind === 'kart') await view.setKart(name);
    else await view.setCharacter(name);
    view.renderPreview($('#setup-model'));
    view.renderPreview($('#items-model'));
  } catch (error) {
    showError(error);
  }
}

function startRace() {
  if (!wasm || !signedIn || $('#start').disabled) return;
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
  for (const id of ['single-setup', 'items-dialog', 'tracks-dialog', 'nexon-menu']) {
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

function renderItems() {
  const select = itemType === 'kart' ? kartChoice : characterChoice;
  $('#item-cards').replaceChildren(...[...select.options].map((option) => {
    const button = document.createElement('button');
    button.className = `item-card ${select.value === option.value ? 'selected' : ''}`;
    button.disabled=option.disabled;
    button.textContent = option.textContent;
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
  const speed = Math.max(0, Math.round(state[6] * 3.6));
  const speedNode = $('#speed');
  if (speedNode.dataset.value !== String(speed)) speedNode.replaceChildren(...String(Math.min(speed,999)).split('').map(digit => {
    const glyph=document.createElement('span');
    glyph.className='v1-speed-digit';
    // Original tacho.xml fontStr="1234567890", fontSize="36 43".
    glyph.style.backgroundPositionX=`-${((Number(digit)+9)%10)*36}px`;
    return glyph;
  }));
  speedNode.dataset.value = String(speed);
  $('#speed').setAttribute('aria-label', `속도 ${speed} km/h`);
  $('#gauge').style.width = `${Math.min(100, Math.max(0, state[7]))}%`;
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
    announcedLap=currentLap;lapNoticeUntil=performance.now()+2200;
    $('#lap-notice').textContent=lapAnnouncement(currentLap,trackLaps[trackChoice.value]);
  }
  $('#lap-notice').classList.toggle('hidden',state[19]!==2 || performance.now()>lapNoticeUntil);
  const kind=Math.round(state[48]||0);
  $('#boost-status').textContent=boostLabel(kind);
  $('#boost-status').classList.toggle('hidden',!kind);
  $('#boost-status').dataset.kind=kind;
  const finished = state[19] === 3;
  $('#race-result').classList.toggle('hidden', !finished);
  if (finished) {
    $('#result-time').textContent = formatTime(state[24]);
    $('#result-best').textContent = formatTime(state[18]);
  }
}

function frame(time) {
  if (!lastFrame) lastFrame = time;
  const elapsed = demoElapsedMilliseconds(lastFrame, time);
  lastFrame = time;
  if (active === 'race' && elapsed > 0) {
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
  await loadLocalCatalog();
  current = new Float32Array(wasm.demo_state_count());
  previous = new Float32Array(wasm.demo_state_count());
  visual = new Float32Array(wasm.demo_state_count());
  syncState();
  await Promise.all([view.setKart(kartChoice.value), view.setCharacter(characterChoice.value)]);
  await loadSelectedTrack();
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}
