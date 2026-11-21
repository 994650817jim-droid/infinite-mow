import Phaser from 'phaser';
import { playMenuMusic } from '../systems/Music';
import { startCityAmbient } from '../systems/ContentSfx';
import { uiSfx } from '../systems/Sfx';
import { defaultHero, loadRoster } from '../systems/RosterStore';
import { checkWorld } from '../systems/Achievements';
import { RENDER_SCALE, screenPoint, TITLE_FONT, HEADING_FONT } from '../config';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { requestDirectDepart } from '../systems/DirectDepart';
import { W, H, worldText, worldButton, worldShell, panel, worldAssets } from '../world/WorldUI';
import { homeCommand } from '../ui/HomeCommand';
import { lqPanel, lqFloat } from '../ui/LacquerKit';
import { addMainMenuButton } from '../ui/MainMenuButton';
import { arcUnlocked, thirdChapterUnlocked, worldUnlocked, loadWorld, rewardGrain, cityLevels, hardChapterCleared, ensureIntel, intelEvents, lubuChallengeOpen, lubuClears, advanceEra, takeLostNotice, takeNewChapters, type CityAlert, type EraAdvance } from '../world/WorldStore';
import { citySize, CITY_TITLE, incomeText } from '../town/TownData';
import { cityIncome, emptyCityLevels } from '../data/cityBuildings';
import { FACTIONS, SPECIALTIES, TIER_NAME, cityById, cityOwner, eraDef, eraIndexFor, type CityDef, type EraId } from '../world/WorldCities';
import { lacquerPlate, resourceBar } from '../world/WorldMapChrome';
import { CHAPTER_TIMELINE, chapterById, chapterStages, chapterState, chapterStagesDone, currentChapter, stageOpen, type TimelineChapterId } from '../world/ChapterTimeline';
import { HARD_MODE, HARD_TITLES } from '../data/hardMode';
import { SIEGE, FIRST_CAPTURE_BONUS, siegeBossName, defenseBossName } from '../data/siege';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { LUBU_CHALLENGE } from '../data/dongzhuo';
import { INTEL_INFO, intelBrief, intelReward, intelTitle, seasonIndex, type IntelEvent } from '../world/WorldIntel';
import { QUALITIES } from '../data/items';
import { MAIN_ROUTE, ROUTE_NODES, nodeChapter, routeNode, routeSiegeOpen, routeView, siegeNodeOf, stageNode, type NodeVis, type RouteNode, type RouteView } from '../world/RouteMap';
import { checkHeroJoins } from '../ui/HeroJoinReveal';

/** 第叁章起各章有自己的选关页（worldStagePick 指定关号）。 */
const CAMPAIGNS = { qunxiong: { open: () => thirdChapterUnlocked(), scene: 'ThirdChapterScene' }, guandu: { open: () => arcUnlocked('guandu'), scene: 'GuanduChapterScene' }, chibi: { open: () => arcUnlocked('chibi'), scene: 'ChibiChapterScene' }, jingnan: { open: () => arcUnlocked('jingnan'), scene: 'JingnanChapterScene' }, shu: { open: () => arcUnlocked('shu'), scene: 'ShuChapterScene' }, hanzhong: { open: () => arcUnlocked('hanzhong'), scene: 'HanzhongChapterScene' }, xiangfan: { open: () => arcUnlocked('xiangfan'), scene: 'XiangfanChapterScene' }, yiling: { open: () => arcUnlocked('yiling'), scene: 'YilingChapterScene' }, nanzheng: { open: () => arcUnlocked('nanzheng'), scene: 'NanzhengChapterScene' }, beifa: { open: () => arcUnlocked('beifa'), scene: 'BeifaChapterScene' } } as const;
type CampaignId = keyof typeof CAMPAIGNS;
type Selection = { kind: 'node'; node: RouteNode } | { kind: 'intel'; event: IntelEvent };
type NodeView = { node?: RouteNode; event?: IntelEvent; root: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Zone; label?: Phaser.GameObjects.Container; ring: Phaser.GameObjects.Image };
type Btn = { image: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; g: Phaser.GameObjects.GameObject; setEnabled: (on: boolean) => void; setVisible: (v: boolean) => void };

const RT = 'assets/world/route/';
/** 征途美术件（ChatGPT 出图，tools/prepare-route-art.py 去底切件）。 */
const ART = ['medal_open', 'medal_cleared', 'medal_locked', 'medal_boss', 'city_enemy', 'city_own', 'city_alert', 'camp', 'pennant_intel', 'pennant_challenge', 'banner_next', 'seal_hard', 'road_done', 'road_todo', 'road_branch', 'foot_1', 'brush', 'cloud_sea', 'cloud_wall', 'cloud_a', 'cloud_b', 'cloud_c', 'cloud_d'] as const;
const MAP_W = 1536, MAP_H = 1024, TILE_N = 3;
/** 镜头三档（相对铺满视口的最小缩放）：全图 / 章节 / 近看。 */
export const ZOOM_TIERS = [1, 2.6, 4] as const;
const SEAL_AT = { x: .77, y: .79 } as const; // 告捷章上朱印中心（相对 medal_cleared）
const GOLD = 0xc9a35e;

/**
 * 天下地图 v2「征途」（2026-11-19，设计稿 side-session-notes/world-map-redesign.md，数据 world/RouteMap.ts）：
 * 一张调淡的汉末舆图；主线关在史事发生地，按故事顺序用手绘土路连起；没到过的地方盖水墨云雾，打下一个点雾沿路散开。
 * 节点只有 4 种样子（主线圆章 / 城池 / 令旗 / 营寨），全图唯一「下一战」；右侧固定详情栏 + 出征。
 * 入口照旧：主线（壹贰章直接开战，叁章起进各章选关页）、攻城 / 守城、军情、三英战吕布（虎牢关）、入城、乱世。
 */
export class WorldMapScene extends Phaser.Scene {
  selected!: Selection;
  view!: RouteView;
  readonly nodes = new Map<string, NodeView>();
  action!: Btn; hardBtn!: Btn;
  detailTitle!: Phaser.GameObjects.Text; detailSub!: Phaser.GameObjects.Text; detail!: Phaser.GameObjects.Text;
  private sealG!: Phaser.GameObjects.Image; private sealT!: Phaser.GameObjects.Text;
  layer!: Phaser.GameObjects.Container;
  nodeLayer!: Phaser.GameObjects.Container;
  private tiles: Array<{ r: number; c: number; img?: Phaser.GameObjects.Image; loading: boolean }> = [];
  area = { x: 0, y: 0, w: 0, h: 0 }; zoom = 1; minZoom = 1;
  private panelBox = { x: 0, y: 0, w: 0, h: 0 };
  private owned: string[] = []; private alerts: CityAlert[] = []; private capturedEver: string[] = []; private era: EraId = 1; intel: IntelEvent[] = [];
  private pointer = { x: 0, y: 0, down: false, moved: 0 }; private pinch = 0; private pinching = false;
  private modal?: Phaser.GameObjects.Container;
  private desktop = true;
  /** 第 2 期动效：本次新露出的点（上次进地图时还没露出）——路线描画、迷雾散开、节点浮现。 */
  fresh = new Set<string>();
  private fogRT?: Phaser.GameObjects.RenderTexture;
  private drawIns: Array<{ rope: Phaser.GameObjects.Rope; pts: Phaser.Math.Vector2[]; feet: Phaser.GameObjects.Image[] }> = [];
  private arrow?: Phaser.GameObjects.Container;
  /** 测试用：动效计数。 */
  readonly fx = { drawn: 0, holes: 0, popped: 0 };

  constructor() { super('WorldMapScene'); }

  preload() {
    if (!worldUnlocked() && !isChapterTestRun()) return;
    worldAssets(this, 'rt_base', RT + 'base_overview.webp');
    for (const k of ART) worldAssets(this, 'rt_' + k, RT + k + '.png');
    this.load.once('complete', () => {
      for (const k of ART) if (this.textures.exists('rt_' + k)) this.textures.get('rt_' + k).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const t = this.textures.get('rt_medal_cleared'); if (t && !t.has('seal')) { const src = t.getSourceImage() as { width: number; height: number }; t.add('seal', 0, Math.round(src.width * .6), Math.round(src.height * .6), Math.round(src.width * .37), Math.round(src.height * .38)); }
    });
  }

  create() { /* 武将来投（systems/HeroUnlocks）：按进度补查、弹没看过的揭幕 */this.time.delayedCall(500,()=>checkHeroJoins(this));
    playMenuMusic(this, 'map'); startCityAmbient(this, k => uiSfx().play(k), ['amb_wind', 'amb_wind', 'amb_horn', 'amb_drum', 'amb_flag']); try { checkWorld(loadWorld()); } catch { /* 存档不可用 */ }
    if (!worldUnlocked() && !isChapterTestRun()) { this.registry.set('loadBattle', true); this.scene.start(this.registry.get('battleReady') ? 'MenuScene' : 'BootScene'); return; }
    this.desktop = W > 600; this.nodes.clear(); this.tiles = []; this.modal = undefined; this.registry.remove('hardChapter');
    const test = isChapterTestRun(), advance = test ? null : advanceEra(), lost = test ? [] : takeLostNotice(); if (!test) ensureIntel();
    const s = loadWorld(); this.owned = s.ownedCities; this.alerts = s.alerts; this.capturedEver = s.capturedEver; this.intel = intelEvents();
    this.era = !s.cleared.hulao ? 0 : eraIndexFor({ hulaoCleared: s.cleared.hulao, warlordStages: s.warlordStages, guanduStages: s.guanduStages });
    this.view = routeView({ progress: s, owned: this.owned, alerts: this.alerts.map(a => a.city), challengeOpen: lubuChallengeOpen(), challengeCleared: lubuClears() > 0, testRun: test });
    this.cameras.main.setBackgroundColor('#1a140e');
    // 版面：电脑版地图在左、详情栏在右；手机版地图在上、详情在下
    const top = this.desktop ? 52 : 100, strip = 40;
    if (this.desktop) { this.panelBox = { x: W - 322, y: top + 6, w: 314, h: H - top - 14 }; this.area = { x: 8, y: top + 4, w: W - 322 - 16, h: H - top - 4 - strip - 8 }; }
    else { this.panelBox = { x: 10, y: H - 300, w: W - 20, h: 292 }; this.area = { x: 10, y: top, w: W - 20, h: H - top - 300 - strip - 10 }; }

    // 新露出的点：和上次进地图时记下的对比（只是界面记忆，存在 im_route_seen_v1，不进存档）；第一次进地图不播
    this.fresh = new Set(); this.drawIns = []; this.fogRT = undefined; this.arrow = undefined; this.fx.drawn = this.fx.holes = this.fx.popped = 0;
    { const KEY = 'im_route_seen_v1', vis = [...this.view.vis].filter(([, v]) => v !== 'hidden').map(([id]) => id); let prev: Set<string> | null = null;
      try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (Array.isArray(v)) prev = new Set(v as string[]); } catch { /* 存储不可用 */ }
      if (prev) for (const id of vis) if (!prev.has(id) && id !== 'camp') this.fresh.add(id);
      try { localStorage.setItem(KEY, JSON.stringify(vis)); } catch { /* 存储不可用 */ } }
    this.buildMap();
    this.buildTopBar(s);
    this.buildPanel();
    this.buildStrip(strip);
    this.buildInput();

    // 镜头：从攻城 / 军情 / 挑战回来聚焦那一点；否则对准「下一战」
    this.minZoom = Math.max(this.area.w / MAP_W, this.area.h / MAP_H);
    const focusCity = String(this.registry.get('mapFocusCity') ?? ''), focusIntel = this.intel.find(e => e.id === this.registry.get('mapFocusIntel')), focusNode = String(this.registry.get('mapFocusNode') ?? '');
    for (const k of ['mapFocusCity', 'mapFocusIntel', 'mapFocusNode']) this.registry.remove(k);
    const capId = String(this.registry.get('mapCaptured') ?? ''); this.registry.remove('mapCaptured');
    const pick = (focusCity && siegeNodeOf(focusCity)) || (focusNode && routeNode(focusNode)) || (this.view.next && routeNode(this.view.next)) || routeNode('camp')!;
    this.selected = focusIntel ? { kind: 'intel', event: focusIntel } : { kind: 'node', node: pick };
    const fx = focusIntel ? cityById(focusIntel.city) ?? pick : pick;
    this.setZoom(this.minZoom * (this.desktop ? ZOOM_TIERS[1] : 1.4)); this.centerOn(fx.x, fx.y);
    this.refresh();

    const fresh = test ? 0 : takeNewChapters();
    if (fresh > 0) this.chapterBanner();
    if (advance || lost.length) this.showNotice(advance, lost);
    const captured = !test && this.owned.includes(capId) ? cityById(capId) : undefined;
    if (captured) this.playCapture(captured);
    this.buildArrow();
    if (this.fresh.size) this.later(450, () => this.playReveal());
    this.updateTiles();
  }

  /** 新露出的点：路线由毛笔描过去、迷雾从中心散开、节点浮现（约 1.3 秒）。 */
  private playReveal() {
    for (const d of this.drawIns) {
      const n = d.pts.length, brush = this.textures.exists('rt_brush') ? this.add.image(d.pts[0].x, d.pts[0].y, 'rt_brush').setOrigin(.15, .85).setDisplaySize(26, 30).setName('route-brush') : undefined;
      if (brush) this.layer.add(brush);
      const st = { t: 0 }, alphas = new Array(n).fill(0);
      this.tweens.add({ targets: st, t: 1, duration: 900, ease: 'Sine.easeInOut', onUpdate: () => { const k = Math.floor(st.t * (n - 1)); for (let i = 0; i <= k; i++) alphas[i] = 1; d.rope.setAlphas(alphas); brush?.setPosition(d.pts[k].x, d.pts[k].y); },
        onComplete: () => { d.rope.setAlphas(1); this.fx.drawn++; if (brush) this.tweens.add({ targets: brush, alpha: 0, duration: 250, onComplete: () => brush.destroy() }); for (const f of d.feet) this.tweens.add({ targets: f, alpha: .8, duration: 300 }); } });
    }
    const rt = this.fogRT;
    if (rt) for (const h of this.view.holes) {
      if (!this.fresh.has(h.id)) continue; const brush = this.make.image({ key: 'rt_hole', add: false }), st = { r: 4 };
      this.tweens.add({ targets: st, r: h.r, duration: 1000, delay: 250, ease: 'Quad.easeOut', onUpdate: () => { brush.setPosition(h.x, h.y).setScale(st.r * 2.3 / 128); rt.erase(brush); }, onComplete: () => { brush.destroy(); this.fx.holes++; } });
    }
    for (const id of this.fresh) {
      const v = this.nodes.get(id); if (!v) continue; const y = v.root.y; v.root.y = y - 14 / this.zoom;
      this.tweens.add({ targets: v.root, alpha: 1, y, duration: 420, delay: 850, ease: 'Back.easeOut', onComplete: () => { this.fx.popped++; } });
    }
  }

  /** 「下一战」在镜头外：地图边上一枚指向它的小旗牌，点一下飞过去。 */
  private buildArrow() {
    const n = this.view.next ? routeNode(this.view.next) : undefined; if (!n) return;
    const d = n.chapter && n.stage ? chapterStages(n.chapter)[n.stage - 1] : undefined;
    const t = worldText(this, 0, 0, '下一战 · ' + (d ? d.code + ' ' + d.name : ''), 13, '#ffe3a0').setOrigin(.5).setFontFamily(HEADING_FONT).setStroke('#3a0c06', 3).setName('next-arrow-text');
    const g = this.add.graphics(); lacquerPlate(g, -t.width / 2 - 12, -t.height / 2 - 5, t.width + 24, t.height + 10, .94, 0xb42a1c);
    const tip = worldText(this, 0, 0, '➤', 18, '#d8402a').setOrigin(.5).setStroke('#2a0806', 3).setName('next-arrow-tip');
    const hit = this.add.zone(0, 0, t.width + 24, t.height + 10).setInteractive({ useHandCursor: true }).setName('next-arrow-hit');
    hit.on('pointerup', () => { this.select({ kind: 'node', node: n }); this.flyTo(n.x, n.y, Math.max(this.zoom, this.minZoom * ZOOM_TIERS[1]), 600); });
    this.arrow = this.add.container(0, 0, [g, t, tip, hit]).setDepth(9).setName('next-arrow').setVisible(false);
  }
  update() {
    const a = this.arrow, n = this.view?.next ? routeNode(this.view.next) : undefined; if (!a || !n || !this.layer) return;
    const sx = this.layer.x + n.x * this.zoom, sy = this.layer.y + n.y * this.zoom, A = this.area, pad = 26;
    const inside = sx > A.x + pad && sx < A.x + A.w - pad && sy > A.y + pad && sy < A.y + A.h - pad;
    if (inside || this.modal) { a.setVisible(false); return; }
    const cx = A.x + A.w / 2, cy = A.y + A.h / 2, dx = sx - cx, dy = sy - cy, ang = Math.atan2(dy, dx);
    const hw = A.w / 2 - 90, hh = A.h / 2 - 30, k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    const tip = a.getByName('next-arrow-tip') as Phaser.GameObjects.Text, plate = a.getByName('next-arrow-text') as Phaser.GameObjects.Text;
    let px = cx + dx * k, py = cy + dy * k;
    // 右上角是缩放按钮（约 50×100）：旗牌落进去就往下让开
    if (px + plate.width / 2 + 40 > A.x + A.w - 52 && py - plate.height / 2 - 12 < A.y + 100) py = A.y + 100 + plate.height / 2 + 14;
    a.setPosition(px, py).setVisible(true);
    tip.setRotation(ang).setPosition(Math.cos(ang) * (plate.width / 2 + 22), Math.sin(ang) * (plate.height / 2 + 14));
  }

  // ———————————————————————— 地图层 ————————————————————————
  private buildMap() {
    this.layer = this.add.container(0, 0).setName('world-layer');
    this.layer.add(this.add.image(0, 0, 'rt_base').setOrigin(0).setDisplaySize(MAP_W, MAP_H).setName('world-base'));
    for (let r = 0; r < TILE_N; r++) for (let c = 0; c < TILE_N; c++) this.tiles.push({ r, c, loading: false });
    const roads = this.add.container(0, 0).setName('world-roads'); this.layer.add(roads); this.buildRoads(roads);
    const fog = this.buildFog(); this.layer.add(fog);
    this.nodeLayer = this.add.container(0, 0).setName('world-nodes'); this.layer.add(this.nodeLayer);
    for (const n of ROUTE_NODES) { const v = this.view.vis.get(n.id) ?? 'hidden'; if (v !== 'hidden') this.addNode(n, v); }
    for (const e of this.intel) { const c = cityById(e.city), sn = c && siegeNodeOf(c.id); if (c && sn && this.view.vis.get(sn.id) !== 'hidden') this.addIntel(e, c); }
    const mask = this.make.graphics({ x: 0, y: 0 }).fillStyle(0xffffff).fillRect(this.area.x, this.area.y, this.area.w, this.area.h);
    this.layer.setMask(mask.createGeometryMask()); this.events.once('shutdown', () => mask.destroy());
    const frame = this.add.graphics(); frame.lineStyle(2, GOLD, .9).strokeRect(this.area.x - 1, this.area.y - 1, this.area.w + 2, this.area.h + 2);
  }

  /** 主线：按故事顺序连相邻两关（终点已露出才画）；支线：从挂靠关到攻城 / 挑战点。 */
  private buildRoads(into: Phaser.GameObjects.Container) {
    const vis = (id: string): NodeVis => this.view.vis.get(id) ?? 'hidden';
    for (let i = 1; i < MAIN_ROUTE.length; i++) {
      const a = routeNode(MAIN_ROUTE[i - 1])!, b = routeNode(MAIN_ROUTE[i])!, vb = vis(b.id);
      if (vb === 'hidden' || vis(a.id) === 'hidden') continue;
      this.road(into, a, b, vb === 'faint' ? 'todo' : 'done');
    }
    for (const n of ROUTE_NODES) if ((n.kind === 'siege' || n.kind === 'challenge') && vis(n.id) !== 'hidden' && n.after) { const a = routeNode(n.after); if (a && vis(a.id) !== 'hidden') this.road(into, a, n, 'branch'); }
  }
  private curve(a: { x: number; y: number; id?: string }, b: { x: number; y: number; id?: string }): Phaser.Math.Vector2[] {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, seed = ((a.x * 7 + b.y * 13) | 0) % 2 ? 1 : -1, bend = Math.min(46, d * .16) * seed;
    const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2((a.x + b.x) / 2 - dy / d * bend, (a.y + b.y) / 2 + dx / d * bend), new Phaser.Math.Vector2(b.x, b.y));
    return c.getPoints(Math.max(8, Math.round(d / 10)));
  }
  /** 手绘土路：拉直的笔触沿曲线弯（Rope），已走的路上隔一段印一对草鞋脚印。 */
  private road(into: Phaser.GameObjects.Container, a: RouteNode, b: RouteNode, kind: 'done' | 'todo' | 'branch') {
    const key = 'rt_road_' + kind; if (!this.textures.exists(key)) return;
    const pts = this.curve(a, b), src = this.textures.get(key).getSourceImage() as { height: number }, thick = kind === 'done' ? 13 : kind === 'branch' ? 6 : 6, k = thick / src.height;
    const rope = this.add.rope(0, 0, key, undefined, pts.map(p => new Phaser.Math.Vector2(p.x / k, p.y / k)), true).setScale(k).setName(`road-${a.id}-${b.id}`);
    if (kind === 'todo') rope.setAlpha(.8);
    into.add(rope);
    const fresh = this.fresh.has(b.id), feet: Phaser.GameObjects.Image[] = [];
    if (fresh) { rope.setAlphas(0); this.drawIns.push({ rope, pts, feet }); }
    if (kind !== 'done' || !this.textures.exists('rt_foot_1')) return;
    let acc = 30;
    for (let i = 1; i < pts.length; i++) {
      acc += Phaser.Math.Distance.BetweenPoints(pts[i - 1], pts[i]); if (acc < 58) continue; acc = 0;
      const ang = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const f = this.add.image(pts[i].x, pts[i].y, 'rt_foot_1').setDisplaySize(7, 7).setRotation(ang + Math.PI / 2).setAlpha(fresh ? 0 : .8); into.add(f); if (fresh) feet.push(f);
    }
  }

  /** 水墨云雾：宣纸色底 + 手绘云团铺满，再按揭开圆擦开（柔边），边上再压一圈云头。 */
  private buildFog(): Phaser.GameObjects.RenderTexture {
    const rt = this.add.renderTexture(0, 0, MAP_W, MAP_H).setOrigin(0).setName('world-fog');
    rt.fill(0xd9d2c0, 1);
    const rnd = new Phaser.Math.RandomDataGenerator(['route-fog']), clouds = ['rt_cloud_sea', 'rt_cloud_wall', 'rt_cloud_a', 'rt_cloud_b', 'rt_cloud_c', 'rt_cloud_d'].filter(k => this.textures.exists(k));
    const stamp = (key: string, x: number, y: number, w: number, alpha = 1) => { const t = this.textures.get(key).getSourceImage() as { width: number }; rt.stamp(key, undefined, x, y, { scale: w / t.width, alpha, originX: .5, originY: .5, tint: 0xd9dde2 }); }; // 冷灰染一层：云团原画偏暖粉，压成水墨灰褐
    if (clouds.length) for (let i = 0; i < 150; i++) stamp(clouds[i % clouds.length], rnd.between(-80, MAP_W + 80), rnd.between(-60, MAP_H + 60), rnd.between(150, 380), .95);
    if (!this.textures.exists('rt_hole')) {
      const c = this.textures.createCanvas('rt_hole', 128, 128)!, g = c.getContext(), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.62, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 128, 128); c.refresh();
    }
    const brush = this.make.image({ key: 'rt_hole', add: false });
    for (const h of this.view.holes) { if (this.fresh.has(h.id)) continue; brush.setPosition(h.x, h.y).setScale(h.r * 2.3 / 128); rt.erase(brush); }
    brush.destroy();
    // 揭开处边缘压几朵小云，像云头卷在已到地区的边上（中心不落在任何揭开圆里）
    const inside = (x: number, y: number) => this.view.holes.some(h => Math.hypot(x - h.x, y - h.y) < h.r * .95);
    const small = ['rt_cloud_c', 'rt_cloud_d', 'rt_cloud_b'].filter(k => this.textures.exists(k));
    if (small.length) for (const h of this.view.holes) for (let k = 0; k < 6; k++) {
      const a = rnd.realInRange(0, Math.PI * 2), x = h.x + Math.cos(a) * h.r * 1.12, y = h.y + Math.sin(a) * h.r * 1.0;
      if (!inside(x, y)) stamp(small[k % small.length], x, y, h.r * rnd.realInRange(.7, 1.05), .95);
    }
    this.fogRT = rt;
    return rt;
  }

  // ———————————————————————— 节点 ————————————————————————
  private label(text: string, y: number, dim = false, size = 13): Phaser.GameObjects.Container {
    const t = worldText(this, 0, y, text, size, dim ? '#a89c84' : '#f4e2ba').setOrigin(.5, 0).setFontFamily(HEADING_FONT).setStroke('#120904', 2);
    const g = this.add.graphics(); lacquerPlate(g, -t.width / 2 - 8, y - 2, t.width + 16, t.height + 4, dim ? .55 : .86);
    return this.add.container(0, 0, [g, t]).setName('node-label');
  }
  private addNode(n: RouteNode, v: NodeVis) {
    const root = this.add.container(n.x, n.y).setName('route-' + n.id), parts: Phaser.GameObjects.GameObject[] = [];
    const ring = this.add.image(0, 0, 'rt_hole').setDisplaySize(92, 92).setTint(0xffe2a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setName('select-ring');
    parts.push(ring);
    let w = 56, h = 56, lab: Phaser.GameObjects.Container | undefined;
    if (n.kind === 'stage') {
      const boss = !!n.boss, size = v === 'faint' ? 44 : boss ? 66 : 54, key = v === 'faint' ? 'rt_medal_locked' : boss ? 'rt_medal_boss' : v === 'cleared' ? 'rt_medal_cleared' : 'rt_medal_open';
      if (n.id === this.view.next) { const glow = this.add.image(0, 0, 'rt_hole').setDisplaySize(size * 1.9, size * 1.9).setTint(0xffc860).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.55).setName('next-glow'); parts.push(glow); this.tweens.add({ targets: glow, alpha: .2, scale: glow.scale * 1.18, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
      const img = this.add.image(0, 0, key, '__BASE'); img.setScale(size / img.width); if (v === 'faint') img.setAlpha(.82); parts.push(img);
      const code = `${CHAPTER_TIMELINE.findIndex(c => c.id === n.chapter) + 1}-${n.stage}`;
      parts.push(worldText(this, 0, boss ? 4 : 0, code, Math.round(size * .3), v === 'faint' ? '#7b6a52' : '#ffe3a0').setOrigin(.5).setFontFamily(HEADING_FONT).setStroke(v === 'faint' ? '#efe4cc' : '#3a0c06', 3));
      if (v === 'cleared') {
        if (boss) parts.push(this.add.image(size * .3, size * .3, 'rt_medal_cleared', 'seal').setDisplaySize(size * .36, size * .36));
        const sx = boss ? size * .3 : (SEAL_AT.x - .5) * size, sy = boss ? size * .3 : (SEAL_AT.y - .5) * size;
        parts.push(worldText(this, sx, sy, '捷', Math.round(size * .2), '#7a1a0e').setOrigin(.5).setFontFamily(TITLE_FONT));
        if (n.chapter && hardChapterCleared(n.chapter) && this.textures.exists('rt_seal_hard')) { const hs = this.add.image(-size * .38, size * .3, 'rt_seal_hard'); hs.setScale(size * .3 / hs.width); parts.push(hs); }
      }
      const d = n.chapter && n.stage ? chapterStages(n.chapter)[n.stage - 1] : undefined;
      lab = this.label(v === 'faint' ? (d?.name ?? '') + ' · 未开' : d?.name ?? '', size / 2 + 2, v === 'faint'); w = h = size;
    } else if (n.kind === 'siege' && n.city) {
      const c = cityById(n.city)!, mine = this.owned.includes(c.id), alert = this.alertFor(c.id), key = alert ? 'rt_city_alert' : mine ? 'rt_city_own' : 'rt_city_enemy', cw = c.tier === 'large' ? 70 : c.tier === 'medium' ? 62 : 54;
      const img = this.add.image(0, 0, key).setOrigin(.5, .72); img.setScale(cw / img.width); parts.push(img);
      if (mine && !alert) parts.push(worldText(this, cw * .26, -img.displayHeight * .6, '义', Math.round(cw * .16), '#fff7e0').setOrigin(.5).setFontFamily(TITLE_FONT).setStroke('#1b3a14', 2));
      const inc = cityIncome(c.tier, mine ? cityLevels(c.id) : emptyCityLevels());
      lab = this.label(alert ? `${c.name} · 告急` : mine ? `${c.name} · ${incomeText(inc)}` : `攻城 · ${c.name}`, img.displayHeight * .3 + 2, false, 12); w = cw; h = img.displayHeight;
      if (alert) lab.list.forEach(o => { if (o instanceof Phaser.GameObjects.Text) o.setColor('#ff9a7a'); });
    } else if (n.kind === 'challenge') {
      const img = this.add.image(0, 0, 'rt_pennant_challenge').setOrigin(.32, .92); img.setScale(46 / img.height); parts.push(img);
      lab = this.label(v === 'cleared' ? '虎牢关 · 三英战吕布 ✓' : '挑战 · 虎牢关', 6, false, 12); w = 40; h = 46;
    } else if (n.kind === 'camp') {
      const img = this.add.image(0, 0, 'rt_camp').setOrigin(.5, .7); img.setScale(76 / img.width); parts.push(img);
      const size = citySize(loadWorld().town);
      lab = this.label(size > 1 ? `义军${CITY_TITLE[size]}` : '义军营寨', img.displayHeight * .3 + 2); w = 76; h = img.displayHeight;
      let intro = false; try { intro = localStorage.getItem('im_home_seen') !== '1' && !isChapterTestRun(); } catch { /* 存储不可用 */ }
      if (intro) { const tip = worldText(this, 0, -h * .9, '你的营寨 · 点此进入', 13, '#eaffd8').setOrigin(.5).setBackgroundColor('#1d3a26e6').setPadding(8, 4, 8, 4).setName('home-intro-tip'); parts.push(tip); this.tweens.add({ targets: tip, y: tip.y - 5, yoyo: true, repeat: -1, duration: 700 }); }
    }
    if (n.id === this.view.next) parts.push(...this.nextFlag(n.boss ? 66 : 54));
    if (lab) parts.push(lab);
    const hit = this.add.zone(0, n.kind === 'stage' ? 0 : -h * .3, Math.max(44, w), Math.max(44, h)).setInteractive({ useHandCursor: true }).setName('node-' + n.id);
    hit.on('pointerup', (p: Phaser.Input.Pointer) => { if (this.pointer.moved > 10 * RENDER_SCALE || this.pinching || this.modal) return; void p; this.select({ kind: 'node', node: n }); });
    parts.push(hit); root.add(parts); root.setData('vis', v); this.nodeLayer.add(root); if (this.fresh.has(n.id)) root.setAlpha(0);
    this.nodes.set(n.id, { node: n, root, hit, label: lab, ring });
  }
  /** 全图唯一「下一战」：燕尾战旗 + 三个字，轻轻摆动。 */
  private nextFlag(size: number): Phaser.GameObjects.GameObject[] {
    if (!this.textures.exists('rt_banner_next')) return [];
    const f = this.add.image(size * .28, -size * .32, 'rt_banner_next').setOrigin(.2, 1).setName('next-flag'); f.setScale(size * 1.05 / f.height);
    const t = worldText(this, size * .28 + f.displayWidth * .5, -size * .32 - f.displayHeight * .6, '战', Math.round(size * .3), '#fff3d6').setOrigin(.5).setFontFamily(TITLE_FONT).setStroke('#4a0a20', 3);
    const word = worldText(this, size * .28 + f.displayWidth * 1.02, -size * .32 - f.displayHeight * .95, '下一战', 15, '#b42a1c').setOrigin(0, .5).setFontFamily(TITLE_FONT).setStroke('#f6ead0', 3).setName('next-word');
    this.tweens.add({ targets: [f, t], angle: { from: -2, to: 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return [f, t, word];
  }
  private addIntel(e: IntelEvent, c: CityDef) {
    const info = INTEL_INFO[e.kind], root = this.add.container(c.x + 30, c.y - 24).setName('intel-' + e.id);
    const ring = this.add.image(0, -14, 'rt_hole').setDisplaySize(70, 70).setTint(0xffe2a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setName('select-ring');
    const img = this.add.image(0, 0, 'rt_pennant_intel').setOrigin(.3, .95); img.setScale(38 / img.height);
    const glyph = worldText(this, 8, -26, info.glyph, 11, '#fff6dc').setOrigin(.5).setStroke('#4a120a', 3);
    const lab = this.label(`${info.name} · ${this.intelLeftShort(e)}`, 4, false, 11);
    const hit = this.add.zone(4, -16, 40, 44).setInteractive({ useHandCursor: true }).setName('intel-hit-' + e.id);
    hit.on('pointerup', () => { if (this.pointer.moved > 10 * RENDER_SCALE || this.pinching || this.modal) return; this.select({ kind: 'intel', event: e }); });
    root.add([ring, img, glyph, lab, hit]); this.nodeLayer.add(root); this.nodes.set('intel-' + e.id, { event: e, root, hit, label: lab, ring });
  }

  // ———————————————————————— 镜头 ————————————————————————
  setZoom(z: number, px = this.area.x + this.area.w / 2, py = this.area.y + this.area.h / 2) {
    z = Phaser.Math.Clamp(z, this.minZoom, this.minZoom * ZOOM_TIERS[2] * 1.15);
    const mx = (px - this.layer.x) / this.zoom, my = (py - this.layer.y) / this.zoom;
    this.zoom = z; this.layer.setScale(z); this.layer.setPosition(px - mx * z, py - my * z); this.clamp(); this.layoutNodes();
  }
  centerOn(x: number, y: number) { this.layer.setPosition(this.area.x + this.area.w / 2 - x * this.zoom, this.area.y + this.area.h / 2 - y * this.zoom); this.clamp(); this.updateTiles(); }
  private clamp() {
    const a = this.area, w = MAP_W * this.zoom, h = MAP_H * this.zoom;
    this.layer.x = w <= a.w ? a.x + (a.w - w) / 2 : Phaser.Math.Clamp(this.layer.x, a.x + a.w - w, a.x);
    this.layer.y = h <= a.h ? a.y + (a.h - h) / 2 : Phaser.Math.Clamp(this.layer.y, a.y + a.h - h, a.y);
  }
  flyTo(x: number, y: number, z = this.zoom, ms = 600) {
    const from = { z: this.zoom, x: (this.area.x + this.area.w / 2 - this.layer.x) / this.zoom, y: (this.area.y + this.area.h / 2 - this.layer.y) / this.zoom }, p = { t: 0 };
    this.tweens.add({ targets: p, t: 1, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => { const zz = from.z + (z - from.z) * p.t; this.zoom = zz; this.layer.setScale(zz); this.layoutNodes(); this.centerOn(from.x + (x - from.x) * p.t, from.y + (y - from.y) * p.t); } });
  }
  private stepTier(dir: number, px?: number, py?: number) {
    const cur = this.zoom / this.minZoom, tiers = [...ZOOM_TIERS], i = dir > 0 ? tiers.findIndex(t => t > cur * 1.05) : [...tiers].reverse().findIndex(t => t < cur / 1.05);
    if (i < 0) return; const t = dir > 0 ? tiers[i] : [...tiers].reverse()[i]; this.setZoom(this.minZoom * t, px, py); this.updateTiles();
  }
  /** 节点保持屏幕大小；全图档只留主线圆章、营寨、下一战，名牌只在章节档以上显示。 */
  private layoutNodes() {
    const inv = 1 / this.zoom, rel = this.zoom / this.minZoom, overview = rel < 1.45;
    for (const v of this.nodes.values()) {
      v.root.setScale(inv * (overview ? .72 : 1));
      const n = v.node, keep = !!n && (n.kind === 'stage' || n.kind === 'camp' || n.id === this.view.next);
      v.root.setVisible(!overview || keep);
      v.label?.setVisible(!overview || (!!n && n.id === this.view.next) || this.isSelected(v));
    }
    this.declutter();
  }
  /** 名牌不叠：按优先级（选中 > 下一战 > 主线 > 营寨 > 挑战 > 城池 > 军情）放，碰到已放的名牌或别的图标就藏起来。 */
  private declutter() {
    const rank = (v: NodeView) => this.isSelected(v) ? 0 : v.node?.id === this.view.next ? 1 : v.node?.kind === 'stage' ? 2 : v.node?.kind === 'camp' ? 3 : v.node?.kind === 'challenge' ? 4 : v.node ? 5 : 6;
    const list = [...this.nodes.values()].filter(v => v.root.visible && v.label?.visible).sort((a, b) => rank(a) - rank(b));
    const icons = [...this.nodes.values()].filter(v => v.root.visible).map(v => ({ v, r: v.hit.getBounds() }));
    const kept: Phaser.Geom.Rectangle[] = [];
    for (const v of list) {
      const r = v.label!.getBounds();
      const hit = kept.some(k => Phaser.Geom.Intersects.RectangleToRectangle(k, r)) || (rank(v) > 1 && icons.some(i => i.v !== v && Phaser.Geom.Intersects.RectangleToRectangle(i.r, r)));
      if (hit) v.label!.setVisible(false); else kept.push(r);
    }
  }
  /** 镜头范围内载入清晰分块（全图档用总图）。 */
  private updateTiles() {
    if (!this.layer) return; const z = this.zoom, a = this.area, x0 = (a.x - this.layer.x) / z, y0 = (a.y - this.layer.y) / z, x1 = x0 + a.w / z, y1 = y0 + a.h / z, tw = MAP_W / TILE_N, th = MAP_H / TILE_N, need = z >= this.minZoom * 1.35;
    for (const t of this.tiles) {
      const vis = t.c * tw < x1 && (t.c + 1) * tw > x0 && t.r * th < y1 && (t.r + 1) * th > y0, key = `rt_base_${t.r}_${t.c}`;
      if (t.img) { t.img.setVisible(vis && need); continue; }
      if (!vis || !need) continue;
      if (this.textures.exists(key)) { this.addTile(t, key); continue; }
      if (t.loading) continue; t.loading = true; this.load.image(key, `${RT}base_tile_${t.r}_${t.c}.webp`);
      this.load.once(`filecomplete-image-${key}`, () => { t.loading = false; if (this.scene.isActive() && this.layer?.active) { this.addTile(t, key); this.updateTiles(); } }); if (!this.load.isLoading()) this.load.start();
    }
  }
  private addTile(t: { r: number; c: number; img?: Phaser.GameObjects.Image }, key: string) {
    if (t.img) return; this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR); const tw = MAP_W / TILE_N, th = MAP_H / TILE_N;
    t.img = this.add.image(t.c * tw, t.r * th, key).setOrigin(0).setDisplaySize(tw + .5, th + .5).setName(`world-tile-${t.r}-${t.c}`); this.layer.addAt(t.img, 1);
  }
  private buildInput() {
    const inside = (q: Phaser.Input.Pointer) => { const p = screenPoint(q); return p.x >= this.area.x && p.x <= this.area.x + this.area.w && p.y >= this.area.y && p.y <= this.area.y + this.area.h; };
    this.input.on('pointerdown', (q: Phaser.Input.Pointer) => { const p = screenPoint(q); this.pointer = { x: p.x, y: p.y, down: inside(q), moved: 0 }; this.pinch = 0; this.pinching = false; });
    this.input.on('pointermove', (q: Phaser.Input.Pointer) => {
      if (!q.isDown || !this.pointer.down || this.modal) return; const p = screenPoint(q), act = this.input.manager.pointers.filter(o => o.isDown && inside(o)).map(screenPoint);
      if (act.length >= 2) { this.pinching = true; const d = Phaser.Math.Distance.Between(act[0].x, act[0].y, act[1].x, act[1].y); if (this.pinch > 0) this.setZoom(this.zoom * d / this.pinch, (act[0].x + act[1].x) / 2, (act[0].y + act[1].y) / 2); this.pinch = d; }
      else { this.pointer.moved += Math.hypot(p.x - this.pointer.x, p.y - this.pointer.y); this.layer.x += p.x - this.pointer.x; this.layer.y += p.y - this.pointer.y; this.clamp(); }
      this.pointer.x = p.x; this.pointer.y = p.y;
    });
    this.input.on('pointerup', () => { if (this.pointer.down) this.updateTiles(); this.pointer.down = false; });
    this.input.on('wheel', (q: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (this.modal || !inside(q)) return; const p = screenPoint(q); this.stepTier(dy > 0 ? -1 : 1, p.x, p.y); });
    // 缩放按钮（地图右上角）
    const zx = this.area.x + this.area.w - 26;
    for (const [i, label, dir] of [[0, '＋', 1], [1, '－', -1]] as const) { const b = worldButton(this, zx, this.area.y + 26 + i * 46, label, () => this.stepTier(dir), 38); b.image.setDepth(8).setName(dir > 0 ? 'zoom-in' : 'zoom-out'); b.text.setDepth(9); }
  }

  // ———————————————————————— 界面：顶栏 / 详情栏 / 章节条 ————————————————————————
  private buildTopBar(s: ReturnType<typeof loadWorld>) {
    const g = this.add.graphics().setDepth(10); g.fillStyle(0x16100a, .96).fillRect(0, 0, W, this.desktop ? 52 : 96).lineStyle(2, GOLD, .8).lineBetween(0, this.desktop ? 52 : 96, W, this.desktop ? 52 : 96);
    const cur = currentChapter(s), title = worldShell(this, this.registry.get('worldReveal') ? '三国天下开启' : `天下 · ${cur.numeral} ${cur.title}`).setDepth(11).setName('world-title');
    if (this.desktop) title.setFontSize(24).setOrigin(0, .5).setPosition(16, 26);
    const res = resourceBar(this, this.desktop ? title.x + title.width + 16 : 16, this.desktop ? 26 : 70, [{ glyph: '粮', label: '军粮', value: s.provisions, tint: 0x7a5a22 }, { glyph: '城', label: '城池', value: this.owned.length, tint: 0x2f6b45 }], this.desktop).setDepth(11);
    void res; // 告急 / 军情小牌放在地图左上角（顶栏放不下，会压到主菜单）
    let x = this.area.x + 10; const cy = this.area.y + 22;
    const chip = (text: string, color: string, name: string, fn: () => void) => { const t = worldText(this, x, cy, text, 14, color).setOrigin(0, .5).setPadding(10, 5).setDepth(12).setName(name).setInteractive({ useHandCursor: true }); const gg = this.add.graphics().setDepth(11); lacquerPlate(gg, t.x, t.y - t.height / 2, t.width, t.height, .9); t.on('pointerup', fn); x += t.width + 8; return t; };
    if (this.alerts.length) chip(`告急 ${this.alerts.length}`, '#ff9a7a', 'world-alerts', () => { const c = this.alerts.map(a => siegeNodeOf(a.city)).find(Boolean); if (c) { this.select({ kind: 'node', node: c }); this.flyTo(c.x, c.y); } });
    if (this.intel.length) chip(`军情 ${this.intel.length}  ▸`, '#ffc49a', 'world-intel', () => this.nextIntel());
    const bx = this.desktop ? W - 74 : W - 70;
    const back = worldButton(this, bx, this.desktop ? 26 : 26, '返回营寨', () => this.scene.start('CityScene'), 124); back.image.setDisplaySize(124, 38).setDepth(11).setName('world-back'); back.text.setFontSize(15).setDepth(12);
    const all = worldButton(this, bx - 132, this.desktop ? 26 : 26, '全图', () => this.toggleOverview(), 96); all.image.setDisplaySize(96, 38).setDepth(11).setName('world-overview'); all.text.setFontSize(15).setDepth(12);
    addMainMenuButton(this, this.desktop ? bx - 250 : W - 105, this.desktop ? 25 : 70);
  }
  private toggleOverview() { const rel = this.zoom / this.minZoom; if (rel > 1.2) this.flyTo(MAP_W / 2, MAP_H / 2, this.minZoom, 500); else { const n = this.view.next ? routeNode(this.view.next) : routeNode('camp'); if (n) this.flyTo(n.x, n.y, this.minZoom * ZOOM_TIERS[1], 500); } this.later(520, () => this.updateTiles()); }

  private buildPanel() {
    const b = this.panelBox, g = this.add.graphics().setDepth(10).setName('world-panel'); lqPanel(g, b.x, b.y, b.w, b.h, { shadow: true });
    const pad = 18, sealSize = 46;
    this.sealG = this.add.image(b.x + pad + sealSize / 2, b.y + pad + sealSize / 2, 'rt_medal_open').setDisplaySize(sealSize, sealSize).setDepth(11).setName('world-detail-icon');
    this.sealT = worldText(this, this.sealG.x, this.sealG.y, '', 16, '#ffe3a0').setOrigin(.5).setDepth(12).setFontFamily(HEADING_FONT).setStroke('#3a0c06', 3);
    this.detailTitle = worldText(this, b.x + pad + sealSize + 12, b.y + pad - 2, '', this.desktop ? 24 : 22, '#f6dc9a').setDepth(11).setFontFamily(TITLE_FONT).setStroke('#120904', 3).setName('world-detail-title');
    this.detailSub = worldText(this, this.detailTitle.x, b.y + pad + 30, '', 12, '#c8b48c').setDepth(11).setName('world-detail-sub');
    this.detail = worldText(this, b.x + pad, b.y + pad + sealSize + 16, '', this.desktop ? 13 : 13, '#e4dcc4').setWordWrapWidth(b.w - pad * 2, true).setLineSpacing(5).setDepth(11).setName('world-detail');
    const bw = b.w - pad * 2, by = b.y + b.h - (this.desktop ? 44 : 40);
    this.action = this.button(b.x + b.w / 2, by, bw, '出征', true, 'map-action', () => this.doAction(false));
    this.hardBtn = this.button(b.x + b.w / 2, by - 56, bw * .7, '乱世难度', false, 'map-hard', () => this.doAction(true));
  }
  private button(x: number, y: number, w: number, label: string, primary: boolean, name: string, fn: () => void): Btn {
    const c = homeCommand(this, x, y, w, primary ? 48 : 40, label, primary, true, primary ? 22 : 16);
    c.g.setDepth(11); c.caption.setDepth(12); c.hit.setDepth(12).setName(name).on('pointerup', () => { if (c.hit.input?.enabled) fn(); });
    return { image: c.hit, text: c.caption, g: c.g, setEnabled: on => { if (on) c.hit.setInteractive({ useHandCursor: true }); else c.hit.disableInteractive(); c.g.setAlpha(on ? 1 : .45); c.caption.setAlpha(on ? 1 : .55); }, setVisible: v => { c.g.setVisible(v); c.caption.setVisible(v); c.hit.setVisible(v); if (!v) c.hit.disableInteractive(); } };
  }
  private buildStrip(h: number) {
    const y = this.area.y + this.area.h + 8, x0 = this.area.x, w = this.area.w, g = this.add.graphics().setDepth(10); lacquerPlate(g, x0, y, w, h - 4, .9);
    const s = loadWorld(), step = (w - 24) / CHAPTER_TIMELINE.length;
    CHAPTER_TIMELINE.forEach((c, i) => {
      const st = chapterState(c.id, s), cx = x0 + 12 + i * step, cy = y + (h - 4) / 2, col = st === 'cleared' ? 0xb2301e : st === 'open' ? 0xf0c868 : 0x5e5446;
      g.fillStyle(col, 1).fillCircle(cx + 8, cy, 5);
      const t = worldText(this, cx + 18, cy, c.short, 13, st === 'locked' ? '#7d7260' : st === 'open' ? '#ffe2a0' : '#e8d6b0').setOrigin(0, .5).setDepth(11).setName('strip-' + c.id).setInteractive({ useHandCursor: true });
      t.on('pointerup', () => this.focusChapter(c.id));
    });
  }
  private focusChapter(id: TimelineChapterId) {
    const nodes = [1, 2, 3].map(k => stageNode(id, k)!).filter(n => (this.view.vis.get(n.id) ?? 'hidden') !== 'hidden');
    if (!nodes.length) { const c = chapterById(id); this.toast(`第${c.numeral}章「${c.title}」· ${c.hint || '尚未开放'}`); return; }
    const n = nodes.find(x => x.id === this.view.next) ?? nodes[nodes.length - 1]; this.select({ kind: 'node', node: n }); this.flyTo(n.x, n.y, Math.max(this.zoom, this.minZoom * ZOOM_TIERS[1]));
  }
  /** 真实时间的延时（场景还开着才执行）。 */
  private later(ms: number, fn: () => void) { const id = window.setTimeout(() => { if (this.sys.isActive()) fn(); }, ms); this.events.once('shutdown', () => window.clearTimeout(id)); }
  private toast(text: string) {
    const t = worldText(this, this.area.x + this.area.w / 2, this.area.y + 40, text, 15, '#f6dc9a').setOrigin(.5).setPadding(14, 7).setDepth(40).setName('world-toast');
    const g = this.add.graphics().setDepth(39); lacquerPlate(g, t.x - t.width / 2, t.y - t.height / 2, t.width, t.height, .94);
    this.tweens.add({ targets: [t, g], alpha: 0, delay: 1600, duration: 400, onComplete: () => { t.destroy(); g.destroy(); } });
  }

  // ———————————————————————— 选中与详情 ————————————————————————
  private isSelected(v: NodeView) { const s = this.selected; return s.kind === 'node' ? v.node?.id === s.node.id : v.event?.id === s.event.id; }
  select(sel: Selection) { this.selected = sel; this.refresh(); }
  refresh() {
    for (const v of this.nodes.values()) { const on = this.isSelected(v); v.ring.setAlpha(on ? .55 : 0); if (on) v.root.parentContainer?.bringToTop(v.root); }
    this.layoutNodes();
    const sel = this.selected; this.hardBtn.setVisible(false);
    if (sel.kind === 'intel') { this.intelDetail(sel.event); return; }
    const n = sel.node, v = this.view.vis.get(n.id) ?? 'hidden';
    if (n.kind === 'camp') return this.campDetail();
    if (n.kind === 'stage') return this.stageDetail(n, v);
    if (n.kind === 'siege') return this.siegeDetail(n, v);
    if (n.kind === 'challenge') return this.challengeDetail(v);
  }
  private setDetail(icon: string, glyph: string, title: string, sub: string, body: string) {
    if (this.textures.exists(icon)) this.sealG.setTexture(icon, '__BASE');
    const src = this.sealG.texture.getSourceImage() as { width: number; height: number }; this.sealG.setScale(46 / Math.max(src.width, src.height));
    this.sealT.setText(glyph); this.detailTitle.setText(title); this.detailSub.setText(sub); this.detail.setText(body);
  }
  private setAction(label: string, on: boolean) { this.action.text.setText(label); this.action.setVisible(true); this.action.setEnabled(on); }
  private campDetail() {
    const s = loadWorld(), next = currentChapter(s), cleared = CHAPTER_TIMELINE.filter(c => chapterStagesDone(c.id, s) >= 3).length;
    this.setDetail('rt_camp', '', CITY_TITLE[citySize(s.town)] === '义军营寨' ? '义军营寨' : `义军${CITY_TITLE[citySize(s.town)]}`, '中原 · 玩家领地', `从营寨出发，建设后再次出征。\n章节进度 ${cleared}/${CHAPTER_TIMELINE.length} · ${cleared >= CHAPTER_TIMELINE.length ? '诸章皆已平定' : `下一章：第${next.numeral}章「${next.title}」`}\n城池 ${this.owned.length} 座${this.alerts.length ? ` · 告急 ${this.alerts.length}` : ''}`);
    this.setAction('进入营寨', true);
  }
  private stageDetail(n: RouteNode, v: NodeVis) {
    const id = n.chapter!, k = n.stage!, s = loadWorld(), info = chapterById(id), d = chapterStages(id)[k - 1], done = k <= chapterStagesDone(id, s), open = stageOpen(id, k, s) || isChapterTestRun(), cleared = chapterState(id, s) === 'cleared';
    const unlocks = ROUTE_NODES.filter(x => x.after === n.id && x.kind !== 'stage').map(x => x.kind === 'siege' ? cityById(x.city!)?.name : '挑战 · 三英战吕布').filter(Boolean);
    const nextMain = ROUTE_NODES.find(x => x.after === n.id && x.kind === 'stage'), nd = nextMain?.chapter ? chapterStages(nextMain.chapter)[nextMain.stage! - 1] : undefined;
    const status = done ? '✓ 已告捷 · 可重打此关' : open ? '可出征' : v === 'faint' ? `未开放：先打下前一关` : `未解锁：${info.hint}`;
    const lines = [status, open ? this.musterLine() : '', `首领 ${d.boss}（${d.bossTitle}） · ${d.year}`, d.story];
    if (!done) { const after = [nd ? `迷雾散开：${nd.code} ${nd.name}` : '', unlocks.length ? `可攻：${unlocks.join('、')}` : ''].filter(Boolean); if (after.length) lines.push('打下后 · ' + after.join(' · ')); }
    if (cleared && open) lines.push(`乱世：敌军生命×${HARD_MODE.enemyHp}、首领×${HARD_MODE.bossHp}${hardChapterCleared(id) ? ` · 已平乱世 · 称号「${HARD_TITLES[id]}」` : ''}`);
    const warn = this.lossWarning(); if (open && warn) lines.push(warn);
    this.setDetail(n.boss ? 'rt_medal_boss' : done ? 'rt_medal_cleared' : v === 'faint' ? 'rt_medal_locked' : 'rt_medal_open', d.seal, `${d.code} ${d.name}`, `第${info.numeral}章 ${info.title} · ${info.era} ${info.year}`, lines.filter(Boolean).join('\n'));
    this.setAction(open ? (done ? '重打此关' : '出征') : '尚未开放', open);
    if (cleared && open) { this.hardBtn.setVisible(true); this.hardBtn.setEnabled(true); }
  }
  private siegeDetail(n: RouteNode, v: NodeVis) {
    const c = cityById(n.city!)!, owner = cityOwner(c.id, this.era, this.owned), alert = this.alertFor(c.id), mine = this.owned.includes(c.id), s = loadWorld(), open = routeSiegeOpen(c.id, s, this.owned) || isChapterTestRun();
    const inc = cityIncome(c.tier, mine ? cityLevels(c.id) : emptyCityLevels()), sp = SPECIALTIES[c.id], after = n.after ? routeNode(n.after) : undefined, ad = after?.chapter ? chapterStages(after.chapter)[after.stage! - 1] : undefined;
    const status = alert ? `告急：${FACTIONS[alert.attacker].name}来犯！守住可解除；出征别处则此城失守` : mine ? '你的城池 · 可进入建设' : open ? (this.lossWarning() || '可以攻打') : `打下 ${ad ? ad.code + ' ' + ad.name : '前一关'} 后可攻`;
    const era = eraDef(this.era);
    this.setDetail(alert ? 'rt_city_alert' : mine ? 'rt_city_own' : 'rt_city_enemy', '', `${c.name}`, `${TIER_NAME[c.tier]} · ${c.region} · ${FACTIONS[owner].name}`, `${status}\n${mine ? '产出（进入城池可建设）' : '占领后产出'}：每战 ${incomeText(inc)}${sp ? `\n特产「${sp.title}」${sp.text}` : ''}\n归属按公元${era.year}年（${era.name}）`);
    this.setAction(alert ? '亲征 · 守城' : mine ? '进入城池' : open ? '亲征 · 攻城' : '尚不可攻打', !!alert || mine || open);
    void v;
  }
  private challengeDetail(v: NodeVis) {
    const wins = lubuClears(), r = LUBU_CHALLENGE.reward, rr = LUBU_CHALLENGE.repeatReward, locked = v === 'hidden';
    this.setDetail('rt_pennant_challenge', '', '三英战吕布', '挑战 · 虎牢关', `${locked ? `未解锁：${LUBU_CHALLENGE.unlockHint}` : wins ? `已胜 ${wins} 场 · 可反复挑战` : '可选挑战 · 不影响讨董进度'}\n吕布横扫与蓄力冲锋 · 三波后吕布出阵\n奖励：${wins ? `军粮 +${rewardGrain(rr.merits, rr.provisions)}` : `首胜得名马「赤兔」（入马厩）· 军粮 +${rewardGrain(r.merits, r.provisions)}`}${this.lossWarning() ? '\n' + this.lossWarning() : ''}`);
    this.setAction(locked ? '尚未解锁' : '挑战吕布', !locked);
  }
  private intelDetail(e: IntelEvent) {
    const info = INTEL_INFO[e.kind], c = cityById(e.city), f = FACTIONS[e.faction]?.name ?? '';
    this.setDetail('rt_pennant_intel', info.glyph, `${info.name} · ${intelTitle(e).split(' · ')[1] ?? ''}`, `${this.intelLeft(e)}${c ? ` · ${c.name}（${c.region}）` : ''}`, `${intelBrief(e, f)}\n奖励：${this.intelRewardText(e)}${this.lossWarning() ? '\n' + this.lossWarning() : ''}`);
    this.setAction('亲征 · 军情', true);
  }
  private doAction(hard: boolean) {
    if (this.modal) return; const sel = this.selected;
    if (sel.kind === 'intel') { this.openIntel(sel.event); return; }
    const n = sel.node;
    if (n.kind === 'camp') { this.scene.start('CityScene'); return; }
    if (n.kind === 'challenge') { if (lubuChallengeOpen() || isChapterTestRun()) this.launchChallenge(); return; }
    if (n.kind === 'siege') { const c = cityById(n.city!)!, alert = !!this.alertFor(c.id); if (!alert && this.owned.includes(c.id)) { this.scene.start('TownScene', { city: c.id }); return; } this.openSiege(c, alert); return; }
    if (n.kind === 'stage' && n.chapter && n.stage) { if (!stageOpen(n.chapter, n.stage, loadWorld()) && !isChapterTestRun()) return; this.enterStage(n.chapter, n.stage, hard); }
  }
  private nextIntel() { if (!this.intel.length) return; const s = this.selected, i = s.kind === 'intel' ? this.intel.findIndex(e => e.id === s.event.id) : -1, e = this.intel[(i + 1) % this.intel.length]; const c = cityById(e.city); this.select({ kind: 'intel', event: e }); if (c) this.flyTo(c.x, c.y); }

  // ———————————————————————— 出征（入口照旧） ————————————————————————
  private alertFor(id: string) { return this.alerts.find(a => a.city === id); }
  private lossWarning() { const names = this.alerts.map(a => cityById(a.city)?.name).filter(Boolean); return names.length ? `⚠ ${names.join('、')}告急：此时出征别处，${names.length > 1 ? '这些城池' : '该城'}将失守！` : ''; }
  private lordId(): CharacterId { let hero: CharacterId = defaultHero(null); try { hero = defaultHero(localStorage.getItem('im_last_hero')); } catch { /* storage unavailable */ } return hero; }
  private musterLine(): string {
    const lord = CHARACTERS.find(c => c.id === this.lordId())?.name ?? ''; let names: string[] = [];
    try { const r = loadRoster(); names = r.followers.map(id => r.owned.find(o => o.id === id)?.name).filter((x): x is string => !!x); } catch { /* 存档不可用 */ }
    return names.length ? `主将 ${lord} · 随行 ${names.slice(0, 3).join('、')}${names.length > 3 ? ' 等' : ''}` : `主将 ${lord} 亲征`;
  }
  private enterStage(id: TimelineChapterId, stage: number, hard: boolean) {
    if (hard && chapterState(id, loadWorld()) === 'cleared') this.registry.set('hardChapter', id); else this.registry.remove('hardChapter');
    if (id in CAMPAIGNS) { const c = CAMPAIGNS[id as CampaignId]; if (!c.open() && !isChapterTestRun()) return; this.registry.set('worldStagePick', stage); requestDirectDepart(this); this.scene.start(c.scene); return; } // 电脑版直接以主公开战（不再显示各章选将 / 选关页，见 systems/DirectDepart）
    this.launchMain(id, stage);
  }
  /** 壹 / 贰章：直接以主公开战（不经点将页）。 */
  private launchMain(id: TimelineChapterId, stage: number) {
    const n = ([1, 2, 3].includes(stage) ? stage : 1) as 1 | 2 | 3, hero = this.lordId(), c = CHARACTERS.find(x => x.id === hero)!;
    if (!isChapterTestRun()) try { localStorage.setItem('im_last_hero', hero); } catch { /* storage unavailable */ }
    this.registry.remove('campaignTransfer'); this.registry.set('worldCampaign', true);
    this.registry.set('runConfig', { chapter: id === 'hulao' ? 'hulao' : 'huangjin', stage: id === 'huangjin' ? n : undefined, westStage: id === 'hulao' ? n : undefined, character: hero, weapon: c.startWeapon });
    this.goBattle('GameScene');
  }
  private goBattle(key: string) { if (this.registry.get('battleReady')) this.scene.start(key); else { this.registry.set('pendingWarlord', key); this.registry.set('loadBattle', true); this.scene.start('BootScene'); } }
  private launchChallenge() { const hero = this.lordId(); this.registry.remove('campaignTransfer'); this.registry.set('runConfig', { character: hero }); this.goBattle('LubuGameScene'); }
  private launchSiege(city: CityDef, hero: CharacterId, defense = false) {
    if (!isChapterTestRun()) try { localStorage.setItem('im_last_hero', hero); } catch { /* storage unavailable */ }
    this.registry.remove('campaignTransfer'); this.registry.set('siegeCity', city.id); if (defense) this.registry.set('siegeMode', 'defense'); else this.registry.remove('siegeMode'); this.registry.set('runConfig', { character: hero });
    this.goBattle('SiegeGameScene');
  }
  private launchIntel(event: IntelEvent, hero: CharacterId) {
    if (!isChapterTestRun()) try { localStorage.setItem('im_last_hero', hero); } catch { /* storage unavailable */ }
    this.registry.remove('campaignTransfer'); this.registry.set('intelEvent', event.id); this.registry.set('runConfig', { character: hero });
    this.goBattle('IntelGameScene');
  }

  // ———————————————————————— 弹窗（攻城 / 军情 / 时局） ————————————————————————
  private modalPanel(pw: number, ph: number): Phaser.GameObjects.GameObject { if (!this.desktop) return panel(this, W / 2, H / 2, pw, ph); return lqFloat(this, W / 2, H / 2, pw, ph); /* 电脑版去金边大框（2026-11-21） */ }
  private modalButton(root: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, primary: boolean, name: string, fn: () => void) {
    if (this.desktop) { const b = homeCommand(this, x, y, w, 46, label, primary); b.hit.setName(name).on('pointerup', fn); root.add([b.g, b.caption, b.hit]); return; }
    const wb = worldButton(this, x, y, label, fn, w); wb.image.setName(name); root.add([wb.image, wb.text]);
  }
  private lordLine(root: Phaser.GameObjects.Container, x: number, y: number, w: number, hero: CharacterId, name: string) {
    const n = CHARACTERS.find(c => c.id === hero)?.name ?? hero;
    root.add(worldText(this, x, y, '出战', 13, '#b6a07b'));
    const g = this.add.graphics(); lqPanel(g, x, y + 20, w, 44, { shadow: false, glow: false }); root.add(g); root.add(this.add.rectangle(x + w / 2, y + 42, w, 44, 0, 0).setName(name));
    root.add(worldText(this, x + w / 2, y + 42, `主将 ${n} · 亲征`, 18, '#f0d79e').setOrigin(.5).setName(name + '-text'));
  }
  private modalRoot(name: string, pw: number, ph: number) {
    const root = this.add.container(0, 0).setDepth(60).setName(name); this.modal = root;
    root.add(this.add.rectangle(W / 2, H / 2, W, H, 0x07100b, this.desktop ? .86 : .72).setInteractive()); root.add(this.modalPanel(pw, ph)); return root;
  }
  closeModal() { this.modal?.destroy(); this.modal = undefined; }
  openSiege(city: CityDef, defense = false) {
    const alert = defense ? this.alertFor(city.id) : undefined;
    if (this.modal || (defense ? !alert : !routeSiegeOpen(city.id, loadWorld(), this.owned) && !isChapterTestRun())) return;
    const warn = alert ? '' : this.lossWarning(), desk = this.desktop, dy = warn ? (desk ? 36 : 54) : 0;
    const owner = alert ? alert.attacker : cityOwner(city.id, this.era, this.owned), T = SIEGE[city.tier], first = !this.capturedEver.includes(city.id), k = first ? 1 + FIRST_CAPTURE_BONUS : 1, hero = this.lordId();
    const pw = Math.min(W - 40, 520), ph = (desk ? 400 : 560) + dy, px = W / 2 - pw / 2, py = H / 2 - ph / 2, root = this.modalRoot('siege-modal', pw, ph);
    const t = (x: number, y: number, s: string, size = 16, color = '#ede3c9') => { const o = worldText(this, x, y, s, size, color); root.add(o); return o; };
    t(px + 24, py + 20, `${alert ? '守卫' : '攻打'} ${city.name}`, 24, '#f0d79e').setFontFamily(desk ? TITLE_FONT : HEADING_FONT); t(px + 24, py + 54, `${TIER_NAME[city.tier]} · ${city.region} · ${alert ? '来犯' : '守军'}：${FACTIONS[owner].name}`, 14, FACTIONS[owner].css);
    const how = city.tier === 'small' ? '拔掉帅旗，再占领府衙（限 2 分 30 秒）' : city.tier === 'medium' ? '摧毁两座箭楼（会放箭），再占领府衙（限 3 分 30 秒）' : '破城门、毁两座箭楼、击败大将，再占领府衙（限 5 分 30 秒）';
    const body = alert ? `胜利条件：击退${city.tier === 'small' ? '两' : city.tier === 'medium' ? '三' : '四'}波来犯之敌，击败敌将（无城门）\n敌将：${defenseBossName(city, owner)}\n守城奖励：军粮 +${rewardGrain(T.reward.merits / 2, T.reward.provisions / 2)}，告急解除\n失败城池仍在，可再守；改去别处出征则此城失守。`
      : `胜利条件：${how}\n${city.tier === 'large' ? '守城大将：' + siegeBossName(city, owner) : '守军：' + FACTIONS[owner].name + ' · 占领府衙即破城'}\n占领奖励：军粮 +${rewardGrain(T.reward.merits * k, T.reward.provisions * k)}${first ? '（首次攻占 +50%）' : ''}\n失败不损失城池与资源，可再次攻打。`;
    const info = t(px + 24, py + 86, body, 14, '#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw - 48);
    if (warn) t(px + 24, info.y + info.height + 4, warn, 13, '#ff8a70').setWordWrapWidth(pw - 48).setName('siege-warning');
    this.lordLine(root, px + 24, py + dy + (desk ? 214 : 236), pw - 48, hero, 'siege-lord');
    this.modalButton(root, px + pw * .27, py + ph - (desk ? 48 : 58), pw * .38, '返回', false, 'siege-cancel', () => this.closeModal());
    this.modalButton(root, px + pw * .73, py + ph - (desk ? 48 : 58), pw * .38, alert ? '出征守城' : '出征攻城', true, 'siege-go', () => this.launchSiege(city, hero, !!alert));
  }
  private intelRewardText(e: IntelEvent) { const r = intelReward(e); return `军粮 +${rewardGrain(r.merits, r.provisions, r.money)}` + (r.item ? ` · ${QUALITIES[r.item.quality].label}·${QUALITIES[r.item.quality].name}兵装 1 件（${Math.round(r.item.orangeChance * 100)}% 为${QUALITIES.orange.label}·${QUALITIES.orange.name}）` : ''); }
  private intelLeft(e: IntelEvent) { const left = e.expires - seasonIndex(loadWorld().town) + 1; return left > 1 ? `剩余 ${left} 季（含本季）` : '仅限本季'; }
  private intelLeftShort(e: IntelEvent) { const left = e.expires - seasonIndex(loadWorld().town) + 1; return left > 1 ? `余 ${left} 季` : '本季'; }
  openIntel(e: IntelEvent) {
    if (this.modal) return; const info = INTEL_INFO[e.kind], desk = this.desktop, warn = this.lossWarning(), dy = warn ? (desk ? 36 : 54) : 0, hero = this.lordId();
    const pw = Math.min(W - 40, 520), ph = (desk ? 400 : 560) + dy, px = W / 2 - pw / 2, py = H / 2 - ph / 2, root = this.modalRoot('intel-modal', pw, ph);
    const t = (x: number, y: number, s: string, size = 16, color = '#ede3c9') => { const o = worldText(this, x, y, s, size, color); root.add(o); return o; };
    t(px + 24, py + 20, intelTitle(e), 24, '#f0d79e').setFontFamily(desk ? TITLE_FONT : HEADING_FONT); t(px + 24, py + 54, `军情 · ${info.name} · ${this.intelLeft(e)}`, 14, info.css);
    const how = e.kind === 'escort' ? '胜利条件：商车抵达终点（守在车旁它才前进，约 90 秒）' : e.kind === 'bandit' ? '胜利条件：清剿两波流寇，击败寇首（约 2 分钟）' : `胜利条件：清剿三波亲兵，击败${e.general}（约 3 分钟）`;
    const fail = e.kind === 'escort' ? '商车被毁则商队被劫、此事作罢；超时或阵亡可再战。' : e.kind === 'bandit' ? '失败可再战；本季未平定，该城本季产出减半。' : '失败可再战，期限内悬赏有效。';
    const infoText = t(px + 24, py + 86, `${how}\n奖励：${this.intelRewardText(e)}\n${fail}`, 14, '#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw - 48);
    if (warn) t(px + 24, infoText.y + infoText.height + 4, warn, 13, '#ff8a70').setWordWrapWidth(pw - 48).setName('intel-warning');
    this.lordLine(root, px + 24, py + dy + (desk ? 214 : 236), pw - 48, hero, 'intel-lord');
    this.modalButton(root, px + pw * .27, py + ph - (desk ? 48 : 58), pw * .38, '返回', false, 'intel-cancel', () => this.closeModal());
    this.modalButton(root, px + pw * .73, py + ph - (desk ? 48 : 58), pw * .38, '出征', true, 'intel-go', () => this.launchIntel(e, hero));
  }
  /** 时局变化 / 城池失守 提示。 */
  private showNotice(advance: EraAdvance | null, lost: string[]) {
    const desk = this.desktop, pw = Math.min(W - 40, 540), lines: string[] = []; let title = '城池失守';
    if (advance) {
      const e = eraDef(advance.to); title = `时局变化 · 公元${e.year}年`; lines.push(`【${e.name}】${e.summary}`);
      const moved = advance.changes.map(c => `${cityById(c.city)?.name}：${FACTIONS[c.from].name} → ${FACTIONS[c.to].name}`);
      if (moved.length) lines.push('城池易主：' + (moved.length > 8 ? moved.slice(0, 8).join('；') + `；等 ${moved.length} 城` : moved.join('；')));
      if (advance.fallen.length) lines.push('势力覆灭：' + advance.fallen.map(f => FACTIONS[f].name).join('、'));
      lines.push(advance.alerts.length ? '边城告急：' + advance.alerts.map(a => `${cityById(a.city)?.name}（${FACTIONS[a.attacker].name}来犯）`).join('、') + '\n点选告急城池即可守城；若出征别处，告急城池将失守。' : '我方城池暂无战事。');
    }
    if (lost.length) lines.push(`上次出征时告急未救，${lost.map(id => cityById(id)?.name).join('、')}已失守。`);
    const text = worldText(this, 0, 0, lines.join('\n\n'), desk ? 15 : 16, '#e4dcc4').setWordWrapWidth(pw - 48, true).setLineSpacing(5);
    const ph = Math.min(H - 80, text.height + 150), px = W / 2 - pw / 2, py = H / 2 - ph / 2, root = this.modalRoot('era-modal', pw, ph); root.setDepth(70);
    root.add(worldText(this, px + 24, py + 20, title, 24, '#f0d79e')); text.setPosition(px + 24, py + 64); root.add(text);
    this.modalButton(root, W / 2, py + ph - (desk ? 44 : 54), pw * .5, '知道了', true, 'era-ok', () => this.closeModal());
  }
  /** 新篇开启：横幅 + 镜头飞到新一章的第一关。 */
  private chapterBanner() {
    const s = loadWorld(), c = currentChapter(s), n = stageNode(c.id, 1); if (!n) return;
    const banner = this.banner(`新篇开启 · 第${c.numeral}章「${c.title}」`, `${c.era} · 公元${c.year}年 · 迷雾沿路散开`, 'chapter-banner');
    this.later(350, () => this.flyTo(n.x, n.y, this.minZoom * ZOOM_TIERS[1], 900)); this.later(3600, () => { if (banner.active) this.tweens.add({ targets: banner, alpha: 0, duration: 500, onComplete: () => banner.destroy() }); });
  }
  private banner(title: string, sub: string, name: string): Phaser.GameObjects.Container {
    const t = worldText(this, 0, 0, title, 26, '#f6dc9a').setOrigin(.5).setFontFamily(TITLE_FONT).setStroke('#120904', 4).setName(name + '-title'), st = worldText(this, 0, 30, sub, 13, '#e4dcc4').setOrigin(.5);
    const bw = Math.max(t.width, st.width) + 56, g = this.add.graphics(); lacquerPlate(g, -bw / 2, -24, bw, 72, .94, 0xe5c47d);
    const root = this.add.container(this.area.x + this.area.w / 2, this.area.y + 40, [g, t, st]).setDepth(45).setName(name).setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, y: this.area.y + 50, duration: 450, delay: 200 }); return root;
  }
  /** 攻城归来：「某城 归入版图」横幅 + 朱印「归」，选中并对准该城。 */
  private playCapture(c: CityDef) {
    const n = siegeNodeOf(c.id); if (n) { this.select({ kind: 'node', node: n }); this.centerOn(n.x, n.y); }
    const inc = cityIncome(c.tier, cityLevels(c.id)), root = this.add.container(0, 0).setDepth(45).setName('capture-reveal');
    const b = this.banner(`${c.name} 归入版图`, `${TIER_NAME[c.tier]} · 每战 ${incomeText(inc)} · 点城池可建设`, 'capture-banner'); root.add(b);
    const nv = n && this.nodes.get(n.id); if (nv) { const p = nv.root.getWorldTransformMatrix(); const seal = this.add.container(p.tx + 34, p.ty - 30).setName('capture-seal'); seal.add(this.add.image(0, 0, 'rt_medal_cleared', 'seal').setDisplaySize(40, 40)); seal.add(worldText(this, 0, 0, '归', 20, '#7a1a0e').setOrigin(.5).setFontFamily(TITLE_FONT)); seal.setScale(2.4).setAlpha(0).setAngle(-8); this.tweens.add({ targets: seal, scale: 1, alpha: 1, duration: 260, delay: 900, ease: 'Quad.easeIn', onComplete: () => this.cameras.main.shake(140, .003) }); root.add(seal); }
    // 用真实时间计时：刚启动的场景第一帧的时间差很大，delayedCall / 补间 delay 会在第一帧就到点（载入慢时横幅一闪就没）
    this.later(4200, () => { if (root.active) this.tweens.add({ targets: root, alpha: 0, duration: 500, onComplete: () => root.destroy() }); });
  }
}
