/**
 * 战法六大流派（2026-11-19 用户：「我想重做流派系统…太没用了，也没什么联动」→ 设计稿 tactic-schools-redesign.md，用户「流派同意」）。
 * - 流派：火攻 / 奇谋 / 弓弩 / 骑突 / 猛将 / 兵阵，每派 4 个战法（data/builds.ts TACTICS 的 tag）。
 * - 「势」= 本派战法等级之和 + 武将亲和（第一亲和派开局 +1）+ 随行（每名按兵种 +1，最多 +2）+ 机制类信物（每件 +1）+ 橙色名马（骑突 +1）。
 * - 档位：2 势加成、4 势新机制（数值在 SCHOOL_TIER）；6 势觉醒、合击在第 2 期接（AWAKEN / COMBOS）。
 * 数值为开发期初值，平衡会话再调。
 */
import type { CharacterId } from './characters';
import type { FollowerTemplate } from './recruits';

export type SchoolId = 'fire' | 'stratagem' | 'archery' | 'cavalry' | 'warrior' | 'formation';
export const SCHOOL_IDS: readonly SchoolId[] = ['fire', 'stratagem', 'archery', 'cavalry', 'warrior', 'formation'];

export interface SchoolDef {
  name: string; short: string; color: number; css: string;
  /** 第 1 期没有流派朱印图：先借本派代表战法的图标。 */
  icon: string;
  fantasy: string;
  tiers: { 2: { name: string; desc: string }; 4: { name: string; desc: string }; 6: { name: string; desc: string } };
}
export const SCHOOLS: Readonly<Record<SchoolId, SchoolDef>> = {
  fire: { name: '火攻', short: '火', color: 0xd0532a, css: '#e0683c', icon: 'build_icon_ember', fantasy: '点火、火区、火越烧越大',
    tiers: { 2: { name: '火势', desc: '灼烧多烧 1 秒，你的火伤 +15%' }, 4: { name: '燎原', desc: '燃烧的敌人死时爆开一团火，点燃附近 2 人' }, 6: { name: '火烧连天', desc: '觉醒：火浪横扫全屏，点燃并重创普通敌人' } } },
  stratagem: { name: '奇谋', short: '谋', color: 0x5b6db8, css: '#8b9de0', icon: 'build_icon_traction', fantasy: '减速、拉拽、眩晕、风',
    tiers: { 2: { name: '牵制', desc: '减速 +10 点；被控制的敌人受伤 +10%' }, 4: { name: '乱阵', desc: '每第 3 次控制附带 0.6 秒眩晕；精锐也吃满控制' }, 6: { name: '八门金锁', desc: '觉醒：在怪最密处布阵，阵里敌人反复眩晕、受伤加深' } } },
  archery: { name: '弓弩', short: '弓', color: 0x3f9a6e, css: '#6cc79a', icon: 'build_icon_eagle', fantasy: '暴击、穿透、破甲',
    tiers: { 2: { name: '神射', desc: '暴击率 +8%，暴击伤害 +20%' }, 4: { name: '破甲穿云', desc: '暴击必破甲（受伤 +15%，3 秒），并溅射旁边 1 人' }, 6: { name: '万箭齐发', desc: '觉醒：怪最密处落三波箭雨，中箭的全部破甲' } } },
  cavalry: { name: '骑突', short: '骑', color: 0xc89a3a, css: '#e6be5e', icon: 'build_icon_windstep', fantasy: '跑起来就强、冲撞、击退',
    tiers: { 2: { name: '疾驰', desc: '移速 +10%，冲势攒得快 50%' }, 4: { name: '冲阵', desc: '攒满冲势的一击震退一圈，周围敌人吃 50% 溅射' }, 6: { name: '单骑突阵', desc: '觉醒：铁骑幻影沿朝向横扫一条长线，冲锋中无敌' } } },
  warrior: { name: '猛将', short: '猛', color: 0xa62a2a, css: '#d85a4a', icon: 'build_icon_chain', fantasy: '连击叠层、重击震荡、越打越猛',
    tiers: { 2: { name: '鏖战', desc: '连打同一敌人每次 +2%，最多 8 层' }, 4: { name: '震荡', desc: '每第 6 次命中放一圈冲击波：震退、眩晕 0.3 秒' }, 6: { name: '横扫千军', desc: '觉醒：连续猛攻后进入狂斗，攻速大增、每击带冲击波' } } },
  formation: { name: '兵阵', short: '阵', color: 0x8a6a3a, css: '#c8a46a', icon: 'build_icon_coordination', fantasy: '部曲、随行、召兵、护阵',
    tiers: { 2: { name: '军势', desc: '部曲 / 随行伤害 +15%、受伤 -10%' }, 4: { name: '援军', desc: '每 12 秒从后方冲来 3 名义军助战 10 秒' }, 6: { name: '铁壁军阵', desc: '觉醒：全军结阵无敌并嘲讽，随后一起冲杀' } } },
};
export const TIER_STEPS = [2, 4, 6] as const;
/** 当前达到的档位（0 / 2 / 4 / 6）。 */
export function tierOf(shi: number): 0 | 2 | 4 | 6 { return shi >= 6 ? 6 : shi >= 4 ? 4 : shi >= 2 ? 2 : 0; }

/** 档位数值（第 1 期：2 / 4 势）。冲势槽满 = chargeFull 世界像素（约 6 个身位）。 */
export const SCHOOL_TIER = {
  chargeFull: 240,
  fire: { burnExtraMs: 1000, fireDmg: .15, liaoyuanTargets: 2, liaoyuanRatio: .4, liaoyuanR: 85 },
  stratagem: { slowAdd: .10, controlledTaken: .10, stunEvery: 3, stunMs: 600 },
  archery: { crit: .08, critDmg: .20, sunder: .15, sunderMs: 3000, splashRatio: .4, splashR: 70 },
  cavalry: { move: .10, chargeGain: 1.5, ringR: 85, push: 42, splash: .5, targets: 4 },
  warrior: { stackPct: .02, stackCap: 8, every: 6, r: 90, ratio: .3, targets: 5, stunMs: 300, push: 30 },
  formation: { allyDmg: .15, allyTaken: .10, everyMs: 12000, n: 3, lifeMs: 10000 },
} as const;

/** 武将亲和（偏向，不锁死）：第一亲和派开局 +1 势；亲和派战法出现率 ×affinityWeight。 */
export const HERO_AFFINITY: Readonly<Record<CharacterId, readonly SchoolId[]>> = {
  zhuge: ['fire', 'stratagem'], pangtong: ['fire', 'stratagem'],
  zhaoyun: ['cavalry', 'warrior'], machao: ['cavalry'], guanyu: ['warrior', 'cavalry'],
  zhangfei: ['warrior', 'formation'], weiyan: ['warrior', 'formation'],
  huangzhong: ['archery'], huangyueying: ['archery', 'stratagem'], sunshangxiang: ['archery', 'cavalry'],
  diaochan: ['stratagem', 'formation'], liubei: ['formation'],
};
export function heroAffinity(hero: string): readonly SchoolId[] { return (HERO_AFFINITY as Record<string, readonly SchoolId[]>)[hero] ?? []; }
/** 随行按兵种算势（每名 +1，全部随行合计最多 followerCap）。 */
export const FOLLOWER_SCHOOL: Readonly<Record<FollowerTemplate, SchoolId>> = { blade: 'warrior', spear: 'formation', bow: 'archery', strategist: 'stratagem' };
export const SHI_SOURCES = { affinityStart: 1, followerCap: 2, orangeMount: 1 } as const;

/** 三选一：每张战法卡权重 1 + min(weightMax, 势 × weightPer)，亲和派再 × affinityWeight；有一派到 specialtyAt 势后，两张战法卡里必有一张是势最高那派的。 */
export const OFFER = { weightPer: .3, weightMax: 2, affinityWeight: 1.5, specialtyAt: 2, tacticCards: 2 } as const;
/** 军需商人：战法卷轴优先出势最高的两派（权重 ×topWeight）。 */
export const MERCHANT_SCHOOL = { topWeight: 3 } as const;
/** 第 1 期没有新图的战法借现有图标（第 3 期出新图后删掉对应项）。 */
export const TACTIC_ICON_ALIAS: Readonly<Record<string, string>> = { napalm: 'wildfire_lamp', gust: 'control_disk' };
