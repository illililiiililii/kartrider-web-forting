// Server-only 3D OBB swept SAT. Positions and velocities are native C world axes.
// Response constants come from the pinned C resolver; pair mass sharing is ours.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function axes(b){const [w,x,y,z]=b.q;return [[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)],
  [2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x)],[2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)]];}
export function contact(a,b,previousA=a.center,previousB=b.center){
  if(!a.active||!b.active)return null;
  const aa=axes(a),bb=axes(b),all=[...aa,...bb,...aa.flatMap(x=>bb.map(y=>cross(x,y)))];
  const end=sub(a.center,b.center),start=sub(previousA,previousB),motion=sub(end,start);
  let enter=0,exit=1,entryNormal=null,depth=Infinity,normal=null,overlap=true;
  for(const axis of all){
    const length=Math.hypot(...axis);if(length<1e-8)continue;const n=mul(axis,1/length);
    const radius=aa.reduce((s,v,i)=>s+Math.abs(dot(v,n))*a.half[i],0)+bb.reduce((s,v,i)=>s+Math.abs(dot(v,n))*b.half[i],0);
    const d=dot(end,n),penetration=radius-Math.abs(d);
    if(penetration<0)overlap=false;
    if(penetration<depth){depth=penetration;normal=mul(n,d<0?-1:1);}
    const s=dot(start,n),v=dot(motion,n);
    if(Math.abs(v)<1e-10){if(Math.abs(s)>radius)return null;continue;}
    const t1=(-radius-s)/v,t2=(radius-s)/v,near=Math.min(t1,t2),far=Math.max(t1,t2);
    if(near>enter){enter=near;entryNormal=mul(n,v>0?-1:1);}exit=Math.min(exit,far);
    if(enter>exit)return null;
  }
  if(overlap&&(!entryNormal||enter<=0))return {normal,depth:Math.max(0,depth)};
  if(!entryNormal||enter<0||enter>1||exit<0)return null;
  // Keep the entry side even if two fast karts crossed within this 5ms step.
  const radius=aa.reduce((s,v,i)=>s+Math.abs(dot(v,entryNormal))*a.half[i],0)+bb.reduce((s,v,i)=>s+Math.abs(dot(v,entryNormal))*b.half[i],0);
  return {normal:entryNormal,depth:Math.max(0,radius-dot(end,entryNormal))};
}
export function resolvePlayers(engines,previous=new Map()){
  const entries=[...engines.entries()].filter(([,e])=>e.body);
  let contacts=0;
  for(let pass=0;pass<2;pass++)for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    let [idA,ea]=entries[i],[idB,eb]=entries[j],a=ea.body(),b=eb.body();
    let hit=contact(a,b,pass?undefined:previous.get(idA),pass?undefined:previous.get(idB));if(!hit)continue;
    if(hit.normal[2]<-.65){[ea,eb]=[eb,ea];[a,b]=[b,a];hit.normal=mul(hit.normal,-1);}
    const total=a.mass+b.mass,wa=b.mass/total,wb=a.mass/total;
    if(!Number.isFinite(total)||a.mass<=0||b.mass<=0)throw new Error('INVALID_PEER_MASS');
    const relative=sub(a.velocity,b.velocity),incoming=dot(relative,hit.normal)<0;
    if(!incoming&&hit.depth<1e-8)continue;
    const da=incoming?ea.response(hit.normal,relative):Array(6).fill(0);
    const db=incoming?eb.response(mul(hit.normal,-1),mul(relative,-1)):Array(6).fill(0);
    ea.apply([...mul(da.slice(0,3),wa),...mul(da.slice(3),wa),...mul(hit.normal,hit.depth*wa)]);
    eb.apply([...mul(da.slice(0,3),-wb),...mul(db.slice(3),wb),...mul(hit.normal,-hit.depth*wb)]);
    contacts++;
  }
  return contacts;
}
