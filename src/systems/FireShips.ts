import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import { TELEGRAPH_CLASSIC } from '../ui/Telegraph';

/**
 * 赤壁鏖兵 · 东风火船：每隔一段战斗时间，东南风起，一列火船自画面一侧顺风冲过主将附近的一条横向航道。
 * 先有 2 秒地面预警（橙色航道 + 风向箭头），随后火墙扫过，烧伤航道内的敌军（我方不受伤）；首领只受三成伤害。
 * 所有计时用战斗时钟（毫秒），暂停时不推进。一个 Graphics 画预警与火墙，火星粒子数有上限。
 */
export interface FireShipHost {
  scene: Phaser.Scene;
  enemies: () => readonly Enemy[];
  player: () => {x: number; y: number};
  boss: () => Enemy | undefined;
  burn: (e: Enemy, dmg: number, now: number) => void;
  announce: (text: string) => void;
}
export const FIRE_SHIP = {interval: 26000, first: 14000, warnMs: 2000, sweepMs: 1500, laneH: 120, damage: 60, bossShare: .3} as const;

export class FireShips {
  private gfx: Phaser.GameObjects.Graphics;
  private next: number;
  private lane: {y: number; dir: 1 | -1; start: number} | null = null;
  private hitIds = new Set<number>();
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** 统计（测试用）：已发动次数、烧到的敌军数。 */
  readonly metrics = {waves: 0, burned: 0};
  /** opts：间隔与首次时间（遗珍「楼船令旗」用 12 秒间隔复用火船）。 */
  private readonly interval: number;
  constructor(private h: FireShipHost, now: number, opts: {interval?: number; first?: number} = {}) {
    this.interval = opts.interval ?? FIRE_SHIP.interval;
    this.gfx = h.scene.add.graphics().setDepth(23);
    this.next = now + (opts.first ?? FIRE_SHIP.first);
    if (!h.scene.textures.exists('fireship_spark')) { const g = h.scene.make.graphics({x: 0, y: 0}, false); g.fillStyle(0xffd27a, 1).fillCircle(4, 4, 4); g.generateTexture('fireship_spark', 8, 8); g.destroy(); }
    this.sparks = h.scene.add.particles(0, 0, 'fireship_spark', {lifespan: 650, speedY: {min: -90, max: -30}, speedX: {min: -40, max: 40}, scale: {start: 1.1, end: 0}, alpha: {start: .95, end: 0}, tint: [0xffe08a, 0xff9a3c, 0xe04a1c], blendMode: 'ADD', emitting: false, maxAliveParticles: 90}).setDepth(24);
  }
  /** 立即发动（测试 / 调试用）。 */
  force(now: number) { this.next = now; }
  update(now: number) {
    const g = this.gfx; g.clear();
    if (!this.lane && now >= this.next) {
      const p = this.h.player();
      this.lane = {y: p.y + Phaser.Math.Between(-60, 60), dir: Math.random() < .5 ? 1 : -1, start: now};
      this.hitIds.clear(); this.metrics.waves++;
      this.h.announce('东南风起 · 火船顺流而下！');
    }
    const L = this.lane; if (!L) return;
    const cam = this.h.scene.cameras.main, left = cam.worldView.x - 80, right = cam.worldView.right + 80, top = L.y - FIRE_SHIP.laneH / 2, age = now - L.start;
    if (age < FIRE_SHIP.warnMs) {
      // 预警：航道底色闪烁 + 顺风箭头
      const k = age / FIRE_SHIP.warnMs, a = .12 + .1 * Math.abs(Math.sin(age / 120));
      // 低调预警（默认）：不画整条填色航道与边框，只留淡淡的顺风箭头（?telegraph=1 恢复旧样式）
      if (TELEGRAPH_CLASSIC) { g.fillStyle(0xe0742c, a).fillRect(left, top, right - left, FIRE_SHIP.laneH);
      g.lineStyle(2, 0xffc46a, .85).strokeRect(left, top, right - left, FIRE_SHIP.laneH); }
      for (let x = left + ((age / 6) % 90) * L.dir + (L.dir < 0 ? 90 : 0); x < right; x += 90) { const cx = x, cy = L.y, d = L.dir * 16; g.lineStyle(TELEGRAPH_CLASSIC ? 3 : 2, 0xfff0c8, TELEGRAPH_CLASSIC ? .5 + k * .4 : .18 + k * .3).lineBetween(cx - d, cy - 12, cx + d, cy).lineBetween(cx + d, cy, cx - d, cy + 12); }
      return;
    }
    const sweep = (age - FIRE_SHIP.warnMs) / FIRE_SHIP.sweepMs;
    if (sweep >= 1.4) { this.lane = null; this.next = now + this.interval; return; }
    // 火墙前沿从上风处推到下风处，身后留一段渐熄的火带
    const span = right - left, front = L.dir > 0 ? left + span * Math.min(1, sweep) : right - span * Math.min(1, sweep), tail = 260;
    const x0 = L.dir > 0 ? Math.max(left, front - tail) : front, x1 = L.dir > 0 ? front : Math.min(right, front + tail);
    g.fillStyle(0xff7a2a, .32).fillRect(x0, top, x1 - x0, FIRE_SHIP.laneH);
    g.fillStyle(0xffd27a, .5).fillRect(L.dir > 0 ? front - 26 : front, top + 6, 26, FIRE_SHIP.laneH - 12);
    if (sweep <= 1) for (let i = 0; i < 4; i++) this.sparks?.emitParticleAt(front + Phaser.Math.Between(-14, 14), top + Math.random() * FIRE_SHIP.laneH, 1);
    // 伤害：每艘火船对每名敌人只烧一次
    const boss = this.h.boss();
    for (const e of this.h.enemies()) {
      if (!e.active || this.hitIds.has(e.spawnId) || Math.abs(e.y - L.y) > FIRE_SHIP.laneH / 2) continue;
      if (e.x < x0 || e.x > x1) continue;
      this.hitIds.add(e.spawnId); this.metrics.burned++;
      this.h.burn(e, e === boss ? Math.round(FIRE_SHIP.damage * FIRE_SHIP.bossShare) : FIRE_SHIP.damage, now);
    }
  }
  clear() { this.gfx.destroy(); this.sparks?.destroy(); this.sparks = null; }
}
