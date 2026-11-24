import Phaser from 'phaser';
import {STAR_ICON_FILE} from '../data/starFx';
import {STAR_COMBOS,type StarComboId} from '../data/starOuter';
import { takeStarNotice } from '../systems/HeroProgress';
import { FONT, HEADING_FONT, TITLE_FONT, GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP } from '../config';
import { STAR_EDGES, STAR_NODES, STAR_BY_ID, STAR_REGIONS, STAR_RULES, keystonesLit, planStarPath, lightBlock, litSet, starPoints, type StarNode } from '../data/starMap';
import type { AttributeId } from '../data/attributes';
import { statEffective, statSource } from '../data/heroStats';
import { CHARACTERS } from '../data/characters';
import { homeCommand } from './HomeCommand';

/**
 * 星图 · 正式界面（2026-11-21 总制作人派单，取代临时的 StarMapDevPanel）。只在开关 starMapOn() 打开时出现。
 * 两个入口共用：营寨武将谱「属性」页（HeroCodexUI）、战斗内 C 键面板（GameScene.renderStarPanel，游戏暂停）。
 *
 * 版式（电脑布局优先）：整屏铺手绘底图 bg_starmap，不加外框 / 面板底板；图居中，可拖动平移、滚轮缩放（0.8–1.6 倍，1 = 正好一屏放下）。
 * 左侧压在底图上写武将名 / 等级 / 星数 / 四维生效点 / 已点亮的要星主星；右侧写选中节点的名字、类型、说明与唯一的主按钮「点亮」。
 * 字后只垫很淡的墨晕。节点用预染色底座三态（off / ready / on），图标透明度 45% / 75% / 100%；桥上跨系要星用 neutral 套；
 * 连线用两态贴图（两端都点亮才是流金线）；点亮播 12 帧手绘序列帧 fx_light_strip（要星 88、主星 128、小星 56、入口 88）。
 * 美术与尺寸见共享笔记 star-map-art.md；节点坐标是 1600×900 设计稿坐标（data/starMap.ts），整张图在容器里等比缩放。
 */
export interface StarMapState {
  hero: string; heroName: string; level: number;
  /** 这位武将的入口。 */
  gate: string;
  /** 已点亮的星（不含入口）。 */
  lit: readonly string[];
  /** 还能点几颗。 */
  free: number;
  triggers?:Readonly<Record<string,number>>;
}
export interface StarMapOpts {
  state: () => StarMapState;
  /** 点亮一颗；返回是否成功。 */
  onLight: (id: string) => boolean;
  /** 洗点（不给就没有，战斗内不提供）：label 是按钮字，act 返回提示语。 */
  respec?: { label: () => string; act: () => string };
  /** 返回按钮。 */
  close: { label: () => string; act: () => void };
  depth?: number;
}

const P = 'sm_', BASE = 'assets/star-map/';
const SETS = ['neutral', 'strength', 'agility', 'intellect', 'command'] as const;
const KINDS = ['gate', 'small', 'notable', 'keystone'] as const;
const STATES = ['off', 'ready', 'on'] as const;
type NodeState = typeof STATES[number];
/** 设计稿 1× 显示尺寸（底座图是 2×）、图标尺寸、点亮特效尺寸、命中半径。 */
const DISP: Record<StarNode['kind'], number> = { gate: 44, small: 20, notable: 44, keystone: 64 };
const ICON: Partial<Record<StarNode['kind'], number>> = { notable: 28, keystone: 40 };
const FX: Record<StarNode['kind'], number> = { gate: 88, small: 56, notable: 88, keystone: 128 };
const HIT: Record<StarNode['kind'], number> = { gate: 26, small: 16, notable: 26, keystone: 36 };
const ICON_ALPHA: Record<NodeState, number> = { off: .45, ready: .75, on: 1 };
const ICONS: Record<string, string> = { '千钧': 'qianjun', '破阵': 'pozhen', '斩将': 'zhanjiang', '铁骨': 'tiegu', '背水': 'beishui', '万人敌': 'wanrendi', '轻骑': 'qingqi', '游刃': 'youren', '疾影': 'jiying', '连击': 'lianji', '追风': 'zhuifeng', '一骑当千': 'yiqi', '凝神': 'ningshen', '连珠': 'lianzhu', '广域': 'guangyu', '余烬': 'yujin', '妙算': 'miaosuan', '火烧连营': 'huoshao', '励军': 'lijun', '募众': 'muzhong', '同袍': 'tongpao', '严阵': 'yanzhen', '号令': 'haoling', '三军统帅': 'sanjun', '骁锐': 'xiaorui', '奇谋': 'qimou', '帷幄': 'weiwo', '身先士卒': 'shenxian' };
const KIND_NAME: Record<StarNode['kind'], string> = { gate: '入口', small: '小星', notable: '要星', keystone: '主星' };
const ATTR_SHORT: Record<AttributeId, string> = { strength: '力量', agility: '敏捷', intellect: '智力', command: '统御' };
const XS = STAR_NODES.map(n => n.x), YS = STAR_NODES.map(n => n.y);
const BOUNDS = { x0: Math.min(...XS) - 40, x1: Math.max(...XS) + 40, y0: Math.min(...YS) - 40, y1: Math.max(...YS) + 40 };
/** 中心头像位：四个入口围出的方框中点。 */
const CENTER = (() => { const g = STAR_NODES.filter(n => n.kind === 'gate'); return { x: g.reduce((s, n) => s + n.x, 0) / g.length, y: g.reduce((s, n) => s + n.y, 0) / g.length }; })();
const ZOOM_MIN = .8, ZOOM_MAX = IS_DESKTOP ? 1.6 : 3.4;
/** 底图（美术之后交 bg_starmap_stars.webp 替换时只改这里）。 */
export const STAR_BG = { key: P + 'bg', file: 'bg_starmap.webp' } as const;
/**
 * 八卦阵装饰层（2026-11-21 用户批准星图背景做成「八卦阵」；素材与坐标见 public/assets/star-map/bagua/layout.json）。
 * 星图坐标、1× 显示尺寸（图本身 2×）、不透明度——微调只改这张表。放在星图层里：跟着平移缩放、在文字栏下淡出，不参与点击。
 */
export const BAGUA = {
  plate: { file: 'bagua/taiji_plate.png', x: 800, y: 450, w: 368, h: 368, alpha: .2 },
  trigrams: [
    { id: 'qian', x: 505, y: 235 }, { id: 'xun', x: 1095, y: 235 }, { id: 'li', x: 1095, y: 665 }, { id: 'kun', x: 505, y: 665 },
    { id: 'zhen', x: 800, y: 255 }, { id: 'dui', x: 1000, y: 450 }, { id: 'kan', x: 800, y: 645 }, { id: 'gen', x: 600, y: 450 },
  ],
  trigram: { w: 56, h: 52, alpha: .32 },
  /** 星空层（透明星点，铺满全屏、叠在底图上；不跟星图平移缩放）。星的强度单独调这个 alpha；不用烘好的 bg_starmap_stars.webp。 */
  sky: { file: 'stars_layer.png', alpha: 1 },
} as const;
/** 可见区边上的淡出带宽度（逻辑像素）。 */
const FADE_E = 16;

const setOf = (n: StarNode): string => (n.region === 'bridge' ? 'neutral' : n.region);
const nodeKey = (n: StarNode, st: NodeState): string => `${P}${setOf(n)}_${n.kind}_${st}`;

/** 星图要用的图（第一次打开时载入；已有的跳过）。 */
function queueArt(scene: Phaser.Scene, hero: string): number {
  const L = scene.load; let n = 0;
  const img = (k: string, url: string) => { if (!scene.textures.exists(k)) { L.image(k, url); n++; } };
  img(STAR_BG.key, BASE + STAR_BG.file); img(P + 'sky', BASE + BAGUA.sky.file); img(P + 'bagua_plate', BASE + BAGUA.plate.file); for (const t of BAGUA.trigrams) img(P + 'bagua_' + t.id, `${BASE}bagua/trigram_${t.id}.png`); img(P + 'line_ink', BASE + 'line_ink.png'); img(P + 'line_gold', BASE + 'line_gold.png');
  for (const s of SETS) for (const k of KINDS) for (const st of STATES) img(`${P}${s}_${k}_${st}`, `${BASE}nodes/${s}/${k}_${st}.png`);
  for (const id of new Set(Object.values(ICONS))) img(P + 'icon_' + id, `${BASE}icon_${id}.png`);
  if (!scene.textures.exists(P + 'fx')) { L.spritesheet(P + 'fx', BASE + 'fx_light_strip.png', { frameWidth: 192, frameHeight: 192 }); n++; }
  if (CHARACTERS.some(c => c.id === hero)) img('ink_hero_' + hero, `assets/ink-scroll/${hero}.webp`);
  return n;
}

export class StarMapUI {
  readonly root: Phaser.GameObjects.Container;
  private map!: Phaser.GameObjects.Container;
  private readonly nodes = new Map<string, { n: StarNode; base: Phaser.GameObjects.Image; icon?: Phaser.GameObjects.Image; hit: Phaser.GameObjects.Zone; baseAlpha: number; iconAlpha: number; fade: number }>();
  private readonly lines: Array<{ a: string; b: string; ink: Phaser.GameObjects.TileSprite; gold: Phaser.GameObjects.TileSprite }> = [];
  private ring!: Phaser.GameObjects.Graphics;
  private left!: Phaser.GameObjects.Text;
  private leftSub!: Phaser.GameObjects.Text;
  private rTitle!: Phaser.GameObjects.Text;
  private rKind!: Phaser.GameObjects.Text;
  private rDesc!: Phaser.GameObjects.Text;
  private rStatus!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private respecBtn?: Phaser.GameObjects.Text;
  private closeBtn!: Phaser.GameObjects.Text;
  private lightBtn?: ReturnType<typeof homeCommand>;
  private selected: string | null = null;
  private hover: string | null = null;
  private lastClick = { id: '', t: 0 };
  private fit = 1; private zoom = 1;
  private drag: { x: number; y: number; mx: number; my: number; moved: boolean } | null = null;
  private built = false;
  private readonly W = GAME_WIDTH; private readonly H = GAME_HEIGHT;

  constructor(private readonly scene: Phaser.Scene, private readonly o: StarMapOpts) {
    this.root = scene.add.container(0, 0).setScrollFactor(0).setName('star-map').setDepth(o.depth ?? 0);
    // 整屏吃掉点击（也是拖动平移的抓手）；先铺纯色，底图载入后铺上
    const catcher = scene.add.rectangle(0, 0, this.W, this.H, 0x0d0b09, 1).setOrigin(0).setScrollFactor(0).setInteractive().setName('star-map-catcher');
    this.root.add(catcher);
    const st = o.state();
    if (queueArt(scene, st.hero) > 0) {
      const wait = scene.add.text(this.W / 2, this.H / 2, '星图载入中…', { fontFamily: HEADING_FONT, fontSize: '18px', color: '#cdb98e', resolution: 2 }).setOrigin(.5).setScrollFactor(0);
      this.root.add(wait);
      scene.load.once('complete', () => { if (!this.root.active) return; wait.destroy(); this.build(); });
      scene.load.start();
    } else this.build();
    this.root.once('destroy', () => this.unbind());
  }

  destroy(): void { this.root.destroy(); }

  // ───────────────────────────── 搭建 ─────────────────────────────
  private build(): void {
    const s = this.scene, W = this.W, H = this.H;
    this.built = true;
    if (!s.anims.exists(P + 'fx_play')) s.anims.create({ key: P + 'fx_play', frames: s.anims.generateFrameNumbers(P + 'fx', { start: 0, end: 11 }), frameRate: 15, repeat: 0 });
    const bg = s.add.image(W / 2, H / 2, STAR_BG.key).setScrollFactor(0); bg.setScale(Math.max(W / bg.width, H / bg.height)); this.root.add(bg);
    if (s.textures.exists(P + 'sky')) { const sky = s.add.image(W / 2, H / 2, P + 'sky').setScrollFactor(0).setAlpha(BAGUA.sky.alpha).setName('star-map-sky'); sky.setScale(Math.max(W / sky.width, H / sky.height)); this.root.add(sky); }
    // 图：容器里用设计稿坐标；默认缩放 = 正好一屏放下（左右各留出文字栏）
    this.map = s.add.container(0, 0).setScrollFactor(0).setName('star-map-layer'); this.root.add(this.map);
    const sideL = IS_DESKTOP ? 210 : 0, sideR = IS_DESKTOP ? 230 : 0;
    this.clip = { l: sideL, r: W - sideR, t: IS_DESKTOP?4:148, b: IS_DESKTOP?H-24:H-410 };
    // 默认缩放：整张图放进可见区并让出淡出带，默认视图里没有一颗星是半透明的
    const availW = this.clip.r - this.clip.l - 2 * FADE_E, availH = this.clip.b - this.clip.t - 2 * FADE_E;
    this.fit = Math.min(availW / (BOUNDS.x1 - BOUNDS.x0), availH / (BOUNDS.y1 - BOUNDS.y0));
    this.home = { x: (this.clip.l + this.clip.r) / 2, y: (this.clip.t + this.clip.b) / 2 };
    // 八卦阵（最底层：太极盘 + 八卦，在连线和节点之下；不可点）
    { const add = (key: string, x: number, y: number, w: number, h: number, alpha: number, name: string) => { if (!s.textures.exists(key)) return; const im = s.add.image(x, y, key).setDisplaySize(w, h).setAlpha(alpha).setScrollFactor(0).setName(name); this.map.add(im); this.decor.push({ obj: im, x, y, alpha }); };
      const pl = BAGUA.plate; add(P + 'bagua_plate', pl.x, pl.y, pl.w, pl.h, pl.alpha, 'star-bagua-plate');
      for (const t of BAGUA.trigrams) add(P + 'bagua_' + t.id, t.x, t.y, BAGUA.trigram.w, BAGUA.trigram.h, BAGUA.trigram.alpha, 'star-bagua-' + t.id); }
    // 连线（先画，在节点下面）
    for (const [a, b] of STAR_EDGES) {
      const A = STAR_BY_ID.get(a)!, B = STAR_BY_ID.get(b)!, len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x);
      const mk = (key: string, alpha: number) => { const tex = s.textures.get(key).getSourceImage() as { height: number }; const t = s.add.tileSprite(A.x, A.y, len * 2, tex.height, key).setOrigin(0, .5).setScale(.5).setRotation(ang).setAlpha(alpha).setScrollFactor(0); this.map.add(t); return t; };
      this.lines.push({ a, b, ink: mk(P + 'line_ink', .72), gold: mk(P + 'line_gold', 1) });
    }
    // 中心头像（水墨立轴取头肩，裁成圆；没图用像素头像）
    this.portrait();
    // 节点
    for (const n of STAR_NODES) {
      const base = s.add.image(n.x, n.y, nodeKey(n, 'off')).setDisplaySize(DISP[n.kind] * this.baseScale(n.kind), DISP[n.kind] * this.baseScale(n.kind)).setScrollFactor(0).setName('star-base-' + n.id);
      this.map.add(base);
      const ic = (STAR_ICON_FILE[n.id] ?? ICONS[n.name]), size = ICON[n.kind];
      const icon = ic && size ? s.add.image(n.x, n.y, P + 'icon_' + ic).setDisplaySize(size, size).setScrollFactor(0) : undefined;
      if (icon) this.map.add(icon);
      const r = HIT[n.kind], hit = s.add.zone(n.x, n.y, r * 2, r * 2).setScrollFactor(0).setName('star-' + n.id).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(r, r, r), hitAreaCallback: Phaser.Geom.Circle.Contains });
      hit.on('pointerover', () => { this.hover = n.id; this.renderTip(); });
      hit.on('pointerout', () => { if (this.hover === n.id) { this.hover = null; this.renderTip(); } });
      hit.on('pointerup', (p: Phaser.Input.Pointer) => { if (this.drag?.moved) return; this.click(n.id, p); });
      this.map.add(hit);
      this.nodes.set(n.id, { n, base, icon, hit, baseAlpha: 1, iconAlpha: 1, fade: 1 });
    }
    this.ring = s.add.graphics().setScrollFactor(0); this.map.add(this.ring);
    this.applyView();
    this.buildText();
    this.bind();
    // 旧存档第一次打开星图：一次性说明，写在右栏「选一颗星」的说明里（HeroProgress.takeStarNotice 只返回一次 true；选中任意一颗星后不再显示）
    if (takeStarNotice()) this.intro = '四维加点已换成星图：升级得星，点亮相连的星获得加成；原先的属性点已退回。\n\n';
    this.render();
  }
  private intro = '';
  private home = { x: 0, y: 0 };
  /** 星图可见区（左右文字栏与底部操作提示之外）；区外的星、线、头像淡出到 0 并关掉点击（2026-11-21 验收：放大 / 拖动后文字栏压在星上）。 */
  private clip = { l: 0, r: 0, t: 0, b: 0 };
  private readonly decor: Array<{ obj: Phaser.GameObjects.Image; x: number; y: number; alpha: number }> = [];
  private portraitParts: Array<{ setAlpha: (a: number) => unknown }> = [];
  private fadeAt(x: number, y: number): number {
    const s = this.fit * this.zoom, sx = this.map.x + x * s, sy = this.map.y + y * s, c = this.clip, E = FADE_E;
    return Phaser.Math.Clamp(Math.min((sx - c.l) / E, (c.r - sx) / E, (sy - c.t) / E, (c.b - sy) / E), 0, 1);
  }
  /** 按屏幕位置给每颗星 / 每条线 / 中心头像算淡出（平移、缩放、刷新后调用）。 */
  private applyFade(): void {
    if (!this.built) return;
    for (const v of this.nodes.values()) {
      const a = this.fadeAt(v.n.x, v.n.y); v.fade = a;
      v.base.setAlpha(a * v.baseAlpha); v.icon?.setAlpha(a * v.iconAlpha);
      if (v.hit.input) v.hit.input.enabled = a > .5;
    }
    for (const l of this.lines) { const A = STAR_BY_ID.get(l.a)!, B = STAR_BY_ID.get(l.b)!, a = Math.min(this.fadeAt(A.x, A.y), this.fadeAt(B.x, B.y)); l.ink.setAlpha(.72 * a); l.gold.setAlpha(a); }
    const pa = this.fadeAt(CENTER.x, CENTER.y); for (const o of this.portraitParts) o.setAlpha(pa);
    for (const d of this.decor) d.obj.setAlpha(d.alpha * this.fadeAt(d.x, d.y));
    this.ring.setAlpha(this.selected ? this.nodes.get(this.selected)?.fade ?? 1 : 1);
  }
  /** 底座图的显示尺寸系数（图是 2×，显示按设计稿 1×；入口 / 要星图 128 宽包含外圈笔触，按设计稿 44 直径换算）。 */
  private baseScale(kind: StarNode['kind']): number { const img2x = { gate: 128, small: 58, notable: 128, keystone: 186 }[kind], disp2x = DISP[kind] * 2; return img2x / disp2x; }

  private portrait(): void {
    const s = this.scene, st = this.o.state(), key = 'ink_hero_' + st.hero, faceKey = P + 'face_' + st.hero, R = 40;
    if (!s.textures.exists(faceKey) && s.textures.exists(key)) {
      const src = s.textures.get(key).getSourceImage() as HTMLImageElement, c = document.createElement('canvas'); c.width = c.height = 160;
      const g = c.getContext('2d')!; g.beginPath(); g.arc(80, 80, 78, 0, Math.PI * 2); g.clip();
      // 立轴人物在上半部：取宽度 70%、从顶上 6% 开始的方块（头肩）
      const w = src.width * .7, sx = (src.width - w) / 2, sy = src.height * .06; g.drawImage(src, sx, sy, w, w, 0, 0, 160, 160);
      s.textures.addCanvas(faceKey, c);
    }
    const ring = s.add.graphics().setScrollFactor(0); this.portraitParts.push(ring); ring.fillStyle(0x0b0806, .85).fillCircle(CENTER.x, CENTER.y, R + 3).lineStyle(2, 0xc9a35e, .9).strokeCircle(CENTER.x, CENTER.y, R + 3); this.map.add(ring);
    const c = CHARACTERS.find(x => x.id === st.hero);
    if (s.textures.exists(faceKey)) { const im = s.add.image(CENTER.x, CENTER.y, faceKey).setDisplaySize(R * 2, R * 2).setScrollFactor(0).setName('star-map-face'); this.map.add(im); this.portraitParts.push(im); }
    else if (c && s.textures.exists(c.portrait)) { const im = s.add.image(CENTER.x, CENTER.y, c.portrait).setScrollFactor(0).setName('star-map-face'); im.setScale(Math.min(R * 1.6 / im.width, R * 1.6 / im.height)); this.map.add(im); this.portraitParts.push(im); }
  }

  private buildText(): void {
    const s = this.scene, W = this.W, H = this.H;
    const t = (x: number, y: number, size: number, color: string, font = FONT) => { const o = s.add.text(x, y, '', { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }).setScrollFactor(0).setStroke('#0b0806', 3); this.root.add(o); return o; };
    // 很淡的墨晕衬底：左右两栏各一片由内向外变淡的暗色（不画边框）
    const wash = s.add.graphics().setScrollFactor(0); this.root.addAt(wash, this.root.getIndex(this.map) + 1);
    const fade = (x0: number, w: number, toRight: boolean) => { const N = 14; for (let i = 0; i < N; i++) { const k = toRight ? i / N : 1 - i / N; wash.fillStyle(0x060403, .5 * (1 - k) * .9 + .04).fillRect(x0 + i * w / N, 0, w / N + 1, H); } };
    if (IS_DESKTOP) { fade(0, 230, true); fade(W - 250, 250, false); }
    const lx = 22;
    this.left = t(lx, 22, 26, '#f3d9a0', TITLE_FONT).setName('star-map-hero');
    this.leftSub = t(lx, 62, 13, '#e4d5b2').setLineSpacing(6).setWordWrapWidth(190, true).setName('star-map-stats');
    const rx = W - 226, rw = IS_DESKTOP?204:W-44;
    this.rTitle = t(IS_DESKTOP?rx:22, IS_DESKTOP?40:H-390, IS_DESKTOP?20:28, '#f6dc9a', HEADING_FONT).setWordWrapWidth(rw, true).setName('star-map-sel-name');
    this.rKind = t(IS_DESKTOP?rx:22, IS_DESKTOP?70:H-358, IS_DESKTOP?12:18, '#bda57a').setWordWrapWidth(rw,true).setName('star-map-sel-kind');
    this.rDesc = t(IS_DESKTOP?rx:22, IS_DESKTOP?92:H-330, IS_DESKTOP?14:19, '#efe3c6').setWordWrapWidth(rw, true).setLineSpacing(4).setName('star-map-sel-desc');
    this.rStatus = t(IS_DESKTOP?rx:22, IS_DESKTOP?200:H-220, IS_DESKTOP?12:17, '#d8a890').setWordWrapWidth(rw, true).setLineSpacing(3).setName('star-map-sel-status');
    this.msg = t(rx, H - 128, 12, '#9fd0a0').setWordWrapWidth(rw, true).setName('star-map-msg');
    // 小号描金文字按钮：洗点 / 返回
    const small = (x: number, y: number, name: string, act: () => void) => {
      const b = t(x, y, IS_DESKTOP?14:20, '#e8c77e', HEADING_FONT).setOrigin(0, .5).setName(name).setPadding(4, 4).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setColor('#fff0c8')).on('pointerout', () => b.setColor('#e8c77e'));
      b.on('pointerup', act); return b;
    };
    if(!IS_DESKTOP){small(W-92,28,'star-map-zoom-out',()=>this.zoomStep(1/1.3)).setText('－').setFontSize(24).setPadding(8,8);small(W-42,28,'star-map-zoom-in',()=>this.zoomStep(1.3)).setText('＋').setFontSize(24).setPadding(8,8);}
    small(IS_DESKTOP?22:22,H-84,'star-map-next',()=>{const st=this.o.state(),p=this.selected?planStarPath(st.lit,this.selected,st.gate):null,n=p?.path[0]?STAR_BY_ID.get(p.path[0]):null;if(!n){this.say(p?.block??'先选择目标星');return;}this.selected=n.id;this.zoom=Math.max(this.zoom,IS_DESKTOP?1.2:2.3);this.map.setScale(this.fit*this.zoom).setPosition(this.home.x-n.x*this.fit*this.zoom,this.home.y-n.y*this.fit*this.zoom);this.applyFade();this.render();}).setText('定位下一星').setPadding(8,10);
    if (this.o.respec) this.respecBtn = small(rx, H - 30, 'star-map-respec', () => { if (!this.o.state().lit.length) { this.say('还没有点亮的星，不用洗点'); return; } this.say(this.o.respec!.act()); this.selected = null; this.render(); });
    this.closeBtn = small(this.o.respec ? rx + 120 : rx, H - 30, 'star-map-close', () => this.o.close.act());
    // 悬停说明（跟着星走）
    this.tip = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#f1e4c4', resolution: 2, backgroundColor: '#0b0806dd', padding: { x: 8, y: 5 }, wordWrap: { width: 220, useAdvancedWrap: true } }).setScrollFactor(0).setVisible(false).setName('star-map-tip');
    this.root.add(this.tip);
    // 操作提示
    t(W / 2, H - 10, IS_DESKTOP?11:12, '#8f8268').setOrigin(.5).setText(IS_DESKTOP?'拖动平移 · 滚轮缩放 · 单击选中，双击或「点亮」确认':'拖动星图 · ＋/－缩放 · 点亮确认').setName('star-map-help');
  }

  // ───────────────────────────── 交互 ─────────────────────────────
  private readonly onWheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
    if (!this.visible()) return;
    const p = this.scene.input.activePointer, before = this.zoom, next = Phaser.Math.Clamp(this.zoom * (dy > 0 ? 1 / 1.12 : 1.12), ZOOM_MIN, ZOOM_MAX);
    if (next === before) return;
    // 以鼠标为中心缩放
    const k = next / before; this.map.x = p.x - (p.x - this.map.x) * k; this.map.y = p.y - (p.y - this.map.y) * k; this.zoom = next; this.map.setScale(this.fit * this.zoom); this.clampPan(); this.applyFade(); this.renderTip();
  };
  private readonly onDown = (p: Phaser.Input.Pointer): void => { if (!this.visible()) return; this.drag = { x: this.map.x, y: this.map.y, mx: p.x, my: p.y, moved: false }; };
  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    const d = this.drag; if (!d || !p.isDown || !this.visible()) return;
    if (!d.moved && Math.hypot(p.x - d.mx, p.y - d.my) < 6) return;
    d.moved = true; this.map.setPosition(d.x + p.x - d.mx, d.y + p.y - d.my); this.clampPan(); this.applyFade(); this.renderTip();
  };
  private readonly onUp = (): void => { const d = this.drag; if (d?.moved) setTimeout(() => { if (this.drag === d) this.drag = null; }, 0); /* 战斗内暂停时 scene.time 不走，不能用 delayedCall */ else this.drag = null; };
  private bind(): void { const i = this.scene.input; i.on('wheel', this.onWheel); i.on('pointerdown', this.onDown); i.on('pointermove', this.onMove); i.on('pointerup', this.onUp); }
  private unbind(): void { const i = this.scene.input; i?.off('wheel', this.onWheel); i?.off('pointerdown', this.onDown); i?.off('pointermove', this.onMove); i?.off('pointerup', this.onUp); }
  private visible(): boolean { let o: Phaser.GameObjects.Container | null = this.root; while (o) { if (!o.visible || !o.active) return false; o = o.parentContainer; } return this.built; }

  private zoomStep(k:number):void{const old=this.zoom;this.zoom=Phaser.Math.Clamp(old*k,ZOOM_MIN,ZOOM_MAX);const ratio=this.zoom/old;this.map.setPosition(this.home.x-(this.home.x-this.map.x)*ratio,this.home.y-(this.home.y-this.map.y)*ratio).setScale(this.fit*this.zoom);this.clampPan();this.applyFade();}
  private applyView(): void { this.zoom = 1; this.map.setScale(this.fit); this.map.setPosition(this.home.x - ((BOUNDS.x0 + BOUNDS.x1) / 2) * this.fit, this.home.y - ((BOUNDS.y0 + BOUNDS.y1) / 2) * this.fit); }
  /** 平移不能把图整个拖出屏：图的中心留在屏幕内。 */
  private clampPan(): void {
    const s = this.fit * this.zoom, cx = this.map.x + ((BOUNDS.x0 + BOUNDS.x1) / 2) * s, cy = this.map.y + ((BOUNDS.y0 + BOUNDS.y1) / 2) * s;
    const nx = Phaser.Math.Clamp(cx, 80, this.W - 80), ny = Phaser.Math.Clamp(cy, 60, this.H - 60);
    this.map.x += nx - cx; this.map.y += ny - cy;
  }

  private click(id: string, p: Phaser.Input.Pointer): void {
    const now = p.upTime || this.scene.time.now, dbl = this.lastClick.id === id && now - this.lastClick.t < 360;
    this.lastClick = { id, t: now }; this.selected = id; this.msg.setText(''); this.intro = '';
    if (dbl) this.tryLight(id); else this.render();
  }
  private say(m: string): void { this.msg.setText(m); }
  private block(id: string): string | null {
    const st = this.o.state(), n = STAR_BY_ID.get(id)!;
    if (id === st.gate) return '自己的入口：免费、自动点亮';
    const b = lightBlock(st.lit, id, st.gate); if (b) return b;
    if (st.free <= 0) return '没有可用的星（每升 1 级得 1 颗）';
    return n ? null : '没有这颗星';
  }
  private tryLight(id: string): void {
    const n = STAR_BY_ID.get(id)!, b = this.block(id);
    if (b) { this.say(b === '已点亮' ? '' : b); this.render(); return; }
    if (!this.o.onLight(id)) { this.say('点亮失败'); this.render(); return; }
    this.say(`点亮「${n.name}」${n.todo ? '（效果尚未开放）' : ''}`);
    this.playFx(n);
    this.render();
  }
  /** 点亮特效：手绘 12 帧序列帧（fx_light_strip），不用程序粒子 / 补间闪光代替。 */
  private playFx(n: StarNode): void {
    const s = this.scene; if (!s.textures.exists(P + 'fx')) return;
    const fx = s.add.sprite(n.x, n.y, P + 'fx', 0).setDisplaySize(FX[n.kind], FX[n.kind]).setScrollFactor(0).setName('star-map-fx');
    this.map.add(fx); fx.play(P + 'fx_play'); fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  // ───────────────────────────── 刷新 ─────────────────────────────
  private stateOf(n: StarNode, lit: Set<string>, st: StarMapState): NodeState {
    if (lit.has(n.id)) return 'on';
    return st.free > 0 && lightBlock(st.lit, n.id, st.gate) === null ? 'ready' : 'off';
  }
  render(): void {
    if (!this.built || !this.root.active) return;
    const st = this.o.state(), lit = litSet(st.lit, st.gate);
    for (const v of this.nodes.values()) {
      const n = v.n, s = this.stateOf(n, lit, st), k = this.baseScale(n.kind) * DISP[n.kind];
      // 入口：已点亮的放大 12%、全亮；可点的略压暗——两者在 44px 下原来几乎一样（2026-11-21 验收第 3 条）
      const gk = n.kind === 'gate' ? (s === 'on' ? 1.12 : 1) : 1;
      v.base.setTexture(nodeKey(n, s)).setDisplaySize(k * gk, k * gk); v.baseAlpha = n.kind === 'gate' && s === 'ready' ? .8 : 1; v.iconAlpha = ICON_ALPHA[s];
    }
    const route=this.selected?planStarPath(st.lit,this.selected,st.gate):null,planned=new Set(route?.path??[]);
    for (const l of this.lines) { const on = lit.has(l.a) && lit.has(l.b),preview=(planned.has(l.a)&&(planned.has(l.b)||lit.has(l.b)))||(planned.has(l.b)&&lit.has(l.a));l.gold.setTint(preview?0x82d5de:0xffffff).setVisible(on||preview);l.ink.setVisible(!on&&!preview); }
    this.applyFade();
    // 选中圈
    this.ring.clear();
    const sel = this.selected ? STAR_BY_ID.get(this.selected) : undefined;
    if (sel) { const r = DISP[sel.kind] / 2 + 7; this.ring.lineStyle(2, 0xffe6a8, .95).strokeCircle(sel.x, sel.y, r).lineStyle(1, 0xffe6a8, .35).strokeCircle(sel.x, sel.y, r + 4); }
    // 左栏
    const src = statSource(st.hero), pts = starPoints(st.lit, st.gate);
    const effLine = (['strength', 'agility', 'intellect', 'command'] as AttributeId[]).map(a => `${ATTR_SHORT[a]}　${pts[a]} 星 · 生效 ${statEffective(src, a, pts[a], st.level).toFixed(1)}`).join('\n');
    const named = st.lit.map(id => STAR_BY_ID.get(id)).filter((n): n is StarNode => !!n && (n.kind === 'notable' || n.kind === 'keystone'));
    const namedLine = named.length ? named.map(n => (n.kind === 'keystone' ? '◆ ' : '· ') + n.name + (n.todo ? '（未开放）' : '')).join('\n') : '尚未点亮要星';
    this.left.setText(st.heroName);
    this.leftSub.setText([`Lv.${st.level}　入口 ${ATTR_SHORT[STAR_BY_ID.get(st.gate)!.attr!]}`, `可用 ${st.free} 颗 · 已点 ${st.lit.length} 颗`, `主星 ${keystonesLit(st.lit)} / ${STAR_RULES.keystoneMax}`, '', '四维', effLine, '', '已点亮的要星 / 主星', namedLine].join('\n'));
    if(!IS_DESKTOP)this.leftSub.setWordWrapWidth(this.W-44,true).setFontSize(18).setLineSpacing(3).setText(`Lv.${st.level} · 可用 ${st.free} 星 · 主星 ${keystonesLit(st.lit)}/2\n${named.filter(n=>n.kind==='keystone').map(n=>n.name).join(' ＋ ')||'沿星路选择你的打法'}\n108颗星 · 点选目标查看连接路线`);
    // 右栏
    this.lightBtn?.g.destroy(); this.lightBtn?.hit.destroy(); this.lightBtn?.caption.destroy(); this.lightBtn = undefined;
    const W = this.W, H = this.H;
    if (!sel) {
      this.rTitle.setText('选一颗星'); this.rKind.setText(''); this.rDesc.setText(this.intro + '单击星看说明；可点的星外圈有一道亮笔触。\n双击或按下方「点亮」确认。'); this.rStatus.setText('');
    } else {
      const where = sel.region === 'bridge' ? `${ATTR_SHORT[sel.between![0]]} ↔ ${ATTR_SHORT[sel.between![1]]}` : ATTR_SHORT[sel.region as AttributeId] + '区';
      this.rTitle.setText(sel.name); this.rKind.setText(`${KIND_NAME[sel.kind]} · ${where}`+this.comboHint(sel.id,st.lit)).setY(this.rTitle.y + this.rTitle.height + 4);
      this.rDesc.setText(sel.id === st.gate ? '你的入口：免费、自动点亮，本身不加属性。' : sel.desc).setY(this.rKind.y + this.rKind.height + 8);
      const b = this.block(sel.id), stat = lit.has(sel.id) ? '已点亮' : b ? '不能点亮：' + b : '可以点亮（花 1 颗星）';
      this.rStatus.setText((sel.todo ? '效果尚未开放（可以点亮，暂无效果）\n' : '') + stat).setColor(lit.has(sel.id) ? '#9fd0a0' : b ? '#d8a890' : '#f3d48a').setY(this.rDesc.y + this.rDesc.height + 12);
      if(route&&!lit.has(sel.id)){const text=route.block??`路线还需 ${route.cost} 星 · ${st.free>=route.cost?'星数足够':'还缺 '+(route.cost-st.free)+' 星'}\n下一颗：${STAR_BY_ID.get(route.path[0])?.name??'—'}`;this.rStatus.setText((b?'不能点亮：'+b+'\n':'')+text);}
      if(st.triggers&&lit.has(sel.id))this.rStatus.setText(this.rStatus.text+`\n本关触发 ${st.triggers[sel.id]??0} 次`);
    }
    // 唯一的主按钮「点亮」：可点时是水墨主按钮，不可点时置灰（原因写在上面）
    const can = !!sel && !lit.has(sel.id) && this.block(sel.id) === null;
    const btn = homeCommand(this.scene, W - 124, H - 84, 180, 46, '点 亮', true, can, 18);
    for (const o of [btn.g, btn.hit, btn.caption]) { (o as unknown as { setScrollFactor: (n: number) => void }).setScrollFactor(0); this.root.add(o); }
    btn.hit.setName('star-map-light'); if (can) btn.hit.on('pointerup', () => { if (this.selected) this.tryLight(this.selected); });
    this.lightBtn = btn;
    this.respecBtn?.setText(this.o.respec!.label()).setAlpha(st.lit.length ? 1 : .5);
    this.closeBtn.setText(this.o.close.label());
    if (this.respecBtn) this.closeBtn.setX(this.respecBtn.x + this.respecBtn.width + 20); // 返回排在洗点后面，不叠字
    this.root.bringToTop(this.tip); this.renderTip();
  }
  private comboHint(id:string,lit:readonly string[]):string{const key=(Object.keys(STAR_COMBOS) as StarComboId[]).find(k=>(STAR_COMBOS[k].keys as readonly string[]).includes(id));if(!key)return '';const c=STAR_COMBOS[key],active=c.keys.every(n=>lit.includes(n));return '\n'+c.name+(active?' · 已成':' · 需'+(STAR_BY_ID.get(c.keys.find(n=>n!==id)!)?.name??''));}
  private renderTip(): void {
    if (!this.built) return;
    const id = this.hover, n = id ? STAR_BY_ID.get(id) : undefined;
    // 悬停的就是选中的那颗：右栏已经写着，不再弹框（2026-11-21 验收第 2 条：悬停框盖住右栏「已点亮」）
    if (!n || this.drag?.moved || id === this.selected || (this.nodes.get(n.id)?.fade ?? 1) < .5) { this.tip.setVisible(false); return; }
    const st = this.o.state(), s = this.fit * this.zoom, x = this.map.x + n.x * s, y = this.map.y + n.y * s;
    this.tip.setText(`${n.name}${n.todo ? '（效果尚未开放）' : ''}\n${n.id === st.gate ? '你的入口' : n.desc}`).setVisible(true);
    // 放在星的右侧；会伸进右栏时改放左侧（左侧也放不下就贴在可见区内）
    const c = this.clip, right = x + 16 + this.tip.width <= c.r - 4, tx = right ? x + 16 : Math.max(c.l + 4, x - 16 - this.tip.width), ty = Phaser.Math.Clamp(y - this.tip.height - 12, 8, c.b - this.tip.height - 4);
    this.tip.setPosition(tx, ty);
  }
}
