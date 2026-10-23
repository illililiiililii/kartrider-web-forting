"""Add original kart mount metadata without reconverting geometry/collisions."""
import json
from pathlib import Path
from pxr import Usd,UsdGeom
from usd_mounts import kart_mounts
ROOT=Path(__file__).resolve().parent.parent
def prepare(entry):
    path=ROOT/'web-preview/assets/usd'/entry['id']/'model.mesh.json'
    if not entry['ready'] or not path.is_file():return False
    model=json.loads(path.read_text(encoding='utf-8'))
    source=ROOT/'local-assets/kart'/entry['family']/model['source'];stage=Usd.Stage.Open(str(source))
    mounts=kart_mounts(stage,UsdGeom.XformCache(Usd.TimeCode(stage.GetStartTimeCode())))
    if not mounts.get('seat'):return False
    model['kartMounts']=mounts;path.write_text(json.dumps(model,separators=(',',':')),encoding='utf-8');return True
if __name__=='__main__':
    path=ROOT/'web-preview/assets/catalog.json';catalog=json.loads(path.read_text(encoding='utf-8'))
    print('Prepared original kart mount bindings:',sum(prepare(e) for e in catalog['karts']))
