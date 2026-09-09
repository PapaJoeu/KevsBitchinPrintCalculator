import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function shellList() {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const match = source.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(match, 'sw.js must define const SHELL = [...]');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function walk(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`./${dir}/${entry.name}`]));
}

test('the service worker caches every app file', () => {
  const shell = new Set(shellList());
  const expected = ['./index.html', './manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('assets')];
  for (const file of expected) assert.ok(shell.has(file), `${file} is missing from SHELL in sw.js`);
});

test('every cached path exists', () => {
  for (const entry of shellList()) {
    const path = entry === './' ? './index.html' : entry;
    assert.ok(existsSync(join(root, path)), `${entry} is listed in sw.js but does not exist`);
  }
});
