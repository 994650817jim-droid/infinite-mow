import type { Player } from '../entities/Player';
import { applyStageBuff } from '../systems/StageBuffs';

/**
 * 「小成」（经验条每满 1/4、不到整级；data/heroLevels.ts SOFT_CAP）的三个小图标：小而稳，不出和整级三选一重复的强力卡。
 * 本关有效（StageBuffs）或一次性；第一个永远是「军资」兜底（5 秒没选自动给它，卡池也不会被抽空）。数值是初值，交平衡会话。
 */
export interface SmallStep { id: string; kind: '心法' | '军资' | '体魄' | '回血'; name: string; desc: string; icon: string; apply: (p: Player, chapter: number) => string }
const heal = (p: Player, n: number): void => { p.heal(Math.round(n)); };
const POOL: readonly SmallStep[] = [
  { id: 'ss_focus', kind: '心法', name: '凝神', desc: '本关伤害 +3%', icon: 'growth_icon_might', apply: p => { applyStageBuff(p, s => { s.damageMul *= 1.03; }); return '本关伤害 +3%'; } },
  { id: 'ss_swift', kind: '心法', name: '运气', desc: '本关出手 +3%', icon: 'growth_icon_quickness', apply: p => { applyStageBuff(p, s => { s.cooldownMul *= .97; }); return '本关出手 +3%'; } },
  { id: 'ss_keen', kind: '心法', name: '会心', desc: '本关暴击 +2%', icon: 'growth_icon_critical', apply: p => { applyStageBuff(p, s => { s.critChance += .02; }); return '本关暴击 +2%'; } },
  { id: 'ss_body', kind: '体魄', name: '壮骨', desc: '本关生命 +8', icon: 'growth_icon_constitution', apply: p => { applyStageBuff(p, s => { s.maxHpBonus += 8; }); heal(p, 8); return '本关生命 +8'; } },
  { id: 'ss_mend', kind: '回血', name: '调息', desc: '回复 15% 生命', icon: 'growth_icon_rejuvenation', apply: p => { heal(p, p.maxHp * .15); return '回复 15% 生命'; } },
];
/** 军资兜底：随军粮 +(10 + 3 × 章)。 */
export const SMALL_SUPPLY: SmallStep = { id: 'ss_supply', kind: '军资', name: '粮秣', desc: '随军粮 +', icon: 'growth_icon_pickup',
  apply: (p, ch) => { const n = 10 + 3 * ch, sc = p.scene as unknown as { legion?: { food: number } }; if (sc.legion) sc.legion.food += n; return '随军粮 +' + n; } };
/** 三个：军资（第一个）+ 两个不重复的；残血时必带「调息」。 */
export function rollSmallSteps(p: Player, chapter: number, rnd: () => number = Math.random): SmallStep[] {
  const pool = [...POOL], out: SmallStep[] = [{ ...SMALL_SUPPLY, desc: SMALL_SUPPLY.desc + (10 + 3 * chapter) }];
  if (p.hp < p.maxHp * .5) { out.push(pool.splice(pool.findIndex(x => x.id === 'ss_mend'), 1)[0]); }
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
