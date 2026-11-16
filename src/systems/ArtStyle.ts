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

/** v2 图集：纹理键 → 文件（行走 4×4、动作 4×7，原生格 72 / 96，最近邻放大 4 倍入库）。 */
export const ART_V2_FILES: Readonly<Record<string, string>> = {
  hero_walk_sheet: 'assets/processed-v2/zhaoyun_walk_sheet.png',
  zhaoyun_actions: 'assets/hero-actions-v2/zhaoyun.png',
};
/** v2 行走格原生边长（美术像素）；主将按「1 美术像素 = 1 逻辑像素」显示。 */
export const V2_WALK_CELL = 72;

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
