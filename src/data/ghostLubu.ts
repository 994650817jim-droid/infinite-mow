import type { MythicWarning, Point } from './mythicGauntlet';

type Clear = (from: Point, to: Point) => boolean;
export interface Halberd {
  x: number; y: number; appears: number; solid: number;
  lockAt: number; locked: boolean; collision: boolean; broken: boolean; recoverUntil: number;
}
const along = (p: Point, angle: number, distance: number, side = 0): Point => ({
  x:p.x + Math.cos(angle)*distance - Math.sin(angle)*side,
  y:p.y + Math.sin(angle)*distance + Math.cos(angle)*side,
});

export function halberdSequence(origin: Point, target: Point, phase2: boolean, now: number, clear: Clear): MythicWarning[] {
  const angle = Math.atan2(target.y-origin.y,target.x-origin.x);
  const common = {x:origin.x,y:origin.y,angle,face:angle,resolved:false,mythic:'ghost',visual:'blade',action:'attack'} as const;
  const route: MythicWarning[] = [];
  if (phase2) route.push({...common,kind:'ring',name:'修罗震地',radius:164,innerRadius:80,power:.88,startsAt:now,endsAt:now+.98});
  const start = phase2 ? now+1.34 : now;
  const plant: MythicWarning = {...common,kind:'line',name:'方天锁路',radius:220,halfWidth:20,power:.8,startsAt:start,endsAt:start+1};
  const forward = Math.max(68,Math.min(145,Math.hypot(target.x-origin.x,target.y-origin.y)*.7));
  const mark = [40,-40].map(side => along(origin,angle,forward,side)).find(point => clear(origin,point) && clear(target,point));
  if (!mark) {
    // At a blocked prop or map boundary use only the established warning sequence.
    route.push(plant,{...common,kind:'sweep',name:'修罗戟斩',radius:128,power:.85,startsAt:start+1.36,endsAt:start+2.36});
    return route;
  }
  const halberd: Halberd = {...mark,appears:plant.endsAt,solid:plant.endsAt+.50,lockAt:plant.endsAt+1.62,locked:false,collision:false,broken:false,recoverUntil:0};
  plant.halberd=halberd;
  const prep = plant.endsAt+.32;
  route.push(plant,{...common,kind:'line',name:'残戟现形 · 诱敌',radius:0,halfWidth:20,power:1,
    startsAt:prep,endsAt:halberd.lockAt+1.32,halberd,charge:true});
  return route;
}

/** Freeze the actual target direction once, before displaying the charge lane. The stored
 * end point is authoritative for movement, damage, replays and reconnecting clients. */
export function lockHalberdCharge(w: MythicWarning, target: Point, now: number, clear: Clear) {
  const h=w.halberd;
  if (!w.charge || !h || h.locked || now<h.lockAt) return;
  const angle=Math.atan2(target.y-w.y,target.x-w.x);
  let reach=Math.max(115,Math.min(310,Math.hypot(target.x-w.x,target.y-w.y)+72));
  while(reach>0 && !clear(w,along(w,angle,reach))) reach=Math.max(0,reach-12);
  const foot=Math.max(0,Math.min(reach,Math.hypot(target.x-w.x,target.y-w.y)));
  const tip=along(w,angle,foot);
  const canEscape=[-1,1].some(sign=>clear(target,along(tip,angle,0,72*sign)));
  const forward=(h.x-w.x)*Math.cos(angle)+(h.y-w.y)*Math.sin(angle);
  const side=Math.abs((h.y-w.y)*Math.cos(angle)-(h.x-w.x)*Math.sin(angle));
  const entry=forward-Math.sqrt(Math.max(0,24*24-side*side));
  h.locked=true;
  const harmless=!canEscape || reach<30;
  h.collision=!harmless && now>=h.solid && side<=24 && entry>=0 && entry<=reach;
  if(harmless)reach=0;
  else if(h.collision)reach=entry;
  w.angle=w.face=angle; w.radius=reach;
  w.name=harmless?'赤兔勒马':'赤兔冲锋 · 侧移';
  const launch=now+1.02;
  w.endsAt=launch+Math.max(.12,reach/720);
  w.transit={start:launch,to:along(w,angle,reach),cast:0,harmless};
  h.recoverUntil=w.endsAt+(h.collision?3.2:1.55);
}

export function halberdExit(w: MythicWarning, p: Point, clear: Clear): Point | undefined {
  if (!w.charge || !w.halberd?.locked || w.resolved || w.transit?.harmless) return;
  const dx=p.x-w.x,dy=p.y-w.y,c=Math.cos(w.angle),s=Math.sin(w.angle);
  const forward=dx*c+dy*s,side=dy*c-dx*s;
  if(forward < -12 || forward>w.radius+12 || Math.abs(side)>48) return;
  const sign=side<0?-1:1;
  // Hold the safe shoulder until impact instead of immediately marching back into the lane.
  for(const dir of [sign,-sign]){
    const point=along(w,w.angle,forward,44*dir);
    if(clear(p,point))return point;
  }
}
