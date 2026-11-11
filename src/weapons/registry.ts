import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { SpatialGrid } from '../systems/SpatialGrid';
import type { Sfx } from '../systems/Sfx';
import type { PlayerStats, WeaponId, WeaponState } from '../types';

export interface WeaponBolt {
  img: Phaser.GameObjects.Image; vx: number; vy: number; life: number;
  damage: number; bounce: number; active: boolean;
  lastHit: Enemy | null; hitIds: Set<number>;
}

export interface SpearShot {
  img: Phaser.GameObjects.Image; sx: number; sy: number; dirX: number; dirY: number;
  len: number; halfWidth: number; width: number; cap: number;
  hit: Set<number>; roundHit: Map<number, number>; elapsed: number; delay: number; done: boolean;
}

/** 行为只依赖明确的战斗接口，不依赖整份 GameScene。 */
export interface WeaponHost {
  readonly player: Player; readonly enemies: Enemy[]; readonly grid: SpatialGrid<Enemy>;
  readonly add: Phaser.GameObjects.GameObjectFactory; readonly time: Phaser.Time.Clock;
  readonly combatNow: number; readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
  readonly sfx: Sfx; readonly over: boolean; readonly spearShots: SpearShot[]; readonly bolts: WeaponBolt[];
  hitEnemy(enemy: Enemy, damage: number, now: number, source: 'melee' | 'arrow' | 'fire'): boolean;
  nearestEnemy(x: number, y: number, range: number): Enemy | null;
  fireBolt(pool: WeaponBolt[], x: number, y: number, tx: number, ty: number, damage: number, bounce: number, fromPlayer: boolean, speed: number): void;
  spawnGuandaoSlash(angle: number, alpha: number, size: number, duration: number): void;
  spawnFlagSwingFx(x: number, y: number): void;
  spawnFlameGatherFx(x: number, y: number, radius: number): void;
  spawnFlameFx(x: number, y: number, radius: number): void;
}

export const GUANDAO_TABLE = [
  { radius: 125, angle: 120, damage: 32, cooldown: 1.45, arc: 105 },
  { radius: 135, angle: 120, damage: 38, cooldown: 1.45, arc: 115 },
  { radius: 145, angle: 125, damage: 43, cooldown: 1.45, arc: 125 },
  { radius: 155, angle: 130, damage: 49, cooldown: 1.3, arc: 135 },
  { radius: 170, angle: 135, damage: 56, cooldown: 1.25, arc: 150 },
];
const levelIndex = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));

export interface WeaponDef {
  id: WeaponId;
  name: string;
  maxLevel: number;
  /** 单次命中伤害（含武器自身成长，未乘角色/遗物倍率）。 */
  damage(level: number, stats: PlayerStats): number;
  /** 冷却秒数（无冷却的武器返回 0）。 */
  cooldown(level: number, stats: PlayerStats): number;
  desc: string;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  spear_orbit: {
    id: 'spear_orbit',
    name: '七探盘龙枪',
    maxLevel: 5,
    damage: (level, stats) => [22, 24, 27, 30, 34][levelIndex(level)] * stats.damageMul * stats.meleeMul,
    cooldown: (level, stats) => [1.1, 1.1, 1.05, 1.0, 0.95][levelIndex(level)] * stats.cooldownMul,
    desc: '银枪直线突刺，穿透路径上的敌人',
  },
  crossbow: {
    id: 'crossbow',
    name: '连弩齐射',
    maxLevel: 5,
    damage: (level, stats) => 16 * (1 + 0.18 * (level - 1)) * stats.damageMul * stats.arrowMul,
    cooldown: (level, stats) => (1.1 * stats.cooldownMul) / (1 + 0.06 * (level - 1)),
    desc: '自动射击并弹射附近敌人',
  },
  guandao: {
    id: 'guandao',
    name: '青龙偃月斩',
    maxLevel: 5,
    damage: (level, stats) => GUANDAO_TABLE[levelIndex(level)].damage * stats.damageMul * stats.meleeMul,
    cooldown: (level, stats) => GUANDAO_TABLE[levelIndex(level)].cooldown * stats.cooldownMul,
    desc: '自动朝怪群最密处挥砍，最多命中 8 人，升级加范围',
  },
  flame_banner: {
    id: 'flame_banner',
    name: '烈焰战旗',
    maxLevel: 5,
    damage: (level, stats) => 22 * (1 + 0.18 * (level - 1)) * stats.damageMul * stats.fireMul,
    cooldown: (level, stats) => (3.2 * stats.cooldownMul) / (1 + 0.05 * (level - 1)),
    desc: '挥旗后引爆火焰范围',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['spear_orbit', 'crossbow', 'flame_banner', 'guandao'];

export function getWeaponDef(id: string): WeaponDef | undefined {
  return WEAPON_DEFS[id as WeaponId];
}

/** 点到线段的距离（穿透判定用）。 */
function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby || 1)));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/** 七探盘龙枪穿透参数：穿透长度 / 判定宽度(总宽) / 单枪命中上限。 */
export const SPEAR_PIERCE = [
  { len: 150, width: 22, cap: 2 },
  { len: 155, width: 24, cap: 2 },
  { len: 160, width: 24, cap: 3 },
  { len: 165, width: 26, cap: 3 },
  { len: 170, width: 28, cap: 4 },
];

/** 武器行为：保持旧版判定、视觉与音效不变，不做玩法改动。 */
export const WEAPON_BEHAVIORS: Record<WeaponId, (host: WeaponHost, weapon: WeaponState, dt: number, time: number) => void> = {
  spear_orbit: (host, weapon, dt, time) => {
    const level = weapon.level;
    const def = WEAPON_DEFS.spear_orbit;
    const damage = def.damage(level, host.player.stats);
    const pierce = SPEAR_PIERCE[levelIndex(level)];
    // 更新已有突刺（直线穿透判定）
    for (let i = host.spearShots.length - 1; i >= 0; i -= 1) {
      const shot = host.spearShots[i];
      shot.elapsed += dt;
      if (shot.elapsed < shot.delay) continue;
      const t = Math.min(1, (shot.elapsed - shot.delay) / 0.16);
      // Visual timeline is independent of the unchanged 72ms hit check below.
      const age = shot.elapsed - shot.delay;
      const extend = Math.min(1, Math.max(0, (age - .018) / .054));
      const ease = 1 - Math.pow(1 - extend, 3);
      const retract = Math.min(1, Math.max(0, (age - .098) / .142));
      const lengthRatio = age < .098 ? .18 + .82 * ease : 1 - .58 * retract;
      const curLen = shot.len * lengthRatio;
      // Move the shaft forward, hold at contact, then draw it back.
      const handOffset = age < .098 ? -8 * (1 - ease) : -18 * retract;
      const alpha = age < .018 ? .55 : age < .12 ? 1 : Math.max(0, 1 - (age - .12) / .12);
      shot.img
        .setVisible(true)
        .setPosition(shot.sx + shot.dirX * (handOffset + curLen / 2), shot.sy + shot.dirY * (handOffset + curLen / 2))
        .setDisplaySize(curLen, shot.width * (1 + .12 * (1 - retract)))
        .setTint(age >= .054 && age <= .098 ? 0xffffff : 0xc2efff)
        .setAlpha(alpha);
      if (!shot.done && t >= 0.45) {
        shot.done = true;
        const ex = shot.sx + shot.dirX * shot.len;
        const ey = shot.sy + shot.dirY * shot.len;
        let hitCount = 0;
        for (const e of host.enemies) {
          if (host.over) break;
          if (!e.active) continue;
          if (shot.hit.has(e.spawnId)) continue;              // 每枪同一敌人最多一次
          if ((shot.roundHit.get(e.spawnId) ?? 0) >= 2) continue; // 每轮同一敌人最多两枪
          if (distPointToSegment(e.x, e.y, shot.sx, shot.sy, ex, ey) > shot.halfWidth + e.radius) continue;
          shot.hit.add(e.spawnId);
          shot.roundHit.set(e.spawnId, (shot.roundHit.get(e.spawnId) ?? 0) + 1);
          host.hitEnemy(e, damage, time, 'melee');
          hitCount += 1;
          if (hitCount >= shot.cap) break;                    // 单枪命中上限
        }
        if (hitCount > 0) host.sfx.play('allySpear');
      }
      if (shot.elapsed >= 0.24 + shot.delay) {
        shot.img.destroy();
        host.spearShots.splice(i, 1);
      }
    }
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const targets = host.enemies
      .filter((e) => e.active && Math.hypot(e.x - host.player.x, e.y - host.player.y) <= 220)
      .sort((a, b) => Math.hypot(a.x - host.player.x, a.y - host.player.y) - Math.hypot(b.x - host.player.x, b.y - host.player.y));
    if (!targets.length) return;
    const aim = targets[0];
    const aimX = aim.x - host.player.x, aimY = aim.y - host.player.y;
    host.player.faceDirection(Math.abs(aimX) > Math.abs(aimY) ? (aimX < 0 ? 'left' : 'right') : (aimY < 0 ? 'up' : 'down'), 160);
    const passiveCast = host.player.passive.beginCast('spear_orbit');
    const spearLength = pierce.len * passiveCast.spearLengthMul;
    const count = level;
    const used = new Map<number, number>();
    const chosen: Enemy[] = [];
    for (let i = 0; i < count; i += 1) {
      let pick = targets.find((e) => !used.has(e.spawnId));
      if (!pick) pick = targets.find((e) => (used.get(e.spawnId) ?? 0) < 2);
      if (!pick) break;
      used.set(pick.spawnId, (used.get(pick.spawnId) ?? 0) + 1);
      chosen.push(pick);
    }
    if (passiveCast.extraSpear) chosen.push(targets.find(e => !used.has(e.spawnId)) ?? targets.find(e => (used.get(e.spawnId) ?? 0) < 2) ?? targets[0]);
    const roundHit = new Map<number, number>(); // 每轮重置
    const sx = host.player.x;
    const sy = host.player.y - 6;
    for (let i = 0; i < chosen.length; i += 1) {
      const target = chosen[i];
      const dx = target.x - sx;
      const dy = target.y - sy;
      const dist = Math.hypot(dx, dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const angle = Math.atan2(dy, dx);
      const img = host.add
        .image(sx + dirX * spearLength / 2, sy + dirY * spearLength / 2, 'spear_thrust', 'tight')
        .setRotation(angle)
        .setDisplaySize(spearLength, pierce.width)
        .setDepth(40)
        .setVisible(false);
      host.spearShots.push({
        img, sx, sy, dirX, dirY,
        len: spearLength, halfWidth: pierce.width / 2, width: pierce.width, cap: pierce.cap,
        hit: new Set<number>(), roundHit,
        elapsed: 0, delay: i * 0.025, done: false,
      });
    }
    weapon.cooldownLeft = def.cooldown(level, host.player.stats);
  },
  crossbow: (host, weapon, dt, time) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const target = host.nearestEnemy(host.player.x, host.player.y, 500);
    if (!target) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.crossbow;
    const damage = def.damage(level, host.player.stats);
    const bounce = Math.min(4, 2 + Math.floor((level - 1) / 2));
    host.fireBolt(host.bolts, host.player.x, host.player.y, target.x, target.y, damage, bounce, true, 560);
    if (host.player.passive.isSharpshooter(time)) {
      const dx = target.x - host.player.x, dy = target.y - host.player.y, d = Math.hypot(dx, dy) || 1;
      host.fireBolt(host.bolts, host.player.x - dy / d * 6, host.player.y + dx / d * 6, target.x, target.y, damage, bounce, true, 560);
    }
    weapon.cooldownLeft = def.cooldown(level, host.player.stats);
  },
  guandao: (host, weapon, dt, time) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.guandao;
    const damage = def.damage(level, host.player.stats);
    const row = GUANDAO_TABLE[levelIndex(level)];
    const radiusMul = host.player.passive.rangeMultiplier('guandao');
    const radius = row.radius * radiusMul;
    const halfAngle = row.angle * Math.PI / 360;
    const arcSize = row.arc * radiusMul;
    // 在 16 个候选方向里选“扇形内敌人最多”的方向挥砍，尽量 AOE 到怪群
    const currentAngle = host.player.direction === 'left' ? Math.PI : host.player.direction === 'right' ? 0 : host.player.direction === 'up' ? -Math.PI / 2 : Math.PI / 2;
    let bestAngle = currentAngle;
    let bestScore = -1;
    const near = host.grid.query(host.player.x, host.player.y, radius + 50);
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      let count = 0;
      let threat = 0;
      for (const e of near) {
        if (!e.active) continue;
        const dx = e.x - host.player.x;
        const dy = e.y - host.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + e.radius) continue;
        const dot = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (dist || 1);
        if (dot >= Math.cos(halfAngle)) {
          count += 1;
          threat += e.kind === 'boss' ? 5 : e.kind === 'elite' ? 2 : 1;
        }
      }
      const score = count * 10 + threat;
      const closerToFacing = Math.min(Math.abs(angle - currentAngle), Math.PI * 2 - Math.abs(angle - currentAngle));
      const bestFacing = Math.min(Math.abs(bestAngle - currentAngle), Math.PI * 2 - Math.abs(bestAngle - currentAngle));
      if (score > bestScore || (score === bestScore && count > 0 && closerToFacing < bestFacing)) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    if (bestScore < 0) return; // 没有敌人不挥砍、不消耗冷却
    const angle = bestAngle;
    const inCone = (e: Enemy): boolean => {
      if (!e.active) return false;
      const dx = e.x - host.player.x;
      const dy = e.y - host.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.radius) return false;
      const dot = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (dist || 1);
      return dot >= Math.cos(halfAngle);
    };
    const targets = host.enemies.filter(inCone).slice(0, 8);
    if (!targets.length) return;
    const passiveCast = host.player.passive.beginCast('guandao');
    const castDamage = damage * passiveCast.damageMul;
    const strike = (enemy: Enemy, amount: number, at: number): void => {
      if (host.hitEnemy(enemy, amount, at, 'melee')) host.player.passive.recordHit(passiveCast, enemy, at);
    };
    const cardinal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) < 0 ? 'left' : 'right') : Math.sin(angle) < 0 ? 'up' : 'down';
    host.player.faceDirection(cardinal as 'left' | 'right' | 'up' | 'down', 130);
    host.sfx.play('allySlash');
    host.cameras.main.shake(80, 0.002);
    for (const enemy of targets) strike(enemy, castDamage, time);
    host.spawnGuandaoSlash(angle, 1, arcSize, 120);
    if (level >= 3) {
      host.time.delayedCall(180, () => {
        if (host.over) return;
        for (const enemy of host.enemies.filter(inCone).slice(0, 8)) strike(enemy, castDamage * 0.4, host.combatNow);
        host.spawnGuandaoSlash(angle, 0.45, arcSize * 0.75, 95);
      });
    }
    weapon.cooldownLeft = def.cooldown(level, host.player.stats);
  },
  flame_banner: (host, weapon, dt) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.flame_banner;
    const damage = def.damage(level, host.player.stats);
    const passiveCast = host.player.passive.beginCast('flame_banner');
    const radius = (120 + (level - 1) * 8) * host.player.stats.fireAreaMul * passiveCast.radiusMul;
    let dirX = 0;
    let dirY = -1;
    const nearest = host.nearestEnemy(host.player.x, host.player.y, 300);
    if (nearest) {
      const d = Math.hypot(nearest.x - host.player.x, nearest.y - host.player.y) || 1;
      dirX = (nearest.x - host.player.x) / d;
      dirY = (nearest.y - host.player.y) / d;
    }
    const cx = host.player.x + dirX * radius * 0.45;
    const cy = host.player.y + dirY * radius * 0.45;
    host.sfx.play('flameSwing');
    host.spawnFlagSwingFx(dirX, dirY);
    host.time.delayedCall(250, () => {
      if (host.over) return;
      host.spawnFlameGatherFx(cx, cy, radius);
    });
    host.time.delayedCall(400, () => {
      if (host.over) return;
      host.spawnFlameFx(cx, cy, radius);
      host.sfx.play('flameBoom');
      host.cameras.main.shake(150, 0.005);
      const candidates = host.grid.query(cx, cy, radius + 30);
      for (const enemy of candidates) {
        if (!enemy.active) continue;
        const dist = Math.hypot(enemy.x - cx, enemy.y - cy);
        if (dist <= radius + enemy.radius && host.hitEnemy(enemy, damage, host.combatNow, 'fire')) host.player.passive.recordHit(passiveCast, enemy, host.combatNow, damage);
      }
    });
    weapon.cooldownLeft = def.cooldown(level, host.player.stats);
  },
};

