import type { ChapterDef } from './chapters';

/**
 * 主线关卡节奏与小怪成长（2026-11-16 平衡，用户批准；试玩反馈「每关太久、8 波太多」「小怪到后面数值需要提高」）。
 *
 * - spacing：每波间隔（秒）。首领在最后一波开始时登场，所以首领时刻 = (波数 − 1) × spacing。
 * - pace：刷怪「时间轴」加速倍率。刷怪间隔、每次数量、兵种配比、精锐出现都按 elapsed × pace 取值，
 *   原来第 N 波的刷怪强度在新的第 N 波出现。关内的血量成长（hpScale）不加速，由下面的 hp 倍率补上。
 * - hp / damage：小怪（含精锐，不含首领）在该关的生命与伤害倍率，乘在原有数值上。
 *   第二到第五章原来共用同一套小怪且每关重置，玩家输出却涨了约 5 倍；生命按玩家输出约 50–60% 的速度涨。
 * - bossHp：首领生命倍率。首领提前 1–3 分钟登场，主将等级低 2–3 级，原血量在 90 秒内几乎打不动（实测首领掉血从 60–100% 跌到 20–45%），
 *   按「登场时主将输出约降多少」同比下调；章末首领（张角、吕布）实测 0.6 仍打不动，取 0.5；第三章起波距只缩 45 → 35，降得少。
 * - names / recruitWaves：合并波次时的新波名与招兵波（不填 = 沿用原值）。
 * 攻城、守城、军情战不经过这里，保持原样。
 */
export interface StageTuning { spacing: number; pace: number; hp: number; damage: number; bossHp: number; names?: readonly string[]; recruitWaves?: readonly number[] }

export type TunedChapter = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi';

const chapterStages = (spacing: number, pace: number, hp: readonly number[], damage: number, bossHp: number): StageTuning[] =>
  hp.map(h => ({ spacing, pace, hp: h, damage, bossHp }));

export const STAGE_TUNING: Record<TunedChapter, readonly StageTuning[]> = {
  huangjin: [
    { spacing: 30, pace: 2, hp: 1, damage: 1, bossHp: .6 }, // 1-1：3 波，首领 1:00（原 2:00）
    { spacing: 30, pace: 2, hp: 1.3, damage: 1.05, bossHp: .65 }, // 1-2：4 波，首领 1:30（原 3:00）
    // 1-3：6 波 × 60 秒 → 5 波 × 35 秒，首领 2:20（原 5:00）；去掉「校尉压阵」
    { spacing: 35, pace: 300 / 140, hp: 1.7, damage: 1.1, bossHp: .5, names: ['黄巾先锋', '弓盾合围', '轻骑突袭', '黄巾大军', '张角决战'], recruitWaves: [1, 2, 3, 4] },
  ],
  hulao: [
    { spacing: 30, pace: 1.5, hp: 2, damage: 1.15, bossHp: .75 }, // 2-1 汜水关：4 波，首领 1:30（原 2:15）
    { spacing: 30, pace: 1.5, hp: 2.3, damage: 1.2, bossHp: .75 }, // 2-2 荥阳：4 波，首领 1:30
    // 2-3 虎牢关：8 波 × 45 秒 → 5 波 × 35 秒，首领 2:20（原 5:15）
    { spacing: 35, pace: 315 / 140, hp: 2.6, damage: 1.25, bossHp: .5, names: ['关前哨骑', '西凉列阵', '铁甲压境', '虎牢精锐', '吕布出阵'], recruitWaves: [1, 2, 3, 4] },
  ],
  qunxiong: chapterStages(35, 45 / 35, [3.2, 3.52, 3.84], 1.35, .85), // 第三章：每波 45 → 35 秒
  guandu: chapterStages(35, 45 / 35, [4, 4.4, 4.8], 1.45, .85), // 第四章
  chibi: chapterStages(35, 45 / 35, [5, 5.5, 6], 1.6, .85), // 第五章（波次沿用第三章底关，只换成长倍率）
};

export function stageTuning(chapter: TunedChapter, stage: number): StageTuning {
  const list = STAGE_TUNING[chapter];
  return list[Math.max(0, Math.min(list.length - 1, Math.round(stage) - 1))];
}

/** 把节奏与成长套到一关的 ChapterDef 上（波次重排、刷怪加速、成长倍率）。 */
export function tuneStage(c: ChapterDef, chapter: TunedChapter, stage: number): ChapterDef {
  const t = stageTuning(chapter, stage), names = t.names ?? c.waves.map(w => w.name);
  return {
    ...c,
    waves: names.map((name, i) => ({ name, start: i * t.spacing })),
    recruitWaves: t.recruitWaves ?? c.recruitWaves,
    pace: t.pace,
    growth: { hp: t.hp, damage: t.damage, bossHp: t.bossHp },
  };
}
