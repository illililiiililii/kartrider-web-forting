// Deterministic peer-render comparison with ordered 0/80ms arrival jitter.
import {samplePeerState} from '../web-preview/peer-interpolation.mjs';
const state=x=>{const s=Array(62).fill(0);s[0]=x;s[43]=1;return s;};
const arrivals=[];let lastArrival=0;
for(let tick=50,i=0;tick<=2000;tick+=50,i++){
  const delay=i%4===2?80:0;
  lastArrival=Math.max(lastArrival+1,tick+delay);
  arrivals.push({arrival:lastArrival,tick,state:state(tick*.01)});
}
const snapshots=[];let next=0,oldFrom=0,oldTarget=0,oldReceived=0,oldVisual=0,offset=null;
const oldSteps=[],newSteps=[];let prevOld=null,prevNew=null;
for(let now=50;now<=2100;now+=1000/60){
  while(next<arrivals.length&&arrivals[next].arrival<=now){
    const frame=arrivals[next++];oldFrom=oldVisual;oldTarget=frame.state[0];oldReceived=now;
    offset??=now-frame.tick;snapshots.push({tick:frame.tick,state:frame.state});if(snapshots.length>8)snapshots.shift();
  }
  if(!snapshots.length)continue;
  oldVisual=oldFrom+(oldTarget-oldFrom)*Math.min(1,(now-oldReceived)/50);
  const current=samplePeerState(snapshots,now-offset-100)[0];
  if(prevOld!==null){oldSteps.push(Math.abs(oldVisual-prevOld));newSteps.push(Math.abs(current-prevNew));}
  prevOld=oldVisual;prevNew=current;
}
const summarize=steps=>({maxStep:Math.round(Math.max(...steps)*1000)/1000,stalledFrames:steps.filter(x=>x<.0001).length});
console.log(JSON.stringify({scenario:'ordered 50ms snapshots, every fourth packet delayed 80ms, 60 FPS',old:summarize(oldSteps),buffered:summarize(newSteps)}));
