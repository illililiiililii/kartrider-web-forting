import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {seatSurface,mountRider} from '../web-preview/rider-mount.mjs';
import {pullCameraTowardRider} from '../web-preview/camera-pose.mjs';
const model=name=>JSON.parse(readFileSync(new URL(`../web-preview/assets/usd/${name}/model.mesh.json`,import.meta.url)));
const quarter=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
test('rider hips contact the authored kart seat surface for all primary riders and starter bodies',()=>{
  for(const kartName of ['whiteKnightV1','cottonV1','practiceV1','saberV1']){
    const kart=model(kartName),seat=seatSurface(kart.parts,kart.kartMounts.seat);
    assert.equal(seat.source,'authored seat + surface',kartName);
    for(const character of ['dao','bazzi','marid','run_dizini']){
      const data=model(character),rider=new THREE.Group(),scale=1.25*1.5*.6;
      assert.ok(mountRider(rider,seat,data.riderMounts,scale,.8*scale,.02));rider.updateMatrixWorld(true);
      const actual=new THREE.Vector3(...data.riderMounts.hips).applyMatrix4(rider.matrixWorld);
      const expected=new THREE.Vector3(...seat.point).multiplyScalar(scale).applyQuaternion(quarter);expected.y+=.02*scale;
      assert.ok(actual.distanceTo(expected)<1e-7,`${kartName}/${character}: seated hips must not float above/behind the seat`);
    }
  }
  const kart=model('whiteKnightV1');assert.ok(Math.abs(seatSurface(kart.parts,kart.kartMounts.seat).point[1]-.17031)<1e-5);
});
test('missing seat metadata remains explicit instead of guessing another kart mount',()=>{
  assert.equal(seatSurface([],null),null);assert.equal(mountRider(new THREE.Group(),null,{},1,.8,0),false);
});
test('closer camera reduces distance by 25% while retaining the rider direction and input pose',()=>{
  const position=[-8,4,2],rider=[0,1,0],before=new THREE.Vector3(...position),target=new THREE.Vector3(...rider);
  const after=new THREE.Vector3(...pullCameraTowardRider(position,rider));
  assert.ok(Math.abs(after.distanceTo(target)/before.distanceTo(target)-.75)<1e-9);
  assert.ok(target.clone().sub(after).normalize().distanceTo(target.clone().sub(before).normalize())<1e-9);
  assert.deepEqual(position,[-8,4,2]);
});
