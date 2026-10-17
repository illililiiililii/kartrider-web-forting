import * as THREE from './vendor/three.module.min.js';
import {clamp,formatTime,Progress} from './physics.js';
import {DrivingState} from './driving.js';
const $=id=>document.getElementById(id),keys=new Set(),canvas=$('game');
let renderer,scene,camera,track,kart,course,colliders=[],ready=false,state='loading',elapsed=0,countdown=3,startBoostArmed=false,progress,best=null,accumulator=0,previous=performance.now(),lobbyAngle=0;
let catalog,selected={track:'village_R01',kart:'spectorV1',character:'dao'},driving=new DrivingState(),loading=false,loadSerial=0,driverGroup,ws=null,ownId=null,room=null,lastPose=0,remote=new Map(),multiplayer=false;const kartPreviews=new Map();
const car={x:0,y:0,z:0,vx:0,vy:0,vz:0,heading:0,speed:0,drift:false},safe={x:0,y:0,z:0,heading:0};
const ray=new THREE.Raycaster(),look=new THREE.Vector3(),camTarget=new THREE.Vector3();
let music=new Audio('assets/tracks/village_R01/bgm.ogg');music.loop=true;music.volume=.28;let soundOn=false;
const kartSoundRoot='assets/original-ui/sound/fx/kart/',motorSound=new Audio(kartSoundRoot+'engine_V1/motor.ogg'),driftSound=new Audio(kartSoundRoot+'drift.ogg'),boostSound=new Audio(kartSoundRoot+'engine_V1/booster.ogg');motorSound.loop=true;motorSound.volume=.08;driftSound.volume=.33;boostSound.volume=.38;let previousRaceDrift=false,previousRaceBoost=false;
function playKartSound(sound){if(!soundOn)return;sound.currentTime=0;sound.play().catch(()=>{});}
const speedGlyphs=new Image(),speedCanvas=document.createElement('canvas');speedCanvas.id='speed-sprite';speedCanvas.width=114;speedCanvas.height=44;speedCanvas.hidden=true;$('speed').parentElement.append(speedCanvas);
speedGlyphs.onload=()=>{speedCanvas.hidden=false;$('speed').hidden=true;};speedGlyphs.src='assets/original-ui/stage/speedIndiGame/속도_num.png';
function drawOriginalSpeed(value){if(!speedGlyphs.complete||!speedGlyphs.naturalWidth)return;const ctx=speedCanvas.getContext('2d'),digits=String(Math.min(999,Math.max(0,Math.round(value)))).padStart(3,'0');ctx.clearRect(0,0,114,44);for(let i=0;i<3;i++)ctx.drawImage(speedGlyphs,Number(digits[i])*38,0,38,44,i*38,0,38,44);}
try{selected={...selected,...JSON.parse(localStorage.getItem('kart-web-selection')||'{}')};}catch{}
function bestKey(){return `kart-web-best-${selected.track}`;}
function readBest(){try{best=Number(localStorage.getItem(bestKey()))||null;}catch{best=null;}updateBest();}
function updateBest(){const txt=best?formatTime(best):'—';$('best').textContent=txt;$('best-hud').textContent='BEST '+txt;}updateBest();
const textures=new Map();
async function loadScene(file,mapping={},kartSkinUrl=null){
 const response=await fetch(file);if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);
 const data=await response.arrayBuffer(),view=new DataView(data);let offset=0;
 const u=()=>{let v=view.getUint32(offset,true);offset+=4;return v;},f=()=>{let v=view.getFloat32(offset,true);offset+=4;return v;},s=n=>{let b=new Uint8Array(data,offset,n);offset+=n;return new TextDecoder().decode(b).split('\0')[0];};
 if(s(4)!=='KTRK'||u()!==2)throw new Error('지원하지 않는 KTRK 파일');
 const count=u();u();u();const bounds=[f(),f(),f(),f(),f(),f()],group=new THREE.Group(),loader=new THREE.TextureLoader();
 for(let i=0;i<count;i++){
  const name=s(96),texture=s(96),flags=u(),vc=u(),ic=u(),positions=new Float32Array(vc*3),uv=new Float32Array(vc*2);
  if(vc>1000000||ic>3000000)throw new Error('메시 크기 제한 초과');
  for(let j=0;j<vc;j++){positions[j*3]=f();positions[j*3+1]=f();positions[j*3+2]=f();uv[j*2]=f();uv[j*2+1]=1-f();}
  const indices=new Uint32Array(ic);for(let j=0;j<ic;j++){indices[j]=u();if(indices[j]>=vc)throw new Error('잘못된 메시 인덱스');}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(indices,1));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  let map=null,url=kartSkinUrl|| (mapping[texture]?'assets/'+mapping[texture]:null);
  if(url){if(!textures.has(url)){const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.set(url,t);}map=textures.get(url);}
  const mat=new THREE.MeshBasicMaterial({map,color:map?0xffffff:kartSkinUrl?0xc3d0d8:0x9cb5a9,side:THREE.DoubleSide,alphaTest:.35});
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.userData.flags=flags;
  // Collision-only invisible volumes carry no texture. Keep them for ray tests.
  if(!kartSkinUrl&&!texture)mesh.visible=false;
  group.add(mesh);if(!kartSkinUrl&&(flags&1))colliders.push(mesh);
 }
 group.userData.bounds=bounds;return group;
}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.background=new THREE.Color('#92cdeb');scene.fog=new THREE.Fog('#b1dcec',900,2300);
  camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,4000);camera.up.set(0,0,1);
  catalog=await fetch('assets/catalog.json').then(r=>r.json());for(const kind of ['track','kart','character'])if(!catalog[kind+'s'].some(v=>v.id===selected[kind]))selected[kind]=catalog[kind+'s'][0].id;
  buildChoices();await loadSelection(true);state='lobby';resize();requestAnimationFrame(frame);renderKartPreviews();
 }catch(e){console.error(e);$('load-status').textContent='불러오기 실패: '+e.message;$('start').textContent='새로고침 후 다시 시도';}
}
const item=kind=>catalog[kind+'s'].find(v=>v.id===selected[kind]);
function buildChoices(){
 for(const kind of ['kart','character','track']){
  const grid=$(kind+'-grid');grid.replaceChildren();for(const entry of catalog[kind+'s']){
   const b=document.createElement('button');b.className='choice '+kind+(entry.id===selected[kind]?' selected':'');b.type='button';
   if(kind==='character'){const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--avatar',entry.color);const img=document.createElement('img');img.src=`assets/characters/${entry.id}/face.png`;img.alt='';avatar.append(img);b.append(avatar);}
   else{const img=document.createElement('img');img.src=kind==='track'?`assets/tracks/${entry.id}/thumbnail.png`:kartPreviews.get(entry.id)||`assets/karts/${entry.id}/skin.png`;img.alt='';b.append(img);}
   const name=document.createElement('strong');name.textContent=entry.name;b.append(name);
   const subtitle=document.createElement('small');subtitle.textContent=kind==='track'?`${entry.laps} LAP · ${entry.gates} CHECKPOINT`:kind==='kart'?'V1 SERIES':'RIDER';b.append(subtitle);
   b.onclick=async()=>{if(loading||room?.stage!=='lobby'&&room)return;selected[kind]=entry.id;try{localStorage.setItem('kart-web-selection',JSON.stringify(selected));}catch{}buildChoices();if(kind!=='character')await loadSelection();else{attachDriver(kart,selected.character);updateSelectionText();}if(room)send({type:'profile',kart:selected.kart,character:selected.character,track:selected.track});};grid.append(b);
  }
 }
 updateSelectionText();
}
async function renderKartPreviews(){let preview;try{const canvas=document.createElement('canvas');preview=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});preview.setSize(220,130,false);preview.setPixelRatio(1);preview.outputColorSpace=THREE.SRGBColorSpace;const mini=new THREE.Scene();const cam=new THREE.PerspectiveCamera(29,220/130,.1,100);cam.up.set(0,0,1);cam.position.set(2.3,3.1,2.1);cam.lookAt(0,0,.42);
 for(const k of catalog.karts){const model=await loadScene(`assets/karts/${k.id}/model.ktrk`,{},`assets/karts/${k.id}/skin.png`);mini.add(model);preview.render(mini,cam);const src=canvas.toDataURL('image/png');kartPreviews.set(k.id,src);for(const b of document.querySelectorAll('#kart-grid .choice'))if(b.textContent.includes(k.name))b.querySelector('img').src=src;mini.remove(model);model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 }catch(e){console.warn('카트 미리보기 생성 실패',e);}finally{preview?.dispose();}}
function updateSelectionText(){
 const t=item('track'),k=item('kart'),c=item('character'),stats=k.stats||{};
 $('selected-summary').textContent=`${c.name} · ${k.name} · ${t.name}`;$('selected-track').textContent=t.name;$('selected-kart').textContent=k.name;$('track-title').textContent=t.name;$('track-laps').textContent=`${t.laps} LAP · ${t.gates} CHECKPOINT`;$('track-thumb').src=`assets/tracks/${t.id}/thumbnail.png`;$('map-name').textContent=t.name.toUpperCase();
 $('showcase-kart').textContent=k.name;$('showcase-rider').textContent=`${c.name} 라이더`;
 // These are the actual recovered V1 BodyParam values, mapped to the four
 // familiar garage labels rather than inventing separate tuning numbers.
 const values={speed:Math.abs(stats.DragFactor||0)*1000,accel:stats.ForwardAccelForce,drift:stats.SteerConstraint*30,boost:stats.DriftEscapeForce/23};
 const caps={speed:90,accel:170,drift:100,boost:100};
 for(const [name,value] of Object.entries(values)){const meter=$('stat-'+name);if(meter)meter.style.setProperty('--value',`${clamp((Number(value)||0)/(caps[name]||100)*100,12,100)}%`);}
}
function attachDriver(vehicle,charId){if(!vehicle)return;const old=vehicle.getObjectByName('web-driver');if(old)vehicle.remove(old);const entry=catalog.characters.find(c=>c.id===charId),group=new THREE.Group();group.name='web-driver';const color=new THREE.Color(entry.color),suit=new THREE.MeshBasicMaterial({color}),dark=new THREE.MeshBasicMaterial({color:0x172436}),skin=new THREE.MeshBasicMaterial({color:0xffcfaa}),cap=new THREE.MeshBasicMaterial({color:color.clone().lerp(new THREE.Color(0xffffff),.18)});
 // The original character portrait sits on a round, visible face; keeping the
 // front clear avoids the opaque visor that used to hide every chosen rider.
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.235,.30,5,10),suit);body.position.set(0,-.14,.98);group.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.345,16,12),skin);head.position.set(0,-.23,1.48);group.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.353,16,10,0,Math.PI*2,0,Math.PI*.43),cap);helmet.position.set(0,-.23,1.48);group.add(helmet);
 for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.105,10,8),skin);ear.position.set(.315*side,-.23,1.49);group.add(ear);}
 // The face card must sit beyond the head sphere's front surface (-.575).
 // Previously it was buried inside the sphere, leaving every rider faceless.
 const face=new THREE.Mesh(new THREE.PlaneGeometry(.54,.28),new THREE.MeshBasicMaterial({map:textures.get(`assets/characters/${charId}/face.png`),transparent:true,side:THREE.DoubleSide,alphaTest:.05}));face.rotation.x=Math.PI/2;face.position.set(0,-.606,1.47);group.add(face);
 for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.082,.32,4,8),suit);arm.position.set(.29*side,-.35,1.00);arm.rotation.z=-.65*side;arm.rotation.x=Math.PI/2;group.add(arm);const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.22,4,8),dark);leg.position.set(.15*side,-.02,.65);leg.rotation.x=Math.PI/2;group.add(leg);}
 vehicle.add(group);driverGroup=group;
}
async function loadSelection(initial=false){if(loading)return;loading=true;ready=false;$('start').disabled=true;$('load-status').textContent='선택한 카트와 트랙을 불러오는 중…';const serial=++loadSerial;
 try{const t=item('track'),k=item('kart'),trackBase=`assets/tracks/${t.id}`,kartBase=`assets/karts/${k.id}`;
  const [mapping,newCourse]=await Promise.all([fetch(`${trackBase}/textures.json`).then(r=>r.json()),fetch(`${trackBase}/course.json`).then(r=>r.json())]);
  if(!track||track.userData.id!==t.id){colliders=[];const newTrack=await loadScene(`${trackBase}/track.ktrk`,mapping);newTrack.userData.id=t.id;if(track)scene.remove(track);track=newTrack;scene.add(track);course=newCourse;music.pause();music.src=`${trackBase}/bgm.ogg`;if(soundOn)music.play().catch(()=>{});}
  if(!kart||kart.userData.id!==k.id){const newKart=await loadScene(`${kartBase}/model.ktrk`,{},`${kartBase}/skin.png`);newKart.userData.id=k.id;if(kart)scene.remove(kart);kart=newKart;scene.add(kart);const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.45,20),new THREE.MeshBasicMaterial({color:0x102c3a,transparent:true,opacity:.25,depthWrite:false}));shadow.position.z=.03;kart.add(shadow);}
  for(const c of catalog.characters){const url=`assets/characters/${c.id}/face.png`;if(!textures.has(url)){const tex=await new THREE.TextureLoader().loadAsync(url);tex.colorSpace=THREE.SRGBColorSpace;textures.set(url,tex);}}
  attachDriver(kart,selected.character);const box=new THREE.Box3().setFromObject(kart),size=box.getSize(new THREE.Vector3());driving=new DrivingState(k.stats,{halfWidth:clamp(size.x*.35,.55,1.8),halfLength:clamp(size.y*.35,.65,2.4),suspensionRange:.5,groundedDragScale:1});readBest();updateSelectionText();progress=new Progress(course.gates,t.laps);resetCar(true);ready=true;$('start').disabled=false;$('start').textContent=room?'방장 출발 대기':'혼자 달리기';$('load-status').textContent='원본 에셋 준비 완료 · 3D 주행 물리 적용';
 }catch(e){console.error(e);$('load-status').textContent='불러오기 실패: '+e.message;}finally{loading=false;}
}
function resetCar(start=false){
 let r=start?course.spawn:progress?.gates[Math.max(0,progress.next-1)]?.records[0]||course.spawn;
 const h=Math.atan2(r[3],r[4]);car.x=r[0]-r[3]*(start?12:3);car.y=r[1]-r[4]*(start?12:3);car.z=r[2];car.heading=h;car.vx=car.vy=car.vz=car.speed=0;driving.reset({x:car.x,y:car.y,z:car.z,heading:h});
 Object.assign(safe,{x:car.x,y:car.y,z:car.z,heading:h});updateKart();camera.position.set(car.x-10*Math.sin(h),car.y-10*Math.cos(h),car.z+5);keys.clear();
}
function startRace(){if(!ready)return;if(room){if(room.hostId===ownId&&room.stage==='lobby')send({type:'start'});return;}beginRace();}
function beginRace(seconds=3){if(!ready)return;for(const d of [$('results'),$('info'),$('multiplayer')])if(d.open)d.close();state='countdown';elapsed=0;countdown=seconds;startBoostArmed=false;previousRaceDrift=previousRaceBoost=false;progress=new Progress(course.gates,item('track').laps);resetCar(true);$('lobby').hidden=true;$('hud').hidden=false;document.body.classList.add('racing');$('pause').textContent='일시정지 · Esc';if(soundOn){music.play().catch(()=>{});motorSound.play().catch(()=>{});}canvas.focus();}
function garage(){state='lobby';motorSound.pause();$('garage-screen').hidden=true;$('home-screen').hidden=false;keys.clear();if($('results').open)$('results').close();$('hud').hidden=true;$('lobby').hidden=false;document.body.classList.remove('racing');if(room)leaveRoom();resetCar(true);}
let beforePause='race';function pause(){if(state==='race'||state==='countdown'){beforePause=state;state='paused';motorSound.pause();keys.clear();$('message').textContent='PAUSED';$('pause').textContent='계속하기 · Esc';}else if(state==='paused'){state=beforePause;if(soundOn)motorSound.play().catch(()=>{});$('message').textContent='';$('pause').textContent='일시정지 · Esc';}}
function finish(){state='finished';motorSound.pause();car.speed=0;keys.clear();if(room)send({type:'finish',time:elapsed});$('again').textContent=room?'방에서 나가기':'다시 달리기 ↗';$('finish-time').textContent=formatTime(elapsed);const record=!best||elapsed<best;if(record){best=elapsed;try{localStorage.setItem(bestKey(),String(best));}catch{}}
 updateBest();$('record-status').textContent=record?'새로운 개인 최고 기록입니다.':'완주 기록이 측정되었습니다.';$('results').showModal();}
function groundQuery(origin,delta){const o=new THREE.Vector3(...origin),d=new THREE.Vector3(...delta),distance=d.length();if(distance<1e-6)return null;ray.set(o,d.normalize());ray.far=distance;const hit=ray.intersectObjects(colliders,false).find(h=>{const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);return n.z>.65;});if(!hit)return null;const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);return {point:[hit.point.x,hit.point.y,hit.point.z],normal:[n.x,n.y,n.z]};}
function bodySweep(from,to,axes){
 const movement=new THREE.Vector3(to[0]-from[0],to[1]-from[1],0),distance=movement.length();if(distance<1e-6)return null;
 const direction=movement.multiplyScalar(1/distance),right=new THREE.Vector3(...axes.right),forward=new THREE.Vector3(...axes.forward),width=driving.geometry.halfWidth*.8,length=driving.geometry.halfLength*.8;
 const reach=width+length+.2,minX=Math.min(from[0],to[0])-reach,maxX=Math.max(from[0],to[0])+reach,minY=Math.min(from[1],to[1])-reach,maxY=Math.max(from[1],to[1])+reach;
 const nearby=colliders.filter(mesh=>{const b=mesh.geometry.boundingBox;return b&&b.max.x>=minX&&b.min.x<=maxX&&b.max.y>=minY&&b.min.y<=maxY&&b.max.z>=from[2]+.2&&b.min.z<=from[2]+1;});
 if(!nearby.length)return null;
 const samples=[[0,0],[width,length],[-width,length],[width,-length],[-width,-length]];let nearest=null;
 for(const [side,front] of samples)for(const height of [.28,.8]){
  const origin=new THREE.Vector3(from[0],from[1],from[2]+height).addScaledVector(right,side).addScaledVector(forward,front);
  ray.set(origin,direction);ray.far=distance+.035;
  for(const hit of ray.intersectObjects(nearby,false)){
   const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);if(Math.abs(n.z)>.65)continue;
   // Track collision meshes contain both triangle windings; oppose travel on
   // either face so a reverse-side impact cannot slip through the barrier.
   if(n.dot(direction)>0)n.negate();if(n.dot(direction)>-.05)continue;
   if(!nearest||hit.distance<nearest.distance)nearest={distance:hit.distance,normal:[n.x,n.y,n.z]};break;
  }
 }
 return nearest?{normal:nearest.normal,fraction:Math.max(0,(nearest.distance-.025)/distance)}:null;
}
function tick(dt){
 if(state==='countdown'){
  // A press in the final 0.1 seconds of the countdown arms the launch boost.
  // Earlier acceleration inputs do not qualify, matching the timing-based start.
  const throttle=keys.has('ArrowUp')||keys.has('KeyW');
  if(throttle&&countdown<=.1&&countdown>.02)startBoostArmed=true;
  countdown-=dt;$('message').textContent=countdown>0?String(Math.ceil(countdown)):'GO!';
  if(countdown<=0){state='race';if(startBoostArmed){driving.startBoost(driving.config().startBoosterTime);$('message').textContent='START BOOST!';}}
  return;
 }
 if(state!=='race')return;
 elapsed+=dt;if(elapsed>1)$('message').textContent='';
 const old=[car.x,car.y,car.z+.8],throttle=keys.has('ArrowUp')||keys.has('KeyW'),brake=keys.has('ArrowDown')||keys.has('KeyS'),steer=(keys.has('ArrowLeft')||keys.has('KeyA')?1:0)-(keys.has('ArrowRight')||keys.has('KeyD')?1:0);
 const motion=driving.step(dt,{forward:throttle,reverse:brake,steer,drift:keys.has('ShiftLeft')||keys.has('ShiftRight'),boost:keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('Space'),groundQuery,bodySweep});car.x=driving.position[0];car.y=driving.position[1];car.z=driving.position[2];car.heading=driving.heading;car.speed=driving.speed;car.drift=motion.mode==='drift'||motion.mode==='trigger';
 if(car.drift&&!previousRaceDrift)playKartSound(driftSound);previousRaceDrift=car.drift;
 const boosting=driving.nitroTime>0;if(boosting&&!previousRaceBoost)playKartSound(boostSound);previousRaceBoost=boosting;
 motorSound.playbackRate=clamp(.75+Math.abs(driving.vf)/70,.75,1.6);motorSound.volume=clamp(.035+Math.abs(driving.vf)/700,.035,.14);
 car.vz=driving.linearVelocity[2];
 if(car.z<-40||!Number.isFinite(car.x)){resetCar();return;}
 if(progress.update(old,[car.x,car.y,car.z+.8])){if(progress.finished){finish();return;}Object.assign(safe,{x:car.x,y:car.y,z:car.z,heading:car.heading});}
 updateKart();
}
function updateKart(){if(!kart)return;kart.position.set(car.x,car.y,car.z);kart.quaternion.set(...driving.orientation);}
function drawMap(){const c=$('map').getContext('2d'),xs=course.route.map(p=>p[0]),ys=course.route.map(p=>p[1]),b=[Math.min(...xs),Math.min(...ys),0,Math.max(...xs),Math.max(...ys)],sx=205/Math.max(1,b[3]-b[0]),sy=205/Math.max(1,b[4]-b[1]),scale=Math.min(sx,sy),cx=(b[0]+b[3])/2,cy=(b[1]+b[4])/2;
 const xy=p=>[120+(p[0]-cx)*scale,120-(p[1]-cy)*scale];c.clearRect(0,0,240,240);c.strokeStyle='#9bb7c6';c.lineWidth=4;c.lineJoin='round';c.beginPath();course.route.forEach((p,i)=>{const q=xy(p);i?c.lineTo(...q):c.moveTo(...q)});c.closePath();c.stroke();
 const next=progress?.gates[progress.next].records[0];if(next){const q=xy(next);c.fillStyle='#c7ff53';c.beginPath();c.arc(...q,4,0,Math.PI*2);c.fill();}
 for(const peer of remote.values()){if(peer.pose){const q=xy([peer.pose.x,peer.pose.y]);c.fillStyle='#ffad36';c.beginPath();c.arc(...q,4,0,Math.PI*2);c.fill();}}
 const p=xy([car.x,car.y]);c.save();c.translate(...p);c.rotate(car.heading);c.fillStyle='#ffe348';c.strokeStyle='#062234';c.lineWidth=2;c.beginPath();c.moveTo(0,-8);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fill();c.stroke();c.restore();
}
function frame(now){const dt=Math.min((now-previous)/1000,.05);previous=now;accumulator+=dt;while(accumulator>=.005){tick(.005);accumulator-=.005;}
 if(state==='lobby'){
  // Garage presentation is a slow front three-quarter orbit, so the selected
  // Kart and the rider's original face texture are both readable before race.
  lobbyAngle+=dt*.22;const a=lobbyAngle,h=car.heading,fx=Math.sin(h),fy=Math.cos(h),sx=Math.cos(h),sy=-Math.sin(h);
  camera.position.set(car.x+fx*(5.0+Math.cos(a)*.65)+sx*(2.75+Math.sin(a)*.9),car.y+fy*(5.0+Math.cos(a)*.65)+sy*(2.75+Math.sin(a)*.9),car.z+3.15+Math.sin(a)*.18);camera.lookAt(car.x,car.y,car.z+1.02);
 }
 else{
  const distance=9+Math.min(3,Math.abs(car.speed)*.035);camTarget.set(car.x-Math.sin(car.heading)*distance,car.y-Math.cos(car.heading)*distance,car.z+4.5);camera.position.lerp(camTarget,1-Math.exp(-6*dt));look.set(car.x+Math.sin(car.heading)*10,car.y+Math.cos(car.heading)*10,car.z+1.1);camera.lookAt(look);camera.fov+=( (driving.nitroTime>0?73:63)-camera.fov)*Math.min(1,dt*4);camera.updateProjectionMatrix();
  const speedKmh=driving.speed*3.6;$('speed').textContent=Math.round(speedKmh);drawOriginalSpeed(speedKmh);$('time').textContent=formatTime(elapsed);$('lap').innerHTML=`${Math.min(progress?.lap||1,item('track').laps)} <em>/ ${item('track').laps}</em>`;$('checkpoint').textContent=`CHECKPOINT ${progress?.next||0} / ${course.gates.length}`;$('boost-fill').style.width=`${driving.charge*100}%`;$('boost-label').textContent=`N₂O ${driving.nitro} / 2 · Ctrl`;$('drift-label').textContent=driving.startBoostTime>0?'START BOOST':driving.nitroTime>0?'BOOST ON':driving.mode==='trigger'?'DRIFT ENTRY':car.drift?'DRIFT':'GRIP';drawMap();
 }
 if(room&&state==='race'&&now-lastPose>65){lastPose=now;send({type:'pose',x:car.x,y:car.y,z:car.z,heading:car.heading,speed:car.speed});}
 for(const peer of remote.values())if(peer.mesh&&peer.pose){const p=peer.pose;peer.mesh.position.lerp(new THREE.Vector3(p.x,p.y,p.z),Math.min(1,dt*12));peer.mesh.rotation.z=Math.PI-p.heading;}
 renderer.render(scene,camera);requestAnimationFrame(frame);
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function send(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
function leaveRoom(){if(ws){ws.close();ws=null;}room=null;ownId=null;multiplayer=false;for(const p of remote.values())if(p.mesh)scene.remove(p.mesh);remote.clear();$('room-details').hidden=true;$('room-status').textContent='';$('racer-list').replaceChildren();$('start').textContent='혼자 달리기';$('start').disabled=!ready;}
async function updateRoom(data){room=data;multiplayer=true;$('room-details').hidden=false;$('room-code').textContent=data.code;$('room-players').replaceChildren();$('racer-list').replaceChildren();
 for(const p of data.players){const line=document.createElement('div');line.textContent=`${p.id===data.hostId?'★ ':''}${p.name} · ${catalog.karts.find(k=>k.id===p.kart)?.name||p.kart}${p.finish!=null?' · '+formatTime(p.finish):''}`;$('room-players').append(line);$('racer-list').append(line.cloneNode(true));if(p.id!==ownId&&!remote.has(p.id)){const peer={mesh:null,pose:null};remote.set(p.id,peer);loadScene(`assets/karts/${p.kart}/model.ktrk`,{},`assets/karts/${p.kart}/skin.png`).then(mesh=>{if(remote.get(p.id)!==peer)return;peer.mesh=mesh;attachDriver(mesh,p.character);scene.add(mesh);});}}
 for(const [id,p] of remote)if(!data.players.some(v=>v.id===id)){if(p.mesh)scene.remove(p.mesh);remote.delete(id);}
 $('room-start').hidden=data.hostId!==ownId||data.stage!=='lobby';$('room-status').textContent=data.stage==='lobby'?`방 ${data.code} · ${data.players.length}/8명 대기 중`:'레이스 진행 중';$('start').textContent=data.hostId===ownId?'함께 출발':'방장 출발 대기';$('start').disabled=data.hostId!==ownId||!ready;
 if(data.track!==selected.track){selected.track=data.track;buildChoices();await loadSelection();}
 if(data.stage==='countdown'&&state==='lobby')beginRace(clamp((data.startAt-Date.now())/1000,.1,3));
}
function connectRoom(action){if(ws)leaveRoom();const url=`${location.protocol==='https:'?'wss':'ws'}://${location.host}/multiplayer`;ws=new WebSocket(url);$('room-status').textContent='서버 연결 중…';ws.onopen=()=>send({type:action,name:$('rider-name').value||'Rider',code:$('room-code-input').value,track:selected.track,kart:selected.kart,character:selected.character});ws.onmessage=async e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='hello')ownId=m.id;else if(m.type==='room')await updateRoom(m);else if(m.type==='pose'){const p=remote.get(m.id);if(p)p.pose=m;}else if(m.type==='leave'){const p=remote.get(m.id);if(p?.mesh)scene.remove(p.mesh);remote.delete(m.id);}else if(m.type==='error')$('room-status').textContent=m.message;};ws.onerror=()=>$('room-status').textContent='멀티플레이 서버에 연결할 수 없습니다.';ws.onclose=()=>{if(room)$('room-status').textContent='연결이 끊겼습니다.';};}
function selectGarageTab(name){for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);for(const kind of ['kart','character','track'])$(kind+'-grid').hidden=kind!==name;}
function showOriginalMode(type){
 const menu=$('original-mode-menu');menu.hidden=false;$('original-single-menu').hidden=type!=='single';$('original-multi-menu').hidden=type!=='multi';$('original-mode-title').textContent=type==='single'?'싱글 플레이':'멀티플레이';
}
function navigateHome(where){
 if(where==='play'){showOriginalMode('single');return;}
 if(where==='multi'){showOriginalMode('multi');return;}
 if(where==='garage'||where==='track'){$('original-mode-menu').hidden=true;$('home-screen').hidden=true;$('garage-screen').hidden=false;selectGarageTab(where==='track'?'track':'kart');$('garage-heading-title').textContent=where==='track'?'트랙 선택 · 스피드전':'내 카트와 캐릭터';return;}
 if(where==='lobby'){$('original-mode-menu').hidden=true;$('garage-screen').hidden=true;$('home-screen').hidden=false;return;}
 if(where==='profile'||where==='club'||where==='tune'||where==='exchange'||where==='shop'){$('info').querySelector('h2').textContent=({profile:'내 정보',club:'클럽',tune:'튜닝',exchange:'교환',shop:'상점'})[where];$('info').querySelector('p').textContent='웹 포팅 로비에서 준비 중인 메뉴입니다.';$('info').showModal();}
}
addEventListener('resize',resize);addEventListener('keydown',e=>{const onControl=e.target instanceof HTMLElement&&e.target.closest('button,a,input,dialog');if((state==='race'||state==='countdown')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){if(!$('info').open&&!$('results').open)pause();return;}if(e.code==='Enter'&&state==='lobby'&&!onControl)startRace();if(e.code==='KeyR'&&state==='race')resetCar();if(!onControl)keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(state==='race'||state==='countdown')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='race'||state==='countdown'))pause();});
$('start').onclick=startRace;
document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>navigateHome(b.dataset.home));
document.querySelectorAll('.mode-choice').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mode-choice').forEach(x=>x.classList.toggle('selected',x===b));navigateHome(b.dataset.mode==='track'?'track':b.dataset.mode==='time'?'play':'multi');});
$('original-mode-close').onclick=()=>$('original-mode-menu').hidden=true;
document.querySelectorAll('[data-original-action]').forEach(b=>b.onclick=()=>{
 const action=b.dataset.originalAction;
 if(action==='time')navigateHome('track');
 else if(action==='kart')navigateHome('garage');
 else if(action==='rooms'||action==='speed-individual'){$('original-mode-menu').hidden=true;$('multiplayer').showModal();}
 else {$('original-mode-menu').hidden=true;$('info').querySelector('h2').textContent=b.getAttribute('aria-label')||'게임 모드';$('info').querySelector('p').textContent='이 모드는 아직 구현되지 않았습니다. 현재 웹 멀티플레이는 스피드 개인전 방만 지원합니다.';$('info').showModal();}
});
$('garage-back').onclick=()=>navigateHome('lobby');$('again').onclick=()=>room?garage():startRace();$('garage').onclick=garage;$('exit').onclick=garage;$('pause').onclick=pause;
$('reset').onclick=()=>{if(state==='race'||state==='paused')resetCar();};$('help').onclick=()=>$('info').showModal();$('close-info').onclick=()=>$('info').close();
$('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent='사운드 '+(soundOn?'ON':'OFF');$('sound').setAttribute('aria-label','배경음악 '+(soundOn?'끄기':'켜기'));if(soundOn){music.play().catch(()=>{});if(state==='race'||state==='countdown')motorSound.play().catch(()=>{});}else{music.pause();motorSound.pause();}};
for(const tab of document.querySelectorAll('[data-tab]'))tab.onclick=()=>selectGarageTab(tab.dataset.tab);
$('multi-open').onclick=()=>$('multiplayer').showModal();$('multi-close').onclick=()=>$('multiplayer').close();$('room-create').onclick=()=>connectRoom('create');$('room-join').onclick=()=>connectRoom('join');$('room-start').onclick=startRace;$('room-leave').onclick=leaveRoom;
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);});for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>keys.delete(b.dataset.key));}
init();
