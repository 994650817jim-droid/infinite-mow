/**
 * 名将连战 · 每阵杂兵（用户 11-21「兵种质量从第一章的兵到最后的兵，从弱到强」；表在 data/gauntlet.ts GAUNTLET_TROOPS，交接表在共享笔记 gauntlet-v1.md）。
 * 每阵借一章一关的敌人定义（兵种、外形含各章换色、出兵配比照搬），生命 / 伤害按表折算：本阵步卒折到 infHp / infDmg，其余兵种按同一倍率；
 * 再按兵种单调——每类兵至少比上一阵强 4%（生命）/ 2%（伤害）。重兵（象兵这类，生命 ≥ 本阵步卒 3 倍的非精锐）不进单调链：
 * 它本身照样不弱于上一阵同类，但下一阵的同类兵不必追上它（第十阵的魏军骑兵不必比南中象兵还厚）。
 * 名将的亲兵用他自己那一章的兵（外形 / 配比），强度按本阵折算。
 */
import { getBattleChapter, type ChapterDef } from './chapters';
import type { EnemyDef } from './enemies';
import { arcPalette, repaintChapter, thirdBattle } from './thirdChapter';
import { guanduBattle } from './guanduChapter';
import { chibiBattle } from './chibiChapter';
import { jingnanBattle } from './jingnanChapter';
import { shuBattle } from './shuChapter';
import { hanzhongBattle } from './hanzhongChapter';
import { xiangfanBattle } from './xiangfanChapter';
import { yilingBattle } from './yilingChapter';
import { nanzhengBattle } from './nanzhengChapter';
import { beifaBattle } from './beifaChapter';
import { waveTroops, type GauntletArc, type GauntletTroops } from './gauntlet';

/** 各篇是第几章（「名将来投」按本阵兵种那一章的时代出人）。 */
export const ARC_CHAPTER: Readonly<Record<GauntletArc, number>> = { huangjin: 1, hulao: 2, qunxiong: 3, guandu: 4, chibi: 5, jingnan: 6, shu: 7, hanzhong: 8, xiangfan: 9, yiling: 10, nanzheng: 11, beifa: 12 };
export const TROOP_KINDS = ['infantry', 'shield', 'archer', 'cavalry', 'elite'] as const;
export type TroopKind = typeof TROOP_KINDS[number];
/** 单调链：每阵每类兵至少比上一阵强多少。 */
export const TROOP_STEP = { hp: 1.04, dmg: 1.02 } as const;

/** 某章某关的战斗定义（敌人已换成该章配色：借第三章底兵的各篇把换色键换成本篇的）。 */
export function troopChapter(arc: GauntletArc, stage: number): ChapterDef {
  const s = Math.max(1, Math.min(3, Math.floor(stage))) as 1 | 2 | 3;
  let c: ChapterDef;
  switch (arc) {
    case 'huangjin': c = getBattleChapter('huangjin', s); break;
    case 'hulao': c = getBattleChapter('hulao', 1, s); break;
    case 'qunxiong': c = thirdBattle(s); break;
    case 'guandu': c = guanduBattle(s); break;
    case 'chibi': c = chibiBattle(s); break;
    case 'jingnan': c = jingnanBattle(s); break;
    case 'shu': c = shuBattle(s); break;
    case 'hanzhong': c = hanzhongBattle(s); break;
    case 'xiangfan': c = xiangfanBattle(s); break;
    case 'yiling': c = yilingBattle(s); break;
    case 'nanzheng': c = nanzhengBattle(s); break;
    case 'beifa': c = beifaBattle(s); break;
  }
  const p = arcPalette(arc, s); return p ? repaintChapter(c, p) : c;
}
/** 这一章的兵要用到的图键（行走 / 攻击 / 静态，不含首领）。 */
export function troopTextures(c: ChapterDef): string[] {
  const out = new Set<string>();
  for (const [k, d] of Object.entries(c.enemies)) if (k !== 'boss') for (const t of [d.walkVisual?.texture, d.texture, d.attackVisual]) if (t) out.add(t);
  return [...out];
}

export interface WaveTroopSet {
  /** 第几阵、表里这一阵的条目、借的那一章的战斗定义（出兵配比用它的 pickEnemy）。 */
  wave: number; troops: GauntletTroops; chapter: ChapterDef;
  /** 折算后的五类兵；heavy = 重兵（不进单调链）。 */
  defs: Record<TroopKind, EnemyDef>; heavy: Record<TroopKind, boolean>;
}
const cache = new Map<number, { set: WaveTroopSet; chain: Record<TroopKind, { hp: number; damage: number }> }>();
function build(n: number): { set: WaveTroopSet; chain: Record<TroopKind, { hp: number; damage: number }> } {
  const hit = cache.get(n); if (hit) return hit;
  const prev = n > 1 ? build(n - 1).chain : null, t = waveTroops(n), c = troopChapter(t.arc, t.stage), inf = c.enemies.infantry, look = t.look ? troopChapter(t.look.arc, t.look.stage) : null;
  const fh = t.infHp / inf.hp, fd = t.infDmg / inf.damage;
  const defs = {} as Record<TroopKind, EnemyDef>, heavy = {} as Record<TroopKind, boolean>, chain = {} as Record<TroopKind, { hp: number; damage: number }>;
  for (const k of TROOP_KINDS) {
    const d = c.enemies[k], h = k !== 'elite' && k !== 'infantry' && d.hp >= inf.hp * 3;
    let hp = d.hp * fh, dmg = d.damage * fd;
    if (prev) { hp = Math.max(hp, prev[k].hp * TROOP_STEP.hp); dmg = Math.max(dmg, prev[k].damage * TROOP_STEP.dmg); }
    const lk = look && t.look?.kinds.includes(k) ? look.enemies[k] : null; // 换外形：只换图 / 攻击图 / 染色
    defs[k] = { ...d, ...(lk ? { texture: lk.texture, walkVisual: lk.walkVisual, attackVisual: lk.attackVisual, tint: lk.tint } : {}), hp: Math.round(hp), damage: Math.round(dmg * 10) / 10 }; heavy[k] = h;
    chain[k] = h && prev ? prev[k] : { hp: defs[k].hp, damage: defs[k].damage };
  }
  const out = { set: { wave: n, troops: t, chapter: c, defs, heavy }, chain };
  cache.set(n, out); return out;
}
/** 第 n 阵的杂兵（无尽同样：最后三阵的兵种轮换，强度接着涨）。 */
export function waveTroopSet(n: number): WaveTroopSet { return build(Math.max(1, Math.floor(n))).set; }
/** 名将的亲兵：用他那一章的兵（外形 / 配比），生命 / 伤害按本阵步卒折算。 */
export function guardDef(arc: GauntletArc, stage: number, kind: TroopKind, wave: number): EnemyDef {
  const w = waveTroopSet(wave), c = troopChapter(arc, stage), inf = c.enemies.infantry, d = c.enemies[kind];
  return { ...d, hp: Math.round(Math.max(d.hp * w.defs.infantry.hp / inf.hp, kind === 'elite' ? w.defs.elite.hp * .8 : 0)), damage: Math.round(d.damage * w.defs.infantry.damage / inf.damage * 10) / 10 };
}
