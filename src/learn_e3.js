/* 完整设计实例（4 个）：电压模式 Type III / 峰值电流 Boost OTA / 平均电流双环 / 数字 3P3Z */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, Lr = PS.Learn, Ls = PS.Ls, c = Lr.col, hz = Lr.hz, F = Lr.F;
const G2 = '完整设计实例';

function example(o) {
  Lr.add({ id: o.id, group: G2, title: o.title, sl: o.sl, mkP: o.mkP,
    html: o.html + '<p class="muted">下方“实际计算过程”把工具内部的每一步都展开、代入当前数值；结果与“设计”页完全一致，可点按钮把这组参数带到设计页继续做工况扫描、负载阶跃和导出。</p>',
    plotTitle: '开环增益 T、对象 P、补偿器 Gc（用' + (o.dig ? '量化后系数' : '圆整后元件') + '计算）',
    calc(v) {
      const R = PS.design(o.mkP(v));
      if (R.fatal) return { series: [], info: R.fatal, R };
      const series = [{ name: '开环 T', fn: R.T, color: c(1) }, { name: '对象 P', fn: R.Pd, color: c(2), dash: true, width: 1.8 }, { name: '补偿器 Gc', fn: R.gcPlot, color: c(3), width: 1.8 }];
      const vl = [Lr.mk(R.op.f0, 'f0'), Lr.mk(R.op.fesr, 'fESR')].concat(Lr.pzMarks(R.rz ? R.rz.cpReal : R.kd.cp));
      if (isFinite(R.op.frhpz)) vl.push(Lr.mk(R.op.frhpz, 'RHPZ'));
      const sch = R.rz ? PS.schemOf(R.rz, R.P.family) : PS.schem('dig', { adc: R.P.adcBits + ' bit', ord: (R.qz.a.length - 1) + 'P' + (R.qz.a.length - 1) + 'Z', act: 'DPWM', actv: 'N = ' + R.ctx.dig.Npwm });
      const fq = PS.logspace(R.fmin, R.fmax * 0.999, 500), pzv = Lr.pzMarks(R.rz ? R.rz.cpReal : R.kd.cp).filter(m => m.x > R.fmin && m.x < R.fmax);
      const gs = [{ name: o.dig ? 'Gc（量化系数）' : 'Gc（圆整元件）', fn: R.gcPlot, color: c(3) }, { name: o.dig ? 's 域原型' : '理想元件', fn: R.gcIdeal, color: c(2), dash: true, width: 1.5 }];
      const extra = [{ title: '补偿器 Gc 单独的 Bode 图', note: '虚线为' + (o.dig ? ' s 域原型' : '未圆整的理想元件') + '。对照下方作用表理解每个零点（增益拐上去、相位抬起）和极点（增益拐下来、相位回落）。', cfg: Ls.bcfg(gs, fq, { vlines: pzv.concat([{ x: R.mg.fc, label: 'fc' }]), height: 330 }) }];
      if (R.inner) extra.push({ title: '电流内环：开环 Ti、对象与电流补偿器', cfg: Ls.bcfg([{ name: '内环 Ti', fn: R.inner.T, color: c(1) }, { name: '内环对象', fn: R.inner.plant, color: c(2), dash: true }, { name: '电流补偿器', fn: R.ctx.Gci, color: c(3) }], fq, { vlines: [{ x: R.inner.mg.fc, label: 'fci' }], height: 330, ph0: -180 }) });
      return { R, f0: R.fmin, f1: R.fmax * 0.999, mg: R.mg, series, extra, vlines: vl.filter(m => m.x > R.fmin && m.x < R.fmax), sch,
        info: '设计结果：Type ' + ['', 'I', 'II', 'III'][R.kd.type] + '，fc = ' + hz(R.mg.fc) + '，PM = ' + R.mg.pm.toFixed(1) + '°，GM = ' + (isFinite(R.mg.gm) ? R.mg.gm.toFixed(1) + ' dB' : '∞') + (R.inner ? '；内环 fci = ' + hz(R.inner.mg.fc) + '，PMi = ' + R.inner.mg.pm.toFixed(1) + '°' : '') + (R.warn.length ? '。<br>检查：' + R.warn.join('；') : '') };
    },
    steps: (v, r) => r.R ? Lr.designSteps(r.R) : [],
    roles: (v, r) => {
      const R = r.R; if (!R || R.fatal) return { rows: [] };
      const a = PS.pzList(R.kd.cp), b = R.rz ? PS.pzList(R.rz.cpReal) : null, ro = Lr.pzRoles(R);
      return { head: ['极零点', '设计值', R.rz ? '圆整后' : '（数字）', '作用'], rows: a.map((x, i) => [x.k, hz(x.f), b ? hz(b[i].f) : '—', ro[i] ? ro[i].role : '']) };
    } });
}

example({ id: 'ex_vmc', title: '实例①：12 V→5 V Buck 电压模式 Type III',
  html: `<p>场景：12 V 转 5 V/3 A，fs = 500 kHz，L = 4.7 µH，2×22 µF 陶瓷电容（ESR 5 mΩ），运放误差放大器，Vref = 0.8 V。</p>
  <p>难点：陶瓷电容 ESR 零点在 700 kHz 以上，帮不上忙；LC 谐振 11 kHz 处相位跌 180°，fc 选在 50 kHz 时对象相位约 −175°，需要 &gt; 140° 的提升 → 必须 Type III。</p>
  ${F('流程：工作点 → f0、fESR → 选 fc → 读 P(fc) → Boost → K → 双零双极 → ωi → R1 定值算 C1/C2/R2/C3/R3 → E 系列 → 验证')}`,
  sl: [{ k: 'fc', l: '目标 fc', a: 20e3, b: 100e3, v: 50e3, log: true, u: 'Hz' }, { k: 'pm', l: '目标 PM', a: 35, b: 70, v: 60, fmt: x => x.toFixed(0) + '°' }, { k: 'Rc', l: '电容 ESR', a: 1e-3, b: 60e-3, v: 5e-3, log: true, u: 'Ω' }],
  mkP: v => Object.assign(PS.preset(0), { fcAuto: false, fc: v.fc, pm: v.pm, Rc: v.Rc, IoMin: 1 }) });

example({ id: 'ex_pcmc', title: '实例②：5 V→12 V Boost 峰值电流 + OTA Type II',
  html: `<p>场景：5 V 升 12 V/1 A，fs = 400 kHz，L = 10 µH，66 µF，采样增益 Ri = 0.25 V/A，OTA gm = 1 mS。</p>
  <p>要点：①斜坡补偿先把 Qp 调到 ≈1；②电流环把 LC 双极点变成一个负载极点，fc 处相位约 −90°，Type II 足够；③RHPZ 限制带宽，最差工况（4.5 V、1 A）RHPZ ≈ 26 kHz，fc 只能取几 kHz。</p>`,
  sl: [{ k: 'fc', l: '目标 fc', a: 1e3, b: 15e3, v: 5e3, log: true, u: 'Hz' }, { k: 'pm', l: '目标 PM', a: 35, b: 75, v: 60, fmt: x => x.toFixed(0) + '°' }, { k: 'se', l: '斜坡 Se/Sf', a: 0, b: 1.2, v: 0.5, fmt: x => x.toFixed(2) }],
  mkP: v => Object.assign(PS.preset(1), { fcAuto: false, fc: v.fc, pm: v.pm, seRatio: v.se, IoMin: 0.2 }) });

example({ id: 'ex_acm', title: '实例③：48 V→12 V Buck 平均电流双环',
  html: `<p>场景：48 V 转 12 V/5 A，fs = 200 kHz，L = 33 µH，100 µF，Ri = 0.1 V/A，锯齿波 Vm = 2 V。</p>
  <p>步骤：<b>先设计电流内环</b>（对象 Ri·Gid/Vm，fci ≈ fs/10，Type II，PM ≈ 60°）；内环闭合后电压外环的对象近似为“电流源驱动电容 + 负载”，相位约 −90°，再用 Type II 设计外环，fc ≤ fci/5。</p>`,
  sl: [{ k: 'fci', l: '内环 fci', a: 5e3, b: 40e3, v: 20e3, log: true, u: 'Hz' }, { k: 'fc', l: '外环 fc', a: 500, b: 8e3, v: 4e3, log: true, u: 'Hz' }, { k: 'pm', l: '外环 PM', a: 35, b: 75, v: 60, fmt: x => x.toFixed(0) + '°' }],
  mkP: v => Object.assign(PS.preset(4), { fciAuto: false, fci: v.fci, fcAuto: false, fc: v.fc, pm: v.pm, IoMin: 1 }) });

example({ id: 'ex_dig', dig: true, title: '实例④：12 V→3.3 V Buck 数字电压模式 3P3Z',
  html: `<p>场景：12 V 转 3.3 V/5 A，fs = 400 kHz，L = 4.7 µH，220 µF 聚合物电容（ESR 15 mΩ），12 bit ADC（3.3 V 满量程），高分辨率 PWM（等效 2 GHz 时钟）。</p>
  <p>与模拟设计的区别：①对象里多了 ADC 增益与延时 e<sup>−sTd</sup>（Td = tc + D·Ts），fc 处要多补 360°·fc·Td 的相位；②s 域设计后用 Tustin（fc 预畸变）变成 3P3Z；③系数量化成 Q 格式整数，并强制 Σa = 0。拖动 tc/Ts 看延时如何吃掉相位裕度。</p>`,
  sl: [{ k: 'fc', l: '目标 fc', a: 5e3, b: 40e3, v: 20e3, log: true, u: 'Hz' }, { k: 'pm', l: '目标 PM', a: 35, b: 65, v: 50, fmt: x => x.toFixed(0) + '°' }, { k: 'tc', l: '采样提前量 tc/Ts', a: 0.05, b: 1, v: 0.3, fmt: x => x.toFixed(2) }],
  mkP: v => Object.assign(PS.clone(PS.DEFAULTS), { name: '数字 3P3Z 实例', impl: 'digital', Vin: 12, VinMin: 10, VinMax: 14, Vo: 3.3, Io: 5, IoMax: 5, IoMin: 1, fs: 400e3, L: 4.7e-6, RL: 6e-3, C: 220e-6, Rc: 15e-3, Ron: 8e-3, Vref: 0.8, fclk: 2e9, fcAuto: false, fc: v.fc, pm: v.pm, tcRatio: v.tc }) });
})(typeof window !== 'undefined' ? window : globalThis);
