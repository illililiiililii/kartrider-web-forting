// The C/Wasm race state, rather than a HUD animation, owns these transitions.
export function createRaceSoundEvents(emit) {
  let previous = null;
  return {
    reset() { previous = null; },
    update(state, totalLaps) {
      const phase = Math.round(state[19]);
      const digit = phase === 1 && state[20] > 0 && state[20] <= 3 ? Math.ceil(state[20]) : 0;
      const lap = Math.max(1, Math.round(state[21]));
      if (phase === 1 && digit && digit !== previous?.digit) emit('start-count', digit);
      if (phase === 2 && previous?.phase === 1) emit('start-go');
      if (phase === 2 && previous?.phase === 2 && lap > previous.lap) {
        emit('lap-complete', lap - 1);
        if (lap === totalLaps) emit('final-lap');
      }
      if (phase === 3 && previous?.phase !== 3) emit('race-finish');
      previous = {phase, digit, lap};
    },
  };
}
