import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { GANNING as G } from '../data/ganning';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';
/** 2026-11-20 平衡（P3 复核）：一条条火线叠在首领身上不叠加——同一首领每 fire.tickMs 只被火线烧一次。 */
const BOSS_FIRE_AT = new WeakMap<object, number>();

/**
 * 甘宁 · 锦帆铁索钩（P3 第二批可玩武将，数值 data/ganning.ts）：甩钩 → 钩线上的敌兵吃伤害并被拉到身边 → 原地横扫；每第 3 钩铁索烧红沿索留火。
 * 被动「锦帆」：被钩过的敌兵被击杀攒量（GameScene 击杀时 CharacterPassives.p3Gain），满了「百骑劫营」（本文件开启：移速、每钩都烧红）。
 * 分支「夜袭点火」：每钩都烧红，着火的敌兵被拉来时爆燃；「百骑劫魏营」：改为甘宁顺着铁索扑过去，落地横扫。
 * 特效全部借现成手绘序列帧 / 图：铁索 pangtong_chain、烧红铁索 pangtong_chain_hot（庞统）、火 fx_zy_field（周瑜）、横扫 fx_lvbu_sweep（吕布）、
 * 冲刺 fx_flank_streak、落地 fx_windstep_burst；缺图时不画替代图形（伤害照算）。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const GANNING_DEF = {
  id: 'jinfan_gou' as const, name: '锦帆铁索钩', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [16, 18, 21, 24, 28][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.05, 1, .95, .9, .85][lv(level)] * stats.cooldownMul,
  desc: '朝敌群甩出铁索钩，钩中的敌兵拉到身边再横扫；每第 3 钩铁索烧红，沿索留火',
};
export const ganningReach = (level: number, tiesuo = 0): number => Math.round(G.reach[lv(level)] * (1 + G.tiesuo * tiesuo));
export const ganningSweepR = (level: number): number => G.sweepR[lv(level)];

interface Fire { x: number; y: number; r: number; until: number; next: number; dmg: number; img: Phaser.GameObjects.Image | null }
interface Pending { at: number; x: number; y: number; r: number; dmg: number; burst?: { r: number; dmg: number }; second?: boolean }
interface GnState { hooks: number; hot: number; pulled: number; dashes: number; sweeps: number; bursts: number; raids: number; fires: Fire[]; pending: Pending[]; movingSince: number; wasMoving: boolean }
const STATE = new WeakMap<Player, GnState>();
const state = (pl: Player): GnState => { let s = STATE.get(pl); if (!s) { s = { hooks: 0, hot: 0, pulled: 0, dashes: 0, sweeps: 0, bursts: 0, raids: 0, fires: [], pending: [], movingSince: -1, wasMoving: false }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function ganningDebug(pl: Player): { hooks: number; hot: number; pulled: number; dashes: number; sweeps: number; bursts: number; raids: number; fires: number } { const s = state(pl); return { hooks: s.hooks, hot: s.hot, pulled: s.pulled, dashes: s.dashes, sweeps: s.sweeps, bursts: s.bursts, raids: s.raids, fires: s.fires.length }; }

/** 点到线段距离。 */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/** 铁索：从主将甩到 (tx, ty) 再收回（手绘铁索图拉伸；烧红用庞统烧红铁索序列帧）。 */
function chainFx(host: WeaponHost, ax: number, ay: number, tx: number, ty: number, hot: boolean): void {
  const s = sceneOf(host), key = hot ? 'pangtong_chain_hot' : 'pangtong_chain'; if (!s.textures.exists(key)) return;
  const len = Math.hypot(tx - ax, ty - ay), rot = Math.atan2(ty - ay, tx - ax), h = hot ? 30 : 16;
  const img = host.add.image(ax, ay - 10, key, 0).setOrigin(0, .5).setRotation(rot).setDisplaySize(1, h).setDepth(42).setName('gn-chain');
  if (hot) img.setBlendMode(1);
  s.tweens.addCounter({ from: 0, to: 1, duration: 300, onUpdate: tw => { const t = tw.getValue() ?? 0, k = t < .45 ? t / .45 : 1 - (t - .45) / .55; img.setDisplaySize(Math.max(1, len * k), h).setPosition(host.player.x, host.player.y - 10); if (hot) img.setFrame(Math.floor(t * 12) % 6); }, onComplete: () => img.destroy() });
}

function sweep(host: WeaponHost, st: GnState, x: number, y: number, r: number, dmg: number, time: number, burst?: { r: number; dmg: number }): void {
  const s = sceneOf(host);
  for (const e of host.grid.query(x, y, r + 40)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - x, e.y - y) <= r + e.radius) host.hitEnemy(e, e.kind === 'boss' ? dmg * G.bossMul : dmg, time, 'melee');
  st.sweeps++;
  playSheet(s, 'fx_lvbu_sweep', x, y - 6, { size: r * 2.3, ms: 300, depth: 41, add: true, tint: 0xffc890, name: 'gn-sweep' });
  if (burst) {
    // 夜袭点火：拉来的敌兵里有着火的 → 主将身边爆燃
    for (const e of host.grid.query(x, y, burst.r + 40)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - x, e.y - y) <= burst.r + e.radius) { host.hitEnemy(e, burst.dmg, time, 'fire'); e.p3BurnUntil = time + G.fire.burnMarkMs; }
    st.bursts++;
    playSheet(s, 'fx_zy_blast', x, y - 10, { size: burst.r * 2.4, ms: 420, depth: 42, add: true, name: 'gn-burst' });
  }
  host.sfx.play('atk_guandao');
}

/** 沿铁索留火（每 step 像素一团，tickMs 一跳 fire 伤害，标记着火 burnMarkMs）。 */
function layFire(host: WeaponHost, st: GnState, ax: number, ay: number, bx: number, by: number, dmg: number, time: number, durMul: number): void {
  const s = sceneOf(host), len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / G.fire.step));
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    const img = s.textures.exists('fx_zy_field') ? host.add.image(x, y, 'fx_zy_field', 0).setDisplaySize(G.fire.r * 2.6, G.fire.r * 2.6).setDepth(3).setAlpha(.85).setBlendMode(1).setName('gn-fire') : null;
    st.fires.push({ x, y, r: G.fire.r, until: time + G.fire.ms * durMul, next: time + G.fire.tickMs, dmg, img });
  }
}

export function ganningBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), s = sceneOf(host);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), yexi = branch === 'gn_yexi', jieying = branch === 'gn_jieying';
  const final = tier >= 3 && (g.build.tags()[yexi ? 'fire' : 'cavalry'] ?? 0) >= 4;
  pl.passive.p3Need = G.need;
  // 锦帆：量表满 → 百骑劫营
  if (pl.passive.takeP3()) { pl.passive.startP3(time, G.raidMs, G.raidSpeed, 1); st.raids++; pl.playAction('skill', 'down'); } // 起手特效 / 音由 HeroCastFx 按被动触发计数自动放
  const raid = pl.passive.p3Active(time);
  // 铃响：记持续移动
  const moving = Math.hypot(pl.moveInput.x, pl.moveInput.y) > .1;
  if (moving && !st.wasMoving) st.movingSince = time; if (!moving) st.movingSince = -1; st.wasMoving = moving;
  // 火：每跳伤害、标记着火
  for (const f of st.fires) {
    f.img?.setFrame(Math.floor(time / 90) % 6).setAlpha(Math.min(.85, (f.until - time) / 400));
    if (time >= f.next) { f.next += G.fire.tickMs; for (const e of host.grid.query(f.x, f.y, f.r + 30)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - f.x, e.y - f.y) <= f.r + e.radius) { if (e.kind === 'boss') { if (time - (BOSS_FIRE_AT.get(e) ?? -1e9) < G.fire.tickMs) continue; BOSS_FIRE_AT.set(e, time); } host.hitEnemy(e, f.dmg, time, 'fire'); e.p3BurnUntil = time + G.fire.burnMarkMs; } }
  }
  for (const f of st.fires) if (time >= f.until) f.img?.destroy();
  st.fires = st.fires.filter(f => time < f.until);
  // 延后的横扫（拉过来 / 扑过去之后）
  for (const p of st.pending) if (time >= p.at) sweep(host, st, p.second ? pl.x : p.x, p.second ? pl.y : p.y, p.r, p.dmg, time, p.burst);
  st.pending = st.pending.filter(p => time < p.at);

  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const reach = ganningReach(weapon.level, g.masteries.tiesuo ?? 0) * pl.passive.rangeMultiplier('jinfan_gou');
  const target = smartTarget(host, Math.min(G.range * reach / G.reach[0], reach));
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, len = Math.min(reach, d + 30);
  const ax = pl.x, ay = pl.y, bx = pl.x + ux * len, by = pl.y + uy * len;
  const ling = st.movingSince >= 0 && time - st.movingSince >= G.lingMoveMs ? 1 + G.ling * (g.masteries.lingxiang ?? 0) : 1;
  const base = GANNING_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * ling, kk = yexi || jieying ? k : 1;
  st.hooks++;
  const hot = yexi || raid || st.hooks % G.hotEvery === 0; if (hot) st.hot++;
  chainFx(host, ax, ay, bx, by, hot);
  pl.faceDirection(cardinal(ux, uy), 240); pl.playAction('attack', cardinal(ux, uy)); host.sfx.play('atk_spear');
  let burning = false;
  for (const e of host.grid.query((ax + bx) / 2, (ay + by) / 2, len / 2 + G.width + 30)) {
    if (!e.active || e.isSupplySlot || e.def.behavior === 'wall' || segDist(e.x, e.y, ax, ay, bx, by) > G.width / 2 + e.radius) continue;
    if (e.p3BurnUntil > time) burning = true;
    host.hitEnemy(e, base * G.hookMul * kk * (e.kind === 'boss' ? G.bossMul : 1), time, 'melee'); if (!e.active) continue;
    e.hookedUntil = time + G.hookMarkMs;
    if (!jieying && e.kind !== 'boss' && !e.controlImmune) { const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey) || 1, pull = Math.max(0, ed - G.pullStop); host.knockEnemy?.(e, -ex / ed * pull, -ey / ed * pull, G.pullMs); st.pulled++; }
  }
  const fireMul = yexi && final ? G.yexi.finalFireMul : 1;
  if (hot) layFire(host, st, ax + ux * 40, ay + uy * 40, bx, by, base * G.fire.mul * kk, time, fireMul);
  const r = ganningSweepR(weapon.level) * pl.passive.rangeMultiplier('jinfan_gou');
  if (jieying) {
    // 百骑劫魏营：顺着铁索扑过去（无敌），落地横扫；进阶再扫一次
    const to = Math.max(0, len - 40);
    pl.knockUp(time, G.jieying.dashMs, ux * to, uy * to, true); pl.invulnUntil = Math.max(pl.invulnUntil, time + G.jieying.invulnMs); st.dashes++;
    playSheet(s, 'fx_flank_streak', ax + ux * to / 2, ay + uy * to / 2 - 6, { size: to + 60, sizeH: 70, ms: 260, depth: 41, add: true, rotation: Math.atan2(uy, ux), tint: 0xffd0a0, name: 'gn-dash' });
    const lx = ax + ux * to, ly = ay + uy * to;
    st.pending.push({ at: time + G.jieying.dashMs + 10, x: lx, y: ly, r: r * G.jieying.rMul, dmg: base * G.sweepMul * k });
    if (final) st.pending.push({ at: time + G.jieying.dashMs + G.jieying.secondDelayMs, x: lx, y: ly, r: r * G.jieying.rMul, dmg: base * G.sweepMul * k, second: true });
    playSheet(s, 'fx_windstep_burst', lx, ly + 6, { size: r * 2, ms: 380, depth: 40, add: true, name: 'gn-land' });
  } else {
    const burst = yexi && burning ? { r: G.yexi.r * (final ? G.yexi.finalRMul : 1), dmg: base * G.yexi.mul * k } : undefined;
    st.pending.push({ at: time + G.pullMs + 20, x: pl.x, y: pl.y, r, dmg: base * G.sweepMul * kk, burst, second: true });
  }
  weapon.cooldownLeft = Math.max(.3, GANNING_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
