import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyDef } from '../data/enemies';
import type { EnemyKind } from '../types';
import { DEPTH } from '../config';
import { BossKit, Beat, type BossDebug } from './BossKit';

export interface ArcHost {
  scene: Phaser.Scene; boss: Enemy; player: Player; army: Legion;
  spawn: (kind: EnemyKind, x: number, y: number, def?: EnemyDef) => Enemy | null;
  def: (kind: EnemyKind) => EnemyDef;
  banner: (text: string, caption?: string) => void;
  sfx: (key: string) => void;
}

/** ThirdGameScene 用到的首领控制器接口（旧 ThirdBoss 与重设计样板共用）。 */
export interface ArcController {
  phase2: boolean; readonly label: string;
  forceSkill(now: number): void; incoming(ally: boolean): number; hit(now: number): void;
  update(dt: number, now: number): void; defeat(): void; updateDeath(delta: number): void; clear(): void;
  readonly debug?: BossDebug;
}

/**
 * 第三 / 五章首领重设计样板的公共底座（袁术、曹仁）：沿用 ThirdBoss 的 4×8 首领图帧位
 * （行走 dir*4+帧、起手 17、号令 24、出手 18~23、强化 25、倒地 28~31），招式各自实现。
 */
export abstract class ArcBossV2<M extends string> implements ArcController {
  state: 'approach' | 'warn' | 'attack' | 'recover' | 'rage' | 'dead' = 'approach';
  phase2 = false;
  readonly kit: BossKit; protected beat = new Beat<M>();
  protected gfx: Phaser.GameObjects.Graphics;
  protected angle = 0; protected next = 0;
  private hitAt = 0; private corpse?: Phaser.GameObjects.Image; private deathMs = 0; protected gone = false;
  abstract readonly debug: BossDebug;
  abstract get label(): string;
  abstract update(dt: number, now: number): void;
  constructor(protected h: ArcHost, protected tex: string, readonly name: string, now: number) {
    this.kit = new BossKit({ scene: h.scene, boss: h.boss, banner: h.banner, sfx: h.sfx });
    this.gfx = h.scene.add.graphics().setDepth(DEPTH.fx - 1);
    h.boss.controlImmune = true; this.next = now + 1200;
  }
  /** 受到伤害倍率（部曲人多时分摊，同旧版）× 本首领的招式倍率。 */
  incoming(ally: boolean): number { return (ally ? 1 / Math.sqrt(Math.max(1, this.h.army.count / 12)) : 1) * this.takenMul(); }
  protected takenMul(): number { return 1; }
  hit(now: number): void { this.hitAt = now + 100; }
  forceSkill(now: number): void { this.debug.force(0, now); }

  protected pose(frame: number, now: number): void {
    const b = this.h.boss;
    b.sprite.setTexture(this.tex, frame).setDisplaySize(144, 144).setOrigin(.5, 114 / 128).setFlipX(frame >= 16 && Math.cos(this.angle) < 0);
    if (this.hitAt > now) b.sprite.setTint(0xffbbbb); else if (b.flashUntil <= now) b.sprite.setTint(0xffffff);
  }
  /** 走向主将并保持 keep 距离；返回是否在走。 */
  protected walk(dt: number, now: number, keep = 115, speedMul = 1): boolean {
    const b = this.h.boss, p = this.h.player, dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0, moving = d > keep;
    if (moving) { b.sprite.x += dx / d * b.def.speed * speedMul * dt; b.sprite.y += dy / d * b.def.speed * speedMul * dt; }
    this.pose(dir * 4 + (moving ? Math.floor(now / 120) % 4 : 0), now);
    return moving;
  }
  /** 一个不会动、不会攻击的「物件」敌人（旗、柱）：本体隐藏，由调用方画。 */
  protected spawnProp(x: number, y: number, hp: number, tint: number): Enemy | null {
    const base = this.h.def('infantry');
    const e = this.h.spawn('infantry', x, y, { ...base, walkVisual: undefined, attackVisual: undefined, behavior: undefined, hp, speed: 0, damage: 0, xp: 1, radius: 18, tint });
    if (e) { e.controlImmune = true; e.sprite.setAlpha(0); }
    return e;
  }
  protected toRecover(now: number, ms: number): void { this.beat.set(this.beat.move, 'recover', now, ms); this.kit.recover(now, ms); this.state = 'recover'; }
  protected toIdle(now: number, gap: number): void { this.beat.set(null, 'idle', now, 0); this.state = 'approach'; this.next = now + gap; }

  defeat(): void {
    this.state = 'dead'; this.gfx.clear(); const b = this.h.boss;
    this.corpse = this.h.scene.add.image(b.x, b.y, this.tex, 28).setDisplaySize(144, 144).setOrigin(.5, 114 / 128).setDepth(28);
    this.onDefeat();
  }
  protected onDefeat(): void { /* 子类清理 */ }
  updateDeath(delta: number): void { if (this.corpse) { this.deathMs += delta; this.corpse.setFrame(28 + Math.min(3, Math.floor(this.deathMs / 180))); } }
  clear(): void { if (this.gone) return; this.gone = true; this.onDefeat(); this.gfx.destroy(); this.kit.clear(); }
}
