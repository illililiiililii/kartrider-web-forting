import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const tracks=['beach_I01','beach_I02','village_R01'];
for(const name of [...tracks,'whiteKnightV1','saberV1','dao','bazzi']) {
  const directory=new URL(`../web-preview/assets/usd/${name}/`,import.meta.url);
  test(`${name}: converted geometry, references and native alignment are valid`,{skip:!existsSync(new URL('model.mesh.json',directory))},()=>{
    const {parts}=JSON.parse(readFileSync(new URL('model.mesh.json',directory)));
    assert.ok(parts.length>0);
    for(const part of parts) {
      assert.equal(part.positions.length%3,0);assert.equal(part.indices.length%3,0);
      assert.equal(part.uvs.length,part.positions.length/3*2);
      assert.ok(part.positions.every(Number.isFinite));assert.ok(part.uvs.every(Number.isFinite));
      assert.ok(part.indices.every(i=>Number.isInteger(i)&&i>=0&&i<part.positions.length/3));
      if(part.texture) assert.ok(existsSync(new URL(part.texture,directory)),part.texture);
      if(part.missingTexture) assert.equal(part.texture,null);
    }
    if(tracks.includes(name)) {
      const info=JSON.parse(readFileSync(new URL('collision-info.json',directory)));
      assert.equal(info.source,'original-1s-property-road');
      assert.ok(info.matchedVisualMeshes>parts.length/2);assert.ok(info.maximumBoundsError<.02);
      assert.ok(info.collidableMeshes>0);assert.ok(info.collidableTriangles>0);
      if(name!=='beach_I02') assert.equal(info.unmatchedCollisionMeshes,0,'all collision geometry must match the render');
    }
  });
}
