/**
 * 战线推进（GameScene.advanceFrontline）：第 1、2 章的第 1、2 关（1-1、1-2、2-1、2-2：battleStage < 3 且没有 encounter）首领出场 bossMs 没打倒，
 * 首领变追兵跟进下一关，中间没有行营休整。第 3 关与第 3–12 章、攻城 / 军情 / 支线不走这条（它们靠首领阶段额度 + 震怒兜底，data/bossStall.ts）。
 * 喘息（总制作人新存档试玩 11-20：1-1 首领 90 秒没打死 → 直接进 1-2，血量不回、追兵跟着，新手基本必死）：
 * breather.chapters 里的章，推进那一刻回 heal 比例的生命、invulnMs 无敌（受击闪烁提示），横幅写「某某追来」。
 */
export const FRONTLINE = {
  /** 首领出场多少毫秒没打倒就战线推进。 */
  bossMs: 90000,
  /** 推进时的喘息：哪几章给（章序号）、回复生命上限的比例、无敌毫秒。 */
  breather: { chapters: [1] as readonly number[], heal: .3, invulnMs: 3000 },
} as const;

/** 这一章的战线推进给不给喘息；不给返回 null。 */
export function frontlineBreather(chapter: number): { heal: number; invulnMs: number } | null {
  return FRONTLINE.breather.chapters.includes(chapter) ? { heal: FRONTLINE.breather.heal, invulnMs: FRONTLINE.breather.invulnMs } : null;
}
