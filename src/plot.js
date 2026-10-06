/* 轻量 Canvas 图表：多面板共享 x 轴（Bode = 幅值+相位，对数 x；时域 = 线性 x）
   cfg = { xLog, xUnit, height, panels:[{ unit, label, yFix:[lo,hi], step, series:[{name,color,dash,width,x,y}], hlines:[{y,label,strong}], arrows:[{x,y0,y1,label}] }], vlines:[{x,label}] } */
(function (G) {
'use strict';
const PS = G.PS;

function niceStep(span, n) {
  const raw = span / Math.max(1, n), e = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e;
}
PS.css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

PS.Plot = function (host, cfg) {
  this.host = host; this.cfg = cfg || {}; this.hidden = new Set(); this.hoverX = null;
  host.classList.add('plot');
  host.innerHTML = '<div class="plot-legend"></div><div class="plot-wrap"><canvas></canvas><div class="plot-tip" hidden></div></div>';
  this.leg = host.querySelector('.plot-legend'); this.cv = host.querySelector('canvas'); this.tip = host.querySelector('.plot-tip');
  this.buf = document.createElement('canvas');
  this.cv.addEventListener('mousemove', e => this.hover(e));
  this.cv.addEventListener('mouseleave', () => { this.hoverX = null; this.tip.hidden = true; this.blit(); });
  if (G.ResizeObserver) new ResizeObserver(() => this.render()).observe(host);
};
const PR = PS.Plot.prototype;

PR.set = function (cfg) { this.cfg = Object.assign({}, this.cfg, cfg); this.legend(); this.render(); };

PR.legend = function () {
  const names = new Map();
  (this.cfg.panels || []).forEach(p => p.series.forEach(s => { if (!names.has(s.name) && !s.noLegend) names.set(s.name, s); }));
  this.leg.innerHTML = '';
  names.forEach((s, nm) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'leg-item' + (this.hidden.has(nm) ? ' off' : '');
    b.setAttribute('aria-pressed', !this.hidden.has(nm));
    b.innerHTML = `<svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke="${s.color}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="4 3"' : ''} stroke-linecap="round"/></svg><span>${s.label || PS.esc(nm)}</span>`;
    b.onclick = () => { this.hidden.has(nm) ? this.hidden.delete(nm) : this.hidden.add(nm); this.legend(); this.render(); };
    this.leg.appendChild(b);
  });
  if (G.PS.annotate) G.PS.annotate(this.leg);
};

// 计算布局与坐标映射
PR.layout = function (W, Hh) {
  const c = this.cfg, np = c.panels.length, mL = 58, mR = 14, mT = 10, mB = 30, gap = 18;
  const ph = (Hh - mT - mB - gap * (np - 1)) / np;
  let x0 = c.xRange ? c.xRange[0] : Infinity, x1 = c.xRange ? c.xRange[1] : -Infinity;
  if (!c.xRange) c.panels.forEach(p => p.series.forEach(s => { if (s.x.length) { x0 = Math.min(x0, s.x[0]); x1 = Math.max(x1, s.x[s.x.length - 1]); } }));
  if (!(x1 > x0)) { x0 = c.xLog ? 10 : 0; x1 = c.xLog ? 1e6 : 1; }
  const lx0 = c.xLog ? Math.log10(x0) : x0, lx1 = c.xLog ? Math.log10(x1) : x1;
  const X = v => mL + ((c.xLog ? Math.log10(v) : v) - lx0) / (lx1 - lx0) * (W - mL - mR);
  const Xi = px => { const u = lx0 + (px - mL) / (W - mL - mR) * (lx1 - lx0); return c.xLog ? Math.pow(10, u) : u; };
  const panels = c.panels.map((p, i) => {
    const top = mT + i * (ph + gap);
    let lo = Infinity, hi = -Infinity;
    if (p.yFix) { lo = p.yFix[0]; hi = p.yFix[1]; }
    else {
      p.series.forEach(s => { if (this.hidden.has(s.name)) return; for (let k = 0; k < s.x.length; k++) { const y = s.y[k]; if (s.x[k] >= x0 && s.x[k] <= x1 && isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; } } });
      (p.hlines || []).forEach(h => { if (h.inRange) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); } });
      if (!(hi >= lo)) { lo = -1; hi = 1; }
      if (p.clamp) { lo = Math.max(lo, p.clamp[0]); hi = Math.min(hi, p.clamp[1]); if (hi - lo > p.clamp[2]) lo = hi - p.clamp[2]; }
      if (hi - lo < (p.minSpan || 1e-12)) { const m = (hi + lo) / 2; lo = m - (p.minSpan || 1e-12) / 2; hi = m + (p.minSpan || 1e-12) / 2; }
      const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    }
    const step = p.step ? (Math.ceil((hi - lo) / p.step / 6) * p.step) : niceStep(hi - lo, 5);
    if (!p.yFix) { lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; }
    const Y = v => top + (hi - v) / (hi - lo) * ph;
    return { p, top, h: ph, lo, hi, step, Y };
  });
  return { W, H: Hh, mL, mR, mT, mB, x0, x1, X, Xi, panels };
};

PR.render = function () {
  if (!this.cfg.panels) return;
  const dpr = G.devicePixelRatio || 1, W = Math.max(280, this.host.clientWidth), H = this.cfg.height || 420;
  for (const c of [this.cv, this.buf]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
  const ctx = this.buf.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.L = this.draw(ctx, W, H);
  this.blit();
};

PR.draw = function (ctx, W, H) {
  const L = this.layout(W, H), c = this.cfg;
  const col = { bg: PS.css('--surface-1') || '#fff', ink: PS.css('--text-primary'), ink2: PS.css('--text-secondary'), mut: PS.css('--muted'), grid: PS.css('--grid'), axis: PS.css('--axis') };
  ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
  ctx.font = '11px system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
  const xr = [L.mL, W - L.mR];
  // x 网格
  const xt = [];
  if (c.xLog) {
    for (let d = Math.floor(Math.log10(L.x0)); d <= Math.ceil(Math.log10(L.x1)); d++) for (let k = 1; k < 10; k++) { const v = k * Math.pow(10, d); if (v >= L.x0 * 0.999 && v <= L.x1 * 1.001) xt.push({ v, major: k === 1 }); }
  } else { const st = niceStep(L.x1 - L.x0, 8); for (let v = Math.ceil(L.x0 / st) * st; v <= L.x1 + st * 1e-6; v += st) xt.push({ v, major: true }); }
  L.panels.forEach((pp, i) => {
    const p = pp.p, last = i === L.panels.length - 1;
    ctx.save(); ctx.beginPath(); ctx.rect(xr[0], pp.top, xr[1] - xr[0], pp.h); ctx.clip();
    ctx.lineWidth = 1;
    xt.forEach(t => { ctx.strokeStyle = col.grid; ctx.globalAlpha = t.major ? 1 : 0.45; const x = Math.round(L.X(t.v)) + 0.5; ctx.beginPath(); ctx.moveTo(x, pp.top); ctx.lineTo(x, pp.top + pp.h); ctx.stroke(); });
    ctx.globalAlpha = 1;
    for (let v = pp.lo; v <= pp.hi + pp.step * 1e-6; v += pp.step) { const y = Math.round(pp.Y(v)) + 0.5; ctx.strokeStyle = col.grid; ctx.beginPath(); ctx.moveTo(xr[0], y); ctx.lineTo(xr[1], y); ctx.stroke(); }
    (p.hlines || []).forEach(h => { const y = Math.round(pp.Y(h.y)) + 0.5; ctx.strokeStyle = col.axis; ctx.lineWidth = h.strong ? 1.5 : 1; ctx.setLineDash(h.dash ? [4, 4] : []); ctx.beginPath(); ctx.moveTo(xr[0], y); ctx.lineTo(xr[1], y); ctx.stroke(); ctx.setLineDash([]); });
    let nl = 0;
    (c.vlines || []).forEach(v => {
      if (!(v.x > L.x0 && v.x < L.x1)) return;
      const x = Math.round(L.X(v.x)) + 0.5; ctx.strokeStyle = v.color || col.mut; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, pp.top); ctx.lineTo(x, pp.top + pp.h); ctx.stroke(); ctx.setLineDash([]);
      // 标签只画在第一个面板顶部，交错两行避免重叠
      if (v.label && i === 0) { ctx.fillStyle = col.ink2; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(v.label, x + 3, pp.top + 3 + (nl++ % 2) * 13); }
    });
    // 数据
    p.series.forEach(s => {
      if (this.hidden.has(s.name)) return;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash ? [6, 4] : []); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalAlpha = s.alpha || 1;
      if (s.dots) {   // 离散点（采样点）
        ctx.fillStyle = s.color;
        for (let k = 0; k < s.x.length; k++) { const xv = s.x[k], yv = s.y[k]; if (!isFinite(yv) || xv < L.x0 || xv > L.x1) continue; ctx.beginPath(); ctx.arc(L.X(xv), pp.Y(yv), 3.5, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1; return;
      }
      ctx.beginPath(); let pen = false;
      for (let k = 0; k < s.x.length; k++) {
        const xv = s.x[k], yv = s.y[k];
        if (!isFinite(yv) || xv < L.x0 || xv > L.x1) { pen = false; continue; }
        const X = L.X(xv), Y = pp.Y(yv);
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
    // 裕度箭头
    (p.arrows || []).forEach(a => {
      if (!(a.x > L.x0 && a.x < L.x1)) return;
      const x = L.X(a.x), y0 = pp.Y(a.y0), y1 = pp.Y(a.y1);
      ctx.strokeStyle = col.ink; ctx.fillStyle = col.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      const d = y1 > y0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x - 4, y1 - 6 * d); ctx.lineTo(x + 4, y1 - 6 * d); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y0, 3, 0, 7); ctx.fill();
      ctx.font = '600 11px system-ui,"Microsoft YaHei",sans-serif'; ctx.textAlign = x > W - 140 ? 'right' : 'left';
      ctx.fillText(a.label, x + (x > W - 140 ? -8 : 8), (y0 + y1) / 2 + 4); ctx.font = '11px system-ui,"Microsoft YaHei",sans-serif';
    });
    ctx.restore();
    // 轴与刻度
    ctx.strokeStyle = col.axis; ctx.lineWidth = 1; ctx.strokeRect(xr[0] + 0.5, pp.top + 0.5, xr[1] - xr[0] - 1, pp.h - 1);
    ctx.fillStyle = col.mut; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const fmtY = p.fmtY || (v => p.unitSI ? PS.fmt(v, '', 3) : (+v.toFixed(Math.max(0, -Math.floor(Math.log10(pp.step) + 1e-9)))).toString());
    for (let v = pp.lo; v <= pp.hi + pp.step * 1e-6; v += pp.step) ctx.fillText(fmtY(v), xr[0] - 6, pp.Y(v));
    ctx.save(); ctx.translate(13, pp.top + pp.h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = col.ink2; ctx.fillText(p.label || '', 0, 0); ctx.restore();
    if (last) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = col.mut;
      xt.forEach(t => { if (t.major) ctx.fillText(PS.fmt(t.v, c.xUnit || '', 3).replace(' ', ''), L.X(t.v), pp.top + pp.h + 6); });
    }
  });
  return L;
};

})(typeof window !== 'undefined' ? window : globalThis);
