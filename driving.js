// 5 ms planar port of the recovered 2004 KartRider Demo dynamics path.
// The original has suspension and full 3D contacts; this module preserves the
// original longitudinal, lateral, drift, drag and yaw order for the web track.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const G=9.800000190734863,MASS=100,STEP=.005,PI=3.1415927410125732;

// Demo's STANDARD_DYNAMICS profile, used as the canonical handling profile.
// V1 BodyParam values only adjust the relative steering/acceleration feel.
const base={air:3,drag:.725,forward:3300,reverse:2000,gripBrake:2000,slipBrake:1500,
 maxSteer:10,steerConstraint:28,frontGrip:5,rearGrip:5,triggerFactor:.2,
 triggerTime:.2,slipFactor:.2,escape:4000,corner:.05};

export class DrivingState{
 constructor(stats={}){this.stats=stats;this.reset();}
 reset(){
  this.vf=0;this.vs=0;this.yaw=0;this.heading=0;this.previousSteer=0;
  this.driftInput=false;this.triggerActive=false;this.triggerTimer=0;this.lingerTimer=0;this.entryWasForward=false;
  this.slipDetected=false;this.previousDrift=false;this.previousForward=false;
  this.reverseTimer=0;this.nitro=0;this.nitroTime=0;this.instantTime=0;this.instantWindow=0;this.startBoostTime=0;
  this.previousBoost=false;this.charge=0;
 }
 get speed(){return Math.hypot(this.vf,this.vs);}
 get mode(){return this.triggerActive?'trigger':(this.driftInput||this.slipDetected||this.lingerTimer>0?'drift':'grip');}
 startBoost(duration=.8){this.startBoostTime=Math.max(this.startBoostTime,Math.max(0,duration));}
 config(){
  const steering=clamp((this.stats.SteerConstraint??2.4)/2.4,.82,1.22);
  const accel=clamp((this.stats.ForwardAccelForce??154)/154,.92,1.10);
  return {...base,steerConstraint:base.steerConstraint*steering,forward:base.forward*accel,escape:base.escape*accel};
 }
 step(dt,input={}){
  // The caller invokes this at 5 ms. Clamp protects against hidden-tab jumps.
  dt=clamp(dt,0,STEP);const forward=!!input.forward,reverse=!!input.reverse;
  const steer=clamp(input.steer||0,-1,1),drift=!!input.drift,boost=!!input.boost,cfg=this.config();
  const speed=this.speed;

  // The demo checks an accelerator edge and advances boost timers before its
  // longitudinal state machine.  Keeping this order matters at drift exits.
  if(forward&&!this.previousForward&&this.instantWindow>0){this.instantTime=.5;this.instantWindow=0;}
  this.previousForward=forward;this.instantWindow=Math.max(0,this.instantWindow-dt);this.instantTime=Math.max(0,this.instantTime-dt);
  if(boost&&!this.previousBoost&&this.nitro>0&&this.nitroTime<=0){this.nitro--;this.nitroTime=3;}
  this.previousBoost=boost;this.nitroTime=Math.max(0,this.nitroTime-dt);

  // Longitudinal state machine: forward, brake, 200 ms stop/reverse delay.
  const launchBoost=this.startBoostTime>0;this.startBoostTime=Math.max(0,this.startBoostTime-dt);
  const boosted=launchBoost||this.nitroTime>0||this.instantTime>0;let forwardForce=0,sideForce=0;
  if(forward){
   forwardForce=(this.slipDetected?cfg.escape:cfg.forward)*(boosted?1.5:1);
   if(this.vf<0){const recovery=(this.driftInput||this.slipDetected)?speed:Math.min(speed,5);forwardForce+=recovery*MASS*G;}
   this.reverseTimer=0;
  }else if(reverse){
   if(this.vf<=.5){this.reverseTimer+=dt;if(this.vf<=-.5)this.reverseTimer=1;
    if(this.reverseTimer<=.2&&Math.abs(this.vs)<=.2){this.vf=0;this.vs=0;}
    else if(this.reverseTimer>.2)forwardForce=-cfg.reverse;
   }else{
    const alignment=this.vf/Math.max(speed,.001),brake=alignment<=.8?cfg.slipBrake:cfg.gripBrake;
    forwardForce-=brake*this.vf/Math.max(speed,.001);sideForce-=brake*this.vs/Math.max(speed,.001);
   }
  }else if(this.vf<=.5&&this.vf>=-.5)this.reverseTimer+=dt;

  // Exact input-edge / trigger ordering from 0x00431a30 and 0x0042fff0.
  // This follows the drive force above, as in the original fixed-step loop.
  // Preserve the pre-edge state for the drift-exit boost decision.
  const wasDrifting=this.driftInput||this.slipDetected;
  if(drift!==this.previousDrift){
   if(!drift)this.driftInput=false;
   else if(this.lingerTimer<=0){this.driftInput=true;this.triggerActive=true;this.entryWasForward=this.vf>0;}
   this.previousDrift=drift;
  }
  if(speed<=5){this.triggerActive=false;this.driftInput=false;this.slipDetected=false;}
  else if(!this.driftInput&&!this.triggerActive)this.slipDetected=Math.abs(this.vs)>Math.abs(this.vf)*1.2;
  else this.slipDetected=false;

  const activeMode=this.mode;
  if(this.triggerActive){
   if(this.triggerTimer<=0){this.triggerTimer=cfg.triggerTime;this.lingerTimer=cfg.triggerTime*2;}
   else {this.triggerTimer=Math.max(0,this.triggerTimer-dt);if(this.triggerTimer===0)this.triggerActive=false;}
  }else if(activeMode==='drift')this.lingerTimer=Math.max(0,this.lingerTimer-dt);

  // 0x0042fcde and 0x0042fe1c: front/rear slip and tire forces.
  const maximum=PI*cfg.maxSteer/180*steer;
  let filtered=maximum*Math.exp(-Math.abs(this.vf/cfg.steerConstraint));
  if(forward&&Math.sign(this.previousSteer)===Math.sign(filtered)&&Math.abs(this.previousSteer)<Math.abs(filtered))filtered=this.previousSteer;
  this.previousSteer=filtered;
  const denom=Math.max(speed,5),travel=this.vf<=0?-1:1;
  const steerForSlip=speed>=.5?travel*((speed>5&&activeMode==='drift'&&this.driftInput)?maximum:filtered):0;
  const frontSlip=steerForSlip-this.vs/denom-(this.yaw*.5)/denom;
  const rearSlip=-this.vs/denom+(this.yaw*.5)/denom;
  let frontForce,rearForce;
  if(speed>5&&activeMode==='trigger'){frontForce=0;rearForce=maximum*cfg.triggerFactor*-(G*MASS)*cfg.frontGrip;}
  else {frontForce=frontSlip*G*MASS*cfg.frontGrip;rearForce=rearSlip*G*MASS*cfg.rearGrip;if(speed>5&&activeMode==='drift'){frontForce*=cfg.slipFactor;rearForce*=cfg.slipFactor;}}
  const lateral=frontForce+rearForce,yawTorque=.5*frontForce-.5*rearForce;
  sideForce+=lateral;if(speed>5&&activeMode==='grip')forwardForce+=Math.abs(lateral)*cfg.corner;

  // 0x0042fc40: leaving a forward drift opens one 0.5 second accelerator
  // window.  It is deliberately evaluated after the lateral state update.
  if(this.entryWasForward&&wasDrifting&&!this.driftInput&&!this.slipDetected&&this.instantWindow===0){this.entryWasForward=false;this.instantWindow=.5;}

  // Force -> velocity -> pose. Drag is the demo's linear plus grounded quadratic drag.
  const drag=cfg.air+speed*cfg.drag;this.vf+=(forwardForce/MASS-this.vf*drag/MASS)*dt;this.vs+=(sideForce/MASS-this.vs*drag/MASS)*dt;
  this.yaw+=(yawTorque*12/MASS-this.yaw*cfg.air/MASS)*dt;
  this.yaw=clamp(this.yaw,-5,5);
  const turn=this.yaw*dt,c=Math.cos(turn),s=Math.sin(turn),vf=this.vf*c+this.vs*s,vs=this.vs*c-this.vf*s;
  this.vf=vf;this.vs=vs;this.heading+=turn;

  if(activeMode==='drift'&&Math.abs(steer)>0&&speed>14){this.charge+=dt*.34*Math.min(1,speed/45)*(1+Math.min(1,Math.abs(vs)/8));if(this.charge>=1){this.charge-=1;this.nitro=Math.min(2,this.nitro+1);}}
  return {dx:(Math.sin(this.heading)*vf+Math.cos(this.heading)*vs)*dt,dy:(Math.cos(this.heading)*vf-Math.sin(this.heading)*vs)*dt,mode:activeMode,speed:this.speed,skid:Math.atan2(vs,Math.max(4,Math.abs(vf)))};
 }
 collisionSlow(factor=.65){this.vf*=factor;this.vs*=factor;this.yaw*=.45;}
}
