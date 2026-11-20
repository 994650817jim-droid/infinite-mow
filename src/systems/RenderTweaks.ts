import Phaser from 'phaser';

/**
 * 渲染小改动（2026-11-20 夜间性能优化）：
 * Phaser 的 Graphics.fillPath / fillRoundedRect / fillPoints 每帧都会把整条路径重新交给 earcut 三角剖分（HUD、血条、范围圈这类每帧重放的图形一帧里就有上百条）。
 * 这些路径几乎都是凸的（圆角矩形、圆、扇形、菱形），凸多边形用「扇形三角化」就够了，O(n) 且不分配；凹的仍走原来的 earcut，画面不变。
 * 压测里 earcut 占一帧约 7%、整个 Graphics 渲染约 18%。
 *
 * 另一处：Graphics.arc（fillCircle / strokeCircle / fillRoundedRect / slice 都走它）在渲染器里固定步长 0.01 → 每段圆弧 100 个点、每点 new 一个 Point（垃圾）。
 * 圆角矩形四个角 400 个点、小圆也 100 个点。这里把 arc 改成按半径自适应的折线（r=6 约 4 点 / 四分之一圆，r≥100 封顶 100 点），线条光滑度肉眼不变，点数和垃圾少一个数量级。
 */
let installed = false;
type Pt = { x: number; y: number };
const scratch: Pt[] = [];
export function isConvex(raw: Pt[]): boolean {
  // 先去掉相邻重复点（圆弧接口处常有），用复用的数组，不产生垃圾
  let n = 0; for (let i = 0; i < raw.length; i++) { const p = raw[i]; if (n && scratch[n - 1].x === p.x && scratch[n - 1].y === p.y) continue; scratch[n++] = p; }
  if (n > 1 && scratch[n - 1].x === scratch[0].x && scratch[n - 1].y === scratch[0].y) n--;
  const path = scratch; if (n < 3) return false;
  let sign = 0, turn = 0;
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n], c = path[(i + 2) % n], ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
    const cross = ux * vy - uy * vx;
    if (Math.abs(cross) < 1e-9) continue; // 共线 / 重复点：不影响凸性
    const s = cross > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false;
    turn += Math.atan2(cross, ux * vx + uy * vy);
  }
  return sign !== 0 && Math.abs(Math.abs(turn) - Math.PI * 2) < .05; // 总转角必须正好一圈（排除五角星这类绕两圈的）
}
/** 圆弧自适应分段：整圆点数 ≈ 6√r，夹在 [12, 100]。 */
export const arcSegments = (radius: number, sweep: number): number => Math.max(2, Math.ceil(Math.min(100, Math.max(12, Math.sqrt(Math.abs(radius)) * 6)) * Math.abs(sweep) / (Math.PI * 2)));
function installFastArc(): void {
  const G = Phaser.GameObjects.Graphics.prototype as unknown as { arc: unknown; lineTo(x: number, y: number): unknown };
  const PI2 = Math.PI * 2;
  G.arc = function (this: { lineTo(x: number, y: number): unknown }, x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false, overshoot = 0) {
    let sweep = endAngle - startAngle; // 与渲染器里同一套归一化
    if (anticlockwise) { if (sweep < -PI2) sweep = -PI2; else if (sweep > 0) sweep = -PI2 + sweep % PI2; } else if (sweep > PI2) sweep = PI2; else if (sweep < 0) sweep = PI2 + sweep % PI2;
    const n = arcSegments(radius, sweep), total = 1 + overshoot;
    for (let i = 0; i < n; i++) { const ta = sweep * (i / n) * total + startAngle; this.lineTo(x + Math.cos(ta) * radius, y + Math.sin(ta) * radius); }
    const te = sweep + startAngle; this.lineTo(x + Math.cos(te) * radius, y + Math.sin(te) * radius);
    return this;
  };
}
export function installFastFill(): void {
  if (installed) return; installed = true; installFastArc();
  const MP = (Phaser.Renderer.WebGL.Pipelines as unknown as { MultiPipeline?: { prototype: Record<string, unknown> } }).MultiPipeline?.prototype;
  const orig = MP?.batchFillPath as ((this: unknown, path: Pt[], cm: unknown, pm: unknown) => void) | undefined; if (!MP || !orig) return;
  MP.batchFillPath = function (this: { renderer: { pipelines: { set(p: unknown): void } }; calcMatrix: { getX(x: number, y: number): number; getY(x: number, y: number): number }; fillTint: { TL: number; TR: number; BL: number }; batchTri: (...a: unknown[]) => void }, path: Pt[], currentMatrix: { }, parentMatrix?: { multiply(m: unknown, out: unknown): void }): void {
    if (path.length < 3 || !isConvex(path)) { orig.call(this, path, currentMatrix, parentMatrix); return; }
    this.renderer.pipelines.set(this);
    const m = this.calcMatrix; if (parentMatrix) parentMatrix.multiply(currentMatrix, m);
    const tl = this.fillTint.TL, tr = this.fillTint.TR, bl = this.fillTint.BL, p0 = path[0], x0 = m.getX(p0.x, p0.y), y0 = m.getY(p0.x, p0.y);
    let x1 = m.getX(path[1].x, path[1].y), y1 = m.getY(path[1].x, path[1].y);
    for (let i = 2; i < path.length; i++) {
      const p = path[i], x2 = m.getX(p.x, p.y), y2 = m.getY(p.x, p.y);
      this.batchTri(null, x0, y0, x1, y1, x2, y2, 0, 0, 1, 1, tl, tr, bl, 2); x1 = x2; y1 = y2;
    }
  } as unknown as typeof MP.batchFillPath;
}
