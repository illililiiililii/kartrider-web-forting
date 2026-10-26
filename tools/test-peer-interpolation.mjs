import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePeerState} from '../web-preview/peer-interpolation.mjs';

const state=(x,q=[1,0,0,0])=>{const s=Array(62).fill(0);s[0]=x;s[14]=1;s.splice(43,4,...q);return s;};
test('irregular network snapshots interpolate by server time and hold the latest pose',()=>{
  const frames=[{tick:50,state:state(5)},{tick:100,state:state(10)},{tick:250,state:state(25)}];
  assert.equal(samplePeerState(frames,175)[0],17.5);
  assert.equal(samplePeerState(frames,30)[0],5);
  assert.equal(samplePeerState(frames,300)[0],25);
});
test('orientation chooses the shortest quaternion arc and remains unit length',()=>{
  const frames=[{tick:0,state:state(0,[1,0,0,0])},{tick:50,state:state(1,[-1,0,0,0])}];
  const pose=samplePeerState(frames,25);
  assert.equal(pose[0],.5);
  assert.equal(pose[43],1);
  assert.equal(Math.hypot(...pose.slice(43,47)),1);
});
