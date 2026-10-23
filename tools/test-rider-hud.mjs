import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minimapRotation} from '../web-preview/live-minimap.mjs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {addOpaqueDepthPass} from '../web-preview/material-depth.mjs';

test('all prepared character variants retain rest meshes and weighted seated poses',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../web-preview/assets/catalog.json',import.meta.url)));
  for(const character of catalog.characters.filter(c=>c.ready)){
    const data=JSON.parse(readFileSync(new URL(`../web-preview/assets/usd/${character.id}/model.mesh.json`,import.meta.url)));
    assert.match(data.drivingPose,/weighted/);
    let changed=0;
    for(const part of data.parts){assert.equal(part.positions.length,part.seatedPositions.length);assert.ok(part.seatedPositions.every(Number.isFinite));changed+=part.positions.filter((v,i)=>Math.abs(v-part.seatedPositions[i])>.01).length;}
    assert.ok(changed>30,character.id);
  }
});

test('original lap rectangles and timing are used, without first-lap or booster text',()=>{
  const panels=JSON.parse(readFileSync(new URL('../web-preview/assets/ui/lap-notices.json',import.meta.url)));
  assert.equal(panels['1lap'],undefined);assert.deepEqual(panels['2lap'].rect,[0,208,356,306]);assert.deepEqual(panels.finallap.rect,[0,110,458,208]);
  assert.equal(panels.finallap.fadeIn+panels.finallap.hold+panels.finallap.fadeOut,1100);
  const html=readFileSync(new URL('../web-preview/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/id="boost-status"/);
});

test('heading-up map keeps the world forward direction pointing up at all headings',()=>{
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2,.37]){
    const angle=minimapRotation(heading),x=Math.cos(heading),y=-Math.sin(heading);
    assert.ok(Math.abs(x*Math.cos(angle)-y*Math.sin(angle))<1e-9);
    assert.ok(Math.abs(x*Math.sin(angle)+y*Math.cos(angle)+1)<1e-9);
  }
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  addOpaqueDepthPass(THREE,wall);assert.equal(wall.children[0].material.side,THREE.DoubleSide);assert.equal(wall.children[0].material.depthWrite,true);
});
