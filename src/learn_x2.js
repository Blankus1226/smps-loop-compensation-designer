/* 学习扩展②：运放 Type II / Type III —— 元件逐步计算 + 各极零点作用 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num;
const midGain = (cp, f) => C.abs(PS.compEval(cp, C.jw(f)));

Lr.extend('type2', {
  steps(v) {
    if (v.fp <= v.fz) return [{ t: '参数无效', r: 'fp 必须大于 fz，否则 C2 = C1·fz/(fp−fz) 为负' }];
    const R1 = 10e3, wi = TAU * v.fi, wz = TAU * v.fz, wp = TAU * v.fp;
    const Ct = 1 / (wi * R1), C2 = Ct * wz / wp, C1 = Ct - C2, R2 = 1 / (wz * C1), k = Math.sqrt(v.fp / v.fz);
    const cp = { type: 2, wi, z: [wz], p: [wp] }, fm = Math.sqrt(v.fz * v.fp);
    return [
      '已知：fi = ' + hz(v.fi) + '，fz = ' + hz(v.fz) + '，fp = ' + hz(v.fp) + '，取 R1 = 10 kΩ',
      { t: '总电容（由积分增益决定）', f: 'ω<sub>i</sub> = 1/[R1·(C1+C2)]　⇒　C1 + C2 = 1/(2π·fi·R1)', r: 'C1 + C2 = 1/(2π × ' + hz(v.fi) + ' × 10 kΩ) = ' + V(Ct, 'F') },
      { t: '拆分 C2（由极零点比决定）', f: 'ω<sub>p</sub>/ω<sub>z</sub> = (C1+C2)/C2　⇒　C2 = (C1+C2)·fz/fp', r: 'C2 = ' + V(Ct, 'F') + ' × ' + num(v.fz / v.fp) + ' = <b>' + V(C2, 'F') + '</b>' },
      { t: 'C1', f: 'C1 = (C1+C2) − C2', r: 'C1 = <b>' + V(C1, 'F') + '</b>' },
      { t: 'R2（由零点决定）', f: 'ω<sub>z</sub> = 1/(R2·C1)　⇒　R2 = 1/(2π·fz·C1)', r: 'R2 = 1/(2π × ' + hz(v.fz) + ' × ' + V(C1, 'F') + ') = <b>' + V(R2, 'Ω') + '</b>' },
      { t: '回代验证极点', f: 'f<sub>p</sub> = (C1+C2)/(2π·R2·C1·C2)', r: '= ' + hz(Ct / (TAU * R2 * C1 * C2)) + '（应等于 ' + hz(v.fp) + '）' },
      { t: '中频平台增益', f: 'fz ≪ f ≪ fp 时 |Gc| ≈ R2/R1', r: 'R2/R1 = ' + num(R2 / R1) + '（' + Lr.db(R2 / R1) + '）；在 √(fz·fp) = ' + hz(fm) + ' 处精确值 ' + Lr.db(midGain(cp, fm)) },
      { t: '最大相位提升', f: 'φ<sub>max</sub> = arctan√(fp/fz) − arctan√(fz/fp)，出现在 √(fz·fp)', r: 'φ<sub>max</sub> = ' + PS.deg(Math.atan(k) - Math.atan(1 / k)).toFixed(2) + '° @ ' + hz(fm), n: 'Gc 的相位 = −90° + φ，即 fc 放在 √(fz·fp) 时补偿器相位为 ' + (PS.deg(Math.atan(k) - Math.atan(1 / k)) - 90).toFixed(1) + '°。' },
      { t: 'E 系列圆整', r: 'R2 → ' + V(PS.roundE(R2, 96), 'Ω', 3) + '（E96），C1 → ' + V(PS.roundE(C1, 24), 'F', 2) + '，C2 → ' + V(PS.roundE(C2, 24), 'F', 2) + '（E24）', n: '圆整后极零点会偏移几个百分点，设计页会用圆整后的值重算 fc/PM。' }];
  },
  mark: v => [Lr.mk(v.fi, 'fi'), Lr.mk(v.fz, 'fz'), Lr.mk(v.fp, 'fp')],
  roles: v => ({ rows: [
    ['原点极点', 'f = 0', 'C1 + C2（经 R1）', '积分 → 无静差；fz 以下 −20 dB/dec、相位 −90°', '—'],
    ['零点 fz', hz(v.fz), 'R2 · C1', '把斜率由 −20 拉平为 0 dB/dec，相位抬升最多 +90°；电流模式常放在负载极点 1/(2πR·Co) 附近或 fc/K 处', '太低：中低频增益不足，负载阶跃后恢复拖尾；太高：fc 处提升不够，PM 小'],
    ['极点 fp', hz(v.fp), 'R2 · (C1∥C2)', 'fc 以上恢复 −20 dB/dec，衰减开关纹波；常放在 ESR 零点或 fs/2', '太低：抵消掉零点的提升；太高：高频增益大，纹波进入 PWM 比较器（抖动、多次翻转）'],
    ['中频增益 R2/R1', v.fp > v.fz ? Lr.db(v.fi * v.fp / (v.fz * (v.fp - v.fz))) + '（= fi·fp / [fz(fp−fz)]）' : '—', 'R2 / R1', '决定 fc（使 |Gc·P| = 1）', '调 R2 会同时移动 fz 和 fp，实践中先定 R2 再按 fz、fp 算 C1、C2'],
    ['C2 的物理意义', '—', '与 R2·C1 并联', '高频旁路，C2 ≪ C1', 'C2 过大 → fp 接近 fz，提升消失']] }),
});

Lr.extend('type3', {
  steps(v) {
    const R1 = 10e3, w = x => TAU * x, wi = w(v.fi), [z1, z2, p1, p2] = [v.fz1, v.fz2, v.fp1, v.fp2];
    if (!(p1 > z1) || !(p2 > z2)) return [{ t: '参数无效', r: '需要 fp1 > fz1（R2C1C2 网络）且 fp2 > fz2（R3C3 网络），否则元件值为负' }];
    const Ct = 1 / (wi * R1), C2 = Ct * z1 / p1, C1 = Ct - C2, R2 = 1 / (w(z1) * C1);
    const C3 = (1 / w(z2) - 1 / w(p2)) / R1, R3 = 1 / (w(p2) * C3);
    const cp = { type: 3, wi, z: [w(z1), w(z2)], p: [w(p1), w(p2)] }, fpk = [10, 100, 1e3, 1e4, 1e5, 1e6].map(f => [f, PS.deg(C.arg(PS.compEval(cp, C.jw(f))))]);
    const best = PS.logspace(10, 1e7, 400).reduce((a, f) => { const p = PS.deg(C.arg(PS.compEval(cp, C.jw(f)))); return p > a[1] ? [f, p] : a; }, [0, -999]);
    return [
      '已知：fi = ' + hz(v.fi) + '，fz1 = ' + hz(z1) + '，fz2 = ' + hz(z2) + '，fp1 = ' + hz(p1) + '，fp2 = ' + hz(p2) + '，R1 = 10 kΩ',
      '第一组：R2、C1、C2（反馈支路，决定 fi、fz1、fp1）',
      { t: '总电容', f: 'C1 + C2 = 1/(2π·fi·R1)', r: '= ' + V(Ct, 'F') },
      { t: 'C2', f: 'C2 = (C1+C2) · fz1/fp1', r: '= ' + V(Ct, 'F') + ' × ' + num(z1 / p1) + ' = <b>' + V(C2, 'F') + '</b>' },
      { t: 'C1、R2', f: 'C1 = (C1+C2) − C2，R2 = 1/(2π·fz1·C1)', r: 'C1 = <b>' + V(C1, 'F') + '</b>，R2 = <b>' + V(R2, 'Ω') + '</b>' },
      '第二组：R3、C3（输入支路，决定 fz2、fp2）',
      { t: 'C3', f: 'f<sub>z2</sub> = 1/[2π(R1+R3)C3]，f<sub>p2</sub> = 1/(2π·R3·C3)　⇒　C3 = [1/(2πfz2) − 1/(2πfp2)] / R1', r: 'C3 = (' + num(1 / w(z2)) + ' − ' + num(1 / w(p2)) + ') s / 10 kΩ = <b>' + V(C3, 'F') + '</b>' },
      { t: 'R3', f: 'R3 = 1/(2π·fp2·C3)', r: 'R3 = <b>' + V(R3, 'Ω') + '</b>（应 ≪ R1，否则 fz2、fp2 挤在一起）' },
      '增益形状（三段）',
      { t: 'fz1 ～ fz2：平台 R2/R1', r: 'R2/R1 = ' + Lr.db(R2 / R1) },
      { t: 'fz2 ～ fp1：+20 dB/dec 上升段', n: '两个零点都已生效、极点还没到，这一段提供主要的相位提升，fc 通常放在这里。' },
      { t: 'max(fz2, fp1) ～ fp2：高频平台', f: 'Zf ≈ 1/(sC2)，Zi ≈ 1/(sC3)　⇒　|Gc| ≈ C3/C2；fp2 之后 Zi → R1∥R3，增益 −20 dB/dec 下降', r: 'C3/C2 = ' + Lr.db(C3 / C2) + '；在 ' + hz(Math.sqrt(p1 * p2)) + ' 处精确值 ' + Lr.db(C.abs(PS.compEval(cp, C.jw(Math.sqrt(p1 * p2))))) },
      { t: '相位', r: '最大 ' + best[1].toFixed(1) + '° @ ' + hz(best[0]) + '（即最多比积分器的 −90° 多 ' + (best[1] + 90).toFixed(1) + '°）；' + fpk.map(x => hz(x[0]) + ': ' + x[1].toFixed(0) + '°').join('，') }];
  },
  mark: v => [Lr.mk(v.fz1, 'fz1'), Lr.mk(v.fz2, 'fz2'), Lr.mk(v.fp1, 'fp1'), Lr.mk(v.fp2, 'fp2'), Lr.mk(11e3, 'f0')],
  roles: v => ({ rows: [
    ['原点极点', 'f = 0', 'C1 + C2（经 R1）', '积分 → 无静差', '—'],
    ['零点 fz1', hz(v.fz1), 'R2 · C1', '与 fz2 一起抵消 LC 双极点 f0 的 −180°；经典放 0.5·f0～f0（示例 f0 = 11 kHz）', '太高：f0 处相位先跌到 −270°，可能条件稳定；太低：低频增益下降'],
    ['零点 fz2', hz(v.fz2), '(R1 + R3) · C3', '第二个相位提升；经典放 f0 处', '同上；fz2 与 fz1 相距过远时中间出现相位凹陷'],
    ['极点 fp1', hz(v.fp1), 'R2 · (C1∥C2)', '抵消输出电容 ESR 零点 fESR（示例 0.7 MHz），恢复高频衰减；ESR 很小时放 fc·√K', '低于 fc 会吃掉提升；缺失则高频增益 +20 dB/dec 上升'],
    ['极点 fp2', hz(v.fp2), 'R3 · C3', '放在 fs/2：衰减开关纹波、防止 PWM 多次翻转', '太低损失 fc 处相位；太高高频噪声放大'],
    ['Rb', '只影响直流', 'Vref·(1 + R1/Rb) = Vo', '只设定输出电压，运放虚地使它不出现在 AC 传递函数里', '改变 Rb 不影响补偿（OTA 结构除外）']] }),
});
})(typeof window !== 'undefined' ? window : globalThis);
