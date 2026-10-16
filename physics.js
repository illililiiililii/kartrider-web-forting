export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0')}`;
export function segmentTriangle(a,b,v0,v1,v2){
 const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const d=sub(b,a),e1=sub(v1,v0),e2=sub(v2,v0),h=cross(d,e2),det=dot(e1,h);
 if(Math.abs(det)<1e-8)return false;const f=1/det,s=sub(a,v0),u=f*dot(s,h);if(u<0||u>1)return false;
 const q=cross(s,e1),v=f*dot(d,q);if(v<0||u+v>1)return false;const t=f*dot(e2,q);return t>=0&&t<=1;
}
export function crossesGate(a,b,g){
 const r=g.records[0];if(r&&((b[0]-a[0])*r[3]+(b[1]-a[1])*r[4]+(b[2]-a[2])*r[5])<=0)return false;
 return g.triangles.some(t=>segmentTriangle(a,b,...t.map(i=>g.vertices[i])));
}
export class Progress{
 constructor(gates,laps=2){this.gates=gates;this.laps=laps;this.next=0;this.lap=1;this.started=false;this.finished=false;this.passed=0;}
 update(a,b){if(this.finished||!crossesGate(a,b,this.gates[this.next]))return false;
  if(this.next===0){if(this.started)this.lap++;this.started=true;if(this.lap>this.laps)this.finished=true;}
  this.passed++;this.next=(this.next+1)%this.gates.length;return true;
 }
}
