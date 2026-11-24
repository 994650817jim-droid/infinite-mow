/**
 * 星图 · 战斗内反馈（第四期，2026-11-21 用户试玩：「主要是我没看到那个点上描述的效果」「也要加上星图触发的特效美术」）。全部在开关 starMapOn() 后面。
 * 这里只有数据：① 增益栏「星图」小图标用哪张图、哪些星是触发式 / 状态式；② 手绘特效的 8 个挂点。
 * 画面在 ui/StarBuffHud.ts（图标排）与 systems/StarFeedback.ts（特效挂点）；触发信号由 RunGrowth.pulse() 发出。
 */

/** 28 颗要星 / 主星的图标文件名（public/assets/star-map/icon_<名>.png；贴图 key 与星图页面相同：sm_icon_<名>）。 */
export const STAR_ICON_FILE: Record<string, string> = {
  'strength.NX1':'pozhen',
  'strength.NX2':'zhanjiang',
  'strength.K2':'wanrendi',
  'agility.NX1':'zhuifeng',
  'agility.NX2':'jiying',
  'agility.K2':'yiqi',
  'intellect.NX1':'qimou',
  'intellect.NX2':'guangyu',
  'intellect.K2':'huoshao',
  'command.NX1':'haoling',
  'command.NX2':'tongpao',
  'command.K2':'sanjun',

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
  'strength.NX1':'trigger',
  'strength.NX2':'trigger',
  'strength.K2':'trigger',
  'agility.NX1':'trigger',
  'agility.NX2':'trigger',
  'agility.K2':'trigger',
  'intellect.NX1':'trigger',
  'intellect.NX2':'trigger',
  'intellect.K2':'trigger',
  'command.NX1':'trigger',
  'command.NX2':'trigger',
  'command.K2':'trigger',

  'strength.NL1': 'trigger', 'intellect.NL1': 'trigger', 'agility.NL1': 'trigger', 'intellect.K': 'trigger',
  'agility.NL2': 'timed', 'bridge1.h': 'timed',
  'strength.NR2': 'state', 'command.NR2': 'state', 'bridge3.h': 'state', 'agility.NR2': 'state',
};
/** 增益栏「星图」图标排的版式：每行几个、最多几行（超出折叠成「+N」）、图标边长、间距；亮一下的时长与放大倍数；状态不成立时的透明度。 */
export const STAR_HUD = { perRow: 10, rows: 2, size: 20, gap: 3, flashMs: 400, flashScale: 1.35, idleAlpha: .4 } as const;

/** 主将脚底相对主将坐标的下移（主将坐标在身体中段，影子画在 +26；跟着主将的特效锚点都对这里）。 */
export const STAR_FX_FOOT = 26;
/**
 * 手绘特效的 8 个挂点，**都已接上**（2026-11-21 美术 d7386d87：背水、破阵；9480e478：其余 6 个）。
 * 成品在 public/assets/star-map/fx/fx_<名>.png，帧数 / 单帧尺寸 / 锚点 / 帧率以同目录 fx.json 为准（tools/test-star-map.mjs 逐项核对）。
 * 图是 2× 的，scale = .5 即 fx.json 的显示尺寸。没有任何程序画的图形；ready = false 的项不加载、不显示。
 * - mode：loop = 条件成立期间一直显示，跟着主将；once = 在触发点播一遍（frames = 1 的 loop 就是一张静图）。
 * - when（只对 loop）：state = 这颗星的状态成立时（背水：残血）；lit = 点亮了就常驻（star / alsoStar 任意一颗）。
 * - at：feet 主将脚底 / hit 触发点（命中点）/ side 主将身侧 / kill 被击杀敌人的脚底。
 * - layer：over 画在主将之上（名字牌、血条在界面层，不会被盖）；under 紧贴主将之下一层；ground 贴地，在所有单位之下。
 * - alpha：透明度；breathe：静图的呼吸幅度（alpha 上下浮动这么多，周期 3 秒，不闪）；offset：相对锚点的偏移；
 *   flipWithFacing：按主将朝向水平翻转（游刃：风痕默认在主将左侧、朝左掠过；主将朝左时翻到右侧）。
 */
export interface StarFxDef {
  star: string; alsoStar?: string; mode: 'loop' | 'once'; when?: 'state' | 'lit';
  at: 'feet' | 'hit' | 'side' | 'kill'; layer: 'over' | 'under' | 'ground';
  key: string; url: string; frames: number; frameW: number; frameH: number; fps: number;
  anchor: { x: number; y: number }; scale: number; alpha: number; breathe?: number; offset?: { x: number; y: number }; flipWithFacing?: boolean; ready: boolean;
}
const fx = (file: string, d: Omit<StarFxDef, 'key' | 'url'>): StarFxDef => ({ key: 'star_fx_' + file, url: `assets/star-map/fx/fx_${file}.png`, ...d });
export const STAR_FX = {
  /** 背水：生命低于 40% 期间，火焰绕主将身上循环。显示 96×112，锚点脚底中心，10 帧 / 秒。 */
  beishui: fx('beishui', { star: 'strength.NR2', mode: 'loop', when: 'state', at: 'feet', layer: 'over', frames: 8, frameW: 192, frameH: 224, fps: 10, anchor: { x: .5, y: 208 / 224 }, scale: .5, alpha: 1, ready: true }),
  /** 万人敌（v2）：点亮后常驻主将脚下的地纹，缓慢转动。显示 160×90，贴地；偏亮偏橙，alpha .7 免得压过人物。 */
  wanrendi: fx('wanrendi', { star: 'strength.K', mode: 'loop', when: 'lit', at: 'feet', layer: 'ground', frames: 6, frameW: 320, frameH: 180, fps: 6, anchor: { x: .5, y: .5 }, scale: .5, alpha: .7, ready: true }),
  /** 三军统帅：点亮后常驻的帅旗虚影，旗杆底在主将左后方，旗面朝右飘。显示 112×120，alpha .8，在主将之下一层。 */
  sanjun: fx('sanjun', { star: 'command.K', mode: 'loop', when: 'lit', at: 'feet', layer: 'under', frames: 6, frameW: 224, frameH: 240, fps: 6, anchor: { x: 24 / 224, y: 229 / 240 }, scale: .5, alpha: .8, offset: { x: -22, y: -4 }, ready: true }),
  /** 号令 / 身先士卒：点亮任意一颗就显示的范围光环（单张静图，环宽 ≈ 440 = 半径 220）。显示 456×227，贴地、很淡（alpha .35），缓慢呼吸；透视椭圆，所以不旋转。 */
  haoling: fx('haoling', { star: 'command.NR2', alsoStar: 'bridge3.h', mode: 'loop', when: 'lit', at: 'feet', layer: 'ground', frames: 1, frameW: 912, frameH: 454, fps: 0, anchor: { x: .5, y: .5 }, scale: .5, alpha: .35, breathe: .06, ready: true }),
  /** 破阵：重击命中点，一次性。显示 128×128，16 帧 / 秒。 */
  pozhen: fx('pozhen', { star: 'strength.NL1', mode: 'once', at: 'hit', layer: 'over', frames: 8, frameW: 256, frameH: 256, fps: 16, anchor: { x: .5, y: .5 }, scale: .5, alpha: 1, ready: true }),
  /** 连珠：法术伤害翻倍那一下的命中点，双环回响，一次性。显示 112×112，14 帧 / 秒。 */
  lianzhu: fx('lianzhu', { star: 'intellect.NL1', mode: 'once', at: 'hit', layer: 'over', frames: 8, frameW: 224, frameH: 224, fps: 14, anchor: { x: .5, y: .5 }, scale: .5, alpha: 1, ready: true }),
  /** 游刃：闪避成功时主将身侧的风痕残影，一次性。显示 96×96，14 帧 / 秒；按主将朝向翻转。 */
  youren: fx('youren', { star: 'agility.NL1', mode: 'once', at: 'side', layer: 'over', frames: 6, frameW: 192, frameH: 192, fps: 14, anchor: { x: .5, y: .5 }, scale: .5, alpha: 1, offset: { x: -26, y: 0 }, flipWithFacing: true, ready: true }),
  /** 火烧连营：被法术击杀的敌人脚底的贴地火环，一次性。显示 160×160，12 帧 / 秒，在单位之下。爆燃只用这张，不再借别的图。 */
  huoshao: fx('huoshao', { star: 'intellect.K', mode: 'once', at: 'kill', layer: 'ground', frames: 8, frameW: 320, frameH: 320, fps: 12, anchor: { x: .5, y: .5 }, scale: .5, alpha: 1, ready: true }),
} satisfies Record<string, StarFxDef>;
export type StarFxId = keyof typeof STAR_FX;
