/**
 * P2 曹操（可玩武将 id「mengde」，首领 / 剧情里仍是 caocao；other-factions-design.md §4，2026-11-19；初值，交平衡会话）：
 * 本命「倚天剑」：中距离扇形剑斩（reach），命中给敌兵挂「军令」markMs 毫秒：被标记的受伤 +markVuln（武艺「唯才是举」每级再 +weicai），
 *   部曲优先集火主将这一剑的目标（Legion.focus）。
 * 被动「奸雄」：部曲阵亡攒 1 点、主将回血 healPct（武艺「望梅止渴」每级再 +wangmei），满 need 点召「虎豹骑」：
 *   riders 骑从主将身边沿最密敌群方向冲过 chargeLen 像素（chargeMs），每骑每个敌兵最多撞一下（剑斩伤害 × chargeMul）。
 * 分支「挟天子以令诸侯」（兵阵）：每 xie.everyMs 插令旗成阵地 xie.ms（半径 xie.r）：阵内部曲攻速 +xie.haste、每秒回 xie.healPct 最大生命。
 * 分支「虎豹骑」（骑突）：奸雄只需 hubao.need 点，冲撞眩晕 hubao.stunMs，冲过留下尘浪 hubao.dustMs（敌兵减速 hubao.slow）。
 * 曹操本人图：首领版 bosses-v2/hanzhong_caocao。
 */
export const MENGDE = {
  range: 170, reach: [110, 115, 120, 125, 132], arc: .95,
  markMs: 6000, markVuln: .2, weicai: .08,
  need: 8, healPct: .04, wangmei: .02,
  riders: 5, chargeLen: 520, chargeMs: 700, chargeW: 34, chargeGap: 34, chargeMul: 1.3,
  xie: { everyMs: 8000, ms: 6000, r: 150, haste: .25, healPct: .02, finalRMul: 1.3 },
  hubao: { need: 5, stunMs: 800, dustMs: 4000, dustW: 70, slow: .35, finalRiders: 7 },
} as const;
