/* 完整设计实例：把一次 PS.design() 的结果展开成逐步计算（K 因子 → 元件 / 离散化 → 验证） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num, dg = Lr.deg;
const f = w => w / TAU;

// K 因子与零极点放置（opamp / ota / 数字共用）
Lr.kSteps = function (kd, fc, ota, H0) {
  const st = [], t = kd.type, b = kd.boost;
  st.push({ t: '选择补偿器类型', f: 'Boost ≤ 3° → Type I；3°～70° → Type II；> 70° → Type III', r: 'Boost = ' + dg(b) + ' → <b>Type ' + ['', 'I', 'II', 'III'][t] + '</b>' });
  if (t === 2) {
    const bb = Math.max(5, Math.min(b, 85));
    st.push({ t: 'K 因子', f: 'K = tan(Boost/2 + 45°)', r: 'K = tan(' + (bb / 2 + 45).toFixed(3) + '°) = <b>' + kd.K.toFixed(4) + '</b>' });
    st.push({ t: '零点与极点', f: 'fz = fc/K，fp = fc·K', r: 'fz = ' + hz(fc) + ' / ' + kd.K.toFixed(3) + ' = <b>' + hz(f(kd.cp.z[0])) + '</b>，fp = <b>' + hz(f(kd.cp.p[0])) + '</b>' });
  } else if (t === 3 && ota) {
    const bff = kd.cp.bff, kff = Math.sqrt(1 / H0), r = Math.max(5, Math.min(b - bff, 85));
    st.push({ t: 'Cff 对能提供的提升', f: 'φ<sub>ff</sub> = arctan√(Vo/Vref) − arctan√(Vref/Vo)', r: 'φff = ' + dg(bff) + '（Vo/Vref = ' + (1 / H0).toFixed(3) + '）' });
    st.push({ t: 'Cff 对放置（最大提升落在 fc）', f: 'fz,ff = fc·√H0，fp,ff = fc/√H0', r: 'fz,ff = ' + hz(f(kd.cp.z[1])) + '，fp,ff = ' + hz(f(kd.cp.p[1])) + '（√(Vo/Vref) = ' + kff.toFixed(3) + '）' });
    st.push({ t: '剩余提升交给 Type II 部分', f: 'K = tan[(Boost − φff)/2 + 45°]', r: 'K = tan(' + (r / 2 + 45).toFixed(3) + '°) = <b>' + kd.K.toFixed(4) + '</b>；fz1 = ' + hz(f(kd.cp.z[0])) + '，fp1 = ' + hz(f(kd.cp.p[0])) });
  } else if (t === 3) {
    const bb = Math.max(10, Math.min(b, 155));
    st.push({ t: 'K 因子', f: 'K = [tan(Boost/4 + 45°)]²', r: 'K = [tan(' + (bb / 4 + 45).toFixed(3) + '°)]² = <b>' + kd.K.toFixed(4) + '</b>，√K = ' + Math.sqrt(kd.K).toFixed(4) });
    st.push({ t: '双零点与双极点', f: 'fz1 = fz2 = fc/√K，fp1 = fp2 = fc·√K', r: 'fz = <b>' + hz(f(kd.cp.z[0])) + '</b>，fp = <b>' + hz(f(kd.cp.p[0])) + '</b>' + (kd.cp.p[1] !== kd.cp.p[0] ? '（fp2 被限制为 ' + hz(f(kd.cp.p[1])) + '）' : '') });
  } else st.push({ t: 'Type I', r: '不需要零极点，只有积分器' });
  if (kd.warn.length) st.push({ t: '设计告警', r: kd.warn.join('；') });
  return st;
};
// 积分增益：使 |Gc·P| = 1
Lr.gainStep = (kd, Pm, fc) => {
  const sh = C.abs(PS.compShape(kd.cp, C.jw(fc)));
  return { t: '积分增益（让 fc 处 |Gc·P| = 1）', f: 'ω<sub>i</sub> = 2π·fc / [ |P(fc)| · |Π(1+s/ω<sub>z</sub>)/Π(1+s/ω<sub>p</sub>)|<sub>fc</sub> ]', r: 'ωi = 2π × ' + hz(fc) + ' / (' + num(Pm) + ' × ' + num(sh) + ') = ' + num(kd.cp.wi) + ' rad/s → <b>fi = ' + hz(f(kd.cp.wi)) + '</b>' };
};
// 模拟元件计算（与 PS.realize 完全相同的公式）
Lr.partSteps = function (cp, rz, fam, cfg) {
  const st = [], z = cp.z, p = cp.p, t = cp.type, g = n => { const x = rz.parts.find(q => q.name === n); return x ? x.ideal : NaN; };
  if (fam === 'ota') {
    const H0 = cfg.Vref / cfg.Vo;
    st.push({ t: '分压电阻', f: 'Rb = ' + V(cfg.Rb, 'Ω') + '，Rt = Rb·(Vo − Vref)/Vref', r: 'Rt = <b>' + V(g('Rt'), 'Ω') + '</b>，H0 = ' + num(H0) });
    if (t === 1) st.push({ t: 'Cc', f: 'Cc = H0·gm / ωi', r: 'Cc = <b>' + V(g('Cc'), 'F') + '</b>' });
    else {
      st.push({ t: '总电容', f: 'Cc + Cp = H0·gm / ωi', r: '= ' + num(H0) + ' × ' + V(cfg.gm, 'S') + ' / ' + num(cp.wi) + ' = ' + V(g('Cc') + g('Cp'), 'F') });
      st.push({ t: 'Cp、Cc、Rc', f: 'Cp = (Cc+Cp)·fz1/fp1，Cc = (Cc+Cp) − Cp，Rc = 1/(ωz1·Cc)', r: 'Cp = <b>' + V(g('Cp'), 'F') + '</b>，Cc = <b>' + V(g('Cc'), 'F') + '</b>，Rc = <b>' + V(g('Rc'), 'Ω') + '</b>' });
      if (t === 3) st.push({ t: 'Cff', f: 'Cff = 1/(ωz,ff·Rt)', r: 'Cff = <b>' + V(g('Cff'), 'F') + '</b>' });
    }
  } else {
    const R1 = cfg.R1;
    st.push({ t: '输入电阻（上分压电阻）', r: 'R1 = ' + V(R1, 'Ω') + '（取定值，其余元件按它缩放）' });
    if (t === 1) st.push({ t: 'C1', f: 'C1 = 1/(ωi·R1)', r: 'C1 = <b>' + V(g('C1'), 'F') + '</b>' });
    else {
      const Ct = 1 / (cp.wi * R1);
      st.push({ t: '总电容', f: 'C1 + C2 = 1/(ωi·R1)', r: '= 1/(' + num(cp.wi) + ' × ' + V(R1, 'Ω') + ') = ' + V(Ct, 'F') });
      st.push({ t: 'C2、C1、R2', f: 'C2 = (C1+C2)·fz1/fp1，C1 = (C1+C2) − C2，R2 = 1/(ωz1·C1)', r: 'C2 = <b>' + V(g('C2'), 'F') + '</b>，C1 = <b>' + V(g('C1'), 'F') + '</b>，R2 = <b>' + V(g('R2'), 'Ω') + '</b>' });
      if (t === 3) st.push({ t: 'C3、R3', f: 'C3 = (1/ωz2 − 1/ωp2)/R1，R3 = 1/(ωp2·C3)', r: 'C3 = (' + num(1 / z[1]) + ' − ' + num(1 / p[1]) + ')/' + V(R1, 'Ω') + ' = <b>' + V(g('C3'), 'F') + '</b>，R3 = <b>' + V(g('R3'), 'Ω') + '</b>' });
    }
    if (g('Rb') > 0) st.push({ t: '下分压电阻（只定直流）', f: 'Rb = R1·Vref/(Vo − Vref)', r: 'Rb = <b>' + V(g('Rb'), 'Ω') + '</b>' });
  }
  if (cfg.round) {
    st.push({ t: '圆整到 E 系列（R → E96，C → E24）', r: rz.parts.map(q => q.name + ' ' + V(q.ideal, q.unit, 4) + ' → <b>' + V(q.val, q.unit, 3) + '</b>').join('；') });
    const a = PS.pzList(cp), b = PS.pzList(rz.cpReal);
    st.push({ t: '圆整后实际极零点', r: a.map((x, i) => x.k + ' ' + hz(x.f) + ' → ' + hz(b[i].f) + '（' + ((b[i].f / x.f - 1) * 100).toFixed(1) + '%）').join('；') });
  }
  return st;
};
// 数字离散化与量化
Lr.discSteps = function (cp, dc, qz, T, fc, method) {
  const st = [], wc = TAU * fc;
  if (method === 'mpz') st.push({ t: '零极点匹配', f: 'z<sub>i</sub> = e<sup>−ω·T</sup>，积分 → z = 1，补 (1 + z⁻¹) 使阶数一致，在 fc 处匹配增益', r: '零点 ' + cp.z.map(w => num(Math.exp(-w * T))).join('、') + '；极点 ' + cp.p.map(w => num(Math.exp(-w * T))).join('、') });
  else { const k = wc / Math.tan(wc * T / 2); st.push({ t: 'Tustin（fc 预畸变）', f: 's = κ(1 − z⁻¹)/(1 + z⁻¹)，κ = ωc / tan(ωcT/2)', r: 'κ = ' + num(k) + '（2/T = ' + num(2 / T) + '）' }); }
  st.push({ t: '差分方程系数', r: 'b = [' + dc.b.map(num).join(', ') + ']<br>a = [' + dc.a.map(num).join(', ') + ']，Σa = ' + dc.a.reduce((x, y) => x + y, 0).toExponential(1) });
  st.push({ t: '定点量化', f: 'Q = 30 − ⌈log₂ max|系数|⌉；末项 A<sub>N</sub> 修正使 ΣA = 0', r: '<b>Q' + qz.Q + '</b>：B = [' + qz.bq.join(', ') + ']，A = [' + qz.aq.join(', ') + ']' });
  return st;
};
})(typeof window !== 'undefined' ? window : globalThis);
