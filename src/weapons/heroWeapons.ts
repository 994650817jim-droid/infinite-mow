import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { PASSIVE_RULES as R } from '../data/passives';
import type { WeaponHost } from './registry';
import { smartTarget } from './heroWeapons2';

/**
 * 魏延「镇北环首刀」与庞统「凤雏连环令」两把专属本命武器（2026-11-15 重做，不再沿用关羽偃月刀 / 诸葛亮战旗）。
 * 特效均为程序化过渡方案（地裂纹、碎石、火雷、锁链）；魏延劈下瞬间沿用他已有的劈地序列帧，庞统火烧连环沿用火凤序列帧。
 */
/** 正式序列帧图集是否已加载（缺图时退回程序化特效）。 */
export const hasFxSheet = (host: WeaponHost, sheet: string): boolean => (host.add as unknown as { scene: Phaser.Scene }).scene.textures.exists('hero_fx_' + sheet);
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));

// ───────────────────────── 魏延 · 镇北环首刀 ─────────────────────────

/** 裂波道数：Lv1–2 一道、Lv3–4 两道、Lv5 三道。 */
export const zhenbeiCracks = (level: number): number => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const ZHENBEI_DEF = {
  id: 'zhenbei_blade' as const, name: '镇北环首刀', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [30, 34, 38, 43, 48][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.5, 1.5, 1.45, 1.4, 1.35][lv(level)] * stats.cooldownMul,
  desc: '朝敌群重劈，地面裂开直线冲击波，穿透全部敌人',
};

/** 敌人到线段（起点 → 方向 × 长度）的侧向距离；在线段范围外返回 Infinity。 */
function sideDistance(e: Enemy, x: number, y: number, ux: number, uy: number, len: number): { along: number; side: number } {
  const dx = e.x - x, dy = e.y - y, along = dx * ux + dy * uy;
  if (along < -e.radius || along > len + e.radius) return { along, side: Infinity };
  return { along, side: Math.abs(dx * uy - dy * ux) };
}

/** 程序化地裂纹：主裂缝折线 + 两侧细纹 + 碎石，暗红余烬后淡出（过渡特效）。 */
function crackFx(host: WeaponHost, x: number, y: number, angle: number, len: number, width: number, hot = false): void {
  const g = host.add.graphics().setDepth(19), ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  const pts: Array<[number, number]> = []; const steps = 9;
  for (let i = 0; i <= steps; i++) { const t = i / steps, j = i === 0 ? 0 : (Math.random() - .5) * width * .35; pts.push([x + ux * len * t + nx * j, y + uy * len * t + ny * j]); }
  const stroke = (w: number, color: number, a: number) => { g.lineStyle(w, color, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokePath(); };
  stroke(width * .55, 0x2a1a10, .35); stroke(7, hot ? 0xff5a2a : 0x3b2414, .9); stroke(3, hot ? 0xffd27a : 0xff8a3c, .95);
  for (let i = 2; i < steps; i += 2) { const [px, py] = pts[i], s = (i % 4 ? 1 : -1) * width * (.35 + Math.random() * .2); g.lineStyle(2, 0x3b2414, .8); g.lineBetween(px, py, px + nx * s + ux * 10, py + ny * s + uy * 10); }
  g.scene.tweens.add({ targets: g, alpha: 0, delay: 260, duration: 380, onComplete: () => g.destroy() });
  for (let i = 0; i < 7; i++) {
    const t = .2 + Math.random() * .8, px = x + ux * len * t, py = y + uy * len * t, side = (Math.random() - .5) * width;
    const rock = host.add.rectangle(px + nx * side * .3, py + ny * side * .3, 5 + Math.random() * 4, 4 + Math.random() * 3, Math.random() < .5 ? 0x6b4a2c : 0x8a6a44).setDepth(42).setRotation(Math.random() * 3);
    rock.scene.tweens.add({ targets: rock, x: px + nx * side, y: py + ny * side - 18 - Math.random() * 14, rotation: rock.rotation + 2, alpha: 0, duration: 420 + Math.random() * 160, ease: 'Quad.easeOut', onComplete: () => rock.destroy() });
  }
}

/** 一次劈砍朝各方向放出的裂波；同一次出刀里每名敌人只吃一次伤害。 */
/** sprite=false：只画程序化地裂纹（谁敢杀我时由整张怒吼冲击波序列帧负责光效，避免 6 张叠加混合裂波把画面冲成白色）。 */
function releaseCracks(host: WeaponHost, angles: number[], damage: number, len: number, width: number, now: number, hot: boolean, sprite = true): number {
  const px = host.player.x, py = host.player.y, hit = new Set<number>(); let n = 0;
  for (const a of angles) {
    const ux = Math.cos(a), uy = Math.sin(a);
    for (const e of host.grid.query(px + ux * len / 2, py + uy * len / 2, len / 2 + width)) {
      if (!e.active || e.isSupplySlot || hit.has(e.spawnId)) continue;
      const { along, side } = sideDistance(e, px, py, ux, uy, len);
      if (side > width / 2 + e.radius) continue;
      hit.add(e.spawnId);
      if (host.hitEnemy(e, damage * (along <= R.crackCloseRange ? R.crackCloseMul : 1), now, 'melee')) n++;
    }
    // 正式「劈地裂波」序列帧（朝右，按方向旋转、按长度放大）；缺图时退回程序化地裂纹
    if (sprite && hasFxSheet(host, 'c')) host.heroFx?.('crack', px + ux * (len / 2 + 10), py + 8 + uy * (len / 2 + 10), len * 1.25, a);
    else crackFx(host, px + ux * 14, py + 10 + uy * 14, a, len, width, hot);
  }
  return n;
}

export function zhenbeiBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pl = host.player, growth = pl.growth, level = weapon.level;
  const kaishan = growth.masteries.kaishan, heavy = kaishan > 0 && growth.slashCount >= 4;
  const len = R.crackLen, width = R.crackWidth * (heavy ? 1.5 : 1);
  // 选裂波方向：16 个候选方向里，直线带内敌人最多（精锐 / 首领加权）的一个；有优先目标时直指目标
  const near = host.grid.query(pl.x, pl.y, len + 40).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= len + e.radius);
  if (!near.length) return; // 没有敌人不出刀、不耗冷却
  let best = 0, bestScore = -1;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 2 * i / 16, ux = Math.cos(a), uy = Math.sin(a); let score = 0;
    for (const e of near) { const { side } = sideDistance(e, pl.x, pl.y, ux, uy, len); if (side <= width / 2 + e.radius) score += e.kind === 'boss' ? 5 : e.kind === 'elite' ? 2 : 1; }
    if (score > bestScore) { bestScore = score; best = a; }
  }
  const priority = host.priorityTarget?.(len) ?? null;
  if (priority) best = Math.atan2(priority.y - pl.y, priority.x - pl.x);
  const cast = pl.passive.beginCast('zhenbei_blade');
  if (kaishan) growth.slashCount = heavy ? 0 : growth.slashCount + 1;
  // 孤军深入：身边 160 像素内每名敌人伤害 +1.5/2/2.5%（最多 15 名）
  const gujun = growth.masteries.gujun ? 1 + Math.min(15, host.grid.query(pl.x, pl.y, 160).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= 160).length) * [.015, .02, .025][growth.masteries.gujun - 1] : 1;
  const damage = ZHENBEI_DEF.damage(level, pl.stats) * growth.damageMultiplier(time) * gujun * (heavy ? [1.5, 1.7, 1.9][kaishan - 1] : 1);
  const ux = Math.cos(best), uy = Math.sin(best);
  pl.faceDirection(Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down'), 160);
  host.sfx.play('allySlash');
  if (cast.whoDares) {
    // 谁敢杀我：怒吼，6 向裂波各 80%，并 3 秒受伤 -30%
    pl.playAction('skill', ux < 0 ? 'left' : 'right');
    pl.passive.startGuard(time);
    const angles = Array.from({ length: R.whoDaresDirs }, (_, k) => best + k * Math.PI * 2 / R.whoDaresDirs);
    releaseCracks(host, angles, damage * R.whoDaresDamageMul, len * 1.1, width, time, true, false);
    host.heroFx?.('whoDares', pl.x, pl.y - 4, len * 1.6);
    if (!hasFxSheet(host, 'c')) { const ring = host.add.circle(pl.x, pl.y - 6, 30, 0xff5a3c, 0).setStrokeStyle(6, 0xff6a4a, .9).setDepth(41);
      ring.scene.tweens.add({ targets: ring, radius: len, alpha: 0, duration: 460, onComplete: () => ring.destroy() }); }
    const shout = host.add.text(pl.x, pl.y - 70, '谁敢杀我！', { fontFamily: 'serif', fontSize: '26px', color: '#ffe0b0', stroke: '#7a1a10', strokeThickness: 6 }).setOrigin(.5).setDepth(60).setName('weiyan-whodares');
    shout.scene.tweens.add({ targets: shout, y: pl.y - 104, alpha: 0, delay: 500, duration: 600, onComplete: () => shout.destroy() });
    host.cameras.main.shake(140, .005);
  } else {
    pl.playAction(heavy ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
    const n = zhenbeiCracks(level), spread = 18 * Math.PI / 180;
    const angles = n === 1 ? [best] : n === 2 ? [best - spread / 2, best + spread / 2] : [best - spread, best, best + spread];
    releaseCracks(host, angles, damage, len, width, time, heavy);
    host.cameras.main.shake(70, heavy ? .004 : .002);
  }
  // 劈下瞬间：魏延自己的劈地序列帧（缺图时 heroFx 什么都不做）
  host.heroFx?.('weiyanSlash', pl.x + ux * 56, pl.y + uy * 56, 230, best);
  weapon.cooldownLeft = Math.max(.25, ZHENBEI_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}

// ───────────────────────── 庞统 · 凤雏连环令 ─────────────────────────

/** 每次落雷枚数：Lv1–4 一枚（脚下）、Lv5 两枚（脚下 + 身旁一侧，雷链加宽）。 */
export const lianhuanMinesPerCast = (level: number): number => (level >= 5 ? 2 : 1);
export const LIANHUAN_DEF = {
  id: 'lianhuan_mines' as const, name: '凤雏连环令', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => 26 * (1 + .18 * (level - 1)) * stats.damageMul * stats.fireMul,
  // 2026-11-16 重做（用户批准）：改为定时在脚下落雷、边走边留下雷链；Lv3 起落雷间隔缩短
  cooldown: (level: number, stats: PlayerStats) => ((level >= 3 ? R.mineDropFastSec : R.mineDropSec) * stats.cooldownMul) / (1 + .03 * (level - 1)),
  desc: '每隔片刻在脚下落一枚火雷，边走边留下雷链；敌人踩中引爆，附近火雷连环引爆',
};
const mineRadius = (level: number) => R.mineRadius * (1 + .05 * (level - 1));

interface Mine { x: number; y: number; armAt: number; until: number; body: Phaser.GameObjects.Container; lit: boolean; ring?: RingGroup; }
interface RingGroup { x: number; y: number; fuseAt: number; mines: Mine[]; links: Phaser.GameObjects.Container; fired: boolean; }
interface Chain { count: number; awarded: boolean; }
interface MineState { mines: Mine[]; rings: RingGroup[]; fengpoReadyAt: number; side: number; }
const STATE = new WeakMap<Player, MineState>();
const stateOf = (p: Player): MineState => { let s = STATE.get(p); if (!s) { s = { mines: [], rings: [], fengpoReadyAt: 0, side: 1 }; STATE.set(p, s); } return s; };

const texOk = (host: WeaponHost, key: string): boolean => (host.add as unknown as { scene: Phaser.Scene }).scene.textures.exists(key);
/** 火雷：正式贴图（青铜雷壳）+ 叠加混合的跳动红芯；缺图时退回程序化雷壳。 */
function mineBody(host: WeaponHost, x: number, y: number): Phaser.GameObjects.Container {
  if (texOk(host, 'pangtong_mine')) {
    const shell = host.add.image(0, 0, 'pangtong_mine').setDisplaySize(30, 30);
    const glow = host.add.circle(0, -1, 5, 0xff5a2a, .8).setBlendMode(1);
    glow.scene.tweens.add({ targets: glow, scale: 1.8, alpha: .35, yoyo: true, repeat: -1, duration: 260 });
    return host.add.container(x, y, [shell, glow]).setDepth(19).setName('pangtong-mine');
  }
  const shell = host.add.circle(0, 0, 11, 0x6a4a24).setStrokeStyle(2, 0xc8a050, 1);
  const rim = host.add.circle(0, 0, 7, 0x3a2614);
  const core = host.add.circle(0, 0, 4, 0xff4a2a);
  core.scene.tweens.add({ targets: core, scale: 1.6, alpha: .55, yoyo: true, repeat: -1, duration: 260 });
  return host.add.container(x, y, [shell, rim, core]).setDepth(19).setName('pangtong-mine');
}

/** 两枚火雷间的锁链（连环）：正式铁链贴图平铺；缺图时画程序化链环。放进 into（火烧连环常驻）或闪一下淡出。 */
function linkFx(host: WeaponHost, a: { x: number; y: number }, b: { x: number; y: number }, into?: Phaser.GameObjects.Container): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  let obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Graphics;
  if (texOk(host, 'pangtong_chain')) {
    const t = host.add.tileSprite((a.x + b.x) / 2, (a.y + b.y) / 2, d, 12, 'pangtong_chain').setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setDepth(19.5);
    t.setTileScale(12 / 24, 12 / 24); obj = t;
  } else {
    const g = host.add.graphics().setDepth(19.5), n = Math.max(2, Math.round(d / 12));
    g.lineStyle(3, 0x5a4630, .9).lineBetween(a.x, a.y, b.x, b.y);
    for (let i = 0; i <= n; i++) { const t = i / n; g.lineStyle(2, i % 2 ? 0xe8c070 : 0xb08a48, 1).strokeCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3); }
    obj = g;
  }
  if (into) into.add(obj);
  else { obj.setName('pangtong-link'); obj.scene.tweens.add({ targets: obj, alpha: 0, duration: 320, onComplete: () => obj.destroy() }); }
}

function placeMine(host: WeaponHost, s: MineState, x: number, y: number, now: number, life: number, ring?: RingGroup): Mine {
  const m: Mine = { x, y, armAt: now + R.mineArmMs, until: now + life, body: mineBody(host, x, y), lit: false, ring };
  s.mines.push(m); return m;
}

function explode(host: WeaponHost, s: MineState, m: Mine, damage: number, radius: number, chain: Chain | null, chainRange: number, chained: boolean, now: number): void {
  if (m.lit) return; m.lit = true;
  const i = s.mines.indexOf(m); if (i >= 0) s.mines.splice(i, 1);
  m.body.destroy();
  if (host.over) return;
  host.spawnFlameFx(m.x, m.y, radius); host.sfx.play('flameBoom');
  const dmg = damage * (chained && host.player.growth.masteries.lianying >= 3 ? 1.2 : 1);
  for (const e of host.grid.query(m.x, m.y, radius + 30)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - m.x, e.y - m.y) <= radius + e.radius) host.hitEnemy(e, dmg, now, 'fire');
  if (!chain) return;
  chain.count++;
  if (!chain.awarded && chain.count >= R.mineChainStack) { chain.awarded = true; host.player.passive.onMineChain(chain.count); }
  // 连环：附近未引爆的火雷依次连锁
  for (const o of [...s.mines]) {
    if (o.lit || o.ring || Math.hypot(o.x - m.x, o.y - m.y) > chainRange) continue;
    o.lit = true; linkFx(host, m, o);
    host.time.delayedCall(R.mineChainDelayMs, () => { o.lit = false; explode(host, s, o, damage, radius, chain, chainRange, true, host.combatNow); });
  }
}

function fireRing(host: WeaponHost, s: MineState, g: RingGroup, damage: number, radius: number, now: number): void {
  if (g.fired) return; g.fired = true;
  g.links.destroy(); s.rings.splice(s.rings.indexOf(g), 1);
  for (const m of g.mines) explode(host, s, m, damage, radius, null, 0, false, now);
  host.heroFx?.('phoenix', g.x, g.y - R.ringRadius * .3, R.ringRadius * 3);
  host.martialField(g.x, g.y, R.ringRadius + 20, damage, R.ringFireMs, 2);
}

export function lianhuanBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = stateOf(pl), growth = pl.growth, level = weapon.level;
  const damage = LIANHUAN_DEF.damage(level, pl.stats) * growth.damageMultiplier(time), radius = mineRadius(level);
  const chainRange = R.mineChainRange * (1 + .15 * growth.masteries.lianying);
  // 火雷：踩中或到期引爆，带出连锁
  for (const m of [...s.mines]) {
    if (m.lit || m.ring || time < m.armAt) continue;
    const stepped = time >= m.until || host.grid.query(m.x, m.y, R.mineTrigger + 30).some(e => e.active && !e.isSupplySlot && Math.hypot(e.x - m.x, e.y - m.y) <= R.mineTrigger + e.radius);
    if (time >= m.until) { explode(host, s, m, damage, radius, null, 0, false, time); continue; }
    if (stepped) explode(host, s, m, damage, radius, { count: 0, awarded: false }, chainRange, false, time);
  }
  // 火烧连环：敌人踏入圈内或 2 秒后整圈齐爆
  for (const g of [...s.rings]) {
    const inside = host.grid.query(g.x, g.y, R.ringRadius + 30).some(e => e.active && !e.isSupplySlot && Math.hypot(e.x - g.x, e.y - g.y) <= R.ringRadius - 10);
    if (time >= g.fuseAt || (inside && time >= g.mines[0].armAt)) fireRing(host, s, g, damage, radius, time);
  }
  const max = R.mineMax + 2 * growth.masteries.fulei, life = R.mineLifeMs + 2000 * growth.masteries.fulei;
  // 落凤坡伏兵：生命 <30% 时脚下布 4 枚火雷护身（每 30 秒最多一次）
  if (pl.alive && pl.hp < pl.maxHp * R.fengpoHp && time >= s.fengpoReadyAt) {
    s.fengpoReadyAt = time + R.fengpoCooldownMs;
    for (let k = 0; k < R.fengpoMines; k++) { const a = k * Math.PI / 2 + Math.PI / 4; placeMine(host, s, pl.x + Math.cos(a) * 46, pl.y + Math.sin(a) * 46, time, life); }
    const t = host.add.text(pl.x, pl.y - 66, '落凤坡伏兵', { fontFamily: 'serif', fontSize: '20px', color: '#ffd9a0', stroke: '#5a1a10', strokeThickness: 5 }).setOrigin(.5).setDepth(60).setName('pangtong-fengpo');
    t.scene.tweens.add({ targets: t, y: pl.y - 96, alpha: 0, delay: 500, duration: 600, onComplete: () => t.destroy() });
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const foes = host.grid.query(pl.x, pl.y, 320).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= 320)
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  if (!foes.length) return; // 没有敌人不布雷、不耗冷却
  const priority = host.priorityTarget?.(320) ?? null; if (priority) { foes.splice(foes.indexOf(priority), 1); foes.unshift(priority); }
  const cast = pl.passive.beginCast('lianhuan_mines');
  if (cast.formation) {
    // 火烧连环：身边一圈 6 枚火雷，以锁链连成环
    pl.faceDirection(foes[0].x < pl.x ? 'left' : 'right', 200);
    host.spawnFlagSwingFx(Math.sign(foes[0].x - pl.x) || 1, 0);
    host.sfx.play('flameSwing');
    pl.playAction('skill', foes[0].x < pl.x ? 'left' : 'right');
    const g: RingGroup = { x: pl.x, y: pl.y, fuseAt: time + R.ringFuseMs, mines: [], links: host.add.container(0, 0).setDepth(19.5).setName('pangtong-ring'), fired: false };
    for (let k = 0; k < R.ringMines; k++) { const a = k * Math.PI * 2 / R.ringMines; g.mines.push(placeMine(host, s, pl.x + Math.cos(a) * R.ringRadius, pl.y + Math.sin(a) * R.ringRadius, time, R.ringFuseMs + 500, g)); }
    for (let k = 0; k < R.ringMines; k++) linkFx(host, g.mines[k], g.mines[(k + 1) % R.ringMines], g.links);
    s.rings.push(g);
  } else {
    // 脚下落雷：边走边留下雷链，追兵踩中即连环引爆。Lv5 另在身旁一侧（与最近敌人方向垂直，左右交替）多落一枚
    const n = lianhuanMinesPerCast(level);
    const dx = foes[0].x - pl.x, dy = foes[0].y - pl.y, d = Math.hypot(dx, dy) || 1;
    s.side = -s.side || 1;
    for (let k = 0; k < n; k++) {
      const off = k === 0 ? 0 : R.mineSideOffset * s.side, x = pl.x - dy / d * off, y = pl.y + dx / d * off;
      while (s.mines.filter(m => !m.ring).length >= max) { const old = s.mines.find(m => !m.ring && !m.lit); if (!old) break; explode(host, s, old, damage, radius, null, 0, false, time); }
      placeMine(host, s, x, y, time, life);
    }
  }
  weapon.cooldownLeft = Math.max(.25, LIANHUAN_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}

/** 测试 / 调试用：当前场上火雷数。 */
export function lianhuanMineCount(p: Player): number { return STATE.get(p)?.mines.length ?? 0; }

// ───────────────────────── 孙尚香 · 弓腰姬飞刀 ─────────────────────────
// 近：身边环绕飞刀，割伤贴身敌人；远：从环里掷出一把，穿透、不飞回，1.2 秒后在身边重新凝成一把。
// 被动「侍婢执刀」满层时召执刀侍婢护身。飞刀、侍婢、刀光均为程序化过渡（侍婢暂借蜀军刀兵行走图染红）。

/** 环绕飞刀数：Lv1–2 两把、Lv3–4 三把、Lv5 四把。 */
export const sunOrbitKnives = (level: number): number => (level >= 5 ? 4 : level >= 3 ? 3 : 2);
export const SUN_KNIVES_DEF = {
  id: 'sun_knives' as const, name: '弓腰姬飞刀', maxLevel: 5,
  /** 掷刀伤害；环绕割伤用 sunOrbitDamage。 */
  damage: (level: number, stats: PlayerStats) => [18, 20, 23, 26, 30][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [.9, .9, .85, .8, .75][lv(level)] * stats.cooldownMul,
  desc: '身边环绕飞刀割伤近敌，并不断掷出飞刀穿透远敌；移动中掷得更快',
};
export const sunOrbitDamage = (level: number, stats: PlayerStats): number => [10, 11, 12, 13, 15][lv(level)] * stats.damageMul * stats.meleeMul;

interface OrbitKnife { img: Phaser.GameObjects.Image; readyAt: number; }
interface ThrownKnife { img: Phaser.GameObjects.Image; vx: number; vy: number; left: number; pierce: number; hit: Set<number>; damage: number; }
interface Maid { img: Phaser.GameObjects.Image; until: number; angle: number; nextSlash: number; }
interface SunState { orbit: OrbitKnife[]; thrown: ThrownKnife[]; maids: Maid[]; spin: number; orbitHit: Map<number, number>; }
const SUN = new WeakMap<Player, SunState>();
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;

/** 程序化飞刀贴图（过渡）：银白刀身 + 赤红刀柄缠布。 */
function ensureKnifeTexture(host: WeaponHost): string {
  if (sceneOf(host).textures.exists('sun_knife')) return 'sun_knife'; // 正式飞刀贴图（2026-11-16 ChatGPT）
  const key = 'sun_knife_tex', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x7a1a14, 1).fillRect(0, 4, 8, 4);
  g.fillStyle(0xd8b060, 1).fillRect(8, 2, 2, 8);
  g.fillStyle(0xe8eef4, 1).fillTriangle(10, 2, 10, 10, 30, 6);
  g.lineStyle(1, 0x8a96a4, 1).lineBetween(11, 6, 28, 6);
  g.generateTexture(key, 32, 12); g.destroy();
  return key;
}

function sunState(host: WeaponHost): SunState {
  let s = SUN.get(host.player);
  if (!s) { s = { orbit: [], thrown: [], maids: [], spin: 0, orbitHit: new Map() }; SUN.set(host.player, s); }
  return s;
}

function summonMaids(host: WeaponHost, s: SunState, time: number, count: number, ms: number, cap: number): void {
  const pl = host.player, scene = sceneOf(host);
  for (let k = 0; k < count; k++) {
    if (s.maids.length >= cap) { const old = s.maids.shift()!; old.img.destroy(); }
    const angle = Math.random() * Math.PI * 2, x = pl.x + Math.cos(angle) * R.maidRange, y = pl.y + Math.sin(angle) * R.maidRange;
    // 正式执刀侍婢行走图（sun_maid_walk）；缺图时借蜀军刀兵染红过渡
    const img = scene.textures.exists('sun_maid_walk') ? host.add.image(x, y, 'sun_maid_walk', 'down_0')
      : scene.textures.exists('shu_swordsman_walk_sheet') ? host.add.image(x, y, 'shu_swordsman_walk_sheet', 'down_0').setTint(0xff9a8a)
      : host.add.image(x, y, ensureKnifeTexture(host)).setTint(0xff9a8a);
    img.setScale(46 / Math.max(1, img.height)).setDepth(39).setName('sun-maid');
    s.maids.push({ img, until: time + ms, angle, nextSlash: time + 200 });
    // 召唤刀光（过渡）
    const ring = host.add.circle(x, y, 8, 0xff6a5a, 0).setStrokeStyle(3, 0xffc0a0, .9).setDepth(41);
    ring.scene.tweens.add({ targets: ring, radius: 40, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }
}

export function sunKnivesBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = sunState(host), growth = pl.growth, level = weapon.level, tex = ensureKnifeTexture(host);
  // 环绕刀数随等级补齐
  const want = sunOrbitKnives(level);
  while (s.orbit.length < want) s.orbit.push({ img: host.add.image(pl.x, pl.y, tex).setDisplaySize(30, 14).setDepth(40).setName('sun-orbit-knife'), readyAt: time });
  s.spin += dt * 3.2;
  const orbitDamage = sunOrbitDamage(level, pl.stats) * growth.damageMultiplier(time);
  s.orbit.forEach((k, i) => {
    const a = s.spin + i * Math.PI * 2 / s.orbit.length, x = pl.x + Math.cos(a) * R.knifeOrbitR, y = pl.y - 6 + Math.sin(a) * R.knifeOrbitR * .8;
    const ready = time >= k.readyAt;
    k.img.setPosition(x, y).setRotation(a + Math.PI / 2).setVisible(pl.alive).setAlpha(ready ? 1 : Math.max(.15, 1 - (k.readyAt - time) / R.knifeRegenMs));
    if (!pl.alive) return;
    // 掷出后正在补刀的那一把也照样割伤（50%）：否则掷刀节奏（≤0.9 秒）与补刀（1.2 秒）、环绕周期（约 2 秒）
    // 会对上相位，经过某个贴身敌人的总是“空位”，近身防守时有时无（2026-11-16 回归发现）
    for (const e of host.grid.query(x, y, 40)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - x, e.y - y) > 12 + e.radius) continue;
      if ((s.orbitHit.get(e.spawnId) ?? 0) > time) continue;
      s.orbitHit.set(e.spawnId, time + R.knifeOrbitHitMs);
      host.hitEnemy(e, orbitDamage * (ready ? 1 : .5), time, 'melee');
    }
  });
  if (s.orbitHit.size > 300) for (const [id, t] of s.orbitHit) if (t <= time) s.orbitHit.delete(id);
  // 掷出的飞刀：直线飞行、穿透，不飞回
  for (let i = s.thrown.length - 1; i >= 0; i--) {
    const k = s.thrown[i], step = Math.hypot(k.vx, k.vy) * dt;
    k.img.x += k.vx * dt; k.img.y += k.vy * dt; k.left -= step;
    for (const e of host.grid.query(k.img.x, k.img.y, 40)) {
      if (k.pierce <= 0) break;
      if (!e.active || e.isSupplySlot || k.hit.has(e.spawnId) || Math.hypot(e.x - k.img.x, e.y - k.img.y) > 10 + e.radius) continue;
      k.hit.add(e.spawnId); k.pierce--; host.hitEnemy(e, k.damage, time, 'arrow');
    }
    if (k.left <= 0 || k.pierce <= 0 || host.over) { k.img.destroy(); s.thrown.splice(i, 1); }
  }
  // 侍婢：绕身护卫，近敌挥刀
  const maidDamage = SUN_KNIVES_DEF.damage(level, pl.stats) * growth.damageMultiplier(time) * R.maidDamageMul;
  for (let i = s.maids.length - 1; i >= 0; i--) {
    const m = s.maids[i];
    if (time >= m.until || host.over) { m.img.scene.tweens.add({ targets: m.img, alpha: 0, duration: 200, onComplete: () => m.img.destroy() }); s.maids.splice(i, 1); continue; }
    m.angle += dt * 1.6;
    const tx = pl.x + Math.cos(m.angle) * R.maidRange, ty = pl.y + Math.sin(m.angle) * R.maidRange * .8;
    const mvx = (tx - m.img.x) * Math.min(1, dt * 6), mvy = (ty - m.img.y) * Math.min(1, dt * 6); m.img.x += mvx; m.img.y += mvy;
    if (m.img.texture.key === 'sun_maid_walk') { const dir = Math.abs(mvx) > Math.abs(mvy) ? (mvx < 0 ? 'left' : 'right') : (mvy < 0 ? 'up' : 'down'); m.img.setFrame(`${dir}_${Math.floor(time / 140) % 4}`); }
    if (time < m.nextSlash) continue;
    let best: Enemy | null = null, bd: number = R.maidRange;
    for (const e of host.grid.query(m.img.x, m.img.y, R.maidRange)) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - m.img.x, e.y - m.img.y); if (d < bd) { bd = d; best = e; } }
    if (!best) continue;
    m.nextSlash = time + R.maidSlashMs; m.img.setFlipX(best.x < m.img.x);
    host.hitEnemy(best, maidDamage, time, 'melee');
    const a = Math.atan2(best.y - m.img.y, best.x - m.img.x), arc = host.add.graphics().setDepth(41);
    arc.lineStyle(3, 0xffe0c0, .95).beginPath().arc(m.img.x, m.img.y, 26, a - .8, a + .8).strokePath();
    arc.scene.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
  }
  // 掷刀
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  // 掷刀优先打环绕刀够不着的敌人（环外最近者），环内的交给环绕刀；环外没有敌人时才打最近的
  const outer = R.knifeOrbitR + 30;
  // 统一索敌：环外（首领 > 精锐 > 群怪 > 最近），环外没有敌人时才打环内
  const target = smartTarget(host, R.knifeRange, outer) ?? smartTarget(host, R.knifeRange);
  if (!target) return;
  const knife = s.orbit.find(k => time >= k.readyAt);
  if (!knife) { weapon.cooldownLeft = .1; return; }
  const cast = pl.passive.beginCast('sun_knives');
  const maidCap = R.maidMax + growth.masteries.baibi, maidMs = R.maidMs + 2000 * growth.masteries.baibi;
  if (cast.maids) { pl.playAction('skill', target.x < pl.x ? 'left' : 'right'); summonMaids(host, s, time, R.maidSummon, maidMs, maidCap); }
  else pl.playAction('attack', target.x < pl.x ? 'left' : 'right');
  pl.faceDirection(target.x < pl.x ? 'left' : 'right', 160);
  const moving = pl.passive.isMoving(time);
  const sx = knife.img.x, sy = knife.img.y, d = Math.hypot(target.x - sx, target.y - sy) || 1;
  knife.readyAt = time + R.knifeRegenMs;
  s.thrown.push({ img: host.add.image(sx, sy, tex).setDisplaySize(32, 15).setDepth(41).setRotation(Math.atan2(target.y - sy, target.x - sx)).setName('sun-thrown-knife'),
    vx: (target.x - sx) / d * R.knifeSpeed, vy: (target.y - sy) / d * R.knifeSpeed, left: R.knifeRange + 40,
    pierce: R.knifePierce + (moving ? growth.masteries.huishen : 0), hit: new Set(), damage: SUN_KNIVES_DEF.damage(level, pl.stats) * growth.damageMultiplier(time) });
  host.sfx.play('allySpear');
  weapon.cooldownLeft = Math.max(.2, SUN_KNIVES_DEF.cooldown(level, pl.stats) * (moving ? R.knifeMovingCdMul : 1) / growth.attackSpeedMultiplier(time));
}
/** 测试用：环绕刀 / 在飞的刀 / 侍婢数量。 */
export function sunKnifeStats(p: Player): { orbit: number; ready: number; thrown: number; maids: number } {
  const s = SUN.get(p); const now = (p.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? 0;
  return { orbit: s?.orbit.length ?? 0, ready: s?.orbit.filter(k => now >= k.readyAt).length ?? 0, thrown: s?.thrown.length ?? 0, maids: s?.maids.length ?? 0 };
}

// ───────────────────────── 貂蝉 · 双花扇 ─────────────────────────
// 回旋飞扇：掷出 230 像素后飞回手上，去程、回程各能打中同一敌人一次；命中加魅惑，满层倒戈（离间）。
// 被动满层「闭月」：舞带环身旋舞 2 秒，圈内持续伤害并令敌人倒戈。飞扇、魅惑标记、舞带均为程序化过渡。

/** 同时掷出的扇子数：Lv1–2 一柄、Lv3–4 两柄、Lv5 三柄（霓裳 3 级再 +1）。 */
export const diaochanFanCount = (level: number): number => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const DIAOCHAN_FANS_DEF = {
  id: 'diaochan_fans' as const, name: '双花扇', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [20, 23, 26, 29, 33][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [1.2, 1.2, 1.15, 1.1, 1.05][lv(level)] * stats.cooldownMul,
  desc: '掷出回旋团扇，去回各打一次；命中积魅惑，满层的敌人倒戈攻击同伴',
};
interface Fan { img: Phaser.GameObjects.Image; ox: number; oy: number; ex: number; ey: number; back: boolean; t: number; outHit: Set<number>; backHit: Set<number>; damage: number; }
interface DiaoState { fans: Fan[]; marks: Map<number, Phaser.GameObjects.Text | Phaser.GameObjects.Image>; danceUntil: number; nextTick: number; ribbon?: Phaser.GameObjects.Graphics; }
const DIAO = new WeakMap<Player, DiaoState>();

/** 程序化团扇贴图（过渡）：粉色扇面 + 金色扇骨。 */
function ensureFanTexture(host: WeaponHost): string {
  if (sceneOf(host).textures.exists('diaochan_fan')) return 'diaochan_fan'; // 正式团扇贴图
  const key = 'diaochan_fan_tex', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffd6ec, 1).slice(16, 20, 15, Math.PI * 1.1, Math.PI * 1.9, false).fillPath();
  g.lineStyle(2, 0xe2b04a, 1); for (let k = 0; k <= 4; k++) { const a = Math.PI * (1.1 + .2 * k); g.lineBetween(16, 20, 16 + Math.cos(a) * 15, 20 + Math.sin(a) * 15); }
  g.fillStyle(0xff7ab8, 1).fillCircle(16, 12, 3);
  g.generateTexture(key, 32, 24); g.destroy();
  return key;
}

function diaoState(host: WeaponHost): DiaoState {
  let s = DIAO.get(host.player);
  if (!s) { s = { fans: [], marks: new Map(), danceUntil: 0, nextTick: 0 }; DIAO.set(host.player, s); }
  return s;
}

function fanHit(host: WeaponHost, e: Enemy, damage: number, time: number): void {
  const g = host.player.growth, need = g.masteries.meirenji >= 3 ? 2 : R.charmNeed, ms = R.turnMs + 500 * g.masteries.meirenji;
  host.hitEnemy(e, damage, time, 'arrow');
  if (host.player.passive.addCharm(e, time, need, ms)) {
    const t = host.add.text(e.x, e.y - e.radius - 30, '离间', { fontFamily: 'serif', fontSize: '15px', color: '#ffd0ec', stroke: '#6a1a4a', strokeThickness: 4 }).setOrigin(.5).setDepth(60);
    t.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }
}

export function diaochanFansBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = diaoState(host), growth = pl.growth, level = weapon.level, tex = ensureFanTexture(host);
  const damage = DIAOCHAN_FANS_DEF.damage(level, pl.stats) * growth.damageMultiplier(time);
  // 魅惑 / 倒戈标记（粉心 = 魅惑层数；「乱」= 倒戈中）
  const seen = new Set<number>();
  for (const c of pl.passive.charmViews()) {
    const e = c.enemy; if (!e.active || e.spawnId !== c.spawnId) continue;
    const turned = c.turnedUntil > time, label = turned ? '乱' : c.marks ? '♥'.repeat(c.marks) : c.vulnUntil > time ? '惑' : '';
    if (!label) continue;
    seen.add(e.uid);
    let t = s.marks.get(e.uid);
    if (sceneOf(host).textures.exists('charm_heart')) {
      // 正式标记：粉心（魅惑层数越多越大）/ 断锁链（倒戈中）/ 首领易伤用半透明粉心
      const key = turned ? 'charm_broken' : 'charm_heart', size = turned ? 22 : c.marks ? 11 + 4 * c.marks : 14;
      if (!t || t.type !== 'Image') { t?.destroy(); t = host.add.image(e.x, e.y, key).setDepth(60).setName('diaochan-mark'); s.marks.set(e.uid, t); }
      (t as Phaser.GameObjects.Image).setTexture(key).setDisplaySize(size, size).setAlpha(!turned && !c.marks ? .6 : 1).setPosition(e.x, e.y - e.radius - 24);
    } else {
      if (!t) { t = host.add.text(e.x, e.y, '', { fontFamily: 'serif', fontSize: '13px', color: '#ff8fd0', stroke: '#3a0a24', strokeThickness: 3 }).setOrigin(.5).setDepth(60).setName('diaochan-mark'); s.marks.set(e.uid, t); }
      (t as Phaser.GameObjects.Text).setText(label).setColor(turned ? '#ffe0f4' : '#ff8fd0').setPosition(e.x, e.y - e.radius - 22);
    }
  }
  for (const [uid, t] of s.marks) if (!seen.has(uid)) { t.destroy(); s.marks.delete(uid); }
  // 回旋飞扇
  for (let i = s.fans.length - 1; i >= 0; i--) {
    const f = s.fans[i]; f.img.rotation += dt * 14;
    if (!f.back) {
      f.t += dt * R.fanSpeed / Math.max(1, Math.hypot(f.ex - f.ox, f.ey - f.oy));
      const k = Math.min(1, f.t); f.img.setPosition(f.ox + (f.ex - f.ox) * k, f.oy + (f.ey - f.oy) * k);
      if (f.t >= 1) f.back = true;
    } else {
      const dx = pl.x - f.img.x, dy = pl.y - 8 - f.img.y, d = Math.hypot(dx, dy);
      if (d < 18 || host.over) { f.img.destroy(); s.fans.splice(i, 1); continue; }
      const step = Math.min(d, R.fanSpeed * 1.1 * dt); f.img.x += dx / d * step; f.img.y += dy / d * step;
    }
    const hits = f.back ? f.backHit : f.outHit;
    for (const e of host.grid.query(f.img.x, f.img.y, 50)) {
      if (!e.active || e.isSupplySlot || hits.has(e.spawnId) || Math.hypot(e.x - f.img.x, e.y - f.img.y) > 16 + e.radius) continue;
      hits.add(e.spawnId); fanHit(host, e, f.damage, time);
    }
  }
  // 闭月：舞带环身旋舞
  if (time < s.danceUntil) {
    if (s.ribbon) { s.ribbon.clear(); const a0 = time / 180; s.ribbon.setPosition(pl.x, pl.y - 6);
      for (let k = 0; k < 3; k++) { const a = a0 + k * Math.PI * 2 / 3; s.ribbon.lineStyle(6 - k, k % 2 ? 0xe9a6ff : 0xffc6ec, .85).beginPath().arc(0, 0, R.moonRadius * (.55 + .15 * k), a, a + 1.6).strokePath(); } }
    if (time >= s.nextTick) {
      s.nextTick = time + R.moonTickMs;
      const turnMs = R.turnMs + 500 * growth.masteries.meirenji;
      for (const e of host.grid.query(pl.x, pl.y, R.moonRadius + 30)) {
        if (!e.active || e.isSupplySlot || Math.hypot(e.x - pl.x, e.y - pl.y) > R.moonRadius + e.radius) continue;
        host.hitEnemy(e, damage * R.moonDamageMul, time, 'arrow'); pl.passive.forceTurn(e, time, turnMs);
      }
    }
    return;
  }
  if (s.ribbon) { s.ribbon.destroy(); s.ribbon = undefined; }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const range = R.fanRange * (1 + .15 * growth.masteries.nichang);
  const target = smartTarget(host, range + 60);
  if (!target) return;
  const cast = pl.passive.beginCast('diaochan_fans');
  pl.faceDirection(target.x < pl.x ? 'left' : 'right', 200);
  if (cast.moonDance) {
    pl.playAction('skill', target.x < pl.x ? 'left' : 'right');
    s.danceUntil = time + R.moonMs; s.nextTick = time;
    s.ribbon = host.add.graphics().setDepth(41).setName('diaochan-moon');
    host.heroFx?.(sceneOf(host).textures.exists('hero_fx_d') ? 'moonDance' : 'charm', pl.x, pl.y - 6, R.moonRadius * 2.4); // 闭月正式序列帧（fx_d 第 1 行），缺图用倾城花瓣旋涡
    weapon.cooldownLeft = R.moonMs / 1000;
    return;
  }
  pl.playAction('attack', target.x < pl.x ? 'left' : 'right');
  const n = diaochanFanCount(level) + (growth.masteries.nichang >= 3 ? 1 : 0), a0 = Math.atan2(target.y - pl.y, target.x - pl.x), spread = 25 * Math.PI / 180;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k - (n - 1) / 2) * spread, ox = pl.x, oy = pl.y - 8;
    s.fans.push({ img: host.add.image(ox, oy, tex).setDisplaySize(30, 30).setDepth(41).setName('diaochan-fan'), ox, oy, ex: ox + Math.cos(a) * range, ey: oy + Math.sin(a) * range, back: false, t: 0, outHit: new Set(), backHit: new Set(), damage });
  }
  host.sfx.play('allySlash');
  weapon.cooldownLeft = Math.max(.25, DIAOCHAN_FANS_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}
