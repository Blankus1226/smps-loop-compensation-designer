/* 图表交互：缓存贴图、十字线悬停读数、PNG 导出 */
(function (G) {
'use strict';
const PS = G.PS, PR = PS.Plot.prototype;

PR.blit = function () {
  const ctx = this.cv.getContext('2d'), dpr = G.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.buf, 0, 0);
  if (this.hoverX === null || !this.L) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = this.L, x = L.X(this.hoverX);
  ctx.strokeStyle = PS.css('--text-secondary'); ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(x, L.mT); ctx.lineTo(x, L.H - L.mB); ctx.stroke(); ctx.setLineDash([]);
  const bg = PS.css('--surface-1');
  L.panels.forEach(pp => pp.p.series.forEach(s => {
    if (this.hidden.has(s.name) || s.noHover) return;
    const y = interp(s, this.hoverX); if (!isFinite(y) || y < pp.lo || y > pp.hi) return;
    ctx.fillStyle = s.color; ctx.strokeStyle = bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, pp.Y(y), 4, 0, 7); ctx.fill(); ctx.stroke();
  }));
};
function interp(s, x) {
  const X = s.x; if (!X.length || x < X[0] || x > X[X.length - 1]) return NaN;
  let lo = 0, hi = X.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; }
  const t = (x - X[lo]) / ((X[hi] - X[lo]) || 1);
  return s.y[lo] + (s.y[hi] - s.y[lo]) * t;
}
PS.interp = interp;

PR.hover = function (e) {
  if (!this.L) return;
  const r = this.cv.getBoundingClientRect(), px = e.clientX - r.left, L = this.L;
  if (px < L.mL || px > L.W - L.mR) { this.hoverX = null; this.tip.hidden = true; this.blit(); return; }
  this.hoverX = L.Xi(px); this.blit();
  const rows = [], c = this.cfg;
  L.panels.forEach(pp => pp.p.series.forEach(s => {
    if (this.hidden.has(s.name) || s.noHover) return;
    const y = interp(s, this.hoverX); if (!isFinite(y)) return;
    rows.push(`<div class="tip-row"><i style="background:${s.color}"></i><span>${PS.esc(s.name)}${pp.p.tipTag ? ' ' + pp.p.tipTag : ''}</span><b>${(pp.p.fmtTip || (v => v.toFixed(2)))(y)}${pp.p.unit ? ' ' + pp.p.unit : ''}</b></div>`);
  }));
  this.tip.innerHTML = `<div class="tip-h">${PS.fmt(this.hoverX, c.xUnit || '', 4)}</div>` + rows.join('');
  this.tip.hidden = !rows.length;
  const tw = this.tip.offsetWidth;
  this.tip.style.left = (px + 14 + tw > L.W ? px - 14 - tw : px + 14) + 'px';
  this.tip.style.top = Math.max(4, e.clientY - r.top - 20) + 'px';
};

// 导出 PNG：标题 + 图例 + 图表（2× 分辨率）
PR.png = function (title) {
  const W = Math.max(800, this.host.clientWidth), Hc = this.cfg.height || 420, s = 2, legH = 26, tH = title ? 30 : 0;
  const cv = document.createElement('canvas'); cv.width = W * s; cv.height = (Hc + legH + tH + 8) * s;
  const ctx = cv.getContext('2d'); ctx.scale(s, s);
  ctx.fillStyle = PS.css('--surface-1'); ctx.fillRect(0, 0, W, Hc + legH + tH + 8);
  ctx.fillStyle = PS.css('--text-primary');
  if (title) { ctx.font = '600 15px system-ui,"Microsoft YaHei",sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(title, 14, 16); }
  ctx.font = '12px system-ui,"Microsoft YaHei",sans-serif'; ctx.textBaseline = 'middle';
  let x = 14; const seen = new Set();
  this.cfg.panels.forEach(p => p.series.forEach(sr => {
    if (seen.has(sr.name) || sr.noLegend || this.hidden.has(sr.name)) return; seen.add(sr.name);
    ctx.strokeStyle = sr.color; ctx.lineWidth = 2.5; ctx.setLineDash(sr.dash ? [5, 3] : []);
    ctx.beginPath(); ctx.moveTo(x, tH + 13); ctx.lineTo(x + 20, tH + 13); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = PS.css('--text-secondary'); ctx.fillText(sr.name, x + 26, tH + 13); x += 40 + ctx.measureText(sr.name).width;
  }));
  ctx.save(); ctx.translate(0, tH + legH); this.draw(ctx, W, Hc); ctx.restore();
  return cv.toDataURL('image/png');
};

})(typeof window !== 'undefined' ? window : globalThis);
