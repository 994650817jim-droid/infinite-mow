/**
 * 军阵（共享笔记 formation-design.md；用户 11-20「我想加入军阵系统」→「全按推荐」）。
 * 部曲与随从按阵型站位，护阵（E）时阵势生效；出击时散阵，各阵有自己的出击打法。出征前在行营「布阵」选主阵 / 备阵，战斗中按 X 变阵（有冷却）。
 * - 军阵不进三选一卡池、不算势、不占主修两派；「呼应」只读主修（主修兵阵 = 所有阵都呼应），主效果 ×echoMul。
 * - 主将擅长的阵（HERO_FORMATION）主效果再 ×favoredMul。主效果合计封顶 mainCap（平衡会话跑模拟再调）。
 * - 入阵人数 = slotsBase + slotsPerCommand × 统御；超出的士兵照常作战、站后军、不吃阵势。
 * - 学会哪些阵按主线进度（mechanicUnlocks：formation / f_snake / f_crane / f_geese），不另存档；八阵 = 诸葛亮主将专属，诸葛亮随行时他人半效。
 * 数值都是初值，交平衡会话。
 */
import type { SchoolId } from './schools';
import { mechOpen } from './mechanicUnlocks';

export type FormationId = 'circle' | 'wedge' | 'crane' | 'geese' | 'snake' | 'bazhen';
export const FORMATION_IDS: readonly FormationId[] = ['circle', 'wedge', 'crane', 'geese', 'snake', 'bazhen'];

export interface FormationDef {
  name: string; /** 一字简称（增益图标角标、小地图） */ short: string; role: string;
  /** 呼应流派：是主修之一（或主修兵阵）时主效果 ×echoMul。 */ echo: SchoolId;
  main: string; cost: string; hero: string; sortie: string;
  /** 护阵拴绳（像素，原来 260）：阵形要看得出来，士兵离位追敌的距离收紧。 */ leash: number;
}
export const FORMATIONS: Readonly<Record<FormationId, FormationDef>> = {
  circle: { name: '方圆阵', short: '圆', role: '守', echo: 'formation', leash: 150,
    main: '部曲 / 随从受伤 −20%', cost: '部曲伤害 −10%、移速 −10%', hero: '主将受伤 −8%', sortie: '出击：外圈向四周推开一圈（击退、减速 1 秒）' },
  wedge: { name: '锋矢阵', short: '矢', role: '突', echo: 'cavalry', leash: 220,
    main: '部曲打正前方的敌人伤害 +15%', cost: '部曲受伤 +10%', hero: '主将移速 +6%', sortie: '出击：全队沿朝向直线冲锋，穿透撞退（冷却 6 秒）' },
  crane: { name: '鹤翼阵', short: '翼', role: '包抄', echo: 'stratagem', leash: 220,
    main: '被两侧夹击的敌人受伤 +20%；部曲攻击范围 +20%', cost: '部曲受伤 +10%（中军空虚）', hero: '—', sortie: '出击：两翼向敌人最密处合拢包抄' },
  geese: { name: '雁行阵', short: '雁', role: '射', echo: 'archery', leash: 190,
    main: '远程部曲伤害 +20%、射程 +20%', cost: '近战部曲伤害 −15%', hero: '主将武器范围 +5%', sortie: '出击：远程朝敌人最密处齐射三轮' },
  snake: { name: '长蛇阵', short: '蛇', role: '机动', echo: 'cavalry', leash: 220,
    main: '绕击：蛇身路过的敌人，每名士兵每 1.2 秒顺手一击；部曲 / 随从移速 +25%', cost: '部曲伤害 −10%', hero: '主将移速 +5%', sortie: '出击：蛇身沿来路反卷回去' },
  bazhen: { name: '八阵', short: '八', role: '困', echo: 'stratagem', leash: 220,
    main: '阵内敌人减速 15%，每 4 秒困住一个（眩晕 1.2 秒）；部曲伤害 +10%、受伤 −10%', cost: '换入后 3 秒才成阵', hero: '技艺「八阵图」范围 +25%', sortie: '出击：八队向阵心合围' },
};

/** 名将擅阵（主效果 ×favoredMul）。 */
export const HERO_FORMATION: Readonly<Record<string, FormationId>> = {
  liubei: 'circle', zhangfei: 'circle', mengde: 'circle', weiyan: 'wedge', guanyu: 'wedge', lvbu: 'wedge', machao: 'wedge', zhangliao: 'wedge',
  zhaoyun: 'snake', sunshangxiang: 'snake', zhuge: 'bazhen', pangtong: 'crane', zhouyu: 'crane', diaochan: 'crane',
  huangzhong: 'geese', taishici: 'geese', huangyueying: 'geese',
};

/** 数值（初值，交平衡会话）。 */
export const FORMATION = {
  switchMs: 15000, switchMsFormation: 9000, settleMs: 1000, bazhenSettleMs: 3000,
  slotsBase: 8, slotsPerCommand: 2,
  echoMul: 1.5, favoredMul: 1.25, halfMul: .5,
  /** 主效果（受伤减免 / 伤害加成）封顶。 */ mainCap: .3,
  spacing: 38,
  // 方圆减伤单独封顶 cap（平衡会话复核 11-20：它和练兵甲胄、统御、铁壁都相乘，又基本常驻），呼应 / 擅阵叠满也不超过 −25%
  circle: { taken: .2, cap: .25, heroTaken: .08, dmg: -.1, speed: -.1, pushR: 70, push: 46, slowMs: 1000, slow: .6 },
  wedge: { front: .15, arcDeg: 60, heroMove: .06, taken: .1, chargeDist: 300, chargeMs: 650, chargeCd: 6000, chargeHit: .6, chargePush: 38 },
  crane: { pincer: .2, range: .2, taken: .1, pincerR: 120, flankMs: 1200 },
  geese: { ranged: .2, range: .2, melee: -.15, heroRange: .05, volleys: 3, volleyGapMs: 450, volleyR: 90 },
  snake: { grazeMs: 1200, grazeR: 44, graze: .5, speed: .25, heroMove: .05, dmg: -.1, trailStep: 14, gap: 30, lead: 56 },
  bazhen: { r: 200, slow: .15, trapMs: 4000, stunMs: 1200, dmg: .1, taken: .1, eightRange: .25, ring: 118 },
} as const;

/** 学会了哪些阵（按主线进度；?dev=1 全开）。八阵：诸葛亮主将专属；诸葛亮随行时他人可用（半效）。 */
export function formationsKnown(hero: string, followerHeroes: readonly string[] = []): FormationId[] {
  if (!mechOpen('formation')) return [];
  const out: FormationId[] = ['circle', 'wedge'];
  if (mechOpen('f_crane')) out.push('crane');
  if (mechOpen('f_geese')) out.push('geese');
  if (mechOpen('f_snake')) out.push('snake');
  if (hero === 'zhuge' || followerHeroes.includes('zhuge')) out.push('bazhen');
  return out;
}
/** 八阵半效（主将不是诸葛亮、靠诸葛亮随行）。 */
export function formationHalf(id: FormationId, hero: string): boolean { return id === 'bazhen' && hero !== 'zhuge'; }

const LOADOUT_KEY = 'im_formation_loadout';
function readAll(): Record<string, string[]> { try { return JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '{}') as Record<string, string[]>; } catch { return {}; } }
/** 某主将的主阵 / 备阵（只取学会了的；没选过 = 擅阵优先，再按 FORMATION_IDS 顺序）。返回 0–2 个不重复的阵。 */
export function formationLoadout(hero: string, known: readonly FormationId[]): FormationId[] {
  const saved = (readAll()[hero] ?? []).filter((x): x is FormationId => known.includes(x as FormationId));
  const fav = HERO_FORMATION[hero], order = [...(fav && known.includes(fav) ? [fav] : []), ...FORMATION_IDS.filter(x => known.includes(x))];
  const out: FormationId[] = [];
  for (const x of [...saved, ...order]) if (!out.includes(x) && out.length < 2) out.push(x);
  return out;
}
/** 布阵：slot 0 = 主阵、1 = 备阵；和另一格相同就对调。 */
export function setFormationLoadout(hero: string, slot: 0 | 1, id: FormationId, known: readonly FormationId[]): FormationId[] {
  const cur = formationLoadout(hero, known), out = [...cur];
  if (out[1 - slot] === id) out[1 - slot] = out[slot];
  out[slot] = id;
  const all = readAll(); all[hero] = out.filter(Boolean); try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return formationLoadout(hero, known);
}
/** 入阵人数。 */
export function formationSlots(command: number): number { return FORMATION.slotsBase + FORMATION.slotsPerCommand * Math.max(0, Math.floor(command)); }
/** 主效果倍率：呼应 ×1.5、擅阵 ×1.25、八阵半效 ×0.5。 */
export function formationPower(id: FormationId, hero: string, majors: readonly SchoolId[]): { mul: number; echo: boolean; favored: boolean; half: boolean } {
  const echo = majors.includes(FORMATIONS[id].echo) || majors.includes('formation'), favored = HERO_FORMATION[hero] === id, half = formationHalf(id, hero);
  return { mul: (echo ? FORMATION.echoMul : 1) * (favored ? FORMATION.favoredMul : 1) * (half ? FORMATION.halfMul : 1), echo, favored, half };
}
/** 变阵冷却（主修兵阵更短）。 */
export function formationSwitchMs(majors: readonly SchoolId[]): number { return majors.includes('formation') ? FORMATION.switchMsFormation : FORMATION.switchMs; }
