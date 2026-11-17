import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { BOSS_KIT } from '../data/bossRedesign';
import { playBossFx } from './BossFx';

/**
 * 首领重设计的公共件（样板 4 人共用，2026-11-16 用户选方案 C）：
 *  - 程序化姿态 pose：招式图集出来前，用前倾 / 后仰 / 下蹲 / 施法 / 踉跄顶上（只改显示，不动碰撞）。
 *  - 收招破绽 recover：身上暖色闪光 + 脚下几颗金色火星，告诉玩家「现在可以打」。
 *  - 二阶段转场 phaseShift：无敌 1.5 秒 + 震屏 + 台词横幅 + 场景色调滤镜（之后一直保留）。
 *  - 招式节拍 Beat：起手 → 预警 → 出手 → 收招 四段计时。
 * 预警特效一律走 Telegraph / WarnFx 的公共入口（查 Bug 会话维护），这里不画预警圈。
 */

/** 旧版首领（对比 / 回退）：?boss=old。 */
export const BOSS_OLD: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('boss') === 'old'; } catch { return false; } })();

/**
 * 首领招式图集（画风会话出，public/assets/bosses-v2/<id>_moves.png）：4×4、每格 288、脚底 y=256、全部朝右。
 * 帧 0~3 起手、4~7 出手、8~11 收招、12~13 转场、14~15 受伤。
 */
export function ensureMoves(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.spritesheet(key, `assets/bosses-v2/${key}.png`, { frameWidth: 288, frameHeight: 288 });
  if (!scene.load.isLoading()) scene.load.start();
}

export type PoseKind = 'lean' | 'rear' | 'crouch' | 'cast' | 'stagger' | 'spin';
export type BeatPhase = 'idle' | 'windup' | 'warn' | 'release' | 'recover';

/** 测试模式「首领 → 指定招式 / 二阶段」按钮用的统一接口。 */
export interface BossDebug { moves: readonly string[]; force(index: number, now: number): void; phase2(now: number): void; }

interface KitHost {
  scene: Phaser.Scene; boss: Enemy;
  banner: (text: string, caption?: string) => void;
  sfx?: (key: string) => void;
}

export class BossKit {
  private poseKind: PoseKind | null = null; private poseAmt = 0; private poseDir = 1;
  private saved: { sx: number; sy: number; rot: number } | null = null;
  private moveKey: string | null = null; private moveFrame = 0; private moveDir = 1;
  private savedTex: { key: string; frame: string | number; ox: number; oy: number; flip: boolean; sx: number; sy: number } | null = null;
  private recoverUntil = 0; private recoverFrom = 0;
  private sparks: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Rectangle;
  private shiftUntil = 0; private shifting = false;
  constructor(private h: KitHost) {
    const s = h.scene;
    this.sparks = s.add.graphics().setDepth(DEPTH.fx - 2).setName('bosskit-sparks');
    s.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.restore, this);
    s.events.on(Phaser.Scenes.Events.POST_UPDATE, this.apply, this);
    s.events.once('shutdown', () => this.clear());
  }
  get now(): number { return (this.h.scene as unknown as { combatNow?: number }).combatNow ?? this.h.scene.time.now; }
  /** 转场中（无敌、招式暂停）。 */
  get inShift(): boolean { return this.shifting; }

  /** 本帧姿态（每帧调用；不调用就回到原样）。amt 0~1；dir = 朝向左右（-1 / 1）。 */
  pose(kind: PoseKind | null, amt = 1, dir = 1): void { this.poseKind = kind; this.poseAmt = Math.max(0, Math.min(1, amt)); this.poseDir = dir < 0 ? -1 : 1; }

  /** 招式名横幅（大招 / 招牌招）。 */
  banner(text: string, caption?: string): void { this.h.banner(text, caption); }

  /** 本帧用招式图集的第 frame 帧（每帧调用；图没载入时返回 false，调用方保持原来的画法）。dir：-1 朝左（图朝右，左边镜像）。 */
  move(key: string, frame: number, dir = 1): boolean {
    if (!this.h.scene.textures.exists(key)) return false;
    this.moveKey = key; this.moveFrame = Math.max(0, Math.min(15, Math.floor(frame))); this.moveDir = dir < 0 ? -1 : 1; return true;
  }

  /** 收招破绽：持续 ms，期间暖色闪光 + 火星。 */
  recover(now: number, ms: number): void { this.recoverFrom = now; this.recoverUntil = now + ms; }

  /** 二阶段转场。tint = 场景滤镜颜色（之后保留）；onDone 在无敌结束时调用。 */
  phaseShift(now: number, line: string, caption: string, tint: number, alpha = .16): void {
    const { scene, boss } = this.h;
    this.shifting = true; this.shiftUntil = now + BOSS_KIT.shiftMs; boss.invulnerable = true;
    scene.cameras.main.shake(BOSS_KIT.shiftShakeMs, BOSS_KIT.shiftShake);
    scene.cameras.main.flash(260, (tint >> 16) & 255, (tint >> 8) & 255, tint & 255, false);
    this.h.banner(line, caption); this.h.sfx?.('gong');
    // 手绘气浪（图到后）：以首领为中心向外冲，按首领换色
    playBossFx(scene, 'kit_shift', boss.x, boss.y - 20, 460, DEPTH.fx + 1, 0, 5, 700, tint === 0x300808 ? 0xff7a5a : tint === 0x3a2a05 ? 0xffd77a : 0xffe2b0);
    this.overlay?.destroy();
    this.overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 1.2, GAME_HEIGHT * 1.2, tint, 0).setScrollFactor(0).setDepth(DEPTH.fx + 6).setName('boss-phase-filter');
    scene.tweens.add({ targets: this.overlay, fillAlpha: alpha, duration: 900 });
  }

  /** 每帧（战斗时钟）调用：转场计时、收招火星。 */
  update(now: number): void {
    const b = this.h.boss;
    if (this.shifting) {
      this.pose('rear', .6 + .4 * Math.sin(now / 70), 1);
      if (now >= this.shiftUntil) { this.shifting = false; b.invulnerable = false; }
    }
    const g = this.sparks; g.clear();
    if (now < this.recoverUntil && b.active) {
      // 收招：每拍一次暖色着色（借受击闪白的复原机制），脚下几颗金色方块火星向上飘
      if (Math.floor((now - this.recoverFrom) / BOSS_KIT.recoverPulseMs) % 2 === 0) { b.sprite.setTint(0xffd27a); b.flashUntil = now + 90; }
      const t = (now - this.recoverFrom) / 1000;
      for (let i = 0; i < 6; i++) {
        const k = (t * 1.6 + i / 6) % 1, a = i * 1.047 + t;
        const x = b.x + Math.cos(a) * (b.radius + 6), y = b.y - k * 46;
        g.fillStyle(i % 2 ? 0xf2c27a : 0xffe2a0, (1 - k) * .9).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      }
      this.pose('stagger', .5, 1);
    }
  }

  private restore(): void {
    const sp = this.h.boss.sprite;
    if (this.saved) { if (sp.active) { sp.setScale(this.saved.sx, this.saved.sy); sp.setRotation(this.saved.rot); } this.saved = null; }
    const t = this.savedTex;
    if (t) { if (sp.active && this.h.scene.textures.exists(t.key)) sp.setTexture(t.key, t.frame).setOrigin(t.ox, t.oy).setFlipX(t.flip).setScale(t.sx, t.sy); this.savedTex = null; }
  }
  private apply(): void {
    const sp = this.h.boss.sprite, k = this.poseKind, a = this.poseAmt, d = this.poseDir;
    this.poseKind = null;
    // 招式图集：保持当前显示高度换帧（v2 本体格子同为 288、人物等高），脚底对齐 256/288
    if (this.moveKey && sp.active && this.h.boss.active) {
      this.savedTex = { key: sp.texture.key, frame: sp.frame.name, ox: sp.originX, oy: sp.originY, flip: sp.flipX, sx: sp.scaleX, sy: sp.scaleY };
      const s = Math.abs(sp.displayHeight) / 288;
      sp.setTexture(this.moveKey, this.moveFrame).setOrigin(.5, 256 / 288).setFlipX(this.moveDir < 0).setScale(s);
    }
    this.moveKey = null;
    if (!k || !sp.active || !this.h.boss.active) return;
    this.saved = { sx: sp.scaleX, sy: sp.scaleY, rot: sp.rotation };
    let rot = 0, sx = 1, sy = 1;
    if (k === 'lean') { rot = .2 * a * d; sx = 1 + .04 * a; sy = 1 - .05 * a; }
    else if (k === 'rear') { rot = -.16 * a * d; sy = 1 + .07 * a; sx = 1 - .03 * a; }
    else if (k === 'crouch') { sy = 1 - .14 * a; sx = 1 + .08 * a; }
    else if (k === 'cast') { sy = 1 + .05 * a + .02 * Math.sin(this.now / 90); sx = 1 - .02 * a; }
    else if (k === 'stagger') { rot = .07 * Math.sin(this.now / 110) * a; sy = 1 - .05 * a; }
    else if (k === 'spin') { sx = Math.cos(this.now / 60) * (1 + .05 * a); }
    sp.setScale(this.saved.sx * sx, this.saved.sy * sy).setRotation(this.saved.rot + rot);
  }

  clear(): void {
    const s = this.h.scene;
    s.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.restore, this);
    s.events.off(Phaser.Scenes.Events.POST_UPDATE, this.apply, this);
    this.restore(); this.sparks.destroy(); this.overlay?.destroy(); this.overlay = undefined;
    if (this.shifting) { this.shifting = false; this.h.boss.invulnerable = false; }
  }
}

/** 招式节拍：起手 → 预警 → 出手 → 收招。时间都是战斗时钟毫秒。 */
export class Beat<M extends string> {
  move: M | null = null; phase: BeatPhase = 'idle'; from = 0; until = 0;
  set(move: M | null, phase: BeatPhase, now: number, ms: number): void { this.move = move; this.phase = phase; this.from = now; this.until = now + ms; }
  /** 当前段进度 0~1。 */
  progress(now: number): number { return Math.max(0, Math.min(1, (now - this.from) / Math.max(1, this.until - this.from))); }
  done(now: number): boolean { return now >= this.until; }
  age(now: number): number { return now - this.from; }
}

/** 朝向：dx 正 = 右。 */
export const faceDir = (dx: number): number => (dx < 0 ? -1 : 1);
