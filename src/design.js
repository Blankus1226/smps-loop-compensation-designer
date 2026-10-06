/* 设计总流程：参数 → 工作点 → （内环）→ 外环被控对象 → 自动/手动补偿 → RC/数字实现 → 环路与裕度 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;

PS.MODES = { vmc: '电压模式 VMC', pcmc: '峰值电流模式 PCMC', acm: '平均电流模式 ACM', coti: '电流型 COT', cotr: '纹波型 COT' };
PS.TOPOS = { buck: 'Buck', boost: 'Boost', buckboost: 'Buck-Boost（反相）' };

PS.DEFAULTS = {
  name: '', topo: 'buck', mode: 'vmc', impl: 'analog', family: 'opamp',
  VinMin: 10, Vin: 12, VinMax: 14, Vo: 5, IoMin: 0.3, Io: 3, IoMax: 3,
  fs: 500e3, L: 4.7e-6, RL: 10e-3, C: 44e-6, Rc: 5e-3, Ron: 15e-3, Dmax: 0.92,
  Vref: 0.8, Vm: 1.0, Ri: 0.1, seRatio: 0.5, R1: 10e3, gm: 1e-3, RbOta: 10e3, Vcmax: 5,
  compType: 'auto', method: 'kfactor', fcAuto: true, fc: 30e3, pm: 60,
  fciAuto: true, fci: 50e3, pmi: 60, Rci: 10e3,
  roundE: true, eR: 96, eC: 24,   // 圆整系列：电阻 / 电容
  adcBits: 12, adcFs: 3.3, fclk: 200e6, tcRatio: 1.0, dacBits: 12, dacFs: 3.3, disc: 'tustin',
  stepFrom: 0.5, stepTo: 1.0, tol: 1.0,
  manual: false, m: { type: 3, fz1: 2e3, fz2: 5e3, fp1: 60e3, fp2: 250e3 },
};

PS.PRESETS = [
  { name: '12V→5V Buck · 电压模式 Type III（模拟运放）', p: {} },
  { name: '5V→12V Boost · 峰值电流模式（OTA）', p: { topo: 'boost', mode: 'pcmc', family: 'ota', VinMin: 4.5, Vin: 5, VinMax: 5.5, Vo: 12, IoMin: 0.1, Io: 1, IoMax: 1, fs: 400e3, L: 10e-6, RL: 15e-3, C: 66e-6, Rc: 3e-3, Ron: 20e-3, Ri: 0.25, compType: 'auto' } },
  { name: '12V→−5V Buck-Boost · 数字电压模式', p: { topo: 'buckboost', mode: 'vmc', impl: 'digital', VinMin: 10, Vin: 12, VinMax: 14, Vo: 5, IoMin: 0.2, Io: 2, IoMax: 2, fs: 200e3, L: 22e-6, RL: 20e-3, C: 220e-6, Rc: 10e-3, Ron: 20e-3 } },
  { name: '12V→1.2V Buck · 纹波型 COT（D-CAP 类）', p: { topo: 'buck', mode: 'cotr', VinMin: 10, Vin: 12, VinMax: 14, Vo: 1.2, IoMin: 0.5, Io: 6, IoMax: 6, fs: 500e3, L: 1e-6, RL: 3e-3, C: 220e-6, Rc: 6e-3, Ron: 8e-3, Vref: 0.6, compType: 'auto' } },
  { name: '48V→12V Buck · 平均电流模式（双环）', p: { topo: 'buck', mode: 'acm', VinMin: 36, Vin: 48, VinMax: 60, Vo: 12, IoMin: 0.5, Io: 5, IoMax: 5, fs: 200e3, L: 33e-6, RL: 15e-3, C: 100e-6, Rc: 5e-3, Ron: 20e-3, Ri: 0.1, Vm: 2 } },
  { name: '12V→3.3V Buck · 数字峰值电流模式', p: { topo: 'buck', mode: 'pcmc', impl: 'digital', VinMin: 9, Vin: 12, VinMax: 15, Vo: 3.3, IoMin: 0.3, Io: 4, IoMax: 4, fs: 300e3, L: 4.7e-6, RL: 8e-3, C: 150e-6, Rc: 4e-3, Ron: 12e-3, Ri: 0.15 } },
];
PS.preset = i => Object.assign(PS.clone(PS.DEFAULTS), PS.clone(PS.PRESETS[i].p), { name: PS.PRESETS[i].name });

// 数字链路参数；采样点在 PWM 周期起点前 tc 处，新值在周期起点装载
PS.digParams = function (P, op) {
  const Npwm = Math.max(16, Math.round(P.fclk / P.fs)), tc = P.tcRatio / P.fs;
  return {
    Npwm, tc, Kadc: (Math.pow(2, P.adcBits) - 1) / P.adcFs, Kdac: P.dacFs / (Math.pow(2, P.dacBits) - 1),
    Td: tc + op.D / P.fs, adcMax: Math.pow(2, P.adcBits) - 1, dacMax: Math.pow(2, P.dacBits) - 1,
  };
};
PS.mkCtx = function (P, op, base) {
  const ctx = { P, op, H: P.Vref / P.Vo, Ts: 1 / P.fs, mode: P.mode, impl: P.impl, dig: PS.digParams(P, op) };
  ctx.Se = base && base.Se !== undefined ? base.Se : P.seRatio * op.Sf;
  if (base) { ctx.Gci = base.Gci; ctx.Gdi = base.Gdi; }
  return ctx;
};

PS.autoFc = function (P, op, fci) {
  let fc = P.impl === 'digital' ? P.fs / 20 : P.fs / 10;
  if (P.mode === 'acm') fc = Math.min(fc, fci / 5);
  if (P.mode === 'cotr') fc = P.fs / 20;
  if (P.topo !== 'buck') {
    const w = PS.opPoint(P, P.VinMin, P.IoMax);
    fc = Math.min(fc, w.frhpz / 5);
  }
  // VMC：fc 需高于 LC 谐振约 3 倍，否则 Type III 双零点处低频增益不足
  if (P.mode === 'vmc') fc = Math.max(fc, Math.min(op.f0 * 3, P.fs / (P.impl === 'digital' ? 8 : 5)));
  return PS.nice(fc);
};
PS.autoFci = function (P, op) {
  const dig = P.impl === 'digital';
  return PS.nice(Math.max(P.fs / (dig ? 20 : 10), Math.min(op.f0 * 3, P.fs / (dig ? 8 : 5))));
};

PS.design = function (Pin) {
  const P = Object.assign(PS.clone(PS.DEFAULTS), Pin), R = { P, warn: [], info: [] };
  if (P.topo !== 'buck' && P.mode === 'cotr') { P.mode = 'coti'; R.warn.push('纹波型 COT 仅适用于 Buck，已改为电流型 COT'); }
  if ((P.mode === 'coti' || P.mode === 'cotr') && P.impl === 'digital') { P.impl = 'analog'; R.warn.push('COT 为模拟控制方式，不提供数字实现，已切换为模拟'); }
  if (P.impl === 'digital') P.family = 'digital';
  else if (P.family === 'digital') P.family = 'opamp';
  const op = R.op = PS.opPoint(P, P.Vin, P.Io);
  if (!op.ok) { R.fatal = op.err; return R; }
  const ctx = R.ctx = PS.mkCtx(P, op), dig = P.impl === 'digital', dg = ctx.dig;
  R.fmax = dig ? P.fs / 2 : (P.mode === 'pcmc' ? P.fs * 0.97 : P.fs);
  R.fmin = Math.min(op.f0, P.fs / 1000) / 20;

  // ---------- ACM 内环 ----------
  if (P.mode === 'acm') {
    const fci = R.fci = P.fciAuto ? PS.autoFci(P, op) : P.fci;
    if (fci < 2.5 * op.f0) R.warn.push('电流内环 fci = ' + PS.fmt(fci, 'Hz') + ' 接近 LC 谐振 f0 = ' + PS.fmt(op.f0, 'Hz') + '，内环增益在谐振处有峰，可能多次穿越');
    const Pi = s => PS.innerPlant(ctx, s);
    const kd = PS.kfactor(Pi, fci, P.pmi, { type: 2, family: 'opamp', fpMax: dig ? 0.45 * P.fs : 0 });
    R.inner = { kd, fc: fci, plant: Pi };
    if (dig) {
      const dc = PS.discretize(kd.cp, ctx.Ts, P.disc, fci), qz = PS.quantize(dc);
      R.inner.dc = dc; R.inner.qz = qz;
      ctx.Gdi = s => PS.dEval(qz, s, ctx.Ts);
    } else {
      const rz = PS.realize(kd.cp, 'opamp', { R1: P.Rci, round: P.roundE, eR: P.eR, eC: P.eC, Rb: false });
      R.inner.rz = rz;
      ctx.Gci = s => PS.compEval(rz.cpReal, s);
    }
    const gi = dig ? ctx.Gdi : ctx.Gci;
    R.inner.T = s => C.mul(Pi(s), gi(s));
    R.inner.mg = PS.margins(R.inner.T, R.fmin, R.fmax);
    kd.warn.forEach(w => R.warn.push('电流内环：' + w));
  }

  // ---------- 外环 ----------
  const Pl = R.Pl = s => PS.plantP(ctx, s);
  const kin = R.kin = dig ? dg.Kadc * ctx.H : 1;          // 数字：vo → ADC 码
  const Pd = R.Pd = s => C.sc(Pl(s), kin);                // 设计用对象（数字为 码/码）
  const fc = R.fcTarget = P.fcAuto ? PS.autoFc(P, op, R.fci || P.fs) : P.fc;
  const fam = P.family === 'ota' ? 'ota' : 'opamp', H0 = ctx.H;
  if (P.mode === 'cotr' && P.compType === 'none') {
    R.noLoop = true;
  } else {
    let kd;
    const opt = { type: P.compType, family: fam, H0, fpMax: dig ? 0.45 * P.fs : 0 };
    if (P.manual) kd = PS.manualComp(Pd, fc, P.m, { family: fam, H0 });
    else if (P.method === 'classic' && P.mode === 'vmc' && fam === 'opamp' && !dig) kd = PS.classic3(Pd, fc, op, P);
    else kd = PS.kfactor(Pd, fc, P.pm, opt);
    R.kd = kd; kd.warn.forEach(w => R.warn.push(w));
    if (P.method === 'classic' && !(P.mode === 'vmc' && fam === 'opamp' && !dig) && !P.manual) R.info.push('经典放置法只用于模拟运放 VMC，已改用 K 因子法');
    if (dig) {
      R.dc = PS.discretize(kd.cp, ctx.Ts, P.disc, fc);
      R.qz = PS.quantize(R.dc);
      R.gcIdeal = s => PS.compEval(kd.cp, s);                     // s 域原型（码/码）
      R.gcPlot = s => PS.dEval(R.qz, s, ctx.Ts);
      R.gcFloat = s => PS.dEval(R.dc, s, ctx.Ts);
      R.gc = s => C.sc(R.gcPlot(s), kin);                          // vc/(−vo)
    } else {
      R.rz = PS.realize(kd.cp, fam, { R1: P.R1, Vref: P.Vref, Vo: P.Vo, gm: P.gm, Rb_ota: P.RbOta, round: P.roundE, eR: P.eR, eC: P.eC });
      R.gcIdeal = s => PS.compEval(kd.cp, s);
      R.gcPlot = s => PS.compEval(R.rz.cpReal, s);
      R.gc = R.gcPlot;
      if (R.rz.bad) R.warn.push('元件值计算出非正数，请检查极零点设置（零点应低于对应极点）');
    }
    R.T = s => C.mul(Pd(s), R.gcPlot(s));
    R.Tideal = s => C.mul(Pd(s), R.gcIdeal(s));
    R.mg = PS.margins(R.T, R.fmin, R.fmax);
  }
  PS.checks(R);
  return R;
};

})(typeof window !== 'undefined' ? window : globalThis);
