import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyKind } from '../types';
import { DEPTH, actorDepth } from '../config';
import { MID_SIEGE_FILES } from './SiegeMidArt';
import { Strikes } from './BeifaSystems';
import { playSheet } from './SkillFxSheets';
import { SPAWN_TENT, tentIntervalMs } from '../data/spawnTents';
import { registerTents, tentMuster, type TentCtx } from './SpawnTents';

/**
 * 2-1 汜水关（用户 2026-11-18：「这里障碍物很奇怪也没什么用联动和这章节，设计一下」）：
 *  - 关墙横在开局北面（城墙段铺一条），关门居中，门两侧两座箭楼；西凉营帐集中在关前两翼（敌军出兵方向），不再散落在战场中间。
 *  - 箭楼：城头弓手定时朝主将放一轮箭雨（手绘预警圈），可打塌（换毁坏帧）；塌了箭雨停，掉战功（记一名精英）并给主将短时攻击加成。
 *  - 西凉营帐：「西凉列阵」波起，每顶定时出两骑西凉铁骑；打塌后（扬尘 + 余火）这处不再出兵；全塌后本关余下刷兵变稀。
 *  - 关门：前半关紧闭；华雄出阵时关门洞开（城门倒塌序列帧），华雄带亲卫从门里杀出。
 *  - 温酒斩华雄：关羽为主将或随行，华雄出关 30 秒内斩之 → 「温酒斩华雄」，战功加赏（记两名首领）。
 * 美术全部复用：攻城 v2 城墙图集（城墙段 / 城门 / 城门破 / 箭楼 / 箭楼毁）、城门倒塌序列帧、西凉营寨道具（营帐走环境互动的可破坏营帐）。数值初值，交平衡会话。
 */
const CLIFF = 'shu_pass', CLIFF_FILE = 'assets/shu/pass.png', TREES = 'terrain_trees', TREES_FILE = 'assets/terrain/trees.png', BARB = 'siege_mid_barb', BARB_FILE = 'assets/siege-v2/barbican.png';
export const SISHUI_PASS = {
  wallY: -440, wallHalf: 1250, segW: 230, gateW: 270, towerX: 250, towerHp: 420,
  volleyEverySec: 6.5, volleyPoints: 3, volleyR: 68, warnMs: 1300, playerRatio: .05, allyDamage: 12,
  buffMul: 1.2, buffSec: 12,
  tents: [[-560, -300], [-820, -250], [560, -300], [820, -250]] as const, tentHp: 260, tentEverySec: 9, tentRiders: 2,
  thinMul: 1.35, wenjiuSec: 30, guards: 4,
  /** 关墙两端接山崖 + 场地围成封闭矩形（用户 2026-11-18「城墙要过不去，不是绕一下就过去」）：崖壁厚 / 往南到开局点之后多远 / 往北到关墙之后多远；碰撞框分块（导航按最大半边长查询，块不能太大）。 */
  // 城墙专项检查 W1–W3（2026-11-18）：南 / 北边界、崖壁外侧都要画出来，碰撞不超出画面；关内只留 1400（原 2600，北段崖壁只画到 900）
  cliffThick: 520, southReach: 2300, northReach: 1400, chunk: 1100,
} as const;

export interface PassHost {
  scene: Phaser.Scene; player: Player; legion: Legion; now: () => number; elapsed: () => number;
  /** 当前第几波（0 起）。 */ wave: () => number;
  spawn: (k: EnemyKind, x: number, y: number) => Enemy | null;
  spawnTower: (x: number, y: number, hp: number) => Enemy | null;
  placeTent: (x: number, y: number, id: string, hp: number, faction?: number) => Enemy | null;
  envReady: () => boolean;
  banner: (t: string, danger: boolean, c?: string) => void; sfx: (k: string) => void;
  /** 战功：记几名精英 / 首领（结算时按击杀折算）。 */ merit: (elite: number, boss: number) => void;
  /** 关羽在不在队（主将或随行）。 */ guanyu: () => boolean;
  /** 刷兵帐篷统一规则（data/spawnTents；GameScene.tentCtx）。 */ tent?: TentCtx;
}

/** 关墙选项（第 3~12 章的关隘 / 城池复用 2-1 这套；不传 = 2-1 汜水关原样）。 */
export interface PassOpts {
  /** 门两侧箭楼（放箭雨、可打塌）；默认有。 */ towers?: boolean;
  /** 关前营帐出骑；默认有（第 3~12 章已有自己的敌营，传 false）。 */ tents?: boolean;
  /** 温酒斩华雄；默认有。 */ wenjiu?: boolean;
  /** 关墙离开局点多远（负 = 北面）。 */ wallY?: number;
  /** 关门洞开时的横幅（标题、副标题）。 */ gateText?: readonly [string, string];
  /** 名字前缀（截图 / 测试用，默认 sishui）。 */ tag?: string;
  /** 营寨木栅（势力道具图集键，帧 3 = 木栅段）代替城墙、辕门（城墙图集帧 7）代替关门；辕门一直可通行，首领出阵时扬尘杀出。 */ palisade?: string;
  /** 营帐：位置（相对开局点）、出什么兵、哪个势力的帐、第几波（0 起）开始出兵。 */
  tentSpots?: readonly (readonly [number, number])[]; tentRider?: EnemyKind; tentFaction?: number; tentFromWave?: number;
  /** 每次出几个兵（默认 2）。 */ tentCount?: number;
  /** 营帐 / 营寨叫什么（横幅用；默认 西凉营帐 / 西凉营寨）。 */ tentName?: string; campName?: string;
  /** 伏兵预兆：出兵前多少毫秒营帐扬尘、喊「有伏兵」，再从帐里冲出来（2-2 荥阳）。 */ tentWarnMs?: number;
  /** false = 不画关墙 / 关门（只要营帐）。 */ wall?: boolean;
  /** 场地边界画什么：cliff 山崖（关隘）· tower 墙端角楼 + 林带（平原城池）· woods 林带（营寨）。不传：营栅 woods，否则 cliff。 */ ends?: 'cliff' | 'tower' | 'woods';
}

export class SishuiPass {
  readonly footprints: { left: number; right: number; top: number; bottom: number }[] = [];
  private gateFoot: { left: number; right: number; top: number; bottom: number };
  private art: Phaser.GameObjects.Image[] = []; private gateImg: Phaser.GameObjects.Image | null = null;
  towers: { e: Enemy | null; x: number; y: number; at: number; down: boolean }[] = [];
  tents: { e: Enemy | null; x: number; y: number; at: number; down: boolean; warned?: boolean; members: Array<{ e: Enemy; life: number }> }[] = [];
  private unregister: () => void = () => {};
  private tentsPlaced = false; private allTentsDown = false;
  private strikes: Strikes; private buffUntil = 0; private buffed = false;
  gateOpen = false; bossAt = -1; wenjiu = false;
  readonly metrics = { volleys: 0, towersDown: 0, rides: 0, tentsDown: 0, warns: 0 };
  constructor(private h: PassHost, private o: PassOpts = {}) {
    // 舆图小帐 + 屏外边缘提示（systems/SpawnTents）
    this.unregister = registerTents(h.scene, () => this.tents.filter(t => !t.down && t.e?.active).map(t => ({ x: t.x, y: t.y, ratio: t.e!.hp / Math.max(1, t.e!.maxHp), hit: false, awake: t.at > 0 && Math.hypot(h.player.x - t.x, h.player.y - t.y) < 1400 })));
    const P = SISHUI_PASS, p = h.player, wy = p.y + this.wallY;
    // 关墙碰撞：左右两段城墙 + 关门（开门后移除）
    if (o.wall !== false) this.footprints.push({ left: p.x - P.wallHalf, right: p.x - P.gateW / 2, top: wy - 70, bottom: wy - 10 }, { left: p.x + P.gateW / 2, right: p.x + P.wallHalf, top: wy - 70, bottom: wy - 10 });
    this.gateFoot = { left: p.x - P.gateW / 2, right: p.x + P.gateW / 2, top: wy - 70, bottom: wy - 10 }; if (!this.o.palisade && o.wall !== false) this.footprints.push(this.gateFoot);
    if (o.wall !== false) this.sealFlanks(p.x, p.y, wy);
    this.strikes = new Strikes({ scene: h.scene, player: p, army: h.legion, now: h.now });
    const s = h.scene, wall = MID_SIEGE_FILES[0];
    if (o.wall === false) return;
    const need = ([[wall.key, wall.file], [CLIFF, CLIFF_FILE], [TREES, TREES_FILE], [BARB, BARB_FILE]] as Array<[string, string]>).filter(([k]) => !s.textures.exists(k));
    if (!need.length) this.build(); else { for (const [k, f] of need) s.load.spritesheet(k, f, { frameWidth: 384, frameHeight: 384 }); s.load.once('complete', () => { if (s.textures.exists(wall.key)) this.build(); }); if (!s.load.isLoading()) s.load.start(); }
  }
  /** 把一块矩形切成不超过 chunk 的小块（导航按最大半边长查询，整块太大会拖慢）。 */
  private slab(l: number, t: number, r: number, b: number): void {
    const C = SISHUI_PASS.chunk, nx = Math.max(1, Math.ceil((r - l) / C)), ny = Math.max(1, Math.ceil((b - t) / C));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) this.flank++, this.footprints.push({ left: l + (r - l) * i / nx, right: l + (r - l) * (i + 1) / nx, top: t + (b - t) * j / ny, bottom: t + (b - t) * (j + 1) / ny });
  }
  /** 关墙从地图一侧连到另一侧：两端接崖壁，崖壁往南围到场地南边、往北围到关内，再用一道南 / 北边界合上，整块场地封闭（只有关门可通）。 */
  private sealFlanks(px: number, py: number, wy: number): void {
    const P = SISHUI_PASS, W = P.wallHalf, T = P.cliffThick, top = wy - P.northReach, bot = py + P.southReach;
    this.slab(px - W - T, top, px - W, bot); this.slab(px + W, top, px + W + T, bot);
    this.slab(px - W - T, bot, px + W + T, bot + T); this.slab(px - W - T, top - T, px + W + T, top);
    this.cliff = { x0: px - W, x1: px + W, top, bot };
    // 平原城池：墙端角楼底座也挡人（角楼一半压在场内）
    if (this.ends === 'tower') for (const side of [-1, 1]) this.footprints.push(side < 0 ? { left: px - W, right: px - W + 100, top: wy - 70, bottom: wy + 6 } : { left: px + W - 100, right: px + W, top: wy - 70, bottom: wy + 6 }), this.flank++;
  }
  private get ends(): 'cliff' | 'tower' | 'woods' { return this.o.ends ?? (this.o.palisade ? 'woods' : 'cliff'); }
  private flank = 0;
  private cliff: { x0: number; x1: number; top: number; bot: number } | null = null;
  /** 关墙 / 关门 / 箭楼（城墙图集：0 城墙段 · 1 城门 · 2 城门破 · 3 箭楼 · 4 箭楼毁）。 */
  private get wallY(): number { return this.o.wallY ?? SISHUI_PASS.wallY; }
  private get tag(): string { return this.o.tag ?? 'sishui'; }
  private build(): void {
    const P = SISHUI_PASS, s = this.h.scene, p = this.h.player, wy = p.y + this.wallY, K = MID_SIEGE_FILES[0].key, T = this.tag;
    const pal = this.o.palisade && s.textures.exists(this.o.palisade) ? this.o.palisade : null, seg = pal ? 150 : P.segW, segSize = pal ? 190 : P.segW + 8;
    // 城墙段从门两侧往外对称铺（段与段略压一点盖缝）一直铺到崖壁；原来按 -wallHalf 起点铺，左右不对称，门与箭楼之间漏出一截空缺
    for (const side of [-1, 1]) for (let x = P.gateW / 2 + seg / 2 - 24; this.ends === 'tower' ? x + seg / 2 < P.wallHalf + 80 : x - seg / 2 < P.wallHalf; x += seg - 14) this.art.push(s.add.image(p.x + side * x, wy, pal ?? K, pal ? 3 : 0).setOrigin(.5, .97).setDisplaySize(segSize, segSize).setDepth(actorDepth(wy) - .01).setName(T + '-wall').setFlipX(side > 0 && !pal));
    this.buildBounds(wy);
    this.gateImg = s.add.image(p.x, wy + 2, K, this.o.palisade ? 7 : 1).setOrigin(.5, .97).setDisplaySize(P.gateW + 30, P.gateW + 30).setDepth(actorDepth(wy)).setName(T + '-gate');
    if (this.o.towers !== false) for (const side of [-1, 1]) {
      const x = p.x + side * P.towerX, y = wy + 18, e = this.h.spawnTower(x, y, P.towerHp);
      e?.sprite.setTexture(K, 3).setOrigin(.5, .97).setDisplaySize(170, 170);
      this.towers.push({ e, x, y, at: this.h.now() + 4000 + (side > 0 ? 1800 : 0), down: false });
    }
  }
  /**
   * 场地边界的画面（城墙专项检查 W1–W4）：左右两侧、南北两道边界都画满，盖住整块碰撞（崖壁厚 cliffThick，外侧再多画一点，镜头贴边时也看不到空地）。
   * - cliff（关隘）：蜀道山崖图（shu_pass 帧 0 / 1），侧边两列，南北各一排；
   * - tower（平原城池）：墙两端接角楼（瓮城套件 barbican 帧 3），其余边界是林带；
   * - woods（营寨）：营栅两端直接接林带。
   */
  private buildBounds(wy: number): void {
    const c = this.cliff, s = this.h.scene; if (!c) return;
    const P = SISHUI_PASS, T = P.cliffThick, tag = this.tag, style = this.ends;
    const cliffArt = style === 'cliff' && s.textures.exists(CLIFF), treeArt = s.textures.exists(TREES);
    const put = (x: number, y: number, k: number, side: number): void => {
      if (cliffArt) { this.art.push(s.add.image(x, y, CLIFF, side < 0 ? 0 : side > 0 ? 1 : k % 2).setOrigin(.5, 1).setDisplaySize(400, 400).setDepth(actorDepth(y)).setName(tag + '-cliff')); return; }
      if (treeArt) { const f = [0, 2, 7, 4, 2, 0, 7][k % 7], z = 260 + (k * 53) % 70; this.art.push(s.add.image(x, y, TREES, f).setOrigin(.5, .95).setDisplaySize(z, z).setDepth(actorDepth(y)).setName(tag + '-bound')); return; }
      this.art.push(s.add.image(x, y, MID_SIEGE_FILES[0].key, 6).setOrigin(.5, 1).setDisplaySize(300, 300).setDepth(actorDepth(y)).setName(tag + '-bound'));
    };
    const step = cliffArt ? 230 : 150, cols = cliffArt ? [120, 440] : [70, 230, 390, 560], jit = (k: number): number => ((k * 37) % 50) - 25;
    // 左右两侧：从北边界外一路到南边界外
    for (const side of [-1, 1]) cols.forEach((dx, ci) => { for (let y = c.top - 300 + ci * 60, k = ci * 3; y < c.bot + 420; y += step, k++) put(side > 0 ? c.x1 + dx + jit(k) * .4 : c.x0 - dx - jit(k) * .4, y, k, cliffArt ? side : 0); });
    // 南 / 北边界：横贯整个场地（含两侧崖壁宽度），挡住看不见的墙（石板路也到这里为止）
    const rows = cliffArt ? [[c.bot + 360], [c.top + 30]] : [[c.bot + 130, c.bot + 330], [c.top + 30, c.top - 200]];
    for (const ys of rows) ys.forEach((y0, ri) => { for (let x = c.x0 - T, k = ri * 5; x <= c.x1 + T; x += cliffArt ? 220 : 140, k++) put(x + jit(k) * .3, y0 + jit(k + 3) * .5, k, 0); });
    // 平原城池：墙两端角楼
    if (style === 'tower' && s.textures.exists(BARB)) for (const x of [c.x0, c.x1]) this.art.push(s.add.image(x, wy + 6, BARB, 3).setOrigin(.5, .97).setDisplaySize(250, 250).setDepth(actorDepth(wy) + .001).setName(tag + '-corner'));
  }

  /** 每帧（战斗中）。 */
  update(): void {
    const now = this.h.now(), P = SISHUI_PASS, p = this.h.player;
    this.strikes.update();
    if (!this.tentsPlaced && this.o.tents !== false && this.h.envReady()) { this.tentsPlaced = true; (this.o.tentSpots ?? P.tents).forEach(([dx, dy], i) => { const x = p.x + dx, y = p.y + dy, e = this.h.placeTent(x, y, `fixed-${this.tag}-tent-${i}`, P.tentHp, this.o.tentFaction); this.tents.push({ e, x, y, at: 0, down: !e, members: [] }); }); }
    // 箭楼：放箭雨；被打塌换毁坏帧、掉战功、主将短时攻击加成
    for (const t of this.towers) {
      if (t.down) continue;
      if (t.e && !t.e.active) { t.down = true; this.metrics.towersDown++; this.towerDown(t); continue; }
      if (now >= t.at) { t.at = now + P.volleyEverySec * 1000; this.metrics.volleys++; for (let k = 0; k < P.volleyPoints; k++) { const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 60 + Math.random() * 90; this.strikes.add('arrows', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, P.volleyR, P.warnMs, P.playerRatio, P.allyDamage); } this.h.sfx('chargeWarn'); }
    }
    // 西凉营帐：「西凉列阵」（第 2 波）起每顶一直定时出兵，直到被打塌（用户 11-19「生成兵的帐篷应该会多刷新兵直到被摧毁」）：
    // 间隔 / 存活上限按 data/spawnTents（受损更急，首领出场 / 开关门后速度减半，不再停）；打塌后余火、给粮、不再出兵；全塌后余下刷兵变稀
    for (const t of this.tents) {
      if (t.down) continue;
      if (t.e && !t.e.active) { t.down = true; this.metrics.tentsDown++; this.h.tent?.reward?.(t.x, t.y, SPAWN_TENT.grain, false); this.h.sfx('tent_fire'); playSheet(this.h.scene, 'fx_ground_fire', t.x, t.y + 6, { size: 150, ms: 1400, depth: actorDepth(t.y) + .2, originY: .8, name: 'sishui-tent-fire' }); this.h.banner((this.o.tentName ?? '西凉营帐') + '已焚', false, this.tents.every(x => x.down) ? '' : '此处不再出' + ((this.o.tentRider ?? 'cavalry') === 'cavalry' ? '骑' : '兵')); continue; }
      t.members = t.members.filter(m => m.e.active && m.e.spawnId === m.life);
      const ch = this.h.tent?.chapter() ?? 2, cap = SPAWN_TENT.live(ch), full = t.members.length >= cap;
      if (this.h.wave() >= (this.o.tentFromWave ?? 1)) { if (!t.at) t.at = now + 1500 + this.tents.indexOf(t) * 900; const warn = this.o.tentWarnMs ?? 0;
        if (full || (this.h.tent?.crowd() ?? 0) >= SPAWN_TENT.crowdCap) { if (now >= t.at - SPAWN_TENT.musterMs) t.at = now + 1000; continue; } // 本帐兵满 / 同屏太多：先不出，被杀了再补
        if (!warn && !t.warned && now >= t.at - SPAWN_TENT.musterMs) { t.warned = true; tentMuster(this.h.scene, t.x, t.y + 40, SPAWN_TENT.musterMs); } // 帐篷口扬尘：要出兵了
        if (warn && !t.warned && now >= t.at - warn) { t.warned = true; this.metrics.warns++; playSheet(this.h.scene, 'fx_collapse_dust', t.x, t.y + 10, { size: 170, ms: warn, depth: actorDepth(t.y) + .3, originY: .8, name: this.tag + '-tent-warn' }); this.h.sfx('chargeWarn'); if (this.metrics.warns === 1) this.h.banner('营中有伏兵', true, '看到营帐扬尘就是伏兵要冲出 · 烧掉营帐断其伏兵'); }
        if (now >= t.at) { t.at = now + tentIntervalMs(ch, t.e ? t.e.hp / Math.max(1, t.e.maxHp) : 1, this.gateOpen || (this.h.tent?.bossOn() ?? false)); t.warned = false; const n = this.o.tentCount ?? P.tentRiders, p0 = this.h.player, a = Math.atan2(p0.y - t.y, p0.x - t.x); for (let k = 0; k < n && t.members.length < cap; k++) { const o = (k - (n - 1) / 2) * 44, u = this.h.spawn(this.o.tentRider ?? 'cavalry', t.x + Math.cos(a) * 60 - Math.sin(a) * o, t.y + 30 + Math.sin(a) * 60 + Math.cos(a) * o); if (u) { this.metrics.rides++; t.members.push({ e: u, life: u.spawnId }); } } } }
    }
    if (!this.allTentsDown && this.tents.length && this.tents.every(t => t.down)) { this.allTentsDown = true; this.h.banner((this.o.campName ?? '西凉营寨') + '尽毁', true, '敌军后继乏力 · 余下来兵变稀'); }
    if (this.buffed && now >= this.buffUntil) { this.buffed = false; p.stats.damageMul /= P.buffMul; }
  }
  /** 刷兵间隔倍率（GameScene.updateSpawner）：营帐全塌后变稀。 */
  get spawnMul(): number { return this.allTentsDown ? SISHUI_PASS.thinMul : 1; }
  private towerDown(t: { x: number; y: number }): void {
    const s = this.h.scene, P = SISHUI_PASS, K = MID_SIEGE_FILES[0].key;
    if (s.textures.exists(K)) this.art.push(s.add.image(t.x, t.y, K, 4).setOrigin(.5, .97).setDisplaySize(170, 170).setDepth(actorDepth(t.y)).setName(this.tag + '-tower-ruin'));
    playSheet(s, 'fx_collapse_dust', t.x, t.y, { size: 210, ms: 650, depth: DEPTH.fx, originY: .8, name: 'sishui-tower-dust' });
    s.cameras.main.shake(140, .004);
    this.h.merit(1, 0);
    if (!this.buffed) { this.buffed = true; this.h.player.stats.damageMul *= P.buffMul; }
    this.buffUntil = this.h.now() + P.buffSec * 1000;
    this.h.banner('箭楼已毁', false, `箭雨停了 · 战功 +1 · 攻击 +${Math.round((P.buffMul - 1) * 100)}%（${P.buffSec} 秒）`);
  }
  /** 华雄出阵：关门洞开（城门倒塌序列帧），华雄带亲卫从门里杀出。 */
  onBoss(boss: Enemy): void {
    if (this.gateOpen) return;
    const s = this.h.scene, P = SISHUI_PASS, p = this.h.player, gx = this.gateImg?.x ?? p.x, gy = (this.gateImg?.y ?? p.y + this.wallY) + 40;
    this.gateOpen = true; this.bossAt = this.h.now();
    const i = this.footprints.indexOf(this.gateFoot); if (i >= 0) this.footprints.splice(i, 1);
    if (!this.o.palisade) this.gateImg?.setFrame(2);
    const fx = MID_SIEGE_FILES[1].key;
    if (s.textures.exists(fx) && !this.o.palisade) { const img = s.add.image(gx, gy - 40, fx, 0).setOrigin(.5, .9).setDisplaySize(P.gateW + 40, P.gateW + 40).setDepth(DEPTH.fx); const t0 = s.time.now, run = (): void => { const k = Math.floor((s.time.now - t0) / 80); if (k >= 8 || !img.active) { s.events.off('postupdate', run); img.destroy(); return; } img.setFrame(k); }; s.events.on('postupdate', run); }
    else playSheet(s, 'fx_collapse_dust', gx, gy, { size: 260, ms: 700, depth: DEPTH.fx, originY: .8, name: 'sishui-gate-dust' });
    s.cameras.main.shake(260, .007);
    boss.sprite.x = gx; boss.sprite.y = gy;
    for (let k = 0; k < P.guards; k++) this.h.spawn('elite', gx + (k - (P.guards - 1) / 2) * 70, gy + 30 + (k % 2) * 30);
    if (this.o.gateText) { this.h.banner(this.o.gateText[0], true, this.o.gateText[1]); return; }
    this.h.banner('关门洞开', true, this.h.guanyu() ? `华雄出关 · ${P.wenjiuSec} 秒内斩之，可成「温酒斩华雄」` : '华雄率亲卫杀出汜水关');
  }
  /** 温酒斩华雄的条件此刻生效（关羽在队、华雄出关 30 秒内）——首领招降让斩华雄优先，不弹劝降窗。 */
  wenjiuLive(): boolean { return this.bossAt >= 0 && !this.wenjiu && this.o.wenjiu !== false && this.h.guanyu() && this.h.now() - this.bossAt <= SISHUI_PASS.wenjiuSec * 1000; }
  /** 华雄被斩：关羽在队且出关 30 秒内 → 温酒斩华雄。 */
  onBossDown(): void {
    if (this.bossAt < 0 || this.wenjiu || this.o.wenjiu === false) return;
    if (this.h.guanyu() && this.h.now() - this.bossAt <= SISHUI_PASS.wenjiuSec * 1000) { this.wenjiu = true; this.h.merit(0, 2); this.h.banner('温酒斩华雄', true, '其酒尚温 · 战功加赏'); this.h.sfx('gong'); }
  }
  snapshot() { return { gateOpen: this.gateOpen, towers: this.towers.filter(t => !t.down).length, tents: this.tents.filter(t => !t.down).length, tentsPlaced: this.tentsPlaced, spawnMul: this.spawnMul, buffed: this.buffed, wenjiu: this.wenjiu, foot: this.footprints.length - this.flank, metrics: { ...this.metrics }, pending: this.strikes.pending }; }
  clear(): void { this.unregister(); for (const a of this.art) a.destroy(); this.gateImg?.destroy(); this.strikes.clear(); if (this.buffed) { this.buffed = false; this.h.player.stats.damageMul /= SISHUI_PASS.buffMul; } }
}
