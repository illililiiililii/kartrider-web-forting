import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {mountWheel} from '../web-preview/wheel-basis.mjs';
for(const name of ['whiteKnightV1','saberV1']) test(`${name}: X/Z wheel basis preserves mounting and spins around the authored axle`,{skip:!existsSync(new URL(`../web-preview/assets/usd/${name}/model.mesh.json`,import.meta.url))},()=>{
  const {parts}=JSON.parse(readFileSync(new URL(`../web-preview/assets/usd/${name}/model.mesh.json`,import.meta.url)));
  const wheels=parts.filter(p=>/\/wheel\d\/Geo$/.test(p.name));
  assert.equal(wheels.length,4);
  let frontCount=0;
  for(const part of wheels) {
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3)); geometry.setIndex(part.indices);
    const wheel=mountWheel(new THREE.Mesh(geometry)); wheel.pivot.updateMatrixWorld(true);
    const input=new THREE.Vector3(...part.positions.slice(0,3));
    const vertex=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,0).applyMatrix4(wheel.mesh.matrixWorld);
    assert.ok(vertex.distanceTo(input)<1e-6);
    wheel.mesh.rotation.z=-Math.PI/3; wheel.pivot.updateMatrixWorld(true);
    geometry.computeBoundingBox();
    const before=input.x-wheel.pivot.position.x;
    vertex.fromBufferAttribute(geometry.attributes.position,0).applyMatrix4(wheel.mesh.matrixWorld);
    assert.ok(Math.abs(vertex.x-wheel.pivot.position.x-before)<1e-6,'spin must not tilt the axle');
    assert.ok(wheel.radius>0);
    if(wheel.front) {
      frontCount++;
      wheel.pivot.rotation.y=.2;wheel.pivot.updateMatrixWorld(true);
      const axle=new THREE.Vector3(0,0,1).transformDirection(wheel.mesh.matrixWorld);
      assert.ok(Math.abs(axle.y)<1e-6);
      assert.ok(Math.abs(axle.z+Math.sin(.2))<1e-6,'front axle must follow steering yaw');
    }
  }
  assert.equal(frontCount,2);
});
