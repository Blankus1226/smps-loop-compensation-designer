/* 学习模式框架：目录（分组排序 + 搜索）、讲解、滑杆/下拉、Bode 与附加图、计算过程、作用表、思考题、上一课/下一课
   课程字段：id, group, title, pre:[先修 id], html（核心公式/要点）, talk（原理讲解，字符串或 (v,r)=>字符串）,
     sl:[滑杆 {k,l,a,b,v,log,u,fmt} 或下拉 {k,l,opts:[[值,'名称'],…],v}], calc(v) → { series|cfg|none, info, sch, mg, vlines, extra:[{title,cfg|svg|html}] },
     steps(v,r), roles, mark(v,r), quiz:[[问,答]], refs:[…], html2
   课程内容在 learn_*.js 中注册到 PS.Learn.L */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;
const Learn = PS.Learn = { L: [], cur: 'start', vals: {} };
const $ = id => document.getElementById(id);
Learn.add = (o) => Learn.L.push(o);
// 组内排序：把课程 id 排到 ref 之后
Learn.after = (id, ref) => { const L = Learn.L, i = L.findIndex(x => x.id === ref), l = L.find(x => x.id === id); if (i >= 0 && l) l.ord = (L[i].ord !== undefined ? L[i].ord : i) + 0.01; };
// 分组顺序（目录、上一课/下一课都按这个顺序）
Learn.GROUPS = ['入门', '信号与系统基础', '自动控制原理基础', '开环增益分析方法', '功率级特性', '模拟补偿器', '电流模式补偿', '数字信号处理基础', '数字补偿器', '完整设计实例', '典型控制器芯片'];
Learn.ordered = function () {
  const gi = g => { const i = Learn.GROUPS.indexOf(g); return i < 0 ? 99 : i; };
  // 组内按 ord（缺省为注册顺序）；Learn.after(id, ref) 可把课程排到另一课之后
  const od = (l, i) => l.ord !== undefined ? l.ord : i;
  return Learn.L.map((l, i) => [l, od(l, i)]).sort((a, b) => gi(a[0].group) - gi(b[0].group) || a[1] - b[1]).map(x => x[0]);
};
// 工具：常用传递函数构造
Learn.tf = {
  integ: wi => s => C.div(C.of(wi), s),
  lead: (fz, fp) => s => C.div(C.lin(s, TAU * fz), C.lin(s, TAU * fp)),
  comp: (fi, zs, ps) => s => PS.compEval({ wi: TAU * fi, z: zs.map(f => TAU * f), p: ps.map(f => TAU * f) }, s),
  mul: (...fs) => s => fs.reduce((a, f) => C.mul(a, f(s)), C.ONE),
};
Learn.col = i => PS.css('--s' + i);

Learn.open = function () {
  const toc = $('toc');
  if (!toc.childElementCount) {
    const q = document.createElement('input'); q.type = 'search'; q.className = 'toc-q'; q.placeholder = '搜索课程…'; q.setAttribute('aria-label', '搜索课程');
    toc.appendChild(q);
    let grp = '';
    Learn.ordered().forEach(l => {
      if (l.group !== grp) { grp = l.group; const h = document.createElement('h4'); h.textContent = grp; h.dataset.g = grp; toc.appendChild(h); }
      const b = document.createElement('button'); b.type = 'button'; b.textContent = l.title; b.dataset.id = l.id; b.dataset.g = l.group;
      b.onclick = () => Learn.go(l.id); toc.appendChild(b);
    });
    q.oninput = () => {
      const s = q.value.trim().toLowerCase(), vis = new Set();
      toc.querySelectorAll('button').forEach(b => { const l = Learn.L.find(x => x.id === b.dataset.id), hit = !s || (l.title + ' ' + l.group + ' ' + (l.kw || '')).toLowerCase().includes(s); b.hidden = !hit; if (hit) vis.add(b.dataset.g); });
      toc.querySelectorAll('h4').forEach(h => { h.hidden = !vis.has(h.dataset.g); });
    };
  }
  Learn.show();
};
Learn.go = function (id) { Learn.cur = id; Learn.show(); const box = $('lesson'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'start' }); };
Learn.link = (id, label) => { const l = Learn.L.find(x => x.id === id); return `<a href="#" class="lk" data-go="${id}">${label || (l ? l.title : id)}</a>`; };

Learn.show = function () {
  const list = Learn.ordered(), l = list.find(x => x.id === Learn.cur) || list[0], idx = list.indexOf(l);
  Learn.cur = l.id;
  document.querySelectorAll('#toc button').forEach(b => b.setAttribute('aria-current', b.dataset.id === l.id));
  const v = Learn.vals[l.id] = Learn.vals[l.id] || Object.fromEntries((l.sl || []).map(s => [s.k, s.v]));
  const box = $('lesson'), prev = list[idx - 1], next = list[idx + 1];
  const nav = `<div class="lnav">${prev ? `<button type="button" class="btn" data-go="${prev.id}">← ${prev.title}</button>` : '<span></span>'}${next ? `<button type="button" class="btn" data-go="${next.id}">${next.title} →</button>` : ''}</div>`;
  const pre = (l.pre || []).filter(id => Learn.L.some(x => x.id === id));
  const talk = typeof l.talk === 'function' ? '<div id="ls-talk"></div>' : (l.talk || '');
  box.innerHTML = `<div class="lgrp muted">${l.group}</div><h2>${l.title}</h2>
    ${pre.length ? `<p class="prereq">先修：${pre.map(id => Learn.link(id)).join('、')}</p>` : ''}
    <div class="lesson-intro">${l.html || ''}</div>
    ${talk ? `<h3>原理讲解</h3><div class="talk">${talk}</div>` : ''}
    ${l.sl && l.sl.length || !l.noPlot ? `<div class="two" style="margin-top:10px"><div>${l.sl && l.sl.length ? '<h3>拖动参数</h3>' : ''}<div id="ls-sl"></div><div id="ls-info" class="note" aria-live="polite"></div></div><div id="ls-sch"></div></div>` : ''}
    ${l.noPlot ? '' : `<h3>${l.plotTitle || 'Bode 图'}</h3><div id="ls-plot"></div>`}
    <div id="ls-extra"></div>
    ${l.steps ? '<h3>实际计算过程 <span class="muted" style="font-weight:400">（代入当前参数，随拖动实时更新）</span></h3><div id="ls-steps" class="calc" aria-live="polite"></div>' : ''}
    ${l.roles ? `<h3>${l.rolesTitle || '每个极零点 / 元件的作用'}</h3><div id="ls-roles" class="tbw"></div>` : ''}
    ${l.html2 ? `<div style="margin-top:10px">${l.html2}</div>` : ''}
    ${l.quiz ? `<h3>思考题 <span class="muted" style="font-weight:400">（先自己想，再点开看答案）</span></h3><div class="quiz">${l.quiz.map((x, i) => `<details><summary>${i + 1}. ${x[0]}</summary><div>${x[1]}</div></details>`).join('')}</div>` : ''}
    ${l.refs ? `<h3>参考资料</h3><ul class="refs">${l.refs.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${nav}`;
  box.querySelectorAll('[data-go]').forEach(a => { a.onclick = e => { e.preventDefault(); Learn.go(a.dataset.go); }; });
  Learn._sch = null; Learn._ex = [];
  if (l.mkP) {   // 完整实例：一键带到设计页
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn pri'; b.textContent = '在“设计”页打开这组参数';
    b.onclick = () => { PS.UI.load(l.mkP(Learn.vals[l.id])); PS.UI.tab('tb-design'); PS.UI.toast('已载入：' + l.title); };
    box.querySelector('.lesson-intro').appendChild(b);
  }
  const sl = $('ls-sl');
  (l.sl || []).forEach(s => {
    const d = document.createElement('div'); d.className = 'sl';
    if (s.opts) {   // 下拉选择
      d.innerHTML = `<label for="lsl-${s.k}">${s.l}</label><select id="lsl-${s.k}" class="btn">${s.opts.map(o => `<option value="${o[0]}"${String(o[0]) === String(v[s.k]) ? ' selected' : ''}>${o[1]}</option>`).join('')}</select><output></output>`;
      const se = d.querySelector('select');
      se.onchange = () => { const o = s.opts.find(x => String(x[0]) === se.value); v[s.k] = o ? o[0] : se.value; Learn.update(l, v); };
      sl.appendChild(d); return;
    }
    const toPos = x => s.log ? (Math.log10(x) - Math.log10(s.a)) / (Math.log10(s.b) - Math.log10(s.a)) * 1000 : (x - s.a) / (s.b - s.a) * 1000;
    const fromPos = p => s.log ? Math.pow(10, Math.log10(s.a) + p / 1000 * (Math.log10(s.b) - Math.log10(s.a))) : s.a + p / 1000 * (s.b - s.a);
    const fmt = x => s.fmt ? s.fmt(x) : PS.fmt(x, s.u || '', 3);
    d.innerHTML = `<label for="lsl-${s.k}">${s.l}</label><input type="range" id="lsl-${s.k}" min="0" max="1000" value="${Math.round(toPos(v[s.k]))}"><output>${fmt(v[s.k])}</output>`;
    const inp = d.querySelector('input'), out = d.querySelector('output');
    inp.oninput = () => { v[s.k] = fromPos(+inp.value); out.textContent = fmt(v[s.k]); Learn.update(l, v); };
    sl.appendChild(d);
  });
  Learn.plot = l.noPlot ? null : new PS.Plot($('ls-plot'), {});
  Learn.update(l, v);
  PS.annotate(box);
};

// Bode 配置：series + 裕度箭头 + 竖线
Learn.bodeCfg = function (r) {
  const f = r.f || PS.logspace(r.f0 || 10, r.f1 || 1e7, 500), S = [], Ph = [];
  r.series.forEach(s => { const b = PS.bode(s.fn, f); S.push({ name: s.name, color: s.color, dash: s.dash, width: s.width || 2.5, x: f, y: b.mag }); Ph.push({ name: s.name, color: s.color, dash: s.dash, width: s.width || 2.5, x: f, y: b.ph }); });
  const arM = [], arP = [], vl = (r.vlines || []).filter(x => x && isFinite(typeof x === 'number' ? x : x.x)).map(x => typeof x === 'number' ? { x } : x);
  if (r.mg) {
    const mg = r.mg;
    if (isFinite(mg.fc)) { const pc = PS.interp({ x: mg.f, y: mg.ph }, mg.fc); arP.push({ x: mg.fc, y0: -180 + 360 * Math.round((pc + 180) / 360), y1: pc, label: 'PM ' + mg.pm.toFixed(1) + '°' }); vl.push({ x: mg.fc }); }
    if (isFinite(mg.fgm)) arM.push({ x: mg.fgm, y0: -mg.gm, y1: 0, label: 'GM ' + mg.gm.toFixed(1) + ' dB' });
  }
  return { xLog: true, xUnit: 'Hz', height: r.height || 430, vlines: vl, panels: [
    { label: '幅值 (dB)', unit: 'dB', series: S, hlines: [{ y: 0, strong: true }], arrows: arM, clamp: [-100, 120, 140], step: 20, fmtTip: x => x.toFixed(1) },
    { label: '相位 (°)', unit: '°', series: Ph, hlines: [{ y: r.ph0 === undefined ? -180 : r.ph0, dash: true }], arrows: arP, clamp: [-450, 200, 400], step: 45, fmtTip: x => x.toFixed(1) }] };
};

Learn.update = function (l, v) {
  let r;
  try { r = l.calc ? l.calc(v) : {}; } catch (e) { r = { series: [], info: '计算出错：' + PS.esc(e.message) }; console.error(e); }
  if (l.mark) {   // 带标签的竖线替换同位置的无标签竖线
    const mk = l.mark(v, r).filter(m => isFinite(m.x));
    r.vlines = (r.vlines || []).filter(x => typeof x !== 'number' || !mk.some(m => Math.abs(m.x / x - 1) < 0.01)).concat(mk);
  }
  if ($('ls-info')) { $('ls-info').innerHTML = r.info || ''; $('ls-info').hidden = !r.info; PS.annotate($('ls-info')); }
  if (typeof l.talk === 'function' && $('ls-talk')) { $('ls-talk').innerHTML = l.talk(v, r); PS.annotate($('ls-talk')); }
  if (l.steps && $('ls-steps')) { try { $('ls-steps').innerHTML = Learn.stepsHtml(l.steps(v, r)); } catch (e) { $('ls-steps').textContent = '计算出错：' + e.message; } PS.annotate($('ls-steps')); }
  if (l.roles && $('ls-roles')) { $('ls-roles').innerHTML = Learn.rolesHtml(typeof l.roles === 'function' ? l.roles(v, r) : l.roles); PS.annotate($('ls-roles')); }
  if ($('ls-sch') && r.sch !== undefined && r.sch !== Learn._sch) { $('ls-sch').innerHTML = r.sch; Learn._sch = r.sch; }
  if (Learn.plot) {
    if (r.cfg) Learn.plot.set(r.cfg);
    else if (r.series) Learn.plot.set(Learn.bodeCfg(r));
  }
  // 附加图：数量或类型变化时重建，否则原地刷新（保留图例开关状态）
  const ex = r.extra || [], host = $('ls-extra'), sig = ex.map(e => (e.cfg ? 'p' : e.svg !== undefined ? 's' : 'h') + e.title).join('|');
  if (host && host.dataset.sig !== sig) {
    host.dataset.sig = sig; host.innerHTML = ''; Learn._ex = [];
    ex.forEach((e, i) => {
      const w = document.createElement('div'); w.className = 'lex';
      w.innerHTML = `<h3>${e.title}</h3>${e.note ? `<p class="hint">${e.note}</p>` : ''}<div class="lex-b" id="ls-ex${i}"></div>`;
      host.appendChild(w); Learn._ex.push(e.cfg ? new PS.Plot(w.querySelector('.lex-b'), {}) : null);
    });
  }
  ex.forEach((e, i) => {
    const b = $('ls-ex' + i); if (!b) return;
    if (e.cfg) Learn._ex[i].set(e.cfg); else b.innerHTML = e.svg !== undefined ? e.svg : e.html;
    const n = b.parentNode.querySelector('.hint'); if (n && e.note) n.innerHTML = e.note;
  });
  if (host) PS.annotate(host);
};
// 公式片段 / 注释框 / 要点框
Learn.F = s => `<div class="f">${s}</div>`;
Learn.N = s => `<div class="note">${s}</div>`;
Learn.K = s => `<div class="key"><b>要点</b>${s}</div>`;
})(typeof window !== 'undefined' ? window : globalThis);
