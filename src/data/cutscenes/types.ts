/**
 * 过场动画脚本（引擎内即时演算，全部用现成图：武将 / 首领图集、首领骑乘图、v2 名马、手绘特效序列帧）。
 * 一段过场 = 一串步骤，按顺序执行；步骤默认等它做完再往下（wait: false = 与后面的步骤同时进行）。
 * 新增一段过场只要在 src/data/cutscenes/ 写一个脚本、在 index.ts 登记，不改代码。
 *
 * 位置 Pos：{ a: 锚点名, x, y }——锚点由调用方提供（如 'dongzhuo'、'gate'、'player'），x / y 为偏移；
 *   特殊锚点：'@left' / '@right' / '@top' / '@bottom'（步骤开始时镜头视野的边，x / y 照样偏移）、'@center'（视野中心）；
 *   也可写演员 id（演员当前位置）。不写 a = 世界坐标。
 */
export type Dir = 'left' | 'right' | 'down' | 'up';
export interface Pos { a?: string; x?: number; y?: number; /** y 取另一个锚点（如从画面左边、与董卓同一高度出场）。 */ ay?: string }
/** 条件：主将或随行里有某武将（如张飞在队才喊「三姓家奴」）。 */
export interface Cond { hero?: string }

/** 演员外观。 */
export type ActorSpec =
  /** 首领骑乘图（public/assets/ride-v2/boss_<rider>_ride.png，4×9）+ v2 名马（horses-v2）。 */
  | { kind: 'ride'; rider: string; horse: 'chitu' | 'wuzhui' | 'jueying' | 'dawan' | 'generic' }
  /** 按方向命名帧的图集（'left_0' … 'up_3'，如 boss_lubu、武将行走图）。scale / foot（脚底在帧高的比例）。 */
  | { kind: 'sheet'; tex: string; scale: number; foot: number; attack?: string }
  /** 只有一张图（立绘、道具）。 */
  | { kind: 'image'; tex: string; frame?: string | number; scale: number; foot: number };

interface Base { if?: Cond; /** false = 不等它做完，直接进下一步。 */ wait?: boolean }
export type CutStep = Base & (
  | { t: 'letterbox'; on: boolean; ms?: number }
  | { t: 'fade'; to: number; ms: number; color?: number }
  | { t: 'wait'; ms: number }
  /** 镜头：平移到某处（中心）、缩放；ease：'sine' | 'quad' | 'linear'（默认 sine）。 */
  | { t: 'cam'; to?: Pos; zoom?: number; ms: number; ease?: Ease }
  | { t: 'shake'; ms: number; k: number }
  /** 慢动作：过场时钟倍率 scale，持续 ms（真实时间）。 */
  | { t: 'slow'; scale: number; ms: number }
  /** 顿帧：过场时钟停 ms（真实时间）。 */
  | { t: 'hitstop'; ms: number }
  | { t: 'flash'; color: number; ms: number; alpha?: number }
  | { t: 'actor'; id: string; spec: ActorSpec; at: Pos; face?: Dir }
  /** 用调用方提供的战场上的人（锚点里带精灵的，如董卓）当演员；fall：倒地帧图集（4 帧、格 288、脚底 256、朝右）。 */
  | { t: 'bind'; id: string; anchor: string; fall?: string }
  /** 姿势：walk / ride（走 / 骑行循环）、idle（站定）、attack（出招，播一遍停在最后一帧）、fall（倒地，播一遍停在最后一帧）。 */
  | { t: 'pose'; id: string; pose: Pose; face?: Dir; fps?: number }
  /** 走 / 骑到某处；dust：沿路扬尘（手绘扬尘序列帧）；face：先转向。 */
  | { t: 'move'; id: string; to: Pos; ms: number; ease?: Ease; pose?: Pose; dust?: boolean; face?: Dir }
  | { t: 'face'; id: string; dir: Dir }
  | { t: 'remove'; id: string }
  /** 手绘序列帧特效（SKILL_FX 里的键）：size 显示边长、ms 时长、rot 旋转（弧度）、add 叠加混合、tint、dy 往上抬。 */
  | { t: 'fx'; key: string; at: Pos; size: number; ms: number; rot?: number; flipX?: boolean; add?: boolean; tint?: number; originY?: number }
  /** 台词：cry = 大字战吼（头顶逐字砸下）；sub = 底部字幕（说话人名 + 句子）。who：演员 id / 锚点；name：显示的名字。 */
  | { t: 'say'; who?: string; name?: string; text: string; style: 'cry' | 'sub'; ms?: number; color?: string }
  | { t: 'sfx'; key: string; times?: number; every?: number }
  /** 背景乐压低（0–1，1 = 恢复）。 */
  | { t: 'music'; duck: number }
);
export type Pose = 'walk' | 'ride' | 'idle' | 'attack' | 'fall';
export type Ease = 'sine' | 'quad' | 'linear' | 'out';

export interface CutsceneScript {
  id: string; title: string;
  /** key = 关键剧情（「剧情：只看章头章末」也播）；full = 只在「完整」时播。 */
  level: 'key' | 'full';
  steps: CutStep[];
  /** 播完 / 跳过后留在场上、随后淡出的演员（id → 最终姿势），保证跳过与看完结果一致。 */
  linger?: Record<string, Pose>;
}
