/* 设计页渲染：KPI、提示、Bode、补偿器、手动微调、数字实现 */
(function (G) {
'use strict';
const PS = G.PS, UI = PS.UI, C = PS.C, TAU = 2 * Math.PI;
const $ = id => document.getElementById(id);
const col = i => PS.css('--s' + i);
const stPM = pm => !isFinite(pm) ? '' : pm >= 45 ? '<span class="st good">良好</span>' : pm >= 30 ? '<span class="st warn">偏低</span>' : '<span class="st bad">' + (pm < 0 ? '不稳定' : '危险') + '</span>';
const stGM = gm => !isFinite(gm) ? '<span class="st good">无穿越</span>' : gm >= 6 ? '<span class="st good">良好</span>' : '<span class="st bad">偏低</span>';
const kpi = (k, v, s) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`;

UI.renderSoon = PS.debounce(() => UI.render(), 120);
UI.render = function () {
  const P = UI.P;
  let R;
  try { R = UI.R = PS.design(P); } catch (e) { $('msgs').innerHTML = `<div class="msg e"><span class="ic">✕</span><span>计算出错：${PS.esc(e.message)}</span></div>`; console.error(e); return; }
  UI.renderKpis(R); UI.renderBode(R); UI.renderGc(R); UI.renderComp(R); UI.renderTune(R); UI.renderDig(R);
  UI.stale = { sweep: true, step: true, exp: true };
  const cur = document.querySelector('nav.tabs [aria-selected="true"]').id;
  if (cur === 'tb-sweep') UI.renderSweep(); if (cur === 'tb-step') UI.runStep(); if (cur === 'tb-export') UI.renderExport();
};

UI.renderKpis = function (R) {
  const P = R.P, op = R.op;
  $('title-sum').textContent = PS.TOPOS[P.topo] + ' · ' + PS.MODES[P.mode] + ' · ' + (P.impl === 'digital' ? '数字' : P.family === 'ota' ? '模拟 OTA' : '模拟运放');
  if (R.fatal) { $('kpis').innerHTML = ''; $('msgs').innerHTML = `<div class="msg e"><span class="ic">✕</span><span>${PS.esc(R.fatal)}</span></div>`; PS.annotate($('msgs')); return; }
  const mg = R.mg, h = [];
  h.push(kpi('占空比 D', op.D.toFixed(3), 'IL = ' + PS.fmt(op.IL, 'A') + '，ΔIL = ' + PS.fmt(op.dIL, 'A')));
  if (mg) {
    h.push(kpi('穿越频率 fc', PS.fmt(mg.fc, 'Hz'), '目标 ' + PS.fmt(R.fcTarget, 'Hz') + (P.fcAuto && !P.manual ? '（自动）' : '')));
    h.push(kpi('相位裕度 PM', PS.fmtNum(mg.pm, 1) + '°', stPM(mg.pm) + (mg.crossings > 1 ? ' 最小 ' + mg.pmMin.toFixed(0) + '°' : '')));
    h.push(kpi('增益裕度 GM', isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞', stGM(mg.gm) + (isFinite(mg.fgm) ? ' @' + PS.fmt(mg.fgm, 'Hz') : '')));
  } else h.push(kpi('外环', '无', '无误差放大器，比较器直接比较 FB 与 Vref'));
  h.push(kpi('LC 谐振 f0', PS.fmt(op.f0, 'Hz'), 'fESR = ' + PS.fmt(op.fesr, 'Hz')));
  if (P.topo !== 'buck') h.push(kpi('RHPZ', PS.fmt(op.frhpz, 'Hz'), '最差 ' + PS.fmt(R.frhpzWorst, 'Hz')));
  if (R.pcmc) h.push(kpi('Qp（fs/2 双极点）', isFinite(R.pcmc.Qp) ? R.pcmc.Qp.toFixed(2) : '<0', 'mc = ' + R.pcmc.mc.toFixed(2) + '，Qp=1 需 Se/Sf ≈ ' + R.pcmc.seOpt.toFixed(2)));
  if (R.cotr) h.push(kpi('Q2（纹波 COT）', isFinite(R.cotr.Q2) ? R.cotr.Q2.toFixed(2) : '不稳定', 'rc·C = ' + PS.fmt(R.cotr.rcC, 's') + '，需 > ' + PS.fmt(R.cotr.need, 's')));
  if (P.mode === 'coti' || P.mode === 'cotr') h.push(kpi('导通时间 Ton', PS.fmt(op.Ton, 's'), 'ω1 = π/Ton → ' + PS.fmt(1 / (2 * op.Ton), 'Hz')));
  if (R.inner) h.push(kpi('电流内环 fci / PM', PS.fmt(R.inner.mg.fc, 'Hz'), 'PM = ' + PS.fmtNum(R.inner.mg.pm, 1) + '° ' + stPM(R.inner.mg.pm)));
  if (R.delayLoss) h.push(kpi('数字延时相位损失', R.delayLoss.toFixed(1) + '°', 'Td = ' + PS.fmt(R.ctx.dig.Td, 's')));
  $('kpis').innerHTML = h.join('');
  const m = [];
  R.warn.forEach(w => m.push(`<div class="msg w"><span class="ic">!</span><span>${PS.esc(w)}</span></div>`));
  R.info.forEach(w => m.push(`<div class="msg i"><span class="ic">i</span><span>${PS.esc(w)}</span></div>`));
  if (!R.warn.length && mg && mg.pm > 40) m.unshift('<div class="msg i"><span class="ic">✓</span><span>设计满足目标，可在“负载阶跃”页查看开关级仿真验证</span></div>');
  $('msgs').innerHTML = m.join('');
  PS.annotate($('kpis')); PS.annotate($('msgs'));
};

// Bode 图数据
UI.bodeCfg = function (R, which) {
  const P = R.P, dig = P.impl === 'digital';
  const f = PS.logspace(R.fmin, R.fmax, 600), S = [], Ph = [];
  const add = (name, fn, c, dash, w) => { const b = PS.bode(fn, f); S.push({ name, color: c, dash, width: w, x: f, y: b.mag }); Ph.push({ name, color: c, dash, width: w, x: f, y: b.ph }); };
  let mg;
  if (which === 'inner' && R.inner) {
    mg = R.inner.mg;
    const gi = dig ? (s => PS.dEval(R.inner.qz, s, R.ctx.Ts)) : R.ctx.Gci;
    add('开环 Ti', R.inner.T, col(1), false, 2.5); add('对象（d→iL 采样）', R.inner.plant, col(2)); add('电流补偿器', gi, col(3));
  } else if (R.T) {
    mg = R.mg;
    add('开环 T', R.T, col(1), false, 2.5); add('被控对象 P', R.Pd, col(2)); add('补偿器 Gc', R.gcPlot, col(3));
    if (dig) { add('Gc s 域原型', R.gcIdeal, col(3), true); add('T（s 域原型）', R.Tideal, col(1), true, 1.5); }
    else if (P.roundE) { add('T（理想元件）', R.Tideal, col(1), true, 1.5); }
  } else { add('vo/vc（纹波 COT 本征环路）', s => C.sc(R.Pl(s), R.ctx.H), col(2)); }
  const vlines = [], arrM = [], arrP = [];
  if (mg && isFinite(mg.fc)) {
    vlines.push({ x: mg.fc });
    const phc = PS.interp({ x: mg.f, y: mg.ph }, mg.fc);
    arrP.push({ x: mg.fc, y0: -180 + 360 * Math.round((phc + 180) / 360), y1: phc, label: 'PM ' + mg.pm.toFixed(1) + '°' });
  }
  if (mg && isFinite(mg.fgm)) arrM.push({ x: mg.fgm, y0: -mg.gm, y1: 0, label: 'GM ' + mg.gm.toFixed(1) + ' dB' });
  if (!dig && R.P.mode === 'pcmc') vlines.push({ x: P.fs / 2 });
  if (dig) vlines.push({ x: P.fs / 2 * 0.999 });
  return {
    xLog: true, xUnit: 'Hz', height: 470, vlines,
    panels: [
      { label: '幅值 (dB)', unit: 'dB', series: S, hlines: [{ y: 0, strong: true }], arrows: arrM, clamp: [-100, 120, 140], step: 20, tipTag: '|·|', fmtTip: v => v.toFixed(1) },
      { label: '相位 (°)', unit: '°', series: Ph, hlines: [{ y: -180, dash: true }], arrows: arrP, clamp: [-450, 200, 400], step: 45, fmtTip: v => v.toFixed(1) },
    ],
  };
};
UI.renderBode = function (R) {
  const sel = $('loopSel');
  if (R.inner) {
    sel.hidden = false;
    if (!sel.childElementCount) sel.innerHTML = '<button type="button" data-v="outer" aria-pressed="true">电压外环</button><button type="button" data-v="inner" aria-pressed="false">电流内环</button>';
    sel.querySelectorAll('button').forEach(b => { b.onclick = () => { UI.loop = b.dataset.v; sel.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); UI.renderBode(UI.R); }; });
  } else { sel.hidden = true; UI.loop = 'outer'; }
  if (!UI.bode) UI.bode = new PS.Plot($('bode'), {});
  if (R.fatal) return;
  UI.bode.set(UI.bodeCfg(R, UI.loop || 'outer'));
};

// 补偿器单独的 Bode 图：外环 Gc（实际 / 理想或 s 域原型 / 浮点系数），平均电流模式可切到电流补偿器；标出各极零点与 fc
UI.renderGc = function (R) {
  const card = $('card-gc'), P = R.P, dig = P.impl === 'digital';
  if (R.fatal || R.noLoop || !R.kd) { card.hidden = true; return; }
  card.hidden = false;
  const sel = $('gcSel');
  if (R.inner) {
    sel.hidden = false;
    if (!sel.childElementCount) sel.innerHTML = '<button type="button" data-v="outer" aria-pressed="true">电压补偿器</button><button type="button" data-v="inner" aria-pressed="false">电流补偿器</button>';
    sel.querySelectorAll('button').forEach(b => { b.onclick = () => { UI.gcLoop = b.dataset.v; sel.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); UI.renderGc(UI.R); }; });
  } else { sel.hidden = true; UI.gcLoop = 'outer'; }
  const inner = UI.gcLoop === 'inner' && R.inner, f = PS.logspace(R.fmin, R.fmax, 600), S = [], Ph = [];
  const add = (name, fn, c, dash, w) => { const b = PS.bode(fn, f); S.push({ name, color: c, dash, width: w || 2.4, x: f, y: b.mag }); Ph.push({ name, color: c, dash, width: w || 2.4, x: f, y: b.ph }); };
  let cpD, cpR, fc;
  if (inner) {
    const I = R.inner; cpD = I.kd.cp; cpR = I.rz ? I.rz.cpReal : null; fc = I.mg.fc;
    add(dig ? '电流补偿器（量化系数）' : '电流补偿器（圆整元件）', dig ? (s => PS.dEval(I.qz, s, R.ctx.Ts)) : R.ctx.Gci, col(3));
    add(dig ? 's 域原型' : '理想元件', s => PS.compEval(cpD, s), col(2), true, 1.6);
  } else {
    cpD = R.kd.cp; cpR = R.rz ? R.rz.cpReal : null; fc = R.mg.fc;
    add(dig ? 'Gc（量化系数）' : 'Gc（圆整元件）', R.gcPlot, col(3));
    if (dig) { add('Gc s 域原型', R.gcIdeal, col(2), true, 1.6); add('Gc 浮点系数', R.gcFloat, col(4), true, 1.3); }
    else if (P.roundE) add('Gc 理想元件', R.gcIdeal, col(2), true, 1.6);
  }
  const vl = PS.pzList(cpR || cpD).slice(1).map(x => ({ x: x.f, label: x.k.split(' ')[1] })).filter(x => x.x > R.fmin && x.x < R.fmax);
  if (isFinite(fc)) vl.push({ x: fc, label: inner ? 'fci' : 'fc', color: col(1) });
  if (dig) vl.push({ x: P.fs / 2 * 0.999, label: 'fs/2' });
  if (!UI.gcPlot) UI.gcPlot = new PS.Plot($('gcbode'), {});
  UI.gcPlot.set({ xLog: true, xUnit: 'Hz', height: 380, vlines: vl, panels: [
    { label: '幅值 (dB)', unit: 'dB', series: S, hlines: [{ y: 0, strong: true }], clamp: [-100, 140, 160], step: 20, tipTag: '|·|', fmtTip: v => v.toFixed(1) },
    { label: '相位 (°)', unit: '°', series: Ph, hlines: [{ y: -90, dash: true }], clamp: [-450, 200, 400], step: 45, fmtTip: v => v.toFixed(1) }] });
  const sc = C.jw(fc), gv = (inner ? (dig ? PS.dEval(R.inner.qz, sc, R.ctx.Ts) : R.ctx.Gci(sc)) : R.gcPlot(sc));
  $('gc-hint').innerHTML = isFinite(fc) ? `在 ${inner ? 'fci' : 'fc'} = ${PS.fmt(fc, 'Hz')} 处：|Gc| = ${PS.dB(C.abs(gv)).toFixed(1)} dB，∠Gc = ${PS.deg(C.arg(gv)).toFixed(1)}°，即比积分器的 −90° 多提升了 ${(PS.deg(C.arg(gv)) + 90).toFixed(1)}°。` + (dig ? '数字补偿器在 fs/2 以上周期重复，只画到 Nyquist。' : '虚线为未圆整的理想值。') + ' 各极零点的作用见下方表格，原理见“学习模式 → 开环增益分析方法”。' : '';
  PS.annotate($('gc-hint'));
};

UI.renderComp = function (R) {
  const P = R.P, card = $('card-comp');
  if (R.fatal || R.noLoop) { card.hidden = !R.noLoop; $('schem').innerHTML = ''; $('comp-tables').innerHTML = R.noLoop ? '<p>纹波型 COT 无误差放大器：FB 直接与 Vref 比较，DC 调节点为纹波谷值，平均输出比设定值高约半个纹波。</p>' : ''; return; }
  card.hidden = false;
  const kd = R.kd, dig = P.impl === 'digital', h = [];
  $('comp-sub').textContent = 'Type ' + kd.type + (P.manual ? ' · 手动' : P.method === 'classic' && P.mode === 'vmc' && !dig && P.family === 'opamp' ? ' · 经典放置' : ' · K 因子法') + (isFinite(kd.boost) ? ' · 需相位提升 ' + kd.boost.toFixed(1) + '°' : '') + (kd.K ? ' · K = ' + kd.K.toFixed(2) : '');
  if (dig) $('schem').innerHTML = PS.schem('dig', { adc: P.adcBits + ' bit', ord: (R.qz.a.length - 1) + 'P' + (R.qz.a.length - 1) + 'Z', act: P.mode === 'pcmc' ? 'DAC' : 'DPWM', actv: P.mode === 'pcmc' ? '→ 峰值比较器' : 'N = ' + R.ctx.dig.Npwm, plant: P.mode === 'acm' ? '电流内环 + 功率级' : 'Gvd(s)' });
  else $('schem').innerHTML = PS.schemOf(R.rz, P.family);
  if (!dig) {
    h.push('<h3>元件值</h3><table class="tb"><tr><th>元件</th><th>计算值</th><th>' + (P.roundE ? 'E' + P.eR + ' / E' + P.eC : '取值') + '</th><th>偏差</th></tr>');
    R.rz.parts.forEach(p => h.push(`<tr><td>${p.name}</td><td>${PS.fmt(p.ideal, p.unit, 4)}</td><td><b>${PS.fmt(p.val, p.unit, 3)}</b></td><td>${((p.val / p.ideal - 1) * 100).toFixed(1)}%</td></tr>`));
    h.push('</table>');
  }
  h.push('<h3>极零点与作用</h3><table class="tb roles"><tr><th></th><th>设计值</th><th>' + (dig ? '—' : '实际（圆整后）') + '</th><th>作用</th></tr>');
  const a = PS.pzList(kd.cp), b = dig ? null : PS.pzList(R.rz.cpReal), ro = PS.Learn.pzRoles(R);
  a.forEach((x, i) => h.push(`<tr><td>${x.k}</td><td>${PS.fmt(x.f, 'Hz', 4)}</td><td>${b ? PS.fmt(b[i].f, 'Hz', 4) : ''}</td><td>${ro[i] ? ro[i].role : ''}</td></tr>`));
  h.push('</table><p class="hint">完整的逐步计算过程见“学习模式 → 完整设计实例”。</p>');
  const chips = PS.chipsFor ? PS.chipsFor(P.mode, P.topo, P.impl) : [];
  if (chips.length) h.push('<h3>同类控制器芯片（参考）</h3><ul class="chiplist">' + chips.map(ch => `<li><b>${ch[0]}</b>：${ch[3]}，${ch[5]}。${PS.Learn.dsLinks(ch)}</li>`).join('') + '</ul><p class="hint">全部芯片与数据手册见“学习模式 → 典型控制器芯片”。</p>');
  if (R.inner && !dig) {
    h.push('<h3>电流内环补偿器（Type II，运放差分输入）</h3><table class="tb"><tr><th>元件</th><th>取值</th></tr>');
    R.inner.rz.parts.forEach(p => h.push(`<tr><td>${p.name}</td><td>${PS.fmt(p.val, p.unit, 3)}</td></tr>`));
    h.push('</table>');
  }
  $('comp-tables').innerHTML = h.join('');
  PS.annotate($('card-comp'));
};
})(typeof window !== 'undefined' ? window : globalThis);
