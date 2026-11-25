/** A mark belongs to one caster and one incarnation of a target. Times are combat milliseconds. */
export interface SpellMark { spawn: number; until: number; raw: number }
interface MarkHost<T> {
  valid: (target: T) => boolean;
  identity: (target: T) => number;
}
interface MarkRules {
  markMs: number; markTargets: number; chainTargets: number; chainRadius: number;
  chainRatio: number; smallChainRatio: number; chainCd: number;
}
export function expireMarks<T>(marks: Map<T, SpellMark>, now: number, host: MarkHost<T>): void {
  for (const [target, mark] of marks) {
    if (now >= mark.until || !host.valid(target) || host.identity(target) !== mark.spawn) marks.delete(target);
  }
}
/** The host resolves each derived hit through its ordinary damage pipeline, never its primary-hit hook. */
export function applySpellMark<T extends {x:number; y:number; hp:number}>(
  marks: Map<T, SpellMark>, target: T, raw: number, now: number, readyAt: number,
  keystone: boolean, rules: MarkRules, host: MarkHost<T>, conduct: (other:T, damage:number)=>void,
): number {
  expireMarks(marks, now, host);
  if (now >= readyAt) {
    let hits = 0;
    for (const [other, mark] of marks) {
      if (other === target || !host.valid(other) || mark.spawn !== host.identity(other) ||
          Math.hypot(other.x-target.x, other.y-target.y) > rules.chainRadius) continue;
      conduct(other, raw * (keystone ? rules.chainRatio : rules.smallChainRatio));
      if (++hits >= (keystone ? rules.chainTargets : 1)) break;
    }
    if (hits) readyAt = now + rules.chainCd;
  }
  if (target.hp > 0) {
    const capacity = keystone ? rules.markTargets : 2;
    if (!marks.has(target) && marks.size >= capacity) {
      const oldest = marks.keys().next();
      if (!oldest.done) marks.delete(oldest.value);
    }
    marks.set(target, {spawn:host.identity(target), until:now+rules.markMs, raw});
  }
  return readyAt;
}
