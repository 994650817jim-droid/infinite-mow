import type { TroopKind } from './legion';
export const GAUNTLET_RECRUIT = {
  per: 3, base: 60, perWave: 10,
  tiers: [
    { upTo: 3, kinds: ['swordsman', 'spearman'], level: 1 },
    { upTo: 6, kinds: ['swordsman', 'spearman', 'archer', 'guardian'], level: 2 },
    { upTo: Infinity, kinds: ['spearman', 'archer', 'guardian', 'rider', 'halberdier'], level: 3 },
  ] as ReadonlyArray<{ upTo: number; kinds: readonly TroopKind[]; level: number }>,
} as const;
export function recruitTier(wave: number): { upTo: number; kinds: readonly TroopKind[]; level: number } { return GAUNTLET_RECRUIT.tiers.find(t => wave <= t.upTo) ?? GAUNTLET_RECRUIT.tiers[GAUNTLET_RECRUIT.tiers.length - 1]; }
export function recruitCost(wave: number): number { return GAUNTLET_RECRUIT.base + GAUNTLET_RECRUIT.perWave * Math.max(1, Math.floor(wave)); }
