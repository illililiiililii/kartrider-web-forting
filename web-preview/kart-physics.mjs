// Stable ABI: all 18 recovered dynamics fields, then known boost/EX fields.
export const dynamicsFields=['Mass','AirFriction','DragFactor','ForwardAccelForce','BackwardAccelForce','GripBrakeForce','SlipBrakeForce','MaxSteerAngle','SteerConstraint','FrontGripFactor','RearGripFactor','DriftTriggerFactor','DriftTriggerTime','DriftSlipFactor','DriftEscapeForce','CornerDrawFactor','DriftLeanFactor','SteerLeanFactor'];
export const featureFields=['BoostAccelFactor','NormalBoosterTime','StartBoosterTimeSpeed','StartForwardAccelForceSpeed','chargeInstAccelGaugeByBoost','chargeInstAccelGaugeByGrip','instAccelFactor','instAccelGaugeCooldownTime','instAccelGaugeLength','instAccelGaugeMinUsable','instAccelGaugeMinVelBound'];
export function applyKartPhysics(api,profile){
  const fields=[...dynamicsFields,...featureFields];
  if(!profile || !fields.every(key=>Number.isFinite(profile.values[key])))throw new Error('선택 카트의 원본 성능 데이터가 없습니다. 성능 준비 스크립트를 실행하세요.');
  for(const [index,key] of fields.entries())if(!api.demo_set_kart_parameter(index,profile.values[key]))throw new Error(`카트 성능값 오류: ${key}`);
  if(!api.demo_apply_kart_parameters(+profile.exceed))throw new Error('카트 성능 범위 검증 실패');
}
// Renderer local +X = forward, +Z = right. Native local -Y = forward,
// +X = right. Wheel suspension geometry is deliberately independent.
export function collisionFit(bounds,scale){
  const min=bounds.min,max=bounds.max;
  const half=[(max.z-min.z)*scale/2,(max.x-min.x)*scale/2,(max.y-min.y)*scale/2];
  const center=[(min.z+max.z)*scale/2,-(min.x+max.x)*scale/2,half[2]];
  if(![...half,...center].every(Number.isFinite)||half.some(v=>v<=0||v>10))throw new Error('카트 충돌 범위가 올바르지 않습니다');
  return {half,center};
}
