import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import { playSheet } from './SkillFxSheets';

/**
 * 战法「迂回袭」表现（第三版：手绘透明序列帧，用户：「不要再做像素特效了」「不需要太夸张」）。只管画面与音效，伤害在 BuildCombat。
 * 素材：public/assets/skill-fx/flank_streak.png（月白侧袭弧光）、strike_glint.png（命中星芒）。
 * - 蓄力：不提示（克制；增益图标上有进度）。
 * - 蓄满：主将身侧一个很小的星芒约每秒闪一下，轻响 flankReady。
 * - 触发：一道细长月白弧光从侧面扫过被波及的敌人群，每个被波及的敌人一个小星芒，约 0.25 秒内消失。
 * 缺图时什么都不画。
 */
export class FlankFx {
  private ready = false;
  private blinkAt = 0;
  readonly stats = { readyCount: 0, strikes: 0, sweeps: 0, hits: 0, blinks: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {}

  get isReady(): boolean { return this.ready; }

  /** 每帧：level 为迂回袭等级（0 = 未拥有），ratio 为蓄力进度 0–1。 */
  update(dt: number, level: number, ratio: number): void {
    void dt;
    const p = this.player;
    if (!level || !p.alive) { this.ready = false; return; }
    if (ratio >= 1 && !this.ready) { this.ready = true; this.stats.readyCount++; this.blinkAt = 0; this.sfx?.play('flankReady'); }
    if (ratio < 1) this.ready = false;
    const now = this.scene.time.now;
    if (this.ready && now - this.blinkAt > 1000) {
      this.blinkAt = now; this.stats.blinks++;
      const side = p.direction === 'left' ? -1 : 1;
      playSheet(this.scene, 'fx_strike_glint', p.x + side * 14, p.y - 6, { size: 18, ms: 260, depth: p.sprite.depth + .004, add: true, alpha: .8, name: 'flank-ready-glint' });
    }
  }

  /** 触发：一道月白弧光侧扫被波及的敌人群，每人一个小星芒。 */
  strike(targets: Enemy[]): void {
    if (!targets.length) return;
    this.stats.strikes++; this.stats.sweeps++; this.ready = false;
    this.sfx?.play('flankStrike');
    const p = this.player, sc = this.scene;
    const cx = targets.reduce((n, e) => n + e.x, 0) / targets.length, cy = targets.reduce((n, e) => n + e.y, 0) / targets.length - 18;
    // 图上弧光从左下扫向右上；让它垂直于主将→目标群的方向掠过（从侧面扫），随机左 / 右侧
    const ang = Math.atan2(cy - (p.y - 18), cx - p.x), side = Math.random() < .5 ? 1 : -1;
    playSheet(sc, 'fx_flank_streak', cx, cy, { size: 120, ms: 250, depth: DEPTH.fx, rotation: ang + Math.PI / 4 * side, flipY: side < 0, add: true, alpha: .9, name: 'flank-streak' });
    targets.forEach((e, i) => sc.time.delayedCall(60 + 40 * i, () => { this.stats.hits++; playSheet(sc, 'fx_strike_glint', e.x, e.y - 18, { size: 34, ms: 170, depth: DEPTH.fx + .1, add: true }); }));
  }

  destroy(): void { /* 序列帧各自播完销毁 */ }
}
