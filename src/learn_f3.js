/* 学习：开环增益分析方法（读开环 Bode、每个极零点的目的、环路测量） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const G3 = '开环增益分析方法';
const dB = x => (20 * Math.log10(Math.abs(x))).toFixed(1) + ' dB';
const PRE = [['0', '12V→5V Buck 电压模式 Type III'], ['1', '5V→12V Boost 峰值电流 OTA'], ['2', '12V→−5V Buck-Boost 数字电压模式'], ['3', '12V→1.2V Buck 纹波 COT'], ['4', '48V→12V Buck 平均电流双环'], ['5', '12V→3.3V Buck 数字峰值电流']];
// 在 [f0,f1] 上找 |T| 的斜率（dB/dec）
const slopeAt = (Tf, f) => 20 * Math.log10(C.abs(Tf(C.jw(f * 1.122))) / C.abs(Tf(C.jw(f / 1.122)))) / 0.1;

/* ---------- 读开环 Bode 图：一张图看完设计质量 ---------- */
Lr.add({ id: 'olread', group: G3, title: '怎样从开环增益 T 分析一个电源环路', pre: ['fb', 'pmtime', 'bodeasy'], kw: '开环 分析 检查清单 斜率 低频增益 高频衰减 fc PM GM',
  html: `${K('拿到一张开环 Bode 图，按“低频 → fc → 高频 → 工况”四步检查：① 低频增益够不够大（静差、调整率、抑制）；② fc 在哪、斜率是不是 −20 dB/dec、PM 够不够；③ GM 与高频衰减（开关纹波、fs/2 处）；④ 换到最差工况再看一遍，有没有多次穿越、条件稳定。')}`,
  talk: (v, r) => `<p>补偿设计的结果最终都体现在开环增益 T(s) = Gc·Fm·Gvd·H 这一条曲线上。下面以一个真实的设计（可在上方切换示例）为例，把“看图”变成一套可重复的检查方法。每一项的当前读数都在下方“实际计算过程”中给出。</p>
  <h4>① 低频段：增益越大越好</h4>
  <p>低频 |T| 决定输出电压的静态精度、负载/线性调整率，以及对 100/120 Hz 工频纹波等低频扰动的抑制能力（压低 |T| 倍）。有积分器时低频斜率为 −20 dB/dec，增益在直流趋于无穷。检查点：100 Hz 处 |T| 通常应 > 40 dB；电压模式在 LC 谐振 f0 处 |T| 应明显大于 0 dB（否则谐振峰会让 |T| 在 f0 附近再次穿越）。</p>
  <h4>② 穿越频率 fc 与 PM：带宽与阻尼</h4>
  <p>fc 近似等于闭环带宽，决定负载阶跃的跌落（ΔV ≈ ΔI/(2π·fc·C)）和恢复时间（约 3～5 个 1/fc）。fc 的上限来自：开关频率（模拟 fs/10～fs/5，数字 fs/20 左右）、RHPZ（< fRHPZ/5）、数字延时、峰值电流模式 fs/2 双极点。<b>理想情况是 |T| 以 −20 dB/dec 穿过 0 dB</b>，这时相位在 fc 附近变化平缓，PM 对元件容差不敏感；若以 −40 dB/dec 穿越，相位接近 −180°，PM 很小且对增益变化极其敏感。PM 一般取 45°～60°。</p>
  <h4>③ 高频段：GM 与噪声衰减</h4>
  <p>相位到达 −180° 的频率处，|T| 应比 0 dB 低 6～10 dB 以上（GM）。fc 以上 |T| 应持续下降，在 fs/2 处足够小（通常 < −20 dB），否则开关纹波经补偿器放大后进入 PWM 比较器，造成占空比抖动、多次翻转甚至次谐波。这就是补偿器高频极点的作用。</p>
  <h4>④ 工况与容差：在最差点再看一遍</h4>
  <p>电压模式 T 与 Vin 成正比；Boost 的 RHPZ 在低 Vin、重载时最低；轻载 LC 谐振 Q 升高；电容随偏压、温度、老化变化。要在 Vin×Io 的角点上重复上述检查（本工具“工况扫描”页），并确认没有<b>多次穿越</b>和<b>条件稳定</b>（${Lr.link('nyq')}）。</p>
  <h4>⑤ 用分解图定位问题</h4>
  <p>T = P·Gc，取对数后是相加。把对象 P 和补偿器 Gc 分别画出来（下方附加图），就能看出某一段的斜率、相位是谁造成的：PM 不够，是对象在 fc 处相位太低（看 P），还是补偿器提升不够、极点放得太低（看 Gc）。下一课 ${Lr.link('pzwhy')} 会逐个拆开补偿器的零极点。</p>`,
  sl: [{ k: 'pre', l: '示例设计', opts: PRE, v: '0' }, { k: 'g', l: '增益倍率（模拟偏差）', a: 0.25, b: 4, v: 1, log: true, fmt: x => dB(x) }],
  calc(v) {
    const R = PS.design(PS.preset(+v.pre));
    if (R.noLoop || !R.T) return { series: [], info: '纹波型 COT 无误差放大器，无外环开环增益可读。请选其他示例。', R };
    const Tf = s => C.sc(R.T(s), v.g), mg = PS.margins(Tf, R.fmin, R.fmax), f = PS.logspace(R.fmin, R.fmax, 500), P = R.P;
    const vl = [{ x: R.op.f0, label: 'f0' }];
    if (isFinite(R.op.frhpz)) vl.push({ x: R.op.frhpz, label: 'RHPZ' });
    if (R.op.fesr < R.fmax) vl.push({ x: R.op.fesr, label: 'fESR' });
    vl.push({ x: P.fs / 2 * 0.98, label: 'fs/2' });
    const dec = Ls.bcfg([{ name: '对象 P', fn: R.Pd, color: c(2) }, { name: '补偿器 Gc', fn: s => C.sc(R.gcPlot(s), v.g), color: c(3) }, { name: '开环 T = P·Gc', fn: Tf, color: c(1), width: 1.4, dash: true }], f, { vlines: vl.concat(isFinite(mg.fc) ? [{ x: mg.fc, label: 'fc' }] : []), height: 380, ph0: -180 });
    return { f0: R.fmin, f1: R.fmax, mg, vlines: vl, series: [{ name: '开环 T', fn: Tf, color: c(1) }], R, Tf, mgx: mg,
      extra: [{ title: '分解：对象 P 与补偿器 Gc（dB 相加 = T）', note: '在 fc 处读：∠T = ∠P + ∠Gc，|T| = |P|·|Gc| = 1。', cfg: dec }],
      info: `${PS.TOPOS[P.topo]} · ${PS.MODES[P.mode]}：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}${mg.crossings > 1 ? '，<b>' + mg.crossings + ' 次穿越</b>' : ''}。` };
  },
  steps(v, r) {
    const R = r.R; if (!r.Tf) return [{ t: '无外环', r: '纹波型 COT 无误差放大器' }];
    const P = R.P, mg = r.mgx, Tf = r.Tf, st = [], ok = b => b ? '<span class="st good">合格</span>' : '<span class="st bad">需注意</span>';
    const t100 = C.abs(Tf(C.jw(100))), tf0 = C.abs(Tf(C.jw(R.op.f0)));
    st.push('① 低频');
    st.push({ t: '100 Hz 处 |T|', r: dB(t100) + ' → 100 Hz 扰动被压低 ' + num(t100) + ' 倍 ' + ok(t100 > 100) });
    st.push({ t: 'LC 谐振 f0 = ' + hz(R.op.f0) + ' 处 |T|', r: dB(tf0) + ' ' + ok(tf0 > 3 || R.op.f0 > mg.fc), n: P.mode === 'vmc' ? '电压模式要求 f0 处仍有足够增益，否则谐振峰附近相位 −180° 时可能出现第二次穿越。' : '电流模式下 LC 双极点已被电流环拆开，这一项只作参考。' });
    st.push('② 穿越频率与相位裕度');
    const lim = [P.impl === 'digital' ? P.fs / 20 : P.fs / 5].concat(isFinite(R.op.frhpz) ? [R.frhpzWorst / 5] : []), fl = Math.min(...lim);
    st.push({ t: 'fc', r: hz(mg.fc) + '（上限参考 ' + hz(fl) + (isFinite(R.op.frhpz) ? '，含 fRHPZ,最差/5' : '') + '）' + ok(mg.fc <= fl * 1.05) });
    const sl = slopeAt(Tf, mg.fc);
    st.push({ t: 'fc 处斜率', r: sl.toFixed(1) + ' dB/dec ' + ok(sl > -30 && sl < -10), n: '−20 dB/dec 最理想；接近 −40 说明 fc 落在了对象双极点之后、补偿器零点没起作用的区域。' });
    st.push({ t: 'PM', f: 'PM = 180° + ∠T(fc) = 180° + ∠P(fc) + ∠Gc(fc)', r: '∠P = ' + PS.phaseAt(R.Pd, mg.fc).toFixed(1) + '°，∠Gc = ' + PS.deg(C.arg(R.gcPlot(C.jw(mg.fc)))).toFixed(1) + '° → <b>PM = ' + mg.pm.toFixed(1) + '°</b> ' + ok(mg.pm >= 45) });
    if (mg.crossings > 1) st.push({ t: '多次穿越', r: mg.crossings + ' 次，最小 PM ' + mg.pmMin.toFixed(1) + '°', n: '每一次穿越都要满足相位条件。' });
    st.push('③ 高频');
    st.push({ t: 'GM', r: (isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB @ ' + hz(mg.fgm) : '∞（相位未到 −180°）') + ' ' + ok(!(mg.gm < 6)) });
    const tfs = C.abs(Tf(C.jw(P.fs / 2 * 0.98)));
    st.push({ t: 'fs/2 处 |T|', r: dB(tfs) + ' ' + ok(tfs < 0.3), n: '这里还大，开关纹波会被放大送进调制器。补偿器的高频极点（fp1/fp2）就是为此而设。' });
    st.push('④ 工况（固定补偿器，扫描 Vin × Io 九个角点）');
    try {
      const rows = PS.sweep(R).filter(x => !x.err), w = rows.reduce((a, b) => (b.pm < a.pm ? b : a), rows[0]);
      st.push({ t: '最差 PM 工况', r: 'Vin = ' + V(w.Vin, 'V') + '，Io = ' + V(w.Io, 'A') + '：fc = ' + hz(w.fc) + '，PM = ' + PS.fmtNum(w.pm, 1) + '° ' + ok(w.pm >= 40), n: '“工况扫描”页可以看到全部角点的 Bode 叠加。' });
    } catch (e) { st.push({ t: '工况扫描', r: '—' }); }
    return st;
  },
  rolesTitle: '开环 Bode 图检查清单',
  roles: { head: ['检查项', '目标', '不满足时的典型原因', '怎样改'], rows: [
    ['低频增益（100 Hz）', '> 40 dB', '积分增益太低、fc 太低', '提高 fi（即提高 fc），或把零点放低'],
    ['fc', '模拟 ≤ fs/10～fs/5；数字 ≤ fs/20；Boost < fRHPZ/5', '期望过高', '降低 fc，或提高 fs、减小 L'],
    ['fc 处斜率', '≈ −20 dB/dec', '零点太高、对象双极点在 fc 附近', '把零点放到 fc 以下（Type III 双零点放 f0 附近）'],
    ['PM', '45°～60°（最差工况 ≥ 40°）', '对象相位太低、补偿器提升不够、延时', '加大 K、换 Type III、降低 fc、减小延时'],
    ['GM', '≥ 6～10 dB', '高频极点太低、Q 过高的双极点、延时', '提高极点、加斜坡补偿、降低增益'],
    ['fs/2 处衰减', '|T| < −20 dB', '缺高频极点、极点太高', '加/降低高频极点（fs/2 附近）'],
    ['多次穿越 / 条件稳定', '只穿越一次', '轻载谐振峰、双零点太高', '零点放低、fc 远高于 f0、加阻尼'],
    ['工况变化', '所有角点都满足', 'Vin、负载、电容变化', '工况扫描；电压模式用输入前馈']] },
  quiz: [['某电压模式 Buck 的 PM 只有 25°，分解图显示 fc 处对象相位 −178°、补偿器相位 −27°。问题出在哪里？', '补偿器在 fc 处只有 −27°，即相对积分器的 −90° 只提升了 63°，而对象需要 >130° 的提升。应改用 Type III（或加大 K），把双零点放到 f0 附近、极点移到 fc 以上更远处。'],
    ['为什么要求 fc 处斜率接近 −20 dB/dec，而不只是看 PM？', '最小相位系统中斜率与相位近似对应（−20 dB/dec ≈ −90°）。斜率平缓意味着 fc 附近相位变化慢，增益变化导致 fc 移动时 PM 基本不变，设计更“鲁棒”。']] });
/* ---------- 每个零极点的目的：逐个去掉看后果 ---------- */
// 基于示例 1（VMC Type III），可对积分器、两个零点、两个极点分别“去掉/放错”
Lr.add({ id: 'pzwhy', group: G3, title: '补偿器每个零点、极点的目的：去掉它会怎样', pre: ['olread', 'type3'], kw: '零点 极点 目的 作用 为什么 积分 Type III 放错',
  html: `${K('积分器 → 无静差；零点 → 在 fc 以下把相位“抬起来”、把斜率拉平；极点 → 在 fc 以上让增益重新下降，抵消 ESR 零点、衰减开关纹波。零点放在 fc 以下、极点放在 fc 以上，相位提升的峰值才会落在 fc 附近。')}`,
  talk: `<p>补偿器的每一个零点、极点都有明确的目的。最好的理解方式是做“减法”：以一个已经设计好的电压模式 Type III 为基础，把某一个零极点去掉或移到错误的位置，看开环 Bode 图、PM、fs/2 处衰减和负载阶跃分别发生了什么。</p>
  <h4>积分器（原点极点）</h4><p>让低频增益趋于无穷，消除稳态误差。代价是全频段固定 −90° 相位，所以“PM = 90° − 补偿器还欠的那部分”。去掉积分器（换成同等中频增益的比例环节），负载阶跃后输出不再回到原值。</p>
  <h4>零点：为什么放在 fc 以下</h4><p>一个零点在其频率以上提供最多 +90° 相位，但在转折频率处只有 +45°，到 10 倍频才接近 +90°。要让 fc 处得到足够的提升，零点必须<b>低于</b> fc。电压模式的 LC 双极点在 f0 之后带来 −180°，两个零点放在 f0 附近，正好把 f0 以后的 −40 dB/dec 拉回 −20 dB/dec。零点放得太高：fc 处相位不够；放得太低：零点以下的积分增益变小，低频抑制变差，而且零点与积分之间的“平台”太宽，负载阶跃后的恢复出现慢尾巴。</p>
  <h4>极点：为什么放在 fc 以上</h4><p>极点会吃掉相位，放在 fc 以下就把零点辛苦抬起的相位又压回去。但没有极点也不行：两个零点之后补偿器增益以 +20 dB/dec 一路上升，开关频率处的纹波被大幅放大送进 PWM 比较器；ESR 零点之后对象斜率变缓，环路高频增益也会上翘。所以第一个极点通常放在 ESR 零点处抵消它（或 fc·√K），第二个放在 fs/2 附近专门衰减开关噪声。</p>
  <h4>K 因子的几何直觉</h4><p>零点和极点关于 fc 对称（几何平均为 fc）时，相位提升峰值恰好落在 fc；两者间距越大（K 越大）提升越多，但低频增益更低、高频增益更高，噪声与纹波放大更严重。设计就是在这些代价之间找平衡。</p>`,
  sl: [{ k: 'mod', l: '修改哪一项', opts: [['none', '原设计（全部保留）'], ['noint', '去掉积分器（换成比例）'], ['z1hi', '零点 fz1 放到 fc 以上（×5）'], ['z2hi', '两个零点都放到 fc 处'], ['nz2', '去掉第二个零点（退化为 Type II）'], ['p1lo', '极点 fp1 放到 fc 以下（÷4）'], ['nop1', '去掉极点 fp1'], ['nop2', '去掉极点 fp2'], ['nop', '去掉两个极点']], v: 'none' }],
  calc(v) {
    const R = PS.design(PS.preset(0)), P = R.P, op = R.op, cp0 = R.rz.cpReal, fc0 = R.mg.fc, Pd = R.Pd;
    const z = cp0.z.slice().sort((a, b) => a - b), p = cp0.p.slice().sort((a, b) => a - b);
    let cp = { type: 3, wi: cp0.wi, z: z.slice(), p: p.slice() }, integ = true;
    const m = v.mod;
    if (m === 'z1hi') cp.z[0] = TAU * fc0 * 5;
    if (m === 'z2hi') cp.z = [TAU * fc0, TAU * fc0];
    if (m === 'nz2') cp.z = [z[0]];
    if (m === 'p1lo') cp.p[0] = TAU * fc0 / 4;
    if (m === 'nop1') cp.p = [p[1]];
    if (m === 'nop2') cp.p = [p[0]];
    if (m === 'nop') cp.p = [];
    if (m === 'noint') integ = false;
    // 增益重新按原 fc 归一（保持 |T(fc0)| = 1），这样比较的是“形状”的影响
    // 去掉积分器：把“积分 × 第一个零点”换成它在 fz1 以上的等效常数（PI → P），保留其余零极点
    if (!integ) cp.z = [z[1]];
    const shape = s => integ ? PS.compEval(cp, s) : PS.compShape(cp, s);
    const g0 = 1 / C.abs(C.mul(Pd(C.jw(fc0)), shape(C.jw(fc0)))), gc = s => C.sc(shape(s), g0);
    const Tf = s => C.mul(Pd(s), gc(s)), mg = PS.margins(Tf, R.fmin / 10, R.fmax), T0 = R.T;
    const mg0 = R.mg, fsh = P.fs / 2 * 0.98, f = PS.logspace(R.fmin / 10, R.fmax, 500), stable = mg.pm > 0 && isFinite(mg.fc);
    const ld0 = Lr.loadStep(R, R.gc, P.Io * 0.5, 4e-4), ld = stable ? Lr.loadStep(R, gc, P.Io * 0.5, 4e-4) : null;
    const lines = [{ name: '原设计', color: c(2), width: 1.8, dash: true, x: ld0.t, y: ld0.v }];
    if (ld) lines.push({ name: '修改后', color: c(1), width: 2.4, x: ld.t, y: ld.v });
    const vl = cp.z.map((w, i) => ({ x: w / TAU, label: 'fz' + (i + 1) })).concat(cp.p.map((w, i) => ({ x: w / TAU, label: 'fp' + (i + 1) })), [{ x: op.f0, label: 'f0' }]);
    return { f0: R.fmin / 10, f1: R.fmax, mg, vlines: vl, R, mg0, Tf, gc, fsh, cp, integ,
      series: [{ name: '开环 T（修改后）', fn: Tf, color: c(1) }, { name: '开环 T（原设计）', fn: T0, color: c(2), dash: true, width: 1.6 }],
      extra: [{ title: '补偿器 Gc 单独的 Bode 图', note: '虚线为原设计。注意零点让增益“拐上去”，极点让它“拐下来”。', cfg: Ls.bcfg([{ name: 'Gc 修改后', fn: gc, color: c(3) }, { name: 'Gc 原设计', fn: R.gcPlot, color: c(2), dash: true, width: 1.5 }], f, { vlines: vl, height: 340 }) },
        { title: '负载阶跃 ' + PS.fmt(P.Io * 0.5, 'A') + '（小信号）', note: stable ? '原设计最大跌落 ' + V(Math.max(...ld0.v.map(x => -x)), 'V') + '，修改后 ' + V(Math.max(...ld.v.map(x => -x)), 'V') + '；400 µs 时残余偏差：原 ' + V(-ld0.v[ld0.v.length - 1], 'V') + '，修改后 ' + V(-ld.v[ld.v.length - 1], 'V') + '。' : '<b>修改后环路不稳定</b>，只显示原设计。', cfg: Ls.tcfg(lines, { label: 'Δvo (V)', hlines: [0] }) }],
      info: `原设计：fc = ${hz(mg0.fc)}，PM = ${mg0.pm.toFixed(1)}°，fs/2 处 |T| = ${dB(C.abs(T0(C.jw(fsh))))}。修改后：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°${mg.crossings > 1 ? '（' + mg.crossings + ' 次穿越）' : ''}，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}，fs/2 处 |T| = ${dB(C.abs(Tf(C.jw(fsh))))}。` };
  },
  steps(v, r) {
    const R = r.R, fc = r.mg0.fc, s = C.jw(fc), st = [];
    const ph = w => PS.deg(Math.atan(fc / (w / TAU)));
    st.push('原设计在 fc = ' + hz(fc) + ' 处，各因子贡献的相位');
    st.push({ t: '对象 P', r: PS.phaseAt(R.Pd, fc).toFixed(1) + '°' });
    st.push({ t: '积分器', r: '−90°' });
    R.rz.cpReal.z.slice().sort((a, b) => a - b).forEach((w, i) => st.push({ t: '零点 fz' + (i + 1) + ' = ' + hz(w / TAU), f: '+arctan(fc/fz)', r: '+' + ph(w).toFixed(1) + '°' }));
    R.rz.cpReal.p.slice().sort((a, b) => a - b).forEach((w, i) => st.push({ t: '极点 fp' + (i + 1) + ' = ' + hz(w / TAU), f: '−arctan(fc/fp)', r: '−' + ph(w).toFixed(1) + '°' }));
    st.push({ t: '合计 → PM', r: 'PM = 180° + 各项之和 = ' + r.mg0.pm.toFixed(1) + '°' });
    st.push('修改后');
    st.push({ t: '新的零极点', r: (r.integ ? '积分器保留；' : '<b>无积分器</b>；') + '零点 ' + (r.cp.z.map(w => hz(w / TAU)).join('、') || '无') + '；极点 ' + (r.cp.p.map(w => hz(w / TAU)).join('、') || '无') });
    st.push({ t: '结果', r: 'fc = ' + hz(r.mg.fc) + '，PM = ' + PS.fmtNum(r.mg.pm, 1) + '°，fs/2 处 |T| ' + dB(C.abs(r.Tf(C.jw(r.fsh)))) + '（原 ' + dB(C.abs(R.T(C.jw(r.fsh)))) + '）', n: { none: '这就是 K 因子法给出的平衡点。', noint: '没有积分器，低频增益停在一个有限值（本例 10 Hz 处 |T| 只有 ' + dB(C.abs(r.Tf(C.jw(10)))) + '，原设计为 ' + dB(C.abs(R.T(C.jw(10)))) + '），负载阶跃后输出回不到原值（见阶跃图终值）。PM 反而变大，因为少了积分器的 −90°——这说明 PM 不是唯一的指标。', z1hi: '零点高于 fc，在 fc 处只提供很少相位，PM 大幅下降。', z2hi: '两个零点都在 fc：各只提供 45°，提升不够；而且 f0～fc 之间斜率为 −40 dB/dec。', nz2: '少一个零点就少约 70°～90° 的提升，电压模式 LC 双极点的 −180° 补不回来。', p1lo: '极点低于 fc，吃掉了零点的提升。', nop1: 'ESR 零点不再被抵消，补偿器高频增益偏高。', nop2: 'fs/2 附近缺少衰减，纹波被放大进入 PWM 比较器（相位裕度反而略增，这正是“代价”的另一面）。', nop: '两个零点之后补偿器增益以 +20 dB/dec 一路上升（看上方 Gc 单独的 Bode 图），fs/2 处环路增益明显变大；纹波越大、ESR 越大越严重，实际电路会出现占空比抖动，小信号 PM 再好看也没有意义。' }[v.mod] });
    return st;
  },
  roles: (v, r) => {
    const R = r.R, cp = R.rz.cpReal, z = cp.z.slice().sort((a, b) => a - b), p = cp.p.slice().sort((a, b) => a - b), f0 = R.op.f0, fe = R.op.fesr, fc = r.mg0.fc, fs = R.P.fs;
    const where = f => f < f0 * 1.3 ? '在 f0 = ' + hz(f0) + ' 附近' : '高于 f0（K 因子法放在 fc/√K）';
    const p1why = Math.abs(Math.log10(p[0] / TAU / fe)) < 0.2 ? '放在 fESR = ' + hz(fe) + ' 抵消 ESR 零点' : '由 K 因子法放在 fc·√K，与零点关于 fc 对称，使相位提升峰值落在 fc（本例 fESR = ' + hz(fe) + ' 很高，不需要专门抵消）';
    return { head: ['零极点', '原设计位置', '目的', '为什么放在这里', '放错 / 去掉的后果'], rows: [
      ['积分器', 'fi = ' + hz(cp.wi / TAU), '无静差；整体增益决定 fc', '必须有', '静差、调整率差'],
      ['零点 fz1', hz(z[0] / TAU), '抵消 LC 双极点 −180° 中的 90°', where(z[0] / TAU) + '，低于 fc = ' + hz(fc) + '，fc 处贡献 +' + PS.deg(Math.atan(fc / (z[0] / TAU))).toFixed(0) + '°', '太高 → PM 不足；太低 → 低频增益下降、恢复拖尾'],
      ['零点 fz2', hz(z[1] / TAU), '抵消另外 90°', '与 fz1 合起来把 f0 之后的 −40 dB/dec 拉回 −20 dB/dec', '去掉 → 退化为 Type II，电压模式 PM 不够'],
      ['极点 fp1', hz(p[0] / TAU), 'fc 以上让增益重新下降', p1why, '低于 fc → 吃掉相位；去掉 → 高频增益偏高'],
      ['极点 fp2', hz(p[1] / TAU), '衰减开关纹波与噪声', p[1] / TAU > fs / 5 ? '靠近 fs/2 = ' + hz(fs / 2) : '与 fp1 一起（K 因子法双极点重合）；在 fs/2 = ' + hz(fs / 2) + ' 处已提供 ' + (20 * Math.log10(Math.hypot(1, fs / 2 / (p[1] / TAU)))).toFixed(0) + ' dB 衰减', '去掉 → fs/2 处增益大，PWM 抖动；太低 → 损失 fc 处相位']] };
  },
  quiz: [['为什么零点放在 fc 处只给 45°，而不是 90°？', '零点相位 arctan(f/fz)，在 f = fz 时为 45°，到 10·fz 才接近 84°。所以要在 fc 得到大的提升，零点必须远低于 fc（但不能太低，否则低频增益损失）。'],
    ['去掉 fp2 后 PM 反而变大了，为什么还要保留它？', 'fp2 的作用不在 PM，而在高频：衰减 fs/2 附近的开关纹波，避免占空比抖动、比较器多次翻转、噪声放大。小信号 Bode 图看不到这些大信号问题，但实际电路会出问题。']] });

/* ---------- 环路测量：注入点、扰动幅度、Bode 分析仪 ---------- */
Lr.add({ id: 'olmeas', group: G3, title: '实测开环增益：注入法与注意事项', pre: ['olread'], kw: '测量 注入 Bode 分析仪 网络分析仪 Middlebrook 注入电阻 扰动幅度',
  html: `${F('在反馈路径中串入注入电阻 R<sub>inj</sub>（10～50 Ω），隔离变压器在其两端注入正弦 v<sub>z</sub>，测 T = −v<sub>y</sub>/v<sub>x</sub>（v<sub>x</sub> 在注入点下游、v<sub>y</sub> 在上游）')}
  ${K('要求：注入点一侧是低阻抗（输出端）、另一侧是高阻抗（分压电阻/误差放大器输入），这样插入 R<sub>inj</sub> 不改变环路；扰动幅度足够小，在 fc 附近输出扰动只有输出电压的约 1%；扫频范围覆盖 fc/100～fs/2。')}`,
  talk: `<p>仿真和计算只能告诉你“模型”的环路增益，实际电路还有寄生参数、电容容量随偏压降低、电流采样噪声、PCB 走线等因素。最终都要用 Bode 分析仪（频率响应分析仪）实测开环增益，这是电源设计验证的标准步骤。</p>
  <p><b>为什么可以在闭环工作时测开环？</b>Middlebrook 注入法：在环路中某一点串入一个小电阻，用隔离变压器在电阻两端加一个正弦扰动 v<sub>z</sub>。扰动绕环路一圈，电阻两侧的电压分别为 v<sub>x</sub>（下游，送往分压网络）和 v<sub>y</sub>（上游，来自功率级输出），二者之比的负值就是环路增益。电源始终闭环运行，工作点正常。</p>
  <p><b>注入点选择</b>：通常在输出电容与上分压电阻之间。那里一侧是功率级输出（低阻抗），另一侧是分压电阻（高阻抗），插入 10～50 Ω 几乎不影响环路。不能选在两侧阻抗相当的位置。</p>
  <p><b>扰动幅度</b>：太大会把电源推出小信号线性区（误差放大器摆幅受限、占空比饱和），曲线在 fc 附近变得不平滑；太小则被噪声淹没，低频（环路增益很大，v<sub>x</sub> 很小）和高频（v<sub>y</sub> 很小）测不准。常用做法是频率相关的扰动幅度：低频和高频大一些，fc 附近小一些。</p>
  <p><b>测量能看出的问题</b>：实测 fc 比计算低——多半是陶瓷电容直流偏压下容量下降，或电流采样增益偏差；fs/2 附近出现尖峰——峰值电流模式斜坡补偿不足；低频增益平台——误差放大器有限增益。下方计算按当前示例给出注入后的 v<sub>x</sub>、v<sub>y</sub> 幅值，帮助你选择扰动幅度。</p>`,
  sl: [{ k: 'pre', l: '示例设计', opts: PRE.filter(x => x[0] !== '3'), v: '0' }, { k: 'vz', l: '注入幅度 vz', a: 1e-3, b: 0.3, v: 0.02, log: true, u: 'V' }],
  calc(v) {
    const R = PS.design(PS.preset(+v.pre)), Tf = R.T, f = PS.logspace(R.fmin, R.fmax, 400);
    // vz = vx − vy，vy = −T·vx ⇒ vx = vz/(1+T)，vy = −T·vz/(1+T)
    const vx = f.map(x => { const t = Tf(C.jw(x)); return C.abs(C.div(C.of(v.vz), C.addr(t, 1))); }), vy = f.map(x => { const t = Tf(C.jw(x)); return C.abs(C.div(C.sc(t, v.vz), C.addr(t, 1))); });
    const cfg = { xLog: true, xUnit: 'Hz', height: 300, vlines: [{ x: R.mg.fc, label: 'fc' }], panels: [{ label: '幅值 (dBV)', unit: 'dBV', series: [{ name: '|vx|（注入点下游）', color: c(1), width: 2.2, x: f, y: vx.map(PS.dB) }, { name: '|vy|（注入点上游 = 输出扰动）', color: c(2), width: 2.2, x: f, y: vy.map(PS.dB) }], hlines: [{ y: PS.dB(1e-3), dash: true }], clamp: [-160, 20, 160], step: 20, fmtTip: x => x.toFixed(1) }] };
    const ifc = f.findIndex(x => x >= R.mg.fc), vyfc = vy[Math.max(0, ifc)];
    return { f0: R.fmin, f1: R.fmax, mg: R.mg, series: [{ name: '开环 T（理论）', fn: Tf, color: c(1) }], R, vyfc, vx, vy, f,
      extra: [{ title: '注入后测量点上的信号幅值', note: '虚线为 1 mV（典型分析仪噪声底的量级）。信号低于噪声底的频段，测量结果不可信。', cfg }],
      info: `fc 处输出扰动 |vy| ≈ ${V(vyfc, 'V')}（输出电压 ${V(R.P.Vo, 'V')} 的 ${(100 * vyfc / R.P.Vo).toFixed(2)}%）${vyfc / R.P.Vo > 0.03 ? '，<b>偏大，可能进入大信号区</b>' : ''}。` };
  },
  steps(v, r) {
    const fl = r.f[0], fh = r.f[r.f.length - 1];
    return [{ t: '注入关系', f: 'v<sub>z</sub> = v<sub>x</sub> − v<sub>y</sub>，v<sub>y</sub> = −T·v<sub>x</sub>　⇒　v<sub>x</sub> = v<sub>z</sub>/(1+T)，v<sub>y</sub> = −T·v<sub>z</sub>/(1+T)' },
      { t: '低频（' + hz(fl) + '）', r: '|vx| = ' + V(r.vx[0], 'V') + '：环路增益很大，下游信号很小 → 低频需加大注入或接受较大噪声' },
      { t: 'fc 附近', r: '|vx| ≈ |vy| ≈ ' + V(r.vyfc, 'V'), n: '这里两路信号相当，最好测；也是输出扰动最大的地方，扰动幅度应以这里为准选择。' },
      { t: '高频（' + hz(fh) + '）', r: '|vy| = ' + V(r.vy[r.vy.length - 1], 'V') + '：环路增益很小，上游信号很小' },
      { t: '经验', r: '注入幅度使 fc 处输出扰动约为 Vo 的 0.5%～1%，同时让低频/高频的小信号高于噪声底 20 dB 以上；必要时分段扫频、调整幅度。' }];
  },
  roles: { head: ['项目', '推荐', '原因'], rows: [
    ['注入电阻', '10～50 Ω，注入点：输出电容 → 上分压电阻之间', '一侧低阻、一侧高阻，插入后不改变环路'],
    ['注入变压器', '宽带隔离变压器（10 Hz～10 MHz）', '把信号源与电源地隔离'],
    ['探头', '低电容、两路相同，接地尽量短', '高频相位误差、开关噪声耦合'],
    ['扫频范围', 'fc/100 ～ fs/2', '低频看增益、fc 附近看 PM、高频看 GM 与 fs/2'],
    ['IF 带宽 / 平均', '低频窄带宽、多次平均', '开关噪声与低频信号分离'],
    ['工况', '最低/最高 Vin、轻/重载、高/低温', '与工况扫描对照'],
    ['与模型对比', '实测 vs 本工具计算', '差异大时检查电容容量（直流偏压）、电流采样增益、斜坡']] },
  quiz: [['为什么注入点不能选在误差放大器输出（COMP）和调制器之间？', '那一点两侧阻抗都不低（COMP 输出阻抗高，尤其 OTA），插入电阻会改变环路；也可以选，但需要按 Middlebrook 条件校核阻抗比。'],
    ['实测 fc 与计算差很多，最常见是什么原因？', '① 陶瓷电容在直流偏压下容量只剩标称的 30%～60%：电压模式 LC 双极点上移、电流模式负载极点上移，fc 和 PM 都会变；② 电流模式的采样增益 Ri（采样电阻、DCR 采样的温漂）与设定不符；③ 误差放大器带宽有限或 OTA 输出阻抗分流。先用实际有效容量和实测 Ri 重算，再对比曲线。']] });

})(typeof window !== 'undefined' ? window : globalThis);
