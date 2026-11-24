import type { CharacterId } from './characters';
import { LVBU } from './lvbu';
import { ZHANGLIAO } from './zhangliao';
import { ZHOUYU } from './zhouyu';
import { TAISHICI } from './taishici';
import { MENGDE } from './mengde';
import { GANNING } from './ganning';
import { DIANWEI } from './dianwei';
import { SUNQUAN } from './sunquan';
import { MENGHUO } from './menghuo';
import { ZHURONG } from './zhurong';
import { HZ_SHARP, ZG_TIANHUO } from './heroMechanics';
import { PASSIVE_RULES as R } from './passives';
const pct = (n: number): number => Math.round(n * 100);
/** 按武将ID索引，新增武将缺说明时由类型检查报错；不再依赖人物列表排列。 */
export const CODEX_PASSIVES: Record<CharacterId, string> = {
  zhaoyun: "命中积龙胆（满7层）。满层后下一次枪刺多出一枪，枪长 +25%。",
  guanyu: "一刀砍中3名以上敌人积1层武势（满3层），每层刀斩范围 +4%；满层后下一刀伤害 +25%。",
  huangzhong: "重箭命中积蓄势（满4层）。满层进入「神射」6秒：暴击率 +10%，重箭命中处小范围爆裂（50%伤害）。受伤掉1层蓄势，神射中受伤不打断。",
  zhuge: "无首领时，天火每发都积1层星象；有首领 / 精锐时只算同一目标（满3层）。满层后下一发必定暴击且伤害×2（算无遗策），落地留下4.5秒星火焦土，灼烧范围内所有敌人。",
  zhangfei: "命中积怒气（满5层）。满层大喝：周围敌人震慑1.2秒（无法行动）并受140%伤害，脚下留下3秒断桥区。",
  machao: "命中积铁骑（满6层）。满层后下一枪化为冲锋：向前突进，160%伤害；冲锋中无敌，结束后2秒受伤 -30%。",
  weiyan: "受伤积拒敌（每0.5秒最多1层，满5层）；身边每有3名敌人，每秒再积1层。满层「谁敢杀我」：向6个方向劈出裂波（各80%伤害），3秒内受伤 -30%。",
  liubei: "一剑同时砍中两名敌人积1层仁德（满4层）。满层：伤害 +15%，回复8%生命，部曲回复35%，4秒内攻速 +30%。",
  pangtong: "一次连锁引爆3枚以上火雷积1层计策（满3层）。满层「火烧连环」：身边布6枚环形火雷，踩到或2秒后齐爆并留火2秒。生命低于30%时脚下自动布4枚火雷（每30秒一次）。",
  huangyueying: "命中积机括（满12层）。满层后额外射出6支扇形弩箭，每支60%伤害。",
  sunshangxiang: "移动中每0.8秒积1层疾步（满6层）。满层召2名执刀侍婢护身6秒（最多3名），绕身挥刀。",
  diaochan: "被双扇扇中2次的敌人倒戈3秒（精锐减半）：转而攻击同伴，且受伤 +20%；首领不会倒戈，改为受伤 +15%。满层「闭月」：舞带环身2秒，圈内敌人倒戈并每0.4秒受50%伤害。",
  lvbu: `击杀积累战意，满 ${LVBU.need} 点进入「人中吕布」${LVBU.frenzyMs/1000}秒：移速 +${pct(LVBU.moveMul-1)}%、攻速 +${pct(LVBU.haste-1)}%，每次出手连击两次，不被击退。第二击对首领伤害另有折减。`,
  zhangliao: `击杀溃逃中的敌人积累止啼，满 ${ZHANGLIAO.need} 点召出 ${ZHANGLIAO.huben.riders} 骑虎贲虚影绕身冲击 ${ZHANGLIAO.huben.laps} 圈。首领不会被强制溃逃。`,
  zhouyu: `火船与火场击杀敌人积累英发，满 ${ZHOUYU.need} 点刮起东风 ${ZHOUYU.windMs/1000} 秒：火场沿主将当时朝向推进，火场伤害变为 ${ZHOUYU.windMul} 倍。首领火伤另有折减。`,
  taishici: `附近部曲受伤积累信义，满 ${TAISHICI.need} 点自动向敌群突围，沿途造成 ${pct(TAISHICI.dashMul)}% 伤害；沿途部曲获得最大生命 ${pct(TAISHICI.shield)}% 的护盾，持续 ${TAISHICI.shieldMs/1000} 秒。`,
  mengde: `部曲阵亡积累奸雄并回复主将 ${pct(MENGDE.healPct)}% 最大生命，满 ${MENGDE.need} 点召出 ${MENGDE.riders} 骑虎豹骑虚影冲击敌阵。`,
  ganning: `被铁索钩标记的敌人死去时积累锦帆，满 ${GANNING.need} 点进入「百骑劫营」${GANNING.raidMs/1000} 秒：移速 +${pct(GANNING.raidSpeed-1)}%，每一钩都烧红并留下火线。`,
  dianwei: `受伤积累恶来（至少间隔 ${DIANWEI.gainGapMs/1000} 秒），满 ${DIANWEI.need} 点狂怒 ${DIANWEI.rageMs/1000} 秒：受伤减少 ${pct(1-DIANWEI.rageGuard)}%，每 ${DIANWEI.rageWhirlMs/1000} 秒自动旋风攻击。`,
  sunquan: `每击杀 ${SUNQUAN.need} 名敌人切换一次阵势：守势减伤 ${pct(1-SUNQUAN.stance.guard)}%并治疗附近部曲；攻势强化齐射；疾势提高移速与攻速。开局为守势，按守→攻→疾循环。`,
  menghuo: `击杀积累南蛮王，满 ${MENGHUO.need} 点召出 ${MENGHUO.beasts} 头猛兽冲阵，每头沿途造成 ${pct(MENGHUO.chargeMul)}% 伤害并推开普通敌军。`,
  zhurong: `击杀燃烧中的敌人积累火神之力，满 ${ZHURONG.need} 点触发烈焰飞刀阵：飞刀绕身攻击，结束后向外射出。`,
};
// 已改过的基础机制直接读取战斗配置。
CODEX_PASSIVES.huangzhong = `重箭命中积蓄势（满${HZ_SHARP.need}层）。满层进入神射${HZ_SHARP.sharpMs/1000}秒：暴击率 +${pct(R.critBonus)}%，命中处小范围爆裂（${pct(R.heavyBurstMul)}%伤害）。受伤掉1层，神射期间受伤不打断。`;
CODEX_PASSIVES.zhuge = `天火积累观星，满${ZG_TIANHUO.starNeed}层后下一发必定暴击且伤害×${ZG_TIANHUO.burstMul}，留下${ZG_TIANHUO.ember.ms/1000}秒星火焦土。无首领/精锐时每发都积层；有首领/精锐时需连续命中同一目标。`;
