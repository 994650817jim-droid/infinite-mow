import Phaser from 'phaser';

/**
 * 渲染小改动（2026-11-20 夜间性能优化）：
 * Phaser 的 Graphics.fillPath / fillRoundedRect / fillPoints 每帧都会把整条路径重新交给 earcut 三角剖分（HUD、血条、范围圈这类每帧重放的图形一帧里就有上百条）。
 * 这些路径几乎都是凸的（圆角矩形、圆、扇形、菱形），凸多边形用「扇形三角化」就够了，O(n) 且不分配；凹的仍走原来的 earcut，画面不变。
 * 压测里 earcut 占一帧约 7%、整个 Graphics 渲染约 18%。
 */
let installed = false;
type Pt = { x: number; y: number };
export function isConvex(path: Pt[]): boolean {
  const n = path.length; if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n], c = path[(i + 2) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue; // 共线 / 重复点：不影响凸性
    const s = cross > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return sign !== 0;
}
export function installFastFill(): void {
  if (installed) return; installed = true;
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
