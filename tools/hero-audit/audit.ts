// 全武将数值体检（静态，2026-11-21）：读真实数据表（武器 DEF / 被动常量 / 四维 / 等级曲线），用几何模型估每次出手命中的「伤害单位」，
// 算单体 DPS、30 / 80 敌清杂、有效生命。用法：node tools/hero-audit/build.mjs tools/hero-audit/audit.ts tools/hero-audit/audit.out.mjs && node tools/hero-audit/audit.out.mjs
// 模型假设（写进体检报告）：
//  - 敌兵均匀分布在主将身边半径 300 像素的圆里（30 敌 ρ≈1.06e-4 /px²，80 敌 ≈2.83e-4）；有目标的武器第一下必中。
//  - 首领 = 单一大目标：线 / 扇 / 圈每次都中，但没有「附带命中别人」。
//  - 被动 / 分支 / 武艺不进基础表，另算（见 passive 段）。全局三选一 / 兵装 / 本命 Lv6–7 对所有人一样，不计（只比相对）。
import { CHARACTERS } from '../../src/data/characters';
import { WEAPON_DEFS, GUANDAO_TABLE, SPEAR_PIERCE } from '../../src/weapons/registry';
import { HERO_STATS, statSource, statEffective, statMultiplier } from '../../src/data/heroStats';
import { primaryAttribute, attributePointsAt, vigorHp, ATTRIBUTE_EFFECT, PRIMARY_BONUS, PRIMARY_PERK, SPELL_WEAPONS, PRIMARY_TIERS } from '../../src/data/attributes';
import { suggestedLevel } from '../../src/systems/HeroProgress';
import { PASSIVE_RULES as R } from '../../src/data/passives';
import { ZG_TIANHUO as Z, LB_COMMAND } from '../../src/data/heroMechanics';
import { LVBU } from '../../src/data/lvbu'; import { ZHANGLIAO } from '../../src/data/zhangliao'; import { ZHOUYU } from '../../src/data/zhouyu';
import { TAISHICI } from '../../src/data/taishici'; import { MENGDE } from '../../src/data/mengde'; import { GANNING } from '../../src/data/ganning';
import { DIANWEI } from '../../src/data/dianwei'; import { SUNQUAN } from '../../src/data/sunquan'; import { MENGHUO } from '../../src/data/menghuo'; import { ZHURONG } from '../../src/data/zhurong';
import { BALANCE } from '../../src/config';

const STATS = { damageMul: 1, cooldownMul: 1, moveMul: 1, critChance: .05, regen: .25, pickupRadius: 95, armor: 0, maxHpBonus: 0, meleeMul: 1, arrowMul: 1, fireMul: 1, fireAreaMul: 1, damageTakenMul: 1 } as any;
const RD = 300, rho = (n: number) => n / (Math.PI * RD * RD);
const fan = (r: number, half: number) => half * r * r; // 扇面积（half = 半角弧度）
const circ = (r: number) => Math.PI * r * r;
const tgt = (n: number, a: number, cap = Infinity) => Math.min(cap, 1 + n * a); // 有目标：第一下必中 + 范围内其余
const area = (n: number, a: number, cap = Infinity) => Math.min(cap, Math.max(1, n * a)); // 落在人堆里的范围：至少 1
const rad = (deg: number) => deg * Math.PI / 180;
type Prof = { st: number; boss: number; crowd: (rho: number, am: number) => number; note?: string };
// 每次出手的伤害单位（× def.damage），l = 1..5，am = 范围倍率（面积按 am² 放大）
const P: Record<string, (l: number) => Prof> = {
  spear_orbit: l => { const s = SPEAR_PIERCE[l - 1]; return { st: Math.min(2, l), boss: Math.min(2, l), crowd: (p, am) => l * tgt(p, s.len * s.width * am * am, s.cap), note: `每次 ${l} 枪、每枪上限 ${s.cap}；同一敌人一轮最多 2 下` }; },
  guandao: l => { const g = GUANDAO_TABLE[l - 1]; return { st: 1, boss: 1, crowd: (p, am) => tgt(p, fan(g.radius, rad(g.angle) / 2) * am * am, 8), note: `扇 r${g.radius} ${g.angle}°，上限 8` }; },
  baodiao_bow: l => ({ st: 1, boss: R.heavyBossMul, crowd: (p, am) => 1 + R.heavyPierceMul * Math.min(R.heavyPierce, p * 300 * 30 * am), note: `锁定 1 人 + 穿 ${R.heavyPierce} 人 ×${R.heavyPierceMul}；首领 ×${R.heavyBossMul}` }),
  flame_banner: l => ({ st: 1 + 1 / (Z.starNeed + 1), boss: 1 + 1 / (Z.starNeed + 1), crowd: (p, am) => { const main = 1 + Z.crowdSplashMul * p * circ(Z.crowdSplashRadius) * am * am; const ember = area(p, circ(Z.ember.radius) * am * am) * Z.ember.mul * (Z.ember.ms / Z.ember.tickMs) * .6; return main * (1 + 1 / (Z.starNeed + 1)) + ember / (Z.starNeed + 1); }, note: `每第 ${Z.starNeed + 1} 发 ×${Z.burstMul} + 焦土 r${Z.ember.radius} ${Z.ember.ms / 1000}s（按敌兵 60% 时间留在里面）` }),
  dangyang_roar: l => { const half = rad(l >= 3 ? 45 : 35), max = l >= 5 ? 260 : 220; return { st: 1, boss: 1, crowd: (p, am) => area(p, fan(max * am, half)), note: `声浪 ${Math.round(half * 360 / Math.PI)}° 推到 ${max}` }; },
  zhanjin_lance: l => { const r = R.landRadius * (1 + (l >= 3 ? .1 : 0)); return { st: R.liftHitMul + 1, boss: R.liftHitMul + 1, crowd: (p, am) => R.liftHitMul + tgt(p, circ(r) * am * am), note: `挑 ×${R.liftHitMul} + 落地 r${Math.round(r)}` }; },
  zhenbei_blade: l => { const n = l >= 5 ? 3 : l >= 3 ? 2 : 1; return { st: 1 + (R.crackCloseMul - 1) * .5, boss: R.crackCloseMul, crowd: (p, am) => n * tgt(p, R.crackLen * R.crackWidth * am) * 1.05, note: `${n} 道裂波 ${R.crackLen}×${R.crackWidth} 穿透全部；贴身 ×${R.crackCloseMul}` }; },
  shuanggu_swords: l => { const r = R.crossSplash + (l >= 3 ? 10 : 0); return { st: 2, boss: 2, crowd: (p, am) => 2 * (1 + R.crossSplashMul * p * circ(r) * am * am), note: `两剑分打两人，各溅 r${r} ×${R.crossSplashMul}` }; },
  lianhuan_mines: l => { const r = R.mineRadius * (1 + .05 * (l - 1)); return { st: 1, boss: 1, crowd: (p, am) => area(p, circ(r) * am * am), note: `每次放 1 颗雷 r${Math.round(r)}` }; },
  crossbow: l => { const b = Math.min(4, 2 + Math.floor((l - 1) / 2)), x = l - 1; return { st: 1, boss: 1 + .7 * x, crowd: () => (1 + .7 * x) * (1 + b), note: `1 + ${x} 支 ×0.7，每支弹 ${b} 次不衰减` }; },
  sun_knives: l => { const c = R.knifeCountByLevel[l - 1], pc = R.knifePierceByLevel[l - 1], orb = l >= 5 ? 4 : l >= 3 ? 3 : 2, od = [10, 11, 12, 13, 15][l - 1] / [16, 19, 23, 28, 35][l - 1];
    // 移动中掷刀间隔 ×0.7（风筝时几乎一直在动）：按 1/0.85 折入；环刀每把每 0.5 秒割一次，按 25% 时间贴身
    const mv = 1 / (.5 + .5 * R.knifeMovingCdMul), orbit = orb * od * (1000 / R.knifeOrbitHitMs) * .25 * WEAPON_DEFS.sun_knives.cooldown(l, STATS);
    return { st: mv * 1 + orbit, boss: mv * 1 + orbit, crowd: (p, am) => mv * (1 + R.knifeExtraMul * (c - 1)) * tgt(p, R.knifeRange * 20 * am, pc) + orbit * Math.max(1, p * circ(R.knifeOrbitR + 20) * 2), note: `掷 ${c} 把（多的 ×${R.knifeExtraMul}）穿 ${pc}；环刀 ${orb} 把；移动中间隔 ×${R.knifeMovingCdMul}` }; },
  diaochan_fans: l => { const c = l >= 5 ? 3 : l >= 3 ? 2 : 1; return { st: 2, boss: 2 * c, crowd: (p, am) => c * 2 * tgt(p, R.fanRange * am * 40), note: `${c} 柄扇、去回各一下（路宽按 40）` }; },
  fangtian_ji: l => { const L = LVBU.thrustLen[l - 1], r = LVBU.sweepRadius[l - 1]; return { st: (2 + LVBU.sweepMul) / 3, boss: (2 + LVBU.sweepMul) / 3, crowd: (p, am) => (2 * tgt(p, L * LVBU.thrustWidth * am) + LVBU.sweepMul * area(p, circ(r) * am * am)) / 3, note: `突 ${L}×${LVBU.thrustWidth} ×2 → 横扫 r${r} ×${LVBU.sweepMul}` }; },
  pozhen_shuangji: l => { const r = ZHANGLIAO.reach[l - 1]; return { st: 1, boss: 1, crowd: (p, am) => tgt(p, fan(r, ZHANGLIAO.arc) * am * am), note: `扇 r${r} 半角 ${Math.round(ZHANGLIAO.arc * 180 / Math.PI)}°` }; },
  huochuan_ling: l => { const b = ZHOUYU.blast[l - 1], fr = b * ZHOUYU.fieldR, tick = ZHOUYU.tickMul * ZHOUYU.fieldMs / ZHOUYU.tickMs; return { st: ZHOUYU.ships + tick * .5 * ZHOUYU.ships, boss: (ZHOUYU.ships + tick) * ZHOUYU.bossMul, crowd: (p, am) => ZHOUYU.ships * tgt(p, circ(b) * am * am) + ZHOUYU.ships * area(p, circ(fr) * am * am) * tick * .6, note: `${ZHOUYU.ships} 船爆 r${b}、火场 r${Math.round(fr)} ${ZHOUYU.fieldMs / 1000}s；首领 ×${ZHOUYU.bossMul}` }; },
  donglai_ji: l => { const r = TAISHICI.reach[l - 1], e = 1 / TAISHICI.throwEvery; return { st: 1 + e * TAISHICI.throwMul, boss: 1 + e * TAISHICI.throwMul, crowd: (p, am) => tgt(p, fan(r, TAISHICI.arc) * am * am) + e * TAISHICI.throwMul * tgt(p, TAISHICI.throwRange * .75 * TAISHICI.throwW * am), note: `扇 r${r}；每第 ${TAISHICI.throwEvery} 击短戟 ×${TAISHICI.throwMul}` }; },
  yitian_jian: l => { const r = MENGDE.reach[l - 1], v = 1 + MENGDE.markVuln; return { st: v, boss: v, crowd: (p, am) => v * tgt(p, fan(r, MENGDE.arc) * am * am), note: `扇 r${r}；军令易伤 +${MENGDE.markVuln * 100}%（算进本人）` }; },
  jinfan_gou: l => { const L = GANNING.reach[l - 1], r = GANNING.sweepR[l - 1], fire = GANNING.fire.mul * GANNING.fire.ms / GANNING.fire.tickMs / GANNING.hotEvery;
    return { st: GANNING.hookMul + GANNING.sweepMul + fire * .5, boss: (GANNING.hookMul + GANNING.sweepMul) * GANNING.bossMul + fire * .5, crowd: (p, am) => { const h = tgt(p, L * GANNING.width * am); return GANNING.hookMul * h + GANNING.sweepMul * (h + p * circ(r) * am * am) + fire * area(p, L * 84 * am) * .6; }, note: `钩 ${L}×${GANNING.width} ×${GANNING.hookMul} 拉回 + 横扫 r${r}；每第 ${GANNING.hotEvery} 钩留火；首领 ×${GANNING.bossMul}` }; },
  shuang_tieji: l => { const r = DIANWEI.whirlR[l - 1], e = 1 / DIANWEI.whirlEvery; return { st: DIANWEI.throws * DIANWEI.throwMul * .75 + e * DIANWEI.whirlMul, boss: DIANWEI.throws * DIANWEI.throwMul + e * DIANWEI.whirlMul, crowd: (p, am) => DIANWEI.throws * DIANWEI.throwMul * tgt(p, DIANWEI.throwRange * .75 * DIANWEI.throwW * am) + e * DIANWEI.whirlMul * area(p, circ(r) * am * am), note: `掷 ${DIANWEI.throws} 戟 ×${DIANWEI.throwMul} 穿透；每第 ${DIANWEI.whirlEvery} 击旋风 r${r}` }; },
  guding_dao: l => { const r = SUNQUAN.reach[l - 1], e = 1 / SUNQUAN.volleyEvery; return { st: SUNQUAN.slashMul + e * SUNQUAN.volleyMul, boss: SUNQUAN.slashMul + e * SUNQUAN.volleyMul, crowd: (p, am) => SUNQUAN.slashMul * tgt(p, fan(r, SUNQUAN.arc) * am * am) + e * SUNQUAN.volleyMul * area(p * 1.3, circ(SUNQUAN.volleyR) * am * am), note: `扇 r${r}；每第 ${SUNQUAN.volleyEvery} 斩齐射 r${SUNQUAN.volleyR}（打最密处）` }; },
  nanman_dao: l => { const r = MENGHUO.reach[l - 1]; return { st: MENGHUO.cleaveMul + MENGHUO.crackMul, boss: (MENGHUO.cleaveMul + MENGHUO.crackMul) * MENGHUO.bossMul, crowd: (p, am) => MENGHUO.cleaveMul * tgt(p, fan(r, MENGHUO.arc) * am * am) + MENGHUO.crackMul * area(p, MENGHUO.crackLen * MENGHUO.crackW * am), note: `劈 r${r} ×${MENGHUO.cleaveMul} + 裂地 ${MENGHUO.crackLen}×${MENGHUO.crackW} ×${MENGHUO.crackMul}；首领 ×${MENGHUO.bossMul}` }; },
  huoyan_feiqiang: l => { const fire = ZHURONG.fire.mul * ZHURONG.fire.ms / ZHURONG.fire.tickMs, e = 1 / ZHURONG.fanEvery;
    return { st: ZHURONG.spearMul + fire * .5 + e * ZHURONG.knifeMul * 1.5, boss: (ZHURONG.spearMul + e * ZHURONG.knifeMul * 2) * ZHURONG.bossMul + fire, crowd: (p, am) => ZHURONG.spearMul * tgt(p, ZHURONG.spearRange * ZHURONG.spearW * am) + fire * area(p, ZHURONG.spearRange * .75 * ZHURONG.fire.r * 2 * am) * .6 + e * ZHURONG.fan * ZHURONG.knifeMul * tgt(p, ZHURONG.knifeRange * ZHURONG.knifeW * am) * .7, note: `火枪 ${ZHURONG.spearRange}×${ZHURONG.spearW} ×${ZHURONG.spearMul} 穿透 + 火线；每第 ${ZHURONG.fanEvery} 掷 ${ZHURONG.fan} 把飞刀` }; },
};

const GROUP: Record<string, 'melee' | 'ranged' | 'strat'> = { zhaoyun: 'melee', guanyu: 'melee', zhangfei: 'melee', machao: 'melee', weiyan: 'melee', liubei: 'melee', lvbu: 'melee', zhangliao: 'melee', taishici: 'melee', mengde: 'melee', ganning: 'melee', dianwei: 'melee', sunquan: 'melee', menghuo: 'melee',
  huangzhong: 'ranged', sunshangxiang: 'ranged', zhurong: 'ranged', huangyueying: 'strat',
  zhuge: 'strat', pangtong: 'strat', diaochan: 'strat', zhouyu: 'strat' };

type Alloc = Partial<Record<'strength' | 'agility' | 'intellect' | 'command', number>>;
function attr(hero: string, weapon: string, L: number, alloc: Alloc) {
  const src = statSource(hero), pts = (id: any) => statEffective(src, id, alloc[id as keyof Alloc] ?? 0, L), prim = primaryAttribute(hero)!, raw = alloc[prim] ?? 0, tier = PRIMARY_TIERS.filter(n => raw >= n).length;
  const spell = SPELL_WEAPONS.has(weapon);
  const dmg = (1 + ATTRIBUTE_EFFECT.strength.damage * pts('strength')) * (1 + Math.min(PRIMARY_BONUS.maxPoints, raw) * PRIMARY_BONUS.perPoint);
  const spellMul = spell ? 1 + ATTRIBUTE_EFFECT.intellect.skill * pts('intellect') : 1;
  const zhugeRaw = weapon === 'flame_banner' ? 1 + Z.intPerPoint * (alloc.intellect ?? 0) : 1;
  const spd = Math.min(1.8, 1 + ATTRIBUTE_EFFECT.agility.attackSpeed * pts('agility'));
  let crit = STATS.critChance + Math.min(.1, ATTRIBUTE_EFFECT.agility.crit * pts('agility'));
  let perk = 1, perkBoss = 1, cdPerk = 1, areaPerk = 1;
  if (prim === 'strength') { if (tier >= 2) perk *= 1 + (PRIMARY_PERK.strength.crushMul - 1) / PRIMARY_PERK.strength.crushEvery; if (tier >= 3) perkBoss *= 1 + PRIMARY_PERK.strength.eliteMul; }
  if (prim === 'agility') { if (tier >= 2) crit += PRIMARY_PERK.agility.crit; if (tier >= 3) perk *= 1 + PRIMARY_PERK.agility.haste * .6; }
  if (prim === 'intellect' && spell) { if (tier >= 1) cdPerk = 1 / (1 - PRIMARY_PERK.intellect.cooldown); if (tier >= 2) perk *= 1 + PRIMARY_PERK.intellect.echoChance; }
  if (prim === 'intellect' && tier >= 3) areaPerk = 1 + PRIMARY_PERK.intellect.area;
  const critMul = 1 + crit * (BALANCE.critMultiplier - 1);
  const am = (1 + ATTRIBUTE_EFFECT.intellect.area * pts('intellect')) * areaPerk;
  const total = dmg * spellMul * zhugeRaw * spd * critMul * perk * cdPerk;
  const hp = BALANCE.player.maxHp * (1 + ATTRIBUTE_EFFECT.strength.hp * pts('strength')) + vigorHp(L);
  return { total, boss: total * perkBoss, am, hp, parts: { dmg, spellMul, zhugeRaw, spd, critMul, perk, cdPerk } };
}
const allIn = (hero: string, L: number, id?: string): Alloc => ({ [id ?? primaryAttribute(hero)!]: attributePointsAt(L) });

const LEVELS = [{ tag: 'Lv1', L: 1, wl: 1 }, { tag: '第4章', L: suggestedLevel(4, 2), wl: 5 }, { tag: '第8章', L: suggestedLevel(8, 2), wl: 5 }, { tag: '第12章', L: suggestedLevel(12, 2), wl: 5 }];
const rows: any[] = [];
for (const c of CHARACTERS) {
  const w = c.startWeapon, d = (WEAPON_DEFS as any)[w], row: any = { id: c.id, name: c.name, w, grp: GROUP[c.id], prim: primaryAttribute(c.id), hpMul: c.hpMul, spd: c.speedMul, dmgMul: c.damageMul, base: HERO_STATS[c.id].base.join('/'), at: {} };
  for (const lv of LEVELS) {
    const pr = P[w](lv.wl), a = attr(c.id, w, lv.L, lv.L === 1 ? {} : allIn(c.id, lv.L)), dmg = d.damage(lv.wl, STATS) * c.damageMul, cd = d.cooldown(lv.wl, STATS);
    const k = a.total * dmg / cd;
    row.at[lv.tag] = { st: k * pr.st, boss: k * pr.boss * (a.boss / a.total), c30: k * pr.crowd(rho(30), a.am), c80: k * pr.crowd(rho(80), a.am), hp: a.hp + 100 * (c.hpMul - 1), attr: a.total, note: pr.note, L: lv.L, pts: attributePointsAt(lv.L) };
  }
  // 四维：全加主属性 vs 全加力量 / 全加敏捷（第 8 章）
  const L8 = suggestedLevel(8, 2), alt: any = {};
  for (const id of ['strength', 'agility', 'intellect', 'command']) alt[id] = +attr(c.id, w, L8, allIn(c.id, L8, id)).total.toFixed(3);
  row.alt8 = alt; row.zero8 = +attr(c.id, w, L8, {}).total.toFixed(3);
  row.mult = Object.fromEntries(['strength', 'agility', 'intellect', 'command'].map(id => [id, statMultiplier(statSource(c.id), id as any)]));
  rows.push(row);
}
console.log(JSON.stringify({ levels: LEVELS, rows, lb: LB_COMMAND }, null, 0));
