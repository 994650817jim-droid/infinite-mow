import Phaser from 'phaser';
import { DEPTH } from '../config';
import { factionTargetOfKey } from './FactionPalette';
import { YUAN_HUE } from './YuanPalette';

/**
 * 敌我区分叠加层（用户 2026-11-16 选定：方案 a 阵营色为默认；方案 c 描边在「军中设置 · 敌我描边」里开启）。
 * 独立叠加层：每帧在场景 postupdate（各单位已经摆好姿势之后）读取敌军 / 部曲 / 随行武将的精灵，不改 Enemy.ts / Ally.ts。
 * - a 阵营色：调色板替换（不重画图）。我方部曲衣甲布料换成统一的青色；敌军按图集势力加深（黄巾图集偏黄，其余赤红）。
 *   首领与随行武将保持原画（武将标志色不能换掉）。
 * - b 脚下徽记（样品，仅 ?iff=b 可见）：像素短弧，我方青、敌方红；精锐双弧、首领金红宽弧带角。
 * - c 描边：每张图集生成一份“外轮廓”贴图（按帧高换算线宽），贴在身后；我方青、敌方暗红、精锐橙红、首领亮红。
 * 换色 / 轮廓贴图在启动后浏览器空闲时逐张预生成（warmIffTextures），进战斗时基本都已就绪；没来得及的首次出现时现生成。
 * URL 覆盖（测试用）：?iff=0 关闭全部；?iff=a / b / c / 组合（如 ac）强制指定。
 * 性能：同屏 ~200 单位每帧只做 setPosition / setTexture 等属性赋值，不用 Graphics 重画。
 */
export interface IffMode { tint: boolean; marks: boolean; outline: boolean; /** 描边只给敌人（设置「仅敌人」）。 */ enemyOnly?: boolean; /** 粗描边（设置「粗」）。 */ thick?: boolean }
export type IffSide = 'ally' | 'enemy';
export type IffRank = 'normal' | 'elite' | 'boss';
export interface IffUnit { sprite: Phaser.GameObjects.Image; foot: { x: number; y: number }; side: IffSide; rank: IffRank; visible: boolean; /** 保持原画（随行武将）。 */ keepColors?: boolean; /** 黄巾军（第一章）：不论图集名，阵营色一律偏黄。 */ yellow?: boolean }

const OUTLINE_KEY = 'im_iff_outline';
/** 设置「敌我描边」（方案 c），默认关。 */
export function iffOutlineEnabled(): boolean { try { const v = localStorage.getItem(OUTLINE_KEY); return v === '1' || v === 'enemy'; } catch { return false; } }
const iffOutlineEnemyOnly = (): boolean => { try { return localStorage.getItem(OUTLINE_KEY) === 'enemy'; } catch { return false; } };
const iffOutlineThick = (): boolean => { try { return localStorage.getItem('im_iff_outline_w') === 'thick'; } catch { return false; } };
export function setIffOutline(on: boolean): void { try { localStorage.setItem(OUTLINE_KEY, on ? '1' : '0'); } catch { /* ignore */ } }

export function readIffMode(search = typeof location !== 'undefined' ? location.search : ''): IffMode | null {
  const v = new URLSearchParams(search).get('iff')?.toLowerCase();
  if (v === undefined || v === '') return { tint: true, marks: false, outline: iffOutlineEnabled(), enemyOnly: iffOutlineEnemyOnly(), thick: iffOutlineThick() };
  const mode = { tint: v.includes('a'), marks: v.includes('b'), outline: v.includes('c') };
  return mode.tint || mode.marks || mode.outline ? mode : null;
}

const ALLY_HUE = 186;
/** 敌军势力色：按图集名判断（黄巾图集 → 黄；第四章袁军 yuan_ → 土黄；攻城 / 情报势力换色 f_<势力>_ → 该势力色，
 * 灰白势力返回 null 即不再染色；其余 → 赤红）。 */
const enemyHue = (key: string): number | null => {
  const k = key.replace(/^readable_/, '');
  if (k.startsWith('yellow_')) return 48;
  if (k.startsWith('yuan_')) return YUAN_HUE;
  const f = factionTargetOfKey(k);
  if (f === 'gray') return null;
  return f ? f.hue : 355;
};
const OUTLINE = { ally: 0x63e6ff, enemy: 0xb3241c, elite: 0xff5a24, boss: 0xff2a1a } as const;
const failed = new Set<string>();

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max / 255];
}
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 复制一张图集的帧定义到新纹理（行走表都是规则网格，无裁边）。 */
function cloneFrames(tm: Phaser.Textures.TextureManager, from: string, to: string): void {
  const src = tm.get(from), dst = tm.get(to);
  for (const name of src.getFrameNames()) { const f = src.get(name); if (!dst.has(name)) dst.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  const linear = src.source[0]?.scaleMode === Phaser.ScaleModes.LINEAR;
  dst.setFilter(linear ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
}

function sourcePixels(tm: Phaser.Textures.TextureManager, key: string): { w: number; h: number; data: ImageData; canvas: HTMLCanvasElement } | null {
  const img = tm.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = img.width, h = img.height; if (!w || !h) return null;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
  try { return { w, h, data: ctx.getImageData(0, 0, w, h), canvas }; } catch { return null; }
}

/** 生成的贴图登记进战斗图集清单：回主城时随战斗图集一起卸载（CityScene）。 */
function track(game: Phaser.Game, key: string): void { const keys = game.registry.get('battleTextureKeys') as string[] | undefined; if (keys && !keys.includes(key)) keys.push(key); }

/** 黄巾版换色副本另存一份（iffA_enemyY_…）：同一张通用敌兵图在第一章染黄、其他章节染红。 */
export const recolorKey = (key: string, side: IffSide, yellow = false): string => `iffA_${side}${yellow && side === 'enemy' ? 'Y' : ''}_${key}`;
const IFF_PREFIX = /^iffA_(ally|enemyY?)_/;
export const outlineKeyOf = (key: string, thick = false): string => (thick ? 'iffOT_' : 'iffO_') + key.replace(IFF_PREFIX, '');

/** 方案 a：生成换色副本，返回新键（失败返回 null）。 */
export function buildRecolor(game: Phaser.Game, key: string, side: IffSide, yellow = false): string | null {
  const tm = game.textures, target = recolorKey(key, side, yellow);
  if (tm.exists(target)) return target;
  if (failed.has(target) || !tm.exists(key) || key.startsWith('__')) return null;
  const px = sourcePixels(tm, key); if (!px) { failed.add(target); return null; }
  const hue = side === 'ally' ? ALLY_HUE : yellow ? 48 : enemyHue(key);
  if (hue === null) { failed.add(target); return null; } // 灰白势力：保持底图配色
  const d = px.data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 30) continue;
    const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    // 布料：有一定饱和度且不太暗；跳过皮肤（橙色低饱和）与金属（低饱和）
    const skin = h >= 8 && h <= 42 && s < .62 && v > .45;
    if (s < .28 || v < .16 || skin) continue;
    const k = Math.min(1, (s - .28) / .25); // 越鲜艳的布料换得越彻底
    const nh = side === 'ally' ? hue : h + (((hue - h + 540) % 360) - 180) * .55;
    const ns = Math.min(1, s * (side === 'ally' ? 1.05 : 1.15)), nv = side === 'ally' ? Math.min(1, v * 1.04) : v;
    const [r, g, b] = hsv2rgb((nh + 360) % 360, ns, nv);
    d[i] = d[i] + (r - d[i]) * k; d[i + 1] = d[i + 1] + (g - d[i + 1]) * k; d[i + 2] = d[i + 2] + (b - d[i + 2]) * k;
  }
  px.canvas.getContext('2d')!.putImageData(px.data, 0, 0);
  tm.addCanvas(target, px.canvas); cloneFrames(tm, key, target); track(game, target);
  return target;
}

/** 方案 c：生成外轮廓贴图（白色，按阵营着色），返回新键（失败返回 null）。 */
export function buildOutline(game: Phaser.Game, key: string, thick = false): string | null {
  const tm = game.textures, base = key.replace(IFF_PREFIX, ''), target = outlineKeyOf(key, thick);
  if (tm.exists(target)) return target;
  if (failed.has(target) || !tm.exists(base) || base.startsWith('__')) return null;
  const px = sourcePixels(tm, base); if (!px) { failed.add(target); return null; }
  const { w, h } = px, d = px.data.data, src = tm.get(base), frame = src.get(src.getFrameNames()[0] ?? '__BASE');
  // 线宽：约等于显示时 1.5 屏幕像素（96 帧 → 2px，192 帧 → 4px，256 帧 → 5px）
  const r = Math.max(2, Math.round((frame?.cutHeight || 96) / 48)) * (thick ? 2 : 1); // 粗描边线宽加倍
  const solid = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 60 ? 1 : 0;
  // 可分离膨胀（先横后竖），不跨帧格子边界
  const cw = frame?.cutWidth || w, ch = frame?.cutHeight || h, tmp = new Uint8Array(w * h), dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!solid[y * w + x]) continue; const x0 = Math.max(Math.floor(x / cw) * cw, x - r), x1 = Math.min(Math.floor(x / cw) * cw + cw - 1, x + r); for (let xx = x0; xx <= x1; xx++) tmp[y * w + xx] = 1; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!tmp[y * w + x]) continue; const y0 = Math.max(Math.floor(y / ch) * ch, y - r), y1 = Math.min(Math.floor(y / ch) * ch + ch - 1, y + r); for (let yy = y0; yy <= y1; yy++) dil[yy * w + x] = 1; }
  for (let i = 0; i < w * h; i++) { const on = dil[i] && !solid[i]; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = on ? 235 : 0; }
  px.canvas.getContext('2d')!.putImageData(px.data, 0, 0);
  tm.addCanvas(target, px.canvas); cloneFrames(tm, base, target); track(game, target);
  return target;
}

/** 部曲 / 敌军图集（行走、攻击、动作表）；武将行走表与首领专属图不在内。 */
const ALLY_SHEET = /^(readable_)?(shu_\w+_(walk|attack)_sheet|legion_\w+_(walk|action))$/;
const ENEMY_SHEET = /^(readable_)?(enemy_\w+_(walk|attack|run|charge)_sheet|yellow_(swordsman|shield|spear|archer)-(walk|attack)-v\d|yellow_(spear|archer|shield)_(walk|attack)|xiliang_\w+_(walk|attack)|feixiong_(walk|attack)|hubao_(walk|attack))$/;

let warmTimer = 0;
/**
 * 空闲时预生成换色（与开启描边时的轮廓）贴图，每次空闲只做一张，不卡加载与菜单。
 * 主城会卸载战斗图集，回到战斗前 BootScene 重新加载后再调用一次即可（已存在的会跳过）。
 */
export function warmIffTextures(game: Phaser.Game): void {
  const mode = readIffMode(); if (!mode || (!mode.tint && !mode.outline)) return;
  const jobs: (() => void)[] = [];
  for (const key of game.textures.getTextureKeys()) {
    const ally = ALLY_SHEET.test(key), enemy = ENEMY_SHEET.test(key); if (!ally && !enemy) continue;
    // readable_ 派生版与原图只会用到其一：v2 图集用原键，v1 用 readable_ 键，两种都备好成本翻倍，只备实际会显示的那份
    if (!key.startsWith('readable_') && game.textures.exists('readable_' + key)) continue;
    const side: IffSide = ally ? 'ally' : 'enemy';
    if (mode.tint && !game.textures.exists(recolorKey(key, side))) jobs.push(() => { buildRecolor(game, key, side); });
    // 通用敌兵图第一章也用（黄巾版）：顺带备好黄巾换色
    if (mode.tint && enemy && /^(readable_)?enemy_/.test(key) && !game.textures.exists(recolorKey(key, side, true))) jobs.push(() => { buildRecolor(game, key, side, true); });
    if (mode.outline && !game.textures.exists(outlineKeyOf(key))) jobs.push(() => { buildOutline(game, key); });
  }
  if (warmTimer) clearTimeout(warmTimer);
  const idle = (fn: () => void): void => { const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback; if (ric) ric(fn, { timeout: 1500 }); else warmTimer = window.setTimeout(fn, 30); };
  const next = (): void => { const job = jobs.shift(); if (!job) return; try { job(); } catch { /* 单张失败不影响其他 */ } idle(next); };
  idle(next);
}

export class IffOverlay {
  private marks = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
  private outlines = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
  private seen = new Set<Phaser.GameObjects.Image>();
  /** 统计（测试用）。 */
  readonly stats = { units: 0, recolored: 0, marks: 0, outlines: 0, built: 0 };

  constructor(private readonly scene: Phaser.Scene, readonly mode: IffMode, private readonly units: () => Iterable<IffUnit>) {
    if (mode.marks) this.makeMarkTextures();
    const tick = (): void => this.update();
    scene.events.on('postupdate', tick);
    scene.events.once('shutdown', () => { scene.events.off('postupdate', tick); this.destroy(); });
  }

  update(): void {
    this.seen.clear();
    const st = this.stats; st.units = st.recolored = st.marks = st.outlines = 0;
    for (const u of this.units()) {
      const sp = u.sprite; if (!sp.active) continue;
      this.seen.add(sp); st.units++;
      if (this.mode.tint && u.rank !== 'boss' && !u.keepColors && u.visible) { if (this.recolor(sp, u.side, !!u.yellow)) st.recolored++; }
      if (this.mode.marks) {
        const m = this.marks.get(sp) ?? this.newImage(this.marks, sp, 'iff-mark-' + u.side + '-normal');
        const key = 'iff-mark-' + u.side + '-' + u.rank;
        if (m.texture.key !== key) m.setTexture(key);
        m.setVisible(u.visible).setPosition(u.foot.x, u.foot.y + 1).setDepth(DEPTH.enemy - .9);
        if (u.visible) st.marks++;
      }
      if (this.mode.outline) {
        const o = this.outlines.get(sp) ?? this.newImage(this.outlines, sp, '__WHITE');
        const key = u.visible && !(this.mode.enemyOnly && u.side === 'ally') ? this.outline(sp.texture.key) : null;
        if (!key) { o.setVisible(false); continue; }
        if (o.texture.key !== key || o.frame.name !== sp.frame.name) o.setTexture(key, sp.frame.name);
        o.setVisible(true).setPosition(sp.x, sp.y).setScale(sp.scaleX, sp.scaleY).setOrigin(sp.originX, sp.originY).setFlip(sp.flipX, sp.flipY)
          .setRotation(sp.rotation).setDepth(sp.depth - .0004).setTint(u.side === 'ally' ? OUTLINE.ally : u.rank === 'normal' ? OUTLINE.enemy : OUTLINE[u.rank]).setAlpha(sp.alpha * (u.side === 'ally' ? .9 : 1));
        st.outlines++;
      }
    }
    // 描边关掉（战斗内设置即时切换）：已有描边全部隐藏
    if (!this.mode.outline) for (const img of this.outlines.values()) if (img.visible) img.setVisible(false);
    // 单位消失（死亡、回收）：隐藏对应叠加图
    for (const map of [this.marks, this.outlines]) for (const [sp, img] of map) if (!this.seen.has(sp) && img.visible) img.setVisible(false);
  }

  /** 某个单位身后的描边图（开了「敌我描边」时；BossPresence 放大首领 / 精锐时一起放大）。 */
  overlayOf(sp: Phaser.GameObjects.Image): Phaser.GameObjects.Image | undefined { const o = this.outlines.get(sp); return o?.visible ? o : undefined; }

  private newImage(map: Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>, sp: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
    const img = this.scene.add.image(sp.x, sp.y, key).setVisible(false).setName('iff-overlay');
    if (map === this.marks) img.setOrigin(.5, .5).setScale(2);
    map.set(sp, img); return img;
  }

  private recolor(sp: Phaser.GameObjects.Image, side: IffSide, yellow: boolean): boolean {
    const key = sp.texture.key;
    if (key.startsWith('iffA_')) return true;
    const had = this.scene.textures.exists(recolorKey(key, side, yellow)), target = buildRecolor(this.scene.game, key, side, yellow);
    if (!target) return false;
    if (!had) this.stats.built++;
    sp.setTexture(target, sp.frame.name);
    return true;
  }

  private outline(key: string): string | null {
    const thick = !!this.mode.thick, had = this.scene.textures.exists(outlineKeyOf(key, thick)), target = buildOutline(this.scene.game, key, thick);
    if (target && !had) this.stats.built++;
    return target;
  }

  // ---------------- b 脚下徽记（样品） ----------------
  private makeMarkTextures(): void {
    const sc = this.scene;
    const make = (key: string, w: number, h: number, fill: string, light: string, line: string, shape: (x: number, y: number) => 0 | 1 | 2): void => {
      if (sc.textures.exists(key)) return;
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
      const grid: number[][] = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => shape(x, y)));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = grid[y][x];
        if (v) { g.fillStyle = v === 2 ? light : fill; g.fillRect(x, y, 1, 1); continue; }
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx])) { g.globalAlpha = .85; g.fillStyle = line; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; }
      }
      sc.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    // 前方的一段浅弧（像脚下光环的前沿），两端收尖；中央一像素高光
    const arc = (W: number, H: number, rx: number, ry: number, thick: number) => (x: number, y: number): 0 | 1 | 2 => {
      const cx = (W - 1) / 2, cy = 1, dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.hypot(dx, dy);
      const t = Math.abs(x - cx) / rx; if (t > .98) return 0;
      const th = thick * (1 - t * .55) / ry;
      if (d < 1 - th || d > 1 || y < cy) return 0;
      return Math.abs(x - cx) < rx * .35 && d > 1 - th * .5 ? 2 : 1;
    };
    const SIDES = { ally: ['#2fc6e6', '#b8f6ff', '#0b2a33'], enemy: ['#c8322a', '#ff9a7a', '#2a0806'] } as const;
    for (const side of ['ally', 'enemy'] as const) {
      const [f, l, o] = SIDES[side];
      make(`iff-mark-${side}-normal`, 17, 6, f, l, o, arc(17, 6, 7.5, 3.6, 1.6));
      make(`iff-mark-${side}-elite`, 21, 8, f, l, o, (x, y) => arc(21, 8, 9.5, 4.8, 1.5)(x, y) || arc(21, 8, 6.5, 3.1, 1.3)(x, y));
      make(`iff-mark-${side}-boss`, 31, 10, side === 'enemy' ? '#e0402a' : f, '#ffd56a', o, (x, y) => {
        const a = arc(31, 10, 14.5, 6.8, 2.2)(x, y); if (a) return a;
        return (Math.abs(x - 15) === 13 || Math.abs(x - 15) === 12) && y >= 5 && y <= 7 ? 1 : 0;
      });
    }
  }

  destroy(): void {
    for (const map of [this.marks, this.outlines]) { for (const img of map.values()) img.destroy(); map.clear(); }
  }
}
