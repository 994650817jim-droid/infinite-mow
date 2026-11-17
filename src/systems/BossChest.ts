import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, actorDepth } from '../config';
import { playSheet } from './SkillFxSheets';
import { bossDeathKey } from './BossDeathArt';

/**
 * 首领倒地 → 掉宝箱 → 主将走过去捡起遗物 → 才进下一阶段（用户 2026-11-17：「每次boss死亡后做个倒地动画，然后掉落宝箱，走过去会捡起遗物。然后才下一阶段」）。
 *  - 倒地：控制器自己有倒地帧的（第三~五章 4×8 图集 28~31、华雄、徐荣、攻城 / 情报首领）沿用；其余首领用「受伤帧 + 绕脚底倒下 + 下沉淡出」。
 *    扬尘用手绘序列帧 fx_collapse_dust（SkillFxSheets），不画像素特效。
 *  - 宝箱：item_chest（关 / 开着冒光 / 空），主将碰到就打开，调 grant() 发遗物（遗物本身由道具系统发放、存储），弹出名称和效果。
 *  - 宝箱离主将远时，主将身边一个指向宝箱的箭头（界面提示）。
 */
export interface ChestLoot { name: string; desc: string; tag: string }
export interface ChestHost {
  scene: Phaser.Scene; player: Player;
  /** 打开宝箱时发放遗物，返回要展示的条目。 */
  grant: () => ChestLoot[];
  /** 弹窗关掉后调用（结算 / 告捷卷轴 / 继续战斗）。 */
  done: () => void;
  sfx: (key: string) => void;
}

export const CHEST = { dropDelayMs: 1000, reach: 52, popupMs: 3200, arrowFrom: 150 } as const;

/** 没有倒地帧的首领：受伤帧（v2 招式图集 14）→ 绕脚底向一侧倒下 → 扬尘 → 下沉淡出。返回倒地点。 */
/** 返回：用了倒地 4 帧时为朝向（1 右 / -1 左，宝箱据此往前偏开尸体），否则 0。 */
export function playBossFall(scene: Phaser.Scene, boss: Enemy, movesKey?: string, deathId?: string): number {
  const sp = boss.sprite, dir = sp.flipX ? -1 : 1;
  const img = scene.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setDepth(sp.depth).setName('boss-fall');
  // 画风会话补的倒地 4 帧（张角 / 张梁 / 张宝 / 董卓 / 吕布）：受击后仰 → 倒地 → 躺倒 → 静止，每帧 160ms；倒地那一下扬尘，停一会儿再下沉淡出
  const death = bossDeathKey(scene, deathId);
  if (death) {
    const h = Math.abs(sp.displayHeight); img.setTexture(death, 0).setOrigin(.5, 256 / 288).setScale(h / 288).setFlipX(dir < 0).setName('boss-fall-frames');
    [1, 2, 3].forEach((f, i) => scene.time.delayedCall(160 * (i + 1), () => { if (!img.active) return; img.setFrame(f);
      if (f === 2) { playSheet(scene, 'fx_collapse_dust', img.x, img.y - 6, { size: 190, ms: 650, depth: img.depth + .1, alpha: .85, originY: .62 }); scene.cameras.main.shake(140, .004); } }));
    scene.tweens.add({ targets: img, y: img.y + 8, alpha: 0, delay: 160 * 3 + 900, duration: 700, onComplete: () => img.destroy() });
    return dir;
  }
  if (movesKey && scene.textures.exists(movesKey)) { const h = Math.abs(sp.displayHeight); img.setTexture(movesKey, 14).setOrigin(.5, 256 / 288).setScale(h / 288).setFlipX(dir < 0); }
  img.setTint(0xffd8c8);
  scene.tweens.add({ targets: img, rotation: dir * -1.35, y: img.y + 6, duration: 420, ease: 'Quad.easeIn', onComplete: () => {
    playSheet(scene, 'fx_collapse_dust', img.x, img.y - 6, { size: 190, ms: 650, depth: img.depth + .1, alpha: .85, originY: .62 });
    scene.cameras.main.shake(140, .004);
    scene.tweens.add({ targets: img, y: img.y + 10, alpha: 0, delay: 650, duration: 700, onComplete: () => img.destroy() });
  } });
  return 0;
}

export class BossChest {
  private img?: Phaser.GameObjects.Image; private glow?: Phaser.GameObjects.Ellipse;
  private arrow: Phaser.GameObjects.Graphics; private label: Phaser.GameObjects.Text;
  private readyAt: number; private opened = false; private finished = false; private popup?: Phaser.GameObjects.Container;
  constructor(private h: ChestHost, readonly x: number, readonly y: number, now: number) {
    this.readyAt = now + CHEST.dropDelayMs;
    this.arrow = h.scene.add.graphics().setDepth(DEPTH.hud - 5).setName('boss-chest-arrow');
    this.label = h.scene.add.text(0, 0, '宝箱', { fontFamily: FONT, fontSize: '14px', color: '#ffe7a8', stroke: '#1a1310', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.hud - 5).setVisible(false);
  }
  get ready(): boolean { return !!this.img; }
  get done(): boolean { return this.finished; }

  update(now: number): void {
    if (this.finished) return;
    if (!this.img && now >= this.readyAt) this.drop();
    if (!this.img || this.opened) { this.arrow.clear(); this.label.setVisible(false); return; }
    const p = this.h.player, dx = this.x - p.x, dy = this.y - p.y, d = Math.hypot(dx, dy);
    if (d <= CHEST.reach + p.radius) { this.open(); return; }
    // 指向宝箱的箭头（离得远时）
    this.arrow.clear(); this.label.setVisible(false);
    if (d > CHEST.arrowFrom) {
      const a = Math.atan2(dy, dx), r = 74, bob = Math.sin(now / 160) * 4, cx = p.x + Math.cos(a) * (r + bob), cy = p.y - 30 + Math.sin(a) * (r + bob);
      const pt = (l: number, w: number) => [cx + Math.cos(a) * l - Math.sin(a) * w, cy + Math.sin(a) * l + Math.cos(a) * w] as const;
      const [x1, y1] = pt(16, 0), [x2, y2] = pt(-10, -11), [x3, y3] = pt(-10, 11);
      this.arrow.fillStyle(0x1a1310, .85).fillTriangle(...pt(19, 0), ...pt(-12, -14), ...pt(-12, 14)).fillStyle(0xf2c27a, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
      this.label.setVisible(true).setPosition(cx - Math.cos(a) * 26, cy - Math.sin(a) * 26 - 12);
    }
  }
  /** 测试 / 调试用：直接打开（跳过走过去）。 */
  collectNow(): void { if (!this.img) this.drop(); if (!this.opened) this.open(); if (this.popup) this.closePopup(); }

  private drop(): void {
    const s = this.h.scene;
    this.glow = s.add.ellipse(this.x, this.y + 12, 78, 24, 0xf3d48a, .32).setDepth(actorDepth(this.y) - .1).setBlendMode(Phaser.BlendModes.ADD).setName('boss-chest-glow');
    this.img = s.add.image(this.x, this.y - 60, 'item_chest', 0).setDisplaySize(72, 60).setOrigin(.5, .9).setDepth(actorDepth(this.y)).setName('boss-chest');
    s.tweens.add({ targets: this.img, y: this.y + 10, duration: 380, ease: 'Bounce.easeOut' });
    s.tweens.add({ targets: this.glow, alpha: .12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.h.sfx('pickup');
  }
  private open(): void {
    this.opened = true; this.arrow.clear(); this.label.setVisible(false);
    const s = this.h.scene; this.img!.setFrame(1); this.h.sfx('bossVolley');
    s.time.delayedCall(450, () => this.img?.setFrame(2));
    const loot = this.h.grant();
    this.showPopup(loot);
  }
  private showPopup(loot: ChestLoot[]): void {
    const s = this.h.scene, W = GAME_WIDTH, w = 460, lineH = 46, hgt = 70 + Math.max(1, loot.length) * lineH, x0 = W / 2 - w / 2, y0 = GAME_HEIGHT * .2;
    const root = s.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay - 6).setName('boss-chest-popup');
    const g = s.add.graphics().setScrollFactor(0);
    g.fillStyle(0x000000, .4).fillRoundedRect(x0 + 3, y0 + 5, w, hgt, 10).fillStyle(0x1b120b, .96).fillRoundedRect(x0, y0, w, hgt, 10)
      .lineStyle(2, 0xc9a35e, .95).strokeRoundedRect(x0 + 4, y0 + 4, w - 8, hgt - 8, 8);
    root.add(g);
    root.add(s.add.text(W / 2, y0 + 24, '获得遗物', { fontFamily: HEADING_FONT, fontSize: '22px', color: '#f6dc9a', resolution: 2 }).setOrigin(.5).setScrollFactor(0));
    (loot.length ? loot : [{ name: '无遗珍', desc: '这一战的首领没有留下遗珍', tag: '' }]).forEach((l, i) => {
      const y = y0 + 56 + i * lineH;
      root.add(s.add.text(x0 + 24, y, (l.tag ? `【${l.tag}】` : '') + l.name, { fontFamily: FONT, fontSize: '17px', color: '#f0b48a', resolution: 2 }).setScrollFactor(0).setName('boss-chest-loot-' + i));
      root.add(s.add.text(x0 + 24, y + 21, l.desc, { fontFamily: FONT, fontSize: '13px', color: '#eadcbd', resolution: 2 }).setScrollFactor(0).setWordWrapWidth(w - 48));
    });
    root.setAlpha(0); s.tweens.add({ targets: root, alpha: 1, duration: 180 });
    this.popup = root;
    s.time.delayedCall(CHEST.popupMs, () => this.closePopup());
  }
  private closePopup(): void {
    if (this.finished) return; this.finished = true;
    const p = this.popup; this.popup = undefined;
    if (p?.active) this.h.scene.tweens.add({ targets: p, alpha: 0, duration: 200, onComplete: () => p.destroy() });
    this.h.scene.tweens.add({ targets: [this.img, this.glow].filter(Boolean), alpha: 0, delay: 300, duration: 500 });
    this.h.done();
  }
  clear(): void { this.arrow.destroy(); this.label.destroy(); this.popup?.destroy(); this.img?.destroy(); this.glow?.destroy(); }
  snapshot() { return { ready: this.ready, opened: this.opened, done: this.finished, x: this.x, y: this.y }; }
}
