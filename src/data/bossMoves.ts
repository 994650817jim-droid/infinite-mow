import type { EnemyKind } from '../types';
import type { BossMountDef } from '../systems/BossMount';

/**
 * 首领专属招式 · 二阶段 · 骑马（设计表见共享笔记 boss-moves-plan.md；用户 2026-11-17「给boss设计首领专属招式和2阶段，还想boss也有骑马」）。
 * 每位首领只写配置，控制器统一是 systems/BossMoveset.ts；预警都用现成的手绘 WarnFx（长条 / 扇形 / 落点圈 / 伏兵）。
 * 伤害写成首领基础伤害的倍数（dmg），时间单位毫秒。初值，交平衡会话。
 */
export type MoveDef =
  /** 直线冲锋：先出长条预警，再沿线冲过去，撞到主将掉血；back 折返再冲一次；fire 冲过的路上留地火。 */
  | { kind: 'charge'; name: string; windupMs: number; cd: number; dmg: number; len: number; width: number; dashMs: number; back?: boolean; fire?: boolean }
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
}
export interface BossMovesetDef {
  id: string; name: string;
  /** 骑马（一阶段）；半血坠马转二阶段步战。 */ mount?: BossMountDef;
  p1: PhaseDef; p2: PhaseDef;
  /** 进二阶段的生命比例。 */ phaseAt: number;
}

/** 第一批（第 1–3 章）：张梁、张宝、李傕、张绣。 */
export const BOSS_MOVES: Record<string, BossMovesetDef> = {
  // 1-1 张梁（人公将军）：骑黄骠马；黄天旗阵 + 人公冲阵 → 坠马「旗倒人狂」：折返连冲、冲过留地火
  zhangliang: {
    id: 'zhangliang', name: '张梁', phaseAt: .5, mount: { horse: 'generic', tint: 0xe2c06a },
    p1: { name: '人公将军', caption: '黄天旗阵 · 人公冲阵', gapMs: 2600, speedMul: 1.35, moves: [
      { kind: 'flags', name: '黄天旗阵', windupMs: 700, cd: 16000, dmg: 0, count: 3, radius: 170, hp: 90, takenMul: .5 },
      { kind: 'charge', name: '人公冲阵', windupMs: 900, cd: 4200, dmg: 1.4, len: 380, width: 70, dashMs: 520 },
      { kind: 'sweep', name: '马上横斩', windupMs: 600, cd: 3600, dmg: 1.1, r: 120, arc: Math.PI * .8 },
    ] },
    p2: { name: '旗倒人狂', caption: '坠马步战 · 折返连冲，冲过之处起火', gapMs: 2000, speedMul: 1, moves: [
      { kind: 'charge', name: '人公连冲', windupMs: 800, cd: 4000, dmg: 1.5, len: 340, width: 70, dashMs: 480, back: true, fire: true },
      { kind: 'sweep', name: '黄巾大刀', windupMs: 650, cd: 3200, dmg: 1.3, r: 130, arc: Math.PI, times: 2 },
    ] },
  },
  // 1-2 张宝（地公将军，术士不骑）：地公裂土 + 撒豆成兵 → 妖术护体（符兵护体减伤）、裂土三圈
  zhangbao: {
    id: 'zhangbao', name: '张宝', phaseAt: .5,
    p1: { name: '地公将军', caption: '地公裂土 · 撒豆成兵', gapMs: 2800, speedMul: 1, moves: [
      { kind: 'rings', name: '地公裂土', windupMs: 900, cd: 5000, dmg: 1.2, radii: [110, 200], gapMs: 420, band: 60 },
      { kind: 'summon', name: '撒豆成兵', windupMs: 800, cd: 9000, dmg: 0, troop: 'infantry', count: 5, radius: 150, around: 'boss' },
      { kind: 'volley', name: '黄沙符落', windupMs: 1100, cd: 4600, dmg: 1, count: 3, r: 62, spread: 120, fx: 'slam' },
    ] },
    p2: { name: '妖术护体', caption: '道兵护体时张宝几乎不受伤 · 先打道兵', gapMs: 2200, speedMul: 1, guards: { troop: 'shield', count: 4, takenMul: .2 }, moves: [
      { kind: 'rings', name: '地公裂土 · 三重', windupMs: 900, cd: 4800, dmg: 1.3, radii: [100, 190, 280], gapMs: 380, band: 60 },
      { kind: 'volley', name: '黄沙符落', windupMs: 1000, cd: 3800, dmg: 1.1, count: 5, r: 62, spread: 150, fx: 'slam' },
    ] },
  },
  // 3-1 李傕（西凉余部）：骑西凉马；西凉铁骑长冲 + 劫掠长安绕圈箭雨 → 坠马「困兽之斗」：连劈 + 西凉亲兵护卫
  lijue: {
    id: 'lijue', name: '李傕', phaseAt: .5, mount: { horse: 'generic', tint: 0xb9774a },
    p1: { name: '西凉铁骑', caption: '长距离冲锋 · 绕阵箭雨', gapMs: 2400, speedMul: 1.4, moves: [
      { kind: 'charge', name: '西凉铁骑', windupMs: 900, cd: 4000, dmg: 1.5, len: 520, width: 76, dashMs: 560 },
      { kind: 'ride', name: '劫掠长安', windupMs: 600, cd: 7000, dmg: 1, radius: 260, ms: 1600, drops: 6, r: 64 },
    ] },
    p2: { name: '困兽之斗', caption: '坠马步战 · 西凉亲兵护卫时李傕减伤', gapMs: 2000, speedMul: 1, guards: { troop: 'infantry', count: 4, takenMul: .45 }, moves: [
      { kind: 'sweep', name: '困兽连劈', windupMs: 600, cd: 2800, dmg: 1.3, r: 125, arc: Math.PI * .9, times: 3 },
      { kind: 'summon', name: '西凉残部', windupMs: 800, cd: 10000, dmg: 0, troop: 'cavalry', count: 3, radius: 260, around: 'player' },
    ] },
  },
  // 3-2 张绣（北地枪王）：骑白马；百鸟朝凤枪 + 宛城夜袭（隐身突刺）→ 坠马「枪出如龙」：贯穿一线 + 二连扇刺
  zhangxiu: {
    id: 'zhangxiu', name: '张绣', phaseAt: .5, mount: { horse: 'generic' },
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
};

/** 已有专属控制器的首领只补骑马（半血坠马跟着统一的 boss-phase 事件）。 */
export const BOSS_MOUNTS: Record<string, BossMountDef> = {
  lubu: { horse: 'chitu', cut: .6 },
  huaxiong: { horse: 'wuzhui', cut: .62 },
};
