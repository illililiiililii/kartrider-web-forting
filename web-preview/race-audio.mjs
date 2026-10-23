// Same local originals/levels as debug.js; race start supplies the user gesture.
export function createRaceAudio() {
  const sounds = Object.fromEntries(['beach', 'village', 'drift', 'boost'].map(name => {
    const audio = new Audio(`./assets/audio/${name}.ogg`);
    audio.id = `race-audio-${name}`;
    audio.preload = 'auto';
    audio.volume = name === 'drift' ? 0.45 : name === 'boost' ? 0.5 : 0.28;
    audio.loop = name === 'beach' || name === 'village';
    document.body.append(audio);
    return [name, audio];
  }));
  let enabled = false, drifting = false, boosting = false;
  const play = sound => sound.play().catch(error => console.warn(`Original audio: ${sound.id}: ${error.message}`));
  function stop() {
    enabled = drifting = boosting = false;
    for (const sound of Object.values(sounds)) { sound.pause(); sound.currentTime = 0; }
  }
  return {
    start(track) {
      stop(); enabled = true;
      if(track.startsWith('village'))play(sounds.village);
      else if(track.startsWith('beach'))play(sounds.beach);
    },
    stop,
    update(state) {
      if (!enabled) return;
      const drift = Boolean(state[9]), boost = state[8] > 0 || state[17] > 0;
      if (drift && !drifting) { sounds.drift.currentTime = 0; play(sounds.drift); }
      if (!drift && drifting) sounds.drift.pause();
      if (boost && !boosting) { sounds.boost.currentTime = 0; play(sounds.boost); }
      if (!boost && boosting) sounds.boost.pause();
      drifting = drift; boosting = boost;
    },
  };
}
