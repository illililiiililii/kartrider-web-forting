// Keep source alpha blending. Only fully opaque texels seed the depth buffer;
// transparent holes and genuinely translucent pixels still blend normally.
export function addOpaqueDepthPass(THREE, mesh) {
  if (!mesh.material.transparent) return;
  const material=mesh.material.clone();
  material.transparent=false;
  material.colorWrite=false;
  material.depthWrite=true;
  material.alphaTest=Math.max(material.alphaTest,0.999);
  const depth=new THREE.Mesh(mesh.geometry,material);
  depth.name='opaque-alpha-depth';
  mesh.add(depth);
}
