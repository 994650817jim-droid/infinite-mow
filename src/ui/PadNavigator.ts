/**
 * 手柄界面导航（STEAM_PLAN.md · S2）：所有菜单 / 面板通用，不需要逐个界面改代码。
 * - 自动收集当前画面最上层“可点击”的对象（有 pointerdown / pointerup 监听、可见、在屏幕内），
 *   全屏遮罩（模态面板的底板）以下的对象不算。
 * - 十字键 / 左摇杆按屏幕位置移动焦点（金色框，同时触发 pointerover / pointerout 悬停效果）；
 *   Ⓐ = 点击（pointerdown + pointerup），Ⓑ = 返回（场景自定义 → “返回 / 关闭”按钮 → ESC），右摇杆 = 滚轮。
 * - 场景可实现 PadAware：padCapture() 为 true 时（战斗进行中）导航让出，按键交给 padButton()。
 * 对象可 setData('padDefault', true) 指定默认焦点，setData('padSkip', true) 排除，
 * setData('padAdjust', dir => …) 让左右键调节数值（滑条）而不是移动焦点。
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';
import { PAD, gamepad, synthKey } from '../platform/gamepad';

export interface PadAware {
  /** true：本帧手柄不做界面导航（例如战斗中摇杆用于移动）。 */
  padCapture?(): boolean;
  /** 处理手柄按键；返回 true 表示已处理。 */
  padButton?(button: number): boolean;
  /** 过滤导航候选对象（例如战斗面板打开时排除 HUD）。 */
  padFilter?(obj: Phaser.GameObjects.GameObject): boolean;
}

type GO = Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Depth> & { parentContainer?: Phaser.GameObjects.Container; getBounds?: () => Phaser.Geom.Rectangle; scrollFactorX?: number; scrollFactorY?: number; text?: string };
interface Candidate { obj: GO; scene: Phaser.Scene; x: number; y: number; w: number; h: number; order: number }

const BACK_LABEL = /^(返回|关闭|取消|离开|收起|×|✕|‹ ?返回)/;
const BACK_NAME = /(^|-)(close|back|cancel)$/i;

export class PadNavigator {
  private focus: GO | null = null;
  private focusScene: Phaser.Scene | null = null;
  private frames = new Map<Phaser.Scene, Phaser.GameObjects.Graphics>();
  private repeatAt = 0;
  private lastDir = '';
  private scrollAcc = 0;

  constructor(private game: Phaser.Game) {
    // 切回键鼠时立即隐藏焦点框
    gamepad.onDeviceChange(() => this.drawFrame());
  }

  /** 每帧调用（gamepad.update 之后）。 */
  update(time: number): void {
    const scenes = this.game.scene.getScenes(true) as (Phaser.Scene & PadAware)[];
    const top = [...scenes].reverse();
    const captor = top.find(s => s.padCapture?.());
    if (captor) {
      for (const b of gamepad.pressedButtons()) captor.padButton?.(b);
      this.setFocus(null, null);
      return;
    }
    const pressed = gamepad.pressedButtons();
    // 场景自定义按键优先（如战斗暂停时 ☰ 继续）
    const handled = new Set<number>();
    for (const b of pressed) if (top.some(s => s.padButton?.(b))) handled.add(b);

    if (!gamepad.connected || gamepad.device !== 'pad') { this.drawFrame(); return; }
    const cands = this.collect(scenes);
    if (this.focus && !cands.some(c => c.obj === this.focus)) this.setFocus(null, null);
    if (!this.focus && cands.length) { const d = this.defaultCandidate(cands); this.setFocus(d.obj, d.scene); }

    // 方向：十字键 / 左摇杆，按住时重复
    const { x, y } = gamepad.move;
    const dir = Math.abs(x) < 0.5 && Math.abs(y) < 0.5 ? '' : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'R' : 'L') : (y > 0 ? 'D' : 'U');
    if (dir && (dir !== this.lastDir || time >= this.repeatAt)) {
      this.repeatAt = time + (dir !== this.lastDir ? 380 : 150);
      const adjust = this.focus?.getData?.('padAdjust') as ((d: number) => void) | undefined;
      if (adjust && (dir === 'L' || dir === 'R')) adjust(dir === 'R' ? 1 : -1);
      else this.move(cands, dir);
    }
    this.lastDir = dir;

    if (pressed.includes(PAD.A) && !handled.has(PAD.A) && this.focus && this.focusScene) this.click(this.focus, this.focusScene);
    if (pressed.includes(PAD.B) && !handled.has(PAD.B)) this.back(cands);
    if (pressed.includes(PAD.START) && !handled.has(PAD.START)) synthKey('Enter', 13);

    // 右摇杆滚动列表
    if (gamepad.scrollY) {
      this.scrollAcc += gamepad.scrollY * 18;
      if (Math.abs(this.scrollAcc) >= 6) { this.wheel(top, this.scrollAcc); this.scrollAcc = 0; }
    } else this.scrollAcc = 0;
    this.drawFrame();
  }

  /** 当前焦点（测试用）。 */
  get focused(): Phaser.GameObjects.GameObject | null { return this.focus; }

  // —— 候选收集 ——
  private collect(scenes: (Phaser.Scene & PadAware)[]): Candidate[] {
    const all: Candidate[] = [];
    let order = 0, blockerOrder = -1;
    for (const scene of scenes) {
      if (!scene.sys.settings.visible || !scene.input?.enabled) continue;
      scene.children.depthSort();
      const cam = scene.cameras.main;
      const walk = (list: GO[], parentVisible: boolean): void => {
        // 场景根列表已 depthSort；容器内按列表顺序绘制（与 Phaser 渲染一致）
        for (const obj of list) {
          const visible = parentVisible && obj.visible !== false && (obj.alpha ?? 1) > 0.05;
          order++;
          if (!visible) continue;
          const container = obj as unknown as Phaser.GameObjects.Container;
          if (obj.input && obj.input.enabled && obj.getBounds) {
            const r = this.screenRect(obj, cam);
            if (r && r.w > 0 && r.h > 0) {
              const blocker = r.w >= GAME_WIDTH * 0.85 && r.h >= GAME_HEIGHT * 0.85;
              if (blocker) blockerOrder = order;
              else if (this.clickable(obj) && !obj.getData?.('padSkip') && (!scene.padFilter || scene.padFilter(obj))) {
                const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
                if (cx >= 0 && cx <= GAME_WIDTH && cy >= 0 && cy <= GAME_HEIGHT) all.push({ obj, scene, ...r, order });
              }
            }
          }
          if (container.list && container.type === 'Container') walk(container.list as GO[], visible);
        }
      };
      walk(scene.children.list as GO[], true);
    }
    return all.filter(c => c.order > blockerOrder);
  }

  private clickable(obj: GO): boolean {
    return obj.listenerCount('pointerdown') + obj.listenerCount('pointerup') > 0;
  }

  /** 对象在设计分辨率屏幕坐标中的矩形。 */
  private screenRect(obj: GO, cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number; w: number; h: number } | null {
    let b: Phaser.Geom.Rectangle;
    try { b = obj.getBounds!(); } catch { return null; }
    // 交互区域比显示范围小时（卡片外发光留白）按命中区缩小
    const hit = obj.input?.hitArea, size = obj as unknown as { width?: number; height?: number };
    if (hit instanceof Phaser.Geom.Rectangle && size.width && size.height && obj.type !== 'Container' && (hit.width < size.width - 1 || hit.height < size.height - 1)) {
      const fx = b.width / size.width, fy = b.height / size.height;
      b = new Phaser.Geom.Rectangle(b.x + hit.x * fx, b.y + hit.y * fy, hit.width * fx, hit.height * fy);
    }
    let root: GO = obj; while (root.parentContainer) root = root.parentContainer as unknown as GO;
    const sfx = root.scrollFactorX ?? obj.scrollFactorX ?? 1, sfy = root.scrollFactorY ?? obj.scrollFactorY ?? 1;
    const hud = sfx === 0 && sfy === 0, k = hud ? 1 : cam.zoom / RENDER_SCALE; // HUD 在 UI 镜头上（原倍数），不跟主镜头拉远
    const x = (b.x - cam.scrollX * sfx) * k + (hud ? 0 : cam.x / RENDER_SCALE), y = (b.y - cam.scrollY * sfy) * k + (hud ? 0 : cam.y / RENDER_SCALE);
    return { x, y, w: b.width * k, h: b.height * k };
  }

  private defaultCandidate(cands: Candidate[]): Candidate {
    const marked = cands.filter(c => c.obj.getData?.('padDefault'));
    if (marked.length) return marked[marked.length - 1];
    // 最上层一组里离画面中心最近的
    const maxOrder = Math.max(...cands.map(c => c.order));
    const topGroup = cands.filter(c => c.scene === cands.find(d => d.order === maxOrder)!.scene);
    let best = topGroup[0], bestD = Infinity;
    for (const c of topGroup) { const d = Math.hypot(c.x + c.w / 2 - GAME_WIDTH / 2, c.y + c.h / 2 - GAME_HEIGHT / 2); if (d < bestD) { bestD = d; best = c; } }
    return best;
  }

  private move(cands: Candidate[], dir: string): void {
    const cur = cands.find(c => c.obj === this.focus);
    if (!cur) return;
    const vx = dir === 'R' ? 1 : dir === 'L' ? -1 : 0, vy = dir === 'D' ? 1 : dir === 'U' ? -1 : 0;
    const ax = cur.x + cur.w / 2, ay = cur.y + cur.h / 2;
    let best: Candidate | null = null, bestScore = Infinity;
    for (const c of cands) {
      if (c === cur) continue;
      // 目标矩形上离当前中心最近的点，避免大按钮被判在错误方向
      const px = Math.max(c.x, Math.min(ax, c.x + c.w)), py = Math.max(c.y, Math.min(ay, c.y + c.h));
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const along = (cx - ax) * vx + (cy - ay) * vy;
      if (along <= 4) continue;
      const gapAlong = Math.max(0, (px - ax) * vx + (py - ay) * vy);
      const across = Math.abs(vx ? py - ay : px - ax);
      const score = gapAlong + along * 0.3 + across * 2.2;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (best) this.setFocus(best.obj, best.scene);
  }

  private setFocus(obj: GO | null, scene: Phaser.Scene | null): void {
    if (obj === this.focus) return;
    const pointer = this.fakePointer();
    if (this.focus && this.focus.active) try { this.focus.emit('pointerout', pointer); } catch { /* ignore */ }
    this.focus = obj; this.focusScene = scene;
    if (obj && scene) {
      const c = this.centre(obj, scene); pointer.x = c.x; pointer.y = c.y;
      try { obj.emit('pointerover', pointer, 0, 0, this.eventData()); } catch { /* ignore */ }
      scene.events.off('shutdown', this.onShutdown, this); scene.events.once('shutdown', this.onShutdown, this);
    }
  }
  private onShutdown(): void { this.focus = null; this.focusScene = null; this.frames.forEach((g, s) => { if (!s.sys.isActive()) { g.destroy(); this.frames.delete(s); } }); }

  private centre(obj: GO, scene: Phaser.Scene): { x: number; y: number } {
    const r = this.screenRect(obj, scene.cameras.main) ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: (r.x + r.w / 2) * RENDER_SCALE, y: (r.y + r.h / 2) * RENDER_SCALE };
  }

  private fakePointer(): Phaser.Input.Pointer {
    const p = new Phaser.Input.Pointer(this.game.input, 9);
    p.buttons = 1;
    return p;
  }
  private eventData(): Phaser.Types.Input.EventData { const e = { cancelled: false, stopPropagation() { e.cancelled = true; } }; return e; }

  /** Ⓐ：在对象中心模拟一次点击。 */
  click(obj: Phaser.GameObjects.GameObject, scene: Phaser.Scene): void {
    const o = obj as GO, c = this.centre(o, scene), p = this.fakePointer();
    p.x = p.downX = p.upX = c.x; p.y = p.downY = p.upY = c.y; p.worldX = c.x; p.worldY = c.y;
    let lx = 0, ly = 0;
    const hit = o.input?.hitArea as { x?: number; y?: number; width?: number; height?: number; radius?: number } | undefined;
    if (hit) { lx = (hit.x ?? 0) + (hit.radius === undefined ? (hit.width ?? 0) / 2 : 0); ly = (hit.y ?? 0) + (hit.radius === undefined ? (hit.height ?? 0) / 2 : 0); }
    p.isDown = true; p.primaryDown = true;
    o.emit('pointerdown', p, lx, ly, this.eventData());
    p.isDown = false; p.primaryDown = false;
    if (o.active && o.input) o.emit('pointerup', p, lx, ly, this.eventData());
  }

  /** Ⓑ：返回。 */
  private back(cands: Candidate[]): void {
    const maxOrder = cands.length ? Math.max(...cands.map(c => c.order)) : 0;
    const topScene = cands.find(c => c.order === maxOrder)?.scene;
    const top = cands.filter(c => c.scene === topScene);
    const labelled = top.filter(c => BACK_LABEL.test(this.labelOf(c.obj, c.scene)) || BACK_NAME.test(c.obj.name ?? ''));
    if (labelled.length) { const c = labelled[labelled.length - 1]; this.click(c.obj, c.scene); return; }
    synthKey('Escape', 27);
  }

  /** 按钮文字：本身是文字，或压在按钮中心范围内的文字（按钮底板 + 单独文字的写法）。 */
  labelOf(obj: Phaser.GameObjects.GameObject, scene: Phaser.Scene): string {
    const o = obj as GO;
    if (typeof o.text === 'string' && o.text.trim()) return o.text.trim();
    const r = this.screenRect(o, scene.cameras.main); if (!r) return '';
    const cam = scene.cameras.main; let found = '';
    const walk = (list: GO[]): void => {
      for (const t of list) {
        if (found) return;
        if (t.visible === false) continue;
        if (t.type === 'Text' && typeof t.text === 'string' && t.text.trim()) {
          const b = this.screenRect(t, cam);
          if (b) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2; if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) found = t.text.trim(); }
        }
        const c = t as unknown as Phaser.GameObjects.Container;
        if (c.type === 'Container' && c.list) walk(c.list as GO[]);
      }
    };
    const parent = o.parentContainer;
    walk((parent ? parent.list : scene.children.list) as GO[]);
    if (!found && parent) walk(scene.children.list as GO[]);
    return found;
  }

  /** 当前焦点的文字（测试 / 调试用）。 */
  focusLabel(): string { return this.focus && this.focusScene ? this.labelOf(this.focus, this.focusScene) : ''; }

  private wheel(top: Phaser.Scene[], dy: number): void {
    const scene = top[0]; if (!scene) return;
    const p = this.fakePointer();
    const c = this.focus && this.focusScene ? this.centre(this.focus, this.focusScene) : { x: GAME_WIDTH * RENDER_SCALE / 2, y: GAME_HEIGHT * RENDER_SCALE / 2 };
    p.x = c.x; p.y = c.y;
    const over = scene.input.hitTestPointer(p);
    for (const o of over) o.emit('wheel', p, 0, dy, 0, this.eventData());
    scene.input.emit('wheel', p, over, 0, dy, 0);
  }

  // —— 焦点框 ——
  private drawFrame(): void {
    for (const [s, g] of this.frames) if (s !== this.focusScene || gamepad.device !== 'pad') g.setVisible(false);
    const obj = this.focus, scene = this.focusScene;
    if (!obj || !scene || gamepad.device !== 'pad' || !scene.sys.isActive()) return;
    let g = this.frames.get(scene);
    if (!g || !g.scene) { g = scene.add.graphics().setScrollFactor(0).setDepth(1e7); this.frames.set(scene, g); }
    const r = this.screenRect(obj, scene.cameras.main); if (!r) return;
    const pad = 4, x = r.x - pad, y = r.y - pad, w = r.w + pad * 2, h = r.h + pad * 2, t = this.game.loop.time / 1000;
    const a = 0.75 + 0.25 * Math.sin(t * 6);
    g.clear().setVisible(true);
    g.lineStyle(3, 0xffd76a, a).strokeRoundedRect(x, y, w, h, Math.min(10, h / 3));
    const L = Math.min(14, w / 3, h / 3);
    g.lineStyle(4, 0xfff1b8, 1);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) g.lineBetween(cx, cy, cx + sx * L, cy).lineBetween(cx, cy, cx, cy + sy * L);
    scene.children.bringToTop(g);
  }
}

let navigator_: PadNavigator | null = null;
/** 在 main.ts 创建游戏后调用：每帧轮询手柄并驱动界面导航。 */
export function installGamepad(game: Phaser.Game): PadNavigator {
  navigator_ = new PadNavigator(game);
  game.events.on(Phaser.Core.Events.PRE_STEP, (time: number) => { gamepad.update(); navigator_!.update(time); });
  return navigator_;
}
export function padNavigator(): PadNavigator | null { return navigator_; }
