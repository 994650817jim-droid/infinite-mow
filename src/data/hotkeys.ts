/**
 * 战斗快捷键表（用户 2026-11-18「帮我做快捷键游戏战斗的」，电脑版为主）。
 * 每个动作一个主键（可在设置「快捷键」里改，存 localStorage）+ 固定的副键（如 Esc 之外的 P、Enter 之外的 Space、数字小键盘）。
 * 同一个动作在不同面板里含义相同或相近，所以一个键只属于一个动作，不会冲突：
 *  - pick1–4：三选一 / 首领遗珍 / 战地招募选卡；行营休整切页签；招降弹窗 1 劝降、2 斩杀、3 再压一压（默认数字键由弹窗自己处理）；
 *  - confirm（Enter）：确认 / 行营「率军出征」/ 结算主行动；
 *  - back（Esc）：战斗中暂停（原有）；面板里关闭 / 返回 / 跳过；
 *  - reroll（R）：三选一刷新 / 结算「再来一局」（原有）。
 * 移动（WASD / 方向键）固定不可改，只在列表里显示。
 */
export type HotkeyAction =
  | 'back' | 'potion' | 'order' | 'sortie' | 'bag' | 'attributes' | 'build' | 'map' | 'menu'
  | 'pick1' | 'pick2' | 'pick3' | 'pick4' | 'reroll' | 'confirm';

export interface HotkeyDef {
  label: string;
  /** 设置页说明（在哪些界面起作用）。 */
  where: string;
  /** 默认主键（KeyboardEvent.code）。 */
  key: string;
  /** 固定副键（不可改）。 */
  alt?: readonly string[];
}

export const HOTKEYS: Record<HotkeyAction, HotkeyDef> = {
  back: { label: '暂停 / 关闭 / 跳过', where: '战斗中暂停；面板里返回、关闭', key: 'Escape', alt: ['KeyP'] },
  potion: { label: '服药', where: '战斗中', key: 'KeyQ' },
  order: { label: '护阵 / 出击 切换', where: '战斗中', key: 'KeyE' },
  sortie: { label: '出击', where: '战斗中（已在出击时不变）', key: 'KeyF' },
  bag: { label: '行囊', where: '战斗中开关；行营休整', key: 'KeyB', alt: ['Tab'] },
  attributes: { label: '属性加点', where: '战斗中有属性点时开关', key: 'KeyC' },
  build: { label: '战法构筑', where: '战斗中开关', key: 'KeyV' },
  // 2026-11-18 战场地图（battle-map-design.md）：M 已给返回主菜单，Tab 给行囊，取 G
  map: { label: '战场地图', where: '战斗中开关大地图（小地图常显）', key: 'KeyG' },
  // 2026-11-18 用户「返回主菜单按钮，三处都加」：暂停菜单里按一次待确认、再按一次执行；天下地图 / 义军营寨直接回主页
  menu: { label: '返回主菜单', where: '暂停菜单（再按一次确认）；天下地图 / 义军营寨', key: 'KeyM' },
  pick1: { label: '选第 1 项', where: '三选一 / 遗珍 / 招募；休整页签 1；劝降', key: 'Digit1', alt: ['Numpad1'] },
  pick2: { label: '选第 2 项', where: '三选一 / 遗珍 / 招募；休整页签 2；斩杀', key: 'Digit2', alt: ['Numpad2'] },
  pick3: { label: '选第 3 项', where: '三选一 / 遗珍 / 招募；休整页签 3；再压一压', key: 'Digit3', alt: ['Numpad3'] },
  pick4: { label: '选第 4 项', where: '招募第 4 张卡；休整页签 4', key: 'Digit4', alt: ['Numpad4'] },
  reroll: { label: '刷新 / 再来一局', where: '三选一刷新；结算再来一局', key: 'KeyR' },
  confirm: { label: '确认 / 出征', where: '结算主行动；休整「率军出征」；剧情确认', key: 'Enter', alt: ['Space', 'NumpadEnter'] },
};
export const HOTKEY_ORDER = Object.keys(HOTKEYS) as HotkeyAction[];
/** 固定键（不可改）：设置页只列出。 */
export const FIXED_KEYS: ReadonlyArray<{ label: string; keys: string }> = [
  { label: '移动', keys: 'W A S D / 方向键' },
];
/** 改键时不允许用的键（移动键、系统键）。 */
export const RESERVED_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);

const STORE = 'im_hotkeys_v1';
let cache: Partial<Record<HotkeyAction, string>> | null = null;
function load(): Partial<Record<HotkeyAction, string>> {
  if (cache) return cache;
  try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}'); cache = v && typeof v === 'object' ? v : {}; } catch { cache = {}; }
  return cache!;
}
function save(v: Partial<Record<HotkeyAction, string>>): void { cache = v; try { if (Object.keys(v).length) localStorage.setItem(STORE, JSON.stringify(v)); else localStorage.removeItem(STORE); } catch { /* 无痕模式等 */ } }

/** 当前主键。 */
export function hotkeyCode(a: HotkeyAction): string { return load()[a] ?? HOTKEYS[a].key; }
/** 当前全部生效的键（主键 + 不和别的动作主键冲突的副键）。 */
export function hotkeyCodes(a: HotkeyAction): string[] {
  const main = hotkeyCode(a), taken = new Set(HOTKEY_ORDER.filter(x => x !== a).map(hotkeyCode));
  return [main, ...(HOTKEYS[a].alt ?? []).filter(c => c !== main && !taken.has(c))];
}
/** 这个键对应哪个动作（没有则 null）。 */
export function actionFor(code: string): HotkeyAction | null {
  for (const a of HOTKEY_ORDER) if (hotkeyCode(a) === code) return a;
  for (const a of HOTKEY_ORDER) if (hotkeyCodes(a).includes(code)) return a;
  return null;
}
/** 改键：返回冲突的动作（有冲突时不改）。force=true 时与冲突方互换。 */
export function setHotkey(a: HotkeyAction, code: string, force = false): { ok: boolean; conflict: HotkeyAction | null; reserved?: boolean } {
  if (RESERVED_CODES.has(code)) return { ok: false, conflict: null, reserved: true };
  // 只有别的动作的「主键」算冲突；别的动作的副键被占用时那个副键自动失效（hotkeyCodes 会排除）
  const other = HOTKEY_ORDER.find(x => x !== a && hotkeyCode(x) === code) ?? null;
  if (other && !force) return { ok: false, conflict: other };
  const v = { ...load() }, mine = hotkeyCode(a);
  if (other) { if (mine === HOTKEYS[other].key) delete v[other]; else v[other] = mine; } // 互换
  if (code === HOTKEYS[a].key) delete v[a]; else v[a] = code;
  save(v);
  return { ok: true, conflict: other };
}
export function resetHotkeys(): void { save({}); }
/** 主键之间有没有重复（测试 / 设置页自检用）。 */
export function hotkeyConflicts(): HotkeyAction[][] {
  const by = new Map<string, HotkeyAction[]>();
  for (const a of HOTKEY_ORDER) for (const c of hotkeyCodes(a)) by.set(c, [...(by.get(c) ?? []), a]);
  return [...by.values()].filter(l => l.length > 1);
}

/** 键在界面上的写法（短）。 */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return '小键盘' + code.slice(6);
  return ({ Escape: 'Esc', Enter: 'Enter', Space: '空格', Tab: 'Tab', Backspace: '退格', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps' } as Record<string, string>)[code] ?? code;
}
export function hotkeyLabel(a: HotkeyAction): string { return keyName(hotkeyCode(a)); }

/** 合成键盘事件（手柄 synthKey）只有 key 没有 code：按 key 补出 code。 */
export function eventCode(e: KeyboardEvent): string {
  if (e.code) return e.code;
  const k = e.key;
  if (k === 'Escape' || k === 'Enter' || k === 'Tab') return k;
  if (k === ' ') return 'Space';
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  if (/^[a-z]$/i.test(k)) return 'Key' + k.toUpperCase();
  return k;
}
/** 焦点在文字输入框里（改名等）时不触发快捷键。 */
export function typingTarget(e: Event): boolean {
  const t = (e.target ?? document.activeElement) as HTMLElement | null, a = document.activeElement as HTMLElement | null;
  const typing = (el: HTMLElement | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  return typing(t) || typing(a);
}
