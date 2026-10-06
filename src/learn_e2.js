/* 完整设计实例：逐步计算总流程 + 4 个可交互实例（结果与“设计”页完全同源） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num, dg = Lr.deg;

Lr.innerSteps = function (R) {
  const P = R.P, I = R.inner, fci = I.fc, s = C.jw(fci), Pv = I.plant(s), Pm = C.abs(Pv), ph = PS.phaseAt(I.plant, fci), dig = P.impl === 'digital';
  const st = ['电流内环（先设计，外环把它当成对象的一部分）'];
  st.push({ t: '内环带宽', f: '模拟 fci ≈ fs/10，数字 ≈ fs/20，且 ≥ 3·f0', r: 'fci = <b>' + hz(fci) + '</b>' });
  st.push({ t: '内环对象', f: dig ? 'P<sub>i</sub> = Kadc·Ri·e<sup>−sTd</sup>·G<sub>id</sub>(s) / Npwm' : 'P<sub>i</sub> = Ri·G<sub>id</sub>(s) / Vm，G<sub>id</sub> = îL/d̂', r: '|Pi(fci)| = ' + num(Pm) + '（' + Lr.db(Pm) + '），∠Pi = ' + dg(ph) });
  st.push({ t: '所需提升', f: 'Boost = PMi − 90° − ∠Pi', r: P.pmi + '° − 90° − (' + dg(ph) + ') = ' + dg(I.kd.boost) });
  Lr.kSteps(I.kd, fci, false).forEach(x => st.push(x));
  st.push(Lr.gainStep(I.kd, Pm, fci));
  if (I.rz) Lr.partSteps(I.kd.cp, I.rz, 'opamp', { R1: P.Rci, round: P.roundE, eR: P.eR, eC: P.eC }).forEach(x => st.push(x));
  if (I.dc) Lr.discSteps(I.kd.cp, I.dc, I.qz, R.ctx.Ts, fci, P.disc).forEach(x => st.push(x));
  st.push({ t: '内环结果', r: 'fci = ' + hz(I.mg.fc) + '，PMi = ' + dg(I.mg.pm) });
  return st;
};

Lr.designSteps = function (R) {
  const P = R.P, op = R.op, dig = P.impl === 'digital', st = [];
  if (R.fatal) return [{ t: '设计无效', r: R.fatal }];
  st.push('一、工作点');
  st.push({ t: '占空比（含 DCR、Rds(on) 损耗）', f: { buck: 'D = (Vo + Io·Rs)/Vin', boost: 'D′ = [Vin + √(Vin² − 4Vo·Io·Rs)]/(2Vo)', buckboost: 'D′ = [Vin + √(Vin² − 4(Vin+Vo)·Io·Rs)]/[2(Vin+Vo)]' }[P.topo], r: 'Rs = ' + V(op.Rs, 'Ω') + ' → <b>D = ' + op.D.toFixed(4) + '</b>，IL = ' + V(op.IL, 'A') + '，R = ' + V(op.R, 'Ω') });
  st.push({ t: '电感纹波', f: 'ΔIL = V<sub>on</sub>·D·Ts / L', r: 'ΔIL = ' + V(op.Von, 'V') + ' × ' + op.D.toFixed(3) + ' × ' + V(op.Ts, 's') + ' / ' + V(P.L, 'H') + ' = ' + V(op.dIL, 'A') });
  st.push('二、功率级特征频率');
  st.push({ t: 'LC 谐振', f: P.topo === 'buck' ? 'f0 = 1/(2π√(LC))' : 'f0 = D′/(2π√(LC))', r: 'f0 = <b>' + hz(op.f0) + '</b>' });
  st.push({ t: 'ESR 零点', f: 'fESR = 1/(2π·Rc·C)', r: 'fESR = ' + hz(op.fesr) });
  if (P.topo !== 'buck') st.push({ t: '右半平面零点', f: P.topo === 'boost' ? 'fRHPZ = R·D′²/(2πL)' : 'fRHPZ = R·D′²/(2πL·D)', r: '标称 ' + hz(op.frhpz) + '，最差工况（Vin 最低、Io 最大）' + hz(R.frhpzWorst) });
  if (P.mode === 'pcmc') {
    const q = PS.pcmcQ(op, R.ctx.Se);
    st.push({ t: '峰值电流模式斜坡', f: 'Sn = Ri·Von/L，Sf = Ri·Voff/L，Se = (Se/Sf)·Sf，mc = 1 + Se/Sn，Qp = 1/[π(mc·D′ − 0.5)]', r: 'Sn = ' + V(op.Sn, 'V/s') + '，Sf = ' + V(op.Sf, 'V/s') + '，Se = ' + V(R.ctx.Se, 'V/s') + '，mc = ' + q.mc.toFixed(3) + '，<b>Qp = ' + (q.Qp > 0 ? q.Qp.toFixed(3) : '<0') + '</b>' });
    st.push({ t: '调制器增益', f: 'Fm = 1/[(Sn + Se)·Ts]', r: 'Fm = ' + num(PS.Fm(op, R.ctx.Se)) });
  }
  if (P.mode === 'vmc' && !dig) st.push({ t: 'PWM 增益', f: 'd̂/v̂c = 1/Vm', r: '1/' + V(P.Vm, 'V') + ' = ' + num(1 / P.Vm) });
  if (P.mode === 'cotr' || P.mode === 'coti') st.push({ t: 'COT 导通时间', f: 'Ton = D·Ts（自适应）', r: 'Ton = ' + V(op.Ton, 's') + '，双极点 1/(2Ton) = ' + hz(1 / (2 * op.Ton)) + (P.mode === 'cotr' ? '，rc·C = ' + V(P.Rc * P.C, 's') + ' vs Ton/2 = ' + V(op.Ton / 2, 's') : '') });
  if (dig) {
    const d = R.ctx.dig;
    st.push('三、数字链路');
    st.push({ t: 'PWM 计数与 ADC 增益', f: 'Npwm = fclk/fs，Kadc = 2<sup>N</sup>/VFS（码/V），H = Vref/Vo', r: 'Npwm = ' + d.Npwm + '，Kadc = ' + num(d.Kadc) + '，H = ' + num(R.ctx.H) + ' → Vo 的 1 LSB = ' + V(1 / (d.Kadc * R.ctx.H), 'V') });
    st.push({ t: '总延时', f: 'Td = tc + D·Ts', r: 'Td = ' + V(d.Td, 's') + '（' + (d.Td * P.fs).toFixed(2) + ' Ts）' });
  }
  if (R.inner) Lr.innerSteps(R).forEach(x => st.push(x));
  st.push((dig ? '四' : '三') + '、外环' + (R.noLoop ? '（无误差放大器）' : '补偿器'));
  if (R.noLoop) { st.push({ t: '结果', r: '纹波型 COT 直接比较 FB 与 Vref，没有外环补偿器' }); return st; }
  const fc = R.fcTarget, s = C.jw(fc), Pm = C.abs(R.Pd(s)), kd = R.kd;
  st.push({ t: '选 fc', f: P.fcAuto ? (dig ? 'fs/20' : P.mode === 'cotr' ? 'fs/20' : 'fs/10') + (P.topo !== 'buck' ? '，且 ≤ 最差 fRHPZ/5' : '') + (P.mode === 'vmc' ? '，且 ≥ 3·f0' : '') + (P.mode === 'acm' ? '，且 ≤ fci/5' : '') : '手动指定', r: 'fc = <b>' + hz(fc) + '</b>' });
  st.push({ t: '设计用对象 P(fc)', f: dig ? 'P = Kadc·H·Gvc(s)，含延时 e<sup>−sTd</sup>（码/码）' : P.mode === 'vmc' ? 'P = Gvd(s)/Vm' : P.mode === 'acm' ? 'P = v̂o/îref（电流内环已闭合）' : 'P = v̂o/v̂c（电流环已闭合）', r: '|P| = ' + num(Pm) + '（' + Lr.db(Pm) + '），∠P = ' + dg(kd.phPlant) });
  if (P.method === 'classic' && kd.K === undefined && !P.manual) st.push({ t: '经典放置', r: 'fz1 = 0.5·f0，fz2 = f0，fp1 = fESR（不低于 1.5fc），fp2 = fs/2' });
  else if (P.manual) st.push({ t: '手动极零点', r: PS.pzList(kd.cp).map(x => x.k + ' ' + hz(x.f)).join('，') });
  else {
    st.push({ t: '所需相位提升', f: 'Boost = PM − 90° − ∠P(fc)', r: P.pm + '° − 90° − (' + dg(kd.phPlant) + ') = <b>' + dg(kd.boost) + '</b>' });
    Lr.kSteps(kd, fc, P.family === 'ota' && !dig, R.ctx.H).forEach(x => st.push(x));
  }
  st.push(Lr.gainStep(kd, Pm, fc));
  if (R.rz) Lr.partSteps(kd.cp, R.rz, P.family, { R1: P.R1, Rb: P.RbOta, gm: P.gm, Vref: P.Vref, Vo: P.Vo, round: P.roundE, eR: P.eR, eC: P.eC }).forEach(x => st.push(x));
  if (R.dc) Lr.discSteps(kd.cp, R.dc, R.qz, R.ctx.Ts, fc, P.disc).forEach(x => st.push(x));
  st.push('验证');
  st.push({ t: '用' + (dig ? '量化后系数' : '圆整后元件') + '重算环路', r: 'fc = ' + hz(R.mg.fc) + '，<b>PM = ' + dg(R.mg.pm) + '</b>，GM = ' + (isFinite(R.mg.gm) ? R.mg.gm.toFixed(2) + ' dB' : '∞') + (R.mg.crossings > 1 ? '（' + R.mg.crossings + ' 次穿越，最小 PM ' + dg(R.mg.pmMin) + '）' : '') });
  if (R.warn.length) st.push({ t: '设计检查', r: R.warn.join('<br>') });
  return st;
};
})(typeof window !== 'undefined' ? window : globalThis);
