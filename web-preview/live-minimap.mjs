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

// FUN_00467550 from the recovered demo, using THIS 5136 track's ToMinimap.
// The map quad reverses V; xt_bigmap is the same mapping at twice resolution.
export function bitmapProjection(mapping, width, height) {
  if (!mapping || ![...mapping.origin,mapping.scale,mapping.width,mapping.height].every(Number.isFinite) || mapping.scale<=0 || mapping.width<=0 || mapping.height<=0) throw new Error('Invalid ToMinimap registration');
  return (x,y) => [width*(.5+(x-mapping.origin[0])*mapping.scale/mapping.width),
    height*(.5-(y-mapping.origin[1])*mapping.scale/mapping.height)];
}

export function lapAnnouncement(current, total) {
  return current === total ? '마지막 바퀴!!' : `${current}번째 바퀴`;
}
export const minimapRotation = heading => heading-Math.PI/2;

export function createLiveMinimap(image) {
  const canvas=document.createElement('canvas');
  canvas.id='live-minimap'; canvas.width=600; canvas.height=540;
  canvas.setAttribute('aria-label','실제 트랙 좌표 기반 지도 및 차량 방향');
  canvas.hidden=true; image.after(canvas);
  const ctx=canvas.getContext('2d');
  let background, project, zoom=1.75, generation=0;
  return {
    async load(bytes, name, hasOriginal=true) {
      const serial=++generation;
      background=null;
      if (name && hasOriginal) {
        const response=await fetch(`./assets/tracks/${name}/minimap.json`);
        if (!response.ok) throw new Error(`${name} 원본 ToMinimap 좌표 없음`);
        const mapping=await response.json();
        const bitmap=new Image();bitmap.src=`./assets/tracks/${name}/xt_bigmap.png`;
        await bitmap.decode();
        if(serial!==generation)return;
        project=bitmapProjection(mapping,bitmap.naturalWidth,bitmap.naturalHeight);
        zoom=canvas.width/bitmap.naturalWidth*2;
        background=bitmap;
        canvas.dataset.source='xt_bigmap.png + track.1s/ToMinimap';
        image.hidden=true;canvas.hidden=false;return;
      }
      const triangles=readMapTriangles(bytes);
      project=mapProjection(triangles,canvas.width,canvas.height,16);
      const fallback=document.createElement('canvas');fallback.width=canvas.width;fallback.height=canvas.height;
      const draw=fallback.getContext('2d');draw.fillStyle='#d9e5eb';
      for (const tri of triangles) {
        draw.beginPath();
        tri.forEach(([x,y],i) => { const p=project(x,y); i ? draw.lineTo(...p) : draw.moveTo(...p); });
        draw.closePath(); draw.fill();
      }
      background=fallback;zoom=1.75;canvas.dataset.source='collision schematic (no original mapping)';
      image.hidden=true; canvas.hidden=false;
    },
    draw(state) {
      if (!background) return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const position=project(state[0],state[1]);
      const x=canvas.width/2,y=canvas.height/2;
      ctx.save();ctx.translate(x,y);ctx.rotate(minimapRotation(state[2]));ctx.scale(zoom,zoom);ctx.translate(-position[0],-position[1]);ctx.drawImage(background,0,0);ctx.restore();
      ctx.save(); ctx.translate(x,y);
      ctx.beginPath(); ctx.moveTo(0,-51); ctx.lineTo(70,50); ctx.lineTo(0,25); ctx.lineTo(-70,50); ctx.closePath();
      ctx.fillStyle='#d82b0b'; ctx.strokeStyle='#160a05'; ctx.lineWidth=7; ctx.fill(); ctx.stroke(); ctx.restore();
    },
  };
}
