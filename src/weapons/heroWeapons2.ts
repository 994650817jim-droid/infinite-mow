import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { PASSIVE_RULES as R } from '../data/passives';
import type { WeaponHost } from './registry';

/**
 * 第二批专属本命武器（2026-11-16，用户确认）：黄忠「宝雕弓」、张飞「当阳喝断」、马超「虎头湛金枪」、刘备「双股剑」。
 * 不再共用黄月英连弩 / 赵云长枪 / 关羽偃月刀。特效全部是程序化过渡方案，正式图见 NEW_HEROES_ASSET_REQUEST.md。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const alive = (e: Enemy): boolean => e.active && !e.isSupplySlot;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
/** 普通 / 精锐被推开（首领、免控不动）。 */
function shove(e: Enemy, ux: number, uy: number, dist: number): void {
  if (e.kind === 'boss' || e.controlImmune) return;
  const k = e.kind === 'elite' ? .4 : 1; e.sprite.x += ux * dist * k; e.sprite.y += uy * dist * k;
}

// ───────────────────────── 黄忠 · 宝雕弓（百步穿杨重箭狙击） ─────────────────────────
export const BAODIAO_DEF = {
  id: 'baodiao_bow' as const, name: '宝雕弓', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [70, 80, 92, 105, 120][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [2.2, 2.1, 2.0, 1.9, 1.8][lv(level)] * stats.cooldownMul,
  desc: '向远处最强的敌人射出重箭，单体重创并击退；首领、精锐优先',
};
interface HeavyArrow { img: Phaser.GameObjects.Image; target: Enemy; spawn: number; damage: number; burst: boolean; pierce: number; hit: Set<number>; ux: number; uy: number; left: number; }
const ARROWS = new WeakMap<Player, HeavyArrow[]>();
function arrowTexture(host: WeaponHost): string {
  const key = 'huangzhong_heavy_arrow', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffd27a, .35).fillRect(0, 4, 30, 4);
  g.fillStyle(0x6a4a24, 1).fillRect(10, 5, 34, 2);
  g.fillStyle(0xe8c070, 1).fillTriangle(44, 1, 44, 11, 56, 6);
  g.fillStyle(0xfff2c0, 1).fillTriangle(6, 2, 12, 6, 6, 10);
  g.generateTexture(key, 56, 12); g.destroy();
  return key;
}
/** 选靶：首领 > 精锐 > 最远（600 内）；有锁定目标时用锁定目标。 */
function sniperTarget(host: WeaponHost, range: number): Enemy | null {
  const pl = host.player, locked = host.priorityTarget?.(range, false); if (locked) return locked;
  let best: Enemy | null = null, score = -1;
  for (const e of host.grid.query(pl.x, pl.y, range)) {
    if (!alive(e)) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d > range) continue;
    const s = (e.kind === 'boss' ? 3000 : e.kind === 'elite' ? 2000 : 0) + d;
    if (s > score) { score = s; best = e; }
  }
  return best;
}
export function baodiaoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, list = ARROWS.get(pl) ?? []; ARROWS.set(pl, list);
  // 飞行中的重箭：追向目标，命中单体（穿杨 3 级再穿 1 人）
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.target.active && a.target.spawnId === a.spawn && !a.hit.has(a.spawn)) { const d = Math.hypot(a.target.x - a.img.x, a.target.y - a.img.y) || 1; a.ux = (a.target.x - a.img.x) / d; a.uy = (a.target.y - a.img.y) / d; }
    const step = R.heavyArrowSpeed * dt; a.img.x += a.ux * step; a.img.y += a.uy * step; a.left -= step; a.img.setRotation(Math.atan2(a.uy, a.ux));
    // 狙击：先只撞锁定的目标（途中的敌人不挡箭）；目标中箭或已死后，穿杨的余力才会打到路上的敌人
    const locked = a.target.active && a.target.spawnId === a.spawn && !a.hit.has(a.spawn);
    for (const e of host.grid.query(a.img.x, a.img.y, 50)) {
      if (!alive(e) || a.hit.has(e.spawnId) || (locked && e !== a.target) || Math.hypot(e.x - a.img.x, e.y - a.img.y) > 12 + e.radius) continue;
      const ex = e.x, ey = e.y; // 爆裂以中箭位置为圆心（击退之前）
      a.hit.add(e.spawnId); host.hitEnemy(e, a.damage, time, 'arrow'); shove(e, a.ux, a.uy, R.heavyArrowKnock);
      const flash = host.add.circle(ex, ey - 8, 10, 0xffe6a0, .8).setDepth(42).setBlendMode(1);
      flash.scene.tweens.add({ targets: flash, radius: 34, alpha: 0, duration: 240, onComplete: () => flash.destroy() });
      if (a.burst) { // 神射：命中处小范围爆裂
        for (const o of host.grid.query(ex, ey, R.heavyBurstRadius + 30)) if (alive(o) && o !== e && Math.hypot(o.x - ex, o.y - ey) <= R.heavyBurstRadius + o.radius) host.hitEnemy(o, a.damage * R.heavyBurstMul, time, 'arrow');
        const ring = host.add.circle(ex, ey - 6, 12, 0xffd27a, 0).setStrokeStyle(4, 0xffe6a0, .9).setDepth(42);
        ring.scene.tweens.add({ targets: ring, radius: R.heavyBurstRadius, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      }
      if (a.pierce-- <= 0) { a.left = 0; break; }
    }
    if (a.left <= 0 || host.over) { a.img.destroy(); list.splice(i, 1); }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = sniperTarget(host, R.heavyArrowRange);
  if (!target) return;
  const g = pl.growth, level = weapon.level;
  const damage = BAODIAO_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * (1 + .12 * g.masteries.chuanyang);
  const sharp = pl.passive.isSharpshooter(time), ux = target.x - pl.x, uy = target.y - pl.y, d = Math.hypot(ux, uy) || 1;
  pl.faceDirection(cardinal(ux, uy), 200);
  if (sharp && time >= pl.nextSkillAction && pl.playAction('skill', ux < 0 ? 'left' : 'right')) pl.nextSkillAction = time + 4000; else pl.playAction('attack', ux < 0 ? 'left' : 'right');
  list.push({ img: host.add.image(pl.x, pl.y - 10, arrowTexture(host)).setDepth(41).setName('huangzhong-heavy-arrow').setBlendMode(sharp ? 1 : 0),
    target, spawn: target.spawnId, damage, burst: sharp, pierce: g.masteries.chuanyang >= 3 ? 1 : 0, hit: new Set(), ux: ux / d, uy: uy / d, left: R.heavyArrowRange + 120 });
  host.sfx.play('allySpear');
  // 老骥伏枥：生命低于一半时射速提高
  const laoji = g.masteries.laoji && pl.hp < pl.maxHp * .5 ? 1 + [.15, .25, .35][g.masteries.laoji - 1] : 1;
  weapon.cooldownLeft = Math.max(.4, BAODIAO_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time) / laoji);
}

// ───────────────────────── 张飞 · 当阳喝断（声浪） ─────────────────────────
export const DANGYANG_DEF = {
  id: 'dangyang_roar' as const, name: '丈八蛇矛·当阳喝断', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [22, 25, 28, 32, 36][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.4, 1.4, 1.35, 1.3, 1.25][lv(level)] * stats.cooldownMul,
  desc: '朝前大喝，一道越推越宽的弧形声浪向前推进，伤害并一路推后敌人',
};
interface Wave { x: number; y: number; a: number; half: number; r: number; max: number; damage: number; hit: Set<number>; g: Phaser.GameObjects.Graphics; }
interface Bridge { x: number; y: number; until: number; g: Phaser.GameObjects.Graphics; }
const WAVES = new WeakMap<Player, { waves: Wave[]; bridges: Bridge[] }>();
export const dangyangHalfAngle = (level: number): number => (level >= 3 ? 45 : 35) * Math.PI / 180;
export function dangyangBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, st = WAVES.get(pl) ?? { waves: [], bridges: [] }; WAVES.set(pl, st);
  // 推进中的声浪：每名敌人只吃一次伤害，被声浪边缘一路推后
  for (let i = st.waves.length - 1; i >= 0; i--) {
    const w = st.waves[i]; w.r += R.roarWaveSpeed * dt;
    for (const e of host.grid.query(w.x, w.y, w.r + 40)) {
      if (!alive(e)) continue;
      const dx = e.x - w.x, dy = e.y - w.y, d = Math.hypot(dx, dy) || 1, off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - w.a), Math.cos(Math.atan2(dy, dx) - w.a)));
      if (off > w.half || d > w.r + e.radius || d < w.r - 40) continue;
      if (!w.hit.has(e.spawnId)) { w.hit.add(e.spawnId); host.hitEnemy(e, w.damage, time, 'melee'); } // 命中即由 hitEnemy 计入怒气
      shove(e, dx / d, dy / d, R.roarWavePush * dt * 60);
    }
    w.g.clear();
    const fade = 1 - w.r / w.max;
    for (let k = 0; k < 3; k++) { const rr = w.r - k * 14; if (rr <= 8) continue; w.g.lineStyle(7 - k * 2, k ? 0xffb060 : 0xff6a3a, .85 * fade).beginPath().arc(w.x, w.y, rr, w.a - w.half, w.a + w.half).strokePath(); }
    if (w.r >= w.max || host.over) { w.g.destroy(); st.waves.splice(i, 1); }
  }
  // 据水断桥：3 秒内敌人进不来
  for (let i = st.bridges.length - 1; i >= 0; i--) {
    const b = st.bridges[i];
    if (time >= b.until || host.over) { b.g.destroy(); st.bridges.splice(i, 1); continue; }
    b.g.setAlpha(.5 + .3 * Math.sin(time / 120));
    for (const e of host.grid.query(b.x, b.y, R.bridgeRadius + 30)) {
      if (!alive(e) || e.kind === 'boss' || e.controlImmune) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1, edge = R.bridgeRadius + e.radius;
      if (d < edge) { e.sprite.x = b.x + dx / d * edge; e.sprite.y = b.y + dy / d * edge; }
    }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const g = pl.growth, level = weapon.level, max = (level >= 5 ? 260 : 220) * (1 + .12 * g.masteries.wanrendi);
  const target = host.priorityTarget?.(max, false) ?? host.nearestEnemy(pl.x, pl.y, max);
  if (!target) return;
  const cast = pl.passive.beginCast('dangyang_roar');
  const damage = DANGYANG_DEF.damage(level, pl.stats) * g.damageMultiplier(time), a = Math.atan2(target.y - pl.y, target.x - pl.x);
  pl.faceDirection(cardinal(Math.cos(a), Math.sin(a)), 200);
  host.sfx.play('allySlash');
  if (cast.bridge) {
    // 据水断桥：360° 喝断，震慑周围（首领只受伤），并留下 3 秒敌人进不来的断桥区
    pl.playAction('skill', Math.cos(a) < 0 ? 'left' : 'right');
    const stun = R.roarStunMs + 200 * g.masteries.dahe;
    for (const e of host.grid.query(pl.x, pl.y, R.roarRadius + 40)) {
      if (!alive(e) || Math.hypot(e.x - pl.x, e.y - pl.y) > R.roarRadius + e.radius) continue;
      host.hitEnemy(e, damage * R.roarDamageMul, time, 'melee');
      if (!e.controlImmune && e.kind !== 'boss') e.stunUntil = Math.max(e.stunUntil, time + stun);
    }
    host.heroFx?.('roar', pl.x, pl.y - 10, R.roarRadius * 2.6);
    const bg = host.add.graphics().setDepth(18.8).setName('zhangfei-bridge');
    bg.fillStyle(0xff8a3c, .12).fillCircle(pl.x, pl.y, R.bridgeRadius).lineStyle(4, 0xffb060, .8).strokeCircle(pl.x, pl.y, R.bridgeRadius);
    st.bridges.push({ x: pl.x, y: pl.y, until: time + R.bridgeMs + 500 * g.masteries.dahe, g: bg });
    host.cameras.main.shake(140, .005);
  } else pl.playAction('attack', Math.cos(a) < 0 ? 'left' : 'right');
  st.waves.push({ x: pl.x, y: pl.y - 4, a, half: dangyangHalfAngle(level), r: 24, max, damage, hit: new Set(), g: host.add.graphics().setDepth(41).setName('zhangfei-wave') });
  weapon.cooldownLeft = Math.max(.3, DANGYANG_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}

// ───────────────────────── 马超 · 虎头湛金枪（铁骑冲阵） ─────────────────────────
export const ZHANJIN_DEF = {
  id: 'zhanjin_lance' as const, name: '虎头湛金枪', maxLevel: 5,
  /** 骑枪基础伤害（移动中 ×1.3、站着补刺 ×0.4）。 */
  damage: (level: number, stats: PlayerStats) => [16, 18, 20, 23, 26][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => 1.2 * stats.cooldownMul / (1 + .05 * (level - 1)),
  desc: '移动时枪尖在前持续刺中敌人，跑得越快伤害越高；站定时补一记短刺',
};
interface Rider { img: Phaser.GameObjects.Image; ux: number; uy: number; left: number; hit: Set<number>; damage: number; }
interface LanceState { px: number; py: number; ux: number; uy: number; nextHit: Map<number, number>; riders: Rider[]; tip?: Phaser.GameObjects.Graphics; standCd: number; }
const LANCE = new WeakMap<Player, LanceState>();
export function zhanjinBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, level = weapon.level;
  let st = LANCE.get(pl); if (!st) { st = { px: pl.x, py: pl.y, ux: 1, uy: 0, nextHit: new Map(), riders: [], standCd: 0 }; LANCE.set(pl, st); }
  const mx = pl.x - st.px, my = pl.y - st.py, moved = Math.hypot(mx, my); st.px = pl.x; st.py = pl.y;
  const moving = moved > .3 && pl.passive.isMoving(time);
  if (moving) { st.ux = mx / moved; st.uy = my / moved; }
  const base = ZHANJIN_DEF.damage(level, pl.stats) * g.damageMultiplier(time);
  const len = R.lanceLen * (1 + .15 * g.masteries.jinma), width = R.lanceWidth * (g.masteries.jinma >= 3 ? 1.5 : 1);
  if (!st.tip) st.tip = host.add.graphics().setDepth(41).setName('machao-lance');
  st.tip.clear();
  if (moving && pl.alive) {
    // 骑枪判定：身前一段，碰到即刺（每名敌人 0.3 秒一次），伤害随实际速度提高
    const speedK = Math.min(1.4, (moved / Math.max(dt, 1e-3)) / R.lanceRefSpeed), dmg = base * R.lanceMoveMul * Math.max(.6, speedK);
    const x0 = pl.x + st.ux * 12, y0 = pl.y - 6 + st.uy * 12;
    st.tip.lineStyle(3, 0xffe08a, .55).lineBetween(x0, y0, x0 + st.ux * len, y0 + st.uy * len).fillStyle(0xfff2c0, .8).fillCircle(x0 + st.ux * len, y0 + st.uy * len, 4);
    for (const e of host.grid.query(x0 + st.ux * len / 2, y0 + st.uy * len / 2, len / 2 + width)) {
      if (!alive(e)) continue;
      const dx = e.x - x0, dy = e.y - y0, along = dx * st.ux + dy * st.uy, side = Math.abs(dx * st.uy - dy * st.ux);
      if (along < -e.radius || along > len + e.radius || side > width / 2 + e.radius || (st.nextHit.get(e.spawnId) ?? 0) > time) continue;
      st.nextHit.set(e.spawnId, time + R.lanceHitMs); host.hitEnemy(e, dmg, time, 'melee');
    }
  }
  if (st.nextHit.size > 300) for (const [id, t] of st.nextHit) if (t <= time) st.nextHit.delete(id);
  // 西凉铁骑：骑兵从身后排成一线冲过战场，沿途践踏
  for (let i = st.riders.length - 1; i >= 0; i--) {
    const r = st.riders[i], step = R.riderSpeed * dt; r.img.x += r.ux * step; r.img.y += r.uy * step; r.left -= step;
    for (const e of host.grid.query(r.img.x, r.img.y, 60)) { if (!alive(e) || r.hit.has(e.spawnId) || Math.hypot(e.x - r.img.x, e.y - r.img.y) > R.riderWidth / 2 + e.radius) continue; r.hit.add(e.spawnId); host.hitEnemy(e, r.damage, time, 'melee'); shove(e, r.ux, r.uy, 14); }
    if (r.left <= 0 || host.over) { r.img.scene.tweens.add({ targets: r.img, alpha: 0, duration: 160, onComplete: () => r.img.destroy() }); st.riders.splice(i, 1); }
  }
  if (pl.passive.snapshot(time).ready && pl.passive.beginCast('zhanjin_lance').cavalry) {
    pl.playAction('skill', st.ux < 0 ? 'left' : 'right');
    const n = R.riderCount + g.masteries.tieqi, scene = sceneOf(host), nx = -st.uy, ny = st.ux;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 34, sx = pl.x - st.ux * 120 + nx * off, sy = pl.y - st.uy * 120 + ny * off;
      const img = scene.textures.exists('enemy_cavalry_run_sheet') ? host.add.image(sx, sy, 'enemy_cavalry_run_sheet', 0).setTint(0xbfe0ff) : host.add.image(sx, sy, '__WHITE');
      img.setScale(64 / Math.max(1, img.height)).setFlipX(st.ux < 0).setDepth(40).setName('machao-rider');
      st.riders.push({ img, ux: st.ux, uy: st.uy, left: R.riderRun, hit: new Set(), damage: base * R.riderDamageMul });
    }
    host.heroFx?.('dash', pl.x + st.ux * 120, pl.y + st.uy * 120, 300, Math.atan2(st.uy, st.ux));
    host.sfx.play('allySpear');
  }
  // 站定：每 1.2 秒向最近的敌人补一记短刺（40%）
  weapon.cooldownLeft -= dt;
  if (moving || weapon.cooldownLeft > 0) return;
  const t = host.priorityTarget?.(R.lanceLen + 20, true) ?? host.nearestEnemy(pl.x, pl.y, R.lanceLen + 20);
  if (!t) return;
  const ux = t.x - pl.x, uy = t.y - pl.y, d = Math.hypot(ux, uy) || 1; st.ux = ux / d; st.uy = uy / d;
  pl.faceDirection(cardinal(ux, uy), 160); pl.playAction('attack', ux < 0 ? 'left' : 'right');
  host.hitEnemy(t, base * R.lanceStandMul, time, 'melee'); host.sfx.play('allySpear');
  const s = host.add.image(pl.x + st.ux * 45, pl.y - 6 + st.uy * 45, 'spear_thrust', 'tight').setRotation(Math.atan2(uy, ux)).setDisplaySize(80, 20).setTint(0xffe08a).setDepth(41);
  s.scene.tweens.add({ targets: s, alpha: 0, duration: 160, onComplete: () => s.destroy() });
  weapon.cooldownLeft = Math.max(.3, ZHANJIN_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}

// ───────────────────────── 刘备 · 双股剑（双剑分击） ─────────────────────────
export const SHUANGGU_DEF = {
  id: 'shuanggu_swords' as const, name: '双股剑', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [20, 23, 26, 29, 33][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.1, 1.1, 1.05, 1.0, .95][lv(level)] * stats.cooldownMul,
  desc: '双剑同时出手，分别在最近的两个敌人身上斩出「×」形交叉斩',
};
export const shuangguSplash = (level: number, taoyuan: number): number => R.crossSplash + (level >= 3 ? 10 : 0) + 10 * taoyuan;
function crossFx(host: WeaponHost, x: number, y: number, size: number, color: number): void {
  const g = host.add.graphics().setDepth(42).setName('liubei-cross');
  g.lineStyle(5, color, .95).lineBetween(x - size, y - size, x + size, y + size).lineBetween(x - size, y + size, x + size, y - size);
  g.lineStyle(2, 0xffffff, .9).lineBetween(x - size * .7, y - size * .7, x + size * .7, y + size * .7).lineBetween(x - size * .7, y + size * .7, x + size * .7, y - size * .7);
  g.scene.tweens.add({ targets: g, alpha: 0, scale: 1.15, duration: 220, onComplete: () => g.destroy() });
}
export function shuangguBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pl = host.player, g = pl.growth, level = weapon.level, range = R.swordsRange;
  const foes = host.grid.query(pl.x, pl.y, range + 30).filter(e => alive(e) && Math.hypot(e.x - pl.x, e.y - pl.y) <= range + e.radius)
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  if (!foes.length) return;
  const locked = host.priorityTarget?.(range, true); if (locked && foes.includes(locked)) { foes.splice(foes.indexOf(locked), 1); foes.unshift(locked); }
  const cast = pl.passive.beginCast('shuanggu_swords');
  const damage = SHUANGGU_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * cast.damageMul, splash = shuangguSplash(level, g.masteries.taoyuan);
  const targets = foes.slice(0, g.masteries.taoyuan >= 3 ? 3 : 2), colors = [0x8fe0c0, 0xffd27a, 0xffffff];
  if (cast.heal) pl.heal(pl.maxHp * cast.heal * (1 + .25 * g.masteries.xiemin));
  if (cast.rally) { host.rallyAllies?.(cast.rally * (1 + .25 * g.masteries.xiemin)); host.heroFx?.('rally', pl.x, pl.y - 20, 260); }
  const u = targets[0], ux = u.x - pl.x, uy = u.y - pl.y;
  pl.faceDirection(cardinal(ux, uy), 140); pl.playAction(cast.empowered ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
  host.sfx.play('allySlash');
  const struck = new Set<number>();
  targets.forEach((t, i) => {
    crossFx(host, t.x, t.y - 6, 18 + splash * .3, colors[i]);
    if (host.hitEnemy(t, damage, time, 'melee')) pl.passive.recordHit(cast, t, time);
    struck.add(t.spawnId);
    for (const o of host.grid.query(t.x, t.y, splash + 30)) if (alive(o) && o !== t && !struck.has(o.spawnId) && Math.hypot(o.x - t.x, o.y - t.y) <= splash + o.radius) { struck.add(o.spawnId); host.hitEnemy(o, damage * R.crossSplashMul, time, 'melee'); }
  });
  // 只有一个目标时，第二把剑补砍同一人（60%）
  if (targets.length === 1) host.hitEnemy(targets[0], damage * .6, time, 'melee');
  weapon.cooldownLeft = Math.max(.25, SHUANGGU_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}
