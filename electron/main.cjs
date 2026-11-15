// 《无限割草：乱世千军》桌面版（Steam）主进程。STEAM_PLAN.md · S1。
// - 用私有 app:// 协议加载 dist/（避免 file:// 下的跨域与路径问题）
// - 默认全屏 16:9；F11 / Alt+Enter 切换窗口模式；隐藏菜单栏；打包后禁用开发者工具
// - 存档：用户数据目录下 save.json（同步读写、原子写入），供渲染进程替代浏览器 localStorage，便于 Steam 云存档同步
const { app, BrowserWindow, protocol, net, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const SAVE_FILE = () => path.join(app.getPath('userData'), 'save.json');
const devMode = !app.isPackaged && process.env.IM_DEVTOOLS === '1';
// 自动测试用：指定独立的用户数据目录，避免碰到玩家真实存档
if (process.env.IM_USER_DATA) app.setPath('userData', process.env.IM_USER_DATA);
// 部分 Windows 环境里 Chromium 的 GPU 子进程沙箱启动即“拒绝访问”（0xC0000022），重试 9 次后整个程序退出（0x80000003）。
// 关闭 GPU 进程沙箱即可正常启动，仍保留硬件加速（单机离线游戏，不加载外部网页）。
app.commandLine.appendSwitch('disable-gpu-sandbox');
// 同理：音频服务进程沙箱在这些环境里出错，游戏的 AudioContext 停在 suspended 且报“audio device”错误 → 没有声音。关闭音频服务沙箱。
app.commandLine.appendSwitch('disable-features', 'AudioServiceSandbox');
// 自动测试用：受限环境里再关硬件加速、改软件渲染（玩家不受影响）
if (process.env.IM_SAFE_GPU === '1') app.disableHardwareAcceleration();

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

// —— 存档文件 ——
let store = null;
function loadStore() {
  if (store) return store;
  try { store = JSON.parse(fs.readFileSync(SAVE_FILE(), 'utf8')); if (!store || typeof store !== 'object' || Array.isArray(store)) store = {}; }
  catch { store = null; }
  return store;
}
function writeStore() {
  const file = SAVE_FILE(), tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(store ?? {}), 'utf8');
  fs.renameSync(tmp, file);
}
ipcMain.on('store:load', e => { e.returnValue = loadStore(); });           // null = 还没有存档文件（首次启动，由渲染进程迁移旧存档）
ipcMain.on('store:set', (e, key, value) => { if (!store) store = {}; store[String(key)] = String(value); try { writeStore(); e.returnValue = true; } catch { e.returnValue = false; } });
ipcMain.on('store:remove', (e, key) => { if (!store) store = {}; delete store[String(key)]; try { writeStore(); e.returnValue = true; } catch { e.returnValue = false; } });
ipcMain.on('store:replace', (e, all) => { store = all && typeof all === 'object' ? Object.fromEntries(Object.entries(all).map(([k, v]) => [String(k), String(v)])) : {}; try { writeStore(); e.returnValue = true; } catch { e.returnValue = false; } });
ipcMain.on('store:path', e => { e.returnValue = SAVE_FILE(); });

let win = null;
function toggleFullscreen() { if (win) win.setFullScreen(!win.isFullScreen()); }
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:fullscreen', () => toggleFullscreen());
ipcMain.on('app:isFullscreen', e => { e.returnValue = !!win?.isFullScreen(); });

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, useContentSize: true,
    fullscreen: process.env.IM_WINDOWED !== '1', backgroundColor: '#0b0907', autoHideMenuBar: true, show: false,
    title: '无限割草：乱世千军',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false, nodeIntegration: false, devTools: devMode },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { toggleFullscreen(); event.preventDefault(); }
  });
  // 外部链接不在游戏窗口里打开
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  win.loadURL('app://game/index.html');
  if (devMode) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  protocol.handle('app', request => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
