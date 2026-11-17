import Phaser from 'phaser';

/**
 * 首领重设计样板的手绘特效（2026-11-16 用户规定：特效一律用手绘 / 厚涂透明序列帧，不再程序绘制像素风）。
 * 图集：public/assets/boss-fx/<key>.png，一行 6 帧、每帧 256×256（tools/prepare-warn-fx.mjs 从洋红底原图切出），原图在 originals/。
 * 按需加载；图还没到 / 没加载完时 has() 返回 false，调用方退回原来的占位画法。
 */
export const BOSS_FX = ['zj_pillar', 'zj_talisman', 'lb_whirl', 'ys_coin', 'cr_bagua', 'kit_shift', 'lb_arrow', 'ys_flag', 'kit_recover'] as const;
export type BossFxKey = typeof BOSS_FX[number];
const texKey = (k: BossFxKey): string => 'bossfx_' + k;
/** 已有图的键（图到一张登记一张，避免请求不存在的文件）。 */
export const BOSS_FX_READY: readonly BossFxKey[] = ['zj_pillar', 'zj_talisman', 'lb_whirl', 'ys_coin', 'cr_bagua', 'kit_shift'];

/** 确保这些特效图在加载（已加载 / 没有图的跳过）。 */
export function ensureBossFx(scene: Phaser.Scene, keys: readonly BossFxKey[]): void {
  const missing = keys.filter(k => BOSS_FX_READY.includes(k) && !scene.textures.exists(texKey(k)));
  if (!missing.length) return;
  for (const k of missing) scene.load.spritesheet(texKey(k), `assets/boss-fx/${k}.png`, { frameWidth: 256, frameHeight: 256 });
  if (!scene.load.isLoading()) scene.load.start();
}
export function hasBossFx(scene: Phaser.Scene, k: BossFxKey): boolean { return scene.textures.exists(texKey(k)); }

/** 一个跟随的特效贴图（循环或按进度换帧），没图时为 null。 */
export function bossFxImage(scene: Phaser.Scene, k: BossFxKey, depth: number): Phaser.GameObjects.Image | null {
  return hasBossFx(scene, k) ? scene.add.image(0, 0, texKey(k), 0).setDepth(depth) : null;
}
/** 一次性播放 frames 区间（含首尾），播完淡出销毁。返回是否播了。 */
export function playBossFx(scene: Phaser.Scene, k: BossFxKey, x: number, y: number, size: number, depth: number, from = 0, to = 5, ms = 420, tint?: number): boolean {
  if (!hasBossFx(scene, k)) return false;
  const img = scene.add.image(x, y, texKey(k), from).setDepth(depth).setDisplaySize(size, size);
  if (tint !== undefined) img.setTint(tint);
  scene.tweens.addCounter({ from, to: to + .99, duration: ms, onUpdate: t => img.setFrame(Math.min(to, Math.floor(t.getValue() ?? from))),
    onComplete: () => scene.tweens.add({ targets: img, alpha: 0, duration: 160, onComplete: () => img.destroy() }) });
  return true;
}
/** 帧号：按进度 0~1 落在 [from, to]。 */
export const fxFrame = (p: number, from: number, to: number): number => Math.min(to, from + Math.floor(Math.max(0, Math.min(1, p)) * (to - from + 1)));
