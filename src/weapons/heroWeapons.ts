import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PlayerStats, WeaponState } from '../types';
import { PASSIVE_RULES as R } from '../data/passives';
import type { WeaponHost } from './registry';
import { smartTarget } from './heroWeapons2';
import { SHOW_OWN_RANGE_FX } from '../ui/HintStyle';

/**
 * 魏延「镇北环首刀」与庞统「凤雏连环令」两把专属本命武器（2026-11-15 重做，不再沿用关羽偃月刀 / 诸葛亮战旗）。
 * 魏延特效为程序化过渡（地裂纹、碎石），劈下瞬间沿用劈地序列帧；庞统 2026-11-16 改为方案 A「铁索连环」，见下方庞统段落。
 */
/** 正式序列帧图集是否已加载（缺图时退回程序化特效）。 */
export const hasFxSheet = (host: WeaponHost, sheet: string): boolean => (host.add as unknown as { scene: Phaser.Scene }).scene.textures.exists('hero_fx_' + sheet);
const lv = (level: number): number => Math.max(0, Math.min(4, Math.floor(level) - 1));

// ───────────────────────── 魏延 · 镇北环首刀 ─────────────────────────

/** 裂波道数：Lv1–2 一道、Lv3–4 两道、Lv5 三道。 */
export const zhenbeiCracks = (level: number): number => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const ZHENBEI_DEF = {
  id: 'zhenbei_blade' as const, name: '镇北环首刀', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [30, 34, 38, 43, 48][lv(level)] * stats.damageMul * stats.meleeMul,
  cooldown: (level: number, stats: PlayerStats) => [1.5, 1.5, 1.45, 1.4, 1.35][lv(level)] * stats.cooldownMul,
  desc: '朝敌群重劈，地面裂开直线冲击波，穿透全部敌人',
};

/** 敌人到线段（起点 → 方向 × 长度）的侧向距离；在线段范围外返回 Infinity。 */
function sideDistance(e: Enemy, x: number, y: number, ux: number, uy: number, len: number): { along: number; side: number } {
  const dx = e.x - x, dy = e.y - y, along = dx * ux + dy * uy;
  if (along < -e.radius || along > len + e.radius) return { along, side: Infinity };
  return { along, side: Math.abs(dx * uy - dy * ux) };
}

/** 程序化地裂纹：主裂缝折线 + 两侧细纹 + 碎石，暗红余烬后淡出（过渡特效）。 */
function crackFx(host: WeaponHost, x: number, y: number, angle: number, len: number, width: number, hot = false): void {
  // 2026-11-17：换成手绘透明序列帧 weiyan_crack（Gemini 出图，6 帧 1024×256：裂开 → 熔光最亮、土块掀起 → 余烬 → 淡去）。
  // 帧内冲击点在 x≈90、裂缝末端在 x≈940；朝左时上下翻转，保证扬尘、土块始终朝画面上方。缺图时退回下面的程序化地裂纹。
  if (sceneOf(host).textures.exists('weiyan_crack')) {
    const s = len / 850, left = Math.cos(angle) < 0;
    const fx = host.add.sprite(x, y, 'weiyan_crack', 0).setOrigin(90 / 1024, .5).setScale(s * (hot ? 1.05 : 1)).setRotation(angle).setFlipY(left).setDepth(19).setName('weiyan-crack-fx');
    fx.scene.tweens.addCounter({ from: 0, to: 5.99, duration: 680, onUpdate: t => { if (fx.active) fx.setFrame(Math.floor(t.getValue() ?? 0)); }, onComplete: () => fx.destroy() });
    return;
  }
  const g =host.add.graphics().setDepth(19), ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
  const pts: Array<[number, number]> = []; const steps = 9;
  for (let i = 0; i <= steps; i++) { const t = i / steps, j = i === 0 ? 0 : (Math.random() - .5) * width * .35; pts.push([x + ux * len * t + nx * j, y + uy * len * t + ny * j]); }
  const stroke = (w: number, color: number, a: number) => { g.lineStyle(w, color, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokePath(); };
  stroke(width * .55, 0x2a1a10, .35); stroke(7, hot ? 0xff5a2a : 0x3b2414, .9); stroke(3, hot ? 0xffd27a : 0xff8a3c, .95);
  for (let i = 2; i < steps; i += 2) { const [px, py] = pts[i], s = (i % 4 ? 1 : -1) * width * (.35 + Math.random() * .2); g.lineStyle(2, 0x3b2414, .8); g.lineBetween(px, py, px + nx * s + ux * 10, py + ny * s + uy * 10); }
  g.scene.tweens.add({ targets: g, alpha: 0, delay: 260, duration: 380, onComplete: () => g.destroy() });
  for (let i = 0; i < 7; i++) {
    const t = .2 + Math.random() * .8, px = x + ux * len * t, py = y + uy * len * t, side = (Math.random() - .5) * width;
    const rock = host.add.rectangle(px + nx * side * .3, py + ny * side * .3, 5 + Math.random() * 4, 4 + Math.random() * 3, Math.random() < .5 ? 0x6b4a2c : 0x8a6a44).setDepth(42).setRotation(Math.random() * 3);
    rock.scene.tweens.add({ targets: rock, x: px + nx * side, y: py + ny * side - 18 - Math.random() * 14, rotation: rock.rotation + 2, alpha: 0, duration: 420 + Math.random() * 160, ease: 'Quad.easeOut', onComplete: () => rock.destroy() });
  }
}

/** 一次劈砍朝各方向放出的裂波；同一次出刀里每名敌人只吃一次伤害。 */
/** sprite=false：只画程序化地裂纹（谁敢杀我时由整张怒吼冲击波序列帧负责光效，避免 6 张叠加混合裂波把画面冲成白色）。 */
function releaseCracks(host: WeaponHost, angles: number[], damage: number, len: number, width: number, now: number, hot: boolean, sprite = true): number {
  const px = host.player.x, py = host.player.y, hit = new Set<number>(); let n = 0;
  for (const a of angles) {
    const ux = Math.cos(a), uy = Math.sin(a);
    for (const e of host.grid.query(px + ux * len / 2, py + uy * len / 2, len / 2 + width)) {
      if (!e.active || e.isSupplySlot || hit.has(e.spawnId)) continue;
      const { along, side } = sideDistance(e, px, py, ux, uy, len);
      if (side > width / 2 + e.radius) continue;
      hit.add(e.spawnId);
      if (host.hitEnemy(e, damage * (along <= R.crackCloseRange ? R.crackCloseMul : 1), now, 'melee')) n++;
    }
    // 正式「劈地裂波」序列帧（朝右，按方向旋转、按长度放大）；缺图时退回程序化地裂纹
    if (sprite && hasFxSheet(host, 'c')) host.heroFx?.('crack', px + ux * (len / 2 + 10), py + 8 + uy * (len / 2 + 10), len * 1.25, a);
    else crackFx(host, px + ux * 14, py + 10 + uy * 14, a, len, width, hot);
  }
  return n;
}

export function zhenbeiBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const pl = host.player, growth = pl.growth, level = weapon.level;
  const kaishan = growth.masteries.kaishan, heavy = kaishan > 0 && growth.slashCount >= 4;
  const am = host.player.passive.rangeMultiplier('zhenbei_blade'), len = R.crackLen * am, width = R.crackWidth * (heavy ? 1.5 : 1) * am; // 智力范围加成
  // 选裂波方向：16 个候选方向里，直线带内敌人最多（精锐 / 首领加权）的一个；有优先目标时直指目标
  const near = host.grid.query(pl.x, pl.y, len + 40).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= len + e.radius);
  if (!near.length) return; // 没有敌人不出刀、不耗冷却
  let best = 0, bestScore = -1;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 2 * i / 16, ux = Math.cos(a), uy = Math.sin(a); let score = 0;
    for (const e of near) { const { side } = sideDistance(e, pl.x, pl.y, ux, uy, len); if (side <= width / 2 + e.radius) score += e.kind === 'boss' ? 5 : e.kind === 'elite' ? 2 : 1; }
    if (score > bestScore) { bestScore = score; best = a; }
  }
  const priority = host.priorityTarget?.(len) ?? null;
  if (priority) best = Math.atan2(priority.y - pl.y, priority.x - pl.x);
  const cast = pl.passive.beginCast('zhenbei_blade');
  if (kaishan) growth.slashCount = heavy ? 0 : growth.slashCount + 1;
  // 孤军深入：身边 160 像素内每名敌人伤害 +1.5/2/2.5%（最多 15 名）
  const gujun = growth.masteries.gujun ? 1 + Math.min(15, host.grid.query(pl.x, pl.y, 160).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= 160).length) * [.015, .02, .025][growth.masteries.gujun - 1] : 1;
  const damage = ZHENBEI_DEF.damage(level, pl.stats) * growth.damageMultiplier(time) * gujun * (heavy ? [1.5, 1.7, 1.9][kaishan - 1] : 1);
  const ux = Math.cos(best), uy = Math.sin(best);
  pl.faceDirection(Math.abs(ux) > Math.abs(uy) ? (ux < 0 ? 'left' : 'right') : (uy < 0 ? 'up' : 'down'), 160);
  host.sfx.play('allySlash');
  if (cast.whoDares) {
    // 谁敢杀我：怒吼，6 向裂波各 80%，并 3 秒受伤 -30%
    pl.playAction('skill', ux < 0 ? 'left' : 'right');
    pl.passive.startGuard(time);
    const angles = Array.from({ length: R.whoDaresDirs }, (_, k) => best + k * Math.PI * 2 / R.whoDaresDirs);
    releaseCracks(host, angles, damage * R.whoDaresDamageMul, len * 1.1, width, time, true, false);
    host.heroFx?.('whoDares', pl.x, pl.y - 4, len * 1.6);
    if (!hasFxSheet(host, 'c')) { const ring = host.add.circle(pl.x, pl.y - 6, 30, 0xff5a3c, 0).setStrokeStyle(6, 0xff6a4a, .9).setDepth(41);
      ring.scene.tweens.add({ targets: ring, radius: len, alpha: 0, duration: 460, onComplete: () => ring.destroy() }); }
    const shout = host.add.text(pl.x, pl.y - 70, '谁敢杀我！', { fontFamily: 'serif', fontSize: '26px', color: '#ffe0b0', stroke: '#7a1a10', strokeThickness: 6 }).setOrigin(.5).setDepth(60).setName('weiyan-whodares');
    shout.scene.tweens.add({ targets: shout, y: pl.y - 104, alpha: 0, delay: 500, duration: 600, onComplete: () => shout.destroy() });
    host.cameras.main.shake(140, .005);
  } else {
    pl.playAction(heavy ? 'skill' : 'attack', ux < 0 ? 'left' : 'right');
    const n = zhenbeiCracks(level), spread = 18 * Math.PI / 180;
    const angles = n === 1 ? [best] : n === 2 ? [best - spread / 2, best + spread / 2] : [best - spread, best, best + spread];
    releaseCracks(host, angles, damage, len, width, time, heavy);
    host.cameras.main.shake(70, heavy ? .004 : .002);
  }
  // 劈下瞬间：魏延自己的劈地序列帧（缺图时 heroFx 什么都不做）
  host.heroFx?.('weiyanSlash', pl.x + ux * 56, pl.y + uy * 56, 230, best);
  weapon.cooldownLeft = Math.max(.25, ZHENBEI_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}

// ───────────────────────── 庞统 · 凤雏连环令 ─────────────────────────
// 2026-11-16 方案 A「铁索连环」（用户选定）：边走边在脚下落火雷，雷与雷之间拉起烧红的铁索。
//  Lv1 新雷连上一枚雷，铁索上的敌人减速；Lv2 铁索灼伤；Lv3 雷炸时火沿铁索烧向相连的雷（链上敌人挨打）、落雷更快；
//  Lv4 双链（再连最近的另一枚）、火雷上限 +2；Lv5「铁索连舟」：绕回来让铁索首尾相接，圈内地面起火 3 秒后整圈齐爆。
//  特效（2026-11-17 用户：「庞统的攻击特效还是像素，要改」→ 全部换成手绘厚涂透明序列帧，参照诸葛亮 flame_burst）：
//   pangtong_paint（6×4，每帧 256，透明底）：0–5 火雷爆炸、6–11 沿索火苗、12–17 地火、18–23 雷芯闪；
//   pangtong_chain_hot（6 帧，每帧 1024×130，透明底）：烧红铁索（平铺）。缺图时退回程序化过渡，不画地面圈。

/** 每枚新雷连几条铁索：Lv1–3 一条（连上一枚雷），Lv4 起两条（再连最近的另一枚）。 */
export const lianhuanLinksPerMine = (level: number): number => (level >= 4 ? 2 : 1);
export const LIANHUAN_DEF = {
  id: 'lianhuan_mines' as const, name: '凤雏连环令', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => 26 * (1 + .18 * (level - 1)) * stats.damageMul * stats.fireMul,
  // 脚下定时落雷；Lv3 起落雷间隔缩短
  cooldown: (level: number, stats: PlayerStats) => ((level >= 3 ? R.mineDropFastSec : R.mineDropSec) * stats.cooldownMul) / (1 + .03 * (level - 1)),
  desc: '边走边在脚下落火雷，雷与雷之间拉起烧红的铁索：碰到铁索的敌人减速，踩雷引爆并连环引爆附近的雷',
};
const mineRadius = (level: number) => R.mineRadius * (1 + .05 * (level - 1));

type MineKind = 'trail' | 'ring' | 'fengpo';
interface Mine { x: number; y: number; armAt: number; until: number; body: Phaser.GameObjects.Container; core?: Phaser.GameObjects.Sprite; lit: boolean; ring?: RingGroup; kind: MineKind; seq: number; loop?: LoopFire; warned?: number; fuseAt?: number; }
interface RingGroup { x: number; y: number; fuseAt: number; mines: Mine[]; links: Phaser.GameObjects.Container; fired: boolean; }
interface Tether { a: Mine; b: Mine; body: Phaser.GameObjects.Container; }
interface LoopFire { poly: { x: number; y: number }[]; mines: Mine[]; until: number; nextTick: number; fx: Phaser.GameObjects.Container; box: [number, number, number, number]; onEnd?: () => void; }
interface Chain { count: number; awarded: boolean; }
interface MineState { mines: Mine[]; rings: RingGroup[]; tethers: Tether[]; loops: LoopFire[]; burnAt: Map<number, { spawn: number; at: number }>; fengpoReadyAt: number; seq: number; lastTrail: Mine | null; }
const STATE = new WeakMap<Player, MineState>();
const stateOf = (p: Player): MineState => { let s = STATE.get(p); if (!s) { s = { mines: [], rings: [], tethers: [], loops: [], burnAt: new Map(), fengpoReadyAt: 0, seq: 0, lastTrail: null }; STATE.set(p, s); } return s; };

const texOk = (host: WeaponHost, key: string): boolean => (host.add as unknown as { scene: Phaser.Scene }).scene.textures.exists(key);
/** 手绘特效图集 pangtong_paint 的帧段：0–5 火雷爆炸、6–11 沿索火苗、12–17 地火、18–23 雷芯闪。 */
const PT = { burst: 0, run: 6, ground: 12, core: 18 } as const;
const ptFx = (host: WeaponHost): boolean => texOk(host, 'pangtong_paint');
/** 播放 pangtong_paint 的一段帧（不依赖全局动画表）：loop 时循环，否则播完停在最后一帧。 */
/** 无限循环补间：宿主对象销毁时一并移除（否则补间永远留在 TweenManager 里，火雷多、打得久时越积越多）。 */
function loopTween(owner: Phaser.GameObjects.GameObject, tw: Phaser.Tweens.Tween): Phaser.Tweens.Tween { owner.once('destroy', () => tw.remove()); return tw; }
function playPt(sprite: Phaser.GameObjects.Sprite, start: number, fps: number, loop: boolean, offset = 0): void {
  const st = { t: offset };
  sprite.setFrame(start + (offset % 6));
  const tw = sprite.scene.tweens.add({ targets: st, t: offset + 6, duration: 6000 / fps, repeat: loop ? -1 : 0,
    onUpdate: () => { if (sprite.active) sprite.setFrame(start + (Math.floor(st.t) % 6)); } });
  if (loop) loopTween(sprite, tw);
}
const tetherLen = (p: Player): number => R.tetherLen * (1 + .15 * p.growth.masteries.lianying);
/** 点到线段的距离。 */
function segDist(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / l2));
  return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
}
function inPoly(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-6) + a.x) inside = !inside;
  }
  return inside;
}
const polyArea = (poly: { x: number; y: number }[]): number => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;

/** 火雷：青铜雷壳 + 跳动的雷芯（像素帧；缺图时程序化红芯）。 */
function mineBody(host: WeaponHost, x: number, y: number): { body: Phaser.GameObjects.Container; core?: Phaser.GameObjects.Sprite } {
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (texOk(host, 'pangtong_mine')) parts.push(host.add.image(0, 0, 'pangtong_mine').setDisplaySize(30, 30));
  else parts.push(host.add.circle(0, 0, 11, 0x6a4a24).setStrokeStyle(2, 0xc8a050, 1), host.add.circle(0, 0, 7, 0x3a2614));
  let core: Phaser.GameObjects.Sprite | undefined;
  if (ptFx(host)) {
    // 雷芯：平时在 18–20 帧间慢慢明灭（暗红），将爆时快速闪到亮白
    core = host.add.sprite(0, -2, 'pangtong_paint', PT.core).setDisplaySize(30, 30).setBlendMode('ADD');
    const st = { t: 0 }, c0 = core; loopTween(c0, core.scene.tweens.add({ targets: st, t: 3, duration: 780, yoyo: true, repeat: -1, onUpdate: () => { if (core?.active && !core.getData('warn')) core.setFrame(PT.core + Math.min(2, Math.floor(st.t))); } }));
    parts.push(core);
  } else {
    const glow = host.add.circle(0, -1, 5, 0xff5a2a, .8).setBlendMode(1);
    loopTween(glow, glow.scene.tweens.add({ targets: glow, scale: 1.8, alpha: .35, yoyo: true, repeat: -1, duration: 260 }));
    parts.push(glow);
  }
  return { body: host.add.container(x, y, parts).setDepth(19).setName('pangtong-mine'), core };
}
/** 雷将爆示警：雷芯闪到亮白，fast 时闪得更快（引信后段）；缺图时雷体程序化跳动。 */
function warnMine(m: Mine, fast = false): void {
  const lvl = fast ? 2 : 1;
  if ((m.warned ?? 0) >= lvl || !m.body.active) return; m.warned = lvl;
  m.body.scene.tweens.killTweensOf(m.body); m.body.setScale(1);
  if (m.core) { m.core.scene.tweens.killTweensOf(m.core); m.core.setData('warn', true); playPt(m.core, PT.core, fast ? 26 : 11, true, 2); }
  loopTween(m.body, m.body.scene.tweens.add({ targets: m.body, scale: fast ? 1.22 : 1.12, yoyo: true, repeat: -1, duration: fast ? 70 : 160 }));
}

/** 两雷之间的锁链：正式铁链贴图平铺；缺图时画程序化链环。放进 into（常驻）或闪一下淡出。 */
function linkFx(host: WeaponHost, a: { x: number; y: number }, b: { x: number; y: number }, into?: Phaser.GameObjects.Container): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  let obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Graphics;
  if (texOk(host, 'pangtong_chain')) {
    const t = host.add.tileSprite((a.x + b.x) / 2, (a.y + b.y) / 2, d, 12, 'pangtong_chain').setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setDepth(19.5);
    t.setTileScale(12 / 24, 12 / 24); obj = t;
  } else {
    const g = host.add.graphics().setDepth(19.5), n = Math.max(2, Math.round(d / 12));
    g.lineStyle(3, 0x5a4630, .9).lineBetween(a.x, a.y, b.x, b.y);
    for (let i = 0; i <= n; i++) { const t = i / n; g.lineStyle(2, i % 2 ? 0xe8c070 : 0xb08a48, 1).strokeCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3); }
    obj = g;
  }
  if (into) into.add(obj);
  else { obj.setName('pangtong-link'); obj.scene.tweens.add({ targets: obj, alpha: 0, duration: 320, onComplete: () => obj.destroy() }); }
}

/** 拉一段烧红铁索（常驻，直到任一端的雷炸掉）：铁链 + 叠加的烧红光（像素帧）。 */
function tie(host: WeaponHost, s: MineState, a: Mine, b: Mine): void {
  if (a === b || s.tethers.some(t => (t.a === a && t.b === b) || (t.a === b && t.b === a))) return;
  const body = host.add.container(0, 0).setDepth(19.5).setName('pangtong-tether');
  if (texOk(host, 'pangtong_chain_hot')) {
    // 手绘烧红铁索：每帧 1024×130，铁链中心线在帧内 85 处；按 34 像素高平铺，6 帧循环闪动
    const d = Math.hypot(b.x - a.x, b.y - a.y), hgt = 34, ts = hgt / 130;
    const t = host.add.tileSprite((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(8, d + 6) / ts, 130, 'pangtong_chain_hot', Math.floor(Math.random() * 6))
      .setOrigin(.5, 85 / 130).setScale(ts).setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    const st = { t: Math.random() * 6 }; loopTween(t, t.scene.tweens.add({ targets: st, t: st.t + 6, duration: 900, repeat: -1, onUpdate: () => { if (t.active) t.setFrame(Math.floor(st.t) % 6); } }));
    body.add(t); s.tethers.push({ a, b, body }); return;
  }
  linkFx(host, a, b, body);
  s.tethers.push({ a, b, body });
}
const tethered = (s: MineState, a: Mine, b: Mine): boolean => s.tethers.some(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
function untieAll(s: MineState, m: Mine): void {
  for (let i = s.tethers.length - 1; i >= 0; i--) { const t = s.tethers[i]; if (t.a === m || t.b === m) { t.body.destroy(); s.tethers.splice(i, 1); } }
}

function placeMine(host: WeaponHost, s: MineState, x: number, y: number, now: number, life: number, kind: MineKind, ring?: RingGroup): Mine {
  const { body, core } = mineBody(host, x, y);
  const m: Mine = { x, y, armAt: now + R.mineArmMs, until: now + life, body, core, lit: false, ring, kind, seq: ++s.seq };
  s.mines.push(m); return m;
}

/** 火走铁索（Lv3）：火苗沿铁索从 a 跑到 b，铁索上的敌人挨一下。 */
function fireRun(host: WeaponHost, a: Mine, b: Mine, damage: number, now: number): void {
  for (const e of host.grid.query((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) / 2 + 40))
    if (e.active && !e.isSupplySlot && segDist(e.x, e.y, a, b) <= R.tetherWidth / 2 + e.radius + 6) host.hitEnemy(e, damage, now, 'fire');
  if (ptFx(host)) {
    const f = host.add.sprite(a.x, a.y, 'pangtong_paint', PT.run).setDisplaySize(56, 56).setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setDepth(41).setName('pangtong-firerun');
    playPt(f, PT.run, 40, true);
    f.scene.tweens.add({ targets: f, x: b.x, y: b.y, duration: R.mineChainDelayMs, onComplete: () => f.destroy() });
  } else linkFx(host, a, b);
}

function explode(host: WeaponHost, s: MineState, m: Mine, damage: number, radius: number, chain: Chain | null, chainRange: number, chained: boolean, now: number, level: number): void {
  if (m.lit) return; m.lit = true;
  const i = s.mines.indexOf(m); if (i >= 0) s.mines.splice(i, 1);
  const linked = s.mines.filter(o => tethered(s, m, o));
  untieAll(s, m);
  m.body.destroy();
  if (s.lastTrail === m) s.lastTrail = null;
  if (host.over) return;
  host.spawnFlameFx(m.x, m.y, radius); host.sfx.play('flameBoom');
  const dmg = damage * (chained && host.player.growth.masteries.lianying >= 3 ? 1.2 : 1);
  for (const e of host.grid.query(m.x, m.y, radius + 30)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - m.x, e.y - m.y) <= radius + e.radius) host.hitEnemy(e, dmg, now, 'fire');
  if (!chain) return;
  chain.count++;
  if (!chain.awarded && chain.count >= R.mineChainStack) { chain.awarded = true; host.player.passive.onMineChain(chain.count); }
  // 连环：附近（或铁索相连）未引爆的火雷依次连锁；Lv3 起沿铁索走火
  for (const o of [...s.mines]) {
    const onTether = linked.includes(o);
    if (o.lit || o.ring || (!onTether && Math.hypot(o.x - m.x, o.y - m.y) > chainRange)) continue;
    o.lit = true;
    if (onTether && level >= 3) fireRun(host, m, o, damage * R.fireRunMul, now); else linkFx(host, m, o);
    host.time.delayedCall(R.mineChainDelayMs, () => { o.lit = false; explode(host, s, o, damage, radius, chain, chainRange, true, host.combatNow, level); });
  }
}

/** 铁索连舟（Lv5）/ 满级火烧连环：多边形圈内整片起火 loopMs，之后整圈齐爆。 */
function startLoop(host: WeaponHost, s: MineState, mines: Mine[], now: number, onEnd?: () => void): LoopFire {
  const poly = mines.map(m => ({ x: m.x, y: m.y }));
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y), box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const fx = host.add.container(0, 0).setDepth(18).setName('pangtong-loopfire');
  // 地火：在圈内按 34 像素网格铺像素火（最多 48 块），火铺满的地方就是范围，不画外圈
  const pts: { x: number; y: number }[] = [];
  for (let y = box[1] + 17; y < box[3]; y += 34) for (let x = box[0] + 17; x < box[2]; x += 34) if (inPoly(x, y, poly)) pts.push({ x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10 });
  if (!pts.length) pts.push({ x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length });
  for (const p of pts.slice(0, 48)) {
    if (ptFx(host)) { const g = host.add.sprite(p.x, p.y, 'pangtong_paint', PT.ground).setOrigin(.5, .7).setDisplaySize(54, 54).setAlpha(.95); playPt(g, PT.ground, 10, true, Math.floor(Math.random() * 6)); fx.add(g); }
    else if (texOk(host, 'wf_flame')) { const g = host.add.image(p.x, p.y, 'wf_flame').setDisplaySize(30, 30).setBlendMode('ADD').setAlpha(.8); loopTween(g, g.scene.tweens.add({ targets: g, scaleY: g.scaleY * 1.3, alpha: .5, yoyo: true, repeat: -1, duration: 200 + Math.random() * 120 })); fx.add(g); }
  }
  fx.setAlpha(0); fx.scene.tweens.add({ targets: fx, alpha: 1, duration: 200 });
  const loop: LoopFire = { poly, mines, until: now + R.loopMs, nextTick: now, fx, box, onEnd };
  for (const m of mines) m.loop = loop;
  s.loops.push(loop); return loop;
}

function fireRing(host: WeaponHost, s: MineState, g: RingGroup, damage: number, radius: number, now: number, level: number): void {
  if (g.fired) return; g.fired = true;
  s.rings.splice(s.rings.indexOf(g), 1);
  if (level >= 5) {
    // 满级：火烧连环这一圈先化作「铁索连舟」整片地火，烧完再齐爆
    startLoop(host, s, g.mines, now, () => { g.links.destroy(); host.heroFx?.('phoenix', g.x, g.y - R.ringRadius * .3, R.ringRadius * 3); });
    return;
  }
  g.links.destroy();
  for (const m of g.mines) explode(host, s, m, damage, radius, null, 0, false, now, level);
  host.heroFx?.('phoenix', g.x, g.y - R.ringRadius * .3, R.ringRadius * 3);
  host.martialField(g.x, g.y, R.ringRadius + 20, damage, R.ringFireMs, 2);
}

export function lianhuanBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = stateOf(pl), growth = pl.growth, level = weapon.level;
  const damage = LIANHUAN_DEF.damage(level, pl.stats) * growth.damageMultiplier(time), radius = mineRadius(level) * host.player.passive.rangeMultiplier('lianhuan_mines'); // 智力范围加成
  const chainRange = R.mineChainRange * (1 + .15 * growth.masteries.lianying), len = tetherLen(pl);
  // 火雷：被踩后先烧引信（mineFuseMs，期间再有人踩不重新计时）再爆并带出连锁；到期无人踩则原地自爆。铁索连舟中的雷由地火统一引爆
  for (const m of [...s.mines]) {
    if (m.lit || m.ring || m.loop || time < m.armAt) continue;
    if (m.fuseAt !== undefined) {
      if (time >= m.fuseAt) explode(host, s, m, damage, radius, { count: 0, awarded: false }, chainRange, false, time, level);
      else if (m.fuseAt - time <= R.mineFuseMs * .4) warnMine(m, true);
      continue;
    }
    if (time >= m.until) { explode(host, s, m, damage, radius, null, 0, false, time, level); continue; }
    if (host.grid.query(m.x, m.y, R.mineTrigger + 30).some(e => e.active && !e.isSupplySlot && Math.hypot(e.x - m.x, e.y - m.y) <= R.mineTrigger + e.radius)) {
      m.fuseAt = time + R.mineFuseMs; warnMine(m);
    }
  }
  // 铁索：碰到的敌人减速（首领不受影响）；Lv2 起每 0.5 秒灼伤
  for (const t of s.tethers) {
    for (const e of host.grid.query((t.a.x + t.b.x) / 2, (t.a.y + t.b.y) / 2, Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y) / 2 + 40)) {
      if (!e.active || e.isSupplySlot || segDist(e.x, e.y, t.a, t.b) > R.tetherWidth / 2 + e.radius) continue;
      if (e.kind !== 'boss') { e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - R.tetherSlow); e.martialSlowUntil = time + 150; }
      if (level < 2) continue;
      const b = s.burnAt.get(e.uid);
      if (b && b.spawn === e.spawnId && time < b.at) continue;
      s.burnAt.set(e.uid, { spawn: e.spawnId, at: time + R.tetherTickMs });
      host.hitEnemy(e, damage * R.tetherBurnMul, time, 'fire');
    }
  }
  if (s.burnAt.size > 400) s.burnAt.clear();
  // 铁索连舟 / 满级火烧连环：圈内地火每 0.5 秒灼伤并减速，最后 0.8 秒雷芯闪烁示警，到时整圈齐爆
  for (const lp of [...s.loops]) {
    if (time >= lp.nextTick) {
      lp.nextTick = time + R.loopTickMs;
      const cx = (lp.box[0] + lp.box[2]) / 2, cy = (lp.box[1] + lp.box[3]) / 2, r = Math.hypot(lp.box[2] - lp.box[0], lp.box[3] - lp.box[1]) / 2 + 20;
      for (const e of host.grid.query(cx, cy, r)) {
        if (!e.active || e.isSupplySlot || !inPoly(e.x, e.y, lp.poly)) continue;
        host.hitEnemy(e, damage * R.loopMul, time, 'fire');
        if (e.kind !== 'boss') { e.martialSlow = Math.min(time >= e.martialSlowUntil ? 1 : e.martialSlow, 1 - R.loopSlow); e.martialSlowUntil = time + R.loopTickMs + 60; }
      }
    }
    if (time >= lp.until - 800) for (const m of lp.mines) warnMine(m);
    if (time >= lp.until || host.over) {
      s.loops.splice(s.loops.indexOf(lp), 1);
      lp.fx.scene.tweens.add({ targets: lp.fx, alpha: 0, duration: 260, onComplete: () => lp.fx.destroy() });
      const chain: Chain = { count: 0, awarded: false };
      for (const m of lp.mines) { m.loop = undefined; m.ring = undefined; if (s.mines.includes(m)) explode(host, s, m, damage, radius, chain, chainRange, false, time, level); }
      lp.onEnd?.();
    }
  }
  // 火烧连环：2 秒后整圈齐爆；敌人踏入圈内则改为再烧一段引信（不晚于原定时间）。满级先化作整片地火
  for (const g of [...s.rings]) {
    const inside = host.grid.query(g.x, g.y, R.ringRadius + 30).some(e => e.active && !e.isSupplySlot && Math.hypot(e.x - g.x, e.y - g.y) <= R.ringRadius - 10);
    if (inside && time >= g.mines[0].armAt) g.fuseAt = Math.min(g.fuseAt, time + R.mineFuseMs);
    if (level < 5 && g.fuseAt - time <= R.mineFuseMs * .4) for (const m of g.mines) warnMine(m, true); // 满级这一圈先化作地火，示警留给地火收尾
    if (time >= g.fuseAt) fireRing(host, s, g, damage, radius, time, level);
  }
  const max = R.mineMax + 2 * growth.masteries.fulei + (level >= 4 ? R.mineMaxLv4Bonus : 0) + (level >= 5 ? R.mineMaxLv5Bonus : 0), life = R.mineLifeMs + 2000 * growth.masteries.fulei;
  // 落凤坡伏兵：生命 <30% 时脚下布 4 枚火雷，以铁索连成方阵护身（每 30 秒最多一次）
  if (pl.alive && pl.hp < pl.maxHp * R.fengpoHp && time >= s.fengpoReadyAt) {
    s.fengpoReadyAt = time + R.fengpoCooldownMs;
    const sq: Mine[] = [];
    for (let k = 0; k < R.fengpoMines; k++) { const a = k * Math.PI / 2 + Math.PI / 4; sq.push(placeMine(host, s, pl.x + Math.cos(a) * 46, pl.y + Math.sin(a) * 46, time, life, 'fengpo')); }
    for (let k = 0; k < sq.length; k++) tie(host, s, sq[k], sq[(k + 1) % sq.length]);
    const t = host.add.text(pl.x, pl.y - 66, '落凤坡伏兵', { fontFamily: 'serif', fontSize: '20px', color: '#ffd9a0', stroke: '#5a1a10', strokeThickness: 5 }).setOrigin(.5).setDepth(60).setName('pangtong-fengpo');
    t.scene.tweens.add({ targets: t, y: pl.y - 96, alpha: 0, delay: 500, duration: 600, onComplete: () => t.destroy() });
  }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const foes = host.grid.query(pl.x, pl.y, 320).filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - pl.x, e.y - pl.y) <= 320)
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  if (!foes.length) return; // 没有敌人不布雷、不耗冷却
  const priority = host.priorityTarget?.(320) ?? null; if (priority) { foes.splice(foes.indexOf(priority), 1); foes.unshift(priority); }
  const cast = pl.passive.beginCast('lianhuan_mines');
  if (cast.formation) {
    // 火烧连环：身边一圈 6 枚火雷，以锁链连成环
    pl.faceDirection(foes[0].x < pl.x ? 'left' : 'right', 200);
    host.spawnFlagSwingFx(Math.sign(foes[0].x - pl.x) || 1, 0);
    host.sfx.play('flameSwing');
    pl.playAction('skill', foes[0].x < pl.x ? 'left' : 'right');
    const g: RingGroup = { x: pl.x, y: pl.y, fuseAt: time + R.ringFuseMs, mines: [], links: host.add.container(0, 0).setDepth(19.5).setName('pangtong-ring'), fired: false };
    for (let k = 0; k < R.ringMines; k++) { const a = k * Math.PI * 2 / R.ringMines; g.mines.push(placeMine(host, s, pl.x + Math.cos(a) * R.ringRadius, pl.y + Math.sin(a) * R.ringRadius, time, R.ringFuseMs + R.loopMs + 1000, 'ring', g)); }
    for (let k = 0; k < R.ringMines; k++) linkFx(host, g.mines[k], g.mines[(k + 1) % R.ringMines], g.links);
    s.rings.push(g);
  } else {
    // 脚下落雷，拉铁索连上一枚雷（Lv4 起再连最近的另一枚）
    while (s.mines.filter(m => m.kind === 'trail').length >= max) { const old = s.mines.find(m => m.kind === 'trail' && !m.lit && !m.loop); if (!old) break; explode(host, s, old, damage, radius, null, 0, false, time, level); }
    const m = placeMine(host, s, pl.x, pl.y, time, life, 'trail'), prev = s.lastTrail;
    if (prev && !prev.lit && s.mines.includes(prev) && Math.hypot(prev.x - m.x, prev.y - m.y) <= len) tie(host, s, prev, m);
    if (lianhuanLinksPerMine(level) >= 2) {
      const near = s.mines.filter(o => o !== m && o !== prev && !o.lit && !o.ring && Math.hypot(o.x - m.x, o.y - m.y) <= len)
        .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
      if (near) tie(host, s, near, m);
    }
    // Lv5 铁索连舟：绕回来、新雷挨近至少 3 枚之前的旧雷 → 铁索首尾相接，圈内（面积够大才算）整片起火
    if (level >= 5) {
      const back = s.mines.filter(o => o.kind === 'trail' && !o.lit && !o.loop && o.seq <= m.seq - R.loopBackSteps && Math.hypot(o.x - m.x, o.y - m.y) <= len)
        .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
      if (back) {
        const ring = s.mines.filter(o => o.kind === 'trail' && !o.lit && !o.loop && o.seq >= back.seq && o.seq <= m.seq).sort((a, b) => a.seq - b.seq);
        if (ring.length >= 3 && polyArea(ring) >= R.loopMinArea) { tie(host, s, back, m); startLoop(host, s, ring, time); host.sfx.play('flameSwing'); }
      }
    }
    s.lastTrail = m;
  }
  weapon.cooldownLeft = Math.max(.25, LIANHUAN_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}

/** 测试 / 调试用：当前场上火雷数。 */
export function lianhuanMineCount(p: Player): number { return STATE.get(p)?.mines.length ?? 0; }
/** 测试 / 调试用：铁索段数、正在燃烧的连舟数。 */
export function lianhuanNetStats(p: Player): { tethers: number; loops: number } { const s = STATE.get(p); return { tethers: s?.tethers.length ?? 0, loops: s?.loops.length ?? 0 }; }

// ───────────────────────── 孙尚香 · 弓腰姬飞刀 ─────────────────────────
// 近：身边环绕飞刀，割伤贴身敌人；远：从环里掷出一把，穿透、不飞回，1.2 秒后在身边重新凝成一把。
// 被动「侍婢执刀」满层时召执刀侍婢护身。飞刀、侍婢、刀光均为程序化过渡（侍婢暂借蜀军刀兵行走图染红）。

/** 环绕飞刀数：Lv1–2 两把、Lv3–4 三把、Lv5 四把。 */
export const sunOrbitKnives = (level: number): number => (level >= 5 ? 4 : level >= 3 ? 3 : 2);
export const SUN_KNIVES_DEF = {
  id: 'sun_knives' as const, name: '弓腰姬飞刀', maxLevel: 5,
  /** 掷刀伤害；环绕割伤用 sunOrbitDamage。 */
  // 2026-11-16 前低后高（原 18/20/23/26/30），后两级加高补打首领
  damage: (level: number, stats: PlayerStats) => [16, 19, 23, 28, 35][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [.9, .9, .85, .8, .75][lv(level)] * stats.cooldownMul,
  desc: '身边环绕飞刀割伤近敌，并不断掷出飞刀穿透远敌；移动中掷得更快',
};
/** 每次掷几把 / 每把穿透（Lv1–Lv5）。 */
export const sunThrowCount = (level: number): number => R.knifeCountByLevel[lv(level)];
export const sunThrowPierce = (level: number): number => R.knifePierceByLevel[lv(level)];
export const sunOrbitDamage = (level: number, stats: PlayerStats): number => [10, 11, 12, 13, 15][lv(level)] * stats.damageMul * stats.meleeMul;

interface OrbitKnife { img: Phaser.GameObjects.Image; readyAt: number; }
interface ThrownKnife { img: Phaser.GameObjects.Image; vx: number; vy: number; left: number; pierce: number; hit: Set<number>; damage: number; }
interface Maid { img: Phaser.GameObjects.Image; until: number; angle: number; nextSlash: number; }
interface SunState { orbit: OrbitKnife[]; thrown: ThrownKnife[]; maids: Maid[]; spin: number; orbitHit: Map<number, number>; }
const SUN = new WeakMap<Player, SunState>();
const sceneOf = (host: WeaponHost): Phaser.Scene => (host.add as unknown as { scene: Phaser.Scene }).scene;

/** 程序化飞刀贴图（过渡）：银白刀身 + 赤红刀柄缠布。 */
function ensureKnifeTexture(host: WeaponHost): string {
  if (sceneOf(host).textures.exists('sun_knife')) return 'sun_knife'; // 正式飞刀贴图（2026-11-16 ChatGPT）
  const key = 'sun_knife_tex', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x7a1a14, 1).fillRect(0, 4, 8, 4);
  g.fillStyle(0xd8b060, 1).fillRect(8, 2, 2, 8);
  g.fillStyle(0xe8eef4, 1).fillTriangle(10, 2, 10, 10, 30, 6);
  g.lineStyle(1, 0x8a96a4, 1).lineBetween(11, 6, 28, 6);
  g.generateTexture(key, 32, 12); g.destroy();
  return key;
}

function sunState(host: WeaponHost): SunState {
  let s = SUN.get(host.player);
  if (!s) { s = { orbit: [], thrown: [], maids: [], spin: 0, orbitHit: new Map() }; SUN.set(host.player, s); }
  return s;
}

function summonMaids(host: WeaponHost, s: SunState, time: number, count: number, ms: number, cap: number): void {
  const pl = host.player, scene = sceneOf(host);
  for (let k = 0; k < count; k++) {
    if (s.maids.length >= cap) { const old = s.maids.shift()!; old.img.destroy(); }
    const angle = Math.random() * Math.PI * 2, x = pl.x + Math.cos(angle) * (R.maidRange * host.player.passive.rangeMultiplier('sun_knives')), y = pl.y + Math.sin(angle) * (R.maidRange * host.player.passive.rangeMultiplier('sun_knives'));
    // 正式执刀侍婢行走图（sun_maid_walk）；缺图时借蜀军刀兵染红过渡
    const img = scene.textures.exists('sun_maid_walk') ? host.add.image(x, y, 'sun_maid_walk', 'down_0')
      : scene.textures.exists('shu_swordsman_walk_sheet') ? host.add.image(x, y, 'shu_swordsman_walk_sheet', 'down_0').setTint(0xff9a8a)
      : host.add.image(x, y, ensureKnifeTexture(host)).setTint(0xff9a8a);
    img.setScale(46 / Math.max(1, img.height)).setDepth(39).setName('sun-maid');
    s.maids.push({ img, until: time + ms, angle, nextSlash: time + 200 });
    // 召唤刀光（过渡）
    if (SHOW_OWN_RANGE_FX) { const ring = host.add.circle(x, y, 8, 0xff6a5a, 0).setStrokeStyle(3, 0xffc0a0, .9).setDepth(41);
    ring.scene.tweens.add({ targets: ring, radius: 40, alpha: 0, duration: 320, onComplete: () => ring.destroy() }); }
  }
}

export function sunKnivesBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = sunState(host), growth = pl.growth, level = weapon.level, tex = ensureKnifeTexture(host);
  // 环绕刀数随等级补齐
  const want = sunOrbitKnives(level);
  while (s.orbit.length < want) s.orbit.push({ img: host.add.image(pl.x, pl.y, tex).setDisplaySize(30, 14).setDepth(40).setName('sun-orbit-knife'), readyAt: time });
  s.spin += dt * 3.2;
  const orbitDamage = sunOrbitDamage(level, pl.stats) * growth.damageMultiplier(time);
  s.orbit.forEach((k, i) => {
    const a = s.spin + i * Math.PI * 2 / s.orbit.length, x = pl.x + Math.cos(a) * (R.knifeOrbitR * host.player.passive.rangeMultiplier('sun_knives')), y = pl.y - 6 + Math.sin(a) * (R.knifeOrbitR * host.player.passive.rangeMultiplier('sun_knives')) * .8;
    const ready = time >= k.readyAt;
    k.img.setPosition(x, y).setRotation(a + Math.PI / 2).setVisible(pl.alive).setAlpha(ready ? 1 : Math.max(.15, 1 - (k.readyAt - time) / R.knifeRegenMs));
    if (!pl.alive) return;
    // 掷出后正在补刀的那一把也照样割伤（50%）：否则掷刀节奏（≤0.9 秒）与补刀（1.2 秒）、环绕周期（约 2 秒）
    // 会对上相位，经过某个贴身敌人的总是“空位”，近身防守时有时无（2026-11-16 回归发现）
    for (const e of host.grid.query(x, y, 40)) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - x, e.y - y) > 12 + e.radius) continue;
      if ((s.orbitHit.get(e.spawnId) ?? 0) > time) continue;
      s.orbitHit.set(e.spawnId, time + R.knifeOrbitHitMs);
      host.hitEnemy(e, orbitDamage * (ready ? 1 : .5), time, 'melee');
    }
  });
  if (s.orbitHit.size > 300) for (const [id, t] of s.orbitHit) if (t <= time) s.orbitHit.delete(id);
  // 掷出的飞刀：直线飞行、穿透，不飞回
  for (let i = s.thrown.length - 1; i >= 0; i--) {
    const k = s.thrown[i], step = Math.hypot(k.vx, k.vy) * dt;
    k.img.x += k.vx * dt; k.img.y += k.vy * dt; k.left -= step;
    for (const e of host.grid.query(k.img.x, k.img.y, 40)) {
      if (k.pierce <= 0) break;
      if (!e.active || e.isSupplySlot || k.hit.has(e.spawnId) || Math.hypot(e.x - k.img.x, e.y - k.img.y) > 10 + e.radius) continue;
      k.hit.add(e.spawnId); k.pierce--; host.hitEnemy(e, k.damage, time, 'arrow');
    }
    if (k.left <= 0 || k.pierce <= 0 || host.over) { k.img.destroy(); s.thrown.splice(i, 1); }
  }
  // 侍婢：绕身护卫，近敌挥刀
  const maidDamage = SUN_KNIVES_DEF.damage(level, pl.stats) * growth.damageMultiplier(time) * R.maidDamageByLevel[lv(level)];
  for (let i = s.maids.length - 1; i >= 0; i--) {
    const m = s.maids[i];
    if (time >= m.until || host.over) { m.img.scene.tweens.add({ targets: m.img, alpha: 0, duration: 200, onComplete: () => m.img.destroy() }); s.maids.splice(i, 1); continue; }
    m.angle += dt * 1.6;
    const tx = pl.x + Math.cos(m.angle) * (R.maidRange * host.player.passive.rangeMultiplier('sun_knives')), ty = pl.y + Math.sin(m.angle) * (R.maidRange * host.player.passive.rangeMultiplier('sun_knives')) * .8;
    const mvx = (tx - m.img.x) * Math.min(1, dt * 6), mvy = (ty - m.img.y) * Math.min(1, dt * 6); m.img.x += mvx; m.img.y += mvy;
    if (m.img.texture.key === 'sun_maid_walk') { const dir = Math.abs(mvx) > Math.abs(mvy) ? (mvx < 0 ? 'left' : 'right') : (mvy < 0 ? 'up' : 'down'); m.img.setFrame(`${dir}_${Math.floor(time / 140) % 4}`); }
    if (time < m.nextSlash) continue;
    let best: Enemy | null = null, bd: number = (R.maidRange * host.player.passive.rangeMultiplier('sun_knives'));
    for (const e of host.grid.query(m.img.x, m.img.y, (R.maidRange * host.player.passive.rangeMultiplier('sun_knives')))) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - m.img.x, e.y - m.img.y); if (d < bd) { bd = d; best = e; } }
    if (!best) continue;
    m.nextSlash = time + R.maidSlashMs; m.img.setFlipX(best.x < m.img.x);
    host.hitEnemy(best, maidDamage, time, 'melee');
    const a = Math.atan2(best.y - m.img.y, best.x - m.img.x);
    if (texOk(host, 'sun_maid_slash')) {
      // 正式刀光：6 帧弧形斩击（图里弧背朝左上，转 a + 3π/4 让弧背朝向目标），叠加混合，约 0.25 秒播完
      const fx = host.add.sprite(m.img.x + Math.cos(a) * 14, m.img.y + Math.sin(a) * 14, 'sun_maid_slash', 0).setDisplaySize(64, 64)
        .setRotation(a + Math.PI * .75).setBlendMode('ADD').setDepth(41).setName('sun-maid-slash');
      const f = { t: 0 };
      fx.scene.tweens.add({ targets: f, t: 5.99, duration: 250, onUpdate: () => fx.setFrame(Math.floor(f.t)), onComplete: () => fx.destroy() });
    } else {
      const arc = host.add.graphics().setDepth(41);
      arc.lineStyle(3, 0xffe0c0, .95).beginPath().arc(m.img.x, m.img.y, 26, a - .8, a + .8).strokePath();
      arc.scene.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
    }
  }
  // 掷刀
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  // 掷刀优先打环绕刀够不着的敌人（环外最近者），环内的交给环绕刀；环外没有敌人时才打最近的
  const outer = (R.knifeOrbitR * host.player.passive.rangeMultiplier('sun_knives')) + 30;
  // 统一索敌：环外（首领 > 精锐 > 群怪 > 最近），环外没有敌人时才打环内
  const target = smartTarget(host, (R.knifeRange * host.player.passive.rangeMultiplier('sun_knives')), outer) ?? smartTarget(host, (R.knifeRange * host.player.passive.rangeMultiplier('sun_knives')));
  if (!target) return;
  const ready = s.orbit.filter(k => time >= k.readyAt);
  if (!ready.length) { weapon.cooldownLeft = .1; return; }
  const cast = pl.passive.beginCast('sun_knives');
  const maidCap = R.maidMax + growth.masteries.baibi, maidMs = R.maidMs + 2000 * growth.masteries.baibi;
  if (cast.maids) { pl.playAction('skill', target.x < pl.x ? 'left' : 'right'); summonMaids(host, s, time, R.maidSummon, maidMs, maidCap); }
  else pl.playAction('attack', target.x < pl.x ? 'left' : 'right');
  pl.faceDirection(target.x < pl.x ? 'left' : 'right', 160);
  const moving = pl.passive.isMoving(time);
  // 每次掷几把随等级 1/1/2/2/3：第一把打主目标，其余飞向主目标以外的近敌（伤害 60%）；没有别的敌人时散射在主目标两侧
  const base = SUN_KNIVES_DEF.damage(level, pl.stats) * growth.damageMultiplier(time), pierce = R.knifePierceByLevel[lv(level)] + (moving ? growth.masteries.huishen : 0);
  const count = Math.min(ready.length, R.knifeCountByLevel[lv(level)]);
  const others = host.grid.query(pl.x, pl.y, (R.knifeRange * host.player.passive.rangeMultiplier('sun_knives'))).filter(e => e.active && !e.isSupplySlot && e !== target && Math.hypot(e.x - pl.x, e.y - pl.y) <= (R.knifeRange * host.player.passive.rangeMultiplier('sun_knives')))
    .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
  for (let k = 0; k < count; k++) {
    const knife = ready[k], sx = knife.img.x, sy = knife.img.y, t = k === 0 ? target : others[k - 1];
    let ax = (t ?? target).x - sx, ay = (t ?? target).y - sy;
    if (!t) { const a = Math.atan2(ay, ax) + (k % 2 ? 1 : -1) * .22 * Math.ceil(k / 2), d0 = Math.hypot(ax, ay); ax = Math.cos(a) * d0; ay = Math.sin(a) * d0; }
    const d = Math.hypot(ax, ay) || 1;
    knife.readyAt = time + R.knifeRegenMs;
    s.thrown.push({ img: host.add.image(sx, sy, tex).setDisplaySize(32, 15).setDepth(41).setRotation(Math.atan2(ay, ax)).setName('sun-thrown-knife'),
      vx: ax / d * R.knifeSpeed, vy: ay / d * R.knifeSpeed, left: (R.knifeRange * host.player.passive.rangeMultiplier('sun_knives')) + 40,
      pierce, hit: new Set(), damage: base * (k === 0 ? 1 : R.knifeExtraMul) });
  }
  host.sfx.play('allySpear');
  weapon.cooldownLeft = Math.max(.2, SUN_KNIVES_DEF.cooldown(level, pl.stats) * (moving ? R.knifeMovingCdMul : 1) / growth.attackSpeedMultiplier(time));
}
/** 测试用：环绕刀 / 在飞的刀 / 侍婢数量。 */
export function sunKnifeStats(p: Player): { orbit: number; ready: number; thrown: number; maids: number } {
  const s = SUN.get(p); const now = (p.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? 0;
  return { orbit: s?.orbit.length ?? 0, ready: s?.orbit.filter(k => now >= k.readyAt).length ?? 0, thrown: s?.thrown.length ?? 0, maids: s?.maids.length ?? 0 };
}

// ───────────────────────── 貂蝉 · 双花扇 ─────────────────────────
// 回旋飞扇：掷出 230 像素后飞回手上，去程、回程各能打中同一敌人一次；命中加魅惑，满层倒戈（离间）。
// 被动满层「闭月」：舞带环身旋舞 2 秒，圈内持续伤害并令敌人倒戈。飞扇、魅惑标记、舞带均为程序化过渡。

/** 同时掷出的扇子数：Lv1–2 一柄、Lv3–4 两柄、Lv5 三柄（霓裳 3 级再 +1）。 */
export const diaochanFanCount = (level: number): number => (level >= 5 ? 3 : level >= 3 ? 2 : 1);
export const DIAOCHAN_FANS_DEF = {
  id: 'diaochan_fans' as const, name: '双花扇', maxLevel: 5,
  damage: (level: number, stats: PlayerStats) => [20, 23, 26, 29, 33][lv(level)] * stats.damageMul * stats.arrowMul,
  cooldown: (level: number, stats: PlayerStats) => [1.2, 1.2, 1.15, 1.1, 1.05][lv(level)] * stats.cooldownMul,
  desc: '掷出回旋团扇，去回各打一次；命中积魅惑，满层的敌人倒戈攻击同伴',
};
interface Fan { img: Phaser.GameObjects.Image; ox: number; oy: number; ex: number; ey: number; back: boolean; t: number; outHit: Set<number>; backHit: Set<number>; damage: number; }
interface DiaoState { fans: Fan[]; marks: Map<number, Phaser.GameObjects.Text | Phaser.GameObjects.Image>; danceUntil: number; nextTick: number; ribbon?: Phaser.GameObjects.Graphics; }
const DIAO = new WeakMap<Player, DiaoState>();

/** 程序化团扇贴图（过渡）：粉色扇面 + 金色扇骨。 */
function ensureFanTexture(host: WeaponHost): string {
  if (sceneOf(host).textures.exists('diaochan_fan')) return 'diaochan_fan'; // 正式团扇贴图
  const key = 'diaochan_fan_tex', scene = sceneOf(host);
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffd6ec, 1).slice(16, 20, 15, Math.PI * 1.1, Math.PI * 1.9, false).fillPath();
  g.lineStyle(2, 0xe2b04a, 1); for (let k = 0; k <= 4; k++) { const a = Math.PI * (1.1 + .2 * k); g.lineBetween(16, 20, 16 + Math.cos(a) * 15, 20 + Math.sin(a) * 15); }
  g.fillStyle(0xff7ab8, 1).fillCircle(16, 12, 3);
  g.generateTexture(key, 32, 24); g.destroy();
  return key;
}

function diaoState(host: WeaponHost): DiaoState {
  let s = DIAO.get(host.player);
  if (!s) { s = { fans: [], marks: new Map(), danceUntil: 0, nextTick: 0 }; DIAO.set(host.player, s); }
  return s;
}

function fanHit(host: WeaponHost, e: Enemy, damage: number, time: number): void {
  const g = host.player.growth, need = g.masteries.meirenji >= 3 ? 2 : R.charmNeed, ms = R.turnMs + 500 * g.masteries.meirenji;
  host.hitEnemy(e, damage, time, 'arrow');
  if (host.player.passive.addCharm(e, time, need, ms)) {
    const t = host.add.text(e.x, e.y - e.radius - 30, '离间', { fontFamily: 'serif', fontSize: '15px', color: '#ffd0ec', stroke: '#6a1a4a', strokeThickness: 4 }).setOrigin(.5).setDepth(60);
    t.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }
}

export function diaochanFansBehavior(host: WeaponHost, weapon: WeaponState, dt: number, time: number): void {
  const pl = host.player, s = diaoState(host), growth = pl.growth, level = weapon.level, tex = ensureFanTexture(host);
  const damage = DIAOCHAN_FANS_DEF.damage(level, pl.stats) * growth.damageMultiplier(time);
  // 魅惑 / 倒戈标记（粉心 = 魅惑层数；「乱」= 倒戈中）
  const seen = new Set<number>();
  for (const c of pl.passive.charmViews()) {
    const e = c.enemy; if (!e.active || e.spawnId !== c.spawnId) continue;
    const turned = c.turnedUntil > time, label = turned ? '乱' : c.marks ? '♥'.repeat(c.marks) : c.vulnUntil > time ? '惑' : '';
    if (!label) continue;
    seen.add(e.uid);
    let t = s.marks.get(e.uid);
    if (sceneOf(host).textures.exists('charm_heart')) {
      // 正式标记：粉心（魅惑层数越多越大）/ 断锁链（倒戈中）/ 首领易伤用半透明粉心
      const key = turned ? 'charm_broken' : 'charm_heart', size = turned ? 22 : c.marks ? 11 + 4 * c.marks : 14;
      if (!t || t.type !== 'Image') { t?.destroy(); t = host.add.image(e.x, e.y, key).setDepth(60).setName('diaochan-mark'); s.marks.set(e.uid, t); }
      (t as Phaser.GameObjects.Image).setTexture(key).setDisplaySize(size, size).setAlpha(!turned && !c.marks ? .6 : 1).setPosition(e.x, e.y - e.radius - 24);
    } else {
      if (!t) { t = host.add.text(e.x, e.y, '', { fontFamily: 'serif', fontSize: '13px', color: '#ff8fd0', stroke: '#3a0a24', strokeThickness: 3 }).setOrigin(.5).setDepth(60).setName('diaochan-mark'); s.marks.set(e.uid, t); }
      (t as Phaser.GameObjects.Text).setText(label).setColor(turned ? '#ffe0f4' : '#ff8fd0').setPosition(e.x, e.y - e.radius - 22);
    }
  }
  for (const [uid, t] of s.marks) if (!seen.has(uid)) { t.destroy(); s.marks.delete(uid); }
  // 回旋飞扇
  for (let i = s.fans.length - 1; i >= 0; i--) {
    const f = s.fans[i]; f.img.rotation += dt * 14;
    if (!f.back) {
      f.t += dt * R.fanSpeed / Math.max(1, Math.hypot(f.ex - f.ox, f.ey - f.oy));
      const k = Math.min(1, f.t); f.img.setPosition(f.ox + (f.ex - f.ox) * k, f.oy + (f.ey - f.oy) * k);
      if (f.t >= 1) f.back = true;
    } else {
      const dx = pl.x - f.img.x, dy = pl.y - 8 - f.img.y, d = Math.hypot(dx, dy);
      if (d < 18 || host.over) { f.img.destroy(); s.fans.splice(i, 1); continue; }
      const step = Math.min(d, R.fanSpeed * 1.1 * dt); f.img.x += dx / d * step; f.img.y += dy / d * step;
    }
    const hits = f.back ? f.backHit : f.outHit;
    for (const e of host.grid.query(f.img.x, f.img.y, 50)) {
      if (!e.active || e.isSupplySlot || hits.has(e.spawnId) || Math.hypot(e.x - f.img.x, e.y - f.img.y) > 16 + e.radius) continue;
      hits.add(e.spawnId); fanHit(host, e, f.damage, time);
    }
  }
  // 闭月：舞带环身旋舞
  if (time < s.danceUntil) {
    if (s.ribbon) { s.ribbon.clear(); if (SHOW_OWN_RANGE_FX) { const a0 = time / 180; s.ribbon.setPosition(pl.x, pl.y - 6);
      for (let k = 0; k < 3; k++) { const a = a0 + k * Math.PI * 2 / 3; s.ribbon.lineStyle(6 - k, k % 2 ? 0xe9a6ff : 0xffc6ec, .85).beginPath().arc(0, 0, (R.moonRadius * host.player.passive.rangeMultiplier('diaochan_fans')) * (.55 + .15 * k), a, a + 1.6).strokePath(); } } }
    if (time >= s.nextTick) {
      s.nextTick = time + R.moonTickMs;
      const turnMs = R.turnMs + 500 * growth.masteries.meirenji;
      for (const e of host.grid.query(pl.x, pl.y, (R.moonRadius * host.player.passive.rangeMultiplier('diaochan_fans')) + 30)) {
        if (!e.active || e.isSupplySlot || Math.hypot(e.x - pl.x, e.y - pl.y) > (R.moonRadius * host.player.passive.rangeMultiplier('diaochan_fans')) + e.radius) continue;
        host.hitEnemy(e, damage * R.moonDamageMul, time, 'arrow'); pl.passive.forceTurn(e, time, turnMs);
      }
    }
    return;
  }
  if (s.ribbon) { s.ribbon.destroy(); s.ribbon = undefined; }
  weapon.cooldownLeft -= dt;
  if (weapon.cooldownLeft > 0) return;
  const range = R.fanRange * (1 + .15 * growth.masteries.nichang) * host.player.passive.rangeMultiplier('diaochan_fans'); // 智力范围加成
  const target = smartTarget(host, range + 60);
  if (!target) return;
  const cast = pl.passive.beginCast('diaochan_fans');
  pl.faceDirection(target.x < pl.x ? 'left' : 'right', 200);
  if (cast.moonDance) {
    pl.playAction('skill', target.x < pl.x ? 'left' : 'right');
    s.danceUntil = time + R.moonMs; s.nextTick = time;
    s.ribbon = host.add.graphics().setDepth(41).setName('diaochan-moon');
    host.heroFx?.(sceneOf(host).textures.exists('hero_fx_d') ? 'moonDance' : 'charm', pl.x, pl.y - 6, (R.moonRadius * host.player.passive.rangeMultiplier('diaochan_fans')) * 2.4); // 闭月正式序列帧（fx_d 第 1 行），缺图用倾城花瓣旋涡
    weapon.cooldownLeft = R.moonMs / 1000;
    return;
  }
  pl.playAction('attack', target.x < pl.x ? 'left' : 'right');
  const n = diaochanFanCount(level) + (growth.masteries.nichang >= 3 ? 1 : 0), a0 = Math.atan2(target.y - pl.y, target.x - pl.x), spread = 25 * Math.PI / 180;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k - (n - 1) / 2) * spread, ox = pl.x, oy = pl.y - 8;
    s.fans.push({ img: host.add.image(ox, oy, tex).setDisplaySize(30, 30).setDepth(41).setName('diaochan-fan'), ox, oy, ex: ox + Math.cos(a) * range, ey: oy + Math.sin(a) * range, back: false, t: 0, outHit: new Set(), backHit: new Set(), damage });
  }
  host.sfx.play('allySlash');
  weapon.cooldownLeft = Math.max(.25, DIAOCHAN_FANS_DEF.cooldown(level, pl.stats) / growth.attackSpeedMultiplier(time));
}
/** 测试用：清掉庞统场上所有火雷、铁索、连舟地火与火烧连环（不引爆）。 */
export function lianhuanClear(p: Player): void {
  const s = STATE.get(p); if (!s) return;
  for (const m of s.mines) m.body.destroy();
  for (const t of s.tethers) t.body.destroy();
  for (const l of s.loops) l.fx.destroy();
  for (const g of s.rings) g.links.destroy();
  s.mines.length = s.tethers.length = s.loops.length = s.rings.length = 0; s.lastTrail = null; s.burnAt.clear();
}
