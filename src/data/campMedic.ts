/**
 * 行营休整 · 军医（用户 2026-11-18：「关于前一关收到的伤害血量会继承到下一关，休整加个军医，军医可以花费军粮治疗，可以画个军医治疗立绘」）。
 * 主将（与名将随从、部曲）的血量现在跨关继承；休整时花随军粮治疗。价格随章节递增。起始价格，交平衡会话调。
 *   小治：主将回复 25% 生命上限        价格 10 + 3 × 章
 *   大治：主将生命回满                  价格 26 + 8 × 章（按缺的血折算：缺得少收得少，至少收小治价）
 *   为全军疗伤：部曲与名将随从全部回满  价格 12 + 4 × 章（没人受伤时不可点）
 */
export type MedicKind = 'small' | 'full' | 'army';
export const CAMP_MEDIC = {
  small: { name: '小治', desc: '敷药包扎 · 回复 25% 生命', frac: .25, base: 10, perChapter: 3 },
  full: { name: '大治', desc: '施针用药 · 生命回满', base: 26, perChapter: 8 },
  army: { name: '为全军疗伤', desc: '部曲与随行伤兵全部回满', base: 12, perChapter: 4 },
} as const;

/** 第几章（1–12）：按战斗场景与章节 id 推出。 */
export function medicChapter(sceneKey: string, chapterId?: string): number {
  const byScene: Record<string, number> = { ThirdGameScene: 3, GuanduGameScene: 4, ChibiGameScene: 5, JingnanGameScene: 6, ShuGameScene: 7, HanzhongGameScene: 8, XiangfanGameScene: 9, YilingGameScene: 10, NanzhengGameScene: 11, BeifaGameScene: 12 };
  return byScene[sceneKey] ?? (chapterId === 'hulao' ? 2 : 1);
}

/** 价格。full 按缺血比例折算（missing 0–1），不低于小治价。 */
export function medicPrice(kind: MedicKind, chapter: number, missing = 1): number {
  const c = Math.max(1, Math.min(12, chapter));
  if (kind === 'small') return CAMP_MEDIC.small.base + CAMP_MEDIC.small.perChapter * c;
  if (kind === 'army') return CAMP_MEDIC.army.base + CAMP_MEDIC.army.perChapter * c;
  const full = CAMP_MEDIC.full.base + CAMP_MEDIC.full.perChapter * c, small = medicPrice('small', c);
  return Math.max(small, Math.round(full * Math.max(0, Math.min(1, missing))));
}
