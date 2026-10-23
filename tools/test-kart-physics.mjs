import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {applyKartPhysics,collisionFit,dynamicsFields,featureFields} from '../web-preview/kart-physics.mjs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {mountWheel} from '../web-preview/wheel-basis.mjs';
const path=new URL('../web-preview/assets/kart-physics.json',import.meta.url);
const profiles=existsSync(path)?JSON.parse(readFileSync(path)).karts:null;
const module=new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm',import.meta.url)));
function create(profile){
  const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
  const pointer=api.demo_new();if(profile)applyKartPhysics(api,profile);
  return {api,state:new Float32Array(api.memory.buffer,pointer,api.demo_state_count())};
}
function drive(api,ms,chunk=5){for(let t=0;t<ms;t+=chunk)api.demo_step(Math.min(chunk,ms-t),1,0,0,0,0);}

test('all local per-kart stock configurations apply and survive race reset',{skip:!profiles},()=>{
  for(const [name,profile] of Object.entries(profiles)){
    assert.ok([...dynamicsFields,...featureFields].every(k=>Number.isFinite(profile.values[k])),name);
    const {api}=create(profile);api.demo_start_race();
    for(const [field,key] of [[4,'Mass'],[5,'MaxSteerAngle'],[6,'SteerConstraint']])assert.ok(Math.abs(api.demo_config_value(field)-profile.values[key])<1e-5,name+key);
  }
});

test('Korean S7 changes genuine acceleration/steering config instead of keyboard sensitivity',{skip:!profiles},()=>{
  const a=create(profiles.whiteKnightV1),b=create();drive(a.api,1500);drive(b.api,1500);
  assert.ok(a.state[6]<b.state[6]);assert.equal(a.api.demo_config_value(5),10);
  assert.ok(Math.abs(a.api.demo_config_value(6)-25.34)<1e-5);
  assert.notEqual(profiles.whiteKnightV1.values.SteerConstraint,profiles.saberV1.values.SteerConstraint);
});

test('EX has separate charge, minimum, throttle gate, drain and cooldown',{skip:!profiles},()=>{
  const {api,state:s}=create(profiles.whiteKnightV1);
  api.demo_exceed_input(1);drive(api,500);assert.equal(s[58],0,'cannot use an empty gauge');
  api.demo_exceed_input(0);drive(api,3100);assert.ok(s[57]>=s[60]);
  api.demo_exceed_input(1);drive(api,20);assert.equal(s[58],1);assert.equal(s[48],4);
  const gauge=s[57];drive(api,100);assert.ok(s[57]<gauge);assert.equal(s[7],0,'N2O is independent');
  api.demo_exceed_input(0);drive(api,5);assert.equal(s[58],0);assert.ok(s[59]>2.99);
  const after=s[57];drive(api,500);assert.equal(s[57],after,'cooldown prevents charging');
  api.demo_reset();assert.equal(s[57],0);assert.equal(s[58],0);
  api.demo_start_race();api.demo_exceed_input(1);drive(api,2000);assert.equal(s[57],0,'no charging during countdown');
});

test('EX charge and movement retain five millisecond partition invariance',{skip:!profiles},()=>{
  const a=create(profiles.whiteKnightV1),b=create(profiles.whiteKnightV1);
  drive(a.api,1000,50);drive(b.api,1000,5);
  for(const field of [0,1,3,4,6,57])assert.ok(Math.abs(a.state[field]-b.state[field])<1e-5,String(field));
});

test('EX activation changes C acceleration using the selected original factor',{skip:!profiles},()=>{
  const a=create(profiles.whiteKnightV1),b=create(profiles.whiteKnightV1);
  drive(a.api,3350);drive(b.api,3350);a.api.demo_exceed_input(1);
  drive(a.api,20);drive(b.api,20);
  assert.equal(a.state[58],1);assert.equal(b.state[58],0);assert.ok(a.state[6]>b.state[6]);
});

test('body fit follows the same visible meshes, axis mapping and scale; suspension stays unchanged',{skip:!profiles},()=>{
  for(const name of ['whiteKnightV1','saberV1','practiceV1','cottonV1']){
    const data=JSON.parse(readFileSync(new URL(`../web-preview/assets/usd/${name}/model.mesh.json`,import.meta.url)));
    const group=new THREE.Group();
    for(const part of data.parts){
      const label=part.name.split('/').at(-2)||part.name;
      if(part.missingTexture || /^mod/i.test(label)&&!/^mod1b/i.test(label))continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setIndex(part.indices);
      const mesh=new THREE.Mesh(geometry);group.add(label.startsWith('wheel')?mountWheel(mesh).pivot:mesh);
    }
    group.rotation.y=Math.PI/2;group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(group),scale=1.25*1.5*.6;
    const fit=collisionFit(bounds,scale),{api}=create(profiles[name]);
    const original=[0,1,2].map(i=>api.demo_config_value(i));
    assert.equal(api.demo_fit_body(...fit.half,...fit.center),1);
    for(const [index,value] of [...fit.half,...fit.center].entries())assert.ok(Math.abs(api.demo_body_value(index)-value)<1e-6);
    assert.deepEqual([0,1,2].map(i=>api.demo_config_value(i)),original);
    assert.ok(Math.abs(2*fit.half[1]-(bounds.max.x-bounds.min.x)*scale)<1e-8);
    assert.equal(api.demo_fit_body(NaN,1,1,0,0,0),0);
  }
});

function wallFixture(collidable){
  const bytes=new Uint8Array(44+204+4*20+6*4),d=new DataView(bytes.buffer);
  bytes.set([75,84,82,75]);[2,1,4,2].forEach((v,i)=>d.setUint32(4+i*4,v,true));
  for(let i=0;i<6;i++)d.setFloat32(20+i*4,i<3?-100:100,true);
  const mesh=44;d.setUint32(mesh+192,+collidable,true);d.setUint32(mesh+196,4,true);d.setUint32(mesh+200,6,true);
  // Scene loader's original X mirror maps source -2 to world +2.
  [[-2,-10,0],[-2,10,0],[-2,10,4],[-2,-10,4]].forEach((p,i)=>p.forEach((v,k)=>d.setFloat32(mesh+204+i*20+k*4,v,true)));
  [0,1,2,0,2,3].forEach((v,i)=>d.setUint32(mesh+204+80+i*4,v,true));return bytes;
}
test('native collision query contacts walls at fitted front/side, including offset and heading; decoration passes',()=>{
  for(const collidable of [true,false]){
    const {api}=create(),bytes=wallFixture(collidable),p=api.demo_track_alloc(bytes.length);
    new Uint8Array(api.memory.buffer,p,bytes.length).set(bytes);assert.equal(api.demo_track_load(p,bytes.length),2);api.demo_track_free_buffer(p);
    assert.equal(api.demo_fit_body(.4,1,.5,.2,-.3,.5),1);
    for(const [heading,boundary] of [[0,2-.3-1],[Math.PI/2,2+.2-.4]]){
      api.demo_track_enable(boundary-.01,0,0,heading);assert.equal(api.demo_body_contacts(),0,'no invisible padding before the visual box reaches wall');
      api.demo_track_enable(boundary+.01,0,0,heading);assert.equal(api.demo_body_contacts()>0,collidable,'actual edge reaches wall; scenery has no collision');
    }
  }
});
