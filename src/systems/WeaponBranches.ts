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
 * 第一批：赵云 / 关羽 / 张飞 / 刘备；第二批：诸葛亮 / 黄忠 / 马超 / 魏延；第三批：庞统 / 黄月英 / 孙尚香 / 貂蝉（各两个分支）。
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
  /** 火场（天火燎原 / 火矢 / 铁骑蹄火）、八阵陷阱、营栅区。 */
  private fields: Array<{ x: number; y: number; r: number; until: number; nextTick: number; mul: number; spread: boolean }> = [];
  private traps: Array<{ x: number; y: number; until: number; armed: number }> = [];
  private camps: Array<{ x: number; y: number; r: number; until: number; nextTick: number; props: Phaser.GameObjects.Image[] }> = [];
  private shots = 0; private slamAt = 0; private fieldAt = 0; private campAt = 0; private burstAt = 0;
  /** 第三批：连环计锁链、木牛、飞刀、魅惑、舞圈。 */
  private chained = new Map<Enemy, number>(); private chainUntil = 0; private oxen: Array<{ x: number; y: number; until: number; nextShot: number; img?: Phaser.GameObjects.Image }> = []; private oxAt = 0;
  private volleyAt = 0; private knives: Array<{ x: number; y: number }> = []; private still = 0; private charmed: Array<{ e: Enemy; life: number; until: number; nextTick: number }> = [];
  private rings: Array<{ x: number; y: number; until: number; nextTick: number }> = [];
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
    else if (b.id !== 'gy_danqi' && b.id !== 'ss_benxi') { this.moveX = P.x; this.moveY = P.y; }
    for (const s of this.segs) if (now < s.until && now >= s.nextTick) { s.nextTick = now + 500; for (const e of this.h.query(s.x, s.y, 46)) if (e.active && Math.hypot(e.x - s.x, e.y - s.y) <= 46 + e.radius) this.deal(e, .5); } // 2026-11-19 平衡：刀痕 .35 → .5（分支伤害只占关羽 5～6%）
    this.segs = this.segs.filter(s => now < s.until);
    this.tickZones(now); this.tick3(b, now);
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
    if (this.onFire2(b, now) || this.onFire3(b, now)) return;
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
    const b = this.branch; if (b?.id === 'wy_hanzhong' && this.inCamp()) return n * .8;
    if (!b || b.id !== 'zf_nuhou' || this.h.now() >= this.guardUntil) return n;
    if (this.final()) { const P = this.h.player; for (const e of this.h.query(P.x, P.y, 120)) if (e.active && !e.isSupplySlot) this.deal(e, .5); }
    return n * .7;
  }
  /** 本命武器命中（仁德 / 三英）。 */
  onWeaponHit(e: Enemy, dmg: number): void {
    const b = this.branch; if (!b) return; const now = this.h.now(), k = this.k();
    if (b.id === 'pt_lianhuan' && now < this.chainUntil && this.chained.get(e) === e.spawnId) { for (const [o, life] of this.chained) if (o !== e && o.active && o.spawnId === life) this.h.damage(o, dmg * (this.tier() >= 3 ? .4 : .3)); this.stats.hits++; return; }
    if (b.id === 'dc_biyue' && Math.random() < Math.min(.45, .15 * k) && e.kind !== 'boss' && (e.kind !== 'elite' || this.final()) && !this.charmed.some(c => c.e === e)) { this.charmed.push({ e, life: e.spawnId, until: now + 2000 * (this.tier() >= 3 ? 1.5 : 1), nextTick: now }); e.stunUntil = Math.max(e.stunUntil, now + 2000); this.fx('fx_heal_fushui', e.x, e.y - 20, 70, 600, 0xffa0d0); this.stats.procs++; return; }
    if (b.id === 'hz_huoshi' && now >= this.fieldAt) { this.fieldAt = now + 400; this.field(e.x, e.y, 65, 2000 * (1 + .25 * (this.tier() - 1)), this.final() ? .34 : .26, false); return; } // 2026-11-19 平衡：半径 55 → 65、灼烧 .2 / .26 → .26 / .34
    if (b.id === 'mc_weishui' && now >= this.slamAt) { this.slamAt = now + 500; const r = 90 * (1 + .15 * (this.tier() - 1));
      for (const o of this.h.query(e.x, e.y, r)) if (o.active && !o.isSupplySlot && Math.hypot(o.x - e.x, o.y - e.y) <= r + o.radius) this.deal(o, .5);
      this.fx('fx_collapse_dust', e.x, e.y, r * 2.2, 500, 0xc8a878); this.stats.procs++;
      if (this.final()) { const g = this.h.player.growth; g.berserkUntil = Math.max(g.berserkUntil, now) + 3000; } return; }
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
  /** 第二批：出手触发的分支（返回 true = 已处理）。 */
  private onFire2(b: WeaponBranch, now: number): boolean {
    const P = this.h.player, k = this.k(), t = this.nearest(460);
    if (b.id === 'zg_liaoyuan') { if (!t) return true; const tx = t.x, ty = t.y; this.h.scene.time.delayedCall(850, () => this.field(tx, ty, 80 * (this.tier() >= 2 ? 1.2 : 1), 3000 * (this.tier() >= 3 ? 1.4 : 1), .25, true)); return true; }
    if (b.id === 'zg_bazhen') { if (!t) return true; const max = this.final() ? 8 : 2 + this.tier(); if (this.traps.length >= max) this.traps.shift(); this.traps.push({ x: t.x, y: t.y, until: now + 6000, armed: 0 }); this.fx('fx_awaken_stratagem', t.x, t.y, 110, 500, 0x9fc8ff); this.stats.procs++; return true; }
    if (b.id === 'hz_chuanyang') {
      const far = this.farthest(520); if (!far) return true; this.shots++;
      const ang = Math.atan2(far.y - P.y, far.x - P.x), L = 520, ex = P.x + Math.cos(ang) * L, ey = P.y + Math.sin(ang) * L, crit = this.tier() >= 3 ? 1.5 : 1, fifth = this.final() && this.shots % 5 === 0;
      for (const e of this.h.query((P.x + ex) / 2, (P.y + ey) / 2, L / 2 + 30)) { if (!e.active || e.isSupplySlot || segDist(e.x, e.y, P.x, P.y, ex, ey) > 18 + e.radius) continue;
        const d = Math.hypot(e.x - P.x, e.y - P.y); this.deal(e, .32 * (1 + d / 400) * crit /* 2026-11-19 平衡：.6 → .32（10-3 分支伤害占 56%、总 DPS 是火矢 1.65 倍） */ * (fifth && (e.kind === 'boss' || e.kind === 'elite') ? 3 : 1)); }
      this.fx('fx_flank_streak', (P.x + ex) / 2, (P.y + ey) / 2, L, 320, 0xf0f8ff, ang); this.stats.procs++; return true; }
    if (b.id === 'mc_tieqi') {
      if (!t) return true; const ang = Math.atan2(t.y - P.y, t.x - P.x), L = 300, ex = P.x + Math.cos(ang) * L, ey = P.y + Math.sin(ang) * L;
      for (const e of this.h.query((P.x + ex) / 2, (P.y + ey) / 2, L / 2 + 50)) if (e.active && !e.isSupplySlot && segDist(e.x, e.y, P.x, P.y, ex, ey) <= 40 + e.radius) this.deal(e, .7);
      this.fx('fx_flank_streak', (P.x + ex) / 2, (P.y + ey) / 2, L + 60, 380, 0xbfe0ff, ang);
      if (this.final()) for (let i = 1; i <= 3; i++) this.field(P.x + Math.cos(ang) * L * i / 4, P.y + Math.sin(ang) * L * i / 4, 50, 1800, .2, false);
      this.stats.procs++; return true; }
    if (b.id === 'wy_ziwu') {
      if (!t) return true; const ang = Math.atan2(t.y - P.y, t.x - P.x), L = Math.min(260, Math.hypot(t.x - P.x, t.y - P.y) + 30), x = P.x + Math.cos(ang) * L, y = P.y + Math.sin(ang) * L, twice = this.final() && P.hp < P.maxHp / 2;
      const blast = () => { for (const e of this.h.query(x, y, 100)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - x, e.y - y) <= 90 + e.radius) this.deal(e, .9); this.fx('fx_explosion', x, y, 200, 500, 0xff9a7a); };
      this.h.scene.time.delayedCall(500, blast); if (twice) this.h.scene.time.delayedCall(800, blast); this.stats.procs++; return true; }
    if (b.id === 'wy_hanzhong') {
      if (now < this.campAt) return true; this.campAt = now + 5000; const max = this.final() ? 2 : 1; if (this.camps.length >= max) { const old = this.camps.shift(); old?.props.forEach(p => p.destroy()); }
      const r = 110 * (1 + .15 * (this.tier() - 1)), s = this.h.scene, props: Phaser.GameObjects.Image[] = [];
      if (s.textures.exists('yellow_props')) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r * .7; props.push(s.add.image(x, y, 'yellow_props', 12).setOrigin(.5, .9).setDisplaySize(64, 64).setDepth(y / 10 + 20).setAlpha(.95)); }
      this.camps.push({ x: P.x, y: P.y, r, until: now + 5000 * (1 + .2 * (this.tier() - 1)), nextTick: now, props }); this.stats.procs++; return true; }
    return false;
  }
  /** 第三批：出手触发。 */
  private onFire3(b: WeaponBranch, now: number): boolean {
    const P = this.h.player, t = this.nearest(420);
    if (b.id === 'pt_lianying') { if (!t) return true; const n = this.final() ? 5 : 3; for (let i = 1; i <= n; i++) this.field(P.x + (t.x - P.x) * i / 3, P.y + (t.y - P.y) * i / 3, 55, 2200 * (this.tier() >= 3 ? 1.3 : 1), .22 * (this.tier() >= 2 ? 1.25 : 1), false); return true; }
    if (b.id === 'pt_lianhuan') { if (!t) return true; this.chained.clear(); const n = 4 + 2 * (this.tier() - 1);
      for (const e of this.h.query(t.x, t.y, 200).filter(o => o.active && !o.isSupplySlot && o.kind !== 'boss').slice(0, n)) { this.chained.set(e, e.spawnId); this.fx('fx_strike_glint', e.x, e.y - 10, 60, 400, 0xc8d0e0); }
      this.chainUntil = now + 6000; this.stats.procs++; return true; }
    if (b.id === 'hy_liannu') { const n = 2 + (this.tier() - 1), pool = this.h.query(P.x, P.y, 380).filter(e => e.active && !e.isSupplySlot);
      for (let i = 0; i < n && pool.length; i++) { const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; this.deal(e, .5); this.fx('fx_strike_glint', e.x, e.y - 10, 60, 300, 0xf0e8c8);
        if (this.final() && Math.random() < .2) { const o = this.h.query(e.x, e.y, 120).find(x => x !== e && x.active && !x.isSupplySlot); if (o) this.deal(o, .35); } }
      this.stats.procs++; return true; }
    if (b.id === 'dc_meirenji') { if (!t) return true; this.rings.push({ x: t.x, y: t.y, until: now + 4000, nextTick: now }); if (this.rings.length > 4) this.rings.shift(); this.fx('fx_heal_fushui', t.x, t.y, 200 * (this.tier() >= 2 ? 1.2 : 1), 4000, 0xffb0d8); this.stats.procs++; return true; }
    return false;
  }
  /** 第三批：每帧（木牛、万刃齐射、奔袭飞刀、魅惑、舞圈、连环减速）。 */
  private tick3(b: WeaponBranch, now: number): void {
    const P = this.h.player, k = this.k();
    if (b.id === 'hy_muniu') {
      const max = this.final() ? 2 : 1;
      if (now >= this.oxAt && this.oxen.length < max) { this.oxAt = now + 10000; const s = this.h.scene, x = P.x + 40, y = P.y + 20;
        const img = s.textures.exists('yellow_props') ? s.add.image(x, y, 'yellow_props', 24).setOrigin(.5, .9).setDisplaySize(70, 70).setDepth(y / 10 + 20).setTint(0xe8c890) : undefined;
        this.oxen.push({ x, y, until: now + 8000 * (this.tier() >= 3 ? 1.3 : 1), nextShot: now, img }); this.stats.procs++; }
      for (const o of this.oxen) if (now < o.until && now >= o.nextShot) { o.nextShot = now + 600 / k; let best: Enemy | null = null, d0 = 300; for (const e of this.h.query(o.x, o.y, 300)) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - o.x, e.y - o.y); if (d < d0) { d0 = d; best = e; } }
        if (best) { this.deal(best, .4); this.fx('fx_flank_streak', (o.x + best.x) / 2, (o.y + best.y) / 2, d0 + 30, 200, 0xf0e0b0, Math.atan2(best.y - o.y, best.x - o.x)); } }
      for (const o of this.oxen.filter(x => now >= x.until)) { o.img?.destroy(); if (this.final()) { for (const e of this.h.query(o.x, o.y, 110)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - o.x, e.y - o.y) <= 100 + e.radius) this.deal(e, .8); this.fx('fx_explosion', o.x, o.y, 180, 450, 0xffc080); } }
      this.oxen = this.oxen.filter(x => now < x.until);
    }
    if (b.id === 'ss_wanren' && now >= this.volleyAt && this.nearest(260)) { this.volleyAt = now + 3000 / k; const volley = () => { const near = this.h.query(P.x, P.y, 260).filter(e => e.active && !e.isSupplySlot).slice(0, 8); for (const e of near) { this.deal(e, .5); this.fx('fx_strike_glint', e.x, e.y - 10, 56, 260, 0xffd0d0); } this.fx('fx_dianwei_whirl', P.x, P.y, 300, 380, 0xffc0c0); };
      volley(); if (this.final()) this.h.scene.time.delayedCall(400, volley); this.stats.procs++; }
    if (b.id === 'ss_benxi') {
      const d = Math.hypot(P.x - this.moveX, P.y - this.moveY);
      if (d >= 90) { this.knives.push({ x: this.moveX, y: this.moveY }); if (this.knives.length > 8 + 2 * this.tier()) this.knives.shift(); this.fx('fx_strike_glint', this.moveX, this.moveY, 50, 400, 0xe0e8ff); this.moveX = P.x; this.moveY = P.y; this.still = now;
        for (const e of this.h.query(this.moveX, this.moveY, 60)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - this.moveX, e.y - this.moveY) <= 50 + e.radius) this.deal(e, .4); } // 2026-11-19 平衡：撒刀 .25 → .4（10-3 DPS 只有万刃的 0.72）
      else if (this.knives.length && now - this.still > 500) { for (const kn of this.knives) for (const e of this.h.query(kn.x, kn.y, 60)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - kn.x, e.y - kn.y) <= 50 + e.radius) this.deal(e, this.final() ? .6 : .45); this.knives = []; this.stats.procs++; } // 2026-11-19 平衡：收刀 .3 / .4 → .45 / .6
    }
    for (const c of this.charmed) if (now < c.until && now >= c.nextTick && c.e.active && c.e.spawnId === c.life) { c.nextTick = now + 500; for (const o of this.h.query(c.e.x, c.e.y, 90)) if (o !== c.e && o.active && !o.isSupplySlot && o.kind !== 'boss' && Math.hypot(o.x - c.e.x, o.y - c.e.y) <= 80 + o.radius) this.deal(o, .3); }
    this.charmed = this.charmed.filter(c => now < c.until && c.e.active && c.e.spawnId === c.life);
    for (const r of this.rings) if (now < r.until && now >= r.nextTick) { r.nextTick = now + 500; const rr = 90 * (this.tier() >= 2 ? 1.2 : 1);
      for (const e of this.h.query(r.x, r.y, rr + 20)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - r.x, e.y - r.y) <= rr + e.radius) this.deal(e, .25 * (this.tier() >= 3 ? 1.3 : 1)); this.h.slow(r.x, r.y, rr, .2, 700);
      if (this.final()) for (const o of this.rings) if (o !== r && now < o.until && Math.hypot(o.x - r.x, o.y - r.y) < rr * 1.6) { const mx = (o.x + r.x) / 2, my = (o.y + r.y) / 2; for (const e of this.h.query(mx, my, 70)) if (e.active && !e.isSupplySlot) this.deal(e, .4); this.fx('fx_heal_fushui', mx, my, 120, 400, 0xff90c0); } }
    this.rings = this.rings.filter(r => now < r.until);
    if (b.id === 'pt_lianhuan' && this.final() && now < this.chainUntil) for (const [e, life] of this.chained) if (e.active && e.spawnId === life && Math.random() < .1) this.h.slow(e.x, e.y, 20, .7, 600);
  }
  private farthest(r: number): Enemy | null { const P = this.h.player; let best: Enemy | null = null, d0 = 0; for (const e of this.h.query(P.x, P.y, r)) { if (!e.active || e.isSupplySlot) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d <= r && d > d0) { d0 = d; best = e; } } return best; }
  /** 火场：每 0.5 秒灼烧圈内敌兵；天火燎原的火场会向 160 内相邻火场蔓延（中点再起一片），进阶后三片以上爆燃。 */
  private field(x: number, y: number, r: number, ms: number, mul: number, spread: boolean): void {
    const now = this.h.now(); this.fields.push({ x, y, r, until: now + ms, nextTick: now, mul, spread }); if (this.fields.length > 10) this.fields.shift();
    this.fx('fx_ground_fire', x, y, r * 2.3, ms, 0xffb070); this.stats.procs++;
    if (spread) { const n = this.fields.find(f => f !== this.fields[this.fields.length - 1] && f.spread && Math.hypot(f.x - x, f.y - y) < 160 && Math.hypot(f.x - x, f.y - y) > 40);
      if (n && this.fields.length < 10) { const mx = (n.x + x) / 2, my = (n.y + y) / 2; this.fields.push({ x: mx, y: my, r: r * .8, until: now + ms * .7, nextTick: now, mul, spread: false }); this.fx('fx_ground_fire', mx, my, r * 1.8, ms * .7, 0xffb070); } }
  }
  private tickZones(now: number): void {
    for (const f of this.fields) if (now < f.until && now >= f.nextTick) { f.nextTick = now + 500; for (const e of this.h.query(f.x, f.y, f.r + 20)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - f.x, e.y - f.y) <= f.r + e.radius) this.deal(e, f.mul, true); }
    this.fields = this.fields.filter(f => now < f.until);
    if (this.branch?.id === 'zg_liaoyuan' && this.final() && now >= this.burstAt) { const sp = this.fields.filter(f => f.spread); if (sp.length >= 3) { this.burstAt = now + 4000; const cx = sp.reduce((a, f) => a + f.x, 0) / sp.length, cy = sp.reduce((a, f) => a + f.y, 0) / sp.length; for (const e of this.h.query(cx, cy, 160)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - cx, e.y - cy) <= 140 + e.radius) this.deal(e, 1.5, true); this.fx('fx_explosion', cx, cy, 300, 600, 0xffa060); } }
    for (const tp of this.traps) { if (now >= tp.until) continue;
      if (!tp.armed) { const hit = this.h.query(tp.x, tp.y, 70).filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - tp.x, e.y - tp.y) <= 60 + e.radius); if (hit.length) { tp.armed = now + 1000; for (const e of hit) e.stunUntil = Math.max(e.stunUntil, now + 1000 * (this.tier() >= 3 ? 1.5 : 1)); } }
      else if (now >= tp.armed) { tp.until = 0; for (const e of this.h.query(tp.x, tp.y, 100)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - tp.x, e.y - tp.y) <= 90 + e.radius) this.deal(e, .8); this.fx('fx_explosion', tp.x, tp.y, 180, 450, 0x9fc8ff); } }
    this.traps = this.traps.filter(tp => now < tp.until);
    for (const c of this.camps) if (now < c.until && now >= c.nextTick) { c.nextTick = now + 500; this.h.slow(c.x, c.y, c.r, .4, 700); }
    const gone = this.camps.filter(c => now >= c.until); for (const c of gone) c.props.forEach(p => p.destroy()); this.camps = this.camps.filter(c => now < c.until);
  }
  /** 镇守汉中：主将在营栅区内减伤 20%。 */
  inCamp(): boolean { const P = this.h.player, now = this.h.now(); return this.camps.some(c => now < c.until && Math.hypot(P.x - c.x, P.y - c.y) <= c.r); }
  clear(): void { this.segs = []; this.barrier = undefined; this.dashQueue = []; this.stunned.clear(); this.fields = []; this.traps = []; for (const c of this.camps) c.props.forEach(p => p.destroy()); this.camps = []; for (const o of this.oxen) o.img?.destroy(); this.oxen = []; this.chained.clear(); this.charmed = []; this.rings = []; this.knives = []; }
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
