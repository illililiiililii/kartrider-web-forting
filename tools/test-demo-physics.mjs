import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const module = new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm', import.meta.url)));
function create() {
  const api = new WebAssembly.Instance(module, {
    wasi_snapshot_preview1: { proc_exit: () => {}, random_get: () => 0 },
  }).exports;
  const pointer = api.demo_new();
  return { api, state: new Float32Array(api.memory.buffer, pointer, 40) };
}

test('demo C physics accelerates with its 5ms substeps and stays finite', () => {
  const { api, state } = create();
  for (let i = 0; i < 100; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  assert.ok(state[6] > 35 && state[6] < 50);
  assert.equal(state[16], 4); // 5 + 5 + 5 + 1 ms in upstream C.
  assert.ok([...state].every(Number.isFinite));
});

test('max steer angle slider changes the C dynamics config', () => {
  function heading(angle) {
    const { api, state } = create();
    api.demo_set_steer_angle(angle);
    for (let i = 0; i < 35; i++) api.demo_step(16, 1, 0, 0, 0, 0);
    for (let i = 0; i < 25; i++) api.demo_step(16, 1, 0, 1, 0, 0);
    return state[2];
  }
  assert.ok(heading(5) < heading(10));
  assert.ok(heading(10) < heading(20));
});

test('upstream speed attenuation reduces steering angle without changing the slider', () => {
  function steerAfterAcceleration(steps) {
    const { api, state } = create();
    api.demo_set_steer_angle(10);
    for (let i = 0; i < steps; i++) api.demo_step(16, 1, 0, 0, 0, 0);
    const speed = state[6];
    api.demo_step(16, 0, 0, 1, 0, 0);
    return { speed, angle: state[13] * 180 / Math.PI };
  }
  const slow = steerAfterAcceleration(0);
  const medium = steerAfterAcceleration(30);
  const fast = steerAfterAcceleration(60);
  assert.ok(slow.angle > medium.angle && medium.angle > fast.angle);
  assert.ok(Math.abs(slow.angle - 10) < 0.01);
  assert.ok(medium.speed > 15 && fast.speed > 29);
  assert.ok(fast.angle > 3 && fast.angle < 4);
});

test('demo kart presets change acceleration without altering C formulas', () => {
  function speed(preset) {
    const { api, state } = create();
    api.demo_set_preset(preset);
    for (let i = 0; i < 35; i++) api.demo_step(16, 1, 0, 0, 0, 0);
    return state[6];
  }
  assert.ok(speed(0) < speed(20));
});

test('drift changes C state and rear-slip gauge, walls remain bounded', () => {
  const { api, state } = create();
  for (let i = 0; i < 30; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  for (let i = 0; i < 40; i++) api.demo_step(16, 1, 0, 1, 1, 0);
  assert.equal(state[9], 1);
  assert.ok(state[7] > 0);
  api.demo_reset();
  for (let i = 0; i < 1500; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  assert.ok(state[0] <= 78);
  assert.ok(state[11] <= 3);
});

test('upstream gauge banks a booster only after drift ends, then Ctrl spends it', () => {
  const { api, state } = create();
  for (let i = 0; i < 30; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  for (let i = 0; i < 500 && state[7] < 100; i++) api.demo_step(16, 1, 0, 1, 1, 0);
  assert.equal(state[7], 100);
  assert.equal(state[32], 0);
  for (let i = 0; i < 100 && state[32] === 0; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  assert.equal(state[32], 1);
  assert.equal(state[7], 0);
  api.demo_step(16, 1, 0, 0, 0, 1);
  assert.ok(state[8] > 2.9);
  assert.equal(state[32], 0);
});

test('recovered 7-second countdown blocks driving and grants precisely timed start boost', () => {
  const { api, state } = create();
  api.demo_start_race();
  const x = state[0];
  for (let i = 0; i < 432; i++) api.demo_step(16, 0, 0, 0, 0, 0);
  assert.equal(state[0], x);
  assert.equal(state[19], 1);
  api.demo_step(16, 1, 0, 0, 0, 0);
  assert.ok(state[8] > 0.99);
  for (let i = 0; i < 14; i++) api.demo_step(16, 1, 0, 0, 0, 0);
  assert.equal(state[19], 2);
  api.demo_step(16, 1, 0, 0, 0, 0);
  assert.ok(state[23] > 0);
});

test('original demo course tables build their gate graph in Wasm', () => {
  const { api, state } = create();
  const pointer = state.byteOffset;
  assert.equal(api.demo_set_course(11), 1); // village_R01 in source data
  const refreshed = new Float32Array(api.memory.buffer, pointer, 40);
  api.demo_step(16, 0, 0, 0, 0, 0);
  assert.ok(refreshed[39] >= 0);
  api.demo_clear_course();
  api.demo_step(16, 0, 0, 0, 0, 0);
  assert.equal(refreshed[39], -1);
});

test('recovered steering input gives the last pressed direction ownership', () => {
  const { api } = create();
  api.demo_steering_event(-1, 1);
  assert.equal(api.demo_steering_value(), -1);
  api.demo_steering_event(1, 1);
  assert.equal(api.demo_steering_value(), 1);
  api.demo_steering_event(-1, 0);
  assert.equal(api.demo_steering_value(), 1);
  api.demo_steering_event(1, 0);
  assert.equal(api.demo_steering_value(), 0);
});

const localTrack = new URL('../web-preview/assets/usd/beach_I01/collision.ktrk', import.meta.url);
test('local original track collision loads and keeps the practice timer separate from synthetic gates',
  { skip: !existsSync(localTrack) }, () => {
    const { api, state } = create();
    const statePointer = state.byteOffset;
    const bytes = readFileSync(localTrack);
    const pointer = api.demo_track_alloc(bytes.length);
    assert.ok(pointer);
    new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
    assert.ok(api.demo_track_load(pointer, bytes.length) > 1000);
    api.demo_track_free_buffer(pointer);
    const trackState = new Float32Array(api.memory.buffer, statePointer, 40);
    const height = api.demo_track_ground_height(-120, 98, 80);
    assert.ok(height > 30 && height < 40);
    assert.equal(api.demo_track_enable(-120, 98, height, 0), 1);
    api.demo_start_race();
    for (let i = 0; i < 440; i++) api.demo_step(16, 1, 0, 0, 0, 0);
    assert.equal(trackState[19], 2);
    assert.ok(trackState[23] > 0);
    assert.equal(trackState[21], 1);
  });

test('idle kart does not creep across an imported near-flat original track',
  { skip: !existsSync(localTrack) }, () => {
    const { api, state } = create();
    const statePointer = state.byteOffset;
    const bytes = readFileSync(localTrack);
    const pointer = api.demo_track_alloc(bytes.length);
    new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
    assert.ok(api.demo_track_load(pointer, bytes.length) > 1000);
    api.demo_track_free_buffer(pointer);
    const trackState = new Float32Array(api.memory.buffer, statePointer, 40);
    const height = api.demo_track_ground_height(-120, 98, 80);
    assert.ok(Math.abs(api.demo_track_ground_normal(-120, 98, 80, 0)) < 0.02);
    assert.equal(api.demo_track_enable(-120, 98, height, 0), 1);
    api.demo_start_race();
    for (let i = 0; i < 30000; i++) api.demo_step(16, 0, 0, 0, 0, 0);
    assert.ok(Math.abs(trackState[0] + 120) < 0.5, `idle x=${trackState[0]}`);
    assert.ok(Math.abs(trackState[1] - 98) < 0.5, `idle y=${trackState[1]}`);
    assert.ok(trackState[6] < 0.1, `idle speed=${trackState[6]}`);
  });
