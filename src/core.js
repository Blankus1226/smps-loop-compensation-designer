/* 核心：命名空间、复数运算、线性方程组、数值工具、SI 格式化、E 系列圆整 */
(function (G) {
'use strict';
const PS = G.PS = G.PS || {};

// ---------- 复数 {re, im} ----------
const C = PS.C = {
  of: (re, im) => ({ re: re, im: im || 0 }),
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; },
  sc: (a, k) => ({ re: a.re * k, im: a.im * k }),
  addr: (a, k) => ({ re: a.re + k, im: a.im }),
  inv: a => { const d = a.re * a.re + a.im * a.im; return { re: a.re / d, im: -a.im / d }; },
  neg: a => ({ re: -a.re, im: -a.im }),
  abs: a => Math.hypot(a.re, a.im),
  arg: a => Math.atan2(a.im, a.re),
  exp: a => { const e = Math.exp(a.re); return { re: e * Math.cos(a.im), im: e * Math.sin(a.im) }; },
  lin: (s, w) => ({ re: 1 + s.re / w, im: s.im / w }),                 // 1 + s/w
  quad: (s, w, Q) => {                                                   // 1 + s/(wQ) + s²/w²
    const r2 = s.re * s.re - s.im * s.im, i2 = 2 * s.re * s.im;
    return { re: 1 + s.re / (w * Q) + r2 / (w * w), im: s.im / (w * Q) + i2 / (w * w) };
  },
  jw: f => ({ re: 0, im: 2 * Math.PI * f }),
  ok: a => isFinite(a.re) && isFinite(a.im),
};
C.ONE = { re: 1, im: 0 }; C.ZERO = { re: 0, im: 0 };

// 复数线性方程组 A x = b（高斯消元 + 部分主元），A 为 n×n，可同时解多个右端
PS.solveC = function (A, Bs) {
  const n = A.length, M = A.map(r => r.slice()), R = Bs.map(b => b.slice());
  for (let k = 0; k < n; k++) {
    let piv = k, best = C.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) { const v = C.abs(M[i][k]); if (v > best) { best = v; piv = i; } }
    if (piv !== k) { [M[k], M[piv]] = [M[piv], M[k]]; R.forEach(b => { [b[k], b[piv]] = [b[piv], b[k]]; }); }
    const d = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = C.div(M[i][k], d);
      if (f.re === 0 && f.im === 0) continue;
      for (let j = k; j < n; j++) M[i][j] = C.sub(M[i][j], C.mul(f, M[k][j]));
      R.forEach(b => { b[i] = C.sub(b[i], C.mul(f, b[k])); });
    }
  }
  return R.map(b => {
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < n; j++) s = C.sub(s, C.mul(M[i][j], x[j]));
      x[i] = C.div(s, M[i][i]);
    }
    return x;
  });
};

// ---------- 数值工具 ----------
PS.logspace = (a, b, n) => { const la = Math.log10(a), lb = Math.log10(b), r = []; for (let i = 0; i < n; i++) r.push(Math.pow(10, la + (lb - la) * i / (n - 1))); return r; };
PS.clamp = (x, a, b) => Math.min(Math.max(x, a), b);
PS.dB = v => 20 * Math.log10(Math.max(v, 1e-300));
PS.deg = r => r * 180 / Math.PI;
PS.rad = d => d * Math.PI / 180;
// 相位展开（输入弧度，输出度）
PS.unwrap = function (ph) {
  const out = new Array(ph.length); let off = 0;
  for (let i = 0; i < ph.length; i++) {
    if (i > 0) { let d = ph[i] + off - (out[i - 1] * Math.PI / 180); while (d > Math.PI) { off -= 2 * Math.PI; d -= 2 * Math.PI; } while (d < -Math.PI) { off += 2 * Math.PI; d += 2 * Math.PI; } }
    out[i] = (ph[i] + off) * 180 / Math.PI;
  }
  return out;
};
// 把函数 H(s) 在频率数组上求值，返回 {mag(dB), ph(deg 展开)}
PS.bode = function (H, fs) {
  const mag = [], raw = [];
  for (const f of fs) { const v = H(C.jw(f)); mag.push(PS.dB(C.abs(v))); raw.push(C.arg(v)); }
  return { f: fs, mag, ph: PS.unwrap(raw) };
};
// 取 2 位有效数字的“整齐”值
PS.nice = v => { if (!(v > 0)) return v; const e = Math.floor(Math.log10(v)); const m = v / Math.pow(10, e); return Math.round(m * 10) / 10 * Math.pow(10, e); };

// ---------- SI 前缀 ----------
const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
PS.fmt = function (v, unit, sig) {
  unit = unit || ''; sig = sig || 3;
  if (v === undefined || v === null || isNaN(v)) return '—';
  if (!isFinite(v)) return (v > 0 ? '∞' : '-∞') + (unit ? ' ' + unit : '');
  if (v === 0) return '0' + (unit ? ' ' + unit : '');
  const a = Math.abs(v);
  for (const [k, p] of PRE) if (a >= k * 0.9995) { return (+(v / k).toPrecision(sig)) + ' ' + p + unit; }
  return (+(v / 1e-15).toPrecision(sig)) + ' f' + unit;
};
PS.fmtNum = (v, d) => (v === undefined || isNaN(v)) ? '—' : (isFinite(v) ? v.toFixed(d === undefined ? 1 : d) : '∞');
const MUL = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
PS.parseSI = function (str) {
  if (typeof str === 'number') return str;
  const s = String(str).trim().replace(/,/g, '');
  const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*(meg|MEG|[fpnuµμmkKMG])?/);
  if (!m) return NaN;
  let v = parseFloat(m[1]);
  if (m[2]) v *= /meg/i.test(m[2]) ? 1e6 : MUL[m[2]];
  return v;
};

// ---------- E 系列 ----------
const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976];
PS.roundE = function (v, series) {
  if (!(v > 0) || !isFinite(v)) return v;
  const list = series === 96 ? E96 : E24, base = series === 96 ? 100 : 10;
  const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e) * base;
  let best = list[0], bd = Infinity;
  for (const x of list.concat([base * 10])) { const d = Math.abs(Math.log(m / x)); if (d < bd) { bd = d; best = x; } }
  return best / base * Math.pow(10, e);
};

// ---------- 杂项 ----------
PS.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
PS.debounce = (fn, ms) => { let t = null; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; };
PS.clone = o => JSON.parse(JSON.stringify(o));

})(typeof window !== 'undefined' ? window : globalThis);
