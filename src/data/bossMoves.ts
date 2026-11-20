import type { EnemyKind } from '../types';
import type { BossMountDef } from '../systems/BossMount';
import { sideMoves } from './sideRoutes';

/**
 * 首领专属招式 · 二阶段 · 骑马（设计表见共享笔记 boss-moves-plan.md；用户 2026-11-17「给boss设计首领专属招式和2阶段，还想boss也有骑马」）。
 * 每位首领只写配置，控制器统一是 systems/BossMoveset.ts；预警都用现成的手绘 WarnFx（长条 / 扇形 / 落点圈 / 伏兵）。
 * 伤害写成首领基础伤害的倍数（dmg），时间单位毫秒。初值，交平衡会话。
 */
export type MoveDef =
  /** 直线冲锋：先出长条预警，再沿线冲过去，撞到主将掉血；back 折返再冲一次；fire 冲过的路上留地火。 */
  | { kind: 'charge'; name: string; windupMs: number; cd: number; dmg: number; len: number; width: number; dashMs: number; back?: boolean; fire?: boolean; /** 两侧并行的骑兵道（虎豹冲阵）：只出预警与伤害，首领冲中间。 */ lanes?: number }
  /** 扇形多道箭（连珠箭阵）：从首领朝主将张开 count 道长条。 */
  | { kind: 'fan'; name: string; windupMs: number; cd: number; dmg: number; count: number; spread: number; len: number; width: number; /** 飞刀（祝融）：出手后每道飞出一把手绘飞刀（KnifeFx），刀飞过谁就伤谁（出手后还能躲）；值 = 飞行速度 px/s。 */ knives?: number }
  /** 扇形横扫（朝主将）。 */
  | { kind: 'sweep'; name: string; windupMs: number; cd: number; dmg: number; r: number; arc: number; times?: number }
  /** 以首领为圆心一圈圈向外的地裂（每圈一段延迟）。 */
  | { kind: 'rings'; name: string; windupMs: number; cd: number; dmg: number; radii: number[]; gapMs: number; band: number }
  /** 主将附近落点（箭雨 / 落石）。 */
  | { kind: 'volley'; name: string; windupMs: number; cd: number; dmg: number; count: number; r: number; spread: number; fx: 'arrows' | 'slam' | 'fire' }
  /** 贯穿一线的远距离刺 / 射（不位移）。 */
  | { kind: 'thrust'; name: string; windupMs: number; cd: number; dmg: number; len: number; width: number }
  /** 绕主将半圈奔驰，沿途落箭雨（劫掠）。 */
  | { kind: 'ride'; name: string; windupMs: number; cd: number; dmg: number; radius: number; ms: number; drops: number; r: number }
  /** 隐身后在主将身侧现身突刺。 */
  | { kind: 'vanish'; name: string; windupMs: number; cd: number; dmg: number; hideMs: number; r: number; arc: number }
  /** 召兵（伏兵预警后出现）。 */
  | { kind: 'summon'; name: string; windupMs: number; cd: number; dmg: number; troop: EnemyKind; count: number; radius: number; around: 'player' | 'boss' }
  /** 插旗阵：旗在时首领受伤 ×takenMul，砍倒旗才好打。 */
  | { kind: 'flags'; name: string; windupMs: number; cd: number; dmg: number; count: number; radius: number; hp: number; takenMul: number };

export interface PhaseDef {
  /** 横幅标题与小字。 */ name: string; caption: string;
  moves: MoveDef[];
  /** 招式间隔（毫秒）。 */ gapMs: number;
  /** 移速倍率（步战 / 骑马）。 */ speedMul: number;
  /** 进入此阶段时召的亲卫：在场时首领受伤 ×takenMul。 */ guards?: { troop: EnemyKind; count: number; takenMul: number };
  /**
   * 进入此阶段时在首领四周立「护法符柱」（2026-11-19 用户：1-2 军情「先打掉护法符柱，张宝才会受伤」——「这个玩法要应用到这一关」）：
   * 符柱没全碎时首领受伤 ×takenMul；手绘符柱图同 1-3 张角（zj_pillar）；符柱被自动索敌优先打（Enemy.ward）。
   */
  wards?: { count: number; radius: number; hp: number; takenMul: number };
}
export interface BossMovesetDef {
  id: string; name: string;
  /** 骑马（一阶段）；半血坠马转二阶段步战。 */ mount?: BossMountDef;
  /** 步战首领转二阶段的狂暴演出（不骑马的才用）：一阶段的旗帜倒下、大吼（手绘战吼声浪）、二阶段身上反复腾起气焰（手绘气焰，色调 color）。 */ rage?: { color: number; roar: string };
  p1: PhaseDef; p2: PhaseDef;
  /** 进二阶段的生命比例。 */ phaseAt: number;
}

/** 第一批（第 1–3 章）：张梁、张宝、李傕、张绣。 */
export const BOSS_MOVES: Record<string, BossMovesetDef> = {
  // 支线白门楼 · 陈宫（后排军师，data/sideRoutes.ts）：步战、走得慢；火攻落点 + 号令伏兵，二阶段亲兵护体
  chengong: {
    id: 'chengong', name: '陈宫', phaseAt: .5,
    p1: { name: '公台献策', caption: '火攻落点 · 号令伏兵', gapMs: 3000, speedMul: .55, moves: [
      { kind: 'volley', name: '火攻', windupMs: 1100, cd: 5200, dmg: 1.1, count: 5, r: 62, spread: 200, fx: 'fire' },
      { kind: 'summon', name: '号令伏兵', windupMs: 900, cd: 11000, dmg: 0, troop: 'archer', count: 4, radius: 200, around: 'player' },
    ] },
    p2: { name: '困守白门', caption: '连环火计 · 亲兵护体时陈宫减伤', gapMs: 2600, speedMul: .5, guards: { troop: 'shield', count: 3, takenMul: .5 }, moves: [
      { kind: 'volley', name: '连环火计', windupMs: 1000, cd: 4400, dmg: 1.2, count: 7, r: 62, spread: 240, fx: 'fire' },
      { kind: 'summon', name: '号令伏兵', windupMs: 900, cd: 12000, dmg: 0, troop: 'infantry', count: 4, radius: 220, around: 'player' },
    ] },
  },
  // 1-1 张梁（人公将军）：步战（用户 2026-11-18：第一章首领都不骑马）；黄天旗阵 + 徒步冲阵 → 半血「旗倒人狂」（旗倒、大吼、黄色气焰）：折返连冲、冲过留地火
  zhangliang: {
    id: 'zhangliang', name: '张梁', phaseAt: .5, rage: { color: 0xffd25a, roar: '苍天已死！' },
    p1: { name: '人公将军', caption: '黄天旗阵 · 人公冲阵', gapMs: 2600, speedMul: 1.1, moves: [
      { kind: 'flags', name: '黄天旗阵', windupMs: 700, cd: 16000, dmg: 0, count: 3, radius: 170, hp: 90, takenMul: .5 },
      { kind: 'charge', name: '人公冲阵', windupMs: 900, cd: 4200, dmg: 1.4, len: 300, width: 70, dashMs: 560 },
      { kind: 'sweep', name: '人公横斩', windupMs: 600, cd: 3600, dmg: 1.1, r: 120, arc: Math.PI * .8 },
    ] },
    p2: { name: '旗倒人狂', caption: '黄天旗倒 · 折返连冲，冲过之处起火', gapMs: 2000, speedMul: 1.15, moves: [
      { kind: 'charge', name: '人公连冲', windupMs: 800, cd: 4000, dmg: 1.5, len: 300, width: 70, dashMs: 520, back: true, fire: true },
      { kind: 'sweep', name: '黄巾大刀', windupMs: 650, cd: 3200, dmg: 1.3, r: 130, arc: Math.PI, times: 2 },
    ] },
  },
  // 1-2 张宝（地公将军，术士不骑）：地公裂土 + 撒豆成兵 → 妖术护体（符兵护体减伤）、裂土三圈
  zhangbao: {
    id: 'zhangbao', name: '张宝', phaseAt: .5,
    p1: { name: '地公将军', caption: '护法符柱 · 先打碎符柱', gapMs: 2800, speedMul: 1, wards: { count: 4, radius: 130, hp: 110, takenMul: .15 }, moves: [
      { kind: 'rings', name: '地公裂土', windupMs: 900, cd: 5000, dmg: 1.2, radii: [110, 200], gapMs: 420, band: 60 },
      { kind: 'summon', name: '撒豆成兵', windupMs: 800, cd: 9000, dmg: 0, troop: 'infantry', count: 5, radius: 150, around: 'boss' },
      { kind: 'volley', name: '黄沙符落', windupMs: 1100, cd: 4600, dmg: 1, count: 3, r: 62, spread: 120, fx: 'slam' },
    ] },
    // 二阶段：再立一轮符柱（代替原来的道兵护体，与军情提示一致）
    p2: { name: '妖术护体', caption: '符柱再起 · 打碎符柱张宝才会受伤', gapMs: 2200, speedMul: 1, wards: { count: 4, radius: 150, hp: 150, takenMul: .15 }, moves: [
      { kind: 'rings', name: '地公裂土 · 三重', windupMs: 900, cd: 4800, dmg: 1.3, radii: [100, 190, 280], gapMs: 380, band: 60 },
      { kind: 'volley', name: '黄沙符落', windupMs: 1000, cd: 3800, dmg: 1.1, count: 5, r: 62, spread: 150, fx: 'slam' },
    ] },
  },
  // 3-1 李傕（西凉余部）：骑西凉马；西凉铁骑长冲 + 劫掠长安绕圈箭雨 → 坠马「困兽之斗」：连劈 + 西凉亲兵护卫
  lijue: {
    id: 'lijue', name: '李傕', phaseAt: .5, mount: { horse: 'generic', tint: 0xb9774a, rider: 'lijue' },
    p1: { name: '西凉铁骑', caption: '长距离冲锋 · 绕阵箭雨', gapMs: 2400, speedMul: 1.4, moves: [
      { kind: 'charge', name: '西凉铁骑', windupMs: 900, cd: 4000, dmg: 1.5, len: 520, width: 76, dashMs: 560 },
      { kind: 'ride', name: '劫掠长安', windupMs: 600, cd: 7000, dmg: 1, radius: 260, ms: 1600, drops: 6, r: 64 },
    ] },
    p2: { name: '困兽之斗', caption: '坠马步战 · 西凉亲兵护卫时李傕减伤', gapMs: 2000, speedMul: 1, guards: { troop: 'infantry', count: 4, takenMul: .45 }, moves: [
      { kind: 'sweep', name: '困兽连劈', windupMs: 600, cd: 2800, dmg: 1.3, r: 125, arc: Math.PI * .9, times: 3 },
      { kind: 'summon', name: '西凉残部', windupMs: 800, cd: 10000, dmg: 0, troop: 'cavalry', count: 3, radius: 260, around: 'player' },
    ] },
  },
  // 3-1 郭汜（双首领第二批，李傕的同伙）：步战厚背砍刀（v2 图 third_guosi 是步战）；纵兵劫掠召西凉骑 → 二阶段「亡命狂刀」三连劈 + 拖刀突进
  guosi: {
    id: 'guosi', name: '郭汜', phaseAt: .5,
    p1: { name: '西凉悍将', caption: '厚背砍刀 · 纵兵劫掠', gapMs: 2400, speedMul: 1.1, moves: [
      { kind: 'sweep', name: '厚背砍刀', windupMs: 650, cd: 3200, dmg: 1.3, r: 130, arc: Math.PI * .8, times: 2 },
      { kind: 'summon', name: '纵兵劫掠', windupMs: 800, cd: 9000, dmg: 0, troop: 'cavalry', count: 3, radius: 240, around: 'player' },
    ] },
    p2: { name: '亡命狂刀', caption: '三连劈 · 拖刀突进', gapMs: 2000, speedMul: 1.15, moves: [
      { kind: 'sweep', name: '亡命狂刀', windupMs: 600, cd: 2800, dmg: 1.3, r: 135, arc: Math.PI * .9, times: 3 },
      { kind: 'thrust', name: '拖刀突进', windupMs: 800, cd: 4200, dmg: 1.6, len: 420, width: 62 },
    ] },
  },
  // 3-2 张绣（北地枪王）：骑白马；百鸟朝凤枪 + 宛城夜袭（隐身突刺）→ 坠马「枪出如龙」：贯穿一线 + 二连扇刺
  zhangxiu: {
    id: 'zhangxiu', name: '张绣', phaseAt: .5, mount: { horse: 'generic', rider: 'zhangxiu' },
    p1: { name: '北地枪王', caption: '百鸟朝凤枪 · 宛城夜袭', gapMs: 2400, speedMul: 1.35, moves: [
      { kind: 'sweep', name: '百鸟朝凤枪', windupMs: 650, cd: 3400, dmg: 1.1, r: 150, arc: Math.PI * .5, times: 3 },
      { kind: 'vanish', name: '宛城夜袭', windupMs: 500, cd: 7500, dmg: 1.6, hideMs: 1300, r: 140, arc: Math.PI * .6 },
      { kind: 'charge', name: '白马突阵', windupMs: 800, cd: 5000, dmg: 1.3, len: 420, width: 64, dashMs: 480 },
    ] },
    p2: { name: '枪出如龙', caption: '坠马步战 · 一线贯穿长枪', gapMs: 1900, speedMul: 1, moves: [
      { kind: 'thrust', name: '枪出如龙', windupMs: 900, cd: 3600, dmg: 1.8, len: 760, width: 46 },
      { kind: 'sweep', name: '二连扇刺', windupMs: 550, cd: 3000, dmg: 1.2, r: 150, arc: Math.PI * .6, times: 2 },
      { kind: 'vanish', name: '宛城夜袭', windupMs: 450, cd: 7000, dmg: 1.7, hideMs: 1100, r: 140, arc: Math.PI * .6 },
    ] },
  },
  // ===== 第二批：第四章骑马补丁、第五章曹纯 / 蔡瑁、第六章荆南四将 =====
  // 5-1 曹纯（虎豹骑）：骑黑马；虎豹冲阵（三道并冲）+ 长坂追袭（折返连冲）→ 坠马「虎豹围猎」：虎豹骑合围
  caochun: {
    id: 'caochun', name: '曹纯', phaseAt: .5, mount: { horse: 'wuzhui', rider: 'caochun' },
    p1: { name: '虎豹骑', caption: '三道并冲 · 长坂追袭', gapMs: 2300, speedMul: 1.45, moves: [
      { kind: 'charge', name: '虎豹冲阵', windupMs: 1000, cd: 4600, dmg: 1.4, len: 480, width: 70, dashMs: 520, lanes: 3 },
      { kind: 'charge', name: '长坂追袭', windupMs: 700, cd: 5200, dmg: 1.3, len: 300, width: 64, dashMs: 380, back: true },
    ] },
    p2: { name: '虎豹围猎', caption: '坠马步战 · 虎豹骑四面合围', gapMs: 2100, speedMul: 1, moves: [
      { kind: 'summon', name: '虎豹围猎', windupMs: 900, cd: 9000, dmg: 0, troop: 'cavalry', count: 6, radius: 280, around: 'player' },
      { kind: 'sweep', name: '马刀横扫', windupMs: 600, cd: 3000, dmg: 1.3, r: 130, arc: Math.PI * .9, times: 2 },
    ] },
  },
  // 5-2 蔡瑁（水军都督，不骑）：楼船箭雨 + 水军旗令 →「连环火起」：火箭雨（落点起火）+ 水军增援
  caimao: {
    id: 'caimao', name: '蔡瑁', phaseAt: .5,
    p1: { name: '荆州水军', caption: '楼船箭雨 · 水军旗令', gapMs: 2600, speedMul: 1, moves: [
      { kind: 'volley', name: '楼船箭雨', windupMs: 1200, cd: 4200, dmg: 1, count: 7, r: 66, spread: 220, fx: 'arrows' },
      { kind: 'flags', name: '水军旗令', windupMs: 700, cd: 15000, dmg: 0, count: 3, radius: 180, hp: 110, takenMul: .55 },
    ] },
    p2: { name: '连环火起', caption: '火箭雨落处起火 · 水军增援', gapMs: 2100, speedMul: 1, moves: [
      { kind: 'volley', name: '火箭齐发', windupMs: 1100, cd: 3600, dmg: 1.2, count: 8, r: 70, spread: 230, fx: 'fire' },
      { kind: 'summon', name: '水军增援', windupMs: 800, cd: 9000, dmg: 0, troop: 'archer', count: 5, radius: 260, around: 'player' },
    ] },
  },
  // 6-1 赵范（桂阳太守，不骑）：亲军护驾 + 弓阵齐射 →「弃城欲逃」：绕城奔逃、身后落绊马索（落点）
  zhaofan: {
    id: 'zhaofan', name: '赵范', phaseAt: .5,
    p1: { name: '桂阳太守', caption: '亲军护驾 · 弓阵齐射', gapMs: 2600, speedMul: 1, moves: [
      { kind: 'summon', name: '亲军护驾', windupMs: 800, cd: 9000, dmg: 0, troop: 'shield', count: 4, radius: 110, around: 'boss' },
      { kind: 'volley', name: '弓阵齐射', windupMs: 1100, cd: 4200, dmg: 1, count: 5, r: 62, spread: 170, fx: 'arrows' },
    ] },
    p2: { name: '弃城欲逃', caption: '赵范绕城奔逃 · 身后落下绊索', gapMs: 2000, speedMul: 1.3, moves: [
      { kind: 'ride', name: '弃城欲逃', windupMs: 500, cd: 6000, dmg: .9, radius: 280, ms: 1800, drops: 6, r: 60 },
      { kind: 'volley', name: '弓阵齐射', windupMs: 1000, cd: 3800, dmg: 1.1, count: 6, r: 62, spread: 180, fx: 'arrows' },
    ] },
  },
  // 6-2 刘度（零陵太守，不骑）：山越伏林 + 藤牌推进 →「据险死守」：藤牌兵护体减伤 + 箭雨
  liudu: {
    id: 'liudu', name: '刘度', phaseAt: .5,
    p1: { name: '零陵太守', caption: '山越伏林 · 藤牌推进', gapMs: 2600, speedMul: 1, moves: [
      { kind: 'summon', name: '山越伏林', windupMs: 900, cd: 8500, dmg: 0, troop: 'archer', count: 5, radius: 250, around: 'player' },
      { kind: 'summon', name: '藤牌推进', windupMs: 800, cd: 9500, dmg: 0, troop: 'shield', count: 5, radius: 150, around: 'boss' },
      { kind: 'sweep', name: '军刀横扫', windupMs: 650, cd: 3400, dmg: 1.2, r: 125, arc: Math.PI * .9 },
    ] },
    p2: { name: '据险死守', caption: '藤牌兵护体时刘度减伤 · 先破藤牌', gapMs: 2200, speedMul: .9, guards: { troop: 'shield', count: 5, takenMul: .3 }, moves: [
      { kind: 'volley', name: '山越毒箭', windupMs: 1000, cd: 3600, dmg: 1.1, count: 6, r: 62, spread: 190, fx: 'arrows' },
      { kind: 'sweep', name: '军刀横扫', windupMs: 600, cd: 3000, dmg: 1.3, r: 130, arc: Math.PI * .9, times: 2 },
    ] },
  },
  // 6-3 黄忠（长沙老将，可劝降）：骑马；百步穿杨（贯穿一箭）+ 连珠箭阵（扇形五箭）→ 坠马「老当益壮」：大刀连斩 + 穿杨
  huangzhong: {
    id: 'huangzhong', name: '黄忠', phaseAt: .5, mount: { horse: 'generic', tint: 0xc8a070, rider: 'huangzhong' },
    p1: { name: '长沙老将', caption: '百步穿杨 · 连珠箭阵', gapMs: 2400, speedMul: 1.3, moves: [
      { kind: 'thrust', name: '百步穿杨', windupMs: 1100, cd: 4000, dmg: 1.9, len: 820, width: 40 },
      { kind: 'fan', name: '连珠箭阵', windupMs: 900, cd: 4600, dmg: 1.1, count: 5, spread: Math.PI * .55, len: 520, width: 34 },
    ] },
    p2: { name: '老当益壮', caption: '坠马步战 · 大刀连斩', gapMs: 1900, speedMul: 1.15, moves: [
      { kind: 'sweep', name: '老当益壮', windupMs: 550, cd: 2800, dmg: 1.4, r: 135, arc: Math.PI, times: 3 },
      { kind: 'thrust', name: '百步穿杨', windupMs: 900, cd: 4200, dmg: 2, len: 820, width: 40 },
    ] },
  },
  // 6-3 韩玄（长沙太守，不骑）：严刑督战（召兵）+ 城头弓阵 →「困兽」：亲兵护体
  hanxuan: {
    id: 'hanxuan', name: '韩玄', phaseAt: .5,
    p1: { name: '长沙太守', caption: '严刑督战 · 城头弓阵', gapMs: 2500, speedMul: 1, moves: [
      { kind: 'summon', name: '严刑督战', windupMs: 900, cd: 8000, dmg: 0, troop: 'infantry', count: 6, radius: 240, around: 'player' },
      { kind: 'volley', name: '城头弓阵', windupMs: 1100, cd: 4000, dmg: 1.1, count: 6, r: 64, spread: 200, fx: 'arrows' },
    ] },
    p2: { name: '困兽', caption: '亲兵护体时韩玄减伤 · 先打亲兵', gapMs: 2100, speedMul: 1, guards: { troop: 'infantry', count: 5, takenMul: .35 }, moves: [
      { kind: 'sweep', name: '困兽乱劈', windupMs: 600, cd: 3000, dmg: 1.3, r: 125, arc: Math.PI * .9, times: 2 },
      { kind: 'volley', name: '城头弓阵', windupMs: 1000, cd: 3600, dmg: 1.2, count: 7, r: 64, spread: 210, fx: 'arrows' },
    ] },
  },

  // ===== 第三批：第八章汉中、第十章夷陵（孙桓 / 朱然）、第十二章北伐（张郃再战 / 郝昭） =====
  // 8-1 / 12-1 张郃：骑马；巧变阵（三面枪兵合围）+ 突阵 + 连环枪 → 坠马「瓦口隘死战」：亲卫护体、连环枪三段
  zhanghe: {
    id: 'zhanghe', name: '张郃', phaseAt: .5, mount: { horse: 'generic', tint: 0x8a96b0, rider: 'zhanghe' },
    p1: { name: '巧变之将', caption: '巧变阵 · 突阵 · 连环枪', gapMs: 2300, speedMul: 1.35, moves: [
      { kind: 'summon', name: '巧变阵', windupMs: 900, cd: 8500, dmg: 0, troop: 'infantry', count: 6, radius: 240, around: 'player' },
      { kind: 'charge', name: '张郃突阵', windupMs: 850, cd: 4400, dmg: 1.4, len: 440, width: 66, dashMs: 480 },
      { kind: 'sweep', name: '连环枪击', windupMs: 600, cd: 3400, dmg: 1.2, r: 145, arc: Math.PI * .55, times: 2 },
    ] },
    p2: { name: '瓦口隘死战', caption: '坠马步战 · 亲卫护体时张郃减伤', gapMs: 2000, speedMul: 1, guards: { troop: 'infantry', count: 4, takenMul: .45 }, moves: [
      { kind: 'sweep', name: '连环枪击', windupMs: 550, cd: 2800, dmg: 1.3, r: 150, arc: Math.PI * .55, times: 3 },
      { kind: 'thrust', name: '长枪贯阵', windupMs: 850, cd: 4200, dmg: 1.7, len: 640, width: 44 },
    ] },
  },
  // 8-2 夏侯渊：骑马；疾行突袭（全屏长冲折返）+ 三日五百（绕阵箭雨）→ 坠马「军刀横扫」大范围 + 召骑兵
  xiahouyuan: {
    id: 'xiahouyuan', name: '夏侯渊', phaseAt: .5, mount: { horse: 'generic', tint: 0x5a4a3a, rider: 'xiahouyuan' },
    p1: { name: '疾行之将', caption: '疾行突袭 · 三日五百', gapMs: 2100, speedMul: 1.55, moves: [
      { kind: 'charge', name: '疾行突袭', windupMs: 900, cd: 4800, dmg: 1.5, len: 720, width: 70, dashMs: 560, back: true },
      { kind: 'ride', name: '三日五百', windupMs: 500, cd: 7000, dmg: 1.1, radius: 300, ms: 1700, drops: 8, r: 64 },
    ] },
    p2: { name: '军刀横扫', caption: '坠马步战 · 大范围横扫', gapMs: 2000, speedMul: 1.05, moves: [
      { kind: 'sweep', name: '军刀横扫', windupMs: 650, cd: 3000, dmg: 1.5, r: 170, arc: Math.PI * 1.1, times: 2 },
      { kind: 'summon', name: '号令援军', windupMs: 800, cd: 9000, dmg: 0, troop: 'cavalry', count: 4, radius: 280, around: 'player' },
    ] },
  },
  // 8-3 曹操：骑绝影；虎豹骑冲阵（三道）+ 挟天子令诸侯（插旗减伤）→ 坠马「鸡肋断后」：火线箭雨、虎豹骑断后
  caocao: {
    id: 'caocao', name: '曹操', phaseAt: .5, mount: { horse: 'jueying', rider: 'caocao' },
    p1: { name: '魏王', caption: '虎豹骑冲阵 · 挟天子令诸侯', gapMs: 2400, speedMul: 1.35, moves: [
      { kind: 'charge', name: '虎豹骑冲阵', windupMs: 1000, cd: 4600, dmg: 1.5, len: 500, width: 72, dashMs: 520, lanes: 3 },
      { kind: 'flags', name: '挟天子令诸侯', windupMs: 800, cd: 15000, dmg: 0, count: 3, radius: 190, hp: 130, takenMul: .5 },
      { kind: 'sweep', name: '倚天剑斩', windupMs: 600, cd: 3400, dmg: 1.3, r: 135, arc: Math.PI * .9 },
    ] },
    p2: { name: '鸡肋断后', caption: '坠马步战 · 断后火线 · 虎豹骑护驾', gapMs: 2000, speedMul: 1, guards: { troop: 'cavalry', count: 4, takenMul: .5 }, moves: [
      { kind: 'volley', name: '断后火线', windupMs: 1000, cd: 3600, dmg: 1.2, count: 7, r: 66, spread: 220, fx: 'fire' },
      { kind: 'sweep', name: '倚天剑斩', windupMs: 550, cd: 3000, dmg: 1.4, r: 140, arc: Math.PI, times: 2 },
    ] },
  },
  // 10-1 孙桓：骑马；宗室锐气（冲阵）+ 夷道死守（召兵）→ 坠马连斩
  sunhuan: {
    id: 'sunhuan', name: '孙桓', phaseAt: .5, mount: { horse: 'generic', tint: 0xb06048, rider: 'sunhuan' },
    p1: { name: '宗室少将', caption: '宗室锐气 · 夷道死守', gapMs: 2300, speedMul: 1.4, moves: [
      { kind: 'charge', name: '宗室锐气', windupMs: 850, cd: 4200, dmg: 1.4, len: 460, width: 66, dashMs: 480 },
      { kind: 'summon', name: '夷道死守', windupMs: 800, cd: 9000, dmg: 0, troop: 'infantry', count: 5, radius: 160, around: 'boss' },
    ] },
    p2: { name: '少年血勇', caption: '坠马步战 · 连斩', gapMs: 1900, speedMul: 1.1, moves: [
      { kind: 'sweep', name: '连斩', windupMs: 550, cd: 2800, dmg: 1.4, r: 130, arc: Math.PI * .9, times: 3 },
      { kind: 'charge', name: '步战突进', windupMs: 700, cd: 4600, dmg: 1.3, len: 320, width: 60, dashMs: 420 },
    ] },
  },
  // 10-2 朱然：骑马；连营反扑（绕营奔袭箭雨）+ 长枪突刺 → 坠马「坚守夷道」：亲兵护体减伤
  zhuran: {
    id: 'zhuran', name: '朱然', phaseAt: .5, mount: { horse: 'generic', tint: 0x9a6a52, rider: 'zhuran' },
    p1: { name: '昭武将军', caption: '连营反扑 · 长枪突刺', gapMs: 2300, speedMul: 1.35, moves: [
      { kind: 'ride', name: '连营反扑', windupMs: 500, cd: 6500, dmg: 1.1, radius: 290, ms: 1700, drops: 7, r: 64 },
      { kind: 'thrust', name: '长枪突刺', windupMs: 800, cd: 3800, dmg: 1.6, len: 560, width: 44 },
    ] },
    p2: { name: '坚守夷道', caption: '坠马步战 · 亲兵护体时朱然减伤', gapMs: 2100, speedMul: .95, guards: { troop: 'shield', count: 5, takenMul: .35 }, moves: [
      { kind: 'sweep', name: '长枪横扫', windupMs: 600, cd: 3000, dmg: 1.3, r: 150, arc: Math.PI * .8, times: 2 },
      { kind: 'volley', name: '营寨弓弩', windupMs: 1000, cd: 3800, dmg: 1.1, count: 6, r: 64, spread: 200, fx: 'arrows' },
    ] },
  },
  // 12-2 郝昭（守将，不骑）：火箭逆射 + 石磨压阵（大落石）→「死守陈仓」：城头弓手护体减伤
  haozhao: {
    id: 'haozhao', name: '郝昭', phaseAt: .5,
    p1: { name: '陈仓守将', caption: '火箭逆射 · 石磨压阵', gapMs: 2500, speedMul: 1, moves: [
      { kind: 'volley', name: '火箭逆射', windupMs: 1100, cd: 4000, dmg: 1.1, count: 6, r: 64, spread: 200, fx: 'fire' },
      { kind: 'volley', name: '石磨压阵', windupMs: 1300, cd: 5200, dmg: 1.6, count: 2, r: 105, spread: 120, fx: 'slam' },
    ] },
    p2: { name: '死守陈仓', caption: '城头弓手护体时郝昭减伤 · 先打弓手', gapMs: 2100, speedMul: 1, guards: { troop: 'archer', count: 5, takenMul: .4 }, moves: [
      { kind: 'volley', name: '火箭逆射', windupMs: 1000, cd: 3400, dmg: 1.2, count: 8, r: 64, spread: 220, fx: 'fire' },
      { kind: 'volley', name: '石磨压阵', windupMs: 1200, cd: 4600, dmg: 1.7, count: 3, r: 105, spread: 150, fx: 'slam' },
    ] },
  },

  // ===== 第四批：第七章入蜀、第九章襄樊、第十一章南征（走路动画会话的场景；场地机制不动，只配首领招式） =====
  // 7-1 杨怀（白水关，不骑）：白水伏杀（席间暗刺：隐身后近身）+ 关隘滚石（大落石）→「困兽」：亲兵护体
  yanghuai: {
    id: 'yanghuai', name: '杨怀', phaseAt: .5,
    p1: { name: '白水关', caption: '白水伏杀 · 关隘滚石', gapMs: 2500, speedMul: 1, moves: [
      { kind: 'vanish', name: '白水伏杀', windupMs: 500, cd: 7500, dmg: 1.6, hideMs: 1300, r: 135, arc: Math.PI * .6 },
      { kind: 'volley', name: '关隘滚石', windupMs: 1300, cd: 4800, dmg: 1.5, count: 3, r: 95, spread: 160, fx: 'slam' },
    ] },
    p2: { name: '困兽', caption: '亲兵护体时杨怀减伤 · 先打亲兵', gapMs: 2100, speedMul: 1, guards: { troop: 'infantry', count: 4, takenMul: .4 }, moves: [
      { kind: 'sweep', name: '困兽乱劈', windupMs: 600, cd: 3000, dmg: 1.3, r: 125, arc: Math.PI * .9, times: 2 },
      { kind: 'volley', name: '关隘滚石', windupMs: 1200, cd: 4200, dmg: 1.6, count: 4, r: 95, spread: 190, fx: 'slam' },
    ] },
  },
  // 7-2 张任（落凤坡）：骑马；落凤伏弩（扇形连弩）+ 冲阵 → 坠马「宁死不降」：弓手护体、连弩更密
  zhangren: {
    id: 'zhangren', name: '张任', phaseAt: .5, mount: { horse: 'generic', tint: 0x7a6a58 },
    p1: { name: '落凤坡', caption: '落凤伏弩 · 冲阵', gapMs: 2300, speedMul: 1.35, moves: [
      { kind: 'fan', name: '落凤伏弩', windupMs: 950, cd: 4400, dmg: 1.2, count: 5, spread: Math.PI * .5, len: 560, width: 34 },
      { kind: 'charge', name: '张任冲阵', windupMs: 850, cd: 4800, dmg: 1.4, len: 440, width: 66, dashMs: 480 },
    ] },
    p2: { name: '宁死不降', caption: '坠马步战 · 弓手护体时张任减伤', gapMs: 2000, speedMul: 1, guards: { troop: 'archer', count: 4, takenMul: .45 }, moves: [
      { kind: 'fan', name: '伏弩连射', windupMs: 850, cd: 3600, dmg: 1.2, count: 7, spread: Math.PI * .7, len: 560, width: 32 },
      { kind: 'sweep', name: '宁死不降', windupMs: 600, cd: 3200, dmg: 1.4, r: 130, arc: Math.PI, times: 2 },
    ] },
  },
  // 7-3 刘璋（益州牧，统帅不骑）：闭城自守（召守军）+ 城头弓阵 →「困守州府」：盾兵护体减伤
  liuzhang: {
    id: 'liuzhang', name: '刘璋', phaseAt: .5,
    p1: { name: '益州牧', caption: '闭城自守 · 城头弓阵', gapMs: 2600, speedMul: .9, moves: [
      { kind: 'summon', name: '闭城自守', windupMs: 900, cd: 8000, dmg: 0, troop: 'infantry', count: 6, radius: 240, around: 'player' },
      { kind: 'volley', name: '城头弓阵', windupMs: 1100, cd: 4000, dmg: 1.1, count: 6, r: 64, spread: 200, fx: 'arrows' },
    ] },
    p2: { name: '困守州府', caption: '盾兵护体时刘璋减伤 · 先破盾兵', gapMs: 2200, speedMul: .9, guards: { troop: 'shield', count: 5, takenMul: .35 }, moves: [
      { kind: 'volley', name: '州府箭雨', windupMs: 1000, cd: 3600, dmg: 1.2, count: 7, r: 64, spread: 220, fx: 'arrows' },
      { kind: 'summon', name: '益州援兵', windupMs: 800, cd: 9000, dmg: 0, troop: 'infantry', count: 5, radius: 260, around: 'player' },
    ] },
  },
  // 9-1 曹仁（樊城守将，不骑；第五章有专属八门金锁控制器，这里用章节键单配）：樊城精兵 + 大刀 →「城门死守」：盾兵护体
  'xiangfan.caoren': {
    id: 'caoren', name: '曹仁', phaseAt: .5,
    p1: { name: '樊城守将', caption: '樊城精兵 · 坚守', gapMs: 2500, speedMul: 1, moves: [
      { kind: 'summon', name: '樊城精兵', windupMs: 900, cd: 8500, dmg: 0, troop: 'infantry', count: 6, radius: 230, around: 'player' },
      { kind: 'sweep', name: '大刀横扫', windupMs: 650, cd: 3400, dmg: 1.3, r: 130, arc: Math.PI * .9 },
    ] },
    p2: { name: '城门死守', caption: '盾兵护体时曹仁减伤 · 先破盾阵', gapMs: 2100, speedMul: .95, guards: { troop: 'shield', count: 5, takenMul: .35 }, moves: [
      { kind: 'sweep', name: '大刀连斩', windupMs: 600, cd: 3000, dmg: 1.4, r: 135, arc: Math.PI, times: 2 },
      { kind: 'volley', name: '城头弓阵', windupMs: 1100, cd: 4000, dmg: 1.1, count: 6, r: 64, spread: 200, fx: 'arrows' },
    ] },
  },
  // 9-2 庞德（抬榇决战）：骑白马；抬榇冲锋 + 额前一箭（远射）→ 坠马「死战不退」：狂暴连斩（场景里另有半血抬棺加速）
  pangde: {
    id: 'pangde', name: '庞德', phaseAt: .5, mount: { horse: 'generic' },
    p1: { name: '抬榇决战', caption: '抬榇冲锋 · 额前一箭', gapMs: 2300, speedMul: 1.35, moves: [
      { kind: 'charge', name: '抬榇冲锋', windupMs: 850, cd: 4200, dmg: 1.6, len: 480, width: 70, dashMs: 480 },
      { kind: 'thrust', name: '额前一箭', windupMs: 1000, cd: 4600, dmg: 1.7, len: 760, width: 38 },
    ] },
    // 移速不再另加：XiangfanGameScene 半血抬棺狂暴已把移速 ×1.45、伤害 ×1.35（两边叠加会过快）
    p2: { name: '死战不退', caption: '坠马步战 · 狂暴连斩', gapMs: 1700, speedMul: 1, moves: [
      { kind: 'sweep', name: '死战连斩', windupMs: 500, cd: 2600, dmg: 1.5, r: 135, arc: Math.PI, times: 3 },
      { kind: 'charge', name: '步战冲杀', windupMs: 650, cd: 4200, dmg: 1.5, len: 340, width: 64, dashMs: 400, back: true },
    ] },
  },
  // 9-3 吕蒙（白衣渡江，不骑）：白衣渡江（隐身后另处突袭）+ 士别三日（连斩）→「麦城合围」：召兵封路 + 箭雨
  lvmeng: {
    id: 'lvmeng', name: '吕蒙', phaseAt: .5,
    p1: { name: '白衣渡江', caption: '隐身突袭 · 士别三日', gapMs: 2300, speedMul: 1.1, moves: [
      { kind: 'vanish', name: '白衣渡江', windupMs: 500, cd: 7000, dmg: 1.7, hideMs: 1400, r: 140, arc: Math.PI * .6 },
      { kind: 'sweep', name: '士别三日', windupMs: 600, cd: 3200, dmg: 1.3, r: 130, arc: Math.PI * .9, times: 3 },
    ] },
    p2: { name: '麦城合围', caption: '召兵封路 · 箭雨', gapMs: 2000, speedMul: 1.1, moves: [
      { kind: 'summon', name: '麦城合围', windupMs: 900, cd: 8500, dmg: 0, troop: 'infantry', count: 7, radius: 260, around: 'player' },
      { kind: 'volley', name: '吴军箭雨', windupMs: 1000, cd: 3600, dmg: 1.2, count: 7, r: 64, spread: 220, fx: 'arrows' },
      { kind: 'vanish', name: '白衣再渡', windupMs: 450, cd: 7500, dmg: 1.8, hideMs: 1200, r: 140, arc: Math.PI * .6 },
    ] },
  },
  // 11-1 忙牙长（不骑）：蛮刀乱劈 + 象兵冲撞（第十一章的骑兵就是象兵）→「瘴气」：身边一圈圈外扩
  mangyachang: {
    id: 'mangyachang', name: '忙牙长', phaseAt: .5,
    p1: { name: '蛮将', caption: '蛮刀乱劈 · 象兵冲撞', gapMs: 2400, speedMul: 1, moves: [
      { kind: 'sweep', name: '蛮刀乱劈', windupMs: 600, cd: 3000, dmg: 1.3, r: 125, arc: Math.PI * .9, times: 3 },
      { kind: 'summon', name: '象兵冲撞', windupMs: 900, cd: 9500, dmg: 0, troop: 'cavalry', count: 2, radius: 300, around: 'player' },
    ] },
    p2: { name: '瘴气', caption: '身边瘴气一圈圈外扩', gapMs: 2000, speedMul: 1, moves: [
      { kind: 'rings', name: '瘴气弥漫', windupMs: 900, cd: 4400, dmg: 1.2, radii: [110, 200, 290], gapMs: 400, band: 60 },
      { kind: 'sweep', name: '蛮刀狂劈', windupMs: 550, cd: 2800, dmg: 1.4, r: 130, arc: Math.PI, times: 3 },
    ] },
  },
  // 11-2 兀突骨（乌戈国主，不骑）：巨人践踏（重冲）+ 践踏震地 →「藤甲狂怒」：更快、三重震地
  wutugu: {
    id: 'wutugu', name: '兀突骨', phaseAt: .5,
    p1: { name: '乌戈国主', caption: '巨人践踏 · 震地', gapMs: 2500, speedMul: .95, moves: [
      { kind: 'charge', name: '巨人践踏', windupMs: 950, cd: 4600, dmg: 1.7, len: 400, width: 80, dashMs: 560 },
      { kind: 'rings', name: '践踏震地', windupMs: 900, cd: 5000, dmg: 1.3, radii: [120, 220], gapMs: 420, band: 70 },
    ] },
    p2: { name: '藤甲狂怒', caption: '兀突骨狂怒 · 三重震地', gapMs: 1900, speedMul: 1.2, moves: [
      { kind: 'rings', name: '三重震地', windupMs: 850, cd: 4200, dmg: 1.4, radii: [110, 210, 310], gapMs: 380, band: 70 },
      { kind: 'charge', name: '狂怒践踏', windupMs: 800, cd: 4200, dmg: 1.8, len: 400, width: 80, dashMs: 500, back: true },
    ] },
  },
  // 11-3 祝融夫人（双首领第二批，孟获之妻，v2 图 nz_zhurong）：飞刀扇射（手绘旋转飞刀，出手后还能侧身躲）+ 火神落刀 →「火神之后」七刀连射 + 双刀旋舞
  zhurong: {
    id: 'zhurong', name: '祝融', phaseAt: .5,
    p1: { name: '祝融夫人', caption: '飞刀扇射 · 火神落刀', gapMs: 2300, speedMul: 1.15, moves: [
      { kind: 'fan', name: '飞刀', windupMs: 750, cd: 3400, dmg: 1.1, count: 5, spread: .9, len: 520, width: 40, knives: 620 },
      { kind: 'volley', name: '火神落刀', windupMs: 950, cd: 6000, dmg: 1.2, count: 4, r: 60, spread: 130, fx: 'fire' },
    ] },
    p2: { name: '火神之后', caption: '七刀连射 · 双刀旋舞', gapMs: 1900, speedMul: 1.25, moves: [
      { kind: 'fan', name: '七刀连射', windupMs: 700, cd: 3000, dmg: 1.2, count: 7, spread: 1.3, len: 560, width: 40, knives: 680 },
      { kind: 'sweep', name: '双刀旋舞', windupMs: 550, cd: 3200, dmg: 1.2, r: 120, arc: Math.PI * 1.4, times: 2 },
    ] },
  },
  // 11-3 孟获（南蛮王）：象的骑乘图未到先步战；蛮王冲阵 + 蛮王怒吼 →「七擒不服」：召象兵 + 震地（场景里另有七擒七纵）
  menghuo: {
    id: 'menghuo', name: '孟获', phaseAt: .5,
    p1: { name: '南蛮王', caption: '蛮王冲阵 · 蛮王怒吼', gapMs: 2400, speedMul: 1.05, moves: [
      { kind: 'charge', name: '蛮王冲阵', windupMs: 850, cd: 4400, dmg: 1.5, len: 440, width: 72, dashMs: 500 },
      { kind: 'summon', name: '蛮王怒吼', windupMs: 900, cd: 8500, dmg: 0, troop: 'infantry', count: 6, radius: 240, around: 'player' },
    ] },
    p2: { name: '七擒不服', caption: '象兵冲阵 · 蛮王震地', gapMs: 2000, speedMul: 1.1, moves: [
      { kind: 'summon', name: '象兵冲阵', windupMs: 900, cd: 9000, dmg: 0, troop: 'cavalry', count: 3, radius: 300, around: 'player' },
      { kind: 'rings', name: '蛮王震地', windupMs: 850, cd: 4400, dmg: 1.4, radii: [110, 210, 300], gapMs: 400, band: 65 },
      { kind: 'sweep', name: '蛮王横扫', windupMs: 600, cd: 3000, dmg: 1.4, r: 135, arc: Math.PI, times: 2 },
    ] },
  },
};
// 其他势力支线（data/sideRoutes.ts）：借现成首领的招式改名，登记为「支线.首领」
Object.assign(BOSS_MOVES, sideMoves(BOSS_MOVES));
/** 已有专属控制器的首领只补骑马（半血坠马跟着统一的 boss-phase 事件）。 */
export const BOSS_MOUNTS: Record<string, BossMountDef> = {
  lubu: { horse: 'chitu', cut: .6, rider: 'lubu' },
  huaxiong: { horse: 'wuzhui', cut: .62, rider: 'huaxiong' },
  // 第四章官渡：颜良、文丑（GuanduBoss 专属控制器），半血坠马
  yanliang: { horse: 'dawan', cut: .62, rider: 'yanliang' },
  wenchou: { horse: 'generic', tint: 0x6a5a48, cut: .62, rider: 'wenchou' },
};
