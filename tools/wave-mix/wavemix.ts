// 配兵审计（2026-11-21，平衡会话）：按运行时逻辑在纯 node 里重放主线 36 关的刷兵，逐段统计兵种占比。
// 重放的是 GameScene.updateSpawner + StagePhaseRunner + RosterMix：
//   普通刷兵：间隔 chapter.spawnInterval(paced) × 段间喘息 ×2 × 大军压境 ×(1/1.5) × 首领在场 ×2；每次 spawnBurst(paced)（首领在场 ×0.5）；同屏上限 150（首领 ×0.5）。
//   每次先问 RosterMix.pickRoster（STAGE_MIX 新兵种：受 maxTraitShare / roleCaps / 单兵种 cap 管），否则 chapter.pickEnemy(paced)。
//   换段：精锐段 = 精锐小队（第 1–3 章 2 / 4–7 章 3 / 之后 4，五段关；三段关 1）+ 2 倍盾兵；事件段 = 伏兵一圈 8+min(8,章)；大军压境 = 1 精锐 + 一圈 6+章；副将段 = 1 名副将。
//   第三关（及无 stage 的关）每 60 秒（按节奏）一名精锐。
// 存活模型（决定上限 / 占比上限是否卡住）：普通兵 8 秒、特种兵 15 秒、精锐 25 秒后视为被杀（玩家正常清怪的近似）。
// 不含：EnemyCamps / 关前营帐（另表按章算）、攻城城门、守城（另节）。
import { getBattleChapter, chapterBossTime } from '../../src/data/chapters';
import { thirdBattle } from '../../src/data/thirdChapter';
import { guanduBattle } from '../../src/data/guanduChapter';
import { chibiBattle } from '../../src/data/chibiChapter';
import { jingnanBattle } from '../../src/data/jingnanChapter';
import { shuBattle } from '../../src/data/shuChapter';
import { hanzhongBattle } from '../../src/data/hanzhongChapter';
import { xiangfanBattle } from '../../src/data/xiangfanChapter';
import { yilingBattle } from '../../src/data/yilingChapter';
import { nanzhengBattle } from '../../src/data/nanzhengChapter';
import { beifaBattle } from '../../src/data/beifaChapter';
import { PHASES, buildPhasePlan, phasedPace, CHAPTER_INDEX } from '../../src/data/stagePhases';
import { waveIndexAt } from '../../src/data/waves';
import { ROSTER, ROSTER_MIX, STAGE_MIX } from '../../src/data/enemyRoster';
import { pickRoster, isFodder, type MixCounts } from '../../src/systems/RosterMix';
import { BALANCE } from '../../src/config';

type Any = any;
const KEYS: [string, number, (s: 1 | 2 | 3) => Any][] = [
  ['huangjin', 1, s => getBattleChapter('huangjin', s)], ['hulao', 2, s => getBattleChapter('hulao', 3, s)], ['qunxiong', 3, s => thirdBattle(s)], ['guandu', 4, s => guanduBattle(s)],
  ['chibi', 5, s => chibiBattle(s)], ['jingnan', 6, s => jingnanBattle(s)], ['shu', 7, s => shuBattle(s, () => false)], ['hanzhong', 8, s => hanzhongBattle(s)],
  ['xiangfan', 9, s => xiangfanBattle(s)], ['yiling', 10, s => yilingBattle(s)], ['nanzheng', 11, s => nanzhengBattle(s)], ['beifa', 12, s => beifaBattle(s)],
];
const RUNS = Number(process.env.RUNS ?? 200), DT = .1, LIFE = { base: 8, special: 15, elite: 25 };

/** 兵种归类：近战 / 远程 / 骑兵 / 特种（盾、新兵种非杂兵）/ 精锐。 */
function cat(kind: string): string {
  if (kind === 'elite' || kind === 'lieutenant') return 'elite';
  if (kind === 'infantry') return 'melee';
  if (kind === 'archer') return 'ranged';
  if (kind === 'cavalry') return 'cavalry';
  if (kind === 'shield') return 'special';
  const t = ROSTER[kind]; if (!t) return 'melee';
  if (t.role === 'ranged' || t.role === 'sniper' || t.role === 'artillery' || (t.role === 'ambush' && t.base === 'archer')) return 'ranged';
  if (t.base === 'cavalry' || t.role === 'cavalry' || t.role === 'lancer') return t.role === 'ranged' ? 'ranged' : 'cavalry';
  if (isFodder(t.role)) return 'melee';
  return 'special';
}

function runStage(key: string, ch: number, stage: number, build: (s: 1 | 2 | 3) => Any) {
  const base = build(stage as 1 | 2 | 3), eligible = !base.bossAtStart && !base.objective && base.waves?.length && CHAPTER_INDEX[key] !== undefined;
  const plan = eligible ? buildPhasePlan(key, stage, base.waves, base.bossName) : null;
  const waves = plan ? plan.waves : base.waves, pace = plan ? phasedPace(base.pace, chapterBossTime(base), plan.bossAt) : (base.pace ?? 1);
  const bossAt = plan ? plan.bossAt : chapterBossTime(base), END = bossAt + 60, stageKey = key + '.' + stage;
  const phases = plan ? plan.phases : [{ kind: 'vanguard', start: 0, name: '' }, { kind: 'boss', start: bossAt, name: '' }];
  const out: Any = { stage: `${ch}-${stage}`, key: stageKey, phased: !!plan, bossAt, phases: phases.map((p: Any) => ({ kind: p.kind, name: p.name, start: p.start, end: 0, spawned: {} as Record<string, number>, n: 0, peakAlive: 0, aliveSum: 0, aliveN: 0, events: {} as Record<string, number> })) };
  out.phases.forEach((p: Any, i: number) => { p.end = i + 1 < out.phases.length ? out.phases[i + 1].start : END; });
  const squadN = PHASES.eliteSquad(ch), ambushN = PHASES.ambush(ch), surgeN = PHASES.surge.ring(ch);
  const crowd: [string, string] = ch === 1 ? (stage <= 1 ? ['infantry', 'shield'] : stage === 2 ? ['infantry', 'archer'] : ['infantry', 'cavalry']) : ['infantry', 'cavalry'];
  for (let run = 0; run < RUNS; run++) {
    let t = 0, spawnTimer = 0, eliteTimer = BALANCE.eliteInterval, phaseIdx = -1, calmUntil = 0;
    const alive: { kind: string; dies: number }[] = [];
    const add = (kind: string, life: number, P: Any, ev?: string) => { alive.push({ kind, dies: t + life }); P.spawned[kind] = (P.spawned[kind] ?? 0) + 1; P.n++; if (ev) P.events[ev] = (P.events[ev] ?? 0) + 1; };
    while (t < END) {
      for (let i = alive.length - 1; i >= 0; i--) if (alive[i].dies <= t) alive.splice(i, 1);
      // 换段
      let pi = 0; for (let i = 0; i < out.phases.length; i++) if (t >= out.phases[i].start) pi = i;
      const P = out.phases[pi];
      if (pi !== phaseIdx) {
        phaseIdx = pi; calmUntil = t + PHASES.calmSec;
        if (plan) {
          if (P.kind === 'elite') { const n = plan.phases.length > 3 ? squadN : 1; for (let i = 0; i < n; i++) add('elite', LIFE.elite, P, '精锐小队'); for (let i = 0; i < n * 2; i++) add('shield', LIFE.special, P, '精锐小队'); }
          else if (P.kind === 'event') { for (let i = 0; i < ambushN; i++) add(i % 2 ? crowd[1] : crowd[0], LIFE.base, P, '伏兵'); }
          else if (P.kind === 'surge') { add('elite', LIFE.elite, P, '大军压境'); for (let i = 0; i < surgeN; i++) add(i % 3 === 2 ? crowd[1] : crowd[0], LIFE.base, P, '大军压境'); }
          else if (P.kind === 'lieutenant') add('lieutenant', LIFE.elite * 2, P, '副将');
        }
      }
      const bossOn = t >= bossAt, B = BALANCE.bossSpawn, cap = bossOn ? Math.round(BALANCE.enemyCap * B.capMul) : BALANCE.enemyCap;
      const paced = t * pace;
      spawnTimer -= DT;
      if (spawnTimer <= 0 && alive.length < cap) {
        const surge = P.kind === 'surge' ? PHASES.surge.intervalMul : 1;
        spawnTimer = base.spawnInterval(paced) * (t < calmUntil ? PHASES.calmIntervalMul : 1) * surge * (bossOn ? B.intervalMul : 1);
        const raw = base.spawnBurst(paced), burst = bossOn ? Math.max(1, Math.ceil(raw * B.burstMul)) : raw;
        for (let i = 0; i < burst; i++) {
          if (alive.length >= cap) break;
          const c: MixCounts = { total: 0, special: 0, byId: {}, byRole: {} };
          for (const a of alive) { c.total++; const r = ROSTER[a.kind]; if (r) { c.byId[r.id] = (c.byId[r.id] ?? 0) + 1; c.byRole[r.role] = (c.byRole[r.role] ?? 0) + 1; if (!isFodder(r.role)) c.special++; } }
          const wave = waveIndexAt(t, waves) + 1, mix = pickRoster(stageKey, wave, c);
          if (mix && 'trait' in mix) { const r = ROSTER[mix.trait], g = r.group ? Math.round((r.group[0] + r.group[1]) / 2) : 1; for (let k = 0; k < g; k++) add(mix.trait, isFodder(r.role) ? LIFE.base : LIFE.special, P); continue; }
          const kind = mix && 'base' in mix ? mix.base : base.pickEnemy(paced);
          add(kind, kind === 'shield' ? LIFE.special : kind === 'elite' ? LIFE.elite : LIFE.base, P);
        }
      }
      if ((!base.stage || base.stage === 3) && paced >= BALANCE.eliteFirst) { eliteTimer -= DT * pace; if (eliteTimer <= 0) { eliteTimer = BALANCE.eliteInterval; add('elite', LIFE.elite, P, '定时精锐'); } }
      P.peakAlive = Math.max(P.peakAlive, alive.length); P.aliveSum += alive.length; P.aliveN++;
      t += DT;
    }
  }
  // 汇总成比例
  out.phases = out.phases.map((p: Any) => {
    const dur = Math.max(1, p.end - p.start), tot = Object.values(p.spawned as Record<string, number>).reduce((a, b) => a + b, 0) || 1;
    const share = (pred: (k: string) => boolean) => +(100 * Object.entries(p.spawned as Record<string, number>).filter(([k]) => pred(k)).reduce((a, [, v]) => a + v, 0) / tot).toFixed(1);
    const kinds = Object.fromEntries(Object.entries(p.spawned as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, v]) => [ROSTER[k]?.name ?? k, +(100 * v / tot).toFixed(1)]));
    return { kind: p.kind, name: p.name, start: p.start, end: p.end, perSec: +(tot / RUNS / dur).toFixed(2), alive: +(p.aliveSum / Math.max(1, p.aliveN)).toFixed(1), peak: p.peakAlive,
      melee: share(k => cat(k) === 'melee'), ranged: share(k => cat(k) === 'ranged'), cavalry: share(k => cat(k) === 'cavalry'), special: share(k => cat(k) === 'special'), elite: share(k => cat(k) === 'elite'),
      kinds, events: Object.fromEntries(Object.entries(p.events as Record<string, number>).map(([k, v]) => [k, +(v / RUNS).toFixed(1)])) };
  });
  return out;
}

const rows: Any[] = [];
for (const [key, ch, build] of KEYS) for (const s of [1, 2, 3]) { try { rows.push(runStage(key, ch, s, build)); } catch (e) { rows.push({ stage: `${ch}-${s}`, err: String((e as Error)?.stack ?? e).slice(0, 300) }); } }
console.log(JSON.stringify({ meta: { runs: RUNS, life: LIFE, cap: BALANCE.enemyCap, maxTraitShare: ROSTER_MIX.maxTraitShare }, rows, mix: STAGE_MIX }));
