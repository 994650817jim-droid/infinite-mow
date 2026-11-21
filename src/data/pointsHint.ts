/**
 * 属性点提醒（总制作人第二轮试玩：第一章打完攒了 13 点没加，只有升级界面一行小字和头像旁小角标）。
 * 属性点从 1-1 升级起就攒（每级 1 点）；能加的地方：营寨主帐「武将谱」（第一章通关、天下开启后）、战斗中头像旁「属性」（2-3 四维加点开放后）。
 * 规则：有没加的点、且至少一处能加时才提醒（还加不了的时候不催）——行营顶部资源行、结算正文一行、营寨进门一句；第一次能加时另弹一次引导卡。
 */
export function pointsHint(free: number, o: { world: boolean; battle: boolean }): { n: number; where: string } | null {
  if (!(free > 0)) return null;
  const w = [o.world ? '营寨主帐「武将谱」' : '', o.battle ? '战斗中头像旁「属性」' : ''].filter(Boolean);
  return w.length ? { n: Math.floor(free), where: w.join('或') } : null;
}
/** 第一次能加点时的引导（只一次）。 */
export const POINTS_GUIDE_KEY = 'im_points_guide_v1';
export function pointsGuideText(h: { n: number; where: string }): string { return '升级攒下 ' + h.n + ' 点属性点还没加：去' + h.where + '加点，力 / 敏 / 智 / 统各有加成'; }
