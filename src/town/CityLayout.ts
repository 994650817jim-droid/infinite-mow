/**
 * 主城全景（英雄无敌式城镇画面）：每个城池规模一张全景底图（1536×1024），建筑贴图按固定位置摆在底图上。
 * 坐标是底图像素（建筑底边中心）；w = 建筑贴图在底图上的显示宽度（满级），低等级略小。
 * 美术：public/assets/city/bg_<规模>.webp、<建筑>_<等级>.webp（tools/prepare-city-art.mjs 切图）。缺图时退回旧小镇像素画 / 程序画。
 */
import type { TownBuildingId } from './TownData';

export const PANO_W = 1536, PANO_H = 1024;
export interface Slot { x: number; y: number; w: number }
type Layout = Record<TownBuildingId, Slot>;

/** 默认布局（三种规模共用，按各自底图微调见 CITY_SLOTS）。从后往前：府衙居中靠后，两侧街坊，前排军营 / 城门。 */
// 底图：远处城墙约在 y≈280，城门在正中；主路自城门向左下弯到画面底部（x≈650–900），y≈420 向左、y≈520 向右分岔；左下角是农田小溪。
const BASE: Layout = {
  tavern: { x: 300, y: 415, w: 220 },
  smithy: { x: 600, y: 412, w: 200 },
  market: { x: 1180, y: 475, w: 280 },
  post: { x: 1430, y: 470, w: 180 },
  clinic: { x: 470, y: 610, w: 200 },
  granary: { x: 1430, y: 660, w: 200 },
  house: { x: 270, y: 680, w: 250 },
  hall: { x: 950, y: 720, w: 390 },
  farm: { x: 170, y: 930, w: 290 },
  drill: { x: 1340, y: 950, w: 310 },
  barracks: { x: 1090, y: 1010, w: 290 },
  wall: { x: 760, y: 1024, w: 310 },
  pavilion: { x: 1150, y: 860, w: 260 },
};
// 大城底图：正中笔直的青石御道（x≈640–1000）直通城门，y≈460–510 一条横街，分出四片方地；府衙坐落在城门内御道上。
const LARGE: Layout = {
  tavern: { x: 170, y: 445, w: 200 },
  smithy: { x: 410, y: 445, w: 190 },
  hall: { x: 768, y: 475, w: 400 },
  market: { x: 1130, y: 445, w: 260 },
  post: { x: 1390, y: 445, w: 180 },
  house: { x: 200, y: 700, w: 240 },
  clinic: { x: 430, y: 700, w: 190 },
  granary: { x: 1420, y: 700, w: 180 },
  drill: { x: 1180, y: 760, w: 300 },
  farm: { x: 180, y: 960, w: 280 },
  barracks: { x: 1240, y: 1010, w: 280 },
  wall: { x: 768, y: 1024, w: 310 },
  pavilion: { x: 768, y: 712, w: 280 },
};
export const CITY_SLOTS: Record<1 | 2 | 3, Layout> = { 1: BASE, 2: BASE, 3: LARGE };
/** 等级对应的显示比例（Lv1 小、Lv3 满）。 */
export const LEVEL_SCALE = [0, .86, .96, 1.06];

/** 已导入的主城全景美术（城池规模 → 是否有底图；建筑等级列表）。 */
export const CITY_BG_SIZES: number[] = [1, 2, 3];
export const CITY_ART_LEVELS: number[] = [1, 2, 3];
