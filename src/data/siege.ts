import {getSishuiEncounter} from './sishui';
import type {ChapterDef} from './chapters';
import type {EnemyDef} from './enemies';
import type {EnemyKind} from '../types';
import {FACTIONS, TIER_NAME, CITIES, type CityDef, type CityTier, type FactionId} from '../world/WorldCities';
import {factionKey} from '../systems/FactionPalette';

/**
 * 攻城战（WORLD_MAP_PLAN.md · W2）：按城市档位分三档。
 * W5 数值（多局自动测试后调低，2026-11-15 用户确认）。小城 2 波 → 县尉；中城 3 波 → 守将；大城 4 波 → 先破城门，再战势力大将（沿用第四章首领技能）。
 */
export interface SiegeTier {waves: readonly string[]; hpScale: number; boss: {hp: number; speed: number; damage: number; scale: number}; reward: {merits: number; provisions: number}; camps: number; gateHp: number;}
export const SIEGE: Record<CityTier, SiegeTier> = {
  small: {waves: ['城外守军', '县尉出阵'], hpScale: .65, boss: {hp: 380, speed: 52, damage: 8, scale: 1.25}, reward: {merits: 30, provisions: 60}, camps: 1, gateHp: 0},
  medium: {waves: ['城外守军', '城头弓阵', '守将出阵'], hpScale: .8, boss: {hp: 850, speed: 48, damage: 10, scale: 1.4}, reward: {merits: 60, provisions: 120}, camps: 2, gateHp: 0},
  large: {waves: ['城外营垒', '城头弓阵', '瓮城死守', '大将出城'], hpScale: .9, boss: {hp: 1700, speed: 50, damage: 12, scale: 1}, reward: {merits: 120, provisions: 240}, camps: 2, gateHp: 900},
};
/** 首次攻占额外奖励比例。 */
export const FIRST_CAPTURE_BONUS = .5;
/** 守将称谓。 */
export function siegeBossName(city: CityDef, owner: FactionId): string {
  const f = FACTIONS[owner].name;
  return city.tier === 'small' ? `${city.name}县尉` : city.tier === 'medium' ? `${f}守将` : `${f}大将`;
}
/** 大城大将借用第四章首领技能与图集（W5 前为过渡造型）：按城序轮换三套。 */
export function siegeLargeKit(city: CityDef): {stage: 1 | 2 | 3; atlas: string} {
  const i = CITIES.filter(c => c.tier === 'large').findIndex(c => c.id === city.id), stage = ((Math.max(0, i) % 3) + 1) as 1 | 2 | 3;
  return {stage, atlas: ['guandu_yanliang', 'guandu_wenchou', 'guandu_chunyuqiong'][stage - 1]};
}
/** 守军用到的西凉兵动作表（需按势力换色）。 */
export function siegeSourceKeys(): string[] { return [...new Set(Object.values(getSishuiEncounter().enemies).map(d => d.walkVisual?.texture).filter((k): k is string => !!k))]; }

export function siegeBattle(city: CityDef, owner: FactionId): ChapterDef {
  const base = getSishuiEncounter(), T = SIEGE[city.tier];
  const colored = Object.fromEntries(Object.entries(base.enemies).map(([k, def]) => [k, k === 'boss' || !def.walkVisual ? def : {...def, walkVisual: {...def.walkVisual, texture: factionKey(owner, def.walkVisual.texture)}}])) as Record<EnemyKind, EnemyDef>;
  // 中小城守将：精锐兵放大作首领（无特殊技能，近身肉搏）；大城：第四章首领图集
  const elite = colored.elite, boss: EnemyDef = city.tier === 'large'
    ? {...base.enemies.boss, texture: siegeLargeKit(city).atlas, walkVisual: undefined, attackVisual: undefined, hp: T.boss.hp, speed: T.boss.speed, damage: T.boss.damage}
    : {...elite, kind: 'boss', hp: T.boss.hp, speed: T.boss.speed, damage: T.boss.damage, xp: 30, radius: 26, walkVisual: elite.walkVisual ? {...elite.walkVisual, scale: elite.walkVisual.scale * T.boss.scale} : undefined};
  return {
    ...base,
    name: `攻城 · ${city.name}`, label: `${TIER_NAME[city.tier]} · ${city.region} · ${FACTIONS[owner].name}`, description: `攻取${city.name}`,
    bossName: siegeBossName(city, owner), bossStyle: 'siege', westStage: 3,
    waves: T.waves.map((name, i) => ({name, start: i * 45})), recruitWaves: city.tier === 'small' ? [1] : city.tier === 'medium' ? [1, 2] : [1, 2, 3],
    enemies: {...colored, boss},
    hpScale: t => base.hpScale(t) * T.hpScale,
    pickEnemy: t => { const r = Math.random(); return t < 20 ? 'infantry' : r < .38 ? 'infantry' : r < .58 ? 'shield' : r < .8 ? 'archer' : r < .94 ? 'cavalry' : 'elite'; },
    victoryTitle: `攻占${city.name}`, victoryText: `${city.name}归入义军版图`,
  };
}

/** W4 守城战：敌军来犯我方城池。波次同档位攻城战，无城门；胜利奖励为攻城的一半（WorldStore.settleDefense）。 */
const DEFENSE_WAVES: Record<CityTier, readonly string[]> = {
  small: ['敌军压境', '敌将叩关'],
  medium: ['敌军压境', '云梯攀城', '敌将叩关'],
  large: ['敌军压境', '云梯攀城', '冲车撞门', '敌军大将'],
};
export function defenseBossName(city: CityDef, attacker: FactionId): string {
  const f = FACTIONS[attacker].name;
  return city.tier === 'large' ? `${f}大将` : `${f}先锋`;
}
export function defenseBattle(city: CityDef, attacker: FactionId): ChapterDef {
  const base = siegeBattle(city, attacker);
  return {
    ...base,
    name: `守城 · ${city.name}`, label: `${TIER_NAME[city.tier]} · ${city.region} · ${FACTIONS[attacker].name}来犯`, description: `守住${city.name}`,
    bossName: defenseBossName(city, attacker), waves: DEFENSE_WAVES[city.tier].map((name, i) => ({name, start: i * 45})),
    victoryTitle: `${city.name}守住了`, victoryText: `击退${FACTIONS[attacker].name}，${city.name}转危为安`,
  };
}

/**
 * 攻城目标（用户 2026-11-16：「攻城战需要摧毁一些城市地标、首府或者占领」）：试玩初值，交平衡会话测。
 * 小城：拔掉帅旗 → 占领府衙；中城：摧毁两座箭楼（会放箭）→ 占领府衙；大城：破城门、摧毁箭楼、击败大将 → 占领府衙。
 * 占领：主将站进府衙圈内，进度涨满即破城；圈内有敌兵时进度变慢。守城战不变。
 */
export const SIEGE_GOALS = {
  flagHp: 220, towerHp: 320, towerShotMs: 2400, towerRange: 380, towerDamage: 7, towerArrowSpeed: 230,
  /** 府衙位置：小城在帅旗处，中大城在城门之后。 */
  capture: {x: 0, y: -720, smallY: -330, radius: 90, seconds: 6, contestedMul: .35},
  limit: {small: 150, medium: 210, large: 330} as Record<CityTier, number>,
} as const;
