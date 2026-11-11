import type { Enemy } from '../entities/Enemy';
import type { Ally } from '../entities/Ally';
import type { SpatialGrid } from './SpatialGrid';

/** Velocity steering, solved from one spatial snapshot before any enemy is moved. */
export class EnemyMovement {
  private readonly allies: Ally[] = [];
  private readonly neighbors: Enemy[] = [];

  prepare(enemies: readonly Enemy[], grid: SpatialGrid<Enemy>, allyGrid: SpatialGrid<Ally>, px: number, py: number, dt: number): void {
    const blend = 1 - Math.exp(-14 * dt);
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (enemy.kind === 'boss' || enemy.controlImmune || (enemy.kind === 'cavalry' && enemy.chargeState !== 'none')) {
        enemy.moveVx = enemy.moveVy = 0;
        continue;
      }
      // Ordinary troops can engage soldiers. Bosses and cavalry keep their special targeting.
      if (enemy.kind !== 'cavalry') {
        const old = enemy.targetAlly;
        let best = old?.active && old.lifeId === enemy.targetLife && Math.hypot(old.x - enemy.x, old.y - enemy.y) < 650 ? old : null;
        let score = best ? Math.hypot(best.x - enemy.x, best.y - enemy.y) * .8 : Math.hypot(px - enemy.x, py - enemy.y);
        if (Math.hypot(px - enemy.x, py - enemy.y) < score * .8) { best = null; score = Math.hypot(px - enemy.x, py - enemy.y); }
        for (const ally of allyGrid.query(enemy.x, enemy.y, Math.min(650, score + 1), this.allies)) {
          if (!ally.active) continue;
          const d = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
          if (d < score && d < 650) { best = ally; score = d; }
        }
        enemy.targetAlly = best; enemy.targetLife = best?.lifeId ?? 0;
      }
      const target = enemy.targetAlly;
      const dx = (target?.x ?? px) - enemy.x, dy = (target?.y ?? py) - enemy.y, distance = Math.hypot(dx, dy);
      const nx = distance > .001 ? dx / distance : 0, ny = distance > .001 ? dy / distance : 0;
      const speed = enemy.def.speed;
      // Preserve ranged approach/retreat distances and retreat speed. No arrive slowdown for melee.
      const goal = enemy.kind === 'archer' ? distance > 230 ? 1 : distance < 150 ? -.8 : 0 : target && distance < enemy.radius + target.radius ? 0 : 1;
      let sx = 0, sy = 0;
      for (const other of grid.query(enemy.x, enemy.y, enemy.radius + 38, this.neighbors)) {
        if (other === enemy || !other.active) continue;
        let ox = enemy.x - other.x, oy = enemy.y - other.y;
        const range = (enemy.radius + other.radius) * 1.06;
        let dist = Math.hypot(ox, oy);
        if (dist >= range) continue;
        if (dist < .001) {
          // Stable opposite directions for coincident pool instances; never random each frame.
          const angle = (Math.min(enemy.uid, other.uid) * 2.399963 + Math.max(enemy.uid, other.uid) * .618034);
          const sign = enemy.uid < other.uid ? 1 : -1;
          ox = Math.cos(angle) * sign; oy = Math.sin(angle) * sign; dist = 1;
        }
        const pressure = (range - dist) / Math.max(dist, range * .12);
        sx += ox / dist * pressure; sy += oy / dist * pressure;
      }
      // A few allies use the same avoidance budget, instead of a second hard push per ally.
      for (const ally of allyGrid.query(enemy.x, enemy.y, enemy.radius + 22, this.allies)) {
        if (!ally.active || ally === target) continue;
        const ox = enemy.x - ally.x, oy = enemy.y - ally.y;
        const range = enemy.radius + ally.radius;
        const dist = Math.hypot(ox, oy);
        if (dist >= range) continue;
        if (dist < .001) {
          sx += Math.cos(enemy.uid * 2.399963);
          sy += Math.sin(enemy.uid * 2.399963);
        } else {
          const pressure = (range - dist) / Math.max(dist, range * .12);
          sx += ox / dist * pressure; sy += oy / dist * pressure;
        }
      }
      // Bounded velocity avoidance rather than repeatedly teleporting positions apart.
      const repel = Math.hypot(sx, sy);
      const limit = repel > 1.3 ? 1.3 / repel : 1;
      sx *= limit; sy *= limit;
      let vx = nx * goal * speed + sx * speed * 4.5;
      let vy = ny * goal * speed + sy * speed * 4.5;
      const magnitude = Math.hypot(vx, vy);
      if (magnitude > speed) { vx *= speed / magnitude; vy *= speed / magnitude; }
      enemy.moveVx += (vx - enemy.moveVx) * blend;
      enemy.moveVy += (vy - enemy.moveVy) * blend;
    }
  }
}
