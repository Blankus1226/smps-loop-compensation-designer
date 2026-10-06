/* 学习：自动控制原理基础（负反馈、PM 与时域、系统型别与静差、Nyquist 判据） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const G2 = '自动控制原理基础';
const dB = x => (20 * Math.log10(Math.abs(x))).toFixed(1) + ' dB';
// 闭环极点（缩放后求根，避免系数跨度过大）
Ls.clPoles = (n, d, W) => Ls.roots(Ls.scale(Ls.padd(d, n), W)).map(r => C.sc(r, W));
// 负载阶跃（小信号）：闭环输出阻抗反变换；返回 {t, v}（V，正为跌落），不稳定时返回 null
Lr.loadStep = function (R, gc, dI, tw) {
  const ctx = R.ctx, P = R.P, op = R.op, Zinf = P.Rc * op.R / (P.Rc + op.R), fhi = Math.max(2 * P.fs, 1 / (TAU * P.Rc * P.C));
  const st = PS.stepFromZ(s => PS.zcl(ctx, s, gc(s)), Zinf, tw, fhi), t = [], v = [], n = 500;
  for (let i = 0; i <= n; i++) { const tt = tw * i / n; t.push(tt); v.push(-dI * PS.stepAt(st, tt)); }
  return { t, v };
};

/* ---------- 负反馈的作用 ---------- */
Lr.add({ id: 'fb', group: G2, title: '负反馈的作用：环路增益 T 与 1/(1+T)', pre: ['start'], kw: '负反馈 灵敏度 输出阻抗 闭环 抑制',
  html: `${F('闭环：v̂o/v̂ref = (1/H)·T/(1+T)，　扰动：v̂o,闭环 = v̂o,开环 / (1+T)，　Z<sub>out,闭环</sub> = Z<sub>out,开环</sub> / (1+T)')}
  ${K('|T| ≫ 1 的频段，扰动被压低 |T| 倍、输出精确跟随参考；|T| ≪ 1 的频段，环路“不管事”，电源表现得和开环一样。fc 就是两者的分界线。fc 附近 |1+T| 可能小于 1，这时反馈反而放大扰动，PM 越小这个“放大峰”越高。')}`,
  talk: `<p>把一个扰动（输入电压跳变、负载电流跳变、元件参数漂移）放进环路，它在输出端的效果会被反馈修正：输出偏了 → 误差放大器察觉 → 调整占空比 → 把输出拉回来。环路增益越大，修正越彻底。数学上，所有从环路外部进入的扰动到输出的传递函数都被除以 (1+T)，所以 <b>1/(1+T) 叫灵敏度函数</b>，它告诉你环路在每个频率把扰动压低了多少倍。</p>
  <p>参考电压到输出的闭环增益是 T/(1+T) 乘以 1/H。低频 |T| 很大时它趋于 1/H，输出电压只由 Vref 和分压电阻决定，与 L、C、Vin、负载都无关，这是负反馈最重要的价值。高频 |T| 很小时它趋于 T/H，基本不跟随参考。</p>
  <p>负载阶跃响应最能体现这一点：闭环输出阻抗 Z<sub>out</sub>/(1+T) 在低频被压得很低，在 fc 附近回到开环水平，在更高频由输出电容（及 ESR）决定。所以<b>跌落大小主要由 fc 和输出电容决定：ΔV ≈ ΔI/(2π·fc·C)</b>，恢复时间约为几个 1/fc，振铃则取决于 PM。下面拖动“环路增益倍率”，同时观察开环/闭环输出阻抗和负载阶跃：增益太小跌落大、恢复慢；增益太大 PM 变小，阻抗出现尖峰、阶跃振铃，最后失稳。</p>`,
  sl: [{ k: 'g', l: '环路增益倍率', a: 0.1, b: 3, v: 1, log: true, fmt: x => dB(x) }],
  calc(v) {
    const R = PS.design(PS.preset(0)), gc = s => C.sc(R.gc(s), v.g), Tf = s => C.sc(R.T(s), v.g), mg = PS.margins(Tf, R.fmin, R.fmax);
    const S = s => C.inv(C.addr(Tf(s), 1)), Tc = s => C.div(Tf(s), C.addr(Tf(s), 1)), f = PS.logspace(R.fmin, R.fmax, 500);
    const dI = R.P.Io * 0.5, tw = Math.min(30 / (mg.fc || 1e4), 1.2e-3), stable = mg.pm > 0 && isFinite(mg.fc);
    const ext = [{ title: '输出阻抗：开环 vs 闭环', note: '闭环 = 开环 / (1+T)。fc 以下被环路压低，fc 附近出现的尖峰来自 |1+T| < 1。',
      cfg: (() => { const cf = Ls.bcfg([{ name: '开环 Zout（vc 固定）', fn: s => PS.zol(R.ctx, s), color: c(2) }, { name: '闭环 Zout', fn: s => PS.zcl(R.ctx, s, gc(s)), color: c(1) }], f, { height: 300 }); cf.panels = cf.panels.slice(0, 1); cf.panels[0].label = '|Z| (dBΩ)'; cf.panels[0].clamp = [-120, 40, 100]; return cf; })() }];
    if (stable) { const ld = Lr.loadStep(R, gc, dI, tw); ext.push({ title: '负载阶跃 ' + PS.fmt(dI, 'A') + '（小信号预测）', note: '最大跌落 ' + V(Math.max(...ld.v.map(x => -x)), 'V') + '；估算 ΔI/(2π·fc·C) = ' + V(dI / (TAU * mg.fc * R.P.C), 'V'), cfg: Ls.tcfg([{ name: 'Δvo', color: c(1), width: 2.4, x: ld.t, y: ld.v }], { label: 'Δvo (V)', hlines: [0] }) }); }
    else ext.push({ title: '负载阶跃', html: '<p class="note"><b>环路已不稳定（PM ≤ 0），线性模型下阶跃响应发散。</b></p>' });
    return { f0: R.fmin, f1: R.fmax, mg, series: [{ name: '开环 T', fn: Tf, color: c(1) }, { name: '闭环 T/(1+T)', fn: Tc, color: c(3) }, { name: '灵敏度 1/(1+T)', fn: S, color: c(2), dash: true }], extra: ext,
      info: `fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°。100 Hz 处 |T| = ${dB(C.abs(Tf(C.jw(100))))}：低频扰动被压低这么多。|1/(1+T)| 最大 ${dB(Math.max(...f.map(x => C.abs(S(C.jw(x))))))}${mg.pm < 30 ? '（尖峰明显，振铃）' : ''}。`, R, Tf, S };
  },
  steps(v, r) {
    const R = r.R, s1 = C.jw(100), s2 = C.jw(r.R.op.f0), t1 = C.abs(r.Tf(s1)), z0 = C.abs(PS.zol(R.ctx, s1)), z1 = C.abs(PS.zcl(R.ctx, s1, C.sc(R.gc(s1), v.g)));
    return ['示例：12 V → 5 V Buck，电压模式 Type III（与“设计”页示例 1 相同），增益乘以 ' + num(v.g),
      { t: '100 Hz 处的环路增益', r: '|T| = ' + num(t1) + '（' + dB(t1) + '）' },
      { t: '输出阻抗被压低的倍数', f: 'Z<sub>cl</sub> = Z<sub>ol</sub> / |1 + T|', r: 'Z<sub>ol</sub> = ' + V(z0, 'Ω') + ' → Z<sub>cl</sub> = ' + V(z1, 'Ω') + '（' + num(z0 / z1) + ' 倍 ≈ |1+T| = ' + num(C.abs(C.addr(r.Tf(s1), 1))) + '）' },
      { t: 'LC 谐振 f0 处', r: '|T(f0)| = ' + dB(C.abs(r.Tf(s2))) + '：谐振峰被环路完全压住' },
      { t: '跌落估算', f: 'ΔV ≈ ΔI / (2π·fc·C)', r: 'ΔI = ' + V(R.P.Io * 0.5, 'A') + '，fc = ' + hz(r.mg.fc) + '，C = ' + V(R.P.C, 'F') + ' → ' + (isFinite(r.mg.fc) ? V(R.P.Io * 0.5 / (TAU * r.mg.fc * R.P.C), 'V') : '—'), n: 'fc 越高、C 越大，跌落越小。要减小跌落，要么提高 fc（受 fs、RHPZ、延时限制），要么加大输出电容。' }];
  },
  roles: { head: ['传递函数', '表达式', '|T| ≫ 1 时', '|T| ≪ 1 时', '工程含义'], rows: [
    ['环路增益', 'T = Gc·Fm·Gvd·H', '—', '—', '判断稳定性（PM、GM）'],
    ['参考 → 输出', '(1/H)·T/(1+T)', '≈ 1/H（精确跟随）', '≈ T/H', '软启动、参考跳变的跟随'],
    ['灵敏度', '1/(1+T)', '≈ 1/T（扰动被压低）', '≈ 1（没有抑制）', '线性调整率、负载调整率、输入纹波抑制'],
    ['闭环输出阻抗', 'Z<sub>ol</sub>/(1+T)', '远小于开环', '等于开环', '负载阶跃跌落'],
    ['fc 附近', '|1+T| 可能 < 1', '—', '—', 'PM 小时扰动被“放大”，阻抗出现尖峰']] },
  quiz: [['电压模式 Buck 的开环输出阻抗在 LC 谐振处有一个尖峰，闭环后为什么尖峰消失了？', 'f0 远低于 fc，那里 |T| 很大（通常 > 30 dB），尖峰被除以 |1+T|。'],
    ['为什么跌落主要由 fc 和 C 决定，而与补偿器类型关系不大？', '在 fc 附近闭环输出阻抗约等于输出电容的阻抗 1/(2π·fc·C)，负载电流在环路来得及响应之前全部由电容提供。补偿器类型只影响 PM（振铃）和低频恢复的快慢。']] });
/* ---------- 相位裕度与闭环时域响应 ---------- */
// 典型开环：L(s) = ωc·(…)/s · 1/(1+s/ωp2)，选 ωp2 使 PM 等于目标；可加延时（Padé）
Lr.add({ id: 'pmtime', group: G2, title: '相位裕度与闭环阶跃响应：PM 为什么取 45°～60°', pre: ['fb', 'spz'], kw: 'PM 超调 阻尼 闭环极点 时域',
  html: `${F('L(s) = (ω<sub>c</sub>/s) · 1/(1 + s/ω<sub>2</sub>)，ω<sub>2</sub> = ω<sub>c</sub>·tan(PM)　⇒　闭环二阶：ζ ≈ ½·√(tan PM · sin PM)')}
  ${K('PM 直接决定闭环主导极点的阻尼：PM ≈ 65° 时 ζ ≈ 0.7（约 5% 超调），60° 约 9%，45° 约 23%，30° 约 41%。PM 越小，fc 附近 |1/(1+T)| 的尖峰越高、负载阶跃振铃越久。')}`,
  talk: `<p>开环看的是 Bode 图上的 PM，闭环看的是时域里的超调和振铃，两者通过<b>闭环极点</b>联系起来。最典型的电源环路在 fc 附近可以近似成“积分器 × 一个高频极点”：积分器贡献 −90°，高频极点再贡献一部分滞后，剩下的就是 PM。这种开环闭合后正好是标准二阶系统，于是可以把 PM 精确换算成 ζ 和超调。</p>
  <p>下面的实验固定 fc，用滑杆改变目标 PM（程序反算高频极点 ω<sub>2</sub>），还可以加入纯延时 Td 模拟数字控制。图中依次给出开环 Bode、闭环阶跃响应、闭环极点在 s 平面上的位置，以及 |1/(1+T)| 的峰值（又称灵敏度峰值 M<sub>s</sub>）。观察几个规律：</p>
  <ul><li>PM 从 90° 减小到 30°，闭环极点从负实轴上分开成共轭对并向虚轴靠拢，阶跃超调逐渐增大；</li>
  <li>加延时后同样的 fc 下 PM 减小，闭环出现额外的高频极点（Padé 近似引入），振铃加剧；</li>
  <li>PM 很大时（> 75°）响应几乎无超调，但上升变慢（同样 fc 下跌落恢复更“钝”），所以工程上取 45°～60° 作为折中。</li></ul>
  <p>经验公式 ζ ≈ PM/100 在 PM ≤ 60° 时误差不大，可以快速估算。实际电源环路不是严格二阶，但这个对应关系在 fc 附近仍然适用。</p>`,
  sl: [{ k: 'pm', l: '相位裕度 PM', a: 10, b: 89, v: 50, fmt: x => x.toFixed(0) + '°' }, { k: 'fc', l: '穿越频率 fc', a: 1e3, b: 1e5, v: 2e4, log: true, u: 'Hz' }, { k: 'td', l: '附加延时 Td', a: 0, b: 1e-5, v: 0, u: 's' }],
  calc(v) {
    const wc = TAU * v.fc, tdPh = PS.rad(360 * v.fc * v.td), w2 = wc * Math.tan(PS.rad(v.pm)), Ts = v.td;
    // ωc 需按 |L(jωc)| = 1 修正：|1/(1+jωc/ω2)| < 1
    const k = wc * Math.sqrt(1 + Math.pow(wc / w2, 2));
    let n = [k], d = Ls.pmul([0, 1], Ls.f1(w2));
    if (Ts > 0) { const pd = Ls.pade(Ts); n = Ls.pmul(n, pd.n); d = Ls.pmul(d, pd.d); }
    const Lf = s => C.mul(C.div(C.of(k), C.mul(s, C.lin(s, w2))), Ts > 0 ? C.exp(C.sc(s, -Ts)) : C.ONE);
    const mg = PS.margins(Lf, v.fc / 1000, v.fc * 1000), cl = Ls.closed(n, d), poles = Ls.clPoles(n, d, wc);
    const stable = poles.every(p => p.re < 0);
    const st = Ls.step(cl.n, cl.d, { W: wc, tEnd: 12 / v.fc }), inf = Ls.stepInfo(st, 1);
    const f = PS.logspace(v.fc / 100, v.fc * 100, 400), Ms = Math.max(...f.map(x => C.abs(C.inv(C.addr(Lf(C.jw(x)), 1)))));
    const zeta = 0.5 * Math.sqrt(Math.tan(PS.rad(v.pm)) * Math.sin(PS.rad(v.pm)));
    return { f0: v.fc / 100, f1: v.fc * 100, mg, series: [{ name: '开环 L', fn: Lf, color: c(1) }, { name: '闭环 L/(1+L)', fn: s => C.div(Lf(s), C.addr(Lf(s), 1)), color: c(3) }],
      sch: Ls.pzSvg([], poles.filter(p => Math.abs(p.re) < 60 * wc), { unit: 'Hz', R: v.fc * 2.2 }),
      extra: [{ title: '闭环单位阶跃响应', note: stable ? '超调 ' + inf.os.toFixed(1) + '%，2% 调节时间 ' + V(inf.ts, 's') + '（≈ ' + (inf.ts * v.fc).toFixed(1) + ' 个 1/fc）' : '<b>闭环不稳定</b>', cfg: Ls.tcfg([{ name: 'y(t)', color: c(1), width: 2.4, x: st.t, y: st.y.map(y => Math.max(-3, Math.min(3, y))) }], { label: 'y', hlines: [1] }) }],
      info: `实际 PM = ${PS.fmtNum(mg.pm, 1)}°${v.td > 0 ? '（延时吃掉 ' + PS.deg(tdPh).toFixed(1) + '°）' : ''}，灵敏度峰值 Ms = ${dB(Ms)}。闭环极点见右图（已换算为 Hz）。`, mg, poles, inf, stable, Ms, w2, zeta };
  },
  steps(v, r) {
    const pm = PS.rad(v.pm), z1 = 0.5 * Math.sqrt(Math.tan(pm) * Math.sin(pm)), os = z1 < 1 ? 100 * Math.exp(-Math.PI * z1 / Math.sqrt(1 - z1 * z1)) : 0;
    const st = [{ t: '高频极点位置', f: '∠L(fc) = −90° − arctan(ωc/ω2) = −180° + PM　⇒　ω2 = ωc·tan(PM)', r: 'f2 = ' + hz(r.w2 / TAU) + '（' + (r.w2 / TAU / v.fc).toFixed(2) + '·fc）' },
      { t: '闭环（无延时）', f: 'L/(1+L) = 1 / (1 + s/(ωc′) + s²/(ωc′·ω2))，ωn = √(ωc′·ω2)，ζ = ½√(ω2/ωc′)', r: 'ζ = ' + z1.toFixed(3) + '（经验 PM/100 = ' + (v.pm / 100).toFixed(2) + '）' },
      { t: '理论超调', f: 'M<sub>p</sub> = e<sup>−πζ/√(1−ζ²)</sup>', r: os.toFixed(1) + '%' + (v.td > 0 ? '（未计延时）' : '') + '；仿真 ' + (r.stable ? r.inf.os.toFixed(1) + '%' : '不稳定') },
      { t: '灵敏度峰值', f: 'M<sub>s</sub> = max|1/(1+L)|，且 |1+L(fc)| = 2·sin(PM/2)　⇒　M<sub>s</sub> ≥ 1/[2·sin(PM/2)]', r: 'Ms = ' + dB(r.Ms) + '，下限 1/(2sin(PM/2)) = ' + dB(1 / (2 * Math.sin(pm / 2))), n: 'Ms 表示最坏频率下扰动被放大的倍数；工程上希望 Ms < 6 dB。' }];
    if (v.td > 0) st.push({ t: '延时的影响', f: 'Δφ = 360°·fc·Td', r: (360 * v.fc * v.td).toFixed(1) + '°，实际 PM ' + r.mg.pm.toFixed(1) + '°' });
    return st;
  },
  roles: () => ({ head: ['PM', 'ζ（本模型）', '阶跃超调', 'Ms 下限', '评价'], rows: [[30, '振铃明显，元件容差下可能失稳'], [45, '常见下限（最差工况）'], [60, '标称设计常用值'], [65, 'ζ ≈ 0.7，超调很小'], [76, '临界阻尼附近，无超调但上升慢'], [89, '接近纯积分环路，响应最“钝”']].map(([p, e]) => {
    const r = PS.rad(p), z = 0.5 * Math.sqrt(Math.tan(r) * Math.sin(r)), os = z < 1 ? 100 * Math.exp(-Math.PI * z / Math.sqrt(1 - z * z)) : 0;
    return [p + '°', z.toFixed(2), os.toFixed(1) + '%', dB(1 / (2 * Math.sin(r / 2))), e];
  }) }),
  quiz: [['PM = 45° 时 |1+T(fc)| 是多少？', '|1+e<sup>j(−135°)</sup>| = 2·sin(22.5°) ≈ 0.77，即 fc 处扰动被放大约 1.3 倍（+2.3 dB）。'],
    ['为什么 PM 太大也不好？', '要获得很大的 PM，补偿器需要更多相位提升（更大的 K），高频增益随之升高、噪声放大；或者降低 fc，动态响应变慢。']] });
/* ---------- 系统型别与稳态误差：为什么补偿器要有积分器 ---------- */
Lr.add({ id: 'typeN', group: G2, title: '稳态误差与系统型别：为什么要有积分器', pre: ['fb'], kw: '静差 型别 积分 直流增益 OTA 有限增益',
  html: `${F('稳态误差 e<sub>ss</sub> = lim<sub>s→0</sub> s·E(s)，阶跃参考下 e<sub>ss</sub> = 1/(1 + T(0))')}
  ${K('只要环路里有一个积分器（原点极点），T(0) = ∞，阶跃扰动下的稳态误差就是 0——这就是所有电源补偿器都以积分器开头的原因。实际运放/OTA 的直流增益有限，“积分器”在很低的频率处变成一个极点，留下很小但不为零的静差。')}`,
  talk: `<p>控制理论按开环传递函数在原点的极点个数把系统分为 0 型、Ⅰ型、Ⅱ型……0 型系统直流增益有限，阶跃输入下总会剩下 1/(1+T(0)) 的误差；Ⅰ型系统（一个积分器）对阶跃输入的稳态误差为零，对斜坡输入有固定误差；Ⅱ型系统对斜坡也无误差。</p>
  <p>开关电源的输出电压要求精度在 1% 以内，而功率级自身的直流增益只有 Vin/Vm 之类的有限值（几十 dB），单靠比例放大会留下明显误差，而且误差还随 Vin、负载变化（负载调整率差）。补偿器加入积分器后，低频增益随频率降低持续上升，任何恒定扰动最终都被完全消除。</p>
  <p>实际电路中的积分器并不理想：运放开环增益 A<sub>OL</sub> 通常 60～100 dB，OTA 的直流增益为 gm·Ro（Ro 是输出阻抗，几 MΩ）。所以“原点极点”其实是一个极低频的实极点 f<sub>p0</sub> ≈ f<sub>i</sub>/A<sub>DC</sub>，环路直流增益 = 功率级直流增益 × A<sub>DC</sub>。下面拖动 A<sub>DC</sub>，看负载阶跃之后输出是否完全回到原值：A<sub>DC</sub> 越小，残留的“静差”越大，这时控制器手册里给出的负载调整率就派上用场了。</p>`,
  sl: [{ k: 'adc', l: '误差放大器直流增益', a: 3, b: 1e5, v: 1e5, log: true, fmt: x => dB(x) }, { k: 'mode', l: '补偿器', opts: [['int', '积分型（Type II，实际 A_DC 有限）'], ['p', '纯比例（同样的中频增益，无积分）']], v: 'int' }],
  calc(v) {
    const R = PS.design(PS.preset(1)), cp = R.rz.cpReal, wi = cp.wi, wz = cp.z[0], wp = cp.p[0];
    // 有限直流增益：wi/s → wi/(s + wi/Adc)；纯比例：把“积分 × 零点”换成它在 fz 以上的等效常数 ωi/ωz，保留高频极点
    const gc = v.mode === 'p' ? (s => C.sc(C.inv(C.lin(s, wp)), wi / wz)) : (s => C.mul(C.div(C.of(wi), C.addr(s, wi / v.adc)), C.div(C.lin(s, wz), C.lin(s, wp))));
    const Tf = s => C.mul(R.Pd(s), gc(s)), mg = PS.margins(Tf, R.fmin / 100, R.fmax), T0 = C.abs(Tf(C.jw(R.fmin / 1e4)));
    const dI = R.P.Io * 0.5, tw = 5e-3, stable = mg.pm > 0;
    let ld = null; if (stable) ld = Lr.loadStep(R, gc, dI, tw);
    const zol0 = C.abs(PS.zol(R.ctx, C.jw(R.fmin / 1e4)));
    return { f0: R.fmin / 100, f1: R.fmax, mg, series: [{ name: '开环 T', fn: Tf, color: c(1) }, { name: '补偿器 Gc', fn: gc, color: c(3) }],
      extra: [{ title: '负载阶跃 ' + PS.fmt(dI, 'A') + '：长时间尺度（看是否回到原值）', note: stable ? '5 ms 时偏差 ' + V(-ld.v[ld.v.length - 1], 'V') + '；理论稳态 ΔI·Zol(0)/(1+T(0)) = ' + V(dI * zol0 / (1 + T0), 'V') + (v.mode === 'int' && v.adc > 1e3 ? '（直流增益很高时，残余由积分器的慢速收敛决定，几乎为 0）' : '') : '<b>不稳定</b>', cfg: stable ? Ls.tcfg([{ name: 'Δvo', color: c(1), width: 2.2, x: ld.t, y: ld.v }], { label: 'Δvo (V)', hlines: [0] }) : Ls.tcfg([{ name: '—', color: c(1), x: [0, 1], y: [0, 0] }]) }],
      info: `示例：5 V→12 V Boost 峰值电流模式。直流环路增益 T(0) ≈ ${dB(T0)}，阶跃参考的稳态误差 1/(1+T0) = ${(100 / (1 + T0)).toPrecision(3)}%。`, T0, R, zol0, dI };
  },
  steps(v, r) {
    const R = r.R, cp = R.rz.cpReal, P0 = C.abs(R.Pd(C.jw(R.fmin / 1e4)));
    return [{ t: '功率级（含电流环）直流增益', r: '|P(0)| = ' + num(P0) + '（' + dB(P0) + '）' },
      { t: '补偿器直流增益', f: v.mode === 'p' ? '纯比例：Gc(0) = ωi/ωz' : '有限增益积分：Gc(0) = A<sub>DC</sub>', r: v.mode === 'p' ? num(cp.wi / cp.z[0]) + '（' + dB(cp.wi / cp.z[0]) + '）' : num(v.adc) + '（' + dB(v.adc) + '）' },
      { t: '低频极点（“积分器”实际位置）', f: 'f<sub>p0</sub> = f<sub>i</sub> / A<sub>DC</sub>', r: v.mode === 'p' ? '无' : hz(cp.wi / TAU / v.adc) },
      { t: '环路直流增益', f: 'T(0) = P(0)·Gc(0)', r: num(r.T0) + '（' + dB(r.T0) + '）' },
      { t: '负载调整：稳态输出偏差', f: 'Δvo = ΔI · Z<sub>ol</sub>(0) / (1 + T(0))', r: V(r.dI, 'A') + ' × ' + V(r.zol0, 'Ω') + ' / ' + num(1 + r.T0) + ' = <b>' + V(r.dI * r.zol0 / (1 + r.T0), 'V') + '</b>', n: '理想积分器时 T(0) → ∞，偏差为 0；实际芯片的负载调整率指标就由这一项（以及 Vref 精度）决定。' }];
  },
  roles: { head: ['系统型别', '原点极点数', '阶跃误差', '斜坡误差', '电源中的对应'], rows: [
    ['0 型', '0', '1/(1+K)', '∞', '纯比例补偿、纹波型 COT 无误差放大器（谷值调节）'],
    ['Ⅰ型', '1', '0', '1/K<sub>v</sub>', '所有带积分器的补偿器（Type I/II/III、PI、PID）'],
    ['Ⅱ型', '2', '0', '0', '少见：两个积分器相位 −180°，需要大量相位提升'],
    ['有限增益积分', '0（极低频极点）', '1/(1+P(0)·A<sub>DC</sub>)', '大', '实际运放/OTA，A<sub>DC</sub> 60～100 dB']] },
  quiz: [['纹波型 COT 没有误差放大器，输出电压精度怎样？', '它是 0 型系统，调节的是 FB 纹波的谷值，平均输出比 Vref 对应值高约半个纹波，且随纹波（Vin、L）变化。很多 COT 芯片内部加了一个积分器来校正这个误差。'],
    ['为什么不用两个积分器让误差更小？', '两个积分器带来 −180° 相位，必须在 fc 以下用零点把相位补回来，容易出现条件稳定；而且一个积分器已经让阶跃扰动误差为零，电源一般不需要跟踪斜坡参考。']] });

/* ---------- Nyquist 稳定判据 ---------- */
Lr.add({ id: 'nyq', group: G2, title: 'Nyquist 稳定判据与条件稳定', pre: ['pmtime'], kw: 'nyquist 奈奎斯特 包围 −1 条件稳定 多次穿越',
  html: `${F('Z = N + P：闭环右半平面极点数 = L(jω) 顺时针包围 −1 点的圈数 + 开环右半平面极点数')}
  ${K('PM 和 GM 只是 Nyquist 判据在“只穿越一次”时的简化。多次穿越 0 dB、或相位先跌破 −180° 又回升时（条件稳定），必须看 Nyquist 曲线是否包围 −1 点；条件稳定的电源在启动、限流时增益下降，可能突然振荡。')}`,
  talk: `<p>Bode 图用两张图分别画幅值和相位，Nyquist 图把它们合成一条复平面上的曲线：频率从 0 扫到 ∞，点 L(jω) 的位置就是“幅值为半径、相位为角度”。闭环特征方程是 1 + L = 0，所以 −1 点是关键：曲线离 −1 越近，系统越接近振荡。</p>
  <ul><li><b>PM</b>：曲线穿过单位圆的那一点，与负实轴的夹角；</li>
  <li><b>GM</b>：曲线穿过负实轴的那一点，离 −1 还差多少倍；</li>
  <li><b>灵敏度峰值 Ms</b>：曲线到 −1 的最近距离的倒数，是比 PM/GM 更全面的鲁棒性指标。</li></ul>
  <p>电源里最容易踩的坑是<b>条件稳定</b>：电压模式 Type III 如果双零点放得太高（高于 LC 谐振），在 f0 附近相位先跌到 −180° 以下，此时增益仍远大于 0 dB；到 fc 时相位又被零点抬回来，PM 看上去很好。Nyquist 图上，曲线在 −1 的左边绕了一圈又回来，没有包围 −1，所以是稳定的——但只要环路增益<b>下降</b>到一定程度（软启动时误差放大器饱和、输入电压降低、限流），曲线就会包围 −1 而振荡。下面拖动“零点位置”和“增益”观察这一现象。</p>`,
  sl: [{ k: 'zr', l: '双零点 / f0', a: 0.3, b: 4, v: 0.8, log: true, fmt: x => x.toFixed(2) + '×f0' }, { k: 'g', l: '环路增益倍率', a: 0.02, b: 3, v: 1, log: true, fmt: x => dB(x) }],
  calc(v) {
    const P = PS.preset(0), R0 = PS.design(P), op = R0.op, fc = R0.fcTarget;
    const cp = { type: 3, z: [TAU * op.f0 * v.zr, TAU * op.f0 * v.zr], p: [TAU * fc * 3, TAU * P.fs / 2], wi: 1 };
    PS.compSolveGain(cp, R0.Pd, fc);
    const Tf = s => C.sc(C.mul(R0.Pd(s), PS.compEval(cp, s)), v.g), mg = PS.margins(Tf, R0.fmin, R0.fmax);
    // 闭环稳定性：用相位判断各次 −180° 穿越处的增益，统计包围（L 开环稳定，P = 0）
    const f = mg.f, crs = [];
    for (let i = 0; i < f.length - 1; i++) { const a = (mg.ph[i] + 180) / 360, b = (mg.ph[i + 1] + 180) / 360; if (Math.floor(a) !== Math.floor(b)) crs.push({ f: f[i], m: mg.mag[i], dir: b < a ? -1 : 1 }); }
    let N = 0; crs.forEach(x => { if (x.m > 0) N += x.dir < 0 ? 1 : -1; });
    const stable = N <= 0 && mg.pm > 0;
    // 最小增益倍率使稳定（条件稳定的下限）
    // 先向下、后向上穿越且都在 0 dB 以上 → 条件稳定；增益降低超过“向上穿越处的 |T|”时，向上穿越落到 0 dB 以下而向下穿越仍在上方 → 包围 −1
    const up = crs.filter(x => x.dir > 0 && x.m > 0).map(x => x.m), gl = up.length ? Math.min(...up) : -Infinity;
    return { f0: R0.fmin, f1: R0.fmax, mg, series: [{ name: '开环 T', fn: Tf, color: c(1) }], vlines: [{ x: op.f0, label: 'f0' }, { x: op.f0 * v.zr, label: 'fz1,2' }],
      sch: Ls.nyqSvg(Tf, R0.fmin, R0.fmax),
      info: (stable ? '闭环<b>稳定</b>' : '闭环<b>不稳定</b>') + `：相位穿越 −180° 共 ${crs.length} 次${crs.length ? '（' + crs.map(x => hz(x.f) + ' 处 |T| = ' + x.m.toFixed(1) + ' dB').join('；') + '）' : ''}。` + (isFinite(gl) && gl > 0 && stable ? '<b>条件稳定</b>：增益再降低 ' + gl.toFixed(1) + ' dB 就会振荡。' : ''), crs, stable, gl };
  },
  steps(v, r) {
    const st = [{ t: '开环右半平面极点数 P', r: 'P = 0（功率级与补偿器本身都稳定）' }];
    r.crs.forEach((x, i) => st.push({ t: '第 ' + (i + 1) + ' 次相位穿越 −180°（' + (x.dir < 0 ? '向下' : '向上') + '）@ ' + hz(x.f), r: '|T| = ' + x.m.toFixed(2) + ' dB → ' + (x.m > 0 ? '在 −1 点左侧穿过负实轴（' + (x.dir < 0 ? '顺时针 +1' : '逆时针 −1') + '）' : '在 −1 与原点之间穿过（不计）') }));
    st.push({ t: '结论', f: 'Z = N + P', r: r.stable ? 'N = 0 → Z = 0，<b>稳定</b>' : '<b>Z > 0，不稳定</b>' });
    if (isFinite(r.gl) && r.gl > 0) st.push({ t: '条件稳定的下限', r: '增益降低超过 ' + r.gl.toFixed(1) + ' dB（软启动、Vin 降低、限流）时，相位回升穿越处的 |T| 先落到 0 dB 以下，而相位跌落穿越处仍在 0 dB 以上 → 曲线包围 −1 → 振荡', n: '解决：把双零点放低到 f0 附近或以下，让相位在 f0 处不跌破 −180°。' });
    return st;
  },
  roles: { head: ['Nyquist 图上的量', '对应 Bode 量', '工程含义'], rows: [
    ['曲线与单位圆交点的角度', 'PM', '阻尼、超调'],
    ['曲线与负实轴交点到原点的距离', '1/GM', '增益还能放大多少倍'],
    ['曲线到 −1 的最近距离 1/Ms', '综合指标', '对增益和相位同时变化的鲁棒性'],
    ['负实轴上 −1 左侧的穿越', '|T| > 0 dB 时相位 = −180°', '条件稳定的标志']] },
  quiz: [['PM = 60°、GM = 20 dB，但条件稳定，这个设计可以接受吗？', '风险很大。启动过程中误差放大器饱和、限流动作时环路增益会大幅下降，可能落入不稳定区，出现启动振荡或限流振荡。应改为双零点放在 f0 附近。'],
    ['为什么开环稳定（P = 0）时只要不包围 −1 就稳定？', 'Z = N + P，P = 0 且 N = 0 ⇒ Z = 0，闭环没有右半平面极点。']] });

})(typeof window !== 'undefined' ? window : globalThis);
