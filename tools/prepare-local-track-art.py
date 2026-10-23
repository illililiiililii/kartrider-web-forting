"""Copy local map art and decode this track's own ToMinimap registration."""
import argparse, importlib.util, json, math, shutil, struct, zlib
from pathlib import Path
from local_asset_paths import ROOT, track_file

def minimap_mapping(source):
    data=source.read_bytes()
    stamp=b'\xaa\x47'+struct.pack('<I',zlib.adler32(b'ToMinimap',0))
    offset=data.find(stamp)
    if offset<0: return None
    offset+=8  # class stamp + object index
    length=struct.unpack_from('<I',data,offset)[0]; offset+=4+length*2
    prop=data[offset]; offset+=1
    if prop:
        path=ROOT/'third_party/KartriderDemoPhysics/scripts/derive_course_gates.py'
        spec=importlib.util.spec_from_file_location('course_tags',path)
        parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
        _,offset=parser.read_tag(data,offset)
    x,y,scale,width,height=struct.unpack_from('<fffII',data,offset)
    if not all(math.isfinite(v) for v in (x,y,scale)) or not 0<scale<100 or not 0<width<=8192 or not 0<height<=8192:
        raise ValueError('Invalid original ToMinimap mapping')
    return {'origin':[x,y],'scale':scale,'width':width,'height':height,'source':'track.1s/ToMinimap'}

def prepare(rho,entry):
    name=entry['id']; target=ROOT/'web-preview/assets/tracks'/name;target.mkdir(parents=True,exist_ok=True)
    for filename in ['xt_bigmap.png','xt_minimap.png','xt_trackCard.png','xt_trackThumb.png']:
        source=track_file(rho,name,filename)
        if source.is_file():shutil.copy2(source,target/filename)
    entry['card']=(target/'xt_trackCard.png').is_file()
    source=track_file(rho,name)
    mapping=minimap_mapping(source) if source.is_file() else None
    entry['minimap']=bool(mapping and (target/'xt_bigmap.png').is_file())
    if entry['minimap']:(target/'minimap.json').write_text(json.dumps(mapping),encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--rho-root',type=Path,required=True);args=parser.parse_args()
    path=ROOT/'web-preview/assets/catalog.json'
    catalog=json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {'tracks':[{'id':name} for name in ['beach_I01','beach_I02','village_R01']]}
    for entry in catalog['tracks']:prepare(args.rho_root,entry)
    if path.is_file():path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Original minimap registrations:',sum(e['minimap'] for e in catalog['tracks']))
