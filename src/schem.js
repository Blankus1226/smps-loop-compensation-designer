/* 补偿器原理图（SVG）：运放 Type I/II/III、OTA Type I/II/III、PI/PID、数字控制框图
   PS.schem(kind, vals) — vals: { R1:'10 kΩ', ... }，缺省只画元件名 */
(function (G) {
'use strict';
const PS = G.PS;

function S(w, h) {
  const o = [];
  const api = {
    w: (pts) => { o.push(`<polyline class="sw" points="${pts.map(p => p.join(',')).join(' ')}"/>`); return api; },
    t: (x, y, s, cls, anc) => { o.push(`<text x="${x}" y="${y}" class="${cls || 'sl'}" text-anchor="${anc || 'middle'}">${s}</text>`); return api; },
    dot: (x, y) => { o.push(`<circle class="sd" cx="${x}" cy="${y}" r="3"/>`); return api; },
    gnd: (x, y) => { o.push(`<path class="sw" d="M${x} ${y}v6M${x - 9} ${y + 6}h18M${x - 6} ${y + 10}h12M${x - 3} ${y + 14}h6"/>`); return api; },
    // 水平电阻 (x1→x2, y)
    rh: (x1, x2, y, nm, v) => {
      const m = (x1 + x2) / 2, a = m - 20, b = m + 20; let d = `M${x1} ${y}H${a}`;
      for (let i = 0; i < 6; i++) d += `L${a + (i + 0.5) * 40 / 6} ${y + (i % 2 ? 6 : -6)}`;
      d += `L${b} ${y}H${x2}`; o.push(`<path class="sw" d="${d}"/>`);
      api.t(m, y - 11, nm, 'sn'); if (v) api.t(m, y + 20, v, 'sv'); return api;
    },
    rv: (x, y1, y2, nm, v, left) => {
      const m = (y1 + y2) / 2, a = m - 18, b = m + 18; let d = `M${x} ${y1}V${a}`;
      for (let i = 0; i < 6; i++) d += `L${x + (i % 2 ? 6 : -6)} ${a + (i + 0.5) * 36 / 6}`;
      d += `L${x} ${b}V${y2}`; o.push(`<path class="sw" d="${d}"/>`);
      api.t(x + (left ? -12 : 12), m - 2, nm, 'sn', left ? 'end' : 'start'); if (v) api.t(x + (left ? -12 : 12), m + 12, v, 'sv', left ? 'end' : 'start'); return api;
    },
    ch: (x1, x2, y, nm, v) => {
      const m = (x1 + x2) / 2;
      o.push(`<path class="sw" d="M${x1} ${y}H${m - 4}M${m + 4} ${y}H${x2}M${m - 4} ${y - 11}V${y + 11}M${m + 4} ${y - 11}V${y + 11}"/>`);
      api.t(m, y - 16, nm, 'sn'); if (v) api.t(m, y + 25, v, 'sv'); return api;
    },
    cv: (x, y1, y2, nm, v, left) => {
      const m = (y1 + y2) / 2;
      o.push(`<path class="sw" d="M${x} ${y1}V${m - 4}M${x} ${m + 4}V${y2}M${x - 11} ${m - 4}H${x + 11}M${x - 11} ${m + 4}H${x + 11}"/>`);
      api.t(x + (left ? -16 : 16), m - 2, nm, 'sn', left ? 'end' : 'start'); if (v) api.t(x + (left ? -16 : 16), m + 12, v, 'sv', left ? 'end' : 'start'); return api;
    },
    amp: (x, y, label) => {          // 三角形，x 为左边缘，y 为中心；输入 y∓14，输出 (x+56,y)
      o.push(`<path class="sa" d="M${x} ${y - 30}L${x + 56} ${y}L${x} ${y + 30}Z"/>`);
      api.t(x + 8, y - 10, '−', 'sp', 'start').t(x + 8, y + 19, '+', 'sp', 'start');
      if (label) api.t(x + 22, y + 4, label, 'sk'); return api;
    },
    box: (x, y, w2, h2, s, s2) => { o.push(`<rect class="sb" x="${x}" y="${y}" width="${w2}" height="${h2}" rx="6"/>`); api.t(x + w2 / 2, y + h2 / 2 + (s2 ? -2 : 4), s, 'sk'); if (s2) api.t(x + w2 / 2, y + h2 / 2 + 13, s2, 'sv'); return api; },
    arr: (x1, y1, x2, y2) => { o.push(`<line class="sw" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`); return api; },
    raw: s => { o.push(s); return api; },
    out: () => `<svg class="schem" viewBox="0 0 ${w} ${h}" role="img" aria-label="补偿器原理图"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="sd"/></marker></defs>${o.join('')}</svg>`,
  };
  return api;
}

PS.schem = function (kind, v) {
  v = v || {}; const g = k => v[k] || '';
  if (kind === 'dig') {
    const s = S(640, 170);
    s.t(18, 54, 'vo', 'sk', 'start').arr(40, 50, 62, 50).box(62, 30, 70, 40, 'H', '分压').arr(132, 50, 152, 50).box(152, 30, 70, 40, 'ADC', g('adc'))
      .arr(222, 50, 248, 50).raw('<circle class="sa" cx="258" cy="50" r="10"/>').t(258, 54, 'Σ', 'sk').t(258, 26, 'VREF_CODE', 'sv').arr(258, 30, 258, 40)
      .arr(268, 50, 290, 50).box(290, 28, 96, 44, 'Gc(z)', g('ord')).arr(386, 50, 406, 50).box(406, 30, 80, 40, 'e^(−sTd)', '延时').arr(486, 50, 506, 50)
      .box(506, 30, 80, 40, g('act') || 'DPWM', g('actv')).arr(586, 50, 612, 50).t(618, 54, 'd', 'sk', 'start')
      .w([[600, 50], [600, 125], [40, 125], [40, 50]]).box(250, 105, 140, 40, '功率级', g('plant') || 'Gvd(s)').t(320, 160, '每个开关周期执行一次（ISR）', 'sv');
    return s.out();
  }
  if (kind.startsWith('ota')) {
    const t = +kind[3], s = S(560, 270), y = 60;
    s.t(16, y + 4, 'vo', 'sk', 'start').w([[34, y], [60, y]]).dot(60, y).rh(60, 170, y, 'Rt', g('Rt'));
    if (t === 3) s.w([[60, y], [60, y - 38], [90, y - 38]]).ch(90, 140, y - 38, 'Cff', g('Cff')).w([[140, y - 38], [170, y - 38], [170, y]]);
    s.dot(170, y).rv(170, y, y + 95, 'Rb', g('Rb'), true).gnd(170, y + 95).w([[170, y], [250, y], [250, y + 16], [280, y + 16]]).t(214, y - 6, 'FB', 'sv');
    s.amp(280, y + 30, 'gm').t(232, y + 48, 'Vref', 'sv').w([[244, y + 44], [280, y + 44]]).w([[336, y + 30], [400, y + 30]]).dot(400, y + 30).t(418, y + 34, 'vc（COMP）', 'sk', 'start');
    if (t === 1) s.cv(400, y + 30, y + 150, 'Cc', g('Cc')).gnd(400, y + 150);
    else s.w([[400, y + 30], [400, y + 50]]).rv(400, y + 50, y + 125, 'Rc', g('Rc'), true).cv(400, y + 125, y + 180, 'Cc', g('Cc'), true).gnd(400, y + 180)
      .w([[400, y + 30], [480, y + 30], [480, y + 70]]).cv(480, y + 70, y + 150, 'Cp', g('Cp')).gnd(480, y + 150);
    return s.out();
  }
  // 运放：op1/op2/op3/pi/pid
  const t = kind === 'pi' ? 2 : kind === 'pid' ? 3 : +kind[2], noC2 = kind === 'pi' || kind === 'pid', s = S(560, t === 3 ? 292 : 240);
  const yi = 150, xin = 40, xn = 230, xo = 420, yb = yi + 104;
  s.t(14, yi + 4, 'vo', 'sk', 'start').w([[30, yi], [xin + 20, yi]]).dot(xin + 20, yi).rh(xin + 20, xn, yi, 'R1', g('R1')).dot(xn, yi);
  if (t === 3) s.w([[xin + 20, yi], [xin + 20, yb], [80, yb]]).rh(80, 140, yb, 'R3', g('R3')).ch(140, 200, yb, 'C3', g('C3')).w([[200, yb], [xn, yb], [xn, yi]]);
  if (g('Rb')) s.dot(xn - 40, yi).w([[xn - 40, yi], [xn - 40, yi + 16]]).rv(xn - 40, yi + 16, yi + 70, 'Rb', g('Rb'), true).gnd(xn - 40, yi + 70);
  s.w([[xn, yi], [xn + 30, yi], [xn + 30, yi - 14], [xn + 60, yi - 14]]).amp(xn + 60, yi, '').t(xn + 40, yi + 34, 'Vref', 'sv').w([[xn + 44, yi + 14], [xn + 60, yi + 14]]);
  s.w([[xn + 116, yi], [xo, yi]]).dot(xo, yi).t(xo + 10, yi + 4, 'vc', 'sk', 'start');
  // 反馈
  const yf1 = 40, yf2 = 88;
  if (t === 1) s.w([[xn, yi], [xn, yf2], [300, yf2]]).ch(300, 360, yf2, 'C1', g('C1')).w([[360, yf2], [xo, yf2], [xo, yi]]);
  else {
    s.w([[xn, yi], [xn, yf1], [250, yf1]]).rh(250, 316, yf1, 'R2', g('R2')).ch(340, 396, yf1, 'C1', g('C1')).w([[316, yf1], [340, yf1]]).w([[396, yf1], [xo, yf1], [xo, yi]]);
    if (!noC2) s.dot(xn, yf2).w([[xn, yf2], [300, yf2]]).ch(300, 360, yf2, 'C2', g('C2')).w([[360, yf2], [xo, yf2]]).dot(xo, yf2);
  }
  return s.out();
};

// 由设计结果组装原理图（含元件值）
PS.schemOf = function (rz, fam) {
  const v = {}; rz.parts.forEach(p => { v[p.name] = PS.fmt(p.val, p.unit === 'Ω' ? 'Ω' : 'F', 3); });
  return PS.schem((fam === 'ota' ? 'ota' : 'op') + rz.cpReal.type, v);
};
})(typeof window !== 'undefined' ? window : globalThis);
