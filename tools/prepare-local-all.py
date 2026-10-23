"""Discover supplied USDA models and reuse the existing local-only converters."""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor,as_completed
import argparse,contextlib,hashlib,importlib.util,json,shutil,subprocess,uuid,xml.etree.ElementTree as ET
from local_asset_paths import track_file, resource_file
ROOT=Path(__file__).resolve().parent.parent
TOOLS=ROOT/'tools'
PRIORITY=['beach_I01','beach_I02','village_R01']
LABELS={'beach_I01':'비치 I01','beach_I02':'비치 I02','village_R01':'빌리지 R01','whiteKnightV1':'백기사 V1','saberV1':'세이버 V1','dao':'다오','bazzi':'배찌','marid':'마리드','run_dizini':'디지니'}
def load_module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def prepare(job):
 kind,entry,source,rho,signature=job;source=Path(source);rho=Path(rho)
 target=ROOT/'web-preview/assets/usd'/entry['id'];cache=ROOT/'local-data/catalog-cache'/f"{entry['id']}.json"
 log=ROOT/'local-data/catalog-logs'/f"{entry['id']}.log"
 fingerprint=hashlib.sha256(signature.encode()+str((source.stat().st_size,source.stat().st_mtime_ns)).encode()).hexdigest()
 if cache.is_file():
  try:
   old=json.loads(cache.read_text(encoding='utf-8'))
   if old['fingerprint']==fingerprint and (not old['entry']['ready'] or (target/'model.mesh.json').is_file()):return kind,old['entry']
  except (ValueError,KeyError):pass
 try:
  with log.open('w',encoding='utf-8') as stream,contextlib.redirect_stdout(stream),contextlib.redirect_stderr(stream):
   converter=load_module('local_usd_converter',TOOLS/'convert-usd-local.py')
   converter.export(source,target/'model.mesh.json',.01,rho_root=rho)
   entry['ready']=True
   if kind=='tracks':
    original=track_file(rho,entry['id']);raw=original.parent
    if not original.is_file():raise ValueError('Original track.1s missing')
    native=ROOT/'local-data/native-collision'/uuid.uuid4().hex/entry['id'];native.parent.mkdir(parents=True)
    tool=TOOLS/'native-collision-exporter/bin/Release/net8.0/NativeCollisionExporter.dll'
    subprocess.run(['dotnet',str(tool),'export',str(original),str(native)],cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT,check=True)
    align=load_module('native_alignment',TOOLS/'align-native-collision.py');align.convert(native.with_suffix('.ktrk'),target)
    entry['alignment']=json.loads((target/'collision-info.json').read_text())
    artwork=ROOT/'web-preview/assets/tracks'/entry['id'];artwork.mkdir(parents=True,exist_ok=True)
    for name in ['xt_minimap.png','xt_trackCard.png','xt_trackThumb.png']:
     if (raw/name).is_file():shutil.copy2(raw/name,artwork/name)
    entry['card']=(artwork/'xt_trackCard.png').is_file()
 except Exception as error:
  entry['ready']=False;entry['reason']=str(error)
  with log.open('a',encoding='utf-8') as stream:stream.write('\nFAILED: '+repr(error)+'\n')
 cache.write_text(json.dumps({'fingerprint':fingerprint,'entry':entry},ensure_ascii=False),encoding='utf-8')
 return kind,entry
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--rho-root',type=Path,required=True);parser.add_argument('--workers',type=int,default=3);args=parser.parse_args()
 for folder in ['catalog-cache','catalog-logs']:(ROOT/'local-data'/folder).mkdir(parents=True,exist_ok=True)
 metadata={}
 xml=resource_file(args.rho_root,'track/common/track@zz.xml')
 if xml.is_file():metadata={e.get('id'):e.attrib for e in ET.parse(xml).getroot().iter('track')}
 locale=resource_file(args.rho_root,'track/common/trackLocale@kr.xml')
 names={e.get('id'):e.get('name') for e in ET.parse(locale).getroot().iter('track') if e.get('name')} if locale.is_file() else {}
 script_hash=hashlib.sha256(b''.join((TOOLS/name).read_bytes() for name in ['convert-usd-local.py','usd_materials.py','align-native-collision.py'])).hexdigest()
 jobs=[];waiting=[]
 for kind,folder in [('tracks','track'),('karts','kart'),('characters','character')]:
  for directory in sorted((ROOT/'local-assets'/folder).iterdir()):
   if not directory.is_dir():continue
   sources=sorted(directory.glob('*.usda'));base=directory.name
   if not sources:waiting.append({'kind':kind,'id':base,'reason':'USDA source missing'});continue
   if kind=='karts':sources=[next((p for p in sources if p.stem==base+'_demo'),next((p for p in sources if p.stem==base),sources[0]))]
   if kind=='tracks':sources=[next((p for p in sources if p.stem==base),sources[0])]
   # Texture changes invalidate cached conversions without listing assets in chat.
   sibling_signature=str(sorted((p.name,p.stat().st_size,p.stat().st_mtime_ns) for p in directory.iterdir() if p.is_file() and p.suffix.lower() in ['.png','.dds','.jpg','.jpeg','.tga']))
   for source in sources:
    primary=kind!='characters' or source.stem==base or (source.stem==base+'_f00' and not (directory/(base+'.usda')).is_file())
    id=base if primary else base+'--'+source.stem
    entry={'id':id,'family':base,'label':LABELS.get(base,base)+((' · '+source.stem) if not primary else '')}
    if kind=='tracks':entry['laps']=int(metadata.get(base,{}).get('laps','0'))
    raw=track_file(args.rho_root,base)
    raw_signature=str((raw.stat().st_size,raw.stat().st_mtime_ns)) if kind=='tracks' and raw.is_file() else ''
    jobs.append((kind,entry,str(source),str(args.rho_root),script_hash+sibling_signature+raw_signature))
 catalog={'format':'p5136-local-catalog-v1','tracks':[],'karts':[],'characters':[],'waiting':waiting}
 with ProcessPoolExecutor(max_workers=args.workers) as pool:
  futures=[pool.submit(prepare,job) for job in jobs]
  for index,future in enumerate(as_completed(futures),1):
   kind,entry=future.result();catalog[kind].append(entry)
   if index%25==0 or index==len(jobs):print(f'Prepared {index}/{len(jobs)} models',flush=True)
 for kind in ['tracks','karts','characters']:
  if kind=='tracks':
   for entry in catalog[kind]:entry['label']=names.get(entry['id'],entry['label'])
  priority=PRIORITY if kind=='tracks' else ['whiteKnightV1','saberV1'] if kind=='karts' else ['dao','bazzi','marid','run_dizini']
  catalog[kind].sort(key=lambda e:(priority.index(e['id']) if e['id'] in priority else 999,e['id']))
 art=load_module('local_track_art',TOOLS/'prepare-local-track-art.py')
 for entry in catalog['tracks']:art.prepare(args.rho_root,entry)
 path=ROOT/'web-preview/assets/catalog.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({kind:{'ready':sum(e['ready'] for e in catalog[kind]),'total':len(catalog[kind])} for kind in ['tracks','karts','characters']}),flush=True)
if __name__=='__main__':main()
