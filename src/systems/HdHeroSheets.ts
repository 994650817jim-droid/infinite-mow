import Phaser from 'phaser';
import { isV2Texture } from './ArtStyle';

/**
 * 高清武将图集：行走表固定 4×4 帧、动作表固定 4×7 帧，帧边长按图片实际宽度 / 4 推算。
 * 标清图（行走 384 宽 = 96 帧、动作 512 宽 = 128 帧）保持原样与最近邻采样；
 * 换上更大的高清图（如行走 768 / 动作 1024）时，重新切帧并改用线性采样，缩小显示时更细腻、不出锯齿。
 * 显示大小不受影响：主将按帧高换算缩放、按实测人物高度统一比例（Player.applyTextureScale / actionFitFor）。
 * 须在 registerWalkSheet 与 createReadableTextures 之后调用（两者都会按 96 / 128 切帧、设最近邻）。
 */
const WALK_BASE = 384, ACTION_BASE = 512, DIRS = ['down', 'left', 'right', 'up'];

function regrid(texture: Phaser.Textures.Texture, cell: number, names: string[]): void {
  for (const name of names) if (texture.has(name)) texture.remove(name);
  names.forEach((name, i) => texture.add(name, 0, (i % 4) * cell, Math.floor(i / 4) * cell, cell, cell));
}

/** 返回已按高清处理的纹理键（测试用）。 */
export function applyHdHeroSheets(scene: Phaser.Scene, walkKeys: string[], actionKeys: string[]): string[] {
  const done: string[] = [];
  const each = (key: string, base: number, names: string[]): void => {
    for (const k of [key, 'readable_' + key]) {
      if (!scene.textures.exists(k)) continue;
      const t = scene.textures.get(k), w = (t.getSourceImage() as { width?: number }).width ?? 0;
      if (w <= base) continue;
      regrid(t, w / 4, names);
      // v2 像素画风保持最近邻，像素格清晰；v1 高清绘画缩小显示用线性。
      t.setFilter(isV2Texture(k) ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR);
      done.push(k);
    }
  };
  const walkNames = DIRS.flatMap(d => [0, 1, 2, 3].map(i => `${d}_${i}`));
  const actionNames = Array.from({ length: 28 }, (_, i) => String(i));
  for (const key of walkKeys) each(key, WALK_BASE, walkNames);
  for (const key of actionKeys) each(key, ACTION_BASE, actionNames);
  return done;
}

/** 按帧高换算的缩放：让高清帧与标清 96 帧在同一 setScale 下显示一样大。 */
export function frameScale(scene: Phaser.Scene, key: string, frame: string, base = 96): number {
  const h = scene.textures.exists(key) ? scene.textures.getFrame(key, frame)?.height : 0;
  return h ? base / h : 1;
}
