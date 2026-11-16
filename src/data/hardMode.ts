/**
 * 乱世难度：已平定的章节可再以乱世难度出征（天下地图「乱世难度」）。
 * 只放大敌军，不改武将 / 兵种 / 首领技能本身；首次以乱世难度通关该章第三关，发一次性奖励与称号。
 */
import type { TimelineChapterId } from '../world/ChapterTimeline';
export const HARD_MODE = {
  /** 小兵 / 精英生命倍率。 */ enemyHp: 1.35,
  /** 首领生命倍率。 */ bossHp: 1.8,
  /** 敌军接触与弹道伤害倍率。 */ damage: 1.25,
  /** 首次乱世通关奖励（永久军功 / 粮草）。 */ reward: { merits: 200, provisions: 300 },
} as const;
export const HARD_TITLES: Record<TimelineChapterId, string> = {
  huangjin: '黄天终结', hulao: '虎牢扬威', qunxiong: '逐鹿群雄', guandu: '官渡奇谋', chibi: '赤壁烽火',
};
