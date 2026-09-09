// make-icons.mjs — writes assets/icon-192.png and icon-512.png: a 98 window showing
// a sheet of imposed documents. Dependency-free PNG encoding via node:zlib.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const TEAL = [0, 128, 128];
const FACE = [192, 192, 192];
const NAVY = [0, 0, 128];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const DOC = [223, 227, 238];

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paintIcon(size) {
  const px = Buffer.alloc(size * size * 3);
  const unit = size / 32; // draw on a 32-unit grid
  const rect = (x, y, w, h, [r, g, b]) => {
    const x0 = Math.round(x * unit);
    const y0 = Math.round(y * unit);
    const x1 = Math.round((x + w) * unit);
    const y1 = Math.round((y + h) * unit);
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const o = (j * size + i) * 3;
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
      }
    }
  };
  rect(0, 0, 32, 32, TEAL);
  rect(2, 3, 28, 26, BLACK); // window outline
  rect(3, 4, 26, 24, FACE);
  rect(3, 4, 26, 4, NAVY); // title bar
  rect(6, 10, 20, 16, WHITE); // sheet
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      rect(7.5 + col * 9, 11.5 + row * 4.7, 7.5, 3.7, NAVY);
      rect(8 + col * 9, 12 + row * 4.7, 6.5, 2.7, DOC);
    }
  }
  return px;
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../assets/icon-${size}.png`, import.meta.url), encodePng(size, paintIcon(size)));
  console.log(`wrote assets/icon-${size}.png`);
}
