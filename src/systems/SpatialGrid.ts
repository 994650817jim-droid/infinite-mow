/**
 * 轻量空间网格：索敌、分离、范围伤害都走这里，避免 O(n²)。
 * 每帧 clear + insert；查询只遍历目标格及其邻格。
 * 格键用整数（cx、cy 各偏移后打包），避免每次插入 / 查询都拼字符串（150 敌 × 每帧数千次查询格的 GC 压力）。
 */
const KEY_OFFSET = 1 << 15;
const KEY_SPAN = 1 << 16;
const ascending = (a: number, b: number): number => a - b;

export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cell: number;
  private readonly cells = new Map<number, T[]>();
  private readonly bucketPool: T[][] = [];
  private readonly keyScratch: number[] = [];

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
    if (!this.cells.size) return out;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c);
    const y1 = Math.floor((y + r) / c);
    // 查询范围的格数多于已占用格数时（如半径 650 的友军索敌），改为遍历已占用格；
    // 命中的格键升序排列（= cx 升序、cy 升序），返回顺序与逐格查询完全一致。
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > this.cells.size) {
      const keys = this.keyScratch; keys.length = 0;
      for (const key of this.cells.keys()) {
        const cx = Math.floor(key / KEY_SPAN) - KEY_OFFSET, cy = (key % KEY_SPAN) - KEY_OFFSET;
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) keys.push(key);
      }
      if (keys.length > 1) keys.sort(ascending);
      for (const key of keys) for (const item of this.cells.get(key)!) out.push(item);
      return out;
    }
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

  private key(cx: number, cy: number): number {
    return (cx + KEY_OFFSET) * KEY_SPAN + (cy + KEY_OFFSET);
  }
}
