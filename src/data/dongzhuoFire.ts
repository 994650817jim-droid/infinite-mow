/** Fire is drawn in ground-plane perspective. Sample the foot position for every combatant. */
export const FIRE_DEPTH_SCALE = 0.6;

export function insideDongzhuoFire(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  const dx = x - cx;
  const dy = (y - cy) / FIRE_DEPTH_SCALE;
  return dx * dx + dy * dy <= radius * radius;
}
