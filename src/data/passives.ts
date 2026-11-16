import type { CharacterId } from './characters';
export const CHARACTER_PASSIVES: Record<CharacterId, { name: string; maxStacks: number }> = {
  zhaoyun: { name: '七进七出', maxStacks: 7 },
  guanyu: { name: '势如破竹', maxStacks: 3 },
  huangzhong: { name: '老当益壮', maxStacks: 0 },
  zhuge: { name: '运筹帷幄', maxStacks: 3 },
  zhangfei: { name: '燕人咆哮', maxStacks: 5 },
  huangyueying: { name: '机关连弩', maxStacks: 8 },
  pangtong: { name: '连环计', maxStacks: 3 },
  liubei: { name: '仁德聚义', maxStacks: 4 },
  weiyan: { name: '长驱子午', maxStacks: 4 },
  machao: { name: '西凉铁骑', maxStacks: 6 },
};
export const PASSIVE_RULES = {
  dragonIntervalMs: 150, spearLengthMul: 1.25,
  coneThreshold: 3, guandaoRangePerStack: .06, guandaoDamageMul: 1.25,
  calmMs: 3000, critBonus: .10,
  chainDelayMs: 650, chainDamageMul: .75, chainRadiusMul: 1.15, mechIntervalMs: 250, mechBolts: 6, mechDamageMul: .6,
  weiyanDamageMul: 1.4, weiyanHeal: .05, liubeiDamageMul: 1.15, liubeiHeal: .08, liubeiRally: .35,
  cavalryIntervalMs: 300, dashLength: 150, dashWidth: 56, dashDamageMul: 1.6, dashMs: 200,
  roarIntervalMs: 350, roarRadius: 175, roarStunMs: 1200, roarDamageMul: 1.4,
  fireRadiusMul: 1.25, burnMs: 2000, burnTickMs: 1000, burnDamageFraction: .10,
} as const;
