// 桌面版预加载：向游戏暴露最小接口（存档同步读写、退出、全屏），不暴露 Node 能力。
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('imDesktop', {
  platform: 'desktop',
  testMode: process.env.IM_TEST === '1',
  store: {
    load: () => ipcRenderer.sendSync('store:load'),
    set: (key, value) => ipcRenderer.sendSync('store:set', key, value),
    remove: key => ipcRenderer.sendSync('store:remove', key),
    replace: all => ipcRenderer.sendSync('store:replace', all),
    path: () => ipcRenderer.sendSync('store:path'),
  },
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
  isFullscreen: () => ipcRenderer.sendSync('app:isFullscreen'),
  // 显示设置：{ width, height, fullscreen, vsync, vsyncActive, resolutions }
  display: {
    get: () => ipcRenderer.sendSync('display:get'),
    set: patch => ipcRenderer.sendSync('display:set', patch),
  },
});
