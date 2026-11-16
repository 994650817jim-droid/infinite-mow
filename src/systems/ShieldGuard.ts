import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import {SHIELD} from '../data/shields';
import {DEPTH} from '../config';

/** 出场时给刀盾兵上盾（城墙、粮草等借用刀盾兵类型的物件除外）。 */
export function armShield(e: Enemy): void {
  if (e.kind !== 'shield' || e.isSupplySlot || e.def.behavior === 'wall' || e.def.behavior === 'supply') return;
  e.shieldMax = e.shieldHp = Math.max(1, Math.round(e.maxHp * (e.def.variant === 'feixiong' ? SHIELD.feixiongRatio : SHIELD.ratio)));
}

/** 伤害先打盾：返回本体实际承受的伤害，以及盾是否在这一下被打碎（碎盾那一击不穿透）。 */
export function absorbShield(e: Enemy, damage: number, source: 'melee' | 'arrow' | 'fire'): {body: number; broke: boolean} {
  if (e.shieldHp <= 0) return {body: damage, broke: false};
  const mul = source === 'fire' ? SHIELD.fireMul : 1, onShield = damage * mul;
  // 打碎盾的那一击到盾为止（溢出的部分被盾吃掉），本体只吃打在盾上那部分的一成：真正的两段
  const used = Math.min(onShield, e.shieldHp) / mul;
  e.shieldHp -= onShield;
  const body = Math.round(used * SHIELD.bodyMul);
  if (e.shieldHp > 0) return {body, broke: false};
  e.shieldHp = 0;
  return {body, broke: true};
}

/** 盾条（灰铁色，在血量之上）与碎盾效果。 */
export class ShieldBars {
  private g: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) { this.g = scene.add.graphics().setDepth(DEPTH.fx).setName('shield-bars'); }
  draw(enemies: readonly Enemy[]): void {
    this.g.clear();
    for (const e of enemies) {
      if (!e.active || e.shieldHp <= 0 || e.shieldMax <= 0) continue;
      const w = SHIELD.barWidth, top = e.sprite.getBounds().top - SHIELD.barOffset, r = e.shieldHp / e.shieldMax;
      this.g.fillStyle(0x14100c, .8).fillRect(e.x - w / 2 - 1, top - 1, w + 2, 5).fillStyle(0xb9c3cf, 1).fillRect(e.x - w / 2, top, w * r, 3);
    }
  }
  /** 碎盾：几片木铁碎片飞散。 */
  shatter(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * .6, piece = this.scene.add.rectangle(x, y - 14, 7, 5, i % 2 ? 0x7a5532 : 0x9aa4b0).setDepth(DEPTH.fx).setRotation(a);
      this.scene.tweens.add({targets: piece, x: x + Math.cos(a) * 34, y: y - 14 + Math.sin(a) * 26 + 22, angle: 220, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => piece.destroy()});
    }
  }
  clear(): void { this.g.destroy(); }
}
