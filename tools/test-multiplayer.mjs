import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {createMultiplayer} from '../multiplayer-server.mjs';
import {createRacePhysicsFactory} from '../server-physics.mjs';
import {createKartServer} from '../server.mjs';
import {readFileSync} from 'node:fs';

const project=resolve(import.meta.dirname,'..');
const catalog={tracks:[{id:'beach_I01',ready:true,courseIndex:0,laps:3}],karts:[{id:'practiceV1',ready:true}],characters:[{id:'dao',ready:true}]};
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'kart-multi-')),path=join(dir,'catalog.json');writeFileSync(path,JSON.stringify(catalog));
  let clock=10000;const inputs=[],saved=[];
  const physics={version:'fixture-v1',speed:'S7',create({slot}){let elapsed=0,x=slot*2;
    return {step(input){inputs.push({...input});elapsed+=50;if(input.throttle)x++;},state(){const s=Array(62).fill(0);s[0]=x;s[19]=elapsed>=9000?3:elapsed>=7000?2:1;s[21]=s[19]===3?4:1;s[24]=s[19]===3?2:0;s[43]=1;return s;}};
  }};
  const players={profile:user=>({nickname:user.id,equippedKart:'practiceV1'})};
  const manager=createMultiplayer({players,root:project,catalogPath:path,now:()=>clock,createPhysics:physics,recordResult:r=>saved.push(r),autoTick:false});
  t.after(()=>{manager.close();rmSync(dir,{recursive:true,force:true});});
  return {manager,physics,path,inputs,saved,advance(ms){clock+=ms;manager.tick();}};
}
function admit(f,count=2){
  const users=Array.from({length:count},(_,i)=>({id:'rider'+i}));
  const room=f.manager.command(users[0],'create',{name:'친구 방',track:'beach_I01',character:'dao'});
  for(const u of users.slice(1))f.manager.command(u,'join',{id:room.id,character:'dao'});
  return {users,room};
}
function readyStart(f,users){for(const u of users)f.manager.command(u,'ready',{ready:true,character:'dao'});return f.manager.command(users[0],'start',{});}
function loaded(f,users,room){for(const u of users)f.manager.command(u,'loaded',{race:room.race,version:f.physics.version});}

test('8-slot admission, ready barrier, host authorization, ownership and host transfer',t=>{
  const f=fixture(t),{users,room}=admit(f,8);
  assert.throws(()=>f.manager.command({id:'ninth'},'join',{id:room.id,character:'dao'}),/ROOM_LOCKED/);
  assert.throws(()=>f.manager.command(users[0],'start',{}),/PLAYERS_NOT_READY/);
  assert.throws(()=>f.manager.command(users[1],'start',{}),/HOST_REQUIRED/);
  assert.equal(f.manager.current(users[0]).players[0].kart,'practiceV1');
  f.manager.command(users[0],'leave');assert.equal(f.manager.current(users[1]).host,users[1].id);
});
test('all players must load the current race version; a missing loader cancels safely',t=>{
  const f=fixture(t),{users}=admit(f),room=readyStart(f,users);
  assert.throws(()=>f.manager.command(users[0],'loaded',{race:room.race,version:'old'}),/VERSION/);
  f.manager.command(users[0],'loaded',{race:room.race,version:f.physics.version});assert.equal(f.manager.current(users[0]).phase,'loading');
  f.advance(20000);for(const u of users)f.manager.current(u);f.advance(10001);assert.equal(f.manager.current(users[0]).phase,'lobby');
});
test('server tick owns movement; replayed inputs and position uploads are rejected; stale throttle stops',t=>{
  const f=fixture(t),{users}=admit(f),room=readyStart(f,users);loaded(f,users,room);
  assert.throws(()=>f.manager.command(users[0],'input',{race:room.race,seq:0,steer:0,position:[999,999]}),/INVALID_INPUT/);
  f.manager.command(users[0],'input',{race:room.race,seq:1,steer:0,throttle:true});
  assert.throws(()=>f.manager.command(users[0],'input',{race:room.race,seq:1,steer:0}),/INVALID_INPUT/);
  f.advance(50);assert.equal(f.inputs[0].throttle,true);assert.equal(f.inputs[1].throttle,false);
  f.advance(500);assert.ok(f.inputs.slice(-2).every(input=>!input.throttle));
});
test('server results persist once, then host can return everyone to waiting',t=>{
  const f=fixture(t),{users}=admit(f),room=readyStart(f,users);loaded(f,users,room);
  for(let i=0;i<180;i++)f.advance(50);
  assert.equal(f.manager.current(users[0]).phase,'results');assert.equal(f.saved.length,2);
  f.advance(50);assert.equal(f.saved.length,2);
  assert.throws(()=>f.manager.command(users[1],'return',{}),/HOST_REQUIRED/);
  assert.equal(f.manager.command(users[0],'return',{}).phase,'lobby');
});
test('invalid admission does not leak rooms, chat is bounded and disconnected members expire',t=>{
  const f=fixture(t);
  assert.throws(()=>f.manager.command({id:'bad'},'create',{name:'bad',track:'beach_I01',character:'../bad'}),/CHARACTER/);assert.equal(f.manager.list().rooms.length,0);
  const {users}=admit(f);f.manager.command(users[0],'chat',{text:'<img onerror=alert(1)>'});
  assert.equal(f.manager.current(users[1]).chat[0].text,'<img onerror=alert(1)>');
  assert.throws(()=>f.manager.command(users[0],'chat',{text:'spam'}),/RATE/);
  f.advance(30001);assert.equal(f.manager.list().rooms.length,0);
});
test('HTTP room API requires login, blocks foreign origins and streams both players',async t=>{
  const f=fixture(t),server=createKartServer({databasePath:':memory:',catalogPath:f.path,multiplayerPhysicsFactory:f.physics});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,controllers=[];
  t.after(async()=>{for(const c of controllers)c.abort();server.close();await once(server,'close');});
  const post=(path,fields,cookie,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(fields)});
  assert.equal((await fetch(base+'/api/multi/rooms')).status,401);
  const cookies=[];
  for(const name of ['multi_alpha','multi_beta']){const r=await post('/api/auth/register',{handle:name,password:'local-test-password'});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
  assert.equal((await post('/api/multi/create',{name:'blocked',track:'beach_I01',character:'dao'},cookies[0],{Origin:'https://other.invalid'})).status,403);
  const made=await (await post('/api/multi/create',{name:'두 명 테스트',track:'beach_I01',character:'dao'},cookies[0])).json();
  assert.ok(made.id);assert.equal((await post('/api/multi/join',{id:made.id,character:'dao'},cookies[1])).status,200);
  for(const cookie of cookies){
    const controller=new AbortController();controllers.push(controller);
    const response=await fetch(base+'/api/multi/events',{headers:{Cookie:cookie},signal:controller.signal});assert.match(response.headers.get('content-type'),/event-stream/);
    const reader=response.body.getReader();let text='';while(!text.includes('event: room'))text+=new TextDecoder().decode((await reader.read()).value);
    assert.match(text,/multi_alpha/);assert.match(text,/multi_beta/);
  }
});
test('real authoritative WASM gives distinct original grid slots and advances both racers',()=>{
  const root=join(project,'web-preview'),fullCatalog=JSON.parse(readFileSync(join(root,'assets/catalog.json'))),factory=createRacePhysicsFactory(root,fullCatalog);
  assert.equal(factory.speed,'S7');
  const a=factory.create({track:'beach_I01',kart:'practiceV1',slot:0}),b=factory.create({track:'beach_I01',kart:'cottonV1',slot:1});
  const first=a.state(),second=b.state();assert.ok(Math.abs(Math.hypot(first[0]-second[0],first[1]-second[1])-2)<.001);
  const input={throttle:false,brake:false,steer:0,drift:false,boost:false,exceed:false};
  for(let i=0;i<160;i++){a.step({...input,throttle:true});b.step(input);}
  const sa=a.state(),sb=b.state();assert.equal(sa[19],2);assert.ok(sa[6]>sb[6]);assert.ok(Math.hypot(sa[0]-first[0],sa[1]-first[1])>1);assert.ok(sa.every(Number.isFinite)&&sb.every(Number.isFinite));
});
