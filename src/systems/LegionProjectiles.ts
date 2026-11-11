import Phaser from 'phaser';
import type { Ally } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import type { SpatialGrid } from './SpatialGrid';
import { DEPTH } from '../config';

interface Arrow { active: boolean; launched: boolean; owner: Ally; lifeId: number; target: Enemy; spawnId: number; due: number; x: number; y: number; vx: number; vy: number; ttl: number; damage: number; image: Phaser.GameObjects.Image | null; }
/** Logical arrows have no gameplay cap; a small reusable display pool bounds visual cost. */
export class LegionProjectiles {
  private readonly shots: Arrow[] = [];
  private readonly images: Phaser.GameObjects.Image[] = [];
  private rendered = 0;
  private readonly near: Enemy[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene) { this.gfx = scene.add.graphics().setDepth(DEPTH.projectile - .1); }
  fire(owner: Ally, target: Enemy, damage: number, due: number): void {
    const shot = this.shots.find(s => !s.active);
    const state = { active: true, launched: false, owner, lifeId: owner.lifeId, target, spawnId: target.spawnId, due, x: owner.x, y: owner.y, vx: 0, vy: 0, ttl: 0, damage, image: null };
    if (shot) Object.assign(shot, state); else this.shots.push(state);
  }
  clear(): void { for (const s of this.shots) if (s.active) this.release(s); this.gfx.clear(); }
  get count(): number { return this.shots.filter(s => s.active).length; }
  update(dt: number, now: number, grid: SpatialGrid<Enemy>, damage: (e: Enemy, amount: number) => void): void {
    this.gfx.clear();
    for (const s of this.shots) {
      if (!s.active || now < s.due) continue;
      if (!s.target.active || s.target.spawnId !== s.spawnId) { this.release(s); continue; }
      if (!s.launched) {
        if (!s.owner.active || s.owner.lifeId !== s.lifeId) { this.release(s); continue; }
        const angle = Math.atan2(s.target.y - (s.owner.y - 12), s.target.x - s.owner.x), speed = s.owner.kind === 'crossbowman' ? 650 : 540;
        s.x = s.owner.x + Math.cos(angle) * 15; s.y = s.owner.y - 12 + Math.sin(angle) * 15;
        s.vx = Math.cos(angle) * speed; s.vy = Math.sin(angle) * speed; s.ttl = .9; s.launched = true;
        if (s.owner.view && this.rendered < 96) {
          s.image = this.images.pop() ?? this.scene.add.image(0, 0, 'arrow').setDepth(DEPTH.projectile);
          s.image.setDisplaySize(s.owner.kind === 'crossbowman' ? 23 : 28, 5).setRotation(angle).setTint(0xffe0a3).setVisible(true); this.rendered++;
        }
      }
      const ax = s.x, ay = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.ttl -= dt;
      s.image?.setPosition(s.x, s.y);
      if (s.image) { const len = Math.hypot(s.vx, s.vy); this.gfx.lineStyle(1, 0xffe1a5, .3).lineBetween(s.x - s.vx / len * 17, s.y - s.vy / len * 17, s.x, s.y); }
      const dx = s.x - ax, dy = s.y - ay, length2 = dx * dx + dy * dy;
      let first: Enemy | null = null, firstT = Infinity;
      for (const e of grid.query((ax + s.x) / 2, (ay + s.y) / 2, Math.hypot(dx, dy) / 2 + 38, this.near)) {
        if (!e.active) continue;
        const t = Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / (length2 || 1)));
        if (t < firstT && Math.hypot(e.x - ax - t * dx, e.y - ay - t * dy) <= e.radius + 3) { first = e; firstT = t; }
      }
      if (first) { this.release(s); damage(first, s.damage); }
      else if (s.ttl <= 0) this.release(s);
    }
  }
  private release(s: Arrow): void { s.active = false; if (s.image) { s.image.setVisible(false); this.images.push(s.image); s.image = null; this.rendered--; } }
}
