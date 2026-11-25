/** Idle facings use the same row order as the four-direction walk sheets. */
export const WALK_DIRECTIONS = ['down', 'left', 'right', 'up'] as const;

export function walkRow(dx: number, dy: number, previous: number): number {
  const horizontal = previous === 1 || previous === 2;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const useX = horizontal ? ax * 1.18 >= ay : ax > ay * 1.18;
  return useX ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
}

/** Tracks voluntary ground velocity. Callers still own collision resolution and scripted movement. */
export class GroundMotion {
  vx = 0;
  vy = 0;
  stop(): void { this.vx = this.vy = 0; }

  advance(dx: number, dy: number, dt: number, speed: number, available: number, immediate = false): void {
    const distance = Math.hypot(dx, dy);
    if (available <= .03 || distance <= .03 || dt <= 0 || speed <= 0) { this.stop(); return; }
    const remaining = Math.min(available, distance);
    const targetSpeed = Math.min(speed, remaining / dt, Math.max(speed * .18, remaining * 8));
    const x = dx / distance * targetSpeed, y = dy / distance * targetSpeed;
    const blend = immediate || remaining < 8 ? 1 : 1 - Math.exp(-19 * dt);
    this.vx += (x - this.vx) * blend;
    this.vy += (y - this.vy) * blend;
    const magnitude = Math.hypot(this.vx, this.vy);
    if (magnitude <= targetSpeed) return;
    this.vx *= targetSpeed / magnitude;
    this.vy *= targetSpeed / magnitude;
  }
}
