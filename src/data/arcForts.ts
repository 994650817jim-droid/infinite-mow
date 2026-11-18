/**
 * 第 3~12 章场景里的关隘 / 城池（统筹会话 2026-11-17 定的障碍物整改）。
 * 原来这些关在场地中间摆一座孤零零的城门（场景 1）或城门 + 两座箭楼（场景 4），挡路又不能互动。现在按关的实际地形：
 *  - pass（关隘）：关墙横在北面、关门居中、门两侧箭楼（放箭雨、可打塌：掉战功 + 主将短时攻击加成），首领出阵时关门洞开、带亲卫杀出。
 *  - city（城池）：城墙 + 城门，不设箭楼；首领出阵时城门洞开、带亲卫杀出。
 *  - clear：本关不是关隘 / 城池（或已有自己的攻城 / 火线机制），场景里的城门去掉。
 * 关墙、箭楼、关门都是 2-1 汜水关那套（systems/SishuiPass.ts，攻城 v2 城墙图集），营帐不另放（这些章节已有自己的敌营）。
 * 键：章节 arc + '.' + 第几关。未列出的关保持原样。
 */
export type FortKind = 'pass' | 'city' | 'clear';
export interface ArcFort { kind: FortKind; gate?: readonly [string, string] }
export const ARC_FORTS: Record<string, ArcFort> = {
  // 场景 1（孤城门）
  'qunxiong.1': { kind: 'city', gate: ['长安城门洞开', '李傕率亲卫杀出城来'] },
  'chibi.1': { kind: 'clear' },
  'jingnan.1': { kind: 'city', gate: ['桂阳城门洞开', '赵范率亲卫出城迎战'] },
  'hanzhong.1': { kind: 'pass', gate: ['阳平关门洞开', '张郃率亲卫杀出关来'] },
  'yiling.1': { kind: 'pass', gate: ['猇亭寨门洞开', '孙桓率亲卫杀出'] },
  'beifa.1': { kind: 'clear' },
  // 场景 4（城门 + 两座箭楼）
  'chibi.3': { kind: 'pass', gate: ['江陵城门洞开', '曹仁率亲卫出城列阵'] },
  'jingnan.3': { kind: 'pass', gate: ['长沙城门洞开', '守将率亲卫出城迎战'] },
  'hanzhong.3': { kind: 'clear' },
  'yiling.3': { kind: 'clear' },
  'beifa.2': { kind: 'clear' },
};
/** 关墙离开局点的距离（第 3~12 章敌营在北面 -420 一带，关墙压在敌营后面）。 */
export const ARC_FORT_WALL_Y = -560;
