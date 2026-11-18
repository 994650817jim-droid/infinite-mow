import Phaser from 'phaser';
import { actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { SpecialId } from '../data/items';

/**
 * 首领遗珍的战斗机制（2026-11-16，boss-drops-proposal.md 首批 10 件，用户批准）。
 * GameScene 在命中 / 击杀 / 拾取 / 每帧等处调用；穿戴哪些由兵装加成里的 specials 决定（换装后 setSpecials 刷新）。
 * 数值都是初值，集中在 RELIC，交「平衡与数值」会话实测。
 * 部分机制在别处接入：伪帝玺的受伤 +15% 在 RunGrowth.incomingDamageMultiplier；豪饮的伤害 +40% 在 RunGrowth.damageMultiplier；
 * 虎豹骑在 HeroMount 选项；楼船火攻复用赤壁 FireShips（间隔 12 秒）。
 */
export const RELIC = {
  fushuiGems: 40, fushuiMax: 3, fushuiLife: 20000, fushuiHitMs: 800, fushuiDamage: 10, fushuiRange: 90,
  jiujieMs: 15000, jiujieRange: 360, jiujieTargets: 3, jiujieDamage: 40, jiujieKillStep: 50, jiujieStepBonus: .1, jiujieMaxBonus: 1,
  zhanjiangMul: 2,
  xiangguoKills: 120,
  jiyingEvery: 8, jiyingLength: 420, jiyingWidth: 36, jiyingMul: 1.5,
  bainiaoHits: 5, bainiaoCooldown: 4000, bainiaoRange: 170, bainiaoArc: 1.4, bainiaoCount: 6, bainiaoMul: .6,
  weixiTreasures: 2, weixiTaken: 1.15,
  jiuhuMs: 8000, jiuhuDamage: 1.4, jiuhuJitter: Math.PI / 12, jiuhuJitterMs: 400,
  hubaoTrample: 2, hubaoRemountMs: 6000,
  louchuanMs: 12000, louchuanFirst: 6000,
} as const;

export interface RelicHost {
  scene: Phaser.Scene;
  player: Player;
  enemies: () => readonly Enemy[];
  /** 遗珍造成的伤害（不算本命命中，不会再触发遗珍）。 */
  hit: (e: Enemy, damage: number, now: number) => void;
  notice: (text: string) => void;
}
/** 黄巾力士：用黄巾步兵 v2 行走图（四向 × 4 帧）走动、朝向、出手前扑，淡入淡出（2026-11-17 用户：「力士出来后没动画」）。 */
interface LiShi { img: Phaser.GameObjects.Image; until: number; nextHit: number; angle: number; born: number; bx: number; by: number; dir: 'down' | 'left' | 'right' | 'up'; walk: number; lunge?: { x: number; y: number; at: number } }
const LISHI_SHEETS = ['enemy_infantry_walk_sheet', 'shu_swordsman_walk_sheet'];
const LISHI_FADE = 300, LISHI_LUNGE_MS = 220;

export class BossRelics {
  private specials = new Set<SpecialId>();
  private gems = 0; private kills = 0; private hits = 0;
  private nextBolt = 0; private xiangguoReady = false; private xiangguoCount = 0;
  private lastTarget: Enemy | null = null; private streak = 0; private bainiaoAt = 0;
  private readonly struck = new WeakSet<Enemy>();
  private readonly lishi: LiShi[] = [];
  private readonly fx: Phaser.GameObjects.Graphics;
  private jitter = 0; private jitterAt = 0;
  /** 统计（测试用）。 */
  readonly metrics = { bolts: 0, lishi: 0, jiying: 0, bainiao: 0, firstStrikes: 0, xiangguo: 0 };

  constructor(private readonly h: RelicHost, specials: readonly SpecialId[], now: number) {
    this.fx = h.scene.add.graphics().setDepth(actorDepth(1e6));
    this.setSpecials(specials, now);
  }
  setSpecials(specials: readonly SpecialId[], now: number): void {
    const had = this.specials.has('jiujie');
    this.specials = new Set(specials);
    if (this.has('jiujie') && !had) this.nextBolt = now + RELIC.jiujieMs;
  }
  has(id: SpecialId): boolean { return this.specials.has(id); }
  get active(): boolean { return this.specials.size > 0; }

  /** 斩将：对精锐 / 首领的第一击。返回 true 时必定暴击并额外 ×RELIC.zhanjiangMul。 */
  firstStrike(e: Enemy): boolean {
    if (!this.has('zhanjiang') || (e.kind !== 'elite' && e.kind !== 'boss') || this.struck.has(e)) return false;
    this.struck.add(e); this.metrics.firstStrikes++; return true;
  }
  /** 本命命中之后：辕门戟影（每第 8 次）、百鸟朝凤（连击同一目标）。 */
  onWeaponHit(e: Enemy, raw: number, now: number): void {
    const p = this.h.player, a = Math.atan2(e.y - p.y, e.x - p.x);
    if (this.has('jiying') && ++this.hits % RELIC.jiyingEvery === 0) this.line(p.x, p.y, a, raw * RELIC.jiyingMul, now);
    if (this.has('bainiao')) {
      if (e === this.lastTarget) this.streak++; else { this.lastTarget = e; this.streak = 1; }
      if (this.streak >= RELIC.bainiaoHits && now >= this.bainiaoAt) { this.streak = 0; this.bainiaoAt = now + RELIC.bainiaoCooldown; this.fan(p.x, p.y, a, raw * RELIC.bainiaoMul, now); }
    }
  }
  onKill(): void {
    this.kills++;
    if (this.has('xiangguo') && ++this.xiangguoCount >= RELIC.xiangguoKills) { this.xiangguoCount = 0; this.xiangguoReady = true; }
  }
  /** 相国印：取走一次「连选两张 + 免费换一批」。 */
  takeXiangguo(): boolean { if (!this.xiangguoReady || !this.has('xiangguo')) return false; this.xiangguoReady = false; this.metrics.xiangguo++; return true; }
  onGem(now: number): void {
    if (!this.has('fushui') || ++this.gems < RELIC.fushuiGems) return;
    this.gems = 0;
    if (this.lishi.filter(l => l.until > now).length >= RELIC.fushuiMax) return;
    const p = this.h.player, s = this.h.scene, key = LISHI_SHEETS.find(k => s.textures.exists(k) && s.textures.get(k).has('down_0')) ?? '__WHITE';
    const angle = Math.random() * Math.PI * 2;
    // 金色淡染：和真正的黄巾敌兵区分（召出来的「力士」），出场淡入
    const img = s.add.image(p.x + Math.cos(angle) * 46, p.y + Math.sin(angle) * 30, key, key === '__WHITE' ? undefined : 'down_0').setTint(0xffe7a0).setAlpha(0).setName('relic-lishi');
    if (key === '__WHITE') img.setDisplaySize(18, 26);
    else img.setScale(Math.min(1, 64 / Math.max(1, img.height)));
    this.lishi.push({ img, until: now + RELIC.fushuiLife, nextHit: now + 300, angle, born: now, bx: img.x, by: img.y, dir: 'down', walk: 0 });
    this.metrics.lishi++; this.h.notice('人公符水 · 黄巾力士助战');
  }
  /** 拾取酒罐 / 酒葫芦：豪饮。 */
  onWine(now: number): void { if (this.has('jiuhu')) { this.h.player.growth.wineUntil = now + RELIC.jiuhuMs; this.h.notice('乌巢豪饮 · 伤害 +40%'); } }
  /** 豪饮中走路踉跄：把移动方向随机偏转（就地改向量）。 */
  sway(move: Phaser.Math.Vector2, now: number): void {
    if (!this.has('jiuhu') || now >= this.h.player.growth.wineUntil || move.lengthSq() < .001) return;
    if (now >= this.jitterAt) { this.jitterAt = now + RELIC.jiuhuJitterMs; this.jitter = (Math.random() * 2 - 1) * RELIC.jiuhuJitter; }
    move.rotate(this.jitter);
  }

  update(now: number): void {
    const p = this.h.player, live = this.h.enemies().filter(e => e.active && !e.isSupplySlot);
    if (this.has('jiujie') && now >= this.nextBolt) {
      this.nextBolt = now + RELIC.jiujieMs;
      const bonus = Math.min(RELIC.jiujieMaxBonus, Math.floor(this.kills / RELIC.jiujieKillStep) * RELIC.jiujieStepBonus);
      const dmg = RELIC.jiujieDamage * (1 + bonus) * p.growth.damageMultiplier(now);
      const targets = live.filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= RELIC.jiujieRange).sort((a, b) => b.hp - a.hp).slice(0, RELIC.jiujieTargets);
      for (const e of targets) { this.bolt(e.x, e.y); this.h.hit(e, dmg, now); }
      if (targets.length) this.metrics.bolts++;
    }
    for (let i = this.lishi.length - 1; i >= 0; i--) {
      const l = this.lishi[i];
      if (now >= l.until + LISHI_FADE || !p.alive) { l.img.destroy(); this.lishi.splice(i, 1); continue; }
      // 淡入 / 到时淡出
      l.img.setAlpha(Math.min(1, (now - l.born) / LISHI_FADE, now < l.until ? 1 : 1 - (now - l.until) / LISHI_FADE));
      l.angle += .015; const tx = p.x + Math.cos(l.angle) * 46, ty = p.y + Math.sin(l.angle) * 30;
      const nx = l.bx + (tx - l.bx) * .15, ny = l.by + (ty - l.by) * .15, dx = nx - l.bx, dy = ny - l.by, step = Math.hypot(dx, dy);
      l.bx = nx; l.by = ny;
      // 出手前扑：朝目标冲出 14 像素再收回（前半程出、后半程回）
      let ox = 0, oy = 0, lunging = false;
      if (l.lunge) { const t = (now - l.lunge.at) / LISHI_LUNGE_MS; if (t >= 1) l.lunge = undefined; else { const k = Math.sin(t * Math.PI) * 14; ox = l.lunge.x * k; oy = l.lunge.y * k; lunging = true; } }
      // 朝向：前扑时朝目标，平时朝走的方向
      const fx = lunging ? l.lunge!.x : dx, fy = lunging ? l.lunge!.y : dy;
      if (Math.hypot(fx, fy) > .05) l.dir = Math.abs(fx) > Math.abs(fy) ? (fx < 0 ? 'left' : 'right') : (fy < 0 ? 'up' : 'down');
      l.walk += step / 9;
      if (l.img.texture.key !== '__WHITE') l.img.setFrame(`${l.dir}_${lunging ? 1 : step > .3 ? Math.floor(l.walk) % 4 : 0}`);
      l.img.setPosition(l.bx + ox, l.by + oy).setDepth(actorDepth(l.by));
      if (now >= l.nextHit && now < l.until) {
        const e = live.find(x => Math.hypot(x.x - l.bx, x.y - l.by) <= RELIC.fushuiRange);
        if (e) {
          l.nextHit = now + RELIC.fushuiHitMs; const d = Math.max(1, Math.hypot(e.x - l.bx, e.y - l.by));
          l.lunge = { x: (e.x - l.bx) / d, y: (e.y - l.by) / d, at: now };
          this.h.hit(e, RELIC.fushuiDamage * p.growth.allyDamageMultiplier(), now);
        }
      }
    }
  }

  private flash(draw: (g: Phaser.GameObjects.Graphics) => void, ms = 220): void {
    const g = this.h.scene.add.graphics().setDepth(actorDepth(1e6)); draw(g);
    this.h.scene.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }
  private bolt(x: number, y: number): void {
    this.flash(g => { g.lineStyle(4, 0xfff2a8, 1); g.beginPath(); g.moveTo(x, y - 240); let cy = y - 240; while (cy < y) { cy += 30; g.lineTo(x + (Math.random() - .5) * 26, Math.min(y, cy)); } g.strokePath(); g.fillStyle(0xfff2a8, .5).fillCircle(x, y, 22); });
  }
  private line(x: number, y: number, a: number, dmg: number, now: number): void {
    const L = RELIC.jiyingLength, half = RELIC.jiyingWidth / 2, c = Math.cos(a), s = Math.sin(a);
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot) continue;
      const dx = e.x - x, dy = e.y - y, t = dx * c + dy * s, d = Math.abs(-dx * s + dy * c);
      if (t >= 0 && t <= L && d <= half + 12) this.h.hit(e, dmg, now);
    }
    this.metrics.jiying++;
    this.flash(g => { g.lineStyle(half, 0xf0d9a0, .55).lineBetween(x, y, x + c * L, y + s * L); g.lineStyle(3, 0xffffff, .9).lineBetween(x, y, x + c * L, y + s * L); });
  }
  private fan(x: number, y: number, a: number, dmg: number, now: number): void {
    const R = RELIC.bainiaoRange, arc = RELIC.bainiaoArc;
    const inCone = this.h.enemies().filter(e => { if (!e.active || e.isSupplySlot) return false; const d = Math.hypot(e.x - x, e.y - y), da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - y, e.x - x) - a)); return d <= R && da <= arc / 2; })
      .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)).slice(0, RELIC.bainiaoCount);
    for (const e of inCone) this.h.hit(e, dmg, now);
    this.metrics.bainiao++;
    this.flash(g => { g.lineStyle(3, 0xffe6a8, .95); for (let i = 0; i < RELIC.bainiaoCount; i++) { const t = a - arc / 2 + arc * i / (RELIC.bainiaoCount - 1); g.lineBetween(x, y, x + Math.cos(t) * R, y + Math.sin(t) * R); } });
  }
  clear(): void { for (const l of this.lishi.splice(0)) l.img.destroy(); this.fx.destroy(); }
}
