import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { LVBU } from '../data/lvbu';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';
import { branchTier } from '../data/weaponBranches';

/**
 * 吕布 · 方天画戟（P2 第一批可玩武将，数值 data/lvbu.ts）：长突 → 长突 → 360° 横扫，循环。
 * 「无双」狂暴中每次出手打两次、出手更快（攻速 ×1.4，移速 / 不被击退在 Player 里接）。
 * 分支在本武器里结算：「人中吕布」横扫转两圈、更大，狂暴中击杀延长狂暴（CharacterPassives.lvbuExtendMs）；
 * 「辕门射戟」每 5 次出手掷戟钉住一线敌兵、戟飞回再割一次。武艺「画戟」放大横扫，「赤兔」狂暴时冲刺穿人。
 * 特效：手绘序列帧 fx_lvbu_*（tools/build-lvbu-fx.mjs 从 ChatGPT 黑底图切出）；图未到时借现成手绘图（spear_thrust、fx_awaken_warrior），不画程序特效。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const hittable = (e: Enemy): boolean => e.active;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

export const LVBU_DEF = {
  id: 'fangtian_ji' as const, name: '方天画戟', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [24, 27, 31, 35, 40][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [.9, .88, .84, .8, .75][lv(level)] * stats.cooldownMul,
  desc: '两次长突穿透一线，接一次 360° 横扫，循环；「无双」狂暴时每次出手打两次',
};
export const lvbuThrustLen = (level: number): number => LVBU.thrustLen[lv(level)];
export const lvbuSweepRadius = (level: number, huaji: number): number => LVBU.sweepRadius[lv(level)] * (1 + LVBU.huaji * huaji);

interface LvbuState { step: number; acts: number; chituAt: number }
const STATE = new WeakMap<Player, LvbuState>();
const state = (pl: Player): LvbuState => { let s = STATE.get(pl); if (!s) { s = { step: 0, acts: 0, chituAt: 0 }; STATE.set(pl, s); } return s; };
/** 测试读：当前循环位（0、1 长突，2 横扫）与出手次数。 */
export function lvbuDebug(pl: Player): { step: number; acts: number } { const s = state(pl); return { step: s.step % 3, acts: s.acts }; }

/** 一条直线上的敌兵（宽 width）：from (x, y) 沿 (ux, uy) 长 len。 */
function lane(host: WeaponHost, x: number, y: number, ux: number, uy: number, len: number, width: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of host.grid.query(x + ux * len / 2, y + uy * len / 2, len / 2 + width)) {
    if (!hittable(e)) continue;
    const dx = e.x - x, dy = e.y - y, along = dx * ux + dy * uy, side = Math.abs(-dx * uy + dy * ux);
    if (along >= -e.radius && along <= len + e.radius && side <= width / 2 + e.radius) out.push(e);
  }
  return out;
}
function shove(e: Enemy, ux: number, uy: number, dist: number): void {
  if (e.kind === 'boss' || e.controlImmune || e.isSupplySlot) return;
  const k = e.kind === 'elite' ? .4 : 1; e.sprite.x += ux * dist * k; e.sprite.y += uy * dist * k;
}
/** 长突特效：手绘戟芒（fx_lvbu_thrust）；缺图时用现成枪芒图 spear_thrust 染金红。 */
function thrustFx(host: WeaponHost, x: number, y: number, ux: number, uy: number, len: number): void {
  const s = sceneOf(host), rot = Math.atan2(uy, ux), cx = x + ux * len / 2, cy = y - 8 + uy * len / 2;
  if (s.textures.exists('fx_lvbu_thrust')) { const im = playSheet(s, 'fx_lvbu_thrust', cx, cy, { size: len + 40, sizeH: 96, ms: 260, depth: 41, add: true, name: 'lvbu-thrust' }); im?.setRotation(rot); return; }
  if (!s.textures.exists('spear_thrust')) return;
  const im = host.add.image(cx, cy, 'spear_thrust', 'tight').setRotation(rot).setDisplaySize(len + 30, 30).setTint(0xffc070).setAlpha(.9).setDepth(41).setBlendMode(1).setName('lvbu-thrust');
  s.tweens.add({ targets: im, alpha: 0, scaleY: im.scaleY * 1.6, duration: 240, onComplete: () => im.destroy() });
}
/** 横扫特效：手绘戟风（fx_lvbu_sweep，旋风环）；缺图时借猛将觉醒手绘冲击环。 */
function sweepFx(host: WeaponHost, x: number, y: number, r: number, storm: boolean): void {
  const s = sceneOf(host), key = s.textures.exists('fx_lvbu_sweep') ? 'fx_lvbu_sweep' : 'fx_awaken_warrior';
  playSheet(s, key, x, y - 6, { size: r * 2.3, ms: storm ? 340 : 300, depth: 41, add: true, name: storm ? 'lvbu-storm' : 'lvbu-sweep', alpha: key === 'fx_lvbu_sweep' ? 1 : .8 });
}

export function lvbuBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), wu = pl.passive.isWushuang(time);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), renzhong = branch === 'lb_renzhong', yuanmen = branch === 'lb_yuanmen';
  // 进阶形态（Lv7 且该派 4 势，同 WeaponBranches.final）：人中吕布 → 转三圈、击杀延长翻倍；辕门射戟 → 掷得更远
  const final = tier >= 3 && (g.build.tags()[renzhong ? 'warrior' : 'archery'] ?? 0) >= 4;
  pl.passive.lvbuExtendMs = renzhong ? LVBU.renzhong.extendMs * (final ? 2 : 1) : 0;
  // 武艺「赤兔」：狂暴时每隔几秒朝前冲刺、穿过沿途敌兵
  const chitu = g.masteries.chitu;
  if (wu && chitu > 0 && time >= st.chituAt && !host.over) {
    const C = LVBU.chitu, hd = Math.hypot(pl.heading.x, pl.heading.y) || 1, ux = pl.heading.x / hd, uy = pl.heading.y / hd;
    st.chituAt = time + C.cdMs[Math.min(2, chitu - 1)];
    const hit = LVBU_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time) * C.mul[Math.min(2, chitu - 1)];
    for (const e of lane(host, pl.x, pl.y, ux, uy, C.len, C.width)) { host.hitEnemy(e, hit, time, 'melee'); shove(e, -uy, ux, 18); }
    pl.knockUp(time, C.ms, ux * C.len, uy * C.len, true);
    host.heroFx?.('dash', pl.x + ux * C.len / 2, pl.y - 6 + uy * C.len / 2, C.len + 90, Math.atan2(uy, ux));
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = smartTarget(host, LVBU.range);
  if (!target) return;
  const level = weapon.level, damage = LVBU_DEF.damage(level, pl.stats) * g.damageMultiplier(time), sweep = st.step % 3 === 2;
  const act = (n: number): void => {
    if (host.over || !pl.alive) return;
    const now = host.combatNow, tx = target.active ? target.x : pl.x + 1, ty = target.active ? target.y : pl.y, d = Math.hypot(tx - pl.x, ty - pl.y) || 1, ux = (tx - pl.x) / d, uy = (ty - pl.y) / d;
    pl.faceDirection(cardinal(ux, uy), 200);
    if (sweep) {
      // 横扫：360° 一圈；「人中吕布」转两圈、更大
      const r = lvbuSweepRadius(level, g.masteries.huaji) * (renzhong ? LVBU.renzhong.radiusMul : 1) * pl.passive.rangeMultiplier('fangtian_ji'), spins = renzhong ? LVBU.renzhong.spins + (final ? 1 : 0) : 1;
      const spin = (j: number): void => {
        if (host.over) return; const t = host.combatNow, px = pl.x, py = pl.y;
        for (const e of host.grid.query(px, py, r + 40)) {
          if (!hittable(e) || Math.hypot(e.x - px, e.y - py) > r + e.radius) continue;
          host.hitEnemy(e, damage * LVBU.sweepMul * (renzhong ? k : 1), t, 'melee');
          const dd = Math.hypot(e.x - px, e.y - py) || 1; shove(e, (e.x - px) / dd, (e.y - py) / dd, LVBU.sweepShove);
        }
        sweepFx(host, px, py, r, renzhong);
        if (j + 1 < spins) host.time.delayedCall(LVBU.renzhong.spinGapMs, () => spin(j + 1));
      };
      spin(0);
      pl.playAction(wu && n === 0 ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
      host.sfx.play('atk_guandao_heavy');
    } else {
      // 长突：一线穿透
      const len = lvbuThrustLen(level) * pl.passive.rangeMultiplier('fangtian_ji');
      for (const e of lane(host, pl.x, pl.y, ux, uy, len, LVBU.thrustWidth)) host.hitEnemy(e, damage * LVBU.thrustMul, now, 'melee');
      thrustFx(host, pl.x, pl.y, ux, uy, len);
      pl.playAction('attack', ux < 0 ? 'left' : ux > 0 ? 'right' : uy < 0 ? 'up' : 'down');
      host.sfx.play('atk_lance');
    }
  };
  act(0);
  if (wu) host.time.delayedCall(LVBU.doubleDelayMs, () => act(1)); // 无双：每次出手打两次
  st.step++; st.acts++;
  // 分支「辕门射戟」：每 5 次出手朝远处掷戟
  if (yuanmen && st.acts % LVBU.yuanmen.every === 0) throwHalberd(host, damage * k, time, final ? LVBU.yuanmen.finalRange : LVBU.yuanmen.range);
  weapon.cooldownLeft = Math.max(.25, LVBU_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time) / (wu ? LVBU.haste : 1));
}

/** 辕门射戟：朝射程内最远的敌兵掷戟，一线敌兵受伤并定身；戟飞到尽头后飞回，沿途再割一次。 */
function throwHalberd(host: WeaponHost, damage: number, time: number, range: number): void {
  const Y = LVBU.yuanmen, pl = host.player, s = sceneOf(host);
  let far: Enemy | null = null, fd = 0;
  for (const e of host.grid.query(pl.x, pl.y, range)) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d <= range && d > fd) { fd = d; far = e; } }
  if (!far) return;
  const ux = (far.x - pl.x) / (fd || 1), uy = (far.y - pl.y) / (fd || 1), x0 = pl.x, y0 = pl.y, len = range;
  for (const e of lane(host, x0, y0, ux, uy, len, Y.width)) { host.hitEnemy(e, damage * Y.mul, time, 'melee'); if (e.kind !== 'boss' && !e.controlImmune) e.stunUntil = Math.max(e.stunUntil, time + Y.stunMs); }
  const flyMs = len / Y.speed * 1000;
  host.time.delayedCall(flyMs, () => {
    if (host.over) return;
    for (const e of lane(host, x0, y0, ux, uy, len, Y.width)) host.hitEnemy(e, damage * Y.backMul, host.combatNow, 'melee');
  });
  // 手绘飞戟（fx_lvbu_halberd，旋转戟 + 红缨）；缺图时借枪芒图
  const key = s.textures.exists('fx_lvbu_halberd') ? 'fx_lvbu_halberd' : s.textures.exists('spear_thrust') ? 'spear_thrust' : '';
  if (!key) return;
  const im = key === 'spear_thrust' ? host.add.image(x0, y0 - 10, key, 'tight').setDisplaySize(80, 22).setTint(0xff8a5a) : host.add.image(x0, y0 - 10, key, 0).setDisplaySize(96, 96);
  im.setRotation(Math.atan2(uy, ux)).setDepth(42).setName('lvbu-halberd');
  s.tweens.add({ targets: im, x: x0 + ux * len, y: y0 - 10 + uy * len, duration: flyMs, yoyo: true, onUpdate: tw => { if (key === 'fx_lvbu_halberd') im.setFrame(Math.floor(tw.elapsed / 60) % 6); }, onComplete: () => im.destroy() });
  host.sfx.play('atk_lance');
}
