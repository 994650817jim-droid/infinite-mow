import { SIDE_REWARD, SIDE_ROUTES, sideRoute, type SideRouteId } from '../data/sideRoutes';
import type { Specialty } from './WorldCities';
import { cityById } from './WorldCities';
import { addProvisions, arcStages, grantCity, ownedCities } from './WorldStore';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { surrenderedIds } from '../systems/SurrenderStore';
import { surrenderDef } from '../data/surrender';
import { REPLAY_CLEARED } from '../data/replayRules';

/**
 * 其他势力支线的存档（other-factions-design.md §1.2）：键 im_side_routes_v1，在存档位里（SaveSlots.PROGRESS_KEYS）；开发期不做老档兼容。
 *   stage：已打过第几关（顺序打）；done：终局已胜（城池并入、特产生效）。
 * 打过的关不能再打（data/replayRules.ts）：劝降一次性，终局没劝降势力之主就是错过了（地图写「已率残部远走」），没有再战。
 * 「已劝降」不另存：读招降名单（SurrenderStore.surrenderedIds，三英战吕布挑战关劝降的吕布也算）。
 */
export const SIDE_KEY = 'im_side_routes_v1';
export interface SideRouteState { stage: number; done: boolean }
type SideSave = Partial<Record<SideRouteId, SideRouteState>>;
const fresh = (): SideRouteState => ({ stage: 0, done: false });
let memory: SideSave | null = null;
function read(): SideSave {
  try { const v = JSON.parse(localStorage.getItem(SIDE_KEY) ?? 'null'); if (v && typeof v === 'object') return v as SideSave; } catch { /* 存储不可用：用会话内存 */ }
  return memory ?? {};
}
function write(s: SideSave): void { memory = s; try { localStorage.setItem(SIDE_KEY, JSON.stringify(s)); } catch { /* 同上 */ } }
export function sideState(id: SideRouteId): SideRouteState {
  const r = sideRoute(id), v = read()[id]; if (!r || !v) return fresh();
  const n = (x: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
  return { stage: n(v.stage, r.stages.length), done: !!v.done };
}
function put(id: SideRouteId, st: SideRouteState): void { const s = read(); s[id] = st; write(s); }

/** 支线开放：主线对应篇章通关（开发测试 ?dev=1 全开）。 */
export function sideRouteOpen(id: SideRouteId): boolean {
  const r = sideRoute(id); if (!r) return false;
  return isChapterTestRun() || arcStages(r.open.arc) >= r.open.stages;
}
/** 这一关能不能打：顺序打，打过的关不能再打（data/replayRules.ts）。 */
export function sideStageOpen(id: SideRouteId, stage: number): boolean {
  const r = sideRoute(id); if (!r || !Number.isInteger(stage) || stage < 1 || stage > r.stages.length || !sideRouteOpen(id)) return false;
  const st = sideState(id); return REPLAY_CLEARED ? st.done || stage <= st.stage + 1 : !st.done && stage === st.stage + 1;
}
/** 下一关（全打完时返回终局，只用于显示）。 */
export function sideNextStage(id: SideRouteId): number { const r = sideRoute(id)!, st = sideState(id); return st.done ? r.stages.length : Math.min(r.stages.length, st.stage + 1); }
/** 这位首领本存档劝降了没。 */
export function sidePersuaded(bossId: string): boolean { return surrenderedIds().includes(bossId); }
/** 势力之主能不能劝（宁死不降的袁绍、公孙瓒、黄祖：终局没有再战劝降加成，改为厚葬奖励，surrender-rules.md）。 */
export function sideLordPersuadable(id: SideRouteId): boolean { const r = sideRoute(id); if (!r) return false; const t = surrenderDef(`${id}-${r.stages.length}:${r.lord}`)?.tier; return t === 'can' || t === 'hard' || t === 'sure'; }

export interface SideSettle { provisions: number; first: boolean; done: boolean; annexed: string[]; message: string }
/** 一关结算：胜利发军粮（终局 ×2）；攻城关并入该城；终局并入支线全部城池、特产生效。测试 / 调试战斗不写进度。 */
export function settleSideStage(id: SideRouteId, stage: number, result: { victory: boolean; debug: boolean }): SideSettle {
  const r = sideRoute(id), zero: SideSettle = { provisions: 0, first: false, done: false, annexed: [], message: '' };
  if (!r) return { ...zero, message: '未知支线' };
  if (result.debug) return { ...zero, message: '测试战斗，不写入永久进度' };
  if (!result.victory) return { ...zero, message: '整军再战' };
  const st = sideState(id), d = r.stages[stage - 1], final = stage === r.stages.length, first = stage > st.stage;
  if (!d) return { ...zero, message: '无效关卡' };
  const annexed: string[] = [];
  const take = (city: string | undefined) => { if (city && grantCity(city)) annexed.push(cityById(city)?.name ?? city); };
  if (first) st.stage = stage;
  take(d.city);
  let done = false;
  if (final) {
    if (!st.done) { st.done = true; done = true; for (const c of r.annex) take(c); }
  }
  put(id, st);
  if (!first) return { ...zero, message: '此关已平定' };
  const base = SIDE_REWARD.provisions[id] * (final ? SIDE_REWARD.finalMul : 1);
  const provisions = addProvisions(Math.round(base));
  return { provisions, first, done, annexed, message: done ? `${r.name} · 讨伐告成` : first ? `${d.name}告捷` : `重温 ${d.name}` };
}
/** 已讨平支线的势力特产（WorldStore.permanentEffects 合进城池特产）。 */
export function sideSpecialties(): Specialty[] { return SIDE_ROUTES.filter(r => sideState(r.id).done).map(r => r.specialty); }
/** 已讨平支线数 / 总数（地图提示用）。 */
export function sideOwnedSummary(): { done: number; total: number; cities: number } {
  const owned = ownedCities(); return { done: SIDE_ROUTES.filter(r => sideState(r.id).done).length, total: SIDE_ROUTES.length, cities: SIDE_ROUTES.flatMap(r => [...r.annex, ...r.stages.map(s => s.city ?? '')]).filter(c => c && owned.includes(c)).length };
}
/** 测试：清掉 / 写入支线进度。 */
export function resetSideRoutes(s: SideSave = {}): void { write(s); }
