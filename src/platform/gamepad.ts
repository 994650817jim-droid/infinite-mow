/**
 * 手柄输入（STEAM_PLAN.md · S2）。直接轮询 navigator.getGamepads()（标准映射：Xbox / Steam Deck / 多数 PS 手柄经 Steam Input），
 * 不依赖 Phaser 手柄插件，所有场景共用一份状态；每帧由 main.ts 的 game prestep 调用 update()。
 * 同时记录“最近一次输入来自手柄还是键鼠”，界面据此切换按键提示。
 */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
export type PadButton = typeof PAD[keyof typeof PAD];
export type InputDevice = 'pad' | 'kbm';

const DEADZONE = 0.22;

/** 手柄按键在界面上的写法（Xbox 布局；Steam Deck 同为 A/B/X/Y）。 */
export const PAD_LABEL: Record<'A' | 'B' | 'X' | 'Y' | 'START', string> = { A: 'Ⓐ', B: 'Ⓑ', X: 'Ⓧ', Y: 'Ⓨ', START: '☰' };

class GamepadState {
  device: InputDevice = 'kbm';
  connected = false;
  /** 左摇杆（已去死区、半径归一）与十字键合成的方向，范围 [-1,1]。 */
  readonly move = { x: 0, y: 0 };
  /** 右摇杆纵向（用于滚动列表）。 */
  scrollY = 0;
  private down = new Set<number>();
  private pressed = new Set<number>();
  private listeners = new Set<(d: InputDevice) => void>();
  /** 由手柄触发的合成键盘事件期间置位，避免把输入设备误判为键鼠。 */
  synthetic = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const kbm = (): void => { if (!this.synthetic) this.setDevice('kbm'); };
    window.addEventListener('keydown', kbm, true);
    window.addEventListener('pointerdown', kbm, true);
    let lx = -1, ly = -1;
    window.addEventListener('pointermove', e => {
      // 鼠标真的挪动了一段才算切回键鼠（避免手柄操作时鼠标微抖）
      if (lx >= 0 && Math.hypot(e.clientX - lx, e.clientY - ly) > 12) kbm();
      lx = e.clientX; ly = e.clientY;
    }, true);
  }

  onDeviceChange(fn: (d: InputDevice) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private setDevice(d: InputDevice): void {
    if (this.device === d) return;
    this.device = d;
    for (const fn of [...this.listeners]) try { fn(d); } catch { /* 界面已销毁 */ }
  }

  /** 每帧调用一次。 */
  update(): void {
    this.pressed.clear();
    let pad: Gamepad | null = null;
    try { for (const p of navigator.getGamepads?.() ?? []) if (p && p.connected) { pad = p; break; } } catch { /* 不支持 */ }
    this.connected = !!pad;
    if (!pad) { this.down.clear(); this.move.x = this.move.y = 0; this.scrollY = 0; return; }
    const now = new Set<number>();
    pad.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) now.add(i); });
    for (const i of now) if (!this.down.has(i)) this.pressed.add(i);
    this.down = now;
    let x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
    const len = Math.hypot(x, y);
    if (len < DEADZONE) { x = 0; y = 0; } else { const k = Math.min(1, (len - DEADZONE) / (1 - DEADZONE)) / len; x *= k; y *= k; }
    const dx = (now.has(PAD.RIGHT) ? 1 : 0) - (now.has(PAD.LEFT) ? 1 : 0), dy = (now.has(PAD.DOWN) ? 1 : 0) - (now.has(PAD.UP) ? 1 : 0);
    if (dx || dy) { const l = Math.hypot(dx, dy); x = dx / l; y = dy / l; }
    this.move.x = x; this.move.y = y;
    const ry = pad.axes[3] ?? 0;
    this.scrollY = Math.abs(ry) < DEADZONE ? 0 : ry;
    if (this.pressed.size || x || y || this.scrollY) this.setDevice('pad');
  }

  isDown(b: PadButton): boolean { return this.down.has(b); }
  justPressed(b: PadButton): boolean { return this.pressed.has(b); }
  /** 本帧新按下的所有键。 */
  pressedButtons(): number[] { return [...this.pressed]; }
}

export const gamepad = new GamepadState();

/** 按当前输入设备选择提示文字。 */
export function keyHint(keyboard: string, pad: string): string { return gamepad.device === 'pad' ? pad : keyboard; }

/**
 * 向窗口派发一个合成键盘事件（复用各场景已有的 ESC / ENTER / 数字键逻辑）。
 * Phaser 读取 keyCode，合成事件需要显式写入。
 */
export function synthKey(key: string, keyCode: number): void {
  gamepad.synthetic = true;
  try {
    for (const type of ['keydown', 'keyup']) {
      const ev = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
      Object.defineProperty(ev, 'which', { get: () => keyCode });
      window.dispatchEvent(ev);
    }
  } finally { gamepad.synthetic = false; }
}
