// Kiểm bộ màu không cần trình duyệt: node tests/grade.test.js
require('../grade.js');
const G = globalThis.Grade, assert = require('assert');
const W = 200, H = 150, d = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { const sky = ((i / W) | 0) < 70; d.set(sky ? [90, 150, 230, 255] : [200, 140, 100, 255], i * 4); }
const img = { width: W, height: H, data: d }, a = G.analyze(img);
const zero = { ev: 0, temp: 0, tint: 0, contrast: 0, sat: 0, fade: 0, vig: 0, grain: 0 };
const px = (o, x, y) => [...o.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];
for (const p of G.PRESETS) {
  const o = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  G.apply(img, o, G.resolve(p, zero, a), 1);
  if (p.id === 'orig') assert.deepStrictEqual(px(o, 100, 100), [200, 140, 100], 'Gốc phải giữ nguyên pixel');
  else assert.notDeepStrictEqual(px(o, 100, 100), [200, 140, 100], p.id + ' không đổi gì');
  if (p.id.startsWith('bw')) { const [r, g, b] = px(o, 100, 100); assert(Math.abs(r - g) < 6 && Math.abs(g - b) < 6, p.id + ' chưa ra xám'); }
  assert(p.id === 'orig' || p.id === 'auto' || p.note, p.id + ' thiếu câu "dùng khi nào"');
}
const s = G.suggest(a); assert(s.length >= 3 && s.every((x) => x.why), 'gợi ý phải có lý do');
const pal = G.palette(img, 5); assert.strictEqual(G.harmony(pal).name, 'Bổ túc', 'trời xanh + đất cam là bổ túc');
console.log('grade.test.js: PASS (' + G.PRESETS.length + ' preset)');
