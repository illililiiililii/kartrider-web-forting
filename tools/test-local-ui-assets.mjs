import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const project = resolve(import.meta.dirname, '..');
const configPath = join(project, 'local-data', 'asset-paths.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')) : {};
const local = join(project, 'local-assets', 'rhoOut');
const original = process.env.KART_ASSET_ROOT || (existsSync(join(local,'gui')) && existsSync(join(local,'stage')) ? local : config.rhoRoot || local);
const preview = join(project, 'web-preview');

test('game/login UI references unchanged original P5136 GUI assets', { skip: !existsSync(join(original, 'gui', 'tachometer', 'default', 'tachometer.png')) }, () => {
  const sourceFiles = ['game.css', 'native-lobby.css', 'native-gui.mjs', 'index.html', 'login.css', 'login.html'];
  const references = new Set();
  for (const file of sourceFiles) {
    const source = readFileSync(join(preview, file), 'utf8');
    assert.doesNotMatch(source, /(?:linear|radial)-gradient\s*\(/i, `${file} contains a fabricated gradient`);
    for (const match of source.matchAll(/assets\/ui\/([^'"\s)]+)/g)) {
      references.add(decodeURIComponent(match[1]));
    }
  }
  assert.ok(references.size >= 20, `Only ${references.size} original GUI assets referenced`);
  for (const relative of references) {
    const local = join(preview, 'assets', 'ui', relative);
    const source = join(original, relative);
    assert.ok(existsSync(local), `Local GUI asset missing: ${relative}`);
    assert.ok(existsSync(source), `Original GUI asset missing: ${relative}`);
    const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(digest(local), digest(source), `GUI sprite changed from original: ${relative}`);
  }
});

test('rank header and participant panels are byte-identical original XML resources',()=>{
  const manifest=JSON.parse(readFileSync(join(preview,'assets/ui/rank-board.json')));
  const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
  for(const [name,sha]of Object.entries(manifest.sources))assert.equal(digest(join(original,'stage/speedIndiGame',name)),sha);
  const panels=[...Object.values(manifest.header),...Object.values(manifest.slots).flatMap(s=>Object.values(s.panels))];
  assert.ok(panels.length>=10);
  for(const panel of panels)assert.equal(digest(join(preview,'assets/ui',panel.image)),digest(join(original,panel.image)));
  assert.equal(manifest.header.myrank.attributes.fontSize,'64 80');
  assert.equal(manifest.slots.self.attributes.windowRect,'0 0 245 31');
});
