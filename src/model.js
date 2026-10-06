/* 功率级：直流工作点 + CCM 平均小信号模型 + 各控制模式的调制律
   约定：所有量取幅值（Buck-Boost 输出按 |Vo| 计算），电压采样 H = Vref/Vo。
   小信号未知量 x = [iL, vo, d]，方程：
     行1  (sL+Rs)·iL + βv·vo − a·d = 0                 （电感）
     行2  −Zp·βi·iL + vo + Zp·b2·d = −Zp·io             （输出节点，io 为负载电流增量）
     行3  调制律 r3·x = kvc·vc                          （随控制模式变化）           */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C;

PS.opPoint = function (P, Vin, Io) {
  const t = P.topo, Vo = P.Vo, Rs = P.RL + P.Ron, Ts = 1 / P.fs;
  Io = Math.max(Io, 1e-6);
  const op = { Vin, Io, Vo, Rs, R: Vo / Io, Ts, ok: true, err: '' };
  let x;
  if (t === 'buck') {
    op.D = (Vo + Io * Rs) / Vin; x = 1 - op.D; op.IL = Io;
  } else {
    const k = t === 'boost' ? Vo : Vin + Vo, disc = Vin * Vin - 4 * k * Io * Rs;
    if (disc < 0) { op.ok = false; op.err = '寄生电阻损耗过大，此工况下无法达到目标输出电压'; x = 0.5; }
    else x = (Vin + Math.sqrt(disc)) / (2 * k);
    op.D = 1 - x; op.IL = Io / x;
  }
  op.Dp = 1 - op.D;
  if (op.D <= 0.005 || op.D >= (P.Dmax || 0.95)) { op.ok = false; op.err = op.err || ('占空比 D = ' + op.D.toFixed(3) + ' 超出可用范围'); }
  const IL = op.IL, Dp = op.Dp;
  if (t === 'buck') { op.Von = Vin - Vo - IL * Rs; op.Voff = Vo + IL * Rs; op.a = Vin; op.bv = 1; op.bi = 1; op.b2 = 0; }
  else if (t === 'boost') { op.Von = Vin - IL * Rs; op.Voff = Vo - Vin + IL * Rs; op.a = Vo; op.bv = Dp; op.bi = Dp; op.b2 = IL; }
  else { op.Von = Vin - IL * Rs; op.Voff = Vo + IL * Rs; op.a = Vin + Vo; op.bv = Dp; op.bi = Dp; op.b2 = IL; }
  op.dIL = op.Von * op.D * Ts / P.L;
  op.Ton = op.D * Ts;
  op.Sn = P.Ri * op.Von / P.L; op.Sf = P.Ri * op.Voff / P.L;
  const LC = Math.sqrt(P.L * P.C);
  op.f0 = (t === 'buck' ? 1 : Dp) / (2 * Math.PI * LC);
  op.fesr = 1 / (2 * Math.PI * P.Rc * P.C);
  op.frhpz = t === 'buck' ? Infinity : (t === 'boost' ? op.R * Dp * Dp / (2 * Math.PI * P.L) : op.R * Dp * Dp / (2 * Math.PI * P.L * op.D));
  op.dcm = IL < op.dIL / 2;               // 非同步整流时会进入 DCM
  op.Icrit = (t === 'buck' ? 1 : Dp) * op.dIL / 2;   // 对应的临界输出电流
  return op;
};

// 峰值电流模式采样增益 He(s) = sTs/(e^{sTs}−1)（Ridley 精确式）
PS.He = function (s, Ts) {
  const x = C.sc(s, Ts);
  if (C.abs(x) < 1e-6) return C.sub(C.ONE, C.sc(x, 0.5));
  let den = C.sub(C.exp(x), C.ONE);
  if (C.abs(den) < 1e-9) den = C.sub(C.exp(C.of(x.re, x.im * (1 + 1e-6))), C.ONE);
  return C.div(x, den);
};
// 电流型 COT：iL/vc 的双极点（Jian Li）ω1=π/Ton, Q1=2/π → 1 + s·Ton/2 + s²·Ton²/π²
PS.Hcot = function (s, Ton) {
  const s2 = C.mul(s, s), k = Ton * Ton / (Math.PI * Math.PI);
  return C.inv({ re: 1 + s.re * Ton / 2 + s2.re * k, im: s.im * Ton / 2 + s2.im * k });
};
// 纹波型 COT（Jian Li）：vo/vc = (1/H)(1+s·rc·C)/(1 + s(rcC − Ton/2) + s²Ton²/π²)
PS.Pcotr = function (op, P, s, H) {
  const s2 = C.mul(s, s), rcC = P.Rc * P.C, k = op.Ton * op.Ton / (Math.PI * Math.PI), b = rcC - op.Ton / 2;
  const den = { re: 1 + s.re * b + s2.re * k, im: s.im * b + s2.im * k };
  return C.sc(C.div(C.addr(C.sc(s, rcC), 1), den), 1 / H);
};
PS.cotrQ = (op, P) => { const x = P.Rc * P.C / op.Ton - 0.5; return x > 0 ? 1 / (Math.PI * x) : -Infinity; };

// 功率级两行
PS.rows = function (op, P, s) {
  const ZL = C.addr(C.sc(s, P.L), op.Rs);
  // Zp = R ∥ (Rc + 1/sC)
  const sC = C.sc(s, P.C), Zc = C.add(C.of(P.Rc), C.inv(sC));
  const Zp = C.div(C.sc(Zc, op.R), C.addr(Zc, op.R));
  return {
    Zp, Zc,
    r1: [ZL, C.of(op.bv), C.of(-op.a)],
    r2: [C.sc(Zp, -op.bi), C.ONE, C.sc(Zp, op.b2)],
    io2: C.neg(Zp),
  };
};

/* 解三行方程。r3 为调制律行（3 个复数），kvc 为 vc 的系数。
   返回 vo/vc、iL/vc、d/vc 以及开环（vc 固定）输出阻抗 Zo=−vo/io。 */
PS.solve = function (op, P, s, r3, kvc) {
  const w = PS.rows(op, P, s), A = [w.r1, w.r2, r3];
  const [xv, xi] = PS.solveC(A, [[C.ZERO, C.ZERO, kvc], [C.ZERO, w.io2, C.ZERO]]);
  return { vo: xv[1], iL: xv[0], d: xv[2], Zo: C.neg(xi[1]), Zp: w.Zp };
};
// 占空比直接驱动：Gvd、Gid
PS.Gvd = function (op, P, s) {
  const r = PS.solve(op, P, s, [C.ZERO, C.ZERO, C.ONE], C.ONE);
  return { Gvd: r.vo, Gid: r.iL, Zo: r.Zo };
};

})(typeof window !== 'undefined' ? window : globalThis);
