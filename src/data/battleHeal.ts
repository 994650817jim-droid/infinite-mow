import { CH1_TRIAL, CH1V6 } from './ch1Trial';
/**
 * 战场回血（用户 2026-11-19「我感觉地图上也需要更多回血手段」；盘点见共享笔记 battle-heal-audit.md）。
 * 全部按最大生命比例算（章节越往后生命越高，回血跟着涨，不用固定值）。数值是初值，交平衡会话复核。
 * 节奏目标：一关 4.5–5 分钟，正常操作约能回 60–100% 最大生命（新旧来源合计）。
 */
export const BATTLE_HEAL = {
  /**
   * 干粮 / 酒肉：打破营地道具有概率掉在地上，受伤时走近自动吃（满血不捡，留着以后再吃）。
   * grain = 粮袋 / 粮车 / 米缸，crate = 木箱 / 钱袋。
   */
  food: {
    grain: { chance: .5, ratio: .05, name: '干粮' },
    crate: { chance: .25, ratio: .06, name: '酒肉' },
    /** 地上留多久（毫秒）；最后 3 秒闪烁。 */
    lifeMs: 45000,
    /** 受伤时多近开始被吸过来、多近算吃到。 */
    // 用户 11-20「回血不要一下子刷在角色脸上」：主将走近 60 内才吸过来（原 90，远远就飞进脸上）
    magnetR: 60, eatR: 26, flySpeed: 460,
    /** 同时最多几份在地上。 */
    max: 10,
  },
  /** 营地酒罐（补给格的酒罐）：原来固定回 10 点，改成按比例（进药囊）。 */
  wineJarRatio: .06,
  /**
   * 泉眼 / 水井 / 药草丛：站上去（圈里）持续回血；一口泉的水量用完要冷却。地图上看得到，屏外有箭头。
   * 五段关按段落刷：精锐段 + elite 秒、事件段 + event 秒，首领段开始前 bossLead 秒补一处（让玩家先回满再打）。
   * 非五段关：开局 firstSec 秒后一处，之后每 everySec 秒一处。同时最多 maxLive 处（多了把最旧的撤掉）。
   */
  spot: {
    radius: 66,
    /** 每秒回最大生命的比例；一池水总量（比例）；用完冷却秒数。 */
    rate: .06, charge: .15, cooldownSec: 50,
    elite: 10, event: 15, bossLead: 15,
    firstSec: 40, everySec: 80,
    maxLive: 2,
    /** 刷点距离（离主将）。 */
    // 用户 11-20：离主将 260–480、并且在画面里（或刚好在画面边上）——原 380–640 常常刷在屏幕外
    // 用户 11-21「回血事件刷远一点」：主动刷出的回血点离主将 450–700（要专门跑一段过去，同机缘远距离思路；小场地取能到的最远处），屏外有箭头
    near: 450, far: 700,
    /** 生命低于这个比例、泉眼在屏幕外且可用时，屏幕边缘出箭头。 */
    arrowBelow: .75,
  },
  /**
   * 军中伤药：副将倒下必掉一份；精锐倒下 chance 概率掉，连续 pity 个没掉则下一个必掉。
   * 拾取进药囊（Q 用，2.5 秒回完）；药囊满了且受伤时直接服下。
   */
  medicine: { ratio: .1, lieutenantRatio: .15, chance: .2, pity: 4, name: '军中伤药' },
  /**
   * 低血保护：生命跌破 below 时，在附近（敌人最少的方向）放一份军中伤药，让玩家有个去处。
   * 冷却 cooldownSec 秒，每关最多 perStage 次。
   */
  /** 首领出场保底（第一章试验数值 ch1v6，见 data/ch1Trial bossEntryAid）：首领出场时主将生命 < below，在主将与首领之间必出一处回血点（水量 charge）；stages 为空 = 关。 */
  bossEntry: { stages: (CH1_TRIAL ? ['huangjin.1'] : []) as readonly string[], ...CH1V6.bossEntryAid },
  lowHp: { below: .3, ratio: .12, dist: [350, 450] as const, cooldownSec: 70, perStage: 2 }, // 残血不让跑太远：350–450（11-21），屏外有箭头
  /**
   * 掉落不砸在主将脸上（用户 11-20）：打碎的道具 / 倒下的精锐副将离主将不足 minDrop 时，回血物从那里「蹦」出去，落到离主将 minDrop–minDrop+spread 处
   * （方向 = 主将 → 掉落点，还在画面里）；本来就够远的就落在原处。低血保护放的药也落在 minDrop–maxDrop 之间、画面里。
   */
  // 11-20 用户「回血的事件不要刷在脸上」第二轮：离主将至少 250（原 150），不在主将移动方向正前方 ±aheadDeg°（刷点 / 低血药 / 蹦出去的落点；本来就 ≥ 250 的掉落落在原处）
  drop: { minDrop: 250, spread: 50, maxDrop: 340, hopMs: 380, viewPad: 50, aheadDeg: 35 },
} as const;

/** 回血点种类：图来自 scene-v2/waterpoints.png（2×2：0 泉眼 / 1 水潭 / 2 石井 / 3 木水槽）；药草丛等新图到了再接。 */
export type HealSpotKind = 'spring' | 'well' | 'herb';
export const HEAL_SPOT_ART = {
  water: { key: 'scene_v2_waterpoints', file: 'assets/scene-v2/waterpoints.png', cell: 512 },
  /** 药草丛（美术会话 11-19，帧 0 茂盛 / 1 采过）：没载到就不刷这种。 */
  herb: { key: 'heal_spot_herb', file: 'assets/heal-props/herb_patch.png', cell: 256 }, // BootScene 载
} as const;
export const HEAL_SPOT_NAME: Record<HealSpotKind, string> = { spring: '泉眼', well: '水井', herb: '药草丛' };
