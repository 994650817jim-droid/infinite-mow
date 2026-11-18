/**
 * 战斗内「设置」与主页「军中设置」共用的选项（2026-11-17 用户：「关于战斗的时候 暂停改成设置，然后可以调描边什么的」）。
 * 改了立即写 localStorage，战斗中即时生效；主页与战斗读同一组键，两边保持同步。
 * - 敌我描边 im_iff_outline：'0' 关 / 'enemy' 仅敌人 / '1' 敌我都描（旧存档里的 '1' / '0' 照旧可读）
 * - 描边粗细 im_iff_outline_w：'thin' / 'thick'
 * - 伤害数字 im_dmg_numbers：'all' / 'crit' 仅暴击 / 'off'
 * - 震屏 im_shake：'strong' / 'weak' / 'off'（与「新增可玩武将」会话约定同一键；缺省 strong）
 * - 剧情 im_story：'full' 完整 / 'chapter' 只看章头章末 / 'off' 关闭（2026-11-17 剧情系统，缺省完整）
 * - 画面清晰度 im_render_scale：''（自动）/ '1' / '2' / '3'（config.pickRenderScale 启动时读，刷新后生效）
 */
const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null): void => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 存储不可用 */ } };

export type OutlineMode = 'off' | 'enemy' | 'all';
export function outlineMode(): OutlineMode { const v = get('im_iff_outline'); return v === 'enemy' ? 'enemy' : v === '1' ? 'all' : 'off'; }
export function setOutlineMode(m: OutlineMode): void { set('im_iff_outline', m === 'enemy' ? 'enemy' : m === 'all' ? '1' : '0'); }
export const OUTLINE_LABEL: Record<OutlineMode, string> = { off: '关', enemy: '仅敌人', all: '敌我都描' };

export type OutlineWidth = 'thin' | 'thick';
export function outlineWidth(): OutlineWidth { return get('im_iff_outline_w') === 'thick' ? 'thick' : 'thin'; }
export function setOutlineWidth(w: OutlineWidth): void { set('im_iff_outline_w', w); }
export const WIDTH_LABEL: Record<OutlineWidth, string> = { thin: '细', thick: '粗' };

export type DamageNumbers = 'all' | 'crit' | 'off';
// 伤害数字 / 震屏每次飘字、每次震屏都要读：缓存在内存，setter 同步更新
let dmgCache: DamageNumbers | null = null, shakeCache: ShakeLevel | null = null;
export function damageNumbers(): DamageNumbers { if (dmgCache) return dmgCache; const v = get('im_dmg_numbers'); return dmgCache = v === 'crit' || v === 'off' ? v : 'all'; }
export function setDamageNumbers(v: DamageNumbers): void { set('im_dmg_numbers', v); dmgCache = v; }
export const DAMAGE_LABEL: Record<DamageNumbers, string> = { all: '全部', crit: '仅暴击', off: '关' };

export type ShakeLevel = 'strong' | 'weak' | 'off';
export function shakeLevel(): ShakeLevel { if (shakeCache) return shakeCache; const v = get('im_shake'); return shakeCache = v === 'weak' || v === 'off' ? v : 'strong'; }
export function setShakeLevel(v: ShakeLevel): void { set('im_shake', v); shakeCache = v; }
export const SHAKE_LABEL: Record<ShakeLevel, string> = { strong: '强', weak: '弱', off: '关' };
/** 震屏强度倍率：强 1、弱 0.5、关 0（与新增武将会话 hitFeel.shakeMul 一致）。 */
export function shakeScale(): number { const v = shakeLevel(); return v === 'off' ? 0 : v === 'weak' ? .5 : 1; }

export type StoryMode = 'full' | 'chapter' | 'off';
export function storyMode(): StoryMode { const v = get('im_story'); return v === 'chapter' || v === 'off' ? v : 'full'; }
export function setStoryMode(v: StoryMode): void { set('im_story', v); }
export const STORY_LABEL: Record<StoryMode, string> = { full: '完整', chapter: '只看章头章末', off: '关闭' };

export type RenderScaleSetting = '' | '1' | '2' | '3';
export function renderScaleSetting(): RenderScaleSetting { const v = get('im_render_scale'); return v === '1' || v === '2' || v === '3' ? v : ''; }
export function setRenderScaleSetting(v: RenderScaleSetting): void { set('im_render_scale', v || null); }
export const SCALE_LABEL: Record<RenderScaleSetting, string> = { '': '自动', '1': '标准', '2': '高清', '3': '超清' };

/** 在一组取值里循环切换（‹ › 按钮用）。 */
export function cycle<T>(list: readonly T[], cur: T, dir: number): T { const i = list.indexOf(cur); return list[((i < 0 ? 0 : i) + dir + list.length) % list.length]; }
