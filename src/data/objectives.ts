/**
 * 关卡目标（用户 2026-11-16：「8 波数太多…应该有各种玩法，杀够多少或者摧毁什么的」）：试玩初值，交平衡会话测。
 * 每关 3 波（约 2.5 分钟）。目标完成后首领出阵（首领战照旧，击败即胜）；没有目标的关按原来的时间出首领。
 * 目标在 limit 秒内没完成判「时间耗尽」失败。
 */
export type StageObjective =
  | {kind: 'kills'; count: number; label: string; limit: number}
  | {kind: 'destroy'; count: number; target: string; label: string; limit: number}
  | {kind: 'hold'; seconds: number; label: string; limit: number};

/** 坚守军旗：旗有耐久，旗旁 70px 内每个敌兵持续扣耐久；守满秒数即完成。 */
export const STAGE_HOLD = {hp: 100, radius: 70, dps: 1.2, cap: 8} as const;
/** 摧毁目标的耐久（受关卡生命成长影响前的基础值）。 */
export const STAGE_DESTROY_HP = 260;
