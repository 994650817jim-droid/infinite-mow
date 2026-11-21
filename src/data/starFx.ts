/**
 * 星图 · 战斗内反馈（第四期，2026-11-21 用户试玩：「主要是我没看到那个点上描述的效果」「也要加上星图触发的特效美术」）。全部在开关 starMapOn() 后面。
 * 这里只有数据：① 增益栏「星图」小图标用哪张图、哪些星是触发式 / 状态式；② 手绘特效的 8 个挂点（美术到位后只填这张表）。
 * 画面在 ui/StarBuffHud.ts（图标排）与 systems/StarFx.ts（特效挂点）；触发信号由 RunGrowth.pulse() 发出。
 */

/** 28 颗要星 / 主星的图标文件名（public/assets/star-map/icon_<名>.png；贴图 key 与星图页面相同：sm_icon_<名>）。 */
export const STAR_ICON_FILE: Record<string, string> = {
  'strength.NC': 'qianjun', 'strength.NL1': 'pozhen', 'strength.NL2': 'zhanjiang', 'strength.NR1': 'tiegu', 'strength.NR2': 'beishui', 'strength.K': 'wanrendi',
  'agility.NC': 'qingqi', 'agility.NL1': 'youren', 'agility.NL2': 'jiying', 'agility.NR1': 'lianji', 'agility.NR2': 'zhuifeng', 'agility.K': 'yiqi',
  'intellect.NC': 'ningshen', 'intellect.NL1': 'lianzhu', 'intellect.NL2': 'guangyu', 'intellect.NR1': 'yujin', 'intellect.NR2': 'miaosuan', 'intellect.K': 'huoshao',
  'command.NC': 'lijun', 'command.NL1': 'muzhong', 'command.NL2': 'tongpao', 'command.NR1': 'yanzhen', 'command.NR2': 'haoling', 'command.K': 'sanjun',
  'bridge0.h': 'xiaorui', 'bridge1.h': 'qimou', 'bridge2.h': 'weiwo', 'bridge3.h': 'shenxian',
};
export const starIconKey = (id: string): string => 'sm_icon_' + STAR_ICON_FILE[id];
export const starIconUrl = (id: string): string => `assets/star-map/icon_${STAR_ICON_FILE[id]}.png`;

/**
 * 图标怎么反馈：
 * - trigger：触发的那一下亮一下（RunGrowth.pulse）——破阵重击、连珠翻倍、游刃闪避、火烧连营爆燃；
 * - timed：触发后有一段生效时间，开始时亮一下、期间保持高亮——疾影（暴击后 2 秒攻速）、奇谋（暴击后 3 秒法术伤害）；
 * - state：条件成立时高亮、不成立时半透明——背水（残血）、号令 / 身先士卒（有部曲在主将身边）、追风（移动中）；
 * - 其余（没列的）是常驻效果，图标一直正常显示。
 */
export type StarFeedbackKind = 'trigger' | 'timed' | 'state';
export const STAR_FEEDBACK: Record<string, StarFeedbackKind> = {
  'strength.NL1': 'trigger', 'intellect.NL1': 'trigger', 'agility.NL1': 'trigger', 'intellect.K': 'trigger',
  'agility.NL2': 'timed', 'bridge1.h': 'timed',
  'strength.NR2': 'state', 'command.NR2': 'state', 'bridge3.h': 'state', 'agility.NR2': 'state',
};
/** 增益栏「星图」图标排的版式：每行几个、最多几行（超出折叠成「+N」）、图标边长、间距；亮一下的时长与放大倍数；状态不成立时的透明度。 */
export const STAR_HUD = { perRow: 10, rows: 2, size: 20, gap: 3, flashMs: 400, flashScale: 1.35, idleAlpha: .4 } as const;

/**
 * 手绘特效的 8 个挂点。**现在一张图都还没有**（美术在画，成品放 public/assets/star-map/fx/），所以每项 ready 都是 false：不加载、不显示、也不画任何程序图形。
 * 美术到位后只改这张表：填 frames / frameW / frameH / fps / 锚点 / 缩放，把 ready 改成 true。
 * - mode：loop = 条件成立期间循环播放，跟着主将；once = 在触发点播一遍。
 * - attach：hero 主将身上 / feet 主将脚下（画在主将后面）/ behind 主将身后 / ring 以主将为圆心的半径环（显示直径 = 2 × STAR_NEAR_RADIUS × scale）
 *   / hit 命中点 / side 主将身侧 / kill 击杀点。
 * - star：由哪颗星驱动（loop 看这颗星的状态，once 看这颗星的触发信号）；ring 那一项由号令、身先士卒任意一颗驱动。
 * - anchor：贴图的锚点（0–1）；scale：显示缩放（ring 例外，见上）；fps：帧率；frames：帧数（横向一条）。
 */
export interface StarFxDef {
  star: string; alsoStar?: string; mode: 'loop' | 'once';
  attach: 'hero' | 'feet' | 'behind' | 'ring' | 'hit' | 'side' | 'kill';
  key: string; url: string; frames: number; frameW: number; frameH: number; fps: number;
  anchor: { x: number; y: number }; scale: number; ready: boolean;
}
const fx = (file: string, d: Omit<StarFxDef, 'key' | 'url'>): StarFxDef => ({ key: 'star_fx_' + file, url: `assets/star-map/fx/${file}.png`, ...d });
export const STAR_FX = {
  /** 背水：生命低于 40% 期间，主将身上循环。 */
  beishui: fx('beishui', { star: 'strength.NR2', mode: 'loop', attach: 'hero', frames: 8, frameW: 192, frameH: 192, fps: 12, anchor: { x: .5, y: .8 }, scale: .6, ready: false }),
  /** 万人敌：点亮后常驻，主将脚下循环。 */
  wanrendi: fx('wanrendi', { star: 'strength.K', mode: 'loop', attach: 'feet', frames: 8, frameW: 256, frameH: 256, fps: 10, anchor: { x: .5, y: .5 }, scale: .5, ready: false }),
  /** 三军统帅：点亮后常驻，主将身后循环。 */
  sanjun: fx('sanjun', { star: 'command.K', mode: 'loop', attach: 'behind', frames: 8, frameW: 256, frameH: 256, fps: 10, anchor: { x: .5, y: .9 }, scale: .6, ready: false }),
  /** 号令 / 身先士卒：有部曲在主将身边时的半径环。 */
  ring: fx('ring', { star: 'command.NR2', alsoStar: 'bridge3.h', mode: 'loop', attach: 'ring', frames: 8, frameW: 512, frameH: 512, fps: 8, anchor: { x: .5, y: .5 }, scale: 1, ready: false }),
  /** 破阵：重击命中点，一次性。 */
  pozhen: fx('pozhen', { star: 'strength.NL1', mode: 'once', attach: 'hit', frames: 8, frameW: 192, frameH: 192, fps: 20, anchor: { x: .5, y: .5 }, scale: .6, ready: false }),
  /** 连珠：翻倍那一下的命中点，一次性。 */
  lianzhu: fx('lianzhu', { star: 'intellect.NL1', mode: 'once', attach: 'hit', frames: 8, frameW: 192, frameH: 192, fps: 20, anchor: { x: .5, y: .5 }, scale: .6, ready: false }),
  /** 游刃：闪避那一下，主将身侧，一次性。 */
  youren: fx('youren', { star: 'agility.NL1', mode: 'once', attach: 'side', frames: 8, frameW: 192, frameH: 192, fps: 20, anchor: { x: .5, y: .7 }, scale: .6, ready: false }),
  /** 火烧连营：爆燃的击杀点，一次性。没到位之前爆燃借用 flame_burst（GameScene.starPyre）；到位后改用这张。 */
  huoshao: fx('huoshao', { star: 'intellect.K', mode: 'once', attach: 'kill', frames: 8, frameW: 256, frameH: 256, fps: 16, anchor: { x: .5, y: .75 }, scale: .8, ready: false }),
} satisfies Record<string, StarFxDef>;
export type StarFxId = keyof typeof STAR_FX;
