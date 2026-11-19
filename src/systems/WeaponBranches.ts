import Phaser from 'phaser';
import { DEPTH } from '../config';
import { branchById, branchTier, type WeaponBranch } from '../data/weaponBranches';
import type { SchoolId } from '../data/schools';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { WeaponState } from '../types';
import { playSheet } from './SkillFxSheets';

/**
 * 兵器专职分支的战斗效果（data/weaponBranches.ts；wave-progression-redesign.md §4.7）。
 * 不改原武器逻辑：看本命武器「出手」（冷却被重置）、武器命中、击杀、主将移动来触发分支效果。
 * 特效全部用现有手绘序列帧换色（skill-fx / 典韦 / 学派觉醒 / 枪刺图），以后出了分支专属序列帧再换。
 * 强度：档 1（选定）/ 2（Lv6）/ 3（Lv7）按 k = 1 + 0.3 ×（档 − 1）；Lv7 且该派 4 势为进阶形态（final）。
 * 第一批：赵云 / 关羽 / 张飞 / 刘备 八个分支。
 */
export interface BranchHost {
  scene: Phaser.Scene;
  player: Player;
  now: () => number;
  weapon: () => WeaponState | undefined;
  /** 本命一击的基础伤害（含主将伤害倍率）。 */
  hit: () => number;
  query: (x: number, y: number, r: number) => Enemy[];
  /** 分支造成的伤害（不算武器命中，不会再触发分支）。 */
  damage: (e: Enemy, n: number, fire?: boolean) => void;
  shi: (s: SchoolId) => number;
  allies: () => Array<{ active: boolean; x: number; y: number; hp: number; maxHp: number }>;
  troopBoost: (mul: number, ms: number) => void;
  escort: (x: number, y: number, n: number, ms: number) => void;
  slow: (x: number, y: number, r: number, slow: number, ms: number) => void;
  /** 随行武将（可玩名将 id）。 */
  followerHeroes: () => readonly string[];
  banner: (title: string, sub: string) => void;
  sfx: (k: string) => void;
}
interface Seg { x: number; y: number; until: number; nextTick: number }

export class WeaponBranches {
  private lastCd = 0; private nextAt = 0; private dashQueue: number[] = []; private finalShown = false;
  private moveX = 0; private moveY = 0; private travel = 0; private segs: Seg[] = [];
  private barrier?: { ax: number; ay: number; bx: number; by: number; until: number; nextTick: number };
  private stunned = new Map<Enemy, number>(); private guardUntil = 0; private healAt = 0; private healFxAt = 0; private thirdAt = 0;
  /** 测试用。 */
  readonly stats = { fires: 0, procs: 0, hits: 0, final: false };

  constructor(private readonly h: BranchHost) { const p = h.player; this.moveX = p.x; this.moveY = p.y; }

  get branch(): WeaponBranch | undefined { return branchById(this.h.weapon()?.branch); }
  private tier(): number { const w = this.h.weapon(); return w ? branchTier(w) : 0; }
  private k(): number { return 1 + .3 * (this.tier() - 1); }
  private final(): boolean { const b = this.branch; return !!b && this.tier() >= 3 && this.h.shi(b.school) >= 4; }
  private nearest(r: number): Enemy | null { const P = this.h.player; let best: Enemy | null = null, d0 = r; for (const e of this.h.query(P.x, P.y, r)) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < d0) { d0 = d; best = e; } } return best; }
  private fx(key: string, x: number, y: number, size: number, ms: number, tint: number, rotation = 0): void { playSheet(this.h.scene, key, x, y, { size, ms, depth: DEPTH.fx, tint, rotation, add: true }); }

  update(): void {
    const b = this.branch, w = this.h.weapon(); if (!b || !w) return;
    const now = this.h.now(), P = this.h.player;
    if (!this.finalShown && this.final()) { this.finalShown = true; this.stats.final = true; this.h.banner('兵器进阶 · ' + b.finalName, b.finalDesc); }
    // 「出手」：冷却被重置（跳回较大的值）
    const fired = w.cooldownLeft > this.lastCd + .05; this.lastCd = w.cooldownLeft;
    if (fired) { this.stats.fires++; this.onFire(b, now); }
    while (this.dashQueue.length && now >= this.dashQueue[0]) { this.dashQueue.shift(); this.dash(); }
    // 移动距离（千里走单骑）
    const dx = P.x - this.moveX, dy = P.y - this.moveY, d = Math.hypot(dx, dy);
    if (b.id === 'gy_danqi' && d >= 70) { this.segs.push({ x: this.moveX, y: this.moveY, until: now + (this.tier() >= 3 ? 2600 : 2000), nextTick: now }); this.fx('fx_drag_scar', this.moveX, this.moveY, 92, this.tier() >= 3 ? 2600 : 2000, 0x8fe0b0, Math.atan2(dy, dx)); if (this.segs.length > 12) this.segs.shift(); this.travel += d; this.stats.procs++; this.moveX = P.x; this.moveY = P.y;
      if (this.final() && this.travel >= 400) { this.travel = 0; this.sweep(150, 1.5, 0x7fd6a0); } }
    else if (b.id !== 'gy_danqi') { this.moveX = P.x; this.moveY = P.y; }
    for (const s of this.segs) if (now < s.until && now >= s.nextTick) { s.nextTick = now + 500; for (const e of this.h.query(s.x, s.y, 46)) if (e.active && Math.hypot(e.x - s.x, e.y - s.y) <= 46 + e.radius) this.deal(e, .35); }
    this.segs = this.segs.filter(s => now < s.until);
    // 百鸟朝凤：定时风暴
    if (b.id === 'zy_bainiao' && now >= this.nextAt && this.nearest(200)) { this.nextAt = now + 6000 / this.k(); this.storm(); }
    // 断桥
    const br = this.barrier;
    if (br && now < br.until && now >= br.nextTick) { br.nextTick = now + 250;
      const cx = (br.ax + br.bx) / 2, cy = (br.ay + br.by) / 2, half = Math.hypot(br.bx - br.ax, br.by - br.ay) / 2;
      for (const e of this.h.query(cx, cy, half + 40)) { if (!e.active || e.kind === 'boss' || (e.kind === 'elite' && !this.final())) continue; if (segDist(e.x, e.y, br.ax, br.ay, br.bx, br.by) > 28 + e.radius) continue;
        const last = this.stunned.get(e) ?? 0; if (now - last < 1200) continue; this.stunned.set(e, now); e.stunUntil = Math.max(e.stunUntil, now + 700); this.deal(e, .2); } }
  }

  private onFire(b: WeaponBranch, now: number): void {
    const P = this.h.player, k = this.k();
    if (b.id === 'zy_longdan' && now >= this.nextAt) { this.nextAt = now + 3000 / k; this.dash(); if (this.final()) this.dashQueue.push(now + 170, now + 340); }
    else if (b.id === 'gy_qinglong') this.crescent();
    else if (b.id === 'zf_duanqiao') {
      const t = this.nearest(320), ang = t ? Math.atan2(t.y - P.y, t.x - P.x) : 0, w = 200 * (1 + .15 * (this.tier() - 1)), cx = P.x + Math.cos(ang) * 150, cy = P.y + Math.sin(ang) * 150, px = -Math.sin(ang), py = Math.cos(ang);
      this.barrier = { ax: cx - px * w / 2, ay: cy - py * w / 2, bx: cx + px * w / 2, by: cy + py * w / 2, until: now + 3000 * (1 + .2 * (this.tier() - 1)), nextTick: now };
      for (let i = -1; i <= 1; i++) this.fx('fx_collapse_dust', cx + px * w / 3 * i, cy + py * w / 3 * i, 120, 900, 0xd8c8a0);
      this.stats.procs++;
    } else if (b.id === 'zf_nuhou') {
      this.h.troopBoost(1.2 + .1 * (this.tier() - 1), 5000 + 1000 * (this.tier() - 1)); this.guardUntil = now + 3000;
      this.fx('fx_awaken_formation', P.x, P.y, 220, 700, 0xffd27a); this.stats.procs++;
    }
  }
  /** 自身受伤（燕人怒吼：减伤，进阶后反震）。返回修正后的伤害。 */
  guard(n: number): number {
    const b = this.branch; if (!b || b.id !== 'zf_nuhou' || this.h.now() >= this.guardUntil) return n;
    if (this.final()) { const P = this.h.player; for (const e of this.h.query(P.x, P.y, 120)) if (e.active && !e.isSupplySlot) this.deal(e, .5); }
    return n * .7;
  }
  /** 本命武器命中（仁德 / 三英）。 */
  onWeaponHit(e: Enemy, dmg: number): void {
    const b = this.branch; if (!b) return; const now = this.h.now(), k = this.k();
    if (b.id === 'lb_rende' && now >= this.healAt) {
      this.healAt = now + 300; const P = this.h.player;
      const hurt = this.h.allies().filter(a => a.active && a.hp < a.maxHp && Math.hypot(a.x - P.x, a.y - P.y) <= 220).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      if (hurt) { hurt.hp = Math.min(hurt.maxHp, hurt.hp + hurt.maxHp * (.03 + .01 * (this.tier() - 1))); this.stats.procs++; if (now >= this.healFxAt) { this.healFxAt = now + 900; this.fx('fx_heal_fushui', hurt.x, hurt.y - 10, 70, 600, 0xbff0c0); } }
    } else if (b.id === 'lb_sanying' && now >= this.thirdAt && Math.random() < Math.min(.8, .35 * k)) {
      this.thirdAt = now + 120;
      const other = this.h.query(e.x, e.y, 120).find(o => o !== e && o.active && !o.isSupplySlot); if (!other) return;
      const fol = this.h.followerHeroes(), brothers = this.final() && (fol.includes('guanyu') || fol.includes('zhangfei')) ? 1.3 : 1;
      this.h.damage(other, dmg * .5 * brothers); this.stats.procs++; this.stats.hits++;
      this.fx('fx_strike_glint', other.x, other.y - 12, 80, 300, 0xe8e0ff, Math.random() * Math.PI);
    }
  }
  /** 击杀（仁德：几率召义勇）。 */
  onKill(e: Enemy): void {
    const b = this.branch; if (!b || b.id !== 'lb_rende') return;
    if (Math.random() < Math.min(.3, .08 * this.k())) { this.h.escort(e.x, e.y, this.final() ? 2 : 1, 10000); this.stats.procs++; }
  }

  private deal(e: Enemy, mul: number, fire = false): void { this.h.damage(e, this.h.hit() * mul * this.k(), fire); this.stats.hits++; }
  private dash(): void {
    const P = this.h.player, t = this.nearest(260); if (!t) return; const now = this.h.now();
    const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, L = Math.min(150, d + 40), px = P.x, py = P.y;
    P.knockUp(now, 140, ux * L, uy * L, true); P.invulnUntil = Math.max(P.invulnUntil, now + 250);
    for (const e of this.h.query(px + ux * L / 2, py + uy * L / 2, L / 2 + 40)) if (e.active && !e.isSupplySlot && segDist(e.x, e.y, px, py, px + ux * L, py + uy * L) <= 26 + e.radius) this.deal(e, .9);
    const s = this.h.scene; if (s.textures.exists('spear_thrust')) { const img = s.add.image(px + ux * L / 2, py - 6 + uy * L / 2, 'spear_thrust', 'tight').setRotation(Math.atan2(uy, ux)).setDisplaySize(L + 50, 30).setTint(0xdcecff).setAlpha(.9).setDepth(DEPTH.fx); s.tweens.add({ targets: img, alpha: 0, scaleY: img.scaleY * 1.7, duration: 300, onComplete: () => img.destroy() }); }
    this.h.sfx('atk_charge'); this.stats.procs++;
  }
  private storm(): void {
    const P = this.h.player, s = this.h.scene; this.sweep(170, 1.2, 0xcfe6ff);
    if (s.textures.exists('spear_thrust')) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, img = s.add.image(P.x + Math.cos(a) * 85, P.y - 6 + Math.sin(a) * 85, 'spear_thrust', 'tight').setRotation(a).setDisplaySize(170, 26).setTint(0xdcecff).setAlpha(.9).setDepth(DEPTH.fx); s.tweens.add({ targets: img, alpha: 0, duration: 360, delay: i * 25, onComplete: () => img.destroy() }); }
    if (this.final()) this.h.slow(P.x, P.y, 260, .5, 2000);
  }
  private sweep(r: number, mul: number, tint: number): void {
    const P = this.h.player; for (const e of this.h.query(P.x, P.y, r)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - P.x, e.y - P.y) <= r + e.radius) this.deal(e, mul);
    this.fx('fx_dianwei_whirl', P.x, P.y, r * 2.2, 420, tint); this.stats.procs++;
  }
  private crescent(): void {
    const P = this.h.player, t = this.nearest(420); if (!t) return;
    const ang = Math.atan2(t.y - P.y, t.x - P.x), range = this.tier() >= 3 ? 440 : 360, sx = P.x, sy = P.y, hit = new Set<Enemy>(), fin = this.final(); let lastSlow = 0;
    playSheet(this.h.scene, 'fx_drag_wave', sx, sy, { size: 150, ms: 450, depth: DEPTH.fx, tint: 0x7fe0c0, rotation: ang, add: true, onUpdate: (img, t2) => {
      const x = sx + Math.cos(ang) * range * t2, y = sy + Math.sin(ang) * range * t2; img.setPosition(x, y);
      for (const e of this.h.query(x, y, 70)) if (e.active && !e.isSupplySlot && !hit.has(e) && Math.hypot(e.x - x, e.y - y) <= 60 + e.radius) { hit.add(e); this.deal(e, .8); }
      if (fin && t2 - lastSlow > .2) { lastSlow = t2; this.h.slow(x, y, 80, .5, 1500); }
    } });
    this.stats.procs++;
  }
  clear(): void { this.segs = []; this.barrier = undefined; this.dashQueue = []; this.stunned.clear(); }
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
