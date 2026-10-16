import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrivingState} from '../driving.js';
import {Progress} from '../physics.js';

const asset=new URL('../assets/',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',asset)));
test('every selectable kart, character and track has loadable assets',()=>{
 for(const k of catalog.karts)for(const file of ['model.ktrk','skin.png'])assert.ok(fs.existsSync(new URL(`karts/${k.id}/${file}`,asset)),`${k.id}/${file}`);
 for(const c of catalog.characters)assert.ok(fs.existsSync(new URL(`characters/${c.id}/face.png`,asset)),c.id);
 for(const t of catalog.tracks){for(const file of ['track.ktrk','textures.json','course.json','thumbnail.png','bgm.ogg'])assert.ok(fs.existsSync(new URL(`tracks/${t.id}/${file}`,asset)),`${t.id}/${file}`);const course=JSON.parse(fs.readFileSync(new URL(`tracks/${t.id}/course.json`,asset)));assert.equal(course.gates.length,t.gates);assert.ok(new Progress(course.gates,t.laps));}
});
test('steering creates lateral slip and drift changes handling',()=>{
 const a=new DrivingState(),b=new DrivingState();for(let i=0;i<360;i++){a.step(1/120,{forward:true,steer:i>180?1:0});b.step(1/120,{forward:true,steer:i>180?1:0,drift:i>180});}
 assert.ok(a.speed>20);assert.ok(Math.abs(a.heading)>.1);assert.ok(Math.abs(b.vs)>Math.abs(a.vs),'drift should have greater sideways velocity');assert.equal(b.mode,'drift');
 for(let i=0;i<180;i++)b.step(1/120,{forward:true});assert.equal(b.mode,'grip');assert.ok(Number.isFinite(b.vf)&&Number.isFinite(b.vs));
});
test('demo update cadence keeps the kart nose and drift trigger in the expected direction',()=>{
 const k=new DrivingState();let distanceY=0;
 for(let i=0;i<600;i++)distanceY+=k.step(.005,{forward:true}).dy;
 assert.ok(k.vf>0,'forward input must produce forward local velocity');
 assert.ok(distanceY>0,'heading zero must drive toward the visible kart nose');

 k.vf=20;
 k.step(.005,{forward:true,steer:1,drift:true});
 assert.equal(k.mode,'trigger');
 assert.equal(k.triggerTimer,.2);
 for(let i=0;i<40;i++)k.step(.005,{forward:true,steer:1,drift:true});
 assert.equal(k.mode,'drift','the trigger must transition into the demo linger phase');
 assert.ok(k.lingerTimer>0);

 const exit=new DrivingState();exit.vf=20;
 exit.step(.005,{forward:true,steer:1,drift:true});
 exit.step(.005,{forward:false,steer:1,drift:false});
 assert.equal(exit.instantWindow,.5,'a forward drift exit must offer the 0.5 second instant-boost input window');
});
test('timed launch boost gives a stronger start without consuming stored nitro',()=>{
 const normal=new DrivingState(),launch=new DrivingState();launch.startBoost(.8);
 for(let i=0;i<100;i++){normal.step(.005,{forward:true});launch.step(.005,{forward:true});}
 assert.ok(launch.vf>normal.vf*1.25,'launch boost must materially increase the initial drive force');
 assert.equal(launch.nitro,0);
});
