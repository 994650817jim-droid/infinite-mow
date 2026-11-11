/**
 * 轻量空间网格：索敌、分离、范围伤害都走这里，避免 O(n²)。
 * 每帧 clear + insert；查询只遍历目标格及其邻格。
 */
export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cell: number;
  private readonly cells = new Map<string, T[]>();
  private readonly bucketPool: T[][] = [];

  constructor(cellSize = 48) {
    this.cell = cellSize;
  }

  clear(): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.bucketPool.push(bucket);
    }
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cell), Math.floor(item.y / this.cell));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(item);
    else {
      const reusable = this.bucketPool.pop() ?? [];
      reusable.push(item);
      this.cells.set(key, reusable);
    }
  }

  /** 返回以 (x,y) 为中心、半径 r 内可能命中的对象（含少量邻格冗余）。 */
  query(x: number, y: number, r: number, out: T[] = []): T[] {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c);
    const y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) {
          for (const item of bucket) out.push(item);
        }
      }
    }
    return out;
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }
}
