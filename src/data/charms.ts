/**
 * 信物库扩充（2026-11-17 用户确认：本局遗物 + 本局宝物都并进信物库；数值见共享笔记 relic-to-token-proposal.md「最终转换表」）。
 * 信物仍是 'token' 栏的普通兵装：每件 = 一条固定效果（按品质取值，下表）+ 品质规定的随机小词条（白 1 … 橙 3）。
 * - 属性类（原本局遗物基础 6 件，火油 + 火折子合并为火油囊）：白～橙都出，白 / 绿 / 蓝 / 紫 / 橙 = 原值 × 0.36 / 0.46 / 0.61 / 0.79 / 1.0。
 * - 传奇类（原流派传奇 3 件）：只出紫 / 橙。
 * - 机制类（原构筑宝物 13 件 + 护心镜）：只出蓝 / 紫 / 橙，主数值 = 原值 × 0.8 / 0.9 / 1.0，冷却取倒数；回生玉佩、护心镜只出紫 / 橙。
 *   机制类开局注入 build.treasures（仍计原构筑标签、参与觉醒），各流派系统按 build.treasurePower 缩放数值。
 * 删除：酒壶（与玉佩 / 香囊重复）、疾风靴（与战靴移速重复）。虎符并入「虎钮印」（友军伤害主词条上限提到 +20%）。
 * 同流派 2 件（无双 / 神射 / 烈焰 / 铁壁）触发原套装。效果实现见 systems/CharmEffects.ts。
 */
import { TAG_NAMES, type BuildTag, type TreasureId } from './builds';
import type { ItemQuality } from './items';

export type CharmSchool = 'wushuang' | 'shenshe' | 'lieyan' | 'tiebi';
export const CHARM_SCHOOL_NAMES: Record<CharmSchool, string> = { wushuang: '无双', shenshe: '神射', lieyan: '烈焰', tiebi: '铁壁' };
/** 同流派 2 件套效果（原数值）。 */
export const CHARM_SET_DESC: Record<CharmSchool, string> = { wushuang: '近战伤害 +8%', shenshe: '箭类伤害 +8%', lieyan: '火焰伤害 +10%', tiebi: '生命上限 +10%' };

export type CharmKind = 'stat' | 'legend' | 'mech';
export interface CharmDef {
  id: string; name: string; kind: CharmKind; icon: string;
  /** 套装流派（原本局遗物）。 */
  school?: CharmSchool;
  /** 构筑标签（原构筑宝物 / 护心镜）：计入流派件数。 */
  tag?: BuildTag;
  /** 机制类：对应的构筑宝物（开局注入 build.treasures）。 */
  treasure?: TreasureId;
  /** 能出的最低品质。 */
  minQuality: ItemQuality;
  /** 按品质的说明（白 → 橙，品质不出的为空）。 */
  desc: (q: ItemQuality) => string;
}

const Q: readonly ItemQuality[] = ['white', 'green', 'blue', 'purple', 'orange'];
const qi = (q: ItemQuality) => Q.indexOf(q);
/** 属性类倍率（白 → 橙）。 */
export const STAT_FACTOR = [.36, .46, .61, .79, 1] as const;
/** 机制类倍率（蓝 / 紫 / 橙；白绿不出，按蓝算）。 */
export function mechPower(q: ItemQuality): number { return q === 'orange' ? 1 : q === 'purple' ? .9 : .8; }
export function statFactor(q: ItemQuality): number { return STAT_FACTOR[qi(q)]; }
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}秒`;

/** 属性类信物的原值（橙）。 */
export const CHARM_STAT = {
  charm_whetstone: { damage: .08 }, charm_drum: { cooldown: .06 }, charm_ring: { crit: .05 }, charm_quiver: { arrow: .12 },
  charm_guard: { reduce: .08 }, charm_oil: { fire: .12, fireArea: .05 },
} as const;
/** 传奇类：紫 / 橙两档。 */
export const CHARM_LEGEND = {
  charm_human_seal: { damage: [.09, .12], every: [14, 12], targets: [3, 4] },
  charm_heaven_ember: { fire: [.11, .15], cd: [6000, 5000] },
  charm_army_jade: { reduce: [.07, .10], heal: [.75, 1] },
} as const;
export const legendTier = (q: ItemQuality) => q === 'orange' ? 1 : 0;
/** 护心镜：紫 / 橙受伤 −13.5% / −15%。 */
export const HEART_MIRROR = [.135, .15] as const;
/** 回生玉佩：紫 / 橙无敌 0.8 / 1 秒（蓝不出）。 */
export const REVIVAL_INVULN = [800, 1000] as const;

const stat = (id: keyof typeof CHARM_STAT, name: string, icon: string, school: CharmSchool, text: (f: number) => string): CharmDef =>
  ({ id, name, kind: 'stat', icon, school, minQuality: 'white', desc: q => text(statFactor(q)) });
const mech = (treasure: TreasureId, name: string, tag: BuildTag, text: (p: number) => string, minQuality: ItemQuality = 'blue'): CharmDef =>
  ({ id: 'charm_' + treasure, name, kind: 'mech', icon: 'build_icon_' + treasure, tag, treasure, minQuality, desc: q => text(mechPower(q)) });

export const CHARMS: readonly CharmDef[] = [
  // A. 原本局遗物
  stat('charm_whetstone', '磨刀石', 'item_whetstone', 'wushuang', f => `武器伤害 +${pct(.08 * f)}`),
  stat('charm_drum', '战鼓', 'item_drum', 'wushuang', f => `武器冷却 −${pct(.06 * f)}`),
  stat('charm_ring', '鹰眼扳指', 'item_ring', 'shenshe', f => `暴击率 +${pct(.05 * f)}`),
  stat('charm_quiver', '羽箭囊', 'item_quiver', 'shenshe', f => `箭类伤害 +${pct(.12 * f)}`),
  stat('charm_guard', '护身甲片', 'item_armor', 'tiebi', f => `受到伤害 −${pct(.08 * f)}`),
  stat('charm_oil', '火油囊', 'item_oil', 'lieyan', f => `火焰伤害 +${pct(.12 * f)}，火焰范围 +${pct(.05 * f)}`),
  { id: 'charm_human_seal', name: '人公将印', kind: 'legend', icon: 'item_drum', school: 'wushuang', minQuality: 'purple',
    desc: q => { const t = legendTier(q), d = CHARM_LEGEND.charm_human_seal; return `伤害 +${pct(d.damage[t])}；每命中 ${d.every[t]} 次，震击附近最多 ${d.targets[t]} 名敌人`; } },
  { id: 'charm_heaven_ember', name: '赤霄火珠', kind: 'legend', icon: 'item_torch', school: 'lieyan', minQuality: 'purple',
    desc: q => { const t = legendTier(q), d = CHARM_LEGEND.charm_heaven_ember; return `火焰伤害 +${pct(d.fire[t])}；武器命中时生成残火，每 ${sec(d.cd[t])}一次`; } },
  { id: 'charm_army_jade', name: '护军玉璧', kind: 'legend', icon: 'item_armor', school: 'tiebi', minQuality: 'purple',
    desc: q => { const t = legendTier(q), d = CHARM_LEGEND.charm_army_jade; return `受到伤害 −${pct(d.reduce[t])}；击杀时为自己和受伤友军回复生命（原量 ${pct(d.heal[t])}，每秒一次）`; } },
  // B. 原本局宝物（构筑宝物 13 件 + 护心镜）
  mech('iron_mirror', '玄铁镜', 'bulwark', p => `格挡后反震额外 +${pct(.25 * p)}；未学反震时反击 3 人 ${pct(.2 * p)}，并提供 ${pct(.15 * p)} 基础格挡（冷却 8 秒）`),
  mech('army_seal', '守军印', 'bulwark', p => `守望多保护 1 人、减伤再 +${Math.round(10 * p * 10) / 10} 个百分点；单独触发为附近 2 人提供 ${pct(.15 + .1 * p)} 减伤（冷却 5 秒）`),
  mech('general_tally', '点将符', 'command', p => `命中后指挥附近 2 名士兵集火该目标 ${sec(2000 * p)}；已学协击时多指挥 1 人、集火再延长 ${sec(1000 * p)}`),
  mech('return_drum', '回军鼓', 'command', p => `每 ${sec(6000 / p)}治疗附近 2 名最低生命士兵 5% 最大生命，受治疗者 2.5 秒减伤 20%`),
  mech('control_disk', '镇军盘', 'control', p => `命中处生成阵法 1.8 秒，阵内最多 6 名普通敌人减速 ${pct(.25 * p)} 并被吸向阵心；冷却 ${sec(6000 / p)}，首领免疫`),
  mech('stored_jade', '沉锋玉', 'charge', p => `蓄势 2 秒后的命中释放弱冲击，0.25 秒后再冲击一次；每次 ${pct(.15 * p)} 伤害，最多 3 人，冷却 4 秒`),
  mech('soul_bell', '追魂铃', 'combo', p => `每 8 次本命命中，追击另一目标，造成 ${pct(.4 * p)} 伤害`),
  mech('slayer_tally', '斩将虎符', 'critical', p => `对精锐 / 首领暴击后追加 ${pct(.25 * p)} 基础伤害；每 0.5 秒一次`),
  mech('horse_order', '走马令', 'skirmish', p => `主动移动约 4 个身位后，下次命中对周围敌人追加 ${pct(.25 * p)} 伤害`),
  mech('wildfire_lamp', '燎原灯', 'flame', p => `命中必定附加弱灼烧（${pct(p)} 强度）；燃烧的敌人死亡时点燃附近 2 人，传出去的火不再传`),
  mech('breaker_jade', '破军佩', 'combo', p => `每 10 次本命命中，震击目标附近 3 人，造成 ${pct(.35 * p)} 伤害`),
  { id: 'charm_revival_jade', name: '回生玉佩', kind: 'mech', icon: 'build_icon_revival_jade', tag: 'skirmish', treasure: 'revival_jade', minQuality: 'purple',
    desc: q => `每关首次致命伤害保留 1 生命，并获得 ${sec(REVIVAL_INVULN[legendTier(q)])}无敌` },
  mech('blood_jade', '饮血佩', 'bulwark', p => `本命武器命中时，回复造成伤害的 ${pct(.05 * p)} 生命；每秒最多回复最大生命的 3%`),
  { id: 'charm_heart_mirror', name: '护心镜', kind: 'mech', icon: 'growth_icon_heart_mirror', tag: 'bulwark', minQuality: 'purple',
    desc: q => `武将受到伤害 −${pct(HEART_MIRROR[legendTier(q)])}` },
];
const BY_ID = new Map(CHARMS.map(c => [c.id, c]));
export function charmDef(base: string): CharmDef | undefined { return BY_ID.get(base); }
export function charmAllowed(def: CharmDef, q: ItemQuality): boolean { return qi(q) >= qi(def.minQuality); }
/** 这一品质能出的信物。 */
export function charmsFor(q: ItemQuality): CharmDef[] { return CHARMS.filter(c => charmAllowed(c, q)); }

/** 旧档里的本局宝物 / 饰品 → 信物底子（迁移用）。疾风靴已删除，返回 null（调用方换随机信物）。虎符并入虎钮印。 */
export function charmForLegacy(id: string): string | null {
  if (id === 'tiger_tally') return 'tiger_seal';
  if (id === 'heart_mirror') return 'charm_heart_mirror';
  if (id === 'wind_boots' || id === 'wine') return null;
  const c = BY_ID.get('charm_' + id); return c ? c.id : null;
}
/** 信物效果说明（行囊详情卡、悬停提示用），不是信物库新信物时为 undefined。 */
export function charmText(item: { base: string; quality: ItemQuality }): string | undefined {
  const tag = BASE_TOKEN_TAG[item.base]; if (tag) return `◆ 计入${TAG_NAMES[tag]}流派 1 件（虎符并入）`;
  const d = BY_ID.get(item.base); if (!d) return undefined;
  const extra = d.tag ? `（计入${TAG_NAMES[d.tag]}流派 1 件）` : d.school ? `（${CHARM_SCHOOL_NAMES[d.school]}：同流派 2 件 ${CHARM_SET_DESC[d.school]}）` : '';
  return `◆ ${d.desc(item.quality)}${extra}`;
}
/** 虎钮印（并入虎符）主词条倍率：橙色友军伤害最高 +20%（普通词条最高约 +9.7%）。 */
export const TIGER_SEAL_PRIMARY = 2.07;
/** 额外计入构筑标签的普通信物（虎钮印并入虎符后计统御）。 */
export const BASE_TOKEN_TAG: Partial<Record<string, BuildTag>> = { tiger_seal: 'command' };
