import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from '../web-preview/vendor/three.module.js';
import { readChasePose } from '../web-preview/camera-pose.mjs';
import { readMapTriangles, mapProjection } from '../web-preview/live-minimap.mjs';
import { once } from 'node:events';
import { createKartServer } from '../server.mjs';

test('server serves debug modules and streaming-instantiable rebuilt Wasm', async () => {
  const server=createKartServer({databasePath:':memory:'});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const path of ['/debug.html','/debug.js','/render3d.js','/camera-pose.mjs','/live-minimap.mjs']) {
      assert.equal((await fetch(base+path)).status,200,path);
    }
    const response=await fetch(base+'/demo_physics.wasm');
    const {instance}=await WebAssembly.instantiateStreaming(response,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0;}}});
    assert.ok(instance.exports.demo_new());
  } finally { server.close(); await once(server,'close'); }
});

test('render camera follows actual C position/orientation and preserves boost FOV', () => {
  const module = new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm', import.meta.url)));
  const api = new WebAssembly.Instance(module, {wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0;}}}).exports;
  const pointer = api.demo_new();
  const state = new Float32Array(api.memory.buffer,pointer,43);
  for(let i=0;i<80;i++) api.demo_step(16,1,0,i>50?1:0,0,0);
  const pose=readChasePose(state);
  assert.deepEqual(pose.position,[state[25],state[27],-state[26]]);
  assert.ok(Math.abs(Math.hypot(...pose.up)-1)<1e-5);
  const camera=new THREE.PerspectiveCamera(pose.fov,16/9,0.1,1000);
  camera.position.fromArray(pose.position); camera.up.fromArray(pose.up);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(...pose.forward)));
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(new THREE.Vector3(...pose.forward))<1e-5);
  api.demo_start_race();
  for(let i=0;i<432;i++) api.demo_step(16,0,0,0,0,0);
  for(let i=0;i<32;i++) api.demo_step(16,1,0,0,0,0);
  assert.ok(state[31]>78,`boost FOV was clamped: ${state[31]}`);
  assert.equal(readChasePose(state).fov,state[31]);
});

test('5136 live map uses loaded KTRK coordinates and matching heading axes', () => {
  const bytes=new Uint8Array(44+204+60+12), d=new DataView(bytes.buffer);
  d.setUint32(0,0x4b52544b,true); d.setUint32(4,2,true); d.setUint32(8,1,true);
  d.setUint32(44+196,3,true); d.setUint32(44+200,3,true);
  const points=[[-10,20,0],[-30,20,0],[-10,40,0]];
  points.forEach((p,i)=>p.forEach((v,k)=>d.setFloat32(248+i*20+k*4,v,true)));
  [0,1,2].forEach((v,i)=>d.setUint32(308+i*4,v,true));
  const triangles=readMapTriangles(bytes);
  assert.equal(triangles.length,1); assert.deepEqual(triangles[0][0],[10,20,0]);
  const project=mapProjection(triangles,240,228);
  assert.deepEqual(project(20,30),[120,114]);
  assert.ok(project(30,30)[0]>120); assert.ok(project(20,40)[1]<114);
  assert.throws(()=>readMapTriangles(bytes.subarray(0,100)),/Truncated/);
});
