/**
 * 首领登场「鸣金让道」（平衡会话配兵审计 wave-mix-audit.md：首领登场时场上平均还有 33–36 个兵，多是副将段留下的，抢首领的戏）。
 * 首领出场那一刻：普通小兵里离「主将 → 首领」这条线最近的先往两侧退开、边走边淡出后撤走（不算击杀、不掉落），场上只留约 keep 个；
 * 精锐、副将（elite）、特殊兵种（新兵种 trait / roster）、城墙 / 补给不撤。之后首领段照现有的减半节奏刷兵。
 * 不适用的场景由 GameScene.bossClearAllowed 跳过：目标型关卡目标没完成（2-3 营寨等）、攻城 / 守城；双首领照常让道。
 * 数值是初值，交平衡会话。
 */
export const BOSS_CLEAR = {
  /** 撤完后场上最多留多少个非首领敌人（精锐、特殊兵种算在里面，但它们不会被撤）。 */
  keep: 14,
  /** 退开用时（毫秒）：期间不出手，到点撤走。 */
  ms: 1600,
  /** 退开速度倍率（相对本兵种移速）。 */
  speedMul: 1.7,
  /** 最后多少毫秒淡出。 */
  fadeMs: 700,
  /** 方向：往两侧（垂直于主将 → 首领连线）的占比，其余是背离主将。 */
  side: .75,
} as const;

export interface ClearUnit { x: number; y: number; kind: string; special?: boolean }
const NORMAL = new Set(['infantry', 'shield', 'archer', 'cavalry']);

/**
 * 选出要撤的兵与各自退开方向（单位向量）。units：场上非首领敌人；p：主将；b：首领。
 * 先撤离「主将 → 首领」连线最近的普通小兵（让出一条道），撤到总数 ≤ keep 或普通小兵撤完为止。
 */
export function pickWithdraw(units: readonly ClearUnit[], p: { x: number; y: number }, b: { x: number; y: number }, keep: number = BOSS_CLEAR.keep): Array<{ index: number; dx: number; dy: number }> {
  const excess = units.length - keep; if (excess <= 0) return [];
  const lx = b.x - p.x, ly = b.y - p.y, L = Math.hypot(lx, ly) || 1, ux = lx / L, uy = ly / L;
  const lineDist = (u: ClearUnit): number => { const t = Math.max(0, Math.min(L, (u.x - p.x) * ux + (u.y - p.y) * uy)); return Math.hypot(u.x - (p.x + ux * t), u.y - (p.y + uy * t)); };
  const cand = units.map((u, index) => ({ u, index })).filter(c => NORMAL.has(c.u.kind) && !c.u.special).sort((a, c) => lineDist(a.u) - lineDist(c.u));
  return cand.slice(0, excess).map(({ u, index }) => {
    const side = (u.x - p.x) * -uy + (u.y - p.y) * ux >= 0 ? 1 : -1, sx = -uy * side, sy = ux * side; // 连线的哪一侧就往哪一侧退
    const ax = u.x - p.x, ay = u.y - p.y, ad = Math.hypot(ax, ay) || 1;
    const dx = sx * BOSS_CLEAR.side + ax / ad * (1 - BOSS_CLEAR.side), dy = sy * BOSS_CLEAR.side + ay / ad * (1 - BOSS_CLEAR.side), d = Math.hypot(dx, dy) || 1;
    return { index, dx: dx / d, dy: dy / d };
  });
}
