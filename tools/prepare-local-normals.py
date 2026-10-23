"""Upgrade existing local JSON normals without re-exporting physics/collision."""
import argparse,hashlib,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from pxr import Usd,UsdGeom
from usd_normals import world_normals,web_normals
from usd_materials import material_info
ROOT=Path(__file__).resolve().parent.parent
VERSION=hashlib.sha256(b''.join(Path(__file__).with_name(n).read_bytes() for n in ['usd_normals.py','usd_materials.py'])).hexdigest()
def prepare(job):
    folder,entry,rho=job;path=ROOT/'web-preview/assets/usd'/entry['id']/'model.mesh.json'
    if not entry['ready'] or not path.is_file():return 0
    model=json.loads(path.read_text(encoding='utf-8'))
    if model.get('normalsVersion')==VERSION:return 0
    source=ROOT/'local-assets'/folder/entry['family']/model['source'];stage=Usd.Stage.Open(str(source))
    time=Usd.TimeCode(stage.GetStartTimeCode());cache=UsdGeom.XformCache(time)
    for part in model['parts']:
        prim=stage.GetPrimAtPath(part['name']);normals=world_normals(UsdGeom.Mesh(prim),time,cache.GetLocalToWorldTransform(prim))
        if normals is not None:part['normals']=web_normals(normals)
        part.update(material_info(prim,source,path.parent,rho))
    model['normalsVersion']=VERSION;path.write_text(json.dumps(model,separators=(',',':')),encoding='utf-8');return 1
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--rho-root',type=Path,default=ROOT/'local-assets/rhoOut');args=parser.parse_args()
    catalog=json.loads((ROOT/'web-preview/assets/catalog.json').read_text(encoding='utf-8'))
    jobs=[(folder,e,args.rho_root) for kind,folder in [('tracks','track'),('karts','kart'),('characters','character')] for e in catalog[kind]]
    with ThreadPoolExecutor(max_workers=4) as pool:print('Upgraded authored normals:',sum(pool.map(prepare,jobs)))
