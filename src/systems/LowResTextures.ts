import Phaser from 'phaser';
import { LOW_MEM } from '../config';

/**
 * 手机省内存（2026-11-17：iPhone 打开网页版页面崩溃，iOS WebKit 单页内存上限紧）。
 *
 * 只在手机 / 低内存设备上启用（电脑不变，?lores=1 强制开、?lores=0 强制关）：
 *  1. 大图（≥ 512×512 像素）解码后缩成一半再交给显卡，显存与内存约为原来的 1/4。
 *     缩小后的图对外仍报原尺寸（width / height），所以切帧、UV、显示大小、各处按 getSourceImage().width 推算格子的代码都不用改；
 *     代码里把源图画进 canvas 再加工（换色、描边、可读化等）时，drawImage 自动按原尺寸绘制。
 *  2. 代码生成的大 canvas 贴图（addCanvas）同样缩一半；所有 canvas 贴图丢掉 Phaser 额外保存的整张 ImageData 副本（项目里没有用到）。
 *  3. 缩小后的图再异步转成 ImageBitmap、释放 canvas 像素，避开 iOS 的 canvas 总内存上限。
 * 首页 / 界面 / 立绘 / 图标等需要清晰的贴图不缩。
 */
export const LOW_RES = LOW_MEM;

const MIN_AREA = 512 * 512;
/** 不缩：首页 / 剧情插画、水墨卷轴、按钮、图标、立绘、界面底板、小镇与地图界面美术。 */
const KEEP = /^(epic_|ink_|title_|story_|btn_ink_|ui_|growth_icon_|build_icon_|icon_|item_|ach_|art_panel|town_|portrait_|world_|strategy_|hero_card|warcard)|_portrait$/;

type Shrunk = HTMLCanvasElement | ImageBitmap;
/** 缩小图 → 原尺寸。 */
const LOGICAL = new WeakMap<object, { w: number; h: number }>();
const canvasWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
const canvasHeight = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height')!;

/** 让缩小图对外报原尺寸（只遮住 JS 读到的 width / height，显卡上传与 drawImage 用的仍是真实像素）。 */
function fake(o: Shrunk, w: number, h: number): void {
  LOGICAL.set(o, { w, h });
  Object.defineProperty(o, 'width', { configurable: true, get: () => w });
  Object.defineProperty(o, 'height', { configurable: true, get: () => h });
  (o as unknown as { __loReal?: [number, number] }).__loReal = [real(o, 'w'), real(o, 'h')];
}
function real(o: Shrunk, d: 'w' | 'h'): number {
  if (o instanceof HTMLCanvasElement) return (d === 'w' ? canvasWidth : canvasHeight).get!.call(o) as number;
  const desc = Object.getOwnPropertyDescriptor(ImageBitmap.prototype, d === 'w' ? 'width' : 'height')!;
  return desc.get!.call(o) as number;
}
function shrink(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'), rw = Math.max(1, Math.ceil(w / 2)), rh = Math.max(1, Math.ceil(h / 2));
  c.width = rw; c.height = rh;
  // CPU 画布（willReadFrequently）：缩图与随后转成的位图都留在内存里，不占显卡进程（GPU 画布 + GPU 位图在每次重载时都会在显存里多一份）
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, rw, rh);
  fake(c, w, h);
  return c;
}
/** 缩小后的 canvas 转成 ImageBitmap，释放 canvas 像素（贴图源换成位图，显卡上的纹理不变）。 */
function toBitmap(texture: Phaser.Textures.Texture, c: HTMLCanvasElement): void {
  if (typeof createImageBitmap !== 'function') return;
  const { w, h } = LOGICAL.get(c)!;
  createImageBitmap(c).then(bmp => {
    const s = texture.source[0];
    if (!s || s.image !== c) { bmp.close(); return; } // 贴图已被移除或替换
    fake(bmp, w, h);
    (s as unknown as { image: unknown }).image = bmp;
    // 显卡纹理包装也记着源（WebGL 上下文丢失后重建时用它重新上传）
    const gt = (s as unknown as { glTexture?: { pixels?: unknown } }).glTexture; if (gt && gt.pixels === c) gt.pixels = bmp;
    canvasWidth.set!.call(c, 0); canvasHeight.set!.call(c, 0);
  }).catch(() => { /* 保留 canvas */ });
}
function dropImageData(t: Phaser.Textures.CanvasTexture): void {
  const o = t as unknown as Record<string, unknown>;
  o.imageData = null; o.data = null; o.pixels = null; o.buffer = null;
}

/** 放掉 <img> 的解码缓存：去掉 src（贴图已经是缩小后的 canvas / 位图，不再读它）。 */
function releaseImage(img: HTMLImageElement): void {
  try { img.onload = null; img.onerror = null; img.removeAttribute('src'); img.src = ''; } catch { /* 忽略 */ }
}

/** 在创建 Phaser.Game 之前调用。 */
export function installLowResTextures(): void {
  if (!LOW_RES) return;
  // drawImage：源是缩小图时按原尺寸坐标绘制
  const draw = CanvasRenderingContext2D.prototype.drawImage as (...a: unknown[]) => void;
  CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
    const L = a[0] && typeof a[0] === 'object' ? LOGICAL.get(a[0] as object) : undefined;
    if (!L) return draw.apply(this, a);
    const img = a[0] as Shrunk, kx = real(img, 'w') / L.w, ky = real(img, 'h') / L.h;
    if (a.length === 3) return draw.call(this, img, a[1], a[2], L.w, L.h);
    if (a.length === 9) return draw.call(this, img, (a[1] as number) * kx, (a[2] as number) * ky, (a[3] as number) * kx, (a[4] as number) * ky, a[5], a[6], a[7], a[8]);
    return draw.apply(this, a);
  } as typeof CanvasRenderingContext2D.prototype.drawImage;

  const TM = Phaser.Textures.TextureManager.prototype as unknown as {
    create(key: string, source: unknown, width?: number, height?: number): Phaser.Textures.Texture | null;
    addCanvas(key: string, source: HTMLCanvasElement, skipCache?: boolean): Phaser.Textures.CanvasTexture | null;
  };
  const create = TM.create;
  TM.create = function (this: Phaser.Textures.TextureManager, key, source, width, height) {
    if (!width && source instanceof HTMLImageElement && !KEEP.test(key)) {
      const w = source.naturalWidth, h = source.naturalHeight;
      if (w * h >= MIN_AREA) {
        const c = shrink(source, w, h), t = create.call(this, key, c, w, h);
        if (t) toBitmap(t, c);
        releaseImage(source); // 原尺寸的 <img> 仍被 Phaser 的加载文件对象引用到整批加载结束：浏览器会一直留着它解码后的整张位图（实测占大头），缩好后立刻放掉
        return t;
      }
    }
    return create.call(this, key, source, width, height);
  };
  const addCanvas = TM.addCanvas;
  TM.addCanvas = function (this: Phaser.Textures.TextureManager, key, source, skipCache) {
    let c = source, mine = false;
    if (source && !LOGICAL.has(source) && !KEEP.test(key) && source.width * source.height >= MIN_AREA) { c = shrink(source, source.width, source.height); mine = true; }
    const t = addCanvas.call(this, key, c, skipCache);
    if (t) { dropImageData(t); if (mine) toBitmap(t, c); }
    return t;
  };
}

/** 测试 / 测量用：贴图实际像素（缩小过的按真实尺寸）。 */
export function realTextureSize(t: Phaser.Textures.Texture): { w: number; h: number } {
  const img = t.source[0]?.image as unknown as { __loReal?: [number, number] } | undefined;
  return img?.__loReal ? { w: img.__loReal[0], h: img.__loReal[1] } : { w: t.source[0]?.width ?? 0, h: t.source[0]?.height ?? 0 };
}
