/**
 * 单场收益上限（总制作人第四轮：一场守城精锐 83 个 → 战功 +83、兵装 10 件、残卷 +6，远多于主线一关的十几战功）。
 * 管首领阶段防刷（data/bossStall.ts）之外、一整场里精锐给的战功、精锐掉的武学残卷、非首领的兵装掉落（精锐 / 杂兵掉在地上的）；
 * 首领本体、首领宝箱、关卡目标 / 悬赏、结算奖励、障碍物掉落（另有每关上限）不算。到上限后照常杀，只是不再给这几样。
 * 主线一关：精锐十来个，战功十几、兵装 2～3 件、残卷 0～1 张——上限按这个留出余量。初值，交平衡会话定。
 */
export type BattleCapKind = 'stage' | 'siege' | 'defense';
export const BATTLE_LOOT_CAP: Record<BattleCapKind, { merit: number; scrolls: number; drops: number }> = {
  stage: { merit: 25, scrolls: 3, drops: 6 },
  siege: { merit: 25, scrolls: 3, drops: 6 },
  defense: { merit: 20, scrolls: 2, drops: 5 },
};
