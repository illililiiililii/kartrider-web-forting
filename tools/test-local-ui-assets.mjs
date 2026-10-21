import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const project = resolve(import.meta.dirname, '..');
const original = process.env.KART_ASSET_ROOT ||
  'C:\\Users\\user\\Downloads\\kart web\\KartRider_5136_01_UNPACK\\KartRider_5136_01_UNPACK\\_rhoOut';
const preview = join(project, 'web-preview');

test('game/login UI references unchanged original P5136 GUI assets', { skip: !existsSync(original) }, () => {
  const sourceFiles = ['game.css', 'index.html', 'login.css', 'login.html'];
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
