import { setStoryFlag, storyFlag } from './Story';
import { isChapterTestRun } from './ChapterProgress';

/**
 * 首领招降的存档旗标（surrender-spec §9.4）：存在剧情旗标 im_story_v1 里（在存档位里，中途退出随战斗快照回滚）。
 *   surrendered：本存档劝降成功的首领 id（含于禁、孟获）—— 仁名 = 其中首领数
 *   executed：本存档斩杀过的首领 id（首次斩杀才给紫装）
 *   neverSeen：宁死不降首领本存档弹过窗的（以后不再弹、倒下播临终台词）
 * Story 旗标只存标量，这里用逗号分隔的字符串。
 */
type ListKey = 'surrendered' | 'executed' | 'neverSeen' | 'honored';
const list = (k: ListKey): string[] => { const v = storyFlag(k); return typeof v === 'string' && v ? v.split(',') : []; };
export const surrenderedIds = (): string[] => list('surrendered');
export const executedIds = (): string[] => list('executed');
export const neverSeenIds = (): string[] => list('neverSeen');
/** 宁死不降之将本存档以礼厚葬过的（斩杀的替代奖励：军粮 + 仁名，surrender-rules.md）。 */
export const honoredIds = (): string[] => list('honored');
/** 加入名单；返回是否本存档第一次。 */
export function markSurrender(k: ListKey, id: string): boolean {
  const l = list(k); if (l.includes(id)) return false; l.push(id); setStoryFlag(k, l.join(','));
  // 剧本分支用的单项旗标（ifFlag 只认一个条件）：surrendered_<id> / executed_<id>；颜良文丑降了几个 hebei_surrendered（0–2）
  if (k !== 'neverSeen') setStoryFlag(k + '_' + id, true);
  if (k === 'surrendered' && (id === 'yanliang' || id === 'wenchou')) setStoryFlag('hebei_surrendered', l.filter(x => x === 'yanliang' || x === 'wenchou').length);
  return true;
}

/** 试炼 / 调试战斗不改人才库与旗标（spec 验收 11）；测试可设 window.__IM_PARLEY_LIVE 走真实流程。 */
export function surrenderLive(): boolean { return !isChapterTestRun() || !!(globalThis as Record<string, unknown>).__IM_PARLEY_LIVE; }
