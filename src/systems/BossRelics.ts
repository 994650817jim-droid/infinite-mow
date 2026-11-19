import Phaser from 'phaser';
import { actorDepth, DEPTH, RENDER_SCALE } from '../config';
import { V2_TROOP_SCALE, v2Filter } from './ArtStyle';
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
  hubaoTrample: 2, hubaoRemountMs: 60000, // 11-18 用户：落马后不可再上马；虎豹骑特例每战可重新上马一次，等 60 秒（待平衡会话复核）
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
/**
 * 黄巾力士（人公符水召出的我方符兵）。2026-11-18 用户：「召唤的黄巾需要区分出来和普通黄巾」——
 * 专用手绘图（金白赤膊、扛大铜锤，比普通黄巾高约 1.2 倍）：lishi_walk（4×4 每格 160，脚底 152）/ lishi_attack（4×4 每格 208，脚底 200，蓄力 → 下砸 → 砸地 → 收锤）；
 * 脚下手绘符阵光圈循环、头顶「力」字符牌；出场从符纸化出、消失时化回符纸飘散（lishi_fx 6×3 每格 256，黑底叠加：第 1 行光圈、第 2 行化出、第 3 行散去）。
 * 「敌我描边」开着时走我方颜色（GameScene.iffUnits，保持原画）。精灵、光圈、符牌、特效都用对象池复用（同屏最多 RELIC.fushuiMax 个）。
 * 专用图没加载到时退回旧做法（黄巾步兵行走图 + 金色淡染）。
 */
interface LiShiView { body: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Image; fx: Phaser.GameObjects.Image; used: boolean }
interface LiShi { v: LiShiView; until: number; nextHit: number; angle: number; born: number; bx: number; by: number; dir: 'down' | 'left' | 'right' | 'up'; walk: number; lunge?: { x: number; y: number; at: number } }
const LISHI_FALLBACK = ['enemy_infantry_walk_sheet', 'shu_swordsman_walk_sheet'];
const LISHI_DIRS = ['down', 'left', 'right', 'up'] as const;
/** 出场：符纸化出 6 帧（每帧 LISHI_FX_MS），第 3 帧光柱起来时人物开始显形；消失：化回符纸 6 帧，人物在头 2 帧内淡掉。 */
const LISHI_FX_MS = 75, LISHI_IN = LISHI_FX_MS * 6, LISHI_OUT = LISHI_FX_MS * 6, LISHI_LUNGE_MS = 320, LISHI_RING_MS = 140;
/** 专用图：行走 / 攻击格与脚底行（脚底 = 原点），显示倍率与我方 v2 兵种相同。 */
const LISHI_WALK = { key: 'lishi_walk', cell: 160, foot: 152 }, LISHI_ATK = { key: 'lishi_attack', cell: 208, foot: 200 };

export class BossRelics {
  private specials = new Set<SpecialId>();
  private gems = 0; private kills = 0; private hits = 0;
  private nextBolt = 0; private xiangguoReady = false; private xiangguoCount = 0;
  private lastTarget: Enemy | null = null; private streak = 0; private bainiaoAt = 0;
  private readonly struck = new WeakSet<Enemy>();
  private readonly lishi: LiShi[] = [];
  private readonly lishiPool: LiShiView[] = [];
  private readonly fx: Phaser.GameObjects.Graphics;
  private jitter = 0; private jitterAt = 0;
  /** 统计（测试用）。 */
  readonly metrics = { bolts: 0, lishi: 0, jiying: 0, bainiao: 0, firstStrikes: 0, xiangguo: 0, lishiViews: 0 };

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
    const p = this.h.player, angle = Math.random() * Math.PI * 2, x = p.x + Math.cos(angle) * 46, y = p.y + Math.sin(angle) * 30;
    const v = this.lishiView(); this.placeLishi(v, x, y, 'down', 0, false);
    v.body.setAlpha(0); v.ring.setAlpha(0); v.tag.setAlpha(0);
    if (this.h.scene.textures.exists('lishi_fx')) v.fx.setVisible(true).setFrame(6).setPosition(x, y); // 符纸化出第 1 帧立刻出现
    this.lishi.push({ v, until: now + RELIC.fushuiLife, nextHit: now + LISHI_IN, angle, born: now, bx: x, by: y, dir: 'down', walk: 0 });
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
      if (now >= l.until + LISHI_OUT || !p.alive) { this.releaseLishi(l.v); this.lishi.splice(i, 1); continue; }
      // 出场：符纸化出（光柱第 3 帧起人物显形）；到时：化回符纸飘散（人物头 2 帧淡掉）
      const tin = now - l.born, tout = now - l.until, special = l.v.body.texture.key === LISHI_WALK.key || l.v.body.texture.key === LISHI_ATK.key, hasFx = this.h.scene.textures.exists('lishi_fx');
      const alpha = tin < LISHI_IN ? Phaser.Math.Clamp((tin - LISHI_FX_MS * 2) / (LISHI_FX_MS * 2), 0, 1) : tout >= 0 ? Phaser.Math.Clamp(1 - tout / (LISHI_FX_MS * 2), 0, 1) : 1;
      l.v.body.setAlpha(alpha); l.v.tag.setAlpha(alpha); l.v.ring.setAlpha(alpha * .7);
      const fxFrame = tin < LISHI_IN ? 6 + Math.min(5, Math.floor(tin / LISHI_FX_MS)) : tout >= 0 ? 12 + Math.min(5, Math.floor(tout / LISHI_FX_MS)) : -1;
      if (fxFrame >= 0 && hasFx) l.v.fx.setVisible(true).setFrame(fxFrame); else l.v.fx.setVisible(false);
      if (hasFx) l.v.ring.setFrame(Math.floor(now / LISHI_RING_MS) % 6);
      if (tout >= 0) { l.v.fx.setPosition(l.bx, l.by); continue; } // 消散中原地不动
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
      const col = lunging ? Math.min(3, Math.floor((now - l.lunge!.at) / LISHI_LUNGE_MS * 4)) : step > .3 ? Math.floor(l.walk) % 4 : 0;
      if (special) this.placeLishi(l.v, l.bx + ox * .4, l.by + oy * .4, l.dir, col, lunging);
      else { const b = l.v.body; if (b.texture.key !== '__WHITE') b.setFrame(`${l.dir}_${lunging ? 1 : col}`); b.setPosition(l.bx + ox, l.by + oy).setDepth(actorDepth(l.by)); }
      l.v.fx.setPosition(l.bx, l.by);
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
  /** 当前在场的力士（敌我描边 / 测试用）：精灵与脚底。 */
  lishiUnits(): Array<{ sprite: Phaser.GameObjects.Image; foot: { x: number; y: number }; visible: boolean }> { return this.lishi.map(l => ({ sprite: l.v.body, foot: { x: l.bx, y: l.by }, visible: l.v.body.visible && l.v.body.alpha > .05 })); }
  /** 从对象池取一套力士显示对象（身体 / 光圈 / 符牌 / 化符特效）；没有就新建。 */
  private lishiView(): LiShiView {
    const free = this.lishiPool.find(v => !v.used);
    if (free) { free.used = true; free.body.setVisible(true); free.ring.setVisible(free.ring.texture.key === 'lishi_fx'); free.tag.setVisible(free.tag.texture.key === 'lishi_tag'); return free; }
    const s = this.h.scene, special = s.textures.exists(LISHI_WALK.key) && s.textures.exists(LISHI_ATK.key);
    if (special) for (const k of [LISHI_WALK.key, LISHI_ATK.key]) s.textures.get(k).setFilter(v2Filter(RENDER_SCALE));
    const key = special ? LISHI_WALK.key : LISHI_FALLBACK.find(k => s.textures.exists(k) && s.textures.get(k).has('down_0')) ?? '__WHITE';
    const body = s.add.image(0, 0, key, special ? 0 : key === '__WHITE' ? undefined : 'down_0').setName('relic-lishi');
    if (!special) { body.setTint(0xffe7a0); if (key === '__WHITE') body.setDisplaySize(18, 26); else body.setScale(Math.min(1, 64 / Math.max(1, body.height))); }
    const fxKey = s.textures.exists('lishi_fx') ? 'lishi_fx' : '__WHITE';
    const ring = s.add.image(0, 0, fxKey, fxKey === 'lishi_fx' ? 0 : undefined).setBlendMode(Phaser.BlendModes.ADD).setName('relic-lishi-ring').setVisible(fxKey === 'lishi_fx');
    if (fxKey === 'lishi_fx') ring.setScale(76 / 218); // 光圈宽约占格 85%：显示约 76 像素宽
    const fx = s.add.image(0, 0, fxKey, fxKey === 'lishi_fx' ? 6 : undefined).setBlendMode(Phaser.BlendModes.ADD).setOrigin(.5, .82).setScale(.42).setVisible(false).setName('relic-lishi-fx');
    const tag = s.add.image(0, 0, s.textures.exists('lishi_tag') ? 'lishi_tag' : '__WHITE').setName('relic-lishi-tag');
    if (tag.texture.key === 'lishi_tag') tag.setScale(17 / tag.height); else tag.setVisible(false);
    const v = { body, ring, tag, fx, used: true }; this.lishiPool.push(v); this.metrics.lishiViews++; return v;
  }
  private releaseLishi(v: LiShiView): void { v.used = false; for (const o of [v.body, v.ring, v.tag, v.fx]) o.setVisible(false); }
  /** 专用图摆姿势：行走 / 出手帧、脚底对位，光圈压在脚下，符牌在头顶。 */
  private placeLishi(v: LiShiView, x: number, y: number, dir: LiShi['dir'], col: number, attack: boolean): void {
    const b = v.body, d = LISHI_DIRS.indexOf(dir), sheet = attack ? LISHI_ATK : LISHI_WALK;
    if (b.texture.key === LISHI_WALK.key || b.texture.key === LISHI_ATK.key) b.setTexture(sheet.key, d * 4 + col).setOrigin(.5, sheet.foot / sheet.cell).setScale(V2_TROOP_SCALE);
    b.setPosition(x, y).setDepth(actorDepth(y));
    v.ring.setPosition(x, y + 1).setDepth(DEPTH.ground + 5);
    v.tag.setPosition(x, y - 132 * V2_TROOP_SCALE - 8).setDepth(actorDepth(y) + .5);
    v.fx.setDepth(actorDepth(y) + .6);
  }
  clear(): void { for (const v of this.lishiPool.splice(0)) for (const o of [v.body, v.ring, v.tag, v.fx]) o.destroy(); this.lishi.length = 0; this.fx.destroy(); }
}
