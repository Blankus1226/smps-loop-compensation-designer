# 界面交互自检：Edge 无头加载 HTML，注入脚本遍历 预设×模式×标签页、手动微调、JSON 往返、主题，
# 结果写入 <pre id="ui-result">，用 --dump-dom 取回。python test/t_ui.py
import subprocess, tempfile, shutil, pathlib, sys, re, json, html as H
sys.stdout.reconfigure(encoding='utf-8')
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
here = pathlib.Path(__file__).resolve().parent
src = (here.parent / 'dist' / '环路补偿设计工具.html').read_text(encoding='utf-8')
probe = r'''
<script>
window.addEventListener('error', e => (window.__errs = window.__errs || []).push(String(e.message)));
window.addEventListener('load', () => setTimeout(async () => {
  const UI = PS.UI, out = [], errs = () => (window.__errs || []).length, sleep = ms => new Promise(r => setTimeout(r, ms));
  const chk = (name, fn) => { try { const r = fn(); out.push([name, r === false ? 'FAIL' : 'ok', String(r)]); } catch (e) { out.push([name, 'ERR', e.message]); } };
  const tabs = ['design', 'sweep', 'step', 'export', 'learn', 'gloss'];
  for (let i = 0; i < PS.PRESETS.length; i++) {
    UI.load(PS.preset(i));
    for (const t of tabs) { UI.tab('tb-' + t); await sleep(t === 'step' ? 400 : 30); }
    chk('preset' + i + ' 设计', () => !!UI.R && !UI.R.fatal && document.querySelectorAll('#kpis .kpi').length > 3);
    chk('preset' + i + ' 仿真', () => !!UI.S && !UI.S.err && UI.S.av.v.length > 50);
    chk('preset' + i + ' 扫描', () => document.querySelectorAll('#sweep-table tr').length >= 5);
    chk('preset' + i + ' 导出', () => { for (const e of UI.EXPORTS) { const s = e[2](); if (!s || s.length < 20) return false; } return true; });
  }
  UI.tab('tb-design');
  for (const m of ['vmc', 'pcmc', 'acm', 'coti', 'cotr']) for (const im of ['analog', 'digital']) for (const fam of ['opamp', 'ota']) {
    UI.load(PS.preset(0)); UI.set('mode', m); UI.set('impl', im); if (im === 'analog') UI.set('family', fam);
    chk(`切换 ${m}/${im}/${fam}`, () => !!UI.R && !UI.R.fatal);
  }
  // E 系列下拉：通过真实 <select> 切换，元件表随之变化；取消圆整时下拉隐藏
  UI.load(PS.preset(0));
  const etab = () => document.getElementById('comp-tables').textContent, pick = (k, v) => { const el = document.getElementById('f-' + k); el.value = v; el.onchange({ target: el }); };
  const e0 = etab(); pick('eR', '12'); const e1 = etab(); pick('eC', '6'); const e2 = etab();
  chk('E 系列切换电阻', () => UI.P.eR === 12 && e1 !== e0 && e1.includes('E12 / E24'));
  chk('E 系列切换电容', () => UI.P.eC === 6 && e2 !== e1 && UI.R.rz.parts.filter(p => p.unit === 'F').every(p => PS.E_SERIES[6].some(x => Math.abs(p.val / Math.pow(10, Math.floor(Math.log10(p.val))) * 10 - x) < 1e-6)));
  const ck = document.querySelector('#form [data-k="roundE"] input'); ck.checked = false; ck.onchange({ target: ck });
  chk('取消圆整隐藏系列下拉', () => document.querySelector('#form [data-k="eR"]').hidden && !UI.P.roundE);
  UI.load(PS.preset(0)); const t = document.getElementById('tune-on'); t.checked = true; t.onchange();
  chk('手动微调启用', () => UI.P.manual && document.querySelectorAll('#tune input[type=range]').length === 5);
  const s = document.getElementById('tn-fc'); s.value = 600; s.oninput();
  chk('滑杆改 fc', () => Math.abs(UI.R.mg.fc / UI.P.fc - 1) < 0.1);
  const inp = document.getElementById('f-L'); inp.value = '10u'; inp.dispatchEvent(new Event('change'));
  chk('输入 10u', () => Math.abs(UI.P.L - 10e-6) < 1e-12);
  inp.value = 'abc'; inp.dispatchEvent(new Event('change')); chk('非法输入标红', () => inp.classList.contains('bad') && Math.abs(UI.P.L - 10e-6) < 1e-12);
  const js = UI.EXPORTS[0][2](); UI.load(PS.preset(3)); const o = JSON.parse(js); UI.load(o);
  chk('JSON 往返', () => Math.abs(UI.P.L - 10e-6) < 1e-12 && UI.P.manual === true);
  UI.setTheme('dark'); chk('深色主题', () => document.documentElement.dataset.theme === 'dark'); UI.setTheme('light');
  UI.tab('tb-learn'); for (const l of PS.Learn.L) { PS.Learn.cur = l.id; PS.Learn.show(); chk('课程 ' + l.id, () => document.querySelector('#ls-plot canvas') !== null); }
  chk('术语注释数', () => document.querySelectorAll('abbr.t').length > 30);
  chk('无 JS 报错', () => errs() === 0 || (window.__errs || []).join(' | '));
  const pre = document.createElement('pre'); pre.id = 'ui-result'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
}, 300));
</script>'''
f = here / '_ui_probe.html'
f.write_text(src.replace('</body>', probe + '</body>'), encoding='utf-8')
prof = tempfile.mkdtemp(prefix='lcd_ui_')
try:
    r = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={prof}', '--window-size=1500,1200',
                        '--virtual-time-budget=120000', '--dump-dom', f.as_uri()], capture_output=True, timeout=300, text=True, encoding='utf-8', errors='ignore')
finally:
    shutil.rmtree(prof, ignore_errors=True); f.unlink()
m = re.search(r'<pre id="ui-result">(.*?)</pre>', r.stdout, re.S)
if not m: print('未取得结果'); print(r.stdout[-800:]); sys.exit(1)
res = json.loads(H.unescape(m.group(1))); bad = [x for x in res if x[1] != 'ok']
for x in res: print(('PASS ' if x[1] == 'ok' else x[1] + ' ') + x[0] + ('' if x[1] == 'ok' else '  ' + x[2]))
print(f'共 {len(res)} 项，问题 {len(bad)} 项'); sys.exit(1 if bad else 0)
