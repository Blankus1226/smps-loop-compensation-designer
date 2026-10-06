/* 学习扩展④：数字 2P2Z/3P3Z、延时、Buck、RHPZ、PCMC、COT —— 实际计算 + 作用 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num;
const arr = a => '[' + a.map(x => (+x).toPrecision(6)).join(', ') + ']';

function digSteps(type) {
  return v => {
    const T = 1 / v.fs, z = [v.fz1].concat(type === 3 ? [v.fz2] : []), p = [v.fp1].concat(type === 3 ? [v.fp2] : []);
    const cp = { type, wi: TAU * v.fi, z: z.map(f => TAU * f), p: p.map(f => TAU * f) }, fc = Math.sqrt(v.fz1 * v.fp1), wc = TAU * fc, k = wc / Math.tan(wc * T / 2);
    const dc = PS.discretize(cp, T, 'tustin', fc), qz = PS.quantize(dc), sa = dc.a.reduce((x, y) => x + y, 0);
    const st = [
      '已知：fs = ' + hz(v.fs) + '（T = ' + V(T, 's') + '），fi = ' + hz(v.fi) + '，零点 ' + z.map(hz).join('、') + '，极点 ' + p.map(hz).join('、'),
      { t: '预畸变频率（在此处数字与模拟完全一致）', f: 'f<sub>c</sub> = √(fz1·fp1)', r: 'fc = ' + hz(fc) },
      { t: 'Tustin 系数 κ', f: 'κ = ω<sub>c</sub> / tan(ω<sub>c</sub>T/2)（不预畸变时 κ = 2/T）', r: 'κ = ' + num(k) + '（2/T = ' + num(2 / T) + '）' },
      { t: '逐个因子代入 s = κ(1 − z⁻¹)/(1 + z⁻¹)', f: '积分 ω<sub>i</sub>/s → (ω<sub>i</sub>/κ)·(1 + z⁻¹)/(1 − z⁻¹)；零点 (1 + s/ω<sub>z</sub>) → [(1 + κ/ω<sub>z</sub>) + (1 − κ/ω<sub>z</sub>)z⁻¹] / (1 + z⁻¹)', r: 'ω<sub>i</sub>/κ = ' + num(cp.wi / k) + '；' + z.map(f => '1 ± κ/ωz = ' + num(1 + k / (TAU * f)) + ' / ' + num(1 - k / (TAU * f))).join('；') + '；' + p.map(f => '1 ± κ/ωp = ' + num(1 + k / (TAU * f)) + ' / ' + num(1 - k / (TAU * f))).join('；') },
      { t: '相乘、约去公共 (1 + z⁻¹)、按 a0 = 1 归一化', r: 'b = ' + arr(dc.b) + '<br>a = ' + arr(dc.a) },
      { t: '检查积分极点', f: 'Σa<sub>i</sub> = 1 + a1 + a2 + … 应 = 0（z = 1 为根）', r: 'Σa = ' + sa.toExponential(2) },
      { t: '选 Q 格式', f: 'Q = 30 − ⌈log₂(max|系数|)⌉，限制在 8～28', r: 'max|系数| = ' + num(Math.max(...dc.b.map(Math.abs), ...dc.a.map(Math.abs))) + ' → <b>Q' + qz.Q + '</b>（1 = ' + Math.pow(2, qz.Q) + '）' },
      { t: '量化并强制 Σa = 0', f: 'B<sub>i</sub> = round(b<sub>i</sub>·2<sup>Q</sup>)，A<sub>N</sub> = −(A0 + … + A<sub>N−1</sub>)', r: 'B = [' + qz.bq.join(', ') + ']<br>A = [' + qz.aq.join(', ') + ']', n: '最大相对误差 ' + (Math.max(...qz.err) * 100).toExponential(1) + '%。A 的末项被修正，使量化后积分极点仍精确在 z = 1，不会静差漂移。' },
      { t: '差分方程（每个周期执行一次）', f: 'u[n] = (Σ B<sub>i</sub>·e[n−i] − Σ<sub>i≥1</sub> A<sub>i</sub>·u[n−i]) &gt;&gt; Q', r: 'u[n] = ' + dc.b.map((b, i) => num(b) + '·e[n' + (i ? '−' + i : '') + ']').join(' + ') + dc.a.slice(1).map((a, i) => (a > 0 ? ' − ' : ' + ') + num(Math.abs(a)) + '·u[n−' + (i + 1) + ']').join('') }];
    p.forEach(f => { if (f > 0.4 * v.fs) st.push({ t: '注意', r: '极点 ' + hz(f) + ' 已超过 0.4·fs，Tustin 会把它压缩到 Nyquist 以内，数字曲线明显偏离模拟原型' }); });
    return st;
  };
}
const digRoles = type => v => ({ head: ['z 域零极点', '位置', '来自', '作用', '注意'], rows: [
  ['z = 1 极点', '—', '积分器 ωi/s', '数字积分，无静差', '量化后必须保证 Σa = 0'],
  ['零点 z<sub>z</sub> = (κ/ωz − 1)/(κ/ωz + 1)', v.fz1 ? hz(v.fz1) + (type === 3 ? '、' + hz(v.fz2) : '') : '', 's 域零点', '与模拟零点作用相同（相位提升）', '零点很低时 z<sub>z</sub> → 1，系数对量化更敏感'],
  ['极点 z<sub>p</sub>', hz(v.fp1) + (type === 3 ? '、' + hz(v.fp2) : ''), 's 域极点', '衰减高频；数字控制里也用来滤掉 ADC 噪声', '接近 Nyquist 的极点会被频率压缩'],
  ['z = −1 零点', 'fs/2', 'Tustin 自动产生', 'Nyquist 处增益为 0，天然抑制开关频率附近噪声', 'MPZ 法要手动补 (1 + z⁻¹)'],
  ['κ 预畸变', '—', 'fc', '保证 fc 处幅相与模拟原型完全一致', '不预畸变时 fc 处会有相位误差']] });
Lr.extend('d2p2z', { steps: digSteps(2), roles: digRoles(2), mark: v => [Lr.mk(v.fz1, 'fz1'), Lr.mk(v.fp1, 'fp1'), Lr.mk(v.fs / 2, 'fs/2')] });
Lr.extend('d3p3z', { steps: digSteps(3), roles: digRoles(3), mark: v => [Lr.mk(v.fz1, 'fz1'), Lr.mk(v.fz2, 'fz2'), Lr.mk(v.fp1, 'fp1'), Lr.mk(v.fp2, 'fp2'), Lr.mk(v.fs / 2, 'fs/2')] });

Lr.extend('delay', {
  steps(v) {
    const Ts = 1 / v.fs, Td = (v.tc + v.D) * Ts, fc = v.r * v.fs, ph = 360 * fc * Td;
    return [
      { t: '延时组成', f: 'Td = tc（采样到 PWM 周期起点）+ D·Ts（后沿调制的平均延时）', r: 'Td = (' + v.tc.toFixed(2) + ' + ' + v.D.toFixed(2) + ') × ' + V(Ts, 's') + ' = <b>' + V(Td, 's') + '</b>' },
      { t: 'fc 处的相位损失', f: 'Δφ = 360° · fc · Td = 360° · (fc/fs) · (tc/Ts + D)', r: '360 × ' + hz(fc) + ' × ' + V(Td, 's') + ' = <b>' + ph.toFixed(2) + '°</b>' },
      { t: '对设计的影响', r: '补偿器要多提供 ' + ph.toFixed(1) + '° 提升；' + (ph > 40 ? '损失过大，建议降低 fc 或把采样点后移（减小 tc）' : ph > 20 ? '可接受，但 Type III 的余量会变小' : '影响较小'), n: '把 fc 从 fs/10 降到 fs/20，相位损失减半。' },
      { t: 'ZOH 的等效延时', f: 'ZOH = (1 − e<sup>−sT</sup>)/(sT) ≈ e<sup>−sT/2</sup>', r: 'fc 处约 ' + (180 * fc * Ts).toFixed(2) + '°（仅作对比；本工具的 DPWM 延时已包含 D·Ts 项）' }];
  },
  mark: v => [Lr.mk(v.r * v.fs, 'fc')],
  roles: { head: ['延时来源', '典型值', '怎样减小'], rows: [['ADC 转换 + 采样保持', '0.1～1 µs', '用快速 ADC、触发点靠近 PWM 更新'], ['控制计算', '0.5～3 µs', '定点运算、CLA/协处理器、预计算部分项'], ['PWM 影子寄存器更新', '0～1 Ts', '计算完立即更新（需防止中途改变占空比）'], ['后沿调制 D·Ts', 'D·Ts', '采用双更新、对称 PWM 可减半']] },
});
})(typeof window !== 'undefined' ? window : globalThis);
