// C world (X,Y,Z up) -> Three world (X,Z,-Y). C owns chase smoothing/FOV.
export function readChasePose(state) {
  return {
    position: [state[25], state[27], -state[26]],
    forward: [state[28], state[30], -state[29]],
    up: [state[40] ?? 0, state[42] ?? 1, -(state[41] ?? 0)],
    fov: state[31],
  };
}
