import type Phaser from 'phaser';
import type { TroopKind } from '../data/legion';
import { artStyle } from './ArtStyle';

/**
 * 兵种胸像立绘（public/assets/troop-portraits/，由 tools/prepare-troop-portraits.mjs 生成 manifest.json）。
 * 只加载清单里列出的图：素材未到位时清单为空，不会产生 404；缺图的兵种继续用行走帧半身裁切过渡。
 */
// 人物画风 v2：用 troop-portraits-v2/ 的写实厚涂像素胸像（8 个兵种齐全）；v1 用原目录（3 张 Q 版）
const V2 = artStyle() === 'v2';
const MANIFEST = V2 ? 'troop_portraits_manifest_v2' : 'troop_portraits_manifest', BASE = V2 ? 'assets/troop-portraits-v2/' : 'assets/troop-portraits/';
const headY = new Map<TroopKind, number>();
export const portraitKey = (kind: TroopKind): string => 'troop_portrait_' + kind;
/** 头部中心在立绘中的高度比例（清单提供；缺省 0.36）。 */
export const portraitHeadY = (kind: TroopKind): number => headY.get(kind) ?? .36;

interface Manifest { portraits?: Array<{ kind: TroopKind; file: string; headY?: number }> }

/** 正在某个场景加载器里排队 / 下载的立绘键（纹理是全局的：场景重启或多场景同时请求时不重复加载，否则 Phaser 报 key already in use）。 */
const inFlight = new Set<string>();

/** 后台加载立绘；有新图加载完成时回调 onReady（用于重绘卡片）。 */
export function loadTroopPortraits(scene: Phaser.Scene, onReady: () => void): void {
  const mine: string[] = [];
  const release = (key: string) => { inFlight.delete(key); };
  const queue = (): boolean => {
    const m = scene.cache.json.get(MANIFEST) as Manifest | undefined;
    let added = false;
    for (const p of m?.portraits ?? []) {
      if (typeof p.headY === 'number') headY.set(p.kind, p.headY);
      const key = portraitKey(p.kind);
      if (scene.textures.exists(key) || inFlight.has(key)) continue;
      inFlight.add(key); mine.push(key);
      scene.load.once('filecomplete-image-' + key, () => release(key));
      scene.load.image(key, BASE + p.file); added = true;
    }
    return added;
  };
  // 加载失败或场景中途关闭（加载器被重置）时放开占位，下次可重新请求
  scene.load.on('loaderror', (file: Phaser.Loader.File) => release(file.key));
  scene.events.once('shutdown', () => { for (const key of mine) if (!scene.textures.exists(key)) release(key); });
  if (scene.cache.json.exists(MANIFEST)) {
    if (!queue()) return;
  } else {
    scene.load.json(MANIFEST, BASE + 'manifest.json');
    scene.load.once('filecomplete-json-' + MANIFEST, () => { queue(); });
  }
  scene.load.once('complete', () => { if (scene.sys.isActive()) onReady(); });
  if (!scene.load.isLoading()) scene.load.start();
}
