import Phaser from 'phaser';
import { loadSideWallArt } from './SideWall';
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
  { key: 'siege_mid_barb', file: 'assets/siege-v2/barbican.png', cell: 384 }, // 瓮城套件（场景审查 P3，美术会话出图）：0 内门关 1 内门破 2 城墙段 3 角楼 4 侧墙段 5 滚木堆 6 礌石堆 7 残垣
  { key: 'siege_mid_city', file: 'assets/siege-v2/city.png', cell: 384 }, // 城内图集（攻城城内段，美术会话出图）：0 市集摊棚 1 市集货担 2 武库库房 3 武库兵器院 4 马道斜坡 5 城内角楼 6 我方占领旗（纯色旗面，代码染色）7 拒马路障组
  { key: 'siege_mid_ladder', file: 'assets/siege-v2/ladder.png', cell: 256 }, // 云梯车（Bing 出图，2×2）：0 完好 1 搭靠 2 受损 3 烧毁残骸；原图 originals/bing_ladder_raw2.jpg
  { key: 'siege_capture', file: 'assets/siege-v2/capture.png', cell: 256 }, // 攻城要点占领圈（即梦出图）：0 石板环 1 水墨笔圈 2 漆金徽章 3 令箭箭镞（见 SiegeCityPoints）
];

export function loadMidSiegeArt(scene: Phaser.Scene): void {
  for (const f of MID_SIEGE_FILES) if (!scene.textures.exists(f.key)) scene.load.spritesheet(f.key, f.file, { frameWidth: f.cell, frameHeight: f.cell });
  // 大城护城河 / 吊桥借地形层的 v2 水面与木桥（同一套手绘图）
  for (const [k, f] of [['terrain_water', 'assets/terrain/water.png'], ['terrain_bridge', 'assets/terrain/bridge.png']] as const) if (!scene.textures.exists(k)) scene.load.image(k, f);
  loadSideWallArt(scene);
  void MID_SIEGE_ART;
}
