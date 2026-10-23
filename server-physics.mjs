// Authoritative web races reuse the same WASM, original course and model fit.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from './web-preview/vendor/three.module.js';
import {mountWheel} from './web-preview/wheel-basis.mjs';
import {applyKartPhysics,collisionFit} from './web-preview/kart-physics.mjs';

export function createRacePhysicsFactory(root,catalog){
  const bytes=readFileSync(join(root,'demo_physics.wasm'));
  const module=new WebAssembly.Module(bytes);
  const specBytes=readFileSync(join(root,'assets/kart-physics.json'));
  const specs=JSON.parse(specBytes),fits=new Map(),tracks=new Map();
  const version=createHash('sha256').update(bytes).update(specBytes).digest('hex');
  function fit(name){
    if(fits.has(name))return fits.get(name);
    const data=JSON.parse(readFileSync(join(root,'assets/usd',name,'model.mesh.json'))),group=new THREE.Group();
    for(const part of data.parts){
      const label=part.name.split('/').at(-2)||part.name;
      if(part.missingTexture || /^mod/i.test(label)&&!/^mod1b/i.test(label))continue;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setIndex(part.indices);
      const mesh=new THREE.Mesh(geometry);group.add(label.startsWith('wheel')?mountWheel(mesh).pivot:mesh);
    }
    group.rotation.y=Math.PI/2;group.updateMatrixWorld(true);
    const value=collisionFit(new THREE.Box3().setFromObject(group),1.25*1.5*.6);
    group.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});fits.set(name,value);return value;
  }
  return {version,speed:specs.speed,create({track,kart,slot}){
    const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
    const pointer=api.demo_new();applyKartPhysics(api,specs.karts[kart]);
    const body=fit(kart);if(!api.demo_fit_body(...body.half,...body.center))throw new Error('BODY_FIT_FAILED');
    if(!tracks.has(track)){if(tracks.size>=4)tracks.delete(tracks.keys().next().value);tracks.set(track,readFileSync(join(root,'assets/usd',track,'collision.ktrk')));}
    const trackBytes=tracks.get(track),buffer=api.demo_track_alloc(trackBytes.length);
    try{
      new Uint8Array(api.memory.buffer,buffer,trackBytes.length).set(trackBytes);
      if(!api.demo_track_load(buffer,trackBytes.length)||!api.demo_track_enable(0,0,0,0)||!api.demo_set_5136_course(catalog.tracks.find(t=>t.id===track)?.courseIndex))throw new Error('COURSE_UNAVAILABLE');
    }finally{api.demo_track_free_buffer(buffer);}
    if(!api.demo_start_race_slot(slot))throw new Error('GRID_UNAVAILABLE');
    return {step(input){api.demo_exceed_input(+input.exceed);if(input.reset)api.demo_request_reset();api.demo_step(50,+input.throttle,+input.brake,input.steer,+input.drift,+input.boost);},
      state(){return Array.from(new Float32Array(api.memory.buffer,pointer,api.demo_state_count()));}};
  }};
}
