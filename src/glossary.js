/* 术语表：每个英文缩写的中文注释；PS.annotate(root) 自动给文本中的缩写加悬停注释 */
(function (G) {
'use strict';
const PS = G.PS;
PS.GLOSS = [
  ['fc', '穿越频率 Crossover frequency：开环增益 |T| = 1（0 dB）处的频率，近似等于闭环带宽'],
  ['fci', '电流内环穿越频率（平均电流模式的内环带宽）'],
  ['PM', '相位裕度 Phase Margin：fc 处开环相位距 −180° 还差多少度；一般取 45°～60°'],
  ['GM', '增益裕度 Gain Margin：开环相位到达 −180° 时增益距 0 dB 还差多少 dB；一般 > 6～10 dB'],
  ['RHPZ', '右半平面零点 Right-Half-Plane Zero：Boost/Buck-Boost 特有，增益上升但相位滞后，限制带宽，fc 宜 < fRHPZ/5'],
  ['fRHPZ', '右半平面零点频率'],
  ['LHP', '左半平面 Left-Half-Plane：普通（稳定）零极点所在的一侧'],
  ['ESR', '等效串联电阻 Equivalent Series Resistance：输出电容内阻，与电容形成一个零点'],
  ['fESR', 'ESR 零点频率 = 1/(2π·ESR·C)'],
  ['DCR', '电感直流电阻 DC Resistance'],
  ['Rds(on)', 'MOSFET 导通电阻'],
  ['CCM', '电流连续模式 Continuous Conduction Mode：电感电流始终大于零'],
  ['DCM', '电流断续模式 Discontinuous Conduction Mode：电感电流在每周期内降到零，小信号模型完全不同'],
  ['FCCM', '强制连续模式 Forced CCM：同步整流允许电感电流反向，轻载也保持 CCM'],
  ['VMC', '电压模式控制 Voltage-Mode Control：误差放大器输出直接与固定锯齿波比较产生 PWM'],
  ['PCMC', '峰值电流模式控制 Peak Current-Mode Control：电感电流峰值（加斜坡）与误差电压比较'],
  ['ACM', '平均电流模式控制 Average Current-Mode Control：电流内环调节平均电感电流，电压外环给定电流参考'],
  ['COT', '恒定导通时间控制 Constant On-Time：导通时间固定，由比较器决定何时开通，频率随负载略变'],
  ['PWM', '脉宽调制 Pulse-Width Modulation'],
  ['DPWM', '数字脉宽调制 Digital PWM：由定时器计数产生，分辨率 = 1/N（N 为周期计数）'],
  ['ADC', '模数转换器 Analog-to-Digital Converter'],
  ['DAC', '数模转换器 Digital-to-Analog Converter'],
  ['EA', '误差放大器 Error Amplifier'],
  ['OTA', '跨导放大器 Operational Transconductance Amplifier：输出电流 = gm × 输入电压差，补偿网络接到地'],
  ['gm', '跨导 Transconductance，单位 A/V（S）'],
  ['Type I', '一型补偿器：纯积分器，一个原点极点，不提供相位提升'],
  ['Type II', '二型补偿器：积分 + 一对零点/极点，最多约 90° 相位提升，常用于电流模式'],
  ['Type III', '三型补偿器：积分 + 两对零点/极点，最多接近 180° 相位提升，常用于电压模式'],
  ['PI', '比例-积分控制器 Proportional-Integral，等价于去掉高频极点的 Type II'],
  ['PID', '比例-积分-微分控制器，实用形式带微分滤波极点，等价于 Type III'],
  ['1P1Z', '一极点一零点数字补偿器（Type I 的离散形式）'],
  ['2P2Z', '两极点两零点数字补偿器，对应 Type II'],
  ['3P3Z', '三极点三零点数字补偿器，对应 Type III'],
  ['Tustin', '双线性变换 s = (2/T)(1−z⁻¹)/(1+z⁻¹)；预畸变后在指定频率处与模拟原型完全一致'],
  ['MPZ', '零极点匹配 Matched Pole-Zero：把每个 s 域零极点映射为 z = e^(sT)'],
  ['ZOH', '零阶保持 Zero-Order Hold：采样值保持一个周期，相当于约 T/2 的延时'],
  ['Bode', '波特图：幅频（dB）与相频（度）随对数频率变化的曲线'],
  ['K 因子', 'Venable K 因子法：按所需相位提升计算 K，把零点放在 fc/K、极点放在 fc·K'],
  ['Venable', 'H. Dean Venable，1983 年提出 K 因子补偿设计法'],
  ['Ridley', 'Ray Ridley，1990 年提出峰值电流模式的采样数据模型（含 fs/2 双极点）'],
  ['Jian Li', '李健（Virginia Tech CPES），提出 COT/纹波控制的描述函数小信号模型'],
  ['f0', 'LC 谐振频率（输出滤波器双极点）'],
  ['fs', '开关频率 Switching frequency'],
  ['fz', '零点频率'], ['fp', '极点频率'], ['fi', '积分器“0 dB 交点”频率 ωi/2π'],
  ['Ts', '开关周期 = 1/fs'],
  ['Ton', '导通时间 On-time'],
  ['Td', '数字控制总延时 = 计算延时 tc + 调制延时 D·Ts'],
  ['tc', '采样到 PWM 装载的计算延时'],
  ['Vm', '锯齿波（PWM 斜坡）峰峰值，调制器增益 = 1/Vm'],
  ['Vref', '反馈参考电压（数字模式下为 ADC 采样目标电压）'],
  ['Ri', '电流采样增益（V/A），= 采样电阻 × 放大倍数'],
  ['Se', '外加斜坡补偿斜率（V/s）'], ['Sn', '电感电流上升斜率 × Ri（V/s）'], ['Sf', '电感电流下降斜率 × Ri（V/s）'],
  ['mc', '斜坡补偿系数 = 1 + Se/Sn'],
  ['Qp', '峰值电流模式 fs/2 处双极点的品质因数 = 1/(π(mc·D′ − 0.5))，<0 即次谐波振荡'],
  ['Q2', '纹波型 COT 在 fs/2 附近双极点的品质因数，由 rc·C/Ton 决定'],
  ['He(s)', 'Ridley 采样增益 sTs/(e^(sTs)−1)，在 fs/2 处产生双极点'],
  ['Fm', '峰值电流模式调制器增益 = 1/((Sn+Se)·Ts)'],
  ['D′', '1 − D'],
  ['Q 格式', '定点数格式：整数 / 2^Q 表示小数，Q 越大精度越高、动态范围越小'],
  ['LSB', '最低有效位 Least Significant Bit：一个量化台阶'],
  ['ISR', '中断服务程序 Interrupt Service Routine'],
  ['MCU', '微控制器 Microcontroller'],
  ['E 系列', 'IEC 60063 标准阻容值系列：E6/E12/E24/E48/E96/E192，每十倍频程取 N 个对数等距值，N 越大精度越高'],
  ['E24', 'E24 标准阻容值系列（约 5% 间隔）'], ['E96', 'E96 标准电阻值系列（约 1% 间隔）'],
  ['LTspice', 'ADI 免费 SPICE 仿真器'], ['PSIM', 'Powersim 电力电子仿真软件'], ['SPICE', '通用电路仿真程序'],
  ['JSON', '文本数据格式，用于保存/载入设计参数'], ['PNG', '位图图片格式'],
  ['ΔIL', '电感电流纹波峰峰值'], ['dB', '分贝，20·log10(幅值)'],
  ['Buck', '降压变换器'], ['Boost', '升压变换器'], ['Buck-Boost', '升降压（反相）变换器'],
  ['LTI', '线性时不变系统 Linear Time-Invariant：可以用传递函数描述的系统'],
  ['RHP', '右半平面 Right-Half-Plane：极点在此不稳定，零点在此产生“先反向”的响应'],
  ['Ms', '灵敏度峰值：|1/(1+T)| 的最大值，即 Nyquist 曲线到 −1 点最近距离的倒数；一般希望 < 6 dB'],
  ['Nyquist', 'Nyquist 稳定判据 / Nyquist 频率 fs/2（采样系统能表示的最高频率）'],
  ['Padé', '帕德近似：用有理函数近似纯延时 e^(−sTd)，便于做时域仿真与求闭环极点'],
  ['gmps', '功率级跨导：COMP 电压到电感电流的增益（A/V），电流模式芯片手册常用，等于 1/Ri'],
  ['gmea', '误差放大器（OTA）跨导，即 gm'],
  ['D-CAP', 'TI 的纹波型自适应 COT 控制，用输出电容 ESR 纹波感知电流，无需外部补偿'],
  ['D-CAP3', 'TI 的 COT 控制，内部生成仿真电流斜坡，支持全陶瓷输出电容'],
  ['HRPWM', '高分辨率 PWM：用延迟线把 PWM 边沿细分到 ps 级，提高 DPWM 分辨率、避免极限环'],
  ['CLA', 'C2000 的控制律加速器 Control Law Accelerator：与主 CPU 并行执行控制环路，降低计算延时'],
  ['PFC', '功率因数校正 Power Factor Correction：让输入电流跟随电网电压正弦变化'],
  ['MLCC', '多层陶瓷电容 Multi-Layer Ceramic Capacitor：ESR 很小，容量随直流偏压明显下降'],
  ['VR', '电压调节器 Voltage Regulator（如 CPU 供电的多相 Buck）'],
];
const MAP = new Map(PS.GLOSS.map(([k, v]) => [k, v]));
PS.gloss = k => MAP.get(k) || '';
PS.ab = (k, label) => `<abbr class="t" data-t="${PS.esc(k)}">${label || PS.esc(k)}</abbr>`;
// 长词优先，避免 PID 被 PI 吃掉；用 ASCII 边界（中文字符视为边界）
// 自动注释只针对缩写；Buck/Boost 等普通词与单字母符号只在术语表页显示
const NOAUTO = ['fz', 'fp', 'fi', 'tc', 'Ts', 'Buck', 'Boost', 'Buck-Boost', 'dB', 'JSON', 'PNG', 'Venable', 'Ridley', 'Jian Li', 'Tustin', 'Bode', 'LTspice', 'PSIM', 'SPICE', 'mc'];
const keys = PS.GLOSS.map(x => x[0]).filter(k => !NOAUTO.includes(k)).sort((a, b) => b.length - a.length);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp('(?<![A-Za-z0-9_′])(' + keys.map(esc).join('|') + ')(?![A-Za-z0-9_′(])', 'g');
const SKIP = new Set(['CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'ABBR', 'CANVAS', 'SVG', 'svg']);
PS.annotate = function (root) {
  if (!root || typeof document === 'undefined') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) if (p.nodeType === 1 && (SKIP.has(p.tagName) || p.classList.contains('no-t'))) return NodeFilter.FILTER_REJECT;
      RE.lastIndex = 0; return RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  list.forEach(n => {
    const frag = document.createDocumentFragment(), s = n.nodeValue; let last = 0; RE.lastIndex = 0; let m;
    while ((m = RE.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const a = document.createElement('abbr'); a.className = 't'; a.dataset.t = m[1]; a.textContent = m[1]; a.tabIndex = 0; frag.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    n.parentNode.replaceChild(frag, n);
  });
};
// 全局悬停气泡（一个 div 复用），键盘聚焦同样可见
PS.initTips = function () {
  const tip = document.createElement('div'); tip.className = 'gtip'; tip.hidden = true; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const show = el => {
    const k = el.dataset.t, txt = PS.gloss(k); if (!txt) return;
    tip.innerHTML = '<b>' + PS.esc(k) + '</b> ' + PS.esc(txt); tip.hidden = false;
    const r = el.getBoundingClientRect(), tw = Math.min(320, tip.offsetWidth);
    tip.style.left = Math.max(6, Math.min(innerWidth - tw - 6, r.left)) + 'px';
    tip.style.top = (r.bottom + 6 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px';
  };
  document.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('abbr.t'); if (a) show(a); });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('abbr.t')) tip.hidden = true; });
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('abbr.t')) show(e.target); });
  document.addEventListener('focusout', () => { tip.hidden = true; });
};
})(typeof window !== 'undefined' ? window : globalThis);
