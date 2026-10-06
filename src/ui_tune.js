/* 手动微调滑杆 + 数字实现卡片 */
(function (G) {
'use strict';
const PS = G.PS, UI = PS.UI, TAU = 2 * Math.PI;
const $ = id => document.getElementById(id);

UI.renderTune = function (R) {
  const P = UI.P, box = $('tune'), on = $('tune-on');
  on.checked = !!P.manual;
  on.onchange = () => {
    if (on.checked && UI.R && UI.R.kd) {
      const cp = UI.R.kd.cp, z = cp.z.map(w => w / TAU), p = cp.p.map(w => w / TAU);
      P.manual = true; P.fcAuto = false; P.fc = isFinite(UI.R.mg.fc) ? PS.nice(UI.R.mg.fc) : UI.R.fcTarget;
      P.m = { type: cp.type, fz1: z[0] || P.fc / 3, fp1: p[0] || P.fc * 3, fz2: z[1] || P.fc / 3, fp2: p[1] || P.fc * 3 };
    } else P.manual = false;
    UI.tuneKey = null; UI.buildForm(); UI.render();
  };
  if (R.fatal || R.noLoop) { box.innerHTML = '<p class="hint">当前模式没有可调的外环补偿器。</p>'; UI.tuneKey = null; return; }
  if (!P.manual) {
    box.innerHTML = '<p class="hint">勾选“启用”后，以当前自动设计结果为起点，拖动滑杆调整 fc 与各零点/极点，Bode 图、裕度和元件值实时刷新。' + (P.mode === 'acm' ? '（ACM 只微调电压外环，电流内环保持自动设计）' : '') + '</p>';
    UI.tuneKey = null; return;
  }
  const ota3 = P.family === 'ota' && P.impl !== 'digital';
  const key = [P.m.type, P.family, P.impl, P.fs].join('|');
  const lo = R.fmin, hi = P.fs * 2;
  const items = [['fc', '穿越频率 fc', P.fs / 2000, P.fs / 2]];
  if (P.m.type >= 2) items.push(['fz1', '零点 fz1', lo, hi], ['fp1', '极点 fp1', lo, hi]);
  if (P.m.type >= 3) { items.push(['fz2', ota3 ? 'Cff 零点 fz2' : '零点 fz2', lo, hi]); if (!ota3) items.push(['fp2', '极点 fp2', lo, hi]); }
  const get = k => k === 'fc' ? P.fc : P.m[k], put = (k, v) => { if (k === 'fc') P.fc = v; else P.m[k] = v; };
  if (UI.tuneKey !== key) {
    UI.tuneKey = key;
    const h = [`<div class="fr"><label for="tune-type">补偿器类型</label><select id="tune-type">${[1, 2, 3].map(t => `<option value="${t}" ${+P.m.type === t ? 'selected' : ''}>Type ${['I', 'II', 'III'][t - 1]}</option>`).join('')}</select></div>`];
    items.forEach(([k, l, a, b]) => h.push(`<div class="sl"><label for="tn-${k}">${l}</label><input type="range" id="tn-${k}" min="0" max="1000" data-a="${a}" data-b="${b}"><output id="to-${k}"></output></div>`));
    if (ota3) h.push('<p class="hint">OTA Type III 的 Cff 对极点由分压比决定：fp2 = fz2·Vo/Vref，不能单独调。</p>');
    h.push('<p class="hint">零点应低于与之配对的极点（fz1 < fp1、fz2 < fp2），否则元件值会出现负数。</p>');
    box.innerHTML = h.join('');
    $('tune-type').onchange = e => { P.m.type = +e.target.value; UI.render(); };
    items.forEach(([k]) => {
      const s = $('tn-' + k), a = +s.dataset.a, b = +s.dataset.b;
      s.oninput = () => { put(k, Math.pow(10, Math.log10(a) + s.value / 1000 * (Math.log10(b) - Math.log10(a)))); UI.render(); };
    });
    PS.annotate(box);
  }
  items.forEach(([k]) => {
    const s = $('tn-' + k); if (!s) return;
    const a = +s.dataset.a, b = +s.dataset.b, v = get(k);
    if (document.activeElement !== s) s.value = Math.round((Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) * 1000);
    $('to-' + k).textContent = PS.fmt(v, 'Hz', 3);
  });
};

UI.renderDig = function (R) {
  const P = R.P, card = $('card-dig');
  card.hidden = !(P.impl === 'digital' && !R.fatal && R.qz);
  if (card.hidden) return;
  const dg = R.ctx.dig, h = [];
  h.push('<div class="kpis">',
    `<div class="kpi"><div class="k">PWM 周期计数 N</div><div class="v">${dg.Npwm}</div><div class="s">分辨率 ${(100 / dg.Npwm).toFixed(3)}%</div></div>`,
    `<div class="kpi"><div class="k">ADC 增益</div><div class="v">${dg.Kadc.toFixed(1)}</div><div class="s">码/V；Vo 的 1 LSB = ${PS.fmt(R.res.dvAdc, 'V')}</div></div>`,
    P.mode === 'pcmc'
      ? `<div class="kpi"><div class="k">DAC 1 LSB → 峰值电流</div><div class="v">${PS.fmt(dg.Kdac / P.Ri, 'A')}</div><div class="s">${PS.fmt(dg.Kdac, 'V')} / Ri</div></div>`
      : `<div class="kpi"><div class="k">DPWM 1 LSB → Vo</div><div class="v">${PS.fmt(R.res.dvPwm, 'V')}</div><div class="s">${R.res.dvPwm > R.res.dvAdc ? '<span class="st bad">粗于 ADC</span>' : '<span class="st good">细于 ADC</span>'}</div></div>`,
    `<div class="kpi"><div class="k">总延时 Td</div><div class="v">${PS.fmt(dg.Td, 's')}</div><div class="s">${(dg.Td * P.fs).toFixed(2)} Ts</div></div>`, '</div>');
  const tab = (title, dc, qz) => {
    h.push(`<h3>${title}：u[n] = Σ b<sub>i</sub>·e[n−i] − Σ a<sub>i</sub>·u[n−i]，系数 Q${qz.Q}</h3><table class="tb"><tr><th>i</th><th>b 浮点</th><th>b 定点整数</th><th>b 相对误差</th><th>a 浮点</th><th>a 定点整数</th></tr>`);
    dc.b.forEach((b, i) => h.push(`<tr><td>${i}</td><td>${b.toPrecision(8)}</td><td>${qz.bq[i]}</td><td>${(qz.err[i] * 100).toExponential(1)}%</td><td>${dc.a[i].toPrecision(8)}</td><td>${qz.aq[i]}</td></tr>`));
    h.push('</table>');
  };
  tab('电压外环', R.dc, R.qz);
  if (R.inner && R.inner.qz) tab('电流内环', R.inner.dc, R.inner.qz);
  h.push('<p class="hint">Σa 被强制为 0，量化后积分极点仍精确落在 z = 1，不会出现静差。Bode 图中补偿器实线为量化后的定点系数，虚线为 s 域原型。</p>');
  h.push(`<h3>C 代码（int32 系数、int64 累加、输出限幅抗饱和）</h3><pre class="code no-t" id="ccode">${PS.esc(R.code)}</pre>`);
  $('dig').innerHTML = h.join('');
  PS.annotate($('dig'));
  $('copy-c').onclick = () => UI.copy(R.code);
};
})(typeof window !== 'undefined' ? window : globalThis);
