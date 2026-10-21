import { createPreviewRenderer } from './render3d.js';
import { interpolatePreviewState } from './frame-interpolation.mjs';

const canvas = document.querySelector('#track');
const view = createPreviewRenderer(canvas);
const status = document.querySelector('#status');
const modelLabel = document.querySelector('#model-label');
const kartChoice = document.querySelector('#kart-choice');
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
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false, exceed: false };
const keyMap = {
  KeyW: 'throttle', ArrowUp: 'throttle', Numpad8: 'throttle',
  KeyS: 'brake', ArrowDown: 'brake', Numpad2: 'brake',
  KeyA: 'left', ArrowLeft: 'left', Numpad4: 'left',
  KeyD: 'right', ArrowRight: 'right', Numpad6: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift', ControlLeft: 'boost', ControlRight: 'boost', Space: 'exceed',
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
    controls[control] = type === 'keydown';
  });
}
window.addEventListener('blur', () => Object.keys(controls).forEach((key) => { controls[key] = false; }));
document.querySelector('#reset').addEventListener('click', resetPreview);
document.querySelector('#camera').addEventListener('click', (event) => {
  event.currentTarget.textContent = view.toggleCamera() ? '카메라: 위에서 보기' : '카메라: 추적 시점';
});
for (const button of document.querySelectorAll('[data-key]')) {
  const key = button.dataset.key;
  const set = (pressed) => { controls[key] = pressed; button.classList.toggle('active', pressed); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); set(true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => set(false));
}

let wasm;
let statePointer = 0;
let previousTime = 0;
let accumulator = 0;
let previousState;
let currentState;
let visualState;
function resetPreview() {
  if (!wasm || !statePointer) return;
  wasm.p5136_preview_reset(statePointer);
  currentState.set(new Float32Array(wasm.memory.buffer, statePointer, 19));
  previousState.set(currentState);
  visualState.set(currentState);
  view.resetCamera();
}
const telemetry = Object.fromEntries(['speed', 'gear', 'heading', 'yaw', 'drift', 'slip', 'linger', 'gauge', 'boost', 'exceed', 'hits'].map((id) => [id, document.getElementById(id)]));

function draw(state, visual, frameDeltaMs) {
  const [, , heading, vx, vy, yawRate, speed, gauge, boost, drifting, , hits, linger, , , slip] = state;
  view.render(visual, frameDeltaMs);
  const signedSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
  telemetry.speed.textContent = Math.round(speed * 3.6);
  telemetry.gear.textContent = signedSpeed < -0.5 ? 'R · 후진' : 'D · 전진';
  telemetry.heading.textContent = `${Math.round(heading * 180 / Math.PI)}°`;
  telemetry.yaw.textContent = `${Math.round(yawRate * 180 / Math.PI)}°/s`;
  telemetry.drift.textContent = drifting ? '켜짐' : '꺼짐';
  telemetry.slip.textContent = `${Math.round(slip)}°`;
  telemetry.linger.textContent = `${linger.toFixed(1)}초`;
  telemetry.gauge.textContent = `${Math.round(gauge)}%`;
  telemetry.boost.textContent = `${boost.toFixed(1)}초`;
  telemetry.exceed.textContent = `${state[17].toFixed(1)}초`;
  telemetry.hits.textContent = Math.round(hits);
}

function frame(time) {
  if (!previousTime) previousTime = time;
  const frameDeltaMs = Math.min(Math.max(time - previousTime, 0), 100);
  accumulator = Math.min(accumulator + frameDeltaMs, 100);
  previousTime = time;
  while (accumulator >= 16) {
    previousState.set(currentState);
    wasm.p5136_preview_step_v2(statePointer, 16, +controls.throttle, +controls.brake,
      (+controls.left) - (+controls.right), +controls.drift, +controls.boost, +controls.exceed);
    currentState.set(new Float32Array(wasm.memory.buffer, statePointer, 19));
    accumulator -= 16;
  }
  interpolatePreviewState(previousState, currentState, accumulator / 16, visualState);
  draw(currentState, visualState, frameDeltaMs);
  requestAnimationFrame(frame);
}

try {
  const response = await fetch('./p5136_wasm_core.wasm');
  if (!response.ok) throw new Error(`Wasm 다운로드 실패: ${response.status}`);
  const result = await WebAssembly.instantiate(await response.arrayBuffer());
  wasm = result.instance.exports;
  statePointer = wasm.p5136_preview_new();
  if (!statePointer) throw new Error('Wasm 상태 생성 실패');
  currentState = new Float32Array(new Float32Array(wasm.memory.buffer, statePointer, 19));
  previousState = new Float32Array(currentState);
  visualState = new Float32Array(currentState);
  status.textContent = '3D / Wasm 실행 중';
  requestAnimationFrame(frame);
} catch (error) {
  status.textContent = `실행 실패: ${error.message}`;
  status.style.color = '#ff9090';
  console.error(error);
}
