import test from 'node:test';
import assert from 'node:assert/strict';
import {createMultiplayerClient} from '../web-preview/multiplayer.mjs';

test('delayed public poll still delivers frames while concurrent driving inputs are sent',async t=>{
  const saved=Object.fromEntries(['document','location','fetch','setInterval','setTimeout','Option'].map(k=>[k,globalThis[k]]));
  t.after(()=>Object.assign(globalThis,saved));
  const node=()=>({classList:{add(){},remove(){}},replaceChildren(){},add(){},scrollHeight:0,value:''}),nodes=new Map();
  globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
  globalThis.Option=class {};
  globalThis.location={hostname:'qa.trycloudflare.com',search:''};
  let inputTick,completePoll;const scheduled=[],frames=[],diagnostics=[];
  globalThis.setInterval=callback=>{inputTick=callback;return 1;};
  globalThis.setTimeout=callback=>{scheduled.push(callback);return 1;};
  const room={id:'room',revision:1,name:'test',host:'self',phase:'running',race:'race',speed:'S7',players:[{id:'self',nickname:'QA',slot:0,kart:'practiceV1',ready:true}],chat:[]};
  const response=value=>({ok:true,json:async()=>value});
  globalThis.fetch=async url=>{
    if(url.endsWith('/sync'))return new Promise(resolve=>{completePoll=value=>resolve(response(value));});
    if(url.endsWith('/current'))return response(room);
    if(url.endsWith('/rooms'))return response({rooms:[]});
    if(url.endsWith('/input'))return response({accepted:true});
    throw new Error('Unexpected request '+url);
  };
  const client=createMultiplayerClient({catalog:{tracks:[],karts:[]},userId:'self',getCharacter:()=> 'dao',getControls:()=>({steer:0,throttle:true}),onPrepare:async()=>{},onStart(){},onFrame:frame=>frames.push(frame),onDiagnostics:value=>diagnostics.push(value),onDisconnect(){},onLeave(){}});
  await client.open();assert.ok(completePoll);
  // A WAN response can arrive after several input requests. Those requests
  // must not invalidate a frame, unlike a leave/join mutation.
  await inputTick();await inputTick();await inputTick();
  completePoll({room,frame:{race:'race',tick:150,players:[]}});
  await new Promise(resolve=>saved.setTimeout(resolve,0));
  assert.equal(frames.length,1);assert.equal(frames[0].tick,150);assert.equal(scheduled.length,1);
  assert.ok(diagnostics[0].rttMs>=0);
});
