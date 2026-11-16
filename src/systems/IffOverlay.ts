import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * 敌我区分（样品，URL 参数 ?iff=a / b / c，可组合如 ?iff=ab；不加参数时不创建、画面不变）。
 * 独立叠加层：每帧在场景 postupdate（各单位已经摆好姿势之后）读取敌军 / 部曲 / 随行武将的精灵，
 * 不改 Enemy.ts / Ally.ts。
 * - a 阵营色：调色板替换（不重画图）。我方衣甲布料换成统一的青色，敌军按势力（黄巾黄、其余赤红）加深；
 *   每张图集首次出现时生成一份换色副本（一次 getImageData），之后只是换贴图键。首领保持原画。
 * - b 脚下徽记：像素短弧（深色描边），我方青、敌方红；精锐双弧、首领金红宽弧带角。对象池，只改位置。
 * - c 描边：每张图集生成一份“外轮廓”贴图（按帧高换算的像素宽度膨胀），作为一张贴在身后的影子图，
 *   我方青色、敌方暗红、精锐橙红、首领亮红。同步帧、缩放、锚点、翻转、旋转。
 * 性能：同屏 ~200 单位每帧只做 setPosition / setTexture 等属性赋值，不用 Graphics 重画。
 */
export interface IffMode { tint: boolean; marks: boolean; outline: boolean }
export type IffSide = 'ally' | 'enemy';
export type IffRank = 'normal' | 'elite' | 'boss';
export interface IffUnit { sprite: Phaser.GameObjects.Image; foot: { x: number; y: number }; side: IffSide; rank: IffRank; visible: boolean }

export function readIffMode(search = typeof location !== 'undefined' ? location.search : ''): IffMode | null {
  const v = new URLSearchParams(search).get('iff')?.toLowerCase() ?? '';
  const mode = { tint: v.includes('a'), marks: v.includes('b'), outline: v.includes('c') };
  return mode.tint || mode.marks || mode.outline ? mode : null;
}

const ALLY_HUE = 186;
const OUTLINE = { ally: 0x63e6ff, enemy: 0xb3241c, elite: 0xff5a24, boss: 0xff2a1a } as const;

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
function cloneFrames(scene: Phaser.Scene, from: string, to: string): void {
  const src = scene.textures.get(from), dst = scene.textures.get(to);
  for (const name of src.getFrameNames()) { const f = src.get(name); if (!dst.has(name)) dst.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  const linear = src.source[0]?.scaleMode === Phaser.ScaleModes.LINEAR;
  dst.setFilter(linear ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
}

function sourcePixels(scene: Phaser.Scene, key: string): { w: number; h: number; data: ImageData; canvas: HTMLCanvasElement } | null {
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = img.width, h = img.height; if (!w || !h) return null;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
  try { return { w, h, data: ctx.getImageData(0, 0, w, h), canvas }; } catch { return null; }
}

export class IffOverlay {
  private marks = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
  private outlines = new Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();
  private seen = new Set<Phaser.GameObjects.Image>();
  private failed = new Set<string>();
  /** 统计（测试用）。 */
  readonly stats = { units: 0, recolored: 0, marks: 0, outlines: 0, sheets: 0 };

  constructor(private readonly scene: Phaser.Scene, readonly mode: IffMode, private readonly units: () => Iterable<IffUnit>, private readonly enemyHue: number) {
    this.makeMarkTextures();
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
      if (this.mode.tint && u.rank !== 'boss' && u.visible) { if (this.recolor(sp, u.side)) st.recolored++; }
      if (this.mode.marks) {
        const m = this.marks.get(sp) ?? this.newImage(this.marks, sp, 'iff-mark-' + u.side + '-normal');
        const key = 'iff-mark-' + u.side + '-' + u.rank;
        if (m.texture.key !== key) m.setTexture(key);
        m.setVisible(u.visible).setPosition(u.foot.x, u.foot.y + 1).setDepth(DEPTH.enemy - .9);
        if (u.visible) st.marks++;
      }
      if (this.mode.outline) {
        const o = this.outlines.get(sp) ?? this.newImage(this.outlines, sp, '__WHITE');
        const key = u.visible ? this.outlineKey(sp.texture.key) : null;
        if (!key) { o.setVisible(false); continue; }
        if (o.texture.key !== key || o.frame.name !== sp.frame.name) o.setTexture(key, sp.frame.name);
        o.setVisible(true).setPosition(sp.x, sp.y).setScale(sp.scaleX, sp.scaleY).setOrigin(sp.originX, sp.originY).setFlip(sp.flipX, sp.flipY)
          .setRotation(sp.rotation).setDepth(sp.depth - .0004).setTint(u.side === 'ally' ? OUTLINE.ally : u.rank === 'normal' ? OUTLINE.enemy : OUTLINE[u.rank]).setAlpha(sp.alpha * (u.side === 'ally' ? .9 : 1));
        st.outlines++;
      }
    }
    // 单位消失（死亡、回收）：隐藏对应叠加图
    for (const map of [this.marks, this.outlines]) for (const [sp, img] of map) if (!this.seen.has(sp) && img.visible) img.setVisible(false);
  }

  private newImage(map: Map<Phaser.GameObjects.Image, Phaser.GameObjects.Image>, sp: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
    const img = this.scene.add.image(sp.x, sp.y, key).setVisible(false).setName('iff-overlay');
    if (map === this.marks) img.setOrigin(.5, .5).setScale(2);
    map.set(sp, img); return img;
  }

  // ---------------- a 阵营色 ----------------
  private recolor(sp: Phaser.GameObjects.Image, side: IffSide): boolean {
    const key = sp.texture.key;
    if (key.startsWith('iffA_')) return true;
    const target = `iffA_${side}_${key}`;
    if (!this.scene.textures.exists(target) && !this.buildRecolor(key, target, side)) return false;
    sp.setTexture(target, sp.frame.name);
    return true;
  }

  private buildRecolor(key: string, target: string, side: IffSide): boolean {
    if (this.failed.has(target) || key === '__MISSING' || key === '__DEFAULT') return false;
    const px = sourcePixels(this.scene, key); if (!px) { this.failed.add(target); return false; }
    const d = px.data.data, hue = side === 'ally' ? ALLY_HUE : this.enemyHue;
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
    this.scene.textures.addCanvas(target, px.canvas); cloneFrames(this.scene, key, target); this.stats.sheets++;
    return true;
  }

  // ---------------- c 描边 ----------------
  private outlineKey(key: string): string | null {
    const base = key.startsWith('iffA_') ? key.replace(/^iffA_(ally|enemy)_/, '') : key;
    const target = 'iffO_' + base;
    if (this.scene.textures.exists(target)) return target;
    if (this.failed.has(target)) return null;
    const px = sourcePixels(this.scene, base); if (!px) { this.failed.add(target); return null; }
    const { w, h } = px, d = px.data.data, frame = this.scene.textures.get(base).get(this.scene.textures.get(base).getFrameNames()[0] ?? '__BASE');
    // 线宽：约等于显示时 1.5 屏幕像素（96 帧 → 2px，192 帧 → 4px，256 帧 → 5px）
    const r = Math.max(2, Math.round((frame?.cutHeight || 96) / 48));
    const solid = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 60 ? 1 : 0;
    // 可分离膨胀（先横后竖），不跨帧格子边界
    const cw = frame?.cutWidth || w, ch = frame?.cutHeight || h, tmp = new Uint8Array(w * h), dil = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!solid[y * w + x]) continue; const x0 = Math.max(Math.floor(x / cw) * cw, x - r), x1 = Math.min(Math.floor(x / cw) * cw + cw - 1, x + r); for (let xx = x0; xx <= x1; xx++) tmp[y * w + xx] = 1; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!tmp[y * w + x]) continue; const y0 = Math.max(Math.floor(y / ch) * ch, y - r), y1 = Math.min(Math.floor(y / ch) * ch + ch - 1, y + r); for (let yy = y0; yy <= y1; yy++) dil[yy * w + x] = 1; }
    for (let i = 0; i < w * h; i++) { const on = dil[i] && !solid[i]; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = on ? 235 : 0; }
    px.canvas.getContext('2d')!.putImageData(px.data, 0, 0);
    this.scene.textures.addCanvas(target, px.canvas); cloneFrames(this.scene, base, target); this.stats.sheets++;
    return target;
  }

  // ---------------- b 脚下徽记 ----------------
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
    const arc = (W: number, H: number, rx: number, ry: number, thick: number, notch = false) => (x: number, y: number): 0 | 1 | 2 => {
      const cx = (W - 1) / 2, cy = 1, dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.hypot(dx, dy);
      const t = Math.abs(x - cx) / rx; if (t > .98) return 0;
      const th = thick * (1 - t * .55) / ry;
      if (d < 1 - th || d > 1 || y < cy) return 0;
      if (notch && Math.abs(x - cx) < 1) return 0;
      return Math.abs(x - cx) < rx * .35 && d > 1 - th * .5 ? 2 : 1;
    };
    const SIDES = { ally: ['#2fc6e6', '#b8f6ff', '#0b2a33'], enemy: ['#c8322a', '#ff9a7a', '#2a0806'] } as const;
    for (const side of ['ally', 'enemy'] as const) {
      const [f, l, o] = SIDES[side];
      make(`iff-mark-${side}-normal`, 17, 6, f, l, o, arc(17, 6, 7.5, 3.6, 1.6));
      make(`iff-mark-${side}-elite`, 21, 8, f, l, o, (x, y) => arc(21, 8, 9.5, 4.8, 1.5)(x, y) || arc(21, 8, 6.5, 3.1, 1.3)(x, y));
      make(`iff-mark-${side}-boss`, 31, 10, side === 'enemy' ? '#e0402a' : f, '#ffd56a', o, (x, y) => {
        const a = arc(31, 10, 14.5, 6.8, 2.2)(x, y); if (a) return a;
        // 两侧小角
        return (Math.abs(x - 15) === 13 || Math.abs(x - 15) === 12) && y >= 5 && y <= 7 ? 1 : 0;
      });
    }
  }

  destroy(): void {
    for (const map of [this.marks, this.outlines]) { for (const img of map.values()) img.destroy(); map.clear(); }
  }
}
