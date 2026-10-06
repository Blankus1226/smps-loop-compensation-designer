/* 学习：入门 + 信号与系统基础（拉氏变换与传递函数、s 平面与时域、Bode 渐近线、平均与小信号线性化） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const G1 = '信号与系统基础';
const deg = x => x.toFixed(1) + '°';

// 电源反馈环路框图
function loopSvg() {
  const bx = (x, y, w, h, t, t2) => `<rect class="sb" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text x="${x + w / 2}" y="${y + h / 2 + (t2 ? -3 : 4)}" class="sk" text-anchor="middle">${t}</text>` + (t2 ? `<text x="${x + w / 2}" y="${y + h / 2 + 13}" class="sv" text-anchor="middle">${t2}</text>` : '');
  const ar = (pts) => `<polyline class="sw" fill="none" marker-end="url(#ahL)" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
  const tx = (x, y, s, a) => `<text x="${x}" y="${y}" class="sv" text-anchor="${a || 'middle'}">${s}</text>`;
  return `<svg class="schem" viewBox="0 0 660 230" role="img" aria-label="电源反馈环路框图"><defs><marker id="ahL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="sd"/></marker></defs>
    ${tx(22, 66, 'Vref', 'start')}${ar([[30, 74], [62, 74]])}<circle class="sa" cx="74" cy="74" r="12"/><text x="74" y="79" class="sk" text-anchor="middle">Σ</text>${tx(60, 98, '−', 'middle')}${tx(56, 66, '+', 'middle')}
    ${ar([[86, 74], [112, 74]])}${bx(112, 50, 120, 48, '补偿器 Gc(s)', '误差放大器 + RC')}${ar([[232, 74], [262, 74]])}${tx(247, 66, 'vc')}
    ${bx(262, 50, 100, 48, '调制器 Fm', '1/Vm 或电流环')}${ar([[362, 74], [392, 74]])}${tx(377, 66, 'd')}
    ${bx(392, 50, 130, 48, '功率级 Gvd(s)', 'L、C、负载、Vin')}${ar([[522, 74], [600, 74]])}${tx(630, 78, 'vo')}
    ${ar([[440, 14], [440, 50]])}${tx(440, 10, 'Vin 扰动')}${ar([[490, 14], [490, 50]])}${tx(498, 10, '负载 io 扰动')}
    <polyline class="sw" fill="none" points="560,74 560,160 382,160"/>${bx(262, 136, 120, 48, '分压 H', 'Vref/Vo')}${ar([[262, 160], [74, 160], [74, 86]])}
    ${tx(330, 215, '环路增益 T(s) = Gc · Fm · Gvd · H ：从任意点断开、绕一圈回到断点的增益')}</svg>`;
}

Lr.add({ id: 'start', group: '入门', title: '从这里开始：环路补偿学什么', noPlot: true, noSteps: true, kw: '入门 路线 框图',
  html: `<p>开关电源靠<b>负反馈</b>稳住输出：输出电压经分压 H 与参考 Vref 比较，误差经补偿器 Gc 放大成控制电压 vc，调制器把 vc 变成占空比 d，功率级再把 d 变回输出电压。信号绕环路一圈的增益叫<b>环路增益 T(s)</b>（也常叫开环增益），这套课程全部围绕它展开。</p>${loopSvg()}`,
  talk: () => `<h4>为什么需要“补偿”</h4>
  <p>功率级本身是一个含储能元件的动态系统：电感和电容会让信号产生相位滞后（LC 双极点最多滞后 180°），Boost 还有右半平面零点，数字控制还有计算与调制延时。负反馈在低频把误差压得很小，可一旦信号绕环路一圈<b>恰好滞后 180°、而增益仍不小于 1</b>，负反馈就变成了正反馈，电源开始振荡。</p>
  <p>补偿器的任务是<b>塑造 T(s) 的形状</b>：低频增益尽量大（输出准、抗扰强）；在穿越频率 fc 附近留足相位裕度（稳定、阻尼好、不振铃）；高频迅速衰减（不让开关纹波进入调制器）。“补偿”指的就是用补偿器的零点、极点去弥补功率级带来的相位滞后和增益变化。</p>
  <h4>建议的学习顺序</h4>
  <ol><li><b>信号与系统</b>：${Lr.link('lap')} → ${Lr.link('spz')} → ${Lr.link('bodeasy')} → ${Lr.link('avg')}。学会把电路写成传递函数、读懂 Bode 图。</li>
  <li><b>自动控制原理</b>：${Lr.link('fb')} → ${Lr.link('pmtime')} → ${Lr.link('typeN')} → ${Lr.link('nyq')}，再看 ${Lr.link('pmgm')}、${Lr.link('kfac')}。</li>
  <li><b>开环增益分析方法</b>：${Lr.link('olread')} → ${Lr.link('pzwhy')} → ${Lr.link('olmeas')}。这是把理论用到电源上的关键一步。</li>
  <li><b>功率级特性</b>：${Lr.link('buck')}、${Lr.link('rhpz')}、${Lr.link('pcmc')}、${Lr.link('cot')}，弄清被控对象长什么样。</li>
  <li><b>补偿器</b>：模拟 Type I/II/III、OTA、PI/PID；<b>电流模式补偿</b>：${Lr.link('cmidea')} → ${Lr.link('cmt2')} → ${Lr.link('acmin')}。</li>
  <li><b>数字控制</b>：先学 ${Lr.link('samp')}、${Lr.link('ztr')}、${Lr.link('disc')}、${Lr.link('quant')}，再看 2P2Z/3P3Z 与延时。</li>
  <li>最后用<b>完整设计实例</b>把全流程走一遍，并对照<b>典型控制器芯片</b>的数据手册。</li></ol>
  <h4>每一页怎么用</h4>
  <p>页首是核心公式与要点，接着是原理讲解；中间的滑杆可以实时改变参数，Bode 图、时域图、原理图同步刷新；“实际计算过程”把当前数值逐步代入；“作用表”说明每个极零点或元件为什么存在、放错了会怎样；最后的思考题建议先自己想再展开答案。</p>
  <h4>符号约定</h4>
  <p>s = σ + jω 为复频率，f = ω/2π；dB 指 20·log<sub>10</sub>|·|；相位单位为度，并做了连续展开（不在 ±180° 处折返）；“dec”指十倍频程。英文缩写带虚线下划线，鼠标悬停可看注释。</p>`,
  rolesTitle: '环路中每个环节的作用',
  roles: { head: ['环节', '传递函数', '由谁决定', '在环路中的作用', '设计时关注什么'], rows: [
    ['分压网络 H', 'Vref / Vo', 'Rt、Rb', '把输出缩到参考电压的量级再比较', '运放型补偿中 H 不出现在交流增益里（虚地）；OTA 型中 H 直接乘进增益'],
    ['补偿器 Gc(s)', '积分 × 零点 / 极点', 'RC 网络或数字系数', '塑造环路形状：低频高增益、fc 处补相位、高频衰减', '本课程的主角'],
    ['调制器 Fm', '1/Vm（电压模式）；1/[(Sn+Se)Ts]（峰值电流）', '锯齿波幅度、斜坡补偿', '把控制电压变成占空比', 'Vm 越小增益越大；输入电压前馈让 Vm ∝ Vin，抵消 Gvd ∝ Vin'],
    ['功率级 Gvd(s)', 'LC 双极点、ESR 零点、RHPZ', 'L、C、负载、Vin、寄生电阻', '被控对象', '随工况变化，要在最差工况检查'],
    ['环路增益 T', '以上各项的乘积', '—', '决定稳定性与动态性能', 'fc、PM、GM，以及低频增益与高频衰减']] },
  quiz: [['为什么不能把补偿器增益做得无穷大，让误差为零？', '增益越大 fc 越高，而 fc 越高时功率级、ESR、延时、RHPZ 带来的相位滞后越多，相位裕度不够就会振荡；开关纹波也会被放大送进调制器。实际做法是用<b>积分器</b>只在低频提供“无穷大”增益，到 fc 附近再用零点把相位补回来。'],
    ['环路增益 T 和闭环传递函数是一回事吗？', '不是。T 是把环路断开后绕一圈的增益；闭环 Vo/Vref = (1/H)·T/(1+T)。|T| ≫ 1 时闭环 ≈ 1/H，几乎与功率级参数无关，这正是负反馈的价值。详见 ' + '“负反馈的作用”一课。']] });

/* ---------- 拉普拉斯变换与传递函数：RC 低通的正弦响应 ---------- */
Lr.add({ id: 'lap', group: G1, title: '拉普拉斯变换与传递函数', kw: 'laplace 传递函数 正弦稳态 频率响应',
  html: `${F('电感 v = L·di/dt → V(s) = sL·I(s)；电容 i = C·dv/dt → I(s) = sC·V(s)')}${F('H(s) = Y(s)/X(s)（零初始条件），正弦稳态：x = sin ωt ⇒ y = |H(jω)|·sin(ωt + ∠H(jω))')}
  ${K('把 s 换成 jω，传递函数就变成频率响应：|H| 是幅值放大倍数，∠H 是相位移动。Bode 图就是把它们画成 dB 与度、横轴取对数频率。')}`,
  talk: `<p>拉普拉斯变换把微分方程变成代数方程：电感、电容在 s 域里就是阻抗 sL 和 1/(sC)，于是电路可以像电阻网络一样用分压、并联去列方程，输出与输入之比就是<b>传递函数 H(s)</b>。开关电源的功率级、补偿器、调制器都可以这样写成传递函数，再相乘得到环路增益。</p>
  <p>对线性时不变（LTI）系统，输入一个正弦波，等暂态过去之后输出仍是<b>同频率</b>的正弦波，只是幅值乘了 |H(jω)|、相位移动了 ∠H(jω)。下面用最简单的 RC 低通 H = 1/(1 + sRC) 演示：拖动“输入频率”，时域图里输出与输入的幅值比、相位差会和 Bode 图上该频率的读数完全一致。</p>
  <p>时域图还画出了<b>暂态</b>：刚加上正弦时输出里有一项按 e<sup>−t/τ</sup> 衰减的分量，它由极点 s = −1/(RC) 决定，衰减完才是 Bode 图描述的稳态。Bode 图只描述稳态正弦响应，可极点位置同时决定了暂态快慢，频域和时域就是这样连在一起的。</p>
  <p>换到电源里理解：|T(j2πf)| 表示“频率为 f 的扰动被环路压低了多少倍”，∠T 决定扰动绕一圈回来以后是削弱自己还是加强自己。</p>`,
  sl: [{ k: 'R', l: '电阻 R', a: 100, b: 1e5, v: 1e3, log: true, u: 'Ω' }, { k: 'Cc', l: '电容 C', a: 1e-9, b: 1e-5, v: 1e-7, log: true, u: 'F' }, { k: 'f', l: '输入频率 f', a: 10, b: 1e5, v: 3e3, log: true, u: 'Hz' }],
  calc(v) {
    const tau = v.R * v.Cc, fcn = 1 / (TAU * tau), H = s => C.inv(C.addr(C.sc(s, tau), 1)), w = TAU * v.f;
    const A = 1 / Math.sqrt(1 + w * w * tau * tau), th = Math.atan(w * tau), tEnd = 4 / v.f, n = 700, t = [], x = [], y = [], ys = [];
    for (let i = 0; i <= n; i++) { const tt = tEnd * i / n; t.push(tt); x.push(Math.sin(w * tt)); ys.push(A * Math.sin(w * tt - th)); y.push(A * Math.sin(w * tt - th) + A * Math.sin(th) * Math.exp(-tt / tau)); }
    return { f0: 1, f1: 1e6, series: [{ name: 'H = 1/(1+sRC)', fn: H, color: c(1) }], vlines: [{ x: v.f, label: '输入 f' }, { x: fcn, label: '转折 fc' }],
      extra: [{ title: '时域：输入 sin(2πft) 与输出', note: '实线为实际输出（含暂态），虚线为稳态正弦。读两条正弦的峰值比与时间差，对照上方 Bode 图。',
        cfg: Ls.tcfg([{ name: '输入 x', color: c(2), width: 1.6, x: t, y: x }, { name: '输出 y（含暂态）', color: c(1), width: 2.4, x: t, y }, { name: '稳态 y', color: c(3), dash: true, width: 1.6, x: t, y: ys }], { label: '电压 (V)', hlines: [0] }) }],
      info: `f = ${hz(v.f)} 处 |H| = ${A.toFixed(3)}（${Lr.db(A)}），∠H = ${deg(-PS.deg(th))}，输出滞后 ${V(th / w, 's')}。转折频率 ${hz(fcn)}。`, A, th, tau, fcn };
  },
  steps(v, r) {
    return [{ t: '时间常数与极点', f: 'τ = R·C，极点 s<sub>p</sub> = −1/τ', r: 'τ = ' + V(v.R, 'Ω') + ' × ' + V(v.Cc, 'F') + ' = ' + V(r.tau, 's') + '，s<sub>p</sub> = ' + num(-1 / r.tau) + ' rad/s' },
      { t: '转折频率', f: 'f<sub>c</sub> = 1/(2πτ)', r: hz(r.fcn) },
      { t: '幅值', f: '|H(j2πf)| = 1/√(1 + (f/f<sub>c</sub>)²)', r: '1/√(1 + ' + num(Math.pow(v.f / r.fcn, 2)) + ') = <b>' + r.A.toFixed(4) + '</b>（' + Lr.db(r.A) + '）' },
      { t: '相位', f: '∠H = −arctan(f/f<sub>c</sub>)', r: '<b>' + deg(-PS.deg(r.th)) + '</b>' },
      { t: '相位换算成时间', f: 'Δt = |∠H| / (360°·f)', r: V(r.th / (TAU * v.f), 's'), n: '同样的时间延迟，频率越高对应的相位越大——这就是数字控制延时在高频“吃相位”的原因。' },
      { t: '暂态', f: 'y(t) = A·sin(ωt − θ) + A·sinθ·e<sup>−t/τ</sup>', r: '暂态初值 ' + (r.A * Math.sin(r.th)).toFixed(3) + '，衰减到 1% 约需 4.6τ = ' + V(4.6 * r.tau, 's') }];
  },
  roles: v => { const fcn = 1 / (TAU * v.R * v.Cc); return { head: ['频率区间', '幅值', '相位', '含义'], rows: [
    ['f ≪ fc（< ' + hz(fcn / 10) + '）', '≈ 1（0 dB）', '≈ 0°', '电容来得及充放电，输出跟随输入'],
    ['f = fc（' + hz(fcn) + '）', '0.707（−3 dB）', '−45°', '转折点：真实曲线比渐近线低 3 dB'],
    ['f ≫ fc（> ' + hz(fcn * 10) + '）', '≈ fc/f（−20 dB/dec）', '→ −90°', '电容来不及充电，相当于积分器']] }; },
  quiz: [['f 等于转折频率时，幅值和相位各是多少？', '幅值 1/√2 ≈ 0.707（−3 dB），相位 −45°。'],
    ['为什么转折频率以上斜率是 −20 dB/dec？', '|H| ≈ 1/(ωτ)，频率每升高 10 倍幅值变为 1/10，即 −20 dB。'],
    ['传递函数能描述电源的大信号启动过程吗？', '不能。传递函数只对线性系统成立，电源要先做开关周期平均和小信号线性化（见“平均与小信号线性化”），启动、限流、饱和属于大信号行为。']] });
/* ---------- s 平面：极点位置与时域响应 ---------- */
Lr.add({ id: 'spz', group: G1, title: '零极点与 s 平面：极点位置决定时域响应', pre: ['lap'], kw: '二阶 阻尼 ζ Q 极点 零点 RHP 阶跃',
  html: `${F('H(s) = (1 + s/ω<sub>z</sub>) / (1 + s/(Qω<sub>n</sub>) + s²/ω<sub>n</sub>²)，ζ = 1/(2Q)')}${F('极点 s = −ζω<sub>n</sub> ± jω<sub>n</sub>√(1−ζ²)：实部决定衰减快慢，虚部决定振荡频率')}
  ${K('极点在左半平面才稳定；越靠近虚轴（ζ 越小、Q 越大）振荡越久、Bode 图上的谐振峰越高。右半平面零点让阶跃响应“先反向”，这就是 Boost 的 RHPZ。')}`,
  talk: `<p>传递函数的分母多项式的根叫<b>极点</b>，分子的根叫<b>零点</b>。系统的自由响应（暂态）由极点决定：每个实极点 −a 贡献一项 e<sup>−at</sup>，每对共轭复极点 −σ ± jω<sub>d</sub> 贡献一项 e<sup>−σt</sup>·sin(ω<sub>d</sub>t)。所以只要看极点在 s 平面上的位置，就能大致判断阶跃响应的样子：</p>
  <ul><li><b>离虚轴的距离 σ = ζω<sub>n</sub></b>：越远衰减越快，调节时间约 4/σ；</li>
  <li><b>离实轴的距离 ω<sub>d</sub></b>：振荡角频率；</li>
  <li><b>极点与原点连线和负实轴的夹角</b>：cos 值就是阻尼比 ζ，夹角越大越接近虚轴，超调越大。</li></ul>
  <p>零点不改变暂态的“模式”，但改变各模式的权重：<b>左半平面零点</b>相当于叠加了一份输出的导数，响应更快、超调更大；<b>右半平面零点</b>叠加的是“负的导数”，阶跃一开始输出会先往反方向走，之后才回头。Boost 加大占空比时输出先跌后升，就是这个原因。</p>
  <p>频域里也能看到同样的信息：Q = 1/(2ζ) 是谐振峰高度（|H(jω<sub>n</sub>)| = Q）；ζ 小时相位在 ω<sub>n</sub> 附近急剧跌落 180°。电源中的 LC 双极点、峰值电流模式 fs/2 双极点、COT 双极点都是这种二阶环节，判断它们“危险不危险”看的就是 Q。</p>`,
  sl: [{ k: 'fn', l: '自然频率 fn', a: 100, b: 1e5, v: 5e3, log: true, u: 'Hz' }, { k: 'z', l: '阻尼比 ζ', a: -0.15, b: 2, v: 0.3, fmt: x => x.toFixed(3) },
    { k: 'zm', l: '零点', opts: [['none', '无零点'], ['lhp', '左半平面零点 fz = fn'], ['rhp', '右半平面零点 fz = fn']], v: 'none' }],
  calc(v) {
    const wn = TAU * v.fn, zeta = v.z, d = Ls.f2(wn, 1 / (2 * (Math.abs(zeta) < 1e-6 ? 1e-6 : zeta))), nn = v.zm === 'lhp' ? Ls.f1(wn) : v.zm === 'rhp' ? [1, -1 / wn] : [1];
    const H = Ls.rat(nn, d), poles = Ls.roots(d), zs = nn.length > 1 ? Ls.roots(nn) : [];
    const slow = zeta > 1 ? wn * (zeta - Math.sqrt(zeta * zeta - 1)) : Math.max(zeta, 0.05) * wn;   // 主导（最慢）衰减率
    const st = Ls.step(nn, d, { W: wn, tEnd: Math.min(zeta > 1 ? 7 / slow : 14 / slow, 60 / wn) }), info = Ls.stepInfo(st, 1);
    const unstable = zeta <= 0;
    return { f0: v.fn / 100, f1: v.fn * 100, series: [{ name: 'H(s)', fn: H, color: c(1) }], vlines: [{ x: v.fn, label: 'fn' }], ph0: -90,
      sch: Ls.pzSvg(zs, poles, { unit: 'Hz', R: v.fn * 1.6 }),
      extra: [{ title: '单位阶跃响应', note: unstable ? '<b>ζ ≤ 0：极点在右半平面（或虚轴上），响应发散或等幅振荡。</b>' : '超调 ' + info.os.toFixed(1) + '%' + (info.os > 0.05 ? '，峰值时间 ' + V(info.tp, 's') : '（单调上升）') + '，2% 调节时间 ' + V(info.ts, 's') + (v.zm === 'rhp' ? '。注意起始段先向下：右半平面零点。' : ''),
        cfg: Ls.tcfg([{ name: 'y(t)', color: c(1), width: 2.4, x: st.t, y: st.y.map(y => Math.max(-5, Math.min(5, y))) }], { label: 'y', hlines: [1, 0] }) }],
      info: `极点：${poles.map(p => PS.fmt(p.re / TAU, 'Hz', 3) + (Math.abs(p.im) > 0 ? ' ± j' + PS.fmt(Math.abs(p.im) / TAU, 'Hz', 3) : '')).filter((x, i, a) => a.indexOf(x) === i).join('；')}（已换算为 Hz）。Q = ${(1 / (2 * zeta)).toFixed(2)}。` + (unstable ? '<b>不稳定</b>。' : ''), poles, st, sinfo: info, wn };
  },
  steps(v, r) {
    const z = v.z, wn = r.wn, Q = 1 / (2 * z);
    const st = [{ t: '品质因数', f: 'Q = 1/(2ζ)', r: 'Q = ' + (isFinite(Q) ? Q.toFixed(3) : '∞') + '，谐振峰 |H(jωn)| = Q → ' + (Q > 0 ? Lr.db(Q) : '—') }];
    if (z > 0 && z < 1) {
      st.push({ t: '复极点', f: 's = −ζω<sub>n</sub> ± jω<sub>n</sub>√(1−ζ²)', r: 'σ = ' + num(z * wn) + ' rad/s，ω<sub>d</sub> = ' + num(wn * Math.sqrt(1 - z * z)) + ' rad/s（' + hz(wn * Math.sqrt(1 - z * z) / TAU) + '）' });
      const os = 100 * Math.exp(-Math.PI * z / Math.sqrt(1 - z * z));
      st.push({ t: '理论超调（无零点）', f: 'M<sub>p</sub> = e<sup>−πζ/√(1−ζ²)</sup>', r: os.toFixed(2) + '%' + (v.zm === 'none' ? '（仿真 ' + r.sinfo.os.toFixed(2) + '%）' : '；有零点时仿真得 ' + r.sinfo.os.toFixed(2) + '%') });
      st.push({ t: '峰值时间、调节时间', f: 't<sub>p</sub> = π/ω<sub>d</sub>，t<sub>s</sub>(2%) ≈ 4/(ζω<sub>n</sub>)', r: 't<sub>p</sub> = ' + V(Math.PI / (wn * Math.sqrt(1 - z * z)), 's') + '，t<sub>s</sub> ≈ ' + V(4 / (z * wn), 's') });
    } else if (z >= 1) st.push({ t: '两个实极点（过阻尼）', f: 's = −ω<sub>n</sub>(ζ ± √(ζ²−1))', r: r.poles.map(p => num(p.re) + ' rad/s').join('，'), n: '无超调；慢极点主导响应速度。' });
    else st.push({ t: '不稳定', r: 'ζ ≤ 0 时极点实部 ≥ 0，e<sup>σt</sup> 随时间增长。' });
    st.push({ t: '相位', f: '二阶极点：f ≪ fn 时 0°，f = fn 时 −90°，f ≫ fn 时 −180°', r: 'ζ 越小，−90° 附近的过渡越陡（过渡宽度约 ±ζ·fn）' });
    return st;
  },
  roles: { head: ['s 平面位置', '时域表现', 'Bode 表现', '电源中的例子'], rows: [
    ['负实轴上的极点 −a', 'e<sup>−at</sup> 单调衰减', '−20 dB/dec，相位 −90°', '电流模式的负载极点 1/(2πRC)'],
    ['左半平面共轭复极点', '衰减振荡', '谐振峰 Q，相位急降 180°', 'LC 双极点、PCMC fs/2 双极点'],
    ['原点极点 s = 0', '积分：阶跃输入 → 斜坡输出', '−20 dB/dec 贯穿全频，相位恒 −90°', '补偿器积分器（无静差）'],
    ['右半平面极点', '指数发散', '幅值像普通极点，相位方向相反', '不稳定的系统（次谐波 Qp < 0）'],
    ['左半平面零点', '响应加快、超调变大', '+20 dB/dec，相位 +90°', '补偿器零点、ESR 零点'],
    ['右半平面零点', '先反向再正向', '+20 dB/dec，相位 −90°', 'Boost / Buck-Boost RHPZ']] },
  quiz: [['ζ = 0.5（Q = 1）时阶跃超调大约多少？', '约 16%。电源里常说“Q ≈ 1 比较合适”，就是指这种程度的阻尼。'],
    ['为什么说 RHPZ“补偿不了”？', '要抵消它，补偿器必须放一个右半平面极点，那就成了不稳定系统。幅值上它和普通零点一样升高，相位却滞后，补偿器无法在不付出代价的前提下抵消。'],
    ['极点离虚轴越远越好吗？', '响应越快，但需要的带宽越高。环路里闭环极点的位置由 fc 和 PM 决定，fc 受开关频率、RHPZ、延时限制，不能无限提高。']] });
/* ---------- Bode 渐近线作图 ---------- */
// 因子：{ k:'z'|'p'|'p2'|'i', f, Q }，渐近幅值（dB）与渐近相位（度）
function asym(fa, K0, facs) {
  const mag = [], ph = [];
  fa.forEach(f => {
    let m = 20 * Math.log10(K0), p = 0;
    facs.forEach(x => {
      const r = f / x.f, lg = Math.log10(r), lin = Math.max(0, Math.min(1, (lg + 1) / 2));   // f/10 ~ 10f 线性过渡
      if (x.k === 'i') { m -= 20 * Math.log10(f / x.f); p -= 90; }
      else if (x.k === 'z') { m += r > 1 ? 20 * lg : 0; p += 90 * lin; }
      else if (x.k === 'p') { m -= r > 1 ? 20 * lg : 0; p -= 90 * lin; }
      else if (x.k === 'p2') { m -= r > 1 ? 40 * lg : 0; p -= 180 * lin; }
      else if (x.k === 'rz') { m += r > 1 ? 20 * lg : 0; p -= 90 * lin; }
    });
    mag.push(m); ph.push(p);
  });
  return { mag, ph };
}
const facFn = facs => s => facs.reduce((a, x) => {
  const w = TAU * x.f;
  if (x.k === 'i') return C.mul(a, C.div(C.of(w), s));
  if (x.k === 'z') return C.mul(a, C.lin(s, w));
  if (x.k === 'rz') return C.mul(a, C.addr(C.sc(s, -1 / w), 1));
  if (x.k === 'p') return C.div(a, C.lin(s, w));
  return C.div(a, C.quad(s, w, x.Q));
}, C.ONE);
const FAC_OPTS = [['none', '（不用）'], ['z', '零点 (1+s/ωz)'], ['p', '极点 1/(1+s/ωp)'], ['p2', '二阶极点（Q 见下）'], ['rz', '右半平面零点 (1−s/ω)']];
Lr.add({ id: 'bodeasy', group: G1, title: 'Bode 图与渐近线作图', pre: ['lap', 'spz'], kw: 'bode 渐近线 斜率 dB/dec 手绘',
  html: `${F('20·log|H<sub>1</sub>·H<sub>2</sub>| = 20·log|H<sub>1</sub>| + 20·log|H<sub>2</sub>|，　∠(H<sub>1</sub>·H<sub>2</sub>) = ∠H<sub>1</sub> + ∠H<sub>2</sub>')}
  ${K('取对数后乘法变加法：每个零点让斜率 +20 dB/dec、相位最多 +90°；每个极点 −20 dB/dec、−90°；二阶极点 −40 dB/dec、−180°。相位在转折频率前后各一个十倍频程内完成过渡，转折点处恰好是一半。')}`,
  talk: `<p>Bode 图之所以是电源工程师最常用的工具，是因为它可以<b>手画</b>。一个传递函数总能分解成增益、积分器、一阶零极点、二阶极点等因子的乘积，取对数后每个因子的幅值曲线都可以用两段直线近似（转折频率以下水平，以上斜率 ±20 dB/dec），相位用三段直线近似（f/10 以下 0°，10f 以上 ±90°，中间按 45°/dec 过渡）。把各因子的直线逐段相加，就得到整个系统的渐近 Bode 图。</p>
  <p>渐近线与真实曲线的最大误差：一阶零/极点在转折频率处差 3 dB、相位误差在 f/10 和 10f 处约 5.7°；二阶极点在 f<sub>n</sub> 处差 20·log Q（Q 大时谐振峰远高于渐近线），所以二阶环节一定要额外看 Q。</p>
  <p>设计补偿器时，常用的思路就是在渐近 Bode 图上“搭积木”：先画出功率级，再决定在哪里放零点把斜率拉平、在哪里放极点让它重新下降，使 |T| 以 −20 dB/dec 穿过 0 dB（这样 fc 附近的相位约 −90°，裕度自然充足）。下面可以自由组合最多 4 个因子，蓝色实线是精确值，虚线是渐近线。</p>`,
  sl: [{ k: 'K', l: '直流增益 K', a: 0.01, b: 1000, v: 10, log: true, fmt: x => (20 * Math.log10(x)).toFixed(1) + ' dB' }, { k: 'it', l: '积分器 fi/s', opts: [['0', '无'], ['1', '有（fi = 下方 f1）']], v: '0' },
    { k: 't1', l: '因子 1', opts: FAC_OPTS, v: 'p2' }, { k: 'f1', l: '因子 1 频率', a: 10, b: 1e6, v: 1e3, log: true, u: 'Hz' },
    { k: 't2', l: '因子 2', opts: FAC_OPTS, v: 'z' }, { k: 'f2', l: '因子 2 频率', a: 10, b: 1e6, v: 2e4, log: true, u: 'Hz' },
    { k: 't3', l: '因子 3', opts: FAC_OPTS, v: 'p' }, { k: 'f3', l: '因子 3 频率', a: 10, b: 1e6, v: 2e5, log: true, u: 'Hz' },
    { k: 'Q', l: '二阶极点 Q', a: 0.1, b: 20, v: 3, log: true, fmt: x => x.toFixed(2) }],
  calc(v) {
    const facs = [];
    if (v.it === '1') facs.push({ k: 'i', f: v.f1 });
    [1, 2, 3].forEach(i => { if (v['t' + i] !== 'none') facs.push({ k: v['t' + i], f: v['f' + i], Q: v.Q }); });
    const f = PS.logspace(1, 1e7, 600), H = s => C.sc(facFn(facs)(s), v.K), b = PS.bode(H, f), a = asym(f, v.K, facs);
    // 精确相位与渐近相位对齐到同一 360° 分支
    const off = 360 * Math.round((a.ph[0] - b.ph[0]) / 360), ph = b.ph.map(x => x + off);
    const col1 = c(1), col2 = c(2);
    const cfg = { xLog: true, xUnit: 'Hz', height: 430, vlines: facs.filter(x => x.k !== 'i').map(x => ({ x: x.f, label: { z: 'fz', p: 'fp', p2: 'f0', rz: 'RHPZ' }[x.k] })), panels: [
      { label: '幅值 (dB)', unit: 'dB', series: [{ name: '精确', color: col1, width: 2.5, x: f, y: b.mag }, { name: '渐近线', color: col2, dash: true, width: 2, x: f, y: a.mag }], hlines: [{ y: 0, strong: true }], clamp: [-120, 120, 180], step: 20, fmtTip: x => x.toFixed(1) },
      { label: '相位 (°)', unit: '°', series: [{ name: '精确', color: col1, width: 2.5, x: f, y: ph }, { name: '渐近线', color: col2, dash: true, width: 2, x: f, y: a.ph }], hlines: [{ y: -180, dash: true }], clamp: [-450, 200, 400], step: 45, fmtTip: x => x.toFixed(1) }] };
    let maxE = 0; b.mag.forEach((m, i) => { maxE = Math.max(maxE, Math.abs(m - a.mag[i])); });
    return { cfg, facs, info: '精确曲线与渐近线最大偏差 ' + maxE.toFixed(1) + ' dB' + (facs.some(x => x.k === 'p2') ? '（二阶极点处理论偏差 20·log Q = ' + (20 * Math.log10(v.Q)).toFixed(1) + ' dB）' : '') + '。' };
  },
  steps(v, r) {
    const st = ['从低频往高频逐段累加斜率'];
    let slope = r.facs.some(x => x.k === 'i') ? -20 : 0;
    st.push({ t: '起点', r: '低频斜率 ' + slope + ' dB/dec，' + (slope ? '积分器在 fi 处穿过 K 对应的 dB 值' : '水平线 ' + (20 * Math.log10(v.K)).toFixed(1) + ' dB') });
    r.facs.filter(x => x.k !== 'i').sort((a, b) => a.f - b.f).forEach(x => {
      const ds = { z: 20, p: -20, p2: -40, rz: 20 }[x.k], dp = { z: '+90°', p: '−90°', p2: '−180°', rz: '−90°（注意：幅值上升但相位滞后）' }[x.k];
      slope += ds;
      st.push({ t: { z: '零点', p: '极点', p2: '二阶极点', rz: '右半平面零点' }[x.k] + ' @ ' + hz(x.f), r: '斜率 ' + (ds > 0 ? '+' : '') + ds + ' → 累计 <b>' + slope + ' dB/dec</b>；相位在 ' + hz(x.f / 10) + ' ～ ' + hz(x.f * 10) + ' 内变化 ' + dp });
    });
    st.push({ t: '高频', r: '最终斜率 ' + slope + ' dB/dec', n: '每 −20 dB/dec 的斜率大致对应 −90° 相位（最小相位系统的 Bode 增益-相位关系）。环路 |T| 若以 −20 dB/dec 穿越 0 dB，fc 附近相位约 −90°，PM 约 90°；以 −40 dB/dec 穿越，相位接近 −180°，几乎没有裕度。' });
    return st;
  },
  roles: { head: ['因子', '幅值渐近线', '相位渐近线', '转折点误差', '电源中的例子'], rows: [
    ['常数 K', '水平线 20·logK', '0°（K<0 为 180°）', '—', '直流增益 Vin/Vm'],
    ['积分器 ωi/s', '−20 dB/dec，过 (fi, 0 dB)', '恒 −90°', '无', '补偿器 Type I'],
    ['零点 1+s/ωz', 'fz 以上 +20 dB/dec', '0 → +90°，fz 处 +45°', '+3 dB', 'ESR 零点、补偿器零点'],
    ['极点 1/(1+s/ωp)', 'fp 以上 −20 dB/dec', '0 → −90°，fp 处 −45°', '−3 dB', '电流模式负载极点、补偿器高频极点'],
    ['二阶极点', 'f0 以上 −40 dB/dec', '0 → −180°，f0 处 −90°', '20·logQ', 'LC 双极点、fs/2 双极点'],
    ['右半平面零点', 'f 以上 +20 dB/dec', '0 → −90°', '+3 dB', 'Boost RHPZ']] },
  quiz: [['一个系统低频 40 dB，在 1 kHz 有一个极点、10 kHz 有一个零点、100 kHz 有一个双极点。100 kHz 以上斜率是多少？', '0 → −20（1 kHz）→ 0（10 kHz）→ −40 dB/dec（100 kHz）。'],
    ['为什么相位渐近线在 f/10～10f 之间过渡？', 'arctan(f/fz) 在 f = fz/10 时约 5.7°、f = 10fz 时约 84.3°，用 45°/dec 的直线连接，最大误差约 5.7°，足够手算估计。']] });
/* ---------- 开关周期平均与小信号线性化：开关仿真 vs 平均模型 ---------- */
// 理想同步 Buck（含 DCR、ESR），占空比 d(t) = D + dm·sin(2πft)；返回逐点 vo，以及平均模型的 vo
function buckSim(o) {
  const Ts = 1 / o.fs, n = 80, h = Ts / n, w = TAU * o.f, Rs = o.Rs, Rc = o.Rc, R = o.R, L = o.L, Cc = o.C;
  const tEnd = o.tEnd, N = Math.ceil(tEnd / h), every = Math.max(1, Math.floor(N / 2400));
  // 初值取直流工作点
  const vss = o.Vin * o.D * R / (R + Rs), iss = vss / R;
  let iL = iss, vc = vss, ia = iss, va = vss;
  const T = [], Y = [], Ya = [];
  const vout = (i, v) => (R * (Rc * i + v)) / (R + Rc);
  const der = (i, v, u) => { const vo = vout(i, v); return [(u * o.Vin - Rs * i - vo) / L, (i - vo / R) / Cc]; };
  for (let k = 0; k <= N; k++) {
    const t = k * h, dd = o.D + o.dm * Math.sin(w * t), ph = (t / Ts) % 1, u = ph < dd ? 1 : 0;
    // 开关模型：前向欧拉足够（步长 Ts/80）；平均模型：u 用 d(t)
    let a = der(iL, vc, u); iL += h * a[0]; vc += h * a[1];
    a = der(ia, va, dd); ia += h * a[0]; va += h * a[1];
    if (k % every === 0) { T.push(t); Y.push(vout(iL, vc)); Ya.push(vout(ia, va)); }
  }
  return { T, Y, Ya, vss };
}
// 在最后 m 个整周期上提取 f 分量（复数幅值）
function fourier(T, Y, f, m) {
  const t1 = T[T.length - 1], t0 = t1 - m / f; let re = 0, im = 0, n = 0, mean = 0;
  for (let i = 0; i < T.length; i++) if (T[i] >= t0) { mean += Y[i]; n++; }
  mean /= n;
  for (let i = 0; i < T.length; i++) if (T[i] >= t0) { re += (Y[i] - mean) * Math.sin(TAU * f * T[i]); im += (Y[i] - mean) * Math.cos(TAU * f * T[i]); }
  return { amp: 2 * Math.hypot(re, im) / n, ph: PS.deg(Math.atan2(im, re)) };
}
Lr.add({ id: 'avg', group: G1, title: '开关周期平均与小信号线性化', pre: ['lap'], kw: '平均模型 小信号 线性化 Gvd 开关仿真',
  html: `${F('⟨v<sub>L</sub>⟩<sub>Ts</sub> = d·Vin − vo（Buck）：用一个开关周期内的平均值代替开关波形')}${F('d = D + d̂，vo = Vo + v̂o，忽略 d̂·v̂ 等二阶小量 ⇒ G<sub>vd</sub>(s) = v̂o/d̂')}
  ${K('开关电源本身是时变、非线性的，传递函数是“平均 + 小信号线性化”后的近似。它在远低于 fs/2 的频率内很准确，越接近 fs/2 越不可靠，这也是 fc 一般不超过 fs/10～fs/5 的原因之一。')}`,
  talk: `<p>开关管每个周期开、关一次，电路结构在两种状态之间切换，严格来说不能直接写传递函数。工程上的做法分两步：</p>
  <p><b>① 开关周期平均。</b>只关心比开关频率慢得多的变化，就把每个量在一个开关周期内取平均。对 Buck，电感左端电压在导通时为 Vin、关断时为 0，平均为 d·Vin；于是开关电路被一个“受控电压源 d·Vin”代替，变成连续时间电路，即平均模型。</p>
  <p><b>② 小信号线性化。</b>平均模型对 Buck 是线性的，对 Boost 则含有 d·vo、d·iL 这类乘积，是非线性的。在稳态工作点附近加小扰动 d = D + d̂、vo = Vo + v̂o，展开后丢掉两个小量相乘的项，就得到线性小信号模型和传递函数 G<sub>vd</sub>(s)。Boost 的 RHPZ 正是从 iD = (1−d)·iL 这一项线性化得到的：−d̂·IL 让输出电流先减小。</p>
  <p>下面的实验把这两步“验证”给你看：给占空比加一个频率为 f 的小正弦扰动，同时运行<b>逐周期开关仿真</b>和<b>平均模型</b>，再用傅里叶分析提取输出中 f 分量的幅值和相位，与 G<sub>vd</sub>(j2πf) 的理论值比较。f 较低时三者几乎完全一致；f 接近 fs/2 时开关仿真开始偏离（采样效应、边带混叠），平均模型不再可信。扰动幅度太大时非线性也会显现。</p>`,
  sl: [{ k: 'f', l: '扰动频率 f', a: 300, b: 2.4e5, v: 5e3, log: true, u: 'Hz' }, { k: 'dm', l: '扰动幅度 d̂', a: 0.002, b: 0.2, v: 0.02, log: true, fmt: x => x.toFixed(3) }, { k: 'fs', l: '开关频率 fs', a: 1e5, b: 1e6, v: 5e5, log: true, u: 'Hz' }],
  calc(v) {
    const P = Object.assign(PS.clone(PS.DEFAULTS), { fs: v.fs }), op = PS.opPoint(P, 12, 3);
    const settle = Math.min(2.5e-3, 12 * 3 / (TAU * op.f0)), m = Math.max(2, Math.min(8, Math.round(v.f * 4e-4)));
    const sim = buckSim({ fs: v.fs, f: v.f, dm: v.dm, D: op.D, Vin: 12, L: P.L, C: P.C, Rc: P.Rc, Rs: op.Rs, R: op.R, tEnd: settle + m / v.f });
    const g = PS.Gvd(op, P, C.jw(v.f)).Gvd, gm = C.abs(g), gp = PS.deg(C.arg(g));
    const a = fourier(sim.T, sim.Y, v.f, m), b = fourier(sim.T, sim.Ya, v.f, m);
    const t0 = sim.T[sim.T.length - 1] - Math.min(3, m) / v.f, idx = sim.T.map((t, i) => t >= t0 ? i : -1).filter(i => i >= 0);
    const tt = idx.map(i => sim.T[i] - t0);
    return { f0: 100, f1: v.fs, series: [{ name: 'Gvd 理论（平均小信号）', fn: s => PS.Gvd(op, P, s).Gvd, color: c(2) }], vlines: [{ x: v.f, label: '扰动 f' }, { x: v.fs / 2, label: 'fs/2' }, { x: op.f0, label: 'f0' }],
      extra: [{ title: '时域：开关仿真 vs 平均模型（最后几个扰动周期）', note: '灰线为开关仿真（含开关纹波），蓝线为平均模型。',
        cfg: Ls.tcfg([{ name: '开关仿真 vo', color: PS.css('--axis'), width: 1.1, x: tt, y: idx.map(i => sim.Y[i]) }, { name: '平均模型 vo', color: c(1), width: 2.4, x: tt, y: idx.map(i => sim.Ya[i]) }], { label: 'vo (V)', height: 280 }) }],
      info: `f = ${hz(v.f)}：理论 |Gvd|·d̂ = ${V(gm * v.dm, 'V')}；平均模型 ${V(b.amp, 'V')}；开关仿真 ${V(a.amp, 'V')}（偏差 ${((a.amp / (gm * v.dm) - 1) * 100).toFixed(1)}%）。`, a, b, gm, gp, op, P };
  },
  steps(v, r) {
    const op = r.op;
    return ['已知：Buck 12 V → 5 V/3 A，L = ' + V(r.P.L, 'H') + '，C = ' + V(r.P.C, 'F') + '，fs = ' + hz(v.fs),
      { t: '平均：电感两端电压', f: '⟨v<sub>L</sub>⟩ = d·Vin − Rs·iL − vo', r: '稳态 ⟨v<sub>L</sub>⟩ = 0 ⇒ D = ' + op.D.toFixed(4) },
      { t: '线性化', f: 'd = D + d̂ ⇒ sL·îL = Vin·d̂ − Rs·îL − v̂o', n: 'Buck 的平均模型本来就是线性的；Boost 的 (1−d)·vo 项展开为 D′·v̂o − Vo·d̂，(1−d)·iL 展开为 D′·îL − IL·d̂，后者产生 RHPZ。' },
      { t: '理论小信号响应', f: 'v̂o = G<sub>vd</sub>(j2πf)·d̂', r: '|Gvd| = ' + num(r.gm) + '（' + Lr.db(r.gm) + '），∠Gvd = ' + r.gp.toFixed(1) + '° → 幅值 ' + V(r.gm * v.dm, 'V') },
      { t: '傅里叶提取：平均模型', r: '幅值 ' + V(r.b.amp, 'V') + '（与理论差 ' + ((r.b.amp / (r.gm * v.dm) - 1) * 100).toFixed(2) + '%）' },
      { t: '傅里叶提取：开关仿真', r: '幅值 ' + V(r.a.amp, 'V') + '（与理论差 ' + ((r.a.amp / (r.gm * v.dm) - 1) * 100).toFixed(2) + '%）', n: v.f > v.fs / 6 ? '扰动频率已超过 fs/6，开关仿真与平均模型的差别开始变得明显。' : v.dm > 0.08 ? '扰动幅度较大，可能出现非线性偏差（占空比接近饱和时尤甚）。' : '小信号、低频条件下三者一致，说明平均小信号模型可信。' }];
  },
  roles: { head: ['近似', '前提', '何时失效', '工程对策'], rows: [
    ['开关周期平均', '关心的频率 ≪ fs', '接近 fs/2：采样效应、边带', 'fc ≤ fs/10～fs/5；峰值电流模式用 Ridley 采样模型补上 fs/2 双极点'],
    ['小信号线性化', '扰动 ≪ 工作点', '大阶跃、启动、限流、占空比饱和', '用开关级时域仿真（本工具“负载阶跃”页）验证大信号'],
    ['CCM 模型', '电感电流不过零', '轻载 DCM', '同步整流强制 CCM，或另用 DCM 模型'],
    ['时不变', '工作点不随时间变', 'PFC 等工作点随市电变化', '在每个工作点分别分析（准静态）']] },
  quiz: [['为什么 Buck 的平均模型是线性的，而 Boost 的不是？', 'Buck 中只有 d·Vin，Vin 视为常数；Boost 中出现 (1−d)·vo、(1−d)·iL，是两个变量相乘。'],
    ['把扰动频率拉到 fs/2 附近，开关仿真的结果为什么不再等于 Gvd？', '开关过程相当于以 fs 采样，扰动频率 f 与 fs 会产生 fs − f 等边带分量；接近 fs/2 时边带与原信号重叠，平均模型无法描述。']] });

})(typeof window !== 'undefined' ? window : globalThis);
