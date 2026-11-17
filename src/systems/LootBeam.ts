import Phaser from 'phaser';
import type { ItemQuality } from '../data/items';

/**
 * 装备掉落品质光柱（手绘序列帧，用户 2026-11-17 要求替换程序画的光柱）。
 * 图集 assets/fx-v2/loot_beam.png：4 列 × 4 行，每格 128×256，黑底、淡金白光，用叠加混合（黑色透明）后按品质染色。
 * 第 0~7 帧：光柱循环；第 8~15 帧：同一循环加飘升光点（紫、橙用）。光圈中心在格子 84% 高度。
 * 图还没载入（或载入失败）时返回 null，调用方继续用旧的程序光柱。
 */
const KEY = 'loot_beam_v2', URL = 'assets/fx-v2/loot_beam.png';
const W = 128, H = 256, FOOT = .84;
/** 各品质光柱显示高度（逻辑像素；v2 武将约 88 高）与透明度。 */
const SIZE: Record<ItemQuality, { h: number; a: number }> = {
  white: { h: 100, a: .7 }, green: { h: 120, a: .9 }, blue: { h: 136, a: 1 }, purple: { h: 156, a: 1 }, orange: { h: 176, a: 1 },
};
let failed = false;

/** 预载光柱图集并建好两段循环动画（重复调用无副作用）。 */
export function ensureLootBeam(scene: Phaser.Scene): void {
  const anims = (): void => {
    if (!scene.textures.exists(KEY)) return;
    if (!scene.anims.exists('loot_beam_loop')) scene.anims.create({ key: 'loot_beam_loop', frames: scene.anims.generateFrameNumbers(KEY, { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    if (!scene.anims.exists('loot_beam_sparkle')) scene.anims.create({ key: 'loot_beam_sparkle', frames: scene.anims.generateFrameNumbers(KEY, { start: 8, end: 15 }), frameRate: 10, repeat: -1 });
  };
  if (scene.textures.exists(KEY)) { anims(); return; }
  if (failed) return;
  scene.load.spritesheet(KEY, URL, { frameWidth: W, frameHeight: H });
  scene.load.once('filecomplete-spritesheet-' + KEY, anims);
  scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => { if (f.key === KEY) failed = true; });
  if (!scene.load.isLoading()) scene.load.start();
}

/** 新光柱（放在道具容器里、原点 0,0 即落点）；图未就绪返回 null。 */
export function lootBeam(scene: Phaser.Scene, quality: ItemQuality, color: number): Phaser.GameObjects.Sprite | null {
  if (!scene.textures.exists(KEY) || !scene.anims.exists('loot_beam_loop')) return null;
  const s = SIZE[quality] ?? SIZE.white, sparkle = quality === 'purple' || quality === 'orange';
  const beam = scene.add.sprite(0, 4, KEY, sparkle ? 8 : 0).setOrigin(.5, FOOT).setScale(s.h / H).setAlpha(s.a)
    .setTint(color).setBlendMode(Phaser.BlendModes.ADD).setName('item-drop-beam');
  // 各个掉落物错开起始帧，不要一起闪
  beam.play({ key: sparkle ? 'loot_beam_sparkle' : 'loot_beam_loop', startFrame: Math.floor(Math.random() * 8) });
  return beam;
}
