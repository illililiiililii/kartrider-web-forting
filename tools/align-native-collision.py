"""Adapt original property/road KTRK to the web's unmirrored 5136 world."""
from pathlib import Path
import json,re,struct,sys

def key(name):return re.sub(r'[^a-z0-9]','',name.lower()).removesuffix('geom')

def convert(source,target):
 data=bytearray(source.read_bytes());assert data[:4]==b'KTRK' and struct.unpack_from('<I',data,4)[0]==2
 low,high=struct.unpack_from('<f',data,20)[0],struct.unpack_from('<f',data,32)[0]
 struct.pack_into('<f',data,20,-high);struct.pack_into('<f',data,32,-low)
 offset=44;records={};collidable=triangles=0
 for _ in range(struct.unpack_from('<I',data,8)[0]):
  name=data[offset:offset+96].split(b'\0')[0].decode()
  flags,nv,ni=struct.unpack_from('<III',data,offset+192);offset+=204
  points=[]
  for i in range(nv):
   p=offset+i*20;x,y,z=struct.unpack_from('<3f',data,p);points.append((x,z,-y));struct.pack_into('<f',data,p,-x)
  offset+=nv*20
  for i in range(0,ni,3):
   a,b,c=struct.unpack_from('<III',data,offset+i*4);struct.pack_into('<III',data,offset+i*4,a,c,b)
  offset+=ni*4
  records.setdefault(key(name),[]).append({'road':bool(flags&1),'bounds':[[min(p[k] for p in points),max(p[k] for p in points)] for k in range(3)]})
  if flags&1:collidable+=1;triangles+=ni//3
 assert offset==len(data)
 model=target/'model.mesh.json';scene=json.loads(model.read_text(encoding='utf-8'))
 aligned=unknown=0;max_error=0
 for part in scene['parts']:
  part.pop('collisionRoad',None)
  matches=records.get(key(part['name'].split('/')[-2]),[])
  p=part['positions'];bounds=[[min(p[k::3]),max(p[k::3])] for k in range(3)]
  # Only label a USD mesh when its native counterpart's world-space box agrees.
  matches=[m for m in matches if max(abs(bounds[k][j]-m['bounds'][k][j]) for k in range(3) for j in range(2))<0.02]
  if matches and len({m['road'] for m in matches})==1:
   for match in matches:match['matched']=True
   part['collisionRoad']=matches[0]['road'];part['collisionSource']='original-1s-property-road';aligned+=1
   max_error=max(max_error,max(abs(bounds[k][j]-matches[0]['bounds'][k][j]) for k in range(3) for j in range(2)))
  else:part['collisionSource']='unmatched-original-metadata';unknown+=1
 # Refuse a scene-wide unit/axis mismatch instead of hiding it with a spawn offset.
 if aligned<len(scene['parts'])//2:raise ValueError(f'USD/native collision alignment failed: {aligned} matched, {unknown} unknown')
 target.mkdir(parents=True,exist_ok=True);(target/'collision.ktrk').write_bytes(data)
 model.write_text(json.dumps(scene,separators=(',',':')),encoding='utf-8')
 matched_collision=sum(bool(m['road'] and m.get('matched')) for values in records.values() for m in values)
 info={'source':'original-1s-property-road','collidableMeshes':collidable,'collidableTriangles':triangles,'matchedVisualMeshes':aligned,'unmatchedVisualMeshes':unknown,'matchedCollisionMeshes':matched_collision,'unmatchedCollisionMeshes':collidable-matched_collision,'maximumBoundsError':max_error}
 (target/'collision-info.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
 print(target.name,json.dumps(info))

if __name__=='__main__':convert(Path(sys.argv[1]),Path(sys.argv[2]))
