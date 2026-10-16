import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:8316);
const host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ogg':'audio/ogg','.ktrk':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 let decoded;try{decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const normalized=path.resolve(root,'.'+decoded);
 if(!normalized.startsWith(root+path.sep)&&normalized!==root){res.writeHead(403).end();return;}
 const file=normalized===root?path.join(root,'index.html'):normalized;
 fs.stat(file,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
 });
});

const rooms=new Map(),wss=new WebSocketServer({server,path:'/multiplayer',maxPayload:4096});
const validTrack=new Set(['village_R01','village_I01','forest_I01','desert_I02','ice_I01']);
const validKart=new Set(['spectorV1','whiteKnightV1','stormV1','cottonV1','saberV1','sangunV1','titanV1','practiceV1']);
const validCharacter=new Set(['dao','bazzi','dizni','marid']);
const send=(ws,obj)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
const publicRoom=room=>({type:'room',code:room.code,hostId:room.hostId,track:room.track,stage:room.stage,startAt:room.startAt,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,kart:p.kart,character:p.character,finish:p.finish}))});
const broadcast=(room,obj,except)=>{for(const p of room.players.values())if(p.ws!==except)send(p.ws,obj);};
const publish=room=>broadcast(room,publicRoom(room));
const clean=(v,max)=>String(v||'').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,max);
wss.on('connection',ws=>{
 const player={ws,id:crypto.randomUUID(),name:'Rider',kart:'spectorV1',character:'dao',finish:null,lastPose:0};let room=null;
 send(ws,{type:'hello',id:player.id});
 ws.on('message',raw=>{
  let m;try{m=JSON.parse(raw);}catch{return;}
  if(!m||typeof m!=='object')return;
  if(m.type==='create'&&!room){
   let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
   player.name=clean(m.name,16)||'Rider';if(validKart.has(m.kart))player.kart=m.kart;if(validCharacter.has(m.character))player.character=m.character;
   room={code,hostId:player.id,track:validTrack.has(m.track)?m.track:'village_R01',stage:'lobby',startAt:0,players:new Map([[player.id,player]])};rooms.set(code,room);publish(room);return;
  }
  if(m.type==='join'&&!room){
   const found=rooms.get(clean(m.code,6).toUpperCase());if(!found){send(ws,{type:'error',message:'방을 찾을 수 없습니다.'});return;}
   if(found.players.size>=8){send(ws,{type:'error',message:'방이 가득 찼습니다.'});return;}
   if(found.stage!=='lobby'){send(ws,{type:'error',message:'이미 레이스가 시작됐습니다.'});return;}
   room=found;player.name=clean(m.name,16)||'Rider';if(validKart.has(m.kart))player.kart=m.kart;if(validCharacter.has(m.character))player.character=m.character;
   room.players.set(player.id,player);publish(room);return;
  }
  if(!room)return;
  if(m.type==='profile'&&room.stage==='lobby'){
   if(validKart.has(m.kart))player.kart=m.kart;if(validCharacter.has(m.character))player.character=m.character;
   if(room.hostId===player.id&&validTrack.has(m.track))room.track=m.track;
   publish(room);return;
  }
  if(m.type==='start'&&room.hostId===player.id&&room.stage==='lobby'){
   room.stage='countdown';room.startAt=Date.now()+3300;for(const p of room.players.values())p.finish=null;
   publish(room);return;
  }
  if(m.type==='pose'&&room.stage==='countdown')room.stage='race';
  if(m.type==='pose'&&room.stage==='race'){
   const now=Date.now();if(now-player.lastPose<45)return;player.lastPose=now;
   const a=[m.x,m.y,m.z,m.heading,m.speed];if(!a.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<100000))return;
   broadcast(room,{type:'pose',id:player.id,x:m.x,y:m.y,z:m.z,heading:m.heading,speed:m.speed,at:now},ws);return;
  }
  if(m.type==='finish'&&room.stage==='race'&&player.finish===null){
   const duration=Number(m.time);if(!Number.isFinite(duration)||duration<5||duration>7200)return;
   player.finish=Math.round(duration*1000)/1000;publish(room);
  }
 });
 ws.on('close',()=>{if(!room)return;room.players.delete(player.id);broadcast(room,{type:'leave',id:player.id});if(!room.players.size)rooms.delete(room.code);else{if(room.hostId===player.id)room.hostId=room.players.keys().next().value;publish(room);}});
});
server.listen(port,host,()=>console.log(`KartRider Web: http://127.0.0.1:${port} (${host})`));
