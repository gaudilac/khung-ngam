// Chạy thử toàn luồng với camera giả. Cần server: python3 -m http.server 8765 (trong Photo_Art)
// NODE_PATH="../web_task/node_modules" node tests/e2e.js   — ảnh chụp màn hình ở $OUT
const puppeteer = require('puppeteer');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || require('os').tmpdir() + '/khung-ngam-test'; fs.mkdirSync(OUT, { recursive: true }); const assert = require('assert');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + (e.stack || e.message)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto((process.env.URL || 'http://localhost:8765/'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !document.getElementById('shutter').disabled, { timeout: 8000 });
  await new Promise(r => setTimeout(r, 900));
  const info = await p.evaluate(() => ({ vw: video.videoWidth, vh: video.videoHeight, meter: meterTxt.textContent, nocam: nocam.classList.contains('on') }));
  console.log('camera', JSON.stringify(info));
  await p.screenshot({ path: OUT + '/1-thirds.png' });
  const clickChip = (txt) => p.evaluate((t) => [...document.querySelectorAll('#guides .chip')].find(c => c.textContent.startsWith(t)).click(), txt);
  await clickChip('Xoắn'); await p.screenshot({ path: OUT + '/2-spiral.png' });
  await clickChip('Xoắn'); await p.screenshot({ path: OUT + '/2b-spiral-v1.png' });
  await clickChip('Đường chéo'); await p.screenshot({ path: OUT + '/3-diag.png' });
  await clickChip('Tam giác'); await p.screenshot({ path: OUT + '/4-tri.png' });
  // gợi ý khung: hàm phân tích trên ảnh tự dựng; ★ hiện trên đúng 1 chip; bảng so sánh mở bằng "?" và chọn được khung
  const goiY = await p.evaluate(() => {
    const W = 160, H = 120, mk = (f) => { const g = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = f(x, y); return g; };
    const rnd = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const nz = (x, y) => (rnd(x, y) - 0.5) * 6; // nhiễu nhỏ, dưới ngưỡng cạnh
    const tex = (x, y) => 128 + 90 * (rnd(x >> 2, y >> 2) - 0.5); // hoa văn ô 4px
    const id = (g) => { const r = KN.suggestGuide(g, W, H); return r ? r.id : null; };
    return {
      tron: id(mk((x, y) => 120 + nz(x, y))),
      doixung: id(mk((x, y) => tex(Math.min(x, W - 1 - x), y))),
      diemnhan: id(mk((x, y) => (x >= 28 && x < 40 && y >= 70 && y < 82 ? 230 : 90) + nz(x, y))),
      giua: id(mk((x, y) => (x >= 50 && x < 115 && y >= 35 && y < 90 ? tex(x, y) : 100 + nz(x, y)))),
      cheo: id(mk((x, y) => 128 + 70 * Math.sin((x + y) * 0.35) + nz(x, y))),
      chantroi: id(mk((x, y) => (y < 50 ? 200 : 70) + nz(x, y))),
      hoavan: id(mk(tex)),
    };
  });
  await p.waitForFunction(() => !!KN.st.sug, { timeout: 6000 });
  const sugChip = await p.evaluate(() => [...document.querySelectorAll('#guides .chip')].filter((c) => c.querySelector('.sug')).map((c) => c.textContent));
  await p.evaluate(() => document.querySelector('#guides .chip.help').click());
  const sh = await p.evaluate(() => ({ open: !gsheet.hidden, rows: document.querySelectorAll('#gsList .grow').length, sug: gsSug.textContent }));
  await p.screenshot({ path: OUT + '/4b-bang-khung.png' });
  await p.evaluate(() => [...document.querySelectorAll('#gsList .grow')].find((b) => b.textContent.startsWith('Đối xứng')).click());
  const sh2 = await p.evaluate(() => ({ open: !gsheet.hidden, guide: KN.st.guide }));
  console.log('goi y', JSON.stringify(goiY), JSON.stringify(sugChip), JSON.stringify(sh), JSON.stringify(sh2));
  assert.deepStrictEqual(goiY, { tron: null, doixung: 'center', diemnhan: 'spiral', giua: 'phi', cheo: 'diag', chantroi: 'thirds', hoavan: 'thirds' }, 'gợi ý khung sai');
  assert(sugChip.length === 1 && sh.open && sh.rows === 6 && /★/.test(sh.sug) && !sh2.open && sh2.guide === 'center', 'bảng so sánh khung chưa đúng');
  // thước cân bằng: máy xoay theo chiều kim đồng hồ 10° → vạch phải nghiêng ngược chiều (-10°)
  await p.evaluate(() => levelBtn.click());
  const th = 10 * Math.PI / 180;
  for (let i = 0; i < 40; i++) await p.evaluate((x, y) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z: 0.3 } })), -9.8 * Math.sin(th), 9.8 * Math.cos(th));
  // iOS: dấu ngược
  await new Promise(r => setTimeout(r, 100));
  const lv1 = await p.evaluate(() => ({ disp: level.style.display, tr: level.querySelector('.bar').style.transform, deg: level.querySelector('.deg').textContent }));
  for (let i = 0; i < 60; i++) await p.evaluate((x, y) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z: 0.3 } })), 9.8 * Math.sin(th), -9.8 * Math.cos(th));
  await new Promise(r => setTimeout(r, 100));
  const lv2 = await p.evaluate(() => level.querySelector('.bar').style.transform);
  console.log('level android', JSON.stringify(lv1), 'ios-sign', lv2);
  await p.screenshot({ path: OUT + '/5-level.png' });
  // chụp
  await p.evaluate(() => shutter.click());
  await p.waitForFunction(() => document.getElementById('edit').classList.contains('on'));
  await new Promise(r => setTimeout(r, 600));
  const e1 = await p.evaluate(() => ({ pv: [pv.width, pv.height], presets: document.querySelectorAll('.pr').length, stars: document.querySelectorAll('.pr .star').length,
    on: document.querySelector('.pr.on').textContent, pal: document.querySelectorAll('#pal button').length, harm: harm.textContent, note: note.textContent }));
  console.log('editor', JSON.stringify(e1));
  await p.screenshot({ path: OUT + '/6-editor.png' });
  // tải về
  const cdp = await p.target().createCDPSession();
  const dl = path.join(OUT, 'dl'); fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl);
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await p.evaluate(() => { [...document.querySelectorAll('.pr')].find(x => x.dataset.id === 'cine').click(); withPal.checked = true; });
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => dl.click());
  for (let i = 0; i < 40 && !fs.readdirSync(dl).some(f => f.endsWith('.jpg')); i++) await new Promise(r => setTimeout(r, 250));
  console.log('download', fs.readdirSync(dl).map(f => f + ' ' + fs.statSync(path.join(dl, f)).size));
  // tải ảnh có sẵn: dựng cảnh tổng hợp (trời, mặt trời, đất, cây)
  const dataUrl = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1067; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, '#2a5fa8'); g.addColorStop(1, '#f2b06a'); x.fillStyle = g; x.fillRect(0, 0, 1600, 700);
    x.fillStyle = '#ffe9b0'; x.beginPath(); x.arc(1100, 560, 70, 0, 7); x.fill();
    x.fillStyle = '#3b4a2a'; x.fillRect(0, 700, 1600, 367);
    x.fillStyle = '#2f6b3a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(120 + i * 170, 690, 90, 0, 7); x.fill(); }
    x.fillStyle = '#d9a184'; x.beginPath(); x.arc(520, 560, 60, 0, 7); x.fill();
    return c.toDataURL('image/jpeg', 0.9);
  });
  const img = path.join(OUT, 'scene.jpg'); fs.writeFileSync(img, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await p.evaluate(() => back.click());
  const inp = await p.$('#file'); await inp.uploadFile(img);
  await p.waitForFunction(() => document.getElementById('edit').classList.contains('on'));
  await new Promise(r => setTimeout(r, 600));
  const e2 = await p.evaluate(() => ({ pv: [pv.width, pv.height], on: document.querySelector('.pr.on').textContent, stars: [...document.querySelectorAll('.pr')].filter(x => x.querySelector('.star')).map(x => x.dataset.id), harm: harm.textContent, temp: tempTxt.textContent }));
  console.log('upload', JSON.stringify(e2));
  await p.screenshot({ path: OUT + '/7-upload.png' });
  // so sánh ảnh gốc khi giữ
  await p.evaluate(() => { [...document.querySelectorAll('.pr')].find(x => x.dataset.id === 'bwhard').click(); });
  await new Promise(r => setTimeout(r, 300));
  const px = await p.evaluate(() => { const d = pv.getContext('2d').getImageData(500, 300, 1, 1).data; return [...d].slice(0, 3); });
  await p.evaluate(() => pv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const px2 = await p.evaluate(() => { const d = pv.getContext('2d').getImageData(500, 300, 1, 1).data; return [...d].slice(0, 3); });
  await p.evaluate(() => pv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  console.log('bw px', px, 'giữ để so', px2);
  await p.evaluate(() => adv.open = true); await p.screenshot({ path: OUT + '/8-bw-adv.png', fullPage: false });
  // ảnh ngược sáng (nền trời trắng, người tối ở giữa): mở ra là thanh Phơi sáng đã tự kéo lên; Đặt lại thì về 0
  const backUrl = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const x = c.getContext('2d');
    x.fillStyle = '#f2f0ea'; x.fillRect(0, 0, 1200, 1600);
    x.fillStyle = '#4a3a30'; x.beginPath(); x.arc(600, 620, 200, 0, 7); x.fill(); x.fillRect(330, 820, 540, 780);
    return c.toDataURL('image/jpeg', 0.9);
  });
  const bimg = path.join(OUT, 'nguoc-sang.jpg'); fs.writeFileSync(bimg, Buffer.from(backUrl.split(',')[1], 'base64'));
  await p.evaluate(() => back.click());
  await (await p.$('#file')).uploadFile(bimg);
  await p.waitForFunction(() => document.getElementById('edit').classList.contains('on'));
  await new Promise(r => setTimeout(r, 600));
  const evOf = () => p.evaluate(() => ({ ev: +document.querySelector('#adjs input').value, on: document.querySelector('.pr.on').dataset.id, note: note.textContent }));
  const nb = await evOf();
  await p.screenshot({ path: OUT + '/9-nguoc-sang.png' });
  await p.evaluate(() => reset.click()); await new Promise(r => setTimeout(r, 200));
  const nb2 = await evOf();
  console.log('nguoc sang', JSON.stringify(nb), '| đặt lại', JSON.stringify(nb2));
  assert(nb.ev >= 20 && nb.on !== 'bwhard' && /ngược sáng/.test(nb.note) && /tự kéo Phơi sáng/.test(nb.note), 'ngược sáng mà không tự kéo phơi sáng: ' + JSON.stringify(nb));
  assert(nb2.ev === 0 && !/tự kéo/.test(nb2.note), 'Đặt lại phải đưa phơi sáng về 0: ' + JSON.stringify(nb2));
  console.log('errors', errs);
  assert.strictEqual(info.nocam, false, 'camera không mở');
  assert.deepStrictEqual([lv1.tr, lv2], ['rotate(-10deg)', 'rotate(-10deg)'], 'thước cân bằng sai hướng (Android / iOS)');
  // ảnh camera giả chỉ có vài mảng màu phẳng nên k-means có thể ra < 5 màu
  assert.deepStrictEqual([e1.presets, e1.stars, e1.pal >= 3], [14, 3, true], 'màn chỉnh màu thiếu preset / gợi ý / bảng màu');
  assert(fs.readdirSync(dl).some(f => f.endsWith('.jpg')), 'không tải được ảnh');
  assert(px[0] === px[1] && px[1] === px[2] && !(px2[0] === px2[1] && px2[1] === px2[2]), 'giữ để so ảnh gốc không chạy');
  assert.deepStrictEqual(errs, [], 'có lỗi trên trang');
  console.log('e2e.js: PASS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
