/* 学习扩展⑤：功率级（Buck LC/ESR、RHPZ、PCMC、COT）—— 实际计算 + 每个极零点对补偿器提出的要求 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, hz = Lr.hz, V = Lr.v, num = Lr.num;
const H5 = ['对象极零点', '位置（当前值）', '由谁决定', '对环路的影响', '补偿器怎么应对'];

Lr.extend('buck', {
  steps(v) {
    const P = Object.assign(PS.clone(PS.DEFAULTS), { L: v.L, C: v.C, Rc: v.Rc, Vo: 5 }), op = PS.opPoint(P, v.Vin, 5 / v.R);
    const Q = v.R * Math.sqrt(v.C / v.L) / (1 + v.R * (v.Rc + op.Rs) * v.C / v.L), g0 = v.Vin * v.R / (v.R + op.Rs);
    const ph = f => PS.deg(C.arg(PS.Gvd(op, P, C.jw(f)).Gvd));
    return [
      '已知：Vin = ' + V(v.Vin, 'V') + '，Vo = 5 V，L = ' + V(v.L, 'H') + '，C = ' + V(v.C, 'F') + '，ESR = ' + V(v.Rc, 'Ω') + '，R = ' + V(v.R, 'Ω') + '（Io = ' + V(5 / v.R, 'A') + '），Rs = DCR + Rds(on) = ' + V(op.Rs, 'Ω'),
      { t: '占空比', f: 'D = (Vo + Io·Rs) / Vin', r: 'D = ' + op.D.toFixed(4) },
      { t: '直流增益', f: 'G<sub>vd</sub>(0) = Vin · R/(R + Rs)', r: '= ' + num(g0) + '（' + Lr.db(g0) + '）', n: '电压模式的环路增益与 Vin 成正比——这就是 Vin 变化时 fc 跟着变、要做工况扫描的原因。' },
      { t: 'LC 谐振（双极点）', f: 'f<sub>0</sub> = 1 / (2π√(LC))', r: 'f0 = 1/(2π√(' + V(v.L, 'H') + ' × ' + V(v.C, 'F') + ')) = <b>' + hz(op.f0) + '</b>' },
      { t: '品质因数 Q（谐振峰高度）', f: 'Q = R·√(C/L) / [1 + R·(Rc + Rs)·C/L]', r: 'Q = ' + num(Q) + '，谐振峰 ' + Lr.db(Q), n: '轻载（R 大）Q 高，峰值更尖、相位在 f0 处跌得更陡。' },
      { t: 'ESR 零点', f: 'f<sub>ESR</sub> = 1 / (2π·Rc·C)', r: 'fESR = <b>' + hz(op.fesr) + '</b>' },
      { t: '斜率与相位', r: 'f0 以下 0 dB/dec；f0～fESR −40 dB/dec，相位趋于 −180°；fESR 以上 −20 dB/dec，相位回升到 −90°。实测 ∠Gvd：f0 处 ' + ph(op.f0).toFixed(1) + '°，3·f0 处 ' + ph(3 * op.f0).toFixed(1) + '°，10·f0 处 ' + ph(10 * op.f0).toFixed(1) + '°' },
      { t: '对补偿器的要求', r: 'fc 选在 3·f0～fs/10（≈ ' + hz(3 * op.f0) + ' ～ ' + hz(P.fs / 10) + '）时，对象相位约 ' + ph(Math.min(3 * op.f0, P.fs / 10)).toFixed(0) + '°，加上积分器 −90°，必须靠补偿器提升 ' + (60 - 90 - ph(Math.min(3 * op.f0, P.fs / 10))).toFixed(0) + '° 才能得到 60° PM → ' + (60 - 90 - ph(Math.min(3 * op.f0, P.fs / 10)) > 70 ? 'Type III' : 'Type II') }];
  },
  roles: v => { const fo = 1 / (TAU * Math.sqrt(v.L * v.C)), fe = 1 / (TAU * v.Rc * v.C); return { head: H5, rows: [
    ['LC 双极点 f0', hz(fo), 'L、C', '增益转为 −40 dB/dec，相位跌 180°；Q 高时出现谐振峰', '电压模式：Type III 两个零点放在 f0 附近抵消；电流模式：电流内环把它拆成两个分开的实极点'],
    ['谐振 Q', '随负载变', 'R、Rc、DCR', '轻载 Q 大，峰值可能让 |T| 在 f0 附近再次穿越 0 dB', 'fc 远高于 f0（≥3 倍）避免多次穿越；按最轻载核对'],
    ['ESR 零点 fESR', hz(fe), 'Rc、C', '增益回到 −20 dB/dec，相位回升 90°（“免费”的相位提升）', '若 fESR < fc：可用 Type II；fp1 放在 fESR 处抵消它，防止高频增益上翘'],
    ['直流增益 Vin', V(v.Vin, 'V'), 'Vin（VMC）', '环路增益随 Vin 变化', '按最高 Vin 校核 GM，最低 Vin 校核 fc；或用输入电压前馈']] }; },
  mark: v => [Lr.mk(1 / (TAU * Math.sqrt(v.L * v.C)), 'f0'), Lr.mk(1 / (TAU * v.Rc * v.C), 'fESR')],
});

Lr.extend('rhpz', {
  steps(v) {
    const P = Object.assign(PS.preset(1), { L: v.L }), op = PS.opPoint(P, v.Vin, v.Io);
    if (!op.ok) return [{ t: '工况无效', r: op.err }];
    return [
      '已知：Boost，Vin = ' + V(v.Vin, 'V') + '，Vo = 12 V，Io = ' + V(v.Io, 'A') + '，L = ' + V(v.L, 'H') + '，C = ' + V(P.C, 'F'),
      { t: '占空比与负载电阻', f: 'D′ = 1 − D ≈ Vin/Vo，R = Vo/Io', r: 'D = ' + op.D.toFixed(4) + '，D′ = ' + op.Dp.toFixed(4) + '，R = ' + V(op.R, 'Ω') },
      { t: 'RHPZ', f: 'f<sub>RHPZ</sub> = R·D′² / (2π·L)', r: '= ' + V(op.R, 'Ω') + ' × ' + num(op.Dp * op.Dp) + ' / (2π × ' + V(v.L, 'H') + ') = <b>' + hz(op.frhpz) + '</b>' },
      { t: '双极点也随 D′ 移动', f: 'f<sub>0</sub> = D′ / (2π√(LC))（等效电感 L/D′²）', r: 'f0 = ' + hz(op.f0) },
      { t: '可用带宽上限', f: 'fc ≤ f<sub>RHPZ</sub>/5（最低 Vin、最大 Io 时最低）', r: 'fc ≤ <b>' + hz(op.frhpz / 5) + '</b>', n: 'RHPZ 在 fRHPZ/5 处已带来 ' + PS.deg(Math.atan(0.2)).toFixed(1) + '° 相位滞后，补偿器无法抵消。' },
      { t: '物理原因', r: '占空比 d 增大 → 上管导通时间变短（D′ 变小）→ 输出电流 D′·IL 先减小 → 输出先跌，电感电流上升后才回升。', n: '所以 Boost 不能靠加大补偿器增益“强行”提高带宽，只能减小 L、提高 fs 或改用多相。' }];
  },
  roles: v => { const P = Object.assign(PS.preset(1), { L: v.L }), op = PS.opPoint(P, v.Vin, v.Io); return { head: H5, rows: [
    ['RHPZ', op.ok ? hz(op.frhpz) : '—', 'R、D′、L', '增益 +20 dB/dec 但相位 −90°（与普通零点相反）', '无法补偿，只能 fc < fRHPZ/5；电流模式同样存在'],
    ['LC 双极点', op.ok ? hz(op.f0) : '—', 'L/D′²、C', '与 Buck 相同，但位置随 Vin 变', 'VMC 用 Type III；PCMC 用 Type II'],
    ['ESR 零点', hz(1 / (TAU * P.Rc * P.C)), 'Rc、C', '提供一点相位', '用 fp 抵消'],
    ['最差工况', 'Vin 最低、Io 最大', '—', 'fRHPZ 最低', '工况扫描页可以直接看到']] }; },
  mark: v => { const op = PS.opPoint(Object.assign(PS.preset(1), { L: v.L }), v.Vin, v.Io); return op.ok ? [Lr.mk(op.frhpz, 'fRHPZ'), Lr.mk(op.f0, 'f0'), Lr.mk(op.frhpz / 5, 'fc上限')] : []; },
});

Lr.extend('pcmc', {
  steps(v) {
    const P = Object.assign(PS.clone(PS.DEFAULTS), { mode: 'pcmc', Vo: 12 * v.D }), op = PS.opPoint(P, 12, 3), Ts = op.Ts;
    const Se = v.k * op.Sf, q = PS.pcmcQ(op, Se), a = (op.Sf - Se) / (op.Sn + Se), seOpt = ((1 / Math.PI + 0.5) / op.Dp - 1) * op.Sn / op.Sf;
    return [
      '已知：Buck 12 V → ' + V(P.Vo, 'V') + '，Io = 3 A，L = ' + V(P.L, 'H') + '，Ri = ' + P.Ri + ' V/A，fs = ' + hz(P.fs),
      { t: '采样电流斜率', f: 'S<sub>n</sub> = Ri·(Vin − Vo)/L，S<sub>f</sub> = Ri·Vo/L', r: 'Sn = ' + V(op.Sn, 'V/s') + '，Sf = ' + V(op.Sf, 'V/s') },
      { t: '外加斜坡', f: 'S<sub>e</sub> = (Se/Sf) · S<sub>f</sub>', r: 'Se = ' + v.k.toFixed(2) + ' × Sf = ' + V(Se, 'V/s') + '（每周期斜坡幅度 ' + V(Se * Ts, 'V') + '）' },
      { t: '扰动传递比（逐周期）', f: 'α = −(S<sub>f</sub> − S<sub>e</sub>) / (S<sub>n</sub> + S<sub>e</sub>)', r: 'α = ' + (-a).toFixed(4) + '，10 个周期后放大 ' + Math.pow(Math.abs(a), 10).toExponential(2) + ' 倍 → ' + (Math.abs(a) < 1 ? '衰减（稳定）' : '<b>发散（次谐波振荡）</b>') },
      { t: 'mc 与 Qp', f: 'm<sub>c</sub> = 1 + Se/Sn，Q<sub>p</sub> = 1 / [π(m<sub>c</sub>·D′ − 0.5)]', r: 'mc = ' + q.mc.toFixed(4) + '，mc·D′ = ' + (q.mc * op.Dp).toFixed(4) + '，Qp = ' + (q.Qp > 0 ? q.Qp.toFixed(3) : '负 → 不稳定') },
      { t: '使 Qp = 1 的斜坡', f: 'S<sub>e</sub>/S<sub>f</sub> = [(1/π + 0.5)/D′ − 1] · S<sub>n</sub>/S<sub>f</sub>', r: 'Se/Sf = <b>' + seOpt.toFixed(3) + '</b>', n: 'Se = Sf/2 可保证任意 D 稳定；Se = Sf 为一周期消除扰动（无差拍），但电流环增益下降。' },
      { t: '调制器增益', f: 'F<sub>m</sub> = 1 / [(Sn + Se)·Ts]', r: 'Fm = ' + num(PS.Fm(op, Se)) + ' /V' }];
  },
  roles: { head: H5, rows: [
    ['fs/2 双极点', 'fs/2，Q = Qp', 'D、Se、Sn', 'Qp 大 → fs/2 处尖峰、相位陡降，GM 变小；Qp < 0 → 次谐波振荡', '加斜坡补偿使 Qp ≈ 0.6～1；fc ≤ fs/10'],
    ['负载极点', '≈ 1/(2π·R·C)', 'R、C', '电流环把 LC 双极点拆成一个低频极点 + fs/2 双极点，fc 处相位约 −90°', 'Type II：零点放在负载极点附近抵消'],
    ['ESR 零点', '1/(2π·Rc·C)', 'Rc、C', '高频增益上翘', 'Type II 的极点 fp 放在 fESR 处'],
    ['斜坡 Se', '—', '外部斜坡发生器', '稳定电流环，但削弱电流环（Se → ∞ 时退化为电压模式）', '取 0.5～1 倍 Sf']] },
});

Lr.extend('cot', {
  steps(v) {
    const rcC = v.Rc * v.C, h = v.Ton / 2, Q2 = PS.cotrQ({ Ton: v.Ton }, { Rc: v.Rc, C: v.C });
    return [
      { t: 'ESR 零点时间常数', f: 'τ = r<sub>c</sub>·C', r: 'τ = ' + V(v.Rc, 'Ω') + ' × ' + V(v.C, 'F') + ' = ' + V(rcC, 's') + '，fESR = ' + hz(1 / (TAU * rcC)) },
      { t: '稳定判据', f: 'r<sub>c</sub>·C > Ton/2', r: V(rcC, 's') + (rcC > h ? ' > ' : ' ≤ ') + V(h, 's') + ' → ' + (rcC > h ? '稳定' : '<b>不稳定</b>') },
      { t: '双极点', f: 'ω<sub>2</sub> = π/Ton　⇒　f<sub>2</sub> = 1/(2·Ton)', r: 'f2 = ' + hz(1 / (2 * v.Ton)) },
      { t: 'Q2', f: 'Q<sub>2</sub> = 1 / [π(r<sub>c</sub>C/Ton − 1/2)]', r: Q2 > 0 ? 'Q2 = ' + Q2.toFixed(3) : 'Q2 < 0（右半平面双极点）' },
      { t: '最小 ESR', f: 'r<sub>c,min</sub> = Ton / (2C)', r: 'rc,min = ' + V(h / v.C, 'Ω') + '；让 Q2 ≤ 1 需 rc ≥ ' + V((1 / Math.PI + 0.5) * v.Ton / v.C, 'Ω') },
      { t: '陶瓷电容怎么办', n: '陶瓷电容 ESR 只有几 mΩ，必须用 RC 纹波注入（在 FB 上叠加与电感电流同相的三角波）或改用电流型 COT（D-CAP3、ACOT 等）。' }];
  },
  roles: { head: H5, rows: [
    ['ESR 零点', '1/(2π·rc·C)', 'rc、C', '纹波型 COT 靠它把电感电流“采样”进反馈', '必须 rc·C > Ton/2'],
    ['1/(2Ton) 双极点', '≈ fs/2', 'Ton', 'Q2 大时尖峰，Q2 < 0 次谐波', '增大 rc 或纹波注入；外环 fc ≤ fs/10'],
    ['外环积分', '—', 'EA（可选）', '消除纹波谷值调节造成的直流误差（≈ 纹波一半）', 'Type I，fc 取 fs/20 左右']] },
});
})(typeof window !== 'undefined' ? window : globalThis);
