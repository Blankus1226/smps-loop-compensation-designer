/* 学习：数字信号处理基础（采样与混叠、z 变换与差分方程、离散化方法对比、量化与极限环） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const G5 = '数字信号处理基础';
const dB = x => (20 * Math.log10(Math.abs(x))).toFixed(1) + ' dB';
const fx = (x, n) => (+x.toPrecision(n || 6)).toString();

/* ---------- 采样、混叠与零阶保持 ---------- */
Lr.add({ id: 'samp', group: G5, title: '采样、混叠与零阶保持', kw: '采样 混叠 aliasing Nyquist 奈奎斯特 ZOH 抗混叠 同步采样 纹波',
  html: `${F('采样频率 fs，Nyquist 频率 fs/2：频率 f 的正弦采样后与 |f − k·fs| 无法区分（混叠）')}${F('ZOH：H<sub>zoh</sub>(s) = (1 − e<sup>−sT</sup>)/(sT) ≈ e<sup>−sT/2</sup>（幅值 sinc，相位 −180°·f/fs）')}
  ${K('数字电源每个开关周期采样一次，输出电压里的开关纹波恰好在 fs 上：采样点固定在周期的同一位置时，纹波被混叠成直流偏移（这是好事：它被当成常数），采样点漂移时会混叠成低频“拍频”扰动。所以数字电源一定要把 ADC 触发与 PWM 同步，并选在纹波平均值附近。')}`,
  talk: `<p>模拟信号变成数字序列时，只保留了每隔 T = 1/fs 的瞬时值。<b>采样定理</b>说：只有低于 fs/2 的频率成分能被唯一还原；高于 fs/2 的成分会“折叠”到 0～fs/2 之间，冒充成一个低频信号，这就是混叠。混叠一旦发生就无法在数字域消除，只能在采样前用模拟滤波器（抗混叠滤波）把高频去掉。</p>
  <p>在电源里，最大的高频成分就是开关纹波（频率 = fs 及其谐波）。它与控制环路的采样频率相同，于是 f = fs 的纹波被混叠到 f − fs = 0，即直流：每次都在周期内同一时刻采样，得到的是同一个纹波相位上的值，表现为一个固定偏差。只要采样点固定，这个偏差可以被积分器吸收；但若 PWM 频率与采样频率有微小差异，或采样点随占空比移动，纹波就会混叠成很低频的扰动，环路无法抑制，输出出现缓慢的“拍”。</p>
  <p>数字控制器输出的占空比在一个周期内保持不变，这是<b>零阶保持（ZOH）</b>。ZOH 的频率响应是 sinc 函数，相位滞后正好等于半个周期的延时（−180°·f/fs）。它和计算延时、PWM 调制延时一起构成数字环路的总相位损失（见 ${Lr.link('delay')}）。</p>
  <p>下方实验：输入一个频率可调的正弦，按 fs 采样。把输入频率拖到 fs/2 以上，观察采样点连起来的“表观频率”；拖到接近 fs，表观频率趋近于 0。</p>`,
  sl: [{ k: 'fs', l: '采样频率 fs', a: 1e4, b: 1e6, v: 1e5, log: true, u: 'Hz' }, { k: 'r', l: '输入频率 / fs', a: 0.02, b: 1.98, v: 0.9, fmt: x => x.toFixed(3) }, { k: 'ph', l: '采样点相位', a: 0, b: 1, v: 0.3, fmt: x => (x * 360).toFixed(0) + '°' }],
  calc(v) {
    const T = 1 / v.fs, f = v.r * v.fs, n = 24, tEnd = n * T, t = [], y = [], ts = [], ys = [], yh = [], th = [];
    for (let i = 0; i <= 1200; i++) { const tt = tEnd * i / 1200; t.push(tt); y.push(Math.sin(TAU * f * tt)); }
    for (let k = 0; k <= n; k++) { const tt = (k + v.ph) * T; if (tt > tEnd) break; ts.push(tt); ys.push(Math.sin(TAU * f * tt)); }
    ts.forEach((tt, k) => { th.push(tt, Math.min(tt + T, tEnd)); yh.push(ys[k], ys[k]); });
    let fa = f % v.fs; if (fa > v.fs / 2) fa = v.fs - fa;
    const zoh = s => { const x = C.sc(s, T); return C.abs(x) < 1e-9 ? C.ONE : C.div(C.sub(C.ONE, C.exp(C.neg(x))), x); };
    return { f0: v.fs / 1000, f1: v.fs * 2, vlines: [{ x: v.fs / 2, label: 'fs/2' }, { x: v.fs, label: 'fs' }], ph0: -90,
      series: [{ name: 'ZOH 幅相', fn: zoh, color: c(1) }, { name: '半周期延时 e^(−sT/2)', fn: s => C.exp(C.sc(s, -T / 2)), color: c(2), dash: true }],
      plotTitle: 'Bode 图：零阶保持 ZOH 与半周期延时',
      extra: [{ title: '时域：连续信号、采样点与零阶保持输出', note: `输入 ${hz(f)}，采样后表观频率 <b>${hz(fa)}</b>${v.r > 0.5 ? '（已混叠）' : ''}。`, cfg: Ls.tcfg([
        { name: '输入 x(t)', color: PS.css('--axis'), width: 1.4, x: t, y },
        { name: '零阶保持输出', color: c(1), width: 2.2, x: th, y: yh },
        { name: '采样点', color: c(2), width: 2, x: ts, y: ys, dots: true }], { label: '幅值', height: 300, hlines: [0] }) }],
      info: `fs = ${hz(v.fs)}，输入 ${hz(f)} → 表观 ${hz(fa)}。ZOH 在 fs/10 处相位 −18°、幅值 ${dB(Math.sin(Math.PI * 0.1) / (Math.PI * 0.1))}。`, fin: f, fa };
  },
  steps(v, r) {
    const k = Math.round(r.fin / v.fs);
    return [{ t: 'Nyquist 频率', f: 'f<sub>N</sub> = fs/2', r: hz(v.fs / 2) },
      { t: '混叠频率', f: 'f<sub>a</sub> = |f − k·fs|，k 取使结果最小的整数', r: '|' + hz(r.fin) + ' − ' + k + ' × ' + hz(v.fs) + '| = <b>' + hz(r.fa) + '</b>' },
      { t: 'ZOH 相位', f: '∠H<sub>zoh</sub> = −π·f/fs（−180°·f/fs）', r: 'fs/10 处 −18°，fs/20 处 −9°' },
      { t: '电源中的开关纹波', r: 'f = fs → f<sub>a</sub> = 0：被当成直流偏差。采样点相位改变 → 偏差值改变（与纹波波形在该时刻的值相同）', n: '所以 ADC 触发要与 PWM 同步，并放在纹波“平均值”时刻（Buck 电感电流在导通/关断中点、输出电压纹波过零点附近）。' }];
  },
  roles: { head: ['现象', '成因', '电源中的表现', '对策'], rows: [
    ['混叠到直流', '采样频率 = 纹波频率', '固定的采样偏差', 'ADC 与 PWM 同步；采样点放在纹波平均值处'],
    ['混叠到低频（拍频）', '采样与开关不同步，或采样点随 D 移动', '输出缓慢摆动，环路抑制不了', '同步触发；必要时多次过采样平均'],
    ['噪声混叠', '采样前未滤除开关尖峰', '偶发的大误差、抖动', 'RC 抗混叠滤波；避开开关沿采样'],
    ['ZOH 相位', '占空比保持一个周期', '额外 −180°·f/fs 相位', '计入延时模型；降低 fc 或提高 fs']] },
  quiz: [['数字 Buck 采样频率等于开关频率，采样点放在开关管导通瞬间，会出什么问题？', '导通瞬间有开关振铃和尖峰，采样值噪声大；而且那一刻输出纹波处于极值附近，引入较大的采样偏差。一般放在导通或关断区间的中点。'],
    ['ZOH 的相位滞后和“半个周期延时”完全一样吗？', '相位完全一样（−π·f/fs），幅值不同：ZOH 有 sinc 衰减（fs/2 处约 −3.9 dB），纯延时幅值为 1。']] });

/* ---------- z 变换与差分方程 ---------- */
Lr.add({ id: 'ztr', group: G5, title: 'z 变换、差分方程与 z 平面', pre: ['spz', 'samp'], kw: 'z 变换 差分方程 单位圆 z 平面 极点 稳定 冲激响应',
  html: `${F('z<sup>−1</sup> = 延迟一个采样周期；差分方程 y[n] = b<sub>0</sub>x[n] + b<sub>1</sub>x[n−1] − a<sub>1</sub>y[n−1] ⇔ H(z) = (b<sub>0</sub> + b<sub>1</sub>z<sup>−1</sup>)/(1 + a<sub>1</sub>z<sup>−1</sup>)')}${F('z = e<sup>sT</sup>：s 平面左半平面 ↔ z 平面单位圆内；虚轴 jω ↔ 单位圆 e<sup>jωT</sup>')}
  ${K('数字系统稳定 ⇔ 所有极点在单位圆内。z = 1 对应直流（积分器的极点），z = −1 对应 fs/2（Nyquist）。极点越靠近单位圆，衰减越慢；极点在负实轴上会产生每拍反号的振荡。')}`,
  talk: `<p>数字控制器每个周期执行一次差分方程：用本次和过去几次的误差 e[n]、e[n−1]…以及过去的输出 u[n−1]…算出新的输出。z 变换对差分方程的作用，就像拉氏变换对微分方程：把“延迟一拍”写成乘以 z<sup>−1</sup>，差分方程就变成了代数式 H(z)。</p>
  <p>s 平面与 z 平面通过 z = e<sup>sT</sup> 对应：s 平面的一个极点 −a 变成 z 平面的 e<sup>−aT</sup>（0～1 之间的实数）；s 平面虚轴上的频率 jω 变成单位圆上角度 ωT 的点。所以 z 平面里，<b>沿单位圆从 z = 1 逆时针转到 z = −1，就是频率从 0 扫到 fs/2</b>。数字系统的频率响应就是把 z = e<sup>jωT</sup> 代入 H(z)，它在 fs 上周期重复，这正是混叠在频域的样子。</p>
  <p>下方是一个一阶数字系统 y[n] = b·x[n] + p·y[n−1]（极点 z = p）。拖动极点位置：p 接近 1 时它是一个低通/积分器，衰减很慢；p = 1 时就是纯积分器（累加器）；p 在 0～−1 之间时冲激响应每拍反号；|p| > 1 时发散。</p>`,
  sl: [{ k: 'p', l: '极点 p（实数）', a: -1.1, b: 1.1, v: 0.8, fmt: x => x.toFixed(3) }, { k: 'zr', l: '零点', opts: [['none', '无'], ['m1', 'z = −1（Tustin 常见）'], ['0.5', 'z = 0.5']], v: 'none' }, { k: 'fs', l: '采样频率 fs', a: 1e4, b: 1e6, v: 1e5, log: true, u: 'Hz' }],
  calc(v) {
    const T = 1 / v.fs, p = v.p, zq = v.zr === 'none' ? null : v.zr === 'm1' ? -1 : 0.5;
    const b = zq === null ? [1] : [1, -zq], a = [1, -p];
    // 直流增益归一（仅稳定且不是积分器时）
    const g0 = p < 1 - 1e-6 && p > -1 ? (1 - p) / b.reduce((x, y) => x + y, 0) : 1;
    const bb = b.map(x => x * g0), dc = { b: bb, a }, H = s => PS.dEval(dc, s, T);
    const n = 30, h = [], tt = []; let y1 = 0, x1 = 0;
    for (let k = 0; k < n; k++) { const x = k === 0 ? 1 : 0, y = bb[0] * x + (bb[1] || 0) * x1 + p * y1; h.push(y); tt.push(k); y1 = y; x1 = x; }
    const stairs = { x: [], y: [] }; tt.forEach((k, i) => { stairs.x.push(k, k + 1); stairs.y.push(h[i], h[i]); });
    const sEq = p > 0 ? Math.log(p) / T : NaN;
    return { f0: v.fs / 1e4, f1: v.fs / 2 * 0.999, vlines: [{ x: v.fs / 2 * 0.999, label: 'fs/2' }], ph0: 0, series: [{ name: 'H(e^{jωT})', fn: H, color: c(1) }],
      sch: Ls.pzSvg(zq === null ? [] : [C.of(zq)], [C.of(p)], { z: true }),
      extra: [{ title: '冲激响应 h[n]（横轴：采样序号 n）', note: Math.abs(p) > 1 ? '<b>|p| > 1：极点在单位圆外，发散。</b>' : Math.abs(p) === 1 || Math.abs(Math.abs(p) - 1) < 1e-3 ? '极点在单位圆上：不衰减（p = 1 为累加器/积分器）。' : p < 0 ? '负实轴极点：每拍反号的衰减振荡（频率 fs/2）。' : '单调衰减，时间常数 ≈ ' + (-1 / Math.log(p)).toFixed(2) + ' 拍。',
        cfg: { xLog: false, xUnit: '', height: 260, panels: [{ label: 'h[n]', series: [{ name: 'h[n]', color: c(1), width: 2, x: stairs.x, y: stairs.y.map(y => Math.max(-50, Math.min(50, y))) }], hlines: [{ y: 0, dash: true }], fmtTip: x => (+x.toPrecision(4)).toString() }] } }],
      info: `差分方程：y[n] = ${bb.map((x, i) => fx(x, 4) + '·x[n' + (i ? '−' + i : '') + ']').join(' + ')} + ${fx(p, 4)}·y[n−1]。` + (isFinite(sEq) ? `对应 s 域极点 s = ln(p)/T = ${num(sEq)} rad/s` + (sEq < 0 ? `（${hz(-sEq / TAU)}）。` : sEq > 0 ? '（右半平面，不稳定）。' : '（原点：积分器）。') : ''), p, sEq };
  },
  steps(v, r) {
    const T = 1 / v.fs;
    return [{ t: 'z 域极点 → s 域极点', f: 's = ln(z)/T', r: isFinite(r.sEq) ? num(r.sEq) + ' rad/s' : 'p ≤ 0：没有对应的实数 s 极点（负实轴极点对应 fs/2 处的振荡）' },
      { t: '稳定性', f: '|p| < 1', r: Math.abs(v.p) < 1 ? '稳定' : Math.abs(v.p) === 1 ? '临界' : '<b>不稳定</b>' },
      { t: '频率轴映射', f: 'f → z = e<sup>j2πf/fs</sup>', r: 'f = 0 → z = 1；f = fs/4 → z = j；f = fs/2 → z = −1' },
      { t: '直流增益', f: 'H(1) = Σb / Σa', r: Math.abs(1 - v.p) < 1e-6 ? '∞（积分器）' : '1（已归一化）' }];
  },
  roles: { head: ['z 平面位置', 's 平面对应', '时域', '数字补偿器中的例子'], rows: [
    ['z = 1 极点', 's = 0', '累加（积分）', '2P2Z/3P3Z 的积分器'],
    ['0 < z < 1 实极点', '负实轴极点', '指数衰减', '补偿器高频极点（低通）'],
    ['z = −1 零点', 'fs/2', 'Nyquist 处增益为 0', 'Tustin 变换自动产生'],
    ['−1 < z < 0 极点', '无直接对应（fs/2 振荡）', '每拍反号衰减', '离散化后高于 fs/2 的极点被压缩到这里'],
    ['单位圆外', '右半平面', '发散', '不稳定']] },
  quiz: [['累加器 y[n] = y[n−1] + x[n] 的极点在哪里？对应模拟的什么？', 'z = 1，对应 s = 0 的积分器（乘以 T 的比例）。'],
    ['为什么 fs/2 以上的模拟极点在数字实现中会“变形”？', '数字频率响应在 fs 上周期重复，只有 0～fs/2 是独立的；s 域高于 fs/2 的特性无法在 z 域准确表示，Tustin 会把它压缩到 fs/2 以内，MPZ 会映射到负实轴附近。']] });
/* ---------- 离散化方法对比：前向/后向欧拉、Tustin、预畸变、MPZ ---------- */
// 一阶低通 1/(1+s/ωp) 的离散化，返回 {b,a}
function disc1(method, wp, T, wc) {
  if (method === 'fe') { const k = wp * T; return { b: [0, k], a: [1, k - 1] }; }             // s = (z−1)/T
  if (method === 'be') { const k = wp * T; return { b: [k / (1 + k)], a: [1, -1 / (1 + k)] }; }  // s = (z−1)/(zT)
  if (method === 'mpz') { const p = Math.exp(-wp * T); return { b: [(1 - p) / 2, (1 - p) / 2], a: [1, -p] }; }
  const kap = method === 'tp' ? wc / Math.tan(wc * T / 2) : 2 / T, g = wp / (kap + wp);
  return { b: [g, g], a: [1, (wp - kap) / (kap + wp)] };
}
Lr.add({ id: 'disc', group: G5, title: '离散化方法对比：欧拉、Tustin、预畸变、零极点匹配', pre: ['ztr'], kw: '离散化 Tustin 双线性 预畸变 欧拉 MPZ 频率翘曲 warping',
  html: `${F('前向欧拉 s ≈ (z−1)/T　后向欧拉 s ≈ (z−1)/(zT)　Tustin s ≈ (2/T)(z−1)/(z+1)　预畸变 s ≈ [ω<sub>c</sub>/tan(ω<sub>c</sub>T/2)]·(z−1)/(z+1)　MPZ z<sub>i</sub> = e<sup>s<sub>i</sub>T</sup>')}
  ${F('Tustin 频率翘曲：ω<sub>数字</sub> 与 ω<sub>模拟</sub> 满足 ω<sub>模拟</sub> = (2/T)·tan(ω<sub>数字</sub>T/2)')}
  ${K('Tustin 保证稳定（左半平面 → 单位圆内）、整个 0～fs/2 映射到 0～∞，代价是频率被压缩（翘曲）：越接近 fs/2 偏差越大。预畸变让某一个频率（通常取 fc）完全准确。前向欧拉可能把稳定极点映射到单位圆外，电源补偿器不要用。')}`,
  talk: `<p>把 s 域设计好的补偿器搬到 MCU 里，需要一种把 s 换成 z 的规则。不同规则的本质是对积分 ∫x dt 的不同近似：前向欧拉用矩形左端点，后向欧拉用右端点，Tustin（双线性）用梯形。梯形近似最准，而且它把 s 平面的整个左半平面精确映射到单位圆内，稳定的模拟补偿器离散后一定稳定。</p>
  <p>Tustin 唯一的“毛病”是<b>频率翘曲</b>：模拟频率 0～∞ 被压缩进数字频率 0～fs/2，二者关系是 tan 函数。低频时几乎一一对应，接近 fs/2 时模拟的很大一段被挤到一点。所以离散化后，零极点的实际频率都比原设计略低，越靠近 fs/2 偏得越多。解决办法是<b>预畸变</b>：把 2/T 换成 ω<sub>c</sub>/tan(ω<sub>c</sub>T/2)，使选定频率 ω<sub>c</sub> 处数字与模拟完全一致。电源里通常选 fc，保证穿越频率处的增益和相位不变，也就保住了 PM。</p>
  <p><b>零极点匹配（MPZ）</b>直接把每个零极点按 z = e<sup>sT</sup> 映射，零极点位置最准确，但增益需要另外在某个频率匹配，而且分子阶数不够时要在 z = −1 补零点。本工具的数字补偿器提供 Tustin（预畸变）与 MPZ 两种。</p>
  <p>下面以一阶低通 1/(1 + s/ω<sub>p</sub>) 为例比较各方法的频率响应。把 ω<sub>p</sub> 拖到接近 fs/2，差异就很明显；把 fs 降低，前向欧拉在 ω<sub>p</sub>T > 2 时极点跑到单位圆外。</p>`,
  sl: [{ k: 'fp', l: '模拟极点 fp', a: 100, b: 2e5, v: 2e4, log: true, u: 'Hz' }, { k: 'fs', l: '采样频率 fs', a: 2e4, b: 1e6, v: 1e5, log: true, u: 'Hz' }, { k: 'fw', l: '预畸变频率', a: 100, b: 4.9e5, v: 2e4, log: true, u: 'Hz' }],
  calc(v) {
    const T = 1 / v.fs, wp = TAU * v.fp, wc = TAU * Math.min(v.fw, 0.49 * v.fs), M = [['fe', '前向欧拉', 5], ['be', '后向欧拉', 4], ['tu', 'Tustin', 1], ['tp', 'Tustin 预畸变', 3], ['mpz', '零极点匹配 MPZ', 6]];
    const A = s => C.inv(C.lin(s, wp)), ser = [{ name: '模拟原型', fn: A, color: c(2), dash: true, width: 2.6 }], poles = [];
    M.forEach(([k, n, ci]) => { const d = disc1(k, wp, T, wc); poles.push([n, -d.a[1]]); ser.push({ name: n, fn: s => PS.dEval(d, s, T), color: c(ci), width: 1.8 }); });
    const fd = 2 * Math.atan(wp * T / 2) / (TAU * T);   // Tustin 后极点的实际（数字）频率
    return { f0: v.fs / 2e3, f1: v.fs / 2 * 0.999, series: ser, vlines: [{ x: v.fp, label: 'fp' }, { x: Math.min(v.fw, 0.49 * v.fs), label: '预畸变' }, { x: v.fs / 2 * 0.999, label: 'fs/2' }], ph0: -45,
      sch: Ls.pzSvg([], poles.map(p => C.of(p[1])), { z: true }),
      info: `各方法的 z 域极点：${poles.map(p => p[0] + ' ' + fx(p[1], 4)).join('；')}。${poles[0][1] < -1 ? '<b>前向欧拉极点已在单位圆外（不稳定）。</b>' : ''}Tustin（无预畸变）把模拟极点 ${hz(v.fp)} 映射为数字频率 ${hz(fd)}。`, poles, fd, wc };
  },
  steps(v, r) {
    const T = 1 / v.fs, wp = TAU * v.fp;
    return [{ t: 'ωp·T', r: num(wp * T) + (wp * T > 2 ? '（> 2：前向欧拉不稳定）' : '') },
      { t: '前向欧拉', f: 'z<sub>p</sub> = 1 − ω<sub>p</sub>T', r: fx(1 - wp * T, 5) },
      { t: '后向欧拉', f: 'z<sub>p</sub> = 1/(1 + ω<sub>p</sub>T)', r: fx(1 / (1 + wp * T), 5) },
      { t: 'Tustin', f: 'z<sub>p</sub> = (1 − ω<sub>p</sub>T/2)/(1 + ω<sub>p</sub>T/2)', r: fx((1 - wp * T / 2) / (1 + wp * T / 2), 5) },
      { t: 'MPZ（精确）', f: 'z<sub>p</sub> = e<sup>−ω<sub>p</sub>T</sup>', r: fx(Math.exp(-wp * T), 5) },
      { t: 'Tustin 频率翘曲', f: 'f<sub>数字</sub> = (fs/π)·arctan(π·f/fs)', r: hz(v.fp) + ' → ' + hz(r.fd) + '（偏低 ' + ((1 - r.fd / v.fp) * 100).toFixed(1) + '%）', n: '预畸变把 κ 换成 ωc/tan(ωcT/2)，使预畸变频率处的响应与模拟完全一致；其他频率仍有翘曲，但关键的 fc 处准确。' }];
  },
  roles: { head: ['方法', '稳定性保持', '频率准确性', '直流增益', '适用'], rows: [
    ['前向欧拉', '否（ωT > 2 不稳定）', '差', '准确', '不推荐用于补偿器'],
    ['后向欧拉', '是', '差（极点向 z=0 偏）', '准确', '简单积分器（PI 的 I 项常用）'],
    ['Tustin', '是', '低频好，接近 fs/2 翘曲', '准确', '通用'],
    ['Tustin 预畸变', '是', '预畸变频率处精确', '准确', '电源补偿器（预畸变到 fc）'],
    ['MPZ', '是', '零极点位置精确', '需在某频率匹配', '高频极点较多时']] },
  quiz: [['为什么电源补偿器常把预畸变频率选在 fc？', 'PM 由 fc 处的相位决定，fc 处准确就保住了设计的 PM 和穿越频率；远离 fc 的小误差对稳定性影响不大。'],
    ['Tustin 离散化后补偿器在 fs/2 处的增益为什么是 0？', '(z+1) 因子在 z = −1 处为零，所有 s 域的“无穷远零点”都被映射到 z = −1。']] });

/* ---------- 量化：系数、ADC、DPWM 与极限环 ---------- */
Lr.add({ id: 'quant', group: G5, title: '量化效应：系数精度、ADC/DPWM 分辨率与极限环', pre: ['ztr', 'disc'], kw: '量化 定点 Q 格式 极限环 limit cycle ADC DPWM 分辨率 系数灵敏度',
  html: `${F('系数量化：b<sub>i</sub> → round(b<sub>i</sub>·2<sup>Q</sup>)/2<sup>Q</sup>　ADC：1 LSB 对应输出 ΔVo = V<sub>FS</sub>/(2<sup>N</sup>·H)　DPWM：ΔD = 1/N<sub>pwm</sub> → ΔVo = Vin/N<sub>pwm</sub>')}
  ${K('无极限环条件：DPWM 分辨率必须比 ADC 分辨率更细（ΔVo,DPWM < ΔVo,ADC），且补偿器要有积分器。否则输出在两个 ADC 码之间来回跳，形成低频的“极限环”振荡。系数量化则会让零极点（尤其是靠近 z = 1 的）移位，所以本工具强制量化后 Σa = 0，保证积分极点仍精确在 z = 1。')}`,
  talk: `<p>数字控制器里有三处量化：</p>
  <ul><li><b>ADC</b>：输出电压只能分辨到 1 LSB 对应的电压。数字环路“看”不到比它更小的误差。</li>
  <li><b>DPWM</b>：占空比只能取 1/N<sub>pwm</sub> 的整数倍（N<sub>pwm</sub> = 时钟频率/开关频率，高分辨率 PWM 用延迟线细分）。</li>
  <li><b>系数与运算</b>：定点系数只有有限位数，乘加结果还要截断。</li></ul>
  <p><b>极限环</b>是最典型的量化问题：如果 DPWM 的最小步进对应的输出电压变化大于 ADC 的 1 LSB，那么没有任何一个占空比能让 ADC 读数正好等于参考值，积分器就会在相邻两个占空比之间来回切换，输出出现幅度约 1 个 DPWM 步进、频率很低的振荡。解决方法：提高 DPWM 分辨率（高分辨率 PWM、抖动/dither）、或降低 ADC 分辨率要求（但精度会下降）。经验条件：ΔVo,DPWM ≤ ΔVo,ADC/2。</p>
  <p><b>系数灵敏度</b>：fs 很高而零极点频率很低时，z 域零极点非常接近 1（e<sup>−ωT</sup> ≈ 1 − ωT），系数里的有效信息全在小数点后很多位。Q 格式位数不够，零点就会明显移位，甚至积分器变成一个慢极点（静差）。下方实验对一个 2P2Z 补偿器按选定的 Q 位数量化，显示零极点移动和频率响应偏差，并用简单的定点模型演示极限环。</p>`,
  sl: [{ k: 'Q', l: '系数小数位 Q', a: 6, b: 28, v: 14, fmt: x => 'Q' + Math.round(x) }, { k: 'fs', l: '采样频率 fs', a: 5e4, b: 2e6, v: 5e5, log: true, u: 'Hz' }, { k: 'adc', l: 'ADC 位数', a: 8, b: 14, v: 12, fmt: x => Math.round(x) + ' bit' }, { k: 'npwm', l: 'DPWM 计数 N', a: 50, b: 20000, v: 400, log: true, fmt: x => Math.round(x).toString() }],
  calc(v) {
    const Q = Math.round(v.Q), T = 1 / v.fs, cp = { type: 2, wi: TAU * 2e3, z: [TAU * 1e3], p: [TAU * 4e4] }, fc = 1e4;
    const dc = PS.discretize(cp, T, 'tustin', fc), S = Math.pow(2, Q);
    const bq = dc.b.map(x => Math.round(x * S) / S), aq = dc.a.map(x => Math.round(x * S) / S);
    const qd = { b: bq, a: aq }, rf = s => PS.dEval(dc, s, T), rq = s => PS.dEval(qd, s, T);
    // z 域零极点（升幂多项式需要 z 的降幂：b0 + b1 z^-1 + b2 z^-2 → b0 z² + b1 z + b2）
    const zr = c0 => Ls.roots(c0.slice().reverse()), z0 = zr(dc.b), zq = zr(bq), p0 = zr(dc.a), pq = zr(aq);
    const sumA = aq.reduce((x, y) => x + y, 0);
    // 极限环：Buck 12→3.3 V，ADC 满量程 3.3 V，H = 0.6/3.3
    const Vin = 12, H = 0.6 / 3.3, lsbA = 3.3 / Math.pow(2, Math.round(v.adc)) / H, lsbP = Vin / Math.round(v.npwm);
    // 简化离散模型：vo[n] = Vin·d[n−1]（功率级远快于积分时假设准静态），积分控制 d += ki·e
    // 参考码取 ADC 码中心（目标 3.3 V 附近），输出取每拍的稳态值（功率级按一阶滞后 0.5 处理），积分器累加分数计数、取整后送 DPWM
    const N = Math.round(v.npwm), Na = Math.pow(2, Math.round(v.adc)), refc = Math.round(3.3 * H / 3.3 * Na), n = 600, t = [], vo = [];
    let acc = 3.29 / Vin * N, cnt = Math.round(acc), vout = Vin * cnt / N;
    for (let k = 0; k < n; k++) {
      vout += 0.5 * (Vin * cnt / N - vout);
      const code = Math.floor(vout * H / 3.3 * Na + 0.5), e = refc - code;
      acc += 0.25 * e * (lsbA / lsbP); cnt = Math.round(acc); t.push(k); vo.push(vout);
    }
    const tail = vo.slice(-100), amp = Math.max(...tail) - Math.min(...tail);
    const binLo = (refc - 0.5) * 3.3 / Na / H, binHi = (refc + 0.5) * 3.3 / Na / H, kk = Math.ceil(binLo / Vin * N), hit = kk * Vin / N < binHi ? kk * Vin / N : 0;
    return { f0: 10, f1: v.fs / 2 * 0.999, series: [{ name: '浮点系数', fn: rf, color: c(2), dash: true }, { name: 'Q' + Q + ' 量化系数', fn: rq, color: c(1) }], vlines: [{ x: 1e3, label: 'fz' }, { x: 4e4, label: 'fp' }],
      sch: Ls.pzSvg(zq.filter(z => C.abs(z) < 3), pq.filter(z => C.abs(z) < 3), { z: true }),
      extra: [{ title: '极限环演示：输出电压（每拍）', note: `ADC 1 LSB → ΔVo = ${V(lsbA, 'V')}；DPWM 1 步 → ΔVo = ${V(lsbP, 'V')}。零误差 ADC 码对应输出 ${V(binLo, 'V')}～${V(binHi, 'V')}，` + (hit ? `有 DPWM 档位落在其中（${V(hit, 'V')}）` : '<b>没有任何 DPWM 档位落在其中</b>') + `，稳态峰峰值 ${V(amp, 'V')}。` + (lsbP > lsbA ? (hit ? '这次是“碰巧”没有极限环，Vin 或参考稍有变化就会出现。' : '') : '步进小于 ADC 分辨率时总有档位落入零误差区，保证无极限环。'),
        cfg: { xLog: false, xUnit: '', height: 240, panels: [{ label: 'vo (V)', unit: 'V', series: [{ name: 'vo[n]', color: c(1), width: 1.6, x: t, y: vo }], minSpan: lsbA * 4, fmtTip: x => x.toFixed(5) }] } }],
      info: `Q${Q}：Σa = ${sumA.toExponential(2)}${Math.abs(sumA) > 0 ? '（积分极点已偏离 z = 1，变成慢极点 z = ' + fx(Math.max(...pq.map(p => p.re)), 8) + '）' : '（积分极点仍在 z = 1）'}。零点 ${fx(z0.find(z => z.re > 0) ? z0.find(z => z.re > 0).re : z0[0].re, 7)} → ${fx(zq.find(z => z.re > 0) ? zq.find(z => z.re > 0).re : zq[0].re, 7)}。`, dc, bq, aq, z0, zq, p0, pq, lsbA, lsbP, Q, sumA };
  },
  steps(v, r) {
    const T = 1 / v.fs, zz = Math.exp(-TAU * 1e3 * T);
    return [{ t: '零点在 z 平面的位置', f: 'z<sub>z</sub> ≈ e<sup>−ω<sub>z</sub>T</sup> = 1 − ω<sub>z</sub>T + …', r: 'fz = 1 kHz，fs = ' + hz(v.fs) + ' → z<sub>z</sub> ≈ ' + fx(zz, 8) + '（距 1 只有 ' + (1 - zz).toExponential(2) + '）' },
      { t: '需要的系数精度', f: '2<sup>−Q</sup> ≪ 1 − z<sub>z</sub>', r: '2<sup>−' + r.Q + '</sup> = ' + Math.pow(2, -r.Q).toExponential(2) + (Math.pow(2, -r.Q) > (1 - zz) / 10 ? ' → <b>精度不够，零点明显移位</b>' : ' → 足够') },
      { t: '量化后的系数', r: 'b = [' + r.bq.map(x => fx(x, 7)).join(', ') + ']<br>a = [' + r.aq.map(x => fx(x, 7)).join(', ') + ']' },
      { t: '积分极点', f: 'Σa = 0 ⇔ z = 1 为极点', r: 'Σa = ' + r.sumA.toExponential(2), n: '2P2Z 的 a = [1, c−1, −c] 逐项四舍五入后之和恰好仍为 0（只要 c·2<sup>Q</sup> 不是 .5），所以积分极点天然保住；3P3Z 的 a 有三个非平凡系数，逐项舍入后 Σa 一般不为 0，积分器会变成一个慢极点，留下静差或缓慢漂移。本工具生成的定点代码会修正 a 的末项使 Σa 精确为 0。' },
      { t: 'ADC 与 DPWM 分辨率', f: 'ΔVo,ADC = V<sub>FS</sub>/(2<sup>N</sup>·H)，ΔVo,DPWM = Vin/N<sub>pwm</sub>', r: V(r.lsbA, 'V') + ' vs ' + V(r.lsbP, 'V') + ' → ' + (r.lsbP < r.lsbA ? '满足无极限环条件' : '<b>会出现极限环</b>，需 N<sub>pwm</sub> > ' + Math.ceil(12 / r.lsbA)) }];
  },
  roles: { head: ['量化来源', '影响', '设计准则'], rows: [
    ['ADC 分辨率', '输出精度上限、量化噪声', 'ΔVo,ADC 小于允许误差的 1/5'],
    ['DPWM 分辨率', '极限环', 'ΔVo,DPWM ≤ ΔVo,ADC/2；高分辨率 PWM 或 dither'],
    ['系数位数', '零极点移位，靠近 z=1 时最敏感', 'fs/fz 越大需要的位数越多；强制 Σa = 0'],
    ['运算截断', '输出噪声、小幅极限环', 'int64 累加、输出保留额外小数位（本工具 Qy = 12）'],
    ['输出限幅', '积分饱和（windup）', '限幅后停止积分（抗饱和）']] },
  quiz: [['ADC 12 位、满量程 3.3 V、分压到 0.6 V 的 3.3 V 输出，1 LSB 对应输出多少？', '3.3/4096/(0.6/3.3) ≈ 4.4 mV。'],
    ['为什么高开关频率的数字电源更需要长的系数字长？', 'fs 越高，同样频率的零极点在 z 平面越靠近 1，系数间差别越小，需要更多小数位才能表示。']] });

})(typeof window !== 'undefined' ? window : globalThis);
