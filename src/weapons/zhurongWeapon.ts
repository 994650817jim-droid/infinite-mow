import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import type { WeaponHost } from './registry';
import { ZHURONG as Z } from '../data/zhurong';
import { branchTier } from '../data/weaponBranches';

/**
 * 祝融 · 火焰飞枪（P3 第二批可玩武将，数值 data/zhurong.ts）：远程穿透火枪 + 沿途火线；每第 3 掷扇形飞刀。
 * 被动「火神后裔」：着火的敌兵被击杀攒量（GameScene → CharacterPassives.p3Gain，p3KillCounts 认 Enemy.p3BurnUntil），满了「烈焰飞刀阵」（本文件）。
 * 分支「火神祝融」：火线更宽更久、着火的敌兵死时火蔓延（GameScene 击杀时调 zhurongSpread）；「飞刀连环」：飞刀更勤更多、穿透。
 * 图：首领战现成的燃火飞刀 fx_zhurong_knife（帧 0–7 飞刀、8–11 炸开），火线借周瑜火场 fx_zy_field；缺图不画替代图形。
 */
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;
const cardinal = (ux: number, uy: number): 'left' | 'right' | 'up' | 'down' => Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down');
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));

export const ZHURONG_DEF = {
  id: 'huoyan_feiqiang' as const, name: '火焰飞枪', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [16, 18, 21, 24, 28][lv(level)] * stats.damageMul,
  cooldown: (level: number, stats: PlayerStats) => [1, .95, .9, .85, .8][lv(level)] * stats.cooldownMul,
  desc: '朝远处掷一支火枪，穿透一线、沿途留火；每第 3 掷改为扇形 5 把飞刀',
};

interface Shot { x: number; y: number; ux: number; uy: number; went: number; max: number; speed: number; w: number; dmg: number; pierce: boolean; spear: boolean; hit: Set<string>; img: Phaser.GameObjects.Image | null; lastFire: number }
interface Fire { x: number; y: number; r: number; until: number; next: number; dmg: number; img: Phaser.GameObjects.Image | null }
interface Orbit { start: number; dmg: number; knives: Array<{ a: number; img: Phaser.GameObjects.Image | null; hit: Set<string> }> }
interface ZrState { throws: number; spears: number; fans: number; knives: number; orbits: number; spreads: number; shots: Shot[]; fires: Fire[]; orbit: Orbit | null }
const STATE = new WeakMap<Player, ZrState>();
const state = (pl: Player): ZrState => { let s = STATE.get(pl); if (!s) { s = { throws: 0, spears: 0, fans: 0, knives: 0, orbits: 0, spreads: 0, shots: [], fires: [], orbit: null }; STATE.set(pl, s); } return s; };
/** 测试读。 */
export function zhurongDebug(pl: Player): { throws: number; spears: number; fans: number; knives: number; orbits: number; spreads: number; fires: number; orbiting: boolean; shots: number } { const s = state(pl); return { throws: s.throws, spears: s.spears, fans: s.fans, knives: s.knives, orbits: s.orbits, spreads: s.spreads, fires: s.fires.length, orbiting: !!s.orbit, shots: s.shots.length }; }

/** 炸开（燃火飞刀图第 3 行 8–11 帧）。 */
function burst(host: WeaponHost, x: number, y: number, size: number): void {
  const s = sceneOf(host); if (!s.textures.exists('fx_zhurong_knife')) return;
  const img = host.add.image(x, y - 10, 'fx_zhurong_knife', 8).setDisplaySize(size, size).setDepth(42).setBlendMode(1).setName('zr-burst');
  s.tweens.addCounter({ from: 8, to: 11.99, duration: 280, onUpdate: tw => img.setFrame(Math.floor(tw.getValue() ?? 8)), onComplete: () => img.destroy() });
}
function addFire(host: WeaponHost, st: ZrState, x: number, y: number, r: number, ms: number, dmg: number, time: number): void {
  const s = sceneOf(host);
  const img = s.textures.exists('fx_zy_field') ? host.add.image(x, y, 'fx_zy_field', 0).setDisplaySize(r * 2.6, r * 2.6).setDepth(3).setAlpha(.85).setBlendMode(1).setName('zr-fire') : null;
  st.fires.push({ x, y, r, until: time + ms, next: time + Z.fire.tickMs, dmg, img });
}
function throwShot(host: WeaponHost, st: ZrState, ux: number, uy: number, spear: boolean, dmg: number, pierce: boolean): void {
  const pl = host.player, s = sceneOf(host), size = spear ? 92 : 56;
  const img = s.textures.exists('fx_zhurong_knife') ? host.add.image(pl.x, pl.y - 14, 'fx_zhurong_knife', 0).setDisplaySize(size, size).setRotation(Math.atan2(uy, ux)).setDepth(42).setBlendMode(1).setName(spear ? 'zr-spear' : 'zr-knife') : null;
  st.shots.push({ x: pl.x, y: pl.y, ux, uy, went: 0, max: spear ? Z.spearRange : Z.knifeRange, speed: spear ? Z.spearSpeed : Z.knifeSpeed, w: spear ? Z.spearW : Z.knifeW, dmg, pierce, spear, hit: new Set(), img, lastFire: 0 });
  if (spear) st.spears++; else st.knives++;
}

/** 火神祝融：着火的敌兵死时火蔓延（GameScene 击杀时调；不是祝融 / 没选这条分支时什么都不做）。 */
export function zhurongSpread(host: WeaponHost, enemy: Enemy, time: number): void {
  const pl = host.player, w = pl.weapons[0]; if (!w || w.id !== 'huoyan_feiqiang' || w.branch !== 'zr_huoshen' || enemy.p3BurnUntil <= time) return;
  const st = state(pl), tier = branchTier(w), k = 1 + .3 * Math.max(0, tier - 1), dmg = ZHURONG_DEF.damage(w.level, pl.stats) * pl.growth.damageMultiplier(time) * Z.huoshen.spreadMul * k;
  for (const e of host.grid.query(enemy.x, enemy.y, Z.huoshen.spreadR + 30)) { if (e === enemy || !e.active || e.isSupplySlot || Math.hypot(e.x - enemy.x, e.y - enemy.y) > Z.huoshen.spreadR + e.radius) continue; host.hitEnemy(e, dmg, time, 'fire'); e.p3BurnUntil = time + Z.fire.burnMarkMs; }
  st.spreads++; burst(host, enemy.x, enemy.y, Z.huoshen.spreadR * 2);
}

export function zhurongBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, g = pl.growth, st = state(pl), s = sceneOf(host);
  const branch = weapon.branch ?? '', tier = branchTier(weapon), k = 1 + .3 * Math.max(0, tier - 1), huoshen = branch === 'zr_huoshen', feidao = branch === 'zr_feidao';
  const final = tier >= 3 && (g.build.tags()[huoshen ? 'fire' : 'archery'] ?? 0) >= 4;
  pl.passive.p3Need = Z.need;
  const base = ZHURONG_DEF.damage(weapon.level, pl.stats) * g.damageMultiplier(time);
  const fireMul = (1 + Z.huoshenM * (g.masteries.huoshen ?? 0)) * (huoshen ? k * (final ? Z.huoshen.finalMul : 1) : 1);
  const fireR = Z.fire.r * (huoshen ? Z.huoshen.rMul : 1), fireMs = Z.fire.ms * (huoshen ? Z.huoshen.msMul : 1);
  // 火神后裔：量表满 → 烈焰飞刀阵
  if (pl.passive.takeP3()) {
    st.orbit = { start: time, dmg: base * Z.orbit.mul, knives: Array.from({ length: Z.orbit.n }, (_, i) => ({ a: i / Z.orbit.n * Math.PI * 2, hit: new Set<string>(), img: s.textures.exists('fx_zhurong_knife') ? host.add.image(pl.x, pl.y, 'fx_zhurong_knife', 4).setDisplaySize(56, 56).setDepth(42).setBlendMode(1).setName('zr-orbit') : null })) };
    st.orbits++; pl.playAction('skill', 'down');
  }
  const o = st.orbit;
  if (o) {
    const t = (time - o.start) / Z.orbit.ms, spin = t * Math.PI * 4;
    if (t >= 1) { for (const kn of o.knives) { kn.img?.destroy(); throwShot(host, st, Math.cos(kn.a + spin), Math.sin(kn.a + spin), false, o.dmg, true); } st.orbit = null; }
    else for (const kn of o.knives) {
      const x = pl.x + Math.cos(kn.a + spin) * Z.orbit.r, y = pl.y + Math.sin(kn.a + spin) * Z.orbit.r;
      kn.img?.setPosition(x, y - 12).setRotation(kn.a + spin + Math.PI / 2);
      for (const e of host.grid.query(x, y, Z.knifeW + 30)) { if (!e.active || e.isSupplySlot || Math.hypot(e.x - x, e.y - y) > Z.knifeW + e.radius) continue; const key = e.uid + ':' + e.spawnId; if (kn.hit.has(key)) continue; kn.hit.add(key); host.hitEnemy(e, o.dmg, time, 'fire'); e.p3BurnUntil = time + Z.fire.burnMarkMs; }
    }
  }
  // 飞枪 / 飞刀
  for (const sh of st.shots) {
    const step = sh.speed * dt; sh.x += sh.ux * step; sh.y += sh.uy * step; sh.went += step;
    sh.img?.setPosition(sh.x, sh.y - 14).setFrame((Math.floor(time / 80) % 2) * 4 + (sh.spear ? 0 : 1));
    if (sh.spear && sh.went - sh.lastFire >= Z.fire.step) { sh.lastFire = sh.went; addFire(host, st, sh.x, sh.y, fireR, fireMs, base * Z.fire.mul * fireMul, time); }
    for (const e of host.grid.query(sh.x, sh.y, sh.w + 40)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - sh.x, e.y - sh.y) > sh.w + e.radius) continue;
      const key = e.uid + ':' + e.spawnId; if (sh.hit.has(key)) continue; sh.hit.add(key);
      host.hitEnemy(e, sh.dmg, time, sh.spear ? 'fire' : 'arrow'); e.p3BurnUntil = time + Z.fire.burnMarkMs;
      if (!sh.pierce) { sh.went = sh.max; burst(host, sh.x, sh.y, 70); break; }
    }
  }
  for (const sh of st.shots) if (sh.went >= sh.max) { sh.img?.destroy(); if (sh.spear) burst(host, sh.x, sh.y, 110); }
  st.shots = st.shots.filter(sh => sh.went < sh.max);
  // 火线
  for (const f of st.fires) {
    f.img?.setFrame(Math.floor(time / 90) % 6).setAlpha(Math.min(.85, (f.until - time) / 400));
    if (time >= f.next) { f.next += Z.fire.tickMs; for (const e of host.grid.query(f.x, f.y, f.r + 30)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - f.x, e.y - f.y) <= f.r + e.radius) { host.hitEnemy(e, f.dmg, time, 'fire'); e.p3BurnUntil = time + Z.fire.burnMarkMs; } }
  }
  for (const f of st.fires) if (time >= f.until) f.img?.destroy();
  st.fires = st.fires.filter(f => time < f.until);

  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  // 射程内最远的敌兵（远程穿透：从里往外一串都打）
  let target: Enemy | null = null, far = -1;
  for (const e of host.grid.query(pl.x, pl.y, Z.range + 40)) { if (!e.active || e.isSupplySlot || e.invulnerable || e.def.behavior === 'wall') continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d <= Z.range + e.radius && d > far) { far = d; target = e; } }
  if (!target) return;
  const dx = target.x - pl.x, dy = target.y - pl.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, a0 = Math.atan2(uy, ux);
  st.throws++;
  const every = feidao ? Z.feidao.every : Z.fanEvery, fanNow = (feidao && final) || st.throws % every === 0;
  throwShot(host, st, ux, uy, true, base * Z.spearMul * (huoshen ? k : 1), true);
  if (fanNow) {
    const n = (feidao ? Z.feidao.fan : Z.fan) + (g.masteries.feidao ?? 0);
    for (let i = 0; i < n; i++) { const a = a0 + (n === 1 ? 0 : (i / (n - 1) - .5) * Z.spread); throwShot(host, st, Math.cos(a), Math.sin(a), false, base * Z.knifeMul * (feidao ? k : 1), feidao); }
    st.fans++;
  }
  pl.faceDirection(cardinal(ux, uy), 200); pl.playAction('attack', cardinal(ux, uy)); host.sfx.play('atk_spear');
  weapon.cooldownLeft = Math.max(.25, ZHURONG_DEF.cooldown(weapon.level, pl.stats) / g.attackSpeedMultiplier(time));
}
