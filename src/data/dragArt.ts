import type { CharacterId } from './characters';

/**
 * 关羽「拖刀斩」专属美术（用户 2026-11-16：「关羽解锁拖刀斩的时候是需要拖刀动作的」）。
 * - 拖刀行走：学了拖刀斩后移动时换成这套行走图（大刀斜拖在身后、刀尖着地）。规格同 v2 行走图：
 *   4×4（行 = 下 / 左 / 右 / 上，每方向 4 帧），每格 176、脚底第 168 行、人物约 152 美术像素（art-style-v2-spec.md）。
 * - 拖刀上撩：蓄满挥出半月刀气那一下的出刀动作。1 行 × 4 帧、每格 232、朝右（朝左镜像）。
 * 图到位后把文件放进 public/assets/processed-v2/ 并在下面登记；未登记时不加载（避免 404），代码自动退回普通行走 / 普攻动作。
 * 只在人物画风 v2 下使用（v1 Q 版配不上写实拖刀图）。
 */
export const DRAG_ART_FILES: Readonly<Record<string, string>> = {
  guanyu_drag_walk_sheet: 'assets/processed-v2/guanyu_drag_walk_sheet.png',
  guanyu_drag_slash: 'assets/processed-v2/guanyu_drag_slash.png',
};

/** 拖刀行走图（按武将）。 */
export const DRAG_WALK_SHEET: Partial<Record<CharacterId, string>> = { guanyu: 'guanyu_drag_walk_sheet' };
/** 拖刀上撩出刀图（按武将），帧名 '0'..'3'，朝右。 */
export const DRAG_SLASH_SHEET: Partial<Record<CharacterId, string>> = { guanyu: 'guanyu_drag_slash' };
/** 上撩动作时长（毫秒）：蓄刀 / 起刀 / 撩到顶 / 收势。 */
export const DRAG_SLASH_MS = 420;
export const DRAG_SLASH_WEIGHTS = [.18, .16, .4, .26] as const;

/**
 * 拖刀行走时刀尖着地点（相对主将位置的世界像素，按画面朝向）。
 * 按拖刀行走图（guanyu_drag_walk_sheet，ChatGPT 2026-11-16 21:24 出图）实测 4 帧刀尖着地点的平均值：格内坐标 → 世界（0.5 倍、锚点在格第 107 行）。
 */
export const DRAG_TIP: Record<'down' | 'up' | 'left' | 'right', readonly [number, number]> = {
  right: [-42, 27], left: [38, 27], down: [-40, 28], up: [37, 29],
};
