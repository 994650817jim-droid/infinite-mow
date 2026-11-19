/**
 * 剧情节点数据（2026-11-17 用户：「我想往游戏添加剧情，你设计剧情」；设计见统筹 story-plan.md）。
 * 每章一个文件导出 StoryChapter；src/systems/Story.ts 负责按时机播放、记已看过与旗标。
 */
import type { CharacterId } from '../characters';

/** 一句台词。who：武将 id / '{lord}'（主公自己）/ STORY_CAST 里的人物键；不写为旁白。tip：本关玩法提示（卷轴里以提示样式显示）。 */
export interface StoryLine {
  who?: string; text: string; tip?: boolean;
  /** 条件：某武将在队（主公或随行）/ 已招募（名册里有）/ 存档旗标（'name' 为真、'name=value' 等于、'!name' 未设）/ 主公是其中之一 */
  ifFollower?: CharacterId; ifRecruited?: CharacterId; ifFlag?: string; ifLord?: readonly CharacterId[];
  /** 这几位都在队（第五章起：「张飞、诸葛亮都在队」这类两人条件） */
  ifFollowers?: readonly CharacterId[];
  /** 反向条件（第三章起）：某武将不在队 / 主公不是其中之一（如「貂蝉是随行而不是主公」= ifFollower + ifNotLord） */
  ifNotFollower?: CharacterId; ifNotLord?: readonly CharacterId[];
}
/** interlude 幕间（关前 / 首次通关后的卷轴，每存档一次）；bossPhase 首领二阶段大字台词（每次）；choice 抉择（卷轴 + 两个按钮，选过不再问）。第三章起新增，各章通用。 */
export type StoryNodeType = 'chapterOpen' | 'stageBrief' | 'bossIntro' | 'bossFall' | 'chapterClose' | 'campTalk' | 'bond' | 'bark' | 'interlude' | 'bossPhase' | 'choice';
/** 抉择的一个选项：选中后写旗标 flag=value、播 reply、给奖励（军功 / 军粮）。第一个选项是「跳过」时的默认（史实）分支。 */
export interface StoryChoice { label: string; flag: string; value: string; reply: readonly StoryLine[]; reward?: { merit?: number; grain?: number } }
export interface StoryNode {
  /** 全局唯一，记「已看过」用，如 'huangjin.open'、'huangjin-1.brief' */
  id: string; type: StoryNodeType; lines: readonly StoryLine[];
  /** 主公改写：baseLords 之外的主公改用 variants.other；也可直接按主公 id 给整段 */
  baseLords?: readonly CharacterId[]; variants?: Partial<Record<CharacterId | 'other', readonly StoryLine[]>>;
  /** 卷轴标题 / 小标题 / 插画（缺图退回通用横幅） */
  kicker?: string; title?: string; illustration?: string;
  /** 'bark' 节点：由其他系统（如 2-3 董卓 + 吕布首领战）按 id 调 StoryDirector.line() 触发，Story 不自动播 */
  external?: boolean;
  /** 'choice' 节点的选项（两个） */
  choices?: readonly StoryChoice[];
  /** 双首领关：bossPhase 节点只对这位首领（boss-phase 事件的 bossId）。 */
  boss?: string;
  /** 过场动画 id（过场系统做好之前，这段按字幕当卷轴播；做好后由过场系统接管同一 id） */
  cutscene?: string;
  /** 按旗标换插画（第五章章末：江陵抉择两种）：flagMatches(cond) 成立时用 key */
  illustrationIf?: readonly { cond: string; key: string }[];
  /** 抉择：主公是其中之一时不弹（如魏延是主公，魏延去留不问），直接按 skipChoice（默认 0）写旗标、不给奖励 */
  skipIfLord?: readonly CharacterId[]; skipChoice?: number;
  /** 首领倒下时的横幅 + 旗标（第四章「斩颜良」「诛文丑」，复用温酒斩华雄的横幅样式）：ifFollower 在队才触发；旗标不受剧情设置影响 */
  banner?: { title: string; caption?: string; ifFollower?: CharacterId; flag?: string };
}
/** 羁绊：带着 members 全员（主公 + 随行）进关时，关前追加 lines（每存档一次）并给这些人加成（每关都给）：damageMul 伤害、speedMul 移速（主将）。 */
export interface StoryBond { id: string; name: string; members: readonly CharacterId[]; lines: readonly StoryLine[]; damageMul?: number; speedMul?: number; /** 暴击率加成（主将），如 .05 */ critBonus?: number; /** 技能冷却倍率（如「卧龙凤雏」.95） */ cooldownMul?: number }
/** 某一关的剧情：before 开打前（过场 / 幕间，按顺序，在军情之前）、brief 军情、首领三句、after 首次通关后（战报前）、choice 宝箱捡完后的抉择。 */
export interface StoryStage { before?: readonly StoryNode[]; brief?: StoryNode; bossIntro?: StoryNode; bossPhase?: StoryNode; bossFall?: StoryNode; /** 双首领关：按首领 id 的倒下台词 + 横幅（只在斩杀时播）。 */ bossFalls?: Readonly<Record<string, StoryNode>>; /** 一关先后两位首领（6-3 黄忠 → 韩玄）：按当前首领 id（StoryHost.bossId）取登场 / 二阶段台词，没有时用 bossIntro / bossPhase。 */ bossIntros?: Readonly<Record<string, StoryNode>>; bossPhases?: Readonly<Record<string, StoryNode>>; after?: readonly StoryNode[]; choice?: StoryNode }
export interface StoryChapter {
  /** 章 id：与 ChapterDef.id 一致（huangjin / hulao …） */
  chapter: string;
  open?: StoryNode; close?: StoryNode;
  /** 按关（1–3） */
  stages: Partial<Record<1 | 2 | 3, StoryStage>>;
  /** 章末之后接着播（如第三章「煮酒论英雄」过场），每存档一次 */
  closeAfter?: readonly StoryNode[];
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
  // 第三章：对白水墨立绘 assets/ink-cast/（2026-11-18，见 data/story/art.ts）
  jiaxu: { name: '贾诩', portrait: 'ink_cast_jiaxu' }, wangyun: { name: '王允', portrait: 'ink_cast_wangyun' }, lijue: { name: '李傕', portrait: 'ink_cast_lijue' }, taoqian: { name: '陶谦', portrait: 'ink_cast_taoqian' }, zhangxiu: { name: '张绣', portrait: 'ink_cast_zhangxiu' },
  dianwei: { name: '典韦', portrait: 'ink_cast_dianwei' }, yuanshu: { name: '袁术', portrait: 'ink_cast_yuanshu' }, jiling: { name: '纪灵', portrait: 'ink_cast_jiling' }, mizhu: { name: '糜竺', portrait: 'ink_cast_mizhu' },
  // 第四章：对白水墨立绘 assets/ink-cast/（2026-11-18；蔡阳待补，先显示名字章）
  dongcheng: { name: '董承', portrait: 'ink_cast_dongcheng' }, chengyu: { name: '程昱', portrait: 'ink_cast_chengyu' }, zhangliao: { name: '张辽', portrait: 'ink_cast_zhangliao' }, yanliang: { name: '颜良', portrait: 'ink_cast_yanliang' }, wenchou: { name: '文丑', portrait: 'ink_cast_wenchou' }, xunyou: { name: '荀攸', portrait: 'ink_cast_xunyou' },
  chunyuqiong: { name: '淳于琼', portrait: 'ink_cast_chunyuqiong' }, xuyou: { name: '许攸', portrait: 'ink_cast_xuyou' }, xuchu: { name: '许褚', portrait: 'ink_cast_xuchu' }, caiyang: { name: '蔡阳' }, qinbing: { name: '亲兵' },
  // 第五章（2026-11-18；立绘到位前先显示名字章，ink-cast 有图后在 portrait 填 ink_cast_<键>）
  zhouyu: { name: '周瑜' }, caochun: { name: '曹纯' }, caimao: { name: '蔡瑁' }, caoren: { name: '曹仁' }, sunquan: { name: '孙权' }, huanggai: { name: '黄盖' }, lusu: { name: '鲁肃' }, xushu: { name: '徐庶' },
  // 第六章
  zhaofan: { name: '赵范' }, liudu: { name: '刘度' }, hanxuan: { name: '韩玄' }, fanshi: { name: '樊氏' }, liuxian: { name: '刘贤' }, xingdaorong: { name: '邢道荣' }, yangling: { name: '杨龄' },
};
/** 第一、二章用到、还没有对白立绘的人物（交美术会话补水墨对白半身像，透明底）。 */
/** 第三章新增缺图人物（曹操、吕布、简雍已在上面）。 */
/** 第四章新增缺图人物（袁绍已在第一批）。 */
export const MISSING_PORTRAITS_CH4 = ['蔡阳（可只用名字章）']; // 2026-11-18 其余九人立绘已补齐
export const MISSING_PORTRAITS_CH3: string[] = []; // 2026-11-18 九人立绘已补齐（assets/ink-cast/）
export const MISSING_PORTRAITS = ['旁白卷首图（通用）', '斥候（通用）', '简雍', '曹操', '袁绍', '张梁', '张宝', '张角', '华雄', '徐荣', '董卓', '吕布', '张世平'];
