import Phaser from 'phaser';
import { DEPTH, FONT, IS_DESKTOP } from '../config';
import { HOTKEYS, actionFor, actionsFor, eventCode, hotkeyCode, hotkeyLabel, typingTarget, type HotkeyAction } from '../data/hotkeys';
import { gamepad } from '../platform/gamepad';
import { hotkeyUiOpen } from '../ui/HotkeySettingsUI';

/**
 * 战斗快捷键（用户 2026-11-18「帮我做快捷键游戏战斗的」；键位表见 src/data/hotkeys.ts，可在设置「快捷键」里改）。
 * 一个 keydown 监听按当前界面分派：
 *  - 战斗中：Esc/P 暂停、Q 服药、E 护阵/出击切换、F 出击、B/Tab 行囊、C 加点、V 战法构筑；
 *  - 三选一 / 首领遗珍：1–3 选卡、R 刷新；战地招募：1–4 选卡、Esc/Enter 关闭；
 *  - 行营休整：1–4 页签、Enter 率军出征、B 行囊；结算：Enter 主行动、R 再来一局；劝降：1 劝降、2 斩杀；
 *  - 面板（行囊 / 构筑 / 属性）开着时，再按同一个键或 Esc 关掉。
 * 面板里的按钮一律按对象名找到后模拟一次点击（pointerdown + pointerup），与鼠标点完全同一条路径。
 * 文字输入框有焦点时不响应；手柄合成的键（PadNavigator 的 ☰ → Enter、Ⓑ → Esc）只走原有的 Esc 逻辑，不触发新加的键。
 * 键位提示：电脑布局在 HUD 圆钮与面板按钮右上角标一个米色小字（HotkeyHints），手机布局与手柄输入时不显示。
 */
export interface HotkeyHost {
  readonly scene: Phaser.Scene;
  mode(): string;
  over(): boolean;
  togglePause(): void;
  usePotion(): void;
  order(): 'guard' | 'sortie';
  cycleOrder(): void;
  openBag(): void;
  canAttributes(): boolean;
  openAttributes(from: 'none' | 'pause'): void;
  openBuild(): void;
  chooseUpgrade(i: number): void;
  /** 战场地图（大地图）开关；没有地图（手机布局）时不传。 */
  toggleMap?(): void;
  mapOpen?(): boolean;
  /** 军令面板收起 / 展开（G）；没有面板（手机布局）时不传。 */
  toggleOrders?(): void;
}

type GO = Phaser.GameObjects.GameObject & { visible?: boolean; parentContainer?: Phaser.GameObjects.Container | null; getBounds?: () => Phaser.Geom.Rectangle };

/** 按名字找场上可见、可点的对象（包括容器里的）。 */
export function findVisible(scene: Phaser.Scene, name: string | RegExp): GO[] {
  const out: GO[] = [];
  const walk = (list: Phaser.GameObjects.GameObject[]): void => {
    for (const o of list as GO[]) {
      if (!o.active || o.visible === false) continue;
      if (typeof name === 'string' ? o.name === name : name.test(o.name)) out.push(o);
      if (o instanceof Phaser.GameObjects.Container) walk(o.list);
    }
  };
  walk(scene.children.list);
  return out;
}
function clickable(o: GO): boolean { return !!o.input?.enabled; }
/** 模拟一次点击（与鼠标同一条路径）。 */
export function clickObject(scene: Phaser.Scene, o: GO): boolean {
  if (!clickable(o)) return false;
  const p = scene.input.activePointer;
  o.emit('pointerdown', p, 0, 0, { stopPropagation() {} });
  if (o.active) o.emit('pointerup', p, 0, 0, { stopPropagation() {} });
  return true;
}
function click(scene: Phaser.Scene, name: string | RegExp): boolean { const o = findVisible(scene, name).find(clickable); return !!o && clickObject(scene, o); }
/** 排序：有 slot 数据（行营页签）按 slot，否则按屏幕位置（先上后下、先左后右）。 */
const ord = (a: { o: GO; b: Phaser.Geom.Rectangle }, b: { o: GO; b: Phaser.Geom.Rectangle }) => { const sa = a.o.getData?.('slot'), sb = b.o.getData?.('slot'); if (typeof sa === 'number' && typeof sb === 'number') return sa - sb; return Math.abs(a.b.y - b.b.y) > 40 ? a.b.y - b.b.y : a.b.x - b.b.x; };
/** 一组卡片按屏幕位置（先上后下、先左后右）排序后取第 i 个。 */
function nth(scene: Phaser.Scene, name: RegExp, i: number): GO | null {
  const l = findVisible(scene, name).filter(o => o.getBounds).map(o => ({ o, b: o.getBounds!() }));
  l.sort(ord);
  const o = l[i]?.o; return o && clickable(o) ? o : null;
}
const PICK: Partial<Record<HotkeyAction, number>> = { pick1: 0, pick2: 1, pick3: 2, pick4: 3 };
const RECRUIT_CARDS = /^(recruit-card-|recruit-potion$)/;

export class BattleHotkeys {
  /** 测试用：最近一次按键被哪个动作处理了。 */
  last: { action: HotkeyAction | null; handled: boolean; mode: string } = { action: null, handled: false, mode: '' };
  /** V 从战斗中打开的构筑面板：再按 V / Esc 关掉时直接回到战斗。 */
  private buildFromBattle = false;
  private readonly onKey = (e: KeyboardEvent): void => this.key(e);
  constructor(private readonly h: HotkeyHost) {
    const kb = h.scene.input.keyboard; kb?.on('keydown', this.onKey);
    h.scene.events.once('shutdown', () => kb?.off('keydown', this.onKey));
  }

  private key(e: KeyboardEvent): void {
    if (typingTarget(e) || hotkeyUiOpen()) return;
    // 共用键（M：战斗中 = 舆图；天下地图 / 营寨 = 返回主菜单）：战斗场景里优先舆图
    const code = eventCode(e), all = actionsFor(code), action = all.includes('map') && this.h.toggleMap ? 'map' : actionFor(code);
    if (code === 'Tab' || (code === 'Space' && action)) e.preventDefault?.(); // Tab 不让浏览器挪焦点；空格不滚页
    if (!action) return;
    if (gamepad.synthetic && action !== 'back') return; // 手柄合成的 Enter 不触发新键（保持手柄原行为）
    if (e.repeat && action !== 'pick1' && action !== 'pick2' && action !== 'pick3' && action !== 'pick4') return;
    const handled = this.run(action);
    this.last = { action, handled, mode: this.h.mode() };
  }

  /** 执行一个动作；返回是否起了作用。 */
  run(a: HotkeyAction): boolean {
    const h = this.h, s = h.scene, mode = h.mode(), playing = mode === 'none' && !h.over();
    // 先看浮在最上面的面板
    const bag = s.children.getByName('item-bag');
    if (bag) { if (a === 'bag' || a === 'back') { (bag.getData('ui') as { close?: () => void } | undefined)?.close?.(); return true; } return false; }
    if (s.children.getByName('build-panel')) {
      if (a === 'build' || a === 'back') { const back = this.buildFromBattle; this.buildFromBattle = false; click(s, 'build-panel-back'); if (back && h.mode() === 'pause') h.togglePause(); return true; }
      return false;
    }
    // 舆图开着：M / Esc 卷起（其余键照常）
    if (h.mapOpen?.() && (a === 'map' || a === 'back')) { h.toggleMap?.(); return true; }
    if (playing) {
      switch (a) {
        case 'map': if (!h.toggleMap) return false; h.toggleMap(); return true;
        case 'orders': if (!h.toggleOrders) return false; h.toggleOrders(); return true;
        case 'back': h.togglePause(); return true;
        case 'potion': h.usePotion(); return true;
        case 'order': h.cycleOrder(); return true;
        case 'sortie': if (h.order() === 'guard') h.cycleOrder(); return true;
        case 'bag': h.openBag(); return true;
        case 'attributes': if (!h.canAttributes()) return false; h.openAttributes('none'); return true;
        case 'build': h.togglePause(); h.openBuild(); this.buildFromBattle = true; return true;
        default: return false;
      }
    }
    const i = PICK[a];
    switch (mode) {
      case 'pause':
        if (a === 'back') { h.togglePause(); return true; }
        if (a === 'confirm') return click(s, 'pause-resume');
        if (a === 'bag') { h.openBag(); return true; }
        if (a === 'build') { h.openBuild(); this.buildFromBattle = false; return true; }
        if (a === 'attributes' && h.canAttributes()) { h.openAttributes('pause'); return true; }
        return false;
      case 'levelup': case 'bossloot':
        if (i !== undefined && i < 3) { h.chooseUpgrade(i); return true; }
        if (a === 'reroll' && mode === 'levelup') return click(s, 'upgrade-reroll');
        if (a === 'back') { h.togglePause(); return false; }
        return false;
      case 'attributes':
        if (a === 'attributes' || a === 'back') return click(s, 'attributes-close');
        return false;
      case 'recruit': {
        if (i !== undefined) { const o = nth(s, RECRUIT_CARDS, i); return !!o && clickObject(s, o); }
        if (a === 'back' || a === 'confirm') return click(s, 'recruit-close');
        return false;
      }
      case 'aid':
        if (i !== undefined) { const o = nth(s, /^aid-card-/, i); return !!o && clickObject(s, o); }
        return false;
      case 'rest':
        if (i !== undefined) { const o = nth(s, /^camp-tab-[0-9]+$/, i); return !!o && clickObject(s, o); } // 页签对象名是内部编号（0/2/3/4），按屏幕顺序取第 i 个
        if (a === 'confirm') return click(s, 'camp-confirm-replace') || click(s, 'camp-depart');
        if (a === 'bag') return click(s, 'camp-bag');
        if (a === 'back') return click(s, 'camp-close-details');
        return false;
      case 'result':
        if (a === 'confirm') return click(s, 'result-home');
        if (a === 'reroll') return click(s, 'result-restart');
        return false;
      case 'parley': case 'story': {
        // 招降弹窗（content 会话 systems/Parley.ts，面板 parley-panel）自带 1 劝降 / 2 斩杀 / 3 再压一压：默认数字键交给它处理（不重复触发），
        // 玩家把选卡键改成别的键时由这里代点（按钮 pointerup 生效；没有关闭 / 跳过，必须选）
        const btn = a === 'pick1' ? 'parley-persuade' : a === 'pick2' ? 'parley-execute' : a === 'pick3' ? 'parley-press' : null;
        if (btn && s.children.getByName('parley-panel')) return hotkeyCode(a) === HOTKEYS[a].key ? false : click(s, btn);
        if (btn) return false;
        if (a === 'back') { h.togglePause(); return false; }
        if (a === 'confirm') return click(s, /^story-.*-confirm$/);
        return false;
      }
      default:
        if (a === 'back') h.togglePause();
        return false;
    }
  }
}

/** 每个界面要标键位的对象（名字 → 动作）。 */
const HINTS: Record<string, Array<[string | RegExp, HotkeyAction | ((i: number) => HotkeyAction)]>> = {
  none: [['potion-button', 'potion'], ['attribute-plus', 'attributes'], ['hud-bag', 'bag'], ['hud-pause', 'back']],
  pause: [['pause-resume', 'back'], ['pause-build', 'build']], // 「返回主菜单」不标键：战斗中 M 是舆图
  levelup: [[/^upgrade-card-[0-2]$/, i => (['pick1', 'pick2', 'pick3'] as const)[i]], ['upgrade-reroll', 'reroll']],
  bossloot: [[/^upgrade-card-[0-2]$/, i => (['pick1', 'pick2', 'pick3'] as const)[i]]],
  attributes: [['attributes-close', 'back']],
  recruit: [[RECRUIT_CARDS, i => (['pick1', 'pick2', 'pick3', 'pick4'] as const)[i]], ['recruit-close', 'back']],
  aid: [[/^aid-card-/, i => (['pick1', 'pick2', 'pick3', 'pick4'] as const)[i]]],
  rest: [[/^camp-tab-[0-9]+$/, i => (['pick1', 'pick2', 'pick3', 'pick4'] as const)[i]], ['camp-depart', 'confirm'], ['camp-bag', 'bag']],
  result: [['result-home', 'confirm'], ['result-restart', 'reroll']],
  parley: [['parley-persuade', 'pick1'], ['parley-execute', 'pick2'], ['parley-press', 'pick3']],
};

/** 键位提示：HUD 圆钮与面板按钮右上角的米色小字（电脑布局；手机布局、手柄输入时隐藏）。 */
export class HotkeyHints {
  private pool: Phaser.GameObjects.Text[] = [];
  private acc = 1;
  constructor(private readonly h: HotkeyHost) {}
  update(dt: number): void {
    this.acc += dt; if (this.acc < .08) return; this.acc = 0;
    const s = this.h.scene;
    let n = 0;
    const show = IS_DESKTOP && gamepad.device !== 'pad' && !this.h.over() || IS_DESKTOP && this.h.mode() === 'result' && gamepad.device !== 'pad';
    if (show) {
      const overlay = s.children.getByName('item-bag') ? [['item-bag-close', 'bag'] as [string, HotkeyAction]] : s.children.getByName('build-panel') ? [['build-panel-back', 'back'] as [string, HotkeyAction]] : null;
      const list = overlay ?? HINTS[this.h.mode()] ?? [];
      const depth = overlay ? DEPTH.overlay + 30 : this.h.mode() === 'none' ? DEPTH.hud + 6 : DEPTH.overlay + 26;
      for (const [name, act] of list) {
        let objs = findVisible(s, name).filter(o => o.getBounds);
        if (name instanceof RegExp) { const bs = objs.map(o => ({ o, b: o.getBounds!() })); bs.sort(ord); objs = bs.map(x => x.o); }
        objs.slice(0, 4).forEach((o, i) => {
          const a = typeof act === 'function' ? act(i) : act, b = o.getBounds!();
          if (b.width < 2 || b.height < 2) return;
          const t = this.pool[n] ?? (this.pool[n] = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#e8d3a6', resolution: 2, stroke: '#120904', strokeThickness: 3 }).setOrigin(1, 0).setScrollFactor(0).setName('hotkey-hint'));
          t.setText(hotkeyLabel(a)).setPosition(b.right - 3, b.top + 1).setDepth(depth).setAlpha(.92).setVisible(true).setData('action', a).setData('target', o.name);
          n++;
        });
      }
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].setVisible(false);
    // 护阵 / 出击 按钮自带的键位字（LegionUI）跟着改键走
    const ok = gamepad.device === 'pad' ? undefined : findVisible(s, 'hud-order-key')[0] as Phaser.GameObjects.Text | undefined; if (ok && ok.text !== hotkeyLabel('order')) ok.setText(hotkeyLabel('order')); // 手柄时保留 Ⓨ
  }
}
