import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { SUNQUAN as Q, SUNQUAN_STANCES } from '../data/sunquan';
import { meleeTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 孙权 · 古锭刀 · 令箭（P3 第二批可玩武将，数值 data/sunquan.ts）：近身扇形刀斩，每第 4 斩令江东弓手朝最密处齐射。
 * 被动「制衡」：击杀攒量（GameScene → CharacterPassives.p3Gain），满了切下一阵势（守 → 攻 → 疾），阵势一直生效到下次切换
 * （守势受伤减免与疾势移速走 CharacterPassives.startP3 的长效状态；部曲回血、齐射频率 / 伤害、出手间隔在本文件）。
 * 分支「坐断东南」：阵势效果加倍、切阵时部曲护盾；「江东弓弩」：齐射更大更勤、落点减速。
 * 特效全借现成手绘：刀光 fx_md_slash（换青）、齐射 fx_awaken_archery、阵势 fx_awaken_formation / archery / cavalry；缺图不画替代图形。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
const FOREVER = 1e12;

export const SUNQUAN_DEF = {
  id: 'guding_dao' as const, name: '古锭刀 · 令箭', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [20, 23, 26, 30, 35][lv(level)] /* 2026-11-20 平衡（P3 复核）：原 [16, 18, 21, 24, 28]，整局 DPS 约平均的 0.7、首领用时 1.89 倍中位数，+25% */ * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [.8, .76, .72, .68, .64][lv(level)] * stats.cooldownMul,
  desc: '近身扇形刀斩，每第 4 斩令江东弓手朝最密处齐射',
};
export const sunquanReach = (level: number, ziran = 0): number => Math.round(Q.reach[lv(level)] * (1 + Q.ziran * ziran));

interface Volley { at: number; x: number; y: number; r: number; dmg: number; slow: boolean }
interface Slow { x: number; y: number; r: number; until: number }
interface SqState { slashes: number; volleys: number; landed: number; switches: number; stance: number; stanceSet: boolean; pending: Volley[]; slows: Slow[]; healAcc: number }
const STATE = new WeakMap<Player, SqState>();
const state = (pl: Player): SqState => { let s = STATE.get(pl); if (!s) { s = { slashes: 0, volleys: 0, landed: 0, switches: 0, stance: 0, stanceSet: false, pending: [], slows: [], healAcc: 0 }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function sunquanDebug(pl: Player): { slashes: number; volleys: number; landed: number; switches: number; stance: string; pending: number; slows: number } { const s = state(pl); return { slashes: s.slashes, volleys: s.volleys, landed: s.landed, switches: s.switches, stance: SUNQUAN_STANCES[s.stance], pending: s.pending.length, slows: s.slows.length }; }
/** 测试 / 开发：直接设阵势（0 守 / 1 攻 / 2 疾）。 */
export function sunquanSetStance(pl: Player, i: number): void { const s = state(pl); s.stance = ((i % 3) + 3) % 3; s.stanceSet = false; }

/** 最密处：射程内敌兵里，身边 100 内同伴最多的那个。 */
function densest(host: WeaponHost, range: number): Enemy | null {
  const pl = host.player; let best: Enemy | null = null, bestN = -1;
  for (const e of host.grid.query(pl.x, pl.y, range)) { if (!e.active || e.isSupplySlot || e.def.behavior === 'wall' || Math.hypot(e.x - pl.x, e.y - pl.y) > range) continue; let n = 0; for (const o of host.grid.query(e.x, e.y, 100)) if (o.active && !o.isSupplySlot) n++; if (n > bestN) { bestN = n; best = e; } }
  return best;
}

function orderVolley(host: WeaponHost, st: SqState, time: number, dmg: number, r: number, slow: boolean, rounds: number, gapMs: number): void {
  const t = densest(host, Q.volleyRange); if (!t) return;
  for (let i = 0; i < rounds; i++) st.pending.push({ at: time + Q.volleyDelayMs + i * gapMs, x: t.x, y: t.y, r, dmg, slow });
  st.volleys++; host.sfx.play('atk_bow');
}

export function sunquanBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), s = sceneOf(host);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), zuoduan = branch === 'sq_zuoduan', gongnu = branch === 'sq_gongnu';
  const final = tier >= 3 && (g.build.tags()[zuoduan ? 'formation' : 'archery'] ?? 0) >= 4;
  pl.passive.p3Need = Q.need;
  const S = Q.stance, amp = (v: number): number => zuoduan ? 1 + (v - 1) * 2 * k : v; // 坐断东南：效果加倍（专职等级再乘 k）
  const base = SUNQUAN_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time);
  const vR = Q.volleyR * (gongnu ? Q.gongnu.rMul : 1), vDmg = base * Q.volleyMul * (1 + Q.biyan * (g.masteries.biyan ?? 0)) * (gongnu ? k : 1) * (st.stance === 1 ? amp(S.atkMul) : 1);
  // 制衡：量表满 → 下一阵势
  if (pl.passive.takeP3()) {
    st.stance = (st.stance + 1) % 3; st.stanceSet = false; st.switches++;
    if (zuoduan) { host.shieldAllies?.(pl.x - 1, pl.y, pl.x + 1, pl.y, Q.zuoduan.r, Q.zuoduan.shield * k, time + Q.zuoduan.shieldMs); if (final) orderVolley(host, st, time, vDmg, vR, false, 1, 0); }
    playSheet(s, ['fx_awaken_formation', 'fx_awaken_archery', 'fx_awaken_cavalry'][st.stance], pl.x, pl.y - 20, { size: 230, ms: 800, depth: 41, add: true, name: 'sq-stance' });
    pl.playAction('skill', 'down');
  }
  if (!st.stanceSet || !pl.passive.p3Active(time)) { // 守势减伤 / 疾势移速：长效状态，换阵势时改写（被动重置后补上）
    st.stanceSet = true;
    pl.passive.startP3(time, FOREVER, st.stance === 2 ? amp(S.speed) : 1, st.stance === 0 ? 1 - (1 - S.guard) * (zuoduan ? 2 * k : 1) : 1);
    pl.passive.p3StanceName = SUNQUAN_STANCES[st.stance];
  }
  if (st.stance === 0) { st.healAcc += dt; if (st.healAcc >= 1) { st.healAcc -= 1; host.healAlliesIn?.(pl.x, pl.y, Q.zuoduan.r, S.heal * (zuoduan ? 2 * k : 1)); } }
  // 齐射落地 / 减速区
  for (const v of st.pending) if (time >= v.at) {
    for (const e of host.grid.query(v.x, v.y, v.r + 40)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - v.x, e.y - v.y) <= v.r + e.radius) host.hitEnemy(e, v.dmg, time, 'arrow');
    playSheet(s, 'fx_awaken_archery', v.x, v.y - 10, { size: v.r * 2.4, ms: 480, depth: 41, add: true, name: 'sq-volley' }); st.landed++;
    if (v.slow) st.slows.push({ x: v.x, y: v.y, r: v.r, until: time + Q.gongnu.slowMs });
  }
  st.pending = st.pending.filter(v => time < v.at);
  for (const z of st.slows) for (const e of host.grid.query(z.x, z.y, z.r + 30)) {
    if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.radius) continue;
    e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - Q.gongnu.slow); e.martialSlowUntil = time + 120;
  }
  st.slows = st.slows.filter(z => time < z.until);

  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const reach = sunquanReach(weapon.level, g.masteries.ziran ?? 0) * pl.passive.rangeMultiplier('guding_dao');
  const target = meleeTarget(host, reach); // 只挑刀够得着的（smartTarget 挑的最密处可能刚好够不着，整把刀卡住）
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, rot = Math.atan2(dy, dx);
  if (d > reach + target.radius + 10) return;
  for (const e of host.grid.query(pl.x, pl.y, reach + 40)) {
    if (!e.active || e.isSupplySlot) continue;
    const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey);
    if (ed > reach + e.radius) continue;
    if (ed > e.radius && Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - rot), Math.cos(Math.atan2(ey, ex) - rot))) > Q.arc) continue;
    host.hitEnemy(e, base * Q.slashMul, time, 'melee');
  }
  st.slashes++;
  playSheet(s, 'fx_md_slash', pl.x + Math.cos(rot) * reach * .45, pl.y - 8 + Math.sin(rot) * reach * .45, { size: reach * 1.7, ms: 240, depth: 41, add: true, rotation: rot, tint: 0xa8e8b0, name: 'sq-slash' });
  pl.faceDirection(cardinal(dx / d, dy / d), 160); pl.playAction('attack', cardinal(dx / d, dy / d)); host.sfx.play('atk_guandao');
  const every = gongnu ? Q.gongnu.every : st.stance === 1 ? S.atkEvery : Q.volleyEvery;
  if (st.slashes % every === 0) orderVolley(host, st, time, vDmg, vR, gongnu, gongnu && final ? Q.gongnu.finalRounds : 1, Q.gongnu.roundGapMs);
  const haste = st.stance === 2 ? amp(S.haste) : 1;
  weapon.cooldownLeft = Math.max(.25, SUNQUAN_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time) / haste);
}
