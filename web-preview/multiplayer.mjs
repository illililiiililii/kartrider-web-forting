const $=id=>document.getElementById(id);
const messages={HOST_REQUIRED:'방장만 실행할 수 있습니다.',PLAYERS_NOT_READY:'두 명 이상 입장하고 모두 준비해 주세요.',ROOM_LOCKED:'경기 중이거나 가득 찬 방입니다.',ROOM_NOT_FOUND:'방이 없어졌습니다.',ALREADY_IN_ROOM:'먼저 현재 방에서 나가 주세요.',RACE_VERSION_MISMATCH:'게임 파일이 변경되었습니다. 새로고침해 주세요.',MULTIPLAYER_UNAVAILABLE:'멀티플레이 서버·로컬 에셋을 확인해 주세요.',SIGN_IN_REQUIRED:'다시 로그인해 주세요.',CHAT_RATE_LIMIT:'메시지를 잠시 후 보내 주세요.'};
export function createMultiplayerClient({catalog,userId,getCharacter,getControls,onPrepare,onStart,onFrame,onResults,onLeave,onDisconnect,onRoster}){
  let room=null,stream=null,preparedRace=null,runningRace=null,preparing=null,pendingFrame=null,sequence=0,sending=false,enabled=false,polling=false,lastTick=-1,lastRace=null,mutation=0;
  const panel=$('multi-dialog'),status=$('multi-status');
  async function request(action,fields){
    if(fields!==undefined&&action!=='input')mutation++;
    const response=await fetch('/api/multi/'+action,{credentials:'same-origin',cache:'no-store',...(fields===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)})});
    const result=await response.json();if(!response.ok)throw new Error(messages[result.error]??result.error);return result;
  }
  const showError=error=>{status.textContent=error.message;};
  function render(){
    $('multi-browser').hidden=Boolean(room);$('multi-room').hidden=!room;if(!room)return;
    const self=room.players.find(p=>p.id===userId),host=room.host===userId;
    $('multi-room-name').textContent=`${room.name} · ${room.speed} · ${catalog.tracks.find(t=>t.id===room.track)?.label??room.track}`;
    $('multi-members').replaceChildren(...room.players.map(p=>{const li=document.createElement('li');li.textContent=`${p.slot+1}. ${p.nickname}${p.id===room.host?' [방장]':''} · ${catalog.karts.find(k=>k.id===p.kart)?.label??p.kart} · ${p.loaded&&room.phase==='loading'?'로딩 완료':p.ready?'준비 완료':'대기'}`;return li;}));
    $('multi-ready').textContent=self?.ready?'준비 취소':'준비';$('multi-ready').disabled=room.phase!=='lobby';
    $('multi-start').hidden=!host;$('multi-start').disabled=room.phase!=='lobby'||room.players.length<2||room.players.some(p=>!p.ready);
    $('multi-return').hidden=!host||room.phase!=='results';
    $('multi-results').replaceChildren(...(room.results??[]).map(p=>{const row=document.createElement('p');row.textContent=`${p.rank??'미완주'} · ${p.nickname} · ${p.time===null?'DNF':(p.time/1000).toFixed(2)+'초'}`;return row;}));
    $('multi-chat-log').replaceChildren(...room.chat.map(p=>{const row=document.createElement('div');row.textContent=`${p.nickname}: ${p.text}`;return row;}));$('multi-chat-log').scrollTop=$('multi-chat-log').scrollHeight;
    status.textContent=room.phase==='loading'?'모든 플레이어의 트랙 로딩을 기다리는 중…':room.phase==='running'?'경기 진행 중':room.phase==='results'?'경기가 끝났습니다.':'준비 후 방장이 경기를 시작합니다.';
  }
  async function accept(next){
    if(next&&room?.id===next.id&&next.revision<room.revision)return;
    const previous=room;room=next;render();
    if(!room){preparedRace=runningRace=null;preparing=null;pendingFrame=null;if(previous)onLeave();return;}
    if(room.phase==='running'&&runningRace===room.race)onRoster?.(room);
    if(['loading','running'].includes(room.phase)&&preparedRace!==room.race){
      preparedRace=room.race;const race=room.race;
      preparing=(async()=>{await onPrepare(room);if(room?.race!==race)return;
        if(room.phase==='loading')await request('loaded',{race,version:room.version});
      })();
      preparing.catch(async error=>{showError(error);try{await request('leave',{});await accept(null);}catch{}});
    }
    if(room.phase==='running'&&runningRace!==room.race){
      const race=room.race;await preparing;if(room?.race!==race||room.phase!=='running'||runningRace===race)return;
      runningRace=race;sequence=0;onStart(room);panel.classList.add('hidden');
      if(pendingFrame){onFrame(pendingFrame);pendingFrame=null;}
    }
    if(room.phase==='results'&&runningRace){runningRace=null;onResults(room);panel.classList.remove('hidden');}
    if(room.phase==='lobby'&&runningRace){runningRace=null;preparedRace=null;onResults(room);panel.classList.remove('hidden');}
  }
  function connect(){
    // Quick Tunnels cannot carry SSE. Short authenticated HTTP requests work
    // through that proxy; LAN retains its existing low-latency event stream.
    if(location.hostname.endsWith('.trycloudflare.com')||new URLSearchParams(location.search).get('transport')==='poll'){
      if(polling)return;polling=true;enabled=true;
      const poll=async()=>{try{
        const revision=mutation,result=await request('sync');if(revision!==mutation)return;
        if(result.room?.id!==room?.id||result.room?.revision!==room?.revision)await accept(result.room);
        const frame=result.frame;
        if(frame&&frame.race===room?.race&&(frame.race!==lastRace||frame.tick>lastTick)){
          lastRace=frame.race;lastTick=frame.tick;if(runningRace===frame.race)onFrame(frame);else pendingFrame=frame;
        }
      }catch(error){onDisconnect();showError(error);}finally{if(polling)setTimeout(poll,50);}};
      poll();return;
    }
    if(stream)return;stream=new EventSource('/api/multi/events');enabled=true;
    stream.onopen=()=>{status.textContent='연결되었습니다.';};
    stream.addEventListener('room',event=>accept(JSON.parse(event.data)).catch(showError));
    stream.addEventListener('frame',event=>{const frame=JSON.parse(event.data);if(frame.race!==room?.race)return;
      if(runningRace===frame.race)onFrame(frame);else pendingFrame=frame;});
    stream.addEventListener('replaced',()=>{enabled=false;stream.close();stream=null;onDisconnect();status.textContent='다른 탭에서 이 계정을 사용 중입니다.';});
    stream.onerror=()=>{onDisconnect();status.textContent='연결이 끊겨 재접속 중입니다.';};
  }
  async function refresh(){const result=await request('rooms');$('multi-rooms').replaceChildren(...result.rooms.map(entry=>{
    const button=document.createElement('button');button.textContent=`${entry.name} · ${entry.count}/8 · ${catalog.tracks.find(t=>t.id===entry.track)?.label??entry.track}`;button.disabled=entry.phase!=='lobby'||entry.count>=8;
    button.onclick=()=>request('join',{id:entry.id,character:getCharacter()}).then(accept).catch(showError);return button;
  }));if(!result.rooms.length)$('multi-rooms').textContent='열린 방이 없습니다. 방을 만들어 주세요.';}
  for(const track of catalog.tracks.filter(t=>t.ready&&Number.isInteger(t.courseIndex)))$('multi-track').add(new Option(track.label,track.id));
  $('multi-create').onsubmit=event=>{event.preventDefault();request('create',{name:$('multi-name').value,track:$('multi-track').value,character:getCharacter()}).then(accept).catch(showError);};
  $('multi-refresh').onclick=()=>refresh().catch(showError);
  $('multi-ready').onclick=()=>request('ready',{ready:!room.players.find(p=>p.id===userId)?.ready,character:getCharacter()}).then(accept).catch(showError);
  $('multi-start').onclick=()=>request('start',{}).then(accept).catch(showError);
  $('multi-return').onclick=()=>request('return',{}).then(accept).catch(showError);
  $('multi-chat').onsubmit=event=>{event.preventDefault();const input=$('multi-chat-input');request('chat',{text:input.value}).then(accept).then(()=>{input.value='';}).catch(showError);};
  async function leave(){await request('leave',{});await accept(null);await refresh();}
  $('multi-leave').onclick=()=>leave().catch(showError);
  $('multi-close').onclick=()=>{if(room?.phase==='running')panel.classList.add('hidden');else if(room)leave().then(()=>panel.classList.add('hidden')).catch(showError);else panel.classList.add('hidden');};
  setInterval(async()=>{if(!enabled||!runningRace||sending)return;sending=true;
    try{await request('input',{...getControls(),race:runningRace,seq:sequence++});}catch(error){showError(error);}finally{sending=false;}
  },50);
  return {async open(){connect();panel.classList.remove('hidden');await accept(await request('current'));await refresh();},leave,
    show(){panel.classList.remove('hidden');},get room(){return room;}};
}
