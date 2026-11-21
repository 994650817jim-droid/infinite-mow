/**
 * 我方单位互相避让（2026-11-21 用户试玩「我方自己的兵会重叠一起」）：部曲、名将随从、义军 / 攻城友军、降将随战和主将之间保持最小间距。
 * 每帧在各单位自己走完之后、障碍推开之前跑一次（障碍最后推，不会把人挤进墙里）：
 *  - 空间网格（ALLY_SEP.cell 一格），每个单位只查自己格和周围 8 格，不做全对全；部曲 30 人 + 随从也只是几十次距离计算；
 *  - 两人间距小于 半径之和 + gap 就各退一半重叠量（主将固定不动，只推别人）；每帧推开量有上限（maxPush 像素 / 秒），软碰撞不抖；
 *  - 完全重合的两人按 id 定一个固定方向分开（不随机，不会每帧换方向）。
 */
export interface SepBody { id: number; x: number; y: number; r: number; fixed?: boolean; move(dx: number, dy: number): void }
export const ALLY_SEP = { cell: 64, gap: 4, maxPush: 240 } as const;

export class AllySeparation {
  private readonly cells = new Map<number, SepBody[]>();
  private readonly pool: SepBody[][] = [];
  readonly stats = { bodies: 0, checks: 0, pushes: 0 };
  /** 推开 bodies 里互相重叠的单位。 */
  resolve(bodies: readonly SepBody[], dt: number): void {
    const C = ALLY_SEP.cell, key = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
    for (const list of this.cells.values()) { list.length = 0; this.pool.push(list); } this.cells.clear();
    for (const b of bodies) { const k = key(Math.floor(b.x / C), Math.floor(b.y / C)); let l = this.cells.get(k); if (!l) { l = this.pool.pop() ?? []; this.cells.set(k, l); } l.push(b); }
    const cap = ALLY_SEP.maxPush * Math.max(dt, 1 / 120);
    this.stats.bodies = bodies.length; this.stats.checks = 0;
    for (const a of bodies) {
      const cx = Math.floor(a.x / C), cy = Math.floor(a.y / C);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const l = this.cells.get(key(gx, gy)); if (!l) continue;
        for (const b of l) {
          if (b.id <= a.id) continue; // 每对只算一次
          this.stats.checks++;
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          const min = a.r + b.r + ALLY_SEP.gap; if (d >= min) continue;
          if (d < .01) { const ang = ((a.id * 73 + b.id * 151) % 360) * Math.PI / 180; dx = Math.cos(ang); dy = Math.sin(ang); d = 1; } else { dx /= d; dy /= d; }
          const over = Math.min(min - (d < .01 ? 0 : d), cap * 2);
          if (a.fixed && b.fixed) continue;
          if (a.fixed) b.move(dx * over, dy * over);
          else if (b.fixed) a.move(-dx * over, -dy * over);
          else { a.move(-dx * over / 2, -dy * over / 2); b.move(dx * over / 2, dy * over / 2); }
          this.stats.pushes++;
        }
      }
    }
  }
}
