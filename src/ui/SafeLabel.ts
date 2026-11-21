import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 世界坐标名牌（首领名牌、副将 / 营寨守将名牌、降将、来投、陈宫……）靠屏幕边时往内收，不被 HUD 盖住（统筹 11-21；ch3-6-review 5-2「副将 · 张允」压在舆图卷轴下）。
 * HUD 安全区（设计像素 1280×720）：顶部计时 / 关名 / 舆图卷轴下沿 108；左侧增益图标列 140；右侧圆钮列 W−130；底部首领血条 H−120；
 * 左上武将卡 + 随军粮行（x < 340、y < 230）再往下让。名牌主人在屏幕外较远时不动（名牌跟着出屏）。
 */
/** 安全区按当前布局算（GAME_WIDTH / GAME_HEIGHT 开局后才按电脑 / 手机布局定，不能在模块载入时算死）。 */
export function hudSafe() { return { left: 140, top: 108, right: GAME_WIDTH - 130, bottom: GAME_HEIGHT - 120, panel: { right: 340, bottom: 230 }, reach: 150 }; }

/**
 * 名牌锚点（世界坐标，底边中点）收进安全区：halfW / h 是名牌的半宽、高（世界单位）。返回收好的世界坐标与是否挪过。
 */
export function safeWorldPoint(scene: Phaser.Scene, x: number, y: number, halfW: number, h: number): { x: number; y: number; moved: boolean } {
  const v = scene.cameras.main.worldView; if (!v.width || !v.height) return { x, y, moved: false };
  const kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height, S = hudSafe();
  let sx = (x - v.x) * kx, sy = (y - v.y) * ky; const hw = halfW * kx, hh = h * ky;
  if (sx < -S.reach || sx > GAME_WIDTH + S.reach || sy < -S.reach || sy > GAME_HEIGHT + S.reach) return { x, y, moved: false };
  const sx0 = sx, sy0 = sy;
  sx = Math.max(S.left + hw, Math.min(S.right - hw, sx));
  sy = Math.max(S.top + hh, Math.min(S.bottom, sy));
  if (sx - hw < S.panel.right && sy - hh < S.panel.bottom) sy = S.panel.bottom + hh; // 左上武将卡：往下让
  const moved = Math.abs(sx - sx0) > .5 || Math.abs(sy - sy0) > .5;
  return { x: moved ? sx / kx + v.x : x, y: moved ? sy / ky + v.y : y, moved };
}
