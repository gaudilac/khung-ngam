// Chạy thử toàn luồng với camera giả. Cần server: python3 -m http.server 8765 (trong Photo_Art)
// NODE_PATH="../web_task/node_modules" node tests/e2e.js   — ảnh chụp màn hình ở $OUT
const puppeteer = require('puppeteer');
const fs = require('fs'), path = require('path');
const OUT = process.env.OUT || require('os').tmpdir() + '/khung-ngam-test'; fs.mkdirSync(OUT, { recursive: true }); const assert = require('assert');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
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
  console.log('errors', errs);
  assert.strictEqual(info.nocam, false, 'camera không mở');
  assert.deepStrictEqual([lv1.tr, lv2], ['rotate(-10deg)', 'rotate(-10deg)'], 'thước cân bằng sai hướng (Android / iOS)');
  assert.deepStrictEqual([e1.presets, e1.stars, e1.pal], [14, 3, 5], 'màn chỉnh màu thiếu preset / gợi ý / bảng màu');
  assert(fs.readdirSync(dl).some(f => f.endsWith('.jpg')), 'không tải được ảnh');
  assert(px[0] === px[1] && px[1] === px[2] && !(px2[0] === px2[1] && px2[1] === px2[2]), 'giữ để so ảnh gốc không chạy');
  assert.deepStrictEqual(errs, [], 'có lỗi trên trang');
  console.log('e2e.js: PASS');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
