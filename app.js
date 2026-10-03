// app.js — camera, khung bố cục, đo sáng, thước cân bằng, màn chỉnh màu và xuất ảnh.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = window.Grade;
  const PHI = (1 + Math.sqrt(5)) / 2;

  // ---------- Khung bố cục ----------
  const GUIDES = [
    { id: 'thirds', name: 'Một phần ba', variants: 1,
      tip: 'Đặt chủ thể vào một trong 4 giao điểm. Đường chân trời trùng đường ngang trên nếu mặt đất đẹp, đường dưới nếu bầu trời đẹp. Chân dung: mắt nằm trên đường ngang trên, chừa khoảng trống về phía người đang nhìn.' },
    { id: 'phi', name: 'Lưới vàng', variants: 1,
      tip: 'Chia 1 : 0,618 : 1 — giao điểm gần tâm hơn một phần ba, bố cục chặt và tĩnh hơn. Hợp kiến trúc, chân dung cận, tĩnh vật.' },
    { id: 'spiral', name: 'Xoắn ốc vàng', variants: 4,
      tip: 'Tâm xoắn (vòng tròn nhỏ) là điểm nhấn: mắt, bông hoa, người nhỏ giữa cảnh. Cho đường cong tự nhiên — bờ biển, cầu thang, dáng người — chạy theo nhịp xoắn. Chạm lại nút để xoay hướng.' },
    { id: 'diag', name: 'Đường chéo', variants: 1,
      tip: 'Đặt đường dẫn (con đường, hàng rào, vệt nắng) theo đường chéo để ảnh có chuyển động. Chỗ các đường cắt nhau vuông góc là nơi đặt chủ thể.' },
    { id: 'tri', name: 'Tam giác vàng', variants: 2,
      tip: 'Đường chéo chính chia khung, hai đường vuông góc tạo ba tam giác. Đặt chủ thể tại chân đường vuông góc; hợp ảnh có đường xiên mạnh. Chạm lại để lật.' },
    { id: 'center', name: 'Đối xứng', variants: 1,
      tip: 'Dùng cho kiến trúc, mặt nước phản chiếu, chân dung chính diện. Phải cân thật thẳng — lệch 1–2° là lộ ngay, hãy bật thước cân bằng.' },
    { id: 'none', name: 'Không khung', variants: 1, tip: '' },
  ];
  // [rộng, cao] theo chiều dọc; null = cả khung ngắm
  const RATIOS = [[2, 3], [4, 5], [3, 4], [1, 1], [9, 16], null];

  const st = {
    guide: 'thirds', variant: 0, ratio: RATIOS[0], landscape: false,
    facing: 'environment', stream: null, track: null, timer: 0, busy: false,
    level: false, roll: null,
  };

  const stage = $('stage'), video = $('video'), ov = $('overlay'), octx = ov.getContext('2d');

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1800);
  }

  // ---------- Thanh chọn khung & tỉ lệ ----------
  function renderGuideChips() {
    $('guides').innerHTML = '';
    GUIDES.forEach((g) => {
      const b = document.createElement('button');
      b.className = 'chip' + (st.guide === g.id ? ' on' : '');
      b.innerHTML = g.name + (g.variants > 1 && st.guide === g.id ? '<span class="cyc">↻</span>' : '');
      b.onclick = () => {
        if (st.guide === g.id && g.variants > 1) st.variant = (st.variant + 1) % g.variants;
        else { st.guide = g.id; st.variant = 0; }
        renderGuideChips(); showTip(); draw();
      };
      $('guides').appendChild(b);
    });
  }
  function ratioLabel(r) {
    if (!r) return 'Toàn khung';
    const [a, b] = st.landscape ? [r[1], r[0]] : r;
    return a + ':' + b;
  }
  function renderRatioChips() {
    const box = $('ratios'); box.innerHTML = '';
    RATIOS.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'chip' + (st.ratio === r ? ' on' : '');
      b.textContent = ratioLabel(r);
      b.onclick = () => { st.ratio = r; renderRatioChips(); draw(); };
      box.appendChild(b);
    });
    const o = document.createElement('button');
    o.className = 'chip'; o.textContent = st.landscape ? '▭ Ngang' : '▯ Dọc';
    o.title = 'Đổi khung dọc / ngang';
    o.onclick = () => { st.landscape = !st.landscape; renderRatioChips(); draw(); };
    box.appendChild(o);
  }
  let tipTimer;
  function showTip() {
    const g = GUIDES.find((x) => x.id === st.guide), t = $('tip');
    t.textContent = g.tip; t.classList.toggle('hide', !g.tip);
    clearTimeout(tipTimer); tipTimer = setTimeout(() => t.classList.add('hide'), 9000);
  }
  $('tip').onclick = () => $('tip').classList.add('hide');

  // ---------- Hình học khung ----------
  function cropRect() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!st.ratio) return { x: 0, y: 0, w: W, h: H };
    const [a, b] = st.landscape ? [st.ratio[1], st.ratio[0]] : st.ratio;
    const pad = 10, r = a / b;
    let w = W - pad * 2, h = w / r;
    if (h > H - pad * 2) { h = H - pad * 2; w = h * r; }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }

  function line(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    // nét đôi: viền tối mờ + nét sáng, để nhìn được trên cả nền trắng lẫn nền tối
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.1; ctx.stroke();
  }
  function dot(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r || 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(233,180,76,.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function ring(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(233,180,76,.95)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // tia từ (px,py) theo hướng (dx,dy) tới mép khung
  function toEdge(R, px, py, dx, dy) {
    let t = Infinity;
    if (dx > 1e-9) t = Math.min(t, (R.x + R.w - px) / dx); else if (dx < -1e-9) t = Math.min(t, (R.x - px) / dx);
    if (dy > 1e-9) t = Math.min(t, (R.y + R.h - py) / dy); else if (dy < -1e-9) t = Math.min(t, (R.y - py) / dy);
    return [px + dx * t, py + dy * t];
  }

  // Xoắn ốc vàng: dựng trong hình chữ nhật vàng đơn vị (PHI x 1) rồi ánh xạ vào khung
  function spiralPoints() {
    let x = 0, y = 0, w = PHI, h = 1;
    const pts = [], squares = [];
    const arc = (cx, cy, r, a0, a1) => { for (let k = 0; k <= 16; k++) { const a = a0 + (a1 - a0) * k / 16; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    for (let i = 0; i < 12; i++) {
      const d = i % 4;
      if (d === 0) { const s = h; squares.push([x + s, y, x + s, y + h]); arc(x + s, y + h, s, Math.PI, 1.5 * Math.PI); x += s; w -= s; }
      else if (d === 1) { const s = w; squares.push([x, y + s, x + w, y + s]); arc(x, y + s, s, 1.5 * Math.PI, 2 * Math.PI); y += s; h -= s; }
      else if (d === 2) { const s = h; squares.push([x + w - s, y, x + w - s, y + h]); arc(x + w - s, y, s, 0, 0.5 * Math.PI); w -= s; }
      else { const s = w; squares.push([x, y + h - s, x + w, y + h - s]); arc(x + s, y + h - s, s, 0.5 * Math.PI, Math.PI); h -= s; }
    }
    return { pts, squares, eye: [x + w / 2, y + h / 2] };
  }
  const SPIRAL = spiralPoints();

  function drawGuide(ctx, R, guide, variant) {
    const X = (f) => R.x + R.w * f, Y = (f) => R.y + R.h * f;
    if (guide === 'thirds' || guide === 'phi') {
      const a = guide === 'thirds' ? 1 / 3 : 1 - 1 / PHI, b = 1 - a;
      [a, b].forEach((f) => { line(ctx, [[X(f), R.y], [X(f), R.y + R.h]]); line(ctx, [[R.x, Y(f)], [R.x + R.w, Y(f)]]); });
      [a, b].forEach((fx) => [a, b].forEach((fy) => dot(ctx, X(fx), Y(fy))));
    } else if (guide === 'spiral') {
      const portrait = R.h > R.w;
      const fx = variant & 1, fy = (variant >> 1) & 1;
      const map = ([u, v]) => {
        let nu = u / PHI, nv = v; // 0..1
        if (fx) nu = 1 - nu; if (fy) nv = 1 - nv;
        return portrait ? [R.x + R.w * nv, R.y + R.h * nu] : [R.x + R.w * nu, R.y + R.h * nv];
      };
      ctx.save(); ctx.globalAlpha = 0.45;
      SPIRAL.squares.slice(0, 6).forEach(([a, b, c, d]) => line(ctx, [map([a, b]), map([c, d])]));
      ctx.restore();
      line(ctx, SPIRAL.pts.map(map));
      const e = map(SPIRAL.eye); ring(ctx, e[0], e[1], Math.min(R.w, R.h) * 0.045); dot(ctx, e[0], e[1], 2.5);
    } else if (guide === 'diag') {
      const { x, y, w, h } = R;
      line(ctx, [[x, y], [x + w, y + h]]); line(ctx, [[x + w, y], [x, y + h]]);
      ctx.save(); ctx.globalAlpha = 0.7;
      line(ctx, [[x + w, y], toEdge(R, x + w, y, -h, w)]);
      line(ctx, [[x, y + h], toEdge(R, x, y + h, h, -w)]);
      line(ctx, [[x, y], toEdge(R, x, y, h, w)]);
      line(ctx, [[x + w, y + h], toEdge(R, x + w, y + h, -h, -w)]);
      ctx.restore();
      // giao điểm của đường chéo và đường vuông góc
      const d2 = w * w + h * h;
      [w * w / d2, h * h / d2].forEach((t) => { dot(ctx, x + w * t, y + h * t); dot(ctx, x + w - w * t, y + h * t); });
    } else if (guide === 'tri') {
      const { x, y, w, h } = R, d2 = w * w + h * h, t1 = w * w / d2, t2 = h * h / d2;
      const P = (u, v) => (variant ? [x + w - u, y + v] : [x + u, y + v]);
      line(ctx, [P(0, 0), P(w, h)]);
      line(ctx, [P(w, 0), P(w * t1, h * t1)]);
      line(ctx, [P(0, h), P(w * t2, h * t2)]);
      dot(ctx, ...P(w * t1, h * t1)); dot(ctx, ...P(w * t2, h * t2));
    } else if (guide === 'center') {
      ctx.save(); ctx.setLineDash([6, 6]);
      line(ctx, [[X(0.5), R.y], [X(0.5), R.y + R.h]]); line(ctx, [[R.x, Y(0.5)], [R.x + R.w, Y(0.5)]]);
      ctx.restore();
      ring(ctx, X(0.5), Y(0.5), Math.min(R.w, R.h) * 0.12);
      ctx.save(); ctx.globalAlpha = 0.35;
      line(ctx, [[X(0.25), R.y], [X(0.25), R.y + R.h]]); line(ctx, [[X(0.75), R.y], [X(0.75), R.y + R.h]]);
      ctx.restore();
    }
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, W = stage.clientWidth, H = stage.clientHeight;
    if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) { ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr); }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    const R = cropRect();
    // che mờ phần ngoài khung — đây là phần sẽ bị cắt bỏ
    octx.fillStyle = 'rgba(0,0,0,.62)';
    octx.beginPath(); octx.rect(0, 0, W, H); octx.rect(R.x, R.y, R.w, R.h); octx.fill('evenodd');
    octx.strokeStyle = 'rgba(255,255,255,.5)'; octx.lineWidth = 1; octx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
    drawGuide(octx, R, st.guide, st.variant);
    const lv = $('level');
    lv.style.left = (R.x + R.w * 0.27) + 'px'; lv.style.top = (R.y + R.h / 2) + 'px'; lv.style.width = (R.w * 0.46) + 'px';
  }
  new ResizeObserver(draw).observe(stage);

  // ---------- Camera ----------
  async function startCamera() {
    stopCamera();
    $('shutter').disabled = true;
    const nc = $('nocam');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $('nocamMsg').textContent = window.isSecureContext
        ? 'Trình duyệt này không hỗ trợ camera. Bạn vẫn có thể chọn ảnh có sẵn để chỉnh màu.'
        : 'Camera chỉ mở được qua https:// hoặc localhost. Hãy mở trang bằng địa chỉ bảo mật, hoặc chọn ảnh có sẵn.';
      nc.classList.add('on'); return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: st.facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      });
      st.stream = s; st.track = s.getVideoTracks()[0];
      video.srcObject = s;
      const fm = st.track.getSettings ? st.track.getSettings().facingMode : '';
      video.classList.toggle('mirror', fm ? fm === 'user' : st.facing === 'user');
      await video.play().catch(() => {});
      nc.classList.remove('on');
      setupPro();
    } catch (e) {
      $('nocamMsg').textContent = e.name === 'NotAllowedError'
        ? 'Bạn chưa cho phép dùng camera. Hãy bật quyền camera cho trang này trong cài đặt trình duyệt, rồi tải lại.'
        : 'Không mở được camera (' + e.name + '). Bạn vẫn có thể chọn ảnh có sẵn.';
      nc.classList.add('on');
    }
  }
  function stopCamera() {
    if (st.stream) st.stream.getTracks().forEach((t) => t.stop());
    st.stream = null; st.track = null;
  }
  video.addEventListener('loadedmetadata', () => { $('shutter').disabled = false; draw(); });

  // Zoom / bù sáng phần cứng — chỉ hiện khi máy hỗ trợ (chủ yếu Chrome Android)
  function setupPro() {
    const box = $('pro'); box.innerHTML = ''; box.hidden = true;
    const caps = st.track && st.track.getCapabilities ? st.track.getCapabilities() : {};
    const sets = st.track && st.track.getSettings ? st.track.getSettings() : {};
    const add = (key, label) => {
      const c = caps[key]; if (!c || c.max === undefined || c.max === c.min) return;
      const l = document.createElement('label');
      l.innerHTML = `${label} <input type="range" min="${c.min}" max="${c.max}" step="${c.step || 0.1}" value="${sets[key] ?? c.min}">`;
      l.querySelector('input').oninput = (e) => {
        st.track.applyConstraints({ advanced: [{ [key]: +e.target.value }] }).catch(() => {});
      };
      box.appendChild(l); box.hidden = false;
    };
    add('zoom', 'Zoom');
    add('exposureCompensation', 'Bù sáng');
  }

  $('flip').onclick = () => { st.facing = st.facing === 'user' ? 'environment' : 'user'; startCamera(); };
  $('timer').onclick = () => {
    st.timer = st.timer === 0 ? 3 : st.timer === 3 ? 10 : 0;
    $('timerTxt').textContent = st.timer ? st.timer + ' giây' : 'Tắt';
  };

  // ---------- Đo sáng trực tiếp + biểu đồ histogram ----------
  const mc = document.createElement('canvas'), mctx = mc.getContext('2d', { willReadFrequently: true });
  function drawHist(cv, bins, clipHi, clipLo) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const mx = Math.max(...bins) || 1;
    c.fillStyle = 'rgba(255,255,255,.75)';
    const bw = W / bins.length;
    bins.forEach((v, i) => { const h = Math.sqrt(v / mx) * (H - 4); c.fillRect(i * bw, H - h, bw + 0.5, h); });
    if (clipLo) { c.fillStyle = 'rgba(92,150,255,.9)'; c.fillRect(0, 0, 4, H); }
    if (clipHi) { c.fillStyle = 'rgba(255,138,92,.95)'; c.fillRect(W - 4, 0, 4, H); }
  }
  function lumaStats(data) {
    const bins = new Array(64).fill(0); let hi = 0, lo = 0, sum = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      bins[Math.min(63, L >> 2)]++; sum += L; n++;
      if (Math.max(r, g, b) >= 250) hi++;
      if (L <= 6) lo++;
    }
    return { bins, hi: hi / n, lo: lo / n, mean: sum / n / 255 };
  }
  function meter() {
    if (!$('cam').classList.contains('on') || !video.videoWidth || document.hidden) return;
    const src = sourceRect(); if (!src) return;
    const w = 80, h = Math.max(1, Math.round(80 * src.sh / src.sw));
    mc.width = w; mc.height = h;
    mctx.drawImage(video, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
    const s = lumaStats(mctx.getImageData(0, 0, w, h).data);
    drawHist($('hist'), s.bins, s.hi > 0.01, s.lo > 0.02);
    const t = $('meterTxt');
    let msg = 'Sáng ổn', bad = false;
    if (s.hi > 0.04) { msg = `Cháy sáng ${Math.round(s.hi * 100)}% · giảm bù sáng`; bad = true; }
    else if (s.lo > 0.12 || s.mean < 0.18) { msg = 'Thiếu sáng · giữ máy thật chắc'; bad = true; }
    else if (s.mean > 0.75) { msg = 'Rất sáng · ổn nếu cố ý high-key'; }
    t.textContent = msg; t.classList.toggle('bad', bad);
  }
  setInterval(meter, 450);

  // ---------- Thước cân bằng (gia tốc kế) ----------
  let lp = null, wasFlat = false;
  function onMotion(e) {
    const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
    const ang = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI / 180;
    let sx = g.x * Math.cos(ang) - g.y * Math.sin(ang);
    let sy = g.x * Math.sin(ang) + g.y * Math.cos(ang);
    // iOS và Android ngược dấu nhau; "phía trên" của màn hình luôn là chiều ngược trọng lực
    if (sy < 0) { sx = -sx; sy = -sy; }
    lp = lp ? [lp[0] * 0.8 + sx * 0.2, lp[1] * 0.8 + sy * 0.2] : [sx, sy];
    const inPlane = Math.hypot(lp[0], lp[1]);
    st.roll = inPlane > 5 ? Math.atan2(lp[0], lp[1]) * 180 / Math.PI : null;
  }
  function levelLoop() {
    const lv = $('level');
    if (st.level && st.roll != null) {
      lv.style.display = 'block';
      lv.querySelector('.bar').style.transform = `rotate(${st.roll.toFixed(2)}deg)`;
      const flat = Math.abs(st.roll) < 1;
      lv.classList.toggle('flat', flat);
      lv.querySelector('.deg').textContent = flat ? 'Thẳng' : Math.abs(st.roll).toFixed(1) + '°';
      if (flat && !wasFlat && navigator.vibrate) navigator.vibrate(12);
      wasFlat = flat;
    } else lv.style.display = 'none';
    requestAnimationFrame(levelLoop);
  }
  requestAnimationFrame(levelLoop);
  $('levelBtn').onclick = async () => {
    if (st.level) { st.level = false; $('levelTxt').textContent = 'Cân bằng'; return; }
    try {
      if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted') { toast('Chưa được phép đọc cảm biến nghiêng'); return; }
      }
    } catch (e) { toast('Không xin được quyền cảm biến'); return; }
    window.addEventListener('devicemotion', onMotion);
    st.level = true; $('levelTxt').textContent = 'Đang bật';
    setTimeout(() => { if (st.level && st.roll == null) toast('Máy này không có cảm biến nghiêng (hoặc đang để nằm phẳng)'); }, 1500);
  };

  // ---------- Chụp ----------
  // Vùng ảnh gốc (theo pixel của video) tương ứng với khung đang hiện trên màn
  function sourceRect() {
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
    const W = stage.clientWidth, H = stage.clientHeight, R = cropRect();
    const sc = Math.max(W / vw, H / vh), offX = (W - vw * sc) / 2, offY = (H - vh * sc) / 2;
    const mirror = video.classList.contains('mirror');
    let sx = (R.x - offX) / sc;
    if (mirror) sx = vw - (R.x + R.w - offX) / sc;
    const sy = (R.y - offY) / sc;
    return { sx: Math.max(0, sx), sy: Math.max(0, sy), sw: Math.min(vw, R.w / sc), sh: Math.min(vh, R.h / sc) };
  }
  function capture() {
    const r = sourceRect(); if (!r) return;
    const c = document.createElement('canvas');
    c.width = Math.round(r.sw); c.height = Math.round(r.sh);
    c.getContext('2d').drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
    const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.9;
    requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; });
    openEditor(c);
  }
  $('shutter').onclick = async () => {
    if (st.busy) return; st.busy = true;
    const cd = $('countdown');
    for (let i = st.timer; i > 0; i--) { cd.textContent = i; await new Promise((r) => setTimeout(r, 1000)); }
    cd.textContent = '';
    try { capture(); } finally { st.busy = false; }
  };

  // ---------- Chọn ảnh có sẵn ----------
  const pickFile = () => $('file').click();
  $('pick').onclick = pickFile; $('nocamPick').onclick = pickFile;
  $('file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      // giới hạn 4096 cạnh dài — Safari iOS từ chối canvas quá ~16 MP
      const k = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); openEditor(c);
    };
    img.onerror = () => toast('Không đọc được ảnh này');
    img.src = URL.createObjectURL(f);
    e.target.value = '';
  };

  // ==================== MÀN CHỈNH MÀU ====================
  const ADJ = [
    ['ev', 'Phơi sáng', -100, 100], ['contrast', 'Tương phản', -100, 100], ['temp', 'Nhiệt độ màu', -100, 100],
    ['tint', 'Tông xanh–hồng', -100, 100], ['sat', 'Bão hoà', -100, 100], ['fade', 'Nâng đen (phai)', 0, 100],
    ['vig', 'Tối góc', -100, 100], ['grain', 'Hạt film', 0, 100],
  ];
  const ed = { full: null, src: null, out: null, analysis: null, preset: 'orig', amount: 1, adj: {}, sugg: [], comparing: false };
  const pv = $('pv'), pctx = pv.getContext('2d');

  function scaled(srcCanvas, maxSide, square) {
    const w0 = srcCanvas.width, h0 = srcCanvas.height;
    let sx = 0, sy = 0, sw = w0, sh = h0;
    if (square) { const m = Math.min(w0, h0); sx = (w0 - m) / 2; sy = (h0 - m) / 2; sw = sh = m; }
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  }
  const presetById = (id) => G.PRESETS.find((p) => p.id === id);

  function resetAdj() { ADJ.forEach(([k]) => (ed.adj[k] = 0)); }
  resetAdj();

  function buildAdjUI() {
    const box = $('adjs'); box.innerHTML = '';
    ADJ.forEach(([k, label, mn, mx]) => {
      const row = document.createElement('div'); row.className = 'sl';
      row.innerHTML = `<span>${label}</span><input type="range" min="${mn}" max="${mx}" value="${Math.round(ed.adj[k] * 100)}"><output>${Math.round(ed.adj[k] * 100)}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.oninput = () => { ed.adj[k] = inp.value / 100; out.textContent = inp.value; schedule(); };
      inp.ondblclick = () => { inp.value = 0; inp.oninput(); };
      box.appendChild(row);
    });
  }
  buildAdjUI();

  function openEditor(canvas) {
    ed.full = canvas;
    const longSide = Math.min(1600, Math.round(Math.max(innerWidth, innerHeight) * Math.min(2, devicePixelRatio || 1)));
    ed.src = scaled(canvas, longSide);
    ed.out = new ImageData(ed.src.width, ed.src.height);
    pv.width = ed.src.width; pv.height = ed.src.height;
    ed.analysis = G.analyze(scaled(canvas, 96));
    ed.sugg = G.suggest(ed.analysis).slice(0, 3);
    ed.preset = ed.sugg[0].id; ed.amount = 1; $('amount').value = 100; $('amountOut').textContent = 100;
    resetAdj(); buildAdjUI();
    buildPresets();
    $('cam').classList.remove('on'); $('edit').classList.add('on');
    render();
  }

  function buildPresets() {
    const box = $('presets'); box.innerHTML = '';
    const th = scaled(ed.full, 148, true), zero = {}; ADJ.forEach(([k]) => (zero[k] = 0));
    const topIds = ed.sugg.map((s) => s.id);
    G.PRESETS.forEach((p) => {
      const b = document.createElement('button'); b.className = 'pr' + (p.id === ed.preset ? ' on' : ''); b.dataset.id = p.id;
      const c = document.createElement('canvas'); c.width = th.width; c.height = th.height;
      const o = new ImageData(th.width, th.height);
      G.apply(th, o, G.resolve(p, zero, ed.analysis), p.id === 'orig' ? 0 : 1);
      c.getContext('2d').putImageData(o, 0, 0);
      b.appendChild(c); b.appendChild(document.createTextNode(p.name));
      if (topIds.includes(p.id)) { const s = document.createElement('span'); s.className = 'star'; s.textContent = 'Gợi ý'; b.appendChild(s); }
      b.onclick = () => {
        ed.preset = p.id;
        box.querySelectorAll('.pr').forEach((x) => x.classList.toggle('on', x.dataset.id === p.id));
        schedule();
      };
      box.appendChild(b);
    });
    // màn chỉnh màu vừa mới hiện — đợi một khung hình để có kích thước rồi mới cuộn tới gam được gợi ý
    requestAnimationFrame(() => {
      const sel = box.querySelector('.pr.on');
      box.scrollLeft = sel ? Math.max(0, sel.offsetLeft - box.offsetLeft - box.clientWidth / 2 + sel.offsetWidth / 2) : 0;
    });
  }

  function currentParams() { return G.resolve(presetById(ed.preset), ed.adj, ed.analysis); }
  function adjActive() { return ADJ.some(([k]) => ed.adj[k]); }

  let rq = 0;
  function schedule() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); }
  function render() {
    const amt = ed.preset === 'orig' && !adjActive() ? 0 : ed.preset === 'orig' ? 1 : ed.amount;
    // preset "Gốc" + chỉnh tay: chỉnh tay luôn áp đủ; preset khác thì "Độ đậm" pha với ảnh gốc
    G.apply(ed.src, ed.out, currentParams(), amt);
    pctx.putImageData(ed.comparing ? ed.src : ed.out, 0, 0);
    const p = presetById(ed.preset), sg = ed.sugg.find((s) => s.id === ed.preset);
    $('note').innerHTML = (sg ? `<b>Gợi ý:</b> ${sg.why}. ` : '') + (p.note || '');
    histDebounced(); paletteDebounced();
  }
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const histDebounced = debounce(() => {
    const s = lumaStats(sampleOut(96).data); drawHist($('ehist'), s.bins, s.hi > 0.01, s.lo > 0.02);
  }, 60);
  function sampleOut(max) {
    const c = document.createElement('canvas');
    const k = Math.min(1, max / Math.max(pv.width, pv.height));
    c.width = Math.max(1, Math.round(pv.width * k)); c.height = Math.max(1, Math.round(pv.height * k));
    const x = c.getContext('2d', { willReadFrequently: true });
    const tmp = document.createElement('canvas'); tmp.width = ed.out.width; tmp.height = ed.out.height;
    tmp.getContext('2d').putImageData(ed.out, 0, 0);
    x.drawImage(tmp, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  }
  let lastPal = [];
  const paletteDebounced = debounce(() => {
    const pal = G.palette(sampleOut(64), 5); lastPal = pal;
    const box = $('pal'); box.innerHTML = '';
    pal.forEach((c) => {
      const b = document.createElement('button');
      b.style.background = c.hex; b.style.flex = String(Math.max(0.08, c.share));
      b.title = c.hex + ' — chạm để chép mã';
      b.innerHTML = `<span style="color:${G.lum(...c.rgb.map((v) => v / 255)) > 0.5 ? '#111' : '#fff'}">${c.hex}</span>`;
      b.onclick = () => {
        box.classList.add('show');
        (navigator.clipboard ? navigator.clipboard.writeText(c.hex) : Promise.reject()).then(() => toast('Đã chép ' + c.hex), () => toast(c.hex));
      };
      box.appendChild(b);
    });
    const h = G.harmony(pal);
    $('harm').innerHTML = `<b>${h.name}</b> · ${h.desc}`;
    $('tempTxt').textContent = 'Tông ' + h.temp;
  }, 160);

  $('amount').oninput = (e) => { ed.amount = e.target.value / 100; $('amountOut').textContent = e.target.value; schedule(); };
  $('reset').onclick = () => {
    resetAdj(); buildAdjUI(); ed.amount = 1; $('amount').value = 100; $('amountOut').textContent = 100; schedule();
  };
  $('back').onclick = () => { $('edit').classList.remove('on'); $('cam').classList.add('on'); draw(); };

  // Giữ để xem ảnh gốc
  const cmp = (on) => { if (!ed.src) return; ed.comparing = on; $('cmpBadge').classList.toggle('on', on); pctx.putImageData(on ? ed.src : ed.out, 0, 0); };
  pv.addEventListener('pointerdown', (e) => { e.preventDefault(); cmp(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => pv.addEventListener(ev, () => cmp(false)));
  pv.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- Xuất ảnh độ phân giải đầy đủ ----------
  async function exportBlob() {
    const W = ed.full.width, H = ed.full.height;
    const src = ed.full.getContext('2d').getImageData(0, 0, W, H);
    const out = new ImageData(W, H);
    const amt = ed.preset === 'orig' && !adjActive() ? 0 : ed.preset === 'orig' ? 1 : ed.amount;
    G.apply(src, out, currentParams(), amt);
    const withPal = $('withPal').checked && lastPal.length;
    const strip = withPal ? Math.round(W * 0.14) : 0;
    const c = document.createElement('canvas'); c.width = W; c.height = H + strip;
    const x = c.getContext('2d');
    x.putImageData(out, 0, 0);
    if (withPal) {
      // dải bảng màu kiểu "palette card": mỗi ô rộng theo tỉ lệ màu trong ảnh
      x.fillStyle = '#f4f2ee'; x.fillRect(0, H, W, strip);
      const pad = Math.round(strip * 0.18), sw = (W - pad * 2), tot = lastPal.reduce((a, c) => a + Math.max(0.08, c.share), 0);
      let px = pad;
      const fs = Math.max(10, Math.round(strip * 0.13));
      x.font = `500 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`; x.textBaseline = 'top';
      lastPal.forEach((p) => {
        const w = sw * Math.max(0.08, p.share) / tot;
        x.fillStyle = p.hex; x.fillRect(px, H + pad, w, strip - pad * 2 - fs * 1.6);
        x.fillStyle = '#555'; x.fillText(p.hex, px, H + strip - pad - fs * 1.2);
        px += w;
      });
    }
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
  }
  function fileName() {
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    return `khung-ngam-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}-${ed.preset}.jpg`;
  }
  async function withBusy(btn, label, fn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    await new Promise((r) => setTimeout(r, 30));
    try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') toast('Lỗi khi xuất ảnh: ' + (e.message || e)); }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  $('dl').onclick = () => withBusy($('dl'), 'Đang xuất…', async () => {
    const blob = await exportBlob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Đã lưu ' + a.download);
  });
  try {
    const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [probe] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) $('share').hidden = false;
  } catch (e) { /* trình duyệt không hỗ trợ chia sẻ file */ }
  $('share').onclick = () => withBusy($('share'), 'Đang xuất…', async () => {
    const blob = await exportBlob();
    await navigator.share({ files: [new File([blob], fileName(), { type: 'image/jpeg' })] });
  });

  // ---------- Khởi động ----------
  st.landscape = stage.clientWidth > stage.clientHeight * 1.15;
  renderGuideChips(); renderRatioChips(); showTip(); draw();
  startCamera();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (st.stream && st.track && st.track.readyState === 'ended') startCamera();
  });
})();
