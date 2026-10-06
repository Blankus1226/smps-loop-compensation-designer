/* 各控制模式的调制律（第三行）、被控对象 P(s)=vo/vc、内环增益、闭环输出阻抗
   ctx = { P, op, H, Ts, mode, impl, dig:{Npwm,Kadc,Kdac,Td}, Gci(s), Gdi(s) }
   vc 的单位：模拟 = 伏特；数字 = 计数（VMC 为 PWM 比较值，PCMC 为 DAC 码，ACM 为电流参考码） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C;

// Se：外加斜坡斜率（V/s，硬件固定值，工况扫描时不随工况变化）
PS.Fm = (op, Se) => 1 / ((op.Sn + Se) * op.Ts);
PS.pcmcQ = (op, Se) => { const mc = 1 + Se / op.Sn, x = mc * op.Dp - 0.5; return { mc, Qp: x > 0 ? 1 / (Math.PI * x) : -Infinity }; };

PS.law = function (ctx, s) {
  const P = ctx.P, op = ctx.op, dg = ctx.dig, dig = ctx.impl === 'digital';
  const dly = dig ? C.exp(C.sc(s, -dg.Td)) : C.ONE;
  switch (ctx.mode) {
    case 'vmc':
      return { r3: [C.ZERO, C.ZERO, C.ONE], kvc: dig ? C.sc(dly, 1 / dg.Npwm) : C.of(1 / P.Vm) };
    case 'pcmc': {
      const Fm = PS.Fm(op, ctx.Se);
      return { r3: [C.sc(PS.He(s, op.Ts), Fm * P.Ri), C.ZERO, C.ONE], kvc: dig ? C.sc(dly, Fm * dg.Kdac) : C.of(Fm) };
    }
    case 'acm': {
      const gi = dig ? C.sc(C.mul(dly, ctx.Gdi(s)), 1 / dg.Npwm) : C.sc(ctx.Gci(s), 1 / P.Vm);
      return { r3: [C.sc(gi, dig ? dg.Kadc * P.Ri : P.Ri), C.ZERO, C.ONE], kvc: gi };
    }
    case 'coti':
      return { r3: [C.of(P.Ri), C.ZERO, C.ZERO], kvc: PS.Hcot(s, op.Ton) };
    case 'cotr':   // 等效电流模式近似：ESR 纹波充当“电流采样”，Ri_eq = H·rc
      return { r3: [C.sc(C.sub(C.inv(PS.Hcot(s, op.Ton)), C.ONE), ctx.H * P.Rc * op.bi), C.of(ctx.H), C.ZERO], kvc: C.ONE };
  }
  throw new Error('未知控制模式 ' + ctx.mode);
};

// 被控对象 vo/vc（纹波型 COT 用 Jian Li 公式）
PS.plantP = function (ctx, s) {
  if (ctx.mode === 'cotr') return PS.Pcotr(ctx.op, ctx.P, s, ctx.H);
  const L = PS.law(ctx, s);
  return PS.solve(ctx.op, ctx.P, s, L.r3, L.kvc).vo;
};
// 内环增益 Ti = r3[0]·Gid（PCMC、ACM 有意义）
PS.innerTi = function (ctx, s) {
  const L = PS.law(ctx, s);
  return C.mul(L.r3[0], PS.Gvd(ctx.op, ctx.P, s).Gid);
};
// ACM 内环设计用被控对象：（模拟）Ri·Gid/Vm；（数字）Kadc·Ri·e^{-sTd}·Gid/Npwm
PS.innerPlant = function (ctx, s) {
  const P = ctx.P, Gid = PS.Gvd(ctx.op, P, s).Gid;
  if (ctx.impl === 'digital') return C.sc(C.mul(C.exp(C.sc(s, -ctx.dig.Td)), Gid), ctx.dig.Kadc * P.Ri / ctx.dig.Npwm);
  return C.sc(Gid, P.Ri / P.Vm);
};
// 闭环输出阻抗 Zcl(s) = −vo/io，gc 为 s 处外环补偿器值 vc/(−vo)（无补偿器传 null）
PS.zcl = function (ctx, s, gc) {
  const L = PS.law(ctx, s), r3 = L.r3.slice();
  if (gc) r3[1] = C.add(r3[1], C.mul(L.kvc, gc));
  return PS.solve(ctx.op, ctx.P, s, r3, C.ZERO).Zo;
};
// 开环（vc 固定）输出阻抗
PS.zol = (ctx, s) => PS.zcl(ctx, s, null);

})(typeof window !== 'undefined' ? window : globalThis);
