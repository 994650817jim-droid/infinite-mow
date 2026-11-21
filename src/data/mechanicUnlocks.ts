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
 * 11-20 用户「第一章就可以开发背包，但是军需商人第二章才开，军医1-1打完就开，加入相应剧情」：
 * - 行囊（gear）1-1 就开放，1-1 首领第一次掉兵装时张飞一句引出（at 'event'，GameScene.mechEvent）；之前行囊按钮不显示（mechShown）。
 * - 军需商人（merchant）第一章通关后开放：1-3 打完直接进天下地图（没有行营），张世平在天下地图上来投（2-1 前）；错过了就在之后第一次行营休整时补（at 'camp'）。第一章行营 / 营寨里没有商人。
 * - 军医（medic）1-1 打完开放，1-1 后的行营乡里郎中来投、简雍介绍，初诊不收粮（at 'camp'，CampRestUI）。
 * - 开放前一律隐藏（页签、按钮、建筑不出现），不再灰掉。
 */
export type MechId = 'squad' | 'atlas' | 'jinnang' | 'medic' | 'gear' | 'merchant' | 'fortune' | 'lieutenant' | 'attributes' | 'siege' | 'parley' | 'branch' | 'combo' | 'formation' | 'f_snake' | 'f_crane' | 'f_geese';
export interface MechLine { who: string; id?: string; text: string }
export interface MechDef {
  /** 第几章第几关；when = 'start' 该关开打即开放，'after' 该章通关后开放。 */
  chapter: number; stage: number; when: 'start' | 'after';
  /** 开放前：hidden 战斗里不出现；locked 营寨 / 行营里显示锁住。 */
  pre: 'hidden' | 'locked';
  /** 玩法名（锁住时的「第 X 章 · 某某之后开放」、开放卡标题）。 */
  name: string;
  /** 剧情引子（1–2 句，左下对话卡）；tip = 跟在后面的一行提示。at 'camp' 时第一句写进人物头顶气泡（要短），其余写在行营下方提示行。 */
  lines: readonly MechLine[]; tip: string;
  /** 引子在哪播：缺省 = 开打（when 'after' 也可在天下地图）；camp = 行营休整打开时（CampRestUI；when 'after' 的也在天下地图播；都错过了下一关开打补播）；event = 场景里事件触发（GameScene.mechEvent）。 */
  at?: 'camp' | 'event';
}

export const MECHANICS: Readonly<Record<MechId, MechDef>> = {
  squad: { chapter: 1, stage: 2, when: 'start', pre: 'hidden', name: '部曲',
    lines: [{ who: '简雍', id: 'jianyong', text: '乡勇五百已编成部曲，听主公号令！' }], tip: '战斗支援：选一队兵随行；E 部曲出击 / 护阵' },
  atlas: { chapter: 1, stage: 2, when: 'start', pre: 'hidden', name: '舆图',
    lines: [{ who: '简雍', id: 'jianyong', text: '下曲阳地形复杂，看看舆图再走。' }], tip: '按 M 展开舆图（战斗暂停）' },
  jinnang: { chapter: 1, stage: 3, when: 'after', pre: 'hidden', name: '锦囊',
    lines: [{ who: '诸葛亮', id: 'zhuge', text: '另附锦囊三枚，危急时拆看。' }], tip: '三选一里出现锦囊；按 R 拆开锦囊' },
  medic: { chapter: 1, stage: 2, when: 'start', pre: 'hidden', name: '军医', at: 'camp',
    lines: [{ who: '乡里郎中', text: '在下略通岐黄，愿随军效力。' }, { who: '简雍', id: 'jianyong', text: '主公，这一仗受的伤会带到下一仗——休整时请先生看看。' }], tip: '血量跨关继承，休整时找军医治伤；初诊不收粮' },
  gear: { chapter: 1, stage: 1, when: 'start', pre: 'hidden', name: '行囊', at: 'event',
    lines: [{ who: '张飞', id: 'zhangfei', text: '大哥，缴来的甲胄先穿上！' }], tip: '按 B 打开行囊，点兵装穿上；首领宝箱会掉兵装' },
  merchant: { chapter: 1, stage: 3, when: 'after', pre: 'hidden', name: '军需商人', at: 'camp',
    lines: [{ who: '张世平', id: 'zhangshiping', text: '张某随军贩些兵甲，将军看看？' }, { who: '刘备', id: 'liubei', text: '张兄当年资助我等起兵，如今又随军相助。' }], tip: '行营休整「军需商人」、营寨「旅商」：买兵装、战法卷轴，用不上的兵装也收' },
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
  // 军阵（formation-design.md，用户 11-20「全按推荐」）：第四章通关后徐庶在新野来投，授方圆、锋矢；之后按剧情学长蛇（5-1 后）、鹤翼（5-2 后）、雁行（黄忠来投，第六章后）
  formation: { chapter: 4, stage: 3, when: 'after', pre: 'hidden', name: '军阵',
    lines: [{ who: '徐庶', id: 'xushu', text: '主公用兵，胜在人和，失在无阵。庶有二阵相赠——守则方圆，攻则锋矢。' }], tip: '行营「布阵」选主阵 / 备阵；战斗中按 X 变阵；护阵（E）时阵势生效，出击时各阵有各自的打法' },
  f_snake: { chapter: 5, stage: 2, when: 'start', pre: 'hidden', name: '长蛇阵',
    lines: [{ who: '赵云', id: 'zhaoyun', text: '七进七出，靠的是阵随人走、首尾相应。' }], tip: '学会长蛇阵：行营「布阵」可选' },
  f_crane: { chapter: 5, stage: 3, when: 'start', pre: 'hidden', name: '鹤翼阵',
    lines: [{ who: '周瑜', id: 'zhouyu', text: '两翼齐张，敌入其中，如鹤敛翅。' }], tip: '学会鹤翼阵：行营「布阵」可选' },
  f_geese: { chapter: 6, stage: 3, when: 'after', pre: 'hidden', name: '雁行阵',
    lines: [{ who: '黄忠', id: 'huangzhong', text: '老夫弓手一字排开，箭如雁阵。' }], tip: '学会雁行阵：行营「布阵」可选' },
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
const SEEN_KEY = 'im_mech_seen';
function seen(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]); } catch { return new Set(); } }
/** 测试 / 二周目口子：全开。 */
export const MECH_FLAGS = { allMechanics: false };
function allOpen(): boolean {
  if (MECH_FLAGS.allMechanics) return true;
  if (typeof window === 'undefined') return true; // node 端模拟 / 脚本：全开
  try { if (isChapterTestRun() && new URLSearchParams(window.location.search).get('mech') !== 'real') return true; } catch { /* ignore */ }
  return false;
}
function clearedNow(): number {
  const now = Date.now();
  if (!cache || now - cache.at > 1000) { let n = 99; try { n = mainlineCleared(); } catch { /* 存档不可用：全开 */ } cache = { at: now, n }; }
  return cache.n;
}
/** 这项玩法开放没有（每秒最多读一次存档）。 */
export function mechOpen(id: MechId): boolean {
  if (allOpen()) return true;
  return clearedNow() >= mechNeed(id);
}
/**
 * 事件引子的玩法（at 'event'，如行囊）：开放了、且引子已经播过（或老存档早过了那段）才显示入口。
 * 1-1 首领掉第一件兵装之前，行囊按钮不出现。
 */
export function mechShown(id: MechId): boolean {
  if (!mechOpen(id)) return false;
  if (allOpen() || MECHANICS[id].at !== 'event') return true;
  return seen().has(id) || clearedNow() - mechNeed(id) > 2;
}
/** 事件触发的引子（at 'event'）：第一次返回 true 并记已看；早过了那段（开放超过两关）的静默记掉。 */
export function takeMechEvent(id: MechId): boolean {
  if (allOpen() || !mechOpen(id)) return false;
  const s = seen(); if (s.has(id)) return false;
  s.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
  return clearedNow() - mechNeed(id) <= 2;
}
/** 存档变了（关卡结算后）立刻重读。 */
export function mechRefresh(): void { cache = null; }
/** 锁住时显示：「第二章 · 汜水关开放」/「第一章通关后开放」。 */
export function mechLockText(id: MechId): string {
  const m = MECHANICS[id];
  return m.when === 'after' ? `第${CN[m.chapter]}章通关后开放` : `第${CN[m.chapter]}章 · ${m.chapter}-${m.stage} 开放`;
}

/** 一次（一关开打 / 进一次天下地图）最多播几个新玩法引子。 */
export const MECH_INTRO_CAP = 2;
/**
 * 刚开放、还没播过剧情引子的玩法（播完记一笔）。where：battle = 开打时（全部；章后开放的若还没在地图上播过也在这里播），map = 天下地图（只播 when 'after'）。
 * 测试全开时不播（?dev=1&mech=real 照播）。
 */
export function takeMechIntros(where: 'battle' | 'map' | 'camp', cap: number = MECH_INTRO_CAP): MechId[] {
  if (allOpen()) return [];
  const s = seen(), out: MechId[] = [], n0 = s.size; let n = 0; try { n = mainlineCleared(); } catch { return []; }
  // 行营引子（at 'camp'）只在行营播；没进行营就开打了下一关（n 已过开放那关）才在开打时补播。事件引子（at 'event'）不在这里播
  const fits = (id: MechId): boolean => { const d = MECHANICS[id]; if (d.at === 'event') return false; if (where === 'camp') return d.at === 'camp'; if (where === 'map') return d.when === 'after'; return d.at !== 'camp' || n > mechNeed(id); };
  // 一次最多播 MECH_INTRO_CAP 个（第二章检查：2-1 原来一口气 4 张新玩法卡）：最近开放、本关开打的（when 'start'）优先，章后开放的（锦囊、军医）顺延到下一关 / 天下地图；
  // 开放超过两关还没播的（老存档、跳过的）静默记掉，不一次补播一串
  const ids = (Object.keys(MECHANICS) as MechId[]).filter(id => !s.has(id) && fits(id) && n >= mechNeed(id))
    .sort((a, b) => mechNeed(b) - mechNeed(a) || (MECHANICS[a].when === 'start' ? 0 : 1) - (MECHANICS[b].when === 'start' ? 0 : 1)); // 最近开放的优先，同一关里本关开打的优先
  for (const id of ids) {
    if (n - mechNeed(id) > 2) { s.add(id); continue; } // 顺延最多两关（2-1 的锦囊 → 2-2、军医 → 2-3）
    if (out.length >= cap) continue; // 顺延，不记已看
    out.push(id); s.add(id);
  }
  if (s.size !== n0) try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
  return out;
}
