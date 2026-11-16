import Phaser from 'phaser';

/**
 * 人物画风开关（共享笔记 art-style-v2-spec.md）。
 * v1：现有 Q 版高清绘画图集；v2：「营火写实像素」——写实比例、真像素、深色描边、厚涂。
 * 选择顺序：URL ?art=v1|v2 → localStorage im_art_style → 默认（试作阶段为 v1）。
 * v2 只替换 ART_V2_FILES 里列出的图集，其余单位自动沿用 v1。
 */
export type ArtStyle = 'v1' | 'v2';
export const DEFAULT_ART_STYLE: ArtStyle = 'v1';
const STORE_KEY = 'im_art_style';

/** v2 图集：纹理键 → 文件（行走 4×4、动作 4×7，原生格 176 / 232，人物约 152 美术像素高，160 色）。 */
export const ART_V2_FILES: Readonly<Record<string, string>> = {
  hero_walk_sheet: 'assets/processed-v2/zhaoyun_walk_sheet.png',
  zhaoyun_actions: 'assets/hero-actions-v2/zhaoyun.png',
};
/** v2 主将行走整格的显示高度（逻辑像素）：原生格 176 → 88，即 1080p 全屏（渲染 2 倍）下 1 美术像素 = 1 屏幕像素。
 * 人物约 76 逻辑像素高（用户要求比 v1 大一些）。 */
export const V2_WALK_DISPLAY = 88;
/** v2 行走格的脚底行（描边所在最低行，原生像素）与格高。 */
export const V2_WALK_FOOT = 168, V2_WALK_CELL = 176;
/** 行走帧纵向锚点：让脚底落在精灵中心下方 31 逻辑像素，与 v1 一致（阴影、选中光圈、碰撞位置都不用动）。 */
export const V2_WALK_ORIGIN_Y = (V2_WALK_FOOT + 1) / V2_WALK_CELL - 31 / V2_WALK_DISPLAY;
/** 「主将」标记离精灵中心的高度：v2 人物更高，标记跟着上移。 */
export const V2_MARKER_LIFT = 52;
/** v2 图集的采样：渲染倍率 ≥2 时像素 1:1 对屏幕，用最近邻保持清晰；低于 2 倍要缩小显示，用线性避免丢像素。 */
export function v2Filter(renderScale: number): Phaser.Textures.FilterMode {
  return renderScale >= 2 ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR;
}

let cached: ArtStyle | undefined;
export function artStyle(): ArtStyle {
  if (cached) return cached;
  let v: string | null = null;
  try { v = new URLSearchParams(window.location.search).get('art'); } catch { /* ignore */ }
  if (v === 'v1' || v === 'v2') { try { localStorage.setItem(STORE_KEY, v); } catch { /* ignore */ } }
  else try { v = localStorage.getItem(STORE_KEY); } catch { v = null; }
  cached = v === 'v1' || v === 'v2' ? v : DEFAULT_ART_STYLE;
  return cached;
}
/** 设置界面切换用；重新进入战斗（BootScene 重新加载图集）后生效。 */
export function setArtStyle(style: ArtStyle): void {
  cached = style;
  try { localStorage.setItem(STORE_KEY, style); } catch { /* ignore */ }
}

/** 该纹理（或其 readable_ 派生）当前是否使用 v2 图集。 */
export function isV2Texture(key: string): boolean {
  return artStyle() === 'v2' && Object.prototype.hasOwnProperty.call(ART_V2_FILES, key.replace(/^readable_/, ''));
}

/** 把加载队列里有 v2 版本的图集换成 v2 文件（在 preload 末尾调用；键名不变，其余代码无感）。 */
export function applyArtStyleUrls(load: Phaser.Loader.LoaderPlugin): string[] {
  if (artStyle() !== 'v2') return [];
  const swapped: string[] = [];
  const files = (load as unknown as { list: Phaser.Structs.Set<Phaser.Loader.File> }).list;
  for (const file of files.getArray()) {
    const url = ART_V2_FILES[file.key];
    if (url && file.type === 'spritesheet') { file.url = url; swapped.push(file.key); }
  }
  return swapped;
}
