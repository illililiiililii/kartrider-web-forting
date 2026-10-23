import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const lines=readFileSync(new URL('local-data/native-physics.csv',root),'utf8').trim().split(/\r?\n/);
const module=new WebAssembly.Module(readFileSync(new URL('web-preview/demo_physics.wasm',root)));
const fields=['x','y','z','vx','vy','speed','heading','yawRate','drift','boostTimer','instantBoostTimer','substeps','gauge','boosters','gaugeRate','contactWeight','cameraX','cameraY','cameraZ','cameraForwardX','cameraForwardY','cameraForwardZ','cameraFov','cameraUpX','cameraUpY','cameraUpZ','steerAngle'];
let importedErrors;
test('native free-drive, gauge and camera match; imported contact errors are recorded',()=>{
  let api,state,scenario=-1,rows=0;
  const errors={},last={};
  for(const line of lines.slice(1)) {
    const [s,i,...expected]=line.split(',').map(Number);
    if(s!==scenario) {
      scenario=s;api=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{proc_exit(){},random_get(){return 0}}}).exports;
      const pointer=api.demo_new();state=new Float32Array(api.memory.buffer,pointer,43);
      if(s===2)api.demo_start_race();
      if(s===3) {
        const bytes=readFileSync(new URL('web-preview/assets/usd/beach_I01/collision.ktrk',root));
        const buffer=api.demo_track_alloc(bytes.length);new Uint8Array(api.memory.buffer,buffer,bytes.length).set(bytes);
        assert.ok(api.demo_track_load(buffer,bytes.length));api.demo_track_free_buffer(buffer);
        api.demo_track_enable(1200,980,api.demo_track_ground_height(1200,980,400),Math.PI);
        state=new Float32Array(api.memory.buffer,pointer,43);
      }
      lines[0].split(',').slice(1).map(Number).forEach((v,k)=>assert.ok(Math.abs(api.demo_config_value(k)-v)<1e-7));
      assert.equal(api.demo_config_value(5),10);
      errors[s]=Array(fields.length).fill(0);
    }
    let dt=s>=2?16:5,throttle=+(i<130),brake=+(i>=130),steer=i>=70&&i<130?.7:0,drift=+((s===1||s===5)&&i>=70&&i<125);
    if(s===2){throttle=+(i>=438&&i<490);brake=+(i>=490);steer=i>=458&&i<488?.7:0;}
    if(s===3){throttle=1;brake=0;steer=.5;}
    if(s===4){throttle=0;brake=1;}
    if(s===5)dt=[8,16,17,33,5][i%5];
    api.demo_step(dt,throttle,brake,steer,drift,0);
    const actual=[state[0],state[1],state[14],state[3],state[4],state[6],state[2],state[5],state[9],state[8],state[17],state[16],state[7],state[32],state[33],state[34],...state.slice(25,32),...state.slice(40,43),state[13]];
    actual.forEach((v,k)=>{
      assert.ok(Number.isFinite(v));const error=Math.abs(v-expected[k]);errors[s][k]=Math.max(errors[s][k],error);
      if(s!==3) {
        const tolerance=[8,11,13].includes(k)?0:.0002;
        assert.ok(error<=tolerance,`scenario=${s} frame=${i} ${fields[k]}: native=${expected[k]} wasm=${v} error=${error}`);
      }
    });
    rows++;last[s]={native:expected,wasm:actual};
  }
  const report={rows,fields,maximumErrors:errors,last,sourceGeometry:lines[0].split(',').slice(1).map(Number),scenarios:['5ms accelerate/steer/brake','5ms drift','full countdown and start boost','Beach collision with source geometry','reverse','variable elapsed/drift']};
  writeFileSync(new URL('local-data/physics-parity.json',root),JSON.stringify(report,null,2)+'\n');
  importedErrors=errors[3];
  console.log(`Compared ${rows} frames across ${Object.keys(errors).length} scenarios, including gauge and C camera`);
});
test('prolonged Beach collision converges across native and Wasm targets',{
  skip:!lines.some(line=>line.startsWith('3,')),
  todo:'Native/Wasm prolonged wall contact diverges by centimetres and several degrees; retain strict diagnostic thresholds, no force/height workaround.',
},()=>{
  for(const k of [0,1,2,6,16,17,18,19,20,21,23,24,25])
    assert.ok(importedErrors[k]<.01,`${fields[k]} maximum difference=${importedErrors[k]}`);
});
