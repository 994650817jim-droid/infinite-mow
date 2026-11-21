import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { MENGHUO as M } from '../data/menghuo';
import { meleeTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 孟获 · 南蛮大刀（P3 第二批可玩武将，数值 data/menghuo.ts）：前方大扇面重劈 + 沿劈的方向裂地一线。
 * 被动「南蛮王」：击杀攒量（GameScene → CharacterPassives.p3Gain），满了「驱兽冲阵」（本文件：猛兽 / 象兵一线冲过）。
 * 分支「七擒不服」：受伤攒不服层、伤害递增（层数记在 CharacterPassives.mhBufu，受伤时由 onDamage 攒）；「南中象阵」：象兵、撞晕、更快攒满。
 * 图：刀光 fx_md_slash（换赤）、裂地 weiyan_crack（魏延，6 帧竖排每帧 1024×256）、猛兽 mh_beast_sheet / 象兵 mh_elephant_sheet（第十一章南中兵种图另起键）；缺图不画替代图形。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const MENGHUO_DEF = {
  id: 'nanman_dao' as const, name: '南蛮大刀', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [22, 25, 29, 33, 38][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.15, 1.1, 1.05, 1, .95][lv(level)] * stats.cooldownMul,
  desc: '前方大扇面重劈，沿劈的方向裂地一线',
};
export const menghuoReach = (level: number, manli = 0): number => Math.round(M.reach[lv(level)] * (1 + M.manli * manli));

interface Beast { img: Phaser.GameObjects.Sprite | null; off: number }
interface Charge { start: number; x: number; y: number; ux: number; uy: number; dmg: number; stun: number; back: boolean; hit: Set<string>; beasts: Beast[] }
interface MhState { cleaves: number; cracks: number; charges: number; charge: Charge | null }
const STATE = new WeakMap<Player, MhState>();
const state = (pl: Player): MhState => { let s = STATE.get(pl); if (!s) { s = { cleaves: 0, cracks: 0, charges: 0, charge: null }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function menghuoDebug(pl: Player): { cleaves: number; cracks: number; charges: number; charging: boolean; beasts: number; elephants: boolean } { const s = state(pl); return { cleaves: s.cleaves, cracks: s.cracks, charges: s.charges, charging: !!s.charge, beasts: s.charge?.beasts.length ?? 0, elephants: !!s.charge?.stun }; }

function crack(host: WeaponHost, st: MhState, x: number, y: number, ux: number, uy: number, dmg: number, time: number): void {
  const s = sceneOf(host), L = M.crackLen, ax = x, ay = y, bx = x + ux * L, by = y + uy * L, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
  for (const e of host.grid.query((ax + bx) / 2, (ay + by) / 2, L / 2 + M.crackW + 30)) {
    if (!e.active || e.isSupplySlot) continue;
    const t = Math.max(0, Math.min(1, ((e.x - ax) * vx + (e.y - ay) * vy) / l2));
    if (Math.hypot(e.x - ax - vx * t, e.y - ay - vy * t) > M.crackW / 2 + e.radius) continue;
    host.hitEnemy(e, e.kind === 'boss' ? dmg * M.bossMul : dmg, time, 'melee');
  }
  st.cracks++;
  if (s.textures.exists('weiyan_crack')) { const img = host.add.sprite((ax + bx) / 2, (ay + by) / 2, 'weiyan_crack', 0).setDisplaySize(L * 1.15, L * .29).setRotation(Math.atan2(uy, ux)).setDepth(3).setName('mh-crack'); s.tweens.addCounter({ from: 0, to: 5.99, duration: 420, onUpdate: tw => img.setFrame(Math.floor(tw.getValue() ?? 0)), onComplete: () => s.tweens.add({ targets: img, alpha: 0, duration: 260, onComplete: () => img.destroy() }) }); }
}

function summonBeasts(host: WeaponHost, st: MhState, dmg: number, xiang: boolean, final: boolean): void {
  const pl = host.player, s = sceneOf(host);
  let best: Enemy | null = null, bestN = -1;
  for (const e of host.grid.query(pl.x, pl.y, 420)) { if (!e.active || e.isSupplySlot) continue; let n = 0; for (const o of host.grid.query(e.x, e.y, 100)) if (o.active && !o.isSupplySlot) n++; if (n > bestN) { bestN = n; best = e; } }
  const hd = Math.hypot(pl.heading.x, pl.heading.y) || 1; let ux = pl.heading.x / hd, uy = pl.heading.y / hd;
  if (best) { const d = Math.hypot(best.x - pl.x, best.y - pl.y) || 1; ux = (best.x - pl.x) / d; uy = (best.y - pl.y) / d; }
  st.charge?.beasts.forEach(b => b.img?.destroy());
  const n = xiang ? M.xiang.beasts : M.beasts, key = xiang ? 'mh_elephant_sheet' : 'mh_beast_sheet', size = xiang ? 150 : 120, beasts: Beast[] = [];
  const row = Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 1 : 2) : (uy < 0 ? 3 : 0); // 行：下 / 左 / 右 / 上
  for (let i = 0; i < n; i++) beasts.push({ off: (i - (n - 1) / 2) * M.chargeGap, img: s.textures.exists(key) ? host.add.sprite(pl.x, pl.y, key, row * 4).setDisplaySize(size, size).setDepth(40).setName('mh-beast') : null });
  st.charge = { start: host.combatNow, x: pl.x - ux * 120, y: pl.y - uy * 120, ux, uy, dmg, stun: xiang ? M.xiang.stunMs : 0, back: xiang && final, hit: new Set(), beasts };
  st.charges++; host.sfx.play('atk_guandao_heavy');
}
function updateCharge(host: WeaponHost, st: MhState, time: number): void {
  const c = st.charge; if (!c) return;
  const dur = M.chargeMs * (c.back ? 2 : 1), t = (time - c.start) / dur;
  if (t >= 1 || host.over) { c.beasts.forEach(b => b.img?.destroy()); st.charge = null; return; }
  const leg = c.back ? (t < .5 ? t * 2 : 2 - t * 2) : t, along = leg * M.chargeLen, px = -c.uy, py = c.ux, goingBack = c.back && t >= .5;
  const row = Math.abs(c.ux) > Math.abs(c.uy) ? ((c.ux < 0) !== goingBack ? 1 : 2) : ((c.uy < 0) !== goingBack ? 3 : 0);
  c.beasts.forEach((b, i) => {
    const x = c.x + c.ux * along + px * b.off, y = c.y + c.uy * along + py * b.off;
    b.img?.setPosition(x, y - 10).setFrame(row * 4 + Math.floor(time / 90) % 4).setDepth(30 + y / 1000);
    for (const e of host.grid.query(x, y, M.chargeW + 30)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - x, e.y - y) > M.chargeW / 2 + e.radius) continue;
      const key = e.uid + ':' + e.spawnId + ':' + i + (goingBack ? 'b' : ''); if (c.hit.has(key)) continue; c.hit.add(key);
      host.hitEnemy(e, c.dmg, time, 'melee');
      if (e.active && e.kind !== 'boss' && !e.controlImmune) { host.knockEnemy?.(e, c.ux * M.shove * (goingBack ? -1 : 1) + px * Math.sign(b.off || 1) * M.shove * .5, c.uy * M.shove * (goingBack ? -1 : 1) + py * Math.sign(b.off || 1) * M.shove * .5, 160); if (c.stun) e.stunUntil = Math.max(e.stunUntil, time + c.stun); }
    }
  });
}

export function menghuoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), s = sceneOf(host);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), bufu = branch === 'mh_bufu', xiang = branch === 'mh_xiangzhen';
  const final = tier >= 3 && (g.build.tags()[bufu ? 'warrior' : 'formation'] ?? 0) >= 4;
  pl.passive.p3Need = xiang ? M.xiang.need : M.need;
  pl.passive.p3Armor = 1 - M.tengjia * (g.masteries.tengjia ?? 0);
  pl.passive.mhBufuOn = bufu;
  const stacks = bufu ? pl.passive.mhBufuStacks(time) : 0;
  const base = MENGHUO_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * (1 + M.bufu.per * stacks * (bufu ? k : 1));
  if (pl.passive.takeP3()) { summonBeasts(host, st, base * M.chargeMul * (xiang ? k : 1), xiang, final); pl.playAction('skill', 'down'); }
  updateCharge(host, st, time);

  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const reach = menghuoReach(weapon.level, g.masteries.manli ?? 0) * pl.passive.rangeMultiplier('nanman_dao');
  const target = meleeTarget(host, reach);
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, rot = Math.atan2(dy, dx);
  for (const e of host.grid.query(pl.x, pl.y, reach + 40)) {
    if (!e.active || e.isSupplySlot) continue;
    const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey);
    if (ed > reach + e.radius) continue;
    if (ed > e.radius && Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - rot), Math.cos(Math.atan2(ey, ex) - rot))) > M.arc) continue;
    host.hitEnemy(e, base * M.cleaveMul * (e.kind === 'boss' ? M.bossMul : 1), time, 'melee');
  }
  st.cleaves++;
  playSheet(s, 'fx_md_slash', pl.x + ux * reach * .45, pl.y - 8 + uy * reach * .45, { size: reach * 1.9, ms: 280, depth: 41, add: true, rotation: rot, tint: 0xff9a70, name: 'mh-cleave' });
  crack(host, st, pl.x + ux * 30, pl.y + uy * 30, ux, uy, base * M.crackMul, time);
  if (bufu && final && stacks >= M.bufu.max) crack(host, st, pl.x + ux * 30, pl.y + uy * 30, ux, uy, base * M.crackMul, time);
  pl.faceDirection(cardinal(ux, uy), 220); pl.playAction('attack', cardinal(ux, uy)); host.sfx.play('atk_guandao_heavy');
  weapon.cooldownLeft = Math.max(.3, MENGHUO_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
