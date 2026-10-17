import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrivingState} from '../driving.js';
import {Progress} from '../physics.js';

const asset=new URL('../assets/',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',asset)));
const flatGround=(origin)=>({point:[origin[0],origin[1],0],normal:[0,0,1]});
const onTrack=(stats={})=>{const k=new DrivingState(stats);k.reset({z:0});return k;};
test('every selectable kart, character and track has loadable assets',()=>{
 for(const k of catalog.karts)for(const file of ['model.ktrk','skin.png'])assert.ok(fs.existsSync(new URL(`karts/${k.id}/${file}`,asset)),`${k.id}/${file}`);
 for(const c of catalog.characters)assert.ok(fs.existsSync(new URL(`characters/${c.id}/face.png`,asset)),c.id);
 for(const t of catalog.tracks){for(const file of ['track.ktrk','textures.json','course.json','thumbnail.png','bgm.ogg'])assert.ok(fs.existsSync(new URL(`tracks/${t.id}/${file}`,asset)),`${t.id}/${file}`);const course=JSON.parse(fs.readFileSync(new URL(`tracks/${t.id}/course.json`,asset)));assert.equal(course.gates.length,t.gates);assert.ok(new Progress(course.gates,t.laps));}
});
test('the original local forward axis maps to the visible nose and ground contacts support the chassis',()=>{
 const k=onTrack();let y=0;for(let i=0;i<100;i++)y+=k.step(.005,{forward:true,groundQuery:flatGround}).dy;
 assert.ok(k.vf>0);assert.ok(y>0);assert.equal(k.lastContacts,4);assert.ok(Math.abs(k.position[2])<.06,'flat suspension should settle around static equilibrium');
 const turn=new DrivingState();turn.reset({heading:.7});assert.ok(Math.abs(turn.heading-.7)<1e-8);
});
test('airborne motion uses recovered gravity and has no ground-drive force',()=>{
 const k=new DrivingState();const m=k.step(.002,{forward:true,groundQuery:()=>null});assert.ok(Math.abs(k.linearVelocity[2]+.1176)<1e-8);assert.equal(k.vf,0);assert.equal(m.grounded,false);
});
test('landing compression and rebound follow the recovered one-sided suspension damping',()=>{
 const landing=onTrack();landing.reset({z:.2});landing.step(.002,{groundQuery:flatGround});
 assert.ok(landing.linearVelocity[2]<0,'compression must not create an upward damping spike');
 const rebound=onTrack();rebound.wheelCompression.fill(.6);rebound.step(.002,{groundQuery:flatGround});
 assert.ok(Math.abs(rebound.linearVelocity[2]+.1176)<1e-6,'negative rebound force must be discarded');
});
test('reverse input stops a nearly stationary kart and engages immediately while moving backward',()=>{
 const stopped=onTrack();stopped.vf=.2;stopped.vs=.1;stopped.step(.005,{reverse:true,groundQuery:flatGround});
 assert.ok(Math.abs(stopped.vf)<1e-7);assert.ok(Math.abs(stopped.vs)<.02,'the lateral tire force can act after the velocity reset');
 const backing=onTrack();backing.vf=-1;backing.step(.005,{reverse:true,groundQuery:flatGround});
 assert.ok(backing.vf<-1);
});
test('steering and drift produce tire slip and angular response on a grounded kart',()=>{
 const grip=onTrack(),drift=onTrack();for(let i=0;i<300;i++){const steer=i>180?1:0;grip.step(.005,{forward:true,steer,groundQuery:flatGround});drift.step(.005,{forward:true,steer,drift:i>180,groundQuery:flatGround});}
 assert.ok(grip.speed>5);assert.ok(Math.abs(grip.heading)>.01);assert.ok(Math.abs(drift.vs)>Math.abs(grip.vs));assert.ok(['drift','trigger'].includes(drift.mode));
});
test('P5136 automatic lateral slip starts only above its 15-unit planar-speed gate',()=>{
 const slow=onTrack(),fast=onTrack(),vertical=onTrack();slow.vs=10;fast.vs=20;vertical.vs=4;vertical.linearVelocity[2]=20;
 slow.step(.002,{groundQuery:flatGround});fast.step(.002,{groundQuery:flatGround});vertical.step(.002,{drift:true,groundQuery:flatGround});
 assert.equal(slow.slipDetected,false);assert.equal(slow.mode,'grip');
 assert.equal(fast.slipDetected,true);assert.equal(fast.mode,'drift');
 assert.equal(vertical.mode,'grip','vertical speed must not bypass the planar 5-unit gate');
});
test('P5136 accepts up to 500 ms of elapsed time as 2 ms physics substeps',()=>{
 const delayed=onTrack(),incremental=onTrack(),input={forward:true,groundQuery:flatGround};
 delayed.step(.5,input);for(let i=0;i<250;i++)incremental.step(.002,input);
 assert.ok(Math.abs(delayed.position[1]-incremental.position[1])<1e-6);
 assert.ok(Math.abs(delayed.vf-incremental.vf)<1e-6);
});
test('P5136 BodyParam values compose with recovered dynamics defaults',()=>{
 const c=new DrivingState({ForwardAccelForce:154,DragFactor:-.084,SteerConstraint:3.06,DriftEscapeForce:2210,StartForwardAccelFactorSpeed:1.8,StartBoosterTimeSpeed:1400,BoostAccelFactor:1.54,NormalBoosterTime:65}).config();
 assert.equal(c.forward,2304);assert.equal(c.drag,.666);assert.equal(c.steerConstraint,25.31);assert.equal(c.escape,4810);assert.equal(c.startBoosterTime,1.4);assert.equal(c.startAccelFactor,1.8);assert.equal(c.normalBoosterTime,2.965);assert.equal(c.boostAccel,1.534);assert.equal(c.triggerFactor,.2);assert.equal(c.triggerTime,.2);assert.equal(c.gripBrake,2070);assert.equal(c.slipBrake,1415);assert.ok(Math.abs(c.startForwardForce-(2304*1.8-191.644))<1e-9);
});
test('the recovered launch boost uses the selected kart duration and force',()=>{
 const normal=onTrack({ForwardAccelForce:154}),launch=onTrack({ForwardAccelForce:154,StartForwardAccelFactorSpeed:1.8,StartBoosterTimeSpeed:1400});launch.startBoost(launch.config().startBoosterTime);
 for(let i=0;i<50;i++){normal.step(.005,{forward:true,groundQuery:flatGround});launch.step(.005,{forward:true,groundQuery:flatGround});}
 assert.ok(launch.vf>normal.vf*1.4);assert.ok(Math.abs(launch.startBoostTime-1.15)<1e-8);
});
test('wheel contacts follow chassis orientation and collision response removes incoming velocity',()=>{
 const k=onTrack();k.reset({z:0,heading:Math.PI/2});k.step(.005,{groundQuery:flatGround});assert.equal(k.lastContacts,4);
 k.linearVelocity=[10,0,0];k.step(.005,{bodyContacts:[[-1,0,0]],groundQuery:flatGround});assert.ok(k.linearVelocity[0]<10);
});
test('a swept wall hit stops chassis penetration without losing ground or vertical motion',()=>{
 const k=onTrack();k.linearVelocity=[8,0,0];
 const wall=(from,to)=>to[0]>=.02?{normal:[-1,0,0],fraction:Math.max(0,(.02-from[0])/(to[0]-from[0]))}:null;
 for(let i=0;i<50;i++)k.step(.005,{groundQuery:flatGround,bodySweep:wall});
 assert.ok(k.position[0]<.035,`chassis passed through wall at ${k.position[0]}`);
 assert.ok(Math.abs(k.position[2])<.06,'wall collision must preserve suspension ground contact');
 assert.equal(k.lastContacts,4);
 const falling=new DrivingState();falling.reset({z:2});falling.linearVelocity=[8,0,-3];falling.step(.005,{bodySweep:wall});
 assert.ok(falling.linearVelocity[2]<-3,'horizontal wall impulse must not reverse gravity');
});
