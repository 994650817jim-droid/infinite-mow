/**
 * 行营休整 · 军医（用户 2026-11-18：「关于前一关收到的伤害血量会继承到下一关，休整加个军医，军医可以花费军粮治疗，可以画个军医治疗立绘」）。
 * 主将（与名将随从、部曲）的血量现在跨关继承；休整时花随军粮治疗，营寨 / 城池的军医花营寨军粮（town/CampMedic）。价格随章节递增。起始价格，交平衡会话调。
 * 2026-11-19 用户「军医随着章节往后推越贵」：价格 = 基价 × MEDIC_GROWTH^(章−1) + 每章增量 × 章（复利 + 固定增量，后期也要掂量花不花）。
 *   小治：主将回复 25% 生命上限        第 1 章 13 → 第 6 章 ≈ 36 → 第 12 章 ≈ 71
 *   大治：主将生命回满                  第 1 章 34 → 第 12 章 ≈ 187（按缺的血折算：缺得少收得少，至少收小治价 ×1.8）
 *   为全军疗伤：部曲与名将随从全部回满  第 1 章 16 → 第 12 章 ≈ 90（没人受伤时不可点）
 */
export type MedicKind = 'small' | 'full' | 'army';
/** 初诊不收粮（11-20：1-1 后行营郎中来投时给一次，小治 / 大治任选；用过即消）。 */
export const MEDIC_FREE_KEY = 'im_medic_free';
export function medicFree(): boolean { try { return localStorage.getItem(MEDIC_FREE_KEY) === '1'; } catch { return false; } }
export function setMedicFree(on: boolean): void { try { if (on) localStorage.setItem(MEDIC_FREE_KEY, '1'); else localStorage.removeItem(MEDIC_FREE_KEY); } catch { /* ignore */ } }
/** 每章复利（基价部分）。 */
export const MEDIC_GROWTH = 1.12;
export const CAMP_MEDIC = {
  small: { name: '小治', desc: '敷药包扎 · 回复 25% 生命', frac: .25, base: 10, perChapter: 3 },
  full: { name: '大治', desc: '施针用药 · 生命回满', base: 26, perChapter: 8 },
  army: { name: '为全军疗伤', desc: '部曲与随行伤兵全部回满', base: 12, perChapter: 4 },
} as const;

/**
 * 第几章（1–12）：按战斗场景与章节 id 推出。攻城 / 军情 / 吕布这类不属于某一章的战斗（以及营寨、城池）按天下进度算——传 progress（town/CampMedic.worldMedicChapter）。
 */
export function medicChapter(sceneKey: string, chapterId?: string, progress?: number): number {
  const byScene: Record<string, number> = { ThirdGameScene: 3, GuanduGameScene: 4, ChibiGameScene: 5, JingnanGameScene: 6, ShuGameScene: 7, HanzhongGameScene: 8, XiangfanGameScene: 9, YilingGameScene: 10, NanzhengGameScene: 11, BeifaGameScene: 12 };
  if (byScene[sceneKey]) return byScene[sceneKey];
  if (progress && /^(Siege|Intel|Lubu|SideLubu)GameScene$/.test(sceneKey)) return Math.max(1, Math.min(12, progress));
  return chapterId === 'hulao' ? 2 : 1;
}

/** 价格。full 按缺血比例折算（missing 0–1），不低于小治价。 */
export function medicPrice(kind: MedicKind, chapter: number, missing = 1): number {
  const c = Math.max(1, Math.min(12, chapter));
  const g = Math.pow(MEDIC_GROWTH, c - 1), at = (k: MedicKind) => Math.round(CAMP_MEDIC[k].base * g + CAMP_MEDIC[k].perChapter * c);
  if (kind === 'small') return at('small');
  if (kind === 'army') return at('army');
  const full = at('full'), small = medicPrice('small', c);
  // 用户：「大治和小治区加区分价钱」——大治永远明显比小治贵（至少小治 ×1.8），缺血多时按缺血比例收到满价
  return Math.max(Math.round(small * 1.8), Math.round(full * Math.max(0, Math.min(1, missing))));
}
