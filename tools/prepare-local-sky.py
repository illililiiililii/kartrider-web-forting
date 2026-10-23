"""Reuse the native scene reader for original per-track skydomes (no collisions)."""
import argparse,hashlib,json,shutil,struct,subprocess,uuid
from pathlib import Path
from local_asset_paths import ROOT,track_file

def prepare(rho,entry):
    source=track_file(rho,entry['id'],'skydome.1s');target=ROOT/'web-preview/assets/usd'/entry['id'];out=target/'sky.mesh.json'
    if not source.is_file() or not target.is_dir():return False
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if out.is_file() and json.loads(out.read_text()).get('sourceHash')==digest:return True
    prefix=ROOT/'local-data/sky-export'/uuid.uuid4().hex/entry['id'];prefix.parent.mkdir(parents=True)
    log=prefix.with_suffix('.log')
    with log.open('w') as stream:
        subprocess.run(['dotnet',str(ROOT/'tools/native-collision-exporter/bin/Release/net8.0/NativeCollisionExporter.dll'),'export-kart',str(source),str(prefix)],cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT,check=True)
    data=prefix.with_suffix('.ktrk').read_bytes();offset=44;parts=[]
    for _ in range(struct.unpack_from('<I',data,8)[0]):
        name=data[offset:offset+96].split(b'\0')[0].decode();texture=data[offset+96:offset+192].split(b'\0')[0].decode()
        _,nv,ni=struct.unpack_from('<III',data,offset+192);offset+=204
        positions=[];uvs=[]
        for i in range(nv):
            x,y,z,u,v=struct.unpack_from('<5f',data,offset+i*20);positions.extend([x,z,-y]);uvs.extend([u,v])
        offset+=nv*20;indices=list(struct.unpack_from(f'<{ni}I',data,offset));offset+=ni*4
        candidates=[source.parent/(texture+'.png'),ROOT/'local-assets/track'/entry['id']/(texture+'.png'),rho/'track'/entry['id']/(texture+'.png')]
        image=next((p for p in candidates if p.is_file()),None)
        if image is None:raise ValueError(f'{entry["id"]}: original sky texture missing: {texture}')
        filename=hashlib.sha256(image.read_bytes()).hexdigest()[:12]+'-'+image.name;shutil.copy2(image,target/filename)
        parts.append({'name':name,'positions':positions,'uvs':uvs,'indices':indices,'texture':filename})
    out.write_text(json.dumps({'source':'skydome.1s','sourceHash':digest,'parts':parts},separators=(',',':')));return True
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rho-root',type=Path,required=True);p.add_argument('--manifest-only',action='store_true');args=p.parse_args()
    catalog_path=ROOT/'web-preview/assets/catalog.json'
    catalog=json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.is_file() else {'tracks':[{'id':n,'ready':True} for n in ['beach_I01','beach_I02','village_R01']]}
    ok=missing=0;errors=[]
    available=[]
    for e in catalog['tracks']:
        if not e['ready']:continue
        if args.manifest_only:
            if (ROOT/'web-preview/assets/usd'/e['id']/'sky.mesh.json').is_file():available.append(e['id'])
            continue
        try:
            if prepare(args.rho_root,e):ok+=1;available.append(e['id'])
            else:missing+=1
        except Exception as error:errors.append(f'{e["id"]}: {error}')
    (ROOT/'web-preview/assets/sky-catalog.json').write_text(json.dumps(available),encoding='utf-8')
    if args.manifest_only:print('Registered prepared skydomes:',len(available));raise SystemExit(0)
    (ROOT/'local-data/sky-pending.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Original skydomes: {ok}; missing: {missing}; unsupported: {len(errors)} (local-data/sky-pending.json)')
