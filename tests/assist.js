// Kiểm "Chụp gì?" (bám chủ thể + chỉ hướng), toàn màn hình, nút Lưu vào Ảnh.
// Camera giả = video tự dựng: hoa văn trôi sang PHẢI 1px video/khung hình, 30 khung/giây.
// Cần server: python3 -m http.server 8765 (trong Photo_Art)
// NODE_PATH="../web_task/node_modules" node tests/assist.js   — ảnh chụp màn hình ở $OUT
const puppeteer = require('puppeteer');
const fs = require('fs'), os = require('os'), assert = require('assert');
const OUT = process.env.OUT || os.tmpdir() + '/khung-ngam-test'; fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:8765/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeVideo(file) {
  const W = 320, H = 240, N = 300;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const fd = fs.openSync(file, 'w');
  fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`);
  const uv = Buffer.alloc(W * H / 2, 128);
  for (let t = 0; t < N; t++) {
    const Y = Buffer.alloc(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x - t; // cảnh trôi sang phải theo thời gian
      const v = 128 + 45 * Math.sin(u * 0.09 + Math.sin(y * 0.05) * 3) * Math.cos(y * 0.11) + 70 * (hash(Math.floor(u / 9), Math.floor(y / 9)) - 0.5);
      Y[y * W + x] = Math.max(0, Math.min(255, v));
    }
    fs.writeSync(fd, 'FRAME\n'); fs.writeSync(fd, Y); fs.writeSync(fd, uv);
  }
  fs.closeSync(fd);
}

(async () => {
  const vid = OUT + '/troi-phai.y4m';
  if (!fs.existsSync(vid)) makeVideo(vid);
  const b = await puppeteer.launch({ headless: 'new', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + vid] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  // giả bảng chia sẻ: lần 1 Safari chặn (NotAllowedError), lần 2 cho mở
  await p.evaluateOnNewDocument(() => {
    navigator.canShare = () => true;
    window.__shares = [];
    navigator.share = async (d) => { window.__shares.push(d.files[0].size); if (window.__shares.length === 1) throw new DOMException('mất cú chạm', 'NotAllowedError'); };
  });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !document.getElementById('shutter').disabled, { timeout: 8000 });
  await sleep(500);
  const chip = (sel, txt) => p.evaluate((s, t) => [...document.querySelectorAll(s)].find((c) => c.textContent.startsWith(t)).click(), sel, txt);
  const stageBox = await p.evaluate(() => { const r = stage.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

  // 1) Người: chọn → khung 4:5 + một phần ba, chạm vào chủ thể → có mục tiêu + chỉ hướng
  await chip('#scenes .chip', 'Người');
  const s1 = await p.evaluate(() => ({ guide: KN.st.guide, ratio: document.querySelector('#ratios .chip.on').textContent, step: asStep.textContent, msg: asMsg.textContent }));
  await p.screenshot({ path: OUT + '/a1-nguoi-buoc1.png' });
  // chạm gần góc dưới-trái để chắc chắn phải lia máy
  await p.touchscreen.tap(stageBox.x + stageBox.w * 0.25, stageBox.y + stageBox.h * 0.7);
  await sleep(150);
  const s2 = await p.evaluate(() => ({ step: asStep.textContent, msg: asMsg.textContent, t: KN.st.assist.t, ok: KN.st.assist.ok }));
  console.log('nguoi', JSON.stringify(s1), JSON.stringify(s2));
  await p.screenshot({ path: OUT + '/a2-nguoi-buoc2.png' });
  assert.deepStrictEqual([s1.guide, s1.ratio, s1.step.startsWith('Bước 1')], ['thirds', '4:5', true], 'chọn Người phải đặt khung một phần ba 4:5');
  // chủ thể ở dưới-trái, mục tiêu ở 1/3 trên-trái: chủ thể phải sang phải + lên trên → lia máy sang TRÁI, CHÚC xuống
  assert(s2.step.startsWith('Bước 2') && /sang trái/.test(s2.msg) && /chúc máy xuống/.test(s2.msg), 'chỉ sai hướng lia máy: ' + s2.msg);

  // 2) Bám chủ thể: cảnh trôi sang phải → chấm phải trôi sang phải, không mất dấu
  await chip('#scenes .chip', 'Đồ vật');
  await p.touchscreen.tap(stageBox.x + stageBox.w * 0.3, stageBox.y + stageBox.h * 0.5);
  await sleep(200);
  const p0 = await p.evaluate(() => ({ x: KN.st.assist.pts[0].x, y: KN.st.assist.pts[0].y, std: KN.st.assist.pts[0].tpl && KN.st.assist.pts[0].tpl.std }));
  await sleep(1500);
  const p1 = await p.evaluate(() => ({ x: KN.st.assist.pts[0].x, y: KN.st.assist.pts[0].y, lost: KN.st.assist.lost, vw: video.videoWidth, vh: video.videoHeight }));
  const sc = Math.max(stageBox.w / p1.vw, stageBox.h / p1.vh);
  console.log('bam', JSON.stringify(p0), JSON.stringify(p1), 'dx', (p1.x - p0.x).toFixed(1), 'dy', (p1.y - p0.y).toFixed(1), 'kỳ vọng ~', (30 * 1.5 * sc).toFixed(0));
  await p.screenshot({ path: OUT + '/a3-bam.png' });
  assert(!p1.lost, 'mất dấu dù cảnh có chi tiết');
  assert(p1.x - p0.x > 30 * 1.5 * sc * 0.4 && p1.x - p0.x < 30 * 1.5 * sc * 1.6, 'chấm không trôi theo cảnh');
  assert(Math.abs(p1.y - p0.y) < 15, 'chấm trôi dọc dù cảnh chỉ trôi ngang');

  // 3) Chân trời: có vạch, đổi lựa chọn "Cảnh dưới đẹp hơn" → mục tiêu lên 1/3 trên
  await chip('#scenes .chip', 'Chân trời');
  await p.touchscreen.tap(stageBox.x + stageBox.w * 0.5, stageBox.y + stageBox.h * 0.45);
  await sleep(150);
  const h1 = await p.evaluate(() => KN.st.assist.t.y);
  await chip('#asOpts .chip', 'Cảnh dưới');
  const h2 = await p.evaluate(() => KN.st.assist.t.y);
  await p.screenshot({ path: OUT + '/a4-chan-troi.png' });
  console.log('chan troi target y', h1.toFixed(0), '→', h2.toFixed(0));
  assert(h2 < h1, 'đổi "Cảnh dưới đẹp hơn" phải dời chân trời lên trên');
  await p.click('#asClose');
  assert(await p.evaluate(() => KN.st.assist === null && document.getElementById('assist').hidden), 'nút ✕ không thoát hướng dẫn');

  // 4) Toàn màn hình: khung ngắm phủ cả màn, khung tỉ lệ né hai thanh nổi
  await p.click('#fullBtn'); await sleep(300);
  const f = await p.evaluate(() => {
    const s = stage.getBoundingClientRect(), t = document.querySelector('.topbar').getBoundingClientRect(), c = document.querySelector('.controls').getBoundingClientRect();
    return { stageH: s.height, vh: innerHeight, topBottom: t.bottom, ctrlTop: c.top, insT: getComputedStyle(cam).getPropertyValue('--insT') };
  });
  await chip('#ratios .chip', '4:5'); await sleep(100);
  await p.screenshot({ path: OUT + '/a5-toan-man.png' });
  console.log('full', JSON.stringify(f));
  assert(Math.abs(f.stageH - f.vh) < 2, 'chế độ toàn màn hình chưa phủ kín');
  await p.click('#fullBtn'); await sleep(200);

  // 5) Nút Lưu vào Ảnh: hiện ngay (không phải cuộn), lần 1 bị chặn → mời bấm lại, lần 2 mở được
  await p.click('#shutter');
  await p.waitForFunction(() => document.getElementById('edit').classList.contains('on'));
  await sleep(500);
  const sv = await p.evaluate(() => { const r = share.getBoundingClientRect(); return { hidden: share.hidden, inView: r.top >= 0 && r.bottom <= innerHeight, txt: share.textContent, dl: dl.textContent }; });
  await p.screenshot({ path: OUT + '/a6-nut-luu.png' });
  assert(!sv.hidden && sv.inView, 'nút Lưu vào Ảnh không thấy được trên màn: ' + JSON.stringify(sv));
  await p.click('#share');
  await p.waitForFunction(() => window.__shares.length === 1 && !share.disabled);
  const t1 = await p.evaluate(() => share.textContent);
  await p.click('#share'); await sleep(200);
  const t2 = await p.evaluate(() => ({ n: window.__shares.length, txt: share.textContent, sizes: window.__shares }));
  console.log('luu', JSON.stringify(sv), '| sau lần 1:', t1, '| sau lần 2:', JSON.stringify(t2));
  assert(/sẵn sàng/.test(t1) && t2.n === 2 && t2.txt === 'Lưu vào Ảnh' && t2.sizes[0] === t2.sizes[1], 'luồng chia sẻ bị chặn → bấm lại chưa đúng');

  console.log('errors', errs);
  assert.deepStrictEqual(errs, [], 'có lỗi trên trang');
  console.log('assist.js: PASS');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
