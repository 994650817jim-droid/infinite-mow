import { CITIES, HOME, MAP_H, MAP_W, cityById } from './WorldCities';
import { WORLD_NODES } from './WorldNodes';
import { ownedCities } from './WorldStore';

/**
 * 战败撤回（data/defeatFlow.ts）：退到离这一仗最近的我方城池，或者义军营寨。
 * 位置按 V1 天下地图：主线章节 / 篇章 / 支线 / 挑战关用地图节点，攻城 / 军情用那座城；都找不到时退回营寨。
 */
export interface RetreatTarget { kind: 'city' | 'home'; id: string; name: string }
/** 这一仗在地图上的位置（地图像素）。key = 章节 / 篇章 / 支线 id（GameScene.hardKey）；city = 攻城 / 军情的城。 */
export function battlePoint(key: string, city?: string | null): { x: number; y: number } | null {
  const c = city ? cityById(city) : undefined; if (c) return { x: c.x, y: c.y };
  const n = WORLD_NODES.find(x => x.chapter === key || x.campaign === key || x.side === key || x.challenge === key);
  return n ? { x: n.x * MAP_W, y: n.y * MAP_H } : null;
}
/** exclude：不退到这座城（守城战败：刚没守住的城不算退守去处，2026-11-20）。 */
export function retreatTarget(at: { x: number; y: number } | null, exclude?: string | null): RetreatTarget {
  const home: RetreatTarget = { kind: 'home', id: HOME.id, name: '义军营寨' };
  if (!at) return home;
  let best = home, bd = Math.hypot(HOME.x - at.x, HOME.y - at.y);
  for (const id of ownedCities()) { if (id === exclude) continue; const c = CITIES.find(x => x.id === id); if (!c) continue; const d = Math.hypot(c.x - at.x, c.y - at.y); if (d < bd) { bd = d; best = { kind: 'city', id: c.id, name: c.name }; } }
  return best;
}
