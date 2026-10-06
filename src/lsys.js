/* 学习用线性系统工具：多项式（升幂）、求根、状态空间阶跃响应、Padé 延时、零极点图 / Nyquist 图 SVG、时域图配置
   多项式一律升幂：c[0] + c[1]·s + c[2]·s² …  */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;
const Ls = PS.Ls = {};

Ls.pmul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
Ls.padd = (a, b) => { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push((a[i] || 0) + (b[i] || 0)); return r; };
Ls.psc = (a, k) => a.map(x => x * k);
// 复数 s 处求值
Ls.pe = (c, s) => { let r = C.ZERO; for (let i = c.length - 1; i >= 0; i--) r = C.addr(C.mul(r, s), c[i]); return r; };
Ls.rat = (n, d) => s => C.div(Ls.pe(n, s), Ls.pe(d, s));
// 常用因子（ω 为 rad/s）
Ls.f1 = w => [1, 1 / w];                              // 1 + s/ω
Ls.f2 = (w, Q) => [1, 1 / (w * Q), 1 / (w * w)];      // 1 + s/(ωQ) + s²/ω²
Ls.prod = list => list.reduce((a, b) => Ls.pmul(a, b), [1]);
// 二阶 Padé：e^{−sTd} ≈ (1 − sTd/2 + s²Td²/12)/(1 + sTd/2 + s²Td²/12)
Ls.pade = Td => ({ n: [1, -Td / 2, Td * Td / 12], d: [1, Td / 2, Td * Td / 12] });
// 闭环 L/(1+L)
Ls.closed = (n, d) => ({ n: n.slice(), d: Ls.padd(d, n) });
// 去掉高次端的零系数
Ls.trim = c => { const r = c.slice(); while (r.length > 1 && Math.abs(r[r.length - 1]) < 1e-300) r.pop(); return r; };
// 变量缩放 s = Ω·p：c_k → c_k·Ω^k
Ls.scale = (c, W) => c.map((x, k) => x * Math.pow(W, k));

// Durand–Kerner 求根（升幂系数），返回复数数组
Ls.roots = function (c0) {
  const c = Ls.trim(c0), n = c.length - 1;
  if (n < 1) return [];
  const a = c.map(x => x / c[n]);                     // 首一
  let R = 1; for (let k = 0; k < n; k++) R = Math.max(R, Math.pow(Math.abs(a[k]), 1 / (n - k)));
  let z = []; for (let k = 0; k < n; k++) z.push(C.sc(C.exp(C.of(0, TAU * k / n + 0.4)), R));
  for (let it = 0; it < 800; it++) {
    let mv = 0;
    z = z.map((zi, i) => {
      let den = C.ONE; z.forEach((zj, j) => { if (j !== i) den = C.mul(den, C.sub(zi, zj)); });
      if (C.abs(den) < 1e-300) den = C.of(1e-12);
      const d = C.div(Ls.pe(a, zi), den); mv = Math.max(mv, C.abs(d) / (C.abs(zi) + 1e-30));
      return C.sub(zi, d);
    });
    if (mv < 1e-13) break;
  }
  return z.map(r => C.of(r.re, Math.abs(r.im) < 1e-9 * (C.abs(r) + 1e-30) ? 0 : r.im));
};

/* 阶跃响应：H = n/d（s 域，升幂），先缩放到 p = s/Ω 再用控制标准型 + RK4 积分
   opt: { W: 缩放角频率, tEnd: 秒, u: 输入幅度 }。返回 { t, y, unstable } */
Ls.step = function (n0, d0, opt) {
  const W = opt.W, d = Ls.trim(Ls.scale(d0, W)), nn = Ls.scale(n0, W), N = d.length - 1;
  const u = opt.u === undefined ? 1 : opt.u;
  if (N === 0) { const g = nn[0] / d[0]; return { t: [0, opt.tEnd], y: [g * u, g * u] }; }
  const a = d.map(x => x / d[N]), b = []; for (let k = 0; k <= N; k++) b.push((nn[k] || 0) / d[N]);
  const Dd = b[N], bp = b.slice(0, N).map((x, k) => x - Dd * a[k]);
  // 步长：最快模态的 1/40
  const rr = Ls.roots(d); let wmax = 1; rr.forEach(r => { wmax = Math.max(wmax, C.abs(r)); });
  const tau = opt.tEnd * W, h = Math.min(tau / 400, 0.025 / wmax), steps = Math.min(200000, Math.ceil(tau / h)), hh = tau / steps;
  const f = x => { const dx = new Array(N); for (let i = 0; i < N - 1; i++) dx[i] = x[i + 1]; let s = u; for (let k = 0; k < N; k++) s -= a[k] * x[k]; dx[N - 1] = s; return dx; };
  const out = x => { let s = Dd * u; for (let k = 0; k < N; k++) s += bp[k] * x[k]; return s; };
  let x = new Array(N).fill(0); const T = [0], Y = [out(x)], every = Math.max(1, Math.floor(steps / 700));
  let unstable = false;
  for (let i = 1; i <= steps; i++) {
    const k1 = f(x), x2 = x.map((v, j) => v + hh / 2 * k1[j]), k2 = f(x2), x3 = x.map((v, j) => v + hh / 2 * k2[j]), k3 = f(x3), x4 = x.map((v, j) => v + hh * k3[j]), k4 = f(x4);
    x = x.map((v, j) => v + hh / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (i % every === 0 || i === steps) {
      const y = out(x); T.push(i * hh / W); Y.push(y);
      if (!isFinite(y) || Math.abs(y) > 1e6 * (Math.abs(Y[1]) + 1)) { unstable = true; break; }
    }
  }
  return { t: T, y: Y, unstable, poles: rr.map(r => C.sc(r, W)) };
};
// 阶跃指标：超调 %、峰值时间、2% 调节时间
Ls.stepInfo = function (st, yf) {
  const t = st.t, y = st.y; let pk = -Infinity, tp = 0;
  y.forEach((v, i) => { if (v > pk) { pk = v; tp = t[i]; } });
  let ts = 0; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - yf) > 0.02 * Math.abs(yf)) { ts = t[Math.min(i + 1, t.length - 1)]; break; }
  return { os: Math.max(0, (pk / yf - 1) * 100), tp, ts };
};

// ---------- SVG 小图 ----------
const svgOpen = (W, H, lab) => `<svg class="schem lplot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${lab}">`;
const txt = (x, y, s, anc, cls) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anc || 'middle'}" class="${cls || 'sv'}">${s}</text>`;
/* 零极点图。zs/ps：复数数组；opt: { z: true 画单位圆（z 平面）, unit: 'Hz' 时坐标除以 2π, title } */
Ls.pzSvg = function (zs, ps, opt) {
  opt = opt || {};
  const W = 380, H = 300, cx = W / 2 + 10, cy = H / 2, k = opt.unit === 'Hz' ? 1 / TAU : 1;
  const all = zs.concat(ps).map(p => C.sc(p, k));
  let R = opt.z ? 1.25 : Math.max(1e-30, ...all.map(p => Math.max(Math.abs(p.re), Math.abs(p.im)))) * 1.3;
  if (opt.R) R = opt.R;
  const sx = (W / 2 - 30) / R, X = v => cx + v * sx, Y = v => cy - v * sx;
  const o = [svgOpen(W, H, '零极点图')];
  o.push(`<line x1="20" y1="${cy}" x2="${W - 8}" y2="${cy}" class="ax"/><line x1="${cx}" y1="8" x2="${cx}" y2="${H - 8}" class="ax"/>`);
  if (opt.z) o.push(`<circle cx="${cx}" cy="${cy}" r="${sx}" class="uc"/>` + txt(X(1) + 4, cy - 6, '1', 'start') + txt(X(-1) - 4, cy - 6, '−1', 'end'));
  else {
    o.push(`<rect x="${cx}" y="8" width="${W - 8 - cx}" height="${H - 16}" class="rhp"/>`);
    o.push(txt(W - 12, 22, '右半平面（不稳定）', 'end') + txt(26, 22, '左半平面（稳定）', 'start'));
    o.push(txt(X(-R / 1.3), cy + 16, PS.fmt(-R / 1.3, opt.unit === 'Hz' ? 'Hz' : 'rad/s', 2), 'middle'));
  }
  o.push(txt(W - 10, cy - 6, opt.z ? 'Re z' : 'σ', 'end') + txt(cx + 6, 18, opt.z ? 'Im z' : 'jω', 'start'));
  const clip = v => Math.max(-R, Math.min(R, v));
  zs.forEach(p0 => { const p = C.sc(p0, k); o.push(`<circle cx="${X(clip(p.re)).toFixed(1)}" cy="${Y(clip(p.im)).toFixed(1)}" r="6" class="pz-z"/>`); });
  ps.forEach(p0 => { const p = C.sc(p0, k), x = X(clip(p.re)), y = Y(clip(p.im)); o.push(`<path d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x - 6} ${y + 6}L${x + 6} ${y - 6}" class="pz-p"/>`); });
  o.push(txt(26, H - 10, '○ 零点　× 极点', 'start'));
  return o.join('') + '</svg>';
};
/* Nyquist 图：L(s)，f0..f1 Hz。幅值按 r' = log2(1 + r) 压缩（−1 点仍在单位距离），同时画负频率镜像 */
Ls.nyqSvg = function (L, f0, f1) {
  const W = 380, H = 320, cx = W / 2 + 20, cy = H / 2, f = PS.logspace(f0, f1, 900), sc = 38;
  // 单位圆内线性，圆外按 1 + log10|L| 压缩（|L| = 1000 → 半径 4），−1 点位置不变
  const map = v => { const r = C.abs(v), a = C.arg(v), rr = r <= 1 ? r : 1 + Math.log10(r); return [cx + sc * rr * Math.cos(a), cy - sc * rr * Math.sin(a)]; };
  const pts = f.map(x => map(L(C.jw(x)))).filter(p => isFinite(p[0]) && isFinite(p[1]));
  const lim = p => [Math.max(-2000, Math.min(2000, p[0])), Math.max(-2000, Math.min(2000, p[1]))];
  const pl = (a, cls) => `<polyline class="${cls}" points="${a.map(lim).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
  const o = [svgOpen(W, H, 'Nyquist 图')];
  o.push(`<clipPath id="nqc"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath><g clip-path="url(#nqc)">`);
  o.push(`<line x1="8" y1="${cy}" x2="${W - 8}" y2="${cy}" class="ax"/><line x1="${cx}" y1="8" x2="${cx}" y2="${H - 8}" class="ax"/>`);
  o.push(`<circle cx="${cx}" cy="${cy}" r="${sc}" class="uc"/>`);
  o.push(pl(pts.map(p => [p[0], 2 * cy - p[1]]), 'nq2') + pl(pts, 'nq1'));
  // 方向箭头（取中段一点）
  const m = Math.floor(pts.length * 0.35), a = pts[m], b = pts[Math.min(m + 6, pts.length - 1)];
  if (a && b) { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); o.push(`<path class="nqa" d="M${b[0]} ${b[1]}l${(-9 * Math.cos(ang - 0.45)).toFixed(1)} ${(-9 * Math.sin(ang - 0.45)).toFixed(1)}M${b[0]} ${b[1]}l${(-9 * Math.cos(ang + 0.45)).toFixed(1)} ${(-9 * Math.sin(ang + 0.45)).toFixed(1)}"/>`); }
  o.push(`<circle cx="${cx - sc}" cy="${cy}" r="5" class="pz-p" style="fill:var(--critical);stroke:none"/>` + txt(cx - sc, cy + 20, '−1', 'middle', 'sk'));
  o.push('</g>' + txt(14, 18, '实线 ω > 0，虚线 ω < 0；单位圆 = |L| = 1', 'start') + txt(14, H - 8, '|L| > 1 部分按 1 + log₁₀|L| 压缩，−1 点位置不变', 'start'));
  return o.join('') + '</svg>';
};
// 时域图配置（给 PS.Plot）
Ls.tcfg = function (series, opt) {
  opt = opt || {};
  return { xLog: false, xUnit: 's', height: opt.height || 300, xRange: opt.xRange, vlines: opt.vlines || [],
    panels: [{ label: opt.label || '响应', unit: opt.unit || '', series, hlines: (opt.hlines || []).map(y => typeof y === 'number' ? { y, dash: true } : y), fmtTip: v => (+v.toPrecision(4)).toString() }] };
};
// Bode 配置（单独的小 Bode 图，用于补偿器单独显示等）
Ls.bcfg = function (list, f, opt) {
  opt = opt || {};
  const S = [], Ph = [];
  list.forEach(s => { const b = PS.bode(s.fn, f); S.push({ name: s.name, color: s.color, dash: s.dash, width: s.width || 2.2, x: f, y: b.mag }); Ph.push({ name: s.name, color: s.color, dash: s.dash, width: s.width || 2.2, x: f, y: b.ph }); });
  return { xLog: true, xUnit: 'Hz', height: opt.height || 360, vlines: opt.vlines || [], panels: [
    { label: '幅值 (dB)', unit: 'dB', series: S, hlines: [{ y: 0, strong: true }], clamp: [-100, 140, 160], step: 20, fmtTip: x => x.toFixed(1) },
    { label: '相位 (°)', unit: '°', series: Ph, hlines: opt.ph0 ? [{ y: opt.ph0, dash: true }] : [], clamp: [-450, 200, 400], step: 45, fmtTip: x => x.toFixed(1) }] };
};
})(typeof window !== 'undefined' ? window : globalThis);
