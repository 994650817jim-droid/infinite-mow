/**
 * 敌兵绕障导航（2026-11-20 用户「小怪逻辑有问题，会卡在栏杆」，1-3 广宗决战）：
 * 原来近战兵直线朝主将走，碰到栅栏 / 营栅 / 城墙等碰撞框只被推出来——迎面撞上就卡在栏杆后面。
 * 这里以主将为中心铺一张网格（FLOW.cols × FLOW.rows 格，每格 FLOW.cell 像素），每 FLOW.everyMs 毫秒：
 *  ① 把障碍画进格子（碰撞框按敌兵半径外扩；地形 / 营寨 / 场地边界等按格心逐格查）；
 *  ② 从主将所在格做一次 8 向 Dijkstra（斜走不切角），得到每格到主将的路程。
 * 全场近战兵共用这一张图：到主将的连线上没有挡路格的照旧直走；被挡的顺着路程下降最快的方向绕过去。
 * 到不了的格（例如城门没破的整面城墙后）不给方向 → 保持原来的直走，不会穿墙，也不影响「城门未破墙内只刷远程」。
 * 附近一个障碍都没有时整张图停用，不额外花时间。
 */
export interface FlowBox { left: number; right: number; top: number; bottom: number }
export const FLOW = { cell: 48, cols: 72, rows: 56, everyMs: 300, radius: 18 } as const;

const INF = 1e9, DIRS: ReadonlyArray<readonly [number, number, number]> = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export class EnemyFlowField {
  private readonly n = FLOW.cols * FLOW.rows;
  private readonly solid = new Uint8Array(this.n);
  private readonly dist = new Float32Array(this.n);
  private readonly heap = new Int32Array(this.n * 8); private readonly heapKey = new Float32Array(this.n * 8);
  private ox = 0; private oy = 0; private tx = 0; private ty = 0; private at = -INF; private live = false;
  readonly stats = { builds: 0, ms: 0, solid: 0, steered: 0 };

  /** 是否在用（附近有障碍）。 */
  get active(): boolean { return this.live; }

  /**
   * 每帧调；到点（或主将走出一格以上且距上次 ≥ 0.1 秒）才重算。
   * boxes：碰撞框；extra：碰撞框以外的挡路查询（地形、营寨、场地边界），可省。
   */
  update(now: number, px: number, py: number, boxesOf: () => readonly FlowBox[], extra?: ((x: number, y: number, r: number) => boolean) | null): void {
    const moved = Math.hypot(px - this.tx, py - this.ty) > FLOW.cell;
    if (now < this.at && !(moved && now > this.at - FLOW.everyMs + 100)) return;
    this.at = now + FLOW.everyMs;
    const t0 = performance.now(), C = FLOW.cell, W = FLOW.cols, H = FLOW.rows, r = FLOW.radius;
    this.ox = Math.floor(px / C) * C - (W >> 1) * C; this.oy = Math.floor(py / C) * C - (H >> 1) * C; this.tx = px; this.ty = py;
    const x1 = this.ox + W * C, y1 = this.oy + H * C;
    this.solid.fill(0); let count = 0;
    // ① 碰撞框：外扩半径后覆盖到的格
    for (const b of boxesOf()) {
      const l = b.left - r, rt = b.right + r, t = b.top - r, bt = b.bottom + r;
      if (rt < this.ox || l > x1 || bt < this.oy || t > y1) continue;
      const c0 = Math.max(0, Math.floor((l - this.ox) / C)), c1 = Math.min(W - 1, Math.floor((rt - this.ox) / C));
      const r0 = Math.max(0, Math.floor((t - this.oy) / C)), r1 = Math.min(H - 1, Math.floor((bt - this.oy) / C));
      for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
        const cx = this.ox + (col + .5) * C, cy = this.oy + (row + .5) * C;
        if (cx > l && cx < rt && cy > t && cy < bt) { const i = row * W + col; if (!this.solid[i]) { this.solid[i] = 1; count++; } }
      }
    }
    // ② 其他挡路（地形、营寨、场地边界）：逐格查格心
    if (extra) for (let i = 0; i < this.n; i++) if (!this.solid[i] && extra(this.ox + ((i % W) + .5) * C, this.oy + (Math.floor(i / W) + .5) * C, r)) { this.solid[i] = 1; count++; }
    this.stats.solid = count;
    this.live = count > 0;
    if (this.live) this.dijkstra(Math.floor((px - this.ox) / C), Math.floor((py - this.oy) / C));
    this.stats.builds++; this.stats.ms = performance.now() - t0;
  }

  private dijkstra(sc: number, sr: number): void {
    const W = FLOW.cols, H = FLOW.rows, dist = this.dist, solid = this.solid, heap = this.heap, key = this.heapKey;
    dist.fill(INF);
    if (sc < 0 || sr < 0 || sc >= W || sr >= H) { this.live = false; return; }
    let size = 0;
    const push = (i: number, k: number): void => { let j = size++; while (j > 0) { const p = (j - 1) >> 1; if (key[p] <= k) break; heap[j] = heap[p]; key[j] = key[p]; j = p; } heap[j] = i; key[j] = k; };
    const pop = (): number => { const top = heap[0], li = heap[--size], lk = key[size]; let j = 0; for (;;) { let c = 2 * j + 1; if (c >= size) break; if (c + 1 < size && key[c + 1] < key[c]) c++; if (key[c] >= lk) break; heap[j] = heap[c]; key[j] = key[c]; j = c; } heap[j] = li; key[j] = lk; return top; };
    const s = sr * W + sc; dist[s] = 0; push(s, 0); // 主将格本身被判挡路（贴墙站）也从它出发
    while (size > 0) {
      const kk = key[0], i = pop(); if (kk > dist[i]) continue;
      const col = i % W, row = (i - col) / W;
      for (const [dc, dr, w] of DIRS) {
        const c2 = col + dc, r2 = row + dr; if (c2 < 0 || r2 < 0 || c2 >= W || r2 >= H) continue;
        const j = r2 * W + c2; if (solid[j]) continue;
        if (dc && dr && (solid[row * W + c2] || solid[r2 * W + col])) continue; // 斜走不切角
        const nd = dist[i] + w; if (nd < dist[j] && size < heap.length) { dist[j] = nd; push(j, nd); }
      }
    }
  }

  /**
   * 近战兵在 (x, y) 该往哪走：返回 true 并写 out（单位向量）= 需要绕路；false = 直走即可（没障碍、出了网格、到不了或直线就是近路）。
   */
  steer(x: number, y: number, out: { x: number; y: number }): boolean {
    if (!this.live) return false;
    const C = FLOW.cell, W = FLOW.cols, H = FLOW.rows, col = Math.floor((x - this.ox) / C), row = Math.floor((y - this.oy) / C);
    if (col < 0 || row < 0 || col >= W || row >= H) return false;
    const i = row * W + col; let here = this.dist[i];
    // 贴墙时格子可能被判挡路：取邻格里最近的作为当前路程
    if (here >= INF) { for (const [dc, dr, w] of DIRS) { const c2 = col + dc, r2 = row + dr; if (c2 < 0 || r2 < 0 || c2 >= W || r2 >= H) continue; const d = this.dist[r2 * W + c2] + w; if (d < here) here = d; } if (here >= INF) return false; }
    if (this.clearLine(x, y, i)) return false; // 到主将的连线上没有挡路格：直走（保持原来的手感）
    // 顺着路程下降最快的方向走两格，朝第二格去（少走锯齿、不贴着栅栏端头蹭）
    const next = (c: number, r: number, d: number): number => { let best = -1, bd = d; for (const [dc, dr] of DIRS) {
      const c2 = c + dc, r2 = r + dr; if (c2 < 0 || r2 < 0 || c2 >= W || r2 >= H) continue;
      const j = r2 * W + c2; if (this.solid[j] || this.dist[j] >= bd) continue;
      if (dc && dr && (this.solid[r * W + c2] || this.solid[r2 * W + c])) continue;
      bd = this.dist[j]; best = j; } return best; };
    const b1 = next(col, row, here); if (b1 < 0) return false;
    const b2 = next(b1 % W, Math.floor(b1 / W), this.dist[b1]), best = b2 >= 0 ? b2 : b1;
    const bx = this.ox + ((best % W) + .5) * C - x, by = this.oy + (Math.floor(best / W) + .5) * C - y, m = Math.hypot(bx, by) || 1;
    out.x = bx / m; out.y = by / m; this.stats.steered++;
    return true;
  }
  /** (x, y) 到主将的连线（每半格取一点）有没有挡路格；起点格不算（贴墙站的兵自己那格可能被判挡路）。 */
  private clearLine(x: number, y: number, start: number): boolean {
    const C = FLOW.cell, W = FLOW.cols, H = FLOW.rows, dx = this.tx - x, dy = this.ty - y, steps = Math.ceil(Math.hypot(dx, dy) / (C * .5));
    for (let k = 1; k < steps; k++) {
      const px = x + dx * k / steps, py = y + dy * k / steps, col = Math.floor((px - this.ox) / C), row = Math.floor((py - this.oy) / C);
      if (col < 0 || row < 0 || col >= W || row >= H) return true; // 出了网格：网格外不管
      const j = row * W + col; if (j !== start && this.solid[j]) return false;
    }
    return true;
  }
  /** 测试 / 调试：某点到主将的网格路程（像素，到不了 = Infinity）。 */
  pathLength(x: number, y: number): number { const C = FLOW.cell, col = Math.floor((x - this.ox) / C), row = Math.floor((y - this.oy) / C); if (col < 0 || row < 0 || col >= FLOW.cols || row >= FLOW.rows) return Infinity; const d = this.dist[row * FLOW.cols + col]; return d >= INF ? Infinity : d * C; }
  clear(): void { this.live = false; this.at = -INF; this.stats.builds = this.stats.steered = 0; }
}
