import type {MythicWarning,Point} from './mythicGauntlet.ts';

type Pass=(a:Point,b:Point)=>boolean;
type Basis=Point & {angle:number};
export interface ZhouWind {
  calm:boolean; reach:number; width:number; shoulder:number;
  ignite:number; crestEnds:number; extinguish:number;
}
const START=34, SPEED=95, EMBER_LIFE=.72, EDGE=6;
export function windPoint(w:Basis,forward:number,side:number):Point {
  const c=Math.cos(w.angle),s=Math.sin(w.angle);
  return {x:w.x+c*forward-s*side,y:w.y+s*forward+c*side};
}
function coordinates(w:Basis,p:Point){
  const x=p.x-w.x,y=p.y-w.y,c=Math.cos(w.angle),s=Math.sin(w.angle);
  return {forward:x*c+y*s,side:y*c-x*s};
}

function fire(origin:Point,target:Point,angle:number,start:number,pass:Pass,turns:number[]):MythicWarning|undefined {
  for(const [reach,width] of [[211,53],[151,40],[105,29]]){
    for(const turn of turns){
      const basis={x:origin.x,y:origin.y,angle:angle+turn};
      for(const sign of [1,-1]){
        const shoulder=sign*(width+30),upwind=windPoint(basis,-30,0);
        const around=windPoint(basis,-30,shoulder),corner=windPoint(basis,reach+8,shoulder);
        const foot=coordinates(basis,target);
        const entry=windPoint(basis,Math.max(-30,Math.min(reach+8,foot.forward)),shoulder);
        const escape=foot.forward<START-EDGE ? upwind : entry;
        if(!pass(target,escape)||!pass(origin,upwind)||!pass(escape,around)||!pass(around,upwind)||!pass(around,corner))continue;
        // Check both outer edges and the central trace; shorten or rotate if terrain cuts through the fire front.
        if(![-width,0,width].every(y=>pass(windPoint(basis,START,y),windPoint(basis,reach,y))))continue;
        const ignite=start+1.45,crestEnds=ignite+(reach-START)/SPEED,extinguish=crestEnds+EMBER_LIFE;
        return {...basis,face:basis.angle,kind:'line',radius:reach,halfWidth:width,name:'东风起旗 · 观烬辨风',
          startsAt:start,endsAt:extinguish,wind:{calm:false,reach,width,shoulder,ignite,crestEnds,extinguish},
          resolved:false,power:.88,visual:'seal',action:'cast',mythic:'divine'};
      }
    }
  }
}
function calm(origin:Point,angle:number,start:number):MythicWarning {
  return {x:origin.x,y:origin.y,angle,face:angle,kind:'line',radius:0,name:'余火已熄 · 整阵',startsAt:start,endsAt:start+1.15,
    power:0,visual:'seal',action:'cast',mythic:'divine',resolved:false,wind:{calm:true,reach:0,width:0,shoulder:0,ignite:0,crestEnds:0,extinguish:0}};
}
export function windSequence(origin:Point,target:Point,cast:number,phase2:boolean,now:number,pass:Pass):MythicWarning[] {
  const aim=Math.atan2(target.y-origin.y,target.x-origin.x);
  const first=fire(origin,target,aim,now,pass,[0,.45,-.45,1,-1,Math.PI]);
  if(!first)return [calm({x:origin.x,y:origin.y},aim,now)];
  const quiet=calm({x:origin.x,y:origin.y},first.angle,first.endsAt+.36);
  quiet.wind!.width=first.wind!.width;
  const wave=[first,quiet];
  if(phase2){
    const turn=(cast%2 ? -1:1)*Math.PI/2;
    const second=fire(origin,target,first.angle+turn,quiet.endsAt+.36,pass,[0,.3,-.3,-2*turn]);
    if(second){second.name='东风转旗 · 再辨风向';wave.push(second);}
  }
  return wave;
}
/** Inclusive live depth at this battle instant. Every patch of ground burns for a finite time. */
export function windBand(w:MythicWarning,now:number):[number,number]|undefined {
  const f=w.wind;
  if(!f||f.calm||now<f.ignite||now>=f.extinguish)return;
  const front=(t:number)=>Math.min(f.reach,START+Math.max(0,t-f.ignite)*SPEED);
  return [front(now-EMBER_LIFE)-EDGE,front(now)+EDGE];
}
export function inWind(w:MythicWarning,p:Point,now:number):boolean {
  const band=windBand(w,now);if(!band)return false;
  const {forward,side}=coordinates(w,p);
  return forward>=band[0]&&forward<=band[1]&&Math.abs(side)<=w.wind!.width;
}
// Authoritative only. A resumed socket still owns the same fighter; reused solo soldiers have a new life id.
const victims=new WeakMap<MythicWarning,WeakMap<object,number>>();
export function windContact(w:MythicWarning,p:Point,now:number,life:number,hit:()=>boolean|void):boolean {
  if(!inWind(w,p,now))return false;
  let seen=victims.get(w);
  if(!seen){seen=new WeakMap();victims.set(w,seen);}
  if(seen.get(p)===life||hit()===false)return false;
  seen.set(p,life);return true;
}
export function windExit(w:MythicWarning,p:Point,now:number,pass:Pass):Point|undefined {
  const f=w.wind;
  if(!f||f.calm||w.resolved||now>=f.extinguish)return;
  const {forward,side}=coordinates(w,p),tail=windBand(w,now)?.[0]??START-EDGE;
  if(forward<tail-8||forward>f.reach+12||Math.abs(side)>f.width+24)return;
  const sign=Math.abs(side)>3?Math.sign(side):Math.sign(f.shoulder);
  const targets=[windPoint(w,forward,sign*(f.width+18)),windPoint(w,forward,-sign*(f.width+18))];
  if(forward<START+f.width)targets.unshift(windPoint(w,START-18,side));
  return targets.find(point=>pass(p,point));
}
