import type { CharacterId } from './characters';

/**
 * 武将脚下「被动刻度」（用户 2026-11-18：「我想每个角色都加类似于赵云脚下那个被动，可以知道被动触发到哪里，符合角色」）。
 * 与赵云「七进七出」龙鳞同一做法：脚下前半圈一排手绘小图标，积一层亮一枚，满层流光，触发时一齐闪一下。
 * 图集（ChatGPT 出图黑底 → tools/prepare-fx-sheet.mjs ALPHA=1 反解透明，每格 128）：每行一位武将，4 列 = 熄灭 / 点亮 / 满层流光 A / 满层流光 B。
 *  - passive_gauge_a 4×6：关羽 · 黄忠 · 诸葛亮 · 张飞 · 黄月英 · 庞统
 *  - passive_gauge_b 4×5：刘备 · 魏延 · 马超 · 孙尚香 · 貂蝉
 * 赵云仍用自己的龙鳞序列帧（ZhaoyunPassiveFx，点亮 / 熄灭 / 满层 / 触发都有专门的帧），由 PassiveGauge 统一调度。
 */
export interface GaugeLook {
  /** 图集键与行号。 */
  tex: 'passive_gauge_a' | 'passive_gauge_b'; row: number;
  /** 脚下显示几枚（层数多的按比例折算，如黄月英 12 层 = 6 枚齿轮、每枚 2 层）。 */
  slots: number;
  /** 图标边长（电脑版像素）。 */
  size: number;
  /** 层数的叫法（测试 / 调试用）。 */
  unit: string;
}

export const PASSIVE_GAUGE_LOOKS: Partial<Record<CharacterId, GaugeLook>> = {
  guanyu: { tex: 'passive_gauge_a', row: 0, slots: 3, size: 17, unit: '武势（青龙刀锋）' },
  huangzhong: { tex: 'passive_gauge_a', row: 1, slots: 5, size: 15, unit: '蓄势（箭羽）' },
  zhuge: { tex: 'passive_gauge_a', row: 2, slots: 3, size: 16, unit: '星象（北斗星）' },
  zhangfei: { tex: 'passive_gauge_a', row: 3, slots: 5, size: 15, unit: '怒气（裂地石）' },
  huangyueying: { tex: 'passive_gauge_a', row: 4, slots: 6, size: 14, unit: '机括（齿轮）' },
  pangtong: { tex: 'passive_gauge_a', row: 5, slots: 3, size: 16, unit: '计策（连环锁）' },
  liubei: { tex: 'passive_gauge_b', row: 0, slots: 4, size: 15, unit: '仁德（汉旗）' },
  weiyan: { tex: 'passive_gauge_b', row: 1, slots: 5, size: 15, unit: '拒敌（护心甲片）' },
  machao: { tex: 'passive_gauge_b', row: 2, slots: 6, size: 14, unit: '铁骑（马蹄铁）' },
  sunshangxiang: { tex: 'passive_gauge_b', row: 3, slots: 6, size: 14, unit: '疾步（飞刀）' },
  diaochan: { tex: 'passive_gauge_b', row: 4, slots: 5, size: 15, unit: '舞势（弯月花瓣）' },
};

/**
 * 主将脚下 HUD 排布（2026-11-20 用户「被动叠成数和马耐力条重叠一起」）：马蹄在主将原点下方 30。
 * 步行：被动刻度在 footDy；骑马：被动刻度整排下移 mountDy，落到马蹄下面；马的耐力条（HeroMount）在刻度再下面 barBelowGauge，
 * 没有刻度（P2 武将暂无刻度图）时耐力条贴在马蹄下 bar。
 */
export const FOOT_HUD = { mountDy: 12, bar: 34, barBelowGauge: 62 } as const;

export const PASSIVE_GAUGE = {
  /** 与赵云龙鳞同位置：主将原点下方 footDy 处的前半椭圆。 */
  footDy: 29, rx: 30, ry: 9,
  /** 相邻两枚的角度间隔（弧度；赵云 7 枚铺满 .84π 即每枚 .14π），整排以正下方居中。 */
  step: Math.PI * .14,
  idleAlpha: .75, litAlpha: 1,
  /** 点亮一枚时从 popScale 倍缩回原大；熄灭时 outMs 内淡出到熄灭态。 */
  popScale: 1.45, popMs: 220, outMs: 300,
  /** 满层流光两帧交替的频率。 */
  shimmerFps: 5,
  /** 被动触发：全部图标亮成流光帧并放大 flashScale 倍、flashMs 内收回。 */
  flashScale: 1.7, flashMs: 380,
} as const;
