import {COMPANY_LEASH,rangedStandOff,sortieFlank} from '../rules/retinueTactics';
import type { Ally } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { RECALL, type Order } from '../data/legion';
import type { SpatialGrid } from './SpatialGrid';

export const TACTICS = { thinkMs: 240, retreatHp: .3, returnHp: .6, retreatMinMs: 1600, guardLeash: COMPANY_LEASH.guard, sortieLeash: COMPANY_LEASH.sortie, blockMs: 1500, chargeMs: 550, chargeCooldownMs: 4200 } as const;
export interface TacticState {
  nextThink: number; mode: 'advance' | 'retreat' | 'regroup' | 'charge' | 'return'; until: number;
  spaceX: number; spaceY: number; target: Enemy | null; spawn: number; x: number; y: number; danger: number;
  chargeReady: number; chargeHits: Set<number>; faceX: number; faceY: number; blockReady: number; blockUntil: number;
  /** 护阵收回（RECALL）：切回护阵后跑回阵位，途中不接新战斗；开始时间、最近距离与最近一次靠近的时间（卡住兜底用）。 */
  recall: boolean; recallAt: number; recallBest: number; recallBestAt: number;
}
export function createTacticState(x = 0, y = 0): TacticState {
  return { nextThink: 0, mode: 'advance', until: 0, spaceX:0,spaceY:0,target: null, spawn: 0, x, y, danger: 0, chargeReady: 0, chargeHits: new Set(), faceX: 0, faceY: 1, blockReady: 0, blockUntil: 0, recall: false, recallAt: 0, recallBest: 0, recallBestAt: 0 };
}
/** Cached decisions; all candidate searches use the existing grids, never an all-enemy scan. */
export class LegionTactics {
  /** 收回兜底换位（Legion 接 AllyRejoin：屏外直接换、屏内淡出淡入）；没接时直接换。 */
  relocate: ((u: Ally, x: number, y: number) => void) | null = null;
  private readonly enemies: Enemy[] = [];
  private readonly densityScratch: Enemy[] = [];
  private readonly friends: Ally[] = [];
  private friendGrid: SpatialGrid<Ally> | null = null;
  /** 守城 v2 岗位（Legion.postOf 每帧同步过来）：有岗位的兵守岗位，不跟主将、不退。 */
  postOf?: (u: Ally) => { x: number; y: number } | null;
  constructor(private readonly player: Player,private readonly preferred:(u:Ally)=>Enemy|null=()=>null,private readonly anchor?:(u:Ally)=>{x:number;y:number},private readonly extent:(order?:Order)=>number=()=>0,private readonly navigate?:(u:Ally,x:number,y:number,now:number)=>{x:number;y:number}) {}
  private dangerAt(x: number, y: number, grid: SpatialGrid<Enemy>): number {
    let danger = 0;
    for (const e of grid.query(x, y, 105, this.densityScratch)) if (e.active && !e.isSupplySlot && Math.hypot(e.x - x, e.y - y) < 105) danger += e.kind === 'boss' ? 3 : e.kind === 'elite' ? 2 : 1;
    return danger;
  }
  private readonly clusterCache = new Map<number, number>();
  private epoch = -1;
  private priority(u: Ally, e: Enemy, distance: number, grid: SpatialGrid<Enemy>): number {
    let score = distance;
    if(e.isSupplySlot)return distance*4+300;
    if (u.kind === 'spearman') score *= e.kind === 'cavalry' ? .4 : e.kind === 'elite' ? .65 : 1;
    if (u.kind === 'archer' && e.kind === 'archer') score *= .4;
    if (u.kind === 'crossbowman') score *= e.kind === 'elite' || e.kind === 'cavalry' || e.targetAlly?.def.ranged || e.targetAlly?.kind === 'medic' ? .55 : 1;
    if (u.kind === 'swordsman' || u.kind === 'guardian') {
      if (e.targetAlly?.def.ranged || e.targetAlly?.kind === 'medic') score *= .4;
    }
    if (u.kind === 'halberdier') {
      let density = this.clusterCache.get(e.spawnId);
      if (density === undefined) { density = this.dangerAt(e.x, e.y, grid); this.clusterCache.set(e.spawnId, density); }
      score /= 1 + Math.min(6, density) * .3;
    }
    return score;
  }
  select(u: Ally, grid: SpatialGrid<Enemy>, search: number, leash: number): Enemy | null {
    if (this.postOf?.(u)) { let best: Enemy | null = null, bd = Infinity; for (const e of grid.query(u.x, u.y, search, this.enemies)) { if (!e.active || e.invulnerable) continue; const d = Math.hypot(e.x - u.x, e.y - u.y); if (d <= search && d < bd) { bd = d; best = e; } } return best; } // 岗位上：打身边 / 射程内的，不按主将拴
    const marked=this.preferred(u);if(marked&&u.kind!=='medic'&&!['retreat','regroup','return'].includes(u.ai.mode)&&Math.hypot(marked.x-this.player.x,marked.y-this.player.y)<=leash&&Math.hypot(marked.x-u.x,marked.y-u.y)<=search)return marked;
    let best: Enemy | null = null, score = Infinity;
    for (const e of grid.query(u.x, u.y, search, this.enemies)) {
      if (!e.active || e.invulnerable || Math.hypot(e.x - this.player.x, e.y - this.player.y) > leash) continue;
      const distance = Math.hypot(e.x - u.x, e.y - u.y); if (distance > search) continue;
      const rank = this.priority(u, e, distance, grid) * (e === u.ai.target && e.spawnId === u.ai.spawn ? .85 : 1);
      if (rank < score) { score = rank; best = e; }
    }
    return best;
  }
  private safe(u: Ally, cx: number, cy: number, grid: SpatialGrid<Enemy>): void {
    let best = Infinity;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + (u.slot%7)*.13, radius = 70 + u.slot % 4 * 13, x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
      let occupancy=0;
      if(this.friendGrid)for(const f of this.friendGrid.query(x,y,44,this.friends))if(f.active&&f!==u){const d=Math.hypot(f.x-x,f.y-y);if(d<44)occupancy+=(44-d)/44;}
      const score = this.dangerAt(x, y, grid) * 120 + Math.hypot(x - u.x, y - u.y) * .25 + occupancy*35;
      if (score < best) { best = score; u.ai.x = x; u.ai.y = y; }
    }
  }
  think(u: Ally, now: number, order: Order, grid: SpatialGrid<Enemy>, friends: SpatialGrid<Ally>): void {
    this.friendGrid=friends;
    { const post = this.postOf?.(u); if (post) { if (now < u.ai.nextThink) return; u.ai.nextThink = now + TACTICS.thinkMs + (u.id * 53) % 97; this.thinkPost(u, post, grid); return; } }
    const epoch = Math.floor(now / TACTICS.thinkMs);
    if (epoch !== this.epoch) { this.epoch = epoch; this.clusterCache.clear(); }
    const a = u.ai, ratio = u.hp / u.maxHp, leash = (order === 'guard' ? TACTICS.guardLeash : TACTICS.sortieLeash)+this.extent(order);
    // Low health is urgent; the recovery threshold and minimum duration prevent oscillation.
    if (ratio < TACTICS.retreatHp && a.mode !== 'retreat') { a.mode = 'retreat'; a.until = now + TACTICS.retreatMinMs; a.nextThink = 0; u.attackUntil = now; }
    if (a.mode === 'retreat' && ratio >= TACTICS.returnHp && now >= a.until) { a.mode = 'advance'; a.nextThink = 0; }
    if (a.mode === 'charge' && now >= a.until) a.nextThink = 0;
    if (now < a.nextThink) return;
    a.nextThink = now + TACTICS.thinkMs + (u.id*53)%97;
    const friendRadius = u.kind === 'medic' ? 320 : 170;
    const nearFriends = friends.query(u.x, u.y, friendRadius, this.friends);
    let support = 0, medic: Ally | null = null, wounded: Ally | null = null, lowest = 1, front: Ally | null = null, frontDistance = 0;
    for (const f of nearFriends) {
      if (!f.active || f === u || Math.hypot(f.x - u.x, f.y - u.y) > friendRadius) continue;
      if (!f.def.ranged && f.kind !== 'medic' && f.ai.mode !== 'retreat') support++;
      if (f.kind === 'medic') medic = f;
      if (f.hp / f.maxHp < lowest) { lowest = f.hp / f.maxHp; wounded = f; }
      const d = Math.hypot(f.x - this.player.x, f.y - this.player.y);
      if (!f.def.ranged && f.kind !== 'medic' && d > frontDistance) { front = f; frontDistance = d; }
    }
    a.danger = this.dangerAt(u.x, u.y, grid);
    if (a.mode === 'retreat') {
      a.target = null;
      const healSafe = medic && this.dangerAt(medic.x, medic.y, grid) < 3;
      this.safe(u, healSafe && medic ? medic.x : this.player.x, healSafe && medic ? medic.y : this.player.y, grid); return;
    }
    // 护阵收回：直接回阵位，不接新战斗；回到阵位附近结束；超时且很远 / 卡住时直接归位
    if (a.recall) {
      if (order !== 'guard') a.recall = false;
      else {
        const home = this.home(u), d = Math.hypot(home.x - u.x, home.y - u.y);
        if (!a.recallAt) { a.recallAt = now; a.recallBest = d; a.recallBestAt = now; }
        if (d < a.recallBest - RECALL.progressPx) { a.recallBest = d; a.recallBestAt = now; }
        if (d <= RECALL.doneDist * 2) a.recall = false;
        else if (now - a.recallAt > RECALL.fallbackMs && (d > RECALL.farPx || now - a.recallBestAt > RECALL.stuckMs)) { if (this.relocate) this.relocate(u, home.x, home.y); else u.setPosition(home.x, home.y); a.recall = false; }
        else { a.mode = 'advance'; a.target = null; a.x = home.x; a.y = home.y; return; }
      }
    }
    if (a.mode === 'charge' && now >= a.until) { a.mode = 'return'; a.until = now + 1100; }
    if (a.mode === 'return' && now >= a.until) a.mode = 'advance';
    const pressureLimit=order==='sortie'&&ratio>=TACTICS.returnHp?6:4;
    if (a.danger >= Math.max(pressureLimit, (support + 1) * 2) || Math.hypot(u.x - this.player.x, u.y - this.player.y) > leash + 50) {
      a.mode = a.mode === 'return' ? 'return' : 'regroup'; a.until = Math.max(a.until, now + 900);
    } else if (a.mode === 'regroup' && now >= a.until) a.mode = 'advance';
    if (a.mode === 'regroup' || a.mode === 'return') { a.target = null; this.safe(u, this.player.x, this.player.y, grid); return; }
    const target = u.kind === 'medic' ? null : this.select(u, grid, order === 'guard' ? Math.max(210, u.def.range) : 500, leash);
    a.target = target; a.spawn = target?.spawnId ?? 0;
    const home=this.home(u);
    a.x=home.x;a.y=home.y;
    if (u.kind === 'medic') {
      const friend = wounded ?? (order === 'sortie' ? front : null);
      if (friend && Math.hypot(friend.x - this.player.x, friend.y - this.player.y) < leash) {
        const dx = friend.x - this.player.x, dy = friend.y - this.player.y, d = Math.hypot(dx, dy) || 1;
        a.x = friend.x - dx / d * 70; a.y = friend.y - dy / d * 70;
      }
      if (a.danger > 0) this.safe(u, this.player.x, this.player.y, grid);
      return;
    }
    if (!target) return;
    if(order==='guard'&&Math.hypot(target.x-home.x,target.y-home.y)>Math.max(180,u.def.range))return;
    const dx = target.x - u.x, dy = target.y - u.y, distance = Math.hypot(dx, dy) || 1;
    a.faceX = dx / distance; a.faceY = dy / distance;
    if (u.kind === 'rider' && a.mode !== 'charge' && now >= a.chargeReady && distance > u.def.range && distance < 210 && a.danger <= 2 && (support > 0 || this.dangerAt(target.x, target.y, grid) < 3)) {
      a.mode = 'charge'; a.until = now + TACTICS.chargeMs; a.chargeReady = now + TACTICS.chargeCooldownMs; a.chargeHits.clear();
    }
    if (a.mode === 'charge') { a.x = target.x + a.faceX * 55; a.y = target.y + a.faceY * 55; return; }
    if(u.def.ranged && target.kind==='boss'){
      const back=rangedStandOff(u,target,u.def.range,u.slot);
      if(back){a.x=back.x;a.y=back.y;return;}
    }
    const minRange = u.def.ranged ? Math.min(130, u.def.range * .5) : u.kind === 'spearman' ? 75 : 0;
    if (distance < minRange) {
      const escape = distance < 2 ? (u.slot % 2 ? 1 : -1) : -dx / distance;
      a.x = u.x + escape * 65; a.y = u.y - dy / distance * 65;
      if (this.dangerAt(a.x, a.y, grid) > a.danger) this.safe(u, this.player.x, this.player.y, grid);
    } else {
      const stop = u.def.range * (u.def.ranged ? .82 : u.kind === 'spearman' ? .82 : .7);
      if (distance > stop && order==='sortie' && !u.def.ranged && target.kind==='boss'){
        const flank=sortieFlank(this.player,target,u.def.range,u.slot,u.kind==='guardian');a.x=flank.x;a.y=flank.y;
      }else if (distance > stop) { const angle=Math.atan2(dy,dx)+(u.slot%7-3)*.11;a.x = target.x-Math.cos(angle)*stop; a.y = target.y-Math.sin(angle)*stop; }
      else { a.x = u.x; a.y = u.y; }
    }
  }
  /** 阵位（编队锚点；没有编队时按槽位排在主将身后）。 */
  /** 守城 v2 岗位：守在岗位上；远程打射程内的，近战离岗位 110 以内的才上前（打完回岗），不退、不回主将身边。 */
  private thinkPost(u: Ally, post: { x: number; y: number }, grid: SpatialGrid<Enemy>): void {
    const a = u.ai; a.mode = 'advance'; a.recall = false; a.x = post.x; a.y = post.y;
    const reach = u.def.ranged ? u.def.range * 1.6 : 110; let best: Enemy | null = null, bd = Infinity;
    for (const e of grid.query(post.x, post.y, reach, this.enemies)) { if (!e.active || e.invulnerable) continue; const d = Math.hypot(e.x - post.x, e.y - post.y); if (d <= reach && d < bd) { bd = d; best = e; } }
    a.target = best; a.spawn = best?.spawnId ?? 0; if (!best) return;
    if (!u.def.ranged) { const dx = best.x - post.x, dy = best.y - post.y, d = Math.hypot(dx, dy) || 1; a.x = best.x - dx / d * 24; a.y = best.y - dy / d * 24; }
    const fx = best.x - u.x, fy = best.y - u.y, fd = Math.hypot(fx, fy) || 1; a.faceX = fx / fd; a.faceY = fy / fd;
  }
  private home(u: Ally): { x: number; y: number } { return this.anchor?.(u)??{x:this.player.x+(u.slot%5-2)*38,y:this.player.y+70+Math.floor(u.slot/5)*38}; }
  move(u: Ally, dt: number, now: number, friends: SpatialGrid<Ally>): void {
    const a = u.ai;
    const attacking=now<u.attackUntil && a.mode!=='retreat' && a.mode!=='regroup' && a.mode!=='charge';
    let sx=0,sy=0;
    for(const f of friends.query(u.x,u.y,64,this.friends)){
      if(!f.active||f===u)continue;
      let dx=u.x-f.x,dy=u.y-f.y,d=Math.hypot(dx,dy);
      const min=u.radius+f.radius+8;
      if(d>=min)continue;
      if(d<.01){const lo=Math.min(u.id,f.id),hi=Math.max(u.id,f.id),angle=((lo*73+hi*151)%360)*Math.PI/180,sign=u.id<f.id?1:-1;dx=Math.cos(angle)*sign;dy=Math.sin(angle)*sign;d=1;}
      const weight=(1-Math.min(1,d/min));sx+=dx/d*weight;sy+=dy/d*weight;
    }
    // Keep a small breathing space around the hero; charges retain their special path.
    if(a.mode!=='charge'){
      const dx=u.x-this.player.x,dy=u.y-this.player.y,d=Math.hypot(dx,dy),min=42;
      if(d<min){const angle=u.slot*2.399963;sx+=(d>.01?dx/d:Math.cos(angle))*(1-d/min);sy+=(d>.01?dy/d:Math.sin(angle))*(1-d/min);}
    }
    const length=Math.hypot(sx,sy),scale=length>1?1/length:1;
    const blend=1-Math.exp(-14*dt);
    a.spaceX+=(sx*scale-a.spaceX)*blend;a.spaceY+=(sy*scale-a.spaceY)*blend;
    const withdrawFromBoss=u.def.ranged && a.target?.kind==='boss' && Math.hypot(a.target.x-u.x,a.target.y-u.y)<u.def.range*.66;
    if(attacking && !withdrawFromBoss){
      // Small cosmetic-space adjustment within existing reach, preserving facing and attack frames.
      if(Math.hypot(a.spaceX,a.spaceY)>.05)u.moveTo(u.x+a.spaceX*24,u.y+a.spaceY*24,dt,28,now,true,true);
    }else{
      const tx=a.x+a.spaceX*36,ty=a.y+a.spaceY*36,goal=a.mode==='charge'?{x:tx,y:ty}:this.navigate?.(u,tx,ty,now)??{x:tx,y:ty};
      // 近战接敌（含长枪兵拉开距离）时保持面向目标，避免一退一进来回翻身造成闪烁。
      const target=a.target,engaged=!!target?.active&&!u.def.ranged&&u.kind!=='rider'&&a.mode!=='retreat'&&a.mode!=='regroup'&&Math.hypot(target.x-u.x,target.y-u.y)<=u.def.range*1.2;
      if(engaged&&target)u.face(target.x,target.y);
      u.moveTo(goal.x,goal.y,dt,u.def.speed*(a.mode==='charge'?1.8:a.recall?RECALL.speedMul:1)*u.formSpeed,now,engaged,a.mode==='charge');
    }
  }

  canAttack(u: Ally): boolean { return !u.ai.recall && (u.ai.mode === 'advance' || u.ai.mode === 'charge'); }
}
