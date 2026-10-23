import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {once} from 'node:events';
import {createKartServer} from '../server.mjs';
import {levelForExperience} from '../player-store.mjs';

test('player balances, ownership, rename tickets and rewards persist and reject duplicate/forged requests',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kart-player-test-'));
  const catalogPath=join(directory,'catalog.json'),databasePath=join(directory,'accounts.sqlite');
  writeFileSync(catalogPath,JSON.stringify({karts:[{id:'practiceV1',label:'연습카트',ready:true},{id:'cottonV1',label:'코튼',ready:true},{id:'whiteKnightV1',label:'백기사',ready:true},{id:'missing',label:'미변환',ready:false}],tracks:[{id:'beach_I01',ready:true,laps:3}]}));
  let clock=Date.now(),server,base;
  async function open(){server=createKartServer({catalogPath,databasePath,now:()=>clock});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  async function close(){server.close();await once(server,'close');}
  const request=(path,fields,cookie,headers={})=>fetch(base+'/api/'+path,{method:fields===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(fields===undefined?{}:{body:JSON.stringify(fields)})});
  try{
    await open();
    const registration=await request('auth/register',{handle:'shop_rider',password:'local economy test'});
    const cookie=registration.headers.get('set-cookie').split(';')[0];const id=(await registration.json()).user.id;
    const p=()=>request('player/profile',undefined,cookie).then(r=>r.json());
    let profile=await p();assert.equal(profile.lucci,3000);assert.equal(profile.level,1);
    assert.deepEqual(profile.inventory.map(i=>i.id),['cottonV1','practiceV1']);
    assert.equal((await request('player/purchase',{kind:'kart',id:'whiteKnightV1'})).status,401);
    assert.equal((await request('player/purchase',{kind:'kart',id:'whiteKnightV1'},cookie,{Origin:'https://evil.example'})).status,403);
    assert.equal((await request('player/equip',{id:'whiteKnightV1'},cookie)).status,403);
    assert.equal((await request('player/purchase',{kind:'kart',id:'missing'},cookie)).status,404);
    const buys=await Promise.all([0,1].map(()=>request('player/purchase',{kind:'kart',id:'whiteKnightV1',price:0},cookie)));
    assert.deepEqual(buys.map(r=>r.status).sort(),[200,409]);assert.equal((await p()).lucci,1000);
    assert.equal((await request('player/equip',{id:'whiteKnightV1'},cookie)).status,200);
    assert.equal((await request('player/purchase',{kind:'consumable',id:'nickname-change',quantity:999,price:-10},cookie)).status,200);
    assert.equal((await p()).lucci,500); // Request fields never choose the price or quantity.
    assert.equal((await request('player/rename',{nickname:'<bad>'},cookie)).status,400);
    const other=await request('auth/register',{handle:'other_rider',password:'local economy test'});const otherCookie=other.headers.get('set-cookie').split(';')[0];
    await request('player/profile',undefined,otherCookie);
    assert.equal((await request('player/rename',{nickname:'OTHER_RIDER'},cookie)).status,409);
    assert.equal((await p()).inventory.find(i=>i.id==='nickname-change').quantity,1);
    assert.equal((await request('player/rename',{nickname:'새라이더'},cookie)).status,200);
    assert.equal((await p()).inventory.some(i=>i.id==='nickname-change'),false);
    const me=await (await request('auth/me',undefined,cookie)).json();assert.equal(me.user.handle,'shop_rider');assert.equal(me.user.id,id);
    assert.equal((await request('auth/login',{handle:'shop_rider',password:'local economy test'})).status,200);
    assert.equal((await request('player/daily',{},cookie)).status,200);assert.equal((await request('player/daily',{},cookie)).status,409);
    let ticket=await (await request('player/race/start',{track:'beach_I01'},cookie)).json();
    const result=()=>({id:ticket.id,milliseconds:120000,completedLaps:3,lucci:999999});
    assert.equal((await request('player/race/finish',result(),cookie)).status,400);
    clock+=127000;
    assert.equal((await request('player/race/finish',result(),otherCookie)).status,404);
    assert.equal((await request('player/race/finish',{...result(),completedLaps:2},cookie)).status,400);
    assert.equal((await request('player/race/finish',result(),cookie)).status,200);
    assert.equal((await request('player/race/finish',result(),cookie)).status,409);
    assert.equal((await p()).experience,50);assert.equal((await p()).lucci,1100);
    ticket=await (await request('player/race/start',{track:'beach_I01'},cookie)).json();clock+=127000;
    await request('player/race/finish',result(),cookie);assert.equal((await p()).level,2);
    profile=await p();await close();await open();assert.deepEqual(await p(),profile);
    assert.equal(profile.equippedKart,'whiteKnightV1');assert.equal(profile.nickname,'새라이더');
  }finally{
    if(server?.listening)await close();
    const target=resolve(directory);if(!target.startsWith(resolve(tmpdir())+sep+'kart-player-test-'))throw new Error('Unexpected test cleanup path');
    rmSync(target,{recursive:true,force:true});
  }
});

test('level thresholds depend on saved experience',()=>{
  assert.deepEqual([0,99,100,399,400,900].map(levelForExperience),[1,1,2,2,3,4]);
});
