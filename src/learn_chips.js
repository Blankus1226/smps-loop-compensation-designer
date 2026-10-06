/* 学习：典型控制器芯片一览（控制模式、误差放大器、补偿要点、数据手册）+ 用 TPS54560 手册例题校核本工具
   芯片参数均摘自 数据手册/ 目录下的 TI / Microchip 官方数据手册（2026-10-06 下载核对） */
(function (G) {
'use strict';
const PS = G.PS, C = PS.C, TAU = 2 * Math.PI, Lr = PS.Learn, Ls = PS.Ls, F = Lr.F, K = Lr.K, c = Lr.col, hz = Lr.hz, V = Lr.v, num = Lr.num;
const GC = '典型控制器芯片';
const TI = p => 'https://www.ti.com/lit/ds/symlink/' + p + '.pdf';
// [型号, 文件名, 在线地址, 类型, 控制模式, 误差放大器 / 参考, 开关频率 / 输入范围, 补偿要点, 对应课程, 适用拓扑 b=Buck B=Boost 类]
PS.CHIPS = [
  ['TPS40303', 'tps40303.pdf', TI('tps40303'), 'Buck 控制器', 'vmc', '运放型 EA（GBW 24 MHz，AOL 60 dB）；Vref 0.6 V ±1%', '300 kHz（TPS40304 600 kHz / TPS40305 1.2 MHz）；3～20 V', '电压模式 + 输入电压前馈，外部 Type III（COMP–FB 之间）', 'type3', 'b'],
  ['LM5145', 'lm5145.pdf', TI('lm5145'), 'Buck 控制器', 'vmc', '高 GBW 运放型 EA；Vref 0.8 V ±1%', '100 kHz～1 MHz；6～75 V', '电压模式 + 线路前馈，Type III', 'ex_vmc', 'b'],
  ['TL494', 'tl494.pdf', TI('tl494'), '通用 PWM（Buck/Boost/推挽）', 'vmc', '两个运放型 EA；5 V 基准 ±5%', '振荡器 1～300 kHz；VCC 7～40 V', '经典固定频率电压模式，补偿网络接在 EA 反馈端', 'type3', 'bB'],
  ['TPS54560', 'tps54560.pdf', TI('tps54560'), 'Buck 变换器（内置 5 A 开关）', 'pcmc', 'OTA，gm 350 µS；Vref 0.8 V', '100 kHz～2.5 MHz；4.5～60 V', '峰值电流 + 内部斜坡；COMP 接 Rc/Cc/Cp；手册给出 gmps = 17 A/V 的极零对消公式', 'cmt2', 'b'],
  ['LM5141', 'lm5141.pdf', TI('lm5141'), 'Buck 控制器', 'pcmc', 'OTA，Gm 1200 µS（典型）；FB 1.2 V', '2.2 MHz 或 440 kHz；3.8～65 V', '峰值电流模式，Type II（COMP 对地 RC）', 'cmt2', 'b'],
  ['LM5122', 'lm5122.pdf', TI('lm5122'), '同步 Boost 控制器（可多相）', 'pcmc', '高增益运放型 EA（Type 2 网络接 COMP–FB）；Vref 1.2 V ±1%', '≤ 1 MHz；输入 3～65 V，输出 ≤ 100 V', '峰值电流 + 可编程斜坡（SLOPE 引脚）；RHPZ 限制带宽', 'ex_pcmc', 'B'],
  ['LM5156', 'lm5156.pdf', TI('lm5156'), '非同步 Boost / SEPIC / 反激控制器', 'pcmc', 'OTA，Gm 2 mA/V；FB 1.0 V ±1%', '100 kHz～2.2 MHz；3.5～60 V', '峰值电流 + 可加外部斜坡；Type II', 'rhpz', 'B'],
  ['TPS55340', 'tps55340.pdf', TI('tps55340'), 'Boost 变换器（内置 5 A / 40 V 开关）', 'pcmc', 'OTA，gm 360 µS（典型），Ro 10 MΩ；Vref 1.229 V', '100 kHz～1.2 MHz；2.9～32 V', '定频电流模式 + 内部斜坡；COMP 对地 RC', 'cmt2', 'B'],
  ['LM3478', 'lm3478.pdf', TI('lm3478'), '低边控制器（Boost / SEPIC / 反激）', 'pcmc', 'OTA，Gm 800 µS（典型）；Vref 1.26 V', '100 kHz～1 MHz；2.97～40 V', '电流模式 + 内部斜坡（可外加）；COMP 对地 RC', 'pcmc', 'B'],
  ['UC3843', 'uc3843.pdf', TI('uc3843'), '通用电流模式 PWM（反激 / Boost / 正激）', 'pcmc', '电压型 EA（低输出阻抗）；FB 2.5 V，5 V 基准', '≤ 500 kHz；UVLO 8.4 V / 7.6 V（DC-DC 版本）', '经典峰值电流模式；斜坡需从 RT/CT 外加', 'pcmc', 'B'],
  ['LM5176', 'lm5176.pdf', TI('lm5176'), '四开关升降压控制器', 'pcmc', 'OTA，gm 1.31 mS；Vref 0.8 V', '可调频率；4.2～55 V', 'Buck 区谷值电流、Boost 区峰值电流模式；Boost 区有 RHPZ', 'rhpz', 'bB'],
  ['LM5170-Q1', 'lm5170-q1.pdf', TI('lm5170-q1'), '48 V/12 V 双向多相 Buck/Boost', 'acm', '跨导电流放大器 gm 1 mA/V', '多相，汽车双电池系统', '平均电流模式：调节平均电流，Boost 方向也不受 RHPZ 影响（电流环），单个 RC 同时补偿两个方向', 'acmin', 'bB'],
  ['UCC28180', 'ucc28180.pdf', TI('ucc28180'), 'CCM PFC（Boost）控制器', 'acm', '电流环 OTA（ICOMP 对地电容）+ 电压环 OTA（VCOMP 对地 RC）', '18～250 kHz', '平均电流模式；电流环跟踪正弦、电压环 10～20 Hz', 'acmin', 'B'],
  ['UC3854', 'uc3854.pdf', TI('uc3854'), 'PFC 预调节器（Boost）', 'acm', '电压放大器 + 电流放大器 + 乘法器；7.5 V 基准', '固定频率，可 > 200 kHz', '平均电流模式的经典芯片，无需斜坡补偿', 'acmin', 'B'],
  ['TPS53355', 'tps53355.pdf', TI('tps53355'), 'Buck 变换器（30 A）', 'cotr', '无外部补偿；Vref 0.6 V ±1%', '250 kHz～1 MHz；1.5～15 V', 'D-CAP：用输出电容 ESR 感知电流，手册要求 1/(2π·ESR·C) ≤ fsw/4', 'cot', 'b'],
  ['TPS548A20', 'tps548a20.pdf', TI('tps548a20'), 'Buck 变换器（15 A）', 'coti', '无外部补偿；Vref 0.6 V ±0.5%', '200 kHz～1 MHz（8 档）；1.5～20 V', 'D-CAP3：自适应导通时间 + 内部纹波生成（仿真电流），支持全陶瓷电容', 'cmcot', 'b'],
  ['LM5164', 'lm5164.pdf', TI('lm5164'), 'Buck 变换器（1 A）', 'cotr', '电压调节比较器，无环路补偿；Vref 1.2 V', '6～100 V', 'COT；手册给出 Type 1/2/3 纹波注入方案保证 FB 纹波 ≥ 20 mV', 'cot', 'b'],
  ['TPS61022', 'tps61022.pdf', TI('tps61022'), '同步 Boost 变换器', 'coti', '内部补偿', '1 MHz（Vin < 1.5 V 时降至 0.6 MHz）；0.5～5.5 V', '按 Vin/Vout 预测导通时间的伪定频控制，谷值限流 8 A', 'cmcot', 'B'],
  ['UCD3138', 'ucd3138.pdf', TI('ucd3138'), '隔离电源数字控制器', 'digital', 'EADC（最高 16 MHz，最细 1 mV/LSB）', 'DPWM 250 ps 分辨率；3 个独立环路', '硬件 PID 型 2P2Z 补偿器，补偿器延时 6 个时钟（32 ns/时钟）', 'd2p2z', 'bB'],
  ['TMS320F280049C', 'tms320f280049c.pdf', TI('tms320f280049c'), 'C2000 实时控制 MCU', 'digital', '3 × 12 bit ADC，3.45 MSPS', '100 MHz CPU + 100 MHz CLA；HRPWM 150 ps', '软件 2P2Z/3P3Z（DCL 库），CLA 并行执行控制律降低延时', 'd3p3z', 'bB'],
  ['dsPIC33CK256MP508', 'dspic33ck256mp508-family-data-sheet-ds70005349h.pdf', 'https://ww1.microchip.com/downloads/en/DeviceDoc/dsPIC33CK256MP508-Family-Data-Sheet-DS70005349H.pdf', '数字电源 DSC', 'digital', '12 bit ADC 3.5 Msps；15 ns 模拟比较器 + 12 bit DAC', '100 MIPS；PWM 250 ps 分辨率', 'DAC 带硬件斜坡补偿，可做“数字外环 + 模拟峰值电流比较器”（本工具数字 PCMC 的结构）', 'ex_dig', 'bB'],
];
PS.CHIP_MODE = { vmc: '电压模式', pcmc: '峰值电流模式', acm: '平均电流模式', cotr: '纹波型 COT', coti: '电流型 / 仿真电流 COT', digital: '数字控制' };
// 本地数据手册路径：HTML 位于 试验区 根目录时为 数据手册/，位于 dist/ 时为 ../../数据手册/
Lr.dsHref = f => { const p = typeof location !== 'undefined' ? decodeURIComponent(location.pathname) : ''; return (/\/dist\/[^/]*$/.test(p) ? '../../数据手册/' : '数据手册/') + f; };
Lr.dsLinks = ch => `<a href="${Lr.dsHref(ch[1])}" target="_blank" rel="noopener" data-ds="${ch[1]}">本地 PDF</a> · <a href="${ch[2]}" target="_blank" rel="noopener">官网</a>`;
// 设计页提示：同类芯片
PS.chipsFor = (mode, topo, impl) => PS.CHIPS.filter(ch => (impl === 'digital' ? ch[4] === 'digital' : ch[4] === mode || (mode === 'coti' && ch[4] === 'cotr')) && ch[9].includes(topo === 'buck' ? 'b' : 'B')).slice(0, 3);

Lr.add({ id: 'chips', group: GC, title: '典型 Buck / Boost 控制器与数据手册', pre: ['olread'], kw: '芯片 控制器 数据手册 datasheet TI TPS LM UC UCC UCD C2000 dsPIC 选型',
  html: `${K('同一种控制模式，不同芯片的补偿网络长得几乎一样：电压模式 → 运放 + Type III；峰值电流模式 → OTA + COMP 对地 RC（Type II）；平均电流模式 → 电流环 + 电压环两组 RC；COT → 多数无外部补偿，靠选 L、C、纹波注入保证稳定；数字 → 2P2Z/3P3Z 系数。读数据手册时，先找到“控制模式”“误差放大器类型（运放/OTA、gm）”“Vref”“斜坡补偿”“推荐 fc”这几项，就能套用本工具对应的课程。')}`,
  talk: `<p>下表列出了每种控制模式下常见的 Buck、Boost 芯片，参数全部摘自官方数据手册。数据手册已下载到 <code>claude code试验区\\数据手册\\</code>，点“本地 PDF”直接打开，“官网”链接到 TI / Microchip 的最新版本。</p>
  <h4>读数据手册时找什么</h4>
  <ul><li><b>控制模式</b>：首页 Features 或 Detailed Description 第一段会写 voltage-mode / peak current-mode / average current-mode / D-CAP / COT。</li>
  <li><b>误差放大器</b>：看 COMP 引脚描述。“Output of the transconductance error amplifier”→ OTA，补偿网络接 COMP 到地，查电气特性表里的 gm；“connect the loop compensation network between this pin and the FB pin”→ 运放型，补偿网络接 COMP 到 FB。</li>
  <li><b>功率级跨导 / 调制器增益</b>：电流模式芯片常给出 COMP 到电感电流的跨导 gmps（A/V），它就是 1/Ri；电压模式芯片给出锯齿波幅度或前馈系数 Vm/Vin。</li>
  <li><b>斜坡补偿</b>：内部固定还是外部可调（SLOPE 引脚），以及对电感量的下限要求。</li>
  <li><b>补偿设计章节</b>：Application and Implementation 里通常有完整的例题，可以用本工具的计算核对（下方以 TPS54560 为例）。</li></ul>
  <h4>用 TPS54560 的手册例题校核本工具</h4>
  <p>TPS54560 数据手册第 8.2 节的设计例：12 V 输入、5 V/5 A 输出，fsw = 400 kHz，L = 7.2 µH，输出 2×47 µF 陶瓷电容（降额后 87.4 µF，ESR 等效 1.67 mΩ），gmea = 350 µA/V，gmps = 17 A/V，Vref = 0.8 V。手册先算出调制器极点 f<sub>p(mod)</sub> = 1821 Hz，取 fco = 29.2 kHz，再用极零对消公式得到 R4 = 16.8 kΩ（选 16.9 kΩ）、C5 = 5172 pF（选 4700 pF）。下方“实际计算过程”按本工具 ${Lr.link('cmt2')} 的手算公式重算一遍，并用 Ridley 完整模型算出这组元件的实际 fc 与 PM。</p>`,
  plotTitle: 'TPS54560 手册例题：开环增益（手册元件值，Ridley 模型）',
  sl: [{ k: 'se', l: '假设的内部斜坡 Se/Sf', a: 0.1, b: 1.5, v: 0.5, fmt: x => x.toFixed(2) }, { k: 'cr', l: '电容有效值', opts: [['87.4', '降额后 87.4 µF（手册）'], ['94', '标称 2×47 µF']], v: '87.4' }],
  calc(v) {
    const Cout = +v.cr * 1e-6, gmps = 17, gmea = 350e-6, Vref = 0.8, Vo = 5, fsw = 400e3, Io = 5, Resr = 1.67e-3;
    const P = Object.assign(PS.clone(PS.DEFAULTS), { topo: 'buck', mode: 'pcmc', family: 'ota', Vin: 12, VinMin: 7, VinMax: 60, Vo, Io, IoMax: 5, IoMin: 0.5, fs: fsw, L: 7.2e-6, C: Cout, Rc: Resr, RL: 11e-3, Ron: 92e-3, Ri: 1 / gmps, gm: gmea, Vref, seRatio: v.se, roundE: false });
    const op = PS.opPoint(P, 12, Io), ctx = PS.mkCtx(P, op), Pl = s => PS.plantP(ctx, s), H = Vref / Vo;
    // 手册元件：R4 = 16.9 kΩ，C5 = 4700 pF，C8 = 47 pF（COMP 对地）
    const Rc = 16.9e3, Cc = 4700e-12, Cp = 47e-12, cp = { type: 2, wi: H * gmea / (Cc + Cp), z: [1 / (Rc * Cc)], p: [(Cc + Cp) / (Rc * Cc * Cp)] };
    const gc = s => PS.compEval(cp, s), Tf = s => C.mul(Pl(s), gc(s)), mg = PS.margins(Tf, 10, fsw * 0.97);
    const fpm = Io / (TAU * Vo * Cout), fzm = 1 / (TAU * Resr * Cout), fco = 29.2e3;
    const R4 = TAU * fco * Cout * Vo / (gmps * Vref * gmea), C5 = 1 / (TAU * R4 * fpm), C8a = 1 / (Math.PI * 16.9e3 * fsw), C8b = Cout * Resr / 16.9e3, C8 = Math.max(C8a, C8b);
    const f = PS.logspace(10, fsw * 0.97, 500);
    return { f0: 10, f1: fsw * 0.97, mg, vlines: [{ x: fpm, label: 'fp(mod)' }, { x: 1 / (TAU * Rc * Cc), label: 'fz' }, { x: fsw / 2, label: 'fs/2' }],
      series: [{ name: '开环 T（手册元件）', fn: Tf, color: c(1) }, { name: '对象 P（Ridley）', fn: Pl, color: c(2), dash: true, width: 1.6 }, { name: '补偿器 Gc', fn: gc, color: c(3) }],
      sch: PS.schem('ota2', { Rt: '53.6 kΩ', Rb: '10.2 kΩ', Rc: '16.9 kΩ', Cc: '4.7 nF', Cp: '47 pF' }),
      extra: [{ title: '补偿器 Gc 单独的 Bode 图（手册元件）', cfg: Ls.bcfg([{ name: 'Gc = H·gm·Zc', fn: gc, color: c(3) }], f, { vlines: [{ x: 1 / (TAU * Rc * Cc), label: 'fz' }, { x: 1 / (TAU * Rc * Cp), label: 'fp' }], height: 300 }) }],
      info: `手册元件下：fc = ${hz(mg.fc)}，PM = ${PS.fmtNum(mg.pm, 1)}°，GM = ${isFinite(mg.gm) ? mg.gm.toFixed(1) + ' dB' : '∞'}（手册设计目标 fco = 29.2 kHz）。手册说明：计算忽略了斜坡补偿，实际 fc 会比计算值低。`, R4, C5, C8, fpm, fzm, fco, Cout, mgx: mg, C8a, C8b };
  },
  steps(v, r) {
    return ['TPS54560 数据手册 8.2 节设计例（12 V → 5 V/5 A，400 kHz）',
      { t: '调制器极点（负载极点）', f: 'f<sub>p(mod)</sub> = I<sub>out</sub>/(2π·V<sub>out</sub>·C<sub>out</sub>)', r: '5 A/(2π × 5 V × ' + V(r.Cout, 'F') + ') = <b>' + hz(r.fpm) + '</b>（手册 1821 Hz）' },
      { t: 'ESR 零点', f: 'f<sub>z(mod)</sub> = 1/(2π·R<sub>ESR</sub>·C<sub>out</sub>)', r: hz(r.fzm) + '（手册 1100 kHz）' },
      { t: 'fco 的起点', f: '√(f<sub>p(mod)</sub>·f<sub>z(mod)</sub>) 与 √(f<sub>p(mod)</sub>·fsw/2) 的几何平均', r: '手册取 fco = 29.2 kHz（fs/13.7）' },
      { t: 'R4（= 本工具的 Rc）', f: 'R4 = 2π·fco·C<sub>out</sub>·V<sub>out</sub> / (gmps·Vref·gmea)　⇔　Rc = |Gc(fc)|/(H·gm)，|P(fc)| ≈ gmps/(2π·fc·C)', r: '<b>' + V(r.R4, 'Ω') + '</b>（手册 16.8 kΩ，选 16.9 kΩ）', n: '两个公式是同一个式子：电流模式 |P(fc)| ≈ gmps/(2π·fc·Cout)（= 1/(2π·Ri·C·fc)），H = Vref/Vout。' },
      { t: 'C5（= Cc，零点对准调制器极点）', f: 'C5 = 1/(2π·R4·f<sub>p(mod)</sub>)', r: '<b>' + V(r.C5, 'F') + '</b>（手册 5172 pF，选 4700 pF）' },
      { t: 'C8（= Cp，高频极点）', f: '取 C8 = 1/(π·R4·fsw)（极点在 fs/2）与 C8 = C<sub>out</sub>·R<sub>ESR</sub>/R4（极点抵消 ESR 零点）中较大者', r: V(r.C8a, 'F') + ' 与 ' + V(r.C8b, 'F') + ' → <b>' + V(r.C8, 'F') + '</b>（手册 47.1 pF / 8.64 pF，选 47 pF）', n: '与本工具“fp2 = min(fESR, fs/2)”的规则相同：取较低的那个极点频率（即较大的电容）。' },
      { t: '用 Ridley 完整模型核对手册元件', r: 'fc = ' + hz(r.mgx.fc) + '，PM = ' + PS.fmtNum(r.mgx.pm, 1) + '°', n: '本工具算得的 fc 低于手册目标，这与手册“忽略斜坡补偿，实际穿越频率会低于计算值”的说明一致；拖动“内部斜坡”看 fc 随斜坡增大而降低。TPS54560 的内部斜坡数值手册未直接给出，此处 Se/Sf 为假设值。' }];
  },
  rolesTitle: '典型芯片一览（参数摘自数据手册）',
  roles: () => ({ head: ['型号', '类型', '控制模式', '误差放大器 / 参考', '频率 / 电压范围', '补偿要点', '相关课程', '数据手册'],
    rows: PS.CHIPS.map(ch => [ch[0], ch[3], PS.CHIP_MODE[ch[4]], ch[5], ch[6], ch[7], Lr.link(ch[8]), Lr.dsLinks(ch)]) }),
  quiz: [['TPS54560 的 COMP 接 Rc + Cc 到地，LM5122 的 COMP 与 FB 之间接 RC 网络，两种补偿器的元件计算有什么不同？', 'TPS54560 是 OTA：增益 = H·gm·Rc，H = Vref/Vo 乘进增益；LM5122 是运放型：增益 = Rcomp/R上分压，与 H 无关。零点、极点的公式形式相同（1/(2πRC)）。'],
    ['为什么 D-CAP 芯片（TPS53355）的手册不讲补偿器设计，而讲输出电容？', '它没有误差放大器，环路稳定性完全由输出电容的 ESR 与容量决定：手册要求 1/(2π·ESR·C) ≤ fsw/4，相当于纹波型 COT 的 rc·C > Ton/2 判据的工程版本。'],
    ['数字控制器 UCD3138 的“PID-based 2-pole/2-zero”对应本工具的哪种补偿器？', '对应 2P2Z（数字 Type II/PID 的离散形式）；本工具的数字补偿器课程给出从 s 域设计到 2P2Z 系数的完整过程。']] });
})(typeof window !== 'undefined' ? window : globalThis);
