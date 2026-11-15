import Phaser from 'phaser';
import {DEPTH} from '../config';
import {figureHeight} from './SpriteMetrics';
import type {Ally} from '../entities/Ally';
import type {TroopKind} from '../data/legion';

/**
 * 我方士兵阵亡：播放 4 帧倒地动画，尸体留在原地 60 秒（战斗时间）后 1 秒淡出。
 * 倒地帧图集：troop_deaths_a（刀盾 / 长枪 / 弓箭 / 连弩）、troop_deaths_b（重盾 / 轻骑 / 戟兵 / 军医），各 4 行 × 4 帧、朝右，朝左镜像。
 * 缺图时退回：用该士兵当前的行走帧侧倒、变暗（程序过渡）。
 */
export const CORPSE_MS = 60000, CORPSE_FADE_MS = 1000, DEATH_ANIM_MS = 600, MAX_CORPSES = 24;
export const DEATH_FRAMES: Record<TroopKind, {texture: string; row: number}> = {
  swordsman: {texture: 'troop_deaths_a', row: 0}, spearman: {texture: 'troop_deaths_a', row: 1}, archer: {texture: 'troop_deaths_a', row: 2}, crossbowman: {texture: 'troop_deaths_a', row: 3},
  guardian: {texture: 'troop_deaths_b', row: 0}, rider: {texture: 'troop_deaths_b', row: 1}, halberdier: {texture: 'troop_deaths_b', row: 2}, medic: {texture: 'troop_deaths_b', row: 3},
};
interface Corpse {image: Phaser.GameObjects.Image; start: number; active: boolean; frames: number[] | null; key: string; fallback: boolean; scale: number; baseAlpha: number;}

export class AllyCorpses {
  private readonly pool: Corpse[] = [];
  constructor(private readonly scene: Phaser.Scene) {}
  get count(): number { return this.pool.filter(c => c.active).length; }
  /** 士兵阵亡时调用（在释放其显示对象之前）。 */
  spawn(u: Ally, sprite: Phaser.GameObjects.Image | undefined, now: number): void {
    const x = sprite?.x ?? u.x, y = sprite?.y ?? u.y, mirror = u.facingX < 0, def = DEATH_FRAMES[u.kind];
    let c = this.pool.find(p => !p.active);
    if (!c) {
      if (this.pool.length < MAX_CORPSES) { c = {image: this.scene.add.image(0, 0, '__DEFAULT'), start: 0, active: false, frames: null, key: '', fallback: false, scale: 1, baseAlpha: 1}; this.pool.push(c); }
      else c = this.pool.reduce((a, b) => a.start <= b.start ? a : b); // 最旧的让位
    }
    const art = def && this.scene.textures.exists(def.texture);
    c.active = true; c.start = now; c.fallback = !art; c.baseAlpha = 1;
    const shownH = sprite ? sprite.displayHeight * (sprite.frame ? (figureHeight(this.scene, sprite.texture.key, sprite.frame.name) ?? sprite.frame.height) / sprite.frame.height : 1) : 40;
    if (art) {
      c.key = def.texture; c.frames = [0, 1, 2, 3].map(i => def.row * 4 + i);
      const h0 = figureHeight(this.scene, def.texture, c.frames[0]) ?? 100;
      c.scale = shownH / h0;
      c.image.setTexture(def.texture, c.frames[0]).setOrigin(.5, 114 / 128).setFlipX(mirror).setRotation(0).clearTint();
    } else {
      c.key = sprite?.texture.key ?? '__DEFAULT'; c.frames = null; c.scale = sprite?.scaleY ?? 1;
      c.image.setTexture(c.key, sprite?.frame.name).setOrigin(.5, .9).setFlipX(sprite?.flipX ?? false).setRotation(0).setTint(0x8a8a8a);
    }
    c.image.setPosition(x, y + (art ? 0 : 0)).setScale(c.scale).setAlpha(1).setVisible(true).setDepth(DEPTH.ground + 3 + y / 100000);
  }
  update(now: number): void {
    for (const c of this.pool) {
      if (!c.active) continue;
      const age = now - c.start;
      if (age >= CORPSE_MS + CORPSE_FADE_MS) { c.active = false; c.image.setVisible(false); continue; }
      if (age < DEATH_ANIM_MS) {
        const t = age / DEATH_ANIM_MS;
        if (c.frames) c.image.setFrame(c.frames[Math.min(3, Math.floor(t * 4))]);
        else c.image.setRotation((c.image.flipX ? -1 : 1) * Math.PI / 2 * Math.min(1, t * 1.4));
      } else if (c.frames) c.image.setFrame(c.frames[3]);
      else c.image.setRotation((c.image.flipX ? -1 : 1) * Math.PI / 2);
      c.image.setAlpha(age > CORPSE_MS ? Math.max(0, 1 - (age - CORPSE_MS) / CORPSE_FADE_MS) : 1);
    }
  }
  clear(): void { for (const c of this.pool) { c.active = false; c.image.setVisible(false); } }
}
