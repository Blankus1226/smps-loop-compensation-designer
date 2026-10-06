// 开关级仿真 vs 小信号预测：每个预设 + 额外模式组合
const PS = require('./load')();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const cases = PS.PRESETS.map((p, i) => ({ name: p.name, P: PS.preset(i) }));
const extra = [
  ['Buck PCMC 模拟运放', { mode: 'pcmc', Ri: 0.1 }],
  ['Buck ACM 数字', { mode: 'acm', impl: 'digital', fs: 200e3, Vm: 1, Ri: 0.1, L: 22e-6, C: 220e-6, Rc: 10e-3 }],
  ['Buck 电流型 COT', { mode: 'coti', Ri: 0.1 }],
  ['Boost VMC 模拟', { topo: 'boost', mode: 'vmc', Vin: 5, VinMin: 4.5, VinMax: 5.5, Vo: 12, Io: 1, IoMax: 1, IoMin: 0.2, fs: 400e3, L: 10e-6, C: 66e-6, Rc: 3e-3 }],
  ['Buck-Boost PCMC', { topo: 'buckboost', mode: 'pcmc', Vin: 12, Vo: 5, Io: 2, IoMax: 2, IoMin: 0.4, fs: 300e3, L: 15e-6, C: 150e-6, Ri: 0.1 }],
  ['Buck VMC 数字 MPZ', { impl: 'digital', disc: 'mpz', fs: 200e3, L: 10e-6, C: 100e-6 }],
  ['纹波 COT 无 EA', Object.assign({}, PS.PRESETS[3].p, { compType: 'none' })],
];
extra.forEach(([n, p]) => cases.push({ name: n, P: Object.assign(PS.clone(PS.DEFAULTS), p) }));

for (const c of cases) {
  const R = PS.design(c.P);
  if (R.fatal) { ok(false, c.name + ' ' + R.fatal); continue; }
  const t0 = Date.now(), S = PS.simulate(R), ms = Date.now() - t0;
  if (S.err) { ok(false, c.name + ' 仿真错误 ' + S.err); continue; }
  const Vo = c.P.Vo, eDC = (S.Vpre - Vo) / Vo * 100;
  let line = c.name.padEnd(36) + ' ' + ms + 'ms  Vpre=' + S.Vpre.toFixed(4) + ' (' + eDC.toFixed(2) + '%)  fsw=' + PS.fmt(S.fsw, 'Hz') +
    '  ΔV↑=' + PS.fmt(S.up.dv, 'V') + ' ts=' + PS.fmt(S.up.ts, 's');
  if (R.mg) line += '  PM=' + R.mg.pm.toFixed(0);
  if (S.pred) {
    // 预测 vs 仿真的最大偏移比较
    let pmin = Infinity; S.pred.t.forEach((t, i) => { if (t >= S.T1 && t < S.T2) pmin = Math.min(pmin, S.pred.v[i] - S.Vpre); });
    line += '  预测ΔV↑=' + PS.fmt(pmin, 'V');
    const r = Math.abs(pmin) / Math.abs(S.up.dv);
    const large = R.info.some(s => s.indexOf('大信号') >= 0) && !R.noLoop;
    if (large) console.log('INFO ' + line + '  比值 ' + r.toFixed(2) + '（大信号工况，不作比较）');
    else ok(r > 0.6 && r < 1.6, line + '  比值 ' + r.toFixed(2));
  } else console.log('INFO ' + line + '  （无预测）' + (S.predErr || ''));
  if (R.warn.length) console.log('     警告: ' + R.warn.join(' | '));
  ok(Math.abs(eDC) < (c.P.mode === 'cotr' && c.P.compType === 'none' ? 3 : 0.6), c.name + ' 稳态输出误差 ' + eDC.toFixed(3) + '%');
}
console.log(fail ? '\n共 ' + fail + ' 项失败' : '\n全部通过');
process.exit(fail ? 1 : 0);
