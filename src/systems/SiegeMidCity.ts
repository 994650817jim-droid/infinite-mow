import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { MID_SIEGE as M, LARGE_SIEGE as L, SIEGE_PROFILES, SIEGE_SPAWN, ramStats, type MidSiegePhase, type RamStats, type SiegeProfile } from '../data/siegeMedium';
import { warnFx } from '../ui/WarnFx';
import { playSheet } from './SkillFxSheets';
import { worldText } from '../world/WorldUI';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';
import type { EnemyKind } from '../types';

/**
 * 攻城战重做 · 中城样板控制器（数值见 data/siegeMedium.ts，待平衡会话复核）。
 * 第一段 城外：城墙横在上方，城头两座箭楼放箭雨（落点有手绘预警圈），箭楼毁一座箭雨就减弱；
 *   主将护送冲车（离得近才走）到城门撞门，敌兵有一半会转去打冲车，冲车毁了回营地再领；打掉城外敌营少来兵。
 * 第二段 巷战：窄街两侧民房，屋顶伏兵跳下；2 个据点，站圈占下后插旗、补员，守军反扑守住 20 秒。街上有火油桶。
 * 第三段 府衙：守将两阶段（横扫 → 加冲锋），亲卫定时从回廊杀出，亲卫在场时守将有护盾；击败后掉宝箱、插旗占领。
 * 段与段之间：城门倒塌（手绘序列帧）/ 内城门洞开 → 黑场推进转场，主将与部曲进下一块场地。
 * 美术：有 v2 图（siege_mid_*）用 v2，没有时用现有素材过渡（汜水关城门 / 箭楼 / 营寨道具、营地道具、扬尘序列帧）。
 *
 * 三档城（data/siegeMedium.ts SIEGE_PROFILES）：小城 城外（木门主将直接砍、1 座箭楼、无冲车）→ 县衙；中城 = 上面的样板；
 * 大城 城外（护城河 + 吊桥：砍断两根绳索放桥，或守军到时自己放桥出城）→ 瓮城（四面放箭、滚木礌石，砍破瓮城内门）→ 巷战 → 内城（势力名将两阶段）。
 * 护城河 / 吊桥 / 瓮城的 v2 图还没要（额度恢复后补），现在用江岸地面染暗作水面、营地道具（木栅 / 木板 / 绞索架）过渡。
 */
export interface MidSiegeHost {
  scene: Phaser.Scene;
  player: Player;
  allies: () => readonly Ally[];
  enemies: () => readonly Enemy[];
  now: () => number;
  footprints: Array<{ left: number; right: number; top: number; bottom: number }>;
  spawnEnemy: (kind: EnemyKind, x: number, y: number, force?: boolean) => Enemy | null;
  advance: (e: Enemy, nx: number, ny: number, dt: number) => void;
  spawnTower: (x: number, y: number) => Enemy | null;
  /** 可被武器砍的物件目标（小城木门、吊桥绳索、瓮城内门）：贴图 / 帧 / 尺寸由调用方给 */
  spawnTarget?: (x: number, y: number, hp: number, size: number, texture: string, frame: number | string) => Enemy | null;
  spawnBarrel: (x: number, y: number) => void;
  hurtTroops: (x: number, y: number, r: number, dmg: number) => void;
  recruit: (n: number) => void;
  banner: (text: string, danger?: boolean, caption?: string) => void;
  sfx: (k: string) => void;
  spawnBoss: () => void;
  boss: () => Enemy | null;
  campsAlive: () => [number, number];
  /** 攻城器械等级（讲武堂科技预留，默认 0） */
  engineLevel?: number;
  /** 复用到别的篇章（第七章成都）：守将由篇章首领控制器驱动（不走 stepBoss）、城门血量与段名覆盖 */
  opts?: { externalBoss?: boolean; gateHp?: number; hallName?: string; cityName?: string; tier?: 'small' | 'medium' | 'large'; bossName?: string };
}

type Box = { left: number; right: number; top: number; bottom: number };
/** 城墙铺法（像素为世界坐标）：段距（< 段宽，互相压住接缝）、城门可见半宽、压进城门的量、伸出场地的长度、墙脚阴影、民房离城墙的距离、城门血量字（门前地上，不跑到顶部 HUD 底下）。 */
const WALL = { segStep: 196, gateHalfVis: 124, gateOverlap: 14, beyond: 520, shadowBands: 8, shadowAlpha: .42, houseGap: 300, gateLabelDy: 62, moatFlow: 30 } as const;
const ART = { walls: 'siege_mid_walls', gateFx: 'siege_mid_gatefx', ram: 'siege_mid_ram', street: 'siege_mid_street', hall: 'siege_mid_hall' } as const;
/** v2 图集帧（4×2）：城防 0 城墙段 1 城门 2 城门破 3 箭楼 4 箭楼毁 5 墩台 6 残墙 7 辕门；冲车 0–3 撞门 4 打坏 5 残骸 6 我方大旗 7 我方营帐；
 *  巷战 0 民房 1 两层民房 2 店铺 3 粮仓 4 兵营 5 路障 6 屋脊 7 水井；府衙 0 大堂 1 台阶 2 回廊 3 石狮 4 内城门 5 帅旗 6 香炉 7 照壁 */
export const MID_SIEGE_ART = ART;

interface Ram { img: Phaser.GameObjects.Image; x: number; y: number; hp: number; state: 'move' | 'ram' | 'wreck'; hitAt: number; frame: number; label: Phaser.GameObjects.Text; contact: Map<number, number>; guardUntil: number; burnUntil: number; burnFxAt: number; flashUntil: number; }
interface Point { name: string; x: number; y: number; radius: number; state: 'open' | 'held' | 'secured'; progress: number; hold: number; lost: number; counterAt: number; flag?: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; gfx: Phaser.GameObjects.Graphics; }
interface Zone { x: number; y: number; at: number; id: string; fire?: boolean }
interface Target { e: Enemy; life: number; x: number; y: number; }
interface Log { x: number; y: number; at: number; rolling: boolean; id: string; img?: Phaser.GameObjects.Image; hitPlayer: boolean; hit: Set<number>; }

export class SiegeMidCity {
  phase: MidSiegePhase = 'outside';
  readonly stats = { volleys: 0, zones: 0, ramHits: 0, ramsLost: 0, ramsTaken: 1, fireArrows: 0, burns: 0, putOut: 0, ambushes: 0, transitions: 0, guardWaves: 0, shieldHits: 0, bossSkills: 0, ropesCut: 0, logs: 0, logHits: 0, sally: 0 };
  /** 档位配置（小 / 中 / 大城） */
  readonly prof: SiegeProfile; readonly tier: 'small' | 'medium' | 'large';
  /** 小城木门 / 大城瓮城内门（可砍） */
  private woodGate: Target | null = null; private innerGate: Target | null = null;
  /** 大城护城河：吊桥是否放下、两根绳索 */
  bridgeDown = false; private moatWater?: Phaser.GameObjects.TileSprite; private ropes: Target[] = []; private bridgeBox: Box | null = null; private bridgeImg?: Phaser.GameObjects.Image; private ropeLabel?: Phaser.GameObjects.Text;
  /** 大城瓮城：滚木 */
  private logs: Log[] = []; private logAt = 0; private barbVolleyAt = 0; private barbGateBox: Box | null = null;
  gateHp: number = M.outside.gate.hp;
  gateMax: number = M.outside.gate.hp;
  private towers: Array<{ e: Enemy; life: number; x: number }> = [];
  private ram: Ram | null = null; private ramReadyAt = 0; private spareLeft = 0;
  /** 本场冲车属性（按攻城器械等级加成） */
  readonly ramCfg: RamStats;
  private zones: Zone[] = []; private volleyAt = 0; private zoneSeq = 0;
  private points: Point[] = [];
  private ambushAt = 0; private ambushPending: Array<{ x: number; y: number; at: number; kind: EnemyKind }> = [];
  private guards: Array<{ e: Enemy; life: number }> = []; private guardsAt = 0;
  private bossPhase2 = false; private skillAt = 0; private skill: { kind: 'sweep' | 'charge'; at: number; x: number; y: number; angle: number; hit: boolean } | null = null;
  private gateBox: Box | null = null; private innerGateBox: Box | null = null; private arenaBoxes: Box[] = [];
  private campLabel?: Phaser.GameObjects.Text;
  private gateImg?: Phaser.GameObjects.Image; private innerGateImg?: Phaser.GameObjects.Image; private gateLabel?: Phaser.GameObjects.Text;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private transitioning = false; private finalFlag?: Phaser.GameObjects.Image; private startAt = 0;
  private shieldRingId = 'mid-guard-shield';

  constructor(private readonly h: MidSiegeHost) {
    const now = h.now();
    this.tier = h.opts?.tier ?? 'medium'; this.prof = SIEGE_PROFILES[this.tier];
    this.gateHp = this.gateMax = h.opts?.gateHp ?? this.prof.gateHp;
    this.ramCfg = ramStats(h.engineLevel ?? 0); this.spareLeft = this.ramCfg.spare;
    this.volleyAt = now + 2500; this.ramReadyAt = now; this.startAt = now;
    this.buildOutside();
    this.ram = this.prof.ram ? this.newRam() : null;
    h.footprints.splice(0, h.footprints.length, ...this.arenaBoxes);
    this.h.banner('攻城 · 城外', true, this.tier === 'small' ? '砍破木门，打掉箭楼可减弱箭雨' : this.tier === 'large' ? '砍断吊桥绳索放下吊桥，护送冲车撞开城门' : '护送冲车撞开城门，打掉箭楼可减弱箭雨');
  }

  // ---------- 美术 ----------
  private has(k: string) { return this.h.scene.textures.exists(k); }
  private img(x: number, y: number, key: string, frame: number | string, w: number, h?: number, originY = 1, depth?: number): Phaser.GameObjects.Image {
    const im = this.h.scene.add.image(x, y, key, frame).setOrigin(.5, originY).setDisplaySize(w, h ?? w).setDepth(depth ?? actorDepth(y));
    this.objects.push(im); return im;
  }
  /** v2 图优先，缺图用 fallback（[纹理, 帧]）。 */
  private art(x: number, y: number, v2: [string, number], fb: [string, number | string], w: number, h?: number, originY = 1, depth?: number) {
    // v2 图格子是正方形、物件底边贴格底：一律按正方形显示（宽 = w），不拉伸
    return this.has(v2[0]) ? this.img(x, y, v2[0], v2[1], w, w, originY, depth) : this.img(x, y, fb[0], fb[1], w, h ?? w, originY, depth);
  }
  private box(b: Box) { this.arenaBoxes.push(b); return b; }

  private buildOutside() {
    const o = M.outside, a = o.arena, wy = o.wallY;
    // 场地边界：左右、南边；城墙（城门处留口，口由城门碰撞框堵上）
    this.box({ left: a.left - 80, right: a.left, top: a.top - 1800, bottom: a.bottom + 80 });
    this.box({ left: a.right, right: a.right + 80, top: a.top - 1800, bottom: a.bottom + 80 });
    this.box({ left: a.left - 80, right: a.right + 80, top: a.bottom, bottom: a.bottom + 80 });
    this.box({ left: a.left, right: -o.gate.halfW, top: wy - 30, bottom: wy + 20 });
    this.box({ left: o.gate.halfW, right: a.right, top: wy - 30, bottom: wy + 20 });
    this.gateBox = this.box({ left: -o.gate.halfW, right: o.gate.halfW, top: wy - 30, bottom: wy + 20 });
    // 城墙：v2 城墙段横向拼接；缺图用汜水关木栅（第 3 帧）过渡
    // 城墙连续成一条（用户 11-17「这里的城墙没做好」）：从城门两侧往外铺，段与段互相压一点盖住接缝，伸出场地两边；城门压在最上面盖住两头
    const segW = 226, step = WALL.segStep, from = WALL.gateHalfVis + step / 2 - WALL.gateOverlap;
    for (const side of [-1, 1]) for (let i = 0, x = side * from; Math.abs(x) < Math.max(-a.left, a.right) + WALL.beyond; i++, x += side * step)
      this.art(x, wy + 24, [ART.walls, 0], ['sishui_props_refined', 3], segW, this.has(ART.walls) ? segW * .55 : segW * .6).setFlipX(i % 2 === 1);
    // 墙脚阴影：墙根一条柔和的暗带（贴地，压在地面上、人物之下），城墙不再像贴在地上
    { const g = this.h.scene.add.graphics().setDepth(DEPTH.ground + 2); this.objects.push(g); const L = a.left - WALL.beyond, R = a.right + WALL.beyond;
      for (let k = 0; k < WALL.shadowBands; k++) g.fillStyle(0x1a120a, WALL.shadowAlpha * (1 - k / WALL.shadowBands)).fillRect(L, wy + 14 + k * 4, R - L, 4); }
    // 城门用倒塌序列帧的第 1 帧（完好），破门时直接往下播，最后停在敞开的门洞
    this.gateImg = this.has(ART.gateFx) ? this.img(0, wy + 34, ART.gateFx, 0, 300, 300) : this.art(0, wy + 30, [ART.walls, 1], ['sishui_props_refined', 0], 260);
    // 小城：木门（可砍目标，贴在城门洞前）；城门图压暗成木色
    if (!this.prof.ram) { this.gateImg.setTint(0xb08a5a); const e = this.h.spawnTarget?.(0, wy + 34, this.gateHp, 200, 'yellow_props', 13) ?? null; if (e) { e.sprite.setAlpha(0); this.woodGate = { e, life: e.spawnId, x: 0, y: wy + 34 }; } }
    this.gateLabel = worldText(this.h.scene, 0, wy + WALL.gateLabelDy, '', 15, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(this.gateLabel);
    // 箭楼：可摧毁目标（宿主用营寨物件生成，碰撞 / 命中沿用）
    for (const t of this.prof.towers) { const e = this.h.spawnTower(t.x, wy + 26); if (e) { this.towers.push({ e, life: e.spawnId, x: t.x }); if (this.has(ART.walls)) e.sprite.setTexture(ART.walls, 3).setOrigin(.5, 1).setDisplaySize(150, 150); } }
    // 我方营地（冲车在此领取）
    this.art(o.camp.x - 150, o.camp.y + 30, [ART.ram, 7], ['yellow_props', 0], 150);
    this.art(o.camp.x + 140, o.camp.y + 20, [ART.ram, 6], ['zhuge_banner', 0], 110, 150);
    this.campLabel = worldText(this.h.scene, o.camp.x, o.camp.y + 70, this.prof.ram ? '营地' : '', 14, '#bfe6c8').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(this.campLabel);
    if (this.tier === 'large') this.buildMoat();
    // 后面各段：瓮城（大城）、街巷（中大城）、府衙
    if (this.prof.phases.includes('barbican')) this.buildBarbican();
    if (this.prof.phases.includes('street')) this.buildStreet();
    else { const a = M.hall.arena; this.box({ left: a.left, right: a.right, top: a.bottom, bottom: a.bottom + 80 }); }
    this.buildHall();
  }

  // ---------- 大城：护城河、吊桥 ----------
  private buildMoat() {
    const m = L.moat, a = M.outside.arena, sc = this.h.scene, bw = m.bridgeHalfW;
    this.box({ left: a.left, right: -bw, top: m.top, bottom: m.bottom });
    this.box({ left: bw, right: a.right, top: m.top, bottom: m.bottom });
    this.bridgeBox = this.box({ left: -bw, right: bw, top: m.top, bottom: m.bottom });
    // 水面：用地形层的 v2 手绘水面（terrain/water.png，会流动）+ 两岸土坡；缺图时退回江岸地面压暗染青
    const L0 = a.left - WALL.beyond, W0 = a.right - a.left + WALL.beyond * 2, v2 = sc.textures.exists('terrain_water');
    if (v2) { const bank = sc.add.tileSprite(L0, m.top - 14, W0, m.bottom - m.top + 30, sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE').setOrigin(0, 0).setTint(0x5a4a30).setAlpha(.92).setDepth(DEPTH.ground + 1); this.objects.push(bank); }
    const water = sc.add.tileSprite(L0, m.top, W0, m.bottom - m.top, v2 ? 'terrain_water' : sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE').setOrigin(0, 0).setDepth(DEPTH.ground + 2);
    if (v2) water.setTileScale(.5); else water.setTint(0x6c97a3).setAlpha(.88);
    this.objects.push(water); this.moatWater = v2 ? water : undefined;
    // 吊桥（收起：城门前一道木栅挡着；放下：木板桥）
    this.bridgeImg = this.img(0, m.bottom + 6, 'yellow_props', 10, bw * 2.2, 90);
    for (const r of m.ropes) {
      const y = m.bottom + 40, e = this.h.spawnTarget?.(r.x, y, m.ropeHp, 110, 'yellow_props', 9) ?? null;
      if (e) this.ropes.push({ e, life: e.spawnId, x: r.x, y });
    }
    this.ropeLabel = worldText(sc, 0, m.bottom + 120, '', 14, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(this.ropeLabel);
  }
  /** 场上的说明字（城门血量 / 吊桥绳索 / 营地）：横幅出现时宿主先把它们淡出，免得叠字。 */
  get floatLabels(): Phaser.GameObjects.Text[] { return [this.gateLabel, this.ropeLabel, this.campLabel].filter((t): t is Phaser.GameObjects.Text => !!t?.active); }
  get ropesLeft() { return this.ropes.filter(r => r.e.active && r.e.spawnId === r.life).length; }
  /** 放下吊桥：砍断两根绳索，或守军到时自己放桥出城（出城兵一波）。 */
  lowerBridge(sally = false) {
    if (this.bridgeDown) return;
    this.bridgeDown = true;
    if (this.bridgeBox) { const i = this.h.footprints.indexOf(this.bridgeBox); if (i >= 0) this.h.footprints.splice(i, 1); this.bridgeBox = null; }
    const m = L.moat;
    // 放下的吊桥：地形层的 v2 木桥（横跨护城河，竖着摆）；缺图沿用营寨物件
    if (this.h.scene.textures.exists('terrain_bridge')) this.bridgeImg?.setTexture('terrain_bridge').setOrigin(.5).setRotation(Math.PI / 2).setDisplaySize((m.bottom - m.top) + 70, m.bridgeHalfW * 2.4).setPosition(0, (m.top + m.bottom) / 2).setDepth(DEPTH.ground + 3);
    else this.bridgeImg?.setFrame(27).setDisplaySize(m.bridgeHalfW * 2.2, (m.bottom - m.top) + 50).setOrigin(.5, 1).setPosition(0, m.bottom + 18).setDepth(DEPTH.ground + 3);
    playSheet(this.h.scene, 'fx_collapse_dust', 0, (m.top + m.bottom) / 2, { size: 220, depth: DEPTH.fx, ms: 600 });
    this.h.scene.cameras.main.shake(220, .005); this.h.sfx('propBreak');
    this.ropeLabel?.setText('');
    if (sally) {
      this.stats.sally++;
      for (let i = 0; i < m.sally; i++) this.h.spawnEnemy(i % 3 ? 'infantry' : 'cavalry', (i - m.sally / 2) * 40, m.top - 30, true);
      this.h.banner('守军放桥出城！', true, '吊桥已落 · 护送冲车过桥');
    } else this.h.banner('吊桥已落', false, '护送冲车过桥撞门');
  }
  private updateMoat(now: number) {
    if (this.tier !== 'large' || this.bridgeDown) return;
    const left = this.ropesLeft, el = (now - this.startAt) / 1000, auto = Math.max(0, Math.ceil(L.moat.autoLowerSeconds - el));
    if (left === 0) { this.lowerBridge(false); return; }
    if (auto <= 0) { this.lowerBridge(true); return; }
    this.ropeLabel?.setText(`吊桥绳索 ${2 - left}/2 · 守军 ${auto} 秒后放桥出城`);
  }

  // ---------- 大城：瓮城 ----------
  private buildBarbican() {
    const B = L.barbican, a = B.arena, segW = 220;
    this.box({ left: a.left - 300, right: a.left, top: a.top - 200, bottom: a.bottom + 300 });
    this.box({ left: a.right, right: a.right + 300, top: a.top - 200, bottom: a.bottom + 300 });
    this.box({ left: a.left, right: a.right, top: a.bottom, bottom: a.bottom + 300 });
    this.box({ left: a.left, right: B.innerGate.x - 90, top: a.top - 200, bottom: a.top + 20 });
    this.box({ left: B.innerGate.x + 90, right: a.right, top: a.top - 200, bottom: a.top + 20 });
    this.barbGateBox = this.box({ left: B.innerGate.x - 90, right: B.innerGate.x + 90, top: a.top - 200, bottom: a.top + 20 });
    // 四面城墙：北墙（内门两侧）、东西墙竖排墩台、南面是破开的外门
    for (let x = a.left + segW / 2; x < a.right; x += segW) if (Math.abs(x - B.innerGate.x) > 150) this.art(x, a.top + 40, [ART.walls, 0], ['sishui_props_refined', 3], segW + 6, this.has(ART.walls) ? (segW + 6) * .55 : segW * .6);
    for (let y = a.top + 160; y < a.bottom; y += 170) for (const x of [a.left - 30, a.right + 30]) this.art(x, y + 40, [ART.walls, 5], ['sishui_props_refined', 3], 150);
    this.art(B.innerGate.x, a.top + 46, [ART.hall, 4], ['sishui_props_refined', 0], 280);
    for (const d of B.doors) this.art(d.x + (d.x < B.cx ? 20 : -20), d.y + 40, [ART.walls, 7], ['yellow_props', 13], 110).setFlipX(d.x > B.cx);
  }
  private enterBarbican() {
    const B = L.barbican, now = this.h.now();
    const e = this.h.spawnTarget?.(B.innerGate.x, B.innerGate.y + 30, B.innerGate.hp, 200, 'yellow_props', 13) ?? null;
    if (e) { e.sprite.setAlpha(0); this.innerGate = { e, life: e.spawnId, x: B.innerGate.x, y: B.innerGate.y + 30 }; }
    this.logAt = now + 3500; this.barbVolleyAt = now + 2000;
    this.h.banner('瓮城 · 四面受敌', true, '城头放箭、滚木礌石——砍破瓮城内门');
  }
  get innerGateHp() { const g = this.innerGate; return g && g.e.active && g.e.spawnId === g.life ? Math.ceil(g.e.hp) : 0; }
  private updateBarbican(dt: number, now: number) {
    const B = L.barbican, V = B.volley, p = this.h.player, fx = warnFx(this.h.scene);
    // 城头箭雨（四面）
    if (now >= this.barbVolleyAt) {
      this.barbVolleyAt = now + V.everyMs; this.stats.volleys++;
      for (let i = 0; i < V.zones; i++) { const jx = i ? (Math.random() - .5) * 320 : 0, jy = i ? (Math.random() - .5) * 240 : 0; this.zones.push({ x: p.x + jx, y: p.y + jy, at: now + V.warnMs, id: 'barb-volley-' + (this.zoneSeq++) }); this.stats.zones++; }
    }
    for (const z of [...this.zones]) {
      if (now < z.at) { fx.circle(z.id, 'arrows', z.x, z.y, V.radius, 1 - (z.at - now) / V.warnMs, now); continue; }
      fx.shapeImpact(z.id, 'arrows', z.x, z.y, V.radius, 0, now, 0, { scale: 1, alpha: .85 });
      if (Math.hypot(p.x - z.x, p.y - z.y) <= V.radius + p.radius) p.takeDamage(V.damage, now);
      this.h.hurtTroops(z.x, z.y, V.radius, V.allyDamage);
      this.zones.splice(this.zones.indexOf(z), 1);
    }
    // 滚木礌石：北墙城头沿南北向滚下（先铺预警箭道）
    const G = B.logs, a = B.arena;
    if (now >= this.logAt) {
      this.logAt = now + G.everyMs;
      for (let i = 0; i < G.count; i++) { const x = Math.max(a.left + 60, Math.min(a.right - 60, i ? a.left + 60 + Math.random() * (a.right - a.left - 120) : p.x)); this.logs.push({ x, y: a.top + 30, at: now + G.warnMs, rolling: false, id: 'barb-log-' + (this.zoneSeq++), hitPlayer: false, hit: new Set() }); }
    }
    const len = a.bottom - a.top - 30;
    for (const l of [...this.logs]) {
      if (!l.rolling) {
        fx.lane(l.id, 'charge', l.x, a.top + 30, Math.PI / 2, len, G.width, 1 - (l.at - now) / G.warnMs, now);
        if (now >= l.at) { l.rolling = true; this.stats.logs++; l.img = this.img(l.x, l.y, 'yellow_props', 27, 120, 120, .6); }
        continue;
      }
      l.y += G.speed * dt; l.img?.setPosition(l.x, l.y).setRotation((l.img.rotation + dt * 9) % (Math.PI * 2)).setDepth(actorDepth(l.y));
      if (!l.hitPlayer && Math.abs(p.x - l.x) <= G.width / 2 + p.radius && Math.abs(p.y - l.y) <= 40 + p.radius) { l.hitPlayer = true; this.stats.logHits++; p.takeDamage(G.damage, now); this.h.scene.cameras.main.shake(120, .004); }
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && !l.hit.has(e.uid) && Math.abs(e.x - l.x) <= G.width / 2 + e.radius && Math.abs(e.y - l.y) <= 40) { l.hit.add(e.uid); e.hp -= G.enemyDamage; if (e.hp <= 0) e.hp = 1; }
      this.h.hurtTroops(l.x, l.y, G.width / 2, 10 * dt);
      if (l.y >= a.bottom) { l.img?.destroy(); this.logs.splice(this.logs.indexOf(l), 1); playSheet(this.h.scene, 'fx_collapse_dust', l.x, l.y, { size: 120, depth: DEPTH.fx, ms: 420, alpha: .7 }); }
    }
  }
  private breakInnerGate() {
    if (this.barbGateBox) { const i = this.h.footprints.indexOf(this.barbGateBox); if (i >= 0) this.h.footprints.splice(i, 1); this.barbGateBox = null; }
    for (const l of this.logs) l.img?.destroy(); this.logs.length = 0;
    playSheet(this.h.scene, 'fx_collapse_dust', L.barbican.innerGate.x, L.barbican.innerGate.y + 20, { size: 260, depth: DEPTH.fx, ms: 700 });
    this.h.scene.cameras.main.shake(320, .007); this.h.sfx('bossSummon');
    this.h.banner('瓮城内门已破！', true, '杀入城中街巷');
    this.h.scene.time.delayedCall(1100, () => this.transition('street'));
  }
  /** 可砍目标（木门 / 绳索 / 瓮城内门）：武器在射程内时优先打。 */
  priorityTarget(range: number): Enemy | null {
    const p = this.h.player; let best: Enemy | null = null, bd = Infinity;
    const list = this.phase === 'outside' ? [this.woodGate, ...this.ropes] : this.phase === 'barbican' ? [this.innerGate] : [];
    for (const t of list) { if (!t || !t.e.active || t.e.spawnId !== t.life) continue; const d = Math.hypot(t.e.x - p.x, t.e.y - p.y) - t.e.radius; if (d <= range && d < bd) { bd = d; best = t.e; } }
    return best;
  }

  private buildStreet() {
    const s = M.street, a = s.arena;
    this.box({ left: a.left - 520, right: a.left, top: a.top, bottom: M.outside.wallY - 30 });
    this.box({ left: a.right, right: a.right + 520, top: a.top, bottom: M.outside.wallY - 30 });
    this.innerGateBox = this.box({ left: a.left, right: a.right, top: s.innerGateY - 40, bottom: s.innerGateY });
    const houseW = 230;
    // 民房从城墙后 WALL.houseGap 起盖（城门内留一片空场）：在城外看不到民房「坐在」城墙上
    for (let y = M.outside.wallY - WALL.houseGap; y > s.innerGateY + 140; y -= 180) for (const side of [-1, 1]) {
      const near = s.points.some(p => Math.abs(p.y - y) < 120 && Math.sign(p.x) === side); if (near) continue;
      const f = (Math.abs(Math.round(y / 180)) + (side > 0 ? 1 : 0)) % 3;
      this.art(side * (a.right + houseW / 2 - 6), y, [ART.street, f], ['sishui_props_refined', 2], houseW, this.has(ART.street) ? houseW * .9 : houseW);
    }
    // 据点建筑（粮仓 / 兵营），贴在街边
    s.points.forEach((p, i) => this.art(Math.sign(p.x) * (a.right + 110), p.y + 40, [ART.street, 3 + i], ['sishui_props_refined', 2], 260, this.has(ART.street) ? 240 : 260));
    // 路障
    for (const [x, y] of [[-150, -1100], [140, -1460]] as const) this.art(x, y, [ART.street, 5], ['yellow_props', 26], 120);
    // 内城门
    this.innerGateImg = this.art(0, s.innerGateY + 10, [ART.hall, 4], ['sishui_props_refined', 0], 300);
  }

  private buildHall() {
    const H = M.hall, a = H.arena;
    this.box({ left: a.left - 400, right: a.left, top: a.top - 200, bottom: a.bottom });
    this.box({ left: a.right, right: a.right + 400, top: a.top - 200, bottom: a.bottom });
    this.box({ left: a.left, right: a.right, top: a.top - 200, bottom: a.top });
    this.art(0, a.top + 40, [ART.hall, 0], ['sishui_props_refined', 0], 560, this.has(ART.hall) ? 300 : 300);
    this.art(0, a.top + 80, [ART.hall, 1], ['yellow_props', 31], 220, this.has(ART.hall) ? 90 : 90);
    for (const c of H.corridors) for (const dy of [-150, 0, 150]) this.art(c.x, c.y + dy + 60, [ART.hall, 2], ['sishui_props_refined', 3], 120, 150);
    for (const x of [-170, 170]) this.art(x, a.top + 130, [ART.hall, 3], ['yellow_props', 32], 90).setFlipX(x > 0);
    this.art(-330, -1900, [ART.hall, 6], ['yellow_props', 30], 110);
    this.art(330, -1900, [ART.hall, 5], ['sishui_props_refined', 6], 120, 170);
  }

  // ---------- 冲车 ----------
  private newRam(): Ram {
    const c = M.outside.camp, sz = M.ram.size;
    const img = this.art(c.x, c.y - 40, [ART.ram, 0], ['yellow_props', 24], sz);
    const label = worldText(this.h.scene, c.x, c.y - 40 - sz, '', 13, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(label);
    return { img, x: c.x, y: c.y - 40, hp: this.ramCfg.hp, state: 'move', hitAt: 0, frame: 0, label, contact: new Map(), guardUntil: 0, burnUntil: 0, burnFxAt: 0, flashUntil: 0 };
  }
  get ramInfo() { const r = this.ram; return r ? { x: r.x, y: r.y, hp: r.hp, state: r.state, readyIn: Math.max(0, Math.round(this.ramReadyAt - this.h.now())), spare: this.spareLeft, level: this.ramCfg.level } : null; }
  /** 冲车「受击」提示到期时间（顶部目标行显示）与下次可提示时间。 */
  private ramAlertUntil = 0; private ramAlertNext = 0;
  /** 冲车受伤：arrow = 普通箭（蒙皮顶棚只吃 25%），melee = 敌兵砍，burn = 起火持续伤害（不受免伤）。普通箭 / 砍击后 0.5 秒免伤。 */
  private damageRam(d: number, src: 'arrow' | 'melee' | 'burn' = 'melee') {
    const r = this.ram, now = this.h.now(); if (!r || r.state === 'wreck') return;
    if (src !== 'burn') { if (now < r.guardUntil) return; r.guardUntil = now + M.ram.guardMs; }
    if (src === 'arrow') d *= M.ram.arrowMul;
    r.flashUntil = now + 260; if (now >= this.ramAlertNext) { this.ramAlertNext = now + M.ram.alertCdMs; this.ramAlertUntil = now + 1500; }
    r.hp -= d; r.img.setTintFill(0xffffff); this.h.scene.time.delayedCall(70, () => r.img.active && r.img.clearTint());
    if (r.hp > 0) { if (r.hp < this.ramCfg.hp * .45 && this.has(ART.ram)) r.img.setFrame(4); return; }
    r.state = 'wreck'; this.stats.ramsLost++;
    // 有备用台数就不用等冷却
    if (this.spareLeft > 0) { this.spareLeft--; this.ramReadyAt = this.h.now(); } else this.ramReadyAt = this.h.now() + this.ramCfg.respawnMs;
    if (this.has(ART.ram)) r.img.setTexture(ART.ram, 5); else r.img.setTint(0x4a3a30).setAlpha(.8);
    playSheet(this.h.scene, 'fx_collapse_dust', r.x, r.y - 20, { size: 200, depth: DEPTH.fx, ms: 600 });
    r.label.setText('');
    this.h.sfx('propBreak'); this.h.banner('冲车被毁', true, this.ramReadyAt > this.h.now() ? `回营地重领 · 冷却 ${Math.ceil(this.ramCfg.respawnMs / 1000)} 秒` : '回营地领备用冲车');
  }
  private updateRam(dt: number, now: number) {
    const r = this.ram, p = this.h.player, gateY = this.tier === 'large' && !this.bridgeDown ? L.moat.bottom + 40 - M.ram.size * .1 : M.outside.wallY + 30 + 20;
    if (!r) return;
    if (r.state === 'wreck') {
      const c = M.outside.camp, left = Math.ceil((this.ramReadyAt - now) / 1000);
      this.campLabel?.setText(left > 0 ? `营地 · 新冲车 ${left} 秒` : '营地 · 冲车可领');
      if (now >= this.ramReadyAt && Math.hypot(p.x - c.x, p.y - c.y) <= c.radius) {
        r.img.destroy(); r.label.destroy(); this.ram = this.newRam(); this.campLabel?.setText('营地'); this.stats.ramsTaken++; this.h.banner('领到新冲车', false, '护送它到城门');
      }
      return;
    }
    if (r.state === 'move') {
      const near = Math.hypot(p.x - r.x, p.y - r.y) <= M.ram.escortRadius;
      const tx = 0, ty = gateY + M.ram.size * .1, dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
      if (d < 6 && (this.tier !== 'large' || this.bridgeDown)) { r.state = 'ram'; r.hitAt = now + 400; }
      else if (near) { const s = Math.min(d, M.ram.speed * dt); r.x += dx / d * s; r.y += dy / d * s; }
      r.label.setText(d < 6 ? `冲车 ${Math.ceil(r.hp)} · 吊桥未落` : near ? `冲车 ${Math.ceil(r.hp)}` : `冲车 ${Math.ceil(r.hp)} · 靠近护送`);
    } else if (r.state === 'ram') {
      // 撞门：帧 0→1（拉起）→2（撞出）→3（回弹）
      const T = this.ramCfg.hitEveryMs, t = (now - r.hitAt + T) % T / T;
      const f = t < .45 ? 1 : t < .62 ? 2 : t < .8 ? 3 : 0;
      if (this.has(ART.ram) && r.img.frame.name !== String(f)) r.img.setFrame(f);
      if (now >= r.hitAt) { r.hitAt = now + T; this.stats.ramHits++; this.hitGate(this.ramCfg.gateDamage); }
      r.label.setText(`冲车 ${Math.ceil(r.hp)} · 撞门中`);
    }
    r.img.setPosition(r.x, r.y).setDepth(actorDepth(r.y)); r.label.setPosition(r.x, r.y - M.ram.size * .95).setColor(now < r.flashUntil ? '#ff6a50' : now < r.burnUntil ? '#ffb070' : '#ffe1a0');
    // 起火：持续掉血（手绘火焰序列帧），主将站到旁边扑灭
    if (now < r.burnUntil) {
      if (Math.hypot(p.x - r.x, p.y - r.y) <= M.ram.fire.putOutRadius) { r.burnUntil = 0; this.stats.putOut++; this.h.banner('火已扑灭', false); }
      else {
        this.stats.burns += dt; this.damageRam(M.ram.fire.burnDps * dt, 'burn'); if (this.ram !== r || (r.state as string) === 'wreck') return;
        if (now >= r.burnFxAt) { r.burnFxAt = now + 380; playSheet(this.h.scene, 'fx_ground_fire', r.x + (Math.random() - .5) * 50, r.y - 30, { size: 90, depth: actorDepth(r.y) + 1, ms: 420, alpha: .9 }); }
      }
    }
    // 敌兵围攻冲车（接触伤害，带冷却）
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.kind === 'archer') continue;
      if (Math.hypot(e.x - r.x, e.y - r.y) > e.radius + 46) continue;
      const last = r.contact.get(e.uid) ?? 0; if (now < last) continue;
      r.contact.set(e.uid, now + M.ram.contactCdMs); this.damageRam(e.def.damage * M.ram.contactDamageMul, 'melee');
      if (this.ram?.state === 'wreck') break;
    }
  }
  /** 敌兵寻路：一半敌兵（uid 偶数）在冲车附近时转去打冲车。返回 true 表示已接管。 */
  steer(e: Enemy, dt: number): boolean {
    const r = this.ram;
    if (this.phase !== 'outside' || !r || r.state === 'wreck' || e.kind === 'boss' || e.kind === 'archer' || e.uid % 2) return false;
    const dx = r.x - e.x, dy = r.y - e.y, d = Math.hypot(dx, dy);
    if (d > M.ram.enemyAggroRadius) return false;
    if (d < 40) { this.h.advance(e, 0, 0, dt); return true; }
    this.h.advance(e, dx / d, dy / d, dt); return true;
  }

  // ---------- 城门 ----------
  hitGate(d: number) {
    if (this.phase !== 'outside' || this.gateHp <= 0) return;
    this.gateHp = Math.max(0, this.gateHp - d);
    if (this.woodGate?.e.active && this.woodGate.e.spawnId === this.woodGate.life) this.woodGate.e.hp = Math.max(1, this.gateHp);
    this.h.scene.cameras.main.shake(120, .004);
    playSheet(this.h.scene, 'fx_collapse_dust', (Math.random() - .5) * 60, M.outside.wallY + 20, { size: 120, depth: DEPTH.fx, ms: 420, alpha: .7 });
    this.h.sfx('propBreak');
    if (this.gateHp <= 0) this.breakGate();
  }
  private breakGate() {
    const wy = M.outside.wallY, sc = this.h.scene;
    if (this.gateBox) { const i = this.h.footprints.indexOf(this.gateBox); if (i >= 0) this.h.footprints.splice(i, 1); this.gateBox = null; }
    if (this.woodGate) { if (this.woodGate.e.active && this.woodGate.e.spawnId === this.woodGate.life) this.woodGate.e.deactivate(); this.woodGate = null; }
    this.gateLabel?.setText('');
    // 城门倒塌：有手绘序列帧就播（8 帧），没有就用扬尘序列帧 + 换成破城门图
    if (this.has(ART.gateFx) && this.gateImg) {
      const g = this.gateImg;
      // 用场景时钟逐帧播（跟随游戏步进），8 帧约 1.1 秒，停在最后一帧（门洞敞开）
      for (let i = 1; i < 8; i++) sc.time.delayedCall(i * 140, () => { if (g.active) g.setFrame(i); });
    } else {
      if (this.has(ART.walls)) this.gateImg?.setTexture(ART.walls, 2).setDisplaySize(260, 260); else this.gateImg?.setAlpha(.35);
      for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 160, () => playSheet(sc, 'fx_collapse_dust', (i - 1) * 70, wy + 10, { size: 240, depth: DEPTH.fx, ms: 700 }));
    }
    sc.cameras.main.shake(380, .008);
    this.h.sfx('bossSummon');
    if (this.ram) { this.ram.label.setText(''); }
    this.h.banner('城门已破！', true, '全军杀入城中');
    sc.time.delayedCall(1300, () => this.transition(this.nextPhase('outside')));
  }

  // ---------- 城头箭雨 ----------
  private updateVolley(now: number) {
    const alive = this.towersAlive, total = this.prof.towers.length, idx = alive >= total ? 0 : alive > 0 ? 1 : 2, V = M.outside.volley, p = this.h.player;
    if (now >= this.volleyAt) {
      this.volleyAt = now + V.everyMs[idx]; this.stats.volleys++;
      const n = Math.max(1, Math.round(V.zones[idx] * this.prof.volleyMul));
      for (let i = 0; i < n; i++) {
        // 落点：第一处对准主将（略提前），其余散在主将 / 冲车附近
        const target = i === 0 || !this.ram || this.ram.state === 'wreck' ? p : (i % 2 ? this.ram : p);
        const jx = i === 0 ? 0 : (Math.random() - .5) * 260, jy = i === 0 ? 0 : (Math.random() - .5) * 180;
        const y = Math.min(M.outside.arena.bottom - 40, Math.max(M.outside.wallY + 60, target.y + jy));
        const R = this.ram, fire = target === R && !!R && R.hp < this.ramCfg.hp * M.ram.fire.hpGate && Math.random() < M.ram.fire.chance; // 冲车受损后：瞄冲车的箭雨有时换火箭
        this.zones.push({ x: target.x + jx, y, at: now + V.warnMs, id: 'mid-volley-' + (this.zoneSeq++), fire }); this.stats.zones++; if (fire) this.stats.fireArrows++;
      }
    }
    const fx = warnFx(this.h.scene);
    for (const z of [...this.zones]) {
      const prog = 1 - (z.at - now) / V.warnMs;
      if (now < z.at) { fx.circle(z.id, z.fire ? 'fire' : 'arrows', z.x, z.y, V.radius, prog, now); continue; }
      fx.shapeImpact(z.id, z.fire ? 'fire' : 'arrows', z.x, z.y, V.radius, 0, now, 0, { scale: 1, alpha: .85 });
      if (Math.hypot(p.x - z.x, p.y - z.y) <= V.radius + p.radius) p.takeDamage(V.damage, now);
      this.h.hurtTroops(z.x, z.y, V.radius, V.allyDamage);
      if (this.ram && this.ram.state !== 'wreck' && Math.hypot(this.ram.x - z.x, this.ram.y - z.y) <= V.radius + 40) { this.damageRam(V.ramDamage, 'arrow'); if (z.fire && this.ram && (this.ram.state as string) !== 'wreck') { if (!(this.ram.burnUntil > now)) this.h.banner('冲车着火', true, '站到冲车旁扑灭'); this.ram.burnUntil = now + M.ram.fire.burnMs; } }
      this.zones.splice(this.zones.indexOf(z), 1);
    }
  }
  get towersAlive() { return this.towers.filter(t => t.e.active && t.e.spawnId === t.life).length; }
  get volleyZones() { return this.zones.length; }
  onKilled(e: Enemy) {
    if (this.woodGate && e === this.woodGate.e && e.spawnId === this.woodGate.life) { this.woodGate = null; if (this.gateHp > 0) { this.gateHp = 0; this.breakGate(); } return true; }
    if (this.innerGate && e === this.innerGate.e && e.spawnId === this.innerGate.life) { this.innerGate = null; this.breakInnerGate(); return true; }
    const rope = this.ropes.find(r => r.e === e && r.life === e.spawnId);
    if (rope) { this.ropes.splice(this.ropes.indexOf(rope), 1); this.stats.ropesCut++; this.art(rope.x, rope.y, ['yellow_props', 27], ['yellow_props', 27], 90).setAlpha(.8); this.h.banner(this.ropes.length ? '砍断一根吊桥绳索' : '绳索尽断', false, this.ropes.length ? '还剩 1 根' : '吊桥落下！'); if (!this.ropes.length) this.lowerBridge(false); return true; }
    const t = this.towers.find(t => t.e === e && t.life === e.spawnId);
    if (t) {
      this.towers.splice(this.towers.indexOf(t), 1);
      this.art(t.x, M.outside.wallY + 26, [ART.walls, 4], ['sishui_props_refined', 3], 150).setAlpha(this.has(ART.walls) ? 1 : .55);
      this.h.banner(this.towers.length ? '箭楼已毁 · 箭雨减弱' : '箭楼尽毁 · 箭雨稀疏', false);
      return true;
    }
    const g = this.guards.findIndex(x => x.e === e && x.life === e.spawnId); if (g >= 0) this.guards.splice(g, 1);
    return false;
  }

  // ---------- 刷兵点 ----------
  /** 中城刷兵：按段从固定方向来（城门 / 敌营 / 巷口 / 回廊）。城外敌营存活越多来兵越多。返回 null 表示这次不刷。 */
  spawnPoint(kind: EnemyKind): { x: number; y: number } | null {
    if (this.transitioning) return null;
    const p = this.h.player, r = Math.random();
    if (this.phase === 'outside') {
      const [alive, total] = this.h.campsAlive(), keep = 1 - M.outside.campSpawnBonus * (total - alive);
      if (Math.random() > keep) return null;
      const a = M.outside.arena;
      // 敌兵从城里出（城门两侧出城为主）、两翼只在上半段；下方是我方营地 / 冲车来路，不刷兵（用户 11-17「攻城战的敌军不会从攻城车那一侧出」）
      const rearY = a.bottom - (a.bottom - a.top) * SIEGE_SPAWN.rearCut, moatUp = this.tier === 'large' && !this.bridgeDown, topY = moatUp ? L.moat.bottom + 40 : M.outside.wallY + 80;
      // 大城吊桥未放：城里的兵过不了河，只有两翼敌营方向来人；放桥后从吊桥出城
      if (!moatUp && r < SIEGE_SPAWN.gateShare) return { x: (Math.random() - .5) * 2 * (M.outside.gate.halfW + 200), y: M.outside.wallY + 60 }; // 城门两侧出城
      return { x: Math.random() < .5 ? a.left + 40 : a.right - 40, y: Math.max(topY, Math.min(rearY - 20, p.y - 120 - Math.random() * 260)) }; // 两翼（上半段）
    }
    if (this.phase === 'barbican') {
      const d = L.barbican.doors[Math.floor(Math.random() * L.barbican.doors.length)];
      return { x: d.x + (d.x < L.barbican.cx ? 30 : -30), y: d.y + (Math.random() - .5) * 60 };
    }
    if (this.phase === 'street') {
      const a = M.street.arena;
      if (r < .55) return { x: (Math.random() - .5) * 300, y: Math.max(a.top + 50, p.y - 420) }; // 前方巷口
      return { x: Math.random() < .5 ? a.left + 30 : a.right - 30, y: Math.max(a.top + 50, p.y - 150 - Math.random() * 200) }; // 侧巷（前方；身后是我军来路，不刷）
    }
    if (this.phase === 'hall') {
      if (kind === 'cavalry') return null;
      const c = M.hall.corridors[Math.random() < .5 ? 0 : 1];
      return { x: c.x, y: c.y + (Math.random() - .5) * 300 };
    }
    return null;
  }

  // ---------- 第二段：巷战 ----------
  private enterStreet() {
    const s = M.street, sc = this.h.scene;
    this.points = s.points.map(pt => ({ ...pt, state: 'open' as const, progress: 0, hold: 0, lost: 0, counterAt: 0,
      label: (() => { const l = worldText(sc, pt.x, pt.y - pt.radius - 30, '', 15, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4); this.objects.push(l); return l; })(),
      gfx: (() => { const g = sc.add.graphics().setDepth(DEPTH.ground + 3); this.objects.push(g); return g; })() }));
    for (const b of s.barrels) this.h.spawnBarrel(b.x, b.y);
    this.ambushAt = this.h.now() + 4000;
    this.h.banner('巷战 · 夺取据点', true, '占下粮仓、兵营，顶住守军反扑 20 秒');
  }
  get pointsInfo() { return this.points.map(p => ({ name: p.name, state: p.state, progress: +p.progress.toFixed(2), hold: +p.hold.toFixed(1) })); }
  private updateStreet(dt: number, now: number) {
    const s = M.street, p = this.h.player;
    for (const pt of this.points) {
      const inside = Math.hypot(p.x - pt.x, p.y - pt.y) <= pt.radius;
      let foes = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - pt.x, e.y - pt.y) <= pt.radius) foes++;
      if (pt.state === 'open') {
        if (inside) pt.progress = Math.min(1, pt.progress + dt / s.captureSeconds * (foes ? s.contestedMul : 1));
        if (pt.progress >= 1) this.takePoint(pt, now);
      } else if (pt.state === 'held') {
        pt.hold += dt;
        if (!inside && foes) pt.lost += dt; else pt.lost = Math.max(0, pt.lost - dt * .5);
        if (now >= pt.counterAt) { pt.counterAt = now + s.counterEveryMs; for (let i = 0; i < s.counterBurst; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 1.6; this.h.spawnEnemy(Math.random() < .25 ? 'shield' : 'infantry', pt.x + Math.cos(a) * 420, Math.max(s.arena.top + 40, pt.y + Math.sin(a) * 420)); } }
        if (pt.lost >= s.loseSeconds) { pt.state = 'open'; pt.progress = 0; pt.hold = 0; pt.lost = 0; pt.flag?.destroy(); pt.flag = undefined; this.h.banner(`${pt.name}失守`, true, '重新占领'); }
        else if (pt.hold >= s.holdSeconds) this.securePoint(pt);
      }
      const g = pt.gfx.clear(), col = pt.state === 'secured' ? 0x8fe0b4 : pt.state === 'held' ? 0xe8c76a : 0xd8b07a;
      g.fillStyle(col, inside ? .18 : .1).fillEllipse(pt.x, pt.y, pt.radius * 2, pt.radius * 1.3).lineStyle(3, foes && pt.state !== 'secured' ? 0xd65a3f : col, .9).strokeEllipse(pt.x, pt.y, pt.radius * 2, pt.radius * 1.3);
      const prog = pt.state === 'open' ? pt.progress : pt.state === 'held' ? pt.hold / s.holdSeconds : 1;
      if (prog > 0 && pt.state !== 'secured') { g.lineStyle(6, pt.state === 'held' ? 0xe8c76a : 0x8fe0b4, 1); g.beginPath(); g.arc(pt.x, pt.y, pt.radius * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); g.strokePath(); }
      pt.label.setText(pt.state === 'open' ? `${pt.name} · 占领 ${Math.round(pt.progress * 100)}%` : pt.state === 'held' ? `${pt.name} · 顶住反扑 ${Math.max(0, Math.ceil(s.holdSeconds - pt.hold))} 秒${pt.lost > 0 ? ' · 快回据点！' : ''}` : `${pt.name} · 已占`);
    }
    // 屋顶伏兵：预警（伏兵旗影）后从两侧屋顶跳下
    if (now >= this.ambushAt) {
      this.ambushAt = now + s.ambush.everyMs; this.stats.ambushes++;
      const n = s.ambush.count[0] + Math.floor(Math.random() * (s.ambush.count[1] - s.ambush.count[0] + 1));
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, x = side * s.ambush.roofX, y = Math.max(s.arena.top + 60, Math.min(s.arena.bottom - 60, p.y - 60 - Math.random() * 220));
        warnFx(this.h.scene).ambush(x, y, 70); this.ambushPending.push({ x, y, at: now + s.ambush.warnMs, kind: i === 0 ? 'shield' : 'infantry' });
      }
    }
    for (const a of [...this.ambushPending]) if (now >= a.at) {
      this.ambushPending.splice(this.ambushPending.indexOf(a), 1);
      const e = this.h.spawnEnemy(a.kind, a.x, a.y, true);
      if (e) { const s0 = e.sprite.y; e.sprite.y = s0 - 90; this.h.scene.tweens.add({ targets: e.sprite, y: s0, duration: 260, ease: 'Quad.In' }); playSheet(this.h.scene, 'fx_collapse_dust', a.x, a.y + 6, { size: 90, depth: DEPTH.fx, ms: 380, alpha: .7 }); }
    }
    if (this.points.length && this.points.every(pt => pt.state === 'secured') && !this.transitioning && this.phase === 'street') this.openInnerGate();
  }
  private takePoint(pt: Point, now: number) {
    pt.state = 'held'; pt.hold = 0; pt.lost = 0; pt.counterAt = now + 1200;
    pt.flag = this.art(pt.x + 40, pt.y + 10, [ART.ram, 6], ['zhuge_banner', 0], 90, 130);
    this.h.recruit(M.street.reinforce); this.h.sfx('bossSummon');
    this.h.banner(`占领${pt.name} · 插旗`, false, `守军反扑！守住 ${M.street.holdSeconds} 秒`);
  }
  private securePoint(pt: Point) {
    pt.state = 'secured'; this.h.recruit(M.street.secureReinforce); this.h.player.heal(this.h.player.maxHp * M.street.secureHeal);
    const left = this.points.filter(p => p.state !== 'secured').length;
    this.h.banner(`${pt.name}已守住`, false, left ? `补员完成 · 还剩 ${left} 个据点` : '内城门已开 · 直取府衙');
  }
  private openInnerGate() {
    if (this.innerGateBox) { const i = this.h.footprints.indexOf(this.innerGateBox); if (i >= 0) this.h.footprints.splice(i, 1); this.innerGateBox = null; }
    this.innerGateImg?.setVisible(false); // 内城门洞开：门楼撤掉，扬尘遮住切换
    playSheet(this.h.scene, 'fx_collapse_dust', 0, M.street.innerGateY, { size: 240, depth: DEPTH.fx, ms: 700 });
    this.h.scene.cameras.main.shake(260, .006);
    this.transitioning = true; this.h.scene.time.delayedCall(1100, () => { this.transitioning = false; this.transition(this.nextPhase('street')); });
  }

  // ---------- 第三段：府衙 ----------
  private enterHall() {
    this.guardsAt = this.h.now() + 6000; this.skillAt = this.h.now() + 3500;
    this.h.banner(`${this.hallName} · 决战${this.h.opts?.bossName ?? '守将'}`, true, '亲卫在场时守将有护盾，先清亲卫');
    this.h.scene.time.delayedCall(900, () => this.h.spawnBoss());
  }
  /** 亲卫存活数（护盾判定）。 */
  get guardsAlive() { this.guards = this.guards.filter(g => g.e.active && g.e.spawnId === g.life); return this.guards.length; }
  /** 守将受伤倍率：亲卫在场时减伤。 */
  bossDamageMul(): number { if (this.phase !== 'hall' || !this.guardsAlive) return 1; this.stats.shieldHits++; return M.hall.shieldMul; }
  private updateHall(dt: number, now: number) {
    const H = M.hall, boss = this.h.boss();
    if (boss?.active && now >= this.guardsAt) {
      this.guardsAt = now + this.prof.hall.guardsEveryMs * (this.bossPhase2 ? .75 : 1); this.stats.guardWaves++;
      for (let i = 0; i < this.prof.hall.guardCount; i++) { const c = H.corridors[i % 2]; const e = this.h.spawnEnemy(H.guardKind, c.x + (c.x < 0 ? 30 : -30), c.y + (i - 1) * 60, true); if (e) this.guards.push({ e, life: e.spawnId }); }
      this.h.banner('亲卫杀出回廊', true, '亲卫在场，守将受伤大减');
    }
    // 外部首领控制器（大城名将 / 第七章刘璋）：半血时这里也报一次「死战」，亲卫提前杀出
    if (boss?.active && this.h.opts?.externalBoss && this.prof.hall.phase2 && !this.bossPhase2 && boss.hp / boss.maxHp <= H.phase2At) { this.bossPhase2 = true; this.guardsAt = Math.min(this.guardsAt, now + 1500); if (this.tier === 'large') this.h.banner(`${this.h.opts?.bossName ?? '大将'}死战！`, true, '二阶段 · 招式更狠，亲卫更频'); }
    if (boss?.active && this.guardsAlive) warnFx(this.h.scene).ring(this.shieldRingId, 'lubu', boss.x, boss.y - 10, boss.radius * 3.2, now, .42);
    void dt;
  }
  /** 守将行动：一阶段追击 + 横扫；二阶段（≤50%）加冲锋。返回 true 表示已接管移动。 */
  stepBoss(boss: Enemy, dt: number, now: number): boolean {
    if (this.phase !== 'hall' || this.h.opts?.externalBoss) return false;
    const H = M.hall, p = this.h.player, fx = warnFx(this.h.scene);
    if (this.prof.hall.phase2 && !this.bossPhase2 && boss.hp / boss.maxHp <= H.phase2At) {
      this.bossPhase2 = true; boss.sprite.setTint(0xffb08a); this.h.scene.time.delayedCall(240, () => boss.sprite.active && boss.sprite.clearTint());
      this.h.banner('守将死战！', true, '二阶段 · 小心冲锋'); this.guardsAt = Math.min(this.guardsAt, now + 1500); this.h.sfx('bossSummon');
    }
    const sk = this.skill;
    if (sk) {
      const id = 'mid-boss-skill', prog = 1 - (sk.at - now) / (sk.kind === 'sweep' ? H.sweep.warnMs : H.charge.warnMs);
      if (now < sk.at) {
        if (sk.kind === 'sweep') fx.sector(id, boss.x, boss.y, H.sweep.radius, sk.angle, prog, now);
        else fx.lane(id, 'charge', boss.x, boss.y, sk.angle, H.charge.length, H.charge.width, prog, now);
        boss.moveVx = boss.moveVy = 0; this.h.advance(boss, 0, 0, dt); return true;
      }
      if (!sk.hit) {
        sk.hit = true; this.stats.bossSkills++;
        if (sk.kind === 'sweep') {
          fx.shapeImpact(id + now, 'sweep', boss.x, boss.y, H.sweep.radius, sk.angle, now);
          const a = Math.atan2(p.y - boss.y, p.x - boss.x), da = Math.abs(Phaser.Math.Angle.Wrap(a - sk.angle));
          if (Math.hypot(p.x - boss.x, p.y - boss.y) <= H.sweep.radius + p.radius && da <= H.sweep.arc / 2) p.takeDamage(H.sweep.damage, now);
          this.h.hurtTroops(boss.x, boss.y, H.sweep.radius, H.sweep.damage * .6);
          this.skill = null;
        } else {
          fx.shapeImpact(id + now, 'charge', boss.x, boss.y, H.charge.length, sk.angle, now, H.charge.width);
          sk.x = boss.x + Math.cos(sk.angle) * H.charge.length; sk.y = boss.y + Math.sin(sk.angle) * H.charge.length;
        }
      }
      if (sk?.kind === 'charge') {
        const dx = sk.x - boss.x, dy = sk.y - boss.y, d = Math.hypot(dx, dy), s = Math.min(d, H.charge.speed * dt);
        boss.sprite.x += dx / (d || 1) * s; boss.sprite.y += dy / (d || 1) * s;
        if (Math.hypot(p.x - boss.x, p.y - boss.y) <= boss.radius + p.radius + 6) p.takeDamage(H.charge.damage, now);
        if (d < 8) this.skill = null;
        return true;
      }
      if (!this.skill) this.skillAt = now + (this.bossPhase2 ? H.charge.everyMs * .55 : H.sweep.everyMs);
    }
    const dx = p.x - boss.x, dy = p.y - boss.y, d = Math.hypot(dx, dy) || 1;
    if (!this.skill && now >= this.skillAt) {
      const charge = this.bossPhase2 && (this.stats.bossSkills % 2 === 1 || d > H.sweep.radius * 1.4);
      if (charge || d <= H.sweep.radius * 1.15) { this.skill = { kind: charge ? 'charge' : 'sweep', at: now + (charge ? H.charge.warnMs : H.sweep.warnMs), x: 0, y: 0, angle: Math.atan2(dy, dx), hit: false }; return true; }
    }
    const nx = d > 52 ? dx / d : 0, ny = d > 52 ? dy / d : 0;
    boss.moveVx = nx * boss.def.speed; boss.moveVy = ny * boss.def.speed; this.h.advance(boss, nx, ny, dt);
    return true;
  }
  get bossInfo() { return { phase2: this.bossPhase2, guards: this.guardsAlive, skill: this.skill?.kind ?? null }; }
  /** 击败守将、捡完宝箱后：大堂前插旗占领（动画后回调）。 */
  plantFinalFlag(done: () => void) {
    const sc = this.h.scene, y = M.hall.arena.top + 150;
    this.finalFlag = this.art(0, y, [ART.ram, 6], ['zhuge_banner', 0], 120, 170);
    const f = this.finalFlag, h0 = f.displayHeight; f.setDisplaySize(f.displayWidth, 4).setAlpha(.6);
    sc.tweens.add({ targets: f, displayHeight: h0, alpha: 1, duration: M.hall.flagMs * .6, ease: 'Back.Out' });
    this.h.banner(`插旗占领${this.hallName}`, false, `${this.h.opts?.cityName ?? '此城'}归入义军版图`); this.h.sfx('bossSummon');
    this.phase = 'done'; sc.time.delayedCall(M.hall.flagMs, done);
  }

  // ---------- 推进转场 ----------
  /** 黑场推进：清掉身后的敌兵，主将与部曲移到下一块场地的起点。 */
  /** 档位里当前段的下一段。 */
  nextPhase(from: MidSiegePhase): 'barbican' | 'street' | 'hall' { const ph = this.prof.phases, i = ph.indexOf(from as never); return (ph[i + 1] ?? 'hall') as 'barbican' | 'street' | 'hall'; }
  get hallName() { return this.h.opts?.hallName ?? this.prof.hall.name; }
  transition(to: 'barbican' | 'street' | 'hall') {
    if (this.phase === 'done' || this.phase === 'hall' || this.nextPhase(this.phase) !== to) return;
    const sc = this.h.scene, cam = sc.cameras.main, start = to === 'barbican' ? L.barbican.start : to === 'street' ? M.street.start : M.hall.start;
    this.transitioning = true; this.stats.transitions++;
    this.h.player.invulnUntil = Math.max(this.h.player.invulnUntil, this.h.now() + M.transitionMs + 1200);
    cam.fadeOut(M.transitionMs * .4, 8, 6, 4);
    sc.time.delayedCall(M.transitionMs * .45, () => {
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
      this.zones.length = 0; this.ambushPending.length = 0;
      if (this.ram) { this.ram.label.setText(''); }
      const p = this.h.player; p.sprite.setPosition(start.x, start.y);
      this.h.allies().forEach((a, i) => { if (a.active) a.setPosition(start.x + ((i % 5) - 2) * 34, start.y + 50 + Math.floor(i / 5) * 30); });
      cam.scrollX = start.x - cam.width / 2; cam.scrollY = start.y - cam.height / 2;
      this.phase = to;
      if (to === 'barbican') this.enterBarbican(); else if (to === 'street') this.enterStreet(); else this.enterHall();
      cam.fadeIn(M.transitionMs * .45, 8, 6, 4);
      sc.time.delayedCall(M.transitionMs * .45, () => { this.transitioning = false; });
    });
  }

  // ---------- 主循环 ----------
  update(dt: number) {
    const now = this.h.now();
    if (this.phase === 'outside') {
      this.updateVolley(now); this.updateRam(dt, now); this.updateMoat(now); if (this.moatWater) this.moatWater.tilePositionX -= WALL.moatFlow * dt;
      // 小城木门：血量跟着可砍目标走
      const wg = this.woodGate; if (wg && wg.e.active && wg.e.spawnId === wg.life) this.gateHp = Math.ceil(wg.e.hp);
      this.gateLabel?.setText(this.gateHp > 0 ? `${this.prof.ram ? '城门' : '木门'} ${Math.ceil(this.gateHp)}/${this.gateMax}` : '');
    } else if (this.phase === 'barbican') this.updateBarbican(dt, now);
    else if (this.phase === 'street') this.updateStreet(dt, now);
    else if (this.phase === 'hall') this.updateHall(dt, now);
  }
  /** 目标行。 */
  goalLine(): string {
    const T = this.prof.towers.length, tw = ` · 箭楼 ${T - this.towersAlive}/${T}`, pct = Math.round((1 - this.gateHp / this.gateMax) * 100);
    if (this.phase === 'outside' && !this.prof.ram) return `城外 · 砍破木门 ${pct}%${tw}`;
    if (this.phase === 'outside' && this.tier === 'large' && !this.bridgeDown) return `城外 · 砍断吊桥绳索 ${2 - this.ropesLeft}/2${tw}`;
    if (this.phase === 'outside') return `城外 · 冲车撞门 ${pct}%${tw}${this.ram && this.ram.state !== 'wreck' && this.h.now() < this.ramAlertUntil ? (this.ram.burnUntil > this.h.now() ? ' · 冲车着火！' : ' · 冲车受击！') : ''}${this.ram?.state === 'wreck' ? ' · 冲车已毁 · 回营地领新车' : ''}`;
    if (this.phase === 'barbican') return `瓮城 · 砍破内门 ${Math.round((1 - this.innerGateHp / L.barbican.innerGate.hp) * 100)}% · 小心滚木`;
    if (this.phase === 'street') return '巷战 · ' + this.points.map(p => `${p.name}${p.state === 'secured' ? '✓' : p.state === 'held' ? '守' : ''}`).join(' · ');
    if (this.phase === 'hall') return `${this.hallName} · 击败${this.h.opts?.bossName ?? '守将'}${this.guardsAlive ? ' · 亲卫护盾中' : ''}`;
    return '占领完成';
  }
  get transitioningNow() { return this.transitioning; }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; for (const l of this.logs) l.img?.destroy(); this.logs = []; warnFx(this.h.scene).clear(); }
}
