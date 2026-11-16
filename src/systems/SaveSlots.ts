/**
 * 多存档位（3 个）。当前存档位的进度就是现有的进度键（天下存档、章节通关、上次武将），原有存档代码不用改；
 * 切换存档位时把当前进度打包存进 im_slot_N，再把目标存档位的进度放回进度键，然后重新加载游戏。
 * 音量、布局、渲染倍率等设置是全局的，不随存档位切换。
 * 桌面版的 localStorage 已由 platform/desktop.ts 换成 save.json，所以存档位同样落在 save.json 里（便于 Steam 云存档）。
 */
import { CHAPTER_CLEAR_KEY } from './ChapterProgress';
import { BACKUP_KEY, WORLD_KEY, type WorldSave } from '../world/WorldStore';
import { getCharacter } from '../data/characters';
import { YELLOW_STAGES, DONGZHUO_STAGES } from '../data/chapters';
import { THIRD_STAGES } from '../data/thirdChapter';
import { GUANDU_STAGES } from '../data/guanduChapter';

export const SLOT_COUNT = 3;
/** 最近一次写入进度的时间（毫秒），随存档位一起移动。 */
export const SLOT_TOUCH_KEY = 'im_slot_touched';
const META_KEY = 'im_save_slots';
const slotKey = (i: number): string => `im_slot_${i}`;
/** 属于“一个存档”的键；其余 im_ 键（音量、布局等）是全局设置。 */
export const PROGRESS_KEYS = [WORLD_KEY, BACKUP_KEY, CHAPTER_CLEAR_KEY, 'im_last_hero', SLOT_TOUCH_KEY, 'im_items_v1', 'im_items_v2', 'im_roster_v1'];

export interface SlotSummary {
  index: number;
  active: boolean;
  empty: boolean;
  hero?: string;
  /** 例如“第二章 · 讨伐董卓 2/3”。 */
  progress?: string;
  /** 例如“城池 3 · 军粮 80”。 */
  detail?: string;
  savedAt?: number;
}

const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* 存储不可用 */ } };
const del = (k: string): void => { try { localStorage.removeItem(k); } catch { /* 存储不可用 */ } };

export function activeSlot(): number {
  try { const m = JSON.parse(get(META_KEY) ?? '{}') as { active?: number }; return Number.isInteger(m.active) && m.active! >= 0 && m.active! < SLOT_COUNT ? m.active! : 0; } catch { return 0; }
}
function setActive(i: number): void { set(META_KEY, JSON.stringify({ active: i })); }

/** 进度写入后调用：记下保存时间（WorldStore.commit、选将等）。 */
export function touchSave(): void { set(SLOT_TOUCH_KEY, String(Date.now())); }

function liveData(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PROGRESS_KEYS) { const v = get(k); if (v !== null) out[k] = v; }
  return out;
}
function slotData(i: number): Record<string, string> | null {
  if (i === activeSlot()) return liveData();
  try { const d = JSON.parse(get(slotKey(i)) ?? 'null') as Record<string, string> | null; return d && typeof d === 'object' ? d : null; } catch { return null; }
}
function isEmpty(d: Record<string, string> | null): boolean {
  return !d || !PROGRESS_KEYS.some(k => k !== SLOT_TOUCH_KEY && d[k] !== undefined);
}

/** 从一份进度数据算出存档位卡片上显示的摘要。 */
export function summarize(i: number): SlotSummary {
  const d = slotData(i), active = i === activeSlot();
  if (isEmpty(d)) return { index: i, active, empty: true };
  let w: Partial<WorldSave> = {};
  try { w = JSON.parse(d![WORLD_KEY] ?? '{}') as Partial<WorldSave>; } catch { /* 损坏时只显示武将 */ }
  const chapters: [string, string, number, number][] = [
    ['第一章', '黄巾之乱', w.yellowStages ?? (d![CHAPTER_CLEAR_KEY] === 'true' ? YELLOW_STAGES.length : 0), YELLOW_STAGES.length],
    ['第二章', '讨伐董卓', w.dongzhuoStages ?? 0, DONGZHUO_STAGES.length],
    ['第三章', '群雄割据', w.warlordStages ?? 0, THIRD_STAGES.length],
    ['第四章', '官渡之战', w.guanduStages ?? 0, GUANDU_STAGES.length],
  ];
  // 当前所在章：第一个没打完的；全部打完显示最后一章
  let cur = chapters.findIndex(([, , done, total]) => done < total);
  if (cur < 0) cur = chapters.length - 1;
  else if (cur > 0 && chapters[cur][2] === 0 && !w.worldAvailable && !w.cleared?.huangjin) cur = 0;
  const [num, name, done, total] = chapters[cur];
  const parts: string[] = [];
  if (w.ownedCities?.length) parts.push(`城池 ${w.ownedCities.length}`);
  // v9 只剩军粮（旧存档在读入时折算，这里只显示存档里的数）
  if (w.provisions !== undefined) parts.push(`军粮 ${w.provisions}`);
  let hero: string | undefined;
  try { hero = d!.im_last_hero ? getCharacter(d!.im_last_hero as never).name : undefined; } catch { hero = undefined; }
  const at = Number(d![SLOT_TOUCH_KEY]);
  return { index: i, active, empty: false, hero, progress: `${num} · ${name} ${Math.min(done, total)}/${total}`, detail: parts.join(' · ') || undefined, savedAt: at > 0 ? at : undefined };
}

export function listSlots(): SlotSummary[] { return Array.from({ length: SLOT_COUNT }, (_, i) => summarize(i)); }

/** 切换到存档位 i（空位即开始新征途）。调用后需要重新加载游戏。 */
export function switchSlot(i: number): void {
  const cur = activeSlot();
  if (i === cur || i < 0 || i >= SLOT_COUNT) return;
  const live = liveData();
  if (isEmpty(live)) del(slotKey(cur)); else set(slotKey(cur), JSON.stringify(live));
  const target = slotData(i);
  for (const k of PROGRESS_KEYS) del(k);
  if (target) for (const [k, v] of Object.entries(target)) if (PROGRESS_KEYS.includes(k)) set(k, v);
  del(slotKey(i));
  setActive(i);
}

/** 删除存档位 i（当前存档位则清空当前进度）。调用当前存档位后需要重新加载游戏。 */
export function deleteSlot(i: number): void {
  if (i === activeSlot()) { for (const k of PROGRESS_KEYS) del(k); }
  else del(slotKey(i));
}

/** 切换 / 删除后重新加载：清掉各模块的内存缓存与场景状态。 */
export function reloadGame(): void { window.location.reload(); }
