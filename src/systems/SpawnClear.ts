/**
 * 刷兵避开障碍（全场景审查 F，2026-11-18）：刷兵点落在场景碰撞框（sishuiObstacles.footprints：关墙、营栅、洪水场地边界、
 * 突围谷壁、山道崖壁……）里时，挪到最近的框边——优先朝主将那一侧出来（不然 SishuiObstacles 每帧按最浅方向推，
 * 厚墙里的兵会被推到墙外、永远走不进场地）。
 */
type Box = { left: number; right: number; top: number; bottom: number };

/** 挪出障碍后离框边再留这么多空地（全面检查 #7：只留身体半径时兵贴着墙冒出来）。 */
const CLEAR = 34;
const inside = (b: Box, x: number, y: number, r: number): boolean => x > b.left - r && x < b.right + r && y > b.top - r && y < b.bottom + r;

/** 点在任一框里就挪出来：每次换到「不在任何框里、离 toward 最近」的那条边外；最多挪 6 次。 */
export function freeSpawn(boxes: readonly Box[], x: number, y: number, r: number, toward: { x: number; y: number }): { x: number; y: number; moved: boolean } {
  let moved = false;
  for (let pass = 0; pass < 6; pass++) {
    const b = boxes.find(o => inside(o, x, y, r)); if (!b) break;
    const pad = r + CLEAR;
    const cands = [{ x: b.left - pad, y }, { x: b.right + pad, y }, { x, y: b.top - pad }, { x, y: b.bottom + pad }];
    const free = cands.filter(c => !boxes.some(o => inside(o, c.x, c.y, r)));
    const pool = free.length ? free : cands, d = (c: { x: number; y: number }) => Math.hypot(c.x - toward.x, c.y - toward.y);
    const best = pool.reduce((a, c) => d(c) < d(a) ? c : a);
    x = best.x; y = best.y; moved = true;
  }
  return { x, y, moved };
}
