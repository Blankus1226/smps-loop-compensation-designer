// 数学核心验证：解析式对照、K 因子达标、离散化、量化、阶跃反变换
const PS = require('./load')(), C = PS.C;
let fail = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// 1. Buck Gvd 对照解析式 Vin·Zp/(ZL+Zp)
{
  const P = Object.assign(PS.clone(PS.DEFAULTS), {}), op = PS.opPoint(P, 12, 3), s = C.jw(7e3);
  const g = PS.Gvd(op, P, s).Gvd, w = PS.rows(op, P, s);
  const ZL = C.addr(C.sc(s, P.L), op.Rs), ref = C.sc(C.div(w.Zp, C.add(ZL, w.Zp)), 12);
  ok(near(C.abs(g), C.abs(ref), 1e-9), 'Buck Gvd 与解析式一致 |G|=' + C.abs(g).toFixed(4));
  const g0 = PS.Gvd(op, P, C.jw(1)).Gvd;
  ok(near(C.abs(g0), 12 * op.R / (op.R + op.Rs), 1e-3), 'Buck 直流增益 ≈ Vin·R/(R+Rs)');
}
// 2. Boost RHPZ：|Gvd| 相位在 frhpz 附近比 LHP 零点情况多滞后
{
  const P = PS.preset(1), op = PS.opPoint(P, 5, 1);
  const fz = op.frhpz, a = PS.bode(s => PS.Gvd(op, P, s).Gvd, PS.logspace(10, fz * 10, 400));
  ok(a.ph[a.ph.length - 1] < -200, 'Boost Gvd 高频相位 < −200°（RHPZ + 双极点）：' + a.ph[a.ph.length - 1].toFixed(0));
  ok(near(op.Vo, 12, 1e-9) && op.D > 0.55 && op.D < 0.62, 'Boost D = ' + op.D.toFixed(4));
}
// 3. 每个预设：K 因子设计后实际 PM 接近目标，fc 接近目标
PS.PRESETS.forEach((pr, i) => {
  const R = PS.design(PS.preset(i));
  if (R.fatal) { ok(false, pr.name + ' 致命错误 ' + R.fatal); return; }
  const mg = R.mg;
  console.log('   ' + pr.name + ' fc=' + PS.fmt(mg.fc, 'Hz') + ' 目标 ' + PS.fmt(R.fcTarget, 'Hz') + ' PM=' + mg.pm.toFixed(1) + ' GM=' + mg.gm.toFixed(1) + ' type=' + R.kd.type + ' boost=' + R.kd.boost.toFixed(1));
  ok(near(mg.fc, R.fcTarget, 0.15), pr.name + ' fc 命中');
  ok(mg.pm > 35, pr.name + ' PM > 35°');
  if (R.inner) console.log('   内环 fc=' + PS.fmt(R.inner.mg.fc, 'Hz') + ' PM=' + R.inner.mg.pm.toFixed(1));
  if (R.warn.length) console.log('   警告: ' + R.warn.join(' | '));
});
// 4. 理想（未圆整）元件：实现后极零点与设计一致
{
  const P = PS.preset(0); P.roundE = false;
  const R = PS.design(P), a = R.kd.cp, b = R.rz.cpReal;
  ok(near(a.wi, b.wi, 1e-9) && a.z.every((w, i) => near(w, b.z[i], 1e-9)) && a.p.every((w, i) => near(w, b.p[i], 1e-9)), '运放 Type III 元件反算极零点一致');
  const P2 = PS.preset(1); P2.roundE = false; P2.compType = 3;
  const R2 = PS.design(P2), c = R2.kd.cp, d = R2.rz.cpReal;
  ok(near(c.wi, d.wi, 1e-9) && c.z.every((w, i) => near(w, d.z[i], 1e-9)) && c.p.every((w, i) => near(w, d.p[i], 1e-9)), 'OTA Type III（Cff）元件反算一致');
}
// 4b. E 系列：长度、IEC 60063 例外值、按所选系列圆整
{
  const S = PS.E_SERIES;
  ok([6, 12, 24, 48, 96, 192].every(n => S[n].length === n), 'E6…E192 各含 N 个值');
  ok(S[192].includes(920) && !S[192].includes(919) && S[48].includes(464), 'E192 例外 9.20、E48 取值正确');
  ok(PS.roundE(4.53e3, 12) === 4.7e3 && PS.roundE(4.53e3, 48) === 4.64e3 && PS.roundE(4.53e3, 96) === 4.53e3, '同一阻值按系列圆整到不同标称值');
  const vals = (eR, eC) => { const P = PS.preset(0); P.eR = eR; P.eC = eC; return PS.design(P).rz.parts.map(p => p.val).join(); };
  ok(vals(96, 24) !== vals(12, 6) && vals(96, 24) !== vals(96, 12), '切换电阻/电容系列后元件值随之改变');
  const P = PS.preset(0); P.eR = 6; P.eC = 6;
  ok(PS.design(P).rz.parts.every(p => S[6].some(x => Math.abs(p.val / Math.pow(10, Math.floor(Math.log10(p.val))) * 10 - x) < 1e-6)), 'E6 设计的全部元件都落在 E6 上');
}
// 5. 离散化：Tustin 在 fc 处与模拟原型一致；量化后积分极点精确
{
  const cp = { type: 3, wi: 2e4, z: [2e4, 5e4], p: [6e5, 1.2e6] }, T = 1 / 200e3, fc = 10e3;
  const dc = PS.discretize(cp, T, 'tustin', fc), s = C.jw(fc);
  const ga = PS.compEval(cp, s), gd = PS.dEval(dc, s, T);
  ok(near(C.abs(ga), C.abs(gd), 1e-6) && Math.abs(C.arg(ga) - C.arg(gd)) < 1e-6, 'Tustin 预畸变 fc 处幅相一致');
  ok(dc.a.length === 4 && dc.b.length === 4, 'Type III → 3P3Z');
  const gl = PS.dEval(dc, C.jw(100), T), gla = PS.compEval(cp, C.jw(100));
  ok(near(C.abs(gl), C.abs(gla), 0.01), '低频 100 Hz 一致');
  const m = PS.discretize(cp, T, 'mpz', fc);
  ok(near(C.abs(PS.dEval(m, s, T)), C.abs(ga), 1e-6), 'MPZ 在 fc 处增益匹配');
  const qz = PS.quantize(dc);
  ok(qz.aq.reduce((x, y) => x + y, 0) === 0, '量化后 Σa = 0（积分极点在 z=1）');
  const fx = PS.FixedCtrl(qz, -1e9, 1e9, 0); let y = 0;
  for (let k = 0; k < 50; k++) y = fx.step(10);
  ok(y > 0, '定点控制器对正误差积分为正 y=' + y);
}
// 6. 阶跃反变换：Z(s) = R/(1+sRC) 阶跃应为 R(1−e^{−t/RC})
{
  const Rr = 2, Cc = 1e-5, tau = Rr * Cc, st = PS.stepFromZ(s => C.div(C.of(Rr), C.addr(C.sc(s, tau), 1)), 0, 10 * tau, 1e6);
  let e = 0; for (const t of [0.2, 0.5, 1, 2, 4].map(x => x * tau)) e = Math.max(e, Math.abs(PS.stepAt(st, t) - Rr * (1 - Math.exp(-t / tau))));
  ok(e < 0.01 * Rr, '一阶阶跃反变换误差 ' + (e / Rr * 100).toFixed(3) + '%');
  const st2 = PS.stepFromZ(s => C.of(0.5), 0.5, 1e-3, 1e6);
  ok(Math.abs(PS.stepAt(st2, 5e-4) - 0.5) < 1e-6, '常数阻抗阶跃 = 跳变');
}
console.log(fail ? '\n共 ' + fail + ' 项失败' : '\n全部通过');
process.exit(fail ? 1 : 0);
