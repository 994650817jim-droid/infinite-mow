import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
import {warnCircle} from '../ui/Telegraph';
import {DONGZHUO_BOSS as D} from '../data/dongzhuo';
import {troopArtReady} from './TroopArt';

interface Host {
  scene: Phaser.Scene; player: Player; army: Legion;
  move: (e: Enemy, nx: number, ny: number, dt: number) => void;
  raid: (now: number) => void; guards: (n: number, x: number, y: number) => void;
  spawn: (kind: 'infantry' | 'cavalry', x: number, y: number) => void;
  banner: (text: string, caption?: string) => void;
}
interface Fire {x: number; y: number; warnUntil: number; burnUntil: number; tickAt: number; g: Phaser.GameObjects.Graphics}

/**
 * 2-3 火烧洛阳 · 董卓：慢步追击；纵火（预警圈后燃烧，烧主将与部曲）；号令西凉铁骑突阵；飞熊军护驾；
 * 半血「迁都」：短暂无敌后撤、召一波西凉兵，之后纵火更频繁。
 */
export class DongzhuoBoss {
  private fires: Fire[] = []; private nextFire: number; private nextRaid: number; private retreated = false; private retreatUntil = 0; private rx = 0; private ry = 0;
  constructor(private h: Host, readonly boss: Enemy, now: number) {
    this.nextFire = now + 3000; this.nextRaid = now + D.raidEvery * 1000 * .6;
    // 正式图（ChatGPT 生成的董卓行走 / 攻击图）已加载时换掉占位造型
    if (troopArtReady(h.scene, 'dongzhuo_walk')) boss.reskin({...boss.def, texture: 'dongzhuo_walk', walkVisual: {texture: 'dongzhuo_walk', scale: D.artScale, groundY: D.artGroundY, matched: true}, attackVisual: troopArtReady(h.scene, 'dongzhuo_attack') ? 'dongzhuo_attack' : undefined, tint: undefined});
    h.guards(D.guards, boss.x, boss.y); h.banner('董卓 · 火烧洛阳', '躲开火圈 · 飞熊军护驾');
  }
  get label(): string { return this.retreated ? '迁都 · 纵火加剧' : '纵火 · 铁骑 · 飞熊军'; }
  /** 每帧接管董卓移动。 */
  step(dt: number, now: number): void {
    const b = this.boss, p = this.h.player;
    if (now < this.retreatUntil) { const k = Math.min(1, dt * 4); b.sprite.x += (this.rx - b.x) * k; b.sprite.y += (this.ry - b.y) * k; b.moveVx = b.moveVy = 0; return; }
    if (b.invulnerable && this.retreated) b.invulnerable = false;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
    this.h.move(b, d > 50 ? dx / d : 0, d > 50 ? dy / d : 0, dt);
    if (!this.retreated && b.hp <= b.maxHp * D.retreatAt) this.retreat(now);
  }
  private retreat(now: number): void {
    const b = this.boss, p = this.h.player; this.retreated = true; b.invulnerable = true; this.retreatUntil = now + D.retreatMs;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1; this.rx = b.x + dx / d * D.retreatDistance; this.ry = b.y + dy / d * D.retreatDistance;
    this.h.banner('董卓迁都 · 焚城西走', '西凉兵断后');
    for (let i = 0; i < D.retreatInfantry; i++) { const a = i / D.retreatInfantry * Math.PI * 2; this.h.spawn('infantry', p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320); }
    for (let i = 0; i < D.retreatCavalry; i++) { const a = Math.random() * Math.PI * 2; this.h.spawn('cavalry', p.x + Math.cos(a) * 380, p.y + Math.sin(a) * 380); }
    this.h.guards(D.guards, this.rx, this.ry);
  }
  /** 纵火与号令（GameScene 每帧调用，首领活着时）。 */
  update(now: number): void {
    const p = this.h.player;
    if (now >= this.nextFire) {
      this.nextFire = now + (this.retreated ? D.fireEveryEnraged : D.fireEvery) * 1000;
      { const b = this.boss, dx = p.x - b.x, dy = p.y - b.y; b.startAttack(now, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'); }
      for (let i = 0; i < D.fireCount; i++) { const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 90 + Math.random() * 60; this.fires.push({x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, warnUntil: now + D.fireWarnMs, burnUntil: now + D.fireWarnMs + D.fireBurnMs, tickAt: 0, g: this.h.scene.add.graphics().setDepth(2).setName('dongzhuo-fire')}); }
    }
    if (now >= this.nextRaid) { this.nextRaid = now + D.raidEvery * 1000; this.h.raid(now); }
    for (const f of [...this.fires]) {
      f.g.clear();
      if (now < f.warnUntil) { warnCircle(f.g, f.x, f.y, D.fireRadius, 1 - (f.warnUntil - now) / D.fireWarnMs, 0xd2573a, 0xf2c27a, false, now); continue; }
      if (now >= f.burnUntil) { f.g.destroy(); this.fires.splice(this.fires.indexOf(f), 1); continue; }
      // 燃烧：橙红火焰（程序绘制，忽明忽暗）
      const flick = .55 + .2 * Math.sin(now / 60 + f.x);
      f.g.fillStyle(0xd2462a, flick * .55).fillEllipse(f.x, f.y, D.fireRadius * 2, D.fireRadius * 1.2).fillStyle(0xffb347, flick * .6).fillEllipse(f.x, f.y - 6, D.fireRadius * 1.2, D.fireRadius * .7);
      if (now >= f.tickAt) {
        f.tickAt = now + D.fireTickMs;
        if (Math.hypot((p.x - f.x) / 1, (p.y - f.y) / .6) <= D.fireRadius) p.takeDamage(D.fireDamage, now);
        this.h.army.hurtArea(f.x, f.y, D.fireRadius, D.fireDamage, now);
      }
    }
  }
  /** 测试用。 */
  get state() { return {fires: this.fires.length, retreated: this.retreated, invulnerable: this.boss.invulnerable}; }
  clear(): void { for (const f of this.fires) f.g.destroy(); this.fires = []; }
}
