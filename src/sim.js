/* 逐周期开关级仿真（同步整流 / 强制 CCM）：真实比较器、锁存、导通定时器、
   模拟补偿器（与 RC 圆整后极零点一致）或定点差分方程（与生成的 C 代码逐位一致）。
   负载 = 电阻 Vo/I1 + 阶跃电流源 (I2−I1)，与小信号预测工况一致。 */
(function (G) {
'use strict';
const PS = G.PS;

PS.simulate = function (R, o) {
  o = o || {};
  const P = R.P, mode = P.mode, dig = P.impl === 'digital', topo = P.topo, spp = o.spp || 200;
  const I1 = Math.max(P.Io * P.stepFrom, P.Io * 0.01), I2 = Math.max(P.Io * P.stepTo, P.Io * 0.01), dI = I2 - I1;
  const op = PS.opPoint(P, P.Vin, I1);
  if (!op.ok) return { err: op.err };
  const Ts = 1 / P.fs, dt = Ts / spp, Vin = P.Vin, L = P.L, Cap = P.C, Rc = P.Rc, Rs = op.Rs;
  const Rl = P.Vo / I1, kRl = 1 / (1 + Rc / Rl), H = P.Vref / P.Vo, Ri = P.Ri, ctx = R.ctx, Se = ctx.Se, dg = ctx.dig;
  const fcE = R.mg && isFinite(R.mg.fc) ? R.mg.fc : P.fs / 20;
  const per = x => Math.round(x / Ts) * Ts;
  const seg = per(PS.clamp(6 / fcE, 40 * Ts, 1500 * Ts)), warm = per(PS.clamp(10 / fcE, 80 * Ts, 2500 * Ts));
  const t1 = warm + per(0.3 * seg), t2 = t1 + seg, tEnd = t2 + seg, N = Math.round(tEnd / dt);
  const Vset = (R.rz && R.rz.cpReal.Vo) || P.Vo, Vcmax = P.Vcmax;

  // ---------- 状态向量 [iL, vC, 补偿器...] ----------
  let nx = 2, outer = null, inner = null;
  const mk = cp => { const c = { cp, off: nx, n: 1 + cp.z.length }; nx += c.n; return c; };
  if (!dig && !R.noLoop) outer = mk(R.rz.cpReal);
  if (!dig && mode === 'acm') inner = mk(R.inner.rz.cpReal);
  const x = new Float64Array(nx), xs = new Float64Array(nx), xt = new Float64Array(nx), k1 = new Float64Array(nx), k2 = new Float64Array(nx);
  const Ipk = op.IL + op.dIL / 2, Ival = op.IL - op.dIL / 2;
  const vc0 = { vmc: op.D * P.Vm, pcmc: Ri * Ipk + Se * op.D * Ts, acm: Ri * op.IL, coti: Ri * Ival, cotr: H * (P.Vo - Rc * op.dIL / 2) }[mode];
  const init = (c, v) => { if (!c) return; for (let i = 0; i < c.n; i++) x[c.off + i] = v; };
  x[0] = Ival; x[1] = P.Vo; init(outer, vc0); init(inner, op.D * P.Vm);

  function cRun(c, s, e, dx) {        // 返回限幅后的输出，dx 非空时写导数
    let y = s[c.off]; const cp = c.cp;
    for (let k = 0; k < cp.z.length; k++) {
      const w = s[c.off + 1 + k], p = cp.p[k], r = p / cp.z[k];
      if (dx) dx[c.off + 1 + k] = p * (y - w);
      y = r * y + (1 - r) * w;
    }
    if (dx) dx[c.off] = ((y >= Vcmax && e > 0) || (y <= 0 && e < 0)) ? 0 : cp.wi * e;
    return y < 0 ? 0 : y > Vcmax ? Vcmax : y;
  }
  let ist = 0, vcDig = mode === 'pcmc' ? vc0 : 0;
  const tr = 200e-9;   // 负载阶跃上升/下降时间（与导出的 LTspice 网表一致）
  const iStep = t => t < t1 ? 0 : t < t1 + tr ? dI * (t - t1) / tr : t < t2 ? dI : t < t2 + tr ? dI * (1 - (t - t2) / tr) : 0;
  const vout = (s, q) => (s[1] + Rc * (((topo === 'buck' || !q) ? s[0] : 0) - ist)) * kRl;
  function deriv(s, q, dx) {
    const iL = s[0], iout = (topo === 'buck' || !q) ? iL : 0, vo = (s[1] + Rc * (iout - ist)) * kRl;
    const vL = topo === 'buck' ? (q ? Vin : 0) - vo - iL * Rs : topo === 'boost' ? Vin - (q ? 0 : vo) - iL * Rs : (q ? Vin : -vo) - iL * Rs;
    dx[0] = vL / L; dx[1] = (iout - vo / Rl - ist) / Cap;
    if (outer) { const vc = cRun(outer, s, Vset - vo, dx); if (inner) cRun(inner, s, vc - Ri * iL, dx); }
    else if (inner) cRun(inner, s, 0, dx);
  }
  function step(s, h, q) {
    deriv(s, q, k1); for (let i = 0; i < nx; i++) xt[i] = s[i] + h * k1[i];
    deriv(xt, q, k2); for (let i = 0; i < nx; i++) s[i] += 0.5 * h * (k1[i] + k2[i]);
  }
  const vcOf = (s, q) => mode === 'cotr' && R.noLoop ? P.Vref : dig ? vcDig : cRun(outer, s, Vset - vout(s, q), null);

  // ---------- 数字控制器 ----------
  let cv = null, ci = null, cmp = 0, pend = null, refCode = 0, sampPh = 0;
  if (dig) {
    const ini = PS.digInit(R);
    cv = PS.FixedCtrl(R.qz, ini.umin, ini.umax, ini.u0);
    if (mode === 'acm') ci = PS.FixedCtrl(R.inner.qz, ini.uimin, ini.uimax, ini.ui0);
    refCode = Math.round(dg.Kadc * P.Vref);
    cmp = Math.round(op.D * dg.Npwm);
    sampPh = (spp - Math.round(dg.tc / dt) % spp) % spp;
  }
  const adc = v => Math.max(0, Math.min(dg.adcMax, Math.round(v * dg.Kadc)));
  function sample(q) {
    const vo = vout(x, q), u = cv.step(refCode - adc(H * vo));
    if (mode === 'vmc') pend = Math.max(0, Math.min(Math.floor(P.Dmax * dg.Npwm), u));
    else if (mode === 'pcmc') pend = Math.max(0, Math.min(dg.dacMax, u)) * dg.Kdac;
    else pend = Math.max(0, Math.min(Math.floor(P.Dmax * dg.Npwm), ci.step(u - adc(Ri * x[0]))));
  }

  // ---------- 记录 ----------
  const dec = Math.max(1, Math.round(spp / 40)), rec = { t: [], vo: [], iL: [] }, av = { t: [], v: [] };
  let accV = 0, accN = 0, winEnd = warm + Ts;
  const Ton = op.Ton, Toffmin = Math.min(0.12 * Ts, 250e-9);
  let q = 0, tau = 0, tOn = 0, tOff = -1, nsw = 0;
  const cot = mode === 'coti' || mode === 'cotr';
  const gOff = (s, tt, qq) => mode === 'pcmc' ? Ri * s[0] + Se * tt - vcOf(s, qq)
    : mode === 'vmc' && !dig ? P.Vm * tt / Ts - vcOf(s, qq)
    : mode === 'acm' && !dig ? P.Vm * tt / Ts - cRun(inner, s, 0, null) : -1;
  const gOn = s => mode === 'coti' ? Ri * s[0] - vcOf(s, 0) : H * vout(s, 0) - vcOf(s, 0);

  for (let n = 0; n < N; n++) {
    const t = n * dt;
    ist = iStep(t + dt / 2);
    if (!cot) {
      const ph = n % spp;
      if (ph === 0) {
        if (dig && pend !== null) { if (mode === 'pcmc') vcDig = pend; else cmp = pend; }
        tau = 0; q = 1; nsw++;
        if (gOff(x, 0, 1) >= 0) q = 0;
        if ((mode === 'vmc' || mode === 'acm') && dig && cmp <= 0) q = 0;
      }
      if (dig && ph === sampPh) sample(q);
      if (q) {
        xs.set(x); step(xs, dt, 1);
        let th = 2;
        const tOffT = (mode === 'vmc' || mode === 'acm') && dig ? Math.min(cmp / dg.Npwm, P.Dmax) * Ts : P.Dmax * Ts;
        if (tOffT <= tau + dt + 1e-15) th = Math.max(0, (tOffT - tau) / dt);
        const g0 = gOff(x, tau, 1), g1 = gOff(xs, tau + dt, 1);
        if (g0 >= 0) th = 0; else if (g1 >= 0) th = Math.min(th, g0 / (g0 - g1));
        if (th <= 1) { if (th > 0) step(x, th * dt, 1); q = 0; step(x, (1 - th) * dt, 0); }
        else x.set(xs);
      } else step(x, dt, 0);
      tau += dt;
    } else {
      if (q) {
        const te = tOn + Ton;
        if (te <= t + dt) { const th = Math.max(0, (te - t) / dt); step(x, th * dt, 1); q = 0; tOff = te; step(x, (1 - th) * dt, 0); }
        else step(x, dt, 1);
      } else {
        xs.set(x); step(xs, dt, 0);
        const tm = tOff + Toffmin; let th = 2;
        if (t + dt > tm) {
          const thm = Math.max(0, (tm - t) / dt), g0 = gOn(x), g1 = gOn(xs);
          if (g0 <= 0) th = thm; else if (g1 <= 0) th = Math.max(thm, g0 / (g0 - g1));
        }
        if (th <= 1) { step(x, th * dt, 0); q = 1; tOn = t + th * dt; nsw++; step(x, (1 - th) * dt, 1); }
        else x.set(xs);
      }
    }
    if (t >= warm) {
      const vo = vout(x, q);
      if (n % dec === 0) { rec.t.push(t - warm); rec.vo.push(vo); rec.iL.push(x[0]); }
      accV += vo; accN++;
      if (t + dt >= winEnd - 1e-15) { av.t.push(winEnd - Ts / 2 - warm); av.v.push(accV / accN); accV = 0; accN = 0; winEnd += Ts; }
    }
    if (!isFinite(x[0]) || Math.abs(x[0]) > 1e3 * (op.IL + 1)) return { err: '仿真发散（环路不稳定或参数异常）', rec, av };
  }

  // ---------- 指标 ----------
  const T1 = t1 - warm, T2 = t2 - warm, TE = tEnd - warm, tolV = P.tol / 100 * P.Vo;
  const mean = (a, b) => { let s = 0, c = 0; av.t.forEach((tt, i) => { if (tt >= a && tt < b) { s += av.v[i]; c++; } }); return c ? s / c : NaN; };
  const Vpre = mean(T1 - Math.min(T1, 0.25 * seg), T1);
  function seg1(a, b, sign) {
    const Vf = mean(b - 0.15 * (b - a), b); let ext = 0, last = a;
    av.t.forEach((tt, i) => { if (tt >= a && tt < b) { const d = av.v[i] - Vpre; if (sign * d > sign * ext) ext = d; if (Math.abs(av.v[i] - Vf) > tolV) last = tt; } });
    return { dv: ext, ts: last - a, Vf, settled: last < b - 0.2 * (b - a) };
  }
  const up = seg1(T1, T2, dI > 0 ? -1 : 1), down = seg1(T2, TE, dI > 0 ? 1 : -1);
  const out = { rec, av, T1, T2, TE, I1, I2, Vpre, up, down, fsw: nsw / (tEnd) };

  // ---------- 小信号预测 ----------
  const stable = R.noLoop ? (mode !== 'cotr' || P.Rc * P.C > op.Ton / 2) : (R.mg && R.mg.pm > 0);
  if (stable && isFinite(Vpre)) {
    try {
      const c1 = PS.mkCtx(P, op, R.ctx), Zinf = Rc * Rl / (Rc + Rl);
      const fhi = Math.max(2 * P.fs, mode === 'coti' || mode === 'cotr' ? 1 / op.Ton : 0, 1 / (2 * Math.PI * Rc * Cap));
      const st = PS.stepFromZ(s => PS.zcl(c1, s, R.gc ? R.gc(s) : null), Zinf, TE - T1, fhi);
      // 与仿真的“逐周期平均”同口径：预测曲线也做一个开关周期的滑动平均
      const dv = tt => PS.stepAt(st, tt - T1) - PS.stepAt(st, tt - T2), K = 16;
      const pt = [], pv = [], M = 700;
      for (let i = 0; i <= M; i++) {
        const tt = T1 - 0.1 * seg + (TE - T1 + 0.1 * seg) * i / M; let a = 0;
        for (let k = 0; k < K; k++) a += dv(tt - Ts / 2 + (k + 0.5) * Ts / K);
        pt.push(tt); pv.push(Vpre - dI * a / K);
      }
      out.pred = { t: pt, v: pv };
    } catch (e) { out.predErr = String(e); }
  }
  return out;
};

})(typeof window !== 'undefined' ? window : globalThis);
