/**
 * 剧情节点数据（2026-11-17 用户：「我想往游戏添加剧情，你设计剧情」；设计见统筹 story-plan.md）。
 * 每章一个文件导出 StoryChapter；src/systems/Story.ts 负责按时机播放、记已看过与旗标。
 */
import type { CharacterId } from '../characters';

/** 一句台词。who：武将 id / '{lord}'（主公自己）/ STORY_CAST 里的人物键；不写为旁白。tip：本关玩法提示（卷轴里以提示样式显示）。 */
export interface StoryLine {
  who?: string; text: string; tip?: boolean;
  /** 条件：某武将在随行里 / 已招募（名册里有）/ 存档旗标为真 / 主公是其中之一 */
  ifFollower?: CharacterId; ifRecruited?: CharacterId; ifFlag?: string; ifLord?: readonly CharacterId[];
}
export type StoryNodeType = 'chapterOpen' | 'stageBrief' | 'bossIntro' | 'bossFall' | 'chapterClose' | 'campTalk' | 'bond' | 'bark';
export interface StoryNode {
  /** 全局唯一，记「已看过」用，如 'huangjin.open'、'huangjin-1.brief' */
  id: string; type: StoryNodeType; lines: readonly StoryLine[];
  /** 主公改写：baseLords 之外的主公改用 variants.other；也可直接按主公 id 给整段 */
  baseLords?: readonly CharacterId[]; variants?: Partial<Record<CharacterId | 'other', readonly StoryLine[]>>;
  /** 卷轴标题 / 小标题 / 插画（缺图退回通用横幅） */
  kicker?: string; title?: string; illustration?: string;
  /** 'bark' 节点：由其他系统（如 2-3 董卓 + 吕布首领战）按 id 调 StoryDirector.line() 触发，Story 不自动播 */
  external?: boolean;
}
/** 羁绊：带着 members 全员（主公 + 随行）进关时，关前追加 lines（每存档一次）并给这些人 damageMul 加成（每关都给）。 */
export interface StoryBond { id: string; name: string; members: readonly CharacterId[]; lines: readonly StoryLine[]; damageMul: number }
export interface StoryChapter {
  /** 章 id：与 ChapterDef.id 一致（huangjin / hulao …） */
  chapter: string;
  open?: StoryNode; close?: StoryNode;
  /** 按关（1–3）：关前军情、首领登场 / 倒下 */
  stages: Partial<Record<1 | 2 | 3, { brief?: StoryNode; bossIntro?: StoryNode; bossFall?: StoryNode }>>;
  camp: readonly StoryNode[];
  bonds: readonly StoryBond[];
  /** 其他系统按 id 触发的台词（不自动播） */
  barks?: readonly StoryNode[];
}

/** 非武将人物：显示名；portrait 为对白半身像贴图键（还没有的先只显示名字章，清单见 MISSING_PORTRAITS）。 */
export const STORY_CAST: Record<string, { name: string; portrait?: string }> = {
  scout: { name: '斥候' }, jianyong: { name: '简雍' }, caocao: { name: '曹操' }, yuanshao: { name: '袁绍' },
  zhangliang: { name: '张梁' }, zhangbao: { name: '张宝' }, zhangjiao: { name: '张角' },
  huaxiong: { name: '华雄' }, xurong: { name: '徐荣' }, dongzhuo: { name: '董卓' }, lubu: { name: '吕布' },
  zhangshiping: { name: '张世平' },
};
/** 第一、二章用到、还没有对白立绘的人物（交美术会话补水墨对白半身像，透明底）。 */
export const MISSING_PORTRAITS = ['旁白卷首图（通用）', '斥候（通用）', '简雍', '曹操', '袁绍', '张梁', '张宝', '张角', '华雄', '徐荣', '董卓', '吕布', '张世平'];
