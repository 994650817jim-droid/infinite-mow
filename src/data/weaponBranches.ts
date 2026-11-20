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
  B('spear_orbit', 'zy_longdan', 'cavalry', '龙胆 · 七进七出', '每 3 秒出枪带一次短冲刺\n沿途敌兵受创\n冲刺中无敌 0.25 秒', '冲刺伤害 +30%、间隔缩短', '冲刺伤害再 +30%、间隔再缩短', '七进七出', '冲刺可连 3 次，路径留银白枪痕', true),
  B('spear_orbit', 'zy_bainiao', 'warrior', '百鸟朝凤', '每 6 秒一次 360° 枪风暴\n重创身边一圈敌兵', '风暴伤害 +30%、更频繁', '风暴伤害再 +30%、更频繁', '百鸟朝凤 · 极', '风暴后把周围敌兵吸向身边、减速 2 秒', true),
  B('guandao', 'gy_qinglong', 'warrior', '青龙出水', '每次扇形斩，额外放出\n一道向前穿透的青龙月牙', '月牙伤害 +30%', '月牙伤害再 +30%、飞得更远', '水淹七军', '月牙落地化水浪，沿路敌兵减速', true),
  B('guandao', 'gy_danqi', 'cavalry', '千里走单骑', '移动时身后留下刀痕带\n敌兵踩上持续受创', '刀痕伤害 +30%', '刀痕伤害再 +30%、更长', '过五关', '每走一段路自动横扫一圈', true),
  B('dangyang_roar', 'zf_duanqiao', 'warrior', '据水断桥', '每次喝断，前方留断桥 3 秒\n踏入的敌兵被震住', '断桥更宽、更久', '断桥再宽、再久', '当阳一吼', '断桥连精锐也震住 1 秒', true),
  B('dangyang_roar', 'zf_nuhou', 'formation', '燕人怒吼', '喝断后 5 秒部曲伤害 +20%\n自身 3 秒受伤 −30%', '部曲加伤 +30%', '部曲加伤再提高、持续更久', '万人敌', '怒吼期间受击反震身边敌兵', true),
  B('shuanggu_swords', 'lb_rende', 'formation', '仁德', '命中时治疗附近受伤部曲\n击杀有几率召义勇随战 10 秒', '治疗 +30%、义勇几率提高', '治疗再提高、义勇几率再提高', '携民渡江', '义勇同时存在更多，存在时自身受伤 −10%', true),
  B('shuanggu_swords', 'lb_sanying', 'warrior', '三英', '命中有几率追加第三剑\n斩向附近另一名敌兵', '第三剑几率 +30%', '第三剑几率再提高、伤害提高', '桃园结义', '随行有关羽或张飞时三剑伤害再 +30%', true),
  B('flame_banner', 'zg_liaoyuan', 'fire', '天火燎原', '天火落点留下更大、更久的火场，火场会向相邻火场蔓延', '火场更大', '火场更久', '火烧博望', '火场连成一片时爆燃一次', true),
  B('flame_banner', 'zg_bazhen', 'stratagem', '八阵生门', '星位变成八阵陷阱：敌兵踏入定身 1 秒，随后引爆', '陷阱更多', '定身更久', '八阵图', '同时布 8 个星位、连成阵图', true),
  B('lianhuan_mines', 'pt_lianying', 'fire', '火烧连营', '火雷连锁时沿连线留下燃烧线', '燃烧线伤害提高', '燃烧线更长', '赤壁东风', '燃烧线随风向前推进', true),
  B('lianhuan_mines', 'pt_lianhuan', 'stratagem', '连环计', '火雷把附近敌兵用锁链连在一起，打一个、连着的都掉血', '连锁人数 +2', '分摊比例提高', '铁索连舟', '连着的敌兵移动大减速', true),
  B('baodiao_bow', 'hz_chuanyang', 'archery', '百步穿杨', '重箭穿透一整列，距离越远伤害越高', '远距加成提高', '必暴击', '定军山', '每第 5 箭对首领 / 副将额外重创', true),
  B('baodiao_bow', 'hz_huoshi', 'fire', '火矢', '箭带火，命中处留下小火场', '火场更大', '火场更久', '老当益壮', '火场里的敌兵受箭伤 +30%', true),
  B('crossbow', 'hy_liannu', 'archery', '诸葛连弩', '每轮多 2 支弩矢，弹射 +2', '再多 1 支', '弹射再 +1', '元戎', '弩矢命中时 20% 再分裂', true),
  B('crossbow', 'hy_muniu', 'stratagem', '木牛流马', '每 10 秒放出一只木牛，自动射弩 8 秒', '木牛射得更快', '木牛更耐打', '机关术', '木牛同时 2 只，被打坏时爆炸', true),
  B('sun_knives', 'ss_wanren', 'archery', '万刃', '环身飞刀每 3 秒向外齐射一轮', '齐射更频繁', '飞刀更多', '枭姬', '齐射的刀会折返再割一次', true),
  B('sun_knives', 'ss_benxi', 'cavalry', '奔袭', '走动时身后撒下一路飞刀，每 2.5 秒或撒满 8 把就收回，飞回途中一路再割', '飞刀更多', '冲刺更频繁', '乘龙', '冲刺冷却 −30%', true),
  B('diaochan_fans', 'dc_biyue', 'stratagem', '闭月', '团扇命中有几率魅惑敌兵 2 秒（反打身边敌兵）', '魅惑几率提高', '魅惑更久', '离间', '被魅惑的精锐会攻击首领', true),
  B('diaochan_fans', 'dc_meirenji', 'formation', '连环美人计', '团扇飞过的路线留下舞圈 4 秒，圈内敌兵受伤 +20%', '舞圈更大', '易伤更高', '凤仪亭', '舞圈相交处每秒爆一次花', true),
  B('zhanjin_lance', 'mc_tieqi', 'cavalry', '西凉铁骑', '挑飞时召一排虚影铁骑沿枪向冲过', '铁骑更多', '铁骑伤害提高', '锦马超', '铁骑踏过留下马蹄火痕', true),
  B('zhanjin_lance', 'mc_weishui', 'warrior', '渭水大战', '落地砸击范围变大，被挑飞的敌兵砸到别人也造成伤害', '砸击更大', '连锁伤害提高', '割须弃袍', '砸地后 3 秒攻速 +30%', true),
  B('zhenbei_blade', 'wy_ziwu', 'warrior', '子午谷奇兵', '地裂延长并在终点二次爆裂', '地裂更长', '二次爆裂更大', '反骨', '生命低于一半时地裂翻倍', true),
  B('zhenbei_blade', 'wy_hanzhong', 'formation', '镇守汉中', '重劈处插下营栅区 5 秒：部曲在区内减伤、敌兵减速', '营栅区更大', '营栅区更久', '汉中太守', '营栅区可同时存在 2 处', true),
  // P2 吕布（效果在 weapons/lvbuWeapon.ts 里结算）
  B('fangtian_ji', 'lb_renzhong', 'warrior', '人中吕布', '横扫变旋戟风暴：转两圈、范围更大\n无双狂暴中每次击杀延长狂暴 0.4 秒', '风暴伤害 +30%', '风暴伤害再 +30%', '无双', '狂暴中击杀延长 0.8 秒、旋戟转三圈', true),
  // P2 曹操（效果在 weapons/mengdeWeapon.ts 里结算）
  B('yitian_jian', 'cc_xietianzi', 'formation', '挟天子以令诸侯', '每 8 秒插令旗成阵地 6 秒：\n阵内部曲攻速 +25%、每秒回血 2%', '部曲攻速加成提高', '部曲攻速加成再提高', '魏王', '阵地范围 +30%', true),
  B('yitian_jian', 'cc_hubao', 'cavalry', '虎豹骑', '奸雄只需 5 层，铁骑冲撞眩晕 0.8 秒\n冲过留下尘浪 4 秒（敌兵减速）', '铁骑伤害 +30%', '铁骑伤害再 +30%', '虎豹骑 · 极', '铁骑 7 骑', true),
  // P2 太史慈（效果在 weapons/taishiciWeapon.ts 里结算）
  B('donglai_ji', 'tsc_shenting', 'archery', '神亭酣战', '射戟一次 2 支\n钉住的敌兵 3 秒后爆裂', '射戟伤害 +30%', '射戟伤害再 +30%', '神亭', '爆裂范围更大', true),
  B('donglai_ji', 'tsc_beihai', 'formation', '北海突围', '信义只需 10 层、护盾更厚\n突围路线留下阵地 4 秒（敌兵减速）', '突围伤害 +30%', '突围伤害再 +30%', '北海', '护盾再厚 30%', true),
  // P2 周瑜（效果在 weapons/zhouyuWeapon.ts 里结算）
  B('huochuan_ling', 'zy_chibi', 'fire', '火烧赤壁', '同一轮火船之间拉起火索\n一艘爆燃、其余连锁爆燃，火场更大', '火船伤害 +30%', '火船伤害再 +30%', '赤壁', '火场多烧 1.5 秒', true),
  B('huochuan_ling', 'zy_quyouwu', 'formation', '曲有误', '每 6 秒奏一段琴音（3 秒）：\n身边敌兵减速 30%、部曲攻速 +15%', '部曲攻速加成提高', '部曲攻速加成再提高', '周郎顾', '琴音环同时灼烧环内敌兵', true),
  // P2 张辽（效果在 weapons/zhangliaoWeapon.ts 里结算）
  B('pozhen_shuangji', 'zl_shiwan', 'cavalry', '八百破十万', '八百虎贲 +4 骑、多冲一圈\n撞上的敌兵眩晕 0.6 秒', '虎贲伤害 +30%', '虎贲伤害再 +30%', '八百破十万 · 极', '虎贲再多冲一圈', true),
  B('pozhen_shuangji', 'zl_xiaoyao', 'stratagem', '威震逍遥津', '溃逃会传给身边敌兵\n溃兵互相踩踏掉血', '踩踏伤害 +30%', '踩踏伤害再 +30%', '逍遥津', '踩踏伤害再 ×1.5', true),
  B('fangtian_ji', 'lb_yuanmen', 'archery', '辕门射戟', '每 5 次出手朝远处掷戟\n钉住一线敌兵 1 秒，戟飞回再割一次', '掷戟伤害 +30%', '掷戟伤害再 +30%', '辕门射戟 · 神射', '掷戟穿得更远', true),
];
/** 已出图的分支图标（public/assets/upgrade-icons/branch_<id>.webp）。 */
/**
 * 孙尚香 · 奔袭（2026-11-19 平衡：原来要站定 0.5 秒才收刀，主将几乎一直在走，DPS 只有「万刃」的 0.72）：
 * 走动每 dropStep 像素身后撒一把刀（落地割一下 dropMul）；第一把落地后 recallMs 毫秒、或撒满 fullCount 把、或站定 stillMs 毫秒——先到先收，
 * 收刀时每把刀从落点飞回主将，沿途割一下（recallMul，进阶 recallFinalMul），同一个敌人一次收刀最多被割 maxHitsPerEnemy 下。初值，交平衡会话。
 */
export const BENXI = { dropStep: 90, dropMul: .4, recallMs: 2500, fullCount: 8, stillMs: 500, recallWidth: 44, recallMul: .45, recallFinalMul: .6, maxHitsPerEnemy: 3, keepMax: 8 } as const;
export const BRANCH_ICON_READY: readonly string[] = WEAPON_BRANCHES.map(b => b.id); // 24 枚都已出图（ChatGPT 两张 4×3）
export function branchesFor(weapon: WeaponId): WeaponBranch[] { return WEAPON_BRANCHES.filter(b => b.weapon === weapon); }
export function branchById(id: string | undefined): WeaponBranch | undefined { return id ? WEAPON_BRANCHES.find(b => b.id === id) : undefined; }
/** 本命 Lv6 / 7 的章节门槛（超出 Lv5 的级数上限）。 */
export const WEAPON_OVER = { cap: 0, capFor: (chapter: number): number => chapter >= 8 ? 2 : chapter >= 4 ? 1 : 0, damagePer: .1 };
/** 分支强度档：0 未选；1 选定；2 = Lv6；3 = Lv7。 */
/**
 * 专职面板（2026-11-20 用户「可以按照你建议去开发」）：本命 Lv5 时单独弹「兵器专职」面板（ui/BranchPickPanel），两条都能选（去掉「分支派 2 势」门槛）。
 * 契合：两条里该派「势」更高的那条（同势按武将第一亲和派）；选契合的那条，分支效果 ×fitMul（平衡会话 2026-11-20 定 ×1.2）。
 */
// 2026-11-20 平衡：1.1 → 1.2。分支伤害约占武将总伤害 16～43%（10-3 实测），k 同时乘伤害和部分分支的频率，×1.1 只折合总 DPS +2～4%，几乎无感；×1.2 约 +4～8%，仍小于一张机缘增益（+15%）
export const BRANCH_FIT = { fitMul: 1.2 } as const;
/**
 * 赵云「龙胆 · 七进七出」冲刺（2026-11-20 用户「很容易冲击怪堆被打死」→ 定案「冲进去再杀回原位我觉得可以」）：
 * 杀进去再杀出来——朝移动方向（站定时朝最近的敌兵）冲进去 len，沿途敌兵受创；随即折返回出发点，回程同样受创；
 * 往返全程无敌，回到原位后把身边贴身的敌兵推开。去 / 回各 outMs / backMs。初值，交平衡会话。
 */
/**
 * 七进七出（定案「冲进去再杀回原位」）。2026-11-20 用户「关于赵云七进七出 不要这么快 要有个动作」：原来去 / 回各 0.17 秒像瞬移，
 * 改成四段约 1.1 秒：起手 windMs（压枪蓄势、脚下扬尘）→ 冲入 outMs（持枪突刺、沿途枪影残影、挑开敌兵、首次命中顿帧）
 * → 回马枪 turnMs（最远点转身横扫 turnR）→ 杀回 backMs（回到原位、落地收枪、推开贴身敌兵）。全程无敌。冷却按新时长放宽（交平衡会话复核）。
 */
export const LONGDAN = { len: 170, moveMin: 40, windMs: 200, outMs: 350, turnMs: 200, backMs: 350, backMul: .9, turnR: 95, turnMul: .8, pathPush: 26, ghostMs: 70, hitStopMs: 45, pushR: 90, push: 46, cdMs: 3800 } as const;
export const longdanTotalMs = (): number => LONGDAN.windMs + LONGDAN.outMs + LONGDAN.turnMs + LONGDAN.backMs;
/** 专职状态（HUD 专职行与构筑总览专职栏共用）：当前 Lv（5–7）、进阶进度、是否已进阶、悬停全文。 */
export interface BranchStatus { b: WeaponBranch; lv: number; over: number; shi: number; final: boolean; attuned: boolean; progress: string; tip: string }
export function branchStatus(w: { branch?: string; over?: number; attuned?: boolean } | undefined, shi: (s: SchoolId) => number, schoolName: (s: SchoolId) => string): BranchStatus | null {
  const b = branchById(w?.branch); if (!b || !w) return null;
  const over = Math.max(0, w.over ?? 0), n = shi(b.school), final = over >= 2 && n >= 4;
  return { b, lv: 5 + over, over, shi: n, final, attuned: !!w.attuned,
    progress: final ? '进阶「' + b.finalName + '」' : '进阶 ' + Math.min(n, 4) + '/4 势' + (over >= 2 ? '' : ' · 需 Lv7'),
    tip: b.desc + '\n\nLv6：' + b.lv6 + '\nLv7：' + b.lv7 + '\n\n进阶「' + b.finalName + '」（Lv7 + ' + schoolName(b.school) + '派 4 势）：' + b.finalDesc + (w.attuned ? '\n\n契合当前流派：专职效果 +' + Math.round((BRANCH_FIT.fitMul - 1) * 100) + '%' : '') + '\n\n已锁定 · 需行营「重整构筑」才能更换（花军粮洗掉后本命留在 Lv5，下一场开战时重选）' };
}
export function fitBranch(bs: readonly WeaponBranch[], shi: (s: SchoolId) => number, affinity: readonly SchoolId[]): WeaponBranch | undefined {
  if (bs.length !== 2) return bs[0];
  const [a, b] = bs, sa = shi(a.school), sb = shi(b.school);
  if (sa !== sb) return sa > sb ? a : b;
  const ia = affinity.indexOf(a.school), ib = affinity.indexOf(b.school);
  return ia < 0 && ib < 0 ? a : ib < 0 || (ia >= 0 && ia <= ib) ? a : b;
}
export function branchTier(w: { branch?: string; over?: number }): number { return w.branch ? 1 + (w.over ?? 0) : 0; }
