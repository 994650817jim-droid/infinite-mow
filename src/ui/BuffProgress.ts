/**
 * 增益图标上的「触发进度」（2026-11-16 用户：「关于这种每几次就触发的，玩家可以在左边看到有计数」）。
 * 每 N 次 / 每移动 N / 每 N 秒 / 攒满触发 的技艺与被动，各自的战斗系统只读地报出进度，
 * BuffHud 在图标下方画像素进度条（N ≤ 12 时逐格），满了亮一下；悬停提示多一行「当前 …」。
 * 这里只有读数，不改任何触发规则。
 */
export interface BuffProgress {
  /** 当前进度（0..max）。 */
  cur: number;
  max: number;
  /** 进度条分几格；0 = 连续条（距离、秒数）。 */
  seg: number;
  /** 下一次就会触发（满格发亮）。 */
  ready: boolean;
  /** 悬停提示里的「当前 …」一行。 */
  text: string;
}
/** 约 40 像素一个身位（与技能说明里的「身位」一致）。 */
const BODY = 40;
const fixed = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** 命中 / 出手计数：cur 次已累计，再 1 次（cur = max - 1 时）就触发；或 cur 达到 max 时下一击触发（readyAtMax）。 */
export function countProgress(cur: number, max: number, readyText: string, unit = '次', readyAtMax = false): BuffProgress {
  const c = Math.max(0, Math.min(max, cur)), ready = readyAtMax ? c >= max : c >= max - 1;
  return { cur: readyAtMax ? c : ready ? max : c, max, seg: max <= 12 ? max : 0, ready, text: ready ? readyText : `当前 ${c}/${max} ${unit}` };
}
/** 移动距离（像素）：满了下一击触发。 */
export function distanceProgress(px: number, need: number, readyText: string): BuffProgress {
  const c = Math.max(0, Math.min(need, px)), ready = c >= need - .5;
  return { cur: c, max: need, seg: 0, ready, text: ready ? readyText : `已移动 ${fixed(c / BODY)}/${fixed(need / BODY)} 身位` };
}
/** 蓄势 / 静止时长（毫秒）。 */
export function chargeProgress(ms: number, need: number, readyText: string, verb = '蓄势'): BuffProgress {
  const c = Math.max(0, Math.min(need, ms)), ready = c >= need - 1;
  return { cur: c, max: need, seg: 0, ready, text: ready ? readyText : `${verb} ${fixed(c / 1000)}/${fixed(need / 1000)} 秒` };
}
/** 定时 / 冷却：readyAt 之前在走表，cycle 为一轮时长（毫秒）。 */
export function timerProgress(readyAt: number, cycle: number, now: number, readyText: string, verb = '下次'): BuffProgress {
  const left = Math.max(0, readyAt - now), c = cycle - Math.min(cycle, left), ready = left <= 0;
  return { cur: c, max: cycle, seg: 0, ready, text: ready ? readyText : `${verb} ${fixed(left / 1000)} 秒后` };
}
