import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {contact,resolvePlayers} from '../peer-collision.mjs';
import {courseDistances,rankPlayers} from '../race-ranking.mjs';
import {createRacePhysicsFactory} from '../server-physics.mjs';
import {spriteRect} from '../web-preview/rank-board.mjs';

const body=(center,q=[1,0,0,0])=>({center,q,half:[1,2,.5],active:true,mass:100,velocity:[0,0,0]});
test('3D fitted boxes separate walls, bridge levels and inactive/reset racers',()=>{
  assert.ok(contact(body([0,0,0]),body([1.9,0,0])));
  assert.equal(contact(body([0,0,0]),body([2.1,0,0])),null);
  assert.equal(contact(body([0,0,0]),body([0,0,1.1])),null);
  assert.equal(contact({...body([0,0,0]),active:false},body([0,0,0])),null);
  const turn=[Math.SQRT1_2,0,0,Math.SQRT1_2];
  assert.ok(contact(body([0,0,0],turn),body([2.9,0,0])));
  assert.equal(contact(body([0,0,0],turn),body([3.1,0,0])),null);
});
test('swept contacts stop fast crossing, keeping the entry side inside and beyond a box',()=>{
  for(const x of [1,5]){
    const hit=contact(body([x,0,0]),body([0,0,0]),[-5,0,0],[0,0,0]);
    assert.ok(hit);assert.deepEqual(hit.normal.map(v=>v||0),[-1,0,0]);assert.equal(hit.depth,2+x);
  }
  assert.equal(contact(body([5,0,3]),body([0,0,0]),[-5,0,3],[0,0,0]),null);
});
test('rank follows graph distance, branches, start crossing, laps, finishes and slot ties',()=>{
  const progress=courseDistances([{length:10,next:[1,2]},{length:20,next:[3]},{length:30,next:[3]},{length:10,next:[0]}],0);
  assert.ok(progress(1,0,0)>progress(0,3,9));assert.ok(progress(2,0,0)>progress(1,3,9));
  assert.ok(progress(1,1,10)>progress(1,2,10));
  const members=new Map([['a',{slot:0,finished:false}],['b',{slot:1,finished:false}],['c',{slot:2,finished:true,time:120}]]);
  assert.deepEqual(rankPlayers([{id:'a',progress:.2},{id:'b',progress:.4},{id:'c',progress:0}],members).map(p=>[p.id,p.rank]),[['c',1],['b',2],['a',3]]);
  const open=courseDistances([{length:10,next:[1]},{length:20,next:[]}],0);
  assert.ok(open(1,1,10)>open(1,0,9));
  assert.throws(()=>courseDistances([{length:0,next:[]}],0),/UNAVAILABLE/);
});
test('original rank atlas wraps rank 8 onto the second row without another digit image',()=>{
  assert.deepEqual(spriteRect({size:[512,160],attributes:{fontSize:'64 80',fontStr:'0123456789'}},8),{w:64,h:80,x:0,y:80});
});
test('real WASM pair uses fitted sizes and native response with momentum sharing; no contact before GO',()=>{
  const root=resolve(import.meta.dirname,'../web-preview'),catalog=JSON.parse(readFileSync(join(root,'assets/catalog.json')));
  const factory=createRacePhysicsFactory(root,catalog),a=factory.create({track:'beach_I01',kart:'practiceV1',slot:0}),b=factory.create({track:'beach_I01',kart:'cottonV1',slot:1});
  assert.equal(a.body().active,false);const before=a.body().center;a.apply([0,0,0,0,0,0,100,0,0]);assert.deepEqual(a.body().center,before);
  const input={throttle:false,brake:false,steer:0,drift:false,boost:false,exceed:false};
  for(let i=0;i<150;i++){a.step(input);b.step(input);}
  assert.equal(a.body().active,true);assert.ok(Number.isFinite(a.progress()));
  const ba=a.body(),bb=b.body(),[w,x,y,z]=ba.q,axis=[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)];
  const target=ba.center.map((v,i)=>v+axis[i]*(ba.half[0]+bb.half[0])*.9);
  a.apply([...axis.map((v,i)=>v*10-ba.velocity[i]),0,0,0,0,0,0]);
  b.apply([...axis.map((v,i)=>-v*10-bb.velocity[i]),0,0,0,...target.map((v,i)=>v-bb.center[i])]);
  const momentum=()=>a.body().velocity.map((v,i)=>v*a.body().mass+b.body().velocity[i]*b.body().mass);
  const initial=momentum();const initialRelative=a.body().velocity.map((v,i)=>v-b.body().velocity[i]);
  assert.ok(resolvePlayers(new Map([['a',a],['b',b]]))>0);
  momentum().forEach((v,i)=>assert.ok(Math.abs(v-initial[i])<.005));
  assert.ok(a.body().velocity.every(Number.isFinite));
  const after=contact(a.body(),b.body());assert.ok(!after||after.depth<1e-4);
  assert.ok(a.body().velocity.some((v,i)=>Math.abs(v-b.body().velocity[i]-initialRelative[i])>1));
});
