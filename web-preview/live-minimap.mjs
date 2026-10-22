// Web schematic from loaded road-tagged 5136 geometry, not recovered demo UI.
export function readMapTriangles(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.byteLength < 44 || data.getUint32(0, true) !== 0x4b52544b || data.getUint32(4, true) !== 2) throw new Error('Expected local KTRK v2');
  const triangles = [];
  let offset = 44;
  for (let mesh = 0; mesh < data.getUint32(8, true); mesh++) {
    if (offset + 204 > data.byteLength) throw new Error('Truncated KTRK mesh');
    const collidable = data.getUint32(offset + 192, true) & 1;
    const count = data.getUint32(offset + 196, true), indices = data.getUint32(offset + 200, true);
    offset += 204;
    const vertices = offset, faces = vertices + count * 20;
    offset = faces + indices * 4;
    if (offset > data.byteLength || indices % 3) throw new Error('Invalid KTRK geometry');
    if (!collidable) continue;
    for (let i = 0; i < indices; i += 3) {
      const tri = [];
      for (let j = 0; j < 3; j++) {
        const index = data.getUint32(faces + (i+j)*4, true);
        if (index >= count) throw new Error('Invalid KTRK vertex');
        const p = vertices + index * 20;
        tri.push([-data.getFloat32(p,true), data.getFloat32(p+4,true), data.getFloat32(p+8,true)]);
      }
      const [a,b,c] = tri, u = b.map((v,k) => v-a[k]), v = c.map((v,k) => v-a[k]);
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      // Mirroring X reverses winding. Use magnitude to select horizontal proxy faces.
      if (Math.abs(n[2]) > Math.hypot(...n)*0.65) triangles.push(tri);
    }
  }
  return triangles;
}

export function mapProjection(triangles, width, height, padding = 8) {
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for (const tri of triangles) for (const [x,y] of tri) {
    minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
  }
  if (![minX,maxX,minY,maxY].every(Number.isFinite)) throw new Error('No minimap drive surfaces');
  const scale=Math.min((width-2*padding)/Math.max(1,maxX-minX),(height-2*padding)/Math.max(1,maxY-minY));
  return (x,y) => [width/2+(x-(minX+maxX)/2)*scale, height/2-(y-(minY+maxY)/2)*scale];
}

export function createLiveMinimap(image) {
  const canvas=document.createElement('canvas');
  canvas.id='live-minimap'; canvas.width=480; canvas.height=456;
  canvas.setAttribute('aria-label','실제 트랙 좌표 기반 지도 및 차량 방향');
  canvas.hidden=true; image.after(canvas);
  const ctx=canvas.getContext('2d');
  let background, project;
  return {
    load(bytes) {
      const triangles=readMapTriangles(bytes);
      project=mapProjection(triangles,canvas.width,canvas.height,16);
      ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#d9e5eb';
      for (const tri of triangles) {
        ctx.beginPath();
        tri.forEach(([x,y],i) => { const p=project(x,y); i ? ctx.lineTo(...p) : ctx.moveTo(...p); });
        ctx.closePath(); ctx.fill();
      }
      background=ctx.getImageData(0,0,canvas.width,canvas.height);
      image.hidden=true; canvas.hidden=false;
    },
    draw(state) {
      if (!background) return;
      ctx.putImageData(background,0,0);
      const [x,y]=project(state[0],state[1]);
      ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/2-state[2]);
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(8,9); ctx.lineTo(0,5); ctx.lineTo(-8,9); ctx.closePath();
      ctx.fillStyle='#ffdf00'; ctx.strokeStyle='#151515'; ctx.lineWidth=3; ctx.fill(); ctx.stroke(); ctx.restore();
    },
  };
}
