"""Read-only source backup into ignored ZIPs. Never stage the output in Git."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent.parent
settings=json.loads((root/'local-data/asset-paths.json').read_text(encoding='utf-8-sig'))
out=root/'local-data/drive-backup';out.mkdir(parents=True,exist_ok=True)
manifest={'format':'p5136-source-backup-v1','trackSourceScale':settings.get('trackSourceScale',1),'archives':[]}
for name in ['kart','character','track','rhoOut']:
 source=Path(settings['rhoRoot']) if name=='rhoOut' else root/'local-assets'/name
 output=out/f'p5136-{name}.zip'
 count=total=0
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=1,strict_timestamps=False) as archive:
  for file in sorted(source.rglob('*')):
   if not file.is_file() or file.name=='.gitkeep' or file.suffix=='.log':continue
   archive.write(file,(Path('local-assets')/name/file.relative_to(source)).as_posix())
   count+=1;total+=file.stat().st_size
 with output.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
 manifest['archives'].append({'file':output.name,'files':count,'sourceBytes':total,'zipBytes':output.stat().st_size,'sha256':digest})
 (out/'P5136-ASSET-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
 print(f'{output.name}: {count} files, {output.stat().st_size//1024**2} MiB',flush=True)
