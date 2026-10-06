/* 学习扩展③：OTA Type II/III、PI、PID —— 实际计算 + 作用 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num;

Lr.extend('ota2', {
  steps(v) {
    if (v.fp <= v.fz) return [{ t: '参数无效', r: 'fp 必须大于 fz' }];
    const Rb = 10e3, Rt = Rb * (v.r - 1), H0 = 1 / v.r, wi = TAU * v.fi;
    const Ct = H0 * v.gm / wi, Cp = Ct * v.fz / v.fp, Cc = Ct - Cp, Rc = 1 / (TAU * v.fz * Cc);
    return [
      '已知：gm = ' + V(v.gm, 'S') + '，Vo/Vref = ' + v.r.toFixed(2) + '，fi = ' + hz(v.fi) + '，fz = ' + hz(v.fz) + '，fp = ' + hz(v.fp),
      { t: '分压电阻', f: 'Rb 取 10 kΩ，Rt = Rb·(Vo/Vref − 1)；H0 = Rb/(Rt+Rb) = Vref/Vo', r: 'Rt = <b>' + V(Rt, 'Ω') + '</b>，H0 = ' + num(H0) + '（' + Lr.db(H0) + '）' },
      { t: '总电容（积分增益）', f: 'ω<sub>i</sub> = H0·gm/(Cc+Cp)　⇒　Cc + Cp = H0·gm/(2π·fi)', r: '= ' + num(H0) + ' × ' + V(v.gm, 'S') + ' / (2π × ' + hz(v.fi) + ') = ' + V(Ct, 'F') },
      { t: 'Cp、Cc', f: 'Cp = (Cc+Cp)·fz/fp，Cc = (Cc+Cp) − Cp', r: 'Cp = <b>' + V(Cp, 'F') + '</b>，Cc = <b>' + V(Cc, 'F') + '</b>' },
      { t: 'Rc（零点）', f: 'Rc = 1/(2π·fz·Cc)', r: 'Rc = <b>' + V(Rc, 'Ω') + '</b>' },
      { t: '中频平台增益', f: '|Gc| ≈ H0·gm·Rc（fz ≪ f ≪ fp）', r: '= ' + num(H0 * v.gm * Rc) + '（' + Lr.db(H0 * v.gm * Rc) + '）', n: '与运放结构不同，分压比 H0 直接乘进环路增益：Vo 越高（H0 越小）需要越大的 Rc。' },
      { t: '有限输出阻抗（实际 OTA）', f: '直流增益被限制为 H0·gm·Ro（Ro 典型 1～10 MΩ）', r: 'Ro = 5 MΩ 时直流增益 ≈ ' + Lr.db(H0 * v.gm * 5e6) + '，低于 f ≈ 1/(2π·Ro·(Cc+Cp)) = ' + hz(1 / (TAU * 5e6 * Ct)) + ' 积分变平' }];
  },
  mark: v => [Lr.mk(v.fz, 'fz'), Lr.mk(v.fp, 'fp')],
  roles: v => ({ rows: [
    ['原点极点', 'f = 0（实际在 1/(2πRo·Cc)）', 'Cc + Cp', '积分 → 无静差', 'OTA 输出阻抗有限，直流增益约 60～80 dB'],
    ['零点 fz', hz(v.fz), 'Rc · Cc', '相位提升；电流模式放在负载极点附近', '同运放 Type II'],
    ['极点 fp', hz(v.fp), 'Rc · (Cc∥Cp)', '衰减开关纹波；Cp 常只有几十 pF', 'Cp 过大 → fp 降低吃掉相位'],
    ['分压比 H0', (1 / v.r).toFixed(3), 'Rb/(Rt+Rb)', '直接乘进增益；Rt、Rb 的绝对值不影响 AC（无 Cff 时）', '改 Vo 就必须重算 Rc'],
    ['gm', V(v.gm, 'S'), '芯片参数', '决定同样 Rc 下的增益', '批次离散 ±20%，按最小值留裕度']] }),
});

Lr.extend('ota3', {
  steps(v) {
    const Rb = 10e3, Vref = 0.8, Vo = Vref * v.r, Rt = Rb * (Vo - Vref) / Vref, Cff = 1 / (TAU * v.fzf * Rt), H0 = 1 / v.r;
    const fpf = 1 / (TAU * (Rt * Rb / (Rt + Rb)) * Cff), k = Math.sqrt(v.r), bst = PS.deg(Math.atan(k) - Math.atan(1 / k));
    return [
      '已知：Vref = 0.8 V，Vo = ' + V(Vo, 'V') + '（Vo/Vref = ' + v.r.toFixed(2) + '），Cff 零点 fz,ff = ' + hz(v.fzf) + '，Rb = 10 kΩ',
      { t: '上分压电阻', f: 'Rt = Rb·(Vo − Vref)/Vref', r: 'Rt = <b>' + V(Rt, 'Ω') + '</b>' },
      { t: 'Cff（由零点决定）', f: 'f<sub>z,ff</sub> = 1/(2π·Rt·Cff)　⇒　Cff = 1/(2π·fz,ff·Rt)', r: 'Cff = <b>' + V(Cff, 'F') + '</b>' },
      { t: '配对极点（不能单独调）', f: 'f<sub>p,ff</sub> = 1/[2π·(Rt∥Rb)·Cff] = f<sub>z,ff</sub> · (Rt+Rb)/Rb = f<sub>z,ff</sub> · Vo/Vref', r: 'f<sub>p,ff</sub> = ' + hz(fpf) + '（= ' + hz(v.fzf) + ' × ' + v.r.toFixed(2) + '）' },
      { t: 'Cff 对能提供的最大相位', f: 'φ = arctan√(Vo/Vref) − arctan√(Vref/Vo)，位于 √(fz,ff·fp,ff) = fz,ff·√(Vo/Vref)', r: 'φ = <b>' + bst.toFixed(2) + '°</b> @ ' + hz(v.fzf * k) },
      { t: '低频与高频分压比', r: '低频 H0 = ' + num(H0) + '（' + Lr.db(H0) + '），高频 → 1（0 dB），中间抬高 ' + Lr.db(v.r), n: 'Vo/Vref = 1.5（如 1.2 V 输出、0.8 V 参考）时只有 ' + (PS.deg(Math.atan(Math.sqrt(1.5)) - Math.atan(1 / Math.sqrt(1.5)))).toFixed(1) + '°，基本无用；12 V/0.8 V 时可达 ' + (PS.deg(Math.atan(Math.sqrt(15)) - Math.atan(1 / Math.sqrt(15)))).toFixed(1) + '°。' },
      { t: '设计时的分配', f: '总提升 = Cff 对 + Type II 部分　⇒　Type II 部分只需 Boost − φ', n: '本工具的 K 因子法就是这样：先算 Cff 对给多少，再用 K = tan[(Boost−φ)/2 + 45°] 设计 Rc/Cc/Cp。' }];
  },
  mark: v => [Lr.mk(v.fzf, 'fz,ff'), Lr.mk(v.fzf * v.r, 'fp,ff')],
  roles: v => ({ rows: [
    ['Cff 零点', hz(v.fzf), 'Rt · Cff', '超前相位；放在 fc/√(Vo/Vref) 使最大提升落在 fc', '太低：提升落在 fc 以下；太高：fc 处提升不足'],
    ['Cff 极点', hz(v.fzf * v.r), '(Rt∥Rb) · Cff', '与零点成对出现，间距 = Vo/Vref', '不可独立设定，Vo ≈ Vref 时几乎没有作用'],
    ['Rc、Cc、Cp', '—', '同 OTA Type II', '提供剩余的相位提升与积分', '—'],
    ['副作用', '—', '—', 'Cff 把输出噪声直接耦合到 FB，高频增益抬高 ' + Lr.db(v.r), '纹波大时需要减小 Cff 或在 FB 加小电容']] }),
});

Lr.extend('pi', {
  steps(v) {
    const R1 = 10e3, fz = v.ki / (TAU * v.kp), R2 = v.kp * R1, C1 = 1 / (v.ki * R1);
    return [
      { t: '改写成零极点形式', f: 'Gc = Kp + Ki/s = (Ki/s)·(1 + s·Kp/Ki)　⇒　ω<sub>i</sub> = Ki，ω<sub>z</sub> = Ki/Kp', r: 'fi = ' + hz(v.ki / TAU) + '，fz = Ki/(2π·Kp) = <b>' + hz(fz) + '</b>' },
      { t: '运放实现（R1 = 10 kΩ）', f: 'Gc = (R2 + 1/sC1)/R1 = R2/R1 + 1/(s·R1·C1)　⇒　Kp = R2/R1，Ki = 1/(R1·C1)', r: 'R2 = Kp·R1 = <b>' + V(R2, 'Ω') + '</b>，C1 = 1/(Ki·R1) = <b>' + V(C1, 'F') + '</b>' },
      { t: '各频段增益', r: 'fz 以下 ≈ Ki/ω（−20 dB/dec），fz 以上 → Kp = ' + Lr.db(v.kp) + '，fz 处 ' + Lr.db(v.kp * Math.SQRT2) + '、相位 −45°' },
      { t: '实际电路要加 C2', f: 'C2 ∥ (R2+C1)，形成高频极点 fp ≈ 1/(2π·R2·C2)', r: '例如 fp = 10·fz → C2 = ' + V(1 / (TAU * 10 * fz * R2), 'F') + '，此时就变成 Type II', n: '纯 PI 高频增益为 Kp 不衰减，开关纹波会原样进入 PWM 比较器。' }];
  },
  mark: v => [Lr.mk(v.ki / (TAU * v.kp), 'fz')],
  roles: v => ({ head: ['参数', '当前值', '对应元件', '作用', '调大的效果'], rows: [
    ['Kp 比例', num(v.kp), 'R2/R1', '高频平台增益，决定 fc', 'fc 右移，带宽升高，PM 视对象而定'],
    ['Ki 积分', V(v.ki, '/s'), '1/(R1·C1)', '低频增益，消除静差', 'fz 右移，低频抑制更强但 fc 处相位更滞后'],
    ['零点 fz = Ki/(2πKp)', hz(v.ki / (TAU * v.kp)), 'R2·C1', '积分 −90° 在此恢复到 0°', 'fz 应低于 fc 3～5 倍，才能在 fc 处保留足够相位'],
    ['（缺）高频极点', '—', '加 C2', '衰减纹波', '必须加，等价为 Type II']] }),
});

Lr.extend('pid', {
  steps(v) {
    const wf = TAU * v.ff, a = v.kd + v.kp / wf, b = v.kp + v.ki / wf, d = b * b - 4 * a * v.ki;
    const st = [
      { t: '通分', f: 'Gc = [(Kd + Kp/ωf)s² + (Kp + Ki/ωf)s + Ki] / [s(1 + s/ωf)]', r: '分子系数：a = ' + num(a) + '，b = ' + num(b) + '，c = Ki = ' + num(v.ki) },
      { t: '求两个零点（分子 = 0）', f: 's = [−b ± √(b² − 4ac)] / 2a', r: '判别式 b² − 4ac = ' + num(d) + (d >= 0 ? '（实根）' : '（复根）') }];
    if (d >= 0) { const r1 = (-b + Math.sqrt(d)) / (2 * a), r2 = (-b - Math.sqrt(d)) / (2 * a); st.push({ t: '零点频率', r: 'fz1 = ' + hz(-r1 / TAU) + '，fz2 = ' + hz(-r2 / TAU) }); }
    else st.push({ t: '复零点对', f: 'ω<sub>n</sub> = √(c/a)，Q = √(a·c)/b', r: 'fn = ' + hz(Math.sqrt(v.ki / a) / TAU) + '，Q = ' + num(Math.sqrt(a * v.ki) / b), n: 'Q > 0.5 时两个零点合并成复数对，相位在 fn 处陡升 180°（类似 LC 双极点的反面），正好可以“对消”LC 谐振。' });
    st.push({ t: '极点', r: '原点极点（积分） + 滤波极点 ff = ' + hz(v.ff) });
    st.push({ t: '高频增益', f: '|Gc(∞)| = Kp + Kd·ωf', r: '= ' + num(v.kp + v.kd * wf) + '（' + Lr.db(v.kp + v.kd * wf) + '）' });
    st.push({ t: '与 Type III 的对应', n: 'PID + 一个高频滤波极点 = Type III：积分↔ωi，两个零点↔fz1/fz2，ωf↔fp1，再加的滤波极点↔fp2。所以“数字 PID”和“3P3Z”本质相同。' });
    return st;
  },
  mark: v => [Lr.mk(v.ff, 'ff')],
  roles: v => ({ head: ['参数', '当前值', '作用', '调大的效果', '注意'], rows: [
    ['Kp', num(v.kp), '中频增益', 'fc 升高', '—'],
    ['Ki', V(v.ki, '/s'), '积分，消除静差', '低频零点右移', '过大降低 fc 处相位'],
    ['Kd', V(v.kd, 's'), '微分，fc 附近超前相位（抵消 LC 双极点）', '零点左移、相位提前', '高频增益 Kd·ωf，放大噪声'],
    ['ωf 微分滤波', hz(v.ff), '限制微分的高频增益', '提升范围更宽', '一般取 fs/4～fs/2']] }),
});
})(typeof window !== 'undefined' ? window : globalThis);
