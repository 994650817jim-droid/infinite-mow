import type {ChapterDef} from './chapters';
import type {EnemyDef} from './enemies';
import {getSishuiEncounter} from './sishui';
import {siegeBattle} from './siege';
import {FACTIONS, type CityDef} from '../world/WorldCities';
import type {IntelEvent} from '../world/WorldIntel';

/**
 * 军情事件战斗（WorldIntel.ts）：都以攻城战场为底（同一套西凉兵动作表按势力换色），不改首领与兵种数值体系。
 * - 流寇袭扰：小城两波（流寇 → 寇首，寇首为放大的精锐兵，无技能），黄巾余党配色；
 * - 名将悬赏：三波后名将出阵，借用第四章首领的招式与图集（按名将轮换三套；名将无专属图集前为过渡造型）；
 * - 商队护送：三波来袭、不出首领，商车抵达即胜（IntelGameScene 处理商车）。
 */
export const ESCORT = {hp: 100, distance: 1500, speed: 17, near: 220, raidRadius: 72, raidDps: 1.6, raidCap: 8, timeLimit: 200} as const;
/** 名将借用的首领招式组与图集（GuanduBoss 1 / 2 / 3）。 */
export function bountyKit(general: string): {stage: 1 | 2 | 3; atlas: string} {
  let h = 0; for (const ch of general) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const stage = ((h % 3) + 1) as 1 | 2 | 3;
  return {stage, atlas: ['guandu_yanliang', 'guandu_wenchou', 'guandu_chunyuqiong'][stage - 1]};
}

export function intelBattle(e: IntelEvent, city: CityDef): ChapterDef {
  const f = FACTIONS[e.faction]?.name ?? '敌军';
  if (e.kind === 'bandit') {
    const base = siegeBattle({...city, tier: 'small'}, 'yellow');
    return {
      ...base, name: `流寇 · ${city.name}`, label: `军情 · 流寇袭扰 · ${city.name}城郊`, description: `平定${city.name}流寇`,
      bossName: '流寇寇首', waves: [{name: '流寇袭扰', start: 0}, {name: '寇首现身', start: 45}], recruitWaves: [1],
      hpScale: t => base.hpScale(t) * .95,
      victoryTitle: '流寇平定', victoryText: `${city.name}城郊复归安宁 · 本季产出无损`,
    };
  }
  if (e.kind === 'bounty') {
    const base = siegeBattle({...city, tier: 'medium'}, e.faction), kit = bountyKit(e.general ?? '敌将');
    const boss: EnemyDef = {...getSishuiEncounter().enemies.boss, texture: kit.atlas, walkVisual: undefined, attackVisual: undefined, hp: 1400, speed: 50, damage: 11};
    return {
      ...base, name: `悬赏 · ${e.general}`, label: `军情 · 名将悬赏 · ${f}部将`, description: `击败${e.general}`,
      bossName: e.general ?? '敌将', waves: [{name: '游骑斥候', start: 0}, {name: '亲兵列阵', start: 45}, {name: `${e.general}出阵`, start: 90}], recruitWaves: [1, 2],
      enemies: {...base.enemies, boss},
      victoryTitle: `${e.general}败走`, victoryText: '悬赏告成 · 缴获名将兵装',
    };
  }
  const base = siegeBattle({...city, tier: 'small'}, 'han');
  return {
    ...base, name: `商队 · 往${city.name}`, label: `军情 · 商队护送 · 营寨 → ${city.name}`, description: `护送商队抵达${city.name}`,
    bossName: '山贼', waves: [{name: '商队启程', start: 0}, {name: '山贼拦路', start: 30}, {name: '半途伏兵', start: 60}], recruitWaves: [1, 2],
    hpScale: t => base.hpScale(t) * .85,
    pickEnemy: t => { const r = Math.random(); return t < 15 ? 'infantry' : r < .45 ? 'infantry' : r < .62 ? 'shield' : r < .76 ? 'archer' : 'cavalry'; },
    victoryTitle: '商队抵达', victoryText: `货物安然运抵${city.name} · 商税入库`,
  };
}
