/* 分析：裕度提取、FFT、小信号负载阶跃预测（闭环输出阻抗的数值反变换） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;

// 环路裕度：fc（首个 |T| 由 >1 到 <1 的穿越）、PM、GM、多次穿越提示
PS.margins = function (Tfun, fmin, fmax, n) {
  const f = PS.logspace(fmin, fmax, n || 700), b = PS.bode(Tfun, f), m = b.mag, ph = b.ph;
  const r = { f, mag: m, ph, fc: NaN, pm: NaN, gm: Infinity, fgm: NaN, crossings: 0 };
  // fc 取最后一次向下穿越（带宽）；每次穿越都计算 PM，pmMin 取最小
  let ic = -1; r.pmMin = Infinity;
  const pmAt = (i, t) => { let p = 180 + ph[i] + (ph[i + 1] - ph[i]) * t; while (p > 180) p -= 360; while (p < -180) p += 360; return p; };
  for (let i = 0; i < f.length - 1; i++) {
    if ((m[i] >= 0) !== (m[i + 1] >= 0)) {
      r.crossings++;
      const t = m[i] / (m[i] - m[i + 1]);
      r.pmMin = Math.min(r.pmMin, pmAt(i, t));
      if (m[i] >= 0) ic = i;
    }
  }
  if (ic >= 0) {
    const t = m[ic] / (m[ic] - m[ic + 1]);
    r.fc = Math.pow(10, Math.log10(f[ic]) + t * (Math.log10(f[ic + 1]) - Math.log10(f[ic])));
    r.pm = pmAt(ic, t);
  }
  const start = Math.max(ic, 0);
  for (let i = start; i < f.length - 1; i++) {
    const a = ph[i] + 180, c = ph[i + 1] + 180;
    if (a > 0 && c <= 0) {
      const t = a / (a - c);
      r.fgm = Math.pow(10, Math.log10(f[i]) + t * (Math.log10(f[i + 1]) - Math.log10(f[i])));
      r.gm = -(m[i] + (m[i + 1] - m[i]) * t);
      break;
    }
  }
  return r;
};

// 原地基 2 FFT（re, im 为 Float64Array），inv=true 为逆变换（不含 1/N）
PS.fft = function (re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
};

/* 负载电流单位阶跃下的输出电压偏移 s(t)（V/A，正值表示跌落）
   Zfun(s) 为闭环输出阻抗，Zinf 为高频极限（≈ Rc∥R），tw 为需要的时间长度 */
PS.stepFromZ = function (Zfun, Zinf, tw, fhi) {
  // fhi：模型中最高的特征频率，FFT 上限 N/(2Tp) 需覆盖其数倍，否则积分丢失高频，终值偏移
  const Tp = tw * 2.5;
  let N = 4096; while (N < 262144 && N / (2 * Tp) < 4 * fhi) N *= 2;
  const df = 1 / Tp * (1 + 1e-4 * Math.SQRT2), dt = 1 / (N * df);   // 微调避开 fs 整倍数
  const re = new Float64Array(N), im = new Float64Array(N), H = N / 2;
  for (let k = 0; k <= H; k++) {
    const f = k === 0 ? df * 1e-3 : k * df;
    let z = Zfun(C.jw(f));
    if (!C.ok(z)) z = C.ZERO;
    const x = k / H, w = k === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);   // Lanczos σ 因子
    const vr = (z.re - Zinf) * w, vi = z.im * w;
    re[k] = vr; im[k] = vi;
    if (k > 0 && k < H) { re[N - k] = vr; im[N - k] = -vi; }
  }
  im[H] = 0;
  PS.fft(re, im, true);
  // h(t) = Σ Z(k·df)·e^{j2πk·df·t}·df；阶跃响应 = Zinf + ∫h（梯形积分）
  const n = Math.min(N, Math.ceil(tw / dt) + 2), s = new Float64Array(n);
  let a2 = 0;
  for (let i = 0; i < n; i++) { if (i > 0) a2 += 0.5 * (re[i - 1] + re[i]) * df * dt; s[i] = Zinf + a2; }
  return { dt, s };
};

// 在任意时刻插值读取阶跃响应
PS.stepAt = function (st, t) {
  if (t < 0) return 0;
  const x = t / st.dt, i = Math.floor(x);
  if (i >= st.s.length - 1) return st.s[st.s.length - 1];
  return st.s[i] + (st.s[i + 1] - st.s[i]) * (x - i);
};

})(typeof window !== 'undefined' ? window : globalThis);
