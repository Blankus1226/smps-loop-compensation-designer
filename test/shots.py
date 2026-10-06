# Edge 无头截图 + 控制台错误收集：python test/shots.py [过滤词...]
import subprocess, tempfile, shutil, pathlib, sys
sys.stdout.reconfigure(encoding='utf-8')
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
here = pathlib.Path(__file__).resolve().parent
html = here.parent / 'dist' / '环路补偿设计工具.html'
out = here / 'shots'; out.mkdir(exist_ok=True)
CASES = [
    ('design_buck', 'tab=design'), ('design_boost', 'tab=design&preset=1'), ('design_dig', 'tab=design&preset=2'),
    ('design_cotr', 'tab=design&preset=3'), ('design_acm', 'tab=design&preset=4'), ('design_dark', 'tab=design&preset=5&theme=dark'),
    ('sweep', 'tab=sweep&preset=1'), ('step', 'tab=step'), ('step_dig', 'tab=step&preset=2'), ('export', 'tab=export'),
    ('learn_pm', 'tab=learn&lesson=pmgm'), ('learn_t3', 'tab=learn&lesson=type3'), ('learn_ota3', 'tab=learn&lesson=ota3'),
    ('learn_pcmc', 'tab=learn&lesson=pcmc'), ('learn_cot', 'tab=learn&lesson=cot'), ('learn_3p3z', 'tab=learn&lesson=d3p3z&theme=dark'), ('learn_ex1', 'tab=learn&lesson=ex_vmc'), ('learn_ex4', 'tab=learn&lesson=ex_dig'), ('learn_t2', 'tab=learn&lesson=type2'),
    ('gloss', 'tab=gloss'),
    ('learn_start', 'tab=learn&lesson=start'), ('learn_lap', 'tab=learn&lesson=lap'), ('learn_spz', 'tab=learn&lesson=spz'), ('learn_bodeasy', 'tab=learn&lesson=bodeasy'),
    ('learn_avg', 'tab=learn&lesson=avg'), ('learn_fb', 'tab=learn&lesson=fb'), ('learn_pmtime', 'tab=learn&lesson=pmtime'), ('learn_typeN', 'tab=learn&lesson=typeN'),
    ('learn_nyq', 'tab=learn&lesson=nyq'), ('learn_olread', 'tab=learn&lesson=olread'), ('learn_pzwhy', 'tab=learn&lesson=pzwhy'), ('learn_olmeas', 'tab=learn&lesson=olmeas'),
    ('learn_cmidea', 'tab=learn&lesson=cmidea'), ('learn_cmt2', 'tab=learn&lesson=cmt2'), ('learn_acmin', 'tab=learn&lesson=acmin'), ('learn_cmcot', 'tab=learn&lesson=cmcot'),
    ('learn_samp', 'tab=learn&lesson=samp'), ('learn_ztr', 'tab=learn&lesson=ztr&theme=dark'), ('learn_disc', 'tab=learn&lesson=disc'), ('learn_quant', 'tab=learn&lesson=quant'),
    ('learn_chips', 'tab=learn&lesson=chips'), ('learn_ex3', 'tab=learn&lesson=ex_acm'),
]
flt = sys.argv[1:]
bad = 0
for name, q in CASES:
    if flt and not any(f in name for f in flt): continue
    png = out / (name + '.png')
    if png.exists(): png.unlink()
    prof = tempfile.mkdtemp(prefix='lcd_shot_')
    url = html.as_uri() + '?' + q
    try:
        r = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', f'--user-data-dir={prof}',
                            '--window-size=1600,' + ('4200' if name.startswith('learn') else '2200'), '--virtual-time-budget=6000', '--enable-logging=stderr', '--v=0',
                            f'--screenshot={png}', url], capture_output=True, timeout=120, text=True, encoding='utf-8', errors='ignore')
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    errs = [l for l in (r.stderr or '').splitlines() if 'CONSOLE' in l and ('Error' in l or 'error' in l or 'Uncaught' in l)]
    ok = png.exists() and png.stat().st_size > 20000 and not errs
    if not ok: bad += 1
    print(('OK  ' if ok else 'BAD ') + f'{name:14s} {png.stat().st_size if png.exists() else 0:>8d}B ' + ' | '.join(errs[:3]))
print(f'问题 {bad} 项')
