import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { ART_V2_FILES, regridV2 } from './ArtStyle';
import { HORSE_V2, RIDE, RIDE_DIR_LIFT, RIDE_FRONT } from './HeroMount';
import { playSheet } from './SkillFxSheets';
import { BOSS_PHASE, type BossPhaseEvent } from './BossPhase';

/** 首领坐骑：v2 名马 / 通用马（乘色）。 */
export type BossHorse = 'chitu' | 'wuzhui' | 'jueying' | 'dawan' | 'generic';
export interface BossMountDef { horse: BossHorse; tint?: number; /** 骑者裁到帧高的比例（只露上半身，腿被马挡住）。 */ cut?: number; /** 首领骑乘图 id（public/assets/ride-v2/boss_<id>_ride.png）。 */ rider?: string }
/**
 * 已交付的首领骑乘图（画风会话出，4×9 每格 256 脚底 240：行 1–4 骑行 下 / 左 / 右 / 上，行 5–8 马上出招，行 9 坠马朝右）。
 * 只给这里登记过的首领载图（没出的不去请求，免得 404）；没有的仍用「本体裁上半身放鞍上」顶替。
 */
/** 站姿骑乘图的过渡裁切：裁到大腿根（seat，格内像素），髋部压在鞍上（离地 rise 世界像素）。只用于还没重画成坐姿（不在 SEATED_RIDE_ART）的首领。 */
export const RIDE_SEAT = { seat: 200, rise: 50 } as const;
export const BOSS_RIDE_ART = new Set<string>(['lubu', 'huaxiong', 'zhangliang', 'lijue', 'zhangxiu', 'yanliang']);
/** 已重画成坐姿的骑乘图（不再裁切，按马镫对位，同英雄 HeroMount）；其余仍用 RIDE_SEAT 裁切过渡。 */
export const SEATED_RIDE_ART = new Set<string>(['lubu']);
export const bossRideKey = (id: string): string => 'ride_v2_boss_' + id;
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
  /** 脚下的马（BossPresence 放大首领时一起放大）。 */
  get horseImage(): Phaser.GameObjects.Image | null { return this.horse; }
  /** 朝镜头时盖在骑者腿前的马头马颈（骑乘图版：骑者才像「跨坐」而不是「站在马背上」）；BossPresence 放大首领时一起放大。 */
  private front: Phaser.GameObjects.Image | null = null;
  get frontImage(): Phaser.GameObjects.Image | null { return this.front; }
  private key: string; private last = { x: 0, y: 0 }; private dir: typeof DIRS[number] = 'down'; private stepAt = 0; private frame = 0;
  private readonly onPhase = (e: BossPhaseEvent): void => { if (e.boss === this.boss && e.phase === 2 && this.mounted) this.dismount(); };
  /** 骑乘图已就绪时的纹理键；坠马动画播到何时（期间藏起首领本体）。 */
  private rideKey: string | null = null; private fallUntil = 0;
  /** attacking：控制器此刻在起手 / 出手（骑乘图换马上出招行）。 */
  constructor(private scene: Phaser.Scene, private boss: Enemy, private def: BossMountDef, private attacking?: () => boolean) {
    this.key = HORSE_KEY[def.horse];
    this.last = { x: boss.x, y: boss.y };
    this.ensure(); this.ensureRide();
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
  private ensureRide(): void {
    const id = this.def.rider, s = this.scene; if (!id || !BOSS_RIDE_ART.has(id)) return;
    const k = bossRideKey(id); if (s.textures.exists(k)) { this.rideKey = k; return; }
    s.load.spritesheet(k, `assets/ride-v2/boss_${id}_ride.png`, { frameWidth: RIDE.cell, frameHeight: RIDE.cell });
    s.load.once('filecomplete-spritesheet-' + k, () => { this.rideKey = k; });
    if (!s.load.isLoading()) s.load.start();
  }
  get usesRideArt(): boolean { return !!this.rideKey; }
  private make(): void {
    this.horse = this.scene.add.image(this.boss.x, this.boss.y, this.key, 'down_0').setOrigin(.5, HORSE_V2.foot / HORSE_V2.cell).setScale(HORSE_V2.scale).setName('boss-horse');
    if (this.def.tint !== undefined) this.horse.setTint(this.def.tint);
    this.front = this.scene.add.image(this.boss.x, this.boss.y, this.key, 'down_0').setOrigin(.5, HORSE_V2.foot / HORSE_V2.cell).setScale(HORSE_V2.scale).setName('boss-horse-front').setVisible(false);
    if (this.def.tint !== undefined) this.front.setTint(this.def.tint);
  }
  get hasHorse(): boolean { return !!this.horse && this.mounted; }

  /** 每帧（控制器摆完姿势之后）：马跟着首领、骑者裁上半身抬到鞍上。 */
  update(): void {
    const b = this.boss, h = this.horse;
    if (!this.mounted && this.scene.time.now < this.fallUntil) { b.sprite.setAlpha(0); return; } // 坠马动画期间本体藏起
    if (!this.mounted || !h) return;
    if (!b.active) { this.destroy(); return; }
    const dx = b.x - this.last.x, dy = b.y - this.last.y, moving = Math.hypot(dx, dy) > .4, now = this.scene.time.now; this.last = { x: b.x, y: b.y };
    if (moving) this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (moving && now >= this.stepAt) { this.stepAt = now + 95; this.frame = (this.frame + 1) % 4; } else if (!moving) this.frame = 0;
    h.setPosition(b.x, b.y).setFrame(`${this.dir}_${this.frame}`).setDepth(b.sprite.depth - .002).setVisible(b.sprite.visible).setAlpha(b.sprite.alpha);
    // 前景层：骑乘图版朝镜头时，马头马颈（帧高 30%~56%）盖在骑者腿前（同英雄骑乘 HeroMount）
    const fr = this.front;
    if (fr) {
      const down = !!this.rideKey && this.dir === 'down';
      fr.setVisible(down && b.sprite.visible).setPosition(b.x, b.y).setDepth(b.sprite.depth + .001).setAlpha(b.sprite.alpha);
      if (down) { fr.setFrame(`down_${this.frame}`); fr.setCrop(0, HORSE_V2.cell * RIDE_FRONT.top, HORSE_V2.cell, HORSE_V2.cell * (RIDE_FRONT.cut - RIDE_FRONT.top)); }
    }
    // 骑者：有首领骑乘图 → 整张换成骑乘帧（行 1–4 骑行、行 5–8 马上出招），马镫对到马的镫高（朝镜头 / 背对时整体再抬，同英雄）
    if (this.rideKey) {
      const row = DIRS.indexOf(this.dir) + (this.attacking?.() ? 4 : 0), f = row * 4 + (this.attacking?.() ? Math.floor(now / 110) % 4 : this.frame);
      if (SEATED_RIDE_ART.has(this.def.rider ?? '')) b.sprite.setCrop().setTexture(this.rideKey, f).setFlipX(false).setScale(RIDE.scale).setOrigin(.5, (RIDE.foot + (RIDE.stirrup + (RIDE_DIR_LIFT[this.dir] ?? 0)) / RIDE.scale) / RIDE.cell);
      else b.sprite.setTexture(this.rideKey, f).setCrop(0, 0, RIDE.cell, RIDE_SEAT.seat).setFlipX(false).setScale(RIDE.scale).setOrigin(.5, (RIDE_SEAT.seat + RIDE_SEAT.rise / RIDE.scale) / RIDE.cell);
      return;
    }
    // 没有骑乘图：裁掉本体下半身，髋部对到鞍高（HORSE_V2.riderRise 逻辑像素）
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
    this.front?.destroy(); this.front = null;
    // 有骑乘图：播第 9 行坠马 4 帧（掀下 → 落地 → 半跪 → 起身，朝右画；主将在左时镜像），期间藏起首领本体
    if (this.rideKey) {
      const k = this.rideKey, left = b.x > (s as unknown as { player?: { x: number } }).player!.x, img = s.add.image(b.x, b.y, k, 32).setOrigin(.5, RIDE.foot / RIDE.cell).setScale(RIDE.scale).setFlipX(left).setDepth(b.sprite.depth + .05).setName('boss-fall');
      const t0 = s.time.now, ms = 900; this.fallUntil = t0 + ms;
      const play = (): void => { const t = (s.time.now - t0) / ms; if (t >= 1 || !img.active) { s.events.off('postupdate', play); img.destroy(); if (b.active) b.sprite.setAlpha(1); return; } img.setPosition(b.x, b.y).setFrame(32 + Math.min(3, Math.floor(t * 4))); };
      s.events.on('postupdate', play);
    }
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
    this.horse?.destroy(); this.horse = null; this.front?.destroy(); this.front = null;
    if (this.boss.sprite?.active) this.boss.sprite.setCrop();
  }
}
