/* 学习：基础概念 + 运放 Type I/II/III */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, T = Lr.tf, F = Lr.F, N = Lr.N, c = Lr.col;
const hz = x => PS.fmt(x, 'Hz', 3);
// 示例对象：Buck 电压模式 Vin=12, f0≈11 kHz, Q≈3, ESR 零点 0.7 MHz
const plantV = s => C.sc(C.div(C.lin(s, TAU * 7e5), C.quad(s, TAU * 11e3, 3)), 12);

Lr.add({ id: 'pmgm', group: '基础概念', title: '稳定性：相位裕度与增益裕度',
  html: `<p>闭环稳定性看 <b>开环增益 T(s) = Gc(s)·P(s)</b> 的 Bode 图。|T| 穿过 0 dB 的频率叫 <b>穿越频率 fc</b>，它近似就是闭环带宽，决定动态响应快慢。</p>
  ${F('PM = 180° + ∠T(j2π·fc)　　GM = −20·log<sub>10</sub>|T(j2π·f<sub>180</sub>)|，其中 ∠T(f<sub>180</sub>) = −180°')}
  <ul><li>PM 太小 → 阶跃响应振铃大；PM &lt; 0 → 不稳定。工程上 PM 取 45°～60°，GM ≥ 6～10 dB。</li>
  <li>负反馈的 −180° 已经包含在“相位到 −180° 即失稳”的判据里，所以 Bode 图上看的是 ∠T 距离 −180° 还有多远。</li>
  <li>延时 e<sup>−sTd</sup> 不改变幅值，但相位滞后 360°·f·Td，随频率线性增长——数字控制的主要相位损失来源。</li></ul>`,
  sl: [{ k: 'g', l: '环路增益', a: 0.05, b: 20, v: 1, log: true, fmt: x => (20 * Math.log10(x)).toFixed(1) + ' dB' },
    { k: 'td', l: '附加延时 Td', a: 0, b: 6e-6, v: 0, u: 's' }],
  calc(v) {
    const Gc = T.comp(2.2e3, [5e3, 9e3], [1.2e5, 2.5e5]);
    const Tf = s => C.mul(C.sc(C.mul(Gc(s), plantV(s)), v.g), C.exp(C.sc(s, -v.td)));
    const mg = PS.margins(Tf, 10, 2e6);
    return { f0: 10, f1: 2e6, mg, series: [{ name: '开环 T', fn: Tf, color: c(1) }],
      info: `fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}。${mg.pm < 0 ? '<b>已不稳定</b>。' : mg.pm < 30 ? '裕度过小，振铃明显。' : ''}增大增益 → fc 右移；加延时 → 相位在高频迅速下垂，PM、GM 同时变小。` };
  } });

Lr.add({ id: 'kfac', group: '基础概念', title: 'K 因子法（Venable）',
  html: `<p>K 因子法把“要多少相位提升”直接换算成零极点位置，是本工具自动设计的核心算法。</p>
  ${F('所需提升 Boost = PM<sub>目标</sub> − 90° − ∠P(fc)　（积分器固定贡献 −90°）')}
  ${F('Type II：K = tan(Boost/2 + 45°)，fz = fc/K，fp = fc·K')}
  ${F('Type III：K = [tan(Boost/4 + 45°)]²，双零点 fc/√K，双极点 fc·√K')}
  <p>然后选增益使 |Gc(fc)·P(fc)| = 1。Boost ≤ 0 用 Type I，&lt; 约 70° 用 Type II，更大用 Type III（理论极限 180°，实用 ≲ 155°）。</p>`,
  sl: [{ k: 'fc', l: '目标 fc', a: 5e3, b: 1e5, v: 40e3, log: true, u: 'Hz' }, { k: 'pm', l: '目标 PM', a: 20, b: 80, v: 55, fmt: x => x.toFixed(0) + '°' }],
  calc(v) {
    const kd = PS.kfactor(plantV, v.fc, v.pm, { type: 'auto', family: 'opamp' }), Gc = s => PS.compEval(kd.cp, s), Tf = s => C.mul(Gc(s), plantV(s));
    const mg = PS.margins(Tf, 10, 2e6), pl = PS.pzList(kd.cp).map(x => x.k + ' ' + hz(x.f)).join('，');
    return { f0: 10, f1: 2e6, mg, series: [{ name: '开环 T', fn: Tf, color: c(1) }, { name: '对象 P', fn: plantV, color: c(2) }, { name: '补偿器 Gc', fn: Gc, color: c(3) }],
      info: `∠P(fc) = ${kd.phPlant.toFixed(1)}°，所需提升 ${kd.boost.toFixed(1)}° → 自动选 <b>Type ${kd.type}</b>${kd.K ? '，K = ' + kd.K.toFixed(2) : ''}。${pl}。实测 PM = ${PS.fmtNum(mg.pm, 1)}°。${kd.warn.join(' ')}` };
  } });

Lr.add({ id: 'type1', group: '模拟补偿器', title: 'Type I：积分器',
  html: `<p>最简单的补偿：一个原点极点。直流增益无穷大 → 无静差；相位恒为 −90°，<b>不提供任何相位提升</b>。</p>
  ${F('Gc(s) = ω<sub>i</sub> / s，　ω<sub>i</sub> = 1/(R1·C1)')}
  <p>只适合对象在 fc 附近相位已接近 0° 的场合（例如纹波型 COT 的外环、或带宽要求很低的电流模式）。</p>`,
  sl: [{ k: 'fi', l: '积分器 0 dB 频率 fi', a: 100, b: 1e5, v: 3e3, log: true, u: 'Hz' }],
  calc(v) {
    const R1 = 10e3, C1 = 1 / (TAU * v.fi * R1);
    return { f0: 10, f1: 1e7, series: [{ name: 'Gc', fn: T.integ(TAU * v.fi), color: c(3) }], sch: PS.schem('op1', { R1: '10 kΩ', C1: PS.fmt(C1, 'F') }),
      info: `R1 = 10 kΩ 时 C1 = ${PS.fmt(C1, 'F')}。幅值 −20 dB/dec，相位恒 −90°。` };
  } });

Lr.add({ id: 'type2', group: '模拟补偿器', title: 'Type II：积分 + 一对零极点',
  html: `<p>在积分器上加一个零点 fz 和一个极点 fp。在 fz～fp 之间相位“鼓起”，最大提升发生在两者的几何中点 √(fz·fp)。</p>
  ${F('Gc(s) = (ω<sub>i</sub>/s)·(1 + s/ω<sub>z</sub>)/(1 + s/ω<sub>p</sub>)')}
  ${F('ω<sub>i</sub> = 1/[R1(C1+C2)]，ω<sub>z</sub> = 1/(R2·C1)，ω<sub>p</sub> = (C1+C2)/(R2·C1·C2)')}
  ${F('最大相位提升 = arctan√(fp/fz) − arctan√(fz/fp)　（&lt; 90°）')}
  <p>典型用于 <b>峰值/平均电流模式</b>：对象只有一个低频极点，fc 处相位约 −90°，Type II 的提升足够。</p>`,
  sl: [{ k: 'fi', l: 'fi', a: 100, b: 1e5, v: 3e3, log: true, u: 'Hz' }, { k: 'fz', l: '零点 fz', a: 100, b: 1e6, v: 5e3, log: true, u: 'Hz' }, { k: 'fp', l: '极点 fp', a: 300, b: 3e6, v: 1e5, log: true, u: 'Hz' }],
  calc(v) {
    const cp = { type: 2, wi: TAU * v.fi, z: [TAU * v.fz], p: [TAU * v.fp] }, rz = PS.realize(cp, 'opamp', { R1: 10e3, round: false, Rb: false });
    const k = Math.sqrt(v.fp / v.fz), bst = PS.deg(Math.atan(k) - Math.atan(1 / k));
    return { f0: 10, f1: 1e7, vlines: [v.fz, v.fp], series: [{ name: 'Gc', fn: s => PS.compEval(cp, s), color: c(3) }], sch: PS.schemOf(rz, 'opamp'),
      info: v.fp <= v.fz ? '<b>fp 应大于 fz</b>，否则变成相位滞后，元件值出现负数。' : `最大提升 ${bst.toFixed(1)}° 出现在 ${hz(Math.sqrt(v.fz * v.fp))}。元件：` + rz.parts.map(p => p.name + ' = ' + PS.fmt(p.val, p.unit)).join('，') };
  } });

Lr.add({ id: 'type3', group: '模拟补偿器', title: 'Type III：积分 + 两对零极点',
  html: `<p>两个零点、两个极点，相位提升接近 180°。<b>电压模式</b>的标准选择：LC 双极点在谐振后带来 −180° 相移，需要两个零点抵消。</p>
  ${F('Gc(s) = (ω<sub>i</sub>/s)·(1+s/ω<sub>z1</sub>)(1+s/ω<sub>z2</sub>) / [(1+s/ω<sub>p1</sub>)(1+s/ω<sub>p2</sub>)]')}
  ${F('ω<sub>z1</sub> = 1/(R2C1)，ω<sub>p1</sub> = (C1+C2)/(R2C1C2)，ω<sub>z2</sub> = 1/[(R1+R3)C3]，ω<sub>p2</sub> = 1/(R3C3)')}
  <p>经典放置：两个零点放在 LC 谐振 f0 附近（一个略低于 f0），一个极点抵消 ESR 零点，另一个放在 fs/2 抑制开关噪声。K 因子法则把双零点放在 fc/√K、双极点放在 fc·√K。</p>`,
  sl: [{ k: 'fi', l: 'fi', a: 100, b: 1e5, v: 2e3, log: true, u: 'Hz' }, { k: 'fz1', l: '零点 fz1', a: 100, b: 1e6, v: 5e3, log: true, u: 'Hz' }, { k: 'fz2', l: '零点 fz2', a: 100, b: 1e6, v: 1e4, log: true, u: 'Hz' },
    { k: 'fp1', l: '极点 fp1', a: 300, b: 3e6, v: 1.2e5, log: true, u: 'Hz' }, { k: 'fp2', l: '极点 fp2', a: 300, b: 3e6, v: 2.5e5, log: true, u: 'Hz' }],
  calc(v) {
    const cp = { type: 3, wi: TAU * v.fi, z: [TAU * v.fz1, TAU * v.fz2], p: [TAU * v.fp1, TAU * v.fp2] }, rz = PS.realize(cp, 'opamp', { R1: 10e3, round: false, Rb: false });
    const Gc = s => PS.compEval(cp, s), Tf = s => C.mul(Gc(s), plantV(s)), mg = PS.margins(Tf, 10, 2e6);
    return { f0: 10, f1: 1e7, mg, series: [{ name: 'Gc', fn: Gc, color: c(3) }, { name: '开环 T（配示例 Buck）', fn: Tf, color: c(1) }, { name: '对象 P', fn: plantV, color: c(2), dash: true, width: 1.5 }], sch: PS.schemOf(rz, 'opamp'),
      info: (rz.bad ? '<b>零点需低于配对极点（fz1&lt;fp1、fz2&lt;fp2）</b>。' : '元件：' + rz.parts.map(p => p.name + ' = ' + PS.fmt(p.val, p.unit)).join('，') + '。') + ` 配示例 Buck（f0 = 11 kHz）：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°。` };
  } });
})(typeof window !== 'undefined' ? window : globalThis);
