import Phaser from 'phaser';
import { burningDecor } from './FireProps';
import { actorDepth } from '../config';
import { terrainConfigFor, type Pt } from '../data/terrain';

/**
 * 5-2 赤壁：北岸的曹军水寨布景（全场景审查 P1「赤壁一格水都没有」）。江面本身是 Terrain 的河（data/terrain.ts 'chibi' 2），
 * 这里沿北岸排一溜营栅、望楼、营帐、军旗（曹军营具图集 props_v2_cao；缺图用通用营具 yellow_props 染色），留出两座浮桥的桥头。
 * 水寨只是布景：不加碰撞（北岸本来就隔着江，过江要涉水或走浮桥）。
 * 战船（场景审查 P3，美术风格会话出图 scene-v2/warships.png，2×2 每格 512：楼船 / 斗舰 / 双层楼船 / 三桅战船，船头朝右）：
 * 泊在江北半幅、首尾相连（连环船），躲开两座浮桥；船身进场景碰撞框（不能从船上穿过去），江南半幅照常涉水。
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

export function chibiRiverCamp(scene: Phaser.Scene, boxes?: Array<{ left: number; right: number; top: number; bottom: number }>): Phaser.GameObjects.Image[] {
  const river = terrainConfigFor('chibi', 2)?.rivers?.[0]; if (!river) return [];
  const v2 = scene.textures.exists(CAO), out: Phaser.GameObjects.Image[] = [];
  const landings = river.bridges.map(b => along(river.points, b.at).x);
  let i = 0;
  for (let x = -1700; x <= 1700; x += 210) {
    if (landings.some(l => Math.abs(x - l) < 170)) continue; // 浮桥桥头留空
    const r = ROW[i++ % ROW.length], y = riverY(river.points, x) - river.width / 2 - 70 + r.dy;
    // 火盆：燃烧序列帧循环（江北够不着，只放动画；用户 11-19「火盘也要做那种燃烧的动画」）
    const fire = r.f === 7 ? burningDecor(scene, x, y, r.size, 'brazier', 'chibi-river-camp') : null; if (fire) { out.push(fire); continue; }
    const img = v2 ? scene.add.image(x, y, CAO, r.f) : scene.add.image(x, y, 'yellow_props', FALLBACK[r.f] ?? 12).setTint(0xc89080);
    img.setOrigin(.5, 1).setDisplaySize(r.size, r.size).setDepth(actorDepth(y)).setName('chibi-river-camp');
    out.push(img);
  }
  placeWarships(scene, river.points, river.width, landings, boxes, out);
  return out;
}

const SHIPS = { key: 'scene_v2_warships', file: 'assets/scene-v2/warships.png', cell: 512 } as const;
/** 连环战船：江北半幅一溜，每三艘一组用铁链相连；船身碰撞框（宽 ×0.7、高 ×0.32）。 */
function placeWarships(scene: Phaser.Scene, points: readonly Pt[], width: number, landings: number[], boxes: Array<{ left: number; right: number; top: number; bottom: number }> | undefined, out: Phaser.GameObjects.Image[]): void {
  const spots: Array<{ x: number; f: number; size: number }> = [];
  let i = 0;
  for (let x = -1640; x <= 1640; x += 300) { if (landings.some(l => Math.abs(x - l) < 260)) continue; spots.push({ x, f: [0, 2, 1, 3][i % 4], size: i % 4 === 0 ? 330 : 290 }); i++; }
  const make = (): void => {
    for (const sp of spots) {
      const y = riverY(points, sp.x) - width * .22, img = scene.add.image(sp.x, y, SHIPS.key, sp.f).setOrigin(.5, .55).setDisplaySize(sp.size, sp.size).setDepth(actorDepth(y)).setName('chibi-warship');
      out.push(img); boxes?.push({ left: sp.x - sp.size * .35, right: sp.x + sp.size * .35, top: y - sp.size * .16, bottom: y + sp.size * .16 });
    }
  };
  if (scene.textures.exists(SHIPS.key)) make();
  else { scene.load.spritesheet(SHIPS.key, SHIPS.file, { frameWidth: SHIPS.cell, frameHeight: SHIPS.cell }); scene.load.once('filecomplete-spritesheet-' + SHIPS.key, () => { if (scene.sys.isActive()) make(); }); if (!scene.load.isLoading()) scene.load.start(); }
}
