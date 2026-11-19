import Phaser from 'phaser';
import { FONT, DEPTH, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP as D } from '../config';

export type BannerKind = 'combo' | 'awaken';
interface Item { kind: BannerKind; title: string; sub: string }

/**
 * 合击 / 觉醒横幅（2026-11-19 流派重做第 3 期；图 public/assets/schools/banner_{combo,awaken}.png，ChatGPT 出图）。
 * 屏幕上方居中：从左滑入、停一会、上浮淡出；同时来几条就排队（最多排 4 条），不叠在一起。缺图时只显示字。
 */
export class SchoolBanner {
  private queue: Item[] = []; private busy = false;
  /** live：现在能不能显示（暂停、三选一、构筑面板开着时先不显示，排着等）。 */
  constructor(private readonly scene: Phaser.Scene, private readonly live: () => boolean = () => true) { scene.events.once('shutdown', () => { this.queue.length = 0; }); }
  show(kind: BannerKind, title: string, sub = ''): void {
    if (this.queue.length < 4) this.queue.push({ kind, title, sub });
    if (!this.busy) this.next();
  }
  private next(): void {
    if (!this.queue.length) { this.busy = false; return; }
    this.busy = true;
    if (!this.live()) { this.scene.time.delayedCall(250, () => this.next()); return; }
    const it = this.queue.shift()!;
    const s = this.scene, awaken = it.kind === 'awaken', key = awaken ? 'school_banner_awaken' : 'school_banner_combo';
    const w = awaken ? (D ? 560 : 430) : (D ? 470 : 370), x = GAME_WIDTH / 2, y = GAME_HEIGHT * (D ? .27 : .24);
    const root = s.add.container(x - 40, y).setScrollFactor(0).setDepth(DEPTH.overlay + 52).setAlpha(0).setName('school-banner');
    if (s.textures.exists(key)) { const img = s.add.image(0, 0, key); img.setDisplaySize(w, w * img.height / img.width); root.add(img); }
    const title = s.add.text(0, it.sub ? -9 : 0, it.title, { fontFamily: FONT, fontSize: awaken ? (D ? '25px' : '21px') : (D ? '21px' : '18px'), color: awaken ? '#ffe7a8' : '#f6dc9a', fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setName('school-banner-title');
    root.add(title);
    if (it.sub) root.add(s.add.text(0, D ? 15 : 13, it.sub, { fontFamily: FONT, fontSize: D ? '13px' : '12px', color: '#e8c98a', stroke: '#1a0f08', strokeThickness: 3, resolution: 2 }).setOrigin(.5).setName('school-banner-sub'));
    // 显示中途打开了面板：先藏起来（面板关了再露出来）
    const sync = (): void => { root.setVisible(this.live()); }; s.events.on('update', sync);
    root.once('destroy', () => s.events.off('update', sync));
    s.tweens.add({ targets: root, x, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: root, y: y - 18, alpha: 0, delay: 220 + (awaken ? 1700 : 1400), duration: 360, onComplete: () => { root.destroy(); s.time.delayedCall(100, () => this.next()); } });
  }
}
