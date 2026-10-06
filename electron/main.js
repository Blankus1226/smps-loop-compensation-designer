// Electron 桌面外壳：加载与网页版相同的单文件 HTML，原生“另存为”与数据手册打开（对应 app.py）
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const NAME = '环路补偿设计工具';

function htmlPath() {
  // 打包后 HTML 位于 resources\，开发时位于 dist\
  return app.isPackaged ? path.join(process.resourcesPath, NAME + '.html')
    : path.join(__dirname, '..', 'dist', NAME + '.html');
}

function dsDir() {
  // 数据手册目录：exe 同级的 数据手册\，或其上一级的 数据手册\（便携版 exe 所在目录由 PORTABLE_EXECUTABLE_DIR 给出）
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR ||
    (app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..', '..'));
  for (const d of [path.join(exeDir, '数据手册'), path.join(exeDir, '..', '数据手册')]) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
  }
  return null;
}

ipcMain.handle('open-datasheet', async (_e, name, url) => {
  // 只允许打开 数据手册\ 目录下的 PDF 文件名（防止路径穿越）；找不到时用浏览器打开官网地址
  const d = dsDir();
  if (d && name && path.basename(name) === name && name.toLowerCase().endsWith('.pdf')) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) { await shell.openPath(p); return p; }
  }
  if (typeof url === 'string' && url.startsWith('https://')) { await shell.openExternal(url); return url; }
  return '';
});

ipcMain.handle('save-file', async (e, name, content, isB64) => {
  const ext = path.extname(name).replace('.', '') || 'txt';
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: name,
    filters: [{ name: ext.toUpperCase() + ' 文件', extensions: [ext] }, { name: '所有文件', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePath) return '';
  fs.writeFileSync(r.filePath, isB64 ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8'));
  return r.filePath;
});

function selftest(win, out) {
  // 自检：LCD_SELFTEST=结果文件路径 时，页面加载后读取关键状态写入文件并退出
  setTimeout(async () => {
    const r = {};
    try {
      r.title = await win.webContents.executeJavaScript('document.title');
      r.fc = await win.webContents.executeJavaScript('PS.UI.R && PS.UI.R.mg ? PS.UI.R.mg.fc : null');
      r.pm = await win.webContents.executeJavaScript('PS.UI.R && PS.UI.R.mg ? PS.UI.R.mg.pm : null');
      r.kpis = await win.webContents.executeJavaScript('document.querySelectorAll("#kpis .kpi").length');
      r.api = await win.webContents.executeJavaScript('!!(window.desktopApi && window.desktopApi.save_file)');
      r.engine = await win.webContents.executeJavaScript('navigator.userAgent');
    } catch (err) { r.error = String(err); }
    fs.writeFileSync(out, JSON.stringify(r, null, 1), 'utf-8');
    app.quit();
  }, 4000);
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    title: NAME, width: 1440, height: 920, minWidth: 900, minHeight: 600, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // 页面内的新窗口一律交给系统浏览器（只放行 https）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(htmlPath());
  if (process.env.LCD_SELFTEST) selftest(win, process.env.LCD_SELFTEST);
});

app.on('window-all-closed', () => app.quit());
