import { createPreviewRenderer } from './render3d.js?v=14';
import { interpolatePreviewState } from './frame-interpolation.mjs';

const $ = (selector) => document.querySelector(selector);
const view = createPreviewRenderer($('#world'));
const lobby = $('#lobby');
const raceUi = $('#race-ui');
const status = $('#load-status');
const kartChoice = $('#kart-choice');
const characterChoice = $('#character-choice');
const trackChoice = $('#track-choice');
const trackNames = { beach_I01: '비치 I01', beach_I02: '비치 I02', village_R01: '빌리지 R01' };
const spawns = {
  beach_I01: [-120, 98, 0],
  beach_I02: [-65, 55, Math.PI],
  village_R01: [-20, 70, 0],
};
let wasm, statePointer, current, previous, visual;
let active = 'lobby';
let lastFrame = 0;
let accumulator = 0;
let requestId = 0;
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false };
const keyMap = {
  ArrowUp: 'throttle', Numpad8: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', Numpad2: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', Numpad4: 'left', KeyA: 'left',
  ArrowRight: 'right', Numpad6: 'right', KeyD: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift',
  ControlLeft: 'boost', ControlRight: 'boost',
};

function syncState() {
  current.set(new Float32Array(wasm.memory.buffer, statePointer, 32));
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
    const [x, y, heading] = spawns[name];
    const height = wasm.demo_track_ground_height(x, y, 80);
    if (!Number.isFinite(height)) throw new Error('시작 지점의 바닥을 찾지 못함');
    if (!wasm.demo_track_enable(x, y, height, heading)) throw new Error('트랙 활성화 실패');
    wasm.demo_set_steer_angle(Number(localStorage.getItem('demo-steer-angle')) || 10);
    syncState();
    view.setLobbyMode(true);
    status.textContent = `원본 3D 트랙 · ${triangles.toLocaleString()}개 충돌 후보 삼각형`;
    $('#start').disabled = false;
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
  } catch (error) {
    showError(error);
  }
}

function startRace() {
  if (!wasm || $('#start').disabled) return;
  wasm.demo_start_race();
  wasm.demo_set_steer_angle(Number(localStorage.getItem('demo-steer-angle')) || 10);
  syncState();
  view.setLobbyMode(false);
  lobby.classList.add('hidden');
  raceUi.classList.remove('hidden');
  active = 'race';
}

function goLobby() {
  active = 'lobby';
  Object.keys(controls).forEach((key) => { controls[key] = false; });
  wasm.demo_reset();
  syncState();
  view.setLobbyMode(true);
  raceUi.classList.add('hidden');
  lobby.classList.remove('hidden');
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
}

function draw(state, frameMs) {
  view.render(visual, frameMs);
  if (active !== 'race') return;
  const speed = Math.max(0, Math.round(state[6] * 3.6));
  $('#speed').textContent = String(speed).padStart(3, '0');
  $('#needle').style.transform = `rotate(${-90 + Math.min(270, speed / 360 * 270)}deg)`;
  $('#gauge').style.width = `${Math.min(100, Math.max(0, state[7]))}%`;
  $('#nitro-count').textContent = state[7] >= 100 ? '1' : '0';
  $('#timer').textContent = formatTime(state[23]);
  const countdown = state[19] === 1 ? Math.ceil(state[20]) : 0;
  $('#countdown').textContent = countdown ? String(countdown) : '';
  $('#lap').textContent = state[19] === 1 ? '출발 준비' : '연습 주행';
}

function frame(time) {
  if (!lastFrame) lastFrame = time;
  const elapsed = Math.min(Math.max(time - lastFrame, 0), 100);
  lastFrame = time;
  if (active === 'race') {
    accumulator = Math.min(accumulator + elapsed, 100);
    while (accumulator >= 16) {
      previous.set(current);
      wasm.demo_step(16, +controls.throttle, +controls.brake,
        (+controls.left) - (+controls.right), +controls.drift, +controls.boost);
      current.set(new Float32Array(wasm.memory.buffer, statePointer, 32));
      accumulator -= 16;
    }
    interpolatePreviewState(previous, current, accumulator / 16, visual);
  } else visual.set(current);
  draw(current, elapsed);
  requestAnimationFrame(frame);
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (active !== 'race') return;
    if (type === 'keydown' && event.code === 'KeyR') { wasm.demo_reset(); syncState(); return; }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    controls[control] = type === 'keydown';
  });
}
window.addEventListener('blur', () => Object.keys(controls).forEach((key) => { controls[key] = false; }));
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
$('#mode-speed').addEventListener('click', startRace);
for (const item of document.querySelectorAll('[data-lobby-action]')) {
  item.addEventListener('click', () => {
    const action = item.dataset.lobbyAction;
    if (action === 'start') startRace();
    else {
      const select = ({ kart: kartChoice, character: characterChoice, track: trackChoice })[action];
      select.focus();
      try { select.showPicker(); } catch { /* focus still works on older browsers */ }
    }
  });
}
$('#back-lobby').addEventListener('click', goLobby);
$('#reset').addEventListener('click', () => { wasm.demo_reset(); syncState(); });

try {
  const response = await fetch('./demo_physics.wasm', { cache: 'no-store' });
  if (!response.ok) throw new Error(`데모 물리 Wasm 없음 (${response.status})`);
  const module = await WebAssembly.instantiate(await response.arrayBuffer(), {
    wasi_snapshot_preview1: { proc_exit: () => {}, random_get: () => 0 },
  });
  wasm = module.instance.exports;
  statePointer = wasm.demo_new();
  if (!statePointer) throw new Error('Wasm 초기화 실패');
  current = new Float32Array(32);
  previous = new Float32Array(32);
  visual = new Float32Array(32);
  syncState();
  await Promise.all([view.setKart(kartChoice.value), view.setCharacter(characterChoice.value)]);
  await loadSelectedTrack();
  requestAnimationFrame(frame);
} catch (error) {
  showError(error);
}
