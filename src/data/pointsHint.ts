/**
 * 属性点提醒（总制作人第二轮试玩：第一章打完攒了 13 点没加，只有升级界面一行小字和头像旁小角标）。
 * 属性点从 1-1 升级起就攒（每级 1 点）；能加的地方：营寨主帐「武将谱」（第一章通关、天下开启后）、战斗中头像旁「属性」（1-3 四维加点开放后；2026-11-21 从 2-3 提前）。
 * 规则：有没加的点、且至少一处能加时才提醒（还加不了的时候不催）——行营顶部资源行、结算正文一行、营寨进门一句；第一次能加时另弹一次引导卡。
 */
import { starMapOn } from './starMap';
/** 星图开着（data/starMap.ts）：「属性点 N 未加」一类的字样改说「N 星未点」。下面三个函数给结算 / 行营 / 营寨三处提醒用。 */
/** 星图开着用 star，关着用 old（各处「属性点 / 加点」字样的统一出口）。 */
export function starWord(star: string, old: string): string { return starMapOn() ? star : old; }
export function pointsLeftText(n: number): string { return starMapOn() ? n + ' 星未点' : '属性点 ' + n + ' 未加'; }
export function pointsResultLine(h: { n: number; where: string }): string { return starMapOn() ? '星图  ' + h.n + ' 星未点 · 去' + h.where + '点亮' : '属性点  ' + h.n + ' 点未加 · 去' + h.where + '加点'; }
export function pointsCityToast(n: number): string { return starMapOn() ? '有 ' + n + ' 星未点 · 主帐「武将谱」里点亮' : '有 ' + n + ' 点属性点没加 · 主帐「武将谱」里加点'; }
export function pointsHint(free: number, o: { world: boolean; battle: boolean }): { n: number; where: string } | null {
  if (!(free > 0)) return null;
  const w = [o.world ? '营寨主帐「武将谱」' : '', o.battle ? (starMapOn() ? '战斗中按 C「星图」' : '战斗中头像旁「属性」') : ''].filter(Boolean);
  return w.length ? { n: Math.floor(free), where: w.join('或') } : null;
}
/** 第一次能加点时的引导（只一次）。 */
export const POINTS_GUIDE_KEY = 'im_points_guide_v1';
export function pointsGuideText(h: { n: number; where: string }): string { if (starMapOn()) return '升级攒下 ' + h.n + ' 颗星还没点：去' + h.where + '点亮，沿着连线一颗一颗点过去'; return '升级攒下 ' + h.n + ' 点属性点还没加：去' + h.where + '加点，力 / 敏 / 智 / 统各有加成'; }
