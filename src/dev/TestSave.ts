/**
 * 测试存档隔离（2026-11-16 用户：「dev测试模式也需要适应」）。
 *
 * 实测：改动前 `?dev=1` 会写正式存档——一局测试战斗把武将等级写进 im_heroes_v1，从面板跳主城会改写 im_world_v1。
 * 现在开发构建 + `?dev=1` 时，localStorage 的读写都经过一层「测试存档」：
 * - 写入 / 删除只落在 `imdev:` 前缀的测试键里，正式存档（含三个存档位 im_slot_N）一个字节都不动；
 * - 读取先看测试键，没有再读正式键（所以测试存档一开始等于当前正式存档的副本，测试脚本预先写入的正式键也照常生效）；
 * - 每个测试键记下它分叉时的正式值；正式值之后在测试模式外被改了（正常游玩或测试脚本重新预置），旧的测试副本作废，跟随新的正式值；
 * - 「清空测试存档」：测试存档变成全新空档（设置类键保留）；「回到正式存档副本」：丢掉测试改动。
 *
 * main.ts 第一行就 import 本文件，保证任何模块读存档之前已经装好。
 * 正式构建 import.meta.env.DEV 为 false，下面的代码整段被摇掉，不会进包。
 */
/** 第一章试验数值 ch1v6（?balance=ch1v6）用自己的前缀，和 ?dev=1 的测试存档分开。 */
const TRIAL = CH1_TRIAL;
import { CH1_TRIAL, CH1_TRIAL_ID } from '../data/ch1Trial';
const PFX = TRIAL ? `imtrial-${CH1_TRIAL_ID}:` : 'imdev:';
/** 测试键分叉时的正式值快照。 */
const BASE = TRIAL ? `imtrial-${CH1_TRIAL_ID}#:` : 'imdev#:';
const TOMB = '\u0000deleted', NONE = '\u0000none';
/** 设置类键：清空测试存档时保留（音量、布局、画风、渲染倍率、面板位置等）。 */
const SETTINGS = ['im_sfx_vol', 'im_bgm_vol', 'im_muted', 'im_music', 'im_layout', 'im_render_scale', 'im_iff_outline', 'im_dev_panel', 'im_bgm_ver', 'im_art_style'];

export interface TestSaveApi {
  /** 测试存档里改过的键（相对正式存档，不含设置）。 */
  changed(): string[];
  /** 测试存档变成全新空档（设置保留），然后刷新。 */
  clear(): void;
  /** 丢掉测试改动、重新跟随正式存档，然后刷新。 */
  resetToReal(): void;
}

export function testSaveActive(): boolean {
  if (!import.meta.env.DEV) return false;
  try { return new URLSearchParams(window.location.search).get('dev') === '1' || CH1_TRIAL; } catch { return false; }
}
export function testSaveApi(): TestSaveApi | undefined { return (window as unknown as { __testSave?: TestSaveApi }).__testSave; }

if (import.meta.env.DEV && testSaveActive()) {
  const P = Storage.prototype;
  const raw = { get: P.getItem, set: P.setItem, remove: P.removeItem, key: P.key };
  const lengthDesc = Object.getOwnPropertyDescriptor(P, 'length')!;
  const ls = window.localStorage;
  const rawKeys = (): string[] => { const out: string[] = []; const n = lengthDesc.get!.call(ls) as number; for (let i = 0; i < n; i++) { const k = raw.key.call(ls, i); if (k !== null) out.push(k); } return out; };
  /** 读测试视图：测试键优先；正式值自分叉后变过就丢掉测试副本。 */
  const read = (key: string): string | null => {
    const v = raw.get.call(ls, PFX + key), realNow = raw.get.call(ls, key);
    if (v !== null) {
      const base = raw.get.call(ls, BASE + key);
      if (!TRIAL && base !== null && base !== (realNow ?? NONE)) { // 试验存档不跟随正式存档
 raw.remove.call(ls, PFX + key); raw.remove.call(ls, BASE + key); return realNow; }
      return v === TOMB ? null : v;
    }
    return realNow;
  };
  const write = (key: string, value: string): void => { raw.set.call(ls, PFX + key, value); raw.set.call(ls, BASE + key, raw.get.call(ls, key) ?? NONE); };
  const merged = (): string[] => {
    const all = rawKeys(), seen = new Set<string>();
    for (const k of all) if (!k.startsWith('imdev')) seen.add(k);
    for (const k of all) if (k.startsWith(PFX)) { const real = k.slice(PFX.length); if (read(real) === null) seen.delete(real); else seen.add(real); }
    return [...seen];
  };
  P.getItem = function (this: Storage, key: string): string | null { return this !== ls ? raw.get.call(this, key) : read(String(key)); };
  P.setItem = function (this: Storage, key: string, value: string): void { if (this !== ls) return raw.set.call(this, key, value); write(String(key), String(value)); };
  P.removeItem = function (this: Storage, key: string): void { if (this !== ls) return raw.remove.call(this, key); write(String(key), TOMB); };
  P.clear = function (this: Storage): void {
    if (this !== ls) { for (let n = lengthDesc.get!.call(this) as number; n > 0; n--) { const k = raw.key.call(this, 0); if (k !== null) raw.remove.call(this, k); } return; }
    for (const k of merged()) write(k, TOMB);
  };
  P.key = function (this: Storage, index: number): string | null { return this !== ls ? raw.key.call(this, index) : merged()[index] ?? null; };
  Object.defineProperty(P, 'length', { configurable: true, enumerable: true, get(this: Storage) { return this === ls ? merged().length : lengthDesc.get!.call(this); } });

  /** 删掉测试改动（设置类保留）。 */
  const dropTest = (): void => {
    for (const k of rawKeys()) { const real = k.startsWith(PFX) ? k.slice(PFX.length) : k.startsWith(BASE) ? k.slice(BASE.length) : null; if (real !== null && !SETTINGS.includes(real)) raw.remove.call(ls, k); }
  };
  const api: TestSaveApi = {
    changed: () => rawKeys().filter(k => k.startsWith(PFX)).map(k => k.slice(PFX.length)).filter(k => !SETTINGS.includes(k) && read(k) !== raw.get.call(ls, k)),
    clear: () => { dropTest(); for (const k of rawKeys()) if (k.startsWith('im_') && !SETTINGS.includes(k)) write(k, TOMB); window.location.reload(); },
    resetToReal: () => { dropTest(); window.location.reload(); },
  };
  (window as unknown as { __testSave?: TestSaveApi }).__testSave = api;
  // 试验存档第一次打开：全新空档（设置保留）；之后接着用
  if (TRIAL && raw.get.call(ls, BASE + '__fresh') === null) { for (const k of rawKeys()) if (k.startsWith('im_') && !SETTINGS.includes(k)) write(k, TOMB); raw.set.call(ls, BASE + '__fresh', '1'); }

  // 全局角标：任何场景都能看出现在用的是测试存档（不拦点击）
  const badge = (): void => {
    if (document.getElementById('dev-test-save')) return;
    const el = document.createElement('div'); el.id = 'dev-test-save'; el.textContent = TRIAL ? `试验数值 ${CH1_TRIAL_ID} · 独立存档（不写正式存档）` : '测试存档 · 不写正式存档';
    el.style.cssText = 'position:fixed;right:6px;bottom:4px;z-index:999998;pointer-events:none;font:11px/1.2 system-ui,sans-serif;color:#ffe2a0;background:rgba(122,42,28,.82);border:1px solid #c9a45c;border-radius:3px;padding:2px 6px';
    document.body.appendChild(el);
  };
  if (document.body) badge(); else window.addEventListener('DOMContentLoaded', badge);
}
