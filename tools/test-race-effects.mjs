import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../web-preview/vendor/three.module.js';
import {boostLabel,skidSegment} from '../web-preview/race-effects.mjs';
import {bitmapProjection,lapAnnouncement} from '../web-preview/live-minimap.mjs';
import {addOpaqueDepthPass} from '../web-preview/material-depth.mjs';

test('blended cutouts write depth only at opaque pixels; holes keep alpha',()=>{
  const texture=new THREE.Texture();
  const source=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,opacity:1,side:THREE.DoubleSide}));
  addOpaqueDepthPass(THREE,source);
  const depth=source.children[0];
  assert.equal(depth.geometry,source.geometry);assert.equal(depth.material.map,texture);
  assert.equal(depth.material.colorWrite,false);assert.equal(depth.material.depthWrite,true);
  assert.equal(depth.material.transparent,false);assert.equal(depth.material.alphaTest,.999);
  assert.equal(source.material.depthWrite,false);assert.equal(source.material.transparent,true);
});

test('skids follow actual contact height, have bounded width and reject teleport bridges',()=>{
  const vertices=skidSegment([1,3,2],[2,3.5,2]);assert.equal(vertices.length,18);
  assert.equal(vertices[1],3.025);assert.equal(vertices[7],3.525);
  assert.ok(Math.abs(Math.abs(vertices[2]-vertices[5])-.22)<1e-6);
  assert.equal(skidSegment([0,0,0],[200,0,0]),null);
  assert.equal(skidSegment([0,0,0],[1,5,0]),null);
  assert.equal(skidSegment([0,0,0],[0,0,0]),null);
});

test('bitmap registration preserves native XY axes and doubled bigmap resolution',()=>{
  const p=bitmapProjection({origin:[100,200],scale:.3,width:256,height:256},512,512);
  assert.deepEqual(p(100,200),[256,256]);
  assert.ok(Math.abs(p(110,210)[0]-262)<1e-8);assert.ok(Math.abs(p(110,210)[1]-250)<1e-8);
  assert.throws(()=>bitmapProjection({origin:[0,0],scale:0,width:256,height:256},512,512));
  assert.equal(lapAnnouncement(2,3),'2번째 바퀴');assert.equal(lapAnnouncement(3,3),'마지막 바퀴!!');
  assert.deepEqual([1,2,3].map(boostLabel),['부스터','출발 부스터','순간 부스터']);
});

test('effect type comes from actual C start, item and drift-exit boosts',()=>{
  const module=new WebAssembly.Module(readFileSync(new URL('../web-preview/demo_physics.wasm',import.meta.url)));
  const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
  const p=api.demo_new(),s=new Float32Array(api.memory.buffer,p,api.demo_state_count());
  api.demo_start_race();for(let i=0;i<438;i++)api.demo_step(16,0,0,0,0,0);
  api.demo_step(16,1,0,0,0,0);assert.equal(s[48],2);assert.ok(s[8]>0);
  api.demo_reset();
  for(let i=0;i<80;i++)api.demo_step(16,1,0,0,0,0);
  for(let i=0;i<200;i++)api.demo_step(16,1,0,1,1,0);
  let instant=false;
  for(let i=0;i<400;i++){api.demo_step(16,i%2,0,0,0,0);if(s[48]===3){instant=true;assert.ok(s[17]>0);}}
  assert.ok(instant,'native drift exit opens the accelerator tap boost window');
  assert.ok(s[32]>0,'native drift gauge earns an item');
  api.demo_step(16,1,0,0,0,1);assert.equal(s[48],1);assert.ok(s[8]>2.9);
});

test('prepared effect images are byte-identical local originals',()=>{
  const files=['effect/booster/10main/10Fire01.png','effect/boosterFlare/cotton6/6buster001.png','effect/boosterFlare/cotton6/6buster002.png','effect/boosterWave/8Flashbooster_05.png','effect/boosterWave/9wave01.png','effect/boosterBlur/blurMask.png','effect/boosterBlur/blurMask2.png','stage/timeAttackReady/boostTex_0.png','stage/timeAttackReady/boostTex_1.png'];
  for(const file of files){
    const original=new URL('../local-assets/rhoOut/'+file,import.meta.url);
    assert.ok(existsSync(original));
    const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
    assert.equal(digest(new URL('../web-preview/assets/effects/'+file,import.meta.url)),digest(original),file);
  }
});
