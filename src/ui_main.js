/* 入口：标签页、主题、示例、保存（浏览器下载 / exe 原生对话框）、复制、初始化 */
(function (G) {
'use strict';
const PS = G.PS, UI = PS.UI;
const $ = id => document.getElementById(id);

UI.toast = function (s) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = s;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
};
// 桌面版原生接口：Electron（preload 注入 desktopApi）或 pywebview；浏览器中为 null
UI.native = () => G.desktopApi || (G.pywebview && G.pywebview.api) || null;
// 保存文件：exe 走原生“另存为”，浏览器走下载
UI.save = function (name, content, b64) {
  const api = UI.native();
  if (api && api.save_file) {
    api.save_file(name, content, !!b64).then(p => { if (p) UI.toast('已保存：' + p); });
    return;
  }
  let blob;
  if (b64) { const bin = atob(content), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); blob = new Blob([u], { type: 'image/png' }); }
  else blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  UI.toast('已下载：' + name);
};
UI.savePng = function (plot, name) {
  if (!plot) return;
  const P = UI.P, title = PS.TOPOS[P.topo] + ' · ' + PS.MODES[P.mode] + '  Vin=' + PS.fmt(P.Vin, 'V') + ' Vo=' + PS.fmt(P.Vo, 'V') + ' Io=' + PS.fmt(P.Io, 'A') + ' fs=' + PS.fmt(P.fs, 'Hz');
  UI.save(name, plot.png(title).split(',')[1], true);
};
UI.copy = function (txt) {
  const done = () => UI.toast('已复制到剪贴板');
  if (navigator.clipboard && G.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  function fallback() {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { UI.toast('复制失败，请手动选择'); } ta.remove();
  }
};

UI.tab = function (id) {
  document.querySelectorAll('nav.tabs [role=tab]').forEach(b => {
    const on = b.id === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
    $(b.getAttribute('aria-controls')).hidden = !on;
  });
  if (id === 'tb-sweep' && UI.stale.sweep) UI.renderSweep();
  if (id === 'tb-step' && UI.stale.step) UI.runStep();
  if (id === 'tb-export') UI.renderExport();
  if (id === 'tb-learn') PS.Learn.open();
  if (id === 'tb-gloss') UI.renderGloss();
  [UI.bode, UI.gcPlot, UI.sweepPlot, UI.stepPlot].forEach(p => p && p.render());
};

UI.setTheme = function (t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('lcd-theme', t); } catch (e) { /* file:// 下可能不可用 */ }
  [UI.bode, UI.sweepPlot, UI.stepPlot, PS.Learn && PS.Learn.plot].concat(PS.Learn && PS.Learn._ex || []).forEach(p => p && p.render());
  if (UI.R) { UI.renderBode(UI.R); UI.renderGc(UI.R); }
};

UI.load = function (P) {
  UI.P = Object.assign(PS.clone(PS.DEFAULTS), P); UI.tuneKey = null;
  UI.buildForm(); UI.render();
};

UI.init = function () {
  PS.initTips();
  let th = null; try { th = localStorage.getItem('lcd-theme'); } catch (e) { /* 忽略 */ }
  if (!th) th = G.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = th;
  $('btn-theme').onclick = () => UI.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  const sel = $('preset');
  PS.PRESETS.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p.name; sel.appendChild(o); });
  sel.onchange = () => { if (sel.value !== '') { UI.load(PS.preset(+sel.value)); UI.toast('已载入：' + PS.PRESETS[+sel.value].name); } sel.value = ''; };
  const tabs = [...document.querySelectorAll('nav.tabs [role=tab]')];
  tabs.forEach((b, i) => {
    b.onclick = () => UI.tab(b.id);
    b.onkeydown = e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); UI.tab(n.id); } };
  });
  // exe 中 HTML 位于临时目录，数据手册链接改由原生接口打开（找不到本地文件时打开官网）
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'), api = UI.native();
    if (!a || !api || !api.open_datasheet) return;
    if (a.dataset.ds) { e.preventDefault(); const off = a.parentNode.querySelector('a:not([data-ds])'); api.open_datasheet(a.dataset.ds, off ? off.href : '').then(p => UI.toast(p ? '已打开：' + p : '未找到本地数据手册')); }
    else if (/^https:/.test(a.href)) { e.preventDefault(); api.open_datasheet('', a.href); }
  });
  $('png-bode').onclick = () => UI.savePng(UI.bode, 'bode.png');
  $('png-gc').onclick = () => UI.savePng(UI.gcPlot, 'compensator_bode.png');
  $('png-sweep').onclick = () => UI.savePng(UI.sweepPlot, 'sweep.png');
  $('png-step').onclick = () => UI.savePng(UI.stepPlot, 'load_step.png');
  $('run-sim').onclick = () => UI.runStep();
  $('file-in').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const o = JSON.parse(rd.result); delete o._tool; delete o._ver; UI.load(o); UI.toast('已载入 ' + f.name); } catch (err) { UI.toast('JSON 解析失败：' + err.message); } };
    rd.readAsText(f, 'utf-8'); e.target.value = '';
  };
  UI.stale = {};
  UI.buildForm(); UI.render();
  PS.annotate(document.querySelector('main'));
  // 测试/截图钩子：?tab=learn&lesson=type3&preset=2
  const q = new URLSearchParams(location.search);
  if (q.get('preset')) UI.load(PS.preset(+q.get('preset')));
  if (q.get('theme')) UI.setTheme(q.get('theme'));
  if (q.get('lesson')) PS.Learn.cur = q.get('lesson');
  if (q.get('tab')) UI.tab('tb-' + q.get('tab'));
};
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', UI.init);
})(typeof window !== 'undefined' ? window : globalThis);
