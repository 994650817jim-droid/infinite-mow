import {loadWorld,worldChapterCleared} from '../world/WorldStore';
import type { ChapterId } from '../data/chapters';

/** Only chapter unlock progress is saved; battle builds and armies remain per-run. */
export const CHAPTER_CLEAR_KEY = 'im_chapter1_cleared';
let sessionClear = false;
export function chapterOneCleared(): boolean {
  try { return sessionClear || worldChapterCleared('huangjin') || localStorage.getItem(CHAPTER_CLEAR_KEY) === 'true'; }
  catch { return sessionClear; }
}
export function chapterUnlocked(chapter: ChapterId): boolean {
  return chapter === 'huangjin' || chapterOneCleared() || loadWorld().legacyHulaoAccess;
}
export function recordChapterVictory(result: { chapter: ChapterId; victory: boolean; bossKilled: boolean; reason: string; debug: boolean; stage?:number }): boolean {
  if ((result.stage??3)!==3 || result.chapter !== 'huangjin' || !result.victory || !result.bossKilled || result.reason !== 'boss' || result.debug) return false;
  sessionClear = true;
  try { localStorage.setItem(CHAPTER_CLEAR_KEY, 'true'); } catch { /* Storage blocked: keep this session playable. */ }
  return true;
}
/** Test entry bypasses selection locks, never writes campaign progress. Production excludes it. */
export function isChapterTestRun(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1';
}
