import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import { warText } from './WarStyle';
import type { BattleOrders, BattleOrder } from '../systems/BattleOrders';

/**
 * 军令面板（电脑布局，右侧「行囊」下方）：漆金小匾「军令」+ 最多 4 条军令（○ 进行中 / ✓ 完成 / ✗ 失败，带进度和一行小字）+ 限时。
 * 只在军令表 revision 变化或倒计时跳秒时重设文字；背景随行数重画。设计见共享笔记 battle-map-design.md。
 * 收起（用户「军令也可以收起来」）：点匾额或按 G，收成一行小签「军令 2/3 ▸」；收着时有军令完成，小签闪两下。收 / 展记在 localStorage（本机）。
 */
const FOLD_KEY = 'im_orders_folded';
function loadFolded(): boolean { try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; } }
function saveFolded(v: boolean): void { try { if (v) localStorage.setItem(FOLD_KEY, '1'); else localStorage.removeItem(FOLD_KEY); } catch { /* 无痕模式等：只在本局记住 */ } }
/**
 * 2026-11-19 用户「用药和军令重叠了」：右侧圆钮（用药 Q / 加点 C / 护阵 E，x 864–940）独占最右一列，军令面板挪到这一列左边（右缘 856），
 * 顶在舆图卷轴提示（底 72）之下；底边封顶 maxBottom（台词卡顶 290 之上），放不下的军令收成「另有 n 条」。
 */
export const ORDERS_PANEL = { w: 196, right: 104, top: 84, maxBottom: 282, lineH: 19, detailH: 14, moreH: 16, max: 4 } as const;

export class OrdersPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Array<{ main: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }> = [];
  private readonly timerText: Phaser.GameObjects.Text;
  private rev = -1; private lastSec = -1; private acc = 0; private h = 0; private moreText: Phaser.GameObjects.Text;
  private folded = loadFolded(); private arrow: Phaser.GameObjects.Text; private flash: Phaser.GameObjects.Graphics; private doneSeen = -1;
  /** 测试用：收起状态、收着时闪了几次。 */
  readonly stats = { folded: false, flashes: 0 };
  /** 测试用：面板当前显示的文字（每行）。 */
  lines: string[] = [];
  constructor(private readonly scene: Phaser.Scene, private readonly orders: BattleOrders) {
    const P = ORDERS_PANEL, x = GAME_WIDTH - P.right - P.w;
    this.root = scene.add.container(x, P.top).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('orders-panel');
    this.bg = scene.add.graphics();
    this.title = scene.add.text(14, 7, '军 令', warText(14, LQ.title)).setOrigin(0, 0);
    const seal = scene.add.text(P.w - 27, 14.5, '令', warText(11, '#f6e2b8')).setOrigin(.5);
    this.arrow = scene.add.text(P.w - 50, 14.5, '▾', warText(12, LQ.title)).setOrigin(.5);
    this.flash = scene.add.graphics().setAlpha(0);
    // 匾额（上面 26 像素）可点：收起 / 展开
    const hit = scene.add.zone(0, 0, P.w, 28).setOrigin(0).setInteractive({ useHandCursor: true }).setName('orders-panel-head');
    hit.on('pointerdown', () => this.toggleFold());
    this.root.add([this.bg, this.flash, this.title, seal, this.arrow, hit]);
    for (let i = 0; i < P.max; i++) {
      const main = scene.add.text(14, 0, '', warText(13, LQ.cream)).setOrigin(0, 0);
      const sub = scene.add.text(30, 0, '', warText(11, '#b9a57a')).setOrigin(0, 0);
      main.setWordWrapWidth(P.w - 24); sub.setWordWrapWidth(P.w - 40);
      this.rows.push({ main, sub }); this.root.add([main, sub]);
    }
    this.timerText = scene.add.text(14, 0, '', warText(12, '#e7c98a')).setOrigin(0, 0); this.root.add(this.timerText);
    this.moreText = scene.add.text(30, 0, '', warText(11, '#c8b88f')).setOrigin(0, 0).setName('orders-more'); this.root.add(this.moreText);
    this.root.setVisible(false);
  }
  get container(): Phaser.GameObjects.Container { return this.root; }
  get isFolded(): boolean { return this.folded; }
  /** 收起 / 展开（匾额点击、G 键）。 */
  toggleFold(): void { this.folded = !this.folded; saveFolded(this.folded); this.rev = -1; this.acc = 1; this.update(0); }
  /** 面板占的屏幕矩形（测试 / 防重叠）。 */
  bounds(): { x: number; y: number; w: number; h: number } { return { x: this.root.x, y: this.root.y, w: ORDERS_PANEL.w, h: this.h }; }
  setVisible(v: boolean): void { this.root.setVisible(v && this.rows.some(r => r.main.text !== '')); if (!v) this.root.setVisible(false); }

  update(dt: number): void {
    this.acc += dt; if (this.acc < .2) return; this.acc = 0;
    const t = this.orders.timeLeft(), sec = t ? Math.ceil(t.left) : -1;
    if (this.orders.revision === this.rev && sec === this.lastSec) return;
    this.rev = this.orders.revision; this.lastSec = sec;
    this.render(this.orders.all(), t);
  }

  private render(all: BattleOrder[], t: ReturnType<BattleOrders['timeLeft']>): void {
    const P = ORDERS_PANEL; let y = 30; this.lines = [];
    // 高度封顶：进行中的排前面；放不下（超过 max 条或超过 maxBottom）的收成「另有 n 条」
    const room = P.maxBottom - P.top - 8 - (t ? 22 : 0), need = (o: BattleOrder) => P.lineH + (o.state === 'done' && o.doneText || o.state === 'active' && o.detail ? P.detailH : 0);
    const sorted = [...all.filter(o => o.state === 'active'), ...all.filter(o => o.state !== 'active')], list: BattleOrder[] = [];
    { let used = 30; for (const o of sorted) { const rest = sorted.length - list.length - 1; if (list.length >= P.max || used + need(o) + (rest > 0 ? P.moreH : 0) > room) break; list.push(o); used += need(o); } }
    const hidden = all.length - list.length;
    const done = all.filter(o => o.state === 'done').length;
    // 收着时有军令完成：小签闪两下（展开时有横幅 / 勾，不闪）
    if (this.doneSeen >= 0 && done > this.doneSeen && this.folded) { this.stats.flashes++; this.root.scene.tweens.killTweensOf(this.flash); this.flash.setAlpha(1); this.root.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 380, yoyo: true, repeat: 1, onComplete: () => this.flash.setAlpha(0) }); }
    this.doneSeen = done; this.stats.folded = this.folded;
    this.title.setText(this.folded ? `军令 ${done}/${all.length}` : '军 令'); this.arrow.setText(this.folded ? '▸' : '▾').setX(this.folded ? P.w - 50 : P.w - 50);
    if (this.folded) {
      for (const r of this.rows) { r.main.setText('').setVisible(false); r.sub.setText('').setVisible(false); }
      this.timerText.setVisible(false); this.moreText.setVisible(false); this.h = 28; this.lines = [`军令 ${done}/${all.length}（收起）`];
      const g = this.bg.clear();
      g.fillStyle(0x000000, .35).fillRoundedRect(3, 4, P.w, this.h, 7);
      g.fillStyle(LQ.lacquer, .86).fillRoundedRect(0, 0, P.w, this.h, 7);
      g.lineStyle(1.5, LQ.gold, .9).strokeRoundedRect(3, 3, P.w - 6, this.h - 6, 5);
      g.fillStyle(LQ.cinnabar, .95).fillRoundedRect(P.w - 40, 7, 26, 15, 3);
      this.flash.clear().lineStyle(3, LQ.goldHi, 1).strokeRoundedRect(-2, -2, P.w + 4, this.h + 4, 8).fillStyle(LQ.goldHi, .18).fillRoundedRect(0, 0, P.w, this.h, 7);
      this.root.setVisible(all.length > 0 || !!t); return;
    }
    list.forEach((o, i) => {
      const r = this.rows[i], mark = o.state === 'done' ? '✓' : o.state === 'failed' ? '✗' : '○';
      const prog = o.progress ? ` ${Math.min(o.progress.cur, o.progress.max)}/${o.progress.max}` : '';
      const color = o.state === 'done' ? '#8fbf8a' : o.state === 'failed' ? '#d97a62' : o.kind === 'boss' ? '#f1c46a' : LQ.cream;
      const text = `${mark} ${o.label}${prog}`;
      r.main.setText(text).setColor(color).setPosition(14, y).setVisible(true); y += P.lineH;
      const sub = o.state === 'done' && o.doneText ? o.doneText : o.state === 'active' ? (o.detail ?? '') : '';
      r.sub.setText(sub).setPosition(30, y - 2).setVisible(!!sub); if (sub) y += P.detailH;
      this.lines.push(text + (sub ? ' | ' + sub : ''));
    });
    for (let i = list.length; i < P.max; i++) { this.rows[i].main.setText('').setVisible(false); this.rows[i].sub.setText('').setVisible(false); }
    if (hidden > 0) { this.moreText.setText(`… 另有 ${hidden} 条（舆图 · M 查看）`).setPosition(30, y).setVisible(true); y += P.moreH; this.lines.push(this.moreText.text); } else this.moreText.setVisible(false);
    if (t) { const m = Math.floor(t.left / 60), s = Math.floor(t.left % 60); this.timerText.setText(`${t.label} ${m}:${String(s).padStart(2, '0')}`).setColor(t.danger ? '#ff8a6a' : '#e7c98a').setPosition(14, y + 2).setVisible(true); y += 20; this.lines.push(this.timerText.text); }
    else this.timerText.setVisible(false);
    this.h = y + 8;
    const g = this.bg.clear();
    g.fillStyle(0x000000, .35).fillRoundedRect(3, 4, P.w, this.h, 8);
    g.fillStyle(LQ.lacquer, .86).fillRoundedRect(0, 0, P.w, this.h, 8);
    g.lineStyle(1.5, LQ.gold, .9).strokeRoundedRect(3, 3, P.w - 6, this.h - 6, 6);
    g.lineStyle(1, LQ.gold, .5).lineBetween(12, 26, P.w - 12, 26);
    g.fillStyle(LQ.goldHi, 1); lqDiamond(g, P.w / 2, 26, 3.5); lqDiamond(g, 3, 3, 4); lqDiamond(g, P.w - 3, 3, 4);
    g.fillStyle(LQ.cinnabar, .95).fillRoundedRect(P.w - 40, 7, 26, 15, 3); // 小朱印（令）
    this.root.setVisible(all.length > 0 || !!t);
  }
  destroy(): void { this.root.destroy(true); }
}
