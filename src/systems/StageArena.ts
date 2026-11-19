import Phaser from 'phaser';
import { drawSidePalisade, sideWallReady, whenSideWallReady } from './SideWall';
import { actorDepth, DEPTH } from '../config';
import { ARENA, type StageMapDef, type Pt } from '../data/stageMaps';
import { FACTION_PROPS } from './PropsV2';
import { MID_SIEGE_FILES } from './SiegeMidArt';
import { playSheet } from './SkillFxSheets';
import { warnFx } from '../ui/WarnFx';
import { worldText } from '../world/WorldUI';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';

/**
 * 有边场地（data/stageMaps.ts；设计见共享笔记 stage-maps-design.md）。
 *  - 边：山崖 / 密林 / 大河由地形层画（terrainConfigFor 合进去）；营栅、城墙由这里摆（势力营具营栅、攻城城墙图集，营门 / 关门处立门）。
 *  - 守边：每帧把主将、随行、敌兵挪回场内（首领、补给箱 / 目标物除外——首领由各自控制器推，双首领退走、招降不受影响）。
 *  - 刷兵：落在场外的刷兵点改到离主将最远的关口（离主将 ≥ ARENA.minSpawnDist），场内的不动。
 *  - 镜头：停在边界 + 边带以内。小地图读 bounds / edges / gates（只读）。
 *  - 场景互动：断桥（长坂）、营帐起火蔓延（宛城）、关上滚木（阳平关）。
 */
export interface ArenaHost {
  scene: Phaser.Scene; player: Player; allies: () => readonly Ally[]; enemies: () => Iterable<Enemy>; now: () => number;
  /** 可砍目标（补给槽的「门」）：贴图不显示，由场景图表现。 */
  spawnTarget: (x: number, y: number, hp: number, size: number) => Enemy | null;
  hitEnemy: (e: Enemy, dmg: number, source?: 'melee' | 'arrow' | 'fire') => void;
  /** 断掉离 (x, y) 最近的地形层桥（Terrain.setBridgeBroken），返回是否断了。 */
  breakBridgeNear?: (x: number, y: number) => boolean;
  spawnEnemy?: (kind: 'infantry' | 'shield' | 'archer' | 'cavalry', x: number, y: number) => Enemy | null;
  hurtTroops: (x: number, y: number, r: number, dmg: number) => void;
  banner: (t: string, danger?: boolean, caption?: string) => void;
  sfx: (k: string) => void;
  /** 收掉场外的补给箱 / 道具 */
  purge?: (pred: (x: number, y: number) => boolean) => void;
}
interface Gate extends Pt { off?: boolean }
interface Tent { x: number; y: number; img?: Phaser.GameObjects.Image; fires: Phaser.GameObjects.Sprite[]; state: 'idle' | 'burning' | 'burnt'; litAt: number; tickAt: number }
interface Log { x: number; y: number; toY: number; /** 横滚方向（滚石） */ dir: 1 | -1; at: number; rolling: boolean; img?: Phaser.GameObjects.Image; hit: Set<number>; hitPlayer: boolean; id: string }

export class StageArena {
  readonly bounds: StageMapDef['bounds'];
  readonly gates: Gate[];
  /** 本关边带厚度 */ private band: number = ARENA.edgeBand; private startedAt = 0;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private bridge: { e: Enemy; life: number; x: number; y: number; label: Phaser.GameObjects.Text; killR: number } | null = null;
  private carts: Array<{ e: Enemy; life: number; x: number; y: number; img?: Phaser.GameObjects.Image; litAt: number; burnAt: number; fires: Phaser.GameObjects.Sprite[]; tickAt: number; done: boolean }> = [];
  private bushes: Array<{ x: number; y: number; sprung: boolean; imgs: Phaser.GameObjects.Image[] }> = []; private bushPending: Array<{ x: number; y: number; at: number }> = [];
  private roofAt = 0; private roofPending: Array<{ x: number; y: number; at: number; kind: 'infantry' | 'shield' }> = [];
  private tents: Tent[] = []; private logs: Log[] = []; private logAt = 0; private logSeq = 0;
  /** 测试读 */
  readonly stats = { tentPushes: 0, ringScale: 1, ringClosing: false, ringHits: 0, ringPlayerHits: 0, bushAmbushers: 0, cartsLit: 0, fireBands: 0, fireHits: 0, bushesSprung: 0, roofDrops: 0, relocated: 0, clamped: 0, bridgeDown: false, bridgeDeck: false, tentsLit: 0, tentsBurnt: 0, fireTicks: 0, logs: 0, logHits: 0, logEnemyHits: 0 };

  constructor(private readonly h: ArenaHost, readonly def: StageMapDef) {
    const b = this.bounds = { ...def.bounds }, /* 拷一份：火墙收圈会改它 */ P = def.band ?? ARENA.edgeBand, sc = h.scene; this.band = P;
    this.gates = def.gates.map(g => ({ ...g }));
    sc.cameras.main.setBounds(b.left - P, b.top - P, b.right - b.left + P * 2, b.bottom - b.top + P * 2);
    h.purge?.((x, y) => !this.inside(x, y, 30));
    this.buildEdges();
    if (def.backdropWallY !== undefined) this.backdrop(def.backdropWallY);
    // 守边放在 postupdate：本帧所有系统（冲锋、击退、首领控制器带的兵…）都动完之后再挪回场内
    sc.events.on('postupdate', this.post, this);
    const now = h.now(); this.startedAt = now;
    if (def.interactions?.some(i => i.kind === 'logs' && i.axis === 'x') && !sc.textures.exists('shu_pass')) { sc.load.spritesheet('shu_pass', 'assets/shu/pass.png', { frameWidth: 384, frameHeight: 384 }); if (!sc.load.isLoading()) sc.load.start(); } // 滚石图（蜀道滚石）
    for (const it of def.interactions ?? []) {
      if (it.kind === 'bridge') this.setupBridge(it);
      if (it.kind === 'campfire') this.setupTents(it, now);
      if (it.kind === 'logs') this.logAt = now + it.firstMs;
      if (it.kind === 'firecarts') this.setupCarts(it);
      if (it.kind === 'bushes') this.setupBushes(it);
      if (it.kind === 'roofs') this.roofAt = now + it.firstMs;
    }
  }
  inside(x: number, y: number, m = 0) { const b = this.bounds; return x >= b.left + m && x <= b.right - m && y >= b.top + m && y <= b.bottom - m; }

  // ———— 边（营栅 / 城墙）————
  private buildEdges() {
    const d = this.def, b = this.bounds, sc = this.h.scene, G = ARENA.gateWidth;
    const fac = d.faction !== undefined ? FACTION_PROPS[d.faction] : undefined, propKey = fac && sc.textures.exists(fac.key) ? fac.key : sc.textures.exists('sishui_props_refined') ? 'sishui_props_refined' : null;
    const img = (x: number, y: number, key: string, frame: number, size: number, flip = false) => { const im = sc.add.image(x, y, key, frame).setOrigin(.5, 1).setDisplaySize(size, size).setDepth(actorDepth(y)).setFlipX(flip).setName('arena-edge'); this.objs.push(im); return im; };
    const isHole = (dir: 'n' | 's' | 'w' | 'e', at: number) => (d.openings?.[dir] ?? []).some(h => Math.abs(at - h) < G / 2);
    const palisade = (dir: 'n' | 's' | 'w' | 'e') => {
      if (!propKey) return; const horiz = dir === 'n' || dir === 's';
      if (horiz) {
        const y = dir === 'n' ? b.top - 10 : b.bottom + 140; // 营栅整排在场外：北边墙脚贴边线，南边墙顶贴边线（主将不会「站在栅上」）
        for (let x = b.left - 60, k = 0; x <= b.right + 60; x += 150, k++) if (!isHole(dir, x)) img(x, y, propKey, k % 7 === 3 ? 6 : k % 11 === 6 ? 1 : 3, k % 7 === 3 ? 170 : k % 11 === 6 ? 220 : 190, k % 2 === 1);
        for (const h of d.openings?.[dir] ?? []) img(h, y + 6, propKey, 0, 250);
      } else {
        const x = dir === 'w' ? b.left - 100 : b.right + 100;
        const oldRow = () => { for (let y = b.top + 20, k = 0; y <= b.bottom + 70; y += 72, k++) if (!isHole(dir, y)) img(x + (k % 2 ? 8 : -8), y, propKey, 3, 180, dir === 'e'); };
        // 新营栅（SideWall.ts 侧墙套件的竖排木桩）：开口两侧各一段；缺图退回原来的单桩排
        whenSideWallReady(sc, () => {
          if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; if (!sideWallReady(sc)) { oldRow(); return; }
          const holes = (d.openings?.[dir] ?? []).slice().sort((p, q) => p - q); let y0 = b.top - 30;
          for (const h of [...holes, Infinity]) { const y1 = Math.min(b.bottom + 100, h - G / 2); if (y1 > y0 + 20) this.objs.push(...drawSidePalisade(sc, { x, y0, y1, flip: dir === 'e', name: 'arena-edge' })); y0 = h + G / 2; }
        });
        for (const h of d.openings?.[dir] ?? []) img(x + (dir === 'w' ? 30 : -30), h + 70, propKey, 0, 230);
      }
    };
    const wall = (dir: 'n' | 's') => {
      const W = MID_SIEGE_FILES[0], draw = () => {
        if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
        const y = dir === 'n' ? b.top - 4 : b.bottom + 120, has = sc.textures.exists(W.key);
        for (let x = b.left - 120; x <= b.right + 120; x += 196) if (!isHole(dir, x)) { if (has) img(x, y, W.key, 0, 230).setDisplaySize(230, 127); }
        for (const hx of d.openings?.[dir] ?? []) if (has) img(hx, y + 14, W.key, 1, 300);
        for (const x of [b.left - 40, b.right + 40]) if (has) img(x, y + 20, W.key, 5, 220);
      };
      if (sc.textures.exists(W.key)) draw(); else { sc.load.spritesheet(W.key, W.file, { frameWidth: W.cell, frameHeight: W.cell }); sc.load.once('filecomplete-spritesheet-' + W.key, draw); if (!sc.load.isLoading()) sc.load.start(); }
    };
    for (const dir of ['n', 's', 'w', 'e'] as const) {
      const k = d.edges[dir];
      if (k === 'palisade') palisade(dir);
      if (k === 'wall' && (dir === 'n' || dir === 's')) wall(dir);
      if (k === 'houses') this.houses(dir, isHole);
      if (k === 'fire' && !this.ringFires.length) this.buildFireEdges();
    }
  }

  /** 边外远景城墙（4-1 白马）：攻城城墙图集一排，中间城门、两端墩台。 */
  private backdrop(y: number) {
    const sc = this.h.scene, b = this.bounds, W = MID_SIEGE_FILES[0], draw = () => {
      if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN || !sc.textures.exists(W.key)) return;
      const put = (x: number, f: number, w: number, h = w) => { const im = sc.add.image(x, y, W.key, f).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(actorDepth(y)).setName('arena-backdrop'); this.objs.push(im); };
      for (let x = b.left - 300; x <= b.right + 300; x += 196) if (Math.abs(x) > 170) put(x, 0, 230, 127);
      put(0, 1, 300); for (const x of [-560, 560]) put(x, 3, 150);
    };
    if (sc.textures.exists(W.key)) draw(); else { sc.load.spritesheet(W.key, W.file, { frameWidth: W.cell, frameHeight: W.cell }); sc.load.once('filecomplete-spritesheet-' + W.key, draw); if (!sc.load.isLoading()) sc.load.start(); }
  }
  /** 街坊边（3-1 长安）：攻城街巷图集民房一排（场外），几成着火（地火序列帧，压暗）。 */
  private houses(dir: 'n' | 's' | 'w' | 'e', isHole: (d: 'n' | 's' | 'w' | 'e', at: number) => boolean) {
    const sc = this.h.scene, b = this.bounds, S = MID_SIEGE_FILES[3], burn = this.def.housesBurning ?? 0, draw = () => {
      if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN || !sc.textures.exists(S.key)) return;
      const put = (x: number, y: number, k: number) => {
        const f = [0, 1, 2, 0, 1][k % 5], im = sc.add.image(x, y, S.key, f).setOrigin(.5, 1).setDisplaySize(230, 230).setDepth(actorDepth(y)).setFlipX(k % 2 === 1).setName('arena-house'); this.objs.push(im);
        if ((k * 37 % 10) / 10 < burn) { im.setTint(0x6a5246); this.flame(x - 30, y - 120, 130, y); this.flame(x + 40, y - 70, 100, y); }
      };
      if (dir === 'w' || dir === 'e') { const x = dir === 'w' ? b.left - 120 : b.right + 120; for (let y = b.top + 180, k = dir === 'w' ? 0 : 3; y <= b.bottom + 240; y += 200, k++) if (!isHole(dir, y)) put(x, y, k); }
      else { const y = dir === 'n' ? b.top - 10 : b.bottom + 230; for (let x = b.left - 120, k = 1; x <= b.right + 120; x += 220, k++) if (!isHole(dir, x)) put(x, y, k); }
    };
    if (sc.textures.exists(S.key)) draw(); else { sc.load.spritesheet(S.key, S.file, { frameWidth: S.cell, frameHeight: S.cell }); sc.load.once('filecomplete-spritesheet-' + S.key, draw); if (!sc.load.isLoading()) sc.load.start(); }
  }
  /** 一团地火（手绘地火序列帧），深度跟着所在物件的脚底。 */
  private flame(x: number, y: number, size: number, baseY: number): Phaser.GameObjects.Sprite | null {
    const sc = this.h.scene; if (!sc.textures.exists('ground_fire')) return null;
    const sp = sc.add.sprite(x, y, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(size, size).setDepth(actorDepth(baseY) + .02).setName('arena-fire'); this.objs.push(sp);
    const st = { f: Math.random() * 7 }; sc.tweens.add({ targets: st, f: st.f + 8, duration: 1000 + Math.random() * 300, repeat: -1, onUpdate: () => { if (sp.active) sp.setFrame(Math.floor(st.f) % 8); } });
    return sp;
  }

  // ———— 守边 / 刷兵 ————
  /** 夹回场内（留 30 边距）。 */
  clampPoint(x: number, y: number): Pt { const b = this.bounds; return { x: Phaser.Math.Clamp(x, b.left + 30, b.right - 30), y: Phaser.Math.Clamp(y, b.top + 30, b.bottom - 30) }; }
  /** 每帧：主将、随行、敌兵挪回场内（首领、补给槽除外）。 */
  keepInside() {
    const b = this.bounds, m = 22;
    const clamp = (o: { x: number; y: number }, set: (x: number, y: number) => void) => {
      const x = Phaser.Math.Clamp(o.x, b.left + m, b.right - m), y = Phaser.Math.Clamp(o.y, b.top + m, b.bottom - m);
      if (x !== o.x || y !== o.y) { set(x, y); this.stats.clamped++; }
    };
    const p = this.h.player; clamp(p, (x, y) => p.sprite.setPosition(x, y));
    for (const a of this.h.allies()) if (a.active) clamp(a, (x, y) => a.setPosition(x, y));
    for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss') clamp(e, (x, y) => e.sprite.setPosition(x, y));
    // 营帐是实物（11-19 用户「穿模」：人从营帐里穿过去）：帐底椭圆挡人，主将 / 友军 / 敌兵都推到帐外。地上的土路只是地面，可以走
    if (this.tents.length) {
      const T = ARENA.tentFoot, push = (o: { x: number; y: number }, r: number, set: (x: number, y: number) => void) => {
        for (const t of this.tents) { const cx = t.x, cy = t.y - T.up, dx = (o.x - cx) / (T.rx + r), dy = (o.y - cy) / (T.ry + r), d = Math.hypot(dx, dy); if (d >= 1) continue; const k = d > .01 ? 1 / d : 1, ux = d > .01 ? dx : 0, uy = d > .01 ? dy : 1; set(cx + ux * k * (T.rx + r), cy + uy * k * (T.ry + r)); this.stats.tentPushes++; }
      };
      push(p, 12, (x, y) => p.sprite.setPosition(x, y));
      for (const a of this.h.allies()) if (a.active) push(a, 10, (x, y) => a.setPosition(x, y));
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss') push(e, e.radius * .6, (x, y) => e.sprite.setPosition(x, y));
    }
  }
  /** 刷兵点在场外：改到离主将最远的那个关口附近（沿边错开一点）。场内的刷兵点不动。 */
  spawnAt(x: number, y: number): Pt {
    if (this.inside(x, y, 10)) return { x, y };
    const p = this.h.player, live = this.gates.filter(g => !g.off), far = live.filter(g => Math.hypot(g.x - p.x, g.y - p.y) >= ARENA.minSpawnDist);
    const pick = far.length ? far.sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0] : live.sort((a, c) => Math.hypot(c.x - p.x, c.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0];
    this.stats.relocated++;
    if (!pick) return { x: Phaser.Math.Clamp(x, this.bounds.left + 40, this.bounds.right - 40), y: Phaser.Math.Clamp(y, this.bounds.top + 40, this.bounds.bottom - 40) };
    const j = ARENA.gateJitter, b = this.bounds;
    const q = { x: Phaser.Math.Clamp(pick.x + (Math.random() - .5) * 2 * j, b.left + 30, b.right - 30), y: Phaser.Math.Clamp(pick.y + (Math.random() - .5) * 2 * j, b.top + 30, b.bottom - 30) };
    return Math.hypot(q.x - p.x, q.y - p.y) >= ARENA.minSpawnDist ? q : { x: pick.x, y: pick.y }; // 错开后离主将太近就用关口本身
  }

  // ———— 断桥（长坂）————
  private setupBridge(it: { x: number; y: number; hp: number; killRadius: number }) {
    const e = this.h.spawnTarget(it.x, it.y, it.hp, 220); if (!e) return;
    e.sprite.setAlpha(0);
    const label = worldText(this.h.scene, it.x, it.y + 40, '', 14, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objs.push(label);
    this.bridge = { e, life: e.spawnId, x: it.x, y: it.y, label, killR: it.killRadius };
  }
  private updateBridge() {
    const br = this.bridge; if (!br) return;
    const alive = br.e.active && br.e.spawnId === br.life;
    if (alive) { br.label.setText(`长坂桥 · 砍断 ${Math.round((1 - br.e.hp / br.e.maxHp) * 100)}%`); return; }
    this.bridge = null; br.label.destroy(); this.stats.bridgeDown = true;
    const sc = this.h.scene;
    // 桥面断落：扬尘、水花，桥面图倒进河里
    for (let i = -1; i <= 1; i++) playSheet(sc, 'fx_collapse_dust', br.x + i * 70, br.y - 60 - Math.abs(i) * 30, { size: 220, depth: DEPTH.fx, ms: 700 });
    // 桥面断落：地形层的断桥（Terrain.setBridgeBroken：断桥图、断了按水处理）
    this.stats.bridgeDeck = !!this.h.breakBridgeNear?.(br.x, br.y);
    sc.cameras.main.shake(320, .008);
    // 桥头一带的追兵落水
    for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - br.x, e.y - br.y) < br.killR) this.h.hitEnemy(e, 99999);
    for (const g of this.gates) if (Math.hypot(g.x - br.x, g.y - br.y) < 300) g.off = true;
    this.h.banner('长坂桥断！', false, '北岸追兵过不来了 · 只剩南面山口');
    this.h.sfx('bossSummon');
  }

  // ———— 营帐起火（宛城夜袭）————
  private setupTents(it: { tents: Pt[]; lit: number[] }, now: number) {
    const sc = this.h.scene, fac = this.def.faction !== undefined ? FACTION_PROPS[this.def.faction] : undefined, key = fac && sc.textures.exists(fac.key) ? fac.key : null;
    this.tents = it.tents.map(t => ({ x: t.x, y: t.y, fires: [], state: 'idle' as const, litAt: 0, tickAt: 0,
      img: key ? (() => { const im = sc.add.image(t.x, t.y, key, 2).setOrigin(.5, 1).setDisplaySize(200, 200).setDepth(actorDepth(t.y)).setName('arena-tent'); this.objs.push(im); return im; })() : undefined }));
    for (const i of it.lit) if (this.tents[i]) this.ignite(this.tents[i], now);
  }
  private ignite(t: Tent, now: number) {
    const sc = this.h.scene; t.state = 'burning'; t.litAt = now; t.tickAt = now + 400; this.stats.tentsLit++;
    if (!sc.textures.exists('ground_fire')) return;
    for (const [dx, dy, s] of [[-40, -70, 120], [45, -40, 100], [0, -10, 90]] as const) {
      const sp = sc.add.sprite(t.x + dx, t.y + dy, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(s, s).setDepth(actorDepth(t.y) + .02).setName('arena-fire'); this.objs.push(sp); t.fires.push(sp);
      const st = { f: Math.random() * 7 }; sc.tweens.add({ targets: st, f: st.f + 8, duration: 1000 + Math.random() * 300, repeat: -1, onUpdate: () => { if (sp.active) sp.setFrame(Math.floor(st.f) % 8); } });
    }
    t.img?.setTint(0xb07a5a);
  }
  private updateTents(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'campfire'); if (!it || it.kind !== 'campfire') return;
    const p = this.h.player;
    for (const t of this.tents) {
      if (t.state !== 'burning') continue;
      // 烧着的营帐：火圈里敌我都掉血
      if (now >= t.tickAt) {
        t.tickAt = now + it.tickMs; this.stats.fireTicks++;
        for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && Math.hypot(e.x - t.x, e.y - (t.y - 30)) < it.radius) this.h.hitEnemy(e, it.damage * 2);
        if (Math.hypot(p.x - t.x, p.y - (t.y - 30)) < it.radius + p.radius) p.takeDamage(it.damage, now);
        this.h.hurtTroops(t.x, t.y - 30, it.radius, it.damage * .6);
      }
      // 蔓延：烧了 spreadMs 后点着最近一座没烧的
      if (now - t.litAt >= it.spreadMs && !(t as Tent & { spread?: boolean }).spread) {
        (t as Tent & { spread?: boolean }).spread = true;
        const next = this.tents.filter(q => q.state === 'idle').sort((a, c) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(c.x - t.x, c.y - t.y))[0];
        if (next && Math.hypot(next.x - t.x, next.y - t.y) <= it.spreadRange) { this.ignite(next, now); warnFx(this.h.scene).ambush(next.x, next.y - 40, 60); }
      }
      // 烧完：焦黑、火灭
      if (now - t.litAt >= it.spreadMs * 3) { t.state = 'burnt'; this.stats.tentsBurnt++; for (const f of t.fires) this.h.scene.tweens.add({ targets: f, alpha: 0, duration: 600, onComplete: () => f.destroy() }); t.fires = []; t.img?.setTint(0x4c3c36); }
    }
  }

  // ———— 关上滚木（阳平关）————
  private updateLogs(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'logs'); if (!it || it.kind !== 'logs') return;
    const p = this.h.player, sc = this.h.scene, fx = warnFx(sc), b = this.bounds, side = it.axis === 'x';
    if (now >= this.logAt) {
      this.logAt = now + it.everyMs;
      for (let i = 0; i < it.count; i++) {
        if (side) {
          // 滚石：从两侧山坡横着滚过谷地（第一块对准主将这一行）
          const dir = (this.logSeq % 2 ? -1 : 1) as 1 | -1, y = Phaser.Math.Clamp(i === 0 ? p.y : p.y + (Math.random() - .5) * 700, b.top + 60, b.bottom - 60), x = dir > 0 ? b.left - 30 : b.right + 30;
          this.logs.push({ x, y, toY: dir > 0 ? b.right + 30 : b.left - 30, dir, at: now + it.warnMs, rolling: false, hit: new Set(), hitPlayer: false, id: 'arena-log-' + this.logSeq++ });
        } else {
          const x = Phaser.Math.Clamp(i === 0 ? p.x : b.left + 80 + Math.random() * (b.right - b.left - 160), b.left + 60, b.right - 60), y = Math.max(it.fromY, p.y - 820);
          this.logs.push({ x, y, toY: Math.min(it.toY, y + 1900), dir: 1, at: now + it.warnMs, rolling: false, hit: new Set(), hitPlayer: false, id: 'arena-log-' + this.logSeq++ });
        }
      }
    }
    for (const l of [...this.logs]) {
      if (!l.rolling) {
        if (side) fx.lane(l.id, 'charge', l.x, l.y, l.dir > 0 ? 0 : Math.PI, Math.abs(l.toY - l.x), it.width, 1 - (l.at - now) / it.warnMs, now);
        else fx.lane(l.id, 'charge', l.x, l.y, Math.PI / 2, l.toY - l.y, it.width, 1 - (l.at - now) / it.warnMs, now);
        if (now >= l.at) {
          l.rolling = true; this.stats.logs++;
          const stone = side && sc.textures.exists('shu_pass');
          l.img = stone ? sc.add.image(l.x, l.y, 'shu_pass', 4).setOrigin(.5, .6).setDisplaySize(120, 120).setDepth(actorDepth(l.y)) : sc.add.image(l.x, l.y, 'yellow_props', 27).setOrigin(.5, .6).setDisplaySize(130, 130).setDepth(actorDepth(l.y));
          this.objs.push(l.img);
        }
        continue;
      }
      if (side) l.x += l.dir * it.speed / 60; else l.y += it.speed / 60;
      l.img?.setPosition(l.x, l.y).setRotation(l.img.rotation + .12 * l.dir).setDepth(actorDepth(l.y));
      const hitP = side ? Math.abs(p.y - l.y) <= it.width / 2 + p.radius && Math.abs(p.x - l.x) <= 40 + p.radius : Math.abs(p.x - l.x) <= it.width / 2 + p.radius && Math.abs(p.y - l.y) <= 40 + p.radius;
      if (!l.hitPlayer && hitP) { l.hitPlayer = true; this.stats.logHits++; p.takeDamage(it.damage, now); sc.cameras.main.shake(120, .005); }
      for (const e of this.h.enemies()) {
        if (!e.active || e.isSupplySlot || e.kind === 'boss' || l.hit.has(e.spawnId)) continue;
        const hitE = side ? Math.abs(e.y - l.y) <= it.width / 2 + e.radius && Math.abs(e.x - l.x) <= 40 + e.radius : Math.abs(e.x - l.x) <= it.width / 2 + e.radius && Math.abs(e.y - l.y) <= 40 + e.radius;
        if (hitE) { l.hit.add(e.spawnId); this.stats.logEnemyHits++; this.h.hitEnemy(e, it.enemyDamage); }
      }
      const done = side ? (l.dir > 0 ? l.x >= l.toY : l.x <= l.toY) : l.y >= l.toY;
      if (done) { playSheet(sc, 'fx_collapse_dust', l.x, l.y, { size: 120, depth: DEPTH.fx, ms: 420, alpha: .7 }); l.img?.destroy(); this.logs.splice(this.logs.indexOf(l), 1); }
    }
  }

  // ———— 火墙收圈（火烧连营）————
  /** 火墙：沿当前边界一圈地火（手绘序列帧）；收圈时边界往里收、火跟着挪，镜头边界、关口一起收。 */
  private ringFires: Phaser.GameObjects.Sprite[] = []; private ring0 = { left: 0, right: 0, top: 0, bottom: 0 }; private ringTickAt = 0; private ringPlacedAt = 0;
  private buildFireEdges() {
    const b = this.bounds; this.ring0 = { ...b };
    const per = 2 * ((b.right - b.left) + (b.bottom - b.top)), n = Math.round(per / 120);
    for (let i = 0; i < n; i++) { const f = this.flame(0, 0, 150 + (i % 3) * 20, 0); if (f) this.ringFires.push(f); }
    this.placeRing();
  }
  /** 地火按周长均匀摆在当前边界外侧一点（火在边线上，主将贴边站就在火里）。 */
  private placeRing() {
    const b = this.bounds, w = b.right - b.left, h = b.bottom - b.top, per = 2 * (w + h), n = this.ringFires.length;
    this.ringFires.forEach((f, i) => {
      let d = (i + .5) / n * per, x: number, y: number;
      if (d < w) { x = b.left + d; y = b.top - 20; } else if ((d -= w) < h) { x = b.right + 20; y = b.top + d; } else if ((d -= h) < w) { x = b.right - d; y = b.bottom + 30; } else { d -= w; x = b.left - 20; y = b.bottom - d; }
      f.setPosition(x + ((i * 37) % 30) - 15, y).setDepth(actorDepth(y) + .02);
    });
  }
  private updateFireRing(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'firering'); if (!it || it.kind !== 'firering') return;
    const t0 = this.startedAt + it.startMs, k = Phaser.Math.Clamp((now - t0) / it.durationMs, 0, 1), s = 1 - (1 - it.shrinkTo) * k, r = this.ring0, b = this.bounds;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, hw = (r.right - r.left) / 2 * s, hh = (r.bottom - r.top) / 2 * s;
    if (Math.abs(b.right - (cx + hw)) > .5) {
      b.left = cx - hw; b.right = cx + hw; b.top = cy - hh; b.bottom = cy + hh;
      if (now - this.ringPlacedAt > 200) {
        this.ringPlacedAt = now; this.placeRing();
        const P = this.band; this.h.scene.cameras.main.setBounds(b.left - P, b.top - P, b.right - b.left + P * 2, b.bottom - b.top + P * 2);
        for (let i = 0; i < this.gates.length; i++) { const g0 = this.def.gates[i]; this.gates[i].x = cx + (g0.x - cx) * s; this.gates[i].y = cy + (g0.y - cy) * s; }
        this.stats.ringScale = +s.toFixed(3);
      }
      if (!this.stats.ringClosing && k > 0) { this.stats.ringClosing = true; this.h.banner('火势四合！', true, '火墙往里收 · 别贴着火墙'); }
    }
    // 贴着火墙：敌我都烧（火攻）
    if (now >= this.ringTickAt) {
      this.ringTickAt = now + it.tickMs; const near = (x: number, y: number) => Math.min(x - b.left, b.right - x, y - b.top, b.bottom - y) < it.burn;
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && near(e.x, e.y)) { this.h.hitEnemy(e, it.damage, 'fire'); this.stats.ringHits++; }
      const p = this.h.player; if (near(p.x, p.y)) { p.takeDamage(it.playerDamage, now); this.stats.ringPlayerHits++; }
    }
  }

  // ———— 火油车（盘蛇谷）————
  private setupCarts(it: { carts: Pt[] }) {
    const sc = this.h.scene;
    for (const c of it.carts) {
      const e = this.h.spawnTarget(c.x, c.y, 1, 150); if (!e) continue; e.sprite.setAlpha(0);
      const img = sc.textures.exists('yellow_props') ? sc.add.image(c.x, c.y, 'yellow_props', 24).setOrigin(.5, 1).setDisplaySize(150, 150).setDepth(actorDepth(c.y)).setName('arena-cart') : undefined;
      if (img) this.objs.push(img);
      if (sc.textures.exists('yellow_props')) { const j = sc.add.image(c.x + 60, c.y + 6, 'yellow_props', 18).setOrigin(.5, 1).setDisplaySize(90, 90).setDepth(actorDepth(c.y + 6)).setName('arena-cart'); this.objs.push(j); }
      this.carts.push({ e, life: e.spawnId, x: c.x, y: c.y, img, litAt: 0, burnAt: 0, fires: [], tickAt: 0, done: false });
    }
  }
  private updateCarts(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'firecarts'); if (!it || it.kind !== 'firecarts') return;
    const p = this.h.player, sc = this.h.scene, b = this.bounds;
    for (const c of this.carts) {
      if (c.done) continue;
      if (!c.litAt && !(c.e.active && c.e.spawnId === c.life)) { c.litAt = now; this.stats.cartsLit++; this.flame(c.x, c.y - 40, 110, c.y); warnFx(sc).ambush(c.x, c.y - 30, 80); }
      if (c.litAt && !c.burnAt && now >= c.litAt + it.fuseMs) {
        // 火带横贯山谷
        c.burnAt = now; c.tickAt = now; this.stats.fireBands++; c.img?.setTint(0x4c3c36); sc.cameras.main.shake(200, .006);
        for (let x = b.left + 40; x <= b.right - 40; x += 105) { const f = this.flame(x + (Math.random() - .5) * 30, c.y + (Math.random() - .5) * it.band * .6, 120 + Math.random() * 40, c.y + it.band / 2); if (f) c.fires.push(f); }
        playSheet(sc, 'fx_collapse_dust', c.x, c.y, { size: 200, depth: DEPTH.fx, ms: 600, alpha: .6 });
        this.h.banner('火烧盘蛇谷！', false, '藤甲遇火即燃');
      }
      if (c.burnAt) {
        if (now >= c.tickAt) {
          c.tickAt = now + it.tickMs;
          for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && Math.abs(e.y - c.y) <= it.band / 2 + e.radius && e.x >= b.left && e.x <= b.right) { this.h.hitEnemy(e, it.damage, 'fire'); this.stats.fireHits++; }
          if (Math.abs(p.y - c.y) <= it.band / 2 + p.radius) p.takeDamage(it.playerDamage, now);
          this.h.hurtTroops(0, c.y, (b.right - b.left) / 2, it.playerDamage * .5);
        }
        if (now >= c.burnAt + it.burnMs) { c.done = true; for (const f of c.fires) sc.tweens.add({ targets: f, alpha: 0, duration: 700, onComplete: () => f.destroy() }); c.fires = []; }
      }
    }
  }
  // ———— 灌木伏兵（荥阳）————
  private setupBushes(it: { spots: Pt[] }) {
    const sc = this.h.scene;
    this.bushes = it.spots.map(sp => ({ x: sp.x, y: sp.y, sprung: false, imgs: [] as Phaser.GameObjects.Image[] }));
    // 灌木图在地形树图集 7 号格（地形层异步载入，没载完就等它 / 自己载）
    const draw = () => { if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN || !sc.textures.exists('terrain_trees')) return; for (const bu of this.bushes) bu.imgs = [[-60, -10, 150], [40, 0, 170], [-10, 30, 140]].map(([dx, dy, sz]) => { const im = sc.add.image(bu.x + dx, bu.y + dy, 'terrain_trees', 7).setOrigin(.5, .92).setDisplaySize(sz, sz).setDepth(actorDepth(bu.y + dy)).setName('arena-bush'); this.objs.push(im); return im; }); };
    if (sc.textures.exists('terrain_trees')) draw(); else { sc.load.once('filecomplete-spritesheet-terrain_trees', draw); if (!sc.load.isLoading()) { sc.load.spritesheet('terrain_trees', 'assets/terrain/trees.png', { frameWidth: 384, frameHeight: 384 }); sc.load.start(); } }
  }
  private updateBushes(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'bushes'); if (!it || it.kind !== 'bushes' || !this.h.spawnEnemy) return;
    const p = this.h.player, sc = this.h.scene;
    for (const bu of this.bushes) {
      if (bu.sprung || Math.hypot(p.x - bu.x, p.y - bu.y) > it.range) continue;
      bu.sprung = true; this.stats.bushesSprung++;
      warnFx(sc).ambush(bu.x, bu.y - 20, 90); this.bushPending.push({ x: bu.x, y: bu.y, at: now + it.warnMs });
      for (const im of bu.imgs) sc.tweens.add({ targets: im, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 3 });
    }
    for (const bp of [...this.bushPending]) if (now >= bp.at) {
      this.bushPending.splice(this.bushPending.indexOf(bp), 1);
      for (let i = 0; i < it.count; i++) { const a = Math.PI * 2 * i / it.count; if (this.h.spawnEnemy(i === 0 ? 'shield' : 'infantry', bp.x + Math.cos(a) * 50, bp.y + Math.sin(a) * 30)) this.stats.bushAmbushers++; }
      this.h.banner('林中伏兵！', true);
    }
  }
  // ———— 房檐伏兵（长安街坊）————
  private updateRoofs(now: number) {
    const it = this.def.interactions?.find(i => i.kind === 'roofs'); if (!it || it.kind !== 'roofs' || !this.h.spawnEnemy) return;
    const p = this.h.player, sc = this.h.scene, b = this.bounds;
    if (now >= this.roofAt) {
      this.roofAt = now + it.everyMs; this.stats.roofDrops++;
      for (let i = 0; i < it.count; i++) { const x = i % 2 ? b.right - 40 : b.left + 40, y = Phaser.Math.Clamp(p.y - 140 + i * 120, b.top + 60, b.bottom - 60); warnFx(sc).ambush(x, y, 70); this.roofPending.push({ x, y, at: now + it.warnMs, kind: i === 0 ? 'shield' : 'infantry' }); }
    }
    for (const r of [...this.roofPending]) if (now >= r.at) {
      this.roofPending.splice(this.roofPending.indexOf(r), 1);
      const e = this.h.spawnEnemy(r.kind, r.x, r.y);
      if (e) { const y0 = e.sprite.y; e.sprite.y = y0 - 90; sc.tweens.add({ targets: e.sprite, y: y0, duration: 260, ease: 'Quad.In' }); playSheet(sc, 'fx_collapse_dust', r.x, r.y + 6, { size: 90, depth: DEPTH.fx, ms: 380, alpha: .7 }); }
    }
  }

  update(now: number) {
    this.updateCarts(now); this.updateBushes(now); this.updateRoofs(now); this.updateFireRing(now);
    this.updateBridge(); this.updateTents(now); this.updateLogs(now);
  }
  /** 小地图 / 测试读：边界、四边类型、关口（关掉的不算）。 */
  get info() { return { kind: this.def.kind, bounds: { ...this.bounds }, edges: { ...this.def.edges }, gates: this.gates.filter(g => !g.off).map(g => ({ x: g.x, y: g.y })), edgeBand: this.band }; }
  private post = () => { const st = (this.h.scene as unknown as { mode?: string; over?: boolean }); if (st.mode === 'none' && !st.over) this.keepInside(); };
  clear() { this.h.scene.events.off('postupdate', this.post, this); for (const o of this.objs) o.destroy(); this.objs = []; this.h.scene.cameras.main.removeBounds(); }
}
