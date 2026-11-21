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
/** 这一仗在天下地图上的关卡节点 id（主线章节 / 篇章 / 支线 / 挑战）；攻城 / 军情没有节点返回 null。 */
export function battleNodeId(key: string): string | null { return WORLD_NODES.find(x => x.chapter === key || x.campaign === key || x.side === key || x.challenge === key)?.id ?? null; }
/** 战败退守后出城（TownScene / CityScene 回天下地图）：选中这一仗的关卡节点，没有节点（攻城 / 守城）就选那座城。返回 true = 处理了。 */
export function takeRetreatReturn(reg: { get(k: string): unknown; set(k: string, v: unknown): unknown; remove(k: string): unknown }): boolean {
  const r = reg.get('retreatReturn') as { node?: string | null; city?: string | null } | undefined; if (!r) return false; reg.remove('retreatReturn');
  if (r.node) { reg.set('mapFocusNode', r.node); reg.remove('mapFocusCity'); return true; }
  if (r.city) { reg.set('mapFocusCity', r.city); return true; }
  return false;
}
/** 败退进城后的一条提示（城里 / 营寨的 toast）。 */
export function retreatToast(r: { stage?: string; name?: string; notes?: string[] }): string {
  return `【${r.stage ?? ''}】失利，全军退守${r.name ?? ''}` + (r.notes?.length ? '\n' + r.notes.join(' · ') : '') + '\n军医可先治伤；回天下地图再出征（已选中这一仗），开打前先整军（招兵、军医）';
}
/** exclude：不退到这座城（守城战败：刚没守住的城不算退守去处，2026-11-20）。 */
export function retreatTarget(at: { x: number; y: number } | null, exclude?: string | null): RetreatTarget {
  const home: RetreatTarget = { kind: 'home', id: HOME.id, name: '义军营寨' };
  if (!at) return home;
  let best = home, bd = Math.hypot(HOME.x - at.x, HOME.y - at.y);
  for (const id of ownedCities()) { if (id === exclude) continue; const c = CITIES.find(x => x.id === id); if (!c) continue; const d = Math.hypot(c.x - at.x, c.y - at.y); if (d < bd) { bd = d; best = { kind: 'city', id: c.id, name: c.name }; } }
  return best;
}
