/**
 * 分支给部曲的限时加伤（张飞「燕人怒吼」：喝断后 5 秒部曲伤害 +20%）。
 * 2026-11-21 武将数值体检：原来每次喝断都把 legion.drillMultiplier 再乘一次、到时再除，喝断约 1.3 秒一次、持续 5 秒，
 * 同时叠着 4～5 层（部曲伤害 ×2 ～ ×5，模拟里怒吼比断桥快 4 倍）。改为「刷新」：同时只生效一层（取新旧较大的倍率），每次喝断重新计时。
 */
export interface BoostTarget { drillMultiplier: number }
export type Delay = (ms: number, fn: () => void) => { remove(dispatch?: boolean): void };
export function makeTroopBoost(target: () => BoostTarget, delay: Delay): (mul: number, ms: number) => void {
  let cur = 1, on: BoostTarget | null = null, timer: { remove(dispatch?: boolean): void } | null = null;
  const off = (): void => { if (on) on.drillMultiplier /= cur; cur = 1; on = null; timer = null; };
  return (mul, ms) => {
    timer?.remove(false);
    const t = target(), m = Math.max(1, mul, on === t ? cur : 1);
    if (on) on.drillMultiplier /= cur;
    on = t; cur = m; t.drillMultiplier *= m;
    timer = delay(ms, off);
  };
}
