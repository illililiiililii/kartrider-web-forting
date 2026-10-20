const canvas = document.querySelector('#track');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const controls = { throttle: false, brake: false, left: false, right: false, drift: false, boost: false };
const keyMap = {
  KeyW: 'throttle', ArrowUp: 'throttle', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'boost',
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
const telemetry = Object.fromEntries(['speed', 'heading', 'yaw', 'drift', 'slip', 'linger', 'gauge', 'boost', 'hits'].map((id) => [id, document.getElementById(id)]));

function draw(state) {
  const [x, y, heading, vx, vy, yawRate, speed, gauge, boost, drifting, , hits, linger, , , slip] = state;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#203840'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#638d83'; ctx.lineWidth = 2;
  const scale = Math.min((w - 50) / 160, (h - 50) / 160);
  const sx = (value) => w / 2 + value * scale;
  const sy = (value) => h / 2 - value * scale;
  for (let i = -80; i <= 80; i += 20) {
    ctx.beginPath(); ctx.moveTo(sx(i), sy(-80)); ctx.lineTo(sx(i), sy(80)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx(-80), sy(i)); ctx.lineTo(sx(80), sy(i)); ctx.stroke();
  }
  ctx.strokeStyle = '#e6a56c'; ctx.lineWidth = 8;
  ctx.strokeRect(sx(-80), sy(80), 160 * scale, 160 * scale);
  const px = sx(x); const py = sy(y);
  ctx.strokeStyle = '#92c9ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + vx * 2, py - vy * 2); ctx.stroke();
  ctx.save(); ctx.translate(px, py); ctx.rotate(-heading);
  ctx.fillStyle = boost > 0 ? '#ffd458' : drifting ? '#ff82ad' : '#81c7ff';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-13, -10); ctx.lineTo(-8, 0); ctx.lineTo(-13, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  telemetry.speed.textContent = Math.round(speed * 3.6);
  telemetry.heading.textContent = `${Math.round(heading * 180 / Math.PI)}°`;
  telemetry.yaw.textContent = `${Math.round(yawRate * 180 / Math.PI)}°/s`;
  telemetry.drift.textContent = drifting ? '켜짐' : '꺼짐';
  telemetry.slip.textContent = `${Math.round(slip)}°`;
  telemetry.linger.textContent = `${linger.toFixed(1)}초`;
  telemetry.gauge.textContent = `${Math.round(gauge)}%`;
  telemetry.boost.textContent = `${boost.toFixed(1)}초`;
  telemetry.hits.textContent = Math.round(hits);
}

function frame(time) {
  if (!previousTime) previousTime = time;
  accumulator = Math.min(accumulator + Math.min(time - previousTime, 100), 100);
  previousTime = time;
  while (accumulator >= 16) {
    wasm.p5136_preview_step(statePointer, 16, +controls.throttle, +controls.brake,
      (+controls.left) - (+controls.right), +controls.drift, +controls.boost);
    accumulator -= 16;
  }
  draw(new Float32Array(wasm.memory.buffer, statePointer, 16));
  requestAnimationFrame(frame);
}

try {
  const response = await fetch('./p5136_wasm_core.wasm');
  if (!response.ok) throw new Error(`Wasm 다운로드 실패: ${response.status}`);
  const result = await WebAssembly.instantiate(await response.arrayBuffer());
  wasm = result.instance.exports;
  statePointer = wasm.p5136_preview_new();
  if (!statePointer) throw new Error('Wasm 상태 생성 실패');
  status.textContent = 'Wasm 실행 중';
  requestAnimationFrame(frame);
} catch (error) {
  status.textContent = `실행 실패: ${error.message}`;
  status.style.color = '#ff9090';
  console.error(error);
}
