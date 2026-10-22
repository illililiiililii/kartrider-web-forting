// Rendering-only interpolation. Never feed this smoothed state back to Wasm.
export function interpolatePreviewState(previous, current, alpha, output) {
  output.set(current);
  const t = Math.max(0, Math.min(1, alpha));
  for (const index of [0, 1, 2, 3, 4, 6, 14, 25, 26, 27, 28, 29, 30, 31]) {
    output[index] = previous[index] + (current[index] - previous[index]) * t;
  }
  for (const index of [40, 41, 42]) {
    if (index < output.length) output[index] = previous[index] + (current[index] - previous[index]) * t;
  }
  return output;
}
