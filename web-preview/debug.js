import { createPreviewRenderer } from './render3d.js?v=native47-catalog';
import { createDemoInput, demoElapsedMilliseconds } from './demo-input.mjs';

const canvas = document.querySelector('#track');
const view = createPreviewRenderer(canvas);
const status = document.querySelector('#status');
const modelLabel = document.querySelector('#model-label');
const kartChoice = document.querySelector('#kart-choice');
const characterChoice = document.querySelector('#character-choice');
const physicsPreset = document.querySelector('#physics-preset');
const trackChoice = document.querySelector('#track-choice');
const trackCard = document.querySelector('#track-card');
const trackMinimap = document.querySelector('#track-minimap');
const trackMapStatus = document.querySelector('#track-map-status');
const audioToggle = document.querySelector('#audio-toggle');
const audio = {
  beach: new Audio('./assets/audio/beach.ogg'),
  village: new Audio('./assets/audio/village.ogg'),
  drift: new Audio('./assets/audio/drift.ogg'),
  boost: new Audio('./assets/audio/boost.ogg'),
};
audio.beach.loop = audio.village.loop = true;
audio.beach.volume = audio.village.volume = 0.28;
audio.drift.volume = 0.45;
audio.boost.volume = 0.5;
let audioEnabled = false;
let lastDrifting = false;
let lastBoosting = false;
function currentBgm() { return trackChoice.value.startsWith('village') ? audio.village : audio.beach; }
function playCurrentBgm() {
  audio.beach.pause();
  audio.village.pause();
  if (audioEnabled) currentBgm().play().catch(() => {});
}
audioToggle.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  audioToggle.textContent = audioEnabled ? '원본 음악·효과음 끄기' : '원본 음악·효과음 켜기';
  playCurrentBgm();
});
function selectTrackArtwork() {
  const name = trackChoice.value;
  trackCard.src = `./assets/tracks/${name}/xt_trackCard.png`;
  trackMinimap.src = `./assets/tracks/${name}/xt_minimap.png`;
  trackMapStatus.textContent = name;
  if (audioEnabled) playCurrentBgm();
}
trackChoice.addEventListener('change', selectTrackArtwork);
document.querySelector('#track-preview').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const viewing = await view.toggleTrackPreview(trackChoice.value);
    button.textContent = viewing ? '임시 주행장으로 돌아가기' : '선택한 원본 3D 트랙 보기';
    document.querySelector('.minimap').style.display = viewing ? 'none' : '';
    document.querySelector('.hud-tacho').style.display = viewing ? 'none' : '';
    document.querySelector('.hud-gauge').style.display = viewing ? 'none' : '';
    document.querySelector('.scene-label').firstChild.textContent = viewing ? 'ORIGINAL TRACK 3D ' : '3D TEST CIRCUIT ';
  } catch (error) {
    trackMapStatus.textContent = `3D 트랙 로딩 실패: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
for (const image of [trackCard, trackMinimap]) {
  image.addEventListener('error', () => { trackMapStatus.textContent = '원본 트랙 이미지 없음 · prepare-local-tracks.ps1 실행'; });
}
selectTrackArtwork();
const raceReadout = document.querySelector('#race-status');
const steerAngle = document.querySelector('#steer-angle');
const raceKartScale = document.querySelector('#race-kart-scale');
raceKartScale.value = localStorage.getItem('kart-race-scale') || '0.22';
document.querySelector('#race-kart-scale-value').textContent = raceKartScale.value;
raceKartScale.addEventListener('input', () => {
  localStorage.setItem('kart-race-scale', raceKartScale.value);
  document.querySelector('#race-kart-scale-value').textContent = raceKartScale.value;
});
const steerAngleNumber = document.querySelector('#steer-angle-number');
const steerValue = document.querySelector('#steer-value');
function applySteerAngle(syncNumber = true) {
  const value = Number(steerAngle.value);
  steerValue.textContent = `${value.toFixed(1)}°`;
  if (syncNumber) steerAngleNumber.value = value.toFixed(1);
  if (wasm) wasm.demo_set_steer_angle(value);
  localStorage.setItem('demo-steer-angle', String(value));
}
steerAngle.value = '10'; // Always begin with the source preset; slider changes are explicit.
steerAngle.addEventListener('input', applySteerAngle);
steerAngleNumber.value = Number(steerAngle.value).toFixed(1);
steerAngleNumber.addEventListener('input', () => {
  const value = Number(steerAngleNumber.value);
  if (!Number.isFinite(value) || value < 1 || value > 30) return;
  steerAngle.value = String(Math.max(1, Math.min(30, value)));
  applySteerAngle(false);
});
steerAngleNumber.addEventListener('blur', () => { steerAngleNumber.value = Number(steerAngle.value).toFixed(1); });
steerValue.textContent = `${Number(steerAngle.value).toFixed(1)}°`;
async function selectKart() {
  modelLabel.textContent = '원본 카트 메시 로딩 중';
  try {
    modelLabel.textContent = `${await view.setKart(kartChoice.value)} · 임시 주행장`;
  } catch (error) {
    modelLabel.textContent = `${error.message} · 임시 도형 카트`;
  }
}
kartChoice.addEventListener('change', selectKart);
selectKart();
function selectCharacter() {
  view.setCharacter(characterChoice.value).catch((error) => {
    modelLabel.textContent = `캐릭터 변환 파일 없음: ${error.message}`;
  });
}
characterChoice.addEventListener('change', selectCharacter);
selectCharacter();
physicsPreset.addEventListener('change', () => {
  if (!wasm) return;
  wasm.demo_set_preset(Number(physicsPreset.value));
  resetVisualState();
  wasm.demo_set_steer_angle(Number(steerAngle.value));
});
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false };
const input = createDemoInput(() => wasm, controls);
const keyMap = {
  KeyW: 'throttle', ArrowUp: 'throttle', Numpad8: 'throttle',
  KeyS: 'brake', ArrowDown: 'brake', Numpad2: 'brake',
  KeyA: 'left', ArrowLeft: 'left', Numpad4: 'left',
  KeyD: 'right', ArrowRight: 'right', Numpad6: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift', ControlLeft: 'boost', ControlRight: 'boost',
};
for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (event.code === 'KeyR' && type === 'keydown') {
      resetPreview();
      return;
    }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    input.set(control, type === 'keydown', event.code);
  });
}
window.addEventListener('blur', () => input.clear());
document.querySelector('#reset').addEventListener('click', resetPreview);
document.querySelector('#start-race').addEventListener('click', () => {
  if (!wasm || !statePointer) return;
  wasm.demo_start_race();
  wasm.demo_set_steer_angle(Number(steerAngle.value));
  currentState.set(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  previousState.set(currentState);
  visualState.set(currentState);
  view.resetCamera();
});
document.querySelector('#camera').addEventListener('click', (event) => {
  event.currentTarget.textContent = view.toggleCamera() ? '카메라: 위에서 보기' : '카메라: 추적 시점';
});
document.querySelector('#collision-wireframe').addEventListener('click', async (event) => {
  try { event.currentTarget.textContent = await view.toggleCollision() ? '충돌 메시: 표시' : '충돌 메시: 숨김'; }
  catch (error) { document.querySelector('#status').textContent = error.message; }
});
for (const button of document.querySelectorAll('[data-key]')) {
  const key = button.dataset.key;
  const set = (pressed) => { input.set(key, pressed, button); button.classList.toggle('active', pressed); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); set(true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => set(false));
}

let wasm;
let statePointer = 0;
let previousTime = 0;
let previousState;
let currentState;
let visualState;
function resetPreview() {
  if (!wasm || !statePointer) return;
  wasm.demo_reset();
  wasm.demo_set_steer_angle(Number(steerAngle.value));
  resetVisualState();
}
function resetVisualState() {
  currentState.set(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  previousState.set(currentState);
  visualState.set(currentState);
  view.resetCamera();
}
const telemetry = Object.fromEntries(['speed', 'gear', 'heading', 'yaw', 'drift', 'slip', 'linger', 'gauge', 'boost', 'instant', 'hits'].map((id) => [id, document.getElementById(id)]));
const hudSpeed = document.querySelector('#hud-speed');
const hudGaugeFill = document.querySelector('#hud-gauge-fill');

function draw(state, visual, frameDeltaMs) {
  const [, , heading, vx, vy, yawRate, speed, gauge, boost, drifting, , hits, linger, , , slip] = state;
  view.render(visual, frameDeltaMs);
  const signedSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
  telemetry.speed.textContent = Math.round(speed * 3.6);
  hudSpeed.textContent = String(Math.round(speed * 3.6));
  hudGaugeFill.style.width = `${Math.max(0, Math.min(100, gauge))}%`;
  telemetry.gear.textContent = signedSpeed < -0.5 ? 'R · 후진' : 'D · 전진';
  telemetry.heading.textContent = `${Math.round(heading * 180 / Math.PI)}°`;
  telemetry.yaw.textContent = `${Math.round(yawRate * 180 / Math.PI)}°/s`;
  telemetry.drift.textContent = drifting ? '켜짐' : '꺼짐';
  telemetry.slip.textContent = `${Math.round(slip)}°`;
  telemetry.linger.textContent = `${linger.toFixed(1)}초`;
  telemetry.gauge.textContent = `${Math.round(gauge)}%`;
  if (audioEnabled && drifting && !lastDrifting) {
    audio.drift.currentTime = 0;
    audio.drift.play().catch(() => {});
  }
  if (audioEnabled && boost > 0 && !lastBoosting) {
    audio.boost.currentTime = 0;
    audio.boost.play().catch(() => {});
  }
  lastDrifting = Boolean(drifting);
  lastBoosting = boost > 0;
  telemetry.boost.textContent = `${boost.toFixed(1)}초`;
  telemetry.instant.textContent = `${state[17].toFixed(1)}초`;
  telemetry.hits.textContent = Math.round(hits);
  const [phase, countdown, lap, gate, raceTime, finishTime] = state.slice(19, 25);
  raceReadout.textContent = phase === 1 ? `출발 ${Math.ceil(countdown)}`
    : phase === 2 ? `${Math.round(lap)}/3 LAP · ${raceTime.toFixed(2)}초 · 다음 체크포인트 ${Math.round(gate) + 1}/4`
      : phase === 3 ? `완주! ${finishTime.toFixed(2)}초` : '자유 주행';
}

function frame(time) {
  if (!previousTime) previousTime = time;
  const frameDeltaMs = demoElapsedMilliseconds(previousTime, time);
  previousTime = time;
  if (frameDeltaMs > 0) {
    wasm.demo_step(frameDeltaMs, +controls.throttle, +controls.brake,
      input.steering(), +controls.drift, +controls.boost);
    currentState.set(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  }
  visualState.set(currentState);
  draw(currentState, visualState, frameDeltaMs);
  requestAnimationFrame(frame);
}

try {
  const response = await fetch('./demo_physics.wasm?v=1', {cache: 'no-store'});
  if (!response.ok) throw new Error(`Wasm 다운로드 실패: ${response.status}`);
  const result = await WebAssembly.instantiate(await response.arrayBuffer(), {
    wasi_snapshot_preview1: { proc_exit: () => {}, random_get: () => 0 },
  });
  wasm = result.instance.exports;
  statePointer = wasm.demo_new();
  if (!statePointer) throw new Error('Wasm 상태 생성 실패');
  wasm.demo_set_steer_angle(Number(steerAngle.value));
  currentState = new Float32Array(new Float32Array(wasm.memory.buffer, statePointer, wasm.demo_state_count()));
  previousState = new Float32Array(currentState);
  visualState = new Float32Array(currentState);
  status.textContent = '데모 C 물리 / Wasm 실행 중';
  requestAnimationFrame(frame);
} catch (error) {
  status.textContent = `실행 실패: ${error.message}`;
  status.style.color = '#ff9090';
  console.error(error);
}
