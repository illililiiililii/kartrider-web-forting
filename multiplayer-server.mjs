import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRacePhysicsFactory} from './server-physics.mjs';
import {resolvePlayers} from './peer-collision.mjs';
import {rankPlayers} from './race-ranking.mjs';

const emptyInput=()=>({throttle:false,brake:false,steer:0,drift:false,boost:false,exceed:false,reset:false});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
// Browser transport and simulation are ours. Room phases/8 slots follow the
// supplied P5136_Rust world.rs / room_protocol.rs; no native TCP/UDP compatibility.
export function createMultiplayer({players,root,catalogPath,now=Date.now,createPhysics,recordResult=()=>{},autoTick=true}){
  const rooms=new Map(),membership=new Map(),streams=new Map();let factory,catalog;
  function assets(){
    if(!catalog)catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
    if(!factory)factory=createPhysics??createRacePhysicsFactory(root,catalog);
    return factory;
  }
  function snapshot(room){return {id:room.id,revision:room.revision,name:room.name,track:room.track,host:room.host,phase:room.phase,race:room.race,speed:factory.speed,version:factory.version,
    players:[...room.members.values()].map(p=>({id:p.id,nickname:p.nickname,kart:p.kart,character:p.character,slot:p.slot,ready:p.ready,loaded:p.loaded,finished:p.finished,time:p.time})),chat:room.chat,results:room.results};}
  function send(id,event,data){const stream=streams.get(id);if(!stream||stream.response.destroyed||stream.response.writableEnded)return;if(stream.response.writableLength>256*1024){stream.response.destroy();return;}stream.response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
  function broadcast(room,event='room',value){if(event==='room'){room.revision++;value=snapshot(room);}if(event==='frame')room.frame=value;for(const id of room.members.keys())send(id,event,value);}
  function roomFor(user){const room=rooms.get(membership.get(user.id));if(!room)fail('ROOM_REQUIRED',409);return room;}
  function character(value){if(!catalog.characters.some(c=>c.ready&&c.id===value))fail('CHARACTER_UNAVAILABLE');return value;}
  function leave(user){
    const room=rooms.get(membership.get(user.id));if(!room)return;
    room.members.delete(user.id);membership.delete(user.id);room.engines?.delete(user.id);send(user.id,'room',null);
    if(!room.members.size){rooms.delete(room.id);return;}
    if(room.host===user.id)room.host=room.members.keys().next().value;
    if(room.phase==='loading')cancel(room,'플레이어가 나가 로딩을 취소했습니다.');else broadcast(room);
  }
  function cancel(room,message){room.phase='lobby';room.engines=null;room.frame=null;room.results=[];room.chat.push({nickname:'안내',text:message});room.chat=room.chat.slice(-30);for(const p of room.members.values()){p.ready=false;p.loaded=false;}broadcast(room);}
  function settle(room){
    room.phase='results';room.engines=null;
    room.results=[...room.members.values()].sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||a.slot-b.slot).map((p,index)=>({id:p.id,nickname:p.nickname,rank:p.finished?index+1:null,time:p.time??null,dnf:!p.finished}));
    for(const result of room.results)recordResult({race:room.race,track:room.track,...result});broadcast(room);
  }
  function start(room){
    try{
      const engines=new Map();for(const p of room.members.values())engines.set(p.id,assets().create({track:room.track,kart:p.kart,slot:p.slot}));
      room.engines=engines;room.phase='running';room.started=now();room.simulated=0;room.lastTick=now();room.accumulator=0;room.firstFinish=null;broadcast(room);
    }catch{cancel(room,'트랙·출발 위치를 준비하지 못했습니다.');}
  }
  function tick(){
    const time=now();
    for(const [id,stream] of streams){if(time-stream.heartbeat>=10000){if(!stream.authenticate()){stream.response.end();continue;}stream.response.write(': heartbeat\n\n');stream.heartbeat=time;}}
    for(const room of rooms.values()){
      for(const p of [...room.members.values()])if(!streams.has(p.id)&&time-p.seen>30000)leave(p);
      if(room.phase==='loading'&&time-room.loadingAt>30000){cancel(room,'로딩 제한시간이 지났습니다.');continue;}
      if(room.phase!=='running')continue;
      room.accumulator+=Math.max(0,Math.min(250,time-room.lastTick));room.lastTick=time;
      try{while(room.accumulator>=50&&room.phase==='running'){
        room.accumulator-=50;room.simulated+=50;const states=[];
        // Advance all racers together at the native 5ms step before contacts.
        for(let step=0;step<10;step++){
          const previous=new Map([...room.engines].flatMap(([id,e])=>{const b=e.body?.();return b?.active?[[id,b.center]]:[];}));
          for(const p of room.members.values()){
            const input=time-p.inputAt<=350?p.input:emptyInput();room.engines.get(p.id).step(input,5);p.input.reset=false;
          }
          resolvePlayers(room.engines,previous);
        }
        for(const p of room.members.values()){
          const engine=room.engines.get(p.id);
          const state=engine.state();
          if(state.length!==62||state.some(value=>!Number.isFinite(value)))throw new Error('NON_FINITE_PHYSICS');
          if(!p.finished&&state[19]===3){p.finished=true;p.time=Math.round(state[24]*1000);room.firstFinish??=room.simulated;}
          states.push({id:p.id,state,progress:engine.progress?.()??0});
        }
        broadcast(room,'frame',{race:room.race,tick:room.simulated,players:rankPlayers(states,room.members)});
        if([...room.members.values()].every(p=>p.finished)||(room.firstFinish!==null&&room.simulated-room.firstFinish>=60000)||room.simulated>=600000)settle(room);
      }}catch(error){console.error('Multiplayer race stopped:',error.message);cancel(room,'경기 처리에 실패해 대기실로 돌아왔습니다.');}
    }
  }
  const timer=autoTick?setInterval(tick,25):null;timer?.unref();
  return {tick,
    list(){assets();return {speed:factory.speed,rooms:[...rooms.values()].map(room=>({id:room.id,name:room.name,track:room.track,count:room.members.size,phase:room.phase}))};},
    current(user){const room=rooms.get(membership.get(user.id));if(room)room.members.get(user.id).seen=now();return room?snapshot(room):null;},
    sync(user){const room=this.current(user);return {room,frame:room?rooms.get(room.id).frame??null:null};},
    connect(user,response,authenticate){
      const old=streams.get(user.id);if(old){old.response.write('event: replaced\ndata: {}\n\n');old.response.end();}
      response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});response.write(': connected\n\n');
      const stream={response,authenticate,heartbeat:now()};streams.set(user.id,stream);
      response.on('close',()=>{if(streams.get(user.id)===stream){streams.delete(user.id);const room=rooms.get(membership.get(user.id));if(room){const p=room.members.get(user.id);p.seen=now();p.input=emptyInput();}}});
      send(user.id,'room',this.current(user));
    },
    command(user,action,fields={}){
      if(action==='leave'){leave(user);return null;}
      assets();
      if(action==='create'||action==='join'){
        if(membership.has(user.id))fail('ALREADY_IN_ROOM',409);
        const profile=players.profile(user),chosen=character(fields.character);
        let room;
        if(action==='create'){
          if(rooms.size>=32)fail('ROOM_LIMIT',409);
          const name=typeof fields.name==='string'?fields.name.trim():'';
          if(!name||name.length>40)fail('INVALID_ROOM_NAME');
          if(!catalog.tracks.some(t=>t.ready&&t.id===fields.track&&Number.isInteger(t.courseIndex)))fail('TRACK_UNAVAILABLE');
          room={id:randomUUID(),revision:0,host:user.id,name,track:fields.track,phase:'lobby',race:null,members:new Map(),chat:[],results:[]};rooms.set(room.id,room);
        }else{room=rooms.get(fields.id);if(!room)fail('ROOM_NOT_FOUND',404);if(room.phase!=='lobby'||room.members.size>=8)fail('ROOM_LOCKED',409);}
        const slot=Array.from({length:8},(_,i)=>i).find(i=>![...room.members.values()].some(p=>p.slot===i));
        room.members.set(user.id,{id:user.id,user,nickname:profile.nickname,kart:profile.equippedKart,character:chosen,slot,ready:false,loaded:false,seen:now(),input:emptyInput(),inputAt:0,seq:-1,chatAt:-Infinity});
        membership.set(user.id,room.id);broadcast(room);return snapshot(room);
      }
      const room=roomFor(user),p=room.members.get(user.id);p.seen=now();
      if(action==='chat'){
        if(now()-p.chatAt<500)fail('CHAT_RATE_LIMIT',429);
        const text=typeof fields.text==='string'?fields.text.trim():'';if(!text||text.length>160)fail('INVALID_CHAT');
        p.chatAt=now();room.chat.push({nickname:p.nickname,text});room.chat=room.chat.slice(-30);broadcast(room);return snapshot(room);
      }
      if(action==='ready'){
        if(room.phase!=='lobby')fail('ROOM_LOCKED',409);
        p.kart=players.profile(user).equippedKart;p.character=character(fields.character);p.ready=fields.ready===true;broadcast(room);return snapshot(room);
      }
      if(action==='start'){
        if(user.id!==room.host)fail('HOST_REQUIRED',403);
        if(room.phase!=='lobby'||room.members.size<2||[...room.members.values()].some(p=>!p.ready))fail('PLAYERS_NOT_READY',409);
        if([...rooms.values()].filter(r=>['loading','running'].includes(r.phase)).length>=4)fail('SERVER_BUSY',429);
        room.phase='loading';room.race=randomUUID();room.loadingAt=now();room.results=[];room.frame=null;
        for(const member of room.members.values()){member.loaded=member.finished=false;member.time=null;member.input=emptyInput();member.seq=-1;}
        broadcast(room);return snapshot(room);
      }
      if(action==='loaded'){
        if(room.phase!=='loading'||fields.race!==room.race||fields.version!==factory.version)fail('RACE_VERSION_MISMATCH',409);
        p.loaded=true;broadcast(room);if([...room.members.values()].every(p=>p.loaded))start(room);return snapshot(room);
      }
      if(action==='input'){
        if(room.phase!=='running'||fields.race!==room.race)fail('RACE_REQUIRED',409);
        if(!Number.isSafeInteger(fields.seq)||fields.seq<=p.seq||![-1,0,1].includes(fields.steer)||Object.hasOwn(fields,'position'))fail('INVALID_INPUT');
        if(now()-p.inputAt<20)return {accepted:false};
        p.seq=fields.seq;p.inputAt=now();p.input=Object.fromEntries(Object.keys(emptyInput()).map(k=>[k,k==='steer'?fields.steer:fields[k]===true]));return {accepted:true};
      }
      if(action==='return'){
        if(room.phase!=='results'||room.host!==user.id)fail('HOST_REQUIRED',403);
        cancel(room,'다음 경기를 준비하세요.');return snapshot(room);
      }
      fail('UNKNOWN_ACTION',404);
    },
    close(){if(timer)clearInterval(timer);for(const s of streams.values())s.response.end();streams.clear();rooms.clear();membership.clear();}
  };
}
