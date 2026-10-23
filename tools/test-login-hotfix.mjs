import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readAccountSession} from '../web-preview/account-session.mjs';
import {createKartServer} from '../server.mjs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';

test('old profile API and DB failures surface as errors instead of login loops',async()=>{
  const user={id:'legacy',handle:'legacy_user'};
  for(const status of [404,500]){
    const fetcher=async path=>Response.json(path==='/api/auth/me'?{user}:{error:'NOT_FOUND'},{status:path==='/api/auth/me'?200:status});
    await assert.rejects(readAccountSession(fetcher),status===404?/이전 임시 서버/:/유저 DB/);
  }
  assert.equal(await readAccountSession(async()=>Response.json({user:null})),null);
  const session=await readAccountSession(async path=>Response.json(path==='/api/auth/me'?{user}:{nickname:'legacy_user'}));
  assert.equal(session.user.id,user.id);assert.equal(session.profile.nickname,user.handle);
});

test('different local servers cannot overwrite each other with a shared host cookie',async()=>{
  const servers=[4173,4174].map(port=>createKartServer({databasePath:':memory:',sessionCookieName:`kart_session_${port}`}));
  const addresses=[];const cookies=[];
  try{
    for(const [index,server] of servers.entries()){
      server.listen(0,'127.0.0.1');await once(server,'listening');const address=`http://127.0.0.1:${server.address().port}`;addresses.push(address);
      const response=await fetch(address+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:`hotfix_${index}`,password:'persistent test password'})});
      assert.equal(response.status,200);cookies.push(response.headers.get('set-cookie').split(';')[0]);
    }
    for(const [index,address] of addresses.entries()){
      const headers={Cookie:cookies.join('; ')};
      const {user}=await(await fetch(address+'/api/auth/me',{headers})).json();assert.equal(user.handle,`hotfix_${index}`);
      const profile=await(await fetch(address+'/api/player/profile',{headers})).json();assert.equal(profile.inventory.length,2);
    }
  }finally{for(const server of servers){server.close();await once(server,'close');}}
});

test('legacy credentials gain durable profiles and keep working after server restart',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kart-login-migration-')),path=join(directory,'accounts.sqlite');
  const salt=randomBytes(16),hash=scryptSync('legacy password unchanged',salt,64);
  const old=new DatabaseSync(path);
  old.exec('CREATE TABLE users(id TEXT PRIMARY KEY,handle TEXT NOT NULL UNIQUE COLLATE NOCASE,salt BLOB NOT NULL,password_hash BLOB NOT NULL,created_at INTEGER NOT NULL)');
  old.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('legacy-id','legacy_user',salt,hash,Date.now());old.close();
  let server,base;
  async function start(){server=createKartServer({databasePath:path,sessionCookieName:'kart_session_4174'});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  async function stop(){server.close();await once(server,'close');}
  try{
    await start();
    const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:'legacy_user',password:'legacy password unchanged'})});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
    await stop();await start();
    const headers={Cookie:cookie};const {user}=await(await fetch(base+'/api/auth/me',{headers})).json();assert.equal(user.id,'legacy-id');
    const profile=await(await fetch(base+'/api/player/profile',{headers})).json();assert.equal(profile.inventory.length,2);assert.equal(profile.nickname,'legacy_user');
    const saved=new DatabaseSync(path,{readOnly:true}),row=saved.prepare('SELECT salt,password_hash FROM users').get();
    assert.deepEqual(Buffer.from(row.salt),salt);assert.deepEqual(Buffer.from(row.password_hash),hash);saved.close();
  }finally{
    if(server?.listening)await stop();
    if(!resolve(directory).startsWith(resolve(tmpdir())+sep+'kart-login-migration-'))throw new Error('Unexpected test cleanup path');
    rmSync(directory,{recursive:true,force:true});
  }
});
