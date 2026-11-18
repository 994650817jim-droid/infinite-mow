import Phaser from 'phaser';
import { actorDepth } from '../config';
import { terrainConfigFor, type Pt } from '../data/terrain';

/**
 * 5-2 赤壁：北岸的曹军水寨布景（全场景审查 P1「赤壁一格水都没有」）。江面本身是 Terrain 的河（data/terrain.ts 'chibi' 2），
 * 这里沿北岸排一溜营栅、望楼、营帐、军旗（曹军营具图集 props_v2_cao；缺图用通用营具 yellow_props 染色），留出两座浮桥的桥头。
 * 只是布景：不加碰撞（北岸本来就隔着江，过江要涉水或走浮桥）。战船还没有图，等美术出了再加。
 */
const CAO = 'props_v2_cao';
/** 营具图集帧：0 营门 1 望楼 2 营帐 3 营栅 4 粮箱 5 兵器架 6 军旗 7 火盆 */
const ROW: Array<{ f: number; size: number; dy: number }> = [
  { f: 3, size: 170, dy: 0 }, { f: 1, size: 200, dy: -40 }, { f: 3, size: 170, dy: 0 }, { f: 6, size: 150, dy: 10 },
  { f: 3, size: 170, dy: 0 }, { f: 2, size: 200, dy: -70 }, { f: 3, size: 170, dy: 0 }, { f: 7, size: 110, dy: 20 },
];
const FALLBACK: Record<number, number> = { 3: 12, 1: 2, 6: 5, 2: 1, 7: 29 };

/** 折线上按长度比例取点（同 Terrain 算桥位）。 */
function along(points: readonly Pt[], t: number): Pt {
  const segs = points.slice(1).map((p, i) => ({ a: points[i], b: p, len: Math.hypot(p.x - points[i].x, p.y - points[i].y) }));
  let d = t * segs.reduce((n, s) => n + s.len, 0);
  for (const s of segs) { if (d <= s.len) { const k = d / s.len; return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k }; } d -= s.len; }
  return points[points.length - 1];
}
/** 江心在 x 处的 y（折线插值）。 */
function riverY(points: readonly Pt[], x: number): number {
  for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i]; if (x >= a.x && x <= b.x) return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x); }
  return points[x < points[0].x ? 0 : points.length - 1].y;
}

export function chibiRiverCamp(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const river = terrainConfigFor('chibi', 2)?.rivers?.[0]; if (!river) return [];
  const v2 = scene.textures.exists(CAO), out: Phaser.GameObjects.Image[] = [];
  const landings = river.bridges.map(b => along(river.points, b.at).x);
  let i = 0;
  for (let x = -1700; x <= 1700; x += 210) {
    if (landings.some(l => Math.abs(x - l) < 170)) continue; // 浮桥桥头留空
    const r = ROW[i++ % ROW.length], y = riverY(river.points, x) - river.width / 2 - 70 + r.dy;
    const img = v2 ? scene.add.image(x, y, CAO, r.f) : scene.add.image(x, y, 'yellow_props', FALLBACK[r.f] ?? 12).setTint(0xc89080);
    img.setOrigin(.5, 1).setDisplaySize(r.size, r.size).setDepth(actorDepth(y)).setName('chibi-river-camp');
    out.push(img);
  }
  return out;
}
