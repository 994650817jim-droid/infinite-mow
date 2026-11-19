import type { SchoolId } from './schools';
import type { WeaponId } from '../types';

/**
 * 兵器专职（wave-progression-redesign.md §4.7，2026-11-19 用户「我想兵器专职或者兵器可以变种不同分支流派」「兵器专职分支要做」）：
 * 每位武将的本命武器两条分支（按亲和派）。本命 Lv5 且分支派任一到 2 势时，三选一出两张「兵器专职」卡二选一，本次征程锁定；
 * 第四章开放本命 Lv6、第八章 Lv7（沿分支加深）；Lv7 且该派 4 势进阶为最终形态。效果由 systems/WeaponBranches 驱动（挂在武器出手 / 命中 / 移动上，
 * 不改原武器逻辑），特效先用现有手绘序列帧换色。ready = 该武将的分支效果已实现（分批：赵关张刘 → 诸葛黄马魏 → 庞月孙貂）。
 */
export interface WeaponBranch {
  id: string; weapon: WeaponId; school: SchoolId; name: string;
  /** 专职卡说明（选定时的效果）。 */ desc: string;
  /** Lv6 / Lv7 卡说明。 */ lv6: string; lv7: string;
  /** 进阶形态（Lv7 + 该派 4 势）。 */ finalName: string; finalDesc: string;
  /** 卡面图标（branch_icon_<id>，没有时用武器图标）。 */ icon: string;
  ready: boolean;
}
const B = (weapon: WeaponId, id: string, school: SchoolId, name: string, desc: string, lv6: string, lv7: string, finalName: string, finalDesc: string, ready = false): WeaponBranch =>
  ({ id, weapon, school, name, desc, lv6, lv7, finalName, finalDesc, icon: 'branch_icon_' + id, ready });

export const WEAPON_BRANCHES: readonly WeaponBranch[] = [
  B('spear_orbit', 'zy_longdan', 'cavalry', '龙胆 · 七进七出', '出枪时带一次短冲刺穿过目标，沿途敌兵受创；冲刺中 0.25 秒无敌（每 3 秒一次）', '冲刺伤害 +30%、间隔缩短', '冲刺伤害再 +30%、间隔再缩短', '七进七出', '冲刺可连 3 次，路径留银白枪痕', true),
  B('spear_orbit', 'zy_bainiao', 'warrior', '百鸟朝凤', '每 6 秒一次 360° 连环枪风暴，重创身边一圈敌兵', '风暴伤害 +30%、更频繁', '风暴伤害再 +30%、更频繁', '百鸟朝凤 · 极', '风暴后把周围敌兵吸向身边、减速 2 秒', true),
  B('guandao', 'gy_qinglong', 'warrior', '青龙出水', '每次扇形斩额外放出一道向前穿透的青龙月牙', '月牙伤害 +30%', '月牙伤害再 +30%、飞得更远', '水淹七军', '月牙落地化水浪，沿路敌兵减速', true),
  B('guandao', 'gy_danqi', 'cavalry', '千里走单骑', '移动时身后留下刀痕带，敌兵踩上持续受创', '刀痕伤害 +30%', '刀痕伤害再 +30%、更长', '过五关', '每走一段路自动横扫一圈', true),
  B('dangyang_roar', 'zf_duanqiao', 'warrior', '据水断桥', '每次喝断在前方留一道断桥 3 秒，踏入的敌兵被震住', '断桥更宽、更久', '断桥再宽、再久', '当阳一吼', '断桥连精锐也震住 1 秒', true),
  B('dangyang_roar', 'zf_nuhou', 'formation', '燕人怒吼', '每次喝断后 5 秒部曲伤害 +20%，自身 3 秒受伤 −30%', '部曲加伤 +30%', '部曲加伤再提高、持续更久', '万人敌', '怒吼期间受击反震身边敌兵', true),
  B('shuanggu_swords', 'lb_rende', 'formation', '仁德', '每次命中治疗附近受伤的部曲；击杀时有几率召一名义勇随战 10 秒', '治疗 +30%、义勇几率提高', '治疗再提高、义勇几率再提高', '携民渡江', '义勇同时存在更多，存在时自身受伤 −10%', true),
  B('shuanggu_swords', 'lb_sanying', 'warrior', '三英', '命中时有几率追加第三剑，斩向附近另一名敌兵', '第三剑几率 +30%', '第三剑几率再提高、伤害提高', '桃园结义', '随行有关羽或张飞时三剑伤害再 +30%', true),
  B('flame_banner', 'zg_liaoyuan', 'fire', '天火燎原', '天火落点留下更大、更久的火场，火场会向相邻火场蔓延', '火场更大', '火场更久', '火烧博望', '火场连成一片时爆燃一次'),
  B('flame_banner', 'zg_bazhen', 'stratagem', '八阵生门', '星位变成八阵陷阱：敌兵踏入定身 1 秒，随后引爆', '陷阱更多', '定身更久', '八阵图', '同时布 8 个星位、连成阵图'),
  B('lianhuan_mines', 'pt_lianying', 'fire', '火烧连营', '火雷连锁时沿连线留下燃烧线', '燃烧线伤害提高', '燃烧线更长', '赤壁东风', '燃烧线随风向前推进'),
  B('lianhuan_mines', 'pt_lianhuan', 'stratagem', '连环计', '火雷把附近敌兵用锁链连在一起，打一个、连着的都掉血', '连锁人数 +2', '分摊比例提高', '铁索连舟', '连着的敌兵移动大减速'),
  B('baodiao_bow', 'hz_chuanyang', 'archery', '百步穿杨', '重箭穿透一整列，距离越远伤害越高', '远距加成提高', '必暴击', '定军山', '每第 5 箭对首领 / 副将额外重创'),
  B('baodiao_bow', 'hz_huoshi', 'fire', '火矢', '箭带火，命中处留下小火场', '火场更大', '火场更久', '老当益壮', '火场里的敌兵受箭伤 +30%'),
  B('crossbow', 'hy_liannu', 'archery', '诸葛连弩', '每轮多 2 支弩矢，弹射 +2', '再多 1 支', '弹射再 +1', '元戎', '弩矢命中时 20% 再分裂'),
  B('crossbow', 'hy_muniu', 'stratagem', '木牛流马', '每 10 秒放出一只木牛，自动射弩 8 秒', '木牛射得更快', '木牛更耐打', '机关术', '木牛同时 2 只，被打坏时爆炸'),
  B('sun_knives', 'ss_wanren', 'archery', '万刃', '环身飞刀每 3 秒向外齐射一轮', '齐射更频繁', '飞刀更多', '枭姬', '齐射的刀会折返再割一次'),
  B('sun_knives', 'ss_benxi', 'cavalry', '奔袭', '冲刺时身后撒下一路飞刀，结束时收回再割一次', '飞刀更多', '冲刺更频繁', '乘龙', '冲刺冷却 −30%'),
  B('diaochan_fans', 'dc_biyue', 'stratagem', '闭月', '团扇命中有几率魅惑敌兵 2 秒（反打身边敌兵）', '魅惑几率提高', '魅惑更久', '离间', '被魅惑的精锐会攻击首领'),
  B('diaochan_fans', 'dc_meirenji', 'formation', '连环美人计', '团扇飞过的路线留下舞圈 4 秒，圈内敌兵受伤 +20%', '舞圈更大', '易伤更高', '凤仪亭', '舞圈相交处每秒爆一次花'),
  B('zhanjin_lance', 'mc_tieqi', 'cavalry', '西凉铁骑', '挑飞时召一排虚影铁骑沿枪向冲过', '铁骑更多', '铁骑伤害提高', '锦马超', '铁骑踏过留下马蹄火痕'),
  B('zhanjin_lance', 'mc_weishui', 'warrior', '渭水大战', '落地砸击范围变大，被挑飞的敌兵砸到别人也造成伤害', '砸击更大', '连锁伤害提高', '割须弃袍', '砸地后 3 秒攻速 +30%'),
  B('zhenbei_blade', 'wy_ziwu', 'warrior', '子午谷奇兵', '地裂延长并在终点二次爆裂', '地裂更长', '二次爆裂更大', '反骨', '生命低于一半时地裂翻倍'),
  B('zhenbei_blade', 'wy_hanzhong', 'formation', '镇守汉中', '重劈处插下营栅区 5 秒：部曲在区内减伤、敌兵减速', '营栅区更大', '营栅区更久', '汉中太守', '营栅区可同时存在 2 处'),
];
export function branchesFor(weapon: WeaponId): WeaponBranch[] { return WEAPON_BRANCHES.filter(b => b.weapon === weapon); }
export function branchById(id: string | undefined): WeaponBranch | undefined { return id ? WEAPON_BRANCHES.find(b => b.id === id) : undefined; }
/** 本命 Lv6 / 7 的章节门槛（超出 Lv5 的级数上限）。 */
export const WEAPON_OVER = { cap: 0, capFor: (chapter: number): number => chapter >= 8 ? 2 : chapter >= 4 ? 1 : 0, damagePer: .1 };
/** 分支强度档：0 未选；1 选定；2 = Lv6；3 = Lv7。 */
export function branchTier(w: { branch?: string; over?: number }): number { return w.branch ? 1 + (w.over ?? 0) : 0; }
