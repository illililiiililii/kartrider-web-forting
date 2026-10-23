import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../web-preview/vendor/three.module.js';
import {applyKartOrientation} from '../web-preview/kart-pose.mjs';
test('rendered chassis follows native forward/up for yaw, roll and pitch',()=>{
  for(const [x,y,z] of [[0,0,Math.PI/2],[.2,-.1,1.5],[-.3,.4,-2]]) {
    const source=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
    const state=new Float32Array(47);state.set([source.w,source.x,source.y,source.z],43);
    const kart=new THREE.Group();applyKartOrientation(kart,state);
    const map=v=>new THREE.Vector3(v.x,v.z,-v.y);
    const nativeForward=map(new THREE.Vector3(0,-1,0).applyQuaternion(source));
    const nativeUp=map(new THREE.Vector3(0,0,1).applyQuaternion(source));
    assert.ok(new THREE.Vector3(1,0,0).applyQuaternion(kart.quaternion).distanceTo(nativeForward)<1e-6);
    assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(kart.quaternion).distanceTo(nativeUp)<1e-6);
  }
});
