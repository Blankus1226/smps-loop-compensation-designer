/* 学习扩展①：PM/GM、K 因子、Type I —— 实际计算过程 + 各极零点作用 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, num = Lr.num;
const plantV = s => C.sc(C.div(C.lin(s, TAU * 7e5), C.quad(s, TAU * 11e3, 3)), 12);

Lr.extend('pmgm', {
  steps(v, r) {
    const mg = r.mg, st = [];
    if (!isFinite(mg.fc)) return [{ t: '没有 0 dB 穿越', r: '|T| 全频段小于 1（增益太低）或大于 1，无法定义 PM。' }];
    const phc = PS.interp({ x: mg.f, y: mg.ph }, mg.fc);
    st.push({ t: '找穿越频率 fc：|T(j2πf)| = 1', f: '在 Bode 幅值曲线上找 0 dB 交点', r: 'fc = ' + hz(mg.fc) + (mg.crossings > 1 ? '（共 ' + mg.crossings + ' 次穿越，取最后一次）' : '') });
    st.push({ t: '读 fc 处开环相位', r: '∠T(fc) = ' + phc.toFixed(2) + '°' });
    st.push({ t: '相位裕度', f: 'PM = 180° + ∠T(fc)', r: 'PM = 180° + (' + phc.toFixed(2) + '°) = <b>' + mg.pm.toFixed(2) + '°</b>' });
    if (isFinite(mg.fgm)) st.push({ t: '找相位穿越频率 f180：∠T = −180°', r: 'f180 = ' + hz(mg.fgm) }, { t: '增益裕度', f: 'GM = −|T(f180)|<sub>dB</sub>', r: 'GM = <b>' + mg.gm.toFixed(2) + ' dB</b>（增益再增大 ' + Math.pow(10, mg.gm / 20).toFixed(2) + ' 倍才失稳）' });
    else st.push({ t: '相位始终没有到 −180°', r: 'GM = ∞' });
    if (v.td > 0) st.push({ t: '延时造成的额外相位滞后', f: 'Δφ = 360° · fc · Td', r: '360 × ' + hz(mg.fc) + ' × ' + Lr.v(v.td, 's') + ' = ' + (360 * mg.fc * v.td).toFixed(2) + '°' });
    const zeta = mg.pm > 0 ? mg.pm / 100 : NaN, os = zeta > 0 && zeta < 1 ? 100 * Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta)) : 0;
    st.push({ t: '经验换算：闭环阻尼与阶跃超调', f: 'ζ ≈ PM/100（PM &lt; 70° 时适用），超调 ≈ e<sup>−πζ/√(1−ζ²)</sup>', r: 'ζ ≈ ' + (zeta || 0).toFixed(2) + '，超调约 ' + os.toFixed(0) + '%', n: 'PM = 45° 约 23% 超调，PM = 60° 约 9%，PM = 30° 约 37%。' });
    return st;
  },
  roles: { head: ['指标', '定义', '工程目标', '太小的后果', '太大的代价'], rows: [
    ['fc 穿越频率', '|T| = 0 dB 处', '电压模式 fs/10～fs/5；Boost 类 &lt; fRHPZ/5；数字 ≤ fs/20', '负载阶跃跌落大、恢复慢', '开关纹波进入环路，平均模型失效，对噪声敏感'],
    ['PM 相位裕度', '180° + ∠T(fc)', '45°～60°（最差工况 ≥ 40°）', '振铃、超调大；&lt; 0 不稳定', '响应变“钝”，同样 fc 下跌落略大'],
    ['GM 增益裕度', '∠T = −180° 时距 0 dB 的距离', '≥ 6～10 dB', '元件容差、温漂下可能失稳', '一般无代价'],
    ['延时 Td', '控制计算 + 采样 + PWM 更新', '数字控制尽量 ≤ 1.5·Ts', '—', '每 Hz 吃掉 360°·Td 相位，限制 fc']] },
});

Lr.extend('kfac', {
  steps(v) {
    const kd = PS.kfactor(plantV, v.fc, v.pm, { type: 'auto', family: 'opamp' }), s = C.jw(v.fc), Pm = C.abs(plantV(s)), st = [];
    st.push('第 1 步：读对象在 fc 处的增益和相位');
    st.push({ t: '对象 P(j2π·fc)', r: '|P| = ' + num(Pm) + '（' + Lr.db(Pm) + '），∠P = ' + kd.phPlant.toFixed(2) + '°' });
    st.push('第 2 步：所需相位提升');
    st.push({ t: 'Boost', f: 'Boost = PM<sub>目标</sub> − 90° − ∠P(fc)', r: v.pm.toFixed(1) + '° − 90° − (' + kd.phPlant.toFixed(2) + '°) = <b>' + kd.boost.toFixed(2) + '°</b>' });
    st.push({ t: '选类型', r: 'Boost ' + (kd.boost <= 3 ? '≤ 3° → Type I' : kd.boost <= 70 ? '在 3°～70° → Type II' : '&gt; 70° → Type III') + ' → <b>Type ' + kd.type + '</b>' });
    st.push('第 3 步：K 因子与零极点');
    if (kd.type === 2) {
      st.push({ t: 'K', f: 'K = tan(Boost/2 + 45°)', r: 'tan(' + (Math.min(kd.boost, 85) / 2 + 45).toFixed(2) + '°) = <b>' + kd.K.toFixed(4) + '</b>' });
      st.push({ t: '零点与极点', f: 'fz = fc / K，fp = fc · K', r: 'fz = ' + hz(v.fc / kd.K) + '，fp = ' + hz(v.fc * kd.K) });
    } else if (kd.type === 3) {
      const b = Math.min(kd.boost, 155);
      st.push({ t: 'K', f: 'K = [tan(Boost/4 + 45°)]²', r: '[tan(' + (b / 4 + 45).toFixed(2) + '°)]² = <b>' + kd.K.toFixed(4) + '</b>，√K = ' + Math.sqrt(kd.K).toFixed(4) });
      st.push({ t: '双零点与双极点', f: 'fz1 = fz2 = fc / √K，fp1 = fp2 = fc · √K', r: 'fz = ' + hz(v.fc / Math.sqrt(kd.K)) + '，fp = ' + hz(v.fc * Math.sqrt(kd.K)) });
    } else st.push({ t: 'Type I', r: '不需要零极点' });
    st.push('第 4 步：增益');
    const sh = C.abs(PS.compShape(kd.cp, s));
    st.push({ t: '积分增益 ωi（使 |Gc·P| = 1）', f: 'ω<sub>i</sub> = 2π·fc / ( |P(fc)| · |Π(1+s/ωz)/Π(1+s/ωp)|<sub>fc</sub> )', r: '2π × ' + hz(v.fc) + ' / (' + num(Pm) + ' × ' + num(sh) + ') = ' + num(kd.cp.wi) + ' rad/s → fi = ' + hz(kd.cp.wi / TAU) });
    const mg = PS.margins(x => C.mul(PS.compEval(kd.cp, x), plantV(x)), 10, 2e6);
    st.push('第 5 步：验证');
    st.push({ t: '实测', r: 'fc = ' + hz(mg.fc) + '，PM = ' + mg.pm.toFixed(2) + '°' + (kd.warn.length ? '。' + kd.warn.join(' ') : ''), n: 'fc 处零极点关于 fc 对称（几何中点），所以相位提升恰好在 fc 达到最大值。' });
    return st;
  },
  mark: v => [Lr.mk(v.fc, 'fc')],
  roles: { head: ['K 值', 'Type II 提升', 'Type III 提升', '零极点间距', '代价'], rows: [
    ['K = 1', '0°', '0°', '零点 = 极点', '—'],
    ['K = 2', '36.9°', '73.7°', 'fz = fc/2，fp = 2fc', '轻微'],
    ['K = 4', '61.9°', '123.9°（√K = 2）', 'fz = fc/4，fp = 4fc', 'fc 以下增益抬得少，低频抑制变弱'],
    ['K = 10', '78.6°', '157°（√K = 3.16）', '间距 100 倍', '高频增益大、噪声放大；低频增益下降'],
    ['规律', '提升 = 2·arctan(K) − 90°', '提升 = 4·arctan(√K) − 180°', '对称放在 fc 两侧', 'K 越大越“贵”，优先降 fc 或改拓扑']] },
});

Lr.extend('type1', {
  steps(v) {
    const R1 = 10e3, C1 = 1 / (TAU * v.fi * R1);
    return [{ t: '选输入电阻', r: 'R1 = 10 kΩ（与分压网络阻抗匹配，通常 1～100 kΩ）' },
      { t: '由 fi 求积分电容', f: 'f<sub>i</sub> = 1 / (2π·R1·C1)　⇒　C1 = 1 / (2π·fi·R1)', r: 'C1 = 1 / (2π × ' + hz(v.fi) + ' × 10 kΩ) = <b>' + Lr.v(C1, 'F') + '</b>' },
      { t: '任意频率的增益', f: '|Gc(f)| = fi / f', r: '1 kHz 处 ' + Lr.db(v.fi / 1e3) + '；10 kHz 处 ' + Lr.db(v.fi / 1e4) },
      { t: '与对象配合', f: 'fc 处 |Gc|·|P| = 1　⇒　fi = fc / |P(fc)|', n: '若对象在 fc 处 |P| = 2（6 dB），想要 fc = 10 kHz，则 fi = 5 kHz。' }];
  },
  mark: v => [Lr.mk(v.fi, 'fi')],
  roles: v => ({ rows: [
    ['原点极点', 'f = 0', 'C1（与 R1）', '直流增益 ∞ → 输出电压无静差；整个频段 −20 dB/dec、相位 −90°', '—（必须有）'],
    ['fi（0 dB 频率）', hz(v.fi) + ' 处 |Gc| = 1', 'R1·C1', '决定环路整体增益，从而决定 fc', '太大：fc 过高、相位不够；太小：带宽低、跌落大'],
    ['适用场合', '—', '—', '对象在 fc 附近相位已接近 0°，不需要提升', '用于 LC 电压模式会直接不稳定（−90° −180°）']] }),
});
})(typeof window !== 'undefined' ? window : globalThis);
