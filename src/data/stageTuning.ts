import type { ChapterDef } from './chapters';

/**
 * 主线关卡的刷怪节奏与小怪成长（2026-11-16 平衡，用户批准；试玩反馈「每关太久」「小怪到后面数值需要提高」）。
 *
 * 关卡的波数与时长由各关数据和关卡目标（objectives.ts：每关 3 波 × 45 秒，目标完成后首领出阵）决定，这里不改。
 * 这里只管三件事：
 * - pace：刷怪「时间轴」加速倍率。原来的刷怪表（间隔、每次数量、兵种配比、精锐）是按 2–5 分钟的长关写的，
 *   关卡缩到约 90 秒后，后半段的兵种和密度根本出不来。按「原首领时刻 ÷ 现首领时刻（约 90 秒）」加速，
 *   刷怪表按 elapsed × pace 取值。关内血量成长（hpScale）不加速，由下面的 hp 倍率补上。
 * - hp / damage：小怪（含精锐，不含首领）在该关的生命与伤害倍率，乘在原有数值上。
 *   第二到第五章原来共用同一套小怪且每关重置，玩家输出却涨了约 5 倍；生命按玩家输出约 50–60% 的速度涨。
 * - bossHp：首领生命倍率。首领比原来提前 1–3 分钟登场，主将低 2–3 级，原血量在 90 秒内打不动
 *   （实测首领掉血从 60–100% 跌到 20–45%）；章末首领取 0.5，其余 0.6–0.75，第三章起 0.85。
 * 攻城、守城、军情战不经过这里，保持原样。
 */
export interface StageTuning { pace: number; hp: number; damage: number; bossHp: number }

export type TunedChapter = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi';

const chapterStages = (pace: number, hp: readonly number[], damage: number, bossHp: number): StageTuning[] =>
  hp.map(h => ({ pace, hp: h, damage, bossHp }));

export const STAGE_TUNING: Record<TunedChapter, readonly StageTuning[]> = {
  huangjin: [
    { pace: 120 / 90, hp: 1, damage: 1, bossHp: .48 }, // 1-1 张梁：原首领 2:00；2026-11-18 平衡 .6 → .48（×0.8：Lv1 有 6 / 12 名武将 90 秒打不死）
    { pace: 180 / 90, hp: 1.3, damage: 1.05, bossHp: .65 }, // 1-2 张宝：原 3:00
    { pace: 300 / 90, hp: 1.7, damage: 1.1, bossHp: .5 }, // 1-3 张角：原 5:00
  ],
  hulao: [
    { pace: 135 / 90, hp: 2, damage: 1.15, bossHp: .75 }, // 2-1 汜水关：原 2:15
    { pace: 135 / 90, hp: 2.3, damage: 1.2, bossHp: .75 }, // 2-2 荥阳：原 2:15
    { pace: 315 / 90, hp: 2.6, damage: 1.25, bossHp: .5 }, // 2-3（章末首领）：原 5:15
  ],
  qunxiong: chapterStages(1.2, [3.2, 3.52, 3.84], 1.35, .85), // 第三章：原 3–4 波 × 45 秒，现 3 波
  guandu: chapterStages(1.2, [4, 4.4, 4.8], 1.45, .85), // 第四章
  chibi: chapterStages(1.2, [5, 5.5, 6], 1.6, .85), // 第五章（波次沿用第三章底关，只换成长倍率）
};

export function stageTuning(chapter: TunedChapter, stage: number): StageTuning {
  const list = STAGE_TUNING[chapter];
  return list[Math.max(0, Math.min(list.length - 1, Math.round(stage) - 1))];
}

/** 把刷怪节奏与成长倍率套到一关的 ChapterDef 上（波次、目标不动）。 */
export function tuneStage(c: ChapterDef, chapter: TunedChapter, stage: number): ChapterDef {
  const t = stageTuning(chapter, stage);
  return { ...c, pace: t.pace, growth: { hp: t.hp, damage: t.damage, bossHp: t.bossHp } };
}
