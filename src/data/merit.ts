/**
 * 战功（2026-11-17 用户：「战功获得是击杀精英怪和 boss 获得」「残卷是需要去建筑换而不是自动换」）。
 * 战功是存档里的货币（MasteryStore，跨关累计），只靠击杀精英 / 首领获得；在营寨讲武堂手动兑换武学残卷。
 * 数值待平衡会话复核。测试 / 调试战斗不计。
 */
export const MERIT = {
  /** 击杀一名精英。 */
  elite: 1,
  /** 击败一名首领（含追兵首领、守将）。 */
  boss: 10,
  /** 讲武堂：多少战功换 1 张武学残卷。 */
  perScroll: 10,
} as const;

/** 本场击杀换算的战功。 */
export function meritFromKills(elites: number, bosses: number): number {
  return Math.max(0, Math.floor(elites)) * MERIT.elite + Math.max(0, Math.floor(bosses)) * MERIT.boss;
}
