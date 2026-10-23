import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),path=new URL('web-preview/assets/catalog.json',root);
test('expanded catalog advertises unique existing models and verified original courses',{skip:!existsSync(path)},()=>{
  const catalog=JSON.parse(readFileSync(path));
  assert.equal(catalog.format,'p5136-local-catalog-v1');
  for(const kind of ['tracks','karts','characters']) {
    const ids=catalog[kind].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
    for(const entry of catalog[kind]) {
      if(!entry.ready){assert.ok(entry.reason);continue;}
      assert.ok(existsSync(new URL(`web-preview/assets/usd/${entry.id}/model.mesh.json`,root)),entry.id);
      if(kind==='tracks') {
        assert.ok(Number.isInteger(entry.courseIndex)&&entry.courseIndex>=0);
        assert.ok(entry.laps>0);assert.ok(entry.verifiedGates>0);
        assert.ok(existsSync(new URL(`web-preview/assets/usd/${entry.id}/collision.ktrk`,root)));
      }
    }
  }
});
