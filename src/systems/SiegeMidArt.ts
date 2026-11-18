import Phaser from 'phaser';
import { MID_SIEGE_ART } from './SiegeMidCity';

/**
 * 中城攻城 v2 图（tools/prepare-props.mjs 处理，原图在 public/assets/siege-v2/originals/）。
 * 只登记已到的图；没登记的由 SiegeMidCity 用现有素材过渡。4×2 图集，格边长见 cell。
 */
export const MID_SIEGE_FILES: ReadonlyArray<{ key: string; file: string; cell: number }> = [
  { key: 'siege_mid_walls', file: 'assets/siege-v2/walls.png', cell: 384 }, // 城墙段 / 城门 / 城门破 / 箭楼 / 箭楼毁 / 墩台 / 残墙 / 辕门
  { key: 'siege_mid_gatefx', file: 'assets/siege-v2/gatefx.png', cell: 384 }, // 城门倒塌 8 帧（手绘序列帧）
  { key: 'siege_mid_ram', file: 'assets/siege-v2/ram.png', cell: 256 }, // 冲车撞门 4 帧 / 打坏 / 残骸 / 我方大旗 / 我方营帐
  { key: 'siege_mid_street', file: 'assets/siege-v2/street.png', cell: 384 }, // 民房 ×2 / 店铺 / 粮仓 / 兵营 / 路障 / 屋脊 / 水井
  { key: 'siege_mid_hall', file: 'assets/siege-v2/hall.png', cell: 384 }, // 府衙大堂 / 台阶 / 回廊 / 石狮 / 内城门 / 帅旗 / 香炉 / 照壁
];

export function loadMidSiegeArt(scene: Phaser.Scene): void {
  for (const f of MID_SIEGE_FILES) if (!scene.textures.exists(f.key)) scene.load.spritesheet(f.key, f.file, { frameWidth: f.cell, frameHeight: f.cell });
  // 大城护城河 / 吊桥借地形层的 v2 水面与木桥（同一套手绘图）
  for (const [k, f] of [['terrain_water', 'assets/terrain/water.png'], ['terrain_bridge', 'assets/terrain/bridge.png']] as const) if (!scene.textures.exists(k)) scene.load.image(k, f);
  void MID_SIEGE_ART;
}
