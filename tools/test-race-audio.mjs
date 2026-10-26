import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRaceSoundEvents} from '../web-preview/race-sound-events.mjs';
import {createRaceAudio} from '../web-preview/race-audio.mjs';

const state=(phase,countdown=0,lap=1)=>{const values=Array(62).fill(0);values[19]=phase;values[20]=countdown;values[21]=lap;return values;};

test('race state drives countdown, GO, completed laps, final lap and one finish',()=>{
  const events=[],detector=createRaceSoundEvents((name,value)=>events.push([name,value]));
  for(const value of [state(1,3),state(1,2),state(1,1),state(2,0,1),state(2,0,1),state(2,0,2),state(2,0,3),state(3,0,4),state(3,0,4)])detector.update(value,3);
  assert.deepEqual(events,[
    ['start-count',3],['start-count',2],['start-count',1],['start-go',undefined],
    ['lap-complete',1],['lap-complete',2],['final-lap',undefined],['race-finish',undefined],
  ]);
  detector.reset();detector.update(state(1,3),3);
  assert.deepEqual(events.at(-1),['start-count',3]);
});

test('gates, repeated multiplayer frames and elapsed race time do not trigger laps or an invented ten-second timer',()=>{
  const events=[],detector=createRaceSoundEvents(name=>events.push(name));
  detector.update(state(2,0,1),3);
  const same=state(2,0,1);
  for(let i=0;i<100;i++){same[22]=i;same[23]=i;detector.update(same,3);}
  assert.deepEqual(events,[]);
});

test('original media is cached, gated by user input, volume separated and reset between races',()=>{
  const players=[];
  class FakeAudio {
    constructor(url){this.url=url;this.plays=0;this.pauses=0;this.currentTime=0;players.push(this);}
    play(){this.plays++;return Promise.resolve();}
    pause(){this.pauses++;}
  }
  const audio=createRaceAudio({AudioClass:FakeAudio,host:{append(){}}});
  const named=name=>players.find(player=>player.id==='race-audio-'+name);
  audio.start('beach_I01');
  audio.update(state(1,3),3);
  assert.equal(named('count').plays,0);
  audio.unlock();
  audio.start('beach_I01');
  audio.click('start');audio.click();
  assert.equal(named('startButton').plays,1);
  assert.equal(named('click').plays,1);
  audio.setVolumes({music:.2,effects:.8});
  assert.equal(named('beach').volume,.1);
  assert.equal(named('click').volume,.4);
  audio.update(state(1,3),3);audio.update(state(1,2),3);audio.update(state(1,1),3);
  audio.update(state(2),3);audio.update(state(2,0,2),3);audio.update(state(2,0,3),3);
  audio.update(state(3,0,4),3);audio.update(state(3,0,4),3);
  assert.equal(named('count').plays,3);
  assert.equal(named('go').plays,1);
  assert.equal(named('finalLap').plays,1);
  assert.equal(named('raceOver').plays,1);
  audio.stop();audio.start('village_R01');audio.update(state(1,3),2);
  assert.equal(named('count').plays,4);
  assert.equal(named('raceOver').currentTime,0);
});

test('committed map documents absent general lap and race-end warning sources; prepared audio remains ignored',()=>{
  const map=JSON.parse(readFileSync(new URL('../web-preview/audio-map.json',import.meta.url)));
  const entry=name=>map.entries.find(row=>row.event===name);
  assert.equal(entry('lap-complete').source,null);
  assert.equal(entry('race-end-ten-seconds').source,null);
  assert.ok(existsSync(new URL('../.gitignore',import.meta.url)));
});
