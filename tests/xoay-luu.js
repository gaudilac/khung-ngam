// Tái hiện 2 lỗi user báo: (1) Lưu vào Ảnh trả ảnh CŨ sau khi chụp tấm mới; (2) cầm ngang máy vẫn khung dọc.
// Cần server 8765. NODE_PATH="../web_task/node_modules" node tests/xoay-luu.js
const puppeteer = require('puppeteer');
const fs = require('fs'), os = require('os'), assert = require('assert');
const OUT = process.env.OUT || os.tmpdir() + '/khung-ngam-test'; fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:8765/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vid = OUT + '/troi-phai.y4m'; // dựng bởi tests/assist.js
(async () => {
  assert(fs.existsSync(vid), 'chạy tests/assist.js trước để dựng video thử');
  const b = await puppeteer.launch({ headless: 'new', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + vid] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await p.evaluateOnNewDocument(() => {
    navigator.canShare = () => true; window.__shares = [];
    // ghi lại "vân tay" từng ảnh được chia sẻ
    navigator.share = async (d) => { const u = new Uint8Array(await d.files[0].arrayBuffer()); let h = 0; for (let i = 0; i < u.length; i += 7) h = (h * 31 + u[i]) | 0; window.__shares.push(h); };
  });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !document.getElementById('shutter').disabled, { timeout: 8000 });
  await sleep(400);

  // (1) chụp A → lưu, quay lại, chờ cảnh trôi, chụp B → lưu: hai ảnh phải khác nhau
  const shootAndShare = async () => {
    await p.click('#shutter');
    await p.waitForFunction(() => document.getElementById('edit').classList.contains('on'));
    await sleep(300);
    const n = await p.evaluate(() => window.__shares.length);
    await p.click('#share');
    await p.waitForFunction((k) => window.__shares.length > k, {}, n);
    await p.click('#back'); await sleep(200);
  };
  await shootAndShare(); await sleep(1200); await shootAndShare();
  const shares = await p.evaluate(() => window.__shares);
  console.log('van tay 2 anh da luu', shares);
  assert.notStrictEqual(shares[0], shares[1], 'Lưu vào Ảnh trả lại ẢNH CŨ sau khi chụp tấm mới');

  // (2) xoay ngang (đổi khổ, không tải lại trang) → khung phải nằm ngang, nút chụp vẫn trong màn
  const frame = () => p.evaluate(() => {
    const ov = document.getElementById('overlay'), s = stage.getBoundingClientRect(), sh = shutter.getBoundingClientRect();
    return { land: KN.st.landscape, ratio: document.querySelector('#ratios .chip.on').textContent, stageW: s.width, stageH: s.height,
      shutterIn: sh.top >= 0 && sh.bottom <= innerHeight && sh.left >= 0 && sh.right <= innerWidth, crop: KN.crop() };
  });
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  const f1 = await frame();
  await p.screenshot({ path: OUT + '/x1-ngang.png' });
  await p.evaluate(() => [...document.querySelectorAll('#scenes .chip')].find((c) => c.textContent === 'Người').click());
  await sleep(200);
  const f2 = await frame();
  await p.screenshot({ path: OUT + '/x2-ngang-nguoi.png' });
  console.log('ngang', JSON.stringify(f1), '\nnguoi', JSON.stringify(f2));
  assert(f1.land && f1.crop.w > f1.crop.h, 'xoay ngang mà khung vẫn dọc');
  assert(f2.land && f2.crop.w > f2.crop.h, 'chọn Người khi cầm ngang mà khung vẫn dọc');
  assert(f1.shutterIn && f1.stageH > 250, 'cầm ngang: khung ngắm quá thấp hoặc nút chụp tràn ra ngoài');
  // xoay dọc lại → khung dọc
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  const f3 = await frame();
  assert(!f3.land && f3.crop.h > f3.crop.w, 'xoay dọc lại mà khung không dọc');
  // màn chỉnh màu khi cầm ngang: ảnh xem trước phải đủ lớn
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(300);
  await p.click('#shutter'); await p.waitForFunction(() => document.getElementById('edit').classList.contains('on')); await sleep(400);
  const e = await p.evaluate(() => { const r = pv.getBoundingClientRect(), s = share.getBoundingClientRect(); return { pvH: r.height, saveIn: s.bottom <= innerHeight && !share.hidden }; });
  await p.screenshot({ path: OUT + '/x3-ngang-chinh-mau.png' });
  console.log('chinh mau ngang', JSON.stringify(e));
  assert(e.pvH > 200 && e.saveIn, 'màn chỉnh màu khi cầm ngang: ảnh quá nhỏ hoặc mất nút lưu');
  assert.deepStrictEqual(errs, [], 'có lỗi trên trang');
  console.log('xoay-luu.js: PASS');
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
