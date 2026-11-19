import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { ZG_TIANHUO as Z } from '../data/heroMechanics';
import type { WeaponHost } from './registry';
import { smartTarget } from './heroWeapons2';
import { playSheet } from '../systems/SkillFxSheets';

/**
 * 诸葛亮「七星灯 · 天火」（2026-11-18 重做，用户选方案 A；参数 data/heroMechanics.ts ZG_TIANHUO）。武器 id 仍为 flame_banner（存档 / 技艺 / 随行都沿用）。
 * 出手：目标脚下标星位（跟着目标走）→ delayMs 后天火落下，单体重创 + 小范围溅射；被动「观星」在 CharacterPassives（starLand）。
 * 技艺：借东风（每第 4 发放东风火龙直线扫过、顺风吹开敌人）、八阵图（观星爆发处布阵：减速 / 易伤 / 3 级首领出招变慢）。
 * 特效：手绘序列帧 zhuge_tianhuo（星位 / 天火 / 东风 / 八阵，缺图时退回现有手绘火焰帧 flame_burst / fire_sigil，不画程序特效）。
 */
// 测试钩子（只在开发版）：测试要改的是游戏实际在用的那份 ZG_TIANHUO。dev server 热更新过后，测试自己 import('/src/data/heroMechanics.ts')
// 拿到的是另一份模块（游戏那份带 ?t=），改了不生效。游戏先载入，??= 保住游戏那份，测试后来 import 的不会覆盖。
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __zgTuning?: typeof Z }).__zgTuning ??= Z;
export const TIANHUO_DEF = {
  id: 'flame_banner' as const, name: '七星灯 · 天火', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => Z.base * (1 + Z.perLevel * (level - 1)) * stats.damageMul * stats.fireMul,
  cooldown: (level: number, stats: PlayerStats) => Z.cooldown * stats.cooldownMul / (1 + Z.cdPerLevel * (level - 1)),
  desc: '观星定位，天火落下：首领 / 精锐单点重创；没有时落进怪堆中心大范围溅射；算无遗策那一发留下星火焦土，久烧范围内所有敌人',
};
/** 手绘图集 zhuge_tianhuo 的行起点（每行 8 格，每格 256）：星位 6 帧、天火 8 帧、东风火龙 6 帧（横条在 zhuge_eastwind）、八阵地面 6 帧。 */
export const ZGFX = { star: 0, fall: 8, bazhen: 16 } as const;
interface Strike { target: Enemy; spawn: number; x: number; y: number; at: number; damage: number; mark: Phaser.GameObjects.GameObject | null; /** 打的是杂兵（怪堆）：溅射加大 */ crowd: boolean; /** 出手时场上没有首领 / 精锐：观星按怪堆积层（每发都积） */ crowdStars: boolean; }
interface Zone { x: number; y: number; r: number; until: number; level: number; fx: Phaser.GameObjects.GameObject | null; }
/** 天火余烬：算无遗策落地处的星火焦土（谁都烧；首领 / 精锐按 bossMul） */
interface Ember { x: number; y: number; r: number; until: number; next: number; /** 天火单发伤害（每跳 × mul / bossMul） */ base: number; }
const STATE = new WeakMap<Player, { strikes: Strike[]; casts: number; zones: Zone[]; embers: Ember[]; sinceWind: number }>();
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const alive = (e: Enemy): boolean => e.active && !e.isSupplySlot;
const art = (host: WeaponHost): boolean => sceneOf(host).textures.exists('zhuge_tianhuo');
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');

/**
 * 选靶（2026-11-18 用户：「打不到集群的怪堆」后改）：关卡锁定 / 首领 / 精锐照旧单点（观星积层）；
 * 没有首领 / 精锐时用通用 smartTarget 的「群怪」规则——身边 80 像素内同伴最多的敌人（打进怪堆中心），都落单时打最近的。
 */
export function tianhuoTarget(host: WeaponHost, range: number): Enemy | null { return smartTarget(host, range); }
/** 这一发是不是打杂兵（不是首领 / 精锐 / 关卡锁定目标）：溅射按怪堆数值。 */
const isCrowdShot = (host: WeaponHost, e: Enemy, range: number): boolean => e.kind !== 'boss' && e.kind !== 'elite' && host.priorityTarget?.(range, false) !== e;
/** 借东风方向：16 个候选方向里，火龙直线带内敌人最多的一个（首领 / 精锐加权）；都没有时朝目标。 */
function densestDir(host: WeaponHost, len: number, half: number, fallback: { x: number; y: number }): { x: number; y: number } {
  const pl = host.player, near = host.grid.query(pl.x, pl.y, len + 40).filter(e => alive(e) && Math.hypot(e.x - pl.x, e.y - pl.y) <= len + e.radius);
  let best = fallback, score = 0;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 2 * i / 16, ux = Math.cos(a), uy = Math.sin(a); let n = 0;
    for (const e of near) { const ex = e.x - pl.x, ey = e.y - pl.y, along = ex * ux + ey * uy; if (along < -e.radius || along > len + e.radius || Math.abs(ex * -uy + ey * ux) > half + e.radius) continue; n += e.kind === 'boss' ? 3 : e.kind === 'elite' ? 2 : 1; }
    if (n > score) { score = n; best = { x: ux, y: uy }; }
  }
  return best;
}
/** 循环播放某一行序列帧（手绘图集）；loop=false 时播一遍后销毁。 */
function playRow(host: WeaponHost, key: string, row: number, frames: number, x: number, y: number, w: number, h: number, fps: number, loop: boolean, name: string, depth: number, add = true): Phaser.GameObjects.Sprite {
  const scene = sceneOf(host), s = scene.add.sprite(x, y, key, row).setDisplaySize(w, h).setDepth(depth).setName(name);
  if (add) s.setBlendMode('ADD');
  const st = { t: 0 };
  scene.tweens.add({ targets: st, t: frames - .01, duration: frames / fps * 1000, repeat: loop ? -1 : 0, onUpdate: () => { if (s.active) s.setFrame(row + Math.floor(st.t)); }, onComplete: () => { if (!loop && s.active) s.destroy(); } });
  return s;
}
/**
 * 天火余烬画面：手绘 8 帧 zhuge_ember（0–1 星纹烧进地面、2–5 灼烧循环、6–7 余火熄灭），压扁贴地铺满余烬圈，持续 ms。
 * 缺图时退回现有手绘地火 fx_ground_fire（5 簇），不画程序特效。
 */
function emberFx(host: WeaponHost, x: number, y: number, r: number, ms: number): void {
  const scene = sceneOf(host);
  if (!scene.textures.exists('zhuge_ember')) {
    for (const [fx, fy] of [[0, 0], [.55, 0], [-.55, 0], [0, .4], [0, -.4]]) playSheet(scene, 'fx_ground_fire', x + fx * r, y + fy * r, { size: r * .75, ms, depth: 18.7, alpha: .85, originY: .75, name: 'zhuge-ember' });
    return;
  }
  // 每格 256 里椭圆约宽 194、中心在 55% 高处（tools/build-zhuge-extra-fx.mjs）：统一缩放让椭圆宽 = 2r
  const s = scene.add.sprite(x, y, 'zhuge_ember', 0).setDisplaySize(r * 2.64, r * 2.64).setOrigin(.5, .55).setDepth(18.7).setBlendMode('ADD').setName('zhuge-ember');
  const IGNITE = 260, FADE = 420, LOOP_FRAME = 120;
  scene.tweens.addCounter({ from: 0, to: ms, duration: ms, onUpdate: tw => {
    if (!s.active) return; const t = tw.getValue() ?? 0;
    s.setFrame(t < IGNITE ? (t < IGNITE / 2 ? 0 : 1) : t > ms - FADE ? (t > ms - FADE / 2 ? 7 : 6) : 2 + Math.floor((t - IGNITE) / LOOP_FRAME) % 4);
    s.setAlpha(t > ms - FADE ? Math.max(0, (ms - t) / FADE) : 1);
  }, onComplete: () => { if (s.active) s.destroy(); } });
}
/** 星位预警：跟着目标的手绘星位圈（缺图时用现有火阵地纹 fire_sigil，压扁贴地）。 */
function starMark(host: WeaponHost, x: number, y: number): Phaser.GameObjects.GameObject | null {
  const scene = sceneOf(host);
  if (art(host)) return playRow(host, 'zhuge_tianhuo', ZGFX.star, 6, x, y + 4, 96, 54, 9, true, 'zhuge-star-mark', 19.5);
  if (scene.textures.exists('fire_sigil')) {
    const m = scene.add.image(x, y + 4, 'fire_sigil').setDisplaySize(84, 42).setAlpha(.75).setBlendMode('ADD').setDepth(19.5).setName('zhuge-star-mark');
    scene.tweens.add({ targets: m, alpha: .35, yoyo: true, repeat: -1, duration: 200 });
    return m;
  }
  return null;
}
/** 天火落下：手绘 8 帧（缺图时用现有火焰爆发 flame_burst）。 */
function fallFx(host: WeaponHost, x: number, y: number, burst: boolean): void {
  if (art(host)) { const size = burst ? 190 : 150, s = playRow(host, 'zhuge_tianhuo', ZGFX.fall, 8, x, y, size, size, 20, false, 'zhuge-tianhuo-fall', 43); s.setOrigin(.5, .82); return; }
  host.spawnFlameFx(x, y, Z.splashRadius * (burst ? 1.6 : 1.25));
}
/**
 * 东风火龙：手绘横条 6 帧（zhuge_eastwind，单行 6 帧、每帧 512×128）；缺图时沿线三处火焰爆发。
 * 2026-11-18 晚 用户：「借东风也加点东风特效」——火龙下面先卷起一股东风（手绘 8 帧 zhuge_wind：风痕 + 火星 + 灰烬枯叶顺着扫的方向飞），
 * 比火龙略长略宽、早 60 毫秒起、晚一点散，火龙像乘风而出。缺这张图时只放火龙。
 */
function eastWindFx(host: WeaponHost, x: number, y: number, ux: number, uy: number, len: number): void {
  const scene = sceneOf(host), rot = Math.atan2(uy, ux);
  if (scene.textures.exists('zhuge_wind')) {
    const wl = len * 1.2, w = scene.add.sprite(x + ux * len * .45, y + uy * len * .45, 'zhuge_wind', 0).setDisplaySize(wl, wl / 4 * 1.1).setRotation(rot).setBlendMode('ADD').setDepth(41.9).setAlpha(.9).setName('zhuge-wind');
    const wt = { t: 0 }; scene.tweens.add({ targets: wt, t: 7.99, duration: 640, onUpdate: () => { if (w.active) w.setFrame(Math.floor(wt.t)); }, onComplete: () => w.destroy() });
  }
  if (scene.textures.exists('zhuge_eastwind')) {
    const s = scene.add.sprite(x + ux * len / 2, y + uy * len / 2, 'zhuge_eastwind', 0).setDisplaySize(len, len / 4).setRotation(rot).setBlendMode('ADD').setDepth(42).setName('zhuge-eastwind');
    const st = { t: 0 }; scene.tweens.add({ targets: st, t: 5.99, duration: 420, onUpdate: () => { if (s.active) s.setFrame(Math.floor(st.t)); }, onComplete: () => s.destroy() });
    return;
  }
  for (let k = 1; k <= 3; k++) host.time.delayedCall(k * 70, () => { if (!host.over) host.spawnFlameFx(x + ux * len * k / 3.4, y + uy * len * k / 3.4, 38); });
}

export function tianhuoBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth;
  const st = STATE.get(pl) ?? { strikes: [], casts: 0, zones: [], embers: [], sinceWind: 0 }; STATE.set(pl, st);
  // 天火余烬：每 tickMs 烧一下圈里所有敌人（首领 / 精锐按 bossMul）
  for (let i = st.embers.length - 1; i >= 0; i--) {
    const em = st.embers[i];
    if (host.over || time > em.until + 1) { st.embers.splice(i, 1); continue; }
    if (time < em.next) continue;
    em.next += Z.ember.tickMs;
    for (const e of host.grid.query(em.x, em.y, em.r + 40)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - em.x, e.y - em.y) > em.r + e.radius) continue;
      host.hitEnemy(e, em.base * (e.kind === 'boss' || e.kind === 'elite' ? Z.ember.bossMul : Z.ember.mul), time, 'fire');
    }
  }
  // 八阵图：阵内非首领减速；3 级时阵内首领出招间隔变长（ArcBossV2 系首领读 gapSlow*）；易伤在 CharacterPassives.vulnerability
  for (let i = st.zones.length - 1; i >= 0; i--) {
    const z = st.zones[i];
    if (time >= z.until || host.over) { z.fx?.destroy(); st.zones.splice(i, 1); continue; }
    for (const e of host.grid.query(z.x, z.y, z.r + 40)) {
      if (!alive(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.radius) continue;
      if (e.kind === 'boss') { if (z.level >= 3) { e.gapSlowMul = Z.bazhen.bossGapMul; e.gapSlowUntil = time + 120; } continue; }
      const k = 1 - Z.bazhen.slow * (e.kind === 'elite' ? .6 : 1);
      e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, k); e.martialSlowUntil = time + 120;
    }
  }
  // 星位跟着目标；到点天火落下
  for (let i = st.strikes.length - 1; i >= 0; i--) {
    const s = st.strikes[i], live = s.target.active && s.target.spawnId === s.spawn;
    if (live) { s.x = s.target.x; s.y = s.target.y; (s.mark as Phaser.GameObjects.Sprite | null)?.setPosition?.(s.x, s.y + 4); }
    if (time < s.at && !host.over) continue;
    st.strikes.splice(i, 1); s.mark?.destroy();
    if (host.over) continue;
    // 观星：场上没有首领 / 精锐时每发都积星象（2026-11-18 夜，怪堆里也能每第 4 发算无遗策）；有首领 / 精锐时照旧只算同一目标
    const burst = s.crowdStars ? pl.passive.starLandCrowd(time) : live && pl.passive.starLand(s.target, time);
    if (live) {
      host.setCritOverride?.(burst ? true : null);
      try { host.hitEnemy(s.target, s.damage * (burst ? Z.burstMul : 1), time, 'fire'); } finally { host.setCritOverride?.(null); }
    }
    if (burst && g.masteries.eight_trigrams) {
      const L = g.masteries.eight_trigrams, r = Z.bazhen.radius[L - 1], until = time + Z.bazhen.ms[L - 1];
      const fx = art(host) ? playRow(host, 'zhuge_tianhuo', ZGFX.bazhen, 6, s.x, s.y + 6, r * 2.2, r * 1.25, 8, true, 'zhuge-bazhen', 18.6) : null;
      st.zones.push({ x: s.x, y: s.y, r, until, level: L, fx }); pl.passive.addBazhen(s.x, s.y, r, until);
    }
    fallFx(host, s.x, s.y, burst);
    // 天火余烬（2026-11-18 晚 用户：「只有被动触发后才触发」）：只有算无遗策那一发（观星第 4 发）落地留下星火焦土
    if (burst && Z.ember.mul > 0) { // ember.mul 填 0 即关掉余烬（不留地火、不结算）
      const r = Z.ember.radius; st.embers.push({ x: s.x, y: s.y, r, until: time + Z.ember.ms, next: time + Z.ember.tickMs, base: s.damage });
      emberFx(host, s.x, s.y, r, Z.ember.ms);
    }
    host.sfx.play('atk_flame_boom');
    // 溅射：打杂兵（怪堆）时半径 / 比例加大，打首领 / 精锐维持小溅射
    const sr = s.crowd ? Z.crowdSplashRadius : Z.splashRadius, sm = s.crowd ? Z.crowdSplashMul : Z.splashMul;
    for (const e of host.grid.query(s.x, s.y, sr + 40)) {
      if (!e.active || e === s.target || Math.hypot(e.x - s.x, e.y - s.y) > sr + e.radius) continue;
      host.hitEnemy(e, s.damage * sm, time, 'fire');
    }
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const target = tianhuoTarget(host, Z.range);
  if (!target) return;
  const level = weapon.level, dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  // 智力：天火伤害每点 +1.5%（按实际加点，单点收益；法术伤害加成另由 damageMultiplier 结算）
  const damage = TIANHUO_DEF.damage(level, pl.stats) * g.damageMultiplier(time) * (1 + Z.intPerPoint * (g.attributes?.intellect ?? 0));
  pl.faceDirection(cardinal(ux, uy), 200);
  const bossOrElite = host.enemies.some(e => e.active && (e.kind === 'boss' || e.kind === 'elite')), crowd = isCrowdShot(host, target, Z.range), crowdStars = Z.crowdStars && crowd && !bossOrElite;
  // 这一发会是观星爆发（星象已满）→ 播招牌技动作；否则普通出手
  pl.playAction((crowdStars ? pl.passive.crowdStarMarks(time) : pl.passive.starMarks(target, time)) >= Z.starNeed ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
  host.spawnFlagSwingFx(ux, uy); host.sfx.play('atk_flame');
  st.strikes.push({ target, spawn: target.spawnId, x: target.x, y: target.y, at: time + Z.delayMs, damage, mark: starMark(host, target.x, target.y), crowd, crowdStars });
  // 借东风：每第 4 发同时放出东风火龙，朝目标方向直线扫过
  st.casts++; st.sinceWind++;
  const W = g.masteries.wildfire;
  // 场上没有首领 / 精锐时每第 3 发，有时每第 4 发（数自上一次火龙起的发数，换档不会跳拍）
  const every = bossOrElite ? Z.eastWind.every : Z.eastWind.everyCrowd;
  if (W && st.sinceWind >= every) {
    st.sinceWind = 0;
    const len = Z.eastWind.len[W - 1], half = Z.eastWind.width / 2, hit = damage * Z.eastWind.mul[W - 1], dir = target.kind === 'boss' ? { x: ux, y: uy } : densestDir(host, len, half, { x: ux, y: uy }); // 打首领时朝首领扫（2026-11-18 平衡：一律朝怪最密方向时 1-1 首领段 12 → 34 秒；精锐也朝目标时 5-2 清杂掉回去，所以只限首领）；其余朝怪最密的方向扫
    pl.playAction('skill', dir.x < 0 ? 'left' : 'right');
    eastWindFx(host, pl.x, pl.y, dir.x, dir.y, len);
    for (const e of host.grid.query(pl.x + dir.x * len / 2, pl.y + dir.y * len / 2, len / 2 + half + 40)) {
      if (!e.active) continue; const ex = e.x - pl.x, ey = e.y - pl.y, along = ex * dir.x + ey * dir.y, side = Math.abs(ex * -dir.y + ey * dir.x);
      if (along < -e.radius || along > len + e.radius || side > half + e.radius) continue;
      host.hitEnemy(e, hit, time, 'fire');
      // 东风击退：顺着风向吹开（精锐打折，首领 / 不受控的不推；碰墙 / 障碍 / 场地边由 host 停住）
      const kb = Z.eastWind.knockback, push = e.kind === 'boss' || e.controlImmune ? 0 : kb.px * (e.kind === 'elite' ? kb.eliteMul : 1);
      if (push > 0 && e.active) host.knockEnemy?.(e, dir.x * push, dir.y * push, kb.ms);
    }
  }
  weapon.cooldownLeft = Math.max(.4, TIANHUO_DEF.cooldown(level, pl.stats) / g.attackSpeedMultiplier(time));
}
/** 测试用：当前星位 / 八阵数量。 */
export function tianhuoState(pl: Player): { strikes: number; zones: number; casts: number } { const s = STATE.get(pl); return { strikes: s?.strikes.length ?? 0, zones: s?.zones.length ?? 0, casts: s?.casts ?? 0 }; }
