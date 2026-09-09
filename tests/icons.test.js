import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('icons are PNGs of the declared size', () => {
  for (const size of [192, 512]) {
    const bytes = readFileSync(join(root, 'assets', `icon-${size}.png`));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), size); // IHDR width
    assert.equal(bytes.readUInt32BE(20), size); // IHDR height
  }
});
