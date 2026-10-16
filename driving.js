// Planar port of the recovered KartRider demo tire/steer/drift equations.
// P5136 BodyParam values tune relative V1 kart differences; its original
// client physics code has not been recovered, so this is not bit-exact.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const GRAVITY=9.80000019,MASS=100,STEER_MAX=Math.PI/18;
export class DrivingState{
 constructor(stats={}){this.stats=stats;this.reset();}
 reset(){this.vf=0;this.vs=0;this.yaw=0;this.heading=0;this.mode='grip';this.trigger=0;this.linger=0;this.slip=false;this.driftInput=false;this.wasDrifting=false;this.instantWindow=0;this.instantTime=0;this.nitroTime=0;this.nitro=0;this.charge=0;this.lastForward=false;this.lastDrift=false;this.lastBoost=false;this.lastSteer=0;this.reverseTimer=0;}
 get speed(){return Math.hypot(this.vf,this.vs);}
 step(dt,{forward=false,reverse=false,steer=0,drift=false,boost=false}={}){
  dt=clamp(dt,0,1/60);steer=clamp(steer,-1,1);
  const speed=this.speed;
  // Demo client: a Shift edge starts a 0.1s rear tire kick, followed by
  // reduced tire forces. A 0.2s lockout prevents repeated trigger impulses.
  if(drift&&!this.lastDrift&&speed>5&&this.linger<=0){this.driftInput=true;this.trigger=.1;this.linger=.2;}
  if(!drift)this.driftInput=false;
  this.lastDrift=drift;
  if(speed<=5){this.driftInput=false;this.trigger=0;this.slip=false;}
  else if(!this.driftInput&&this.trigger<=0)this.slip=Math.abs(this.vs)>Math.abs(this.vf)*1.2;
  const wasDrifting=this.wasDrifting;
  this.mode=this.trigger>0?'trigger':(this.driftInput||this.slip||this.linger>0?'drift':'grip');
  this.wasDrifting=this.mode!=='grip';
  if(this.trigger>0)this.trigger=Math.max(0,this.trigger-dt);
  else this.linger=Math.max(0,this.linger-dt);
  if(wasDrifting&&!this.wasDrifting&&this.vf>0)this.instantWindow=.5;
  if(forward&&!this.lastForward&&this.instantWindow>0){this.instantTime=.5;this.instantWindow=0;}
  this.lastForward=forward;this.instantWindow=Math.max(0,this.instantWindow-dt);this.instantTime=Math.max(0,this.instantTime-dt);
  if(boost&&!this.lastBoost&&this.nitro>0&&this.nitroTime<=0){this.nitro--;this.nitroTime=3;}
  this.lastBoost=boost;this.nitroTime=Math.max(0,this.nitroTime-dt);

  // The older demo default is 10 degrees / 30. P5136 SteerConstraint uses
  // a different scale, so only its ratio between V1 karts is applied.
  const constraint=30*clamp((this.stats.SteerConstraint??2.4)/2.4,.8,1.35);
  const maxSteer=STEER_MAX*steer;
  let filtered=maxSteer*Math.exp(-Math.abs(this.vf/constraint));
  if(forward&&Math.sign(filtered)===Math.sign(this.lastSteer)&&Math.abs(this.lastSteer)<Math.abs(filtered))filtered=this.lastSteer;
  this.lastSteer=filtered;
  const denominator=Math.max(5,speed);
  const steerForSlip=speed>=.5?(this.vf<=0?-1:1)*(speed>5&&this.mode==='drift'&&this.driftInput?maxSteer:filtered):0;
  const frontSlip=steerForSlip-this.vs/denominator-(this.yaw*.5)/denominator;
  const rearSlip=-this.vs/denominator+(this.yaw*.5)/denominator;
  let frontForce,rearForce;
  if(speed>5&&this.mode==='trigger'){
   frontForce=0;
   rearForce=maxSteer*.05*(-GRAVITY*MASS)*5;
  }else{
   frontForce=frontSlip*GRAVITY*MASS*5;
   rearForce=rearSlip*GRAVITY*MASS*5;
   if(speed>5&&this.mode==='drift'){frontForce*=.2;rearForce*=.2;}
  }
  const lateralForce=frontForce+rearForce;
  const yawTorque=.5*(frontForce-rearForce);
  const acceleration=clamp((this.stats.ForwardAccelForce??154)/154,.9,1.1);
  let forwardForce=0,sideForce=lateralForce;
  if(forward){forwardForce=(this.slip?5000:3000)*acceleration*(this.nitroTime>0||this.instantTime>0?1.5:1);this.reverseTimer=0;}
  else if(reverse){
   if(this.vf>.5){const alignment=this.vf/Math.max(speed,.001),brake=alignment>.8?2000:1500;forwardForce-=brake*this.vf/Math.max(speed,.001);sideForce-=brake*this.vs/Math.max(speed,.001);this.reverseTimer=0;}
   else{this.reverseTimer+=dt;if(this.reverseTimer>.2)forwardForce-=2000;else if(Math.abs(this.vs)<.2){this.vf=0;this.vs=0;}}
  }
  // P5136 CornerDrawFactor has a different scale from the demo config; the
  // small compensation below retains its intended kart-relative effect.
  if(this.mode==='grip'&&speed>5)forwardForce+=Math.abs(lateralForce)*clamp((this.stats.CornerDrawFactor??.07)*.03,0,.005);
  const drag=3+speed*.5;
  this.vf+=(forwardForce/MASS-this.vf*drag/MASS)*dt;
  this.vs+=(sideForce/MASS-this.vs*drag/MASS)*dt;
  this.yaw+=(yawTorque*12/MASS-this.yaw*.36)*dt;
  // A changing body angle does not instantly rotate the world velocity.
  // Reproject it into the new body axes, then move in world coordinates.
  const turn=this.yaw*dt,c=Math.cos(turn),s=Math.sin(turn);
  const vf=this.vf*c+this.vs*s,vs=this.vs*c-this.vf*s;
  this.vf=vf;this.vs=vs;this.heading+=turn;
  if(this.mode==='drift'&&Math.abs(steer)>0&&speed>14){
   this.charge+=dt*.34*Math.min(1,speed/45)*(1+Math.min(1,Math.abs(this.vs)/8));
   if(this.charge>=1){this.charge-=1;this.nitro=Math.min(2,this.nitro+1);}
  }
  return {dx:(Math.sin(this.heading)*vf+Math.cos(this.heading)*vs)*dt,
          dy:(Math.cos(this.heading)*vf-Math.sin(this.heading)*vs)*dt,
          mode:this.mode,speed:this.speed,skid:Math.atan2(vs,Math.max(4,Math.abs(vf)))};
 }
 collisionSlow(factor=.65){this.vf*=factor;this.vs*=factor;this.yaw*=.45;}
}
