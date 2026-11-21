import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { MENGDE as MD } from '../data/mengde';
import { meleeTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 曹操 · 倚天剑（P2 第一批可玩武将，数值 data/mengde.ts）：中距离扇形剑斩，命中挂「军令」（受伤加成在 CharacterPassives.vulnerability），部曲集火这一剑的目标（host.focusAllies）。
 * 被动「奸雄」：部曲阵亡攒量（Legion.onDeath → CharacterPassives.onAllyDeath，回血在 GameScene），满了召「虎豹骑」一线冲锋（本文件）。
 * 分支「挟天子以令诸侯」：定时插令旗成阵地，阵内部曲攻速 +25%、回血；「虎豹骑」：奸雄更快攒满、冲撞眩晕、留尘浪减速。
 * 特效：手绘序列帧 fx_md_*（tools/build-hero-fx-rows.mjs 从 ChatGPT 黑底图切出），缺图时不画程序特效（伤害照算）。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const MENGDE_DEF = {
  id: 'yitian_jian' as const, name: '倚天剑', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [18, 20, 23, 26, 30][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [.75, .72, .68, .64, .6][lv(level)] * stats.cooldownMul,
  desc: '中距离扇形剑斩，命中挂「军令」6 秒：受伤 +20%，部曲集火',
};
export const mengdeReach = (level: number): number => MD.reach[lv(level)];

interface Rider { img: Phaser.GameObjects.Image | null; off: number }
interface Charge { start: number; x: number; y: number; ux: number; uy: number; dmg: number; stun: number; hit: Set<string>; riders: Rider[] }
interface Zone { x: number; y: number; r: number; until: number; img: Phaser.GameObjects.Image | null; kind: 'banner' | 'dust'; ax?: number; ay?: number; bx?: number; by?: number }
interface MdState { slashes: number; charges: number; charge: Charge | null; zones: Zone[]; bannerAt: number; banners: number; marks: Map<Enemy, { img: Phaser.GameObjects.Image; life: number }> }
const STATE = new WeakMap<Player, MdState>();
const state = (pl: Player): MdState => { let s = STATE.get(pl); if (!s) { s = { slashes: 0, charges: 0, charge: null, zones: [], bannerAt: 0, banners: 0, marks: new Map() }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function mengdeDebug(pl: Player): { slashes: number; charges: number; charging: boolean; riders: number; banners: number; zones: number } { const s = state(pl); return { slashes: s.slashes, charges: s.charges, charging: !!s.charge, riders: s.charge?.riders.length ?? 0, banners: s.banners, zones: s.zones.length }; }

function mark(host: WeaponHost, st: MdState, e: Enemy, time: number): void {
  if (!e.active || (e.isSupplySlot && !e.lockTarget)) return;
  e.junlingUntil = time + MD.markMs;
  const s = sceneOf(host);
  if (!st.marks.has(e) && s.textures.exists('fx_md_mark')) st.marks.set(e, { img: host.add.image(e.x, e.y - e.radius - 24, 'fx_md_mark', 0).setDisplaySize(48, 48).setDepth(43).setBlendMode(1).setName('md-mark'), life: e.spawnId });
}

function summonHubao(host: WeaponHost, st: MdState, weapon: WeaponState, time: number, hubao: boolean, final: boolean, k: number): void {
  const pl = host.player, s = sceneOf(host);
  let best: Enemy | null = null, bestN = -1;
  for (const e of host.grid.query(pl.x, pl.y, 420)) { if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue; let n = 0; for (const o of host.grid.query(e.x, e.y, 100)) if (o.active && !(o.isSupplySlot && !o.lockTarget)) n++; if (n > bestN) { bestN = n; best = e; } }
  const hd = Math.hypot(pl.heading.x, pl.heading.y) || 1; let ux = pl.heading.x / hd, uy = pl.heading.y / hd;
  if (best) { const d = Math.hypot(best.x - pl.x, best.y - pl.y) || 1; ux = (best.x - pl.x) / d; uy = (best.y - pl.y) / d; }
  st.charge?.riders.forEach(r => r.img?.destroy());
  const n = hubao && final ? MD.hubao.finalRiders : MD.riders, riders: Rider[] = [];
  for (let i = 0; i < n; i++) riders.push({ off: (i - (n - 1) / 2) * MD.chargeGap, img: s.textures.exists('fx_md_rider') ? host.add.image(pl.x, pl.y, 'fx_md_rider', 0).setDisplaySize(110, 110).setFlipX(ux < 0).setDepth(42).setBlendMode(1).setName('md-rider') : null });
  const x = pl.x - ux * 120, y = pl.y - uy * 120;
  st.charge = { start: time, x, y, ux, uy, dmg: MENGDE_DEF.damage(weapon.level, pl.stats) * pl.growth.damageMultiplier(time) * MD.chargeMul * (hubao ? k : 1), stun: hubao ? MD.hubao.stunMs : 0, hit: new Set(), riders };
  st.charges++;
  if (hubao) {
    const ax = x, ay = y, bx = x + ux * MD.chargeLen, by = y + uy * MD.chargeLen;
    const img = s.textures.exists('fx_md_dust') ? host.add.image((ax + bx) / 2, (ay + by) / 2, 'fx_md_dust', 0).setDisplaySize(MD.chargeLen, MD.hubao.dustW * 1.4).setRotation(Math.atan2(uy, ux)).setDepth(3).setAlpha(0).setBlendMode(1).setName('md-dust') : null;
    st.zones.push({ x: (ax + bx) / 2, y: (ay + by) / 2, r: MD.hubao.dustW / 2, until: time + MD.chargeMs + MD.hubao.dustMs, img, kind: 'dust', ax, ay, bx, by });
  }
  host.sfx.play('atk_guandao_heavy');
}
function updateCharge(host: WeaponHost, st: MdState, time: number): void {
  const c = st.charge; if (!c) return;
  const t = (time - c.start) / MD.chargeMs;
  if (t >= 1 || host.over) { c.riders.forEach(r => r.img?.destroy()); st.charge = null; return; }
  const along = t * MD.chargeLen, px = -c.uy, py = c.ux;
  c.riders.forEach((r, i) => {
    const x = c.x + c.ux * along + px * r.off, y = c.y + c.uy * along + py * r.off;
    r.img?.setPosition(x, y - 14).setFrame(Math.floor(time / 70) % 6);
    for (const e of host.grid.query(x, y, MD.chargeW + 30)) {
      if (!e.active || (e.isSupplySlot && !e.lockTarget) || Math.hypot(e.x - x, e.y - y) > MD.chargeW / 2 + e.radius) continue;
      const key = e.uid + ':' + e.spawnId + ':' + i; if (c.hit.has(key)) continue; c.hit.add(key);
      host.hitEnemy(e, c.dmg, time, 'melee');
      if (c.stun && e.active && e.kind !== 'boss' && !e.controlImmune) e.stunUntil = Math.max(e.stunUntil, time + c.stun);
    }
  });
}

function inZone(z: Zone, e: Enemy): boolean {
  if (z.kind === 'banner') return Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.radius;
  const ux = z.bx! - z.ax!, uy = z.by! - z.ay!, len = Math.hypot(ux, uy) || 1, dx = e.x - z.ax!, dy = e.y - z.ay!, along = (dx * ux + dy * uy) / len, side = Math.abs(-dx * uy + dy * ux) / len;
  return along >= 0 && along <= len && side <= z.r + e.radius;
}

export function mengdeBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), xie = branch === 'cc_xietianzi', hubao = branch === 'cc_hubao';
  const final = tier >= 3 && (g.build.tags()[xie ? 'formation' : 'cavalry'] ?? 0) >= 4;
  pl.passive.mdNeed = hubao ? MD.hubao.need : MD.need;
  pl.passive.mdMarkVuln = MD.markVuln + MD.weicai * g.masteries.weicai;
  if (pl.passive.takeHubao()) summonHubao(host, st, weapon, time, hubao, final, k);
  updateCharge(host, st, time);
  // 挟天子以令诸侯：定时插令旗
  const s = sceneOf(host), X = MD.xie;
  if (xie && time >= st.bannerAt) {
    st.bannerAt = time + X.everyMs; st.banners++;
    const r = X.r * (final ? X.finalRMul : 1);
    const img = s.textures.exists('fx_md_banner') ? host.add.image(pl.x, pl.y, 'fx_md_banner', 0).setDisplaySize(r * 2, r * 2).setOrigin(.5, .62).setDepth(3).setAlpha(.75).setBlendMode(1).setName('md-banner') : null;
    st.zones.push({ x: pl.x, y: pl.y, r, until: time + X.ms, img, kind: 'banner' });
  }
  for (const z of st.zones) {
    if (z.kind === 'dust' && time < (st.charge?.start ?? -1e9) + MD.chargeMs) { z.img?.setAlpha(0); continue; } // 尘浪等骑兵冲过再起
    z.img?.setFrame(Math.floor(time / 90) % 6).setAlpha(Math.min(z.kind === 'banner' ? .75 : .9, (z.until - time) / 400));
    if (z.kind === 'banner') { host.hasteAllies?.(z.x, z.y, z.r, dt, X.haste * k); host.healAlliesIn?.(z.x, z.y, z.r, X.healPct * dt); continue; }
    for (const e of host.grid.query(z.x, z.y, MD.chargeLen / 2 + 40)) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || !inZone(z, e)) continue;
      e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - MD.hubao.slow); e.martialSlowUntil = time + 120;
    }
  }
  for (const z of st.zones) if (time >= z.until) z.img?.destroy();
  st.zones = st.zones.filter(z => time < z.until);
  // 军令标记跟随 / 收起
  for (const [e, m] of st.marks) {
    if (!e.active || e.spawnId !== m.life || e.junlingUntil <= time) { m.img.destroy(); st.marks.delete(e); continue; }
    m.img.setPosition(e.x, e.y - e.radius - 24).setFrame(Math.floor(time / 100) % 6);
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const reach = mengdeReach(weapon.level) * pl.passive.rangeMultiplier('yitian_jian');
  // 只挑剑够得着的（2026-11-20 P3 孙权同款修）：原来按 MD.range 170 找「最密处」，挑中够不着的那个时整把剑卡住不砍身边的兵
  const target = meleeTarget(host, reach);
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, rot = Math.atan2(dy, dx);
  if (d > reach + target.radius + 10) return;
  const dmg = MENGDE_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time);
  for (const e of host.grid.query(pl.x, pl.y, reach + 40)) {
    if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
    const ex = e.x - pl.x, ey = e.y - pl.y, ed = Math.hypot(ex, ey);
    if (ed > reach + e.radius) continue;
    if (ed > e.radius && Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - rot), Math.cos(Math.atan2(ey, ex) - rot))) > MD.arc) continue;
    host.hitEnemy(e, dmg, time, 'melee');
    mark(host, st, e, time);
  }
  if (target.active) host.focusAllies?.(target);
  st.slashes++;
  if (s.textures.exists('fx_md_slash')) playSheet(s, 'fx_md_slash', pl.x + Math.cos(rot) * reach * .45, pl.y - 8 + Math.sin(rot) * reach * .45, { size: reach * 1.7, ms: 240, depth: 41, add: true, rotation: rot, name: 'md-slash' });
  pl.faceDirection(cardinal(dx / d, dy / d), 160);
  pl.playAction('attack', cardinal(dx / d, dy / d));
  host.sfx.play('atk_guandao');
  weapon.cooldownLeft = Math.max(.25, MENGDE_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
