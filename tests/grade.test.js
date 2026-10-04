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
// --- gợi ý theo bối cảnh lúc chụp + ánh sáng ---
const mk = (f) => { const o = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o.set([...f(x / W, y / H), 255], (y * W + x) * 4); return { width: W, height: H, data: o }; };
const ids = (r, k) => r.slice(0, k || 3).map((x) => x.id);
const flat = mk((u, v) => { const t = 110 + 40 * v; return [t, t - 4, t - 8]; });
const fa = G.analyze(flat);
assert(ids(G.suggest(fa, { main: 'person', opt: 'face' })).includes('portra'), 'chụp người phải gợi ý Portra');
assert(/người|Cận mặt/.test(G.suggest(fa, { main: 'person', opt: 'face' })[0].why), 'lý do phải nhắc tới lựa chọn lúc chụp');
assert.notStrictEqual(G.suggest(fa, { main: 'flower' })[0].id, G.suggest(fa, { main: 'house' })[0].id, 'hoa và công trình phải ra gam khác nhau');
// ngược sáng: nền trắng sáng, chủ thể tối ở ô người dùng đặt (lệch trái, không ở giữa)
const box = { x: 0.1, y: 0.3, w: 0.25, h: 0.4 };
const back = mk((u, v) => (u > box.x && u < box.x + box.w && v > box.y && v < box.y + box.h ? [70, 55, 45] : [235, 230, 220]));
const ba = G.analyze(back, box);
assert(G.light(ba).back, 'phải nhận ra ngược sáng theo ô chủ thể');
assert(!G.light(G.analyze(back)).back, 'không có ô thì vùng giữa (sáng) không phải ngược sáng');
const bs = G.suggest(ba, { main: 'person', opt: 'half' });
assert(bs.slice(0, 3).some((x) => /Ngược sáng/.test(x.why)), 'ngược sáng phải có gợi ý kèm lý do ngược sáng: ' + bs.slice(0, 3).map((x) => x.why));
// ngược sáng thì tự kéo phơi sáng (thanh 0..1, tối đa 1 stop = 0,67); không ngược sáng thì không đụng
const lift = G.light(ba).lift;
assert(lift > 0 && lift <= 0.67 + 1e-9 && G.light(fa).lift === 0, 'mức tự kéo phơi sáng sai: ' + lift);
assert(G.light(ba, { main: 'accent' }).lift === 0 && /silhouette/.test(G.suggest(ba, { main: 'accent' }).find((x) => x.id === 'bwhard').why), 'điểm nhấn ngược sáng: để bóng đen, không kéo sáng');
assert(!/silhouette/.test(G.suggest(ba).find((x) => x.id === 'bwhard').why), 'không rõ chủ thể thì không gợi ý bóng đen trong khi đang kéo sáng');
const lo = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }, sp = ((H * 0.5 | 0) * W + (W * 0.2 | 0)) * 4;
G.apply(back, lo, G.resolve(G.PRESETS[0], Object.assign({}, zero, { ev: lift }), ba), 1);
assert(lo.data[sp] > back.data[sp] + 15 && lo.data[0] >= 235, 'kéo phơi sáng phải làm chủ thể sáng lên mà nền không tối đi');
// cùng một ảnh ấm và tối: 21 giờ là đèn vàng → Tự cân; 17 giờ là nắng chiều → không phải đèn vàng
const warmDark = mk((u, v) => [120 + 30 * u, 80 + 20 * u, 40]);
const wa = G.analyze(warmDark);
assert(G.light(wa, { hour: 21 }).tungsten && !G.light(wa, { hour: 17 }).tungsten, 'giờ chụp phải tách đèn vàng khỏi nắng chiều');
assert.strictEqual(G.suggest(wa, { hour: 21 })[0].id, 'auto', 'đèn vàng ban đêm phải gợi ý Tự cân trước');
assert(G.suggest(wa, { hour: 17 }).findIndex((x) => x.id === 'golden') < G.suggest(wa, { hour: 21 }).findIndex((x) => x.id === 'golden'), 'nắng chiều phải xếp Giờ vàng cao hơn ban đêm');
// ám xanh lá: phòng đèn huỳnh quang thì có; phong cảnh nhiều cây cỏ thì KHÔNG (từng bắt nhầm đất xanh rêu)
const land = mk((u, v) => (v < 0.55 ? [60 + 180 * v / 0.55, 100 + 60 * v / 0.55, 220 - 140 * v / 0.55] : v < 0.7 ? [20, 110, 40] : [45, 65, 30]));
assert(!G.light(G.analyze(land)).green, 'cây cỏ không phải ám xanh lá');
const fluo = G.analyze(mk((u) => { const t = 90 + 100 * u; return [t - 10, t + 8, t - 12]; }));
assert(G.light(fluo).green && G.suggest(fluo)[0].id === 'auto', 'phòng ám xanh lá phải gợi ý Tự cân trước');
console.log('grade.test.js: PASS (' + G.PRESETS.length + ' preset)');
