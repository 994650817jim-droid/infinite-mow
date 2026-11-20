/**
 * P2 张辽（other-factions-design.md §4，2026-11-19；初值，交平衡会话）：
 * 本命「破阵双戟」：极快的近身连斩（左右戟交替，扇形），每击给敌兵叠 1 层「震慑」，叠到 rout 层就「溃逃」routMs 毫秒——
 *   溃逃的敌兵背向主将逃跑、不攻击，受伤 +routVuln；首领 / 免控的敌人只叠层不溃逃。
 * 被动「止啼」：溃逃中的敌兵被击杀攒 1 点，攒满 need 点召「八百虎贲」：riders 骑虚影绕主将环冲 laps 圈（radius 半径、lapMs 一圈），
 *   沿途敌兵每骑每圈最多被撞一下（weapon 伤害 × hitMul）。
 * 分支「八百破十万」（骑突）：虎贲 +4 骑、多一圈、撞上眩晕 stunMs；「威震逍遥津」（奇谋）：溃逃会传给身边 spreadR 内的敌兵，
 *   溃兵互相踩踏（每 trampleCdMs 毫秒撞到身边敌兵一次，伤害 × trampleMul）。
 * 武艺「先登」：每 xiandeng.cdMs 突进 dashLen 像素再多斩 extra 击；「威名」：Lv1 2 层就溃逃，Lv2 / 3 溃逃再 +0.5 / +1 秒。
 */
export const ZHANGLIAO = {
  range: 150, reach: [92, 96, 100, 104, 110], arc: 1.25, // 半角约 72°
  rout: 3, routMs: 2000, routVuln: .25, routSpeed: 1.15, stackMs: 4000,
  need: 12,
  huben: { riders: 8, laps: 2, lapMs: 900, radius: 150, hitR: 40, hitMul: .9 },
  shiwan: { riders: 4, laps: 1, stunMs: 600 },
  xiaoyao: { spreadR: 90, trampleR: 30, trampleCdMs: 500, trampleMul: .25 },
  xiandeng: { cdMs: [5000, 4500, 4000], dashLen: 90, ms: 160, extra: [2, 2, 3] },
  weiming: { extraMs: [0, 500, 1000] },
} as const;
