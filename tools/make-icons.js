// Génère les icônes PNG (pièce d'or « צ »-like avec cœur, sur fond bleu nuit) sans dépendance.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, shade) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        for (let i = 0; i < 4; i++) acc[i] += c[i];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 4; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function shade(x, y) {
  const dx = x - 0.5, dy = y - 0.5, r = Math.hypot(dx, dy);
  let c = lerp(hex('#223f8c'), hex('#0e1838'), r / 0.7);
  const R = 0.33;
  if (r <= R) {
    const t = Math.hypot(x - 0.4, y - 0.36) / 0.45;
    c = t < 0.5 ? lerp(hex('#f7e3a4'), hex('#d3a548'), t / 0.5) : lerp(hex('#d3a548'), hex('#8a6418'), (t - 0.5) / 0.5);
    if (r > R - 0.012) c = lerp(c, hex('#6e4f12'), 0.55);
    if (Math.abs(r - 0.265) < 0.006) c = lerp(c, hex('#7a5717'), 0.6);
    const hx = (x - 0.5) / 0.115, hy = -(y - 0.515) / 0.115;
    if ((hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3 <= 0) c = lerp(hex('#14224a'), hex('#2a4fa8'), (y - 0.38) / 0.3);
  }
  return [...c, 255];
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192, shade));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, shade));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), png(512, shade));
console.log('Icônes générées dans', out);
