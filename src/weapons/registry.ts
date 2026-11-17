import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { SpatialGrid } from '../systems/SpatialGrid';
import type { Sfx } from '../systems/Sfx';
import type { PlayerStats, WeaponId, WeaponState } from '../types';
import { PASSIVE_RULES } from '../data/passives';
import { HERO_TINT } from '../data/characters';
import { BAODIAO_DEF, DANGYANG_DEF, ZHANJIN_DEF, SHUANGGU_DEF, baodiaoBehavior, dangyangBehavior, zhanjinBehavior, shuangguBehavior, smartTarget } from './heroWeapons2';
import { HINT_MOCK, groundScar } from '../ui/HintStyle';
import { DRAG_TRAVEL, DRAG_WAVE_MUL, DRAG_SPIN_MUL } from '../systems/RunGrowth';
import { ZHENBEI_DEF, LIANHUAN_DEF, SUN_KNIVES_DEF, DIAOCHAN_FANS_DEF, zhenbeiBehavior, lianhuanBehavior, sunKnivesBehavior, diaochanFansBehavior } from './heroWeapons';
export { zhenbeiCracks, lianhuanLinksPerMine, sunOrbitKnives, sunThrowCount, sunThrowPierce, diaochanFanCount } from './heroWeapons';

export interface WeaponBolt {
  img: Phaser.GameObjects.Image; vx: number; vy: number; life: number;
  damage: number; bounce: number; active: boolean;
  lastHit: Enemy | null; hitIds: Set<number>;
  /** 随行本命武器射出的箭：命中按友军结算并记到随行名下（GameScene.createFollowerWeapon）。 */
  ally?: { hero: string; credit: (damage: number) => void };
}

export interface SpearShot {
  img: Phaser.GameObjects.Image; sx: number; sy: number; dirX: number; dirY: number;
  len: number; halfWidth: number; width: number; cap: number;
  priority?:Enemy; priorityLife?:number;
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
  priorityTarget?(range:number,bodyRadius?:boolean):Enemy|null;
  fireBolt(pool: WeaponBolt[], x: number, y: number, tx: number, ty: number, damage: number, bounce: number, fromPlayer: boolean, speed: number): void;
  spawnGuandaoSlash(angle: number, alpha: number, size: number, duration: number): void;
  spawnFlagSwingFx(x: number, y: number): void;
  spawnFlameGatherFx(x: number, y: number, radius: number): void;
  martialField(x:number,y:number,r:number,damage:number,duration:number,level:number,formation?:boolean):void;
  spawnFlameFx(x: number, y: number, radius: number): void;
  /** 为身边部曲回复最大生命的比例（刘备仁德）。 */
  rallyAllies?(fraction: number): void;
  /** 武将招牌技序列帧特效（缺图时什么都不做）。 */
  heroFx?(id: string, x: number, y: number, size: number, rotation?: number): void;
  /** 关羽拖刀斩刀气表现（src/systems/DraggingBladeFx.ts）；缺省时退回普通刀光。只管画面，不结算伤害。 */
  draggingBladeWave?(angle: number, size: number, kind: 'crescent' | 'spin', hits: { x: number; y: number }[]): void;
}

// 2026-11-16 平衡（试玩反馈「关羽攻击范围太大」，夜间按推荐方案执行）：半径 125/150/175/200/225 → 120/135/150/165/180（满级 −20%），弧长同比
export const GUANDAO_TABLE = [
  { radius: 120, angle: 120, damage: 32, cooldown: 1.45, arc: 174 },
  { radius: 135, angle: 120, damage: 38, cooldown: 1.45, arc: 195.75 },
  { radius: 150, angle: 125, damage: 43, cooldown: 1.45, arc: 217.5 },
  { radius: 165, angle: 130, damage: 49, cooldown: 1.3, arc: 239.25 },
  { radius: 180, angle: 135, damage: 56, cooldown: 1.25, arc: 261 },
];
const levelIndex = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
/** 黄忠连弩每级额外箭数（Lv1 0 支 … Lv5 4 支，共 5 支）。 */
export const crossbowExtraArrows = (level: number): number => levelIndex(level);

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
  zhenbei_blade: ZHENBEI_DEF,
  lianhuan_mines: LIANHUAN_DEF,
  sun_knives: SUN_KNIVES_DEF,
  diaochan_fans: DIAOCHAN_FANS_DEF,
  baodiao_bow: BAODIAO_DEF,
  dangyang_roar: DANGYANG_DEF,
  zhanjin_lance: ZHANJIN_DEF,
  shuanggu_swords: SHUANGGU_DEF,
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
  // 2026-11-14 平衡：单枪命中上限各级 +1（原 2/2/3/3/4），补赵云前中期清群；伤害、枪数、冷却不变。
  { len: 150, width: 22, cap: 3 },
  { len: 155, width: 24, cap: 3 },
  { len: 160, width: 24, cap: 4 },
  { len: 165, width: 26, cap: 4 },
  { len: 170, width: 28, cap: 5 },
];

/** 武器行为：保持旧版判定、视觉与音效不变，不做玩法改动。 */
export const WEAPON_BEHAVIORS: Record<WeaponId, (host: WeaponHost, weapon: WeaponState, dt: number, time: number) => void> = {
  spear_orbit: (host, weapon, dt, time) => {
    const level = weapon.level;
    const def = WEAPON_DEFS.spear_orbit;
    const damage = def.damage(level, host.player.stats) * host.player.growth.damageMultiplier(time);
    const pierce = SPEAR_PIERCE[levelIndex(level)];
    const mastery = host.player.growth.spearPierceLevel;
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
        .setAlpha(alpha);
      if (!shot.done && t >= 0.45) {
        shot.done = true;
        const ex = shot.sx + shot.dirX * shot.len;
        const ey = shot.sy + shot.dirY * shot.len;
        let hitCount = 0;
        const preferred=shot.priority?.active&&shot.priority.spawnId===shot.priorityLife?shot.priority:null;
        const hitOrder=preferred?[preferred,...host.enemies.filter(e=>e!==preferred)]:host.enemies;
        for (const e of hitOrder) {
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
    const priority=host.priorityTarget?.(pierce.len*host.player.growth.spearLengthMultiplier()-6)??null;
    // 只锁定这一枪真正刺得到的敌人（与下方线段命中判定同一出枪点与枪长），
    // 否则 176~234px 的敌人会被锁定后刺空，白白消耗冷却。
    // 赵云「七进七出」蓄满时这一枪会长 25%：选靶也按加长后的枪长算，否则只有加长枪够得着的敌人永远不会被瞄准（2026-11-16 修）。
    const longSpear = host.player.passive.characterId === 'zhaoyun' && host.player.passive.snapshot(time).ready ? PASSIVE_RULES.spearLengthMul : 1;
    const reachBase = pierce.len * host.player.growth.spearLengthMultiplier() * longSpear + pierce.width / 2;
    const ox = host.player.x, oy = host.player.y - 6;
    const targets = host.grid.query(host.player.x, host.player.y, Math.min(220, reachBase) + 60)
      .filter((e) => e.active && Math.hypot(e.x - ox, e.y - oy) <= Math.min(220, reachBase) + e.radius)
      .sort((a, b) => Math.hypot(a.x - host.player.x, a.y - host.player.y) - Math.hypot(b.x - host.player.x, b.y - host.player.y));
    if(priority){const index=targets.indexOf(priority);if(index>=0)targets.splice(index,1);targets.unshift(priority);}
    // 首领 / 精锐优先：每轮至少一枪留给刺程内最近的首领（没有首领时为精锐）。
    // 原规则每枪先分给最近的不同敌人，首领身边的小兵会吸走全部枪（实测整局仅命中首领 0~11 次）。
    let focus: Enemy | null = null;
    for (const e of targets) {
      if (e === priority || (e.kind !== 'boss' && e.kind !== 'elite')) continue;
      if (!focus || (e.kind === 'boss' && focus.kind !== 'boss')) focus = e; // targets 已按距离排序
    }
    if (focus) { targets.splice(targets.indexOf(focus), 1); targets.splice(priority && targets[0] === priority ? 1 : 0, 0, focus); }
    if (!targets.length) return;
    const aim = targets[0];
    const aimX = aim.x - host.player.x, aimY = aim.y - host.player.y;
    host.player.faceDirection(Math.abs(aimX) > Math.abs(aimY) ? (aimX < 0 ? 'left' : 'right') : (aimY < 0 ? 'up' : 'down'), 160);
    const passiveCast = host.player.passive.beginCast('spear_orbit');
    // 招牌技动作：七进七出（龙胆蓄满的强化一击）
    if (passiveCast.empowered) host.player.playAction('skill', aimX < 0 ? 'left' : 'right');
    // 马超满铁骑：铁骑冲锋——朝目标突进，沿途敌人受重创（借用受击位移平滑移动主将）
    if (passiveCast.dash) {
      const R = PASSIVE_RULES, now = host.combatNow, d = Math.hypot(aimX, aimY) || 1, ux = aimX / d, uy = aimY / d, px = host.player.x, py = host.player.y;
      for (const e of host.grid.query(px + ux * R.dashLength / 2, py + uy * R.dashLength / 2, R.dashLength / 2 + R.dashWidth)) {
        if (!e.active || e.isSupplySlot) continue;
        const dx = e.x - px, dy = e.y - py, along = dx * ux + dy * uy, side = Math.abs(-dx * uy + dy * ux);
        if (along < -e.radius || along > R.dashLength + e.radius || side > R.dashWidth / 2 + e.radius) continue;
        if (host.hitEnemy(e, damage * R.dashDamageMul, now, 'melee')) host.player.passive.recordHit(passiveCast, e, now);
      }
      host.player.knockUp(now, R.dashMs, ux * R.dashLength, uy * R.dashLength, true);
      host.heroFx?.('dash', px + ux * R.dashLength / 2, py - 6 + uy * R.dashLength / 2, R.dashLength + 110, Math.atan2(uy, ux));
      const trail = host.add.image(px + ux * R.dashLength / 2, py - 6 + uy * R.dashLength / 2, 'spear_thrust', 'tight').setRotation(Math.atan2(uy, ux)).setDisplaySize(R.dashLength + 40, 34).setTint(0xbfe0ff).setAlpha(.85).setDepth(41);
      trail.scene.tweens.add({ targets: trail, alpha: 0, scaleY: trail.scaleY * 1.8, duration: 320, onComplete: () => trail.destroy() });
      host.sfx.play('allySpear');
    }
    // 张飞满怒：燕人咆哮——震慑并重创周围敌人（首领不受控，只吃伤害）
    if (passiveCast.roar) {
      const R = PASSIVE_RULES, px = host.player.x, py = host.player.y, now = host.combatNow;
      for (const e of host.grid.query(px, py, R.roarRadius + 40)) {
        if (!e.active || e.isSupplySlot || Math.hypot(e.x - px, e.y - py) > R.roarRadius + e.radius) continue;
        if (host.hitEnemy(e, damage * R.roarDamageMul, now, 'melee')) host.player.passive.recordHit(passiveCast, e, now);
        if (!e.controlImmune) e.stunUntil = Math.max(e.stunUntil, now + R.roarStunMs);
      }
      host.heroFx?.('roar', px, py - 10, R.roarRadius * 2.6);
      if (HINT_MOCK === 'b') groundScar(host.player.sprite.scene, px, py, R.roarRadius, 'crack');
      if (!HINT_MOCK) for (let k = 0; k < 2; k++) { const ring = host.add.circle(px, py - 6, 30, 0xffd27a, 0).setStrokeStyle(6 - k * 2, k ? 0xff8a3c : 0xffe2a0, .9).setDepth(41); ring.scene.tweens.add({ targets: ring, radius: R.roarRadius, alpha: 0, delay: k * 90, duration: 420, onComplete: () => ring.destroy() }); }
      host.cameras.main.shake(160, .006); host.sfx.play('waveDrum');
    }
    const spearLength = pierce.len * passiveCast.spearLengthMul * host.player.growth.spearLengthMultiplier();
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
      { const tint = HERO_TINT[host.player.passive.characterId]; if (tint) img.setTint(tint); }
      host.spearShots.push({
        // 指向营寨优先目标或首领/精锐的那一枪，命中判定先结算该目标，避免单枪上限被沿途小兵占满
        img, sx, sy, dirX, dirY,priority:target===priority||target===focus?target:undefined,priorityLife:target.spawnId,
        len: spearLength, halfWidth: pierce.width / 2, width: pierce.width, cap: pierce.cap + mastery,
        hit: new Set<number>(), roundHit,
        elapsed: 0, delay: i * 0.025, done: false,
      });
    }
    weapon.cooldownLeft = Math.max(.25, def.cooldown(level, host.player.stats) / host.player.growth.attackSpeedMultiplier(time) / (1 + .08 * host.player.growth.weaponMasteryLevel));
  },
  crossbow: (host, weapon, dt, time) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const target = smartTarget(host, 500); // 统一索敌：首领 > 精锐 > 群怪 > 最近
    if (!target) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.crossbow;
    const damage = def.damage(level, host.player.stats) * host.player.growth.damageMultiplier(time);
    const bounce = Math.min(4, 2 + Math.floor((level - 1) / 2));
    { const ax = target.x - host.player.x, ay = target.y - host.player.y; host.player.faceDirection(Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down'), 160);
      // 黄忠招牌技动作「百步穿杨」：神射状态或站立蓄势满时出手，至多每 4 秒一次
      const g = host.player.growth, full = g.masteries.steady_aim > 0 && g.stationarySeconds >= 4.99;
      if ((full || host.player.passive.isSharpshooter(time)) && time >= host.player.nextSkillAction && host.player.playAction('skill', ax < 0 ? 'left' : 'right')) host.player.nextSkillAction = time + 4000; }
    host.fireBolt(host.bolts, host.player.x, host.player.y, target.x, target.y, damage, bounce, true, 560);
    // 黄月英满层：机关连弩——朝目标方向扇形齐射 6 支（60% 伤害，弹射 +1）
    { const pc = host.player.passive.beginCast('crossbow'); if (pc.fan) { const px = host.player.x, py = host.player.y, a0 = Math.atan2(target.y - py, target.x - px), n = PASSIVE_RULES.mechBolts;
      host.player.playAction('skill', target.x < px ? 'left' : 'right'); host.heroFx?.('gears', px, py - 10, 240, a0);
      for (let k = 0; k < n; k++) { const a = a0 + (k - (n - 1) / 2) * .16; host.fireBolt(host.bolts, px, py, px + Math.cos(a) * 420, py + Math.sin(a) * 420, damage * PASSIVE_RULES.mechDamageMul, Math.min(5, bounce + 1), true, 600); } } }
    // 每升一级多射 1 支（Lv5 共 5 支）：额外的箭优先分射附近其他敌人，70% 伤害；不够目标时散射同一目标
    const extra = crossbowExtraArrows(level);
    if (extra > 0) {
      const px = host.player.x, py = host.player.y;
      const others = host.grid.query(px, py, 500).filter(e => e.active && !e.isSupplySlot && e !== target && e.hp > 0)
        .map(e => ({ e, d: Math.hypot(e.x - px, e.y - py) })).filter(o => o.d <= 500).sort((a, b) => a.d - b.d).slice(0, extra);
      for (let k = 0; k < extra; k += 1) {
        const t = others[k]?.e;
        if (t) host.fireBolt(host.bolts, px, py, t.x, t.y, damage * .7, bounce, true, 560);
        else { const a = Math.atan2(target.y - py, target.x - px) + (k % 2 ? 1 : -1) * (.12 + .06 * Math.floor(k / 2)), d = Math.hypot(target.x - px, target.y - py) || 1; host.fireBolt(host.bolts, px, py, px + Math.cos(a) * d, py + Math.sin(a) * d, damage * .7, bounce, true, 560); }
      }
    }
    if (host.player.passive.isSharpshooter(time)) {
      const dx = target.x - host.player.x, dy = target.y - host.player.y, d = Math.hypot(dx, dy) || 1;
      host.fireBolt(host.bolts, host.player.x - dy / d * 6, host.player.y + dx / d * 6, target.x, target.y, damage, bounce, true, 560);
    }
    const volley=host.player.growth.masteries.pearl_volley;
    if(volley&&++host.player.growth.shotCount>=[5,4,3][volley-1]){
      host.player.growth.shotCount=0;
      host.fireBolt(host.bolts,host.player.x,host.player.y-5,target.x,target.y,damage*.7,Math.min(5,bounce+(volley===3?1:0)),true,560);
      host.sfx.play('allySpear');
    }
    weapon.cooldownLeft = Math.max(.25, def.cooldown(level, host.player.stats) / host.player.growth.attackSpeedMultiplier(time));
  },
  guandao: (host, weapon, dt, time) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.guandao;
    const damage = def.damage(level, host.player.stats) * host.player.growth.damageMultiplier(time);
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
    const priority=host.priorityTarget?.(radius)??null;
    if(priority)bestAngle=Math.atan2(priority.y-host.player.y,priority.x-host.player.x);
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
    const cone=host.enemies.filter(inCone);
    if(priority&&inCone(priority)){const i=cone.indexOf(priority);if(i>=0)cone.splice(i,1);cone.unshift(priority);}
    const targets = cone.slice(0, 8);
    if (!targets.length) return;
    const passiveCast = host.player.passive.beginCast('guandao');
    const growth=host.player.growth,charge=growth.masteries.dragon_charge;
    const heavy=charge>0&&growth.slashCount>=4;
    if(charge)growth.slashCount=heavy?0:growth.slashCount+1;
    const castDamage = damage * passiveCast.damageMul * (heavy?[1.4,1.65,1.9][charge-1]:1);
    // 魏延 / 刘备满层：回复（刘备连同部曲）
    if (passiveCast.heal) host.player.heal(host.player.maxHp * passiveCast.heal);
    if (passiveCast.rally) { host.rallyAllies?.(passiveCast.rally); host.heroFx?.('rally', host.player.x, host.player.y - 20, 260); }
    else if (passiveCast.heal) host.heroFx?.('bloodslash', host.player.x + Math.cos(angle) * 60, host.player.y + Math.sin(angle) * 60, 280, angle);
    const strike = (enemy: Enemy, amount: number, at: number): void => {
      if (host.hitEnemy(enemy, amount, at, 'melee')) host.player.passive.recordHit(passiveCast, enemy, at);
    };
    const cardinal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) < 0 ? 'left' : 'right') : Math.sin(angle) < 0 ? 'up' : 'down';
    host.player.faceDirection(cardinal as 'left' | 'right' | 'up' | 'down', 130);
    // 招牌技动作：武势蓄满的强化一刀或青龙蓄势重斩
    if (passiveCast.empowered || heavy) host.player.playAction('skill', cardinal === 'left' ? 'left' : 'right');
    host.sfx.play('allySlash');
    host.cameras.main.shake(80, 0.002);
    for (const enemy of targets) {
      strike(enemy, castDamage, time);
      if(heavy&&charge===3&&enemy.active&&enemy.kind!=='boss'&&!enemy.controlImmune){const push=enemy.kind==='elite'?6:18;enemy.sprite.x+=Math.cos(angle)*push;enemy.sprite.y+=Math.sin(angle)*push;}
    }
    const drag=growth.masteries.dragging_blade;
    if(drag&&growth.travel>=DRAG_TRAVEL[drag-1]){
      growth.travel=0;
      const waveRadius=radius*(1+.1*drag),ids=new Set<number>();
      const wave=(multiplier:number,rotation:number,kind:'crescent'|'spin')=>{
        ids.clear();const hits:{x:number;y:number}[]=[];
        for(const e of host.grid.query(host.player.x,host.player.y,waveRadius+40)){
          if(!e.active||ids.has(e.spawnId)||Math.hypot(e.x-host.player.x,e.y-host.player.y)>waveRadius+e.radius)continue;
          const d=Math.atan2(e.y-host.player.y,e.x-host.player.x)-angle;
          if(Math.cos(d)<0)continue;
          ids.add(e.spawnId);hits.push({x:e.x,y:e.y});host.hitEnemy(e,damage*multiplier,host.combatNow,'melee');
        }
        if(host.draggingBladeWave)host.draggingBladeWave(angle+rotation,row.arc*radiusMul*(1+.1*drag),kind,hits);
        else host.spawnGuandaoSlash(angle+rotation, .8, row.arc*radiusMul*(1+.1*drag),160);
      };
      wave(DRAG_WAVE_MUL[drag-1],0,'crescent');
      if(drag===3)host.time.delayedCall(230,()=>{if(!host.over)wave(DRAG_SPIN_MUL,0,'spin');});
    }
    host.spawnGuandaoSlash(angle, 1, arcSize, heavy?200:120);
    if (level >= 3) {
      host.time.delayedCall(180, () => {
        if (host.over) return;
        for (const enemy of host.enemies.filter(inCone).slice(0, 8)) strike(enemy, damage * passiveCast.damageMul * 0.4, host.combatNow);
        host.spawnGuandaoSlash(angle, 0.45, arcSize * 0.75, 95);
      });
    }
    weapon.cooldownLeft = Math.max(.25, def.cooldown(level, host.player.stats) / host.player.growth.attackSpeedMultiplier(time));
  },
  flame_banner: (host, weapon, dt) => {
    weapon.cooldownLeft -= dt;
    if (weapon.cooldownLeft > 0) return;
    const level = weapon.level;
    const def = WEAPON_DEFS.flame_banner;
    const damage = def.damage(level, host.player.stats) * host.player.growth.damageMultiplier(host.combatNow);
    const passiveCast = host.player.passive.beginCast('flame_banner');
    const radius = (120 + (level - 1) * 8) * host.player.stats.fireAreaMul * passiveCast.radiusMul;
    let dirX = 0;
    let dirY = -1;
    const nearest = host.priorityTarget?.(radius*1.45) ?? host.nearestEnemy(host.player.x, host.player.y, 300);
    if (nearest) {
      const d = Math.hypot(nearest.x - host.player.x, nearest.y - host.player.y) || 1;
      dirX = (nearest.x - host.player.x) / d;
      dirY = (nearest.y - host.player.y) / d;
    }
    // 出手时面向目标（同时播放普攻动作）
    host.player.faceDirection(Math.abs(dirX) > Math.abs(dirY) ? (dirX < 0 ? 'left' : 'right') : (dirY < 0 ? 'up' : 'down'), 200);
    if (passiveCast.empowered) host.player.playAction('skill', dirX < 0 ? 'left' : 'right');
    const growth=host.player.growth,formation=growth.masteries.eight_trigrams;
    if(formation)growth.flagCount=Math.min(3,growth.flagCount+1);
    if(formation&&growth.flagCount>=3&&host.combatNow>=growth.formationReadyAt){
      growth.flagCount=0;growth.formationReadyAt=host.combatNow+10000;
      const candidates=host.grid.query(host.player.x,host.player.y,450).filter(e=>e.active&&!e.isSupplySlot);
      let center=candidates[0],score=-1;
      for(const e of candidates.slice(0,32)){const n=host.grid.query(e.x,e.y,140).filter(t=>t.active&&!t.isSupplySlot&&Math.hypot(t.x-e.x,t.y-e.y)<=140).length;if(n>score){score=n;center=e;}}
      if(center){host.martialField(center.x,center.y,[105,125,140][formation-1],damage,1600,formation,true);host.player.playAction('skill',center.x<host.player.x?'left':'right');}
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
      const burn=growth.masteries.wildfire;
      if(burn)host.martialField(cx,cy,radius*(burn===3?1.1:1),damage,[1000,1800,2500][burn-1],burn);
      host.sfx.play('flameBoom');
      // 2026-11-14 用户要求：诸葛亮战旗爆炸不再震屏（高频普攻震屏易疲劳）；爆炸特效与音效保留。
      const candidates = host.grid.query(cx, cy, radius + 30);
      for (const enemy of candidates) {
        if (!enemy.active) continue;
        const dist = Math.hypot(enemy.x - cx, enemy.y - cy);
        if (dist <= radius + enemy.radius && host.hitEnemy(enemy, damage, host.combatNow, 'fire')) host.player.passive.recordHit(passiveCast, enemy, host.combatNow, damage);
      }
    });
    weapon.cooldownLeft = Math.max(.25, def.cooldown(level, host.player.stats) / host.player.growth.attackSpeedMultiplier(host.combatNow));
  },
  zhenbei_blade: zhenbeiBehavior,
  lianhuan_mines: lianhuanBehavior,
  sun_knives: sunKnivesBehavior,
  diaochan_fans: diaochanFansBehavior,
  baodiao_bow: baodiaoBehavior,
  dangyang_roar: dangyangBehavior,
  zhanjin_lance: zhanjinBehavior,
  shuanggu_swords: shuangguBehavior,
};

