import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const lines=readFileSync(new URL('local-data/native-physics.csv',root),'utf8').trim().split(/\r?\n/);
const module=new WebAssembly.Module(readFileSync(new URL('web-preview/demo_physics.wasm',root)));
test('native pinned C and web Wasm match flat inputs and imported track collision',()=>{
  let api,state,scenario=-1,maxError=0,rows=0;
  const importedErrors=Array(12).fill(0);
  let importedFinal;
  for(const line of lines.slice(1)) {
    const [s,i,...expected]=line.split(',').map(Number);
    if(s!==scenario) {
      scenario=s; api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
      const pointer=api.demo_new(); state=new Float32Array(api.memory.buffer,pointer,43);
      if(s===2) {
        api.demo_start_race();
        for(let j=0;j<432;j++) api.demo_step(16,0,0,0,0,0);
        for(let j=0;j<6;j++) api.demo_step(16,1,0,0,0,0);
        assert.equal(state[19],2);
      }
    }
    if(s===3 && i===0) {
      const statePointer=state.byteOffset;
      const bytes=readFileSync(new URL('web-preview/assets/usd/beach_I01/collision.ktrk',root));
      const buffer=api.demo_track_alloc(bytes.length);
      new Uint8Array(api.memory.buffer,buffer,bytes.length).set(bytes);
      assert.ok(api.demo_track_load(buffer,bytes.length));api.demo_track_free_buffer(buffer);
      api.demo_track_enable(1200,980,api.demo_track_ground_height(1200,980,400),Math.PI);
      state=new Float32Array(api.memory.buffer,statePointer,43);
    }
    if(s===3) api.demo_step(16,1,0,.5,0,0);
    else api.demo_step(5,+(i<130),+(i>=130),i>=70&&i<130?0.7:0,+(s===1&&i>=70&&i<125),0);
    const actual=[state[0],state[1],state[14],state[3],state[4],state[6],state[2],state[5],state[9],state[8],state[17],state[16]];
    actual.forEach((v,k)=>{
      assert.ok(Number.isFinite(v));const error=Math.abs(v-expected[k]);
      if(s<3) {
        maxError=Math.max(maxError,error);
        assert.ok(error<0.0002,`scenario=${s}, step=${i}, field=${k}: native=${expected[k]}, wasm=${v}`);
      } else {
        importedErrors[k]=Math.max(importedErrors[k],error);
        // Contact feedback amplifies cross-target float rounding. Keep the
        // strict flat comparison above and report every imported-field error.
        const tolerance=[.01,.01,.01,.5,.5,.5,.01,.25,0,0,0,0][k];
        assert.ok(error<=tolerance,`imported step=${i}, field=${k}, error=${error}`);
      }
    });
    if(s===3) importedFinal={native:expected,wasm:actual};
    rows++;
  }
  const report={rows,flatMaxAbsoluteError:maxError,flatStepMilliseconds:5,importedStepMilliseconds:16,importedErrors,importedFinal,fields:['x','y','z','vx','vy','speed','heading','yawRate','drift','boostTimer','instantBoostTimer','substeps'],scenarios:['accelerate/steer/brake','drift','countdown-start-boost','Beach wall contact (existing web footprint in both targets)'],nativeGeometry:lines[0].split(',').slice(1).map(Number)};
  writeFileSync(new URL('local-data/physics-parity.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
});
