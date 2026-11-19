import { BALANCE } from '../config';
import type { Enemy } from '../entities/Enemy';

/**
 * 首领走路提速（2026-11-19 用户：「感觉 boss 移动速度都很慢，我在骑着马的时候打 boss」；数值 BALANCE.bossPace）。
 * 主将步行约 178、骑马 ×1.1 ≈ 196、大宛 / 赤兔 ×1.18 ≈ 210；首领 def.speed 多在 30～52，追不上也压不住骑马的主将。
 * 做法：每帧记下首领的位置，一帧结束后（各首领控制器都动完）看这一帧的位移——
 *  - 是「朝主将走」（方向与主将方向夹角 < 60°），且不比走路快太多（不是冲锋 / 突进 / 瞬移），才放大这一步；
 *  - 放大倍数 = walkMul ×（离主将超过 chaseFrom 起渐增，到 chaseFull 时再 ×chaseMul）：近身照旧打招式，离远了追得上来。
 * 不走路的首领（城头的董卓 / 吕布、坚守的司马懿、劝降中、刀枪不入）没有朝主将的位移，自然不受影响；招式位移（冲锋、跃击）不变。
 */
interface Host {
  events: Phaser.Events.EventEmitter;
  enemies: Enemy[];
  player: { x: number; y: number };
  combatNow: number;
  mode: string;
  over: boolean;
}

export class BossPace {
  private readonly last = new Map<Enemy, { x: number; y: number; id: number }>();
  private t0 = 0;
  /** 测试用：本关放大过几步、最近一步的倍数。 */
  readonly stats = { steps: 0, lastMul: 1 };

  constructor(private readonly h: Host) {
    h.events.on('preupdate', this.pre, this);
    h.events.on('postupdate', this.post, this);
    h.events.once('shutdown', () => { h.events.off('preupdate', this.pre, this); h.events.off('postupdate', this.post, this); this.last.clear(); });
  }

  /** 离主将 d 像素时的走路倍数。 */
  static mulAt(d: number): number {
    const P = BALANCE.bossPace, far = Math.min(1, Math.max(0, (d - P.chaseFrom) / (P.chaseFull - P.chaseFrom)));
    return P.walkMul * (1 + (P.chaseMul - 1) * far);
  }

  private pre(): void {
    this.last.clear(); this.t0 = this.h.combatNow;
    if (this.h.mode !== 'none' || this.h.over) return;
    for (const e of this.h.enemies) if (e.active && e.kind === 'boss' && !e.isSupplySlot) this.last.set(e, { x: e.x, y: e.y, id: e.spawnId });
  }

  private post(): void {
    const P = BALANCE.bossPace, dt = (this.h.combatNow - this.t0) / 1000;
    if (dt <= 0 || this.h.mode !== 'none' || this.h.over) return;
    const p = this.h.player;
    for (const [e, a] of this.last) {
      if (!e.active || e.spawnId !== a.id || e.invulnerable) continue;
      const mx = e.x - a.x, my = e.y - a.y, m = Math.hypot(mx, my);
      if (m < .01) continue;
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
      if ((mx * dx + my * dy) / (m * d) < .5) continue; // 不是朝主将走（后撤、绕圈、招式位移）
      if (m > e.def.speed * dt * P.walkCap + .5) continue; // 比走路快得多：冲锋 / 突进 / 瞬移，不管
      const mul = BossPace.mulAt(d), k = mul - 1;
      e.sprite.x += mx * k; e.sprite.y += my * k; e.extraWalk += m * k; // 放大的这段也算进步频（不然腿跟不上身子，滑步）
      this.stats.steps++; this.stats.lastMul = mul;
    }
  }
}
