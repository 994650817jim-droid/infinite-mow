import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { PASSIVE_RULES as R } from '../data/passives';
import type { WeaponHost } from './registry';
import { SHOW_RANGE_RINGS } from '../ui/RangeRings';
import { HINT_MOCK, SHOW_OWN_RANGE_FX, groundScar } from '../ui/HintStyle';

/**
 * 第二批专属本命武器（2026-11-16，用户确认）：黄忠「宝雕弓」、张飞「当阳喝断」、马超「虎头湛金枪」、刘备「双股剑」。
 * 不再共用黄月英连弩 / 赵云长枪 / 关羽偃月刀。特效全部是程序化过渡方案，正式图见 NEW_HEROES_ASSET_REQUEST.md。
 */
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
/** 选靶 / 触发用：活着且不是可破坏道具。 */
const alive = (e: Enemy): boolean => e.active && !e.isSupplySlot;
/** 结算伤害用：道具（酒罐、木箱、油桶、军旗等）也能被打碎（2026-11-17）；状态与击退仍只对敌人。 */
const hittable = (e: Enemy): boolean => e.active;
/** fx_d 正式序列帧（闭月 / 重箭命中 / 当阳声浪 / 交叉斩，2026-11-16 ChatGPT 生成）是否已加载；缺图时用程序化特效。 */
const fxD = (host: WeaponHost): boolean => sceneOf(host).textures.exists('hero_fx_d');
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
/**
 * 统一索敌（2026-11-16 用户要求）：关卡锁定目标（敌营等）> 首领 > 精锐 > 群怪（身边 80 像素内同伴最多）> 最近。
 * 首领 / 精锐由 GameScene.priorityWeaponTarget 给出；minDist 用于「只打某距离以外」的武器（孙尚香掷刀）。
 */
export function smartTarget(host: WeaponHost, range: number, minDist = 0): Enemy | null {
  const pl = host.player, locked = host.priorityTarget?.(range, false);
  if (locked && Math.hypot(locked.x - pl.x, locked.y - pl.y) >= minDist) return locked;
  const list = host.grid.query(pl.x, pl.y, range + 30).filter(e => alive(e) && e.def.behavior !== 'wall')
    .map(e => ({ e, d: Math.hypot(e.x - pl.x, e.y - pl.y) })).filter(o => o.d <= range + o.e.radius && o.d >= minDist).sort((a, b) => a.d - b.d);
  // 空间网格每帧重建一次：本帧刚生成的敌人还不在网格里，此时退回逐个扫描的最近敌人（不限最小距离时）
  if (!list.length) return minDist > 0 ? null : host.nearestEnemy(pl.x, pl.y, range);
  let best = list[0].e, most = 0;
  for (const { e } of list.slice(0, 40)) {
    let n = 0; for (const o of host.grid.query(e.x, e.y, 80)) if (o !== e && alive(o) && Math.hypot(o.x - e.x, o.y - e.y) <= 80) n++;
    if (n > most) { most = n; best = e; }
  }
  return most >= 2 ? best : list[0].e;
}
/** 普通 / 精锐被推开（首领、免控不动）。 */
function shove(e: Enemy, ux: number, uy: number, dist: number): void {
  if (e.kind === 'boss' || e.controlImmune || e.isSupplySlot) return;
  const k = e.kind === 'elite' ? .4 : 1; e.sprite.x += ux * dist * k; e.sprite.y += uy * dist * k;
}

// ───────────────────────── 黄忠 · 宝雕弓（百步穿杨重箭狙击） ─────────────────────────
export const BAODIAO_DEF = {
  id: 'baodiao_bow' as const, name: '宝雕弓', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [70, 80, 92, 105, 120][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [2.2, 2.1, 2.0, 1.9, 1.8][lv(level)] * stats.cooldownMul,
  desc: '向远处最强的敌人射出重箭，单体重创并击退；首领、精锐优先',
};
interface HeavyArrow { img: Phaser.GameObjects.Image; target: Enemy; spawn: number; damage: number; burst: boolean; pierce: number; hit: Set<number>; ux: number; uy: number; left: number; trail?: Phaser.GameObjects.Sprite; }
const ARROWS = new WeakMap<Player, HeavyArrow[]>();
/** 黄忠每关状态：上一帧是否神射、静心 3 级的三连重箭是否待发、宝刀未老是否已用（每关一次：每关新建 Player）。 */
const HZ = new WeakMap<Player, { wasSharp: boolean; fanReady: boolean; eliteSeen: number }>();
/** 黄忠像素特效图集 huangzhong_fx（6×4，每帧 256，黑底叠加）：0–5 神射爆裂、6–11 进入神射金光、12–17 神射箭金色拖光、18–23 宝刀未老红金火焰。 */
const HZFX = { burst: 0, enter: 6, trail: 12, laoji: 18 } as const;
function hzFx(host: WeaponHost, row: number, x: number, y: number, size: number, fps: number, name: string, loopMs = 0, follow?: Player): Phaser.GameObjects.Sprite | null {
  const scene = sceneOf(host); if (!scene.textures.exists('huangzhong_fx')) return null;
  // 进入神射的光柱、宝刀未老的火焰在图里贴着格子下部（约 0.88 处），跟随人物时把这一点放在脚底
  const s = scene.add.sprite(x, y, 'huangzhong_fx', row).setOrigin(.5, follow ? .88 : .5).setDisplaySize(size, size).setBlendMode('ADD').setDepth(43).setName(name);
  const st = { t: 0 }, frames = loopMs ? Math.max(6, Math.round(loopMs / 1000 * fps)) : 6;
  scene.tweens.add({ targets: st, t: frames - .01, duration: frames / fps * 1000,
    onUpdate: () => { if (!s.active) return; s.setFrame(row + (Math.floor(st.t) % 6)); if (follow) s.setPosition(follow.x, follow.y + 4); },
    onComplete: () => { if (s.active) scene.tweens.add({ targets: s, alpha: 0, duration: 160, onComplete: () => s.destroy() }); } });
  return s;
}
function arrowTexture(host: WeaponHost): string {
  if (sceneOf(host).textures.exists('huangzhong_arrow')) return 'huangzhong_arrow'; // 正式重箭贴图
  const key = 'huangzhong_heavy_arrow', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffd27a, .35).fillRect(0, 4, 30, 4);
  g.fillStyle(0x6a4a24, 1).fillRect(10, 5, 34, 2);
  g.fillStyle(0xe8c070, 1).fillTriangle(44, 1, 44, 11, 56, 6);
  g.fillStyle(0xfff2c0, 1).fillTriangle(6, 2, 12, 6, 6, 10);
  g.generateTexture(key, 56, 12); g.destroy();
  return key;
}
/** 旧选靶（首领 > 精锐 > 最远），已改用统一索敌 smartTarget，保留备查。 */
export function sniperTarget(host: WeaponHost, range: number): Enemy | null {
  const pl = host.player, locked = host.priorityTarget?.(range, false); if (locked) return locked;
  let best: Enemy | null = null, score = -1;
  for (const e of host.grid.query(pl.x, pl.y, range)) {
    if (!alive(e)) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d > range) continue;
    const s = (e.kind === 'boss' ? 3000 : e.kind === 'elite' ? 2000 : 0) + d;
    if (s > score) { score = s; best = e; }
  }
  return best;
}
export function baodiaoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, list = ARROWS.get(pl) ?? []; ARROWS.set(pl, list);
  const g = pl.growth, st = HZ.get(pl) ?? { wasSharp: false, fanReady: false, eliteSeen: pl.passive.sharpEliteKillCount }; HZ.set(pl, st);
  // 静心：进入神射所需不受伤时间 5 → 4.5 / 4 / 3.5 秒
  pl.passive.setCalmMs(R.calmMs - R.jingxinStepMs * g.masteries.jingxin);
  // 老骥伏枥 3 级「宝刀未老」：神射中每射杀一名精锐 / 首领，回复少量生命，且一小段时间内受伤不退出神射
  const eliteKills = pl.passive.sharpEliteKillCount;
  if (eliteKills > st.eliteSeen && g.masteries.laoji >= 3 && pl.alive) {
    pl.heal(pl.maxHp * R.laojiHealMul * (eliteKills - st.eliteSeen)); pl.passive.grantSharp(time, R.laojiGuardMs);
    hzFx(host, HZFX.laoji, pl.x, pl.y + 4, 120, 12, 'huangzhong-laoji', R.laojiGuardMs, pl);
    const t = host.add.text(pl.x, pl.y - 70, '宝刀未老', { fontFamily: 'serif', fontSize: '20px', color: '#ffe0a0', stroke: '#5a1a10', strokeThickness: 5 }).setOrigin(.5).setDepth(60).setName('huangzhong-laoji-text');
    t.scene.tweens.add({ targets: t, y: pl.y - 100, alpha: 0, delay: 600, duration: 600, onComplete: () => t.destroy() });
  }
  st.eliteSeen = eliteKills;
  // 进入神射：人物身上一道金光（像素帧）；静心 3 级时神射第一箭待发三连
  const sharpNow = pl.passive.isSharpshooter(time);
  if (sharpNow && !st.wasSharp) { hzFx(host, HZFX.enter, pl.x, pl.y + 4, 150, 14, 'huangzhong-sharp-enter', 0, pl); if (g.masteries.jingxin >= 3) st.fanReady = true; }
  if (!sharpNow) st.fanReady = false;
  st.wasSharp = sharpNow;
  // 飞行中的重箭：追向目标，命中单体（穿杨 3 级再穿 1 人）
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.target.active && a.target.spawnId === a.spawn && !a.hit.has(a.spawn)) { const d = Math.hypot(a.target.x - a.img.x, a.target.y - a.img.y) || 1; a.ux = (a.target.x - a.img.x) / d; a.uy = (a.target.y - a.img.y) / d; }
    const step = R.heavyArrowSpeed * dt; a.img.x += a.ux * step; a.img.y += a.uy * step; a.left -= step; a.img.setRotation(Math.atan2(a.uy, a.ux));
    a.trail?.setPosition(a.img.x - a.ux * 26, a.img.y - a.uy * 26).setRotation(Math.atan2(a.uy, a.ux));
    // 狙击：先只撞锁定的目标（途中的敌人不挡箭）；目标中箭或已死后，穿杨的余力才会打到路上的敌人
    const locked = a.target.active && a.target.spawnId === a.spawn && !a.hit.has(a.spawn);
    for (const e of host.grid.query(a.img.x, a.img.y, 50)) {
      if (e.active && e.isSupplySlot && !a.hit.has(e.spawnId) && Math.hypot(e.x - a.img.x, e.y - a.img.y) <= 12 + e.radius) { a.hit.add(e.spawnId); host.hitEnemy(e, a.damage, time, 'arrow'); continue; }
      if (!alive(e) || a.hit.has(e.spawnId) || (locked && e !== a.target) || Math.hypot(e.x - a.img.x, e.y - a.img.y) > 12 + e.radius) continue;
      const ex = e.x, ey = e.y; // 爆裂以中箭位置为圆心（击退之前）
      a.hit.add(e.spawnId); host.hitEnemy(e, a.damage, time, 'arrow'); shove(e, a.ux, a.uy, R.heavyArrowKnock);
      if (fxD(host)) host.heroFx?.('heavyHit', ex - a.ux * 30, ey - 8 - a.uy * 30, 130, Math.atan2(a.uy, a.ux));
      else { const flash = host.add.circle(ex, ey - 8, 10, 0xffe6a0, .8).setDepth(42).setBlendMode(1);
        flash.scene.tweens.add({ targets: flash, radius: 34, alpha: 0, duration: 240, onComplete: () => flash.destroy() }); }
      if (a.burst) { // 神射：命中处小范围爆裂
        for (const o of host.grid.query(ex, ey, (R.heavyBurstRadius * host.player.passive.rangeMultiplier('baodiao_bow')) + 30)) if (hittable(o) && o !== e && Math.hypot(o.x - ex, o.y - ey) <= (R.heavyBurstRadius * host.player.passive.rangeMultiplier('baodiao_bow')) + o.radius) host.hitEnemy(o, a.damage * R.heavyBurstMul, time, 'arrow');
        // 神射爆裂：像素爆裂帧是命中特效（不是范围提示），各种提示方案下都播；缺图时旧方案（?hints=old）退回程序化光圈，b 方案留地面裂痕
        if (HINT_MOCK === 'b') groundScar(e.sprite.scene, ex, ey, (R.heavyBurstRadius * host.player.passive.rangeMultiplier('baodiao_bow')), 'crack');
        else if (!hzFx(host, HZFX.burst, ex, ey - 6, (R.heavyBurstRadius * host.player.passive.rangeMultiplier('baodiao_bow')) * 2.6, 22, 'huangzhong-burst') && !HINT_MOCK) { const ring = host.add.circle(ex, ey - 6, 12, 0xffd27a, 0).setStrokeStyle(4, 0xffe6a0, .9).setDepth(42);
        ring.scene.tweens.add({ targets: ring, radius: (R.heavyBurstRadius * host.player.passive.rangeMultiplier('baodiao_bow')), alpha: 0, duration: 300, onComplete: () => ring.destroy() }); }
      }
      if (a.pierce-- <= 0) { a.left = 0; break; }
    }
    if (a.left <= 0 || host.over) { a.img.destroy(); a.trail?.destroy(); list.splice(i, 1); }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = smartTarget(host, R.heavyArrowRange);
  if (!target) return;
  const level = weapon.level;
  const ux = target.x - pl.x, uy = target.y - pl.y, d = Math.hypot(ux, uy) || 1;
  const sharp = pl.passive.isSharpshooter(time);
  // 静心：神射中重箭伤害 +20/22/25%（补回去掉「百步」后的前期单体）
  const damage = BAODIAO_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * (sharp && g.masteries.jingxin ? 1 + R.jingxinSharpMul[g.masteries.jingxin - 1] : 1);
  pl.faceDirection(cardinal(ux, uy), 200);
  if (sharp && time >= pl.nextSkillAction && pl.playAction('skill', ux < 0 ? 'left' : 'right')) pl.nextSkillAction = time + 4000; else pl.playAction('attack', ux < 0 ? 'left' : 'right');
  // 神射箭带金色拖光（像素帧）
  const trail = (): Phaser.GameObjects.Sprite | undefined => { const t = sharp ? hzFx(host, HZFX.trail, pl.x, pl.y - 10, 90, 18, 'huangzhong-trail', 1500) : null; return t?.setDisplaySize(96, 40) ?? undefined; };
  list.push({ img: host.add.image(pl.x, pl.y - 10, arrowTexture(host)).setDisplaySize(58, 15).setDepth(41).setName('huangzhong-heavy-arrow').setBlendMode(sharp ? 1 : 0),
    target, spawn: target.spawnId, damage, burst: sharp, pierce: 0, hit: new Set(), ux: ux / d, uy: uy / d, left: R.heavyArrowRange + 120, trail: trail() });
  // 静心 3 级：进入神射后的第一箭化为扇形三连重箭（两侧各一支，每支 70%、都带爆裂；两侧箭不追踪，打路上的敌人）
  if (sharp && st.fanReady) {
    st.fanReady = false;
    const a0 = Math.atan2(uy, ux);
    for (const side of [-1, 1]) {
      const a = a0 + side * R.fanSpreadRad;
      list.push({ img: host.add.image(pl.x, pl.y - 10, arrowTexture(host)).setDisplaySize(58, 15).setDepth(41).setName('huangzhong-heavy-arrow').setBlendMode(1),
        target, spawn: -1, damage: damage * R.fanMul, burst: true, pierce: 0, hit: new Set(), ux: Math.cos(a), uy: Math.sin(a), left: R.heavyArrowRange + 120, trail: trail() });
    }
    list[list.length - 3].damage = damage * R.fanMul;
  }
  host.sfx.play('allySpear');
  // 老骥伏枥：越战越勇——本关每击杀 10 名敌人射速 +2.5%，上限 15/20/25%
  const laoji = g.masteries.laoji ? 1 + Math.min(R.laojiCap[g.masteries.laoji - 1], Math.floor(pl.passive.kills / R.laojiKillsPerStack) * R.laojiPerStack) : 1;
  weapon.cooldownLeft = Math.max(.4, BAODIAO_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time) / laoji);
}

// ───────────────────────── 张飞 · 当阳喝断（声浪） ─────────────────────────
export const DANGYANG_DEF = {
  id: 'dangyang_roar' as const, name: '丈八蛇矛·当阳喝断', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [22, 25, 28, 32, 36][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.4, 1.4, 1.35, 1.3, 1.25][lv(level)] * stats.cooldownMul,
  desc: '朝前大喝，一道越推越宽的弧形声浪向前推进，伤害并一路推后敌人',
};
interface Wave { x: number; y: number; a: number; half: number; r: number; max: number; damage: number; hit: Set<number>; g: Phaser.GameObjects.Graphics; sprite: boolean; }
interface Bridge { x: number; y: number; until: number; g: Phaser.GameObjects.Graphics; }
const WAVES = new WeakMap<Player, { waves: Wave[]; bridges: Bridge[] }>();
/** 丈八蛇矛矛影（程序化过渡）：蜿蜒矛身 + 矛尖，从身前扫过半圈（断桥时扫一整圈），声浪从矛尖发出。 */
function serpentSpear(host: WeaponHost, x: number, y: number, a: number, full: boolean): void {
  const from = full ? a - Math.PI : a - .9, to = full ? a + Math.PI : a + .9;
  if (sceneOf(host).textures.exists('zhangfei_spear')) { // 正式蛇矛贴图：以握柄为轴扫过
    const sp = host.add.image(x, y, 'zhangfei_spear').setOrigin(.08, .5).setDisplaySize(84, 35).setRotation(from).setDepth(41).setName('zhangfei-spear');
    sp.scene.tweens.add({ targets: sp, rotation: to, duration: full ? 280 : 170, ease: 'Sine.easeOut', onComplete: () => sp.scene.tweens.add({ targets: sp, alpha: 0, duration: 100, onComplete: () => sp.destroy() }) });
    return; // 2026-11-17：去掉程序画的橙色弧形拖影
  }
  const g = host.add.graphics({ x, y }).setDepth(41).setName('zhangfei-spear'), L = 70;
  g.lineStyle(4, 0x3a2a1a, 1); g.beginPath(); g.moveTo(0, 0);
  for (let i = 1; i <= 14; i++) { const t = i / 14; g.lineTo(t * L, Math.sin(t * Math.PI * 3) * 4 * (1 - t * .5)); } g.strokePath();
  g.fillStyle(0xd8dde4, 1).fillTriangle(L, -7, L, 7, L + 26, Math.sin(Math.PI * 3) * 2); // 蛇形矛尖
  g.lineStyle(2, 0xffb060, .9).lineBetween(L + 2, 0, L + 22, 0);
  g.fillStyle(0xc0281e, 1).fillCircle(L - 2, 0, 4); // 红缨
  g.setRotation(from);
  g.scene.tweens.add({ targets: g, rotation: to, duration: full ? 320 : 180, ease: 'Sine.easeOut', onComplete: () => g.scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() }) });
  const ghost = host.add.graphics({ x, y }).setDepth(40.5); ghost.lineStyle(10, 0xffb060, .25).beginPath().arc(0, 0, L + 10, from, to).strokePath();
  ghost.scene.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
}
export const dangyangHalfAngle = (level: number): number => (level >= 3 ? 45 : 35) * Math.PI / 180;
export function dangyangBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, st = WAVES.get(pl) ?? { waves: [], bridges: [] }; WAVES.set(pl, st);
  // 推进中的声浪：每名敌人只吃一次伤害，被声浪边缘一路推后
  for (let i = st.waves.length - 1; i >= 0; i--) {
    const w = st.waves[i]; w.r += R.roarWaveSpeed * dt;
    for (const e of host.grid.query(w.x, w.y, w.r + 40)) {
      if (!hittable(e)) continue;
      const dx = e.x - w.x, dy = e.y - w.y, d = Math.hypot(dx, dy) || 1, off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - w.a), Math.cos(Math.atan2(dy, dx) - w.a)));
      if (off > w.half || d > w.r + e.radius || d < w.r - 40) continue;
      if (!w.hit.has(e.spawnId)) { w.hit.add(e.spawnId); host.hitEnemy(e, w.damage, time, 'melee'); } // 命中即由 hitEnemy 计入怒气
      shove(e, dx / d, dy / d, R.roarWavePush * dt * 60);
    }
    w.g.clear();
    const fade = 1 - w.r / w.max;
    if (!w.sprite) for (let k = 0; k < 3; k++) { const rr = w.r - k * 14; if (rr <= 8) continue; w.g.lineStyle(7 - k * 2, k ? 0xffb060 : 0xff6a3a, .85 * fade).beginPath().arc(w.x, w.y, rr, w.a - w.half, w.a + w.half).strokePath(); }
    if (w.r >= w.max || host.over) { w.g.destroy(); st.waves.splice(i, 1); }
  }
  // 据水断桥：3 秒内敌人进不来
  for (let i = st.bridges.length - 1; i >= 0; i--) {
    const b = st.bridges[i];
    if (time >= b.until || host.over) { b.g.destroy(); st.bridges.splice(i, 1); continue; }
    b.g.setAlpha(.5 + .3 * Math.sin(time / 120));
    for (const e of host.grid.query(b.x, b.y, (R.bridgeRadius * host.player.passive.rangeMultiplier('dangyang_roar')) + 30)) {
      if (!alive(e) || e.kind === 'boss' || e.controlImmune) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1, edge = (R.bridgeRadius * host.player.passive.rangeMultiplier('dangyang_roar')) + e.radius;
      if (d < edge) { e.sprite.x = b.x + dx / d * edge; e.sprite.y = b.y + dy / d * edge; }
    }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const g = pl.growth, level = weapon.level, max = (level >= 5 ? 260 : 220) * (1 + .12 * g.masteries.wanrendi) * host.player.passive.rangeMultiplier('dangyang_roar'); // 智力范围加成
  const target = smartTarget(host, max);
  if (!target) return;
  const cast = pl.passive.beginCast('dangyang_roar');
  const damage = DANGYANG_DEF.damage(level, pl.stats) * g.damageMultiplier(time), a = Math.atan2(target.y - pl.y, target.x - pl.x);
  pl.faceDirection(cardinal(Math.cos(a), Math.sin(a)), 200);
  host.sfx.play('allySlash');
  if (cast.bridge) {
    // 据水断桥：360° 喝断，震慑周围（首领只受伤），并留下 3 秒敌人进不来的断桥区
    pl.playAction('skill', Math.cos(a) < 0 ? 'left' : 'right');
    const stun = R.roarStunMs + 200 * g.masteries.dahe;
    for (const e of host.grid.query(pl.x, pl.y, (R.roarRadius * host.player.passive.rangeMultiplier('dangyang_roar')) + 40)) {
      if (!hittable(e) || Math.hypot(e.x - pl.x, e.y - pl.y) > (R.roarRadius * host.player.passive.rangeMultiplier('dangyang_roar')) + e.radius) continue;
      host.hitEnemy(e, damage * R.roarDamageMul, time, 'melee');
      if (!e.controlImmune && e.kind !== 'boss' && !e.isSupplySlot) e.stunUntil = Math.max(e.stunUntil, time + stun);
    }
    host.heroFx?.('roar', pl.x, pl.y - 10, (R.roarRadius * host.player.passive.rangeMultiplier('dangyang_roar')) * 1.7); // 2026-11-17「太夸张」：2.6 → 1.7
    const bg = host.add.graphics().setDepth(18.8).setName('zhangfei-bridge');
    if (SHOW_OWN_RANGE_FX) bg.fillStyle(0xff8a3c, .12).fillCircle(pl.x, pl.y, (R.bridgeRadius * host.player.passive.rangeMultiplier('dangyang_roar')));
    if (HINT_MOCK === 'b') groundScar(bg.scene, pl.x, pl.y, (R.bridgeRadius * host.player.passive.rangeMultiplier('dangyang_roar')), 'crack', 0, 360); // 断桥区：默认只铺淡淡一层，?rings=1 时加描边范围圈
    if (SHOW_RANGE_RINGS) bg.lineStyle(4, 0xffb060, .8).strokeCircle(pl.x, pl.y, (R.bridgeRadius * host.player.passive.rangeMultiplier('dangyang_roar')));
    st.bridges.push({ x: pl.x, y: pl.y, until: time + R.bridgeMs + 500 * g.masteries.dahe, g: bg });
    host.cameras.main.shake(120, .003);
  } else pl.playAction('attack', Math.cos(a) < 0 ? 'left' : 'right');
  serpentSpear(host, pl.x, pl.y - 8, a, !!cast.bridge);
  const sprite = fxD(host); // 正式声浪序列帧（朝右，按出手方向旋转）；判定仍由下面的弧形声浪负责
  if (sprite) host.heroFx?.('roarWave', pl.x + Math.cos(a) * (max * .4), pl.y - 8 + Math.sin(a) * (max * .4), max * .72, a); // 2026-11-17「太夸张」：1.05 → 0.72，并调淡调短
  st.waves.push({ x: pl.x + Math.cos(a) * 46, y: pl.y - 4 + Math.sin(a) * 46, a, half: dangyangHalfAngle(level), r: 24, max, damage, hit: new Set(), g: host.add.graphics().setDepth(41).setName('zhangfei-wave'), sprite });
  weapon.cooldownLeft = Math.max(.3, DANGYANG_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}

// ───────────────────────── 马超 · 虎头湛金枪（枪挑破阵，2026-11-16 用户选方案一） ─────────────────────────
// 普攻：把目标挑飞 0.6 秒（首领 / 免控只受伤），落地砸出范围伤害。被动「西凉铁骑」：命中积层，满层后下一枪化为向前冲锋。
export const ZHANJIN_DEF = {
  id: 'zhanjin_lance' as const, name: '虎头湛金枪', maxLevel: 5,
  /** 落地范围伤害；挑起的那一下为 liftHitMul。 */
  damage: (level: number, stats: PlayerStats) => [26, 29, 33, 37, 42][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.3, 1.3, 1.25, 1.2, 1.15][lv(level)] * stats.cooldownMul,
  desc: '一枪把敌人挑飞，落地时砸出范围伤害；铁骑满层后向前冲锋破阵',
};
export const zhanjinLandRadius = (level: number, jinma: number): number => R.landRadius * (1 + (level >= 3 ? .1 : 0) + .15 * jinma);
/** 冲锋无敌：身后几道淡金残影；之后「铁骑余威」：身上一层很淡的金色护体微光（随人物、轻轻明灭），快结束时闪一下。不画地面圈。 */
function chargeGuardFx(host: WeaponHost, pl: Player): void {
  const scene = sceneOf(host), body = pl.sprite;
  for (let k = 0; k < 4; k++) host.time.delayedCall(k * 55, () => {
    if (!body.active) return;
    const g = scene.add.image(body.x, body.y, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY).setDisplaySize(body.displayWidth, body.displayHeight).setFlipX(body.flipX)
      .setTintFill(0xffe6a0).setBlendMode(1).setAlpha(.45).setDepth(body.depth - .01).setName('machao-invuln-ghost');
    scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  });
  host.time.delayedCall(R.chargeMs + 60, () => {
    if (!body.active) return;
    const glow = scene.add.image(body.x, body.y, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY).setDisplaySize(body.displayWidth, body.displayHeight)
      .setTintFill(0xffd77a).setBlendMode(1).setAlpha(.18).setDepth(body.depth + .001).setName('machao-guard-glow');
    const st = { t: 0 }, total = R.chargeGuardMs;
    scene.tweens.add({ targets: st, t: 1, duration: total,
      onUpdate: () => { if (!body.active || !glow.active) return; const left = total * (1 - st.t);
        glow.setPosition(body.x, body.y).setTexture(body.texture.key, body.frame.name).setDisplaySize(body.displayWidth, body.displayHeight).setFlipX(body.flipX).setDepth(body.depth + .001)
          .setAlpha(left < 350 ? (Math.floor(left / 70) % 2 ? .45 : .1) : .14 + .06 * Math.sin(st.t * Math.PI * 8)); },
      onComplete: () => glow.destroy() });
  });
}
/** 马超手绘特效图集 machao_paint（6×4，每帧 256，透明底；2026-11-17 Gemini 出图，替换原像素图集 machao_fx）：0–5 上挑弧光、6–11 落地砸地、12–17 冲锋尘土拖影、18–23 枪尖破风。 */
const MCFX = { lift: 0, land: 6, dust: 12, wind: 18 } as const;
function mcFx(host: WeaponHost, row: number, x: number, y: number, w: number, h: number, fps: number, name: string, rot = 0, loops = 1, depth = 41): Phaser.GameObjects.Sprite | null {
  const scene = sceneOf(host); if (!scene.textures.exists('machao_paint')) return null;
  const s = scene.add.sprite(x, y, 'machao_paint', row).setDisplaySize(w, h).setRotation(rot).setDepth(depth).setName(name);
  const st = { t: 0 };
  scene.tweens.add({ targets: st, t: 6 * loops - .01, duration: 6 * loops / fps * 1000, onUpdate: () => { if (s.active) s.setFrame(row + (Math.floor(st.t) % 6)); }, onComplete: () => s.destroy() });
  return s;
}
function landSlam(host: WeaponHost, x: number, y: number, radius: number, damage: number, time: number, echo: boolean): void {
  for (const e of host.grid.query(x, y, radius + 30)) if (hittable(e) && Math.hypot(e.x - x, e.y - y) <= radius + e.radius) host.hitEnemy(e, damage, time, 'melee');
  // 落地：一小团像素扬尘碎石（2026-11-16 用户：「砸下来的特效太夸张了」→ 尺寸减半、0.25 秒播完、半透明、不震屏）；名字 machao-land-fx 供测试检查；缺图时退回程序化尘点
  const landFx = mcFx(host, MCFX.land, x, y - 4, radius * 1.3, radius * 1.3, 24, 'machao-land-fx', 0, 1, 40);
  landFx?.setAlpha(.8);
  if (!HINT_MOCK) { const ring = host.add.circle(x, y, 10, 0xffe08a, 0).setStrokeStyle(5, 0xffd27a, .9).setDepth(41).setName('machao-land');
  ring.scene.tweens.add({ targets: ring, radius, alpha: 0, duration: 260, onComplete: () => ring.destroy() }); }
  else if (HINT_MOCK === 'b') groundScar(host.player.sprite.scene, x, y, radius, 'crack');
  if (!landFx) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.random() * .4, dust = host.add.circle(x, y, 4, 0xb89a6a, .8).setDepth(40).setName('machao-land-fx');
    dust.scene.tweens.add({ targets: dust, x: x + Math.cos(a) * radius * .8, y: y + Math.sin(a) * radius * .5, alpha: 0, duration: 360, onComplete: () => dust.destroy() }); }
  if (echo) host.time.delayedCall(260, () => { if (!host.over) landSlam(host, x, y, radius * 1.2, damage * .5, host.combatNow, false); });
}
export function zhanjinBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pl = host.player, g = pl.growth, level = weapon.level;
  const target = smartTarget(host, R.liftRange);
  if (!target) return;
  const damage = ZHANJIN_DEF.damage(level, pl.stats) * g.damageMultiplier(time), tx0 = target.x - pl.x, ty0 = target.y - pl.y, d0 = Math.hypot(tx0, ty0) || 1;
  const cast = pl.passive.beginCast('zhanjin_lance');
  // 2026-11-16 用户：「马超被动是朝着头前冲锋」→ 冲锋朝最近一次移动的方向（键盘 / 手柄一样），挑飞仍朝目标
  // 冲锋方向（2026-11-17 统筹定方案 A）：头前 ±45°、冲锋距离内有敌人就朝头前冲（用户要的「朝着头前冲锋」）；
  // 头前没有敌人就转向目标冲，免得放风筝时冲锋扫空（92bdb4b 后 2-3 DPS 500+ → 177）
  const hd = Math.hypot(pl.heading.x, pl.heading.y) || 1, hx = pl.heading.x / hd, hy = pl.heading.y / hd;
  const reach = R.chargeLen * (1 + .2 * g.masteries.tieqi) + R.chargeWidth;
  const ahead = cast.charge && host.grid.query(pl.x + hx * reach / 2, pl.y + hy * reach / 2, reach / 2 + 60).some(e => {
    if (!alive(e)) return false; const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy) || 1;
    return d <= reach + e.radius && (dx * hx + dy * hy) / d >= Math.cos(Math.PI / 4);
  });
  const ux = cast.charge && ahead ? hx : tx0 / d0, uy = cast.charge && ahead ? hy : ty0 / d0;
  pl.faceDirection(cardinal(ux, uy), 200);
  host.sfx.play('allySpear');
  if (cast.charge) {
    // 锦马冲锋：朝头前突进，沿途重创并把敌人撞向两侧（借用受击位移平滑移动主将）
    pl.playAction('skill', ux < 0 ? 'left' : ux > 0 ? 'right' : uy < 0 ? 'up' : 'down');
    const len = R.chargeLen * (1 + .2 * g.masteries.tieqi), px = pl.x, py = pl.y, hit = damage * R.chargeDamageMul * (1 + .1 * g.masteries.tieqi);
    for (const e of host.grid.query(px + ux * len / 2, py + uy * len / 2, len / 2 + R.chargeWidth)) {
      if (!hittable(e)) continue;
      const dx = e.x - px, dy = e.y - py, along = dx * ux + dy * uy, side = dx * -uy + dy * ux;
      if (along < -e.radius || along > len + e.radius || Math.abs(side) > R.chargeWidth / 2 + e.radius) continue;
      host.hitEnemy(e, hit, time, 'melee'); shove(e, -uy * Math.sign(side || 1), ux * Math.sign(side || 1), 28);
    }
    pl.knockUp(time, R.chargeMs, ux * len, uy * len, true);
    // 冲锋全程无敌，之后 2 秒「铁骑余威」减伤（用户定）
    pl.passive.startChargeGuard(time, R.chargeMs + 60, R.chargeGuardMs);
    chargeGuardFx(host, pl);
    host.heroFx?.('dash', px + ux * len / 2, py - 6 + uy * len / 2, len + 110, Math.atan2(uy, ux));
    const trail = host.add.image(px + ux * len / 2, py - 6 + uy * len / 2, 'spear_thrust', 'tight').setRotation(Math.atan2(uy, ux)).setDisplaySize(len + 40, 34).setTint(0xffe08a).setAlpha(.85).setDepth(41).setName('machao-charge');
    trail.scene.tweens.add({ targets: trail, alpha: 0, duration: 320, onComplete: () => trail.destroy() });
    host.cameras.main.shake(110, .004);
    // 冲锋像素特效：身后一道贴地尘土拖影 + 枪尖破风（都朝冲锋方向），跟着主将走
    const rot = Math.atan2(uy, ux);
    const dust = mcFx(host, MCFX.dust, px, py + 18, 200, 100, 22, 'machao-charge-dust', rot, 2, 39);
    const wind = mcFx(host, MCFX.wind, px + ux * 40, py - 8 + uy * 40, 120, 80, 24, 'machao-charge-wind', rot, 2, 42);
    if (dust || wind) { const fx0 = { t: 0 }; sceneOf(host).tweens.add({ targets: fx0, t: 1, duration: R.chargeMs + 120, onUpdate: () => {
      dust?.active && dust.setPosition(pl.x - ux * 70, pl.y + 18 - uy * 70); wind?.active && wind.setPosition(pl.x + ux * 46, pl.y - 8 + uy * 46); } }); }
  } else {
    // 枪挑：先一枪挑起（liftHitMul），0.6 秒后落地砸出范围伤害
    pl.playAction('attack', ux < 0 ? 'left' : 'right');
    host.hitEnemy(target, damage * R.liftHitMul, time, 'melee');
    const tx = target.x, ty = target.y, spawn = target.spawnId, liftable = target.kind !== 'boss' && !target.controlImmune;
    // 挑：枪尖上挑的银金弧光（像素帧，左右按目标方向翻转）；缺图时退回枪影
    const arc = mcFx(host, MCFX.lift, tx - ux * 10, ty - 30, 120, 120, 26, 'machao-lift-fx', 0, 1, 42);
    if (arc) arc.setFlipX(ux < 0);
    else { const s = host.add.image(pl.x + ux * 40, pl.y - 10 + uy * 40, 'spear_thrust', 'tight').setRotation(Math.atan2(uy, ux) - .5).setDisplaySize(90, 20).setTint(0xffe08a).setDepth(41);
      s.scene.tweens.add({ targets: s, rotation: Math.atan2(uy, ux) - 1.2, alpha: 0, duration: 220, onComplete: () => s.destroy() }); }
    // 脚下扬起一小团尘土（落地帧的前段，缩小）
    mcFx(host, MCFX.land, tx, ty + 4, 70, 70, 20, 'machao-lift-dust', 0, 1, 40);
    if (liftable) {
      target.stunUntil = Math.max(target.stunUntil, time + R.liftMs);
      const sp = target.sprite, y0 = sp.y, rot0 = sp.rotation, spin = (ux < 0 ? -1 : 1) * .5;
      // 被挑的敌人：身上一闪（白色剪影）、腾空时带一点旋转和两道残影，落下时摆正
      const flash = host.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setDisplaySize(sp.displayWidth, sp.displayHeight).setFlipX(sp.flipX)
        .setTintFill(0xffffff).setBlendMode(1).setAlpha(.9).setDepth(sp.depth + .01).setName('machao-lift');
      flash.scene.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
      sp.scene.tweens.add({ targets: sp, y: y0 - 44, rotation: rot0 + spin, duration: R.liftMs / 2, yoyo: true, ease: 'Quad.easeOut', onComplete: () => { if (target.active) sp.setRotation(rot0); } });
      for (const k of [1, 2]) host.time.delayedCall(k * 90, () => {
        if (!target.active || target.spawnId !== spawn) return;
        const ghost = host.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setDisplaySize(sp.displayWidth, sp.displayHeight).setFlipX(sp.flipX).setRotation(sp.rotation)
          .setTint(0xffe8b0).setAlpha(.35).setDepth(sp.depth - .01).setName('machao-lift-ghost');
        ghost.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      });
    }
    host.time.delayedCall(R.liftMs, () => {
      if (host.over) return;
      const lx = target.active && target.spawnId === spawn ? target.x : tx, ly = target.active && target.spawnId === spawn ? target.y : ty;
      landSlam(host, lx, ly, zhanjinLandRadius(level, g.masteries.jinma) * host.player.passive.rangeMultiplier('zhanjin_lance'), damage, host.combatNow, g.masteries.jinma >= 3);
    });
  }
  weapon.cooldownLeft = Math.max(.3, ZHANJIN_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}

// ───────────────────────── 刘备 · 双股剑（双剑分击） ─────────────────────────
export const SHUANGGU_DEF = {
  id: 'shuanggu_swords' as const, name: '双股剑', maxLevel: 5,
  // 2026-11-16 用户要求加强：伤害 +20%、间隔 1.1 → 1.0 秒
  damage: (level: number, stats: PlayerStats) => [24, 28, 31, 35, 40][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.0, 1.0, .95, .9, .85][lv(level)] * stats.cooldownMul,
  desc: '双剑同时出手，分别在两名敌人身上斩出「×」形交叉斩；仁德满层时攻速提高',
};
export const shuangguSplash = (level: number, taoyuan: number): number => R.crossSplash + (level >= 3 ? 10 : 0) + 10 * taoyuan;
function crossFx(host: WeaponHost, x: number, y: number, size: number, color: number): void {
  const g = host.add.graphics().setDepth(42).setName('liubei-cross');
  g.lineStyle(5, color, .95).lineBetween(x - size, y - size, x + size, y + size).lineBetween(x - size, y + size, x + size, y - size);
  g.lineStyle(2, 0xffffff, .9).lineBetween(x - size * .7, y - size * .7, x + size * .7, y + size * .7).lineBetween(x - size * .7, y + size * .7, x + size * .7, y - size * .7);
  g.scene.tweens.add({ targets: g, alpha: 0, scale: 1.15, duration: 220, onComplete: () => g.destroy() });
}
/** 刘备仁德触发后的攻速加成截止时间（每个主将一份）。 */
const LIUBEI_HASTE = new WeakMap<Player, number>();
export const liubeiHasteActive = (p: Player, now: number): boolean => (LIUBEI_HASTE.get(p) ?? 0) > now;
export function shuangguBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pl = host.player, g = pl.growth, level = weapon.level, range = R.swordsRange;
  const foes = host.grid.query(pl.x, pl.y, range + 30).filter(e => alive(e) && Math.hypot(e.x - pl.x, e.y - pl.y) <= range + e.radius)
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  if (!foes.length) return;
  const first = smartTarget(host, range); if (first && foes.includes(first)) { foes.splice(foes.indexOf(first), 1); foes.unshift(first); }
  const cast = pl.passive.beginCast('shuanggu_swords');
  const damage = SHUANGGU_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * cast.damageMul, splash = shuangguSplash(level, g.masteries.taoyuan) * host.player.passive.rangeMultiplier('shuanggu_swords'); // 智力范围加成
  const targets = foes.slice(0, g.masteries.taoyuan >= 3 ? 3 : 2), colors = [0x8fe0c0, 0xffd27a, 0xffffff];
  if (cast.heal) pl.heal(pl.maxHp * cast.heal * (1 + .25 * g.masteries.xiemin));
  if (cast.empowered) { LIUBEI_HASTE.set(pl, time + R.liubeiHasteMs); const aura = host.add.circle(pl.x, pl.y - 10, 30, 0xffd890, .25).setBlendMode(1).setDepth(41).setName('liubei-haste'); aura.scene.tweens.add({ targets: aura, radius: 70, alpha: 0, duration: 500, onComplete: () => aura.destroy() }); }
  if (cast.rally) { host.rallyAllies?.(cast.rally * (1 + .25 * g.masteries.xiemin)); host.heroFx?.('rally', pl.x, pl.y - 20, 260); }
  const u = targets[0], ux = u.x - pl.x, uy = u.y - pl.y;
  pl.faceDirection(cardinal(ux, uy), 140); pl.playAction(cast.empowered ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
  host.sfx.play('allySlash');
  const struck = new Set<number>();
  targets.forEach((t, i) => {
    if (fxD(host)) host.heroFx?.('crossSlash', t.x, t.y - 8, 70 + splash * 1.2, i ? Math.PI / 2 : 0); else crossFx(host, t.x, t.y - 6, 18 + splash * .3, colors[i]);
    if (host.hitEnemy(t, damage, time, 'melee')) pl.passive.recordHit(cast, t, time);
    struck.add(t.spawnId);
    for (const o of host.grid.query(t.x, t.y, splash + 30)) if (hittable(o) && o !== t && !struck.has(o.spawnId) && Math.hypot(o.x - t.x, o.y - t.y) <= splash + o.radius) { struck.add(o.spawnId); host.hitEnemy(o, damage * R.crossSplashMul, time, 'melee'); }
  });
  // 只有一个目标时，第二把剑补砍同一人（60%）
  if (targets.length === 1) host.hitEnemy(targets[0], damage * .6, time, 'melee');
  weapon.cooldownLeft = Math.max(.25, SHUANGGU_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time) / (liubeiHasteActive(pl, time) ? 1 + R.liubeiHaste : 1));
}
