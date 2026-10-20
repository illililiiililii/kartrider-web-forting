import { createPreviewRenderer } from './render3d.js';

const canvas = document.querySelector('#track');
const view = createPreviewRenderer(canvas);
const status = document.querySelector('#status');
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false, exceed: false };
const keyMap = {
  KeyW: 'throttle', ArrowUp: 'throttle', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Numpad8: 'throttle', Numpad2: 'brake', Numpad4: 'left', Numpad6: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift', ControlLeft: 'boost', ControlRight: 'boost',
  Space: 'exceed',
};
for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (event) => {
    if (event.code === 'KeyR' && type === 'keydown') {
      if (wasm && statePointer) wasm.p5136_preview_reset(statePointer);
      return;
    }
    const control = keyMap[event.code];
    if (!control) return;
    event.preventDefault();
    controls[control] = type === 'keydown';
  });
}
window.addEventListener('blur', () => Object.keys(controls).forEach((key) => { controls[key] = false; }));
document.querySelector('#reset').addEventListener('click', () => wasm?.p5136_preview_reset(statePointer));
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
const telemetry = Object.fromEntries(['speed', 'gear', 'heading', 'yaw', 'drift', 'slip', 'linger', 'gauge', 'boost', 'exceed', 'height', 'grounded', 'hits'].map((id) => [id, document.getElementById(id)]));
const speedVeil = document.querySelector('#speed-veil');
const speedBar = document.querySelector('#speed-bar');

function draw(state) {
  const [, , heading, vx, vy, yawRate, speed, gauge, boost, drifting, , hits, linger, , , slip,
    , height, , grounded, exceed] = state;
  view.render(state);
  const signedSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
  telemetry.speed.textContent = Math.round(speed * 3.6);
  telemetry.gear.textContent = signedSpeed < -0.5 ? 'R · 후진' : 'D · 전진';
  telemetry.heading.textContent = `${Math.round(heading * 180 / Math.PI)}°`;
  telemetry.yaw.textContent = `${Math.round(yawRate * 180 / Math.PI)}°/s`;
  telemetry.drift.textContent = drifting ? '켜짐' : '꺼짐';
  telemetry.slip.textContent = `${Math.round(slip)}°`;
  telemetry.linger.textContent = `${linger.toFixed(1)}초`;
  telemetry.gauge.textContent = `${Math.round(gauge / 3810 * 100)}%`;
  telemetry.boost.textContent = `${boost.toFixed(1)}초`;
  telemetry.exceed.textContent = `${exceed.toFixed(1)}초`;
  telemetry.height.textContent = `${height.toFixed(1)} m`;
  telemetry.grounded.textContent = grounded ? '접지' : '공중';
  telemetry.hits.textContent = Math.round(hits);
  const speedRatio = Math.min(speed / 55, 1);
  speedVeil.style.opacity = (speedRatio * 0.54).toFixed(2);
  speedBar.style.width = `${Math.round(speedRatio * 100)}%`;
}

function frame(time) {
  if (!previousTime) previousTime = time;
  accumulator = Math.min(accumulator + Math.min(time - previousTime, 100), 100);
  previousTime = time;
  while (accumulator >= 16) {
    wasm.p5136_preview_step_v2(statePointer, 16, +controls.throttle, +controls.brake,
      (+controls.left) - (+controls.right), +controls.drift, +controls.boost, +controls.exceed);
    accumulator -= 16;
  }
  draw(new Float32Array(wasm.memory.buffer, statePointer, 23));
  requestAnimationFrame(frame);
}

try {
  const response = await fetch('./p5136_wasm_core.wasm');
  if (!response.ok) throw new Error(`Wasm 다운로드 실패: ${response.status}`);
  const result = await WebAssembly.instantiate(await response.arrayBuffer());
  wasm = result.instance.exports;
  statePointer = wasm.p5136_preview_new();
  if (!statePointer) throw new Error('Wasm 상태 생성 실패');
  status.textContent = '3D / Wasm 실행 중';
  requestAnimationFrame(frame);
} catch (error) {
  status.textContent = `실행 실패: ${error.message}`;
  status.style.color = '#ff9090';
  console.error(error);
}
