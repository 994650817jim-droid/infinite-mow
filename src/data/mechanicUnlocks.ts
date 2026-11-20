import { arcStages, loadWorld, type WarlordArc } from '../world/WorldStore';
import { isChapterTestRun } from '../systems/ChapterProgress';

/**
 * 玩法逐章解锁（共享笔记 mechanic-rollout.md；2026-11-20 用户「不用一次性把所有玩法都一次性在第一章加入」，批准「同意」「按你的建议」）。
 * 第一章只教最基础的（移动、攻击、宝石、三选一、拆营帐、回血、首领战）；其余玩法按主线进度开放，每个由剧情人物引出。
 * - 按主线进度判断（已平定的主线关数），不另存开关：老存档、战败重打都不会丢，也不会因为没做某件事永久错过。
 * - 开放前：战斗里的玩法隐藏（不刷、不进卡池、不显示按钮）；营寨 / 行营里的建筑与面板锁住（剪影 + 「第 X 章开放」）。
 * - 开发期 ?dev=1（isChapterTestRun）默认全开，测试不被锁；?dev=1&mech=real 才按进度。
 * - allMechanics：以后二周目 / 老兵模式新档勾选 = 全开（先留口子，没有入口）。
 * 天下地图、马厩、招贤馆、支线的开放沿用原有判断（worldUnlocked / stableUnlocked / other-factions-design），这里只记剧情引子。
 */
export type MechId = 'squad' | 'atlas' | 'jinnang' | 'medic' | 'gear' | 'fortune' | 'lieutenant' | 'attributes' | 'siege' | 'parley' | 'branch' | 'combo';
export interface MechLine { who: string; id?: string; text: string }
export interface MechDef {
  /** 第几章第几关；when = 'start' 该关开打即开放，'after' 该章通关后开放。 */
  chapter: number; stage: number; when: 'start' | 'after';
  /** 开放前：hidden 战斗里不出现；locked 营寨 / 行营里显示锁住。 */
  pre: 'hidden' | 'locked';
  /** 玩法名（锁住时的「第 X 章 · 某某之后开放」、开放卡标题）。 */
  name: string;
  /** 剧情引子（1–2 句，左下对话卡）；tip = 跟在后面的一行提示。 */
  lines: readonly MechLine[]; tip: string;
}

export const MECHANICS: Readonly<Record<MechId, MechDef>> = {
  squad: { chapter: 1, stage: 2, when: 'start', pre: 'hidden', name: '部曲',
    lines: [{ who: '简雍', id: 'jianyong', text: '乡勇五百已编成部曲，听主公号令！' }], tip: '战斗支援：选一队兵随行；E 部曲出击 / 护阵' },
  atlas: { chapter: 1, stage: 2, when: 'start', pre: 'hidden', name: '舆图',
    lines: [{ who: '简雍', id: 'jianyong', text: '下曲阳地形复杂，看看舆图再走。' }], tip: '按 M 展开舆图（战斗暂停）' },
  jinnang: { chapter: 1, stage: 3, when: 'after', pre: 'hidden', name: '锦囊',
    lines: [{ who: '诸葛亮', id: 'zhuge', text: '另附锦囊三枚，危急时拆看。' }], tip: '三选一里出现锦囊；按 R 拆开锦囊' },
  medic: { chapter: 1, stage: 3, when: 'after', pre: 'locked', name: '军医',
    lines: [{ who: '华佗', text: '将军身上带伤，老夫替你看看。' }], tip: '营寨 / 城池军医可治伤、补部曲' },
  gear: { chapter: 2, stage: 1, when: 'start', pre: 'locked', name: '兵装',
    lines: [{ who: '张世平', id: 'zhangshiping', text: '镔铁打的好兵器，张某也备了几件——将军用不上的，张某也收。' }], tip: '首领宝箱开始掉兵装；行营里打开行囊换装，商人收卖兵装' },
  fortune: { chapter: 2, stage: 1, when: 'start', pre: 'hidden', name: '战场机缘',
    lines: [{ who: '斥候', text: '报！远处山坳有辎重车无人看守！' }], tip: '跟着屏幕边缘的箭头，走过去触发机缘' },
  lieutenant: { chapter: 2, stage: 2, when: 'start', pre: 'hidden', name: '副将',
    lines: [{ who: '斥候', text: '报！徐荣帐下李肃压阵，先锋已到！' }], tip: '副将压阵：倒下必掉伤药，军略 +1' },
  attributes: { chapter: 2, stage: 3, when: 'start', pre: 'locked', name: '四维加点',
    lines: [{ who: '关羽', id: 'guanyu', text: '兄长，练兵先练将。某夜读春秋，也不废这臂力。' }], tip: '将帅帐：升级攒下的属性点可以加了' },
  siege: { chapter: 2, stage: 3, when: 'after', pre: 'locked', name: '攻城',
    lines: [{ who: '刘备', id: 'liubei', text: '讨董联军已散，诸侯各怀异心——我等也需一块立足之地。' }], tip: '天下地图上与我方相邻的城池可以出征攻打' },
  parley: { chapter: 3, stage: 1, when: 'start', pre: 'hidden', name: '劝降',
    lines: [{ who: '简雍', id: 'jianyong', text: '李傕反复小人，势穷必肯低头——不妨劝他一劝。' }], tip: '首领残血时出现劝降窗；有的首领宁死不降' },
  branch: { chapter: 3, stage: 1, when: 'start', pre: 'hidden', name: '兵器专职',
    lines: [{ who: '涿郡良匠', text: '将军这兵器，还能再往深里打——两条路，只能选一条。' }], tip: '本命兵器 Lv5 时选专职；选定后要行营「重整构筑」才能换' },
  combo: { chapter: 3, stage: 2, when: 'start', pre: 'hidden', name: '合击',
    lines: [{ who: '诸葛亮', id: 'zhuge', text: '兵法相济：两派各得其二，便成合击。' }], tip: '两个流派各到 2 势，触发合击' },
};

const ARCS: readonly WarlordArc[] = ['qunxiong', 'guandu', 'chibi', 'jingnan', 'shu', 'hanzhong', 'xiangfan', 'yiling', 'nanzheng', 'beifa'];
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/** 已平定的主线关数（第一章 3 关、第二章 3 关、第三章起每章 3 关；按顺序累计，前一章没打完就停）。 */
export function mainlineCleared(): number {
  const s = loadWorld();
  const y = s.cleared.huangjin || s.legacyHulaoAccess ? 3 : Math.min(3, s.yellowStages);
  if (y < 3) return y;
  const d = s.cleared.hulao ? 3 : Math.min(3, s.dongzhuoStages);
  if (d < 3) return 3 + d;
  let n = 6;
  for (const arc of ARCS) { const k = Math.min(3, arcStages(arc)); n += k; if (k < 3) break; }
  return n;
}
/** 开放需要的已平定关数。 */
export function mechNeed(id: MechId): number { const m = MECHANICS[id]; return m.when === 'after' ? m.chapter * 3 : (m.chapter - 1) * 3 + (m.stage - 1); }

let cache: { at: number; n: number } | null = null;
/** 测试 / 二周目口子：全开。 */
export const MECH_FLAGS = { allMechanics: false };
function allOpen(): boolean {
  if (MECH_FLAGS.allMechanics) return true;
  if (typeof window === 'undefined') return true; // node 端模拟 / 脚本：全开
  try { if (isChapterTestRun() && new URLSearchParams(window.location.search).get('mech') !== 'real') return true; } catch { /* ignore */ }
  return false;
}
/** 这项玩法开放没有（每秒最多读一次存档）。 */
export function mechOpen(id: MechId): boolean {
  if (allOpen()) return true;
  const now = Date.now();
  if (!cache || now - cache.at > 1000) { let n = 99; try { n = mainlineCleared(); } catch { /* 存档不可用：全开 */ } cache = { at: now, n }; }
  return cache.n >= mechNeed(id);
}
/** 存档变了（关卡结算后）立刻重读。 */
export function mechRefresh(): void { cache = null; }
/** 锁住时显示：「第二章 · 汜水关开放」/「第一章通关后开放」。 */
export function mechLockText(id: MechId): string {
  const m = MECHANICS[id];
  return m.when === 'after' ? `第${CN[m.chapter]}章通关后开放` : `第${CN[m.chapter]}章 · ${m.chapter}-${m.stage} 开放`;
}

const SEEN_KEY = 'im_mech_seen';
function seen(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]); } catch { return new Set(); } }
/**
 * 刚开放、还没播过剧情引子的玩法（播完记一笔）。where：battle = 开打时（全部；章后开放的若还没在地图上播过也在这里播），map = 天下地图（只播 when 'after'）。
 * 测试全开时不播（?dev=1&mech=real 照播）。
 */
export function takeMechIntros(where: 'battle' | 'map'): MechId[] {
  if (allOpen()) return [];
  const s = seen(), out: MechId[] = [], n0 = s.size; let n = 0; try { n = mainlineCleared(); } catch { return []; }
  for (const id of Object.keys(MECHANICS) as MechId[]) {
    const m = MECHANICS[id]; if (s.has(id) || (where === 'map' && m.when !== 'after') || n < mechNeed(id)) continue;
    if (n === mechNeed(id)) out.push(id); // 早就开放的（老存档、跳过的）静默记掉，不一次补播一串
    s.add(id);
  }
  if (s.size !== n0) try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
  return out;
}
