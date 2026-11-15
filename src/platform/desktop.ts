/**
 * 桌面版（Steam / Electron）平台层。STEAM_PLAN.md · S1。
 * 必须在 main.ts 里最先导入：在任何代码读写 localStorage 之前，把它换成“存到本地存档文件”的同步实现，
 * 这样现有存档代码不用改，桌面版存档落在用户数据目录的 save.json（便于 Steam 云存档同步）。
 * 网页版没有 window.imDesktop，本模块什么都不做。
 */
interface DesktopBridge {
  platform: 'desktop';
  /** 仅自动测试（IM_TEST=1 启动）为 true。 */
  testMode?: boolean;
  store: { load(): Record<string, string> | null; set(key: string, value: string): boolean; remove(key: string): boolean; replace(all: Record<string, string>): boolean; path(): string };
  quit(): void; toggleFullscreen(): void; isFullscreen(): boolean;
  /** Steam 成就（S3）：有 steamworks.js 与 App ID 时同步，否则忽略。 */
  achievement?(id: string): void; steamStatus?(): { enabled: boolean; reason: string };
  /** 显示设置（S2）：窗口分辨率、全屏、垂直同步（重启生效）。 */
  display?: { get(): DisplaySettings; set(patch: Partial<Pick<DisplaySettings, 'width' | 'height' | 'fullscreen' | 'vsync'>>): DisplaySettings };
}
export interface DisplaySettings { width: number; height: number; fullscreen: boolean; vsync: boolean; vsyncActive: boolean; resolutions: [number, number][] }
declare global { interface Window { imDesktop?: DesktopBridge } }

export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? window.imDesktop : undefined;
export const IS_DESKTOP_APP = !!desktop;

/** 以存档文件为后端的 Storage 实现（同步，接口与 localStorage 一致）。 */
class FileStorage implements Storage {
  constructor(private data: Record<string, string>, private bridge: DesktopBridge) {}
  get length(): number { return Object.keys(this.data).length; }
  key(i: number): string | null { return Object.keys(this.data)[i] ?? null; }
  getItem(key: string): string | null { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
  setItem(key: string, value: string): void { const v = String(value); this.data[String(key)] = v; if (!this.bridge.store.set(String(key), v)) throw new DOMException('存档写入失败', 'QuotaExceededError'); }
  removeItem(key: string): void { delete this.data[String(key)]; this.bridge.store.remove(String(key)); }
  clear(): void { this.data = {}; this.bridge.store.replace({}); }
  [name: string]: unknown;
}

if (desktop) {
  let data = desktop.store.load();
  if (!data) {
    // 首次启动：把（桌面外壳自带的）浏览器存储里已有的键迁移进存档文件
    data = {};
    try { for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k !== null) data[k] = window.localStorage.getItem(k) ?? ''; } } catch { /* 无旧存档 */ }
    desktop.store.replace(data);
  }
  const storage = new FileStorage({ ...data }, desktop);
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => storage });
}
