import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {applyKartPhysics,dynamicsFields,featureFields} from '../web-preview/kart-physics.mjs';
import {createDemoInput} from '../web-preview/demo-input.mjs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),specs=JSON.parse(readFileSync(new URL('web-preview/assets/kart-physics.json',root)));
const module=new WebAssembly.Module(readFileSync(new URL('web-preview/demo_physics.wasm',root)));
// A bounded fixture much larger than any audit trajectory, not demo_bridge's
// +/-78 debug square (which would contaminate a sustained speed measurement).
function flatTrack(){
  const bytes=new Uint8Array(44+204+80+24),d=new DataView(bytes.buffer),m=44;
  bytes.set([75,84,82,75]);[2,1,4,2].forEach((v,i)=>d.setUint32(4+i*4,v,true));
  [-10000,-10000,-1,10000,10000,1].forEach((v,i)=>d.setFloat32(20+i*4,v,true));
  d.setUint32(m+192,1,true);d.setUint32(m+196,4,true);d.setUint32(m+200,6,true);
  [[-10000,-10000,0],[10000,-10000,0],[10000,10000,0],[-10000,10000,0]].flatMap(p=>[...p,0,0]).forEach((v,i)=>d.setFloat32(m+204+i*4,v,true));
  [0,1,2,0,2,3].forEach((v,i)=>d.setUint32(m+204+80+i*4,v,true));return bytes;
}
function create(profile){
  const api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
  const pointer=api.demo_new();if(profile)applyKartPhysics(api,{...profile,exceed:false});
  const bytes=flatTrack(),buffer=api.demo_track_alloc(bytes.length);new Uint8Array(api.memory.buffer,buffer,bytes.length).set(bytes);
  assert.ok(api.demo_track_load(buffer,bytes.length));api.demo_track_free_buffer(buffer);assert.ok(api.demo_track_enable(0,0,0,0));
  const normal=api.demo_track_ground_normal(0,0,2,2);assert.ok(normal>.99,'Flat audit fixture must provide upward ground');
  return {api,state:()=>Array.from(new Float32Array(api.memory.buffer,pointer,api.demo_state_count()))};
}
const report={speed:specs.speed,comparison:'pinned 2004 native C with same selected dynamics and flat KTRK vs web WASM; not a 5136 executable comparison',wasmSha256:createHash('sha256').update(readFileSync(new URL('web-preview/demo_physics.wasm',root))).digest('hex'),sourceHashes:specs.sourceHashes,rows:0,scenarios:[],steering:[],notPassedDirectlyToAbi:[],geometry:{}};
const fixture=new URL('local-data/driving-audit-flat.ktrk',root);writeFileSync(fixture,flatTrack());
for(const name of ['whiteKnightV1','saberV1','practiceV1','cottonV1']){
  const profile=specs.karts[name];
  for(const mode of ['straight','grip','drift']){
    const schedule=Array.from({length:1200},(_,i)=>[5,+(i<1000),+(i>=1000),mode!=='straight'&&i>=600&&i<800?1:0,+(mode==='drift'&&i>=600&&i<800)]);
    const source=[dynamicsFields.map(k=>profile.values[k]).join(' '),...schedule.map(row=>row.join(' '))].join('\n')+'\n';
    const native=spawnSync(fileURLToPath(new URL('local-data/physics-profile-reference.exe',root)),[fileURLToPath(fixture)],{input:source,encoding:'utf8',maxBuffer:8*1024*1024});
    if(native.error)throw native.error;assert.equal(native.status,0,native.stderr);
    const expected=native.stdout.trim().split(/\r?\n/).map(row=>row.split(',').map(Number));assert.equal(expected.length,schedule.length);
    const {api,state}=create(profile),errors=Array(12).fill(0);let peak=0,headingAtTurn,turn=0,driftFrames=0,steps=0;
    for(const [i,[ms,throttle,brake,steer,drift]]of schedule.entries()){
      api.demo_step(ms,throttle,brake,steer,drift,0);const s=state();
      const actual=[s[0],s[1],s[14],s[3],s[4],new Float32Array(api.memory.buffer,api.demo_peer_body(),18)[9],s[2],s[5],s[9],s[8]*1000,s[16],s[13]];
      actual.forEach((value,k)=>{assert.ok(Number.isFinite(value));errors[k]=Math.max(errors[k],Math.abs(value-expected[i][k]));});
      assert.ok(Math.abs(s[0])<9000&&Math.abs(s[1])<9000);assert.equal(s[8],0);assert.equal(s[17],0);
      peak=Math.max(peak,s[6]*3.6);if(i===599)headingAtTurn=s[2];if(i===799)turn=s[2]-headingAtTurn;
      driftFrames+=+Boolean(s[9]);steps+=s[16];
    }
    report.rows+=schedule.length;report.scenarios.push({kart:name,mode,peakKmh:peak,turnDegrees:turn*180/Math.PI,driftFrames,steps,maximumErrors:errors});
  }
  const {api}=create(profile),model=JSON.parse(readFileSync(new URL(`web-preview/assets/usd/${name}/model.mesh.json`,root)));
  const wheels=model.parts.filter(p=>/^wheel[0-3]$/.test(p.name.split('/').at(-2))).map(part=>[0,1,2].map(axis=>{
    let min=Infinity,max=-Infinity;for(let i=axis;i<part.positions.length;i+=3){min=Math.min(min,part.positions[i]);max=Math.max(max,part.positions[i]);}return(min+max)/2;
  }));
  assert.equal(wheels.length,4);const scale=1.25*1.5*.6,z=wheels.map(p=>p[2]),x=wheels.map(p=>p[0]);
  report.geometry[name]={mass:api.demo_config_value(4),nativeHalfWidth:api.demo_config_value(0),nativeHalfLength:api.demo_config_value(1),suspension:api.demo_config_value(2),
    nativeWheelRayWheelbase:2*api.demo_config_value(1)*Math.fround(.8),visibleWheelbase:(Math.max(...z)-Math.min(...z))*scale,
    nativeWheelRayTrack:2*api.demo_config_value(0)*Math.fround(.8),visibleWheelTrack:(Math.max(...x)-Math.min(...x))*scale,
    originForwardOfWheelMidpoint:-(Math.min(...z)+Math.max(...z))/2*scale,
    note:'Physical suspension still uses cotten5 geometry and symmetric source inertia; visual fit changes collision only.'};
  // Fresh input at measured forward speeds, without the source's held-turn
  // hysteresis changing the expected speed-dependent angle.
  for(const target of [0,100,200]){
    const {api,state}=create(profile);for(let i=0;i<4000&&state()[6]*3.6<target;i++)api.demo_step(5,1,0,0,0,0);
    const before=state(),forward=before[3]*Math.cos(before[2])+before[4]*Math.sin(before[2]);
    const input=createDemoInput(()=>api,{});input.set('left',true,'ArrowLeft');api.demo_step(1,0,0,input.steering(),0,0);
    const expected=profile.values.MaxSteerAngle*Math.exp(-Math.abs(forward/profile.values.SteerConstraint));
    const actual=state()[13]*180/Math.PI;assert.ok(Math.abs(actual-expected)<.00002,`${name}: target=${target} forward=${forward} expected=${expected} actual=${actual} grounded=${state()[47]} z=${state()[14]}`);
    report.steering.push({kart:name,targetKmh:target,actualKmh:before[6]*3.6,angleDegrees:actual});
  }
}
report.notPassedDirectlyToAbi=Object.keys(specs.karts.whiteKnightV1.values).filter(k=>![...dynamicsFields,...featureFields].includes(k));
writeFileSync(new URL('local-data/driving-physics-audit.json',root),JSON.stringify(report,null,2)+'\n');
for(const scenario of report.scenarios){
  scenario.maximumErrors.forEach((error,k)=>assert.ok(error<([8,9,10].includes(k)?1e-6:.0002),`${scenario.kart}/${scenario.mode} field ${k}: ${error}`));
}
console.log(`Driving audit: ${report.scenarios.length} scenarios / ${report.rows} frames matched native C; 12 selected-profile speed-steering checks passed.`);
