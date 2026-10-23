import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {createDemoInput,demoElapsedMilliseconds} from '../web-preview/demo-input.mjs';
import {readChasePose} from '../web-preview/camera-pose.mjs';
const module=new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm',import.meta.url)));
function create() {
  const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
  const pointer=api.demo_new(),controls={throttle:false,brake:false,left:false,right:false,drift:false,boost:false};
  return {api,state:new Float32Array(api.memory.buffer,pointer,43),controls,input:createDemoInput(()=>api,controls)};
}
test('left/right keyboard inputs turn toward the corresponding side of the actual Three camera',()=>{
  for(const direction of ['left','right']) {
    const {api,state,input}=create();
    for(let i=0;i<30;i++)api.demo_step(16,1,0,0,0,0);
    const pose=readChasePose(state),camera=new THREE.PerspectiveCamera(pose.fov,16/9,.1,1000);
    camera.position.fromArray(pose.position);camera.up.fromArray(pose.up);
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(...pose.forward)));camera.updateMatrixWorld();
    const nativeRight=new THREE.Vector3(...pose.up).cross(new THREE.Vector3(...pose.forward)).normalize();
    const webRight=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
    assert.ok(nativeRight.dot(webRight)<-.9999,'native and Three screen-right have opposite handedness');
    input.set(direction,true,'Arrow');
    assert.equal(api.demo_steering_value(),direction==='left'?-1:1);
    const startY=state[1];
    for(let i=0;i<15;i++)api.demo_step(16,1,0,input.steering(),0,0);
    const straight=new THREE.Vector3(state[0],state[14],-startY).project(camera);
    const turning=new THREE.Vector3(state[0],state[14],-state[1]).project(camera);
    assert.ok(direction==='left'?turning.x<straight.x:turning.x>straight.x,`${direction}: screen deviation=${turning.x-straight.x}`);
  }
});
test('keyboard aliases, touch and last-pressed direction share native input ownership',()=>{
  const {api,input,controls}=create();
  input.set('left',true,'ArrowLeft');input.set('right',true,'touch-right');
  input.set('left',true,'KeyA');input.set('left',false,'ArrowLeft');
  assert.equal(api.demo_steering_value(),1);
  input.set('right',false,'touch-right');assert.equal(api.demo_steering_value(),0);
  input.set('throttle',true,'KeyW');input.set('throttle',true,'ArrowUp');input.set('throttle',false,'KeyW');
  assert.equal(controls.throttle,true);
  input.clear();assert.equal(controls.throttle,false);assert.equal(api.demo_steering_value(),0);
});
test('browser elapsed milliseconds follow the native integer clock and 50ms cap',()=>{
  assert.equal(demoElapsedMilliseconds(16.9,33.2),17);
  assert.equal(demoElapsedMilliseconds(33.2,41.8),8);
  assert.equal(demoElapsedMilliseconds(41.8,500),50);
  assert.equal(demoElapsedMilliseconds(500,499),0);
});
test('the game input path applies the source speed-dependent steering law',()=>{
  for(const target of [0,15,30,45]) {
    const {api,state,input}=create();
    for(let i=0;i<300&&state[6]<target;i++)api.demo_step(5,1,0,0,0,0);
    const forward=state[3]*Math.cos(state[2])+state[4]*Math.sin(state[2]);
    const expected=api.demo_config_value(5)*Math.PI/180*Math.exp(-Math.abs(forward/api.demo_config_value(6)));
    input.set('left',true,'ArrowLeft');api.demo_step(1,0,0,input.steering(),0,0);
    assert.ok(Math.abs(state[13]-expected)<1e-6,`speed=${forward}, angle=${state[13]}, expected=${expected}`);
  }
});
