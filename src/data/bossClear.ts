/**
 * 首领登场「鸣金让道」（平衡会话配兵审计 wave-mix-audit.md：首领段开始时同屏平均约 50–75 人，多是副将段留下的残兵，抢首领的戏）。
 * 首领出场那一刻：普通小兵里离主将最远的残兵先撤（平衡会话建议），往外、略向两侧退开，边走边淡出后撤走（不算击杀、不掉落），
 * 场上只留约 keep 个（12–15，约撤走 75–80%）；精锐、副将（elite）、特殊兵种（新兵种 trait / roster）、城墙 / 补给不撤。
 * 撤完后静场 quietMs 不刷普通兵（主刷兵与各处刷兵帐篷都停），之后首领段照现有的减半节奏刷兵；撤走的兵按经验折一半一次性给玩家，出「敌军溃退」横幅。
 * 数值：平衡会话 11-21（wave-mix-audit.md 最后一节：只撤兵 2.4 秒就回到 20 人，要静场 6–8 秒才有效；撤走的经验约占全关 4.2%，折一半给免得觉得亏）。
 * 不适用的场景由 GameScene.bossClearAllowed 跳过：目标型关卡目标没完成（2-3 营寨等）、攻城 / 守城；双首领照常撤。
 */
export const BOSS_CLEAR = {
  /** 撤完后场上最多留多少个非首领敌人（精锐、特殊兵种算在里面，但它们不会被撤）；平衡会话：留 12–15。 */
  keep: 14,
  /** 退开用时（毫秒）：期间不出手，到点撤走。 */
  ms: 1600,
  /** 退开速度倍率（相对本兵种移速）。 */
  speedMul: 1.7,
  /** 最后多少毫秒淡出。 */
  fadeMs: 700,
  /** 方向：往「主将 → 首领」连线两侧的占比，其余是背离主将（远处的残兵主要往外撤，略分向两边像让开；离得远，侧向多了会横穿画面，取 0.35）。 */
  side: .35,
  /** 静场：撤兵后多少毫秒不刷普通兵（平衡会话：6–8 秒）。 */
  quietMs: 7000,
  /** 撤走的兵经验折多少给玩家（一次性）。 */
  xpShare: .5,
} as const;

export interface ClearUnit { x: number; y: number; kind: string; special?: boolean }
/** 撤走的兵折给玩家的经验（按各兵经验值之和 × xpShare，四舍五入、至少 1）。 */
export function withdrawXp(xps: readonly number[]): number { const s = xps.reduce((a, b) => a + b, 0); return s > 0 ? Math.max(1, Math.round(s * BOSS_CLEAR.xpShare)) : 0; }
const NORMAL = new Set(['infantry', 'shield', 'archer', 'cavalry']);

/**
 * 选出要撤的兵与各自退开方向（单位向量）。units：场上非首领敌人；p：主将；b：首领。
 * 离主将最远的普通小兵先撤（平衡会话 11-21），撤到总数 ≤ keep 或普通小兵撤完为止；身边正在打的留着，首领段一开打不会突然没对手。
 */
export function pickWithdraw(units: readonly ClearUnit[], p: { x: number; y: number }, b: { x: number; y: number }, keep: number = BOSS_CLEAR.keep): Array<{ index: number; dx: number; dy: number }> {
  const excess = units.length - keep; if (excess <= 0) return [];
  const lx = b.x - p.x, ly = b.y - p.y, L = Math.hypot(lx, ly) || 1, ux = lx / L, uy = ly / L;
  const far = (u: ClearUnit): number => Math.hypot(u.x - p.x, u.y - p.y);
  const cand = units.map((u, index) => ({ u, index })).filter(c => NORMAL.has(c.u.kind) && !c.u.special).sort((a, c) => far(c.u) - far(a.u));
  return cand.slice(0, excess).map(({ u, index }) => {
    const side = (u.x - p.x) * -uy + (u.y - p.y) * ux >= 0 ? 1 : -1, sx = -uy * side, sy = ux * side; // 连线的哪一侧就往哪一侧分
    const ax = u.x - p.x, ay = u.y - p.y, ad = Math.hypot(ax, ay) || 1;
    const dx = sx * BOSS_CLEAR.side + ax / ad * (1 - BOSS_CLEAR.side), dy = sy * BOSS_CLEAR.side + ay / ad * (1 - BOSS_CLEAR.side), d = Math.hypot(dx, dy) || 1;
    return { index, dx: dx / d, dy: dy / d };
  });
}
