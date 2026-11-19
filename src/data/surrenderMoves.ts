/**
 * 降将专属招式（用户 2026-11-18 批准：「每位降将加一个专属招式，直接从他当首领时的招式里挑一个缩小版来用」）。
 * 降将仍按模板（枪 / 刀 / 弓 / 谋）普通出手；每出手 every 下、且距上次 ≥ cd 毫秒时，改出这一招（不再出模板招式）。
 * 招式来自他当首领时的招式（data/bossMoves.ts 或专属控制器 HuaxiongBoss / LubuBoss / XurongBoss / GuanduBoss），缩小版：
 *  - 范围约为首领版 × 0.6（r / len / width 已按此写好，下面注释里是首领原值）；
 *  - 伤害写成「随行这一下普通出手」的倍数 dmg（首领版是对主将的伤害倍数，不能直接搬；这里按群伤 1.6–2.4 倍起步），
 *    每招最多打 maxHits 名敌人；
 *  - 预警只有 0.3 秒左右、染成友军的淡青色（FRIENDLY_TINT），落下用首领那招同一套手绘命中帧（WarnFx），不会被当成敌人的招。
 * 2026-11-19 平衡会话复核（按数值推算，未跑模拟）：吕布总输出 ≈ 关羽随行（两段大扇形与范围保留排面，降伤害 / 人数 / 加冷却），
 * 孟获 / 张绣 / 忙牙长 / 兀突骨 / 于禁 / 蔡瑁下调，颜良 / 朱然 / 华雄每段少打 1 人；其余在目标附近不动。等用户放开测试后用 test-follower-weapons 的 DPS 实测核对。
 * 键 = 降将的首领 id（Recruit.boss，与 surrender.ts 的 id 一致；于禁是剧情附送，没有首领战，招式是新配的）。
 */
export type AllyMoveKind =
  /** 扇形横扫（以随行为圆心朝目标）；times 多段（左右交替偏一点）。 */
  | 'sweep'
  /** 直线冲击（随行朝目标前冲一小段，沿线打）：charge = 冲锋道尘线；rift = 刀路裂地（华雄）。 */
  | 'charge' | 'rift'
  /** 贯穿一线（不位移）。 */
  | 'thrust'
  /** 目标附近几处落点（箭雨 / 落石 / 落火）。 */
  | 'volley'
  /** 以随行为圆心一圈圈向外（震地）。 */
  | 'rings'
  /** 扇形几道直线（连珠箭）。 */
  | 'fan';
export interface SurrenderMove {
  /** 招式名（首领招式原名）。 */ name: string;
  /** 卡片 / 图鉴上的一句话说明。 */ desc: string;
  /** 来自首领哪一招（图鉴注）。 */ from: string;
  kind: AllyMoveKind;
  /** 每出手几下出一次、且两次之间至少隔 cd 毫秒。 */ every: number; cd: number;
  /** 伤害 = 随行普通出手 × dmg；每段最多打 maxHits 人。 */ dmg: number; maxHits: number;
  /** 扇形半径 / 落点圈半径 / 线长（按招式种类用）。 */ r: number;
  /** 扇形张角（弧度）/ 线宽 / 落点散布。 */ arc?: number; width?: number; spread?: number;
  /** 段数（横扫）、落点数（箭雨）、道数（连珠）。 */ times?: number; count?: number;
  /** 震地各圈半径。 */ radii?: number[];
  /** 落点的手绘命中帧。 */ fx?: 'slam' | 'arrows' | 'fire';
}
/** 友军招式预警 / 命中帧的染色（淡青）：与敌人的红 / 土黄预警分开。 */
export const FRIENDLY_TINT = 0x9fd4ff;
/** 起手预警时长（毫秒）：比首领短得多，只是让玩家看出「这是自己人在放招」。 */
export const ALLY_WINDUP_MS = 320;

export const SURRENDER_MOVES: Record<string, SurrenderMove> = {
  // 第二章
  huaxiong: { name: '破军裂地', desc: '大刀顺刀路劈出一道裂地，沿线敌人受 2 倍伤害', from: '华雄 · 破军裂地（刀路裂地）', kind: 'rift', every: 3, cd: 9000, dmg: 2, maxHits: 5, r: 200, width: 46 },
  xurong: { name: '荥阳乱箭', desc: '号令伏兵放箭，目标附近落下 3 处箭雨', from: '徐荣 · 伏兵乱箭', kind: 'volley', every: 4, cd: 10000, dmg: 1.6, maxHits: 5, r: 46, spread: 70, count: 3, fx: 'arrows' },
  lubu: { name: '方天横扫', desc: '方天画戟大开大合，身前一大扇形连扫两段，每段 1.5 倍伤害', from: '吕布 · 方天戟横扫', kind: 'sweep', every: 3, cd: 10000, dmg: 1.5, maxHits: 4, r: 120, arc: Math.PI * .95, times: 2 },
  // 第三章
  lijue: { name: '西凉铁骑', desc: '朝敌阵冲出一段，沿线敌人受 1.8 倍伤害', from: '李傕 · 西凉铁骑（首领长 520）', kind: 'charge', every: 4, cd: 10000, dmg: 1.8, maxHits: 6, r: 240, width: 46 },
  zhangxiu: { name: '枪出如龙', desc: '长枪一线贯穿，直线上的敌人受 2 倍伤害', from: '张绣 · 枪出如龙（首领长 760）', kind: 'thrust', every: 3, cd: 9000, dmg: 2, maxHits: 5, r: 300, width: 30 },
  // 第四章
  yanliang: { name: '斩将突击', desc: '纵马突入，斩开一条路，沿线敌人受 2 倍伤害', from: '颜良 · 斩将突击', kind: 'charge', every: 3, cd: 9000, dmg: 2, maxHits: 5, r: 240, width: 50 },
  wenchou: { name: '回马骑射', desc: '回身连发三箭成扇面，每箭 1.6 倍伤害', from: '文丑 · 回马骑射', kind: 'fan', every: 3, cd: 9000, dmg: 1.6, maxHits: 3, r: 280, width: 24, arc: Math.PI * .4, count: 3 },
  chunyuqiong: { name: '乌巢落火', desc: '目标附近落下 3 团火，每团 1.6 倍伤害并点燃', from: '淳于琼 · 落火', kind: 'volley', every: 4, cd: 10000, dmg: 1.6, maxHits: 4, r: 42, spread: 70, count: 3, fx: 'fire' },
  // 第五章
  caimao: { name: '楼船箭雨', desc: '目标附近落下 4 处箭雨，每处 1.2 倍伤害', from: '蔡瑁 · 楼船箭雨（首领 7 处、半径 66）', kind: 'volley', every: 3, cd: 10000, dmg: 1.2, maxHits: 3, r: 40, spread: 90, count: 4, fx: 'arrows' },
  // 第六章
  zhaofan: { name: '弓阵齐射', desc: '目标附近落下 3 处箭雨，每处 1.5 倍伤害', from: '赵范 · 弓阵齐射（首领 5 处、半径 62）', kind: 'volley', every: 3, cd: 9000, dmg: 1.5, maxHits: 4, r: 38, spread: 80, count: 3, fx: 'arrows' },
  liudu: { name: '山越毒箭', desc: '号令山越弓手，目标附近落下 3 处毒箭，每处 1.5 倍伤害', from: '刘度 · 山越毒箭（首领 6 处、半径 62）', kind: 'volley', every: 3, cd: 9000, dmg: 1.5, maxHits: 4, r: 38, spread: 80, count: 3, fx: 'arrows' },
  // 第七章
  yanghuai: { name: '关隘滚石', desc: '目标附近砸下 2 块滚石，每块 2 倍伤害', from: '杨怀 · 关隘滚石（首领半径 95）', kind: 'volley', every: 4, cd: 10000, dmg: 2, maxHits: 5, r: 56, spread: 60, count: 2, fx: 'slam' },
  // 第十章
  zhuran: { name: '长枪突刺', desc: '长枪一线突刺，直线上的敌人受 2 倍伤害', from: '朱然 · 长枪突刺（首领长 560）', kind: 'thrust', every: 3, cd: 9000, dmg: 2, maxHits: 5, r: 260, width: 30 },
  // 第十一章
  mangyachang: { name: '蛮刀乱劈', desc: '蛮刀左右乱劈两段，身前扇形每段 1.3 倍伤害', from: '忙牙长 · 蛮刀乱劈（首领半径 125）', kind: 'sweep', every: 3, cd: 10000, dmg: 1.3, maxHits: 4, r: 80, arc: Math.PI * .9, times: 2 },
  wutugu: { name: '践踏震地', desc: '巨足践地，身边震出两圈，每圈 1.3 倍伤害', from: '兀突骨 · 践踏震地（首领两圈 120 / 220）', kind: 'rings', every: 4, cd: 10000, dmg: 1.3, maxHits: 4, r: 130, radii: [72, 130], width: 46 },
  menghuo: { name: '蛮王冲阵', desc: '蛮王蛮力冲阵，沿线敌人受 2 倍伤害', from: '孟获 · 蛮王冲阵（首领长 440）', kind: 'charge', every: 3, cd: 9000, dmg: 2, maxHits: 5, r: 260, width: 52 },
  // 剧情附送（9-2 后乞降；没有首领战）
  yujin: { name: '毅重军阵', desc: '于禁整肃军阵，身边震出一圈，圈上敌人受 1.3 倍伤害', from: '于禁（无首领战，新配：七军严整）', kind: 'rings', every: 4, cd: 10000, dmg: 1.3, maxHits: 4, r: 110, radii: [110], width: 50 },
};
/** 降将的专属招式（不是降将或没有配置时 null）。 */
export function surrenderMove(boss: string | null | undefined): SurrenderMove | null { return boss ? SURRENDER_MOVES[boss] ?? null : null; }
/** 卡片 / 图鉴用的一行：「专属 · 方天横扫：……」。 */
export function surrenderMoveLine(boss: string | null | undefined): string | null { const m = surrenderMove(boss); return m ? `专属 · ${m.name}：${m.desc}` : null; }
