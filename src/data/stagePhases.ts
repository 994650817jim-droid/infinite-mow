import type { WaveDef } from './waves';

/**
 * 主线关「五段」（wave-progression-redesign.md，2026-11-19 用户批准：「可以按照这样设计」）：
 * 先锋 → 精锐小队 → 本关事件 → 副将 → 首领，约 4–4.5 分钟（原来 3 波约 2.5 分钟）。
 * - 不显示「第 x/5 波」：顶部「战况」线（ui/BattleTrack）+ 段落故事名横幅。
 * - 第一章逐关加长：1-1 三段（先锋 / 精锐 / 首领，时间同原来）、1-2 四段（无副将）、1-3 起五段。
 * - 攻城 / 守城 / 军情 / 挑战、带关卡目标的关（2-3 洛阳）、开场即首领的关不套用（GameScene.phaseEligible）。
 * 数值是初值，交平衡会话校（§平衡会话意见）。
 */
export type PhaseKind = 'vanguard' | 'elite' | 'event' | 'lieutenant' | 'boss';
export interface StagePhase { kind: PhaseKind; start: number; name: string }
export interface PhasePlan { chapter: number; stage: number; phases: StagePhase[]; waves: WaveDef[]; bossAt: number; lieutenant?: string; event?: string }

export const PHASES = {
  /** 各段开始时刻（秒，关内时间）。首领段开始 = 首领登场。 */
  starts: { vanguard: 0, elite: 45, event: 100, lieutenant: 155, boss: 205 } as Record<PhaseKind, number>,
  /** 段间喘息：换段后这几秒内刷兵间隔 ×calmIntervalMul（刷得更稀）。 */
  calmSec: 2.5, calmIntervalMul: 2,
  /** 精锐小队人数（按章）。 */
  eliteSquad: (chapter: number): number => chapter <= 3 ? 2 : chapter <= 7 ? 3 : 4,
  /** 本关事件段开头的一圈伏兵（P1；P2 起再加战场机缘事件）。 */
  ambush: (chapter: number): number => 8 + Math.min(8, chapter),
  /**
   * 副将生命 = 本关精锐生命 × eliteMul，夹在「参考首领生命」的 35%–60% 之间；参考首领生命 = 首领基础生命 × bossRef（不跟 bossHpMul 的章节加倍走，
   * 否则首领一加倍副将也翻倍）。P6 平衡（2026-11-19）：原 ×2、按实际首领夹，5-2 / 10-3 副将约 25 秒倒（段长 50 秒）；改 ×3、参考 ×1.6 后约 35 秒。体型 ×lieutenantScale。
   */
  lieutenantHp: { eliteMul: 3, minBoss: .35, maxBoss: .6, bossRef: 1.6 }, lieutenantScale: 1.3,
  /** 副将段起小兵生命 ×（首领段不再乘：首领在场本来就少刷兵）。 */
  lieutenantWaveHp: 1.1,
  /** 首领生命 ×（玩家多一次三选一 + 关内机缘增益）。初值 1.15，见 bossHpMul（P6 平衡按章节）。 */
  bossHp: 1.15,
  /**
   * 首领生命倍率按章节（2026-11-19 P6 平衡，wave-progression-redesign.md「平衡会话 P6」）：
   * 同等级、同构筑对照，五段关打了 205 秒后（战场机缘约 +10～40% 伤害、锦囊、多 1～2 次三选一、局内升级），
   * 从接战到首领倒下比旧三波关快约 2.7 倍（5-2）、3.5 倍（10-3）。按章节线性补回到旧的首领战用时：
   * 段数 ≤ 3（1-1，首领时刻同旧）×1；第一章 4 / 5 段 ×1.6；第二章起 1.9 + 0.16 × 章，封顶 3.8（5-2 ≈ 2.7、10-3 ≈ 3.5、12 章 3.8）。
   */
  bossHpMul: (chapter: number, phases: number): number => phases <= 3 ? 1 : chapter <= 1 ? 1.6 : Math.min(3.8, 1.9 + .16 * chapter),
  /** 三选一保底：进第 2 / 3 / 4 / 5 段时至少 1 / 2 / 3 / 4 次，首领宝箱补到 5 次。 */
  picks: { waves: [1, 2, 3, 4] as readonly number[], main: 5 },
} as const;

/** 章节序号（hardKey → 1–12）。 */
export const CHAPTER_INDEX: Record<string, number> = { huangjin: 1, hulao: 2, qunxiong: 3, guandu: 4, chibi: 5, jingnan: 6, shu: 7, hanzhong: 8, xiangfan: 9, yiling: 10, nanzheng: 11, beifa: 12 };

/** 本关事件段的故事名（P1 是伏兵冲阵；P2 起该段另有战场机缘事件）。 */
export const EVENT_NAMES: Record<string, string> = {
  huangjin: '黄巾伏兵', hulao: '西凉铁骑冲阵', qunxiong: '并州狼骑', guandu: '袁军弩阵', chibi: '水军跳帮', jingnan: '山越伏兵',
  shu: '蜀道伏兵', hanzhong: '坡上冲锋', xiangfan: '汉水暴涨', yiling: '吴军火攻', nanzheng: '蛮兵出洞', beifa: '魏军方阵',
};
/** 各关副将（避开本关首领；空 = 该关没有副将段）。 */
export const LIEUTENANTS: Record<string, readonly string[]> = {
  huangjin: ['', '', '卜己'], hulao: ['胡轸', '李肃', '李傕'], qunxiong: ['樊稠', '胡车儿', '纪灵'], guandu: ['郭图', '韩猛', '眭元进'],
  chibi: ['夏侯恩', '张允', '牛金'], jingnan: ['鲍隆', '邢道荣', '杨龄'], shu: ['高沛', '泠苞', '刘循'], hanzhong: ['夏侯德', '夏侯尚', '徐晃'],
  xiangfan: ['满宠', '于禁', '马忠'], yiling: ['谢旌', '潘璋', '韩当'], nanzheng: ['董荼那', '阿会喃', '金环三结'], beifa: ['戴陵', '王双', '郭淮'],
};

/** 本关有几段：第一章 3 / 4 / 5，其余 5。 */
export function phaseCount(chapter: number, stage: number): 3 | 4 | 5 {
  if (chapter === 1) return stage <= 1 ? 3 : stage === 2 ? 4 : 5;
  return 5;
}

/**
 * 由原来的波次（名字）排出五段：先锋 = 原第 1 波名，精锐 = 原第 2 波名，事件 = 本章事件名，副将 = 「X 压阵」，首领 = 原最后一波名。
 * 三段关（1-1）沿用原时刻（0 / 45 / 90）；四段关去掉副将。
 */
export function buildPhasePlan(key: string, stage: number, waves: readonly WaveDef[], bossName: string): PhasePlan {
  const chapter = CHAPTER_INDEX[key] ?? 2, n = phaseCount(chapter, stage), names = waves.map(w => w.name);
  const first = names[0] ?? '先锋', second = names[1] ?? '精锐来袭', last = names[names.length - 1] ?? bossName + '决战';
  const lt0 = LIEUTENANTS[key]?.[Math.max(0, Math.min(2, stage - 1))] ?? '', lieutenant = lt0 && lt0 !== bossName ? lt0 : '';
  const event = EVENT_NAMES[key] ?? '伏兵四起', S = PHASES.starts;
  let phases: StagePhase[];
  if (n === 3) phases = [{ kind: 'vanguard', start: 0, name: first }, { kind: 'elite', start: 45, name: second }, { kind: 'boss', start: 90, name: last }];
  else if (n === 4 || !lieutenant) phases = [{ kind: 'vanguard', start: S.vanguard, name: first }, { kind: 'elite', start: S.elite, name: second }, { kind: 'event', start: S.event, name: event }, { kind: 'boss', start: S.lieutenant, name: last }];
  else phases = [{ kind: 'vanguard', start: S.vanguard, name: first }, { kind: 'elite', start: S.elite, name: second }, { kind: 'event', start: S.event, name: event }, { kind: 'lieutenant', start: S.lieutenant, name: lieutenant + '压阵' }, { kind: 'boss', start: S.boss, name: last }];
  const bossAt = phases[phases.length - 1].start;
  return { chapter, stage, phases, waves: phases.map(p => ({ start: p.start, name: p.name })), bossAt, lieutenant: phases.some(p => p.kind === 'lieutenant') ? lieutenant : undefined, event: phases.some(p => p.kind === 'event') ? event : undefined };
}

/** 刷怪时间轴倍率：原表按「原首领时刻」压缩过，关变长后按比例放慢（不低于 1）。 */
export function phasedPace(pace: number | undefined, oldBossAt: number, newBossAt: number): number {
  const p = pace ?? 1; if (newBossAt <= oldBossAt) return p;
  return Math.max(1, p * oldBossAt / newBossAt);
}
