import type { CharacterId } from './characters';
import type { ItemQuality } from './items';

/**
 * 招贤馆（人才库）与跟随武将的数值（RECRUIT_PLAN.md，用户选 A 方案）。
 * 全部为初值，交「平衡与数值」会话测；重要改动需用户批准。
 */
export type RecruitKind = 'hero' | 'named' | 'common';
/** 史事名将与大众脸的模板兵器：枪（近身扫击）/ 刀（前方扇形劈砍）/ 弓（单发远射）/ 谋（小范围火点）。 */
export type FollowerTemplate = 'spear' | 'blade' | 'bow' | 'strategist';

export const TEMPLATES: Record<FollowerTemplate, { name: string; desc: string; range: number; cooldown: number; damage: number; hp: number; speed: number }> = {
  spear: { name: '枪', desc: '近身扫击，打身边一圈', range: 70, cooldown: 900, damage: 16, hp: 220, speed: 1.05 },
  blade: { name: '刀', desc: '前方扇形劈砍', range: 85, cooldown: 1100, damage: 22, hp: 260, speed: 1 },
  bow: { name: '弓', desc: '单发远射', range: 230, cooldown: 950, damage: 18, hp: 160, speed: 1 },
  strategist: { name: '谋', desc: '在敌群落下小范围火点', range: 200, cooldown: 1600, damage: 26, hp: 150, speed: .98 },
};
export const TEMPLATE_ORDER: readonly FollowerTemplate[] = ['spear', 'blade', 'bow', 'strategist'];

export const RECRUIT = {
  /** 招贤馆等级 1 / 2 / 3 的席位数与随行人数上限。 */
  seats: [3, 4, 5],
  followerCap: [1, 2, 3],
  /** 招贤馆升级费用（从 Lv1 → Lv2、Lv2 → Lv3），只收军粮（主城统一军粮后：军粮 = 粮草 + 2×军功 + 1.5×钱，原价 钱300+功120 / 钱800+功300 折算；待平衡会话复核）。 */
  hallUpgrade: [{ provisions: 690 }, { provisions: 1800 }],
  /** 手动刷新：第 n 次花 base + step × (n − 1) 军粮，换季归零。 */
  refreshBase: 30, refreshStep: 30,
  /** 每个席位独立抽：大众脸 / 史事名将 / 可玩名将，按招贤馆等级。 */
  rates: [
    { common: .72, named: .20, hero: .08 },
    { common: .66, named: .23, hero: .11 },
    { common: .60, named: .26, hero: .14 },
  ],
  /** 大众脸品质权重（白 / 绿 / 蓝）。 */
  commonQuality: { white: 55, green: 30, blue: 15 } as Partial<Record<ItemQuality, number>>,
  /** 招募费（军粮）。 */
  cost: { white: 80, green: 150, blue: 260, named: 500, hero: 900 },
  /** 连续这么多次刷新都没有出现未拥有的可玩名将，下一次必出。 */
  pity: 6,
  /** 击败敌将后被俘的概率：名将悬赏 / 攻城 / 守城。 */
  capture: { bounty: .35, siege: .20, defense: .10 },
  /** 降将栏停留季度数与招降折扣。 */
  captiveSeasons: 2, captiveDiscount: .6,
  /** 已拥有武将上限（含主公）。 */
  maxOwned: 30,
} as const;

/** 跟随作战（RECRUIT_PLAN.md §4）：贴身站位环带、索敌半径、拉回与瞬移距离、倒下休整时长。 */
export const FOLLOW = {
  /** 紧贴跟随（用户 2026-11-16「一直紧紧跟随，像战锤幸存者那样」）：每人在主公身后有固定阵位，阵位随主公移动方向平滑转动。
   *  slotRadius 阵位离主公的距离；followK 追阵位的平滑系数（越大越紧，14 ≈ 跑动时只落后十来像素）；turnRate 阵位转向速度；
   *  lunge 近战出手时朝目标前出的距离（之后自动回位）；snap 离阵位超过这个距离直接归位（换图、复活等）。 */
  slotRadius: 56, followK: 14, turnRate: 6, lunge: 22, snap: 160, restMs: 20000,
  /** 可玩名将随行用本命武器（用户 2026-11-16「随行武将要用他们自己的攻击」）：武将等级 ≥ 这些值时武器为 Lv1–5；
   *  效果范围倍率（体量小一点）；随行出手当帧新建的特效放进半透明图层的不透明度（与主将区分）。初值，交平衡会话。 */
  weaponLevelAt: [1, 8, 15, 22, 30], heroAreaMul: .85, fxAlpha: .72,
  /** 可玩名将跟随时专属武器的倍率；吃主将全局伤害加成的比例。 */
  heroDamageMul: .45, heroCooldownMul: 1.3, shareLeaderDamage: .5,
  /** 首领打跟随武将的倍率（同后备兵）。 */
  bossMul: 3,
  /** 武将等级（HeroProgress，用户批准方案 A）：招来的 r_ 武将按等级成长，每级生命 +4%、伤害 +3%；
   *  可玩名将当随行时用自己加过的属性点：力量（strength）每点 +1.5% 伤害、+3% 生命（与主将同值；2026-11-17 属性改版）。 */
  levelHp: .04, levelDamage: .03, mightDamage: .015, constitutionHp: .03,
} as const;

/** 将阶（技能升级）：1–10 级；招贤馆等级决定上限；每级花军粮与军功。 */
export const RANK = {
  max: 10, capByHall: [4, 7, 10],
  cost: (next: number) => ({ provisions: 100 * next }),
  /** 将阶第 n 阶只收军粮 100×n（原 60n 粮 + 20n 军功折算）。兵器线每次 +6% 伤害；被动线每次 +4% 生命与 +3% 攻速（模板被动）。（原「当主将时每阶开局 +2%」已按武将等级方案 A 去掉。） */
  weaponStep: .06, passiveHp: .04, passiveHaste: .03,
} as const;

const SURNAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '潘', '袁', '蔡', '蒋', '余', '于', '杜', '叶', '程', '魏', '苏', '吕', '丁', '任', '卢', '姚', '沈', '钟', '姜', '崔', '谭', '陆', '范', '汪', '廖', '石', '金', '韦', '贾', '夏', '付', '方', '邹', '熊', '白', '孟', '秦', '邱', '侯', '江', '尹', '薛', '闫', '段', '雷', '龙', '黎', '史', '陶', '贺', '毛', '郝', '顾', '龚', '邵', '万', '覃', '武', '钱', '戴', '严', '欧', '莫', '孔', '向', '常'];
const GIVEN = ['勇', '武', '忠', '义', '信', '平', '安', '远', '威', '烈', '昭', '固', '恒', '毅', '刚', '雄', '腾', '超', '岳', '松', '彪', '豹', '虎', '辽', '宁', '泰', '谦', '恭', '正', '直', '方', '达', '通', '明', '亮', '承', '奉', '允', '进', '先', '霸', '猛', '壮', '骁', '锐', '固', '德', '仁', '礼', '智', '肃', '敬', '晖', '朗', '珪', '璋', '琰', '瑾', '玄', '宏'];
const COURTESY = ['伯', '仲', '叔', '季', '子', '元', '公', '文', '孝', '德'];

/** 大众脸姓名：姓 + 单名 / 双名，约三成配表字。 */
export function commonName(random: () => number): string {
  const p = <T,>(a: readonly T[]) => a[Math.floor(random() * a.length) % a.length];
  const name = p(SURNAMES) + p(GIVEN) + (random() < .3 ? p(GIVEN) : '');
  return random() < .3 ? `${name}（${p(COURTESY)}${p(GIVEN)}）` : name;
}

/** 可玩名将跟随时的模板（用于界面标签；战斗里仍用专属武器）。 */
export const HERO_TEMPLATE: Record<CharacterId, FollowerTemplate> = {
  zhaoyun: 'spear', guanyu: 'blade', huangzhong: 'bow', zhuge: 'strategist', zhangfei: 'spear', machao: 'spear',
  weiyan: 'blade', liubei: 'blade', pangtong: 'strategist', huangyueying: 'bow', sunshangxiang: 'bow', diaochan: 'strategist',
};
