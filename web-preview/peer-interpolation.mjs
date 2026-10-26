// Render only between authoritative snapshots. A short delay absorbs normal
// arrival jitter without inventing physics or changing the server's 5ms step.
export function samplePeerState(snapshots,tick){
  if(!snapshots.length)return null;
  if(tick<=snapshots[0].tick)return snapshots[0].state;
  for(let i=1;i<snapshots.length;i++){
    const a=snapshots[i-1],b=snapshots[i];
    if(tick>b.tick)continue;
    const t=Math.max(0,Math.min(1,(tick-a.tick)/(b.tick-a.tick)));
    const state=b.state.slice();
    for(const index of [0,1,14])state[index]=a.state[index]+(b.state[index]-a.state[index])*t;
    const sign=a.state.slice(43,47).reduce((sum,v,j)=>sum+v*b.state[43+j],0)<0?-1:1;
    let norm=0;
    for(let j=43;j<47;j++){state[j]=a.state[j]+(b.state[j]*sign-a.state[j])*t;norm+=state[j]*state[j];}
    norm=Math.sqrt(norm)||1;for(let j=43;j<47;j++)state[j]/=norm;
    return state;
  }
  return snapshots.at(-1).state;
}
