/**
 * 战线推进（GameScene.advanceFrontline）：只对 FRONTLINE.stages 列出的主线关生效（现为 1-1、2-1、2-2；没有 encounter）——首领出场 bossMs 没打倒，
 * 首领变追兵跟进下一关，中间没有行营休整。其余关（1-2、各章第 3 关、第 3–12 章、攻城 / 军情 / 支线）不推进，靠首领阶段额度 + 震怒兜底（data/bossStall.ts）。
 * 1-2 不推进（2026-11-22 总制作人派单、用户批准）：平衡实测张宝 90 秒没打倒时被直接带进第一章收尾 1-3，没有整军、只回 30%，开局二三十秒就倒；
 * 现在 1-2 和第 3 关一样走额度 + 震怒，打完正常回营进 1-3。1-1 推进进 1-2 时，1-1 首领照旧变追兵（追兵不震怒）。
 * 喘息（总制作人新存档试玩 11-20：1-1 首领 90 秒没打死 → 直接进 1-2，血量不回、追兵跟着，新手基本必死）：
 * breather.chapters 里的章，推进那一刻回 heal 比例的生命、invulnMs 无敌（受击闪烁提示），横幅写「某某追来」。
 */
export const FRONTLINE = {
  /** 首领出场多少毫秒没打倒就战线推进。 */
  bossMs: 90000,
  /** 哪些关战线推进（键「章-关」，同 data/bossStall.ts 的 stages）。 */
  stages: ['1-1', '2-1', '2-2'] as readonly string[],
  /** 推进时的喘息：哪几章给（章序号）、回复生命上限的比例、无敌毫秒。 */
  breather: { chapters: [1] as readonly number[], heal: .3, invulnMs: 3000 },
} as const;

/** 这一关（主线第 chapter 章第 stage 关）首领久战不下时是否战线推进。 */
export function frontlineStage(chapter: number, stage: number): boolean { return FRONTLINE.stages.includes(`${chapter}-${stage}`); }

/** 这一章的战线推进给不给喘息；不给返回 null。 */
export function frontlineBreather(chapter: number): { heal: number; invulnMs: number } | null {
  return FRONTLINE.breather.chapters.includes(chapter) ? { heal: FRONTLINE.breather.heal, invulnMs: FRONTLINE.breather.invulnMs } : null;
}
