import type {MythicWarning,Point} from './mythicGauntlet.ts';

export interface SpearShadow {
  from:Point; fakeFrom:Point; fake:Point; side:number;
  plantAt:number; launchAt:number; switchStep:boolean; folded?:boolean;
}
type Clear=(from:Point,to:Point)=>boolean;
function offset(p:Point,angle:number,distance:number,side=0):Point {
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:p.x+distance*c-side*s,y:p.y+distance*s+side*c};
}
function point(p:Point):Point{return {x:p.x,y:p.y};}
function lerp(a:Point,b:Point,t:number):Point{
  if(t>=1)return point(b);
  return {x:a.x+(b.x-a.x)*Math.max(0,t),y:a.y+(b.y-a.y)*Math.max(0,t)};
}
function plan(origin:Point,target:Point,angle:number,length:number,side:number,cast:number,phase:boolean,start:number,clear:Clear){
  const count=(cast%2===0?2:1)+(phase?1:0);
  const result:MythicWarning[]=[];
  let from=point(origin),fakeFrom=point(origin);
  for(let i=0;i<count;i++){
    const returning=i%2===1, switchStep=phase&&i===count-1;
    const realSide=side*(36+(switchStep?22:0)), fakeSide=-side*36;
    const d=returning?length:0,heading=angle+(returning?Math.PI:0);
    const real=offset(origin,angle,d,realSide),fake=offset(origin,angle,d,fakeSide);
    const tip=offset(real,heading,length),fakeTip=offset(fake,heading,length);
    // The fake lane stays open all the way to melee range. The true lane has a
    // reachable side step at the target's depth even when the strike reverses.
    const depth=Math.min(length,Math.max(0,(target.x-real.x)*Math.cos(heading)+(target.y-real.y)*Math.sin(heading)));
    const threat=offset(real,heading,depth),safe=offset(fake,heading,depth);
    if(!clear(from,real)||!clear(fakeFrom,fake)||!clear(real,tip)||!clear(fake,fakeTip)||
      !clear(target,safe)||!clear(threat,safe))return;
    const halfWidth=i===0?(cast%2===0?18:15):switchStep?17:18;
    const endsAt=start+(switchStep?1.7:1.55);
    const shadow:SpearShadow={from,fakeFrom,fake,side,plantAt:start+.34,launchAt:endsAt-.22,switchStep};
    result.push({...real,angle:heading,face:heading,kind:'line',halfWidth,radius:length,
      name:switchStep?'怨影返刺 · 换足扬尘':returning?'怨影重刺 · 循痕回枪':cast%2===0?'百枪真身 · 双影分步':'岔影封步 · 双影分枪',
      startsAt:start,endsAt,resolved:false,power:.88,action:'attack',mythic:'ghost',shadow});
    from=tip;fakeFrom=fakeTip;start=endsAt+.40;
  }
  return result;
}
export function shadowSequence(origin:Point,target:Point,cast:number,phase:boolean,now:number,clear:Clear):MythicWarning[] {
  const angle=Math.atan2(target.y-origin.y,target.x-origin.x), side=cast%2===0?1:-1;
  for(const length of [cast%2===0?248:218,170,116]){
    for(const turn of [0,.35,-.35,.75,-.75]){
      for(const sideChoice of [side,-side]){
        const moves=plan(origin,target,angle+turn,length,sideChoice,cast,phase,now,clear);
        if(moves)return moves;
      }
    }
  }
  return [{...point(origin),angle,face:angle,kind:'line',name:'枪路受阻 · 收枪',radius:0,halfWidth:0,
    startsAt:now,endsAt:now+1.2,resolved:false,power:0,action:'cast',mythic:'ghost',
    shadow:{from:point(origin),fakeFrom:point(origin),fake:point(origin),side,plantAt:now,launchAt:now+1.2,switchStep:false,folded:true}}];
}
export function shadowPosition(w:MythicWarning,now:number,fake:boolean):Point|undefined {
  const s=w.shadow;if(!s||now<w.startsAt)return;
  const foot=fake?s.fake:w;
  if(s.folded)return point(w);
  if(now<s.plantAt)return lerp(fake?s.fakeFrom:s.from,foot,(now-w.startsAt)/(s.plantAt-w.startsAt));
  if(now<=s.launchAt)return point(foot);
  return lerp(foot,offset(foot,w.angle,w.radius),(now-s.launchAt)/(w.endsAt-s.launchAt));
}
export function shadowExit(w:MythicWarning,p:Point,clear:Clear):Point|undefined {
  if(!w.shadow||w.shadow.folded||w.resolved)return;
  const c=Math.cos(w.angle),s=Math.sin(w.angle),x=p.x-w.x,y=p.y-w.y;
  const forward=x*c+y*s,side=y*c-x*s,half=w.halfWidth??18;
  if(forward<0||forward>w.radius||Math.abs(side)>half+10)return;
  const fakeSide=(w.shadow.fake.y-w.y)*c-(w.shadow.fake.x-w.x)*s;
  const sign=Math.abs(side)>3?Math.sign(side):Math.sign(fakeSide);
  for(const dir of [sign,-sign]){
    const safe=offset(w,w.angle,forward,(half+29)*dir);
    if(clear(p,safe))return safe;
  }
}
