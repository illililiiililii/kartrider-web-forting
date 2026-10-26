import {createRaceSoundEvents} from './race-sound-events.mjs';

const source = {
  beach:'beach.ogg', village:'village.ogg', drift:'drift.ogg', boost:'boost.ogg', exceed:'exceed.ogg',
  count:'count_n.flac', go:'count_go.flac', finalLap:'final_lab.flac', raceOver:'race_over.flac',
  click:'click.flac', startButton:'startButton.flac', popup:'popup.flac',
};
const bgm = new Set(['beach','village']);
const volumes = {drift:.45,boost:.5,exceed:.28};

export function createRaceAudio({AudioClass=Audio, host=document.body}={}) {
  const sounds = Object.fromEntries(Object.entries(source).map(([name,file]) => {
    const audio = new AudioClass(`./assets/audio/${file}`);
    audio.id = `race-audio-${name}`;
    audio.preload = 'auto';
    audio.loop = bgm.has(name);
    host.append(audio);
    return [name,audio];
  }));
  let enabled=false, unlocked=false, drifting=false, boosting=false, exceeding=false;
  let bgmVolume=1, effectsVolume=1;
  const play = sound => {
    if (!unlocked || !sound) return;
    const result=sound.play();
    result?.catch(error => { if(!['NotAllowedError','AbortError'].includes(error.name))console.warn(`Original audio: ${sound.id}: ${error.message}`); });
  };
  const oneShot=name=>{const sound=sounds[name];if(!sound)return; sound.pause();sound.currentTime=0;play(sound);};
  const events=createRaceSoundEvents(name=>{
    if(!enabled)return;
    const soundName={'start-count':'count','start-go':'go','final-lap':'finalLap','race-finish':'raceOver'}[name];
    if(soundName)oneShot(soundName);
    // No verified general lap-complete or race-end 10-second sound mapping yet.
  });
  function setVolumes({music=bgmVolume,effects=effectsVolume}={}) {
    bgmVolume=Math.max(0,Math.min(1,Number(music)));
    effectsVolume=Math.max(0,Math.min(1,Number(effects)));
    for(const [name,sound] of Object.entries(sounds))sound.volume=(bgm.has(name)?bgmVolume:effectsVolume)*(volumes[name]??.5);
  }
  setVolumes();
  function stop() {
    enabled=drifting=boosting=exceeding=false;
    events.reset();
    for(const sound of Object.values(sounds)){sound.pause();sound.currentTime=0;}
  }
  return {
    unlock(){unlocked=true;},
    setVolumes,
    click(kind='click'){oneShot(kind==='start'?'startButton':kind==='popup'?'popup':'click');},
    start(track){
      stop();enabled=true;
      if(track.startsWith('village'))play(sounds.village);
      else if(track.startsWith('beach'))play(sounds.beach);
    },
    stop,
    update(state,totalLaps){
      if(!enabled)return;
      events.update(state,totalLaps);
      const drift=Boolean(state[9]),boost=state[8]>0||state[17]>0,exceed=Boolean(state[58]);
      if(exceed&&!exceeding)oneShot('exceed');
      if(!exceed&&exceeding)sounds.exceed.pause();
      if(drift&&!drifting)oneShot('drift');
      if(!drift&&drifting)sounds.drift.pause();
      if(boost&&!boosting)oneShot('boost');
      if(!boost&&boosting)sounds.boost.pause();
      drifting=drift;boosting=boost;exceeding=exceed;
    },
  };
}
