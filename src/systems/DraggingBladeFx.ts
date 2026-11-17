import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';
import { DRAG_SLASH_MS, DRAG_SLASH_SHEET, DRAG_SLASH_WEIGHTS, DRAG_TIP } from '../data/dragArt';
import { DRAG_TRAVEL } from './RunGrowth';
import { playSheet } from './SkillFxSheets';

/**
 * 关羽本命修习「拖刀斩」表现（第三版：手绘透明序列帧，用户：「不要再做像素特效了」）。只管画面与音效，伤害判定在 weapons/registry.ts。
 * 素材：public/assets/skill-fx/（drag_sparks 火星 / drag_scar 划痕 / drag_gleam 刀刃寒光 / drag_wave 半月刀气 / strike_glint 命中星芒）。
 * - 蓄力：移动时刀尖拖地冒一小簇橙红火星，地上隔一段留一道余烬划痕；越接近蓄满，火星越密。
 * - 蓄满：刀刃上一线寒光从刀根扫到刀尖（约每 0.9 秒一次），轻响 bladeReady。
 * - 释放：白金半月刀气向前飞出淡去（三级回旋同一张图、更小更淡、边飞边旋），命中处一个小星芒。
 * 缺图时什么都不画（不再退回程序像素图）。
 */
type Dir = 'down' | 'up' | 'left' | 'right';

export class DraggingBladeFx {
  private ready = false;
  private trail = 0;
  private sparkAt = 0;
  private gleamAt = 0;
  /** 测试 / 调试用统计。 */
  readonly stats = { sparks: 0, grooves: 0, readyCount: 0, waves: 0, spins: 0, flashes: 0, gleams: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {}

  get isReady(): boolean { return this.ready; }
  /** 蓄力进度 0–1（门槛与 weapons/registry.ts 同源：RunGrowth.DRAG_TRAVEL）。 */
  get ratio(): number { const lv = this.player.growth.masteries.dragging_blade; return lv ? Math.min(1, this.player.growth.travel / DRAG_TRAVEL[lv - 1]) : 0; }

  /** 刀尖着地点：拖刀行走图按实测 DRAG_TIP；没有拖刀图时现有行走图的刀头在身前脚边。 */
  private tip(): { x: number; y: number; back: number } {
    const p = this.player, d = p.direction as Dir;
    if (p.dragWalking) { const [tx, ty] = DRAG_TIP[d]; return { x: p.x + tx, y: p.y + ty, back: d === 'right' ? -1 : d === 'left' ? 1 : 0 }; }
    const o = { right: [26, 20, -1], left: [-26, 20, 1], down: [14, 22, 0], up: [-12, 14, 0] }[d];
    return { x: p.x + o[0], y: p.y + o[1], back: o[2] };
  }
  /** 握刀手的大致位置（寒光沿 手 → 刀尖 这段刀身扫过）。 */
  private hand(): { x: number; y: number } {
    const p = this.player, d = p.direction as Dir, o = p.dragWalking ? { right: [-4, 4], left: [4, 4], down: [-6, 4], up: [6, 2] }[d] : { right: [6, 2], left: [-6, 2], down: [6, 4], up: [-6, 0] }[d];
    return { x: p.x + o[0], y: p.y + o[1] };
  }

  /** 每帧调用：moved 为本帧主动移动的距离（与 RunGrowth.recordMovement 同口径）。 */
  update(dt: number, moved: number): void {
    void dt;
    const lv = this.player.growth.masteries.dragging_blade;
    if (!lv || !this.player.alive) { this.ready = false; return; }
    const ratio = this.ratio, now = this.scene.time.now, tip = this.tip(), depth = actorDepth(this.player.y + 26) + .004;
    if (ratio >= 1 && !this.ready) { this.ready = true; this.stats.readyCount++; this.gleamAt = 0; this.sfx?.play('bladeReady'); }
    if (ratio < 1) this.ready = false;
    if (moved > .3) {
      // 划痕：每拖过 26 像素留一道（0.9 秒由亮到暗淡出），上下走时竖放
      this.trail += moved;
      if (this.trail >= 26) {
        this.trail = 0; this.stats.grooves++;
        const vertical = this.player.direction === 'up' || this.player.direction === 'down';
        playSheet(this.scene, 'fx_drag_scar', tip.x, tip.y + 1, { size: 44, ms: 900, depth: DEPTH.deco + 2, rotation: vertical ? Math.PI / 2 : 0, alpha: .55 + .35 * ratio });
      }
      // 火星：每 260 → 110ms 一簇（越蓄越密），朝身后飞溅
      if (now - this.sparkAt > 260 - 150 * ratio) {
        this.sparkAt = now; this.stats.sparks++;
        playSheet(this.scene, 'fx_drag_sparks', tip.x, tip.y, { size: 34 + 14 * ratio, ms: 360, depth, add: true, originX: .76, originY: .84, flipX: tip.back > 0, alpha: .7 + .3 * ratio });
      }
    }
    if (this.ready && now - this.gleamAt > 900) {
      // 寒光：图上是从左下（刀根）扫到右上（刀尖），对齐到 手 → 刀尖
      this.gleamAt = now; this.stats.gleams++;
      const h = this.hand(), dx = tip.x - h.x, dy = tip.y - h.y, len = Math.hypot(dx, dy);
      playSheet(this.scene, 'fx_drag_gleam', (h.x + tip.x) / 2, (h.y + tip.y) / 2, { size: len * 1.35, ms: 540, depth: depth + .002, rotation: Math.atan2(dy, dx) + Math.PI / 4, add: true, name: 'drag-ready-gleam' });
    }
  }

  /**
   * 释放刀气。size：刀气弧长（与旧版 spawnGuandaoSlash 同口径）；hits：本次命中敌人的位置（按刀气飞到时闪光）。
   * kind：'crescent' 白金半月刀气向前飞；'spin' 三级回旋（同一张图，更小更淡、弧向相反、边飞边旋）。
   */
  release(angle: number, size: number, kind: 'crescent' | 'spin', hits: { x: number; y: number }[]): void {
    const spin = kind === 'spin', p = this.player, sc = this.scene;
    if (spin) this.stats.spins++; else this.stats.waves++;
    this.ready = false;
    if (!spin) sc.cameras.main.shake(70, .002);
    this.sfx?.play(spin ? 'bladeSpin' : 'bladeWave');
    // 拖刀上撩出刀动作（有图时）：半月刀气那一下，朝刀气方向的左 / 右
    if (!spin) { const strip = DRAG_SLASH_SHEET[p.growth.character]; if (strip) p.playStrip(strip, ['0', '1', '2', '3'], DRAG_SLASH_MS, Math.cos(angle) < 0, DRAG_SLASH_WEIGHTS); }
    const s = size * (spin ? .6 : .85), dist = size * (spin ? .4 : .55), dur = spin ? 400 : 380, speed = dist / (dur / 1000);
    const x0 = p.x + Math.cos(angle) * 16, y0 = p.y + Math.sin(angle) * 16 - 10;
    playSheet(sc, 'fx_drag_wave', x0, y0, { size: s, ms: dur, depth: DEPTH.fx, rotation: angle, flipY: spin, add: true, alpha: spin ? .55 : .85, name: spin ? 'drag-spin-wave' : 'drag-crescent-wave',
      onUpdate: (img, t) => { const e = 1 - (1 - t) * (1 - t); img.setPosition(x0 + Math.cos(angle) * dist * e, y0 + Math.sin(angle) * dist * e); if (spin) img.setRotation(angle + t * Math.PI * 2.5); } });
    for (const hit of hits) {
      const d = Math.hypot(hit.x - x0, hit.y - y0), delay = Math.min(dur, d / speed * 1000 * .8);
      sc.time.delayedCall(delay, () => { this.stats.flashes++; playSheet(sc, 'fx_strike_glint', hit.x, hit.y - 18, { size: 40, ms: 180, depth: DEPTH.fx + .1, add: true }); });
    }
  }

  destroy(): void { /* 序列帧各自播完销毁 */ }
}
