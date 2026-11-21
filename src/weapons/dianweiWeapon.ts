import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { DIANWEI as D } from '../data/dianwei';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 典韦 · 双铁戟（P3 第二批可玩武将，数值 data/dianwei.ts）：掷短戟（穿透）+ 每第 4 击原地旋风。
 * 被动「恶来」：受伤攒量（CharacterPassives.onDamage），满了「古之恶来」（本文件开启：减伤、自动旋风）。
 * 分支「宛城死战」：半血以下旋风更大、吸血；「护主」：定时给身边部曲护盾、身边部曲攻速。
 * 特效：随军典韦手绘图（fx_dianwei_throw / whirl / hit / rage）与 dianwei_halberd 小戟；缺图不画替代图形。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const DIANWEI_DEF = {
  id: 'shuang_tieji' as const, name: '双铁戟', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [17, 19, 22, 25, 29][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [.9, .86, .82, .78, .74][lv(level)] * stats.cooldownMul,
  desc: '朝最近两个敌兵各掷一支短戟（穿透），每第 4 击原地旋风',
};
export const dianweiWhirlR = (level: number, huwei = 0): number => Math.round(D.whirlR[lv(level)] * (1 + D.huwei * huwei));

interface Shot { x: number; y: number; ux: number; uy: number; went: number; dmg: number; hit: Set<string>; img: Phaser.GameObjects.Image | null }
interface DwState { attacks: number; throws: number; whirls: number; rages: number; pulses: number; leeched: number; shots: Shot[]; rageWhirlAt: number; pulseAt: number }
const STATE = new WeakMap<Player, DwState>();
const state = (pl: Player): DwState => { let s = STATE.get(pl); if (!s) { s = { attacks: 0, throws: 0, whirls: 0, rages: 0, pulses: 0, leeched: 0, shots: [], rageWhirlAt: 0, pulseAt: 0 }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function dianweiDebug(pl: Player): { attacks: number; throws: number; whirls: number; rages: number; pulses: number; leeched: number; shots: number } { const s = state(pl); return { attacks: s.attacks, throws: s.throws, whirls: s.whirls, rages: s.rages, pulses: s.pulses, leeched: Math.round(s.leeched), shots: s.shots.length }; }

function whirl(host: WeaponHost, st: DwState, r: number, dmg: number, time: number, leech: number): void {
  const pl = host.player, s = sceneOf(host); let dealt = 0;
  for (const e of host.grid.query(pl.x, pl.y, r + 40)) {
    if (!e.active || e.isSupplySlot || Math.hypot(e.x - pl.x, e.y - pl.y) > r + e.radius) continue;
    host.hitEnemy(e, dmg, time, 'melee'); dealt += dmg;
    if (e.active && e.kind !== 'boss') { const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy) || 1; host.knockEnemy?.(e, dx / d * D.whirlShove, dy / d * D.whirlShove, 140); }
  }
  if (leech > 0 && dealt > 0) { const h = dealt * leech; pl.heal(h); st.leeched += h; }
  st.whirls++;
  playSheet(s, 'fx_dianwei_whirl', pl.x, pl.y - 8, { size: r * 2.3, ms: 360, depth: 41, add: true, name: 'dw-whirl' });
  pl.playAction('skill', 'down'); host.sfx.play('atk_guandao_heavy');
}

export function dianweiBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), s = sceneOf(host);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), sizhan = branch === 'dw_sizhan', huzhu = branch === 'dw_huzhu';
  const final = tier >= 3 && (g.build.tags()[sizhan ? 'warrior' : 'formation'] ?? 0) >= 4;
  pl.passive.p3Need = D.need;
  const base = DIANWEI_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time);
  const lowHp = pl.hp <= pl.maxHp * D.sizhan.hpBelow, deathFight = sizhan && (final || lowHp);
  const r = dianweiWhirlR(weapon.level, g.masteries.huwei ?? 0) * pl.passive.rangeMultiplier('shuang_tieji') * (deathFight ? D.sizhan.rMul : 1);
  const whirlDmg = base * D.whirlMul * (sizhan ? k : 1), leech = deathFight ? D.sizhan.leech : 0;
  // 恶来：量表满 → 古之恶来（减伤、自动旋风）
  if (pl.passive.takeP3()) { pl.passive.startP3(time, D.rageMs, 1, D.rageGuard); st.rages++; st.rageWhirlAt = time; playSheet(s, 'fx_dianwei_rage', pl.x, pl.y - 10, { size: 190, ms: 600, depth: 42, add: true, name: 'dw-rage' }); }
  if (pl.passive.p3Active(time) && time >= st.rageWhirlAt) { st.rageWhirlAt = time + D.rageWhirlMs; whirl(host, st, r, whirlDmg, time, leech); }
  // 护主：定时给身边部曲护盾；身边部曲常驻攻速
  if (huzhu) {
    host.hasteAllies?.(pl.x, pl.y, D.huzhu.r, dt, D.huzhu.haste * k);
    if (time >= st.pulseAt) {
      st.pulseAt = time + (final ? D.huzhu.finalEveryMs : D.huzhu.everyMs); st.pulses++;
      host.shieldAllies?.(pl.x - 1, pl.y, pl.x + 1, pl.y, D.huzhu.r, D.huzhu.shield * k * (final ? D.huzhu.finalShieldMul : 1), time + D.huzhu.shieldMs);
      playSheet(s, 'fx_dianwei_rage', pl.x, pl.y - 6, { size: D.huzhu.r * 1.6, ms: 520, depth: 3, add: true, tint: 0xffe2a0, alpha: .6, name: 'dw-huzhu' });
    }
  }
  // 飞戟
  for (const sh of st.shots) {
    const step = D.throwSpeed * dt; sh.x += sh.ux * step; sh.y += sh.uy * step; sh.went += step;
    sh.img?.setPosition(sh.x, sh.y - 12).setRotation(sh.img.rotation + dt * 18);
    for (const e of host.grid.query(sh.x, sh.y, D.throwW + 40)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - sh.x, e.y - sh.y) > D.throwW + e.radius) continue;
      const key = e.uid + ':' + e.spawnId; if (sh.hit.has(key)) continue; sh.hit.add(key);
      host.hitEnemy(e, sh.dmg, time, 'melee');
      playSheet(s, 'fx_dianwei_hit', e.x, e.y - 12, { size: 70, ms: 220, depth: 42, add: true, name: 'dw-hit' });
    }
  }
  for (const sh of st.shots) if (sh.went >= D.throwRange) sh.img?.destroy();
  st.shots = st.shots.filter(sh => sh.went < D.throwRange);

  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pool = host.grid.query(pl.x, pl.y, D.range + 40).filter(e => e.active && !e.isSupplySlot && !e.invulnerable && e.def.behavior !== 'wall' && Math.hypot(e.x - pl.x, e.y - pl.y) <= D.range + e.radius)
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  if (!pool.length) return;
  st.attacks++;
  const every = sizhan && final ? D.sizhan.finalEvery : D.whirlEvery;
  if (st.attacks % every === 0) whirl(host, st, r, whirlDmg, time, leech);
  else {
    const n = D.throws + (D.tieji[g.masteries.tieji ?? 0] ?? 0);
    const targets: Enemy[] = []; for (let i = 0; i < n; i++) targets.push(pool[i % pool.length]);
    targets.forEach((t, i) => {
      const dx = t.x - pl.x, dy = t.y - pl.y, d = Math.hypot(dx, dy) || 1, spread = i >= pool.length ? (i % 2 ? .18 : -.18) : 0, a = Math.atan2(dy, dx) + spread;
      const img = s.textures.exists('dianwei_halberd') ? host.add.image(pl.x, pl.y - 12, 'dianwei_halberd').setDisplaySize(48, 32).setDepth(42).setName('dw-halberd') : null;
      st.shots.push({ x: pl.x, y: pl.y, ux: Math.cos(a), uy: Math.sin(a), went: 0, dmg: base * D.throwMul * (huzhu ? 1 : 1), hit: new Set(), img }); st.throws++;
      if (i === 0) { pl.faceDirection(cardinal(dx / d, dy / d), 200); pl.playAction('attack', cardinal(dx / d, dy / d)); }
    });
    playSheet(s, 'fx_dianwei_throw', pl.x, pl.y - 14, { size: 120, ms: 260, depth: 41, add: true, rotation: Math.atan2(pool[0].y - pl.y, pool[0].x - pl.x), name: 'dw-throw' });
    host.sfx.play('atk_spear');
  }
  weapon.cooldownLeft = Math.max(.25, DIANWEI_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
