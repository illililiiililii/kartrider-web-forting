// Exercise every advertised course through the actual shipped Wasm bridge.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),path=new URL('web-preview/assets/catalog.json',root);
const catalog=JSON.parse(readFileSync(path,'utf8'));
const module=new WebAssembly.Module(readFileSync(new URL('web-preview/demo_physics.wasm',root)));
const failures=[];
for(const entry of catalog.tracks) {
  const artwork=new URL(`web-preview/assets/tracks/${entry.id}/`,root);
  entry.card=existsSync(new URL('xt_trackCard.png',artwork));
  entry.minimap=existsSync(new URL('xt_minimap.png',artwork));
  if(!entry.ready)continue;
  try {
    const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
    const pointer=api.demo_new();
    const bytes=readFileSync(new URL(`web-preview/assets/usd/${entry.id}/collision.ktrk`,root));
    const buffer=api.demo_track_alloc(bytes.length);
    if(!buffer)throw Error('Collision input exceeds the bridge allocation limit');
    new Uint8Array(api.memory.buffer,buffer,bytes.length).set(bytes);
    if(!api.demo_track_load(buffer,bytes.length))throw Error('Original collision load failed');
    api.demo_track_free_buffer(buffer);api.demo_track_enable(0,0,0,0);
    const gates=api.demo_set_5136_course(entry.courseIndex);
    if(!gates)throw Error('Original course/start does not match the collision ground');
    const state=new Float32Array(api.memory.buffer,pointer,api.demo_state_count());
    const ground=api.demo_track_ground_height(state[0],state[1],state[14]+10);
    if(!Number.isFinite(ground)||Math.abs(state[14]-ground-.5)>.1)throw Error('Original start height mismatch');
    entry.verifiedGates=gates;
  }catch(error){entry.ready=false;entry.reason=error.message;failures.push({id:entry.id,reason:error.message});}
}
writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
const report={tracks:catalog.tracks.filter(e=>e.ready).length,listedTracks:catalog.tracks.length,karts:catalog.karts.filter(e=>e.ready).length,characterVariants:catalog.characters.filter(e=>e.ready).length,characterFamilies:new Set(catalog.characters.filter(e=>e.ready).map(e=>e.family)).size,spawnFailures:failures};
writeFileSync(new URL('local-data/catalog-validation.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,spawnFailures:failures.length}));
