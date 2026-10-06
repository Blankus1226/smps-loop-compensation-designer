# 桌面版外壳：pywebview 窗口加载与网页版完全相同的单文件 HTML
# 文件保存走原生“另存为”对话框（网页版走浏览器下载）
import sys, os, base64, pathlib
import webview

NAME = '环路补偿设计工具'

def html_path():
    base = pathlib.Path(getattr(sys, '_MEIPASS', pathlib.Path(__file__).resolve().parent / 'dist'))
    return base / f'{NAME}.html'

def ds_dir():
    # 数据手册目录：exe 同级的 数据手册\，或源码目录上一级的 数据手册\
    exe_dir = pathlib.Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else pathlib.Path(__file__).resolve().parent.parent
    for d in (exe_dir / '数据手册', exe_dir.parent / '数据手册'):
        if d.is_dir():
            return d
    return None

class Api:
    def open_datasheet(self, name, url=''):
        # 只允许打开 数据手册\ 目录下的 PDF 文件名（防止路径穿越）；找不到时用浏览器打开官网地址
        d = ds_dir()
        if d and name and os.path.basename(name) == name and name.lower().endswith('.pdf') and (d / name).is_file():
            os.startfile(str(d / name))
            return str(d / name)
        if url.startswith('https://'):
            import webbrowser
            webbrowser.open(url)
            return url
        return ''

    def save_file(self, name, content, is_b64=False):
        win = webview.windows[0]
        ext = os.path.splitext(name)[1].lstrip('.') or 'txt'
        r = win.create_file_dialog(webview.FileDialog.SAVE, save_filename=name,
                                   file_types=(f'{ext.upper()} 文件 (*.{ext})', '所有文件 (*.*)'))
        if not r:
            return ''
        path = r if isinstance(r, str) else r[0]
        data = base64.b64decode(content) if is_b64 else content.encode('utf-8')
        with open(path, 'wb') as f:
            f.write(data)
        return path

def selftest(win, out):
    # 自检：LCD_SELFTEST=结果文件路径 时，页面加载后读取关键状态写入文件并退出
    import time, json
    time.sleep(4)
    r = {}
    try:
        r['title'] = win.evaluate_js('document.title')
        r['fc'] = win.evaluate_js('PS.UI.R && PS.UI.R.mg ? PS.UI.R.mg.fc : null')
        r['pm'] = win.evaluate_js('PS.UI.R && PS.UI.R.mg ? PS.UI.R.mg.pm : null')
        r['kpis'] = win.evaluate_js('document.querySelectorAll("#kpis .kpi").length')
        r['api'] = win.evaluate_js('!!(window.pywebview && window.pywebview.api && window.pywebview.api.save_file)')
        r['engine'] = win.evaluate_js('navigator.userAgent')
    except Exception as e:
        r['error'] = repr(e)
    pathlib.Path(out).write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding='utf-8')
    win.destroy()

if __name__ == '__main__':
    win = webview.create_window(NAME, url=html_path().as_uri(), js_api=Api(), width=1440, height=920, min_size=(900, 600))
    st = os.environ.get('LCD_SELFTEST')
    webview.start(selftest, (win, st)) if st else webview.start()
