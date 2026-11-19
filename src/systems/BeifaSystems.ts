import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyKind } from '../types';
import { DEPTH, FONT, actorDepth } from '../config';
import { CHENCANG, WATER } from '../data/beifaChapter';
import { warnFx } from '../ui/WarnFx';
import { MID_SIEGE_FILES } from './SiegeMidArt';
import { sealCityWall } from './ChapterDressing';
import { playSheet } from './SkillFxSheets';

/** 地面落点打击（箭雨 / 落雷 / 陨星）：先手绘预警圈，到点播手绘命中序列帧并结算伤害。第十二章各处共用。 */
export type StrikeKind = 'arrows' | 'lightning' | 'meteor';
interface Strike { id: string; kind: StrikeKind; x: number; y: number; r: number; at: number; warnMs: number; ratio: number; ally: number }
export interface StrikeHost { scene: Phaser.Scene; player: Player; army: Legion; now: () => number }
export class Strikes {
  private list: Strike[] = []; private seq = 0;
  readonly metrics = { fired: 0, playerHits: 0 };
  constructor(private h: StrikeHost) {}
  add(kind: StrikeKind, x: number, y: number, r: number, warnMs: number, ratio: number, ally: number): void { this.list.push({ id: `beifa-strike-${++this.seq}`, kind, x, y, r, at: this.h.now() + warnMs, warnMs, ratio, ally }); }
  get pending(): number { return this.list.length; }
  update(): void {
    const now = this.h.now(), wf = warnFx(this.h.scene), p = this.h.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i], prog = 1 - (s.at - now) / s.warnMs;
      if (s.kind === 'lightning') wf.warn(s.id, 'lightning', s.x, s.y, s.r, prog, now);
      else wf.circle(s.id, s.kind === 'arrows' ? 'arrows' : 'slam', s.x, s.y, s.r, prog, now);
      if (now < s.at) continue;
      this.list.splice(i, 1); this.metrics.fired++;
      if (s.kind === 'lightning') wf.impact('lightning', s.x, s.y, s.r);
      else if (s.kind === 'arrows') wf.shapeImpact(s.id, 'arrows', s.x, s.y, s.r * 2, 0, now);
      else { playSheet(this.h.scene, 'fx_explosion', s.x, s.y + 6, { size: s.r * 2.6, ms: 620, depth: actorDepth(s.y) + .6, originY: .84, name: 'beifa-meteor-hit' }); this.h.scene.cameras.main.shake(160, .006); }
      if (p.alive && Math.hypot(p.x - s.x, p.y - s.y) <= s.r + p.radius * .5) { p.takeDamage(Math.max(3, p.maxHp * s.ratio), now); this.metrics.playerHits++; }
      this.h.army.hurtArea(s.x, s.y, s.r, s.ally, now);
    }
  }
  clear(): void { this.list = []; }
}

// ---------------- 街亭：汲水点 ----------------
interface Spring { x: number; y: number; owner: 'none' | 'player'; take: number; img: Phaser.GameObjects.Image | null; label: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics }
export interface WaterHost { scene: Phaser.Scene; player: Player; spawn: (k: EnemyKind, x: number, y: number) => Enemy | null; banner: (t: string, c?: string) => void; sfx: (k: string) => void }
/**
 * 街亭「守住水源」：场上两处汲水点（营地水缸道具），主将站上去读条占住。一处都没占着且过了开场宽限 → 断水，主将持续掉血。
 * 张郃定时派兵夺一处汲水点（夺回成无主，要再去占）。
 */
export class BeifaWater {
  readonly springs: Spring[] = [];
  /** 汲水点旁的石井 / 水槽布景。 */ private extras: Phaser.GameObjects.Image[] = [];
  private cutAt: number; private graceUntil: number; private drainAt = 0; private dry = false;
  readonly metrics = { captured: 0, cut: 0, drainTicks: 0 };
  constructor(private h: WaterHost, now: number) {
    const p = h.player, s = h.scene;
    // 场景审查 P3：第一处汲水点原来在 (-360, 160)，正压在左下敌营的营帐底下 → 挪到营地外的空地
    for (const [dx, dy] of [[-600, 420], [380, -170]].slice(0, WATER.count)) {
      const x = p.x + dx, y = p.y + dy;
      // 场景审查 P3：汲水点原来只有标签、用的是辎重车图 → 美术风格会话的水景图（scene-v2/waterpoints.png 2×2：泉眼 / 水潭 / 石井 / 木水槽）：
      // 第一处泉眼 + 旁边石井，第二处水潭 + 旁边木水槽；泉 / 潭平铺在地面层（站上去取水），井 / 水槽是旁边的布景
      const WP = { key: 'scene_v2_waterpoints', file: 'assets/scene-v2/waterpoints.png', cell: 512 }, k = this.springs.length, img = s.add.image(x, y, 'yellow_props', 24).setOrigin(.5, .85).setDisplaySize(84, 84).setDepth(actorDepth(y)).setName('beifa-spring');
      const dress = (): void => { if (!img.active) return; img.setTexture(WP.key, k === 0 ? 0 : 1).setOrigin(.5, .55).setDisplaySize(k === 0 ? 200 : 230, k === 0 ? 200 : 230).setDepth(DEPTH.ground + 3); const side = s.add.image(x + (k === 0 ? 135 : -150), y - 40, WP.key, k === 0 ? 2 : 3).setOrigin(.5, .85).setDisplaySize(150, 150).setDepth(actorDepth(y - 40)).setName('beifa-spring-prop'); this.extras.push(side); };
      if (s.textures.exists(WP.key)) dress(); else { s.load.spritesheet(WP.key, WP.file, { frameWidth: WP.cell, frameHeight: WP.cell }); s.load.once('filecomplete-spritesheet-' + WP.key, dress); if (!s.load.isLoading()) s.load.start(); }
      const label = s.add.text(x, y - 74, '汲水点', { fontFamily: FONT, fontSize: '14px', color: '#cfe6ff', stroke: '#0d1622', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.fx);
      this.springs.push({ x, y, owner: 'none', take: 0, img, label, bar: s.add.graphics().setDepth(DEPTH.fx) });
    }
    this.cutAt = now + WATER.cutEverySec * 1000; this.graceUntil = now + WATER.graceSec * 1000;
    h.banner('守住水源', '站上汲水点占住 · 一处都没有就会断水掉血');
  }
  get held(): number { return this.springs.filter(s => s.owner === 'player').length; }
  get isDry(): boolean { return this.dry; }
  update(dt: number, now: number): void {
    const p = this.h.player;
    for (const s of this.springs) {
      const on = Math.hypot(p.x - s.x, (p.y - s.y) / .6) <= WATER.radius;
      if (s.owner !== 'player') {
        s.take = on ? Math.min(1, s.take + dt / WATER.captureSec) : Math.max(0, s.take - dt / (WATER.captureSec * 2));
        if (s.take >= 1) { s.owner = 'player'; this.metrics.captured++; this.h.banner('占住汲水点', '水源无虞'); this.h.sfx('gong'); }
      }
      s.label.setText(s.owner === 'player' ? '我军汲水点' : '汲水点').setColor(s.owner === 'player' ? '#ffe7a8' : '#cfe6ff');
      s.img?.setTint(s.owner === 'player' ? 0xffffff : 0xb8c4d4);
      s.bar.clear(); if (s.owner !== 'player' && s.take > 0) s.bar.fillStyle(0x0d1622, .85).fillRect(s.x - 46, s.y - 96, 92, 8).fillStyle(0x8cc8ff, 1).fillRect(s.x - 45, s.y - 95, 90 * s.take, 6);
    }
    // 张郃断汲道：派一队兵扑向一处汲水点，那处变回无主
    if (now >= this.cutAt) {
      this.cutAt = now + WATER.cutEverySec * 1000;
      const owned = this.springs.filter(s => s.owner === 'player'), t = owned[Math.floor(Math.random() * owned.length)] ?? this.springs[0];
      t.owner = 'none'; t.take = 0; this.metrics.cut++;
      for (let i = 0; i < WATER.cutSize; i++) { const a = i / WATER.cutSize * Math.PI * 2; this.h.spawn(i % 3 ? 'infantry' : 'archer', t.x + Math.cos(a) * 160, t.y + Math.sin(a) * 110); }
      this.h.banner('张郃断汲道', '魏军夺了一处汲水点 · 再抢回来');
    }
    const dry = now >= this.graceUntil && this.held === 0;
    if (dry !== this.dry) { this.dry = dry; if (dry) this.h.banner('断水', '没有汲水点 · 主将持续掉血'); }
    if (dry && p.alive && now >= this.drainAt) { this.drainAt = now + 1000; p.takeDamage(Math.max(1, p.maxHp * WATER.drainRatio), now); this.metrics.drainTicks++; }
  }
  snapshot() { return { held: this.held, dry: this.dry, owners: this.springs.map(s => s.owner), metrics: { ...this.metrics } }; }
  clear(): void { for (const s of this.springs) { s.img?.destroy(); s.label.destroy(); s.bar.destroy(); } this.springs.length = 0; for (const e of this.extras) e.destroy(); this.extras = []; }
}

// ---------------- 陈仓：城门与箭楼 ----------------
export interface SiegeHost { scene: Phaser.Scene; player: Player; strikes: Strikes; spawnGate: (x: number, y: number, hp: number) => Enemy | null; spawnTower: (x: number, y: number, hp: number) => Enemy | null; banner: (t: string, c?: string) => void; sfx: (k: string) => void;
  /** 场景碰撞框（城墙段推进去；全场景审查 P2：陈仓原来只有孤城门，没有城墙）。 */ footprints?: Array<{ left: number; right: number; top: number; bottom: number }>;
  /** 首领到点后离攻城失利还剩几秒（基础场景：首领时间 + 60 秒没出首领判负）；没到点为 null。 */ timeLeft?: () => number | null }
/** 陈仓攻城（复用攻城样板的城门 / 箭楼物件）：城门在前方，两侧城头箭楼；箭楼每隔几秒朝主将放一轮箭雨（手绘预警圈）。城门未破郝昭不出城。 */
export class ChencangSiege {
  gate: Enemy | null; towers: Enemy[] = []; private gy = 0;
  private gateLife = 0; private volleyAt: number[] = []; private label: Phaser.GameObjects.Text;
  readonly metrics = { volleys: 0 };
  constructor(private h: SiegeHost, now: number) {
    const p = h.player, gx = p.x, gy = p.y + CHENCANG.gateY; this.gy = gy;
    this.gate = h.spawnGate(gx, gy, CHENCANG.gateHp); this.gateLife = this.gate?.spawnId ?? 0;
    for (let i = 0; i < CHENCANG.towers; i++) { const side = i % 2 ? 1 : -1, t = h.spawnTower(gx + side * CHENCANG.towerGap, gy - 10, CHENCANG.towerHp); if (t) { this.towers.push(t); this.volleyAt.push(now + 2500 + i * 1500); } }
    this.label = h.scene.add.text(gx, gy - 230, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe1a0', stroke: '#1a120b', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.fx).setName('chencang-gate-label');
    h.banner('陈仓', '先破城门 · 城头箭楼会放箭雨，拆掉箭楼箭雨就停');
    this.buildWalls(gx, gy);
  }
  /**
   * 陈仓城墙（攻城 v2 城墙图集帧 0，同 2-1 汜水关）：城门两侧一直铺到 ±wallHalf，碰撞框贴着城门（城门本身是可打的物件，破了才通）。
   * 城头两座箭楼压在城墙线上。
   */
  private walls: Phaser.GameObjects.Image[] = [];
  private buildWalls(gx: number, gy: number): void {
    const C = CHENCANG, s = this.h.scene, K = MID_SIEGE_FILES[0];
    this.h.footprints?.push({ left: gx - C.wallHalf, right: gx - C.gateHalf, top: gy - 70, bottom: gy - 10 }, { left: gx + C.gateHalf, right: gx + C.wallHalf, top: gy - 70, bottom: gy - 10 });
    const draw = (): void => { if (!this.label.active) return; for (const side of [-1, 1]) for (let x = side * (140 + C.segW / 2 - 12); Math.abs(x) <= C.wallHalf; x += side * C.segW) { /* W6：从城门两侧往外铺，两边都紧贴城门（原来从左端起铺，左侧离城门差约 190） */ this.walls.push(s.add.image(gx + x, gy, K.key, 0).setOrigin(.5, .97).setDisplaySize(C.segW + 8, C.segW + 8).setDepth(actorDepth(gy) - .01).setName('chencang-wall')); } };
    if (s.textures.exists(K.key)) { draw(); this.stone(); } else { s.load.spritesheet(K.key, K.file, { frameWidth: K.cell, frameHeight: K.cell }); s.load.once('filecomplete-spritesheet-' + K.key, () => { draw(); this.stone(); }); if (!s.load.isLoading()) s.load.start(); }
    // 城墙专项检查 W6：城墙两端原来平切口、能绕过去 → 两端角楼、往南转成侧墙，南边界是我方（蜀军）营栅，整块场地封闭；城门没破之前过不去
    if (this.h.footprints) sealCityWall(s, { cx: gx, wy: gy, half: C.wallHalf, south: this.h.player.y + 1500, boxes: this.h.footprints, south_: 'palisade', palisade: 'props_v2_shu', tag: 'chencang' });
  }
  /** W6：城门两侧原来是营具图的木桩 + 木箭楼（夹在石城墙中间画风不搭）→ 城墙图集的城门（帧 1）、石箭楼（帧 3）。 */
  private stone(): void {
    const K = MID_SIEGE_FILES[0].key; if (!this.label.active || !this.h.scene.textures.exists(K)) return;
    if (this.gateAlive) this.gate!.sprite.setTexture(K, 1).setOrigin(.5, .97).setDisplaySize(290, 290);
    for (const t of this.towers) if (t.active) t.sprite.setTexture(K, 3).setOrigin(.5, 1).setDisplaySize(170, 170);
  }
  /** 城墙线（刷兵：城门没破前不刷到墙北面）。 */
  get wallY(): number { return this.gy; }
  get gateAlive(): boolean { return !!this.gate && this.gate.active && this.gate.spawnId === this.gateLife; }
  get towersAlive(): number { return this.towers.filter(t => t.active).length; }
  update(now: number): void {
    const p = this.h.player;
    if (this.gateAlive) { const left = this.h.timeLeft?.(); this.label.setText(`陈仓城门 ${Math.ceil(this.gate!.hp)}/${this.gate!.maxHp}` + (left != null ? ` · ${Math.ceil(left)} 秒内破门` : '')); } else this.label.setVisible(false);
    this.towers.forEach((t, i) => {
      if (!t.active || now < this.volleyAt[i]) return;
      this.volleyAt[i] = now + CHENCANG.volleyEverySec * 1000; this.metrics.volleys++;
      for (let k = 0; k < CHENCANG.volleyPoints; k++) { const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 60 + Math.random() * 90; this.h.strikes.add('arrows', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, CHENCANG.volleyR, CHENCANG.warnMs, CHENCANG.playerRatio, CHENCANG.allyDamage); }
      this.h.sfx('chargeWarn');
    });
  }
  snapshot() { return { gate: this.gateAlive, gateHp: this.gate?.hp ?? 0, towers: this.towersAlive, metrics: { ...this.metrics } }; }
  clear(): void { this.label.destroy(); for (const w of this.walls) w.destroy(); this.walls = []; }
}
