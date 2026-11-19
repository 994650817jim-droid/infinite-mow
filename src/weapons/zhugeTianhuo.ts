import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { ZG_TIANHUO as Z } from '../data/heroMechanics';
import type { WeaponHost } from './registry';

/**
 * 诸葛亮「七星灯 · 天火」（2026-11-18 重做，用户选方案 A；参数 data/heroMechanics.ts ZG_TIANHUO）。武器 id 仍为 flame_banner（存档 / 技艺 / 随行都沿用）。
 * 出手：目标脚下标星位（跟着目标走）→ delayMs 后天火落下，单体重创 + 小范围溅射；被动「观星」在 CharacterPassives（starLand）。
 * 技艺：借东风（每第 4 发放东风火龙直线扫过）、八阵图（观星爆发处布阵：减速 / 易伤 / 3 级首领出招变慢）。
 * 特效：手绘序列帧 zhuge_tianhuo（星位 / 天火 / 东风 / 八阵，缺图时退回现有手绘火焰帧 flame_burst / fire_sigil，不画程序特效）。
 */
export const TIANHUO_DEF = {
  id: 'flame_banner' as const, name: '七星灯 · 天火', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => Z.base * (1 + Z.perLevel * (level - 1)) * stats.damageMul * stats.fireMul,
  cooldown: (level: number, stats: PlayerStats) => Z.cooldown * stats.cooldownMul / (1 + Z.cdPerLevel * (level - 1)),
  desc: '观星定位，天火落下重创单个目标（首领 > 精锐 > 血最多），溅射周围',
};
/** 手绘图集 zhuge_tianhuo 的行起点（每行 8 格，每格 256）：星位 6 帧、天火 8 帧、东风火龙 6 帧（横条在 zhuge_eastwind）、八阵地面 6 帧。 */
export const ZGFX = { star: 0, fall: 8, bazhen: 16 } as const;
interface Strike { target: Enemy; spawn: number; x: number; y: number; at: number; damage: number; mark: Phaser.GameObjects.GameObject | null; }
interface Zone { x: number; y: number; r: number; until: number; level: number; fx: Phaser.GameObjects.GameObject | null; }
const STATE = new WeakMap<Player, { strikes: Strike[]; casts: number; zones: Zone[] }>();
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const alive = (e: Enemy): boolean => e.active && !e.isSupplySlot;
const art = (host: WeaponHost): boolean => sceneOf(host).textures.exists('zhuge_tianhuo');
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

/** 选靶：关卡锁定 / 首领 / 精锐（priorityTarget）> 首领 > 精锐 > 当前血最多。 */
export function tianhuoTarget(host: WeaponHost, range: number): Enemy | null {
  const pl = host.player, locked = host.priorityTarget?.(range, false); if (locked) return locked;
  let best: Enemy | null = null, score = -1;
  for (const e of host.grid.query(pl.x, pl.y, range)) {
    if (!alive(e) || Math.hypot(e.x - pl.x, e.y - pl.y) > range + e.radius) continue;
    const s = (e.kind === 'boss' ? 3e6 : e.kind === 'elite' ? 2e6 : 0) + e.hp;
    if (s > score) { score = s; best = e; }
  }
  return best;
}
/** 循环播放某一行序列帧（手绘图集）；loop=false 时播一遍后销毁。 */
function playRow(host: WeaponHost, key: string, row: number, frames: number, x: number, y: number, w: number, h: number, fps: number, loop: boolean, name: string, depth: number, add = true): Phaser.GameObjects.Sprite {
  const scene = sceneOf(host), s = scene.add.sprite(x, y, key, row).setDisplaySize(w, h).setDepth(depth).setName(name);
  if (add) s.setBlendMode('ADD');
  const st = { t: 0 };
  scene.tweens.add({ targets: st, t: frames - .01, duration: frames / fps * 1000, repeat: loop ? -1 : 0, onUpdate: () => { if (s.active) s.setFrame(row + Math.floor(st.t)); }, onComplete: () => { if (!loop && s.active) s.destroy(); } });
  return s;
}
/** 星位预警：跟着目标的手绘星位圈（缺图时用现有火阵地纹 fire_sigil，压扁贴地）。 */
function starMark(host: WeaponHost, x: number, y: number): Phaser.GameObjects.GameObject | null {
  const scene = sceneOf(host);
  if (art(host)) return playRow(host, 'zhuge_tianhuo', ZGFX.star, 6, x, y + 4, 96, 54, 9, true, 'zhuge-star-mark', 19.5);
  if (scene.textures.exists('fire_sigil')) {
    const m = scene.add.image(x, y + 4, 'fire_sigil').setDisplaySize(84, 42).setAlpha(.75).setBlendMode('ADD').setDepth(19.5).setName('zhuge-star-mark');
    scene.tweens.add({ targets: m, alpha: .35, yoyo: true, repeat: -1, duration: 200 });
    return m;
  }
  return null;
}
/** 天火落下：手绘 8 帧（缺图时用现有火焰爆发 flame_burst）。 */
function fallFx(host: WeaponHost, x: number, y: number, burst: boolean): void {
  if (art(host)) { const size = burst ? 190 : 150, s = playRow(host, 'zhuge_tianhuo', ZGFX.fall, 8, x, y, size, size, 20, false, 'zhuge-tianhuo-fall', 43); s.setOrigin(.5, .82); return; }
  host.spawnFlameFx(x, y, Z.splashRadius * (burst ? 1.6 : 1.25));
}
/** 东风火龙：手绘横条 6 帧（zhuge_eastwind，单行 6 帧、每帧 512×128）；缺图时沿线三处火焰爆发。 */
function eastWindFx(host: WeaponHost, x: number, y: number, ux: number, uy: number, len: number): void {
  const scene = sceneOf(host);
  if (scene.textures.exists('zhuge_eastwind')) {
    const s = scene.add.sprite(x + ux * len / 2, y + uy * len / 2, 'zhuge_eastwind', 0).setDisplaySize(len, len / 4).setRotation(Math.atan2(uy, ux)).setBlendMode('ADD').setDepth(42).setName('zhuge-eastwind');
    const st = { t: 0 }; scene.tweens.add({ targets: st, t: 5.99, duration: 420, onUpdate: () => { if (s.active) s.setFrame(Math.floor(st.t)); }, onComplete: () => s.destroy() });
    return;
  }
  for (let k = 1; k <= 3; k++) host.time.delayedCall(k * 70, () => { if (!host.over) host.spawnFlameFx(x + ux * len * k / 3.4, y + uy * len * k / 3.4, 38); });
}

export function tianhuoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth;
  const st = STATE.get(pl) ?? { strikes: [], casts: 0, zones: [] }; STATE.set(pl, st);
  // 八阵图：阵内非首领减速；3 级时阵内首领出招间隔变长（ArcBossV2 系首领读 gapSlow*）；易伤在 CharacterPassives.vulnerability
  for (let i = st.zones.length - 1; i >= 0; i--) {
    const z = st.zones[i];
    if (time >= z.until || host.over) { z.fx?.destroy(); st.zones.splice(i, 1); continue; }
    for (const e of host.grid.query(z.x, z.y, z.r + 40)) {
      if (!alive(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.radius) continue;
      if (e.kind === 'boss') { if (z.level >= 3) { e.gapSlowMul = Z.bazhen.bossGapMul; e.gapSlowUntil = time + 120; } continue; }
      const k = 1 - Z.bazhen.slow * (e.kind === 'elite' ? .6 : 1);
      e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, k); e.martialSlowUntil = time + 120;
    }
  }
  // 星位跟着目标；到点天火落下
  for (let i = st.strikes.length - 1; i >= 0; i--) {
    const s = st.strikes[i], live = s.target.active && s.target.spawnId === s.spawn;
    if (live) { s.x = s.target.x; s.y = s.target.y; (s.mark as Phaser.GameObjects.Sprite | null)?.setPosition?.(s.x, s.y + 4); }
    if (time < s.at && !host.over) continue;
    st.strikes.splice(i, 1); s.mark?.destroy();
    if (host.over) continue;
    let burst = false;
    if (live) {
      burst = pl.passive.starLand(s.target, time);
      host.setCritOverride?.(burst ? true : null);
      try { host.hitEnemy(s.target, s.damage * (burst ? Z.burstMul : 1), time, 'fire'); } finally { host.setCritOverride?.(null); }
      if (burst && g.masteries.eight_trigrams) {
        const L = g.masteries.eight_trigrams, r = Z.bazhen.radius[L - 1], until = time + Z.bazhen.ms[L - 1];
        const fx = art(host) ? playRow(host, 'zhuge_tianhuo', ZGFX.bazhen, 6, s.x, s.y + 6, r * 2.2, r * 1.25, 8, true, 'zhuge-bazhen', 18.6) : null;
        st.zones.push({ x: s.x, y: s.y, r, until, level: L, fx }); pl.passive.addBazhen(s.x, s.y, r, until);
      }
    }
    fallFx(host, s.x, s.y, burst);
    host.sfx.play('atk_flame_boom');
    for (const e of host.grid.query(s.x, s.y, Z.splashRadius + 40)) {
      if (!e.active || e === s.target || Math.hypot(e.x - s.x, e.y - s.y) > Z.splashRadius + e.radius) continue;
      host.hitEnemy(e, s.damage * Z.splashMul, time, 'fire');
    }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = tianhuoTarget(host, Z.range);
  if (!target) return;
  const level = weapon.level, dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  // 智力：天火伤害每点 +1.5%（按实际加点，单点收益；法术伤害加成另由 damageMultiplier 结算）
  const damage = TIANHUO_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * (1 + Z.intPerPoint * (g.attributes?.intellect ?? 0));
  pl.faceDirection(cardinal(ux, uy), 200);
  // 这一发会是观星爆发（目标星象已满）→ 播招牌技动作；否则普通出手
  pl.playAction(pl.passive.starMarks(target, time) >= Z.starNeed ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
  host.spawnFlagSwingFx(ux, uy); host.sfx.play('atk_flame');
  st.strikes.push({ target, spawn: target.spawnId, x: target.x, y: target.y, at: time + Z.delayMs, damage, mark: starMark(host, target.x, target.y) });
  // 借东风：每第 4 发同时放出东风火龙，朝目标方向直线扫过
  st.casts++;
  const W = g.masteries.wildfire;
  if (W && st.casts % Z.eastWind.every === 0) {
    const len = Z.eastWind.len[W - 1], half = Z.eastWind.width / 2, hit = damage * Z.eastWind.mul[W - 1];
    pl.playAction('skill', ux < 0 ? 'left' : 'right');
    eastWindFx(host, pl.x, pl.y, ux, uy, len);
    for (const e of host.grid.query(pl.x + ux * len / 2, pl.y + uy * len / 2, len / 2 + half + 40)) {
      if (!e.active) continue; const ex = e.x - pl.x, ey = e.y - pl.y, along = ex * ux + ey * uy, side = Math.abs(ex * -uy + ey * ux);
      if (along < -e.radius || along > len + e.radius || side > half + e.radius) continue;
      host.hitEnemy(e, hit, time, 'fire');
    }
  }
  weapon.cooldownLeft = Math.max(.4, TIANHUO_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}
/** 测试用：当前星位 / 八阵数量。 */
export function tianhuoState(pl: Player): { strikes: number; zones: number; casts: number } { const s = STATE.get(pl); return { strikes: s?.strikes.length ?? 0, zones: s?.zones.length ?? 0, casts: s?.casts ?? 0 }; }
