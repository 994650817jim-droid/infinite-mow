/**
 * 天下地图 v2「征途」路线（2026-11-19 用户批准：「B方案 但是还是有战争迷雾，还有章节应该在历史事件对应的地方」「1可以」）。
 * 设计稿：side-session-notes/world-map-redesign.md。
 * - 地图坐标同 strategy-map（1536×1024）；主线关沿用 ChapterTimeline.STAGE_POINTS（史事发生地），按章节时序连成一条路：营寨 → 1-1 → … → 12-3。
 * - 攻城点 = 每座城池，挂在一个主线关后面（该城所属章节里离它最近的一关；没分章的城挂全图最近的一关）。
 *   规则 B：挂靠的主线关打下即可攻；规则 C：不再要求与我方城池相邻。
 * - 挑战「三英战吕布」挂在虎牢关（汜水关与洛阳之间），开放条件沿用 LUBU_CHALLENGE（通关第二章）。
 * - 迷雾：哪些点露出来全由进度算出（不新增存档字段），见 routeView。
 * 纯数据 / 纯函数：不读写存档（WorldStore 会 import 这里，避免循环依赖）。
 */
import { CITIES, HOME, cityAttackable, type CityDef } from './WorldCities';
import { GAUNTLET } from '../data/gauntlet';
import { CHAPTER_TIMELINE, CITY_CHAPTER, STAGE_POINTS, chapterStagesDone, stageOpen, type TimelineChapterId, type TimelineProgress } from './ChapterTimeline';

/**
 * 天下地图用哪一版（2026-11-19 用户要求先回到旧版 V1 上线）：
 * - 'v1'（缺省）：旧版天下地图 WorldMapSceneV1（注册成 'WorldMapScene'）；攻城 = 规则 B（挂靠的主线关打下）+ 与我方领地相邻；
 * - 'v2'：「征途」路线图 WorldMapScene；攻城 = 规则 B + 规则 C（不要求相邻）。
 * 开发时网址加 ?map=v2 可切到 v2（测试 test-route-map / test-map-depart-v2 用）。
 */
export const WORLD_MAP_VERSION: 'v1' | 'v2' = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('map') === 'v2' ? 'v2' : 'v1'; } catch { return 'v1'; } })();

export type RouteKind = 'camp' | 'stage' | 'siege' | 'challenge';
export interface RouteNode {
  id: string; kind: RouteKind; x: number; y: number;
  /** 主线关所属章节与关号（1–3）。 */
  chapter?: TimelineChapterId; stage?: 1 | 2 | 3;
  /** 攻城点的城池 id。 */
  city?: string;
  /** 挂在哪个点后面（主线 = 上一关；支线 = 挂靠的主线关）。 */
  after?: string;
  boss?: boolean;
}
/** 虎牢关（汜水关与洛阳之间，地图坐标）。 */
export const HULAO_PASS = { x: 742, y: 318 } as const;

const stageId = (c: TimelineChapterId, k: number): string => `${c}-${k}`;
function build(): { nodes: RouteNode[]; main: string[] } {
  const nodes: RouteNode[] = [{ id: 'camp', kind: 'camp', x: HOME.x, y: HOME.y }], main = ['camp'];
  let prev = 'camp';
  for (const c of CHAPTER_TIMELINE) STAGE_POINTS[c.id].forEach((p, i) => {
    const id = stageId(c.id, i + 1); nodes.push({ id, kind: 'stage', x: p.x, y: p.y, chapter: c.id, stage: (i + 1) as 1 | 2 | 3, after: prev, boss: i === 2 }); main.push(id); prev = id;
  });
  const stages = nodes.filter(n => n.kind === 'stage');
  const nearest = (c: CityDef, list: RouteNode[]): RouteNode => list.reduce((a, b) => Math.hypot(b.x - c.x, b.y - c.y) < Math.hypot(a.x - c.x, a.y - c.y) ? b : a);
  for (const c of CITIES) {
    const ch = CITY_CHAPTER[c.id], pool = ch ? stages.filter(s => s.chapter === ch) : stages;
    // 城址与主线关太近（如汜水关城与 2-1 汜水关）：攻城点往外挪开，免得两个图标叠在一起
    let x = c.x, y = c.y; const near = nearest(c, stages), d = Math.hypot(x - near.x, y - near.y);
    if (d < 62) { const ux = d > 1 ? (x - near.x) / d : 0, uy = d > 1 ? (y - near.y) / d : 1; x = near.x + ux * 62; y = near.y + uy * 62; }
    nodes.push({ id: 'siege-' + c.id, kind: 'siege', x, y, city: c.id, after: nearest(c, pool).id });
  }
  nodes.push({ id: 'lubu', kind: 'challenge', x: HULAO_PASS.x, y: HULAO_PASS.y, after: stageId('hulao', 3) });
  // 名将连战入口（data/gauntlet.ts）：开关开着才有这个点（关着时天下地图和原来一模一样）；第二章打完开放
  nodes.push({ id: 'gauntlet', kind: 'challenge', x: HULAO_PASS.x + GAUNTLET.entry.dx, y: HULAO_PASS.y + GAUNTLET.entry.dy }); // 11-22 一开始就能玩：不看开关、不看通关
  return { nodes, main };
}
const BUILT = build();
export const ROUTE_NODES: readonly RouteNode[] = BUILT.nodes;
/** 主线顺序：营寨、1-1 … 12-3。 */
export const MAIN_ROUTE: readonly string[] = BUILT.main;
export function routeNode(id: string): RouteNode | undefined { return ROUTE_NODES.find(n => n.id === id); }
export function siegeNodeOf(cityId: string): RouteNode | undefined { return ROUTE_NODES.find(n => n.kind === 'siege' && n.city === cityId); }
export function stageNode(c: TimelineChapterId, k: number): RouteNode | undefined { return routeNode(stageId(c, k)); }

/** 某点是否已打下（营寨视为已打下）。挑战 / 攻城不在这里算。 */
export function stageCleared(n: RouteNode, s: TimelineProgress): boolean {
  if (n.kind === 'camp') return true;
  return n.kind === 'stage' && !!n.chapter && !!n.stage && n.stage <= chapterStagesDone(n.chapter, s);
}
/** 主线关可出征（沿用 ChapterTimeline.stageOpen：本章已开放且前一关告捷）。 */
export function stageAvailable(n: RouteNode, s: TimelineProgress): boolean {
  return n.kind === 'stage' && !!n.chapter && !!n.stage && stageOpen(n.chapter, n.stage, s);
}
/** 规则 B：攻城点挂靠的主线关打下即可攻（不再要求整章通关、不再要求相邻）。 */
export function siegeUnlocked(cityId: string, s: TimelineProgress): boolean {
  const n = siegeNodeOf(cityId), a = n?.after ? routeNode(n.after) : undefined;
  return !!a && stageCleared(a, s);
}
/** 可出征攻城：已开放、且不是我方城池；V1 还要与我方领地相邻（v2 规则 C 不要求）。 */
export function routeSiegeOpen(cityId: string, s: TimelineProgress, owned: readonly string[]): boolean {
  return !owned.includes(cityId) && siegeUnlocked(cityId, s) && (WORLD_MAP_VERSION === 'v2' || cityAttackable(cityId, owned));
}
/** 攻城点挂靠的主线关（显示「打下 X-Y 后开放」用）。 */
export function siegeGateStage(cityId: string): RouteNode | undefined {
  const n = siegeNodeOf(cityId); return n?.after ? routeNode(n.after) : undefined;
}

export type NodeVis = 'cleared' | 'open' | 'faint' | 'hidden';
export interface RouteView {
  vis: Map<string, NodeVis>;
  /** 全图唯一的「下一战」：第一个可出征而未打下的主线关（全通关时为空）。 */
  next?: string;
  /** 迷雾揭开圆（地图坐标）。 */
  holes: Array<{ x: number; y: number; r: number; id: string }>;
}
export interface RouteState { progress: TimelineProgress; owned: readonly string[]; alerts: readonly string[]; challengeOpen: boolean; challengeCleared: boolean; testRun?: boolean }
/** 揭开半径（地图像素）：主线打下后揭开一大片，可打的点露出它周围。 */
export const REVEAL = { camp: 125, cleared: 105, open: 80, faint: 34, siege: 62, challenge: 58 } as const;

/**
 * 迷雾与节点状态（全由进度算出）：
 * - 主线：打下的 cleared；可出征的 open；open 之后的下一关 faint（淡墨白描，压在迷雾边上）；其余 hidden。
 * - 攻城：我方 / 告急的城一直露出；挂靠的主线关打下后露出（open，或已是我方则 cleared）；否则 hidden。
 * - 挑战：挂靠关打下且开放条件满足 → open（打过 → cleared）。
 */
export function routeView(st: RouteState): RouteView {
  const s = st.progress, vis = new Map<string, NodeVis>(), holes: RouteView['holes'] = [];
  let next: string | undefined, faintSet = false;
  for (const id of MAIN_ROUTE) {
    const n = routeNode(id)!;
    if (n.kind === 'camp') { vis.set(id, 'cleared'); holes.push({ x: n.x, y: n.y, r: REVEAL.camp, id }); continue; }
    if (stageCleared(n, s)) { vis.set(id, 'cleared'); holes.push({ x: n.x, y: n.y, r: REVEAL.cleared, id }); continue; }
    if (stageAvailable(n, s) || st.testRun) { vis.set(id, 'open'); holes.push({ x: n.x, y: n.y, r: REVEAL.open, id }); if (!next) next = id; continue; }
    // 第一个还没开放的关：只在它紧挨着前一个已露出的关时淡墨显示
    const prev = n.after ? vis.get(n.after) : undefined;
    if (!faintSet && (prev === 'open' || prev === 'cleared')) { vis.set(id, 'faint'); holes.push({ x: n.x, y: n.y, r: REVEAL.faint, id }); faintSet = true; continue; }
    vis.set(id, 'hidden');
  }
  for (const n of ROUTE_NODES) {
    if (n.kind === 'siege' && n.city) {
      const mine = st.owned.includes(n.city), alert = st.alerts.includes(n.city);
      const v: NodeVis = mine || alert ? 'cleared' : siegeUnlocked(n.city, s) || st.testRun ? 'open' : 'hidden';
      vis.set(n.id, v); if (v !== 'hidden') holes.push({ x: n.x, y: n.y, r: REVEAL.siege, id: n.id });
    } else if (n.kind === 'challenge' && n.id === 'gauntlet') {
      const a = n.after ? routeNode(n.after) : undefined, v: NodeVis = !a || stageCleared(a, s) || st.testRun ? 'open' : 'hidden';
      vis.set(n.id, v); if (v !== 'hidden') holes.push({ x: n.x, y: n.y, r: REVEAL.challenge, id: n.id });
    } else if (n.kind === 'challenge') {
      const a = n.after ? routeNode(n.after) : undefined, v: NodeVis = st.challengeCleared ? 'cleared' : (st.challengeOpen || st.testRun) && (!a || stageCleared(a, s) || st.testRun) ? 'open' : 'hidden';
      vis.set(n.id, v); if (v !== 'hidden') holes.push({ x: n.x, y: n.y, r: REVEAL.challenge, id: n.id });
    }
  }
  return { vis, next, holes };
}
/** 某点所属章节（主线关 = 本章；支线 = 挂靠关的章节；营寨无）。 */
export function nodeChapter(n: RouteNode): TimelineChapterId | undefined {
  if (n.chapter) return n.chapter;
  const a = n.after ? routeNode(n.after) : undefined; return a?.chapter;
}
