import type Phaser from 'phaser';
import { actorDepth } from '../config';

export type Box = { left: number; right: number; top: number; bottom: number };

/**
 * 大件布景的碰撞形状与深度排序线（统筹 11-21，用户「这个祭坛我直接穿模进去了」）。
 * 形状按底座画（石台 / 台阶 / 石碑脚），几块框叠成近似轮廓，不是整张图一个大框；坐标是贴图归一化坐标（u 左→右、v 上→下，0..1），
 * 由贴图不透明像素的逐行范围量出（tools 外临时脚本，271×260 / 259×260）。
 * sort：深度排序线（v）——脚在这条线以北的单位画在布景后面（被石碑挡住），以南的画在前面；碰撞框挡住了中间，单位不会站到台上。
 */
export const PROP_SHAPES: Readonly<Record<string, { boxes: ReadonlyArray<readonly [number, number, number, number]>; sort: number }>> = {
  // 张宝法坛：圆石台（v .40–.80，最宽处 u .15–.83 在 v .62），石碑立在台后中间，香炉在台心，前沿黄幡垂到 v .80
  zhang_bao_altar: { boxes: [[.27, .40, .73, .80], [.20, .43, .80, .77], [.16, .49, .84, .72]], sort: .6 },
  // 张角天公坛：八角高台（v .38–.87，u .09–.92），正面台阶伸到 v .94
  zhang_jiao_altar: { boxes: [[.10, .42, .90, .87], [.18, .36, .82, .42], [.30, .87, .70, .94]], sort: .66 },
  // 府衙大堂（攻城图集 siege_mid_hall 0 号格，384 见方）：台基 + 堂身落地部分（屋顶伸出去的不算）
  'siege_mid_hall#0': { boxes: [[.10, .62, .90, .90]], sort: .78 },
  // 水井（回血点，heal_spot 2 号格）：井栏一圈，井前的回血圈留空
  // 黄巾营帐（yellow_props 0–3 号格，128 见方：尖帐 / 圆帐 / 凉棚 / 小帐）：帐底一圈
  yellow_tent: { boxes: [[.14, .60, .86, .92]], sort: .76 },
  // 势力营具营帐（props-v2 fort-*.png 2 号格，256 见方；帐身 u .07–.92、底边 v .90）
  fort_tent: { boxes: [[.12, .56, .88, .90]], sort: .74 },
  // 势力营具营栅（3 号格：斜放一段木栅，底边 v .74–.92）、望楼（1 号格：四脚落在 u .38–.82、v .78–.94）
  fort_palisade: { boxes: [[.10, .74, .90, .92]], sort: .83 },
  fort_tower: { boxes: [[.38, .78, .82, .94]], sort: .86 },
  'heal_well': { boxes: [[.32, .64, .70, .82]], sort: .74 },
};

/** 按图像当前位置 / 显示尺寸 / 原点算出碰撞框，推进 out，并把图像深度设到排序线。没有登记形状的贴图返回空。 */
export function propFootprint(img: Phaser.GameObjects.Image, key: string, out?: Box[]): Box[] {
  const s = PROP_SHAPES[key]; if (!s) return [];
  const W = img.displayWidth, H = img.displayHeight, L = img.x - W * img.originX, T = img.y - H * img.originY;
  const made = s.boxes.map(([u0, v0, u1, v1]) => ({ left: L + u0 * W, right: L + u1 * W, top: T + v0 * H, bottom: T + v1 * H }));
  out?.push(...made);
  img.setDepth(actorDepth(T + s.sort * H));
  return made;
}

/** 点到一组框的最近距离（在框里为 0）。 */
export const boxDist = (boxes: readonly Box[], x: number, y: number): number =>
  boxes.reduce((m, b) => Math.min(m, Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom))), Infinity);

/** 形状最南沿（v），放置时用来让首领站在台前。 */
export const propFrontV = (key: string): number => Math.max(...(PROP_SHAPES[key]?.boxes.map(b => b[3]) ?? [1]));

/** 两组框是否重叠（带外扩 pad）。 */
export const boxesOverlap = (a: readonly Box[], b: readonly Box[], pad = 0): boolean =>
  a.some(p => b.some(q => p.left - pad < q.right && p.right + pad > q.left && p.top - pad < q.bottom && p.bottom + pad > q.top));
