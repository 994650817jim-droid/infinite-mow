// 《三国：乱世千军》桌面版（Steam）主进程。STEAM_PLAN.md · S1。
// - 用私有 app:// 协议加载 dist/（避免 file:// 下的跨域与路径问题）
// - 默认全屏 16:9；F11 / Alt+Enter 切换窗口模式；隐藏菜单栏；打包后禁用开发者工具
// - 显示设置（分辨率 / 全屏 / 垂直同步）存 display.json（S2）
// - 存档：用户数据目录下 save.json（同步读写、原子写入），供渲染进程替代浏览器 localStorage，便于 Steam 云存档同步
const { app, BrowserWindow, protocol, net, ipcMain, globalShortcut, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { initSteam, unlockAchievement, steamStatus } = require('./steam.cjs');

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
// 开场动画（2026-11-18）：桌面版允许无手势自动出声，开场 CG 直接带配乐（网页版改为先显示「点击 · 入乱世」取得手势）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 自动测试用：受限环境里再关硬件加速、改软件渲染（玩家不受影响）
if (process.env.IM_SAFE_GPU === '1') app.disableHardwareAcceleration();

// —— 显示设置（S2）：窗口分辨率 / 全屏 / 垂直同步，存于用户数据目录 display.json ——
// 垂直同步只能在启动时设定（Chromium 命令行开关），改动后下次启动生效。
const RESOLUTIONS = [[1280, 720], [1280, 800], [1600, 900], [1920, 1080], [2560, 1440]];
const DISPLAY_FILE = () => path.join(app.getPath('userData'), 'display.json');
const DISPLAY_DEFAULT = { width: 1600, height: 900, fullscreen: true, vsync: true };
function loadDisplay() {
  try { const d = JSON.parse(fs.readFileSync(DISPLAY_FILE(), 'utf8')); return { ...DISPLAY_DEFAULT, ...(d && typeof d === 'object' ? d : {}) }; }
  catch { return { ...DISPLAY_DEFAULT }; }
}
function saveDisplay() {
  try { fs.mkdirSync(path.dirname(DISPLAY_FILE()), { recursive: true }); fs.writeFileSync(DISPLAY_FILE(), JSON.stringify(display), 'utf8'); } catch { /* 只读目录时不保存 */ }
}
const display = loadDisplay();
const vsyncActive = display.vsync !== false;
if (!vsyncActive) { app.commandLine.appendSwitch('disable-gpu-vsync'); app.commandLine.appendSwitch('disable-frame-rate-limit'); }

// Steam（可选）：未安装 steamworks.js 或无 App ID 时为空操作
initSteam(app);
ipcMain.on('steam:achievement', (_e, id) => { unlockAchievement(id); });
ipcMain.on('steam:status', e => { e.returnValue = steamStatus(); });

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
/** 当前屏幕放得下的分辨率（窗口模式用）。 */
function availableResolutions() {
  let max = { width: 1920, height: 1080 };
  try { max = screen.getPrimaryDisplay().workAreaSize; } catch { /* 无屏幕信息 */ }
  const list = RESOLUTIONS.filter(([w, h]) => w <= max.width && h <= max.height);
  return list.length ? list : [RESOLUTIONS[0]];
}
function applyWindowSize() {
  if (!win || win.isFullScreen()) return;
  win.setContentSize(display.width, display.height);
  win.center();
}
function displayState() { return { ...display, fullscreen: !!win?.isFullScreen(), vsyncActive, resolutions: availableResolutions() }; }
ipcMain.on('display:get', e => { e.returnValue = displayState(); });
ipcMain.on('display:set', (e, patch) => {
  const p = patch && typeof patch === 'object' ? patch : {};
  if (Number.isFinite(p.width) && Number.isFinite(p.height) && RESOLUTIONS.some(([w, h]) => w === p.width && h === p.height)) { display.width = p.width; display.height = p.height; applyWindowSize(); }
  if (typeof p.fullscreen === 'boolean' && win && win.isFullScreen() !== p.fullscreen) win.setFullScreen(p.fullscreen);
  if (typeof p.vsync === 'boolean') display.vsync = p.vsync;
  saveDisplay();
  e.returnValue = displayState();
});
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('app:fullscreen', () => toggleFullscreen());
ipcMain.on('app:isFullscreen', e => { e.returnValue = !!win?.isFullScreen(); });

function createWindow() {
  win = new BrowserWindow({
    width: display.width, height: display.height, minWidth: 960, minHeight: 540, useContentSize: true,
    fullscreen: process.env.IM_WINDOWED === '1' ? false : display.fullscreen !== false, backgroundColor: '#0b0907', autoHideMenuBar: true, show: false,
    title: '三国：乱世千军', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false, nodeIntegration: false, devTools: devMode },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  // 记住全屏 / 窗口模式；退出全屏时恢复设置里的窗口分辨率
  win.on('enter-full-screen', () => { display.fullscreen = true; saveDisplay(); });
  win.on('leave-full-screen', () => { display.fullscreen = false; saveDisplay(); setTimeout(applyWindowSize, 50); });
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
