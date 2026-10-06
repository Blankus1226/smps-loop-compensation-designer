/* 学习：峰值电流模式次谐波与斜坡补偿、COT 双极点与 ESR 判据 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, F = Lr.F, c = Lr.col;
const hz = x => PS.fmt(x, 'Hz', 3);

// 逐周期大信号迭代：给谷值电流一个扰动，看它衰减还是放大
function subharm(D, k) {
  const Ts = 1, Sn = 1 / D, Sf = 1 / (1 - D), Se = k * Sf, vc = Sn * D * Ts + Se * D * Ts;
  let iv = 0.12; const pts = [[0, iv]], nom = [[0, 0]];
  for (let n = 0; n < 9; n++) {
    let ton = (vc - iv) / (Sn + Se); ton = Math.max(0, Math.min(ton, 0.98 * Ts));
    const ip = iv + Sn * ton; pts.push([n + ton, ip]); iv = ip - Sf * (Ts - ton); pts.push([n + 1, iv]);
    nom.push([n + D, Sn * D], [n + 1, 0]);
  }
  const all = pts.concat(nom).map(p => p[1]), lo = Math.min(...all), hi = Math.max(...all);
  const W = 560, H = 190, x = t => 30 + t / 9 * (W - 50), y = v => 160 - (v - lo) / (hi - lo || 1) * 130;
  const pl = (a, cl, w, d) => `<polyline fill="none" stroke="${cl}" stroke-width="${w}" ${d ? 'stroke-dasharray="5 4"' : ''} points="${a.map(p => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')}"/>`;
  return `<svg class="schem" viewBox="0 0 ${W} ${H}" role="img" aria-label="电感电流逐周期扰动">${pl(nom, PS.css('--axis'), 1.5, true)}${pl(pts, c(1), 2.2)}
    <text x="30" y="16" class="sk" style="fill:var(--text-primary)">电感电流（虚线 = 稳态，实线 = 加扰动后）</text><text x="${W - 20}" y="${H - 6}" class="sv" text-anchor="end">开关周期 →</text></svg>`;
}

Lr.add({ id: 'pcmc', group: '功率级特性', title: '峰值电流模式：次谐波振荡与斜坡补偿',
  html: `<p>峰值电流模式每个周期在电流达到 vc/Ri 时关断。若谷值电流有一个扰动 Δi，下一周期扰动变为：</p>
  ${F('Δi<sub>n+1</sub> = −Δi<sub>n</sub> · (S<sub>f</sub> − S<sub>e</sub>) / (S<sub>n</sub> + S<sub>e</sub>)')}
  <p>无斜坡补偿（Se = 0）且 D &gt; 0.5 时 Sf &gt; Sn，扰动每周期反号放大，出现 fs/2 的<b>次谐波振荡</b>。Ridley 模型把它表示为 fs/2 处的一对双极点：</p>
  ${F('Q<sub>p</sub> = 1 / [π(m<sub>c</sub>·D′ − 0.5)]，m<sub>c</sub> = 1 + S<sub>e</sub>/S<sub>n</sub>　（Q<sub>p</sub> &lt; 0 即不稳定）')}
  <p>Se = Sf/2 可保证任何占空比都稳定；Se = Sf 为“无差拍”（一个周期消除扰动）。斜坡越大，电流模式越接近电压模式。</p>`,
  plotTitle: '控制到输出 vo/vc 的 Bode 图（Buck 12→5 V 示例，D 由下方滑杆改变）',
  sl: [{ k: 'D', l: '占空比 D', a: 0.1, b: 0.9, v: 0.65, fmt: x => x.toFixed(2) }, { k: 'k', l: 'Se / Sf', a: 0, b: 1.2, v: 0.0, fmt: x => x.toFixed(2) }],
  calc(v) {
    const P = Object.assign(PS.clone(PS.DEFAULTS), { mode: 'pcmc', Vo: 12 * v.D }), op = PS.opPoint(P, 12, 3);
    const Se = v.k * op.Sf, ctx = { P, op, H: P.Vref / P.Vo, Ts: 1 / P.fs, mode: 'pcmc', impl: 'analog', Se, dig: {} };
    const q = PS.pcmcQ(op, Se), ratio = (op.Sf - Se) / (op.Sn + Se);
    return { f0: 100, f1: P.fs * 0.98, vlines: [P.fs / 2], series: [{ name: 'vo/vc', fn: s => PS.plantP(ctx, s), color: c(2) }], sch: subharm(v.D, v.k),
      info: `每周期扰动比 = ${(-ratio).toFixed(3)}（|·| ${Math.abs(ratio) < 1 ? '&lt; 1 收敛' : '≥ 1 <b>发散，次谐波振荡</b>'}）。Qp = ${isFinite(q.Qp) ? q.Qp.toFixed(2) : '&lt;0（不稳定）'}；使 Qp = 1 需 Se/Sf ≈ ${(((1 / Math.PI + 0.5) / op.Dp - 1) * op.Sn / op.Sf).toFixed(2)}。` };
  } });

Lr.add({ id: 'cot', group: '功率级特性', title: 'COT：fs/2 附近双极点与 ESR 判据',
  html: `<p>恒定导通时间（COT）控制没有固定时钟：比较器检测到谷值就开通一个固定 Ton。Jian Li 的描述函数模型给出：</p>
  ${F('电流型 COT：iL/vc = (1/Ri) / (1 + s/(ω<sub>1</sub>Q<sub>1</sub>) + s²/ω<sub>1</sub>²)，ω<sub>1</sub> = π/Ton，Q<sub>1</sub> = 2/π')}
  ${F('纹波型 COT：vo/vc = (1 + s·r<sub>c</sub>C) / (1 + s/(ω<sub>2</sub>Q<sub>2</sub>) + s²/ω<sub>2</sub>²)，Q<sub>2</sub> = 1/[π(r<sub>c</sub>C/Ton − 1/2)]')}
  <p>纹波型 COT 靠输出电容 ESR 上的纹波充当“电流采样”。<b>r<sub>c</sub>C &lt; Ton/2 时 Q<sub>2</sub> &lt; 0，出现次谐波振荡</b>——这就是 D-CAP 等方案不能直接配陶瓷电容、需要“纹波注入”的原因。</p>`,
  sl: [{ k: 'Rc', l: 'ESR rc', a: 1e-4, b: 0.05, v: 6e-3, log: true, u: 'Ω' }, { k: 'C', l: '输出电容 C', a: 1e-5, b: 1e-3, v: 220e-6, log: true, u: 'F' }, { k: 'Ton', l: '导通时间 Ton', a: 5e-8, b: 2e-6, v: 2e-7, log: true, u: 's' }],
  calc(v) {
    const P = { Rc: v.Rc, C: v.C }, op = { Ton: v.Ton }, rcC = v.Rc * v.C, Q2 = PS.cotrQ(op, P);
    return { f0: 1e3, f1: 3 / v.Ton, vlines: [1 / (2 * v.Ton)],
      series: [{ name: '纹波型 COT vo/vc', fn: s => PS.Pcotr(op, P, s, 1), color: c(2) }, { name: '电流型 COT Hcot（Ri·iL/vc）', fn: s => PS.Hcot(s, v.Ton), color: c(3), dash: true }],
      info: `rc·C = ${PS.fmt(rcC, 's')}，Ton/2 = ${PS.fmt(v.Ton / 2, 's')} → ${rcC > v.Ton / 2 ? 'Q2 = ' + Q2.toFixed(2) + (Q2 > 2 ? '（偏高，裕量小）' : '（稳定）') : '<b>rc·C &lt; Ton/2，不稳定</b>：需 ESR &gt; ' + PS.fmt(v.Ton / 2 / v.C, 'Ω') + ' 或加纹波注入'}。双极点位于 1/(2Ton) = ${hz(1 / (2 * v.Ton))}（约 fs/2 附近）。` };
  } });
})(typeof window !== 'undefined' ? window : globalThis);
