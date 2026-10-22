import { createPreviewRenderer } from './render3d.js?v=source-fixes';
import { createLiveMinimap } from './live-minimap.mjs';
import { createRaceAudio } from './race-audio.mjs';
import { interpolatePreviewState } from './frame-interpolation.mjs';

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
let wasm, statePointer, current, previous, visual;
let active = 'lobby';
let lastFrame = 0;
let accumulator = 0;
let requestId = 0;
let itemType = 'kart';
let selectedTrack = trackChoice.value;
let signedIn = false;
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false };
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
  current.set(new Float32Array(wasm.memory.buffer, statePointer, 43));
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
  $('#track-card').src = `./assets/tracks/${name}/xt_trackCard.png`;
  $('#minimap').src = `./assets/tracks/${name}/xt_minimap.png`;
  $('#track-name').textContent = $('#map-label').textContent = trackNames[name];
  $('#setup-track-name').textContent = trackNames[name];
  $('#setup-track-image').src = `./assets/tracks/${name}/xt_trackCard.png`;
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
    liveMinimap.load(binary);
    // The original ToRoad course supplies the actual spawn immediately below.
    // Enable the already-loaded triangle scene without an obsolete manual pose.
    if (!wasm.demo_track_enable(0, 0, 0, 0)) throw new Error('트랙 활성화 실패');
    const gates = wasm.demo_set_5136_course(courseIndices[name]);
    if (!gates) throw new Error(`${name} 원본 체크포인트 그래프를 생성하지 못함`);
    wasm.demo_set_steer_angle(Number(localStorage.getItem('demo-steer-angle')) || 10);
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
  wasm.demo_start_race();
  wasm.demo_set_steer_angle(Number(localStorage.getItem('demo-steer-angle')) || 10);
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
  Object.keys(controls).forEach((key) => { controls[key] = false; });
  wasm.demo_steering_clear();
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
      const image = document.createElement('img');
      image.src = `./assets/tracks/${option.value}/xt_trackCard.png`;
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = option.textContent;
      button.append(image, label);
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
  const finished = state[19] === 3;
  $('#race-result').classList.toggle('hidden', !finished);
  if (finished) {
    $('#result-time').textContent = formatTime(state[24]);
    $('#result-best').textContent = formatTime(state[18]);
  }
}

function frame(time) {
  if (!lastFrame) lastFrame = time;
  const elapsed = Math.min(Math.max(time - lastFrame, 0), 100);
  lastFrame = time;
  if (active === 'race') {
    accumulator = Math.min(accumulator + elapsed, 100);
    while (accumulator >= 16) {
      previous.set(current);
      const steer = Math.max(-1, Math.min(1,
        wasm.demo_steering_value() + (+controls.right) - (+controls.left)));
      wasm.demo_step(16, +controls.throttle, +controls.brake,
        steer, +controls.drift, +controls.boost);
      current.set(new Float32Array(wasm.memory.buffer, statePointer, 43));
      accumulator -= 16;
    }
    interpolatePreviewState(previous, current, accumulator / 16, visual);
  } else visual.set(current);
  draw(current, elapsed);
  requestAnimationFrame(frame);
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (type === 'keydown' && event.code === 'F3') {
      event.preventDefault(); view.toggleCollision().catch(showError); return;
    }
    if (active !== 'race') return;
    if (type === 'keydown' && event.code === 'KeyR') {
      wasm.demo_request_reset();
      syncState();
      return;
    }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    if (control === 'left' || control === 'right') {
      wasm.demo_steering_event(control === 'left' ? -1 : 1, +(type === 'keydown'));
    } else controls[control] = type === 'keydown';
  });
}
window.addEventListener('blur', () => {
  Object.keys(controls).forEach((key) => { controls[key] = false; });
  wasm?.demo_steering_clear();
});
for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  const press = (value) => { controls[control] = value; button.classList.toggle('active', value); };
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
  // Both currently supported kart bodies are V1. These provisional charger
  // parameters are isolated from the recovered demo's drift gauge formula.
  wasm.demo_configure_v1_charger(1, 25, 2);
  current = new Float32Array(43);
  previous = new Float32Array(43);
  visual = new Float32Array(43);
  syncState();
  await Promise.all([view.setKart(kartChoice.value), view.setCharacter(characterChoice.value)]);
  await loadSelectedTrack();
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}
