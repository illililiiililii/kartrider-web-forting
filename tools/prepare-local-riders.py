"""Seat the supplied characters using their retained joints and skin weights.

This is a web driving pose, not a claim of recovered original animation clips.
Original rest geometry, UVs and source files are retained unchanged.
"""
import argparse,base64,hashlib,json
from pathlib import Path
import numpy as np
from pxr import Gf,Usd,UsdGeom
from usd_normals import world_normals,web_normals
ROOT=Path(__file__).resolve().parent.parent
VERSION=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:16]

def rotation_between(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=float(a@b)
    if c>.999999:return np.eye(3)
    if c<-.999999:
        axis=np.cross(a,[1,0,0] if abs(a[0])<.9 else [0,1,0]);axis/=np.linalg.norm(axis)
        return 2*np.outer(axis,axis)-np.eye(3)
    k=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
    return np.eye(3)+k+k@k/(1+c)

def skin_matrices(rig):
    bones=rig['bones']
    # The supplied four character families share this verified 24-joint tree.
    parents=[-1,0,1,2,3,4,4,6,7,8,9,4,11,12,13,14,2,16,17,18,2,20,21,22]
    if [b['p'] for b in bones]!=parents:raise ValueError('Unsupported original joint hierarchy')
    aims={7:(8,[5,-10,-12]),8:(9,[-5,-11,1]),12:(13,[-5,-10,-12]),13:(14,[5,-11,1]),
          16:(17,[0,-1,0]),17:(18,[0,0,-1]),18:(19,[0,-.4,-1]),
          20:(21,[0,-1,0]),21:(22,[0,0,-1]),22:(23,[0,-.4,-1])}
    local=[];rest=[];posed=[]
    for i,bone in enumerate(bones):
        matrix=np.eye(4);matrix[:3,:]=np.array(bone['lm']).reshape(3,4);local.append(matrix)
        rest.append(rest[bone['p']]@matrix if bone['p']>=0 else matrix)
    for i,bone in enumerate(bones):
        matrix=posed[bone['p']]@local[i] if bone['p']>=0 else local[i].copy()
        if i in aims:
            child,direction=aims[i];current=(matrix@local[child])[:3,3]-matrix[:3,3]
            matrix[:3,:3]=rotation_between(current,np.array(direction,dtype=float))@matrix[:3,:3]
        posed.append(matrix)
    return [pose@np.linalg.inv(bind) for pose,bind in zip(posed,rest)]

def prepare(entry):
    name=entry['id'];path=ROOT/'web-preview/assets/usd'/name/'model.mesh.json'
    if not path.is_file():return False
    model=json.loads(path.read_text(encoding='utf-8'))
    if model.get('drivingPoseVersion')==VERSION:return True
    source=ROOT/'local-assets/character'/entry['family']/model['source'];stage=Usd.Stage.Open(str(source))
    rig=None
    for prim in stage.GetPseudoRoot().GetChildren():
        raw=prim.GetCustomData().get('kart_skelData')
        if raw:rig=json.loads(base64.b64decode(raw));break
    if not rig:raise ValueError(f'{name}: original skin data missing')
    skin=skin_matrices(rig);time=Usd.TimeCode(stage.GetStartTimeCode());cache=UsdGeom.XformCache(time)
    for part in model['parts']:
        prim=stage.GetPrimAtPath(part['name']);mesh=UsdGeom.Mesh(prim)
        vertices=mesh.GetPointsAttr().Get(time);transform=cache.GetLocalToWorldTransform(prim)
        weights=rig['weights'].get(prim.GetParent().GetName());points=[];rest=[]
        if weights and weights['vc']!=len(vertices):raise ValueError('Skin vertex count mismatch')
        for index,vertex in enumerate(vertices):
            point=np.array([*transform.Transform(Gf.Vec3d(*vertex)),1.]);rest.append(point.copy())
            if weights:
                es=weights['es'];deformed=np.zeros(4);total=0
                for influence in range(es):
                    offset=index*es+influence;weight=weights['jw'][offset]
                    if weight:deformed+=weight*(skin[weights['ji'][offset]]@point);total+=weight
                if abs(total-1)>.001:raise ValueError('Original skin weights are not normalized')
                point=deformed/total
            elif prim.GetParent().GetName()=='face':point=skin[rig['face_bone']]@point
            points.append([round(float(point[0])*.01,5),round(float(point[2])*.01,5),round(-float(point[1])*.01,5)])
        expanded=[];expanded_rest=[];indices=mesh.GetFaceVertexIndicesAttr().Get();offset=0
        for count in mesh.GetFaceVertexCountsAttr().Get():
            if count>=3:
                for index in indices[offset:offset+count]:
                    expanded.extend(points[index]);p=rest[index];expanded_rest.extend([p[0]*.01,p[2]*.01,-p[1]*.01])
            offset+=count
        if len(expanded)!=len(part['positions']) or np.max(np.abs(np.array(expanded_rest)-part['positions']))>1e-4:raise ValueError('Rest skin does not match existing conversion')
        part['seatedPositions']=expanded
        normals=world_normals(mesh,time,transform)
        if normals is not None:
            part['normals']=web_normals(normals);posed_normals=[]
            for index,normal in normals:
                value=np.array(normal,dtype=float)
                if weights:
                    blended=sum(weights['jw'][index*weights['es']+j]*skin[weights['ji'][index*weights['es']+j]][:3,:3] for j in range(weights['es']))
                    value=np.linalg.inv(blended).T@value
                elif prim.GetParent().GetName()=='face':value=np.linalg.inv(skin[rig['face_bone']][:3,:3]).T@value
                value/=np.linalg.norm(value);posed_normals.extend([float(value[0]),float(value[2]),-float(value[1])])
            part['seatedNormals']=posed_normals
    model['drivingPoseVersion']=VERSION;model['drivingPose']='original weighted joints; web seated pose'
    path.write_text(json.dumps(model,separators=(',',':')),encoding='utf-8');return True

if __name__=='__main__':
    catalog_path=ROOT/'web-preview/assets/catalog.json'
    catalog=json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.is_file() else {'characters':[{'id':name,'family':name,'ready':True} for name in ['dao','bazzi','marid','run_dizini']]}
    print('Prepared weighted seated riders:',sum(prepare(e) for e in catalog['characters'] if e['ready']))
