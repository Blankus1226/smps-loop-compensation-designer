# 构建：把 src/ 下的 CSS、JS 内联为单文件 HTML，输出到 dist/ 与 试验区根目录
#   python build.py          只构建 HTML
#   python build.py exe      再用 PyInstaller 打包 exe（需 pywebview、pyinstaller）
import pathlib, sys, shutil, subprocess
sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parent
SRC, DIST, OUT = ROOT / 'src', ROOT / 'dist', ROOT.parent
NAME = '环路补偿设计工具'
JS = ['core', 'model', 'loops', 'comp', 'digital', 'analysis', 'design', 'checks', 'sim', 'netlist', 'netsw',
      'plot', 'plot2', 'schem', 'glossary', 'lsys', 'learn', 'learn_a', 'learn_b', 'learn_c', 'learn_d',
      'learn_h', 'learn_x1', 'learn_x2', 'learn_x3', 'learn_x4', 'learn_x5', 'learn_e', 'learn_e2', 'learn_e3',
      'learn_f1', 'learn_f2', 'learn_f3', 'learn_f4', 'learn_f5', 'learn_t1', 'learn_t2', 'learn_chips',
      'ui_form', 'ui_design', 'ui_tune', 'ui_tabs', 'ui_main']
CSS = ['style', 'style2']

def build():
    html = (SRC / 'index.html').read_text(encoding='utf-8')
    css = '\n'.join((SRC / f'{n}.css').read_text(encoding='utf-8') for n in CSS)
    js = '\n'.join(f'/* ==== {n}.js ==== */\n' + (SRC / f'{n}.js').read_text(encoding='utf-8') for n in JS)
    assert '</script' not in js.lower(), 'JS 中不能出现 </script'
    html = html.replace('/*@@CSS@@*/', css).replace('/*@@JS@@*/', js)
    DIST.mkdir(exist_ok=True)
    p = DIST / f'{NAME}.html'
    p.write_text(html, encoding='utf-8')
    shutil.copyfile(p, OUT / f'{NAME}.html')
    print(f'HTML: {p}  ({p.stat().st_size // 1024} KB) → 已复制到 {OUT}')
    return p

def exe():
    cmd = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--onefile', '--windowed', '--name', NAME,
           '--add-data', f'{DIST / (NAME + ".html")};.', '--distpath', str(DIST), '--workpath', str(ROOT / 'build'),
           '--specpath', str(ROOT / 'build'), str(ROOT / 'app.py')]
    if (ROOT / 'icon.ico').exists(): cmd[5:5] = ['--icon', str(ROOT / 'icon.ico')]
    subprocess.run(cmd, check=True)
    e = DIST / f'{NAME}.exe'
    shutil.copyfile(e, OUT / f'{NAME}.exe')
    print(f'EXE: {e}  ({e.stat().st_size // 1024 // 1024} MB) → 已复制到 {OUT}')

if __name__ == '__main__':
    build()
    if 'exe' in sys.argv[1:]: exe()
