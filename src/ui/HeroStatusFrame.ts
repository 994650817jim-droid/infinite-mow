import Phaser from 'phaser';
import { HEADING_FONT, FONT } from '../config';
import { LQ, lqDiamond } from './LacquerKit';

/**
 * 战斗左上主将状态框（电脑布局；2026-11-19 用户「这里ui做一下」：原为透明暗底 + 纯色扁平血条 / 经验条）。
 * 漆底金边框；左边圆形主将头像（水墨立绘裁圆 + 金圈）；名字 + 朱砂等级印 + 主属性印（hud-attr-badge，由场景建，这里只摆位置）；
 * 血条：铜框朱红、上沿高光，受伤时米白残血拖尾（停 0.25 秒后 0.6 秒追上，同首领血条的 trail），低于 30% 时外框朱红脉动；数字压在条中央；
 * 经验条：细的金色条，与血条分开；升级时闪一下。每帧由场景调用 update（不受 HUD 10 Hz 节流）。
 */
export const STATUS_FRAME = { x: 14, y: 12, w: 238, h: 72, r: 27, barX: 74, hpY: 36, hpH: 15, xpY: 58, xpH: 5, trailHoldMs: 250, trailMs: 600, flashMs: 520, lowHp: .3 } as const;

export class HeroStatusFrame {
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly seal: Phaser.GameObjects.Text;
  private readonly sealG: Phaser.GameObjects.Graphics;
  private portrait?: Phaser.GameObjects.Image;
  private trail = 1; private lastRatio = 1; private lastNow = 0; private hitAt = -1e9; private lastLevel = -1; private flashAt = -1e9;
  /** 测试用。 */
  readonly stats = { trail: 1, ratio: 1, flashes: 0, low: false, portrait: false };

  constructor(private readonly scene: Phaser.Scene, private readonly hero: string, heroName: string, private readonly depth: number) {
    const F = STATUS_FRAME;
    this.back = scene.add.graphics().setScrollFactor(0).setDepth(depth).setName('hud-status-frame');
    this.bars = scene.add.graphics().setScrollFactor(0).setDepth(depth + .2).setName('hud-status-bars');
    this.sealG = scene.add.graphics().setScrollFactor(0).setDepth(depth + .3);
    this.name = scene.add.text(F.x + F.barX, F.y + 9, heroName, { fontFamily: HEADING_FONT, fontSize: '17px', color: LQ.title, resolution: 2 }).setStroke('#140c06', 3).setScrollFactor(0).setDepth(depth + .4).setName('hud-status-name');
    this.seal = scene.add.text(0, F.y + 18, '', { fontFamily: FONT, fontSize: '11px', color: '#fff1d0', fontStyle: 'bold', resolution: 2 }).setOrigin(.5).setScrollFactor(0).setDepth(depth + .5).setName('hud-status-level');
    this.drawBack();
    this.ensurePortrait();
  }

  /** 头像：水墨立绘（assets/ink-scroll/<id>.webp）裁成圆，按需加载。 */
  private ensurePortrait(): void {
    const s = this.scene, key = 'hud_medal_' + this.hero, src = 'ink_hero_' + this.hero, F = STATUS_FRAME;
    const make = (): void => {
      if (!s.textures.exists(key)) {
        if (!s.textures.exists(src)) return;
        const img = s.textures.get(src).getSourceImage() as HTMLImageElement, S = 128, c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d')!; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
        const side = img.width * .62; g.drawImage(img, (img.width - side) / 2, img.height * .1, side, side, 0, 0, S, S);
        s.textures.addCanvas(key, c);
      }
      if (!this.portrait) this.portrait = s.add.image(F.x + 38, F.y + F.h / 2, key).setDisplaySize(F.r * 2 - 4, F.r * 2 - 4).setScrollFactor(0).setDepth(this.depth + .1).setName('hud-status-portrait');
      this.stats.portrait = true;
    };
    if (s.textures.exists(src) || s.textures.exists(key)) { make(); return; }
    s.load.image(src, 'assets/ink-scroll/' + this.hero + '.webp');
    s.load.once('filecomplete-image-' + src, () => { if (this.back.active) make(); });
    s.load.start();
  }

  /** 框与头像圈（静态，建一次）。 */
  private drawBack(): void {
    const F = STATUS_FRAME, g = this.back, cx = F.x + 38, cy = F.y + F.h / 2;
    g.fillStyle(0x000000, .35).fillRoundedRect(F.x + 3, F.y + 4, F.w, F.h, 9);
    g.fillStyle(LQ.lacquer, .8).fillRoundedRect(F.x, F.y, F.w, F.h, 9);
    g.fillStyle(LQ.lacquerHi, .35).fillRoundedRect(F.x + 4, F.y + 4, F.w - 8, F.h * .42, { tl: 6, tr: 6, bl: 0, br: 0 });
    g.lineStyle(1.6, LQ.gold, .95).strokeRoundedRect(F.x + 2.5, F.y + 2.5, F.w - 5, F.h - 5, 7);
    g.lineStyle(1, LQ.gold, .35).strokeRoundedRect(F.x + 6.5, F.y + 6.5, F.w - 13, F.h - 13, 5);
    g.fillStyle(LQ.goldHi, 1); for (const [px, py] of [[F.x + 2.5, F.y + 2.5], [F.x + F.w - 2.5, F.y + 2.5], [F.x + 2.5, F.y + F.h - 2.5], [F.x + F.w - 2.5, F.y + F.h - 2.5]]) lqDiamond(g, px, py, 4);
    // 头像金圈：外金、内朱一细线、底暗
    g.fillStyle(0x0d0806, 1).fillCircle(cx, cy, F.r + 1);
    g.lineStyle(3, LQ.gold, 1).strokeCircle(cx, cy, F.r + 1.5).lineStyle(1, LQ.goldHi, .8).strokeCircle(cx, cy, F.r + 3.5).lineStyle(1.2, LQ.cinnabar, .9).strokeCircle(cx, cy, F.r - .5);
  }

  setVisible(v: boolean): void { for (const o of [this.back, this.bars, this.name, this.seal, this.sealG, this.portrait]) o?.setVisible(v); }

  /** 每帧：hp / xp 比例、等级、真实时间（毫秒）；hpText 是场景的 HP 数字（摆到条中央）；badge 是主属性印。 */
  update(o: { hp: number; maxHp: number; xp: number; xpNext: number; level: number; now: number; hpText?: Phaser.GameObjects.Text; badge?: Phaser.GameObjects.Image | null; /** 已越过本关建议等级（软上限）：经验条换暗金、右端一道金色小刻度。 */ over?: boolean }): void {
    const F = STATUS_FRAME, ratio = Phaser.Math.Clamp(o.hp / Math.max(1, o.maxHp), 0, 1), xr = Phaser.Math.Clamp(o.xp / Math.max(1, o.xpNext), 0, 1), now = o.now;
    // 残血拖尾：掉血时停一会儿再追上；回血时直接跟上
    if (ratio < this.lastRatio - 1e-4) this.hitAt = now;
    const dt = Phaser.Math.Clamp(now - this.lastNow, 0, 100); this.lastNow = now;
    if (ratio >= this.trail) this.trail = ratio;
    else if (now - this.hitAt > F.trailHoldMs) this.trail = Math.max(ratio, this.trail - dt / F.trailMs);
    this.lastRatio = ratio;
    if (this.lastLevel >= 0 && o.level > this.lastLevel) { this.flashAt = now; this.stats.flashes++; }
    this.lastLevel = o.level;
    // 名字 · 等级印 · 主属性印
    const sx = this.name.x + this.name.width + 8, seal = `${o.level}级`;
    if (this.seal.text !== seal) this.seal.setText(seal);
    const sw = this.seal.width + 10, sh = 18; this.seal.setPosition(sx + sw / 2, F.y + 19);
    this.sealG.clear().fillStyle(0x000000, .3).fillRoundedRect(sx + 1, F.y + 11, sw, sh, 3).fillStyle(LQ.cinnabar, 1).fillRoundedRect(sx, F.y + 10, sw, sh, 3).lineStyle(1, LQ.goldHi, .9).strokeRoundedRect(sx + 1.5, F.y + 11.5, sw - 3, sh - 3, 2);
    o.badge?.setPosition(sx + sw + 14, F.y + 19);
    // 血条
    const g = this.bars.clear(), x0 = F.x + F.barX, w = F.w - F.barX - 12, y = F.y + F.hpY, h = F.hpH;
    g.fillStyle(0x2a1a0e, 1).fillRoundedRect(x0 - 2, y - 2, w + 4, h + 4, 3).lineStyle(1.2, LQ.gold, .95).strokeRoundedRect(x0 - 2.5, y - 2.5, w + 5, h + 5, 3);
    g.fillStyle(0x140806, 1).fillRect(x0, y, w, h);
    if (this.trail > ratio) g.fillStyle(0xf3e2bc, .85).fillRect(x0 + w * ratio, y, w * (this.trail - ratio), h);
    if (ratio > 0) {
      g.fillStyle(0xa82e1c, 1).fillRect(x0, y, w * ratio, h);
      g.fillStyle(0xe2643f, .55).fillRect(x0, y + 1, w * ratio, 4);
      g.fillStyle(0x5a120a, .55).fillRect(x0, y + h - 3, w * ratio, 3);
    }
    g.lineStyle(1, 0x000000, .25); for (const k of [.25, .5, .75]) g.lineBetween(x0 + w * k, y + 2, x0 + w * k, y + h - 2);
    const low = ratio > 0 && ratio < F.lowHp; this.stats.low = low;
    if (low) { const a = .35 + .3 * Math.sin(now / 160); g.lineStyle(2, 0xff5a3a, a).strokeRoundedRect(x0 - 4, y - 4, w + 8, h + 8, 4); }
    o.hpText?.setOrigin(.5, .5).setPosition(x0 + w / 2, y + h / 2 + .5).setFontSize(12).setStroke('#1a0a05', 3).setColor(low ? '#ffe0d0' : '#fff3dc');
    // 经验条（细金条）；升级闪一下
    const xy = F.y + F.xpY, xh = F.xpH;
    g.fillStyle(0x140d06, 1).fillRect(x0, xy, w, xh).lineStyle(1, 0x7a5a2c, .9).strokeRect(x0 - .5, xy - .5, w + 1, xh + 1);
    if (xr > 0) g.fillStyle(o.over ? 0x9a7428 : 0xd9b35c, 1).fillRect(x0, xy, w * xr, xh).fillStyle(o.over ? 0xd8b060 : 0xfff0b8, .5).fillRect(x0, xy, w * xr, 1.5);
    if (o.over) g.fillStyle(0xf0c870, 1).fillRect(x0 + w - 2, xy - 3, 2, xh + 6); // 越级小刻度
    const fk = (now - this.flashAt) / F.flashMs;
    if (fk >= 0 && fk < 1) g.fillStyle(0xfff6d8, .85 * (1 - fk)).fillRect(x0 - 2, xy - 2, w + 4, xh + 4);
    this.stats.trail = this.trail; this.stats.ratio = ratio;
  }

  destroy(): void { for (const o of [this.back, this.bars, this.name, this.seal, this.sealG, this.portrait]) o?.destroy(); }
}
