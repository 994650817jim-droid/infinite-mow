import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { ART_V2_FILES, regridV2 } from './ArtStyle';
import { HORSE_V2 } from './HeroMount';
import { playSheet } from './SkillFxSheets';
import { BOSS_PHASE, type BossPhaseEvent } from './BossPhase';

/** 首领坐骑：v2 名马 / 通用马（乘色）。 */
export type BossHorse = 'chitu' | 'wuzhui' | 'jueying' | 'dawan' | 'generic';
export interface BossMountDef { horse: BossHorse; tint?: number; /** 骑者裁到帧高的比例（只露上半身，腿被马挡住）。 */ cut?: number }
const HORSE_KEY: Record<BossHorse, string> = { chitu: 'horse_v2_chitu_walk', wuzhui: 'horse_v2_wuzhui_walk', jueying: 'horse_v2_jueying_walk', dawan: 'horse_v2_dawan_walk', generic: 'horse_v2_generic_walk' };
const DIRS = ['down', 'left', 'right', 'up'] as const;

/**
 * 首领骑马（一阶段）与坠马（半血转二阶段）：
 *  - 马：现成 v2 名马 / 通用马（horses-v2，4 方向 × 4 帧）画在首领脚下，随首领移动换方向、跑动换帧。
 *  - 骑者：正式「首领骑乘图」到之前，用首领本体裁掉下半身、抬到鞍上顶替（每帧在控制器摆完姿势之后调整）。
 *  - 坠马：收到 boss-phase（dismount）→ 扬尘（手绘序列帧）、马受惊跑开淡出、骑者恢复整身步战。
 * 不改首领逻辑位置（碰撞 / 受击仍在脚下），只改显示。
 */
export class BossMount {
  mounted = true;
  private horse: Phaser.GameObjects.Image | null = null;
  private key: string; private last = { x: 0, y: 0 }; private dir: typeof DIRS[number] = 'down'; private stepAt = 0; private frame = 0;
  private readonly onPhase = (e: BossPhaseEvent): void => { if (e.boss === this.boss && e.phase === 2 && this.mounted) this.dismount(); };
  constructor(private scene: Phaser.Scene, private boss: Enemy, private def: BossMountDef) {
    this.key = HORSE_KEY[def.horse];
    this.last = { x: boss.x, y: boss.y };
    this.ensure();
    scene.events.on('postupdate', this.update, this);
    scene.events.on(BOSS_PHASE, this.onPhase);
    scene.events.once('shutdown', () => this.destroy());
  }
  private ensure(): void {
    const s = this.scene, k = this.key;
    const ready = (): void => { if (!s.textures.exists(k)) return; if (!s.textures.get(k).has('down_0')) regridV2(s, k); if (!this.horse && this.mounted && this.boss.active) this.make(); };
    if (s.textures.exists(k)) { ready(); return; }
    if (!ART_V2_FILES[k]) return;
    s.load.image(k, ART_V2_FILES[k]); s.load.once('filecomplete-image-' + k, ready);
    if (!s.load.isLoading()) s.load.start();
  }
  private make(): void {
    this.horse = this.scene.add.image(this.boss.x, this.boss.y, this.key, 'down_0').setOrigin(.5, HORSE_V2.foot / HORSE_V2.cell).setScale(HORSE_V2.scale).setName('boss-horse');
    if (this.def.tint !== undefined) this.horse.setTint(this.def.tint);
  }
  get hasHorse(): boolean { return !!this.horse && this.mounted; }

  /** 每帧（控制器摆完姿势之后）：马跟着首领、骑者裁上半身抬到鞍上。 */
  update(): void {
    const b = this.boss, h = this.horse;
    if (!this.mounted || !h) return;
    if (!b.active) { this.destroy(); return; }
    const dx = b.x - this.last.x, dy = b.y - this.last.y, moving = Math.hypot(dx, dy) > .4, now = this.scene.time.now; this.last = { x: b.x, y: b.y };
    if (moving) this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (moving && now >= this.stepAt) { this.stepAt = now + 95; this.frame = (this.frame + 1) % 4; } else if (!moving) this.frame = 0;
    h.setPosition(b.x, b.y).setFrame(`${this.dir}_${this.frame}`).setDepth(b.sprite.depth - .002).setVisible(b.sprite.visible).setAlpha(b.sprite.alpha);
    // 骑者：裁掉下半身，髋部对到鞍高（HORSE_V2.riderRise 逻辑像素）
    const sp = b.sprite, fh = sp.frame.realHeight || sp.frame.height, fw = sp.frame.realWidth || sp.frame.width, cut = this.def.cut ?? .62;
    sp.setCrop(0, 0, fw, fh * cut);
    // 髋部（帧高 cut 处）要在脚下往上 riderRise：原点放在髋部之下 rise 显示像素处
    sp.setOrigin(sp.originX, cut + (HORSE_V2.riderRise + (this.dir === 'down' ? HORSE_V2.downRise : 0)) / (Math.abs(sp.scaleY) * fh));
  }
  /** 坠马：扬尘、马受惊跑开淡出、骑者恢复整身。 */
  dismount(): void {
    if (!this.mounted) return; this.mounted = false;
    const b = this.boss, h = this.horse, s = this.scene;
    b.sprite.setCrop();
    playSheet(s, 'fx_collapse_dust', b.x, b.y + 4, { size: 190, ms: 650, depth: b.sprite.depth + .1, originY: .8, name: 'boss-dismount-dust' });
    s.cameras.main.shake(160, .005);
    if (h) {
      const away = b.x < s.cameras.main.worldView.centerX ? -1 : 1;
      h.setFrame(away < 0 ? 'left_0' : 'right_0');
      const start = s.time.now, x0 = h.x, y0 = h.y;
      // 场景 Tween 会随弹窗暂停，这里按场景时钟自己跑
      const run = (): void => { if (!h.active) return; const t = Math.min(1, (s.time.now - start) / 1100); h.setPosition(x0 + away * 420 * t, y0 - 20 * Math.sin(t * Math.PI)).setFrame(`${away < 0 ? 'left' : 'right'}_${Math.floor(t * 14) % 4}`).setAlpha(1 - t); if (t >= 1) { s.events.off('postupdate', run); h.destroy(); } };
      s.events.on('postupdate', run);
      this.horse = null;
    }
  }
  destroy(): void {
    this.scene.events.off('postupdate', this.update, this); this.scene.events.off(BOSS_PHASE, this.onPhase);
    this.horse?.destroy(); this.horse = null;
    if (this.boss.sprite?.active) this.boss.sprite.setCrop();
  }
}
