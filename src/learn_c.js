/* 学习：数字补偿器、延时、功率级特性（LC/ESR、RHPZ、PCMC 次谐波、COT） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, F = Lr.F, c = Lr.col;
const hz = x => PS.fmt(x, 'Hz', 3), fx = a => a.map(x => (+x).toPrecision(6)).join(', ');

function digLesson(id, title, type, html) {
  const sl = [{ k: 'fs', l: '采样频率 fs', a: 2e4, b: 2e6, v: 2e5, log: true, u: 'Hz' }, { k: 'fi', l: 'fi', a: 100, b: 1e5, v: 2e3, log: true, u: 'Hz' },
    { k: 'fz1', l: '零点 fz1', a: 100, b: 5e5, v: 3e3, log: true, u: 'Hz' }, { k: 'fp1', l: '极点 fp1', a: 300, b: 2e6, v: 4e4, log: true, u: 'Hz' }];
  if (type === 3) sl.push({ k: 'fz2', l: '零点 fz2', a: 100, b: 5e5, v: 6e3, log: true, u: 'Hz' }, { k: 'fp2', l: '极点 fp2', a: 300, b: 2e6, v: 8e4, log: true, u: 'Hz' });
  Lr.add({ id, group: '数字补偿器', title, html, sl,
    calc(v) {
      const T = 1 / v.fs, cp = { type, wi: TAU * v.fi, z: [TAU * v.fz1].concat(type === 3 ? [TAU * v.fz2] : []), p: [TAU * v.fp1].concat(type === 3 ? [TAU * v.fp2] : []) };
      const fc = Math.sqrt(v.fz1 * v.fp1), tu = PS.discretize(cp, T, 'tustin', fc), mp = PS.discretize(cp, T, 'mpz', fc), qz = PS.quantize(tu);
      return { f0: 10, f1: v.fs / 2 * 0.999, vlines: [v.fs / 2],
        series: [{ name: 's 域原型', fn: s => PS.compEval(cp, s), color: c(2), dash: true }, { name: 'Tustin（fc 预畸变）', fn: s => PS.dEval(tu, s, T), color: c(1) }, { name: '零极点匹配 MPZ', fn: s => PS.dEval(mp, s, T), color: c(3) }],
        sch: PS.schem('dig', { adc: '', ord: type + 'P' + type + 'Z', act: 'DPWM' }),
        info: `Tustin：b = [${fx(tu.b)}]，a = [${fx(tu.a)}]<br>定点 Q${qz.Q}：b = [${qz.bq.join(', ')}]，a = [${qz.aq.join(', ')}]<br>越接近 Nyquist（fs/2），数字曲线偏离模拟原型越多：Tustin 把 fs/2 映射到 ∞，MPZ 在 fs/2 处加零点。` };
    } });
}
digLesson('d2p2z', '2P2Z（数字 Type II）', 2, `<p>数字控制器每个周期执行一次差分方程。Type II 离散化后分子分母都是二阶，叫 <b>2P2Z</b>（两极点两零点）：</p>
  ${F('u[n] = b<sub>0</sub>e[n] + b<sub>1</sub>e[n−1] + b<sub>2</sub>e[n−2] − a<sub>1</sub>u[n−1] − a<sub>2</sub>u[n−2]')}
  ${F('Tustin：s = κ·(1 − z<sup>−1</sup>)/(1 + z<sup>−1</sup>)，κ = ω<sub>c</sub>/tan(ω<sub>c</sub>T/2)（预畸变，保证 fc 处与模拟完全一致）')}
  <p>积分器映射为 z = 1 处的极点，所以 1 + a<sub>1</sub> + a<sub>2</sub> = 0；定点量化时本工具强制满足这个等式，避免积分漂移。</p>`);
digLesson('d3p3z', '3P3Z（数字 Type III）', 3, `<p>Type III 离散化得到 <b>3P3Z</b>，是数字电压模式电源最常用的结构（TI C2000 的 DCL_DF23、Microchip 的 SMPS 库都提供）。</p>
  ${F('u[n] = Σ<sub>i=0..3</sub> b<sub>i</sub>·e[n−i] − Σ<sub>i=1..3</sub> a<sub>i</sub>·u[n−i]')}
  <p>零极点匹配（MPZ）把每个 s 平面零极点直接映射为 z = e<sup>sT</sup>，并在 z = −1（Nyquist）补零点使阶数一致，增益在 fc 处匹配。两种方法在低频几乎重合，差别只在接近 fs/2 的区域。</p>`);

Lr.add({ id: 'delay', group: '数字补偿器', title: '数字延时与相位损失',
  html: `<p>数字控制环路里有三段延时：ADC 采样保持、程序计算 tc、PWM 调制（后沿调制平均延时 D·Ts）。它们合起来近似为纯延时：</p>
  ${F('e<sup>−s·Td</sup>，Td = tc + D·Ts　⇒　相位损失 = 360° × fc × Td')}
  <p>例如 fs = 200 kHz、tc = Ts、D = 0.4 → Td = 7 µs，在 fc = fs/10 时损失 50°！这就是数字电源 fc 通常只取 fs/20～fs/15 的原因。ZOH（零阶保持）等效于 T/2 延时，曲线供对比。</p>`,
  sl: [{ k: 'fs', l: 'fs', a: 2e4, b: 2e6, v: 2e5, log: true, u: 'Hz' }, { k: 'tc', l: 'tc / Ts', a: 0, b: 1, v: 1, fmt: x => x.toFixed(2) }, { k: 'D', l: '占空比 D', a: 0.05, b: 0.95, v: 0.4, fmt: x => x.toFixed(2) }, { k: 'r', l: 'fc / fs', a: 0.01, b: 0.2, v: 0.05, fmt: x => '1/' + (1 / x).toFixed(1) }],
  calc(v) {
    const Ts = 1 / v.fs, Td = (v.tc + v.D) * Ts, fc = v.r * v.fs;
    const zoh = s => { const x = C.sc(s, Ts); return C.abs(x) < 1e-9 ? C.ONE : C.div(C.sub(C.ONE, C.exp(C.neg(x))), x); };
    return { f0: v.fs / 1000, f1: v.fs / 2, vlines: [fc], series: [{ name: '总延时 e^(−sTd)', fn: s => C.exp(C.sc(s, -Td)), color: c(1) }, { name: 'ZOH（参考）', fn: zoh, color: c(2), dash: true }],
      info: `Td = ${PS.fmt(Td, 's')} = ${(Td / Ts).toFixed(2)} Ts。在 fc = ${hz(fc)} 处相位损失 <b>${(360 * fc * Td).toFixed(1)}°</b>，这部分必须由补偿器额外提供。` };
  } });

const buckOp = v => { const P = Object.assign(PS.clone(PS.DEFAULTS), { L: v.L, C: v.C, Rc: v.Rc, Vo: 5 }); return { P, op: PS.opPoint(P, v.Vin, 5 / v.R) }; };
Lr.add({ id: 'buck', group: '功率级特性', title: 'Buck：LC 双极点与 ESR 零点',
  html: `<p>电压模式下，占空比到输出的传递函数（含寄生电阻）：</p>
  ${F('G<sub>vd</sub>(s) = Vin · (1 + s·R<sub>c</sub>C) / [1 + s(L/R + C(R<sub>c</sub>+R<sub>s</sub>)) + s²LC]')}
  <ul><li>f0 = 1/(2π√LC) 处是双极点：相位在 f0 附近急降 180°，轻载（R 大）时 Q 高，谐振尖峰明显。</li>
  <li>ESR 零点 f<sub>ESR</sub> = 1/(2πR<sub>c</sub>C)：陶瓷电容 ESR 很小，零点远在 fs 之外，Type III 必须自己提供两个零点。</li></ul>`,
  sl: [{ k: 'Vin', l: 'Vin', a: 6.5, b: 48, v: 12, u: 'V' }, { k: 'L', l: 'L', a: 1e-7, b: 1e-4, v: 4.7e-6, log: true, u: 'H' }, { k: 'C', l: 'C', a: 1e-6, b: 1e-3, v: 44e-6, log: true, u: 'F' },
    { k: 'Rc', l: 'ESR', a: 1e-4, b: 0.2, v: 5e-3, log: true, u: 'Ω' }, { k: 'R', l: '负载 R', a: 0.5, b: 100, v: 1.67, log: true, u: 'Ω' }],
  calc(v) {
    const { P, op } = buckOp(v), Q = v.R * Math.sqrt(v.C / v.L) / (1 + v.R * (v.Rc + op.Rs) * v.C / v.L);
    return { f0: 10, f1: 1e7, vlines: [op.f0, op.fesr], series: [{ name: 'Gvd', fn: s => PS.Gvd(op, P, s).Gvd, color: c(2) }],
      info: `f0 = ${hz(op.f0)}，Q ≈ ${Q.toFixed(2)}（峰值 ${(20 * Math.log10(Math.max(Q, 1e-3))).toFixed(1)} dB），f<sub>ESR</sub> = ${hz(op.fesr)}。` };
  } });

Lr.add({ id: 'rhpz', group: '功率级特性', title: 'Boost / Buck-Boost：右半平面零点',
  html: `<p>Boost 开关管导通时电感储能、二极管（上管）断开，<b>输出电流反而先减小</b>，之后才增大——这种“先反向后正向”就是右半平面零点（RHPZ）。它像普通零点一样让增益 +20 dB/dec，但相位却 <b>滞后</b> 90°，无法补偿。</p>
  ${F('Boost：f<sub>RHPZ</sub> = R·D′² / (2π·L)　　Buck-Boost：f<sub>RHPZ</sub> = R·D′² / (2π·L·D)')}
  <p>重载（R 小）、低输入电压（D′ 小）时 RHPZ 最低，所以带宽按最差工况取 fc ≲ f<sub>RHPZ</sub>/5。电流模式也消除不了 RHPZ。</p>`,
  sl: [{ k: 'Vin', l: 'Vin', a: 2, b: 11, v: 5, u: 'V' }, { k: 'L', l: 'L', a: 1e-6, b: 1e-4, v: 10e-6, log: true, u: 'H' }, { k: 'Io', l: 'Io', a: 0.1, b: 5, v: 1, log: true, u: 'A' }],
  calc(v) {
    const P = Object.assign(PS.preset(1), { L: v.L }), op = PS.opPoint(P, v.Vin, v.Io);
    if (!op.ok) return { series: [], info: op.err };
    return { f0: 10, f1: 1e7, vlines: [op.frhpz, op.f0], series: [{ name: 'Gvd（Boost 12 V）', fn: s => PS.Gvd(op, P, s).Gvd, color: c(2) }],
      info: `D = ${op.D.toFixed(3)}，f0 = ${hz(op.f0)}，<b>f<sub>RHPZ</sub> = ${hz(op.frhpz)}</b>，建议 fc &lt; ${hz(op.frhpz / 5)}。注意 RHPZ 之后相位继续下降而不是回升。` };
  } });
})(typeof window !== 'undefined' ? window : globalThis);
