# 用本机 LTspice 批处理验证导出网表：python test/t_spice.py [avg|sw] [预设号...]
# 平均模型：比较 LTspice 测得 fc/PM 与工具计算值；开关模型：检查稳态电压与阶跃跌落
import subprocess, json, sys, os, re, pathlib, time
sys.stdout.reconfigure(encoding='utf-8')
LT = r'D:\ADI\LTspice.exe'
here = pathlib.Path(__file__).resolve().parent
out = here / 'spice'; out.mkdir(exist_ok=True)
kind = sys.argv[1] if len(sys.argv) > 1 else 'avg'
sel = [int(x) for x in sys.argv[2:]] or None
js = r'''
const PS = require(%r)();
const res = [];
const cases = PS.PRESETS.map((p, i) => [p.name, PS.preset(i)]);
cases.push(['Buck PCMC 运放', Object.assign(PS.clone(PS.DEFAULTS), { mode: 'pcmc' })]);
cases.push(['Buck ACM 数字', Object.assign(PS.clone(PS.DEFAULTS), { mode: 'acm', impl: 'digital', fs: 200e3, L: 22e-6, C: 220e-6, Rc: 10e-3 })]);
cases.push(['Buck COT-I', Object.assign(PS.clone(PS.DEFAULTS), { mode: 'coti' })]);
cases.push(['Buck OTA Type III VMC', Object.assign(PS.clone(PS.DEFAULTS), { family: 'ota' })]);
cases.forEach(([name, P], i) => {
  const R = PS.design(P);
  const S = %s ? PS.simulate(R) : null;
  res.push({ i, name, net: PS.%s(R), fc: R.mg ? R.mg.fc : null, pm: R.mg ? R.mg.pm : null,
    Vpre: S && S.Vpre, dv: S && S.up.dv, Vo: P.Vo,
    rawMin: S && Math.min(...S.rec.vo.filter((v, k) => S.rec.t[k] >= S.T1 && S.rec.t[k] < S.T2)) });
});
console.log(JSON.stringify(res));
''' % (str(here / 'load.js').replace('\\', '/'), 'true' if kind == 'sw' else 'false', 'netSw' if kind == 'sw' else 'netAvg')
r = subprocess.run(['node', '-e', js], capture_output=True, text=True, encoding='utf-8')
if r.returncode: print(r.stderr); sys.exit(1)
cases = json.loads(r.stdout)
bad = 0
for c in cases:
    if sel and c['i'] not in sel: continue
    f = out / f'{kind}_{c["i"]}.cir'
    f.write_text(c['net'], encoding='utf-8')
    log = f.with_suffix('.log')
    if log.exists(): log.unlink()
    t0 = time.time()
    try:
        subprocess.run([LT, '-b', str(f)], capture_output=True, timeout=int(os.environ.get('LT_TIMEOUT', '400')))
    except subprocess.TimeoutExpired:
        subprocess.run(['taskkill', '/F', '/IM', 'LTspice.exe'], capture_output=True)
        print(f'FAIL {c["name"]:40s} LTspice 超时'); bad += 1; continue
    raw = log.read_bytes() if log.exists() else b''
    txt = raw.decode('utf-16-le', errors='ignore') if b'\x00' in raw[:200] else raw.decode('utf-8', errors='ignore')
    m = lambda k: (re.search(rf'^{k}:.*?=\s*\(?([-\d.e+]+)', txt, re.I | re.M) or [None, None])[1]
    dt = time.time() - t0
    if kind == 'avg':
        fc = (re.search(r'^fc:.*?AT\s+([-\d.e+]+)', txt, re.M) or [None, None])[1]
        pd = re.search(r'^tfc:.*?\(\s*[-\d.e+]+dB,\s*([-\d.e+]+)°', txt, re.M)
        ph = None
        if pd:
            v = float(pd.group(1)) + 180
            while v > 180: v -= 360
            ph = round(v, 2)
        msg = f'{c["name"]:40s} 工具 fc={c["fc"] or 0:9.1f} PM={c["pm"] or 0:6.1f} | LTspice fc={fc} PM={ph}  ({dt:.1f}s)'
        okk = fc is not None and c['fc'] and abs(float(fc) / c['fc'] - 1) < 0.08 and abs(float(ph) - c['pm']) < 6
    else:
        vp, vmin = m('vpre'), m('vmin')
        # 两边都用含纹波的瞬时最小值比较跌落
        dvt = c['rawMin'] - c['Vpre']
        msg = f'{c["name"]:40s} 工具 Vpre={c["Vpre"]:.4f} 瞬时ΔV={dvt*1e3:.1f}mV | LTspice Vpre={vp} ΔV={(float(vmin)-float(vp))*1e3 if vp and vmin else 0:.1f}mV  ({dt:.1f}s)'
        okk = vp is not None and abs(float(vp) / c['Vo'] - 1) < 0.01 and abs((float(vmin) - float(vp)) / dvt - 1) < 0.35
    if not okk:
        bad += 1
        errs = [l for l in txt.splitlines() if re.search(r'error|unknown|fail|singular|syntax|time step', l, re.I)][:6]
        msg += '  <-- 问题 ' + ' | '.join(errs)
    print(('PASS ' if okk else 'FAIL ') + msg)
print(f'问题 {bad} 项')
