import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { PASSIVE_RULES as R } from '../data/passives';
import type { WeaponHost } from './registry';

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

/** 每次布雷枚数：Lv1–2 一枚、Lv3–4 两枚、Lv5 三枚。 */
export const lianhuanMinesPerCast = (level: number): number => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const LIANHUAN_DEF = {
  id: 'lianhuan_mines' as const, name: '凤雏连环令', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => 26 * (1 + .18 * (level - 1)) * stats.damageMul * stats.fireMul,
  cooldown: (level: number, stats: PlayerStats) => (1.4 * stats.cooldownMul) / (1 + .05 * (level - 1)),
  desc: '挥令旗在敌人来路布下火雷，踩中引爆，附近火雷连环引爆',
};
const mineRadius = (level: number) => R.mineRadius * (1 + .05 * (level - 1));

interface Mine { x: number; y: number; armAt: number; until: number; body: Phaser.GameObjects.Container; lit: boolean; ring?: RingGroup; }
interface RingGroup { x: number; y: number; fuseAt: number; mines: Mine[]; links: Phaser.GameObjects.Container; fired: boolean; }
interface Chain { count: number; awarded: boolean; }
interface MineState { mines: Mine[]; rings: RingGroup[]; fengpoReadyAt: number; }
const STATE = new WeakMap<Player, MineState>();
const stateOf = (p: Player): MineState => { let s = STATE.get(p); if (!s) { s = { mines: [], rings: [], fengpoReadyAt: 0 }; STATE.set(p, s); } return s; };

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
  pl.faceDirection(foes[0].x < pl.x ? 'left' : 'right', 200);
  host.spawnFlagSwingFx(Math.sign(foes[0].x - pl.x) || 1, 0);
  host.sfx.play('flameSwing');
  if (cast.formation) {
    // 火烧连环：身边一圈 6 枚火雷，以锁链连成环
    pl.playAction('skill', foes[0].x < pl.x ? 'left' : 'right');
    const g: RingGroup = { x: pl.x, y: pl.y, fuseAt: time + R.ringFuseMs, mines: [], links: host.add.container(0, 0).setDepth(19.5).setName('pangtong-ring'), fired: false };
    for (let k = 0; k < R.ringMines; k++) { const a = k * Math.PI * 2 / R.ringMines; g.mines.push(placeMine(host, s, pl.x + Math.cos(a) * R.ringRadius, pl.y + Math.sin(a) * R.ringRadius, time, R.ringFuseMs + 500, g)); }
    for (let k = 0; k < R.ringMines; k++) linkFx(host, g.mines[k], g.mines[(k + 1) % R.ringMines], g.links);
    s.rings.push(g);
  } else {
    pl.playAction('attack', foes[0].x < pl.x ? 'left' : 'right');
    // 布在敌人来路上：自己与目标之间约 60% 处；多枚时分给不同的近敌
    const n = lianhuanMinesPerCast(level);
    for (let k = 0; k < n; k++) {
      const t = foes[k % foes.length], spread = k >= foes.length ? (k % 2 ? 1 : -1) * 28 : 0;
      const x = pl.x + (t.x - pl.x) * .6 + spread, y = pl.y + (t.y - pl.y) * .6 + spread;
      while (s.mines.filter(m => !m.ring).length >= max) { const old = s.mines.find(m => !m.ring && !m.lit); if (!old) break; explode(host, s, old, damage, radius, { count: 0, awarded: false }, chainRange, false, time); }
      placeMine(host, s, x, y, time, life);
    }
  }
  weapon.cooldownLeft = Math.max(.25, LIANHUAN_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}

/** 测试 / 调试用：当前场上火雷数。 */
export function lianhuanMineCount(p: Player): number { return STATE.get(p)?.mines.length ?? 0; }
