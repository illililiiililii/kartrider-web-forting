import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolatePreviewState } from '../web-preview/frame-interpolation.mjs';

test('render state moves smoothly between fixed Wasm steps', () => {
  const a = new Float32Array(19);
  const b = new Float32Array(19);
  const output = new Float32Array(19);
  b[0] = 16;
  b[1] = 8;
  b[2] = 2;
  b[9] = 1; // discrete drift flag must not be blended
  interpolatePreviewState(a, b, 0.25, output);
  assert.equal(output[0], 4);
  assert.equal(output[1], 2);
  assert.equal(output[2], 0.5);
  assert.equal(output[9], 1);
});

test('render state clamps delayed-frame interpolation', () => {
  const a = new Float32Array(19);
  const b = new Float32Array(19);
  const output = new Float32Array(19);
  b[0] = 10;
  interpolatePreviewState(a, b, -1, output);
  assert.equal(output[0], 0);
  interpolatePreviewState(a, b, 2, output);
  assert.equal(output[0], 10);
});
