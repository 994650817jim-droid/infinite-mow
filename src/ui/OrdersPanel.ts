import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import { warText } from './WarStyle';
import type { BattleOrders, BattleOrder } from '../systems/BattleOrders';

/**
 * 军令面板（电脑布局，右侧「行囊」下方）：漆金小匾「军令」+ 最多 4 条军令（○ 进行中 / ✓ 完成 / ✗ 失败，带进度和一行小字）+ 限时。
 * 只在军令表 revision 变化或倒计时跳秒时重设文字；背景随行数重画。设计见共享笔记 battle-map-design.md。
 */
export const ORDERS_PANEL = { w: 196, right: 16, top: 196, lineH: 19, detailH: 14, max: 4 } as const;

export class OrdersPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Array<{ main: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }> = [];
  private readonly timerText: Phaser.GameObjects.Text;
  private rev = -1; private lastSec = -1; private acc = 0; private h = 0;
  /** 测试用：面板当前显示的文字（每行）。 */
  lines: string[] = [];
  constructor(private readonly scene: Phaser.Scene, private readonly orders: BattleOrders) {
    const P = ORDERS_PANEL, x = GAME_WIDTH - P.right - P.w;
    this.root = scene.add.container(x, P.top).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('orders-panel');
    this.bg = scene.add.graphics();
    this.title = scene.add.text(14, 7, '军 令', warText(14, LQ.title)).setOrigin(0, 0);
    const seal = scene.add.text(P.w - 27, 14.5, '令', warText(11, '#f6e2b8')).setOrigin(.5);
    this.root.add([this.bg, this.title, seal]);
    for (let i = 0; i < P.max; i++) {
      const main = scene.add.text(14, 0, '', warText(13, LQ.cream)).setOrigin(0, 0);
      const sub = scene.add.text(30, 0, '', warText(11, '#b9a57a')).setOrigin(0, 0);
      main.setWordWrapWidth(P.w - 24); sub.setWordWrapWidth(P.w - 40);
      this.rows.push({ main, sub }); this.root.add([main, sub]);
    }
    this.timerText = scene.add.text(14, 0, '', warText(12, '#e7c98a')).setOrigin(0, 0); this.root.add(this.timerText);
    this.root.setVisible(false);
  }
  get container(): Phaser.GameObjects.Container { return this.root; }
  /** 面板占的屏幕矩形（测试 / 防重叠）。 */
  bounds(): { x: number; y: number; w: number; h: number } { return { x: this.root.x, y: this.root.y, w: ORDERS_PANEL.w, h: this.h }; }
  setVisible(v: boolean): void { this.root.setVisible(v && this.rows.some(r => r.main.text !== '')); if (!v) this.root.setVisible(false); }

  update(dt: number): void {
    this.acc += dt; if (this.acc < .2) return; this.acc = 0;
    const t = this.orders.timeLeft(), sec = t ? Math.ceil(t.left) : -1;
    if (this.orders.revision === this.rev && sec === this.lastSec) return;
    this.rev = this.orders.revision; this.lastSec = sec;
    this.render(this.orders.all().slice(0, ORDERS_PANEL.max), t);
  }

  private render(list: BattleOrder[], t: ReturnType<BattleOrders['timeLeft']>): void {
    const P = ORDERS_PANEL; let y = 30; this.lines = [];
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
    this.root.setVisible(list.length > 0 || !!t);
  }
  destroy(): void { this.root.destroy(true); }
}
