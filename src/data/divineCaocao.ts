import type {MythicWarning, Point} from './mythicGauntlet.ts';

export type WeiOrder = {stance:'shield'|'standDown'} | {stance:'bow'; gap:number; lanes:number[]};
type PathClear=(a:Point,b:Point)=>boolean;
const FRONT=132, HALF_FRONT=83;

/** Coordinates in the army's locked formation. */
export function weiPoint(w: Pick<MythicWarning,'x'|'y'|'angle'>, forward:number, side:number):Point {
  const c=Math.cos(w.angle), s=Math.sin(w.angle);
  return {x:w.x+c*forward-s*side,y:w.y+s*forward+c*side};
}
function coordinates(w:MythicWarning,p:Point) {
  const x=p.x-w.x,y=p.y-w.y,c=Math.cos(w.angle),s=Math.sin(w.angle);
  return {forward:x*c+y*s,side:y*c-x*s};
}
export function weiSequence(origin:Point,target:Point,cast:number,phase2:boolean,now:number,clear:PathClear):MythicWarning[] {
  const facing=Math.atan2(target.y-origin.y,target.x-origin.x);
  const preferredGap=phase2?(cast%2===0?-26:26):0;
  // Keep an approach and an outside route on open terrain when the general stands near a wall.
  let angle=facing,laneLength=0;
  for(const length of [305,210,162]){
    const turn=[0,.3,-.3,.65,-.65,1,-1,Math.PI].find(turn=>{
      const basis={x:origin.x,y:origin.y,angle:facing+turn};
      const open=(side:number)=>clear(weiPoint(basis,16,side),weiPoint(basis,length,side));
      return open(preferredGap)&&(!phase2||open(-preferredGap))&&(open(167)||open(-167));
    });
    if(turn!==undefined){angle=facing+turn;laneLength=length;break;}
  }
  const make=(wei:WeiOrder,start:number,duration:number,power:number,name:string):MythicWarning=>({
    x:origin.x,y:origin.y,angle,face:angle,wei,kind:wei.stance==='shield'?'sweep':'line',
    radius:wei.stance==='bow'?laneLength:FRONT,halfWidth:13,power,name,startsAt:start,endsAt:start+duration,
    resolved:false,mythic:'divine',action:wei.stance==='shield'?'cast':'attack',
  });
  if(!laneLength)return [make({stance:'standDown'},now,1.35,0,'地势狭窄 · 收旗整阵')];
  const shield=make({stance:'shield'},now,2,cast%2===0?.88:1,'魏武盾势 · 举盾');
  const bow=(gap:number,start:number,answer:boolean)=>make({
    stance:'bow',gap,lanes:[-101,-57,57,101].map(side=>side+gap),
  },start,answer?1.55:1.8,answer?.82:.88,answer?'魏武弓势 · 易旗换列':'魏武弓势 · 落盾举旗');
  const first=bow(preferredGap,shield.endsAt+.36,false);
  return phase2?[shield,first,bow(-preferredGap,first.endsAt+.36,true)]:[shield,first];
}
export function weiHits(w:MythicWarning,p:Point):boolean {
  const {forward,side}=coordinates(w,p);
  if(forward<0||forward>w.radius)return false;
  if(w.wei?.stance==='shield')return Math.abs(side)<=HALF_FRONT;
  return w.wei?.stance==='bow' && w.wei.lanes.some(lane=>Math.abs(side-lane)<=(w.halfWidth??13));
}

/** Only the inward component of a step inside the raised front is slowed. */
export function weiAdvance(w:MythicWarning|undefined,from:Point,to:Point,now:number):Point|undefined {
  if(w?.wei?.stance!=='shield'||w.resolved||now<w.startsAt||now>=w.endsAt)return;
  const a=coordinates(w,from), b=coordinates(w,to), inward=a.forward-b.forward;
  if(inward<=1e-7)return;
  let begin=Math.max(0,(a.forward-FRONT)/inward),end=Math.min(1,a.forward/inward);
  const sideStep=b.side-a.side;
  if(Math.abs(sideStep)>1e-7){
    const t1=(-HALF_FRONT-a.side)/sideStep,t2=(HALF_FRONT-a.side)/sideStep;
    begin=Math.max(begin,Math.min(t1,t2));end=Math.min(end,Math.max(t1,t2));
  }else if(Math.abs(a.side)>HALF_FRONT)return;
  if(end<=begin)return;
  const held=(end-begin)*inward*.70;
  return {x:to.x+Math.cos(w.angle)*held,y:to.y+Math.sin(w.angle)*held};
}
export function weiBowExit(w:MythicWarning,p:Point,clear:PathClear):Point|undefined {
  if(w.wei?.stance!=='bow'||w.resolved)return;
  const {forward,side}=coordinates(w,p);
  if(forward<0||forward>w.radius||!w.wei.lanes.some(lane=>Math.abs(side-lane)<=22))return;
  const options=[w.wei.gap,w.wei.gap-136,w.wei.gap+136].sort((a,b)=>Math.abs(a-side)-Math.abs(b-side));
  for(const safe of options){const exit=weiPoint(w,forward,safe);if(clear(p,exit))return exit;}
}
