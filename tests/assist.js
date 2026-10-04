// Kiểm "Trong khung có:" (kéo nút vào khung, tiến/lùi, bám chủ thể + chỉ hướng), toàn màn hình, nút Lưu vào Ảnh.
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

  const tapAt = async (u, v) => { await p.touchscreen.tap(stageBox.x + stageBox.w * u, stageBox.y + stageBox.h * v); await sleep(150); };
  const trang = () => p.evaluate(() => ({ phase: KN.st.assist && KN.st.assist.phase, step: asStep.textContent, msg: asMsg.textContent, go: !asGo.hidden && !asGo.disabled, dock: assist.classList.contains('dock') }));
  // kéo nút vật từ bảng vào khung bằng cảm ứng thật: chạm – rê – thả
  const keo = async (name, u, v) => {
    const b = await p.evaluate((n) => { const r = [...document.querySelectorAll('#asTok .chip')].find((c) => c.textContent.includes(n)).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, name);
    await p.touchscreen.touchStart(b.x, b.y); await p.touchscreen.touchMove(b.x, b.y - 20);
    await p.touchscreen.touchMove(stageBox.x + stageBox.w * u, stageBox.y + stageBox.h * v); await p.touchscreen.touchEnd(); await sleep(120);
  };
  // kéo chấm ở góc ô: f(R, q) trả vị trí mới của góc (toạ độ khung ngắm) theo khung R và tâm ô q
  const coGoc = async (f) => {
    const g = await p.evaluate((fs) => { const a = KN.st.assist, q = a.pts[0], R = KN.crop(); return { x: q.x + a.box.w / 2, y: q.y + a.box.h / 2, to: new Function('R', 'q', 'return ' + fs)(R, q) }; }, f);
    await p.touchscreen.touchStart(stageBox.x + g.x, stageBox.y + g.y); await p.touchscreen.touchMove(stageBox.x + g.to.x, stageBox.y + g.to.y); await p.touchscreen.touchEnd(); await sleep(120);
  };
  const xong = async () => { await p.click('#asGo'); await sleep(120); };
  // chọn 1 thứ → (việc thêm ở bước 1) → kéo vào khung → Xong → Tiếp nếu có bước khoảng cách → tới bước căn khung
  const chon = async (name, u, v, them) => {
    await chip('#scenes .chip', name); if (them) await them();
    await keo(name, u, v); await xong();
    if ((await trang()).phase === 'dist') await xong();
  };

  // 1) Người: chọn → khung 4:5 + một phần ba, bảng xuống đáy; kéo nút lên mặt, kéo góc ô vừa mặt → bỏ qua bước khoảng cách
  await chip('#scenes .chip', 'Người');
  const s1 = await p.evaluate(() => ({ guide: KN.st.guide, ratio: document.querySelector('#ratios .chip.on').textContent }));
  const s1b = await trang();
  await sleep(400); // chờ mẹo của khung mờ hẳn
  await p.screenshot({ path: OUT + '/a1-nguoi-buoc1.png' });
  await keo('Người', 0.25, 0.7);
  const s1c = await trang();
  // ô vừa đúng cỡ mặt của Cận mặt (1,06 × 0,37 chiều cao khung) → không cần tiến/lùi
  await coGoc('({ x: q.x + 0.15 * R.h, y: q.y + 0.196 * R.h })');
  await p.screenshot({ path: OUT + '/a1b-nguoi-o-mat.png' });
  await xong();
  const s2 = await p.evaluate(() => ({ step: asStep.textContent, msg: asMsg.textContent, t: KN.st.assist.t, ok: KN.st.assist.ok, go: asGo.hidden }));
  console.log('nguoi', JSON.stringify(s1), JSON.stringify(s1b), JSON.stringify(s1c), JSON.stringify(s2));
  await p.screenshot({ path: OUT + '/a2-nguoi-buoc2.png' });
  assert.deepStrictEqual([s1.guide, s1.ratio, s1b.step.startsWith('Bước 1/3'), s1b.go, s1b.dock], ['thirds', '4:5', true, false, true], 'chọn Người: khung một phần ba 4:5, bước 1/3, nút Xong khoá tới khi kéo nút vào, bảng ở đáy');
  assert(/Kéo nút "Người"/.test(s1b.msg) && /góc ô/.test(s1c.msg) && s1c.go, 'kéo nút vào rồi phải nhắc kéo góc ô và mở nút Xong: ' + s1c.msg);
  // ô vừa cỡ → nhảy thẳng bước 3; chủ thể dưới-trái, đích 1/3 trên-trái → lia máy sang TRÁI, CHÚC xuống
  assert(s2.step.startsWith('Bước 3/3') && s2.go && /sang trái/.test(s2.msg) && /chúc máy xuống/.test(s2.msg), 'chỉ sai hướng lia máy: ' + JSON.stringify(s2));
  // kiểu chụp: Toàn thân → khung 2:3, mắt cao hơn 1/3 (giữ trọn chân); Cận mặt → về 4:5
  const kieu = () => p.evaluate(() => { const R = KN.crop(), t = KN.st.assist.t; return { ratio: document.querySelector('#ratios .chip.on').textContent, ty: (t.y - R.y) / R.h }; });
  // viền người: đếm điểm ảnh trắng trên lớp vẽ đè dọc mép dưới bàn chân phải của viền Toàn thân
  const chan = (box) => p.evaluate((b) => {
    const R = KN.crop(), dpr = overlay.width / overlay.clientWidth, h = 0.1 * R.h;
    const t = b || { x: KN.st.assist.t.x, y: KN.st.assist.t.y };
    const d = overlay.getContext('2d').getImageData(Math.round((t.x + 0.22 * h) * dpr), Math.round((t.y + 7 * h) * dpr) - 2, Math.round(0.36 * h * dpr), 5).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 3] > 150) n++;
    return { n, t, msg: asMsg.textContent };
  }, box);
  await chip('#asOpts .chip', 'Toàn thân'); const k1 = await kieu(); const v1 = await chan();
  await p.screenshot({ path: OUT + '/a2b-toan-than.png' });
  await chip('#asOpts .chip', 'Cận mặt'); const k2 = await kieu(); const v2 = await chan(v1.t);
  console.log('vien nguoi', v1.n, v2.n, v1.msg);
  assert(v1.n > 20 && v2.n < 5, 'viền Toàn thân phải có bàn chân, Cận mặt thì chân nằm ngoài khung');
  assert(!/viền/.test(v1.msg), 'chưa đúng chỗ đã nhắc canh viền — bảng dài thêm, che vòng đích');
  // đặt chấm đúng vòng đích → lúc đó mới nhắc tiến/lùi cho vừa viền
  const khop = async () => {
    const t = await p.evaluate(() => KN.st.assist.t);
    await p.touchscreen.tap(stageBox.x + t.x, stageBox.y + t.y); await sleep(60);
    return p.evaluate(() => asMsg.textContent);
  };
  const m1 = await khop(); console.log('khop', m1);
  assert(/vừa khít viền/.test(m1), 'đúng chỗ rồi mà không nhắc canh viền: ' + m1);
  console.log('kieu chup', JSON.stringify(k1), JSON.stringify(k2));
  assert(k1.ratio === '2:3' && Math.abs(k1.ty - 0.25) < 0.02, 'Toàn thân phải khung 2:3, mắt ở 0,25 chiều cao');
  assert(k2.ratio === '4:5' && Math.abs(k2.ty - 1 / 3) < 0.02, 'Cận mặt phải về khung 4:5, mắt ở 1/3');

  // 2) Đồ vật: ô mặc định nhỏ hơn ô đích → bước Khoảng cách "Tiến lại gần"; bám chủ thể chạy ngay từ bước này
  await chip('#scenes .chip', 'Đồ vật'); await keo('Đồ vật', 0.3, 0.5); await xong();
  const kc = await trang();
  const p0 = await p.evaluate(() => ({ x: KN.st.assist.pts[0].x, y: KN.st.assist.pts[0].y, std: KN.st.assist.pts[0].tpl && KN.st.assist.pts[0].tpl.std }));
  await p.screenshot({ path: OUT + '/a2c-khoang-cach.png' });
  await sleep(1500);
  const p1 = await p.evaluate(() => ({ x: KN.st.assist.pts[0].x, y: KN.st.assist.pts[0].y, lost: KN.st.assist.lost, vw: video.videoWidth, vh: video.videoHeight }));
  const sc = Math.max(stageBox.w / p1.vw, stageBox.h / p1.vh);
  console.log('khoang cach', JSON.stringify(kc), '| bam', JSON.stringify(p0), JSON.stringify(p1), 'dx', (p1.x - p0.x).toFixed(1), 'dy', (p1.y - p0.y).toFixed(1), 'kỳ vọng ~', (30 * 1.5 * sc).toFixed(0));
  assert(kc.phase === 'dist' && kc.step.startsWith('Bước 2/3') && /Tiến lại gần/.test(kc.msg) && kc.go && !kc.dock, 'ô nhỏ hơn đích phải hỏi tiến lại gần: ' + JSON.stringify(kc));
  assert(!p1.lost, 'mất dấu dù cảnh có chi tiết');
  assert(p1.x - p0.x > 30 * 1.5 * sc * 0.4 && p1.x - p0.x < 30 * 1.5 * sc * 1.6, 'chấm không trôi theo cảnh');
  assert(Math.abs(p1.y - p0.y) < 15, 'chấm trôi dọc dù cảnh chỉ trôi ngang');
  await xong();
  assert((await trang()).phase === 'guide' && /vừa ô/.test(await khop()), 'Đồ vật thiếu câu nhắc ô đặt vật');

  // 3) Chân trời (chỉ Biển, núi): có vạch, đổi lựa chọn "Cảnh dưới đẹp hơn" → mục tiêu lên 1/3 trên
  await chip('#scenes .chip', 'Đồ vật'); // bỏ chọn chủ thể → chỉ còn chân trời
  await chon('Biển, núi', 0.5, 0.45);
  const h1 = await p.evaluate(() => KN.st.assist.t.y);
  await chip('#asOpts .chip', 'Cảnh dưới');
  const h2 = await p.evaluate(() => KN.st.assist.t.y);
  await p.screenshot({ path: OUT + '/a4-chan-troi.png' });
  console.log('chan troi target y', h1.toFixed(0), '→', h2.toFixed(0));
  assert(h2 < h1, 'đổi "Cảnh dưới đẹp hơn" phải dời chân trời lên trên');

  // 3a) Người + Biển, núi: hai nút, đúng chỗ mà chân trời cắt ngang đầu → nhắc hạ thấp máy
  await chip('#scenes .chip', 'Người');
  const tk = await p.evaluate(() => [...document.querySelectorAll('#asTok .chip')].map((c) => c.textContent));
  await keo('Người', 0.5, 0.5); await coGoc('({ x: q.x + 0.15 * R.h, y: q.y + 0.196 * R.h })'); await keo('Biển', 0.5, 0.8); await xong();
  await khop();
  const ty = await p.evaluate(() => KN.st.assist.t.y);
  await p.touchscreen.touchStart(stageBox.x + 30, stageBox.y + stageBox.h * 0.8); await p.touchscreen.touchMove(stageBox.x + 30, stageBox.y + ty + 15); await p.touchscreen.touchEnd(); await sleep(150);
  const cat = await trang();
  await p.screenshot({ path: OUT + '/a4a-chan-troi-cat-dau.png' });
  console.log('nguoi+bien', JSON.stringify(tk), JSON.stringify(cat));
  assert(tk.length === 2 && /cắt ngang đầu/.test(cat.msg), 'chân trời cắt ngang đầu mà không nhắc: ' + JSON.stringify(cat));
  // chụp lúc đang chọn Người + Biển: bối cảnh phải tới màn chỉnh màu — chủ thể, chân trời, ô mặt đúng chỗ đã đặt (giữa khung)
  const mat = await p.evaluate(() => { const a = KN.st.assist, R = KN.crop(), q = a.pts[0]; return { u: (q.x - R.x) / R.w, v: (q.y - R.y) / R.h }; });
  await p.click('#shutter');
  await p.waitForFunction(() => document.getElementById('edit').classList.contains('on')); await sleep(300);
  const ctx = await p.evaluate(() => KN.shot()), gn = await p.evaluate(() => note.textContent);
  await p.screenshot({ path: OUT + '/a3c-goi-y-gam-nguoi-bien.png' });
  console.log('boi canh chup', JSON.stringify(mat), JSON.stringify(ctx), gn);
  const bc = ctx && ctx.box && { u: ctx.box.x + ctx.box.w / 2, v: ctx.box.y + ctx.box.h / 2 };
  assert(bc && ctx.main === 'person' && ctx.hz === true && Math.abs(bc.u - mat.u) < 0.02 && Math.abs(bc.v - mat.v) < 0.02 && ctx.box.w > 0.05,
    'bối cảnh lúc chụp không tới màn chỉnh màu: ' + JSON.stringify(ctx));
  assert(/^Ánh sáng: /.test(gn), 'thiếu dòng đọc ánh sáng: ' + gn);
  await p.click('#back'); await sleep(200);
  await p.click('#asClose');

  // 3b) Hướng nhìn/đi + Đường dẫn + cỡ Đồ vật — đích tính theo phần khung (u ngang, v dọc)
  const dich = () => p.evaluate(() => { const R = KN.crop(), t = KN.st.assist.t; return { u: (t.x - R.x) / R.w, v: (t.y - R.y) / R.h, dirRow: asDir.children.length, ratio: document.querySelector('#ratios .chip.on').textContent }; });
  // người nhìn sang trái → đặt lệch PHẢI dù kéo vào bên trái; các bước sau ẩn hàng chọn hướng
  await chon('Người', 0.25, 0.5, async () => { await chip('#asDir .chip', '← Nhìn'); await p.screenshot({ path: OUT + '/a4b-huong-buoc1.png' }); });
  const d1 = await dich();
  // điểm nhấn nhỏ đi sang phải → tâm xoắn nằm nửa TRÁI dù kéo vào bên phải
  await chon('Điểm nhấn nhỏ', 0.75, 0.5, () => chip('#asDir .chip', 'Nhìn/đi sang phải')); const d2 = await dich();
  // con đường: điểm cuối thấp → đích ở 1/3 trên
  await chon('Con đường', 0.4, 0.75); const d3 = await dich();
  await p.screenshot({ path: OUT + '/a4c-duong-dan.png' });
  // đồ vật: Lấp đầy → đích ở tâm; Tối giản → đích ở giao điểm 1/3
  await chon('Đồ vật', 0.3, 0.5);
  await chip('#asOpts .chip', 'Lấp đầy'); const d4 = await dich();
  await chip('#asOpts .chip', 'Tối giản'); const d5 = await dich(); d5.guide = await p.evaluate(() => KN.st.guide);
  await p.screenshot({ path: OUT + '/a4d-toi-gian.png' });
  // hoa: kéo ô to hơn ô đích → "Lùi ra xa"
  await chip('#scenes .chip', 'Hoa, cây'); await keo('Hoa', 0.5, 0.5);
  await coGoc('({ x: q.x + 0.4 * Math.min(R.w, R.h), y: q.y + 0.4 * Math.min(R.w, R.h) })'); await xong();
  const lui = await trang();
  await p.screenshot({ path: OUT + '/a4e-lui-ra.png' });
  console.log('huong', JSON.stringify(d1), JSON.stringify(d2), '| duong dan', JSON.stringify(d3), '| do vat', JSON.stringify(d4), JSON.stringify(d5), '| lui', lui.msg);
  assert(Math.abs(d1.u - 2 / 3) < 0.02 && d1.dirRow === 0, 'Người nhìn sang trái phải đặt ở 2/3 bên phải, bước sau không còn hàng chọn hướng');
  assert(d2.u < 0.5, 'Điểm nhấn đi sang phải phải đặt tâm xoắn bên trái');
  assert(d3.ratio === '2:3' && Math.abs(d3.v - 1 / 3) < 0.02, 'Con đường: điểm cuối phải về 1/3 trên, khung 2:3');
  assert(Math.abs(d4.u - 0.5) < 0.02 && Math.abs(d4.v - 0.5) < 0.02, 'Lấp đầy phải đặt vật ở tâm');
  const g3 = (x) => Math.abs(x - 1 / 3) < 0.02 || Math.abs(x - 2 / 3) < 0.02;
  assert(g3(d5.u) && g3(d5.v) && d5.guide === 'thirds', 'Tối giản phải đặt vật ở một giao điểm 1/3 và vẽ lưới một phần ba');
  assert(lui.phase === 'dist' && /Lùi ra xa/.test(lui.msg), 'ô to hơn đích phải bảo lùi ra: ' + lui.msg);

  // 3c) Kẹt phóng to: chạm đúp không phóng to trang; lỡ phóng to thì khung ngắm phải thả cho chụm thu nhỏ + nhắc
  const tz = () => p.evaluate(() => ({ stage: stage.style.touchAction, chip: getComputedStyle(document.querySelector('.chip')).touchAction, scale: visualViewport.scale, toast: document.getElementById('toast').textContent }));
  const z0 = await tz();
  // maximum-scale=1 khiến Chrome không cho phóng to thật → giả độ phóng (iPhone vẫn phóng được dù có thẻ đó)
  const gia = (k) => p.evaluate((k) => { Object.defineProperty(visualViewport, 'scale', { configurable: true, get: () => k }); visualViewport.dispatchEvent(new Event('resize')); }, k);
  await gia(2); await sleep(100); const z1 = await tz();
  await gia(1); await sleep(100); const z2 = await tz();
  console.log('phong to', JSON.stringify(z0), JSON.stringify(z1), JSON.stringify(z2));
  assert(z0.chip === 'manipulation' && z0.stage === 'none', 'nút phải chặn chạm đúp phóng to, khung ngắm chặn cử chỉ khi kéo chấm');
  assert(z1.scale > 1.5 && z1.stage === '' && /phóng to/.test(z1.toast), 'đang phóng to mà khung ngắm vẫn chặn chụm thu nhỏ / không nhắc');
  assert(z2.stage === 'none', 'thu nhỏ xong phải chặn cử chỉ lại để kéo chấm');
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
