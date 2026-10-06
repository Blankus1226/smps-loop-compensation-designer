/* 补偿器：统一表示、K 因子法 / 经典放置 / 手动、RC 实现与 E 系列圆整
   cp = { type:1|2|3, wi, z:[ω…], p:[ω…] }  Gc(s) = (wi/s)·Π(1+s/z)/Π(1+s/p)
   OTA Type III 的 Cff 对也作为第二组 z/p 写入（p = z/H0）。 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;

PS.compShape = function (cp, s) {
  let v = C.ONE;
  for (const w of cp.z) v = C.mul(v, C.lin(s, w));
  for (const w of cp.p) v = C.div(v, C.lin(s, w));
  return v;
};
PS.compEval = (cp, s) => C.mul(C.div(C.of(cp.wi), s), PS.compShape(cp, s));
// wi 使 |Gc·Pl|=1 于 fc
PS.compSolveGain = function (cp, Pfun, fc) {
  const s = C.jw(fc), m = C.abs(Pfun(s)) * C.abs(PS.compShape(cp, s)) / (TAU * fc);
  cp.wi = 1 / m; return cp;
};
// 对象在 fc 处的展开相位（度），从低频连续扫描以免 2π 跳变
PS.phaseAt = function (Pfun, fc) {
  const fs = PS.logspace(fc / 2000, fc, 260);
  return PS.bode(Pfun, fs).ph.pop();
};

/* K 因子法。opt: { type:'auto'|1|2|3, family:'opamp'|'ota', H0, maxType, fpMax } */
PS.kfactor = function (Pfun, fc, pm, opt) {
  opt = opt || {};
  const warn = [], ph = PS.phaseAt(Pfun, fc), boost = pm - 90 - ph;
  let type = opt.type === 'auto' || !opt.type ? (boost <= 3 ? 1 : boost <= 70 ? 2 : 3) : +opt.type;
  if (opt.maxType && type > opt.maxType) type = opt.maxType;
  if (opt.family === 'ota' && type === 1 && opt.type === 'auto') type = 2;
  const cp = { type, z: [], p: [], wi: 1 }, wc = TAU * fc;
  let b = boost;
  if (type === 1) { if (boost > 3) warn.push('Type I 无相位提升，无法达到目标相位裕度（需要 ' + boost.toFixed(0) + '°）'); }
  else if (type === 2) {
    if (b > 85) { warn.push('所需相位提升 ' + b.toFixed(0) + '° 超过 Type II 能力，已截断为 85°，建议改用 Type III 或降低 fc'); b = 85; }
    if (b < 5) b = 5;
    const K = Math.tan(PS.rad(b / 2 + 45));
    cp.z = [wc / K]; cp.p = [wc * K]; cp.K = K;
  } else {
    if (opt.family === 'ota') {
      const H0 = opt.H0, kff = 1 / H0, bff = PS.deg(Math.atan(Math.sqrt(kff)) - Math.atan(1 / Math.sqrt(kff)));
      let r = b - bff; if (r > 85) { warn.push('OTA Type III 的 Cff 只能提供 ' + bff.toFixed(0) + '°，剩余提升过大，已截断'); r = 85; }
      if (r < 5) r = 5;
      const K = Math.tan(PS.rad(r / 2 + 45));
      cp.z = [wc / K, wc * Math.sqrt(H0)]; cp.p = [wc * K, wc / Math.sqrt(H0)]; cp.K = K; cp.bff = bff;
    } else {
      // 理论极限 180°；超过 ~155° 时 K 极大，低频环路增益在零点处跌破 0 dB（条件稳定），实用上限取 155°
      if (b > 155) { warn.push('所需相位提升 ' + b.toFixed(0) + '° 超出 Type III 实用极限 155°，已截断，实际 PM ≈ ' + (pm - (b - 155)).toFixed(0) + '°。可提高 fs、选用带 ESR 的电容或降低目标 PM'); b = 155; }
      if (b < 10) b = 10;
      const K = Math.pow(Math.tan(PS.rad(b / 4 + 45)), 2), k = Math.sqrt(K);
      cp.z = [wc / k, wc / k]; cp.p = [wc * k, wc * k]; cp.K = K;
    }
  }
  if (opt.fpMax) cp.p = cp.p.map(w => Math.min(w, TAU * opt.fpMax));
  PS.compSolveGain(cp, Pfun, fc);
  return { cp, boost, phPlant: ph, type, warn, K: cp.K };
};

// 经典 VMC Type III 放置：双零点 ≈ f0（0.5f0 与 f0），极点放 ESR 零点与 fs/2
PS.classic3 = function (Pfun, fc, op, P) {
  const f0 = op.f0, fp1 = Math.max(Math.min(op.fesr, P.fs / 2), fc * 1.5), fp2 = P.fs / 2;
  const cp = { type: 3, z: [TAU * f0 * 0.5, TAU * f0], p: [TAU * fp1, TAU * fp2], wi: 1 };
  PS.compSolveGain(cp, Pfun, fc);
  return { cp, boost: NaN, phPlant: PS.phaseAt(Pfun, fc), type: 3, warn: [] };
};
// 手动：给定类型与极零点频率（Hz），增益按 fc 求
PS.manualComp = function (Pfun, fc, m, opt) {
  const t = +m.type, cp = { type: t, z: [], p: [], wi: 1 };
  if (t >= 2) { cp.z.push(TAU * m.fz1); cp.p.push(TAU * m.fp1); }
  if (t >= 3) { cp.z.push(TAU * m.fz2); cp.p.push(opt && opt.family === 'ota' ? TAU * m.fz2 / opt.H0 : TAU * m.fp2); }
  PS.compSolveGain(cp, Pfun, fc);
  return { cp, boost: NaN, phPlant: PS.phaseAt(Pfun, fc), type: t, warn: [] };
};

/* RC 实现。opamp：R1 = 上分压电阻（输入电阻），Rb 只决定直流偏置。
   ota：Gc = H0·gm·Zo，Type III 用 Cff 并联在 Rt 上。返回 {parts:[{name,ideal,val,unit}], cpReal} */
PS.realize = function (cp, fam, cfg) {
  const parts = [], add = (name, v, unit, ser) => parts.push({ name, ideal: v, val: cfg.round ? PS.roundE(v, ser) : v, unit });
  const z = cp.z, p = cp.p;   // 成对使用：(z[0],p[0]) 主对，(z[1],p[1]) 第二对 / Cff 对
  const g = n => parts.find(x => x.name === n).val;
  const real = { type: cp.type, z: [], p: [], wi: 0 };
  if (fam === 'opamp') {
    const R1 = cfg.R1; add('R1', R1, 'Ω', 96);
    if (cp.type === 1) { add('C1', 1 / (cp.wi * R1), 'F', 24); }
    else {
      const Ct = 1 / (cp.wi * R1), C2 = Ct * z[0] / p[0], C1 = Ct - C2;
      add('C1', C1, 'F', 24); add('C2', C2, 'F', 24); add('R2', 1 / (z[0] * C1), 'Ω', 96);
      if (cp.type === 3) { const C3 = (1 / z[1] - 1 / p[1]) / R1; add('C3', C3, 'F', 24); add('R3', 1 / (p[1] * C3), 'Ω', 96); }
    }
    if (cfg.Rb !== false) add('Rb', R1 * cfg.Vref / (cfg.Vo - cfg.Vref), 'Ω', 96);
    const r1 = g('R1');
    if (cp.type === 1) real.wi = 1 / (r1 * g('C1'));
    else {
      const c1 = g('C1'), c2 = g('C2'), r2 = g('R2');
      real.wi = 1 / (r1 * (c1 + c2)); real.z.push(1 / (r2 * c1)); real.p.push((c1 + c2) / (r2 * c1 * c2));
      if (cp.type === 3) { const c3 = g('C3'), r3 = g('R3'); real.z.push(1 / ((r1 + r3) * c3)); real.p.push(1 / (r3 * c3)); }
    }
  } else {
    const gm = cfg.gm, Rb = cfg.Rb_ota, Rt = Rb * (cfg.Vo - cfg.Vref) / cfg.Vref, H0 = cfg.Vref / cfg.Vo;
    add('Rt', Rt, 'Ω', 96); add('Rb', Rb, 'Ω', 96);
    const ff = cp.type === 3;
    if (cp.type === 1) add('Cc', H0 * gm / cp.wi, 'F', 24);
    else {
      const Ct = H0 * gm / cp.wi, Cp = Ct * z[0] / p[0], Cc = Ct - Cp;
      add('Cc', Cc, 'F', 24); add('Cp', Cp, 'F', 24); add('Rc', 1 / (z[0] * Cc), 'Ω', 96);
      if (ff) add('Cff', 1 / (z[1] * Rt), 'F', 24);
    }
    const rt = g('Rt'), rb = g('Rb'), h0 = rb / (rt + rb);
    real.Vo = cfg.Vref / h0;
    if (cp.type === 1) real.wi = h0 * gm / g('Cc');
    else {
      const cc = g('Cc'), cpp = g('Cp'), rc = g('Rc');
      real.wi = h0 * gm / (cc + cpp); real.z.push(1 / (rc * cc)); real.p.push((cc + cpp) / (rc * cc * cpp));
      if (ff) { const cf = g('Cff'); real.z.push(1 / (rt * cf)); real.p.push((rt + rb) / (rt * rb * cf)); }
    }
  }
  if (fam === 'opamp' && cfg.Rb !== false) real.Vo = cfg.Vref * (1 + g('R1') / g('Rb'));
  const bad = parts.some(x => !(x.ideal > 0) || !isFinite(x.ideal));
  return { parts, cpReal: real, bad };
};

// 极零点列表（Hz），供表格显示
PS.pzList = function (cp) {
  const L = [{ k: '积分 fi', f: cp.wi / TAU }];
  cp.z.slice().sort((a, b) => a - b).forEach((w, i) => L.push({ k: '零点 fz' + (i + 1), f: w / TAU }));
  cp.p.slice().sort((a, b) => a - b).forEach((w, i) => L.push({ k: '极点 fp' + (i + 1), f: w / TAU }));
  return L;
};

})(typeof window !== 'undefined' ? window : globalThis);
