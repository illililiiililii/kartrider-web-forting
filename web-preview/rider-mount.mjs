import * as THREE from './vendor/three.module.js';
const rootRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);

export function seatSurface(parts,seat){
  if(!seat)return null;
  const origin=new THREE.Vector3(...seat.position),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
  const ray=new THREE.Ray(new THREE.Vector3(origin.x,100,origin.z),new THREE.Vector3(0,-1,0));
  let top=-Infinity;
  for(const part of parts.filter(p=>p.name===seat.path+'/Geo'))for(let i=0;i<part.indices.length;i+=3){
    [a,b,c].forEach((v,j)=>v.fromArray(part.positions,part.indices[i+j]*3));
    if(ray.intersectTriangle(a,b,c,false,hit))top=Math.max(top,hit.y);
  }
  // Unknown geometry stays an explicit authored-origin fallback.
  if(Number.isFinite(top))origin.y=top;
  return {point:origin.toArray(),matrix:seat.matrix,source:Number.isFinite(top)?'authored seat + surface':'authored seat origin (surface unavailable)'};
}

export function mountRider(rider,seat,mounts,kartScale,riderScale,base){
  if(!seat||!mounts?.hips)return false;
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(new THREE.Matrix4().fromArray(seat.matrix)));
  const hips=new THREE.Vector3(...mounts.hips).multiplyScalar(riderScale).applyQuaternion(rotation);
  const position=new THREE.Vector3(...seat.point).multiplyScalar(kartScale).sub(hips).applyQuaternion(rootRotation);
  position.y+=base*kartScale;
  rider.position.copy(position);rider.quaternion.copy(rootRotation).multiply(rotation);rider.scale.setScalar(riderScale);
  return true;
}
