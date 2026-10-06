/* 设计检查、工况扫描、数字 C 代码生成 */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI;

PS.checks = function (R) {
  const P = R.P, op = R.op, ctx = R.ctx, W = R.warn, I = R.info, dig = P.impl === 'digital';
  const lo = PS.opPoint(P, P.VinMax, P.IoMin);
  if (lo.ok && P.IoMin < lo.Icrit) W.push('轻载 ' + PS.fmt(P.IoMin, 'A') + ' 低于临界电流 ' + PS.fmt(lo.Icrit, 'A') + '：非同步整流会进入 DCM，CCM 模型失效（本工具按同步整流/强制 CCM 计算）');
  if (P.topo !== 'buck') {
    const w = PS.opPoint(P, P.VinMin, P.IoMax);
    R.frhpzWorst = w.frhpz;
    if (R.mg && R.mg.fc > w.frhpz / 5) W.push('fc = ' + PS.fmt(R.mg.fc, 'Hz') + ' 超过最差工况 RHPZ（' + PS.fmt(w.frhpz, 'Hz') + '）的 1/5，相位裕度会随工况恶化');
  }
  if (R.mg && R.mg.fc > P.fs / (dig ? 8 : 5)) W.push('fc 过高（> fs/' + (dig ? 8 : 5) + '），平均模型精度下降，开关纹波会进入环路');
  if (P.mode === 'pcmc') {
    const q = R.pcmc = PS.pcmcQ(op, ctx.Se);
    const seOpt = ((1 / Math.PI + 0.5) / op.Dp - 1) * op.Sn / op.Sf;   // 使 Qp = 1 的 Se/Sf
    R.pcmc.seOpt = seOpt;
    if (!(q.Qp > 0)) W.push('峰值电流模式次谐波振荡：mc·D′ < 0.5（Qp < 0），需增大斜坡补偿，建议 Se/Sf ≥ ' + seOpt.toFixed(2));
    else if (q.Qp > 2) W.push('fs/2 处双极点 Qp = ' + q.Qp.toFixed(2) + ' 偏高（>2），建议 Se/Sf ≈ ' + seOpt.toFixed(2) + ' 使 Qp≈1');
  }
  if (P.mode === 'cotr') {
    const rcC = P.Rc * P.C, Q2 = PS.cotrQ(op, P);
    R.cotr = { rcC, Q2, need: op.Ton / 2 };
    if (rcC <= op.Ton / 2) W.push('纹波型 COT 不稳定：rc·C = ' + PS.fmt(rcC, 's') + ' ≤ Ton/2 = ' + PS.fmt(op.Ton / 2, 's') + '，ESR 纹波不足，需 rc > ' + PS.fmt(op.Ton / 2 / P.C, 'Ω') + ' 或加纹波注入');
    else if (Q2 > 2) W.push('纹波型 COT 的 fs/2 双极点 Q2 = ' + Q2.toFixed(2) + ' 偏高，裕量小');
  }
  if ((P.mode === 'coti') && P.topo !== 'buck') I.push('COT 用于 ' + PS.TOPOS[P.topo] + ' 时为近似模型（仍按 Jian Li 双极点处理）');
  if (P.mode === 'cotr') {
    I.push('纹波型 COT：Bode 用 Jian Li 模型；阶跃预测用“ESR 等效电流采样”近似模型');
    const dI = Math.abs(P.stepTo - P.stepFrom) * P.Io;
    if (P.Rc * dI > P.Rc * op.dIL) I.push('负载阶跃在 ESR 上的瞬时压降（' + PS.fmt(P.Rc * dI, 'V') + '）大于纹波（' + PS.fmt(P.Rc * op.dIL, 'V') + '），比较器会连续触发，属大信号响应，小信号预测仅供参考，以开关仿真为准');
  }
  if (dig) {
    const dg = ctx.dig, fc = R.mg ? R.mg.fc : R.fcTarget;
    R.delayLoss = 360 * fc * dg.Td;
    I.push('数字延时 Td = ' + PS.fmt(dg.Td, 's') + '（tc + D·Ts），在 fc 处损失相位 ' + R.delayLoss.toFixed(1) + '°');
    const dvPwm = P.Vin / dg.Npwm * (P.topo === 'buck' ? 1 : 1 / (op.Dp * op.Dp)), dvAdc = 1 / (dg.Kadc * ctx.H);
    R.res = { dvPwm, dvAdc };
    if (P.mode === 'vmc' && dvPwm > dvAdc) W.push('DPWM 分辨率（≈' + PS.fmt(dvPwm, 'V') + '/LSB）粗于 ADC（' + PS.fmt(dvAdc, 'V') + '/LSB），可能出现极限环振荡，请提高定时器时钟');
    if (P.Vref >= P.adcFs) W.push('ADC 采样目标电压 Vref 不能超过 ADC 满量程');
  }
  if (P.mode === 'acm' && !dig && R.inner) {
    const g = C.abs(ctx.Gci(C.jw(P.fs))), slope = g * op.Sf, lim = P.Vm * P.fs;
    if (slope > lim) W.push('平均电流模式：放大后的电感电流下降斜率 ' + PS.fmt(slope, 'V/s') + ' 超过锯齿波斜率 ' + PS.fmt(lim, 'V/s') + '，可能次谐波振荡，降低电流环高频增益或增大 Vm');
  }
  const chk = (mg, tag) => {
    if (!mg) return;
    if (!isFinite(mg.fc)) { W.push(tag + '没有找到增益穿越频率'); return; }
    if (mg.pm < 0) W.push(tag + '不稳定：相位裕度 PM = ' + mg.pm.toFixed(1) + '°');
    else if (mg.pm < 40) W.push(tag + '相位裕度偏低（PM = ' + mg.pm.toFixed(1) + '°）');
    if (isFinite(mg.gm) && mg.gm < 6) W.push(tag + '增益裕度偏低（GM = ' + mg.gm.toFixed(1) + ' dB）');
    if (mg.crossings > 1) W.push(tag + '存在 ' + mg.crossings + ' 次增益穿越（条件稳定），各穿越处最小 PM = ' + mg.pmMin.toFixed(1) + '°，请检查 Bode 图');
  };
  chk(R.mg, '外环：'); if (R.inner) chk(R.inner.mg, '电流内环：');
  if (R.rz && R.rz.cpReal.Vo && Math.abs(R.rz.cpReal.Vo - P.Vo) / P.Vo > 0.005) I.push('分压电阻圆整后输出电压变为 ' + PS.fmt(R.rz.cpReal.Vo, 'V'));
  if (dig) R.code = PS.genCode(R);
};

// 工况扫描：补偿器固定，Vin×Io 九个角
PS.sweep = function (R) {
  const P = R.P, rows = [], seen = {};
  const vins = [P.VinMin, P.Vin, P.VinMax], ios = [P.IoMin, P.Io, P.IoMax];
  const f = PS.logspace(R.fmin, R.fmax, 400);
  for (const vin of vins) for (const io of ios) {
    const key = vin + '_' + io; if (seen[key]) continue; seen[key] = 1;
    const op = PS.opPoint(P, vin, io), row = { Vin: vin, Io: io, op, nom: vin === P.Vin && io === P.Io };
    if (!op.ok) { row.err = op.err; rows.push(row); continue; }
    const ctx = PS.mkCtx(P, op, R.ctx);
    if (R.noLoop) { row.Pb = PS.bode(s => PS.plantP(ctx, s), f); rows.push(row); continue; }
    const T = s => C.mul(C.sc(PS.plantP(ctx, s), R.kin), R.gcPlot(s));
    const mg = PS.margins(T, R.fmin, R.fmax, 400);
    Object.assign(row, { fc: mg.fc, pm: mg.pm, gm: mg.gm, bode: { f: mg.f, mag: mg.mag, ph: mg.ph } });
    if (P.mode === 'pcmc') row.Qp = PS.pcmcQ(op, R.ctx.Se).Qp;
    rows.push(row);
  }
  let worst = null;
  rows.forEach(r => { if (isFinite(r.pm) && (!worst || r.pm < worst.pm)) worst = r; });
  if (worst) worst.worst = true;
  return rows;
};

// 稳态初值（计数）
PS.digInit = function (R) {
  const P = R.P, op = R.op, dg = R.ctx.dig, Ipk = op.IL + op.dIL / 2, Iv = op.IL - op.dIL / 2;
  const iSamp = op.IL - op.dIL / 2;   // 周期起点（谷值附近）采样
  if (P.mode === 'vmc') return { u0: op.D * dg.Npwm, umin: 0, umax: P.Dmax * dg.Npwm };
  if (P.mode === 'pcmc') return { u0: (P.Ri * Ipk + R.ctx.Se * op.D * op.Ts) / dg.Kdac, umin: 0, umax: dg.dacMax };
  void Iv;
  return { u0: dg.Kadc * P.Ri * iSamp, umin: 0, umax: dg.adcMax, ui0: op.D * dg.Npwm, uimin: 0, uimax: P.Dmax * dg.Npwm };
};

PS.genCode = function (R) {
  const P = R.P, dg = R.ctx.dig, ini = PS.digInit(R), nref = Math.round(dg.Kadc * P.Vref);
  const head = ['环路补偿器（由 环路补偿设计工具 自动生成）',
    PS.TOPOS[P.topo] + ' · ' + PS.MODES[P.mode] + ' · 数字实现  fs = ' + PS.fmt(P.fs, 'Hz') + '（每个开关周期执行一次）',
    'ADC ' + P.adcBits + ' bit / ' + P.adcFs + ' V，电压采样目标 ' + P.Vref + ' V → 参考码 VREF_CODE = ' + nref,
    '离散化：' + (P.disc === 'mpz' ? '零极点匹配' : 'Tustin（fc 处预畸变）') + '，差分方程 u[n] = Σb·e[n−i] − Σa·u[n−i]'];
  let out = '';
  if (P.mode === 'vmc') {
    out = PS.cCode('cv', R.qz, ini.umin, ini.umax, head.concat(['输出 = PWM 比较寄存器值，周期计数 N = ' + dg.Npwm]));
    out += '\n\n#define VREF_CODE ' + nref + '\n/* ISR：  duty = cv_step(&cv, VREF_CODE - adc_vo);  PWM_CMP = duty;  （影子寄存器，下个周期生效） */';
  } else if (P.mode === 'pcmc') {
    out = PS.cCode('cv', R.qz, ini.umin, ini.umax, head.concat(['输出 = 峰值电流比较器 DAC 码（' + P.dacBits + ' bit / ' + P.dacFs + ' V），斜坡补偿由模拟比较器完成']));
    out += '\n\n#define VREF_CODE ' + nref + '\n/* ISR：  DAC = cv_step(&cv, VREF_CODE - adc_vo); */';
  } else {
    out = PS.cCode('cv', R.qz, ini.umin, ini.umax, head.concat(['外环（电压）：输出 = 电流参考（ADC 码，电流采样 Ri = ' + P.Ri + ' V/A）']));
    out += '\n\n' + PS.cCode('ci', R.inner.qz, ini.uimin, ini.uimax, ['内环（电流）：输出 = PWM 比较寄存器值，周期计数 N = ' + dg.Npwm]);
    out += '\n\n#define VREF_CODE ' + nref + '\n/* ISR：  iref = cv_step(&cv, VREF_CODE - adc_vo);\n         PWM_CMP = ci_step(&ci, iref - adc_il); */';
  }
  out += '\n/* 上电：cv_init(&cv, ' + Math.round(ini.u0) + ');' + (P.mode === 'acm' ? '  ci_init(&ci, ' + Math.round(ini.ui0) + ');' : '') + '  （稳态初值，可改为软启动） */\n';
  return out;
};

})(typeof window !== 'undefined' ? window : globalThis);
