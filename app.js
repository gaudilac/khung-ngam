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

  // "Chụp gì?" — người mới chọn loại cảnh, app tự chọn khung + tỉ lệ rồi chỉ chỗ đặt chủ thể.
  // target(R, opt): điểm/đường cần đưa chủ thể tới, trong toạ độ khung ngắm (null = trục đó không quan trọng).
  const SCENES = [
    { id: 'person', name: 'Người', guide: 'thirds', ratio: [4, 5], dir: true,
      place: 'Chạm hoặc kéo chấm tròn lên MẮT người được chụp',
      tip: 'Khoe biểu cảm → Cận mặt · áo, phụ kiện → Bán thân · dáng, cả bộ đồ → Toàn thân · nơi đã đến → Trong cảnh. Nền sau rối thì chụp càng cận càng tốt. Viền người ở bước 2 là dáng đứng — ngồi hay tạo dáng thì chỉ dùng để ước cỡ.',
      fit: 'tiến/lùi cho người vừa khít viền',
      // [id, tên, độ cao của mắt trong khung, {tỉ lệ, mẹo riêng, body = cỡ đầu so với chiều cao khung}]
      opts: [
        ['face', 'Cận mặt', 1 / 3, { ratio: [4, 5], body: 0.37, tip: 'Cắt mất đỉnh tóc cũng được, nhưng đừng cắt cằm. Đứng lùi ra rồi zoom nếu máy có — dí máy sát mặt làm mũi to ra.' }],
        ['half', 'Bán thân', 1 / 3, { ratio: [4, 5], body: 0.2, tip: 'Mép dưới cắt giữa ngực hoặc ngang eo, đừng cắt ngang cổ hay khuỷu tay. Máy ngang tầm mắt người được chụp.' }],
        // toàn thân: mắt cao hơn 1/3 để người chiếm gần hết chiều cao, không thừa trời trên đầu (cao hơn 0,25 thì bảng hướng dẫn che vòng đích)
        ['full', 'Toàn thân', 0.25, { ratio: [2, 3], body: 0.1, tip: 'Tiến/lùi cho tới khi bàn chân còn cách mép dưới một chút — đừng cắt mất chân. Hạ máy xuống ngang hông cho chân dài, đừng chụp chúc từ trên xuống.' }],
        ['env', 'Trong cảnh', 1 / 3, { ratio: [2, 3], body: 0.035, tip: 'Người nhỏ thôi, cảnh chiếm phần lớn khung. Người nhìn hoặc đi về phía khoảng trống, không nhìn ra mép ảnh.' }],
      ],
      target: (R, o, p) => nearest(p, facing(R, o[0] === 'env'
        ? [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]].map(([u, v]) => [R.x + R.w * u, R.y + R.h * v])
        : [[R.x + R.w / 3, R.y + R.h * o[2]], [R.x + R.w * 2 / 3, R.y + R.h * o[2]]])) },
    { id: 'horizon', name: 'Chân trời', guide: 'thirds', ratio: [2, 3], line: true, level: true,
      place: 'Kéo vạch ngang cho trùng ĐƯỜNG CHÂN TRỜI (mép biển, dải núi, mép ruộng)',
      tip: 'Đừng đặt chân trời ngay giữa ảnh — trừ khi chụp phản chiếu mặt nước. Phần nào đẹp hơn thì cho phần đó 2/3 khung. Thêm tiền cảnh (tảng đá, khóm hoa, hàng rào) ở 1/3 dưới và hạ máy thấp — ảnh có chiều sâu hẳn.',
      opts: [['sky', 'Trời đẹp', 2 / 3], ['ground', 'Cảnh dưới đẹp', 1 / 3], ['mirror', 'Phản chiếu nước', 1 / 2]],
      target: (R, o) => ({ x: null, y: R.y + R.h * o[2] }) },
    { id: 'arch', name: 'Kiến trúc', guide: 'center', ratio: [4, 5], level: true,
      place: 'Chạm vào TRỤC GIỮA công trình (cửa chính, đỉnh mái, tháp)',
      tip: 'Đứng đúng trục giữa và giữ máy thẳng đứng — ngửa máy lên làm các cột chụm vào nhau. Thiếu chỗ thì lùi xa ra, đừng ngửa máy.',
      target: (R) => ({ x: R.x + R.w / 2, y: null }) },
    { id: 'object', name: 'Đồ vật', guide: 'phi', ratio: [1, 1],
      place: 'Chạm lên CHỦ THỂ (món ăn, bông hoa, sản phẩm)',
      tip: 'Món ăn đẹp nhất khi chụp thẳng từ trên xuống hoặc nghiêng 45°.',
      fit: 'tiến/lùi cho vật vừa ô',
      // [id, tên, chỗ đặt, {khung vẽ theo chỗ đặt, box = cạnh ô so với cạnh ngắn của khung}]
      opts: [
        ['mid', 'Vừa', 'phi', { guide: 'phi', box: 0.45, tip: 'Vật chiếm khoảng nửa khung, chừa khoảng thở đều quanh vật. Nền càng gọn càng tốt.' }],
        ['fill', 'Lấp đầy', 'center', { guide: 'center', box: 0.85, tip: 'Tiến sát cho vật gần kín khung, cắt bớt mép vật cũng được. Hợp chi tiết, hoa văn, món ăn cận.' }],
        ['min', 'Tối giản', 'thirds', { guide: 'thirds', box: 0.2, tip: 'Vật nhỏ, nền trơn (trời, tường, mặt bàn) chiếm phần lớn khung — khoảng trống làm vật nổi bật.' }],
      ],
      target: (R, o, p) => o[2] === 'center' ? { x: R.x + R.w / 2, y: R.y + R.h / 2 }
        : nearest(p, o[2] === 'phi' ? PHI_PTS(R) : [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]].map(([u, v]) => [R.x + R.w * u, R.y + R.h * v])) },
    { id: 'wide', name: 'Cảnh rộng', guide: 'spiral', ratio: [2, 3], dir: true,
      place: 'Chạm lên ĐIỂM NHẤN nhỏ trong cảnh (một người, con thuyền, cái cây đơn độc)',
      tip: 'Điểm nhấn nằm ở tâm xoắn, phần còn lại của cảnh dẫn mắt về đó. Chủ thể đang đi về phía nào thì chọn hướng bên dưới để chừa khoảng trống phía trước. Có tiền cảnh (đá, cành cây) ở góc dưới thì ảnh sâu hơn.',
      target: (R) => { const e = spiralMap(R, st.variant)(SPIRAL.eye); return { x: e[0], y: e[1] }; } },
    { id: 'lead', name: 'Đường dẫn', guide: 'thirds', ratio: [2, 3],
      place: 'Chạm vào ĐIỂM CUỐI của đường — chỗ con đường, ray tàu, bờ sông mất hút',
      tip: 'Đường đi vào từ mép dưới và kéo mắt người xem tới điểm cuối nằm ở 1/3 phía trên. Đường cong chữ S hấp dẫn hơn đường thẳng; có người hay vật ở cuối đường thì càng tốt.',
      target: (R, o, p) => nearest(p, [[R.x + R.w / 3, R.y + R.h / 3], [R.x + R.w * 2 / 3, R.y + R.h / 3]]) },
  ];
  // chủ thể nhìn/đi sang trái thì đặt nó lệch phải để chừa khoảng trống phía trước, và ngược lại
  function facing(R, pts) {
    const d = st.assist && st.assist.dir, mid = R.x + R.w / 2;
    return d ? pts.filter((q) => (d === 'L' ? q[0] > mid : q[0] < mid)) : pts;
  }
  const PHI_PTS = (R) => { const a = 1 - 1 / PHI, b = 1 / PHI; return [[a, a], [b, a], [a, b], [b, b]].map(([u, v]) => [R.x + R.w * u, R.y + R.h * v]); };
  function nearest(p, pts) {
    let best = pts[0], bd = Infinity;
    pts.forEach((q) => { const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2; if (d < bd) { bd = d; best = q; } });
    return { x: best[0], y: best[1] };
  }

  const st = {
    guide: 'thirds', variant: 0, ratio: RATIOS[0], landscape: false,
    facing: 'environment', stream: null, track: null, timer: 0, busy: false,
    level: false, roll: null, pitch: null, full: false, assist: null,
  };
  window.KN = { st, crop: () => cropRect() }; // móc cho tests/

  const stage = $('stage'), video = $('video'), ov = $('overlay'), octx = ov.getContext('2d');

  // Chống kẹt phóng to: iPhone bỏ qua user-scalable=no nên chặn cử chỉ chụm (gesturestart, chỉ Safari có)
  // khi trang chưa phóng to. Đã lỡ phóng to thì thả cho chụm thu nhỏ — kể cả trên khung ngắm đang kéo chấm.
  const zoomed = () => !!window.visualViewport && visualViewport.scale > 1.02;
  document.addEventListener('gesturestart', (e) => { if (!zoomed()) e.preventDefault(); }, { passive: false });
  function syncTouch() { stage.style.touchAction = st.assist && !zoomed() ? 'none' : ''; }
  if (window.visualViewport) visualViewport.addEventListener('resize', () => {
    const z = zoomed(); syncTouch();
    if (z && !syncTouch.warned) toast('Màn hình đang bị phóng to — chụm hai ngón lại để thu nhỏ');
    syncTouch.warned = z;
  });

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
    t.textContent = g.tip; t.classList.toggle('hide', !g.tip || !!st.assist);
    clearTimeout(tipTimer); tipTimer = setTimeout(() => t.classList.add('hide'), 9000);
  }
  $('tip').onclick = () => $('tip').classList.add('hide');

  // ---------- Hình học khung ----------
  const isLand = () => innerWidth > innerHeight;
  // điện thoại cầm ngang: CSS chuyển nút chụp sang cột phải, hàng chip nổi đè lên ảnh (khớp media query trong index.html)
  const landMQ = matchMedia('(orientation: landscape) and (max-height: 560px)');
  // Thanh nổi đè lên ảnh (toàn màn hình hoặc cầm ngang): khung có tỉ lệ thì né các thanh đó
  function insets() {
    const cam = $('cam'), top = cam.querySelector('.topbar').offsetHeight;
    if (landMQ.matches) { const pro = $('pro'); return [top, $('ratios').offsetHeight + 12 + (pro.hidden ? 0 : pro.offsetHeight + 6)]; }
    if (!st.full) return [0, 0];
    return [top, cam.querySelector('.controls').offsetHeight];
  }
  // Xoay máy: khung đổi chiều theo; đang ở bước căn khung thì toạ độ cũ hết đúng → làm lại từ bước chỉ chủ thể
  let lastLand = isLand();
  function onResize() {
    const land = isLand();
    if (land !== lastLand) {
      lastLand = land; st.landscape = land; renderRatioChips();
      if (st.assist) startAssist(st.assist.s);
    }
    draw();
  }
  function cropRect() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!st.ratio) return { x: 0, y: 0, w: W, h: H };
    const [top, bot] = insets(), AH = H - top - bot;
    const [a, b] = st.landscape ? [st.ratio[1], st.ratio[0]] : st.ratio;
    const pad = 10, r = a / b;
    let w = W - pad * 2, h = w / r;
    if (h > AH - pad * 2) { h = AH - pad * 2; w = h * r; }
    return { x: (W - w) / 2, y: top + (AH - h) / 2, w, h };
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
  function spiralMap(R, variant) {
    const portrait = R.h > R.w, fx = variant & 1, fy = (variant >> 1) & 1;
    return ([u, v]) => {
      let nu = u / PHI, nv = v; // 0..1
      if (fx) nu = 1 - nu; if (fy) nv = 1 - nv;
      return portrait ? [R.x + R.w * nv, R.y + R.h * nu] : [R.x + R.w * nu, R.y + R.h * nv];
    };
  }

  function drawGuide(ctx, R, guide, variant) {
    const X = (f) => R.x + R.w * f, Y = (f) => R.y + R.h * f;
    if (guide === 'thirds' || guide === 'phi') {
      const a = guide === 'thirds' ? 1 / 3 : 1 - 1 / PHI, b = 1 - a;
      [a, b].forEach((f) => { line(ctx, [[X(f), R.y], [X(f), R.y + R.h]]); line(ctx, [[R.x, Y(f)], [R.x + R.w, Y(f)]]); });
      [a, b].forEach((fx) => [a, b].forEach((fy) => dot(ctx, X(fx), Y(fy))));
    } else if (guide === 'spiral') {
      const map = spiralMap(R, variant);
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
    drawAssist(octx, R);
    const [top, bot] = insets(), cam = $('cam');
    cam.style.setProperty('--insT', top + 'px'); cam.style.setProperty('--insB', bot + 'px');
    const lv = $('level');
    lv.style.left = (R.x + R.w * 0.27) + 'px'; lv.style.top = (R.y + R.h / 2) + 'px'; lv.style.width = (R.w * 0.46) + 'px';
  }
  new ResizeObserver(onResize).observe(stage);

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
    lp = lp ? [lp[0] * 0.8 + sx * 0.2, lp[1] * 0.8 + sy * 0.2, lp[2] * 0.8 + (g.z || 0) * 0.2] : [sx, sy, g.z || 0];
    const inPlane = Math.hypot(lp[0], lp[1]);
    st.roll = inPlane > 5 ? Math.atan2(lp[0], lp[1]) * 180 / Math.PI : null;
    // góc ngửa/chúc máy — dấu z cũng ngược giữa iOS và Android nên chỉ dùng độ lớn
    st.pitch = inPlane > 5 ? Math.atan2(lp[2], inPlane) * 180 / Math.PI : null;
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
  $('levelBtn').onclick = () => {
    if (st.level) { st.level = false; $('levelTxt').textContent = 'Cân bằng'; return; }
    enableLevel();
  };
  // phải gọi ngay trong cú chạm: iOS chỉ hỏi quyền cảm biến khi có thao tác của người dùng
  async function enableLevel(quiet) {
    if (st.level) return;
    try {
      if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted') { toast('Chưa được phép đọc cảm biến nghiêng'); return; }
      }
    } catch (e) { toast('Không xin được quyền cảm biến'); return; }
    window.addEventListener('devicemotion', onMotion);
    st.level = true; $('levelTxt').textContent = 'Đang bật';
    if (!quiet) setTimeout(() => { if (st.level && st.roll == null) toast('Máy này không có cảm biến nghiêng (hoặc đang để nằm phẳng)'); }, 1500);
  }

  // ---------- Toàn màn hình ----------
  $('fullBtn').onclick = () => {
    st.full = !st.full; $('cam').classList.toggle('full', st.full);
    const de = document.documentElement;
    if (st.full && document.fullscreenEnabled && de.requestFullscreen) de.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else if (!st.full && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // iPhone không cho web ẩn thanh địa chỉ; chỉ mở từ Màn hình chính mới chiếm trọn màn
    else if (st.full && !navigator.standalone && /iPhone|iPod/.test(navigator.userAgent)) toast('Muốn ẩn cả thanh địa chỉ: Chia sẻ → Thêm vào MH chính, rồi mở từ biểu tượng đó');
    requestAnimationFrame(draw);
  };

  // ---------- "Chụp gì?": đặt chủ thể → app chỉ chỗ → bám theo chủ thể ----------
  function renderSceneChips() {
    const box = $('scenes'); box.innerHTML = '';
    SCENES.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'chip scene' + (st.assist && st.assist.s === s ? ' on' : '');
      b.textContent = s.name;
      b.onclick = () => (st.assist && st.assist.s === s ? exitAssist() : startAssist(s));
      box.appendChild(b);
    });
  }
  function startAssist(s) {
    if (s.level) enableLevel(true);
    st.guide = s.guide; st.variant = 0;
    setRatio((s.opts && s.opts[0][3] && s.opts[0][3].ratio) || s.ratio);
    st.landscape = isLand(); // khung theo chiều máy đang cầm, mọi loại cảnh
    const R = cropRect();
    st.assist = { s, phase: 'place', opt: s.opts ? s.opts[0] : null, dir: null, pts: [], ok: false, lost: false };
    setSubject(R.x + R.w / 2, R.y + R.h / 2);
    syncTouch();
    renderGuideChips(); renderRatioChips(); renderSceneChips(); showTip(); renderAssistOpts(); updateAssist(); draw();
  }
  function setRatio(r) { st.ratio = RATIOS.find((x) => x && x[0] === r[0] && x[1] === r[1]); }
  function exitAssist() {
    st.assist = null; syncTouch();
    $('assist').hidden = true; renderSceneChips(); draw();
  }
  $('asClose').onclick = exitAssist;
  function renderAssistOpts() {
    const a = st.assist, box = $('asOpts'); box.innerHTML = '';
    (a.s.opts || []).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'chip' + (a.opt === o ? ' on' : ''); b.textContent = o[1];
      b.onclick = () => {
        a.opt = o;
        if (o[3] && o[3].ratio) { setRatio(o[3].ratio); renderRatioChips(); }
        // vòng đích phải nằm trên điểm của khung đang vẽ
        if (o[3] && o[3].guide) { st.guide = o[3].guide; st.variant = 0; renderGuideChips(); }
        renderAssistOpts(); updateAssist(); draw();
      };
      box.appendChild(b);
    });
    // hướng nhìn/đi chỉ chọn ở bước 1 — thêm hàng ở bước 2 thì bảng cao lên, che vòng đích
    const dbox = $('asDir'); dbox.innerHTML = '';
    if (a.s.dir && a.phase === 'place') [['L', '← Nhìn/đi sang trái'], ['R', 'Nhìn/đi sang phải →']].forEach(([d, t]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (a.dir === d ? ' on' : ''); b.textContent = t;
      b.onclick = () => { a.dir = a.dir === d ? null : d; renderAssistOpts(); };
      dbox.appendChild(b);
    });
  }
  function setSubject(x, y) {
    const a = st.assist, R = cropRect();
    // chân trời: bám 2 điểm trên vạch để đường vẫn bám được khi một đầu là trời trơn
    a.pts = a.s.line ? [{ x: R.x + R.w * 0.3, y }, { x: R.x + R.w * 0.7, y }] : [{ x, y }];
    a.lost = false;
  }
  function subjectPoint(a) {
    const live = a.pts.filter((p) => !p.lost), ps = live.length ? live : a.pts;
    return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
  }
  function lockOn() {
    const a = st.assist, f = grab();
    a.pts.forEach((p) => (p.tpl = f ? patchAt(f, p) : null));
    a.lowTex = a.pts.every((p) => !p.tpl || p.tpl.std < 7);
    if (a.s.id === 'wide') {
      // chọn hướng xoắn có tâm gần chủ thể nhất — ít phải lia máy nhất
      const R = cropRect(), p = subjectPoint(a); let bd = Infinity;
      for (let v = 0; v < 4; v++) {
        const e = spiralMap(R, v)(SPIRAL.eye), d = (e[0] - p.x) ** 2 + (e[1] - p.y) ** 2;
        if (d < bd && facing(R, [e]).length) { bd = d; st.variant = v; }
      }
    }
    a.phase = 'guide'; renderAssistOpts(); updateAssist(); draw();
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function updateAssist() {
    const a = st.assist; if (!a) return;
    const box = $('assist'); box.hidden = false;
    const R = cropRect();
    let msg, ok = false;
    if (a.phase === 'place') msg = a.s.place;
    else {
      const p = subjectPoint(a), t = a.s.target(R, a.opt, p); a.t = t; a.p = p;
      const tol = Math.max(14, Math.min(R.w, R.h) * 0.045);
      const dx = t.x == null ? 0 : t.x - p.x, dy = t.y == null ? 0 : t.y - p.y;
      ok = !a.lost && Math.abs(dx) < tol && Math.abs(dy) < tol;
      if (a.lost) msg = 'Mất dấu chủ thể — chạm lại vào chủ thể để bám tiếp';
      // đúng chỗ rồi mới nhắc canh cỡ — nói cùng lúc thì bảng dài thêm dòng, che mất vòng đích
      else if (ok) msg = a.s.fit ? 'Đúng chỗ rồi — ' + a.s.fit + ', rồi bấm chụp' : 'Chuẩn rồi — giữ yên máy và bấm chụp!';
      else if (video.classList.contains('mirror')) msg = 'Dịch máy để chấm đi theo mũi tên vào vòng vàng';
      else {
        // chủ thể cần sang phải trong khung thì máy phải lia sang trái, và ngược lại
        const parts = [];
        if (Math.abs(dx) >= tol) parts.push(dx > 0 ? 'lia máy sang trái' : 'lia máy sang phải');
        if (Math.abs(dy) >= tol) parts.push(dy > 0 ? 'ngửa máy lên' : 'chúc máy xuống');
        const goal = a.s.line ? 'vạch trắng trùng vạch vàng' : a.t.y == null ? 'chấm chạm vạch vàng' : 'chấm vào vòng vàng';
        msg = cap(parts.join(', ')) + ' cho tới khi ' + goal;
      }
      if (a.lowTex && !a.lost) msg += ' · Chỗ vừa chọn hơi trơn, app khó bám — chạm vào chỗ có chi tiết rõ hơn';
      if (a.s.id === 'arch' && st.pitch != null && Math.abs(st.pitch) > 4) msg += ` · Máy đang ngửa/chúc ${Math.abs(st.pitch).toFixed(0)}° — giữ thẳng đứng để cột không chụm vào nhau`;
    }
    if (ok && !a.ok && navigator.vibrate) navigator.vibrate(15);
    a.ok = ok;
    box.classList.toggle('ok', ok);
    const step = a.phase === 'place' ? 'Bước 1/2 · Chỉ chủ thể' : 'Bước 2/2 · Căn khung';
    if ($('asTitle').textContent !== a.s.name) $('asTitle').textContent = a.s.name;
    if ($('asStep').textContent !== step) $('asStep').textContent = step;
    if ($('asMsg').textContent !== msg) $('asMsg').textContent = msg;
    // mẹo chỉ hiện ở bước 1 — bước 2 thu gọn để không che mục tiêu ở 1/3 phía trên
    const tip = a.phase === 'place' ? [a.s.tip, a.opt && a.opt[3] && a.opt[3].tip].filter(Boolean).join('\n') : '';
    if ($('asTip').textContent !== tip) $('asTip').textContent = tip;
  }
  function arrow(ctx, x1, y1, x2, y2, col) {
    const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1), back = Math.min(26, L * 0.5);
    const ex = x2 - Math.cos(ang) * back * 0.9, ey = y2 - Math.sin(ang) * back * 0.9;
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1 + Math.cos(ang) * 18, y1 + Math.sin(ang) * 18); ctx.lineTo(ex, ey);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang - 0.5) * 12, ey - Math.sin(ang - 0.5) * 12); ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang + 0.5) * 12, ey - Math.sin(ang + 0.5) * 12); ctx.stroke();
    ctx.restore();
  }
  // Viền người dáng đứng, nửa phải, đơn vị = chiều cao đầu, gốc ở giữa hai mắt. Người cao ~7,5 đầu.
  const BODY = [[0.18, 0.48], [0.2, 0.75], [0.75, 0.9], [1, 1.15], [1.08, 1.6], [1.12, 2.6], [1.1, 3.8], [1.05, 4.1], [0.88, 4.1],
    [0.86, 3.7], [0.86, 2.6], [0.78, 1.75], [0.72, 2.6], [0.68, 3.1], [0.82, 3.9], [0.72, 5.2], [0.6, 6.6], [0.62, 7], [0.18, 7],
    [0.2, 6.6], [0.16, 5.2], [0.05, 4.1], [0, 4.05]];
  // nét đứt đôi (viền tối + nét trắng mờ), cắt theo khung để thấy rõ mép ảnh cắt người ở đâu
  function drawFit(ctx, R, a) {
    const t = a.t, o = a.opt && a.opt[3];
    if (!t || t.x == null || t.y == null || !(o && (o.body || o.box))) return;
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip(); ctx.beginPath();
    if (o && o.body) {
      const h = o.body * R.h, X = (u) => t.x + u * h, Y = (v) => t.y + v * h;
      ctx.ellipse(t.x, Y(-0.03), 0.38 * h, 0.53 * h, 0, 0, Math.PI * 2);
      ctx.moveTo(X(BODY[0][0]), Y(BODY[0][1]));
      BODY.forEach(([u, v]) => ctx.lineTo(X(u), Y(v)));
      BODY.slice().reverse().forEach(([u, v]) => ctx.lineTo(X(-u), Y(v)));
    } else {
      const d = o.box * Math.min(R.w, R.h);
      ctx.roundRect(t.x - d / 2, t.y - d / 2, d, d, d * 0.08);
    }
    ctx.lineJoin = 'round'; ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  function drawAssist(ctx, R) {
    const a = st.assist; if (!a) return;
    const col = a.ok ? '#6fd08c' : '#e9b44c', p = subjectPoint(a);
    ctx.save();
    if (a.phase === 'guide' && a.t) {
      const t = a.t;
      drawFit(ctx, R, a);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = col; ctx.lineWidth = 2;
      if (t.x == null) { ctx.beginPath(); ctx.moveTo(R.x, t.y); ctx.lineTo(R.x + R.w, t.y); ctx.stroke(); }
      else if (t.y == null) { ctx.beginPath(); ctx.moveTo(t.x, R.y); ctx.lineTo(t.x, R.y + R.h); ctx.stroke(); }
      ctx.setLineDash([]);
      if (t.x != null && t.y != null) {
        ctx.beginPath(); ctx.arc(t.x, t.y, 24, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      }
      if (!a.ok && !a.lost) arrow(ctx, p.x, p.y, t.x == null ? p.x : t.x, t.y == null ? p.y : t.y, col);
    }
    ctx.globalAlpha = a.lost ? 0.45 : 1;
    if (a.s.line) {
      ctx.beginPath(); ctx.moveTo(R.x, p.y); ctx.lineTo(R.x + R.w, p.y);
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }
  // kéo/chạm trên khung ngắm để chỉ chủ thể
  let dragging = false;
  const stagePt = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('pointerdown', (e) => {
    if (!st.assist || e.target.closest('.assist')) return;
    e.preventDefault(); dragging = true;
    try { stage.setPointerCapture(e.pointerId); } catch (er) { /* pointer giả trong test */ }
    setSubject(...stagePt(e)); updateAssist(); draw();
  });
  stage.addEventListener('pointermove', (e) => { if (dragging && st.assist) { setSubject(...stagePt(e)); draw(); } });
  ['pointerup', 'pointercancel'].forEach((ev) => stage.addEventListener(ev, () => { if (dragging && st.assist) { dragging = false; lockOn(); } }));

  // Bám chủ thể: so khớp mảng 17×17 điểm ảnh (trừ độ sáng trung bình) trên khung hình thu nhỏ 160px
  const TW = 160, PR = 8, PN = PR * 2 + 1;
  const tcv = document.createElement('canvas'), tctx = tcv.getContext('2d', { willReadFrequently: true });
  function grab() {
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
    const W = stage.clientWidth, H = stage.clientHeight, k = TW / W, h = Math.max(1, Math.round(H * k));
    const sc = Math.max(W / vw, H / vh), sw = W / sc, sh = H / sc;
    tcv.width = TW; tcv.height = h;
    if (video.classList.contains('mirror')) { tctx.translate(TW, 0); tctx.scale(-1, 1); }
    tctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, TW, h);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = tctx.getImageData(0, 0, TW, h).data, g = new Float32Array(TW * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return { g, w: TW, h, k };
  }
  function patchMean(f, x0, y0) {
    let s = 0;
    for (let j = 0; j < PN; j++) { const row = (y0 + j) * f.w + x0; for (let i = 0; i < PN; i++) s += f.g[row + i]; }
    return s / (PN * PN);
  }
  function patchAt(f, p) {
    const x0 = Math.round(p.x * f.k) - PR, y0 = Math.round(p.y * f.k) - PR;
    if (x0 < 0 || y0 < 0 || x0 + PN > f.w || y0 + PN > f.h) return null;
    const m = patchMean(f, x0, y0), t = new Float32Array(PN * PN); let s2 = 0;
    for (let j = 0; j < PN; j++) for (let i = 0; i < PN; i++) { const v = f.g[(y0 + j) * f.w + x0 + i] - m; t[j * PN + i] = v; s2 += v * v; }
    t.std = Math.sqrt(s2 / (PN * PN));
    return t;
  }
  function trackPoint(f, p) {
    const cx = Math.round(p.x * f.k), cy = Math.round(p.y * f.k), SR = p.lost ? 20 : 12;
    let best = Infinity, bx = cx, by = cy;
    for (let dy = -SR; dy <= SR; dy++) for (let dx = -SR; dx <= SR; dx++) {
      const x0 = cx + dx - PR, y0 = cy + dy - PR;
      if (x0 < 0 || y0 < 0 || x0 + PN > f.w || y0 + PN > f.h) continue;
      const m = patchMean(f, x0, y0); let s = 0;
      for (let j = 0; j < PN && s < best; j++) {
        const row = (y0 + j) * f.w + x0, tr = j * PN;
        for (let i = 0; i < PN; i++) s += Math.abs(f.g[row + i] - m - p.tpl[tr + i]);
      }
      if (s < best) { best = s; bx = cx + dx; by = cy + dy; }
    }
    const err = best / (PN * PN);
    if (err > 22) { p.lost = true; return; }
    p.lost = false; p.x = bx / f.k; p.y = by / f.k;
    if (err < 10) { const nt = patchAt(f, p); if (nt) for (let i = 0; i < nt.length; i++) p.tpl[i] = p.tpl[i] * 0.85 + nt[i] * 0.15; }
  }
  setInterval(() => {
    const a = st.assist;
    if (!a || a.phase !== 'guide' || dragging || !$('cam').classList.contains('on') || !video.videoWidth || document.hidden) return;
    const f = grab(); if (!f) return;
    const tracked = a.pts.filter((p) => p.tpl);
    tracked.forEach((p) => trackPoint(f, p));
    a.lost = tracked.length > 0 && tracked.every((p) => p.lost);
    updateAssist(); draw();
  }, 90);

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
    ed.full = canvas; ed.shot = (ed.shot || 0) + 1; ready = null; // ảnh mới: bỏ ảnh đã xuất sẵn của tấm trước
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
    if (canShareFiles && (!ready || ready.sig !== shareSig())) $('share').textContent = SHARE_TXT;
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
  // Điện thoại/máy tính bảng: nút chính là bảng chia sẻ (có mục "Lưu hình ảnh" vào thư viện Ảnh).
  // Nhận theo màn cảm ứng, không theo userAgent: iPad đời mới tự xưng là "Macintosh".
  let canShareFiles = false;
  try {
    const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' });
    canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [probe] }) && navigator.maxTouchPoints > 0);
  } catch (e) { /* trình duyệt không hỗ trợ chia sẻ file */ }
  if (canShareFiles) {
    $('share').hidden = false;
    $('dl').className = 'secondary'; $('dl').textContent = 'Tải file';
  }
  // Safari chỉ mở bảng chia sẻ ngay sau cú chạm; xuất ảnh lớn mất 1–2 giây có thể làm mất "cú chạm" đó.
  // Bị chặn thì giữ ảnh đã xuất và mời bấm lại — lần hai mở ngay, không phải chờ.
  let ready = null;
  // phải có ed.shot: thiếu nó thì tấm mới cùng gam màu + cùng cỡ bị coi là tấm cũ và lưu nhầm ảnh cũ
  const shareSig = () => JSON.stringify([ed.shot, ed.preset, ed.amount, ed.adj, $('withPal').checked]);
  const SHARE_TXT = 'Lưu vào Ảnh';
  $('share').onclick = async () => {
    const btn = $('share');
    if (!ready || ready.sig !== shareSig()) {
      btn.disabled = true; btn.textContent = 'Đang xuất…';
      await new Promise((r) => setTimeout(r, 30));
      try { ready = { sig: shareSig(), blob: await exportBlob() }; }
      catch (e) { toast('Lỗi khi xuất ảnh: ' + (e.message || e)); btn.disabled = false; btn.textContent = SHARE_TXT; return; }
      btn.disabled = false;
    }
    try {
      await navigator.share({ files: [new File([ready.blob], fileName(), { type: 'image/jpeg' })] });
      btn.textContent = SHARE_TXT;
    } catch (e) {
      if (e.name === 'NotAllowedError') { btn.textContent = 'Ảnh đã sẵn sàng — chạm lần nữa'; return; }
      btn.textContent = SHARE_TXT;
      if (e.name !== 'AbortError') toast('Không mở được bảng chia sẻ: ' + (e.message || e.name));
    }
  };

  // ---------- Khởi động ----------
  st.landscape = isLand();
  renderSceneChips(); renderGuideChips(); renderRatioChips(); showTip(); draw();
  startCamera();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (st.stream && st.track && st.track.readyState === 'ended') startCamera();
  });
})();
