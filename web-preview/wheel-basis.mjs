import * as THREE from './vendor/three.module.js';

// Swap X/Z, rather than changing signs. Apply the inverse basis at the mount:
// S*S=I preserves the authored wheel position/shape, while spin-Z becomes axle-X.
export const swapWheelXZ = new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1);
export function mountWheel(mesh) {
  const geometry=mesh.geometry;
  geometry.computeBoundingBox();
  const center=new THREE.Vector3(), size=new THREE.Vector3();
  geometry.boundingBox.getCenter(center); geometry.boundingBox.getSize(size);
  geometry.translate(-center.x,-center.y,-center.z).applyMatrix4(swapWheelXZ);
  // A basis swap is a reflection; keep the authored front face and normals.
  const index=geometry.index;
  for(let i=0;i<index.count;i+=3) {
    const b=index.getX(i+1); index.setX(i+1,index.getX(i+2)); index.setX(i+2,b);
  }
  // applyMatrix4 already transformed authored normals by the normal matrix.
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const frame=new THREE.Group(); frame.matrixAutoUpdate=false; frame.matrix.copy(swapWheelXZ);
  frame.add(mesh);
  const pivot=new THREE.Group(); pivot.position.copy(center); pivot.add(frame);
  return {pivot,mesh,front:center.z>0,radius:Math.max(size.y,size.z)/2};
}
