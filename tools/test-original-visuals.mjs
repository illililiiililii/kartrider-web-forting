import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from '../web-preview/vendor/three.module.js';
import {mountWheel} from '../web-preview/wheel-basis.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const has=p=>existsSync(new URL('../'+p,import.meta.url));

test('original corner normals survive character seating and all primary model exports',{skip:!has('web-preview/assets/usd/bazzi/model.mesh.json')},()=>{
  for(const name of ['beach_I01','beach_I02','village_R01','whiteKnightV1','saberV1','dao','bazzi']){
    const parts=read(`web-preview/assets/usd/${name}/model.mesh.json`).parts;
    assert.ok(parts.some(p=>p.normals),name);
    for(const part of parts){
      // Track exports often omit normals. Preserve authored data wherever it
      // exists; retain geometric fallback rather than inventing smoothing.
      if(!part.normals){assert.match(name,/^(beach|village)/);continue;}
      assert.equal(part.normals.length,part.positions.length,name);
      for(const normals of [part.normals,part.seatedNormals].filter(Boolean)){
        assert.equal(normals.length,part.positions.length);
        for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<1e-5,`${name}: unit normal`);
      }
      if(['dao','bazzi'].includes(name))assert.ok(part.seatedNormals);
      if(name==='whiteKnightV1')assert.equal(part.alphaBlend,true,'bound Material alpha flag must not be lost');
    }
  }
});

test('Village reference campaign uses the matching original flower-logo ad slots',{skip:!has('web-preview/assets/usd/village_R01/model.mesh.json')},()=>{
  const parts=read('web-preview/assets/usd/village_R01/model.mesh.json').parts;
  const ads=parts.filter(p=>/ad_fence_[abc]\.png/.test(p.textureSource||''));
  assert.ok(ads.length);for(const p of ads)assert.match(p.textureSource,/20221222_facelift/);
});

test('original skies retain real mesh UVs and separate original image references',{skip:!has('web-preview/assets/usd/village_R01/sky.mesh.json')},()=>{
  for(const name of ['beach_I01','beach_I02','village_R01']){
    const sky=read(`web-preview/assets/usd/${name}/sky.mesh.json`);
    assert.equal(sky.source,'skydome.1s');assert.ok(sky.parts.length);
    for(const part of sky.parts){assert.ok(part.positions.every(Number.isFinite));assert.equal(part.uvs.length,part.positions.length/3*2);assert.match(part.texture,/skydome/i);}
  }
});

test('wheel axis swap preserves authored non-geometric smooth normals',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,1,0,0,0,1],3));g.setIndex([0,1,2]);
  const source=new THREE.Vector3(1,2,3).normalize();g.setAttribute('normal',new THREE.Float32BufferAttribute([...source,...source,...source],3));
  const wheel=mountWheel(new THREE.Mesh(g,new THREE.MeshBasicMaterial()));wheel.pivot.updateMatrixWorld(true);
  const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(wheel.mesh.matrixWorld));
  assert.ok(n.distanceTo(source)<1e-6);
});

test('reference dashboard exposes separate EX telemetry and original XML icons/number atlas',{skip:!has('web-preview/assets/ui/v1-dashboard.json')},()=>{
  const hud=read('web-preview/assets/ui/v1-dashboard.json');
  assert.equal(hud.exceedAvailable,true);assert.match(hud.exceedRuntime,/web adapter/);assert.match(hud.source,/v1_exceed/);assert.deepEqual(hud.font.size,[34,42]);
  assert.deepEqual(hud.panels.n2o.position,[50,43]);assert.ok(hud.panels.keyX);assert.ok(hud.panels.keySpace);assert.ok(hud.panels.auto);assert.ok(hud.panels.draft);
});

test('race framing translates the viewport down without changing native pose or FOV',()=>{
  const camera=new THREE.PerspectiveCamera(75,16/9,.1,650);camera.position.set(4,3,8);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const before=new THREE.Vector3().project(camera);const position=camera.position.clone(),rotation=camera.quaternion.clone();
  camera.setViewOffset(1920,1080,0,-1080*.08,1920,1080);
  const after=new THREE.Vector3().project(camera);
  assert.ok(Math.abs(after.y-before.y+.16)<1e-10);assert.equal(camera.fov,75);assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(rotation));
});
