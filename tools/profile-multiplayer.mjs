// Asset-free throughput probe. It isolates room scheduling/serialization and
// the peer collision adapter; it does not stand in for real WASM driving.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createMultiplayer} from '../multiplayer-server.mjs';

const dir=mkdtempSync(join(tmpdir(),'kart-profile-'));
const catalogPath=join(dir,'catalog.json');
writeFileSync(catalogPath,JSON.stringify({tracks:[{id:'probe',ready:true,courseIndex:0}],karts:[{id:'probe',ready:true}],characters:[{id:'probe',ready:true}]}));
const q=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
try{
  for(const count of [2,8]){
    let clock=10000;
    const manager=createMultiplayer({root:resolve(import.meta.dirname,'..'),catalogPath,now:()=>clock,autoTick:false,
      players:{profile:user=>({nickname:user.id,equippedKart:'probe'})},createPhysics:{version:'fixture',speed:'S7',create({slot}){
        let elapsed=0;return {step(_input,ms){elapsed+=ms;},state(){const s=Array(62).fill(0);s[0]=slot*10;s[19]=2;s[21]=1;s[43]=1;return s;},
          body(){return {center:[slot*10,0,0],q:[1,0,0,0],half:[.5,.5,.5],velocity:[0,0,0],mass:1,active:true};},progress(){return elapsed;}};
      }}});
    const users=Array.from({length:count},(_,i)=>({id:`probe-${i}`}));
    const room=manager.command(users[0],'create',{name:'probe',track:'probe',character:'probe'});
    for(const user of users.slice(1))manager.command(user,'join',{id:room.id,character:'probe'});
    for(const user of users)manager.command(user,'ready',{ready:true,character:'probe'});
    const started=manager.command(users[0],'start');
    for(const user of users)manager.command(user,'loaded',{race:started.race,version:'fixture'});
    const samples=[];
    for(let i=0;i<220;i++){clock+=50;manager.tick();if(i>=20)samples.push(manager.sync(users[0]).frame.metrics);}
    const summary={players:count,frames:samples.length};
    for(const key of ['workMs','physicsMs','collisionMs','payloadBytes']){
      const values=samples.map(s=>s[key]);summary[key]={mean:Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100,p95:q(values,.95)};
    }
    console.log(JSON.stringify(summary));manager.close();
  }
}finally{rmSync(dir,{recursive:true,force:true});}
