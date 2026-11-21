import Phaser from 'phaser';
import { DEPTH, FONT, actorDepth } from '../config';
import { DEFENSE_V2, climbSpeed, spotAt, v2Spots, walkSegment, type Pt, type V2Geo, type V2SpotKind } from '../data/defenseV2';
import { isRangedSpawn } from '../data/gateSpawn';
import type { Enemy } from '../entities/Enemy';
import type { Ally } from '../entities/Ally';

/**
 * 守城 v2 试玩版 b 段（共享笔记 defense-redesign-v2.md v2.2 第二、四、六节；按 3 天砍版）：
 * - 云梯车从城外开到墙脚某段 → 墙脚亮圈 → 梯子立在外墙面上 → 墙脚排队的近战兵一个接一个沿梯子往上爬（过渡：用敌兵背面行走帧往上挪，
 *   不是手绘攀爬帧）→ 翻上垛口落到走道上，和梯口驻守 / 主将近战（不做翻垛口 0.6 秒停顿）。
 * - 占段：一段里我方士兵全没了、且这段城头敌兵 ≥ 3 → 这段走道变红、这段梯子上人 ×2；这段敌兵清光即夺回（预备队照常自动补位）。
 * - 一键 F（头顶提示）：梯口推梯（梯上的人摔下城）、滚木架放滚木（砸这段的梯子 + 墙脚）、门楼油锅泼油（门前一片持续烧，专克冲车）、门楼内侧修门（站定读条）。
 * - 冲车开到门前撞门（第二战线）；城外近战每 3 个有 1 个（骑兵全部）去砍门；攻城主将先砍门。门破了先只报「城门被破」（敌兵进城、退守府衙在 c 段接）。
 * - 主将近战把走道南沿的普通兵打下城 → 摔死（精英 / 首领不会）。
 * 特效全用现有手绘图 / 序列帧（云梯车、冲车、滚木堆、地火、水墨圈），不画代码像素特效。数值全在 data/defenseV2.ts DEFENSE_V2.assault。
 */
export interface AssaultHost {
  scene: Phaser.Scene;
  g: V2Geo;
  player: () => Pt & { alive?: boolean };
  units: () => readonly Ally[];
  enemies: () => readonly Enemy[];
  now: () => number;
  elapsed: () => number;
  tier: 'small' | 'medium' | 'large';
  /** 器械（云梯车 / 冲车）：可被武器打的高耐久物件。 */
  spawnTarget: (x: number, y: number, hp: number, size: number, tex: string, frame: number) => Enemy | null;
  hit: (e: Enemy, dmg: number) => void;
  /** 直接击杀（摔下城）：走正常击杀结算（经验 / 掉落 / 战功）。 */
  kill: (e: Enemy) => void;
  advance: (e: Enemy, nx: number, ny: number, dt: number) => void;
  hpScale: () => number;
  banner: (t: string, danger: boolean, c?: string) => void;
  sfx: (k: string) => void;
  /** 走道贴图纹理（占段变红那层复用）。 */
  walkKey: string;
}
type LadderState = 'drive' | 'warn' | 'up' | 'down';
interface Ladder { seg: number; x: number; cart: Enemy; life: number; state: LadderState; until: number; img: Phaser.GameObjects.Image | null; ring: Phaser.GameObjects.Image | null; label: Phaser.GameObjects.Text; next: number; climbers: Set<Enemy> }
interface Ram { e: Enemy; life: number; x: number; next: number; label: Phaser.GameObjects.Text; atGate: boolean }

/** 梯身取云梯车图（siege_mid_ladder 帧 0）梯子最上面那截：顶端一截 + 一档横杆一节竖着平铺（下面那截后面压着车篷，不取）。 */
const LADDER_CROP = { x: 103, w: 52, capY: 5, capH: 20, y: 25, h: 18, scale: .6 } as const;

export class DefenseAssaultV2 {
  readonly gate: { hp: number; max: number; open: boolean };
  private ladders: Ladder[] = []; private rams: Ram[] = [];
  private climbing = new Map<Enemy, { lad: Ladder; life: number }>(); private falling = new Map<Enemy, number>();
  private atGate = new Map<Enemy, number>();
  private captured = [false, false, false, false]; private overlays: Array<Phaser.GameObjects.TileSprite | null> = [null, null, null, null]; private checkAt = 0;
  private logs: number[]; private logRegen: number[]; private oil: { charges: number; cd: number; regen: number };
  private burning: { until: number; next: number; fires: Phaser.GameObjects.Sprite[] } | null = null;
  private channel: { start: number; x: number; y: number } | null = null; private repairCd = 0;
  private nextLadderAt: number; private nextRamAt: number;
  private prompt: Phaser.GameObjects.Text; private bar: Phaser.GameObjects.Graphics; private barText: Phaser.GameObjects.Text;
  private objs: Phaser.GameObjects.GameObject[] = []; private done = false; private gateWarn = 1;
  /** 测试读。 */
  readonly stats = { ladders: 0, raised: 0, climbs: 0, landed: 0, pushed: 0, logs: 0, oil: 0, repairs: 0, rams: 0, ramHits: 0, gateHits: 0, fell: 0, captures: 0, retakes: 0, carts: 0, ramsBroken: 0 };

  constructor(private readonly h: AssaultHost) {
    const A = DEFENSE_V2.assault, s = h.scene, g = h.g;
    this.gate = { hp: A.gate.hp[h.tier], max: A.gate.hp[h.tier], open: false };
    this.logs = g.segs.map(() => A.logs.charges); this.logRegen = g.segs.map(() => 0); this.oil = { charges: A.oil.charges, cd: 0, regen: 0 };
    this.nextLadderAt = A.ladder.firstSec; this.nextRamAt = A.ram.firstSec;
    const sp = v2Spots(g), label = (x: number, y: number, t: string) => { const o = s.add.text(x, y, t, { fontFamily: FONT, fontSize: '13px', color: '#ffd28a', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 2); this.objs.push(o); return o; };
    // 滚木架（瓮城套件帧 5 滚木堆）、油锅位、修门位：一个小字签，不加框
    for (const r of sp.racks) { if (s.textures.exists('siege_mid_barb')) this.objs.push(s.add.image(r.x, r.y + 14, 'siege_mid_barb', 5).setOrigin(.5, .8).setDisplaySize(84, 84).setDepth(actorDepth(r.y)).setName('defv2-rack')); label(r.x, r.y + 30, '滚木').setName('defv2-rack-label'); }
    label(sp.oil.x, sp.oil.y + 26, '热油').setName('defv2-oil-label');
    label(sp.gate.x, sp.gate.y + 22, '修门').setName('defv2-gate-label');
    this.prompt = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe9bd', fontStyle: 'bold', resolution: 2, stroke: '#140d07', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText + 1).setVisible(false).setName('defv2-prompt');
    this.bar = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('defv2-gate-bar');
    this.barText = s.add.text(g.gx, g.F - 212, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe1a0', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-gate-text');
    this.objs.push(this.prompt, this.bar, this.barText);
  }

  // ———— 场景接口 ————
  /** 不受碰撞（正在爬 / 正在摔的，人在墙面上）。 */
  ghost(e: Enemy): boolean { return this.climbing.has(e) || this.falling.has(e); }
  /** 这段被占着（测试 / 舆图用）。 */
  get segmentsCaptured(): readonly boolean[] { return this.captured; }
  /** 屏边指示：在撞门的冲车、被占的段。 */
  guideTargets(): Array<{ key: string; x: number; y: number; label: string }> {
    const out: Array<{ key: string; x: number; y: number; label: string }> = [];
    for (const r of this.rams) if (r.atGate && this.alive(r.e, r.life)) out.push({ key: 'ram', x: r.e.x, y: r.e.y - 60, label: '冲车撞门' });
    this.captured.forEach((c, i) => { if (c) out.push({ key: 'seg' + i, x: this.h.g.segs[i].ladderX, y: this.h.g.W - 100, label: '城头失守' }); });
    return out;
  }
  snapshot() {
    return { gate: Math.round(this.gate.hp), gateMax: this.gate.max, gateOpen: this.gate.open, ladders: this.ladders.map(l => ({ seg: l.seg, state: l.state, climbers: l.climbers.size })), rams: this.rams.map(r => ({ atGate: r.atGate })),
      climbing: this.climbing.size, captured: [...this.captured], logs: [...this.logs], oil: this.oil.charges, stats: { ...this.stats } };
  }

  update(dt: number): void {
    if (this.done) return;
    const now = this.h.now(), el = this.h.elapsed(), A = DEFENSE_V2.assault;
    if (el >= this.nextLadderAt) { this.nextLadderAt = el + (this.spawnLadder() ? A.ladder.everySec : 3); }
    if (el >= this.nextRamAt) { this.nextRamAt = el + (this.spawnRam() ? A.ram.everySec : 5); }
    this.updateLadders(now, dt); this.updateRams(now, dt); this.updateBurning(now); this.updateChannel(now);
    if (now >= this.checkAt) { this.checkAt = now + A.capture.checkMs; this.checkSegments(); }
    this.regen(dt);
    if (!this.gate.open && this.gate.hp <= 0) this.breakGate();
    this.paint(now);
  }

  // ———— 云梯 ————
  private alive(e: Enemy, life: number): boolean { return e.active && e.spawnId === life && e.hp > 0; }
  private spawnLadder(): boolean {
    const A = DEFENSE_V2.assault.ladder, g = this.h.g, s = this.h.scene;
    if (this.ladders.length >= A.max) return false;
    const free = g.segs.filter(sg => !this.ladders.some(l => l.seg === sg.i)); if (!free.length) return false;
    const sg = free[Math.floor(Math.random() * free.length)], x = sg.ladderX, y = g.F + DEFENSE_V2.spawn.dy - 80;
    const cart = this.h.spawnTarget(x, y, Math.round(A.hp * Math.sqrt(Math.max(1, this.h.hpScale()))), A.size, s.textures.exists('siege_mid_ladder') ? 'siege_mid_ladder' : 'sishui_props_refined', 0); if (!cart) return false;
    const label = s.add.text(x, y - A.size - 8, '云梯车', { fontFamily: FONT, fontSize: '14px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-ladder-label');
    this.ladders.push({ seg: sg.i, x, cart, life: cart.spawnId, state: 'drive', until: 0, img: null, ring: null, label, next: 0, climbers: new Set() });
    this.stats.ladders++; this.stats.carts++;
    if (this.stats.ladders === 1) this.h.banner('云梯车来了', true, '开到墙脚就立梯——站梯口按 F 推梯，或用滚木砸');
    return true;
  }
  private ladderTexture(): string {
    const s = this.h.scene, key = 'defv2_ladder', C = LADDER_CROP; if (s.textures.exists(key)) return key; if (!s.textures.exists('siege_mid_ladder')) return '';
    const src = s.textures.get('siege_mid_ladder').getSourceImage() as HTMLImageElement, g = this.h.g;
    const rows = Math.ceil(((g.F - (g.W - DEFENSE_V2.art.crenelOver) + 24) / C.scale - C.capH) / C.h), H = C.capH + rows * C.h;
    const tex = s.textures.createCanvas(key, C.w, H)!, c = tex.context;
    c.drawImage(src, C.x, C.capY, C.w, C.capH, 0, 0, C.w, C.capH);
    for (let r = 0; r < rows; r++) c.drawImage(src, C.x, C.y, C.w, C.h, 0, C.capH + r * C.h, C.w, C.h);
    tex.refresh(); return key;
  }
  /** 立梯：梯身贴在外墙面上，梯顶钩在外侧城垛上、梯脚落在墙脚。 */
  private raise(l: Ladder): void {
    const s = this.h.scene, g = this.h.g, key = this.ladderTexture(); l.state = 'up'; l.next = this.h.now() + 600; this.stats.raised++;
    l.ring?.destroy(); l.ring = null; l.cart.sprite.setFrame(1);
    if (!key) return;
    const top = g.W - DEFENSE_V2.art.crenelOver - 12, hgt = g.F + 12 - top;
    if (!l.img) l.img = s.add.image(l.x, top, key).setOrigin(.5, 0).setDepth(actorDepth(g.W) + .003).setName('defv2-ladder');
    const im = l.img, sc = hgt / im.height; s.tweens.killTweensOf(im);
    im.setVisible(true).setAlpha(1).setPosition(l.x, top).setScale(sc, sc * .2);
    s.tweens.add({ targets: im, scaleY: sc, duration: 380, ease: 'Back.easeOut' });
  }
  /** 梯子倒（推梯 / 滚木）：往城外倒，梯上的人摔下去；车还在的话 raiseMs 后重新立。 */
  private topple(l: Ladder, why: 'push' | 'log'): number {
    const s = this.h.scene, g = this.h.g, n = l.climbers.size; l.state = 'down'; l.until = this.h.now() + DEFENSE_V2.assault.ladder.raiseMs; l.cart.sprite.setFrame(0);
    for (const c of [...l.climbers]) this.fall(c); l.climbers.clear();
    const im = l.img; if (im) { s.tweens.killTweensOf(im); s.tweens.add({ targets: im, y: g.F - 60, scaleY: im.scaleY * .18, alpha: 0, duration: 460, ease: 'Quad.easeIn', onComplete: () => im.setVisible(false) }); }
    if (why === 'push') { this.stats.pushed++; this.h.banner('推倒云梯', false, n ? `梯上 ${n} 人摔下城` : '车还在，过一会儿会再立起来'); }
    this.h.sfx('gong'); return n;
  }
  private updateLadders(now: number, dt: number): void {
    const A = DEFENSE_V2.assault.ladder, g = this.h.g, footY = g.F + A.footDy;
    for (const l of [...this.ladders]) {
      if (!this.alive(l.cart, l.life)) { this.wreck(l.x, footY, 'siege_mid_ladder', 3); for (const c of [...l.climbers]) this.fall(c); l.climbers.clear(); l.img?.destroy(); l.ring?.destroy(); l.label.destroy(); this.ladders.splice(this.ladders.indexOf(l), 1); this.h.banner('云梯车被毁', false, `第 ${l.seg + 1} 段这一架不会再立了`); continue; }
      const cart = l.cart;
      if (l.state === 'drive') {
        const y = Math.max(footY, cart.y - A.speed * dt); cart.sprite.setPosition(l.x, y).setDepth(actorDepth(y)); l.label.setPosition(l.x, y - A.size - 8);
        if (y <= footY) { l.state = 'warn'; l.until = now + A.warnMs; this.ringAt(l); }
        continue;
      }
      if (l.state === 'warn' && now >= l.until) { this.raise(l); continue; }
      if (l.state === 'down' && now >= l.until) { l.state = 'warn'; l.until = now + A.warnMs; this.ringAt(l); continue; }
      if (l.state !== 'up') continue;
      for (const c of l.climbers) if (!c.active) l.climbers.delete(c);
      // 上人：墙脚排队的近战兵里挑最近的一个；这段城头满 segCap 不上
      const fast = this.captured[l.seg] ? DEFENSE_V2.assault.capture.fastMul : 1;
      if (now < l.next || this.segFoes(l.seg) + l.climbers.size >= A.segCap) continue;
      let best: Enemy | null = null, bd = Infinity;
      for (const e of this.h.enemies()) { if (!this.climbable(e) || this.climbing.has(e) || this.falling.has(e)) continue; const dx = Math.abs(e.x - l.x), dy = e.y - g.F; if (dx > A.footReach || dy < -10 || dy > 120) continue; const d = dx + Math.abs(dy - 20); if (d < bd) { bd = d; best = e; } }
      if (!best) continue;
      l.next = now + A.climbGapMs / fast; l.climbers.add(best); this.climbing.set(best, { lad: l, life: best.spawnId }); this.stats.climbs++;
    }
  }
  /** 墙脚亮圈（水墨笔圈 siege_capture 帧 1，染红、一闪一闪）。 */
  private ringAt(l: Ladder): void {
    const s = this.h.scene, g = this.h.g; l.ring?.destroy(); l.ring = null; if (!s.textures.exists('siege_capture')) return;
    const r = s.add.image(l.x, g.F + 14, 'siege_capture', 1).setDisplaySize(150, 64).setTint(0xff6a4a).setAlpha(.9).setDepth(actorDepth(g.F) + .002).setName('defv2-ladder-ring');
    s.tweens.add({ targets: r, alpha: .35, duration: 300, yoyo: true, repeat: -1 }); l.ring = r;
  }
  private climbable(e: Enemy): boolean { return e.active && !e.isSupplySlot && e.hp > 0 && e.kind !== 'boss' && e.kind !== 'cavalry' && e.def.behavior !== 'wall' && !isRangedSpawn(e.kind, e.def); }
  /** 这段城头（走道上）的敌兵数（不含还在梯子上的）。 */
  private segFoes(seg: number): number { let n = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.hp > 0 && !this.climbing.has(e) && walkSegment(this.h.g, e) === seg) n++; return n; }
  /** 摔下城：普通兵摔死（正常击杀结算）；精英摔回墙脚、掉 35% 血；首领不会。 */
  private fall(e: Enemy): void {
    this.climbing.delete(e); if (!e.active || e.kind === 'boss' || this.falling.has(e)) return;
    const s = this.h.scene, g = this.h.g, life = e.spawnId, elite = e.kind === 'elite', A = DEFENSE_V2.assault.push;
    this.falling.set(e, life); this.stats.fell++;
    const tx = e.x + (Math.random() - .5) * 40, ty = g.F + 18 + Math.random() * 30, spin = (Math.random() < .5 ? -1 : 1) * (elite ? 0 : 75);
    s.tweens.add({ targets: e.sprite, x: tx, y: ty, angle: spin, duration: A.fallMs, ease: 'Quad.easeIn', onUpdate: tw => { if (e.spawnId !== life || !e.active) { tw.stop(); e.sprite.setAngle(0); this.falling.delete(e); } }, onComplete: () => {
      this.falling.delete(e); e.sprite.setAngle(0); if (!e.active || e.spawnId !== life) return;
      if (elite) this.h.hit(e, e.maxHp * .35); else this.h.kill(e);
    } });
  }

  // ———— 敌兵步进（场景 customEnemyStep 转来）————
  step(e: Enemy, dt: number): boolean {
    const c = this.climbing.get(e);
    if (c) {
      if (e.spawnId !== c.life || c.lad.state !== 'up') { this.climbing.delete(e); c.lad.climbers.delete(e); return false; }
      const g = this.h.g, sp = climbSpeed(g) * (this.captured[c.lad.seg] ? DEFENSE_V2.assault.capture.fastMul : 1), dy = sp * dt, tx = c.lad.x + ((e.spawnId % 3) - 1) * 5;
      e.sprite.x += (tx - e.x) * Math.min(1, 10 * dt); e.sprite.y -= dy;
      e.moveVx = 0; e.moveVy = -sp; e.intentDx = 0; e.intentDy = -dy; // 背面行走帧往上挪（过渡，不冒充手绘攀爬帧）
      if (e.y <= g.W - 26) { e.sprite.y = g.W - 26; this.climbing.delete(e); c.lad.climbers.delete(e); this.stats.landed++; } // 翻上垛口，落到走道上
      return true;
    }
    if (this.falling.has(e)) { e.moveVx = e.moveVy = 0; return true; }
    const g = this.h.g; if (e.y < g.F - 24) return false; // 走道上 / 城里：照常追人
    const A = DEFENSE_V2.assault;
    if (e.kind === 'cavalry' && e.active && !e.isSupplySlot) return this.gate.open ? false : this.toGate(e, dt, A.gate.contactMul); // 骑兵不爬梯：全去砍门
    if (!this.climbable(e)) return false;
    if (!this.gate.open && e.spawnId % A.gate.share === 0) return this.toGate(e, dt, A.gate.contactMul);
    // 排云梯：最近一架已经到墙脚的梯子，梯脚两侧排开等着
    let lad: Ladder | null = null, ld = Infinity; for (const l of this.ladders) if (l.state !== 'drive') { const d = Math.abs(l.x - e.x) + (l.state === 'up' ? 0 : 200); if (d < ld) { ld = d; lad = l; } }
    if (!lad) return false; // 还没有梯子：照常往主将那边挤（挤在墙脚）
    const qx = lad.x + ((e.spawnId % 9) - 4) * 17, qy = g.F + 22 + (e.spawnId % 3) * 15;
    return this.walk(e, qx, qy, dt, 12);
  }
  private walk(e: Enemy, x: number, y: number, dt: number, stop: number): boolean {
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d <= stop) { e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true;
  }
  /** 去门前砍门（门前同时最多 cap 个，多的在后面等）。 */
  private toGate(e: Enemy, dt: number, mul: number): boolean {
    const A = DEFENSE_V2.assault.gate, g = this.h.g, spread = ((e.spawnId % 9) - 4) * 20, gx = g.gx + spread, gy = g.F + 26 + (e.spawnId % 2) * 14;
    const d = Math.hypot(gx - e.x, gy - e.y);
    if (d <= A.reach) { if (this.slot(e, A.cap)) { this.atGate.set(e, this.h.now()); this.gate.hp -= e.def.damage * mul * dt; this.stats.gateHits++; } e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    return this.walk(e, gx, gy, dt, 4);
  }
  private slot(e: Enemy, cap: number): boolean {
    const now = this.h.now(); if (this.atGate.has(e) && now - (this.atGate.get(e) ?? 0) < 250) return true;
    let n = 0; for (const [k, t] of this.atGate) { if (!k.active || now - t >= 250) this.atGate.delete(k); else n++; }
    return n < cap;
  }
  /** 攻城主将：门没破先来砍门（× bossMul）；门破了交回原招式（进城在 c 段接）。 */
  bossStep(e: Enemy, dt: number): boolean {
    if (this.gate.open || e.y < this.h.g.F - 24) return false;
    const A = DEFENSE_V2.assault.gate, g = this.h.g, d = Math.hypot(g.gx - e.x, g.F + 40 - e.y);
    if (d <= A.reach + 10) { this.gate.hp -= e.def.damage * A.contactMul * A.bossMul * dt; e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    return this.walk(e, g.gx, g.F + 40, dt, 4);
  }
  /** 主将近战打中走道南沿的普通兵（主将在它北边）→ 推下城。返回 true = 推下去了。 */
  tryPushOff(e: Enemy, from: Pt): boolean {
    const g = this.h.g, P = DEFENSE_V2.assault.push;
    if (!e.active || e.isSupplySlot || e.kind === 'elite' || e.kind === 'boss' || e.def.behavior === 'wall' || this.ghost(e)) return false;
    if (e.y < g.W - P.band || e.y > g.W || from.y > e.y - 8 || e.x < g.X0 || e.x > g.X1) return false;
    this.fall(e); return true;
  }

  // ———— 冲车 ————
  private spawnRam(): boolean {
    const A = DEFENSE_V2.assault.ram, g = this.h.g, s = this.h.scene;
    if (this.gate.open || this.rams.length >= A.max) return false;
    const x = g.gx + (Math.random() - .5) * 60, y = g.F + DEFENSE_V2.spawn.dy - 60;
    const e = this.h.spawnTarget(x, y, Math.round(A.hp * Math.sqrt(Math.max(1, this.h.hpScale()))), A.size, s.textures.exists('siege_mid_ram') ? 'siege_mid_ram' : 'sishui_props_refined', 0); if (!e) return false;
    const label = s.add.text(x, y - A.size - 8, '冲车', { fontFamily: FONT, fontSize: '14px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-ram-label');
    this.rams.push({ e, life: e.spawnId, x, next: 0, label, atGate: false }); this.stats.rams++;
    this.h.banner('冲车来了', true, '撞城门——站门楼油锅按 F 泼热油（专克冲车）');
    return true;
  }
  private updateRams(now: number, dt: number): void {
    const A = DEFENSE_V2.assault.ram, g = this.h.g, s = this.h.scene, ty = g.F + A.footDy;
    for (const r of [...this.rams]) {
      if (!this.alive(r.e, r.life)) { this.wreck(r.x, ty, 'siege_mid_ram', 5); r.label.destroy(); this.rams.splice(this.rams.indexOf(r), 1); this.stats.ramsBroken++; this.h.banner('冲车被毁', false); continue; }
      if (!r.atGate) { const y = Math.max(ty, r.e.y - A.speed * dt); r.e.sprite.setPosition(r.x, y).setDepth(actorDepth(y)); r.label.setPosition(r.x, y - A.size - 8); if (y <= ty) r.atGate = true; continue; }
      if (this.gate.open || now < r.next) continue;
      r.next = now + A.hitMs; this.gate.hp -= A.damage; this.stats.ramHits++; this.h.sfx('bossHit');
      s.tweens.addCounter({ from: 0, to: 3, duration: 360, onUpdate: tw => { if (r.e.active) r.e.sprite.setFrame(Math.floor(tw.getValue() ?? 0) % 4); }, onComplete: () => { if (r.e.active) r.e.sprite.setFrame(0); } });
      const v = s.cameras.main.worldView; if (v.contains(g.gx, g.F)) s.cameras.main.shake(80, .0018);
    }
  }
  private wreck(x: number, y: number, tex: string, frame: number): void {
    const s = this.h.scene; if (!s.textures.exists(tex)) return;
    const im = s.add.image(x, y, tex, frame).setOrigin(.5, 1).setDisplaySize(140, 140).setDepth(actorDepth(y - 20)).setName('defv2-wreck');
    s.tweens.add({ targets: im, alpha: 0, delay: 6000, duration: 900, onComplete: () => im.destroy() });
  }
  private breakGate(): void { this.gate.open = true; this.gate.hp = 0; this.h.banner('城门被破！', true, '敌军要从门洞冲进来了'); this.h.sfx('gong'); }

  // ———— 一键 F ————
  private spot(): { kind: V2SpotKind; seg: number } | null { const p = this.h.player(); return spotAt(this.h.g, p, seg => this.ladders.some(l => l.seg === seg && l.state === 'up')); }
  /** F：按站的位置做一件事。返回 true（守城 v2 里 F 不再当「出击」）。 */
  interact(): boolean {
    if (this.done) return true;
    const sp = this.spot(), now = this.h.now(); if (!sp) return true;
    if (sp.kind === 'ladder') { const l = this.ladders.find(q => q.seg === sp.seg && q.state === 'up'); if (l) this.topple(l, 'push'); return true; }
    if (sp.kind === 'rack') { if (this.logs[sp.seg] > 0) this.dropLog(sp.seg); else this.h.sfx('playerHurt'); return true; }
    if (sp.kind === 'oil') { if (this.oil.charges > 0 && now >= this.oil.cd) this.pourOil(); else this.h.sfx('playerHurt'); return true; }
    if (sp.kind === 'gate') { if (!this.gate.open && this.gate.hp < this.gate.max && now >= this.repairCd && !this.channel) { const p = this.h.player(); this.channel = { start: now, x: p.x, y: p.y }; } else this.h.sfx('playerHurt'); return true; }
    return true;
  }
  private dropLog(seg: number): void {
    const A = DEFENSE_V2.assault.logs, g = this.h.g, s = this.h.scene, l = this.ladders.find(q => q.seg === seg && q.state !== 'drive'), x = l?.x ?? g.segs[seg].ladderX;
    this.logs[seg]--; this.stats.logs++;
    const hit = () => {
      const k = Math.sqrt(Math.max(1, this.h.hpScale())); let n = 0;
      if (l && l.state === 'up') n = this.topple(l, 'log');
      if (l && this.alive(l.cart, l.life)) this.h.hit(l.cart, A.engineDamage * k);
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.hp > 0 && !this.falling.has(e) && Math.abs(e.x - x) < A.foot && e.y > g.F - 30 && e.y < g.F + 160) this.h.hit(e, A.damage * k);
      this.h.banner('滚木！', false, (n ? `梯上 ${n} 人砸下城 · ` : '') + `第 ${seg + 1} 段还剩 ${this.logs[seg]} 次`);
    };
    if (!s.textures.exists('siege_mid_barb')) { hit(); return; }
    const log = s.add.image(x, g.W - 40, 'siege_mid_barb', 5).setDisplaySize(104, 104).setDepth(actorDepth(g.F) + .2).setName('defv2-log');
    s.tweens.add({ targets: log, y: g.F + 10, angle: 200, duration: A.fallMs, ease: 'Quad.easeIn', onComplete: () => { hit(); s.tweens.add({ targets: log, x: x + (Math.random() < .5 ? -1 : 1) * 160, angle: 520, alpha: 0, duration: 700, onComplete: () => log.destroy() }); } });
    this.h.sfx('gong');
  }
  private pourOil(): void {
    const O = DEFENSE_V2.assault.oil, g = this.h.g, s = this.h.scene, now = this.h.now(), fires: Phaser.GameObjects.Sprite[] = [];
    this.oil.charges--; this.oil.cd = now + O.cdMs; this.stats.oil++;
    if (s.textures.exists('ground_fire')) for (const dx of [-80, 0, 80]) fires.push(s.add.sprite(g.gx + dx, g.F + 44, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(130, 130).setDepth(actorDepth(g.F + 44) + .05).setName('defv2-oil'));
    this.burning?.fires.forEach(f => f.destroy());
    this.burning = { until: now + O.tickMs * O.ticks, next: now, fires };
    this.h.banner('热油！', false, `门前一片持续烧 · 还剩 ${this.oil.charges} 次`);
  }
  private updateBurning(now: number): void {
    const b = this.burning; if (!b) return; const O = DEFENSE_V2.assault.oil, g = this.h.g;
    b.fires.forEach((f, i) => f.setFrame(Math.floor(now / 120 + i) % 8));
    if (now >= b.until) { for (const f of b.fires) f.destroy(); this.burning = null; return; }
    if (now < b.next) return; b.next = now + O.tickMs;
    const k = Math.sqrt(Math.max(1, this.h.hpScale())), cx = g.gx, cy = g.F + 40;
    for (const e of this.h.enemies()) if (e.active && e.hp > 0 && Math.hypot(e.x - cx, (e.y - cy) * 1.4) <= O.radius) this.h.hit(e, O.damage * k * (this.rams.some(r => r.e === e) ? O.engineMul : 1));
  }
  private updateChannel(now: number): void {
    const c = this.channel; if (!c) return; const R = DEFENSE_V2.assault.repair, p = this.h.player();
    if (this.gate.open || Math.hypot(p.x - c.x, p.y - c.y) > R.moveTol) { this.channel = null; return; }
    if (now - c.start < R.channelMs) return;
    this.channel = null; this.repairCd = now + R.cdMs; this.gate.hp = Math.min(this.gate.max, this.gate.hp + this.gate.max * R.amount); this.stats.repairs++;
    this.h.banner('城门补好了一些', false, `+${Math.round(R.amount * 100)}% · 现在 ${Math.round(this.gate.hp / this.gate.max * 100)}%`);
  }
  /** c 段之前：滚木 / 热油按 regenSec 慢慢回一次（c 段改成喘息补满）。 */
  private regen(dt: number): void {
    const A = DEFENSE_V2.assault;
    this.logs.forEach((n, i) => { if (n >= A.logs.charges) { this.logRegen[i] = 0; return; } this.logRegen[i] += dt; if (this.logRegen[i] >= A.logs.regenSec) { this.logRegen[i] = 0; this.logs[i]++; } });
    if (this.oil.charges >= A.oil.charges) this.oil.regen = 0; else { this.oil.regen += dt; if (this.oil.regen >= A.oil.regenSec) { this.oil.regen = 0; this.oil.charges++; } }
  }

  // ———— 占段 / 夺回 ————
  /** 这段走道变红（复用走道贴图染红叠一层，不画代码特效；墙图是异步载入的，第一次用到时再建）。 */
  private markSeg(i: number, on: boolean): void {
    const s = this.h.scene, g = this.h.g, sg = g.segs[i];
    if (on && !this.overlays[i] && s.textures.exists(this.h.walkKey)) { const o = s.add.tileSprite((sg.x0 + sg.x1) / 2, (g.top + g.W) / 2, sg.x1 - sg.x0, g.W - g.top, this.h.walkKey).setTilePosition(sg.x0 - g.X0, 0).setTint(0xff5a40).setAlpha(.55).setDepth(DEPTH.ground + 3).setName('defv2-captured'); this.overlays[i] = o; this.objs.push(o); }
    this.overlays[i]?.setVisible(on);
  }
  private checkSegments(): void {
    const g = this.h.g, C = DEFENSE_V2.assault.capture;
    g.segs.forEach(sg => {
      const foes = this.segFoes(sg.i), guards = this.h.units().filter(u => u.active && walkSegment(g, u) === sg.i).length;
      if (!this.captured[sg.i] && guards === 0 && foes >= C.minFoes) { this.captured[sg.i] = true; this.stats.captures++; this.markSeg(sg.i, true); this.h.banner(`第 ${sg.i + 1} 段城头失守！`, true, '这段梯子上人更快——清掉这段的敌兵就夺回'); }
      else if (this.captured[sg.i] && foes === 0) { this.captured[sg.i] = false; this.stats.retakes++; this.markSeg(sg.i, false); this.h.banner(`夺回第 ${sg.i + 1} 段`, false, '预备队会上来补驻守'); }
    });
  }

  // ———— 画面：头顶提示、城门血条 ————
  private promptText(now: number): string {
    const sp = this.spot(); if (!sp) return '';
    if (sp.kind === 'ladder') return 'F · 推梯';
    if (sp.kind === 'rack') return this.logs[sp.seg] > 0 ? `F · 滚木 ×${this.logs[sp.seg]}` : '滚木用完';
    if (sp.kind === 'oil') return this.oil.charges <= 0 ? '热油用完' : now < this.oil.cd ? `热油冷却 ${Math.ceil((this.oil.cd - now) / 1000)} 秒` : `F · 泼油 ×${this.oil.charges}`;
    if (this.gate.open) return '';
    if (this.channel) return `修门中 ${Math.max(0, (DEFENSE_V2.assault.repair.channelMs - (now - this.channel.start)) / 1000).toFixed(1)} 秒`;
    if (now < this.repairCd) return `修门冷却 ${Math.ceil((this.repairCd - now) / 1000)} 秒`;
    return this.gate.hp >= this.gate.max ? '城门完好' : 'F · 修门';
  }
  private paint(now: number): void {
    const p = this.h.player(), t = this.promptText(now), g = this.h.g;
    // 头顶提示；主将在画面最上面时（镜头往城外让，城头在画面上部）头顶会压到计时器，改放脚下
    const v = this.h.scene.cameras.main.worldView, above = p.y - DEFENSE_V2.assault.promptDy, py = v.height > 0 && (above - v.y) / v.height < .17 ? p.y + 26 : above;
    this.prompt.setText(t).setVisible(!!t && p.alive !== false).setPosition(p.x, py);
    const k = Math.max(0, this.gate.hp / this.gate.max), b = this.bar.clear(), w = 150, x = g.gx - w / 2, y = g.F - 198;
    if (this.gate.open) { this.barText.setText('城门已破').setColor('#ff8a70'); return; }
    b.fillStyle(0x140a06, .85).fillRect(x - 1, y - 1, w + 2, 9).fillStyle(k < .3 ? 0xd8432a : 0xd8a03a, 1).fillRect(x, y, w * k, 7);
    this.barText.setText(`城门 ${Math.round(k * 100)}%`).setColor(k < .3 ? '#ff8a70' : '#ffe1a0');
    // 城门告急（70% / 40% / 15%）：横幅提一次
    for (const th of [.7, .4, .15]) if (k <= th && this.gateWarn > th) { this.gateWarn = th; this.h.banner(`城门 ${Math.round(k * 100)}%`, true, th <= .4 ? '站门楼内侧按 F 修门，或去门楼泼热油' : '冲车在撞门'); break; }
  }

  clear(): void {
    this.done = true;
    for (const e of this.falling.keys()) if (e.active) e.sprite.setAngle(0);
    this.climbing.clear(); this.falling.clear();
    for (const l of this.ladders) { l.label.destroy(); l.img?.destroy(); l.ring?.destroy(); } for (const r of this.rams) r.label.destroy();
    for (const f of this.burning?.fires ?? []) f.destroy(); this.burning = null;
    for (const o of this.objs) o.destroy(); this.objs = []; this.ladders = []; this.rams = []; this.overlays = [null, null, null, null];
  }
}
