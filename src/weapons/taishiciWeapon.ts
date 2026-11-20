import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { TAISHICI as TS } from '../data/taishici';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 太史慈 · 东莱双戟（P2 第一批可玩武将，数值 data/taishici.ts）：近身双戟交叉斩，每第 4 击射出短戟钉住敌兵、留减速圈。
 * 被动「信义」：身边部曲挨打攒量（Legion.onHurt → CharacterPassives.onAllyHurt），满了「单骑突围」——本文件取走后冲向最密的敌群，沿途部曲得护盾。
 * 分支「神亭酣战」：一次射 2 支、钉住的敌兵 3 秒后爆裂；「北海突围」：信义少攒、护盾更厚、突围路线留阵地减速敌兵。
 * 特效：手绘序列帧 fx_tsc_*（tools/build-hero-fx-rows.mjs 从 ChatGPT 黑底图切出），缺图时不画程序特效（伤害照算）。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const TAISHICI_DEF = {
  id: 'donglai_ji' as const, name: '东莱双戟', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [14, 16, 18, 21, 24][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [.6, .58, .55, .52, .48][lv(level)] * stats.cooldownMul,
  desc: '近身双戟交叉斩；每第 4 击朝远处射出短戟，钉住敌兵 1 秒、留下减速圈',
};
export const taishiciReach = (level: number): number => TS.reach[lv(level)];

interface Zone { x: number; y: number; r: number; until: number; slow: number; img: Phaser.GameObjects.Image | null; kind: 'pin' | 'route'; ax?: number; ay?: number; bx?: number; by?: number }
interface Burst { e: Enemy; life: number; at: number; dmg: number }
interface TscState { strikes: number; throws: number; dashes: number; zones: Zone[]; bursts: Burst[]; burstsDone: number }
const STATE = new WeakMap<Player, TscState>();
const state = (pl: Player): TscState => { let s = STATE.get(pl); if (!s) { s = { strikes: 0, throws: 0, dashes: 0, zones: [], bursts: [], burstsDone: 0 }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function taishiciDebug(pl: Player): { strikes: number; throws: number; dashes: number; zones: number; bursts: number; burstsDone: number } { const s = state(pl); return { strikes: s.strikes, throws: s.throws, dashes: s.dashes, zones: s.zones.length, bursts: s.bursts.length, burstsDone: s.burstsDone }; }

function throwJi(host: WeaponHost, st: TscState, weapon: WeaponState, target: Enemy, time: number, shenting: boolean, k: number): void {
  const pl = host.player, g = pl.growth, s = sceneOf(host);
  const range = TS.throwRange * (1 + TS.shenshe * g.masteries.shenshe) * pl.passive.rangeMultiplier('donglai_ji');
  const dmg = TAISHICI_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * TS.throwMul * (shenting ? k : 1);
  const base = Math.atan2(target.y - pl.y, target.x - pl.x), n = shenting ? TS.shenting.throws : 1;
  st.throws++;
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? (i - (n - 1) / 2) * TS.shenting.spread * 2 / (n - 1) : 0), ux = Math.cos(a), uy = Math.sin(a);
    // 沿直线找第一个碰到的敌兵
    let first: Enemy | null = null, fd = range;
    for (const e of host.grid.query(pl.x + ux * range / 2, pl.y + uy * range / 2, range / 2 + 40)) {
      if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
      const dx = e.x - pl.x, dy = e.y - pl.y, along = dx * ux + dy * uy, side = Math.abs(-dx * uy + dy * ux);
      if (along > 0 && along < fd && side <= TS.throwW / 2 + e.radius) { fd = along; first = e; }
    }
    const ex = pl.x + ux * fd, ey = pl.y + uy * fd, fly = fd / TS.speed * 1000;
    const img = s.textures.exists('fx_tsc_ji') ? host.add.image(pl.x, pl.y - 12, 'fx_tsc_ji', 0).setDisplaySize(90, 90).setRotation(a).setDepth(42).setBlendMode(1).setName('tsc-ji') : null;
    if (img) s.tweens.add({ targets: img, x: ex, y: ey - 12, duration: fly, onUpdate: tw => img.setFrame(Math.min(2, Math.floor(tw.progress * 3))), onComplete: () => { img.setFrame(3).setRotation(0).setFlipX(ux < 0); s.tweens.add({ targets: img, alpha: 0, delay: 300, duration: 300, onComplete: () => img.destroy() }); } });
    const hitE = first;
    host.time.delayedCall(fly, () => {
      if (host.over) return; const now = host.combatNow;
      if (hitE?.active) {
        host.hitEnemy(hitE, dmg, now, 'arrow');
        if (hitE.active && hitE.kind !== 'boss' && !hitE.controlImmune) hitE.stunUntil = Math.max(hitE.stunUntil, now + TS.pinMs);
        if (shenting && hitE.active) st.bursts.push({ e: hitE, life: hitE.spawnId, at: now + TS.shenting.burstMs, dmg: dmg * TS.shenting.burstMul });
      }
      const zimg = s.textures.exists('fx_tsc_pin') ? host.add.image(ex, ey, 'fx_tsc_pin', 0).setDisplaySize(TS.slowR * 2.3, TS.slowR * 2.3 * .62).setDepth(3).setAlpha(.85).setBlendMode(1).setName('tsc-pin') : null;
      st.zones.push({ x: ex, y: ey, r: TS.slowR, until: now + TS.slowMs, slow: TS.slow, img: zimg, kind: 'pin' });
    });
  }
  host.sfx.play('atk_lance');
}

function breakout(host: WeaponHost, st: TscState, weapon: WeaponState, time: number, beihai: boolean, final: boolean, k: number): void {
  const pl = host.player, g = pl.growth, s = sceneOf(host);
  // 最密的敌群：360 内每个敌兵数 90 内的邻居，取最多的那个方向
  let best: Enemy | null = null, bestN = -1;
  for (const e of host.grid.query(pl.x, pl.y, 360)) {
    if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
    let n = 0; for (const o of host.grid.query(e.x, e.y, 90)) if (o.active && !(o.isSupplySlot && !o.lockTarget)) n++;
    if (n > bestN) { bestN = n; best = e; }
  }
  const hd = Math.hypot(pl.heading.x, pl.heading.y) || 1;
  let ux = pl.heading.x / hd, uy = pl.heading.y / hd;
  if (best) { const d = Math.hypot(best.x - pl.x, best.y - pl.y) || 1; ux = (best.x - pl.x) / d; uy = (best.y - pl.y) / d; }
  const ax = pl.x, ay = pl.y, bx = pl.x + ux * TS.dashLen, by = pl.y + uy * TS.dashLen;
  st.dashes++;
  pl.knockUp(time, TS.dashMs, ux * TS.dashLen, uy * TS.dashLen, true);
  pl.playAction('skill', ux < 0 ? 'left' : 'right');
  const dmg = TAISHICI_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * TS.dashMul * (beihai ? k : 1);
  for (const e of host.grid.query((ax + bx) / 2, (ay + by) / 2, TS.dashLen / 2 + 50)) {
    if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
    const dx = e.x - ax, dy = e.y - ay, along = dx * ux + dy * uy, side = Math.abs(-dx * uy + dy * ux);
    if (along >= -e.radius && along <= TS.dashLen + e.radius && side <= TS.dashW / 2 + e.radius) host.hitEnemy(e, dmg, time, 'melee');
  }
  host.shieldAllies?.(ax, ay, bx, by, TS.shieldR, TS.shield * (beihai ? TS.beihai.shieldMul : 1) * (beihai && final ? 1.3 : 1), time + TS.shieldMs);
  if (s.textures.exists('fx_tsc_dash')) playSheet(s, 'fx_tsc_dash', (ax + bx) / 2, (ay + by) / 2 - 10, { size: TS.dashLen + 120, sizeH: 150, ms: TS.dashMs + 160, depth: 41, add: true, rotation: Math.atan2(uy, ux), name: 'tsc-dash' });
  if (beihai) {
    const zimg = s.textures.exists('fx_tsc_route') ? host.add.image((ax + bx) / 2, (ay + by) / 2, 'fx_tsc_route', 0).setDisplaySize(TS.dashLen + 60, TS.beihai.zoneW * 1.4).setRotation(Math.atan2(uy, ux)).setDepth(3).setAlpha(.85).setBlendMode(1).setName('tsc-route') : null;
    st.zones.push({ x: (ax + bx) / 2, y: (ay + by) / 2, r: TS.beihai.zoneW / 2, until: time + TS.beihai.zoneMs, slow: TS.beihai.zoneSlow, img: zimg, kind: 'route', ax, ay, bx, by });
  }
  host.sfx.play('atk_guandao_heavy');
}

function inZone(z: Zone, e: Enemy): boolean {
  if (z.kind === 'pin') return Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.radius;
  const ux = z.bx! - z.ax!, uy = z.by! - z.ay!, len = Math.hypot(ux, uy) || 1, dx = e.x - z.ax!, dy = e.y - z.ay!, along = (dx * ux + dy * uy) / len, side = Math.abs(-dx * uy + dy * ux) / len;
  return along >= 0 && along <= len && side <= z.r + e.radius;
}

export function taishiciBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), shenting = branch === 'tsc_shenting', beihai = branch === 'tsc_beihai';
  const final = tier >= 3 && (g.build.tags()[shenting ? 'archery' : 'formation'] ?? 0) >= 4;
  pl.passive.tscNeed = beihai ? TS.beihai.need : TS.need;
  if (pl.passive.takeBreakout()) breakout(host, st, weapon, time, beihai, final, k);
  // 减速圈 / 阵地
  for (const z of st.zones) {
    z.img?.setFrame(Math.floor(time / 90) % 6).setAlpha(Math.min(.85, (z.until - time) / 400));
    for (const e of host.grid.query(z.x, z.y, (z.kind === 'pin' ? z.r : TS.dashLen / 2) + 40)) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || !inZone(z, e)) continue;
      e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - z.slow); e.martialSlowUntil = time + 120;
    }
  }
  for (const z of st.zones) if (time >= z.until) z.img?.destroy();
  st.zones = st.zones.filter(z => time < z.until);
  // 神亭酣战：钉住的敌兵到时爆裂（进阶范围更大）
  for (const b of st.bursts) {
    if (time < b.at) continue;
    if (b.e.active && b.e.spawnId === b.life) {
      const r = TS.shenting.burstR * (final && shenting ? 1.4 : 1), x = b.e.x, y = b.e.y, s = sceneOf(host);
      for (const e of host.grid.query(x, y, r + 30)) if (e.active && Math.hypot(e.x - x, e.y - y) <= r + e.radius) host.hitEnemy(e, b.dmg, time, 'arrow');
      if (s.textures.exists('fx_tsc_burst')) playSheet(s, 'fx_tsc_burst', x, y - 8, { size: r * 2.4, ms: 360, depth: 41, add: true, name: 'tsc-burst' });
      st.burstsDone++;
    }
    b.at = Infinity;
  }
  st.bursts = st.bursts.filter(b => b.at !== Infinity);
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = smartTarget(host, Math.max(TS.range, TS.throwRange * .9));
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, rot = Math.atan2(dy, dx);
  const reach = taishiciReach(weapon.level) * pl.passive.rangeMultiplier('donglai_ji');
  const cd = Math.max(.2, TAISHICI_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
  // 每第 4 击射戟（目标在射程内就射，不必近身）；其余是近身双戟，够不着就等敌兵靠近
  if ((st.strikes + 1) % TS.throwEvery === 0) {
    throwJi(host, st, weapon, target, time, shenting, k); st.strikes++;
    pl.faceDirection(cardinal(dx / d, dy / d), 160); pl.playAction('attack', cardinal(dx / d, dy / d)); weapon.cooldownLeft = cd; return;
  }
  if (d > reach + target.radius + 10) return;
  const dmg = TAISHICI_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * (1 + TS.qichi * g.masteries.qichi);
  for (const e of host.grid.query(pl.x, pl.y, reach + 40)) {
    if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
    const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey);
    if (ed > reach + e.radius) continue;
    if (ed > e.radius && Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - rot), Math.cos(Math.atan2(ey, ex) - rot))) > TS.arc) continue;
    host.hitEnemy(e, dmg, time, 'melee');
  }
  st.strikes++;
  const s = sceneOf(host);
  if (s.textures.exists('fx_tsc_slash')) playSheet(s, 'fx_tsc_slash', pl.x + Math.cos(rot) * reach * .45, pl.y - 8 + Math.sin(rot) * reach * .45, { size: reach * 1.8, ms: 220, depth: 41, add: true, rotation: rot, name: 'tsc-slash' });
  pl.faceDirection(cardinal(dx / d, dy / d), 160);
  pl.playAction('attack', cardinal(dx / d, dy / d));
  host.sfx.play('atk_guandao');
  weapon.cooldownLeft = cd;
}
