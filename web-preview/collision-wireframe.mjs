// Read the very same KTRK flags/vertices used by the C collision queries.
export function collisionPositions(bytes) {
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), positions=[];
  if(d.byteLength<44 || d.getUint32(0,true)!==0x4b52544b || d.getUint32(4,true)!==2) throw new Error('Invalid KTRK v2');
  let offset=44;
  for(let mesh=0;mesh<d.getUint32(8,true);mesh++) {
    if(offset+204>d.byteLength) throw new Error('Truncated KTRK');
    const flag=d.getUint32(offset+192,true),nv=d.getUint32(offset+196,true),ni=d.getUint32(offset+200,true);
    const vertices=offset+204,indices=vertices+nv*20; offset=indices+ni*4;
    if(offset>d.byteLength) throw new Error('Truncated KTRK vertices');
    if(!(flag&1)) continue;
    for(let i=0;i<ni;i++) {
      const index=d.getUint32(indices+i*4,true);if(index>=nv) throw new Error('Invalid KTRK index');
      const p=vertices+index*20;
      positions.push(-d.getFloat32(p,true),d.getFloat32(p+8,true),-d.getFloat32(p+4,true));
    }
  }
  return new Float32Array(positions);
}
