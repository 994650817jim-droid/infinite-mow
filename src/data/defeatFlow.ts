/**
 * 战败流程（2026-11-20 用户「如果角色被打败被打死后做一段剧情然后回到最近的城市或者营寨，需要给一些惩罚。然后还可以再次挑战」；共享笔记 defeat-flow.md）：
 * 主将倒下 → 慢动作 + 压暗 → 左下角电影感对话卡（部将护主突围）→ 结算面板「退守 X」→ 天下地图聚焦最近的我方城池 / 营寨，弹败退告示。
 * 惩罚有痛感但不劝退（初值，交平衡会话）；不扣等级 / 属性点 / 已招武将，不删存档；战败的关不算平定，照样可以再出征。
 */
export const DEFEAT = {
  /** 慢动作倍率、持续（毫秒，真实时间）；压暗；结算面板晚出多久（先看对话卡）。 */
  slowMul: .35, slowMs: 1500, dim: .55, resultDelayMs: 3000,
  /** 主将负伤：存档点生命压到 hpFrac（营寨 / 城池 / 行营军医可治）；随行压到 followerFrac；存档点部曲折损 troopLoss。 */
  hpFrac: .55, followerFrac: .5, troopLoss: .3,
  /** 营寨军粮扣 grainPct（最多 grainCap）。 */
  grainPct: .08, grainCap: 250,
} as const;

export interface DefeatLine { who: string; text: string }
/** 通用台词（随机一套）：先是部将 / 亲兵护主，再主将一句。who = '' 时用随行名将或「亲兵」。 */
export const DEFEAT_LINES: readonly DefeatLine[][] = [
  [{ who: '', text: '主公快走！末将断后！' }, { who: '@lord', text: '……撤！来日必报此仇！' }],
  [{ who: '', text: '护住主公——杀出一条血路！' }, { who: '@lord', text: '诸君……且退，整军再战！' }],
  [{ who: '', text: '敌势太盛，留得青山在，主公先撤！' }, { who: '@lord', text: '记下今日之败。走！' }],
];
/** 关键关卡专属（键：章节 / 篇章 / 支线 id，或 id-关）。 */
export const DEFEAT_SPECIAL: Readonly<Record<string, DefeatLine[]>> = {
  'hulao-3': [{ who: '', text: '吕布骁勇难当，董卓据城——主公，暂退虎牢！' }, { who: '@lord', text: '……讨董之志不改，整军再来！' }],
  hulao: [{ who: '', text: '西凉铁骑太凶，主公先撤，末将断后！' }, { who: '@lord', text: '撤回营中，再议破敌之策！' }],
  lubu: [{ who: '', text: '三英尚且难敌，主公先撤！' }, { who: '@lord', text: '人中吕布……来日再会！' }],
  chibi: [{ who: '', text: '江上火起，主公快上船！' }, { who: '@lord', text: '……退回夏口，再作计较！' }],
  yiling: [{ who: '', text: '火烧连营——主公速往白帝城！' }, { who: '@lord', text: '……此仇，来日必报！' }],
  beifa: [{ who: '', text: '街亭已失，主公请速退兵！' }, { who: '@lord', text: '……退回汉中，整军再出！' }],
  xiapi: [{ who: '', text: '温侯骁勇，暂避其锋，主公快走！' }, { who: '@lord', text: '下邳……我还会回来！' }],
  nanjun: [{ who: '', text: '周郎火攻，主公暂避！' }, { who: '@lord', text: '南郡……来日再争！' }],
  caowei: [{ who: '', text: '虎豹骑太凶，主公先撤！' }, { who: '@lord', text: '中原未定，岂能就此罢手！' }],
  huangjin: [{ who: '关羽', text: '大哥，黄巾势众，暂退整军！' }, { who: '@lord', text: '……回营，整顿再来！' }],
};
/** 第一章战败小贴士（天下未开，没有惩罚与退守，结算正文加一条）。 */
export const DEFEAT_TIPS: readonly string[] = ['三选一多拿本命兵器，伤害涨得最快', '血少了去捡干粮、站泉眼回血', '张宝的护法符柱先打碎，他才会受伤', '张角的天雷有红圈预警，看准再走', '战斗支援选一队兵随行，按 E 让部曲出击'];
/** 这一关的战败台词：先找「id-关」，再找「id」，都没有就随机一套通用的。 */
export function defeatLines(key: string, stage: number, rnd: () => number = Math.random): DefeatLine[] {
  return DEFEAT_SPECIAL[key + '-' + stage] ?? DEFEAT_SPECIAL[key] ?? DEFEAT_LINES[Math.floor(rnd() * DEFEAT_LINES.length)];
}
