import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { ZHOUYU as ZY } from '../data/zhouyu';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 周瑜 · 火船令（P2 第一批可玩武将，数值 data/zhouyu.ts）：朝敌群放小火船，撞上或到尽头爆燃、留火场。
 * 被动「英发」：本武器烧死敌兵攒量（CharacterPassives.onFireKill），满了刮「东风」——火场顺风推进、伤害翻倍（windUntil / windDir 在本文件）。
 * 分支「火烧赤壁」：同轮火船拉火索、连锁爆燃、火场更大；「曲有误」：定时琴音环，减速敌兵、部曲攻速 +15%（host.hasteAllies）。
 * 特效：手绘序列帧 fx_zy_*（tools/build-hero-fx-rows.mjs 从 ChatGPT 黑底图切出），缺图时不画程序特效（伤害照算）。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;

export const ZHOUYU_DEF = {
  id: 'huochuan_ling' as const, name: '火船令', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [26, 30, 34, 39, 45][lv(level)] * stats.damageMul * stats.fireMul,
  cooldown: (level: number, stats: PlayerStats) => [1.5, 1.45, 1.4, 1.3, 1.2][lv(level)] * stats.cooldownMul,
  desc: '朝敌群放出 2 艘小火船沿直线驶出，撞上敌兵或到尽头爆燃，留下短火场',
};
export const zhouyuBlast = (level: number): number => ZY.blast[lv(level)];

interface Ship { x: number; y: number; ux: number; uy: number; left: number; volley: number; img: Phaser.GameObjects.Image | null; dead: boolean }
interface Field { x: number; y: number; r: number; until: number; nextTick: number; dmg: number; img: Phaser.GameObjects.Image | null }
interface ZyState { ships: Ship[]; fields: Field[]; volley: number; launches: number; blasts: number; windUntil: number; windX: number; windY: number; winds: number; quAt: number; quUntil: number; quTick: number; quRing: Phaser.GameObjects.Image | null; ropeTick: number; rope: Phaser.GameObjects.Image[] }
const STATE = new WeakMap<Player, ZyState>();
const state = (pl: Player): ZyState => { let s = STATE.get(pl); if (!s) { s = { ships: [], fields: [], volley: 0, launches: 0, blasts: 0, windUntil: 0, windX: 1, windY: 0, winds: 0, quAt: 0, quUntil: 0, quTick: 0, quRing: null, ropeTick: 0, rope: [] }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function zhouyuDebug(pl: Player): { launches: number; blasts: number; ships: number; fields: number; field0: { x: number; y: number } | null; windOn: boolean; winds: number; quOn: boolean } { const s = state(pl); const f = s.fields[0]; return { launches: s.launches, blasts: s.blasts, ships: s.ships.length, fields: s.fields.length, field0: f ? { x: Math.round(f.x), y: Math.round(f.y) } : null, windOn: s.windUntil > 0, winds: s.winds, quOn: s.quUntil > 0 }; }
/** 增益栏：东风还剩几毫秒。 */
export function zhouyuWindLeft(pl: Player, now: number): number { const s = STATE.get(pl); return s ? Math.max(0, s.windUntil - now) : 0; }

/** 伤害一个敌兵（火），烧死了给「英发」攒量。 */
function burn(host: WeaponHost, e: Enemy, dmg: number, time: number): void {
  if (!e.active || (e.isSupplySlot && !e.lockTarget)) return;
  host.hitEnemy(e, e.kind === 'boss' ? dmg * ZY.bossMul : dmg, time, 'fire');
  if (!e.active) host.player.passive.onFireKill(time);
}

function explode(host: WeaponHost, st: ZyState, sh: Ship, weapon: WeaponState, time: number, chibi: boolean, final: boolean, k: number): void {
  if (sh.dead) return; sh.dead = true; sh.img?.destroy(); st.blasts++;
  const pl = host.player, g = pl.growth, dmg = ZHOUYU_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * (chibi ? k : 1);
  const r = zhouyuBlast(weapon.level) * pl.passive.rangeMultiplier('huochuan_ling');
  for (const e of host.grid.query(sh.x, sh.y, r + 30)) if (Math.hypot(e.x - sh.x, e.y - sh.y) <= r + e.radius) burn(host, e, dmg, time);
  const s = sceneOf(host);
  if (s.textures.exists('fx_zy_blast')) playSheet(s, 'fx_zy_blast', sh.x, sh.y - 10, { size: r * 2.4, ms: 380, depth: 41, add: true, name: 'zy-blast' });
  host.sfx.play('atk_flame');
  const fr = r * ZY.fieldR * (chibi ? ZY.chibi.fieldMul : 1), ms = ZY.fieldMs + (chibi && final ? ZY.chibi.finalExtraMs : 0);
  const img = s.textures.exists('fx_zy_field') ? host.add.image(sh.x, sh.y, 'fx_zy_field', 0).setDisplaySize(fr * 2.3, fr * 2.3 * .62).setDepth(3).setAlpha(.9).setBlendMode(1).setName('zy-field') : null;
  st.fields.push({ x: sh.x, y: sh.y, r: fr, until: time + ms, nextTick: time + ZY.tickMs, dmg: dmg * ZY.tickMul, img });
  // 火烧赤壁：同轮其余火船连锁爆燃
  if (chibi) for (const o of st.ships) if (!o.dead && o.volley === sh.volley) host.time.delayedCall(90, () => explode(host, st, o, weapon, host.combatNow, chibi, final, k));
}

function updateShips(host: WeaponHost, st: ZyState, weapon: WeaponState, dt: number, time: number, chibi: boolean, final: boolean, k: number): void {
  for (const sh of st.ships) {
    if (sh.dead) continue;
    const step = ZY.speed * dt; sh.x += sh.ux * step; sh.y += sh.uy * step; sh.left -= step;
    sh.img?.setPosition(sh.x, sh.y - 12).setFrame(Math.floor(time / 80) % 6);
    let hit = sh.left <= 0;
    if (!hit) for (const e of host.grid.query(sh.x, sh.y, ZY.shipR + 40)) if (e.active && !(e.isSupplySlot && !e.lockTarget) && Math.hypot(e.x - sh.x, e.y - sh.y) <= ZY.shipR + e.radius) { hit = true; break; }
    if (hit) explode(host, st, sh, weapon, time, chibi, final, k);
  }
  st.ships = st.ships.filter(s => !s.dead);
  // 火索：同一轮还在走的火船两两相连，穿过的敌兵灼烧
  st.rope.forEach(r => r.destroy()); st.rope = [];
  if (!chibi) return;
  const s = sceneOf(host), tick = time >= st.ropeTick, pl = host.player;
  if (tick) st.ropeTick = time + ZY.chibi.ropeTickMs;
  const dmg = ZHOUYU_DEF.damage(weapon.level, pl.stats) * pl.growth.damageMultiplier(time) * ZY.chibi.ropeMul * k;
  for (let i = 0; i + 1 < st.ships.length; i++) {
    const a = st.ships[i], b = st.ships[i + 1]; if (a.volley !== b.volley) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 4) continue;
    if (s.textures.exists('fx_zy_rope')) st.rope.push(host.add.image((a.x + b.x) / 2, (a.y + b.y) / 2 - 12, 'fx_zy_rope', Math.floor(time / 80) % 6).setDisplaySize(len, 34).setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setDepth(40).setBlendMode(1).setName('zy-rope'));
    if (!tick) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    for (const e of host.grid.query((a.x + b.x) / 2, (a.y + b.y) / 2, len / 2 + 30)) {
      if (!e.active || (e.isSupplySlot && !e.lockTarget)) continue;
      const dx = e.x - a.x, dy = e.y - a.y, along = dx * ux + dy * uy, side = Math.abs(-dx * uy + dy * ux);
      if (along >= 0 && along <= len && side <= ZY.chibi.ropeW / 2 + e.radius) burn(host, e, dmg, time);
    }
  }
}

/** 首领上一次被火场烧的时刻（2026-11-20 平衡：火场打首领不叠加）。 */
const BOSS_FIELD_AT = new WeakMap<Enemy, number>();
function updateFields(host: WeaponHost, st: ZyState, dt: number, time: number): void {
  const wind = time < st.windUntil, mul = wind ? ZY.windMul : 1;
  if (!wind && st.windUntil) st.windUntil = 0;
  for (const f of st.fields) {
    if (wind) { f.x += st.windX * ZY.windSpeed * dt; f.y += st.windY * ZY.windSpeed * dt; }
    f.img?.setPosition(f.x, f.y).setFrame(Math.floor(time / 90) % 6).setAlpha(Math.min(.9, (f.until - time) / 400));
    if (time < f.nextTick) continue;
    f.nextTick = time + ZY.tickMs;
    for (const e of host.grid.query(f.x, f.y, f.r + 30)) {
      if (Math.hypot(e.x - f.x, e.y - f.y) > f.r + e.radius) continue;
      if (e.kind === 'boss') { if (time - (BOSS_FIELD_AT.get(e) ?? -1e9) < ZY.tickMs) continue; BOSS_FIELD_AT.set(e, time); } // 叠着的火场打首领不叠加：每 tickMs 只烧一次
      burn(host, e, f.dmg * mul, time);
    }
  }
  for (const f of st.fields) if (time >= f.until) f.img?.destroy();
  st.fields = st.fields.filter(f => time < f.until);
}

function updateQu(host: WeaponHost, st: ZyState, weapon: WeaponState, dt: number, time: number, on: boolean, final: boolean, k: number): void {
  const Q = ZY.qu, pl = host.player, s = sceneOf(host);
  if (!on) { if (st.quRing) { st.quRing.destroy(); st.quRing = null; } st.quUntil = 0; return; }
  if (time >= st.quAt && time >= st.quUntil) { st.quAt = time + Q.everyMs; st.quUntil = time + Q.ms; st.quTick = time; host.sfx.play('cast_sigil'); }
  if (time >= st.quUntil) { st.quRing?.destroy(); st.quRing = null; if (st.quUntil) st.quUntil = 0; return; }
  const r = Q.r * pl.passive.rangeMultiplier('huochuan_ling');
  if (!st.quRing && s.textures.exists('fx_zy_qin')) st.quRing = host.add.image(pl.x, pl.y, 'fx_zy_qin', 0).setDepth(4).setAlpha(.85).setBlendMode(1).setName('zy-qin');
  st.quRing?.setPosition(pl.x, pl.y).setDisplaySize(r * 2.2, r * 2.2 * .62).setFrame(Math.floor(time / 90) % 6);
  for (const e of host.grid.query(pl.x, pl.y, r + 30)) {
    if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.controlImmune || Math.hypot(e.x - pl.x, e.y - pl.y) > r + e.radius) continue;
    e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - Q.slow); e.martialSlowUntil = time + 120;
  }
  host.hasteAllies?.(pl.x, pl.y, r, dt, Q.haste * k);
  if (final && time >= st.quTick) {
    st.quTick = time + Q.finalTickMs;
    const dmg = ZHOUYU_DEF.damage(weapon.level, pl.stats) * pl.growth.damageMultiplier(time) * Q.finalBurn;
    for (const e of host.grid.query(pl.x, pl.y, r + 30)) if (Math.hypot(e.x - pl.x, e.y - pl.y) <= r + e.radius) burn(host, e, dmg, time);
  }
}

export function zhouyuBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), chibi = branch === 'zy_chibi', qu = branch === 'zy_quyouwu';
  const final = tier >= 3 && (g.build.tags()[chibi ? 'fire' : 'formation'] ?? 0) >= 4;
  pl.passive.zyNeed = Math.max(1, Math.round(ZY.need * (1 - ZY.yaliang * g.masteries.yaliang))); // 武艺「雅量」：英发少攒
  // 「英发」攒满 → 东风：朝主将当时的朝向吹
  if (pl.passive.takeDongfeng()) {
    const hd = Math.hypot(pl.heading.x, pl.heading.y) || 1;
    st.windX = pl.heading.x / hd; st.windY = pl.heading.y / hd; st.windUntil = time + ZY.windMs; st.winds++;
    const s = sceneOf(host);
    if (s.textures.exists('fx_zy_wind')) for (let i = 0; i < 3; i++) playSheet(s, 'fx_zy_wind', pl.x + (i - 1) * 140 * -st.windY, pl.y + (i - 1) * 140 * st.windX, { size: 300, ms: 700, depth: 44, add: true, alpha: .8, rotation: Math.atan2(st.windY, st.windX), name: 'zy-wind' });
  }
  updateShips(host, st, weapon, dt, time, chibi, final, k);
  updateFields(host, st, dt, time);
  updateQu(host, st, weapon, dt, time, qu, final, k);
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = smartTarget(host, ZY.range);
  if (!target) return;
  const n = ZY.ships + g.masteries.lianchuan, base = Math.atan2(target.y - pl.y, target.x - pl.x), s = sceneOf(host);
  st.volley++;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * ZY.spread * 2 / Math.max(1, n - 1) * (n > 1 ? 1 : 0), ux = Math.cos(a), uy = Math.sin(a);
    const img = s.textures.exists('fx_zy_ship') ? host.add.image(pl.x, pl.y, 'fx_zy_ship', 0).setDisplaySize(84, 84).setFlipX(ux < 0).setDepth(40).setBlendMode(1).setName('zy-ship') : null;
    st.ships.push({ x: pl.x + ux * 20, y: pl.y + uy * 20, ux, uy, left: ZY.range * pl.passive.rangeMultiplier('huochuan_ling'), volley: st.volley, img, dead: false });
  }
  st.launches++;
  pl.playAction('attack', Math.abs(Math.cos(base)) > Math.abs(Math.sin(base)) ? (Math.cos(base) < 0 ? 'left' : 'right') : (Math.sin(base) < 0 ? 'up' : 'down'));
  host.sfx.play('atk_flame');
  weapon.cooldownLeft = Math.max(.3, ZHOUYU_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
