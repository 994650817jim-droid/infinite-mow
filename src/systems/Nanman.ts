import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { warnFx } from '../ui/WarnFx';
import { playSheet } from './SkillFxSheets';
import { worldText } from '../world/WorldUI';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';

/**
 * 第十一章「克制兵种」（数值 NANMAN，开发期初值，平衡之后再调）：
 * - 藤甲兵（本章 kind === 'shield'）：刀枪不入——非火攻只吃 20%；被火攻命中受 3 倍伤害，并被点燃（持续烧伤），同时引燃身边的敌兵；
 * - 火盆：主将碰到即得「火攻」一段时间（主将自己的攻击都算火攻），火盆熄灭，过一阵重新燃起——没有火系武将也能破藤甲；
 * - 象兵（本章 kind === 'cavalry'）：隔一阵锁定主将，地面先铺冲锋预警箭道，随后直线冲撞，撞到主将重伤 + 击退、撞到部曲也伤；
 * - 毒泉：地上一片片瘴气毒泉，主将 / 部曲站在里面持续掉血、移动变慢；蛮兵熟悉水土不受影响。
 * 美术：毒雾用手绘扬尘序列帧（fx_collapse_dust）染绿过渡、火用手绘地火 / 爆炸序列帧、火盆用手绘火盆燃烧帧；等 v2 毒雾序列帧到了再换（nz_poison）。
 */
export const NANMAN = {
  rattan: { physMul: .2, fireMul: 3, igniteR: 120, burnMs: 3200, tickMs: 400, burnDps: 10, burnPct: .05, otherBurnMul: .4 },
  elephant: { firstMs: 3500, cdMs: [5500, 8500] as const, warnMs: 950, range: [170, 560] as const, len: 620, speed: 640, width: 100, damage: 26, knock: 70, allyDamage: 30, recoverMs: 700 },
  poison: { tickMs: 500, dps: 5, slow: .68, allyDps: 6, puffMs: 260 },
  brazier: { radius: 70, buffMs: 12000, relightMs: 20000, size: 120 },
  // 每关的毒泉 / 火盆位置
  pools: [
    [{ x: -420, y: -260, rx: 230, ry: 120 }, { x: 380, y: 140, rx: 260, ry: 130 }, { x: -260, y: 420, rx: 200, ry: 105 }, { x: 560, y: -460, rx: 190, ry: 100 }, { x: -760, y: 180, rx: 170, ry: 92 }],
    [],
    [{ x: -520, y: 300, rx: 200, ry: 104 }, { x: 600, y: -260, rx: 200, ry: 104 }],
  ] as ReadonlyArray<ReadonlyArray<{ x: number; y: number; rx: number; ry: number }>>,
  braziers: [
    [{ x: 0, y: -520 }, { x: 760, y: 420 }],
    [{ x: -300, y: -220 }, { x: 320, y: -240 }, { x: -340, y: 300 }, { x: 360, y: 320 }, { x: 0, y: -440 }],
    [{ x: -260, y: -200 }, { x: 280, y: 260 }, { x: 0, y: -560 }],
  ] as ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>,
} as const;

export interface NanmanHost {
  scene: Phaser.Scene; player: Player; allies: () => readonly Ally[]; enemies: () => readonly Enemy[]; now: () => number;
  /** 烧伤 / 冲撞造成的伤害（不再走藤甲倍率）。 */
  hitEnemy: (e: Enemy, dmg: number) => void;
  hurtTroops: (x: number, y: number, r: number, dmg: number) => void;
  banner: (t: string, danger?: boolean, caption?: string) => void; sfx: (k: string) => void; boss: () => Enemy | null;
}
interface Charge { state: 'idle' | 'warn' | 'charge' | 'recover'; at: number; angle: number; sx: number; sy: number; moved: number; hit: boolean; id: string }
interface Brazier { x: number; y: number; img: Phaser.GameObjects.Image; lit: boolean; relightAt: number }

export class Nanman {
  readonly stats = { rattanHits: 0, rattanFireHits: 0, ignites: 0, burnTicks: 0, charges: 0, chargeHits: 0, poisonTicks: 0, fireBuffs: 0 };
  /** 「火攻」持续到（战斗时钟）。 */
  fireUntil = 0;
  /** 正在结算烧伤：这时的伤害不再乘藤甲倍率、不再引燃。 */
  inBurn = false;
  private burning = new Map<number, { e: Enemy; until: number; next: number; fxAt: number; rattan: boolean }>();
  private charges = new Map<number, Charge>();
  private braziers: Brazier[] = []; private objects: Phaser.GameObjects.GameObject[] = [];
  private poisonTickAt = 0; private puffAt = 0; private fireFxAt = 0; private seq = 0; private label?: Phaser.GameObjects.Text;
  readonly pools: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }>;

  constructor(private readonly h: NanmanHost, readonly stage: 1 | 2 | 3) {
    const sc = h.scene;
    this.pools = NANMAN.pools[stage - 1];
    // 毒泉：地面一层染绿的手绘扬尘（静帧铺底）+ 不断冒起的毒雾
    for (const p of this.pools) {
      if (sc.textures.exists('fx_collapse_dust')) for (const [dx, dy, s, f] of [[0, 0, 1, 3], [-.45, -.15, .7, 4], [.45, .18, .7, 2]] as const) {
        const i = sc.add.image(p.x + dx * p.rx, p.y + dy * p.ry, 'fx_collapse_dust', f).setDisplaySize(p.rx * 2.1 * s, p.ry * 2.6 * s).setTint(0x6f9a3a).setAlpha(.5).setDepth(DEPTH.ground + 2);
        this.objects.push(i);
      }
      if (sc.textures.exists('ground_v2_jiang')) { const t = sc.add.image(p.x, p.y, 'ground_v2_jiang').setDisplaySize(p.rx * 1.7, p.ry * 1.5).setTint(0x4e6b2a).setAlpha(.35).setDepth(DEPTH.ground + 1); this.objects.push(t); }
    }
    // 火盆
    for (const b of NANMAN.braziers[stage - 1]) {
      const key = sc.textures.exists('brazier_burning') ? 'brazier_burning' : 'yellow_props';
      const img = sc.add.image(b.x, b.y, key, 0).setOrigin(.5, .9).setDisplaySize(NANMAN.brazier.size, NANMAN.brazier.size).setDepth(actorDepth(b.y));
      this.objects.push(img); this.braziers.push({ x: b.x, y: b.y, img, lit: true, relightAt: 0 });
    }
    this.label = worldText(sc, 0, 0, '', 15, '#ffd28a').setOrigin(.5).setDepth(36).setStroke('#1a0f08', 4).setVisible(false); this.objects.push(this.label);
  }

  get fireActive(): boolean { return this.h.now() < this.fireUntil; }
  isRattan(e: Enemy): boolean { return e.kind === 'shield'; }
  isElephant(e: Enemy): boolean { return e.kind === 'cavalry'; }
  /** 象兵是否被本系统接管移动（预警原地蓄势 / 冲撞 / 收势）。 */
  busy(e: Enemy): boolean { const c = this.charges.get(e.uid); return !!c && c.state !== 'idle'; }
  inPool(x: number, y: number): boolean { for (const p of this.pools) if (((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1) return true; return false; }
  isBurning(e: Enemy): boolean { return this.burning.has(e.uid); }

  /** 主将 / 部曲打到敌人前算伤害倍率（藤甲）。返回倍率；火攻命中藤甲时顺带引燃。 */
  damageMul(e: Enemy, fire: boolean): number {
    if (this.inBurn || !this.isRattan(e) || e === this.h.boss()) return 1;
    this.stats.rattanHits++;
    if (!fire) return NANMAN.rattan.physMul;
    this.stats.rattanFireHits++; this.ignite(e, true);
    return NANMAN.rattan.fireMul;
  }
  /** 点燃（藤甲引燃身边敌兵）。 */
  ignite(e: Enemy, spread: boolean) {
    const R = NANMAN.rattan, now = this.h.now(), was = this.burning.get(e.uid);
    if (was) was.until = now + R.burnMs; else { this.burning.set(e.uid, { e, until: now + R.burnMs, next: now + R.tickMs, fxAt: 0, rattan: this.isRattan(e) }); this.stats.ignites++; }
    if (!spread || was) return;
    if (this.h.scene.textures.exists('fx_explosion')) playSheet(this.h.scene, 'fx_explosion', e.x, e.y - 10, { size: 120, depth: DEPTH.fx, ms: 380, alpha: .8 });
    for (const o of this.h.enemies()) if (o !== e && o.active && !o.isSupplySlot && o !== this.h.boss() && Math.hypot(o.x - e.x, o.y - e.y) <= R.igniteR) this.ignite(o, false);
  }

  update(dt: number) {
    const now = this.h.now(), p = this.h.player, sc = this.h.scene;
    // ---- 火盆 ----
    for (const b of this.braziers) {
      if (!b.lit && now >= b.relightAt) { b.lit = true; b.img.setAlpha(1); }
      if (b.lit) { if (b.img.texture.key === 'brazier_burning') b.img.setFrame(Math.floor(now / 90) % 8); }
      if (b.lit && Math.hypot(p.x - b.x, p.y - b.y) <= NANMAN.brazier.radius) {
        b.lit = false; b.relightAt = now + NANMAN.brazier.relightMs; b.img.setAlpha(.45); if (b.img.texture.key === 'brazier_burning') b.img.setFrame(0);
        const fresh = !this.fireActive; this.fireUntil = now + NANMAN.brazier.buffMs; this.stats.fireBuffs++;
        if (fresh) this.h.banner('火攻！', false, '主将的攻击化为火攻 · 藤甲兵遇火即燃');
        this.h.sfx('hitFire');
        playSheet(sc, 'fx_explosion', b.x, b.y - 40, { size: 130, depth: DEPTH.fx, ms: 360, alpha: .75 });
      }
    }
    if (this.fireActive && now >= this.fireFxAt) this.fireFxAt = now + 380, playSheet(sc, 'fx_ground_fire', p.x, p.y + 6, { size: 64, depth: actorDepth(p.y) - 1, ms: 420, alpha: .55, originY: .8 });
    // ---- 烧伤 ----
    const R = NANMAN.rattan;
    for (const [id, b] of this.burning) {
      if (!b.e.active || now >= b.until) { this.burning.delete(id); continue; }
      if (now >= b.fxAt) { b.fxAt = now + 420; const e = b.e; playSheet(sc, 'fx_ground_fire', e.x, e.y + 4, { size: b.rattan ? 78 : 56, depth: actorDepth(e.y) + 1, ms: 440, alpha: .85, originY: .85, onUpdate: im => { if (e.active) im.setPosition(e.x, e.y + 4); } }); }
      if (now >= b.next) {
        b.next = now + R.tickMs; this.stats.burnTicks++;
        const dmg = (R.burnDps + b.e.maxHp * R.burnPct) * R.tickMs / 1000 * (b.rattan ? 1 : R.otherBurnMul);
        this.inBurn = true; try { this.h.hitEnemy(b.e, dmg); } finally { this.inBurn = false; }
      }
    }
    // ---- 象兵冲撞 ----
    const E = NANMAN.elephant, fx = warnFx(sc);
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || !this.isElephant(e)) continue;
      e.dashCd = 99; // 关掉通用骑兵小冲刺，由这里接管
      let c = this.charges.get(e.uid);
      if (!c) { c = { state: 'idle', at: now + E.firstMs * (.6 + Math.random() * .8), angle: 0, sx: 0, sy: 0, moved: 0, hit: false, id: 'nz-ele-' + (this.seq++) }; this.charges.set(e.uid, c); }
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (c.state === 'idle') {
        if (now >= c.at && d >= E.range[0] && d <= E.range[1]) { c.state = 'warn'; c.at = now + E.warnMs; c.angle = Math.atan2(p.y - e.y, p.x - e.x); c.sx = e.x; c.sy = e.y; c.moved = 0; c.hit = false; e.sprite.setTint(0xffb08a); }
      } else if (c.state === 'warn') {
        fx.lane(c.id, 'charge', c.sx, c.sy, c.angle, E.len, E.width, 1 - (c.at - now) / E.warnMs, now);
        if (now >= c.at) { c.state = 'charge'; this.stats.charges++; fx.shapeImpact(c.id, 'charge', c.sx, c.sy, E.len, c.angle, now, E.width, { alpha: .5 }); this.h.sfx('bossSummon'); }
      } else if (c.state === 'charge') {
        const step = E.speed * dt, vx = Math.cos(c.angle), vy = Math.sin(c.angle);
        e.sprite.x += vx * step; e.sprite.y += vy * step; c.moved += step;
        e.direction = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
        if (Math.floor(c.moved / 90) !== Math.floor((c.moved - step) / 90)) playSheet(sc, 'fx_collapse_dust', e.x - vx * 30, e.y + 10, { size: 90, depth: DEPTH.ground + 4, ms: 420, alpha: .55 });
        if (!c.hit && Math.hypot(p.x - e.x, p.y - e.y) <= p.radius + e.radius + 10) {
          c.hit = true; this.stats.chargeHits++;
          if (p.takeDamage(E.damage, now)) sc.cameras.main.shake(160, .006);
          p.sprite.x += vx * E.knock; p.sprite.y += vy * E.knock;
        }
        this.h.hurtTroops(e.x, e.y, e.radius + 12, E.allyDamage * dt * 3);
        if (c.moved >= E.len) { c.state = 'recover'; c.at = now + E.recoverMs; e.sprite.clearTint(); }
      } else if (now >= c.at) { c.state = 'idle'; c.at = now + E.cdMs[0] + Math.random() * (E.cdMs[1] - E.cdMs[0]); }
    }
    for (const [id, c] of this.charges) if (!this.h.enemies().some(e => e.active && e.uid === id)) { this.charges.delete(id); void c; }
    // ---- 毒泉 ----
    const P = NANMAN.poison, inPool = this.inPool(p.x, p.y);
    p.envSpeedMul = inPool ? P.slow : 1;
    if (now >= this.poisonTickAt) {
      this.poisonTickAt = now + P.tickMs;
      if (inPool && p.alive) { p.takeDamage(P.dps * P.tickMs / 1000, now); this.stats.poisonTicks++; }
      for (const u of this.h.allies()) if (u.active && this.inPool(u.x, u.y)) this.h.hurtTroops(u.x, u.y, 8, P.allyDps * P.tickMs / 1000);
    }
    if (this.pools.length && now >= this.puffAt) {
      this.puffAt = now + P.puffMs;
      const pool = this.pools[Math.floor(Math.random() * this.pools.length)], a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * .8;
      playSheet(sc, 'fx_collapse_dust', pool.x + Math.cos(a) * pool.rx * r, pool.y + Math.sin(a) * pool.ry * r, { size: 110 + Math.random() * 60, depth: DEPTH.ground + 3, ms: 1200, alpha: .45, tint: 0x7fb048, onUpdate: (im, t) => im.setY(im.y - .25).setAlpha(.45 * (1 - t * .6)) });
    }
    const left = Math.ceil((this.fireUntil - now) / 1000);
    this.label?.setVisible(inPool || left > 0).setPosition(p.x, p.y - 110).setText(left > 0 ? `火攻 ${left}` + (inPool ? ' · 中毒' : '') : '瘴气中毒 · 移速变慢');
  }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; this.braziers = []; this.burning.clear(); this.charges.clear(); }
}
