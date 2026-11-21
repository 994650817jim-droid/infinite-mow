/**
 * 战斗内「设置」与主页「军中设置」共用的选项（2026-11-17 用户：「关于战斗的时候 暂停改成设置，然后可以调描边什么的」）。
 * 改了立即写 localStorage，战斗中即时生效；主页与战斗读同一组键，两边保持同步。
 * - 敌我描边 im_iff_outline：'0' 关 / 'enemy' 仅敌人 / '1' 敌我都描（旧存档里的 '1' / '0' 照旧可读）
 * - 描边粗细 im_iff_outline_w：'thin' / 'thick'
 * - 伤害数字 im_dmg_numbers：'all' / 'crit' 仅暴击 / 'off'
 * - 震屏 im_shake：'strong' / 'weak' / 'off'（与「新增可玩武将」会话约定同一键；缺省 strong）
 * - 武将台词 im_hero_barks：'off' 关 / 其余开（缺省开）
 * - 剧情 im_story：'full' 完整 / 'chapter' 只看章头章末 / 'off' 关闭（2026-11-17 剧情系统，缺省完整）
 * - 死亡特效 im_death_fx：'off' 关 / 其余开（2026-11-18 敌军死亡特效，缺省开）
 * - 军令面板 im_orders_panel：'on' 开 / 其余关（缺省关）
 * - 合击觉醒提示 im_school_hint：'brief' 简洁（缺省：每关第一次出小签，之后只闪徽印）/ 'full' 完整（觉醒每次都出）/ 'off' 关（只闪徽印）
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

/** 军令面板（2026-11-19 用户「我先移除军令，有点碍眼」）：缺省关；关时只留章节名下的一行目标、屏外箭头与舆图标记，军令数据照旧。 */
export type OrdersPanelSetting = 'on' | 'off';
export function ordersPanelSetting(): OrdersPanelSetting { return get('im_orders_panel') === 'on' ? 'on' : 'off'; }
export function setOrdersPanelSetting(v: OrdersPanelSetting): void { set('im_orders_panel', v); }
export const ORDERS_PANEL_LABEL: Record<OrdersPanelSetting, string> = { on: '开', off: '关' };

export type SchoolHint = 'full' | 'brief' | 'off';
export function schoolHint(): SchoolHint { const v = get('im_school_hint'); return v === 'full' || v === 'off' ? v : 'brief'; }
export function setSchoolHint(v: SchoolHint): void { set('im_school_hint', v); }
export const SCHOOL_HINT_LABEL: Record<SchoolHint, string> = { full: '完整', brief: '简洁', off: '关' };

export type StoryMode = 'full' | 'chapter' | 'off';
export function storyMode(): StoryMode { const v = get('im_story'); return v === 'chapter' || v === 'off' ? v : 'full'; }
export function setStoryMode(v: StoryMode): void { set('im_story', v); }
export const STORY_LABEL: Record<StoryMode, string> = { full: '完整', chapter: '只看章头章末', off: '关闭' };

export type RenderScaleSetting = '' | '1' | '2' | '3';
export function renderScaleSetting(): RenderScaleSetting { const v = get('im_render_scale'); return v === '1' || v === '2' || v === '3' ? v : ''; }
export function setRenderScaleSetting(v: RenderScaleSetting): void { set('im_render_scale', v || null); }
export const SCALE_LABEL: Record<RenderScaleSetting, string> = { '': '自动', '1': '标准', '2': '高清', '3': '超清' };

export type DeathFxSetting = 'on' | 'off';
let deathCache: DeathFxSetting | null = null;
export function deathFxSetting(): DeathFxSetting { if (deathCache) return deathCache; return deathCache = get('im_death_fx') === 'off' ? 'off' : 'on'; }
export function deathFxOn(): boolean { return deathFxSetting() === 'on'; }
export function setDeathFx(v: DeathFxSetting): void { set('im_death_fx', v); deathCache = v; }
export const DEATHFX_LABEL: Record<DeathFxSetting, string> = { on: '开', off: '关' };
/** 测试用：清掉内存缓存，下次读 localStorage。 */
export function resetDeathFxCache(): void { deathCache = null; }

export type HeroBarks = 'on' | 'off';
let barkCache: HeroBarks | null = null;
export function heroBarks(): HeroBarks { if (barkCache) return barkCache; return barkCache = get('im_hero_barks') === 'off' ? 'off' : 'on'; }
export function heroBarksOn(): boolean { return heroBarks() === 'on'; }
export function setHeroBarks(v: HeroBarks): void { set('im_hero_barks', v); barkCache = v; }
export const BARKS_LABEL: Record<HeroBarks, string> = { on: '开', off: '关' };

/** 军阵阵纹（formation-design.md：阵纹透明度低，设置里可关）。 */
export type FormationSigil = 'on' | 'off';
let sigilCache: FormationSigil | null = null;
export function formationSigil(): FormationSigil { if (sigilCache) return sigilCache; return sigilCache = get('im_formation_sigil') === 'off' ? 'off' : 'on'; }
export function formationSigilOn(): boolean { return formationSigil() === 'on'; }
export function setFormationSigil(v: FormationSigil): void { set('im_formation_sigil', v); sigilCache = v; }
export const SIGIL_LABEL: Record<FormationSigil, string> = { on: '开', off: '关' };

/** 在一组取值里循环切换（‹ › 按钮用）。 */
export function cycle<T>(list: readonly T[], cur: T, dir: number): T { const i = list.indexOf(cur); return list[((i < 0 ? 0 : i) + dir + list.length) % list.length]; }

/**
 * 开场动画（2026-11-18 用户「开场动画播完再进游戏界面」）：im_opening = 'every' 每次 / 'first' 首次（缺省）/ 'off' 关闭；
 * im_opening_seen = '1' 表示已经播过（「首次」模式据此跳过）。自动化测试（navigator.webdriver）与 ?autostart / ?perf 默认不播，?opening=1 强制播，?opening=auto 按真实规则判断（测试用）。
 */
export type OpeningMode = 'every' | 'first' | 'off';
export function openingMode(): OpeningMode { const v = get('im_opening'); return v === 'every' || v === 'off' ? v : 'first'; }
export function setOpeningMode(v: OpeningMode): void { set('im_opening', v); }
export const OPENING_LABEL: Record<OpeningMode, string> = { every: '每次', first: '首次', off: '关闭' };
export function markOpeningSeen(): void { set('im_opening_seen', '1'); }
export function shouldPlayOpening(): boolean {
  let q: URLSearchParams; try { q = new URLSearchParams(location.search); } catch { return false; }
  if (q.get('opening') === '1') return true;
  const auto = q.get('opening') === 'auto'; // 测试用：按真实规则（模式 + 是否播过）判断，不因自动化环境跳过
  if (!auto && (q.has('autostart') || q.has('perf') || q.get('opening') === '0')) return false;
  try { if (!auto && navigator.webdriver) return false; } catch { /* ignore */ }
  const m = openingMode(); return m === 'every' || (m === 'first' && get('im_opening_seen') !== '1');
}
