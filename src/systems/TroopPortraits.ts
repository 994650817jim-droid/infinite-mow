import type Phaser from 'phaser';
import type { TroopKind } from '../data/legion';

/**
 * 兵种胸像立绘（public/assets/troop-portraits/，由 tools/prepare-troop-portraits.mjs 生成 manifest.json）。
 * 只加载清单里列出的图：素材未到位时清单为空，不会产生 404；缺图的兵种继续用行走帧半身裁切过渡。
 */
const MANIFEST = 'troop_portraits_manifest', BASE = 'assets/troop-portraits/';
const headY = new Map<TroopKind, number>();
export const portraitKey = (kind: TroopKind): string => 'troop_portrait_' + kind;
/** 头部中心在立绘中的高度比例（清单提供；缺省 0.36）。 */
export const portraitHeadY = (kind: TroopKind): number => headY.get(kind) ?? .36;

interface Manifest { portraits?: Array<{ kind: TroopKind; file: string; headY?: number }> }

/** 后台加载立绘；有新图加载完成时回调 onReady（用于重绘卡片）。 */
export function loadTroopPortraits(scene: Phaser.Scene, onReady: () => void): void {
  const queue = (): boolean => {
    const m = scene.cache.json.get(MANIFEST) as Manifest | undefined;
    let added = false;
    for (const p of m?.portraits ?? []) {
      if (typeof p.headY === 'number') headY.set(p.kind, p.headY);
      if (!scene.textures.exists(portraitKey(p.kind))) { scene.load.image(portraitKey(p.kind), BASE + p.file); added = true; }
    }
    return added;
  };
  if (scene.cache.json.exists(MANIFEST)) {
    if (!queue()) return;
  } else {
    scene.load.json(MANIFEST, BASE + 'manifest.json');
    scene.load.once('filecomplete-json-' + MANIFEST, () => { queue(); });
  }
  scene.load.once('complete', () => { if (scene.sys.isActive()) onReady(); });
  if (!scene.load.isLoading()) scene.load.start();
}
