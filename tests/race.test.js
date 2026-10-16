import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Progress,crossesGate,formatTime} from '../physics.js';
const course=JSON.parse(fs.readFileSync(new URL('../assets/course.json',import.meta.url)));
test('time formatting',()=>{assert.equal(formatTime(65.123),'01:05.123');});
test('real start gate rejects reverse and out-of-bounds crossings',()=>{
 const g=course.gates[0],r=g.records[0];
 const a=[r[0]-r[3]*3,r[1]-r[4]*3,r[2]+1],b=[r[0]+r[3]*3,r[1]+r[4]*3,r[2]+1];
 assert.equal(crossesGate(a,b,g),true);assert.equal(crossesGate(b,a,g),false);
 assert.equal(crossesGate(a.map((x,i)=>i===0?x+1000:x),b.map((x,i)=>i===0?x+1000:x),g),false);
});
test('skipping checkpoints does not advance the lap',()=>{
 const p=new Progress(course.gates),r=course.spawn;
 const a=[r[0],r[1]-4,r[2]+1],b=[r[0],r[1]+4,r[2]+1];p.update(a,b);
 for(let i=0;i<5;i++)p.update(a,b);
 assert.equal(p.lap,1);assert.equal(p.finished,false);
});
test('all original gates can be crossed in sequence for two laps',()=>{
 const p=new Progress(course.gates);
 for(let lap=0;lap<2;lap++)for(const g of course.gates){
  const r=g.records[0],a=[r[0]-r[3]*2,r[1]-r[4]*2,r[2]+.8],b=[r[0]+r[3]*2,r[1]+r[4]*2,r[2]+.8];
  assert.equal(p.update(a,b),true,`gate ${p.next} ${g.name}`);
 }
 const r=course.spawn;p.update([r[0]-r[3]*2,r[1]-r[4]*2,r[2]+.8],[r[0]+r[3]*2,r[1]+r[4]*2,r[2]+.8]);
 assert.equal(p.finished,true);assert.equal(p.lap,3);
});
test('mesh containers have bounded, valid indices and finite positions',()=>{
 for(const file of ['track.ktrk','kart.ktrk']){
  const b=fs.readFileSync(new URL('../assets/'+file,import.meta.url));assert.equal(b.toString('ascii',0,4),'KTRK');assert.equal(b.readUInt32LE(4),2);let o=44;
  for(let i=0;i<b.readUInt32LE(8);i++){const vc=b.readUInt32LE(o+196),ic=b.readUInt32LE(o+200);o+=204;
   for(let j=0;j<vc*5;j++)assert.ok(Number.isFinite(b.readFloatLE(o+j*4)));o+=vc*20;
   for(let j=0;j<ic;j++)assert.ok(b.readUInt32LE(o+j*4)<vc);o+=ic*4;
  }assert.equal(o,b.length);
 }
});
test('continuous original course trajectory completes two laps without skipping gates',()=>{
 const p=new Progress(course.gates);
 for(let loop=0;loop<3&&!p.finished;loop++)for(let i=0;i<course.route.length;i++){
  const a=course.route[i],b=course.route[(i+1)%course.route.length];
  for(let t=0;t<100;t++){
   const v=f=>a.map((x,k)=>x+(b[k]-x)*f+(k===2?.8:0));
   p.update(v(t/100),v((t+1)/100));
  }
 }
 assert.equal(p.finished,true);assert.equal(p.passed,course.gates.length*2+1);
});
