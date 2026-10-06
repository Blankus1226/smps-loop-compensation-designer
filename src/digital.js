/* 数字补偿：s 域原型 → z 域（Tustin 预畸变 / 零极点匹配），定点量化，C 代码生成
   约定：u[n] = Σ b[i]·e[n−i] − Σ a[i]·u[n−i] (i≥1)，a[0]=1，均以 z^-1 多项式表示 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;

const pmul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; };
PS.zEval = function (num, den, z) {           // z 为复数，按 z^-1 多项式求值
  const zi = C.inv(z); let n = C.ZERO, d = C.ZERO, p = C.ONE;
  for (let i = 0; i < Math.max(num.length, den.length); i++) {
    if (i < num.length) n = C.add(n, C.sc(p, num[i]));
    if (i < den.length) d = C.add(d, C.sc(p, den[i]));
    p = C.mul(p, zi);
  }
  return C.div(n, d);
};
// 在 s=jω 处以 z=e^{sT} 求数字补偿器（Nyquist 以上为周期延拓）
PS.dEval = (dc, s, T) => PS.zEval(dc.b, dc.a, C.exp(C.sc(s, T)));

PS.discretize = function (cp, T, method, fc) {
  const wc = TAU * fc;
  let num, den;
  if (method === 'mpz') {
    // 零极点匹配：零点 e^{-zT}、极点 e^{-pT}、积分极点 z=1，补 (1+z^-1) 使阶数一致
    num = [1]; den = [1, -1];
    cp.z.forEach(w => { num = pmul(num, [1, -Math.exp(-w * T)]); });
    cp.p.forEach(w => { den = pmul(den, [1, -Math.exp(-w * T)]); });
    while (num.length < den.length) num = pmul(num, [1, 1]);
    // 在 fc 处匹配增益（含积分，无法在直流匹配）
    const s = C.jw(fc), k = C.abs(PS.compEval(cp, s)) / C.abs(PS.zEval(num, den, C.exp(C.sc(s, T))));
    num = num.map(x => x * k);
  } else {
    // Tustin + fc 预畸变：s = κ(1−q)/(1+q)，κ = wc/tan(wcT/2)
    const k = wc / Math.tan(wc * T / 2);
    num = [cp.wi / k, cp.wi / k]; den = [1, -1];        // wi/s → (wi/κ)(1+q)/(1−q)
    cp.z.forEach(w => { num = pmul(num, [1 + k / w, 1 - k / w]); den = pmul(den, [1, 1]); });
    cp.p.forEach(w => { den = pmul(den, [1 + k / w, 1 - k / w]); num = pmul(num, [1, 1]); });
    // 消去成对出现的 (1+q)：零点数 = 极点数时分子分母各多出同样个数的 (1+q)，直接保留不影响结果
  }
  const a0 = den[0];
  const b = num.map(x => x / a0), a = den.map(x => x / a0);
  return reduce({ b, a, method, T });
};
// 去掉分子分母共同的 (1+q) 因子（Tustin 时成对出现）
function reduce(dc) {
  const div1 = p => { const r = []; let c = 0; for (let i = 0; i < p.length - 1; i++) { c = p[i] - c; r.push(c); } return { q: r, rem: p[p.length - 1] - c }; };
  for (let k = 0; k < 4; k++) {
    if (dc.a.length < 2 || dc.b.length < 2) break;
    const A = div1(dc.a), B = div1(dc.b);
    const sa = Math.max(...dc.a.map(Math.abs)), sb = Math.max(...dc.b.map(Math.abs));
    if (Math.abs(A.rem) < 1e-9 * sa && Math.abs(B.rem) < 1e-9 * sb) { dc.a = A.q; dc.b = B.q; } else break;
  }
  while (dc.b.length < dc.a.length) dc.b.push(0);
  return dc;
}

/* 定点量化：系数 Q 格式（int32），输出状态保留 Qy 位小数（防极限环）。
   强制 Σa = 0 使积分极点精确落在 z=1。 */
PS.quantize = function (dc, opt) {
  const mx = Math.max(...dc.b.map(Math.abs), ...dc.a.map(Math.abs));
  let Q = Math.min(30 - Math.max(0, Math.ceil(Math.log2(mx + 1e-12))), opt && opt.Qmax || 28);
  Q = Math.max(Q, 8);
  const S = Math.pow(2, Q);
  const bq = dc.b.map(x => Math.round(x * S)), aq = dc.a.map(x => Math.round(x * S));
  aq[0] = S;
  let sum = 0; for (let i = 0; i < aq.length - 1; i++) sum += aq[i];
  aq[aq.length - 1] = -sum;                          // 精确积分
  const r = { Q, Qy: 12, bq, aq, b: bq.map(x => x / S), a: aq.map(x => x / S) };
  r.err = dc.b.map((x, i) => x === 0 ? 0 : Math.abs((r.b[i] - x) / x));
  r.minBits = bq.map(x => x === 0 ? 0 : Math.floor(Math.log2(Math.abs(x))) + 1);
  return r;
};

// 精确定点差分方程（BigInt，与生成的 C 代码逐位一致）
PS.FixedCtrl = function (qz, umin, umax, u0) {
  const n = qz.aq.length, Q = BigInt(qz.Q), Qy = BigInt(qz.Qy);
  const B = qz.bq.map(BigInt), A = qz.aq.map(BigInt);
  const lo = BigInt(Math.round(umin)) << Qy, hi = BigInt(Math.round(umax)) << Qy;
  const e = new Array(n).fill(0n), u = new Array(n).fill(BigInt(Math.round(u0 * 2 ** qz.Qy)));
  return {
    step(err) {
      for (let i = n - 1; i > 0; i--) e[i] = e[i - 1];
      e[0] = BigInt(Math.round(err));
      let acc = 0n;
      for (let i = 0; i < n; i++) acc += B[i] * (e[i] << Qy);
      for (let i = 1; i < n; i++) acc -= A[i] * u[i - 1];
      let y = acc >> Q;                              // 算术右移（向下取整），与 C 一致
      if (y > hi) y = hi; if (y < lo) y = lo;
      for (let i = n - 1; i > 0; i--) u[i] = u[i - 1];
      u[0] = y;
      return Number(y >> Qy);
    },
  };
};
// 注：u 数组 u[0] 为本拍输出，u[i-1] 对应 u[n-i]

PS.cCode = function (name, qz, umin, umax, note) {
  const n = qz.aq.length, N = n - 1, up = name.toUpperCase();
  const L = [];
  L.push('/* ' + note.join('\n * ') + '\n */');
  L.push('#include <stdint.h>');
  L.push('#define ' + up + '_N    ' + N + '            /* 阶数 (' + N + 'P' + N + 'Z) */');
  L.push('#define ' + up + '_Q    ' + qz.Q + '           /* 系数 Q 格式：系数 = 整数 / 2^Q */');
  L.push('#define ' + up + '_QY   ' + qz.Qy + '           /* 输出状态额外小数位，抑制极限环 */');
  L.push('#define ' + up + '_UMIN ' + Math.round(umin) + ' ');
  L.push('#define ' + up + '_UMAX ' + Math.round(umax) + ' ');
  L.push('static const int32_t ' + name + '_B[' + n + '] = { ' + qz.bq.join(', ') + ' };');
  L.push('static const int32_t ' + name + '_A[' + n + '] = { ' + qz.aq.join(', ') + ' }; /* A[0] 未使用 */');
  L.push('typedef struct { int32_t e[' + n + ']; int64_t u[' + n + ']; } ' + name + '_t;');
  L.push('');
  L.push('/* 初始化：u0 为期望的初始输出（计数），e 清零 */');
  L.push('static inline void ' + name + '_init(' + name + '_t *c, int32_t u0) {');
  L.push('    for (int i = 0; i < ' + n + '; i++) { c->e[i] = 0; c->u[i] = (int64_t)u0 << ' + up + '_QY; }');
  L.push('}');
  L.push('/* 每个控制周期调用一次：err = 参考码 − ADC 码，返回限幅后的输出（计数） */');
  L.push('static inline int32_t ' + name + '_step(' + name + '_t *c, int32_t err) {');
  L.push('    for (int i = ' + N + '; i > 0; i--) c->e[i] = c->e[i - 1];');
  L.push('    c->e[0] = err;');
  L.push('    int64_t acc = 0;');
  L.push('    for (int i = 0; i <= ' + N + '; i++) acc += (int64_t)' + name + '_B[i] * ((int64_t)c->e[i] << ' + up + '_QY);');
  L.push('    for (int i = 1; i <= ' + N + '; i++) acc -= (int64_t)' + name + '_A[i] * c->u[i - 1];');
  L.push('    int64_t y = acc >> ' + up + '_Q;          /* 要求编译器对有符号数做算术右移（GCC/Clang/TI/Keil 均是） */');
  L.push('    const int64_t lo = (int64_t)' + up + '_UMIN << ' + up + '_QY, hi = (int64_t)' + up + '_UMAX << ' + up + '_QY;');
  L.push('    if (y > hi) y = hi; else if (y < lo) y = lo;   /* 输出限幅 = 抗积分饱和 */');
  L.push('    for (int i = ' + N + '; i > 0; i--) c->u[i] = c->u[i - 1];');
  L.push('    c->u[0] = y;');
  L.push('    return (int32_t)(y >> ' + up + '_QY);');
  L.push('}');
  return L.join('\n');
};

})(typeof window !== 'undefined' ? window : globalThis);
