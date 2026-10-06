/* 学习：电流模式补偿（简化模型、PCMC Type II 逐步计算、ACM 内环设计、电流型 COT） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const G4 = '电流模式补偿';
const dB = x => (20 * Math.log10(Math.abs(x))).toFixed(1) + ' dB', deg = x => x.toFixed(1) + '°';
const TP = [['buck', 'Buck'], ['boost', 'Boost']];
// 峰值电流模式工作点（Buck 12→5 V 或 Boost 5→12 V）
function cmOp(v) {
  const P = v.topo === 'boost' ? Object.assign(PS.preset(1), { family: 'opamp' }) : Object.assign(PS.clone(PS.DEFAULTS), { mode: 'pcmc', Ri: 0.1 });
  if (v.Io !== undefined) P.Io = v.Io;
  if (v.se !== undefined) P.seRatio = v.se;
  if (v.Co !== undefined) P.C = v.Co;
  const op = PS.opPoint(P, P.Vin, P.Io), ctx = PS.mkCtx(P, op);
  return { P, op, ctx };
}
// 简化（一阶）电流模式对象：vo/vc = Kdc·(1+s/ωesr)(1−s/ωrhp)/(1+s/ωp)
function cmSimple(P, op) {
  const R = op.R, Dp = op.Dp, Ri = P.Ri, bst = P.topo === 'boost';
  const Kdc = bst ? R * Dp / (2 * Ri) : R / Ri, wp = bst ? 2 / (R * P.C) : 1 / (R * P.C);
  const wr = TAU * op.frhpz;   // RHPZ：(1 − s/ωr)
  return { Kdc, wp, fn: s => { let x = C.sc(C.div(C.lin(s, TAU * op.fesr), C.lin(s, wp)), Kdc); if (bst) x = C.mul(x, C.addr(C.sc(s, -1 / wr), 1)); return x; } };
}

/* ---------- 电流模式的核心思想 ---------- */
Lr.add({ id: 'cmidea', group: G4, title: '电流模式为什么好补偿：把 LC 双极点“拆开”', pre: ['buck', 'pcmc'], kw: '电流模式 峰值电流 简化模型 负载极点 双极点 拆开 Ridley',
  html: `${F('简化模型（Buck）：v̂o/v̂c ≈ (R/Ri) · (1 + s·Rc·C) / (1 + s·R·C)　（忽略 fs/2 双极点）')}${F('简化模型（Boost）：v̂o/v̂c ≈ (R·D′/2Ri) · (1 + s·Rc·C)(1 − s/ω<sub>RHPZ</sub>) / (1 + s·R·C/2)')}
  ${K('电流内环让电感变成一个受 vc 控制的电流源，LC 二阶系统退化为“电流源驱动 RC”的一阶系统：只剩一个低频的负载极点 f<sub>p</sub> = 1/(2πRC)，fc 附近对象相位约 −90°。因此一个 Type II（积分 + 一对零极点）就够了，而电压模式需要 Type III。')}`,
  talk: `<p>峰值电流模式（PCMC）每个周期在电感电流达到 vc/Ri 时关断开关管，相当于用 vc 直接“指定”电感电流峰值。从外环看，电感不再是一个储能元件，而是一个电流源 îL ≈ v̂c/Ri（低频时）。输出电容和负载电阻并联在这个电流源上，传递函数就只有一个极点 1/(2πRC)，以及 ESR 零点。</p>
  <p>Ridley 的完整模型告诉我们还多了两样东西：<b>① fs/2 处的一对双极点</b>（采样效应，Q 由斜坡补偿决定，见 ${Lr.link('pcmc')}）；<b>② 一个电感极点</b>被推到很高频率。在 fc ≤ fs/10 时，简化的一阶模型已经足够准确，可以用来手算补偿器；最后再用完整模型核对 fs/2 附近的相位与增益裕度。</p>
  <p>下面同时画出电压模式 Gvd/Vm、峰值电流模式完整模型、简化一阶模型三条曲线。拖动“负载电流”可以看到：</p>
  <ul><li>电压模式的 LC 双极点位置不随负载变，但 Q 随负载变（轻载谐振峰很高）；</li>
  <li>电流模式的负载极点 f<sub>p</sub> = 1/(2πRC) 随负载移动，<b>直流增益 R/Ri 与 f<sub>p</sub> 的乘积却不变</b>，所以 f<sub>p</sub> 以上的增益（决定 fc）与负载无关——这就是电流模式的 fc 对负载不敏感的原因；</li>
  <li>Boost 的 RHPZ 在电流模式下依然存在，所以 Boost 电流模式的 fc 仍受 fRHPZ/5 限制。</li></ul>
  <p>电流模式的其他好处：逐周期限流、天然的输入电压前馈（Vin 变化立即改变电流斜率）、多相并联自动均流。代价是需要电流采样（噪声、前沿消隐）和斜坡补偿。</p>`,
  sl: [{ k: 'topo', l: '拓扑', opts: TP, v: 'buck' }, { k: 'Io', l: '负载电流 Io', a: 0.2, b: 5, v: 3, log: true, u: 'A' }, { k: 'se', l: '斜坡 Se/Sf', a: 0.1, b: 1.5, v: 0.5, fmt: x => x.toFixed(2) }],
  calc(v) {
    const { P, op, ctx } = cmOp(v); if (!op.ok) return { series: [], info: op.err };
    const sm = cmSimple(P, op), fs = P.fs;
    const vmc = s => C.sc(PS.Gvd(op, P, s).Gvd, 1 / P.Vm), full = s => PS.plantP(ctx, s);
    const q = PS.pcmcQ(op, ctx.Se);
    return { f0: 10, f1: fs * 0.97, vlines: [{ x: sm.wp / TAU, label: 'fp 负载极点' }, { x: op.f0, label: 'f0' }, { x: fs / 2, label: 'fs/2' }].concat(isFinite(op.frhpz) ? [{ x: op.frhpz, label: 'RHPZ' }] : []), ph0: -90,
      series: [{ name: '电压模式 Gvd/Vm（Vm = ' + PS.fmt(P.Vm, 'V') + '）', fn: vmc, color: c(2) }, { name: '峰值电流模式（Ridley 完整）', fn: full, color: c(1) }, { name: '简化一阶模型', fn: sm.fn, color: c(3), dash: true }],
      info: `负载极点 fp = ${hz(sm.wp / TAU)}，直流增益 ${dB(sm.Kdc)}，fp 以上增益 ≈ Kdc·fp/f（与负载无关）。Qp = ${q.Qp > 0 ? q.Qp.toFixed(2) : '<0（次谐波）'}。`, P, op, sm, ctx, q };
  },
  steps(v, r) {
    if (!r.sm) return [{ t: '工况无效', r: r.info }];
    const P = r.P, op = r.op, sm = r.sm, f1 = 10 * sm.wp / TAU, full = C.abs(PS.plantP(r.ctx, C.jw(f1))), simp = C.abs(sm.fn(C.jw(f1)));
    return ['已知：' + PS.TOPOS[P.topo] + ' ' + V(P.Vin, 'V') + ' → ' + V(P.Vo, 'V') + '，Io = ' + V(op.Io, 'A') + '（R = ' + V(op.R, 'Ω') + '），C = ' + V(P.C, 'F') + '，Ri = ' + P.Ri + ' V/A，fs = ' + hz(P.fs),
      { t: '直流增益', f: P.topo === 'boost' ? 'K<sub>dc</sub> = R·D′/(2Ri)' : 'K<sub>dc</sub> = R/Ri', r: num(sm.Kdc) + '（' + dB(sm.Kdc) + '）' },
      { t: '负载极点', f: P.topo === 'boost' ? 'f<sub>p</sub> = 2/(2π·R·C)' : 'f<sub>p</sub> = 1/(2π·R·C)', r: '<b>' + hz(sm.wp / TAU) + '</b>' },
      { t: 'ESR 零点', f: 'f<sub>ESR</sub> = 1/(2π·Rc·C)', r: hz(op.fesr) },
      P.topo === 'boost' ? { t: 'RHPZ', f: 'f<sub>RHPZ</sub> = R·D′²/(2πL)', r: hz(op.frhpz) + '（电流模式无法消除）' } : { t: 'Buck 无 RHPZ', r: '—' },
      { t: 'fp 以上的增益（与负载无关）', f: '|v̂o/v̂c| ≈ K<sub>dc</sub>·f<sub>p</sub>/f = ' + (P.topo === 'boost' ? 'D′/(2π·Ri·C·f)' : '1/(2π·Ri·C·f)'), r: '在 10·fp = ' + hz(f1) + '：简化 ' + dB(simp) + '，完整模型 ' + dB(full), n: '两者接近说明简化模型可用来手算；接近 fs/2 时差异主要来自采样双极点。' },
      { t: '采样双极点', f: 'Q<sub>p</sub> = 1/[π(m<sub>c</sub>D′ − 0.5)]', r: 'Qp = ' + (r.q.Qp > 0 ? r.q.Qp.toFixed(3) : '<0') + ' → ' + (r.q.Qp > 0 && r.q.Qp < 2 ? 'fs/2 附近相位跌落可控' : '需要调整斜坡') }];
  },
  roles: { head: ['特征', '电压模式', '峰值电流模式', '对补偿的影响'], rows: [
    ['低频极点', 'LC 双极点 f0（Q 随负载）', '负载极点 1/(2πRC)', '电流模式对象相位只到 −90°'],
    ['所需补偿器', 'Type III（双零点）', 'Type II（一个零点）', '元件更少、更容易稳定'],
    ['fc 对负载', '轻载 Q 高，可能多次穿越', 'fp 以上增益与负载无关', '电流模式 fc 基本不随负载变'],
    ['对 Vin', 'Gvd ∝ Vin（需要前馈）', '天然前馈', '电流模式线性调整率好'],
    ['高频', '—', 'fs/2 双极点（斜坡补偿）', 'fc ≤ fs/10，按 Qp 检查 GM'],
    ['RHPZ（Boost）', '有', '仍然有', 'fc < fRHPZ/5']] },
  quiz: [['为什么电流模式下负载变轻 fc 基本不变？', 'fp = 1/(2πRC) 与 R 成反比，直流增益 R/Ri 与 R 成正比，乘积 1/(2πRiC) 与 R 无关；fc 一般在 fp 之上，那里增益只取决于 Ri 和 C。'],
    ['斜坡补偿越大越好吗？', '斜坡太大时调制器增益 Fm 下降，电流环的作用减弱，对象逐渐变回电压模式（LC 双极点重新出现），Type II 就不够了。一般取 Se ≈ (0.5～1)·Sf。']] });
/* ---------- 峰值电流模式 Type II：手算法逐步计算（运放 / OTA） ---------- */
Lr.add({ id: 'cmt2', group: G4, title: '峰值电流模式的补偿计算：Type II 手算法（运放与 OTA）', pre: ['cmidea', 'type2', 'ota2'], kw: '电流模式 补偿计算 Type II OTA Rc Cc Cp 手算 零点放负载极点',
  html: `${F('① 选 fc：≤ fs/10，Boost 还要 ≤ f<sub>RHPZ,min</sub>/5　② 中频增益：|Gc(fc)| = 1/|P(fc)|')}
  ${F('③ 零点 f<sub>z</sub> = 负载极点 f<sub>p</sub>（或 fc/K）　④ 极点 f<sub>p2</sub> = f<sub>ESR</sub>（或 fs/2，取较小者，且 > fc）')}
  ${F('OTA：R<sub>c</sub> = |Gc(fc)| / (H·gm)，C<sub>c</sub> = 1/(2π·R<sub>c</sub>·f<sub>z</sub>)，C<sub>p</sub> = 1/(2π·R<sub>c</sub>·f<sub>p2</sub>)　|　运放：R2 = |Gc(fc)|·R1，C1 = 1/(2π·R2·f<sub>z</sub>)，C2 = 1/(2π·R2·f<sub>p2</sub>)')}
  ${K('零点抵消负载极点后，环路在 fz～fp2 之间就是一个“积分器”，|T| 以 −20 dB/dec 穿越，PM ≈ 90° − 高频损失（fs/2 双极点、fp2、RHPZ）。这就是数据手册（TPS54560、LM5141、LM5122 等）里“极零对消”法的出处，下面的计算与这些手册的公式一致。')}`,
  talk: `<p>电流模式的对象在 fc 附近相位约 −90°，补偿器的任务很简单：在 fc 处给出 1/|P(fc)| 的增益，并让相位不要掉得太多。最常用的手算法是<b>极零对消</b>：</p>
  <ol><li><b>选 fc。</b>fs/10 以内；Boost/Buck-Boost 按最差工况（最低 Vin、最大 Io）的 RHPZ 取 fRHPZ/5 以内。很多手册推荐 fc 取 fs/10 和 √(fp·fESR) 中的较小者。</li>
  <li><b>算中频增益。</b>补偿器在 fz～fp2 之间是平台，平台高度就决定 fc：|Gc| = 1/|P(fc)|。用简化模型 |P(fc)| ≈ 1/(2π·Ri·C·fc)（Buck），可以直接写出 R<sub>c</sub>（OTA）或 R2（运放）。</li>
  <li><b>放零点。</b>零点放在负载极点 f<sub>p</sub> = 1/(2πRC) 处，抵消它的 −90°。负载会变，通常按<b>最大负载</b>（f<sub>p</sub> 最高）或稍低处放，保证 fc 处零点已完全生效。零点放得过高会损失 PM；放得过低会让低频增益偏小、负载阶跃后恢复出现慢尾巴。</li>
  <li><b>放高频极点。</b>放在 ESR 零点处抵消它（铝电解、聚合物电容 fESR 较低），或 fs/2 附近衰减开关噪声（陶瓷电容 fESR 很高），二者取较小者，但必须高于 fc 足够多（≥ 3～5 倍）。</li>
  <li><b>核对。</b>用完整的 Ridley 模型算 PM、GM，检查 fs/2 双极点（Qp）和最差工况。</li></ol>
  <p>OTA 与运放的区别：OTA 的分压比 H 直接乘进增益（Gc = H·gm·Zc），所以 R<sub>c</sub> 要除以 H·gm；运放型分压电阻 R1 就是输入电阻，增益是 R2/R1，与 H 无关（虚地）。下方“实际计算过程”按手算公式一步步得出元件值，并与本工具 K 因子法的自动设计对比。</p>`,
  sl: [{ k: 'topo', l: '拓扑', opts: TP, v: 'buck' }, { k: 'fam', l: '误差放大器', opts: [['ota', 'OTA（gm = 1 mS）'], ['opamp', '运放（R1 = 10 kΩ）']], v: 'ota' }, { k: 'fc', l: '目标 fc', a: 1e3, b: 1e5, v: 3e4, log: true, u: 'Hz' },
    { k: 'zk', l: '零点 / 负载极点', a: 0.2, b: 5, v: 1, log: true, fmt: x => x.toFixed(2) + '×fp' }, { k: 'Co', l: '输出电容 C', a: 10e-6, b: 470e-6, v: 44e-6, log: true, u: 'F' }],
  calc(v) {
    const { P, op, ctx } = cmOp(v); if (!op.ok) return { series: [], info: op.err };
    P.family = v.fam;
    const sm = cmSimple(P, op), Pl = s => PS.plantP(ctx, s), H = ctx.H, fc = v.topo === 'boost' ? Math.min(v.fc, PS.opPoint(P, P.VinMin, P.IoMax).frhpz / 5) : v.fc;
    const Pm = C.abs(Pl(C.jw(fc))), Pms = C.abs(sm.fn(C.jw(fc))), Gm = 1 / Pm;   // 中频平台增益
    const fz = sm.wp / TAU * v.zk, fp2 = Math.max(Math.min(op.fesr, P.fs / 2), 3 * fc);
    let parts, cp;
    if (v.fam === 'ota') {
      const Rc = Gm / (H * P.gm), Cc = 1 / (TAU * Rc * fz), Cp = 1 / (TAU * Rc * fp2);
      parts = { Rc, Cc, Cp }; cp = { type: 2, wi: H * P.gm / (Cc + Cp), z: [1 / (Rc * Cc)], p: [(Cc + Cp) / (Rc * Cc * Cp)] };
    } else {
      const R1 = P.R1, R2 = Gm * R1, C1 = 1 / (TAU * R2 * fz), C2 = 1 / (TAU * R2 * fp2);
      parts = { R1, R2, C1, C2 }; cp = { type: 2, wi: 1 / (R1 * (C1 + C2)), z: [1 / (R2 * C1)], p: [(C1 + C2) / (R2 * C1 * C2)] };
    }
    const gc = s => PS.compEval(cp, s), Tf = s => C.mul(Pl(s), gc(s)), mg = PS.margins(Tf, 10, P.fs * 0.97);
    // 对比：K 因子法
    const kd = PS.kfactor(Pl, fc, 60, { type: 2, family: v.fam, H0: H }), Tk = s => C.mul(Pl(s), PS.compEval(kd.cp, s)), mgk = PS.margins(Tk, 10, P.fs * 0.97);
    const sch = v.fam === 'ota' ? PS.schem('ota2', { Rc: PS.fmt(parts.Rc, 'Ω'), Cc: PS.fmt(parts.Cc, 'F'), Cp: PS.fmt(parts.Cp, 'F'), Rt: PS.fmt(10e3 * (P.Vo - P.Vref) / P.Vref, 'Ω'), Rb: '10 kΩ' }) : PS.schem('op2', { R1: PS.fmt(parts.R1, 'Ω'), R2: PS.fmt(parts.R2, 'Ω'), C1: PS.fmt(parts.C1, 'F'), C2: PS.fmt(parts.C2, 'F') });
    // 负载阶跃（小信号）
    const dI = P.Io * 0.5, ld = mg.pm > 0 ? Lr.loadStep({ ctx, P, op }, gc, dI, Math.min(40 / mg.fc, 2e-3)) : null;
    const f = PS.logspace(10, P.fs * 0.97, 500);
    return { f0: 10, f1: P.fs * 0.97, mg, sch, vlines: [{ x: sm.wp / TAU, label: 'fp' }, { x: fz, label: 'fz' }, { x: fp2, label: 'fp2' }, { x: P.fs / 2, label: 'fs/2' }].concat(isFinite(op.frhpz) ? [{ x: op.frhpz, label: 'RHPZ' }] : []),
      series: [{ name: '开环 T（手算）', fn: Tf, color: c(1) }, { name: '对象 P（Ridley）', fn: Pl, color: c(2), dash: true, width: 1.6 }, { name: '开环 T（K 因子法，PM 60°）', fn: Tk, color: c(4), width: 1.5 }],
      extra: [{ title: '补偿器 Gc 单独的 Bode 图', note: 'fz 以下为积分（−20 dB/dec），fz～fp2 为平台（高度 = 1/|P(fc)|），fp2 以上再次 −20 dB/dec。', cfg: Ls.bcfg([{ name: 'Gc（手算）', fn: gc, color: c(3) }, { name: 'Gc（K 因子法）', fn: s => PS.compEval(kd.cp, s), color: c(4), dash: true, width: 1.5 }], f, { vlines: [{ x: fz, label: 'fz' }, { x: fp2, label: 'fp2' }, { x: fc, label: 'fc' }], height: 320 }) }].concat(ld ? [{ title: '负载阶跃 ' + PS.fmt(dI, 'A') + '（小信号）', note: '最大偏差 ' + V(Math.max(...ld.v.map(Math.abs)), 'V') + '；估算 ΔI/(2π·fc·C) = ' + V(dI / (TAU * mg.fc * P.C), 'V'), cfg: Ls.tcfg([{ name: 'Δvo', color: c(1), width: 2.2, x: ld.t, y: ld.v }], { label: 'Δvo (V)', hlines: [0] }) }] : []),
      info: `手算结果：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}。K 因子法（PM 目标 60°）：fc = ${hz(mgk.fc)}，PM = ${PS.fmtNum(mgk.pm, 1)}°。` + (fc < v.fc ? '（fc 已按 Boost 最差 RHPZ/5 限制为 ' + hz(fc) + '）' : ''), P, op, sm, H, fc, Pm, Pms, Gm, fz, fp2, parts, kd };
  },
  steps(v, r) {
    if (!r.sm) return [{ t: '工况无效', r: r.info }];
    const P = r.P, op = r.op, sm = r.sm, st = [], ota = v.fam === 'ota';
    st.push('已知：' + PS.TOPOS[P.topo] + ' ' + V(P.Vin, 'V') + '→' + V(P.Vo, 'V') + '/' + V(op.Io, 'A') + '，C = ' + V(P.C, 'F') + '（ESR ' + V(P.Rc, 'Ω') + '），Ri = ' + P.Ri + ' V/A，fs = ' + hz(P.fs) + '，Vref = ' + V(P.Vref, 'V') + (ota ? '，gm = ' + V(P.gm, 'S') : '，R1 = ' + V(P.R1, 'Ω')));
    st.push('第 1 步：对象特征频率');
    st.push({ t: '负载极点', f: P.topo === 'boost' ? 'f<sub>p</sub> = 2/(2πRC)' : 'f<sub>p</sub> = 1/(2πRC)', r: hz(sm.wp / TAU) + '（R = ' + V(op.R, 'Ω') + '）' });
    st.push({ t: 'ESR 零点', f: 'f<sub>ESR</sub> = 1/(2π·Rc·C)', r: hz(op.fesr) });
    if (P.topo === 'boost') st.push({ t: 'RHPZ', r: '标称 ' + hz(op.frhpz) + '，最差（Vin = ' + V(P.VinMin, 'V') + '，Io = ' + V(P.IoMax, 'A') + '）' + hz(PS.opPoint(P, P.VinMin, P.IoMax).frhpz) });
    st.push('第 2 步：选 fc');
    st.push({ t: 'fc', f: 'fc ≤ fs/10' + (P.topo === 'boost' ? '，fc ≤ f<sub>RHPZ,min</sub>/5' : ''), r: 'fc = <b>' + hz(r.fc) + '</b>（fs/10 = ' + hz(P.fs / 10) + '）' });
    st.push('第 3 步：对象在 fc 处的增益 → 补偿器平台增益');
    st.push({ t: '简化模型估算', f: P.topo === 'boost' ? '|P(fc)| ≈ D′/(2π·Ri·C·fc)·…' : '|P(fc)| ≈ 1/(2π·Ri·C·fc)（fc ≫ fp）', r: num(r.Pms) + '（' + dB(r.Pms) + '）' });
    st.push({ t: '完整模型（含 fs/2 双极点）', r: '|P(fc)| = ' + num(r.Pm) + '（' + dB(r.Pm) + '），以此为准' });
    st.push({ t: '平台增益', f: '|Gc(fc)| = 1/|P(fc)|', r: '<b>' + num(r.Gm) + '</b>（' + dB(r.Gm) + '）' });
    st.push('第 4 步：元件值');
    if (ota) {
      st.push({ t: '分压比', f: 'H = Vref/Vo', r: num(r.H) });
      st.push({ t: 'Rc（平台增益 = H·gm·Rc）', f: 'R<sub>c</sub> = |Gc(fc)| / (H·gm)', r: num(r.Gm) + ' / (' + num(r.H) + ' × ' + V(P.gm, 'S') + ') = <b>' + V(r.parts.Rc, 'Ω') + '</b> → E96 ' + V(PS.roundE(r.parts.Rc, 96), 'Ω', 3) });
      st.push({ t: 'Cc（零点）', f: 'f<sub>z</sub> = ' + v.zk.toFixed(2) + '·f<sub>p</sub> = ' + hz(r.fz) + '，C<sub>c</sub> = 1/(2π·R<sub>c</sub>·f<sub>z</sub>)', r: '<b>' + V(r.parts.Cc, 'F') + '</b> → E24 ' + V(PS.roundE(r.parts.Cc, 24), 'F', 2) });
      st.push({ t: 'Cp（高频极点）', f: 'f<sub>p2</sub> = max(min(f<sub>ESR</sub>, fs/2), 3fc) = ' + hz(r.fp2) + '，C<sub>p</sub> = 1/(2π·R<sub>c</sub>·f<sub>p2</sub>)', r: '<b>' + V(r.parts.Cp, 'F') + '</b> → E24 ' + V(PS.roundE(r.parts.Cp, 24), 'F', 2) });
    } else {
      st.push({ t: 'R2（平台增益 = R2/R1）', f: 'R2 = |Gc(fc)|·R1', r: '<b>' + V(r.parts.R2, 'Ω') + '</b> → E96 ' + V(PS.roundE(r.parts.R2, 96), 'Ω', 3) });
      st.push({ t: 'C1（零点）', f: 'f<sub>z</sub> = ' + hz(r.fz) + '，C1 = 1/(2π·R2·f<sub>z</sub>)', r: '<b>' + V(r.parts.C1, 'F') + '</b>' });
      st.push({ t: 'C2（高频极点）', f: 'f<sub>p2</sub> = ' + hz(r.fp2) + '，C2 = 1/(2π·R2·f<sub>p2</sub>)', r: '<b>' + V(r.parts.C2, 'F') + '</b>' });
    }
    st.push('第 5 步：验证（Ridley 完整模型）');
    st.push({ t: '结果', r: 'fc = ' + hz(r.mg.fc) + '，PM = ' + PS.fmtNum(r.mg.pm, 1) + '°，GM = ' + (isFinite(r.mg.gm) ? r.mg.gm.toFixed(1) + ' dB' : '∞'), n: '手算法 PM 通常在 60°～80°；PM 偏低时检查 fp2 是否离 fc 太近、Qp 是否偏高、Boost 的 RHPZ 是否离 fc 太近。' });
    st.push({ t: '与 K 因子法对比', r: 'K 因子法：K = ' + r.kd.K.toFixed(2) + '，fz = ' + hz(r.kd.cp.z[0] / TAU) + '，fp = ' + hz(r.kd.cp.p[0] / TAU), n: 'K 因子法把零极点对称放在 fc 两侧以精确命中目标 PM；手算法把零点对准负载极点，低频增益更高、负载阶跃恢复更快，PM 通常更大。' });
    return st;
  },
  roles: v => ({ head: ['元件', '决定', '物理意义', '取值偏了的后果'], rows: v.fam === 'ota' ? [
    ['Rc', '平台增益 H·gm·Rc → fc', '中频增益', '大 → fc 高、PM 降；小 → 带宽不足'],
    ['Cc', '零点 1/(2πRcCc)', '与 Rc 串联，形成积分 + 零点', '大 → 零点低，恢复慢尾巴；小 → 零点高于 fc，PM 不足'],
    ['Cp', '高频极点 1/(2πRcCp)', '高频旁路，Cp ≪ Cc', '大 → 极点低，吃相位；去掉 → 高频纹波进 COMP'],
    ['Rt / Rb', 'H = Vref/Vo', '分压比乘进增益', '改变 Vo 要同时调 Rc']] : [
    ['R1', '输入电阻（= 上分压电阻）', '设定阻抗水平', '—'],
    ['R2', '平台增益 R2/R1 → fc', '中频增益', '大 → fc 高、PM 降；小 → 带宽不足'],
    ['C1', '零点 1/(2πR2C1)', '积分 + 零点', '大 → 零点低；小 → 零点高于 fc'],
    ['C2', '高频极点 1/(2πR2C2)', '高频旁路', '大 → 吃相位；去掉 → 噪声放大']] }),
  quiz: [['负载从 3 A 降到 0.3 A，零点还对准负载极点吗？会不会不稳定？', '不再对准：负载极点降低 10 倍，零点高于它，fz～fp 之间出现一段 −40 dB/dec，但 fc 仍在零点之上，fc 处相位主要由零点决定，PM 只略降。这正是零点按最大负载放的原因。'],
    ['为什么 OTA 型补偿换一个输出电压就要重新算 Rc？', 'OTA 增益 = H·gm·Rc，H = Vref/Vo 随 Vo 改变；运放型增益 R2/R1 只取决于上分压电阻 R1（虚地使下电阻不影响交流增益）。']] });
/* ---------- 平均电流模式：内环设计与斜率判据 ---------- */
Lr.add({ id: 'acmin', group: G4, title: '平均电流模式：电流内环的补偿计算与斜率判据', pre: ['cmidea', 'type2'], kw: '平均电流 内环 电流环 Gid 斜率判据 Dixon 外环 双环 PFC',
  html: `${F('内环对象：P<sub>i</sub>(s) = Ri·G<sub>id</sub>(s)/Vm，fc 附近 G<sub>id</sub> ≈ V<sub>x</sub>/(sL)（Buck V<sub>x</sub> = Vin，Boost V<sub>x</sub> = Vo）')}
  ${F('斜率判据（Dixon）：电流放大器输出的下降斜率 ≤ 锯齿波斜率　⇔　G<sub>ca</sub>·Ri·V<sub>off</sub>/L ≤ Vm·fs　⇒　G<sub>ca,max</sub> = Vm·fs·L/(Ri·V<sub>off</sub>)')}
  ${K('平均电流模式先设计内环：对象在 fc 附近就是一个积分器（电感），用 Type II 把 fci 放在 fs/10～fs/5，零点放在 fci/K 以下给足相位，高频极点放在 fs/2 附近。内环闭合后，外环看到的对象近似为“电流源驱动 RC”，再用 Type II 设计外环，fc ≤ fci/5。')}`,
  talk: `<p>平均电流模式（ACM）不在每个周期比较电流峰值，而是用一个带积分的电流放大器调节<b>平均</b>电感电流，然后电流放大器输出与固定锯齿波比较产生 PWM。它的好处是电流精度高、抗噪声好、没有次谐波问题（只要满足斜率判据），广泛用于 PFC、电池充电、LED 驱动和双向变换器（如 LM5170、UCC28180）。</p>
  <p><b>内环对象。</b>占空比到电感电流的传递函数 G<sub>id</sub> 在 LC 谐振以下由负载决定，谐振以上就是电感的阻抗：îL ≈ V<sub>x</sub>·d̂/(sL)，相位 −90°。所以在 fci（远高于 f0）处，内环对象是一个纯积分，Type II 的零点放在 fci/K 以下即可得到需要的 PM。</p>
  <p><b>为什么有增益上限。</b>电流放大器的输出里含有电感电流纹波被放大后的三角波。如果它的下降斜率比锯齿波还陡，比较器会在一个周期里多次翻转或出现次谐波——这就是 Dixon 的斜率判据。它给出了电流放大器在开关频率附近的最大增益 G<sub>ca,max</sub>，也就间接限制了 fci 的上限。实际上，按 fci ≈ fs/10 设计时这个限制通常是满足的；下方计算会给出余量。</p>
  <p><b>外环。</b>内环闭合后，对外环而言电感电流 ≈ v̂c/Ri（fci 以下），对象退化为 R/Ri · 1/(1+sRC)——与峰值电流模式的简化模型相同。外环 fc 取 fci/5～fci/10，避免两环相互作用。</p>`,
  sl: [{ k: 'fci', l: '内环 fci', a: 3e3, b: 6e4, v: 2e4, log: true, u: 'Hz' }, { k: 'pmi', l: '内环 PM 目标', a: 30, b: 80, v: 60, fmt: x => x.toFixed(0) + '°' }, { k: 'L', l: '电感 L', a: 10e-6, b: 100e-6, v: 33e-6, log: true, u: 'H' }],
  calc(v) {
    const P = Object.assign(PS.preset(4), { fciAuto: false, fci: v.fci, pmi: v.pmi, L: v.L, fcAuto: true });
    const R = PS.design(P); if (R.fatal) return { series: [], info: R.fatal };
    const I = R.inner, op = R.op, f = PS.logspace(R.fmin, R.fmax, 500);
    const Gca = C.abs(R.ctx.Gci(C.jw(P.fs))), Gmax = P.Vm * P.fs * P.L / (P.Ri * op.Voff);
    const Tv = R.T, Pv = R.Pd, sm = cmSimple(P, op);
    return { f0: R.fmin, f1: R.fmax, mg: I.mg, vlines: [{ x: op.f0, label: 'f0' }, { x: I.kd.cp.z[0] / TAU, label: 'fz' }, { x: I.kd.cp.p[0] / TAU, label: 'fp' }, { x: P.fs / 2, label: 'fs/2' }], R,
      series: [{ name: '内环开环 Ti', fn: I.T, color: c(1) }, { name: '内环对象 Ri·Gid/Vm', fn: I.plant, color: c(2), dash: true, width: 1.6 }, { name: '电流补偿器 Gci', fn: R.ctx.Gci, color: c(3) }],
      extra: [{ title: '外环：电压环开环 T 与对象（内环已闭合）', note: '外环对象（蓝虚线）与“电流源驱动 RC”的简化模型（绿点线）在 fci 以下几乎重合。外环 fc = ' + hz(R.mg.fc) + '，PM = ' + R.mg.pm.toFixed(1) + '°。',
        cfg: Ls.bcfg([{ name: '外环 T', fn: Tv, color: c(1) }, { name: '外环对象 vo/iref', fn: Pv, color: c(2), dash: true }, { name: '简化 R/Ri/(1+sRC)', fn: s => C.div(C.of(op.R / P.Ri), C.lin(s, sm.wp)), color: c(3), dash: true, width: 1.4 }], f, { vlines: [{ x: R.mg.fc, label: 'fc' }, { x: I.mg.fc, label: 'fci' }], height: 340, ph0: -180 }) }],
      info: `内环：fci = ${hz(I.mg.fc)}，PMi = ${I.mg.pm.toFixed(1)}°。斜率判据：fs 处电流放大器增益 ${dB(Gca)}，上限 ${dB(Gmax)} → ${Gca <= Gmax ? '满足' : '<b>超出，可能多次翻转/次谐波</b>'}。`, Gca, Gmax, op, P, I };
  },
  steps(v, r) {
    if (!r.I) return [{ t: '无效', r: r.info }];
    const P = r.P, op = r.op, I = r.I, R = r.R, s = C.jw(I.fc), Pm = C.abs(I.plant(s)), est = op.a * P.Ri / (P.Vm * TAU * I.fc * P.L);
    return ['已知：48 V → 12 V/5 A Buck，L = ' + V(P.L, 'H') + '，Ri = ' + P.Ri + ' V/A，Vm = ' + V(P.Vm, 'V') + '，fs = ' + hz(P.fs),
      '一、内环',
      { t: '内环对象在 fci 处', f: '|P<sub>i</sub>| ≈ Ri·Vin/(Vm·2π·fci·L)（fci ≫ f0）', r: '估算 ' + num(est) + '（' + dB(est) + '），精确 ' + num(Pm) + '（' + dB(Pm) + '），∠Pi = ' + PS.phaseAt(I.plant, I.fc).toFixed(1) + '°' },
      { t: '所需提升', f: 'Boost = PMi − 90° − ∠Pi', r: deg(I.kd.boost) + ' → K = ' + I.kd.K.toFixed(3) },
      { t: '零点 / 极点', f: 'fz = fci/K，fp = fci·K', r: 'fz = ' + hz(I.kd.cp.z[0] / TAU) + '，fp = ' + hz(I.kd.cp.p[0] / TAU) },
      { t: '元件（运放差分，输入电阻 ' + V(P.Rci, 'Ω') + '）', r: I.rz.parts.map(p => p.name + ' = ' + V(p.val, p.unit, 3)).join('，') },
      { t: '斜率判据', f: 'G<sub>ca,max</sub> = Vm·fs·L / (Ri·V<sub>off</sub>)，V<sub>off</sub> = ' + V(op.Voff, 'V'), r: '上限 ' + num(r.Gmax) + '（' + dB(r.Gmax) + '），实际 fs 处 ' + num(r.Gca) + '（' + dB(r.Gca) + '）→ 余量 ' + (20 * Math.log10(r.Gmax / r.Gca)).toFixed(1) + ' dB', n: '余量为负时降低 fci，或增大 Vm（锯齿波幅度）。' },
      { t: '内环结果', r: 'fci = ' + hz(I.mg.fc) + '，PMi = ' + deg(I.mg.pm) + '，GMi = ' + (isFinite(I.mg.gm) ? I.mg.gm.toFixed(1) + ' dB' : '∞') },
      '二、外环（内环闭合后）',
      { t: '外环 fc', f: 'fc ≤ fci/5', r: 'fc = ' + hz(R.mg.fc) + '（fci/5 = ' + hz(I.mg.fc / 5) + '），PM = ' + deg(R.mg.pm) },
      { t: '外环补偿器', r: 'Type ' + R.kd.type + '，' + PS.pzList(R.kd.cp).map(x => x.k + ' ' + hz(x.f)).join('，') }];
  },
  roles: { head: ['零极点 / 参数', '位置', '目的', '为什么'], rows: [
    ['电流补偿器积分', '原点', '平均电流无静差', '使电感电流精确跟踪参考（PFC 的正弦电流跟踪靠它）'],
    ['电流补偿器零点', 'fci/K（几 kHz）', '在 fci 处提供相位', '对象是 −90° 的积分，Type II 零点把补偿器相位从 −90° 抬起来'],
    ['电流补偿器极点', 'fci·K，≤ fs/2', '衰减开关纹波', '电流采样里有很大的开关纹波，必须在 fs 附近衰减（斜率判据）'],
    ['Vm（锯齿波）', '外部设定', '调制器增益 1/Vm', 'Vm 越大，同样 fci 下补偿器增益越大，斜率判据越宽松'],
    ['外环 fc', '≤ fci/5', '两环解耦', '外环看内环近似为理想电流源']] },
  quiz: [['为什么平均电流模式不需要斜坡补偿？', '电流放大器的高频极点把电流纹波平均掉了，只要满足斜率判据（放大后的纹波下降斜率不超过锯齿波斜率），就不会出现峰值电流模式那种次谐波振荡。'],
    ['PFC 的电流内环和电压外环带宽通常差多少？', '电流环几 kHz 到十几 kHz（要跟踪 100/120 Hz 的正弦参考），电压环只有 10～20 Hz（不能跟随 2 倍工频纹波，否则输入电流畸变）。']] });

/* ---------- 电流型 COT（D-CAP3 / 电流纹波注入）的补偿 ---------- */
Lr.add({ id: 'cmcot', group: G4, title: '电流型 COT 的外环补偿：Type I 还是 Type II', pre: ['cot', 'cmidea'], kw: 'COT 恒定导通时间 D-CAP3 纹波注入 外环 Type I Ton 双极点',
  html: `${F('电流型 COT（Jian Li）：v̂o/v̂c ≈ (R/Ri)·(1 + sRcC)/(1 + sRC) · 1/(1 + s/(ω<sub>1</sub>Q<sub>1</sub>) + s²/ω<sub>1</sub>²)，ω<sub>1</sub> = π/Ton，Q<sub>1</sub> = 2/π')}
  ${K('COT 的电流环没有次谐波问题（Q<sub>1</sub> = 2/π ≈ 0.64 恒定，不需要斜坡补偿），高频双极点在 1/(2Ton)。外环对象与峰值电流模式一样是一阶的，常用 Type II，零点抵消负载极点；很多芯片（TPS548A20 的 D-CAP3、LM5164 带纹波注入）干脆内部只做积分或不加误差放大器，靠选择 L、C 和纹波注入网络保证稳定。')}`,
  talk: `<p>恒定导通时间控制每次在 FB（或电流信号）下降到阈值时开通一个固定的 Ton，频率随工况略有变化。电流型 COT 在比较器前加入了电感电流信息（真实采样，或 D-CAP3 这类用内部 RC 网络从开关节点“仿真”出的电流斜坡），Jian Li 的描述函数模型表明它的电流环在 1/(2Ton) 附近有一对双极点，Q 恒为 2/π，与占空比无关。所以 COT 不需要斜坡补偿，也没有 D > 0.5 的问题。</p>
  <p>对外环来说，COT 的对象和峰值电流模式简化模型几乎一样：负载极点 1/(2πRC)、ESR 零点，再乘以高频双极点。因此补偿思路相同：</p>
  <ul><li>需要无静差、fc 不高时：Type I 积分器即可（fc 远低于负载极点以上的平台段，相位 −90° − 对象 −90°，要求 fc 在负载极点以下或附近；否则用 Type II）；</li>
  <li>想把 fc 提高到 fs/10 左右：Type II，零点放在负载极点，极点放在 ESR 零点或 1/(2Ton) 以下。</li></ul>
  <p><b>纹波型 COT（D-CAP）</b>没有电流信息，靠输出电容 ESR 上的纹波充当电流信号，因此要求 rc·C > Ton/2（见 ${Lr.link('cot')}）。陶瓷电容 ESR 太小时，要么用 RC 纹波注入（LM5164 手册中的 Type 2/Type 3 纹波注入），要么选 D-CAP3 这类内部电流仿真的芯片。下方对比 Type I 与 Type II 两种外环补偿在电流型 COT 上的效果。</p>`,
  sl: [{ k: 'ct', l: '外环补偿', opts: [['1', 'Type I（积分）'], ['2', 'Type II（零点对准负载极点）']], v: '2' }, { k: 'fc', l: '目标 fc', a: 2e3, b: 6e4, v: 2.5e4, log: true, u: 'Hz' }],
  calc(v) {
    const P = Object.assign(PS.clone(PS.DEFAULTS), { mode: 'coti', Ri: 0.1, compType: v.ct === '1' ? 1 : 2, fcAuto: false, fc: v.fc, pm: 60 });
    const R = PS.design(P); if (R.fatal) return { series: [], info: R.fatal };
    const op = R.op, sm = cmSimple(P, op);
    if (v.ct === '2') { // 零点放在负载极点，极点放在 1/(2Ton) 与 fESR 中较小者
      const fz = sm.wp / TAU, fp = Math.min(op.fesr, 1 / (2 * op.Ton)), cp = { type: 2, z: [TAU * fz], p: [TAU * Math.max(fp, 3 * v.fc)], wi: 1 };
      PS.compSolveGain(cp, R.Pd, v.fc); R.kd.cp = cp;
    }
    const gc = s => PS.compEval(R.kd.cp, s), Tf = s => C.mul(R.Pd(s), gc(s)), mg = PS.margins(Tf, R.fmin, R.fmax);
    return { f0: R.fmin, f1: R.fmax, mg, R, op, sm, vlines: [{ x: sm.wp / TAU, label: 'fp 负载' }, { x: 1 / (2 * op.Ton), label: '1/(2Ton)' }, { x: op.fesr, label: 'fESR' }],
      series: [{ name: '开环 T', fn: Tf, color: c(1) }, { name: '对象（电流型 COT）', fn: R.Pd, color: c(2), dash: true, width: 1.6 }, { name: '补偿器 Gc', fn: gc, color: c(3) }],
      info: `Type ${v.ct}：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}。Ton = ${V(op.Ton, 's')}，高频双极点 ${hz(1 / (2 * op.Ton))}。` + (v.ct === '1' && v.fc > 2 * sm.wp / TAU ? '<b>Type I 时 fc 高于负载极点太多，相位不够。</b>' : ''), mgx: mg };
  },
  steps(v, r) {
    if (!r.sm) return [{ t: '无效', r: r.info }];
    const op = r.op, sm = r.sm, cp = r.R.kd.cp;
    return [{ t: '导通时间与双极点', f: 'Ton = D·Ts，f<sub>1</sub> = 1/(2Ton)，Q<sub>1</sub> = 2/π', r: 'Ton = ' + V(op.Ton, 's') + '，f1 = ' + hz(1 / (2 * op.Ton)) },
      { t: '负载极点', f: 'f<sub>p</sub> = 1/(2πRC)', r: hz(sm.wp / TAU) },
      { t: 'fc 处对象相位', r: deg(PS.phaseAt(r.R.Pd, v.fc)) },
      { t: '补偿器', r: 'Type ' + v.ct + '：' + PS.pzList(cp).map(x => x.k + ' ' + hz(x.f)).join('，') },
      { t: '结果', r: 'fc = ' + hz(r.mgx.fc) + '，PM = ' + PS.fmtNum(r.mgx.pm, 1) + '°', n: v.ct === '1' ? 'Type I 的 PM ≈ 180° − 90° − |∠P(fc)|，只有 fc 在负载极点附近或以下时才够用。' : '零点抵消负载极点后，fc 处相位只受高频双极点与 ESR 影响。' }];
  },
  roles: { head: ['控制方式', '电流信息来源', '稳定条件', '外环补偿', '芯片举例'], rows: [
    ['纹波型 COT（D-CAP）', '输出电容 ESR 纹波', 'rc·C > Ton/2', '通常无误差放大器（谷值调节）', 'TPS53355'],
    ['纹波注入 COT', '外部 RC 从开关节点注入', '注入纹波 ≥ 手册要求', '无误差放大器', 'LM5164（Type 2/3 纹波注入）'],
    ['电流仿真 COT（D-CAP3）', '内部 RC 仿真电感电流', '芯片内部保证', '内部积分/无需外部补偿', 'TPS548A20'],
    ['电流型 COT（真实采样）', '采样电阻 / DCR', 'Q1 = 2/π 恒稳定', 'Type I 或 Type II', '多相 VR 控制器常用']] },
  quiz: [['为什么 COT 不需要斜坡补偿？', 'COT 的调制是“谷值触发 + 固定导通时间”，扰动经过一个 Ton 之后不会像峰值电流模式那样按 (Sf−Se)/(Sn+Se) 放大；Jian Li 模型中 Q1 = 2/π 与 D 无关，始终稳定。'],
    ['D-CAP3 芯片为什么支持全陶瓷电容？', '它不依赖 ESR 纹波，而是用内部 RC 网络从 SW 节点重建电感电流斜坡加到比较器上，相当于电流型 COT。']] });

})(typeof window !== 'undefined' ? window : globalThis);
