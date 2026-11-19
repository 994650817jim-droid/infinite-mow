import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { warnFx } from '../ui/WarnFx';
import { playSheet } from './SkillFxSheets';
import { worldText } from '../world/WorldUI';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';
import type { EnemyKind } from '../types';

/**
 * 第七章「山道伏击」（数值在 MOUNTAIN_PASS，开发期初值，平衡之后再调）：
 * - 狭长山道：两侧是陡坡岩壁（碰撞框挡住），敌兵只从山道前后和两侧山坡来；
 * - 山坡伏兵：先在坡顶出伏兵旗影预警，随后冲下山坡；
 * - 滚石：先在山道上铺一条横向预警箭道，随后大石从一侧山坡滚到另一侧，碾过的人（敌我都算）都受伤（环境互动：可借滚石砸敌）；
 * - 落凤坡（crisis）：庞统随军（主将是庞统时就是主将本人），张任伏弩定时朝他射「落凤箭」（预警箭道），挡在箭道外就没事；庞统倒下即「落凤」。
 * 美术：场景物件图 shu_pass（4×2：左坡 / 右坡 / 松 / 竹 / 滚石 / 碎石 / 关门 / 石碑），缺图时用现有岩石道具过渡。
 */
export const MOUNTAIN_PASS = {
  halfWidth: [450, 390], // 山道半宽：葭萌关 / 落凤坡（11-19 用户「战斗场地有点限制太小了」：300 / 260 × 1.5，stageMaps shu.1 / shu.2 同步）
  yRange: [-4200, 2200] as const,
  ambush: { everyMs: 8500, firstMs: 9000, count: [2, 4], warnMs: 750 },
  boulder: { everyMs: 6500, firstMs: 6000, warnMs: 1300, speed: 620, radius: 46, damage: 22, enemyDamage: 260, allyDamage: 16, width: 96 },
  crisis: { pangtongHp: 260, volleyEveryMs: 7000, firstMs: 7000, warnMs: 1200, lanes: 2, laneLen: 640, laneWidth: 86, damage: 70, regen: 4, followDist: 64 },
} as const;
const ART = 'shu_pass';

export interface MountainPassHost {
  scene: Phaser.Scene; player: Player; allies: () => readonly Ally[]; enemies: () => readonly Enemy[]; now: () => number;
  footprints: Array<{ left: number; right: number; top: number; bottom: number }>;
  spawnEnemy: (kind: EnemyKind, x: number, y: number, force?: boolean) => Enemy | null;
  hitEnemy: (e: Enemy, dmg: number) => void;
  hurtTroops: (x: number, y: number, r: number, dmg: number) => void;
  banner: (t: string, danger?: boolean, caption?: string) => void;
  sfx: (k: string) => void;
  /** 落凤坡：庞统是否由主将本人担当 */
  crisis?: { playerIsPangtong: boolean; onFall: () => void };
}
interface Boulder { img: Phaser.GameObjects.Image; y: number; dir: 1 | -1; x: number; at: number; rolling: boolean; hit: Set<number>; hitPlayer: boolean; id: string; dustAt: number }
interface Lane { x: number; y: number; angle: number; at: number; id: string }

export class MountainPass {
  readonly stats = { ambushes: 0, boulders: 0, boulderKills: 0, boulderHits: 0, volleys: 0, pangtongHits: 0 };
  readonly halfW: number;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private ambushAt: number; private boulderAt: number; private pending: Array<{ x: number; y: number; at: number; kind: EnemyKind }> = [];
  private boulders: Boulder[] = []; private seq = 0;
  /** 落凤坡：随军庞统 */
  private pt?: { img: Phaser.GameObjects.Image; hp: number; x: number; y: number; dir: string; label: Phaser.GameObjects.Text; down: boolean; hurtAt: number };
  private lanes: Lane[] = []; private volleyAt = 0;

  constructor(private readonly h: MountainPassHost, private readonly stage: 1 | 2) {
    const P = MOUNTAIN_PASS, now = h.now();
    this.halfW = P.halfWidth[stage - 1];
    this.ambushAt = now + P.ambush.firstMs; this.boulderAt = now + P.boulder.firstMs; this.volleyAt = now + P.crisis.firstMs;
    const [y0, y1] = P.yRange, W = this.halfW;
    h.footprints.splice(0, h.footprints.length, { left: -W - 900, right: -W, top: y0, bottom: y1 }, { left: W, right: W + 900, top: y0, bottom: y1 });
    this.buildArt();
    if (h.crisis && !h.crisis.playerIsPangtong) this.spawnPangtong();
  }
  private has() { return this.h.scene.textures.exists(ART); }
  private img(x: number, y: number, key: string, frame: number | string, w: number, h = w, depth?: number) { const i = this.h.scene.add.image(x, y, key, frame).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(depth ?? actorDepth(y)); this.objects.push(i); return i; }
  private buildArt() {
    const [y0, y1] = MOUNTAIN_PASS.yRange, W = this.halfW, v2 = this.has();
    // 两侧山坡：v2 坡壁竖向重复；缺图用碎石堆 / 石堆过渡
    for (let y = y0 + 200; y < y1; y += 250) for (const side of [-1, 1] as const) {
      const jitter = ((y * 7) % 40) - 20;
      if (v2) this.img(side * (W + 150) + jitter, y + 40, ART, side < 0 ? 0 : 1, 360, 360, DEPTH.ground + 3 + (y - y0) / 1e5);
      else { this.img(side * (W + 60) + jitter, y + 30, 'yellow_props', 33, 120); this.img(side * (W + 170), y + 120, 'yellow_props', 32, 110); }
      // 坡边松竹点缀（不挡路）
      if (((y / 250) | 0) % 2 === 0) this.img(side * (W + 40) + jitter * .5, y - 60, v2 ? ART : 'yellow_props', v2 ? (side < 0 ? 2 : 3) : 33, v2 ? 140 : 70);
    }
    if (this.stage === 1) this.img(0, y0 + 420, v2 ? ART : 'sishui_props_refined', v2 ? 6 : 0, 360);
    if (this.stage === 2) this.img(-W + 70, -380, v2 ? ART : 'yellow_props', v2 ? 7 : 32, 110);
  }

  // ---------- 刷兵：只从山道前后来，伏兵另算 ----------
  spawnPoint(): { x: number; y: number } {
    const p = this.h.player, W = this.halfW - 40, front = Math.random() < .62;
    return { x: (Math.random() * 2 - 1) * W, y: p.y + (front ? -1 : 1) * (420 + Math.random() * 120) };
  }

  // ---------- 主循环 ----------
  update(dt: number) {
    const now = this.h.now(), P = MOUNTAIN_PASS, p = this.h.player, fx = warnFx(this.h.scene);
    // 山坡伏兵
    if (now >= this.ambushAt) {
      this.ambushAt = now + P.ambush.everyMs; this.stats.ambushes++;
      const n = P.ambush.count[0] + Math.floor(Math.random() * (P.ambush.count[1] - P.ambush.count[0] + 1));
      for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, x = side * (this.halfW - 20), y = p.y - 220 + Math.random() * 360; fx.ambush(x + side * 40, y, 70); this.pending.push({ x, y, at: now + P.ambush.warnMs, kind: i === 0 && this.stage === 2 ? 'archer' : 'infantry' }); }
      this.h.banner(this.stage === 2 ? '林中伏兵！' : '山上伏兵！', true);
    }
    for (const a of [...this.pending]) if (now >= a.at) {
      this.pending.splice(this.pending.indexOf(a), 1);
      const e = this.h.spawnEnemy(a.kind, a.x, a.y, true);
      if (e) { const tx = e.sprite.x, ty = e.sprite.y; e.sprite.x = tx + Math.sign(tx) * 90; e.sprite.y = ty - 70; this.h.scene.tweens.add({ targets: e.sprite, x: tx, y: ty, duration: 320, ease: 'Quad.In' }); playSheet(this.h.scene, 'fx_collapse_dust', tx, ty + 6, { size: 90, depth: DEPTH.fx, ms: 380, alpha: .7 }); }
    }
    // 滚石：预警箭道 → 从一侧滚到另一侧
    if (now >= this.boulderAt) {
      this.boulderAt = now + P.boulder.everyMs; this.stats.boulders++;
      const dir: 1 | -1 = Math.random() < .5 ? 1 : -1, y = p.y - 60 + Math.random() * 160, x = -dir * (this.halfW + 60);
      const im = this.img(x, y, this.has() ? ART : 'yellow_props', this.has() ? 4 : 33, P.boulder.radius * 2.3, P.boulder.radius * 2.3, actorDepth(y)).setOrigin(.5, .62).setAlpha(0);
      this.boulders.push({ img: im, y, dir, x, at: now + P.boulder.warnMs, rolling: false, hit: new Set(), hitPlayer: false, id: 'shu-boulder-' + (this.seq++), dustAt: 0 });
      this.h.sfx('propBreak');
    }
    for (const b of [...this.boulders]) {
      const len = this.halfW * 2 + 120;
      if (!b.rolling) {
        const prog = 1 - (b.at - now) / P.boulder.warnMs;
        fx.lane(b.id, 'charge', -b.dir * (this.halfW + 60), b.y, b.dir > 0 ? 0 : Math.PI, len, P.boulder.width, prog, now);
        b.img.setAlpha(Math.min(1, prog * 1.5));
        if (now >= b.at) { b.rolling = true; fx.shapeImpact(b.id, 'charge', -b.dir * (this.halfW + 60), b.y, len, b.dir > 0 ? 0 : Math.PI, now, P.boulder.width, { alpha: .5 }); }
        continue;
      }
      b.x += b.dir * P.boulder.speed * dt; b.img.setPosition(b.x, b.y).setRotation(b.img.rotation + b.dir * P.boulder.speed * dt / P.boulder.radius);
      if (now >= b.dustAt) { b.dustAt = now + 90; playSheet(this.h.scene, 'fx_collapse_dust', b.x - b.dir * 30, b.y + 10, { size: 80, depth: DEPTH.ground + 4, ms: 420, alpha: .55 }); }
      const R = P.boulder.radius;
      if (!b.hitPlayer && Math.abs(p.x - b.x) <= R + p.radius && Math.abs(p.y - b.y) <= R * .8 + p.radius) { b.hitPlayer = true; p.takeDamage(P.boulder.damage, now); this.h.scene.cameras.main.shake(140, .005); }
      for (const e of this.h.enemies()) {
        if (!e.active || e.isSupplySlot || b.hit.has(e.uid) || Math.abs(e.x - b.x) > R + e.radius || Math.abs(e.y - b.y) > R * .8 + e.radius) continue;
        b.hit.add(e.uid); this.stats.boulderHits++; const alive = e.hp; this.h.hitEnemy(e, e.kind === 'boss' ? P.boulder.enemyDamage * .3 : P.boulder.enemyDamage); if (alive > 0 && !e.active) this.stats.boulderKills++;
      }
      this.h.hurtTroops(b.x, b.y, R, P.boulder.allyDamage * dt * 4);
      if (this.pt && !this.pt.down && Math.abs(this.pt.x - b.x) <= R + 16 && Math.abs(this.pt.y - b.y) <= R) this.hurtPangtong(P.boulder.damage);
      if (Math.abs(b.x) > this.halfW + 140) {
        this.boulders.splice(this.boulders.indexOf(b), 1);
        if (this.has()) { b.img.setTexture(ART, 5).setRotation(0).setOrigin(.5, 1).setDisplaySize(130, 130).setPosition(b.dir * (this.halfW + 30), b.y + 30); this.h.scene.time.delayedCall(9000, () => b.img.active && b.img.destroy()); }
        else b.img.destroy();
      }
    }
    if (this.h.crisis) this.updateCrisis(dt, now);
  }

  // ---------- 落凤坡：随军庞统与落凤箭 ----------
  private spawnPangtong() {
    const p = this.h.player, key = this.h.scene.textures.exists('pangtong_walk_sheet') ? 'pangtong_walk_sheet' : 'hero_walk_sheet';
    const img = this.h.scene.add.image(p.x - 60, p.y + 40, key, 'down_0').setOrigin(.5, .9); img.setScale(p.sprite.scaleX || .5); this.objects.push(img);
    const label = worldText(this.h.scene, img.x, img.y - 90, '', 13, '#ffd2f0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(label);
    this.pt = { img, hp: MOUNTAIN_PASS.crisis.pangtongHp, x: img.x, y: img.y, dir: 'down', label, down: false, hurtAt: 0 };
  }
  /** 落凤箭的目标：随军庞统，或主将本人（主将是庞统时）。 */
  private get target(): { x: number; y: number } | null { if (this.h.crisis?.playerIsPangtong) return this.h.player; return this.pt && !this.pt.down ? this.pt : null; }
  get pangtong() { return this.pt ? { hp: Math.round(this.pt.hp), max: MOUNTAIN_PASS.crisis.pangtongHp, down: this.pt.down } : null; }
  get pangtongSaved() { return !!this.pt && !this.pt.down; }
  private hurtPangtong(d: number) {
    const pt = this.pt; if (!pt || pt.down) return;
    pt.hp -= d; pt.hurtAt = this.h.now(); this.stats.pangtongHits++; pt.img.setTintFill(0xffffff); this.h.scene.time.delayedCall(80, () => pt.img.active && pt.img.clearTint());
    if (pt.hp <= 0) { pt.down = true; pt.hp = 0; pt.img.setTint(0x6a5050).setAlpha(.65).setAngle(80); pt.label.setText('庞统 · 中箭'); this.h.banner('凤雏中箭！', true, '庞统落马……'); this.h.crisis?.onFall(); }
  }
  private updateCrisis(dt: number, now: number) {
    const C = MOUNTAIN_PASS.crisis, p = this.h.player, pt = this.pt, fx = warnFx(this.h.scene);
    if (pt && !pt.down) {
      // 跟在主将侧后方
      const tx = p.x - 46, ty = p.y + 44, dx = tx - pt.x, dy = ty - pt.y, d = Math.hypot(dx, dy), sp = Math.min(d, (d > C.followDist ? 260 : 120) * dt);
      if (d > 2) { pt.x += dx / d * sp; pt.y += dy / d * sp; pt.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'; }
      const frame = d > 6 ? Math.floor(now / 150) % 4 : 0;
      pt.img.setPosition(pt.x, pt.y).setFrame(`${pt.dir}_${frame}`).setDepth(actorDepth(pt.y));
      if (now - pt.hurtAt > 3000) pt.hp = Math.min(C.pangtongHp, pt.hp + C.regen * dt);
      pt.label.setPosition(pt.x, pt.y - 92).setText(`庞统 ${Math.ceil(pt.hp)}/${C.pangtongHp}`);
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - pt.x, e.y - pt.y) < e.radius + 18 && e.contactCd <= 0) { e.contactCd = .9; this.hurtPangtong(e.def.damage * .6); }
    }
    const tg = this.target;
    if (tg && now >= this.volleyAt) {
      this.volleyAt = now + C.volleyEveryMs; this.stats.volleys++;
      for (let i = 0; i < C.lanes; i++) {
        const side = i % 2 ? 1 : -1, sx = side * (this.halfW + 40), sy = tg.y + (i ? 120 : -120), ang = Math.atan2(tg.y - sy, tg.x - sx);
        this.lanes.push({ x: sx, y: sy, angle: ang, at: now + C.warnMs + i * 160, id: 'shu-fall-' + (this.seq++) });
      }
      this.h.banner(this.h.crisis?.playerIsPangtong ? '张任伏弩瞄准了你！' : '张任伏弩瞄准庞统！', true, '带他离开红色箭道');
    }
    for (const l of [...this.lanes]) {
      if (now < l.at) { fx.lane(l.id, 'charge', l.x, l.y, l.angle, C.laneLen, C.laneWidth, 1 - (l.at - now) / C.warnMs, now); continue; }
      fx.shapeImpact(l.id, 'charge', l.x, l.y, C.laneLen, l.angle, now, C.laneWidth);
      const inLane = (x: number, y: number, r: number) => { const dx = x - l.x, dy = y - l.y, c = Math.cos(l.angle), s = Math.sin(l.angle), along = dx * c + dy * s, side = -dx * s + dy * c; return along >= -r && along <= C.laneLen + r && Math.abs(side) <= C.laneWidth / 2 + r; };
      if (this.h.crisis?.playerIsPangtong) { if (inLane(p.x, p.y, p.radius)) p.takeDamage(C.damage * .4, now); }
      else if (pt && !pt.down && inLane(pt.x, pt.y, 14)) this.hurtPangtong(C.damage);
      this.lanes.splice(this.lanes.indexOf(l), 1);
    }
  }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; for (const b of this.boulders) b.img.destroy(); this.boulders = []; warnFx(this.h.scene).clear(); }
}
