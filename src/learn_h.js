/* 学习模式辅助：计算步骤渲染、极零点作用表、给已注册课程追加 steps / roles / mark */
(function (G) {
'use strict';
const PS = G.PS, Lr = PS.Learn, TAU = 2 * Math.PI;

// 步骤：[{ t:'标题', f:'公式（可含 HTML）', r:'代入结果', n:'说明' }]，或字符串作为小节标题
Lr.stepsHtml = function (st) {
  let k = 0;
  return '<ol class="steps">' + st.map(s => {
    if (typeof s === 'string') return `</ol><h4 class="steps-h">${s}</h4><ol class="steps" start="${k + 1}">`;
    k++;
    return `<li><b>${s.t}</b>${s.f ? `<div class="f">${s.f}</div>` : ''}${s.r ? `<div class="res">${s.r}</div>` : ''}${s.n ? `<div class="sn">${s.n}</div>` : ''}</li>`;
  }).join('') + '</ol>';
};
// 作用表：{ head:[...], rows:[[...], ...] }，第一列加粗
Lr.rolesHtml = function (t) {
  const head = t.head || ['极零点 / 元件', '位置（当前值）', '由谁决定', '作用', '放错的后果'];
  return `<table class="tb roles"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>` +
    t.rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 0 ? '<b>' + c + '</b>' : c}</td>`).join('')}</tr>`).join('') + '</table>';
};
// 给已注册课程追加内容
Lr.extend = function (id, o) { const l = Lr.L.find(x => x.id === id); if (l) Object.assign(l, o); };

// 格式化
Lr.hz = x => PS.fmt(x, 'Hz', 4);
Lr.v = (x, u, d) => PS.fmt(x, u || '', d || 4);
Lr.db = x => (20 * Math.log10(Math.abs(x))).toFixed(2) + ' dB';
Lr.deg = x => x.toFixed(2) + '°';
Lr.num = x => Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(4) : (+x.toPrecision(5)).toString();
// 极零点竖线（带标签）
Lr.mk = (f, label) => ({ x: f, label });
Lr.pzMarks = cp => [].concat(cp.z.map((w, i) => Lr.mk(w / TAU, 'fz' + (i + 1))), cp.p.map((w, i) => Lr.mk(w / TAU, 'fp' + (i + 1))));

/* 设计结果中每个极零点的作用（设计页和完整实例共用）
   返回 [{k:'积分 fi', f, role}]，顺序与 PS.pzList 一致（按频率排序） */
Lr.pzRoles = function (R) {
  const P = R.P, op = R.op, cp = R.rz ? R.rz.cpReal : R.kd.cp, fam = P.impl === 'digital' ? 'dig' : P.family;
  const vmc = P.mode === 'vmc', fc = R.mg && isFinite(R.mg.fc) ? R.mg.fc : R.fcTarget, out = [];
  const near = (a, b) => Math.abs(Math.log10(a / b)) < 0.25;
  out.push({ k: '积分 fi', f: cp.wi / TAU, role: '原点极点：直流增益无穷大 → 输出无静差；同时决定整体增益，使 |T(fc)| = 1' });
  cp.z.forEach((w, i) => {
    const f = w / TAU; let role;
    if (fam === 'ota' && cp.type === 3 && i === 1) role = 'Cff 前馈零点（Rt·Cff）：与配对极点间距被 Vo/Vref 锁定，在 fc 附近额外超前 ' + (R.kd.cp.bff || 0).toFixed(0) + '°';
    else if (vmc && cp.type === 3) role = (near(f, op.f0) || f < op.f0 * 1.5 ? '抵消 LC 双极点 f0 = ' + PS.fmt(op.f0, 'Hz') + ' 的 −180° 中的 90°' : '在 fc 以下抬升相位') + '，两个零点合起来把 f0 之后 −40 dB/dec 拉回 −20 dB/dec';
    else if (P.mode !== 'vmc') role = '抵消积分器的 −90°，让 fc 处相位回升；电流模式下常放在负载极点 1/(2πRC) 附近';
    else role = '在 fc 以下抬升相位（fz = fc/K）';
    out.push({ k: '零点 fz' + (i + 1), f, role: role + (f > fc ? '（注意：已高于 fc）' : '') });
  });
  cp.p.forEach((w, i) => {
    const f = w / TAU; let role;
    if (fam === 'ota' && cp.type === 3 && i === 1) role = 'Cff 配对极点（Rt∥Rb·Cff），= fz2·Vo/Vref，不能单独调';
    else if (near(f, op.fesr) && !(R.kd.K && !P.manual)) role = '抵消输出电容 ESR 零点 fESR = ' + PS.fmt(op.fesr, 'Hz') + '，恢复高频衰减';
    else role = (R.kd.K && !P.manual ? '由 K 因子放在 fc·' + (cp.type === 3 ? '√K' : 'K') + '：与零点关于 fc 对称，使相位提升峰值正好落在 fc；' : '') + 'fc 以上让增益重新下降' + (f > P.fs / 4 ? '，同时衰减开关纹波（已接近 fs/2），防止 PWM 比较器多次翻转' : '，抑制高频噪声') + (near(f, op.fesr) ? '；恰好接近 fESR = ' + PS.fmt(op.fesr, 'Hz') + '，顺带抵消了 ESR 零点' : '');
    if (fam === 'dig' && f > 0.45 * P.fs) role += '；数字实现中超过 Nyquist 附近的极点被 Tustin 压缩到 z = −1';
    out.push({ k: '极点 fp' + (i + 1), f, role: role + (f < fc ? '（注意：已低于 fc，会吃掉相位）' : '') });
  });
  // 与 PS.pzList 同序：积分 → 零点按频率升序 → 极点按频率升序，并重新编号
  const zs = out.filter(x => x.k[0] === '零').sort((a, b) => a.f - b.f), ps = out.filter(x => x.k[0] === '极').sort((a, b) => a.f - b.f);
  zs.forEach((x, i) => { x.k = '零点 fz' + (i + 1); }); ps.forEach((x, i) => { x.k = '极点 fp' + (i + 1); });
  return [out[0]].concat(zs, ps);
};
})(typeof window !== 'undefined' ? window : globalThis);
