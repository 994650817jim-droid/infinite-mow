import { BALANCE } from '../config';
import type { ArcHost } from './ArcBossV2';
import { BossPace } from './BossPace';
import { GroundMotion, walkRow } from './GroundMotion';

/** Only used between abilities; warning, charge and scripted motion keep their own timing. */
export class BossWalk {
  private motion = new GroundMotion();
  private last = -Infinity;
  private phase = 0;
  row = 0;
  frame = 0;
  moving = false;

  constructor(private host: ArcHost) { host.boss.ownsBossWalk = true; }

  advance(dt: number, now: number, keep: number, speedMul = 1): void {
    const { boss, player, army } = this.host;
    if (now - this.last > dt * 1000 + 5) this.motion.stop();
    this.last = now;
    const px = player.x - boss.x, py = player.y - boss.y, d = Math.hypot(px, py);
    const waypoint = d > keep ? army.navigation.steer(-boss.uid, boss.x, boss.y, player.x, player.y, boss.radius, now) : player;
    const dx = waypoint.x - boss.x, dy = waypoint.y - boss.y;
    const length = Math.hypot(dx, dy);
    const towardPlayer = dx * px + dy * py >= .5 * length * d;
    const pace = towardPlayer && speedMul <= BALANCE.bossPace.walkCap ? BossPace.mulAt(d) : 1;
    const speed = boss.def.speed * speedMul * pace;
    this.motion.advance(dx, dy, dt, speed, d - keep);
    const mx = this.motion.vx * dt, my = this.motion.vy * dt;
    const travel = Math.hypot(mx, my);
    this.moving = travel > .015;
    if (this.moving) {
      boss.sprite.x += mx;
      boss.sprite.y += my;
      this.row = walkRow(mx, my, this.row);
      this.phase += travel / Math.max(5, Math.min(18, speed / 9));
    } else if (d > .5) this.row = walkRow(px, py, this.row);
    this.frame = this.moving ? Math.floor(this.phase) % 4 : 0;
  }

  idle(): void {
    this.motion.stop();
    this.moving = false;
    this.frame = 0;
  }

  clear(): void { this.host.army.navigation.forget(-this.host.boss.uid); this.host.boss.ownsBossWalk = false; }
}
