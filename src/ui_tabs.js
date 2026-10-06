/* 工况扫描、负载阶跃、导出、术语表 */
(function (G) {
'use strict';
const PS = G.PS, UI = PS.UI;
const $ = id => document.getElementById(id);
const col = i => PS.css('--s' + i);

UI.renderSweep = function () {
  const R = UI.R; UI.stale.sweep = false;
  if (!R || R.fatal) { $('sweep-table').innerHTML = '<p>当前设计无效。</p>'; return; }
  const rows = UI.sweepRows = PS.sweep(R), P = R.P;
  const h = ['<table class="tb"><tr><th>Vin</th><th>Io</th><th>D</th><th>fc</th><th>PM</th><th>GM</th>' + (P.mode === 'pcmc' ? '<th>Qp</th>' : '') + (P.topo !== 'buck' ? '<th>fRHPZ</th>' : '') + '<th>DCM 风险</th><th></th></tr>'];
  rows.forEach(r => {
    const tag = r.worst ? '最差 PM' : r.nom ? '标称' : '';
    if (r.err) { h.push(`<tr><td>${PS.fmt(r.Vin, 'V')}</td><td>${PS.fmt(r.Io, 'A')}</td><td colspan="8">${PS.esc(r.err)}</td></tr>`); return; }
    h.push(`<tr class="${r.worst ? 'hl' : ''} ${r.nom ? 'nom' : ''}"><td>${PS.fmt(r.Vin, 'V')}</td><td>${PS.fmt(r.Io, 'A')}</td><td>${r.op.D.toFixed(3)}</td><td>${PS.fmt(r.fc, 'Hz')}</td><td>${PS.fmtNum(r.pm, 1)}°</td><td>${isFinite(r.gm) ? r.gm.toFixed(1) + ' dB' : '∞'}</td>` +
      (P.mode === 'pcmc' ? `<td>${isFinite(r.Qp) ? r.Qp.toFixed(2) : '<0'}</td>` : '') + (P.topo !== 'buck' ? `<td>${PS.fmt(r.op.frhpz, 'Hz')}</td>` : '') +
      `<td>${r.op.dcm ? '<span class="st warn">是</span>' : '否'}</td><td>${tag}</td></tr>`);
  });
  h.push('</table>');
  $('sweep-table').innerHTML = h.join(''); PS.annotate($('sweep-table'));
  const S = [], Ph = [], gray = PS.css('--axis');
  const lab = r => PS.fmt(r.Vin, 'V') + ' / ' + PS.fmt(r.Io, 'A');
  rows.filter(r => r.bode || r.Pb).forEach(r => {
    const b = r.bode || r.Pb, c = r.worst ? col(2) : r.nom ? col(1) : gray, w = r.worst || r.nom ? 2.5 : 1.3;
    const name = r.worst ? '最差 ' + lab(r) : r.nom ? '标称 ' + lab(r) : lab(r);
    S.push({ name, color: c, width: w, x: b.f, y: b.mag, noLegend: !r.worst && !r.nom }); Ph.push({ name, color: c, width: w, x: b.f, y: b.ph, noLegend: true });
  });
  // 先画灰线再画高亮
  const ord = a => a.sort((x, y) => (x.color === gray ? 0 : 1) - (y.color === gray ? 0 : 1));
  if (!UI.sweepPlot) UI.sweepPlot = new PS.Plot($('sweep-bode'), {});
  UI.sweepPlot.set({ xLog: true, xUnit: 'Hz', height: 440, panels: [
    { label: '幅值 (dB)', unit: 'dB', series: ord(S), hlines: [{ y: 0, strong: true }], clamp: [-100, 120, 140], step: 20, fmtTip: v => v.toFixed(1) },
    { label: '相位 (°)', unit: '°', series: ord(Ph), hlines: [{ y: -180, dash: true }], clamp: [-450, 200, 400], step: 45, fmtTip: v => v.toFixed(1) }] });
};

UI.runStep = function () {
  const R = UI.R; UI.stale.step = false;
  if (!R || R.fatal) return;
  $('step-msgs').innerHTML = '<div class="msg i"><span class="ic">…</span><span>正在进行开关级仿真…</span></div>';
  setTimeout(() => {
    let S;
    try { S = UI.S = PS.simulate(R); } catch (e) { $('step-msgs').innerHTML = `<div class="msg e"><span class="ic">✕</span><span>${PS.esc(e.message)}</span></div>`; return; }
    if (S.err) { $('step-msgs').innerHTML = `<div class="msg e"><span class="ic">✕</span><span>${PS.esc(S.err)}</span></div>`; if (!S.rec) return; }
    const P = R.P, k = [], kp = (a, b, c) => k.push(`<div class="kpi"><div class="k">${a}</div><div class="v">${b}</div><div class="s">${c || ''}</div></div>`);
    let pmin = NaN, pmax = NaN;
    if (S.pred) { const sign = S.I2 > S.I1 ? 1 : -1; S.pred.t.forEach((t, i) => { const d = S.pred.v[i] - S.Vpre; if (t >= S.T1 && t < S.T2) pmin = isNaN(pmin) ? d : sign > 0 ? Math.min(pmin, d) : Math.max(pmin, d); if (t >= S.T2) pmax = isNaN(pmax) ? d : sign > 0 ? Math.max(pmax, d) : Math.min(pmax, d); }); }
    kp('阶跃前平均 Vo', PS.fmt(S.Vpre, 'V', 5), '设定 ' + PS.fmt(P.Vo, 'V') + '，误差 ' + ((S.Vpre / P.Vo - 1) * 100).toFixed(2) + '%');
    kp('加载跌落 ΔV', PS.fmt(S.up.dv, 'V'), (S.pred ? '小信号预测 ' + PS.fmt(pmin, 'V') : '') + '（周期平均）');
    kp('加载恢复时间', S.up.settled ? PS.fmt(S.up.ts, 's') : '未恢复', '进入 ±' + P.tol + '% Vo 带');
    kp('卸载过冲 ΔV', PS.fmt(S.down.dv, 'V'), S.pred ? '小信号预测 ' + PS.fmt(pmax, 'V') : '');
    kp('卸载恢复时间', S.down.settled ? PS.fmt(S.down.ts, 's') : '未恢复', '');
    kp('平均开关频率', PS.fmt(S.fsw, 'Hz'), P.mode === 'coti' || P.mode === 'cotr' ? 'COT 频率随工况变化' : '');
    $('step-kpis').innerHTML = k.join(''); PS.annotate($('step-kpis'));
    const m = [];
    if (!S.pred) m.push('<div class="msg w"><span class="ic">!</span><span>环路不稳定或无法预测，仅显示开关级仿真结果</span></div>');
    R.info.filter(s => s.indexOf('大信号') >= 0).forEach(s => m.push(`<div class="msg i"><span class="ic">i</span><span>${PS.esc(s)}</span></div>`));
    m.push(`<div class="msg i"><span class="ic">i</span><span>负载 ${PS.fmt(S.I1, 'A')} → ${PS.fmt(S.I2, 'A')}（t = 0），${PS.fmt(S.T2 - S.T1, 's')} 后恢复。仿真步长 Ts/200，同步整流（强制 CCM）。</span></div>`);
    $('step-msgs').innerHTML = m.join(''); PS.annotate($('step-msgs'));
    const sh = t => t.map(x => x - S.T1);
    const sv = [{ name: '开关仿真 vo（含纹波）', color: PS.css('--axis'), width: 1, x: sh(S.rec.t), y: S.rec.vo },
      { name: '仿真 · 周期平均', color: col(1), width: 2.5, x: sh(S.av.t), y: S.av.v }];
    if (S.pred) sv.push({ name: '小信号预测', color: col(2), dash: true, width: 2, x: sh(S.pred.t), y: S.pred.v });
    const si = [{ name: 'iL', color: col(3), width: 1.2, x: sh(S.rec.t), y: S.rec.iL }];
    if (!UI.stepPlot) UI.stepPlot = new PS.Plot($('step-plot'), {});
    UI.stepPlot.set({ xLog: false, xUnit: 's', height: 520, xRange: [-0.1 * (S.T2 - S.T1), S.TE - S.T1],
      vlines: [{ x: 0 }, { x: S.T2 - S.T1 }],
      panels: [{ label: '输出电压 (V)', unit: 'V', series: sv, hlines: [{ y: P.Vo * (1 + P.tol / 100), dash: true }, { y: P.Vo * (1 - P.tol / 100), dash: true }], fmtTip: v => v.toFixed(4) },
        { label: '电感电流 (A)', unit: 'A', series: si, fmtTip: v => v.toFixed(3) }] });
  }, 30);
};

// ---------- 导出 ----------
UI.EXPORTS = [
  ['json', '设计参数 JSON', () => JSON.stringify(Object.assign({ _tool: 'loop-comp-designer', _ver: 1 }, UI.P), null, 2), 'design.json'],
  ['avg', 'LTspice 平均模型（.ac 环路）', () => PS.netAvg(UI.R), 'loop_avg.cir'],
  ['sw', 'LTspice 开关级瞬态', () => PS.netSw(UI.R), 'loop_switching.cir'],
  ['psim', 'PSIM 参数文件', () => PS.psim(UI.R), 'psim_params.txt'],
  ['c', 'C 代码头文件', () => UI.R.code || '// 当前为模拟实现，补偿器由 RC 网络完成，不需要 C 代码。\n// 在左侧“控制方式”中选择“数字”即可生成定点 2P2Z/3P3Z C 代码。\n', 'compensator.h'],
];
UI.renderExport = function () {
  UI.stale.exp = false;
  const box = $('exp-btns');
  if (!box.childElementCount) {
    UI.EXPORTS.forEach(([id, label, fn, file]) => {
      const pv = document.createElement('button'); pv.type = 'button'; pv.className = 'btn'; pv.textContent = '预览 ' + label;
      pv.onclick = () => { UI.expSel = id; UI.renderExport(); };
      const sv = document.createElement('button'); sv.type = 'button'; sv.className = 'btn pri'; sv.textContent = '保存';
      sv.onclick = () => { try { UI.save(file, fn()); } catch (e) { UI.toast('导出失败：' + e.message); } };
      const g = document.createElement('span'); g.className = 'row'; g.style.marginRight = '14px'; g.append(pv, sv); box.appendChild(g);
    });
    const ld = document.createElement('button'); ld.type = 'button'; ld.className = 'btn'; ld.textContent = '载入 JSON…';
    ld.onclick = () => $('file-in').click(); box.appendChild(ld);
    const pg = document.createElement('button'); pg.type = 'button'; pg.className = 'btn'; pg.textContent = '保存 Bode PNG';
    pg.onclick = () => UI.savePng(UI.bode, 'bode.png'); box.appendChild(pg);
    PS.annotate(box);
  }
  const e = UI.EXPORTS.find(x => x[0] === (UI.expSel || 'avg'));
  $('exp-title').textContent = '预览：' + e[1] + '（' + e[3] + '）';
  try { $('exp-pre').textContent = UI.R && !UI.R.fatal ? e[2]() : '当前设计无效'; } catch (err) { $('exp-pre').textContent = '生成失败：' + err.message; }
};

UI.renderGloss = function () {
  if ($('gloss').childElementCount) return;
  $('gloss').innerHTML = '<table class="tb"><tr><th>缩写 / 术语</th><th style="text-align:left">含义</th></tr>' + PS.GLOSS.map(([k, v]) => `<tr><td><b>${PS.esc(k)}</b></td><td style="text-align:left;white-space:normal">${PS.esc(v)}</td></tr>`).join('') + '</table>';
};
})(typeof window !== 'undefined' ? window : globalThis);
