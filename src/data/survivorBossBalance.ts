import type { EnemyDef } from './enemies';

/** Only GauntletGameScene opts in. Story bosses retain their original damage and timing. */
export const SURVIVOR_BOSS_BALANCE = {
  fixedSkillBaseDamage: 11,
  fixedSkillMaxMultiplier: 2.5,
  durabilityFromWave: 2,
  hpMultipliers: { xurong: 1.25, zhangxiu: 1.15 } as Readonly<Record<string, number>>,
} as const;

export function survivorBossHp(id: string, wave: number, baseHp: number): number {
  return Math.round(baseHp * (wave >= SURVIVOR_BOSS_BALANCE.durabilityFromWave
    ? SURVIVOR_BOSS_BALANCE.hpMultipliers[id] ?? 1 : 1));
}

export function survivorBossProfile(id: string, baseDamage: number): NonNullable<EnemyDef['survivorBoss']> {
  const ratio = Number.isFinite(baseDamage) ? baseDamage / SURVIVOR_BOSS_BALANCE.fixedSkillBaseDamage : 1;
  return { fixedSkillMul: Math.max(1, Math.min(SURVIVOR_BOSS_BALANCE.fixedSkillMaxMultiplier, ratio)), phase2Signature: id === 'zhangjiao' };
}

/** Fixed-value native skills only. Never apply to def.damage-based moves or max-HP strikes. */
export function fixedBossDamage(def: Pick<EnemyDef, 'survivorBoss'>, damage: number): number {
  return damage * (def.survivorBoss?.fixedSkillMul ?? 1);
}
