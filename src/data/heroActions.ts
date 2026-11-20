import type {CharacterId} from './characters';

/**
 * 武将动作层（HERO_ACTIONS_PLAN.md）：动作播放期间覆盖行走帧，结束后回到行走 / 待机。
 * 帧可写帧名（字符串）或图集序号（数字）。朝左缺图时用朝右帧水平镜像。
 */
export type HeroActionKind = 'attack' | 'skill' | 'hurt' | 'win' | 'die';
export type ActionFrame = string | number;
export interface HeroActionSet {
  texture: string;
  idle?: ActionFrame[];
  attack: {down: ActionFrame[]; right: ActionFrame[]; up: ActionFrame[]; left?: ActionFrame[]};
  skill?: ActionFrame[];
  hurt?: ActionFrame[];
  win?: ActionFrame[];
  die?: ActionFrame[];
}
/** 各动作时长（毫秒，战斗时间）；胜利 / 倒地播完停在最后一帧。 */
export const ACTION_MS: Record<HeroActionKind, number> = {attack: 260, skill: 620, hurt: 220, win: 700, die: 760};
/** 待机呼吸每帧时长。 */
export const IDLE_FRAME_MS = 260;

/**
 * 已有动作素材的武将。
 * 诸葛亮：沿用旧攻击图 zhuge_attack_sheet（96×96，4 行 × 2 列：朝下 / 朝右 / 朝右 / 朝上，第 2 行实际也朝右）——过渡素材，正式动作图到位后替换。
 */
export const HERO_ACTIONS: Partial<Record<CharacterId, HeroActionSet>> = {
  zhaoyun: fullSet('zhaoyun_actions'),
  guanyu: fullSet('guanyu_actions'),
  huangzhong: fullSet('huangzhong_actions'),
  zhuge: fullSet('zhuge_actions'),
  zhangfei: fullSet('zhangfei_actions'),
  huangyueying: fullSet('huangyueying_actions'),
  pangtong: fullSet('pangtong_actions'),
  liubei: fullSet('liubei_actions'),
  weiyan: fullSet('weiyan_actions'),
  machao: fullSet('machao_actions'),
  sunshangxiang: fullSet('sunshangxiang_actions'),
  diaochan: fullSet('diaochan_actions'),
  lvbu: fullSet('lvbu_actions'), // P2：只有 v2 图
  zhangliao: fullSet('zhangliao_actions'),
  zhouyu: fullSet('zhouyu_actions'),
};
/** 诸葛亮旧攻击图（过渡素材，正式图集缺失时退回）。 */
export const ZHUGE_FALLBACK: HeroActionSet = {texture: 'zhuge_attack_sheet', attack: {down: [0, 1], right: [4, 5], up: [6, 7]}};
/** 正式动作图集（tools/prepare-hero-actions.mjs，4 列 × 7 行、128×128）的标准帧序。 */
function fullSet(texture: string): HeroActionSet {
  const row = (r: number, from = 0, n = 4) => Array.from({length: n}, (_, i) => r * 4 + from + i);
  return {texture, idle: row(0), attack: {down: row(1), right: row(2), up: row(3)}, skill: row(4), hurt: row(5, 0, 2), win: row(5, 2, 2), die: row(6)};
}
/** 需加载的正式动作图集（key → 文件）。 */
export const HERO_ACTION_FILES: Record<string, string> = {lvbu_actions: 'assets/hero-actions-v2/lvbu.png', zhangliao_actions: 'assets/hero-actions-v2/zhangliao.png', zhouyu_actions: 'assets/hero-actions-v2/zhouyu.png', sunshangxiang_actions: 'assets/hero-actions/sunshangxiang.png', diaochan_actions: 'assets/hero-actions/diaochan.png', zhaoyun_actions: 'assets/hero-actions/zhaoyun.png', guanyu_actions: 'assets/hero-actions/guanyu.png', huangzhong_actions: 'assets/hero-actions/huangzhong.png', zhangfei_actions: 'assets/hero-actions/zhangfei.png', huangyueying_actions: 'assets/hero-actions/huangyueying.png', pangtong_actions: 'assets/hero-actions/pangtong.png', liubei_actions: 'assets/hero-actions/liubei.png', weiyan_actions: 'assets/hero-actions/weiyan.png', machao_actions: 'assets/hero-actions/machao.png', zhuge_actions: 'assets/hero-actions/zhuge.png'};
