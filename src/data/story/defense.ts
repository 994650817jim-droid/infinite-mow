import type { CityTier } from '../../world/WorldCities';

/**
 * 守城简报（守城重做 defense-redesign.md 第二节「开战简报」，查 Bug 会话回报 ④「守城没有剧情简报」）：
 * 按来犯势力 / 城名 / 攻城主将 / 城池档自动生成；第一次守城多一句教学。攻城主将登场 / 倒下各一句（通用两套轮换）。
 */
export interface DefenseBriefInput { city: string; tier: CityTier; faction: string; general: string; lord: string; first: boolean }
export function defenseBrief(o: DefenseBriefInput): { who?: string; text: string }[] {
  const keep = o.tier === 'small' ? '城小兵少，只能靠城墙死守。' : o.tier === 'large' ? `${o.city}城高池深，守住城门，敌必自退。` : '城中粮草尚足，守住城门便是。';
  const lines: { who?: string; text: string }[] = [
    { who: '斥候', text: `报！${o.general.startsWith(o.faction) ? o.general : o.faction + o.general}引兵来犯，已到${o.city}城下！` }, // 主将名牌常写成「曹操先锋」，别叠成「曹操曹操先锋」
    { who: '守将', text: keep },
    { who: o.lord, text: '传令——弓手上城，部曲守门！' },
    { text: '城门有耐久，破了敌军会涌进瓮城；府衙被破才算失守。每波之间可以喘息：花随军钱币修门、补设施、补弓手。' },
  ];
  if (o.first) lines.push({ text: '站上城头的「滚木」「热油」位会自动放。冲车先拆；云梯打掉，才不会再有人爬上城头。' });
  return lines;
}
const INTRO = ['{city}今日必破！', '城门一开，鸡犬不留！'], FALL = ['……撤！撤兵！', '这城……怎么这般难打……'];
export function defenseBossLine(kind: 'intro' | 'fall', city: string, seed: number): string { const l = kind === 'intro' ? INTRO : FALL; return l[Math.abs(seed) % l.length].replace('{city}', city); }
/** 第一次守城（看过记一笔）。 */
export const DEFENSE_FIRST_KEY = 'im_defense_first_seen';
