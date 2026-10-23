import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveMinimap,minimapRotation} from '../web-preview/live-minimap.mjs';

test('original black/white bigmap is drawn, centered and rotated without rendering track geometry',async t=>{
  const originals={document:globalThis.document,Image:globalThis.Image,fetch:globalThis.fetch};
  t.after(()=>Object.assign(globalThis,originals));
  const rotations=[],translations=[],images=[],scales=[];
  const ctx={clearRect(){},save(){},restore(){},translate(...p){translations.push(p);},rotate(a){rotations.push(a);},scale(...v){scales.push(v);},drawImage(image){images.push(image);},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}};
  const canvas={dataset:{},setAttribute(){},getContext(){return ctx;}};
  globalThis.document={createElement(){return canvas;}};
  globalThis.Image=class {naturalWidth=512;naturalHeight=512;async decode(){}};
  globalThis.fetch=async()=>({ok:true,json:async()=>({origin:[100,200],scale:.3,width:256,height:256})});
  const image={after(){}};
  // Previously this callback overrode the bitmap with a WebGL scene.
  const minimap=createLiveMinimap(image,()=>{throw new Error('Track renderer must not be called');});
  await minimap.load(new Uint8Array(),'beach_I01',true);minimap.draw([100,200,.7]);
  assert.match(canvas.dataset.source,/xt_bigmap.png/);assert.match(images[0].src,/xt_bigmap.png$/);
  assert.equal(rotations[0],minimapRotation(.7));assert.deepEqual(translations.slice(0,2),[[300,270],[-256,-256]]);
  assert.equal(image.hidden,true);assert.equal(canvas.hidden,false);
  assert.deepEqual(scales[0],[600/512*2.6,600/512*2.6]);
});
