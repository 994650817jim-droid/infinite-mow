import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH } from '../config';
interface Slot { image: Phaser.GameObjects.Image; enemy: Enemy | null; spawnId: number; start: number; duration: number; angle: number; kind: string; active: boolean; death: boolean; elapsed: number; }
/** Reuses supplied art for procedural transitions; not independent hand-drawn attack frames. */
export class BattleFeedback {
  private readonly slots: Slot[] = [];
  constructor(private readonly scene: Phaser.Scene) {}
  attack(enemy: Enemy, angle: number, now: number, duration = 230): void {
    if (!enemy.def.walkVisual || !enemy.walkSheet) return;
    enemy.holdAttackPose(now, angle, duration);
    const slot = this.acquire(); if (!slot) return;
    slot.enemy = enemy; slot.spawnId = enemy.spawnId; slot.start = now; slot.duration = duration;
    slot.angle = angle; slot.kind = enemy.kind; slot.death = false; slot.active = true;
    const texture = enemy.kind === 'archer' ? 'arrow' : enemy.kind === 'cavalry' ? 'spear_thrust' : 'blade';
    slot.image.setTexture(texture, texture === 'spear_thrust' ? 'tight' : undefined).setOrigin(.5).setAlpha(.85).setRotation(angle).setVisible(true);
    this.draw(slot, now);
  }
  death(enemy: Enemy): void {
    const slot = this.acquire(true); if (!slot) return;
    slot.enemy = null; slot.death = true; slot.active = true; slot.elapsed = 0; slot.duration = 420;
    slot.image.setTexture(enemy.sprite.texture.key, enemy.sprite.frame.name).setOrigin(enemy.sprite.originX, enemy.sprite.originY)
      .setPosition(enemy.x, enemy.y).setScale(enemy.sprite.scaleX, enemy.sprite.scaleY).setRotation(0).setAlpha(.85).setVisible(true);
  }
  update(now: number, resultDeltaMs = 0): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      if (slot.death) {
        slot.elapsed += resultDeltaMs;
        const t = Math.min(1, slot.elapsed / slot.duration);
        slot.image.setAlpha(.85 * (1 - t)).setRotation(-.22 * t);
        if (t >= 1) this.release(slot);
      } else if (!slot.enemy?.active || slot.enemy.spawnId !== slot.spawnId || now - slot.start >= slot.duration) this.release(slot);
      else this.draw(slot, now);
    }
  }
  clearAttacks(): void { for (const slot of this.slots) if (!slot.death) this.release(slot); }
  private acquire(priority = false): Slot | undefined {
    let slot = this.slots.find(s => !s.active);
    if (!slot && this.slots.length < 24) {
      slot = { image: this.scene.add.image(0, 0, 'blade').setDepth(DEPTH.enemy + 2).setVisible(false), enemy: null, spawnId: 0, start: 0, duration: 0, angle: 0, kind: '', active: false, death: false, elapsed: 0 };
      this.slots.push(slot);
    }
    if (!slot && priority) slot = this.slots.find(s => !s.death);
    return slot;
  }
  private release(slot: Slot): void { slot.active = false; slot.enemy = null; slot.image.setVisible(false); }
  private draw(slot: Slot, now: number): void {
    const e = slot.enemy!; const t = Math.max(0, Math.min(1, (now - slot.start) / slot.duration));
    const thrust = slot.kind === 'cavalry'; const bow = slot.kind === 'archer';
    // Bow release stays at the existing 180ms point; contact attacks start at impact, then follow through.
    const reach = bow ? (t < .5 ? 16 - t * 8 : 12 + (t - .5) * 44) : thrust ? 22 + Math.sin(t * Math.PI) * 25 : 24;
    const angle = bow || thrust ? slot.angle : slot.angle + Math.sin(t * Math.PI) * .65;
    slot.image.setPosition(e.x + Math.cos(angle) * reach, e.y - 5 + Math.sin(angle) * reach).setRotation(angle + (bow || thrust ? 0 : Math.PI / 2))
      .setDisplaySize(bow ? 22 : thrust ? 57 : 13, bow ? 6 : thrust ? 10 : e.kind === 'elite' ? 40 : 30)
      .setAlpha((bow && t < .5 ? .5 : .85) * (t < .7 ? 1 : (1 - t) / .3));
  }
}
