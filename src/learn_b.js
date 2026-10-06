/* 学习：OTA Type II/III、PI、PID */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, F = Lr.F, c = Lr.col;
const hz = x => PS.fmt(x, 'Hz', 3);
const parts = rz => rz.parts.map(p => p.name + ' = ' + PS.fmt(p.val, p.unit)).join('，');

Lr.add({ id: 'ota2', group: '模拟补偿器', title: 'OTA Type II（跨导放大器）',
  html: `<p>OTA 输出的是电流 gm·(Vref − FB)，补偿网络接在输出与地之间，<b>不需要反馈电阻</b>，因此很多集成控制器（COMP 引脚）采用这种结构。区别是分压比 H 直接乘进增益。</p>
  ${F('Gc(s) = H·gm·Z<sub>o</sub>(s)，H = Rb/(Rt+Rb) = Vref/Vo')}
  ${F('Z<sub>o</sub> = (Rc + 1/sCc) ∥ (1/sCp)　⇒　ω<sub>i</sub> = H·gm/(Cc+Cp)，ω<sub>z</sub> = 1/(Rc·Cc)，ω<sub>p</sub> = (Cc+Cp)/(Rc·Cc·Cp)')}
  <p>注意：实际 OTA 有有限输出阻抗 Ro（几 MΩ），低频增益被限制为 H·gm·Ro，本工具按理想积分处理。</p>`,
  sl: [{ k: 'gm', l: '跨导 gm', a: 1e-4, b: 5e-3, v: 1e-3, log: true, u: 'S' }, { k: 'r', l: 'Vo/Vref', a: 1, b: 20, v: 6.25, log: true, fmt: x => x.toFixed(2) },
    { k: 'fi', l: 'fi', a: 100, b: 1e5, v: 3e3, log: true, u: 'Hz' }, { k: 'fz', l: '零点 fz', a: 100, b: 1e6, v: 5e3, log: true, u: 'Hz' }, { k: 'fp', l: '极点 fp', a: 300, b: 3e6, v: 1e5, log: true, u: 'Hz' }],
  calc(v) {
    const cp = { type: 2, wi: TAU * v.fi, z: [TAU * v.fz], p: [TAU * v.fp] };
    const rz = PS.realize(cp, 'ota', { gm: v.gm, Rb_ota: 10e3, Vref: 0.8, Vo: 0.8 * v.r, round: false });
    return { f0: 10, f1: 1e7, series: [{ name: 'Gc', fn: s => PS.compEval(cp, s), color: c(3) }], sch: PS.schemOf(rz, 'ota'),
      info: (rz.bad ? '<b>fp 应大于 fz</b>。' : parts(rz)) + `。同样的极零点，Vo/Vref 越大（H 越小），所需 Cc 越小、Rc 越大。` };
  } });

Lr.add({ id: 'ota3', group: '模拟补偿器', title: 'OTA Type III（Cff 前馈电容）',
  html: `<p>OTA 无法像运放那样在输入侧再加 R3C3，常用做法是在上分压电阻 Rt 上并联 <b>Cff</b>，让分压比本身带一对零极点：</p>
  ${F('H(s) = H<sub>0</sub>·(1 + s·Rt·Cff) / (1 + s·(Rt∥Rb)·Cff)，　f<sub>p,ff</sub> / f<sub>z,ff</sub> = Vo/Vref')}
  <p>这对零极点的<b>间距被输出/参考电压比锁死</b>：Vo/Vref 越大，Cff 能提供的相位越多；Vo 接近 Vref 时几乎没有提升。本工具的 K 因子法会先算 Cff 对能给多少，剩余部分交给 Type II 部分。</p>`,
  sl: [{ k: 'r', l: 'Vo/Vref', a: 1.2, b: 30, v: 6.25, log: true, fmt: x => x.toFixed(2) }, { k: 'fzf', l: 'Cff 零点', a: 1e3, b: 5e5, v: 2e4, log: true, u: 'Hz' }],
  calc(v) {
    const H0 = 1 / v.r, cp = { type: 3, wi: TAU * 3e3, z: [TAU * 5e3, TAU * v.fzf], p: [TAU * 1e5, TAU * v.fzf / H0] };
    const rz = PS.realize(cp, 'ota', { gm: 1e-3, Rb_ota: 10e3, Vref: 0.8, Vo: 0.8 * v.r, round: false });
    const k = Math.sqrt(v.r), bst = PS.deg(Math.atan(k) - Math.atan(1 / k));
    const Hs = s => C.div(C.lin(s, TAU * v.fzf), C.lin(s, TAU * v.fzf / H0));
    return { f0: 10, f1: 1e7, vlines: [v.fzf, v.fzf * v.r], series: [{ name: 'Gc（含 Cff）', fn: s => PS.compEval(cp, s), color: c(3) }, { name: 'Cff 带来的 H(s)/H0', fn: Hs, color: c(4), dash: true }], sch: PS.schemOf(rz, 'ota'),
      info: `Cff 对：fz = ${hz(v.fzf)}，fp = ${hz(v.fzf * v.r)}，最大提升 ${bst.toFixed(1)}°。Cff = ${PS.fmt(rz.parts.find(p => p.name === 'Cff').val, 'F')}。` };
  } });

Lr.add({ id: 'pi', group: '模拟补偿器', title: 'PI 控制器',
  html: `<p>PI = 比例 + 积分，是控制理论里的叫法；在电源里它就是<b>去掉高频极点的 Type II</b>：</p>
  ${F('Gc(s) = K<sub>p</sub> + K<sub>i</sub>/s = (K<sub>i</sub>/s)·(1 + s·K<sub>p</sub>/K<sub>i</sub>)，　零点 f<sub>z</sub> = K<sub>i</sub>/(2π·K<sub>p</sub>)')}
  <p>高频增益恒为 Kp，不衰减开关纹波，实际电路一般会加一个小电容 C2 形成 fp（即 Type II）。数字实现时就是最常见的 2P2Z 的特例。</p>`,
  sl: [{ k: 'kp', l: 'Kp', a: 0.01, b: 100, v: 2, log: true, fmt: x => x.toPrecision(3) }, { k: 'ki', l: 'Ki（1/s）', a: 100, b: 1e7, v: 6e4, log: true, fmt: x => PS.fmt(x, '', 3) }],
  calc(v) {
    const Gc = s => C.add(C.of(v.kp), C.div(C.of(v.ki), s)), fz = v.ki / (TAU * v.kp);
    const R1 = 10e3, R2 = v.kp * R1, C1 = 1 / (v.ki * R1);
    return { f0: 10, f1: 1e7, vlines: [fz], series: [{ name: 'PI', fn: Gc, color: c(3) }], sch: PS.schem('pi', { R1: '10 kΩ', R2: PS.fmt(R2, 'Ω'), C1: PS.fmt(C1, 'F') }),
      info: `零点 fz = ${hz(fz)}；运放实现 R1 = 10 kΩ 时 R2 = Kp·R1 = ${PS.fmt(R2, 'Ω')}，C1 = 1/(Ki·R1) = ${PS.fmt(C1, 'F')}。` };
  } });

Lr.add({ id: 'pid', group: '模拟补偿器', title: 'PID 控制器（带微分滤波）',
  html: `<p>实用 PID 的微分项一定要加滤波极点，否则高频增益无限大：</p>
  ${F('Gc(s) = K<sub>p</sub> + K<sub>i</sub>/s + K<sub>d</sub>·s/(1 + s/ω<sub>f</sub>)')}
  <p>通分后分子是二次式 → 两个零点（可能是复数对），分母有一个原点极点和一个 ω<sub>f</sub> 极点。再加一个高频滤波就和 <b>Type III</b> 等价，所以电压模式 Buck 常被说成“用 PID 控制”。</p>`,
  sl: [{ k: 'kp', l: 'Kp', a: 0.01, b: 100, v: 3, log: true, fmt: x => x.toPrecision(3) }, { k: 'ki', l: 'Ki（1/s）', a: 100, b: 1e7, v: 5e4, log: true, fmt: x => PS.fmt(x, '', 3) },
    { k: 'kd', l: 'Kd（s）', a: 1e-8, b: 1e-3, v: 3e-5, log: true, fmt: x => PS.fmt(x, 's', 3) }, { k: 'ff', l: '微分滤波 ff', a: 1e4, b: 3e6, v: 2e5, log: true, u: 'Hz' }],
  calc(v) {
    const wf = TAU * v.ff, Gc = s => C.add(C.add(C.of(v.kp), C.div(C.of(v.ki), s)), C.div(C.sc(s, v.kd), C.lin(s, wf)));
    // 分子 (Kd + Kp/wf)s² + (Kp + Ki/wf)s + Ki
    const a = v.kd + v.kp / wf, b = v.kp + v.ki / wf, d = b * b - 4 * a * v.ki;
    const z = d >= 0 ? [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)].map(x => hz(-x / TAU)).join(' 和 ') : '复数对，|f| = ' + hz(Math.sqrt(v.ki / a) / TAU);
    return { f0: 10, f1: 1e7, series: [{ name: 'PID', fn: Gc, color: c(3) }], sch: PS.schem('pid', {}),
      info: `两个零点：${z}；滤波极点 ${hz(v.ff)}。Kd 增大 → 高频相位提前更多，但开关噪声被放大。` };
  } });
})(typeof window !== 'undefined' ? window : globalThis);
