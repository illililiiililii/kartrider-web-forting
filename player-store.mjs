import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

// Local single-player policy, not recovered 5136 shop prices/reward tables.
export const ECONOMY={welcome:3000,kart:2000,rename:500,daily:500,raceLucci:100,raceExperience:50};
export const STARTER_KARTS=['practiceV1','cottonV1'];
export const levelForExperience=experience=>1+Math.floor(Math.sqrt(Math.max(0,experience)/100));
function fail(code,status=400){throw Object.assign(new Error(code),{status});}

export function createPlayerStore(database,{catalogPath,now=Date.now}) {
  database.exec(`CREATE TABLE IF NOT EXISTS player_profiles(
    user_id TEXT PRIMARY KEY REFERENCES users(id), nickname TEXT NOT NULL,
    nickname_key TEXT NOT NULL UNIQUE, lucci INTEGER NOT NULL CHECK(lucci>=0),
    experience INTEGER NOT NULL DEFAULT 0, equipped_kart TEXT NOT NULL DEFAULT 'practiceV1',last_daily TEXT);
    CREATE TABLE IF NOT EXISTS player_inventory(user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),PRIMARY KEY(user_id,kind,item_id));
    CREATE TABLE IF NOT EXISTS player_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),
    track TEXT NOT NULL,laps INTEGER NOT NULL,started_at INTEGER NOT NULL,claimed INTEGER NOT NULL DEFAULT 0);`);
  function transaction(fn){database.exec('BEGIN IMMEDIATE');try{const result=fn();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}}
  function catalog(){try{return JSON.parse(readFileSync(catalogPath,'utf8'));}catch{fail('CATALOG_UNAVAILABLE',503);}}
  function ensure(user){
    if(database.prepare('SELECT 1 FROM player_profiles WHERE user_id=?').get(user.id))return;
    let nickname=user.handle.normalize('NFKC'),key=nickname.toLowerCase();
    if(database.prepare('SELECT 1 FROM player_profiles WHERE nickname_key=?').get(key)){
      nickname=nickname.slice(0,12)+'_'+user.id.slice(0,6);key=nickname.toLowerCase();
    }
    transaction(()=>{
      database.prepare('INSERT INTO player_profiles(user_id,nickname,nickname_key,lucci) VALUES(?,?,?,?)').run(user.id,nickname,key,ECONOMY.welcome);
      for(const id of STARTER_KARTS)database.prepare('INSERT INTO player_inventory VALUES(?,?,?,1)').run(user.id,'kart',id);
    });
  }
  function profile(user){
    ensure(user);const p=database.prepare('SELECT nickname,lucci,experience,equipped_kart,last_daily FROM player_profiles WHERE user_id=?').get(user.id);
    const level=levelForExperience(p.experience),inventory=database.prepare('SELECT kind,item_id AS id,quantity FROM player_inventory WHERE user_id=? ORDER BY kind,item_id').all(user.id);
    const today=new Date(now()+9*3600000).toISOString().slice(0,10);
    return {nickname:p.nickname,lucci:p.lucci,experience:p.experience,level,nextLevelExperience:100*level*level,
      levelStartExperience:100*(level-1)*(level-1),equippedKart:p.equipped_kart,inventory,dailyAvailable:p.last_daily!==today};
  }
  function shop(user){
    const p=profile(user),owned=new Set(p.inventory.filter(i=>i.kind==='kart').map(i=>i.id));
    return {policy:ECONOMY,items:[...catalog().karts.filter(k=>k.ready&&!STARTER_KARTS.includes(k.id)).map(k=>({id:k.id,label:k.label,kind:'kart',price:ECONOMY.kart,owned:owned.has(k.id)})),
      {id:'nickname-change',label:'닉네임 변경권',kind:'consumable',price:ECONOMY.rename,owned:false}]};
  }
  function purchase(user,fields){
    ensure(user);const item=shop(user).items.find(i=>i.id===fields?.id&&i.kind===fields?.kind);
    if(!item)fail('ITEM_NOT_FOR_SALE',404);
    transaction(()=>{
      if(item.kind==='kart'&&database.prepare('SELECT 1 FROM player_inventory WHERE user_id=? AND kind=? AND item_id=?').get(user.id,item.kind,item.id))fail('ALREADY_OWNED',409);
      const result=database.prepare('UPDATE player_profiles SET lucci=lucci-? WHERE user_id=? AND lucci>=?').run(item.price,user.id,item.price);
      if(!result.changes)fail('NOT_ENOUGH_LUCCI',409);
      database.prepare(`INSERT INTO player_inventory VALUES(?,?,?,1)
        ON CONFLICT(user_id,kind,item_id) DO UPDATE SET quantity=quantity+1`).run(user.id,item.kind,item.id);
    });return profile(user);
  }
  function equip(user,fields){
    ensure(user);const id=fields?.id;
    if(!catalog().karts.some(k=>k.id===id&&k.ready))fail('KART_UNAVAILABLE',404);
    if(!database.prepare("SELECT 1 FROM player_inventory WHERE user_id=? AND kind='kart' AND item_id=?").get(user.id,id))fail('KART_NOT_OWNED',403);
    database.prepare('UPDATE player_profiles SET equipped_kart=? WHERE user_id=?').run(id,user.id);return profile(user);
  }
  function rename(user,fields){
    ensure(user);const nickname=typeof fields?.nickname==='string'?fields.nickname.trim().normalize('NFKC'):'';
    if(!/^[\p{L}\p{N}_]{2,16}$/u.test(nickname))fail('INVALID_NICKNAME');
    const key=nickname.toLowerCase();
    transaction(()=>{
      const existing=database.prepare('SELECT user_id FROM player_profiles WHERE nickname_key=?').get(key);
      if(existing){if(existing.user_id===user.id)fail('NICKNAME_UNCHANGED');fail('NICKNAME_TAKEN',409);}
      const ticket=database.prepare("SELECT quantity FROM player_inventory WHERE user_id=? AND kind='consumable' AND item_id='nickname-change'").get(user.id);
      if(!ticket)fail('RENAME_TICKET_REQUIRED',409);
      if(ticket.quantity===1)database.prepare("DELETE FROM player_inventory WHERE user_id=? AND kind='consumable' AND item_id='nickname-change'").run(user.id);
      else database.prepare("UPDATE player_inventory SET quantity=quantity-1 WHERE user_id=? AND kind='consumable' AND item_id='nickname-change'").run(user.id);
      database.prepare('UPDATE player_profiles SET nickname=?,nickname_key=? WHERE user_id=?').run(nickname,key,user.id);
    });return profile(user);
  }
  function daily(user){
    ensure(user);const today=new Date(now()+9*3600000).toISOString().slice(0,10);
    const result=database.prepare('UPDATE player_profiles SET lucci=lucci+?,last_daily=? WHERE user_id=? AND (last_daily IS NULL OR last_daily<>?)').run(ECONOMY.daily,today,user.id,today);
    if(!result.changes)fail('DAILY_ALREADY_CLAIMED',409);return profile(user);
  }
  function start(user,fields){
    ensure(user);const track=catalog().tracks.find(t=>t.id===fields?.track&&t.ready&&t.laps>0);
    if(!track)fail('TRACK_UNAVAILABLE',404);
    const id=randomUUID();
    transaction(()=>{
      database.prepare('DELETE FROM player_runs WHERE user_id=?').run(user.id);
      database.prepare('INSERT INTO player_runs(id,user_id,track,laps,started_at) VALUES(?,?,?,?,?)').run(id,user.id,track.id,track.laps,now());
    });return {id};
  }
  function finish(user,fields){
    ensure(user);
    transaction(()=>{
      const run=database.prepare('SELECT * FROM player_runs WHERE id=? AND user_id=?').get(fields?.id??'',user.id);
      if(!run)fail('RUN_NOT_FOUND',404);
      if(run.claimed)fail('RUN_ALREADY_CLAIMED',409);
      const milliseconds=fields?.milliseconds;
      if(fields?.completedLaps!==run.laps||!Number.isSafeInteger(milliseconds)||milliseconds<1||now()-run.started_at<7000+milliseconds||now()-run.started_at>7200000)fail('INVALID_RACE_RESULT');
      database.prepare('UPDATE player_runs SET claimed=1 WHERE id=?').run(run.id);
      database.prepare('UPDATE player_profiles SET lucci=lucci+?,experience=experience+? WHERE user_id=?').run(ECONOMY.raceLucci,ECONOMY.raceExperience,user.id);
    });return {profile:profile(user),reward:{lucci:ECONOMY.raceLucci,experience:ECONOMY.raceExperience}};
  }
  return {profile,shop,purchase,equip,rename,daily,start,finish};
}
