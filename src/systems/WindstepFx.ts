import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { Player } from '../entities/Player';
import { playSheet } from './SkillFxSheets';

/**
 * 战法「踏风步」表现（第二版：手绘透明序列帧，用户：「不要再做像素特效了」）。只管画面与音效，增伤在 BuildCombat.damage。
 * 素材：public/assets/skill-fx/windstep_burst.png（白色风刃 + 嫩绿碎叶）、strike_glint.png（蓄满小星芒）。
 * - 蓄力：不提示（克制；增益图标上有进度）。
 * - 蓄满：脚边一个很小的星芒约每 1.2 秒闪一下，轻响 windReady（与迂回袭的腰侧星芒高度不同）。
 * - 命中：命中点爆一小团碎叶风刃（比迂回袭更轻更小），音效 windHit。
 * 缺图时什么都不画。
 */
export class WindstepFx {
  private ready = false;
  private blinkAt = 0;
  readonly stats = { readyCount: 0, bursts: 0, blinks: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {}

  get isReady(): boolean { return this.ready; }

  /** 每帧：level 为踏风步等级（0 = 未拥有），ratio 为蓄力进度 0–1。 */
  update(dt: number, level: number, ratio: number): void {
    void dt;
    const p = this.player;
    if (!level || !p.alive) { this.ready = false; return; }
    if (ratio >= 1 && !this.ready) { this.ready = true; this.stats.readyCount++; this.blinkAt = 0; this.sfx?.play('windReady'); }
    if (ratio < 1) this.ready = false;
    const now = this.scene.time.now;
    if (this.ready && now - this.blinkAt > 1200) {
      this.blinkAt = now; this.stats.blinks++;
      const side = p.direction === 'left' ? 1 : -1;
      playSheet(this.scene, 'fx_strike_glint', p.x + side * 10, p.y + 24, { size: 14, ms: 240, depth: p.sprite.depth + .003, add: true, alpha: .7, name: 'wind-ready-glint' });
    }
  }

  /** 踏风步那一击命中：命中点一小团碎叶风刃。 */
  burst(x: number, y: number): void {
    this.stats.bursts++; this.ready = false;
    this.sfx?.play('windHit');
    const a = Math.atan2(y - this.player.y, x - this.player.x);
    playSheet(this.scene, 'fx_windstep_burst', x, y - 18, { size: 54, ms: 300, depth: DEPTH.fx + .05, rotation: a * .3, name: 'wind-burst' });
  }

  destroy(): void { /* 序列帧各自播完销毁 */ }
}
