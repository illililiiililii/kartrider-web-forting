// Web port of the recovered KartRider Demo rigid-body update path.
// Evidence: work/physics/analysis/RECOVERY_NOTES.md and reader.md. P5136's
// live client tick is now decompiled; its 2 ms substep is used below. The force
// model still derives from the demo and P5136 BodyParam, pending full port.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], len=a=>Math.sqrt(dot(a,a));
const norm=a=>{const l=len(a);return l>1e-12?mul(a,1/l):[0,0,0]};
const quatNorm=q=>{const l=Math.hypot(...q);return l>1e-12?q.map(x=>x/l):[0,0,0,1]};
const quatMul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const rotate=(q,v)=>{const u=q.slice(0,3),t=mul(cross(u,v),2);return add(v,add(mul(t,q[3]),cross(u,t)))};
const fromYaw=h=>[0,0,Math.sin((Math.PI-h)/2),Math.cos((Math.PI-h)/2)];
// P5136's live GoKart tick subdivides elapsed milliseconds in chunks of at
// most 2 ms before converting each chunk to seconds (RVA 0x633420).
const STEP=.002,G=9.8,WORLD_G=-58.8,MASS=100,PI=Math.PI;

export class DrivingState{
 constructor(stats={},geometry={}){this.stats=stats||{};this.geometry={halfWidth:geometry.halfWidth??1,halfLength:geometry.halfLength??1,suspensionRange:geometry.suspensionRange??.5,groundedDragScale:geometry.groundedDragScale??1};this.reset();}
 config(){
  // S7 SpeedType.Default + kart BodyParam. These are the P5136 start-packet
  // composition rules; the force integrator below is still a demo-era port.
  const s=this.stats,field=(name,fallback)=>Number.isFinite(Number(s[name]))&&s[name]!=null?Number(s[name]):fallback;
  const forward=2150+field('ForwardAccelForce',154),escape=2600+field('DriftEscapeForce',1600);
  const factor=field('StartForwardAccelFactorSpeed',1.7);
  const offsets=new Map([[1.65,-158.679],[1.7,-171.212],[1.8,-191.644],[1.85,-204.276],[1.9,-211.547],[2.1,-240.324]]);
  const startForwardForce=factor===0?forward:forward*factor+(offsets.get(factor)??(-58.8*factor*factor));
  return {mass:100+field('Mass',0),air:3+field('AirFriction',0),drag:Math.max(.05,.75+field('DragFactor',-.083)),forward,reverse:1725+field('BackwardAccelForce',100),gripBrake:2070+field('GripBrakeForce',0),slipBrake:1415+field('SlipBrakeForce',0),maxSteer:10+field('MaxSteerAngle',0),steerConstraint:22.25+field('SteerConstraint',2.36),frontGrip:5+field('FrontGripFactor',0),rearGrip:5+field('RearGripFactor',0),triggerFactor:.2+field('DriftTriggerFactor',0),triggerTime:.2+field('DriftTriggerTime',0),slipFactor:.2+field('DriftSlipFactor',0),escape,corner:.18+field('CornerDrawFactor',.074),driftLean:field('DriftLeanFactor',.06),steerLean:field('SteerLeanFactor',.01),driftMaxGauge:4300+field('DriftMaxGauge',-440),boostAccel:-.006+field('BoostAccelFactor',1.5),driftBoostAccel:field('driftBoostMulAccelFactor',1.4),driftBoostTick:field('driftBoostTick',500)/1000,startAccelFactor:factor,startBoosterTime:Math.max(0,field('StartBoosterTimeSpeed',1500)/1000),normalBoosterTime:Math.max(0,(2900+field('NormalBoosterTime',0))/1000),startForwardForce};
 }
 reset(p={}){this.position=[p.x||0,p.y||0,p.z||0];this.orientation=fromYaw(p.heading||0);this.linearVelocity=[0,0,0];this.angularVelocity=[0,0,0];this.wheelCompression=[0,0,0,0];this.grounded=false;this.previousSteer=0;this.previousDrift=false;this.driftInput=false;this.triggerActive=false;this.triggerTimer=0;this.lingerTimer=0;this.entryWasForward=false;this.slipDetected=false;this.previousForward=false;this.reverseTimer=0;this.previousBoost=false;this.nitro=0;this.nitroTime=0;this.instantTime=0;this.instantWindow=0;this.startBoostTime=0;this.charge=0;}
 get heading(){const f=this.axes().forward;return Math.atan2(f[0],f[1]);} set heading(h){const yaw=this.angularVelocity;this.orientation=fromYaw(h);this.angularVelocity=yaw;}
 axes(){return {right:rotate(this.orientation,[1,0,0]),forward:rotate(this.orientation,[0,-1,0]),up:rotate(this.orientation,[0,0,1])};}
 get speed(){return len(this.linearVelocity);} get vf(){return dot(this.linearVelocity,this.axes().forward);} set vf(v){this.linearVelocity=add(this.linearVelocity,mul(this.axes().forward,v-dot(this.linearVelocity,this.axes().forward)));} get vs(){return dot(this.linearVelocity,this.axes().right);} set vs(v){this.linearVelocity=add(this.linearVelocity,mul(this.axes().right,v-dot(this.linearVelocity,this.axes().right)));} get yaw(){return this.angularVelocity[2];} set yaw(v){this.angularVelocity[2]=v;}
 get mode(){return this.triggerActive?'trigger':(this.driftInput||this.slipDetected||this.lingerTimer>0?'drift':'grip');}
 startBoost(t){this.startBoostTime=Math.max(this.startBoostTime,Math.max(0,t));}
 collisionSlow(f=.65){this.linearVelocity=mul(this.linearVelocity,f);this.angularVelocity=mul(this.angularVelocity,.45);}
 step(dt,input={}){const old=this.position.slice();let remain=clamp(dt,0,.5),contacts=0,mode=this.mode;while(remain>1e-9){const h=Math.min(STEP,remain);this.substep(h,input);remain-=h;mode=this.mode;}
  return {dx:this.position[0]-old[0],dy:this.position[1]-old[1],dz:this.position[2]-old[2],mode,speed:this.speed,skid:Math.atan2(this.vs,Math.max(4,Math.abs(this.vf))),grounded:this.grounded,wheelContacts:this.lastContacts||contacts};}
 substep(dt,input){const cfg=this.config(),forward=input.forward?1:0,reverse=input.reverse?1:0,steer=clamp(Number(input.steer)||0,-1,1),drift=!!input.drift;
  if(forward&&!this.previousForward&&this.instantWindow>0){this.instantTime=.5;this.instantWindow=0;}this.previousForward=!!forward;this.instantWindow=Math.max(0,this.instantWindow-dt);this.instantTime=Math.max(0,this.instantTime-dt);
  if(input.boost&&!this.previousBoost&&this.nitro>0&&this.nitroTime<=0){this.nitro--;this.nitroTime=cfg.normalBoosterTime;}this.previousBoost=!!input.boost;this.nitroTime=Math.max(0,this.nitroTime-dt);
  const axes=this.axes();let v=this.linearVelocity;const forwardV=dot(v,axes.forward),sideV=dot(v,axes.right),speed=len(v),planarSpeed=Math.hypot(forwardV,sideV);const wheel=this.queryWheels(input.groundQuery,axes);this.grounded=wheel.contacts.length>0;this.lastContacts=wheel.contacts.length;let force=[0,0,0],torque=[0,0,0];
  // P5136 VA 0xA36E30 and initializer 0xA2E7C0 confirm zero compression
  // damping and rebound damping = spring coefficient * 0.2. A live race kart
  // had gravity -58.8, mass 100, spring 2940 and rebound damping 588.
  if(this.grounded){force[2]+=WORLD_G*cfg.mass;for(const c of wheel.contacts){const stat=Math.abs(WORLD_G)*cfg.mass*.5,damping=c.delta<=0?stat*.2:0;let f=(c.delta/dt)*damping+stat*c.compression;if(f<=0)continue;f*=dot(c.normal,axes.up);force=add(force,mul(axes.up,f));const lever=[this.geometry.halfWidth*c.sx,-this.geometry.halfLength*c.sy,0];torque=add(torque,mul(cross(lever,[0,0,f]),.1));}
  const launch=this.startBoostTime>0;this.startBoostTime=Math.max(0,this.startBoostTime-dt);const boostMultiplier=this.nitroTime>0?cfg.boostAccel:(this.instantTime>0?cfg.driftBoostAccel:1);let drive=0;
   if(forward){
    drive=launch?cfg.startForwardForce:(this.slipDetected?cfg.escape:cfg.forward)*boostMultiplier;
    if(forwardV<0)drive+=((this.driftInput||this.slipDetected)?speed:Math.min(speed,5))*cfg.mass*G;
    this.reverseTimer=0;
   }else if(reverse){
    if(forwardV<=.5){
     this.reverseTimer+=dt;
     if(forwardV<=-.5)this.reverseTimer=1;
     if(this.reverseTimer<=.2){
      if(Math.abs(sideV)<=.2){this.linearVelocity=[0,0,0];v=this.linearVelocity;}
     }else drive=-cfg.reverse;
    }else{
     const b=forwardV/Math.max(speed,.001)<=.8?cfg.slipBrake:cfg.gripBrake;
     force=add(force,mul(norm(v),-b));
    }
   }else if(forwardV<=.5&&forwardV>=-.5)this.reverseTimer+=dt;
   force=add(force,mul(axes.forward,drive));
   if(drift!==this.previousDrift){if(!drift)this.driftInput=false;else if(this.lingerTimer<=0){this.driftInput=true;this.triggerActive=true;this.entryWasForward=forwardV>0;}this.previousDrift=drift;}
   const wasDrifting=this.driftInput||this.slipDetected;if(planarSpeed<=5){this.triggerActive=false;this.driftInput=false;this.slipDetected=false;}else if(!this.driftInput&&!this.triggerActive)this.slipDetected=planarSpeed>15&&Math.abs(sideV)>Math.abs(forwardV)*1.2;else this.slipDetected=false;
   if(this.triggerActive){if(this.triggerTimer<=0){this.triggerTimer=cfg.triggerTime;this.lingerTimer=cfg.triggerTime*2;}else{this.triggerTimer=Math.max(0,this.triggerTimer-dt);if(this.triggerTimer===0)this.triggerActive=false;}}else if(this.mode==='drift')this.lingerTimer=Math.max(0,this.lingerTimer-dt);
   const mode=this.mode,max=PI*cfg.maxSteer/180*steer;let filtered=max*Math.exp(-Math.abs(forwardV/cfg.steerConstraint));if(forward&&Math.sign(this.previousSteer)===Math.sign(filtered)&&Math.abs(this.previousSteer)<Math.abs(filtered))filtered=this.previousSteer;this.previousSteer=filtered;const denom=Math.max(planarSpeed,5),travel=forwardV<=0?-1:1,steerSlip=planarSpeed>=.5?travel*((planarSpeed>5&&mode==='drift'&&this.driftInput)?max:filtered):0;
   const frontSlip=steerSlip-sideV/denom-(this.angularVelocity[2]*.5)/denom,rearSlip=-sideV/denom+(this.angularVelocity[2]*.5)/denom;let ff,rf;if(planarSpeed>5&&mode==='trigger'){ff=0;rf=max*cfg.triggerFactor*(-G*cfg.mass)*cfg.frontGrip;}else{ff=frontSlip*G*cfg.mass*cfg.frontGrip;rf=rearSlip*G*cfg.mass*cfg.rearGrip;if(planarSpeed>5&&mode==='drift'){ff*=cfg.slipFactor;rf*=cfg.slipFactor;}}
   force=add(force,mul(axes.right,ff+rf));torque[2]+=.5*ff-.5*rf;if(planarSpeed>5&&mode==='grip')force=add(force,mul(axes.forward,Math.abs(ff+rf)*cfg.corner));if(planarSpeed>5&&mode==='drift')torque[1]-=(ff+rf)*cfg.driftLean*(planarSpeed<=10?.5:1);else if(planarSpeed>5&&mode==='grip')torque[1]-=(ff+rf)*cfg.steerLean;
   if(this.entryWasForward&&wasDrifting&&!this.driftInput&&!this.slipDetected&&this.instantWindow===0){this.entryWasForward=false;this.instantWindow=cfg.driftBoostTick;}
   if(mode==='drift'&&Math.abs(steer)>0&&speed>14){this.charge+=dt*.34*Math.min(1,speed/45)*(1+Math.min(1,Math.abs(sideV)/8));if(this.charge>=1){this.charge-=1;this.nitro=Math.min(2,this.nitro+1);}}
  }else{this.driftInput=false;this.slipDetected=false;this.triggerActive=false;force[2]+=WORLD_G*cfg.mass;torque=add(torque,mul(this.angularVelocity,-30));}
  force=add(force,mul(v,-cfg.air-(this.grounded?len(v)*cfg.drag*this.geometry.groundedDragScale:0)));torque=add(torque,mul(this.angularVelocity,-cfg.air));
  this.linearVelocity=add(v,mul(force,dt/cfg.mass));this.angularVelocity=add(this.angularVelocity,mul(torque,dt*12/cfg.mass));
  const oldPosition=this.position.slice();this.position=add(this.position,mul(this.linearVelocity,dt));let omega=[...this.angularVelocity],q=this.orientation;const integrate=w=>quatNorm(quatMul(q,[w[0]*dt/2,w[1]*dt/2,w[2]*dt/2,1]));let nq=integrate(omega),upz=rotate(nq,[0,0,1])[2],tries=0;while(upz<.5&&tries<3){omega[0]*=.1;omega[1]*=.1;nq=integrate(omega);upz=rotate(nq,[0,0,1])[2];tries++;}if(upz<.5){omega[0]=omega[1]=0;nq=integrate(omega);}this.orientation=nq;this.angularVelocity=omega;
  // P5136 resolves wall hits along the movement sweep. A velocity-only response
  // lets the chassis enter the wall, after which all four ground rays miss.
  const hit=input.bodySweep?.(oldPosition,this.position,this.axes());
  if(hit){const n=norm([hit.normal[0],hit.normal[1],0]),travel=sub(this.position,oldPosition),fraction=clamp(Number(hit.fraction)||0,0,1);if(len(n)>0){this.position=[oldPosition[0]+travel[0]*fraction+n[0]*.015,oldPosition[1]+travel[1]*fraction+n[1]*.015,this.position[2]];const vn=dot(n,this.linearVelocity);if(vn<0){this.linearVelocity=add(this.linearVelocity,mul(n,-vn*1.05));this.angularVelocity=mul(this.angularVelocity,.82);}}}
  for(const n0 of input.bodyContacts||[]){const n=norm(Array.isArray(n0)?n0:n0.normal||[0,0,1]);const vn=dot(n,this.linearVelocity);if(vn>=0)continue;const normalV=mul(n,vn),tangent=sub(this.linearVelocity,normalV);if(n[2]<=.65){const tn=len(tangent),remove=Math.min(-vn*1.5,tn*.6),td=tn>0?mul(tangent,1/tn):[0,0,0];let correction=add(mul(normalV,-1.5),mul(td,-remove));correction[2]=0;this.linearVelocity=add(this.linearVelocity,correction);}else this.linearVelocity=add(tangent,mul(normalV,-.2));}
 }
 queryWheels(query,axes){const contacts=[],rs=[1,-1,1,-1],fs=[1,1,-1,-1],range=this.geometry.suspensionRange;for(let i=0;i<4;i++){const old=this.wheelCompression[i];const origin=add(add(add(this.position,mul(axes.right,this.geometry.halfWidth*rs[i]*.8)),mul(axes.forward,this.geometry.halfLength*fs[i]*.8)),mul(axes.up,range));const delta=mul(axes.up,-2*range);const hit=query?.(origin,delta);let comp=0;if(hit){const point=hit.point||hit.position,normal=norm(hit.normal||[0,0,1]);if(normal[2]>.65){const raw=dot(point,axes.up)-(dot(this.position,axes.up)-range);comp=clamp(raw,0,2*range);contacts.push({normal,compression:comp,delta:comp-old,sx:rs[i],sy:fs[i]});}}this.wheelCompression[i]=comp;}return {contacts};}
}
