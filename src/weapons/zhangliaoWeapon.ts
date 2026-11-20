import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { ZHANGLIAO as ZL } from '../data/zhangliao';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 张辽 · 破阵双戟（P2 第一批可玩武将，数值 data/zhangliao.ts）：左右戟交替的极快扇形连斩，每击叠「震慑」，叠满溃逃。
 * 溃逃的移动在 GameScene.updateEnemies（背向主将逃），受伤加成在 CharacterPassives.vulnerability，「止啼」攒量在 CharacterPassives.onRoutKill；
 * 本文件：连斩、震慑 / 溃逃、八百虎贲（被动满了召出）、两条分支（八百破十万 / 威震逍遥津）、武艺先登。
 * 特效：手绘序列帧 fx_zl_*（tools/build-zhangliao-fx.mjs 从 ChatGPT 黑底图切出），缺图时不画程序特效（伤害照算）。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const ZHANGLIAO_DEF = {
  id: 'pozhen_shuangji' as const, name: '破阵双戟', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [12, 13, 15, 18, 20][lv(level)] * stats.damageMul * stats.meleeMul, // 2026-11-20 平衡第一轮：原 [10, 11, 13, 15, 17]，首领用时为中位数的 1.4～2.6 倍（溃逃易伤打不到首领），伤害 +20%
  cooldown: (level: number, stats: PlayerStats) => [.42, .4, .38, .36, .33][lv(level)] * stats.cooldownMul,
  desc: '左右双戟极快连斩身前一扇；每击叠 1 层震慑，3 层的敌兵溃逃 2 秒（逃跑时受伤 +25%）',
};
export const zhangliaoReach = (level: number): number => ZL.reach[lv(level)];

interface Rider { img: Phaser.GameObjects.Image | null }
interface Huben { start: number; laps: number; n: number; a0: number; dmg: number; stun: number; hit: Map<string, true>; riders: Rider[] }
interface ZlState { acts: number; side: number; extra: number; dashAt: number; huben: Huben | null; summons: number; routs: number; marks: Map<Enemy, { img: Phaser.GameObjects.Image; life: number }> }
const STATE = new WeakMap<Player, ZlState>();
const state = (pl: Player): ZlState => { let s = STATE.get(pl); if (!s) { s = { acts: 0, side: 1, extra: 0, dashAt: 0, huben: null, summons: 0, routs: 0, marks: new Map() }; STATE.set(pl, s); } return s; };
/** 测试读：出手次数、召过几次虎贲、虎贲是否在场、溃逃过几个。 */
export function zhangliaoDebug(pl: Player): { acts: number; summons: number; hubenLive: boolean; routs: number } { const s = state(pl); return { acts: s.acts, summons: s.summons, hubenLive: !!s.huben, routs: s.routs }; }

/** 增益栏：八百虎贲还剩几毫秒（0 = 不在场）、总时长。 */
export function hubenLeft(pl: Player, now: number): { left: number; total: number } { const h = state(pl).huben; if (!h) return { left: 0, total: 1 }; const total = h.laps * ZL.huben.lapMs; return { left: Math.max(0, h.start + total - now), total }; }
/** 震慑层数门槛（武艺「威名」Lv1 起 2 层就溃逃）与溃逃时长。 */
function routRule(pl: Player): { need: number; ms: number } {
  const wm = pl.growth.masteries.weiming;
  return { need: ZL.rout - (wm > 0 ? 1 : 0), ms: ZL.routMs + ZL.weiming.extraMs[Math.max(0, Math.min(2, wm - 1))] * (wm > 0 ? 1 : 0) };
}
/** 让敌兵溃逃（首领 / 免控的不逃）；溃逃标记是手绘图 fx_zl_rout（跟着敌兵飘在头顶）。 */
function rout(host: WeaponHost, st: ZlState, e: Enemy, now: number, ms: number): boolean {
  if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || e.routUntil > now) return false;
  e.routUntil = now + ms; e.zhenshe = 0; st.routs++;
  const s = sceneOf(host);
  if (s.textures.exists('fx_zl_rout')) {
    const old = st.marks.get(e); old?.img.destroy();
    const img = host.add.image(e.x, e.y - e.radius - 26, 'fx_zl_rout', 0).setDisplaySize(58, 58).setDepth(43).setBlendMode(1).setName('zl-rout');
    st.marks.set(e, { img, life: e.spawnId });
  }
  return true;
}
/** 叠一层震慑；到门槛就溃逃（「威震逍遥津」溃逃传给身边敌兵，只传一层，不连锁）。 */
function shock(host: WeaponHost, st: ZlState, e: Enemy, now: number, xiaoyao: boolean): void {
  if (!e.active || e.isSupplySlot || e.routUntil > now) return;
  if (now - e.zhensheAt > ZL.stackMs) e.zhenshe = 0;
  e.zhensheAt = now; e.zhenshe++;
  const R = routRule(host.player);
  if (e.zhenshe < R.need) return;
  if (!rout(host, st, e, now, R.ms)) { e.zhenshe = 0; return; }
  if (xiaoyao) for (const o of host.grid.query(e.x, e.y, ZL.xiaoyao.spreadR + 30)) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= ZL.xiaoyao.spreadR + o.radius) rout(host, st, o, now, R.ms);
}

function slashFx(host: WeaponHost, x: number, y: number, rot: number, reach: number, side: number): void {
  const s = sceneOf(host);
  if (!s.textures.exists('fx_zl_slash')) return;
  playSheet(s, 'fx_zl_slash', x + Math.cos(rot) * reach * .45, y - 8 + Math.sin(rot) * reach * .45, { size: reach * 1.7, ms: 200, depth: 41, add: true, rotation: rot, flipY: side < 0, name: 'zl-slash' });
}

function summonHuben(host: WeaponHost, st: ZlState, weapon: WeaponState, time: number, shiwan: boolean, k: number, final: boolean): void {
  const pl = host.player, H = ZL.huben;
  st.huben?.riders.forEach(r => r.img?.destroy());
  const n = H.riders + (shiwan ? ZL.shiwan.riders : 0), s = sceneOf(host);
  const riders: Rider[] = [];
  for (let i = 0; i < n; i++) riders.push({ img: s.textures.exists('fx_zl_rider') ? host.add.image(pl.x, pl.y, 'fx_zl_rider', 0).setDisplaySize(96, 96).setDepth(40).setAlpha(.9).setBlendMode(1).setName('zl-rider') : null });
  st.huben = { start: time, laps: H.laps + (shiwan ? ZL.shiwan.laps : 0) + (shiwan && final ? 1 : 0), n, a0: Math.random() * Math.PI * 2, dmg: ZHANGLIAO_DEF.damage(weapon.level, pl.stats) * pl.growth.damageMultiplier(time) * H.hitMul * (shiwan ? k : 1), stun: shiwan ? ZL.shiwan.stunMs : 0, hit: new Map(), riders };
  st.summons++;
  host.sfx.play('atk_guandao_heavy');
}
function updateHuben(host: WeaponHost, st: ZlState, time: number): void {
  const h = st.huben; if (!h) return;
  const pl = host.player, H = ZL.huben, t = time - h.start;
  if (t >= h.laps * H.lapMs || host.over || !pl.alive) { h.riders.forEach(r => r.img?.destroy()); st.huben = null; return; }
  const lap = Math.floor(t / H.lapMs), frame = Math.floor(t / 70) % 6;
  h.riders.forEach((r, i) => {
    const a = h.a0 + i * Math.PI * 2 / h.n + t / H.lapMs * Math.PI * 2, x = pl.x + Math.cos(a) * H.radius, y = pl.y + Math.sin(a) * H.radius * .8;
    r.img?.setPosition(x, y - 10).setFrame(frame).setFlipX(-Math.sin(a) < 0).setDepth(y > pl.y ? 42 : 39);
    for (const e of host.grid.query(x, y, H.hitR + 30)) {
      if (!e.active || (e.isSupplySlot && !e.lockTarget) || Math.hypot(e.x - x, e.y - y) > H.hitR + e.radius) continue;
      const key = e.uid + ':' + e.spawnId + ':' + i + ':' + lap; if (h.hit.has(key)) continue; h.hit.set(key, true);
      host.hitEnemy(e, h.dmg, time, 'melee');
      if (h.stun && e.kind !== 'boss' && !e.controlImmune) e.stunUntil = Math.max(e.stunUntil, time + h.stun);
    }
  });
}
/** 溃兵互相踩踏（威震逍遥津）+ 溃逃标记跟随 / 收起。 */
function updateRouted(host: WeaponHost, st: ZlState, time: number, xiaoyao: boolean, dmg: number): void {
  for (const [e, m] of st.marks) {
    if (!e.active || e.spawnId !== m.life || e.routUntil <= time) { m.img.destroy(); st.marks.delete(e); continue; }
    m.img.setPosition(e.x, e.y - e.radius - 26).setFrame(Math.floor(time / 90) % 6);
  }
  if (!xiaoyao) return;
  const X = ZL.xiaoyao;
  for (const e of host.grid.query(host.player.x, host.player.y, 700)) {
    if (!e.active || e.routUntil <= time || time < e.trampleAt) continue;
    let n = 0;
    for (const o of host.grid.query(e.x, e.y, X.trampleR + 30)) { if (o === e || !o.active || (o.isSupplySlot && !o.lockTarget) || Math.hypot(o.x - e.x, o.y - e.y) > X.trampleR + o.radius + e.radius) continue; host.hitEnemy(o, dmg * X.trampleMul, time, 'melee'); if (++n >= 2) break; }
    if (n) e.trampleAt = time + X.trampleCdMs;
  }
}

export function zhangliaoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), shiwan = branch === 'zl_shiwan', xiaoyao = branch === 'zl_xiaoyao';
  const final = tier >= 3 && (g.build.tags()[shiwan ? 'cavalry' : 'stratagem'] ?? 0) >= 4;
  const damage = ZHANGLIAO_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time);
  // 「止啼」攒满 → 八百虎贲（进阶「八百破十万」再多一圈）
  if (pl.passive.takeHuben()) summonHuben(host, st, weapon, time, shiwan, k, final);
  updateHuben(host, st, time);
  updateRouted(host, st, time, xiaoyao, damage * (xiaoyao ? k : 1) * (final && xiaoyao ? 1.5 : 1));
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = smartTarget(host, ZL.range);
  if (!target) return;
  const reach = zhangliaoReach(weapon.level) * pl.passive.rangeMultiplier('pozhen_shuangji');
  let dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1;
  // 武艺「先登」：每隔几秒先突进再多斩几击
  const xd = g.masteries.xiandeng;
  if (xd > 0 && time >= st.dashAt && d > reach * .6) {
    const X = ZL.xiandeng, i = Math.min(2, xd - 1), len = Math.min(X.dashLen, d - reach * .4), ux = dx / d, uy = dy / d;
    st.dashAt = time + X.cdMs[i]; st.extra = X.extra[i];
    pl.knockUp(time, X.ms, ux * len, uy * len, true);
    host.heroFx?.('dash', pl.x + ux * len / 2, pl.y - 6 + uy * len / 2, len + 60, Math.atan2(uy, ux));
    weapon.cooldownLeft = X.ms / 1000; return;
  }
  dx = target.x - pl.x; dy = target.y - pl.y; d = Math.hypot(dx, dy) || 1;
  const rot = Math.atan2(dy, dx);
  for (const e of host.grid.query(pl.x, pl.y, reach + 40)) {
    if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
    const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey);
    if (ed > reach + e.radius) continue;
    if (ed > e.radius && Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - rot), Math.cos(Math.atan2(ey, ex) - rot))) > ZL.arc) continue;
    host.hitEnemy(e, damage, time, 'melee');
    shock(host, st, e, time, xiaoyao);
  }
  st.side = -st.side; st.acts++;
  slashFx(host, pl.x, pl.y, rot, reach, st.side);
  pl.faceDirection(cardinal(dx / d, dy / d), 160);
  pl.playAction('attack', cardinal(dx / d, dy / d));
  host.sfx.play('atk_guandao');
  const cd = Math.max(.12, ZHANGLIAO_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
  if (st.extra > 0) { st.extra--; weapon.cooldownLeft = .08; } else weapon.cooldownLeft = cd;
}
