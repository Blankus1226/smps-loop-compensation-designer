/* 左侧参数表单：由描述表生成，值以 SI 单位存于 UI.P */
(function (G) {
'use strict';
const PS = G.PS, UI = PS.UI = { P: PS.preset(0) };
const dig = P => P.impl === 'digital', isCot = P => P.mode === 'coti' || P.mode === 'cotr';
const notDigCot = P => !isCot(P);
const E_OPTS = [['6', 'E6（±20%）'], ['12', 'E12（±10%）'], ['24', 'E24（±5%）'], ['48', 'E48（±2%）'], ['96', 'E96（±1%）'], ['192', 'E192（±0.5%）']];
// 字段：k 键，l 标签，u 单位，sc 显示比例（显示值 = 存储值 / sc），show 可见条件
UI.GROUPS = [
  { t: '拓扑与工况', open: true, f: [
    { k: 'topo', type: 'seg', opts: [['buck', 'Buck'], ['boost', 'Boost'], ['buckboost', 'Buck-Boost']] },
    { k: 'Vin', l: '输入电压 Vin（标称）', u: 'V' }, { k: 'VinMin', l: 'Vin 最小', u: 'V' }, { k: 'VinMax', l: 'Vin 最大', u: 'V' },
    { k: 'Vo', l: '输出电压 |Vo|', u: 'V' }, { k: 'Io', l: '负载电流 Io（标称）', u: 'A' }, { k: 'IoMin', l: 'Io 最小', u: 'A' }, { k: 'IoMax', l: 'Io 最大', u: 'A' }] },
  { t: '功率级', open: true, f: [
    { k: 'fs', l: '开关频率 fs', u: 'Hz' }, { k: 'L', l: '电感 L', u: 'H' }, { k: 'RL', l: '电感 DCR', u: 'Ω' },
    { k: 'C', l: '输出电容 C', u: 'F' }, { k: 'Rc', l: '电容 ESR', u: 'Ω' }, { k: 'Ron', l: 'MOSFET Rds(on)', u: 'Ω' },
    { k: 'Dmax', l: '最大占空比', u: '', plain: true }] },
  { t: '控制方式', open: true, f: [
    { k: 'mode', type: 'seg', opts: [['vmc', 'VMC'], ['pcmc', 'PCMC'], ['acm', 'ACM'], ['coti', '电流型 COT'], ['cotr', '纹波型 COT']] },
    { k: 'impl', type: 'seg', opts: [['analog', '模拟'], ['digital', '数字']], show: notDigCot },
    { k: 'family', type: 'seg', opts: [['opamp', '运放 EA'], ['ota', 'OTA (gm)']], show: P => !dig(P) },
    { k: 'Vref', l: P => dig(P) ? 'ADC 采样目标电压' : '参考电压 Vref', u: 'V' },
    { k: 'Vm', l: '锯齿波峰峰值 Vm', u: 'V', show: P => (P.mode === 'vmc' && !dig(P)) || (P.mode === 'acm' && !dig(P)) },
    { k: 'Ri', l: '电流采样增益 Ri', u: 'V/A', show: P => P.mode !== 'vmc' && P.mode !== 'cotr' },
    { k: 'seRatio', l: '斜坡补偿 Se/Sf', u: '', plain: true, show: P => P.mode === 'pcmc' },
    { k: 'Vcmax', l: '补偿器输出上限', u: 'V', show: P => !dig(P) }] },
  { t: '补偿器设计', open: true, f: [
    { k: 'compType', type: 'select', l: '补偿器类型', opts: P => [['auto', '自动选择'], ['1', 'Type I（积分）'], ['2', 'Type II'], ['3', 'Type III']].concat(P.mode === 'cotr' ? [['none', '无误差放大器']] : []) },
    { k: 'method', type: 'select', l: '设计方法', opts: [['kfactor', 'K 因子法（Venable）'], ['classic', '经典放置（双零点在 f0）']], show: P => P.mode === 'vmc' && !dig(P) && P.family === 'opamp' },
    { k: 'fcAuto', type: 'check', l: '自动推荐 fc' },
    { k: 'fc', l: '目标穿越频率 fc', u: 'Hz', show: P => !P.fcAuto },
    { k: 'pm', l: '目标相位裕度 PM', u: '°', plain: true },
    { k: 'R1', l: '上分压电阻 R1', u: 'Ω', show: P => !dig(P) && P.family === 'opamp' },
    { k: 'gm', l: 'OTA 跨导 gm', u: 'S', show: P => !dig(P) && P.family === 'ota' },
    { k: 'RbOta', l: '下分压电阻 Rb', u: 'Ω', show: P => !dig(P) && P.family === 'ota' },
    { k: 'roundE', type: 'check', l: '元件圆整到 E 系列', show: P => !dig(P) },
    { k: 'eR', type: 'select', l: '电阻系列', opts: E_OPTS, num: true, show: P => !dig(P) && P.roundE },
    { k: 'eC', type: 'select', l: '电容系列', opts: E_OPTS, num: true, show: P => !dig(P) && P.roundE }] },
  { t: '电流内环（ACM）', open: true, show: P => P.mode === 'acm', f: [
    { k: 'fciAuto', type: 'check', l: '自动推荐 fci' }, { k: 'fci', l: '内环穿越频率 fci', u: 'Hz', show: P => !P.fciAuto },
    { k: 'pmi', l: '内环目标 PM', u: '°', plain: true }, { k: 'Rci', l: '内环输入电阻', u: 'Ω', show: P => !dig(P) }] },
  { t: '数字链路', open: true, show: dig, f: [
    { k: 'adcBits', l: 'ADC 位数', u: 'bit', plain: true }, { k: 'adcFs', l: 'ADC 满量程', u: 'V' },
    { k: 'fclk', l: 'PWM 定时器时钟', u: 'Hz' }, { k: 'tcRatio', l: '采样→装载延时 tc / Ts', u: '', plain: true },
    { k: 'dacBits', l: 'DAC 位数', u: 'bit', plain: true, show: P => P.mode === 'pcmc' }, { k: 'dacFs', l: 'DAC 满量程', u: 'V', show: P => P.mode === 'pcmc' },
    { k: 'disc', type: 'select', l: '离散化方法', opts: [['tustin', 'Tustin（fc 处预畸变）'], ['mpz', '零极点匹配 MPZ']] }] },
  { t: '负载阶跃', open: false, f: [
    { k: 'stepFrom', l: '阶跃起点（% Io）', u: '%', sc: 0.01, plain: true }, { k: 'stepTo', l: '阶跃终点（% Io）', u: '%', sc: 0.01, plain: true },
    { k: 'tol', l: '恢复时间容差带', u: '% Vo', plain: true }] },
];

const disp = (f, v) => {
  if (typeof v !== 'number') return v;
  const x = v / (f.sc || 1);
  return f.plain ? String(+x.toPrecision(5)) : PS.fmt(x, '', 4).replace(' ', '');
};
const lab = (f, P) => typeof f.l === 'function' ? f.l(P) : f.l;

UI.buildForm = function () {
  const form = document.getElementById('form'), P = UI.P;
  form.innerHTML = '';
  UI.GROUPS.forEach((g, gi) => {
    const d = document.createElement('details'); d.open = g.open; d.dataset.g = gi;
    d.innerHTML = `<summary>${g.t}</summary>`;
    g.f.forEach(f => {
      const row = document.createElement('div'); row.dataset.k = f.k;
      if (f.type === 'seg') {
        row.className = 'seg'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', f.k);
        f.opts.forEach(([v, t]) => {
          const b = document.createElement('button'); b.type = 'button'; b.innerHTML = t; b.dataset.v = v;
          b.setAttribute('aria-pressed', P[f.k] === v);
          b.onclick = () => { UI.set(f.k, v); };
          row.appendChild(b);
        });
      } else if (f.type === 'check') {
        row.className = 'fr wide';
        row.innerHTML = `<label class="ck"><input type="checkbox" ${P[f.k] ? 'checked' : ''}> ${f.l}</label>`;
        row.querySelector('input').onchange = e => UI.set(f.k, e.target.checked);
      } else if (f.type === 'select') {
        row.className = 'fr';
        const opts = typeof f.opts === 'function' ? f.opts(P) : f.opts, id = 'f-' + f.k;
        row.innerHTML = `<label for="${id}">${f.l}</label><select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(P[f.k]) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
        row.querySelector('select').onchange = e => UI.set(f.k, f.num ? +e.target.value : e.target.value);
      } else {
        row.className = 'fr';
        const id = 'f-' + f.k;
        row.innerHTML = `<label for="${id}">${lab(f, P)}${f.u ? `（${f.u}）` : ''}</label><input id="${id}" inputmode="decimal" value="${disp(f, P[f.k])}">`;
        const inp = row.querySelector('input');
        const commit = live => {
          const v = PS.parseSI(inp.value);   // 支持 4.7u、500k、10kΩ、2.2µF 等写法
          const ok = isFinite(v) && (['stepFrom', 'IoMin', 'tcRatio'].includes(f.k) ? v >= 0 : v > 0);
          inp.classList.toggle('bad', !ok);
          if (!ok) return;
          UI.P[f.k] = v * (f.sc || 1);
          if (!live) inp.value = disp(f, UI.P[f.k]);
          UI.changed(f.k, live);
        };
        inp.addEventListener('input', () => commit(true));
        inp.addEventListener('change', () => commit(false));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(false); });
      }
      d.appendChild(row);
    });
    form.appendChild(d);
  });
  UI.vis(); PS.annotate(form);
};
// 可见性 / 选中态 / 动态标签
UI.vis = function () {
  const P = UI.P;
  document.querySelectorAll('#form details').forEach(d => {
    const g = UI.GROUPS[+d.dataset.g]; d.hidden = g.show ? !g.show(P) : false;
    g.f.forEach(f => {
      const row = d.querySelector(`[data-k="${f.k}"]`); if (!row) return;
      row.hidden = f.show ? !f.show(P) : false;
      if (f.type === 'seg') row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(P[f.k]) === b.dataset.v));
    });
  });
};
UI.set = function (k, v) {
  UI.P[k] = v;
  const rebuild = ['mode', 'impl', 'topo', 'family'].includes(k);
  if (k === 'mode' && v === 'cotr' && UI.P.topo !== 'buck') UI.P.topo = 'buck';
  if (k === 'topo' && v !== 'buck' && UI.P.mode === 'cotr') UI.P.mode = 'coti';
  if (k === 'mode' && (v === 'coti' || v === 'cotr')) UI.P.impl = 'analog';
  if (k === 'mode' && v !== 'cotr' && UI.P.compType === 'none') UI.P.compType = 'auto';
  if (rebuild) { UI.P.manual = false; UI.buildForm(); } else UI.vis();
  UI.changed(k, false);
};
UI.changed = function (k, live) {
  UI.dirty = true;
  if (live) UI.renderSoon(); else UI.render();
};
})(typeof window !== 'undefined' ? window : globalThis);
