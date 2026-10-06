// 向页面暴露与 pywebview 版同名的接口（返回 Promise）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  save_file: (name, content, isB64) => ipcRenderer.invoke('save-file', String(name), String(content), !!isB64),
  open_datasheet: (name, url) => ipcRenderer.invoke('open-datasheet', String(name || ''), String(url || '')),
});
