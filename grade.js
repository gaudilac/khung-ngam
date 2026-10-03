// grade.js — phân tích ảnh, bộ chỉnh màu (preset kiểu film), trích bảng màu.
// Không phụ thuộc DOM ngoài ImageData, để có thể dùng cho cả preview lẫn xuất ảnh gốc.
(function (global) {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (a, b, t) => a + (b - a) * t;

  function hueRgb(h) {
    // HSL(h, 100%, 50%) -> [r,g,b] 0..1
    h = ((h % 360) + 360) % 360 / 60;
    const x = 1 - Math.abs((h % 2) - 1);
    const t = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]];
    return t[Math.floor(h) % 6];
  }

  function rgbToHsl(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }

  // ---------- Preset: tên, khi nào dùng, tham số ----------
  // splitS / splitH: [hue, độ mạnh] tô màu vùng tối / vùng sáng (giữ nguyên độ sáng).
  // to: tách cam–xanh ngọc; greenDesat: dập bớt màu lá; bw: hệ số trộn kênh đen trắng.
  const PRESETS = [
    { id: 'orig', name: 'Gốc', note: 'Ảnh chưa chỉnh', p: {} },
    { id: 'auto', name: 'Tự cân', note: 'Cân lại điểm đen–trắng và ám màu theo chính ảnh này', p: null },
    { id: 'portra', name: 'Portra', note: 'Kodak Portra 400 — da hồng hào, sáng mềm. Chân dung, nắng chiều',
      p: { temp: 0.16, tint: -0.03, contrast: -0.12, fade: 0.04, lift: [0.02, 0.012, 0], sat: -0.05, vib: 0.12,
           splitH: [38, 0.10], splitS: [195, 0.05], greenDesat: 0.18, hiRoll: 0.6 } },
    { id: 'chrome', name: 'Classic Chrome', note: 'Fuji — màu trầm, bóng đổ đậm. Ảnh đường phố, đời thường',
      p: { contrast: 0.22, sat: -0.3, splitS: [200, 0.12], splitH: [45, 0.06], greenDesat: 0.35, fade: 0.03, temp: -0.03, hiRoll: 0.4 } },
    { id: 'cine', name: 'Điện ảnh', note: 'Teal & Orange — da cam ấm trên nền xanh ngọc. Cảnh có người + trời/nước',
      p: { to: 0.7, contrast: 0.16, splitS: [188, 0.16], splitH: [32, 0.10], sat: -0.05, vig: 0.25, fade: 0.03, hiRoll: 0.5 } },
    { id: 'golden', name: 'Giờ vàng', note: 'Đẩy ánh nắng cuối ngày, bóng hơi tím hồng',
      p: { temp: 0.32, tint: 0.05, splitS: [320, 0.08], splitH: [36, 0.14], vib: 0.25, contrast: 0.08, vig: 0.2, hiRoll: 0.5 } },
    { id: 'velvia', name: 'Velvia', note: 'Fuji Velvia — màu rực, sâu. Phong cảnh trời, biển, rừng',
      p: { sat: 0.32, vib: 0.2, contrast: 0.25, splitS: [220, 0.04], ev: -0.05, hiRoll: 0.5 } },
    { id: 'nordic', name: 'Bắc Âu', note: 'Lạnh, nhạt, sáng — tối giản, kiến trúc, trời u ám',
      p: { temp: -0.2, sat: -0.35, ev: 0.15, contrast: -0.05, fade: 0.03, splitS: [205, 0.12], greenDesat: 0.4, hiRoll: 0.7 } },
    { id: 'pastel', name: 'Pastel', note: 'Sáng, trong, phấn hồng nhẹ — chân dung, đồ vật, quán cà phê',
      p: { ev: 0.25, contrast: -0.3, fade: 0.06, sat: -0.25, splitH: [330, 0.08], splitS: [190, 0.08], hiRoll: 0.9, temp: 0.02 } },
    { id: 'moody', name: 'Trầm', note: 'Tối, lạnh, ít màu — mưa, sương, không khí tĩnh lặng',
      p: { ev: -0.35, contrast: 0.1, sat: -0.3, greenDesat: 0.5, fade: 0.08, splitS: [212, 0.15], splitH: [35, 0.05], vig: 0.35, temp: -0.08 } },
    { id: 'matte', name: 'Matte', note: 'Đen bị nâng thành xám, hạt nhẹ — chất film cũ, dịu tương phản gắt',
      p: { fade: 0.12, contrast: -0.2, sat: -0.15, temp: 0.06, splitS: [180, 0.05], grain: 0.25 } },
    { id: 'vintage', name: 'Hoài cổ', note: 'Vàng ngả, bóng xanh rêu — ảnh thập niên 70',
      p: { temp: 0.15, tint: -0.06, fade: 0.1, splitS: [150, 0.1], splitH: [50, 0.15], sat: -0.1, contrast: -0.05, vig: 0.3, grain: 0.3 } },
    { id: 'bwhard', name: 'Đen trắng gắt', note: 'Như kính lọc đỏ: trời sẫm, hình khối nổi. Kiến trúc, đường phố',
      p: { bw: [0.55, 0.38, 0.07], contrast: 0.45, grain: 0.2, vig: 0.2 } },
    { id: 'bwsoft', name: 'Đen trắng mềm', note: 'Xám mịn, ngả ấm nhẹ như giấy in — chân dung cổ điển',
      p: { bw: [0.3, 0.59, 0.11], contrast: -0.05, fade: 0.06, splitS: [220, 0.05], splitH: [40, 0.08], grain: 0.15 } },
  ];

  // ---------- Phân tích ảnh (dùng ImageData đã thu nhỏ) ----------
  function analyze(img) {
    const d = img.data, n = d.length / 4;
    const hist = new Uint32Array(256);
    let sL = 0, sL2 = 0, sS = 0, sr = 0, sg = 0, sb = 0;
    let warm = 0, cool = 0, skin = 0, green = 0, blue = 0, dark = 0, bright = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      const r = R / 255, g = G / 255, b = B / 255;
      const L = lum(r, g, b);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx - mn;
      hist[Math.round(L * 255)]++;
      sL += L; sL2 += L * L; sS += s; sr += r; sg += g; sb += b;
      if (r - b > 0.08) warm++;
      if (b - r > 0.05) cool++;
      if (R > 95 && G > 40 && B > 20 && R > G && R > B && R - Math.min(G, B) > 15 && Math.abs(R - G) > 15 && R - B < 150) skin++;
      if (s > 0.12 && g >= r && g >= b) green++;
      if (s > 0.12 && b >= r && b >= g) blue++;
      if (L < 0.15) dark++;
      if (L > 0.85) bright++;
    }
    const pct = (q) => { let acc = 0, t = q * n; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= t) return i / 255; } return 1; };
    const meanL = sL / n;
    return {
      meanL, stdL: Math.sqrt(Math.max(0, sL2 / n - meanL * meanL)), meanSat: sS / n,
      avg: [sr / n, sg / n, sb / n],
      warm: warm / n, cool: cool / n, skin: skin / n, green: green / n, blue: blue / n,
      dark: dark / n, bright: bright / n, lo: pct(0.005), hi: pct(0.995),
    };
  }

  function autoParams(a) {
    const lo = Math.min(a.lo, 0.12), hi = Math.max(a.hi, 0.8);
    const g = (a.avg[0] + a.avg[1] + a.avg[2]) / 3 || 0.5;
    // gray-world, chỉ dùng 45% để không giết mất ánh nắng có chủ đích
    const wb = a.avg.map((c) => clamp(mix(1, g / (c || g), 0.45), 0.85, 1.18));
    return { levels: [lo, hi], wb, contrast: 0.08, vib: 0.22, hiRoll: 0.3 };
  }

  // Chấm điểm preset theo nội dung ảnh, trả về top gợi ý kèm lý do
  function suggest(a) {
    const sc = {
      auto: [0.35 + (a.hi - a.lo < 0.75 ? 0.35 : 0) + (Math.max(...a.avg) - Math.min(...a.avg) > 0.08 ? 0.2 : 0),
        'Ảnh hơi đục hoặc ám màu — cân lại điểm đen, điểm trắng'],
      portra: [a.skin * 4 + a.warm * 0.4, 'Có tông da người — Portra giữ da hồng hào, mềm mại'],
      pastel: [a.skin * 1.5 + (a.meanL > 0.55 ? 0.4 : 0) + (a.meanSat < 0.3 ? 0.15 : 0), 'Ảnh sáng và nhẹ — hợp tông pastel trong trẻo'],
      cine: [Math.min(a.warm, a.cool) * 3.5, 'Có cả vùng ấm lẫn vùng lạnh — tách cam / xanh ngọc kiểu điện ảnh'],
      golden: [a.warm * 1.2 + (a.meanL > 0.3 && a.meanL < 0.7 ? 0.1 : 0), 'Nhiều ánh vàng ấm — đẩy thành giờ vàng'],
      velvia: [(a.green + a.blue) * 1.5 + (a.skin < 0.05 ? 0.15 : 0), 'Có trời, nước hoặc cây — Velvia cho màu rực và sâu'],
      nordic: [a.blue * 1.0 + (a.meanL > 0.5 ? 0.2 : 0) + (a.meanSat < 0.25 ? 0.2 : 0), 'Trời xanh, ánh sáng dịu — tông lạnh tối giản'],
      chrome: [(a.meanSat > 0.12 && a.meanSat < 0.35 ? 0.3 : 0) + a.stdL + (a.skin < 0.1 ? 0.1 : 0), 'Cảnh đời thường, khối sáng tối rõ — chất ảnh đường phố'],
      moody: [(a.meanL < 0.35 ? 0.6 : 0) + a.dark * 0.8 + a.green * 0.3, 'Ảnh trầm, nhiều vùng tối — giữ không khí tĩnh lặng'],
      bwhard: [a.stdL * 2 + (a.meanSat < 0.15 ? 0.5 : 0), 'Sáng tối tương phản mạnh, ít màu — đen trắng làm nổi hình khối'],
      bwsoft: [(a.meanSat < 0.15 ? 0.4 : 0) + a.skin * 1.2, 'Chân dung đen trắng mềm, cổ điển'],
      matte: [0.2 + (a.stdL > 0.27 ? 0.25 : 0) + a.bright * 0.5, 'Tương phản hơi gắt — matte làm dịu, ra chất film'],
      vintage: [0.15 + a.warm * 0.3, 'Tông ấm — hợp màu hoài cổ'],
    };
    return Object.entries(sc).map(([id, [s, why]]) => ({ id, s, why })).sort((x, y) => y.s - x.s);
  }

  // ---------- Gộp tham số preset + chỉnh tay ----------
  function resolve(preset, adj, analysis) {
    const base = preset.id === 'auto' ? autoParams(analysis) : preset.p;
    const P = Object.assign({ ev: 0, temp: 0, tint: 0, contrast: 0, fade: 0, sat: 0, vib: 0, vig: 0, grain: 0, hiRoll: 0, to: 0, greenDesat: 0 }, base);
    P.ev += adj.ev * 1.5;
    P.temp += adj.temp * 0.5;
    P.tint += adj.tint * 0.5;
    P.contrast = clamp(P.contrast + adj.contrast * 0.6, -0.9, 0.9);
    P.sat = clamp(P.sat + adj.sat * 0.7, -1, 1.2);
    P.fade = clamp(P.fade + adj.fade * 0.2, 0, 0.35);
    P.vig = clamp(P.vig + adj.vig * 0.6, -0.5, 0.9);
    P.grain = clamp(P.grain + adj.grain * 0.6, 0, 1);
    if (P.ev > 0) P.hiRoll = Math.max(P.hiRoll, Math.min(1, P.ev * 1.5));
    return P;
  }

  function buildLut(P) {
    const wb = P.wb ? P.wb.slice() : [1, 1, 1];
    wb[0] *= 1 + 0.12 * P.temp + 0.04 * P.tint;
    wb[1] *= 1 - 0.07 * P.tint;
    wb[2] *= 1 - 0.12 * P.temp + 0.04 * P.tint;
    const lift = P.lift || [0, 0, 0], gain = P.gain || [1, 1, 1], gam = P.gamma || [1, 1, 1];
    const expo = Math.pow(2, P.ev);
    const lv = P.levels || [0, 1];
    const luts = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 256; i++) {
        let v = (i / 255 - lv[0]) / (lv[1] - lv[0]);
        v = v * expo * wb[c];
        if (P.hiRoll > 0 && v > 0.75) {
          const soft = 0.75 + 0.25 * (1 - Math.exp(-(v - 0.75) / 0.25));
          v = mix(Math.min(v, 1), soft, P.hiRoll);
        }
        v = clamp(v, 0, 1);
        v = gain[c] * (v + lift[c] * (1 - v));
        if (gam[c] !== 1) v = Math.pow(clamp(v, 0, 1), 1 / gam[c]);
        v = clamp(v, 0, 1);
        if (P.contrast > 0) {
          const s = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v);
          v = mix(v, s, P.contrast);
        } else if (P.contrast < 0) {
          v = v + (0.5 - v) * -P.contrast * 0.5;
        }
        v = P.fade + v * (1 - P.fade * 1.25);
        luts[c][i] = clamp(v, 0, 1);
      }
    }
    return luts;
  }

  function toneVec(hs) {
    if (!hs || !hs[1]) return null;
    const t = hueRgb(hs[0]), l = lum(t[0], t[1], t[2]);
    return [(t[0] - l) * hs[1], (t[1] - l) * hs[1], (t[2] - l) * hs[1]];
  }

  // src, dst: ImageData cùng kích thước. amount: 0..1 độ đậm của preset.
  function apply(src, dst, P, amount) {
    const W = src.width, H = src.height, s = src.data, o = dst.data;
    const [lr, lg, lb] = buildLut(P);
    const tS = toneVec(P.splitS), tH = toneVec(P.splitH);
    const satF = 1 + P.sat, vib = P.vib, to = P.to, gd = P.greenDesat, bw = P.bw;
    const vig = P.vig, grain = P.grain * 0.14;
    const ORA = [1.0, 0.58, 0.3], TEA = [0.05, 0.55, 0.6];
    const lO = lum(...ORA), lT = lum(...TEA);
    const dx2 = new Float32Array(W);
    for (let x = 0; x < W; x++) { const d = (x + 0.5) / W * 2 - 1; dx2[x] = d * d; }
    let seed = 0x9e3779b9;
    for (let y = 0; y < H; y++) {
      const dy = (y + 0.5) / H * 2 - 1, dy2 = dy * dy;
      let i = y * W * 4;
      for (let x = 0; x < W; x++, i += 4) {
        const R0 = s[i], G0 = s[i + 1], B0 = s[i + 2];
        let r = lr[R0], g = lg[G0], b = lb[B0];
        let L;
        if (gd) {
          const w = clamp((g - Math.max(r, b)) * 5, 0, 1) * gd;
          if (w > 0) { L = lum(r, g, b); r = mix(r, L, w * 0.6) + w * 0.03; g = mix(g, L, w * 0.6); b = mix(b, L, w * 0.6); }
        }
        if (to) {
          L = lum(r, g, b);
          const w = clamp((r - b) * 2.5, -1, 1);
          const T = w >= 0 ? ORA : TEA, k = (w >= 0 ? L / lO : L / lT), a = to * Math.abs(w) * 0.45;
          r = mix(r, Math.min(1, T[0] * k), a); g = mix(g, Math.min(1, T[1] * k), a); b = mix(b, Math.min(1, T[2] * k), a);
        }
        if (bw) { const v = bw[0] * r + bw[1] * g + bw[2] * b; r = g = b = v; }
        L = lum(r, g, b);
        if (satF !== 1 || vib) {
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const f = satF * (1 + vib * (1 - Math.min(1, sat * 2)));
          r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
        }
        if (tS) { const w = (1 - L) * (1 - L); r += tS[0] * w; g += tS[1] * w; b += tS[2] * w; }
        if (tH) { const w = L * L; r += tH[0] * w; g += tH[1] * w; b += tH[2] * w; }
        if (vig) {
          const d = (dx2[x] + dy2) * 0.5;
          const t = clamp((d - 0.12) / 0.88, 0, 1), f = 1 - vig * t * t * (3 - 2 * t);
          r *= f; g *= f; b *= f;
        }
        if (grain) {
          seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
          const nz = ((seed >>> 0) / 4294967296 - 0.5) * grain * (1 - Math.abs(2 * L - 1) * 0.6);
          r += nz; g += nz; b += nz;
        }
        r = clamp(r, 0, 1) * 255; g = clamp(g, 0, 1) * 255; b = clamp(b, 0, 1) * 255;
        o[i] = R0 + (r - R0) * amount;
        o[i + 1] = G0 + (g - G0) * amount;
        o[i + 2] = B0 + (b - B0) * amount;
        o[i + 3] = 255;
      }
    }
    return dst;
  }

  // ---------- Bảng màu: k-means có hạt giống cố định ----------
  function palette(img, k) {
    k = k || 5;
    const d = img.data, pts = [];
    for (let i = 0; i < d.length; i += 4) pts.push([d[i], d[i + 1], d[i + 2]]);
    if (!pts.length) return [];
    const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const C = [pts[Math.floor(rnd() * pts.length)].slice()];
    while (C.length < k) {
      // k-means++: chọn điểm xa các tâm hiện có
      let sum = 0; const ds = pts.map((p) => { const m = Math.min(...C.map((c) => dist(p, c))); sum += m; return m; });
      if (!sum) break;
      let t = rnd() * sum, j = 0;
      while (j < pts.length - 1 && (t -= ds[j]) > 0) j++;
      C.push(pts[j].slice());
    }
    const asg = new Uint8Array(pts.length);
    for (let it = 0; it < 10; it++) {
      const acc = C.map(() => [0, 0, 0, 0]);
      pts.forEach((p, idx) => {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < C.length; c++) { const dd = dist(p, C[c]); if (dd < bd) { bd = dd; bi = c; } }
        asg[idx] = bi; const a = acc[bi]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++;
      });
      acc.forEach((a, c) => { if (a[3]) C[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
      if (it === 9) C.forEach((c, ci) => (c.count = acc[ci][3]));
    }
    return C.filter((c) => c.count).sort((a, b) => b.count - a.count).map((c) => {
      const rgb = c.map((v) => Math.round(v));
      return { rgb, share: c.count / pts.length, hex: '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() };
    });
  }

  // Đọc quan hệ màu của bảng màu theo vòng thuần sắc
  function harmony(pal) {
    const hs = pal.map((p) => ({ hsl: rgbToHsl(p.rgb[0] / 255, p.rgb[1] / 255, p.rgb[2] / 255), w: p.share }))
      .filter((x) => x.hsl[1] > 0.18 && x.hsl[2] > 0.1 && x.hsl[2] < 0.92);
    let warmW = 0, coolW = 0;
    hs.forEach((x) => { const h = x.hsl[0]; if (h < 70 || h > 300) warmW += x.w; else if (h > 150 && h < 270) coolW += x.w; });
    const temp = warmW > coolW * 1.3 ? 'ấm' : coolW > warmW * 1.3 ? 'lạnh' : 'cân bằng';
    if (hs.length < 1) return { name: 'Trung tính', desc: 'Gần như không màu — sức mạnh nằm ở sáng tối và hình khối', temp };
    const hd = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    let maxD = 0;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) maxD = Math.max(maxD, hd(hs[i].hsl[0], hs[j].hsl[0]));
    if (hs.length === 1 || maxD < 45) return { name: 'Tương đồng', desc: 'Các màu đứng sát nhau trên vòng màu — êm, liền mạch, dễ chịu', temp };
    if (maxD > 150) {
      const third = hs.length >= 3 && hs.some((a) => hs.every((b) => a === b || (hd(a.hsl[0], b.hsl[0]) > 80)));
      if (third && hs.length >= 3) return { name: 'Bộ ba', desc: 'Ba vùng màu cách đều — sinh động, nên để một màu làm chủ', temp };
      return { name: 'Bổ túc', desc: 'Hai màu đối nhau trên vòng màu — tương phản mạnh, chủ thể nổi bật', temp };
    }
    return { name: 'Lân cận mở rộng', desc: 'Dải màu trải một góc vừa phải — hài hoà mà vẫn có điểm nhấn', temp };
  }

  global.Grade = { PRESETS, analyze, suggest, resolve, apply, palette, harmony, lum };
})(typeof window !== 'undefined' ? window : globalThis);
