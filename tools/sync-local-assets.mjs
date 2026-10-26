import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(project, 'local-assets');
const stamp = join(project, 'local-data', 'asset-sync.json');
const required = [
  'web-preview/assets/catalog.json',
  'web-preview/demo_physics.wasm',
  'web-preview/assets/ui/gui/frame/ui_01.png',
  'web-preview/assets/ui/gui/font/NotoSansCJKkr-Medium.otf',
  'web-preview/assets/ui/rank-board.json',
  'web-preview/assets/ui/gui/windowTemplate/img_itemTooltopBoxBG.png',
  'web-preview/assets/audio/count_n.flac',
];

async function inventory() {
  const names = [];
  async function visit(directory) {
    const entries = await readdir(directory, {withFileTypes:true});
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name !== '.gitkeep' && entry.name !== 'README.md') names.push(path);
    }
  }
  for (const name of ['rhoOut', 'track', 'kart', 'character', 'client']) {
    const directory = join(assets, name);
    if (existsSync(directory)) await visit(directory);
  }
  names.sort();
  const hash = createHash('sha256');
  for (let start=0; start<names.length; start+=64) {
    const batch = names.slice(start,start+64);
    const stats = await Promise.all(batch.map(path=>stat(path)));
    batch.forEach((path,i)=>hash.update(`${relative(assets,path)}\0${stats[i].size}\0${stats[i].mtimeMs}\n`));
  }
  return {signature:hash.digest('hex'),files:names.length};
}

export async function syncLocalAssets({run=true}={}) {
  const current = await inventory();
  if (current.files===0) return {status:'waiting',files:0};
  let previous = null;
  try { previous=JSON.parse(await readFile(stamp,'utf8')); } catch {}
  if (previous?.signature===current.signature && required.every(path=>existsSync(join(project,path)))) {
    return {status:'current',files:current.files};
  }
  if (!run) return {status:'stale',files:current.files};
  if (process.platform!=='win32') throw new Error('Automatic preparation currently requires Windows PowerShell');
  // Windows PowerShell 5 promotes OpenUSD's native stderr warnings to terminating
  // errors under the preparation script's ErrorActionPreference=Stop.
  const command = process.env.KART_POWERSHELL || 'pwsh.exe';
  const preparation = spawnSync(command,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(project,'tools','prepare-local-all.ps1')],
    {cwd:project,stdio:'inherit',windowsHide:true});
  if (preparation.error) throw preparation.error;
  if (preparation.status!==0) throw new Error(`Local asset preparation exited ${preparation.status}`);
  const missing=required.filter(path=>!existsSync(join(project,path)));
  if (missing.length) throw new Error(`Local output missing: ${missing.join(', ')}`);
  await mkdir(dirname(stamp),{recursive:true});
  await writeFile(stamp,JSON.stringify(current,null,2)+'\n');
  return {status:'prepared',files:current.files};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  syncLocalAssets().then(result=>console.log(`Local assets: ${result.status} (${result.files} files)`))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
