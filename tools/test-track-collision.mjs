import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collisionPositions} from '../web-preview/collision-wireframe.mjs';
const module=new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm',import.meta.url)));
function scene(meshes, minimumZ=-10) {
  const size=44+meshes.reduce((n,m)=>n+204+m.points.length*20+24,0);
  const bytes=new Uint8Array(size),d=new DataView(bytes.buffer);
  d.setUint32(0,0x4b52544b,true);d.setUint32(4,2,true);d.setUint32(8,meshes.length,true);
  d.setUint32(12,meshes.length*4,true);d.setUint32(16,meshes.length*2,true);
  [-1000,-1000,minimumZ,1000,1000,100].forEach((v,i)=>d.setFloat32(20+i*4,v,true));
  let o=44;
  for(const m of meshes) {
    d.setUint32(o+192,m.flag??1,true);d.setUint32(o+196,4,true);d.setUint32(o+200,6,true);o+=204;
    for(const [x,y,z] of m.points) {[-x,y,z,0,0].forEach((v,i)=>d.setFloat32(o+i*4,v,true));o+=20;}
    for(const i of [0,2,1,0,3,2]) {d.setUint32(o,i,true);o+=4;}
  }
  const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
  const statePointer=api.demo_new(),p=api.demo_track_alloc(size);
  new Uint8Array(api.memory.buffer,p,size).set(bytes);assert.equal(api.demo_track_load(p,size),meshes.length*2);
  api.demo_track_free_buffer(p);assert.equal(api.demo_track_enable(0,0,0,0),1);
  return {api,state:new Float32Array(api.memory.buffer,statePointer,api.demo_state_count()),bytes};
}
const floor=(a,b,za=0,zb=za)=>({points:[[a,-20,za],[b,-20,zb],[b,20,zb],[a,20,za]]});
const wall=(x,flag)=>({flag,points:[[x,-20,0],[x,-20,10],[x,20,10],[x,20,0]]});

test('falling off the road requests R recovery before distant scene-bottom limit',()=>{
  const {api,state}=scene([floor(-100,25)],-1000);
  let left=false,recovered=false;
  for(let i=0;i<1000;i++) {
    api.demo_step(5,1,0,0,0,0);
    if(state[0]>28 && state[14]<-2)left=true;
    if(left && state[0]<1 && state[14]>-.5){recovered=true;break;}
  }
  assert.ok(left,'must first leave the drivable surface');
  assert.ok(recovered,'automatic R must return to the same saved pose as manual R');
});

test('rear skid telemetry reports original suspension contacts on the real ground',()=>{
  const {api,state}=scene([floor(-100,500)]);
  for(let i=0;i<100;i++)api.demo_step(5,0,0,0,0,0);
  assert.equal(state[47],1);
  for(const offset of [49,53]){assert.equal(state[offset+3],1);assert.ok(Math.abs(state[offset+2])<1e-6);}
  const distance=Math.hypot(state[49]-state[53],state[50]-state[54]);
  assert.ok(Math.abs(distance-api.demo_config_value(0)*1.6)<1e-4);
});
test('original KTRK road flag blocks a wall and ignores an identical decoration',()=>{
  for(const flag of [0,1]) {
    const {api,state,bytes}=scene([floor(-100,500),wall(20,flag)]);
    for(let i=0;i<900;i++) api.demo_step(5,1,0,0,0,0);
    assert.ok(flag?state[0]<20:state[0]>30,`flag=${flag}, x=${state[0]}`);
    assert.ok(state[14]>-0.5,`road z=${state[14]}`);
    assert.equal(collisionPositions(bytes).length,(flag?12:6)*3);
    assert.deepEqual([...collisionPositions(bytes).slice(0,3)],[-100,0,20]);
  }
});
test('ground rays select the correct level below a bridge',()=>{
  const {api}=scene([floor(-100,100),floor(-100,100,10)]);
  assert.equal(api.demo_track_ground_height(0,0,2),0);
  assert.equal(api.demo_track_ground_height(0,0,12),10);
});
test('native suspension climbs a ramp, crosses an unsupported gap and lands',()=>{
  const {api,state}=scene([floor(-100,25),floor(25,35,0,3),floor(45,500)]);
  let maximum=-Infinity,airborne=false,landed=false;
  for(let i=0;i<1800 && state[0]<90;i++) {
    api.demo_step(5,1,0,0,0,0);maximum=Math.max(maximum,state[14]);
    if(state[0]>36 && state[0]<44 && state[14]>1) airborne=true;
    if(state[0]>50 && state[14]>-.5 && state[14]<1) landed=true;
    assert.ok(state[14]>-2,`fell below course at x=${state[0]}, z=${state[14]}`);
  }
  assert.ok(maximum>3,`ramp height=${maximum}`);assert.ok(airborne,'gap must allow a jump');assert.ok(landed,'landing must restore road support');
});
