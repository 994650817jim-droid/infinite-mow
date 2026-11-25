type Point={x:number;y:number};
type Walkable=(a:Point,b:Point)=>boolean;
export type ArmyThreat=Point & {kind:'line'|'circle'|'ring'|'sweep';radius:number;angle?:number;
  halfWidth?:number;innerRadius?:number;arc?:number;lanes?:number;spread?:number};
export const COMPANY_LEASH={guard:260,sortie:400} as const;

/** Special formations resolve with their own real lanes and timing. */
export function ordinaryWarning(w: (ArmyThreat & {resolved?:boolean;shadow?:unknown;wind?:unknown;wei?:unknown;
  charge?:boolean;transit?:{harmless:boolean};closing?:boolean;constellation?:{broken:boolean}})|null|undefined):w is ArmyThreat {
  return !!w&&!w.resolved&&!w.shadow&&!w.wind&&!w.wei&&!w.charge&&!w.transit?.harmless&&!(w.closing&&w.constellation?.broken);
}
export function insideArmyThreat(w:ArmyThreat,p:Point,pad=0):boolean {
  const x=p.x-w.x,y=p.y-w.y,r=w.radius+pad;
  if(w.kind==='line'){
    const half=(w.halfWidth??25)+pad;
    if(x*x+y*y>(r*r+half*half))return false;
    for(let i=0,n=w.lanes??1;i<n;i++){
      const a=(w.angle??0)+(i-(n-1)/2)*(w.spread??0),c=Math.cos(a),s=Math.sin(a),d=x*c+y*s;
      if(d>=-pad&&d<=r&&Math.abs(y*c-x*s)<=half)return true;
    }
    return false;
  }
  const squared=x*x+y*y;
  if(squared>r*r)return false;
  if(w.kind==='sweep'){
    const a=w.angle??0;
    return Math.abs(Math.atan2(y*Math.cos(a)-x*Math.sin(a),x*Math.cos(a)+y*Math.sin(a)))<=(w.arc??Math.PI*2/3)/2;
  }
  const hole=Math.max(0,(w.innerRadius??0)-pad);
  return squared>=hole*hole;
}
export function threatened(threats:readonly ArmyThreat[],p:Point,pad:number):boolean {
  for(const threat of threats)if(insideArmyThreat(threat,p,pad))return true;
  return false;
}
const rays=Array.from({length:12},(_,i)=>({x:Math.cos(i*Math.PI/6),y:Math.sin(i*Math.PI/6)}));
export type ArmyExit=Point & {threat:ArmyThreat};
/** Look at the union so dodging a charge does not place a unit in another announced strike. */
export function armyExit(threats:readonly ArmyThreat[],p:Point,pad:number,clear:Walkable,slot:number,previous?:ArmyExit):ArmyExit|undefined {
  const threat=threats.find(w=>insideArmyThreat(w,p,pad));
  if(!threat)return;
  // A blocked segment also blocks every longer segment along that same ray.
  const reachable=(end:Point):'unsafe'|'blocked'|'safe'=>{
    if(threatened(threats,end,pad+6))return 'unsafe';
    if(!clear(p,end))return 'blocked';
    if(threats.length>1){
      const n=Math.ceil(Math.hypot(end.x-p.x,end.y-p.y)/12);
      for(const other of threats)if(other!==threat && !insideArmyThreat(other,p,pad)){
        for(let j=1;j<n;j++)if(insideArmyThreat(other,{x:p.x+(end.x-p.x)*j/n,y:p.y+(end.y-p.y)*j/n},pad))return 'blocked';
      }
    }
    return 'safe';
  };
  if(previous?.threat===threat && reachable(previous)==='safe')return previous;
  let blocked=0;
  for(const distance of [25,44,68,96,130,174,225,300,400]){
    for(let i=0;i<rays.length;i++){
      const bit=1<<i;
      if(blocked&bit)continue;
      const ray=rays[(i+slot)%rays.length],end={x:p.x+ray.x*distance,y:p.y+ray.y*distance};
      const state=reachable(end);
      if(state==='safe')return {...end,threat};
      if(state==='blocked')blocked|=bit;
    }
  }
}

/** Cache blocked ground briefly per soldier. A new or moving telegraph invalidates the whole frame immediately. */
export class ArmyEvasion {
  private threats:readonly ArmyThreat[]=[];
  private previous:(ArmyThreat & {source:ArmyThreat})[]=[];
  private version=0;
  private readonly memory=new WeakMap<Point,{version:number;x:number;y:number;retry:number;goal?:ArmyExit}>();
  begin(threats:readonly ArmyThreat[]):void {
    this.threats=threats;
    if(threats.length===this.previous.length && threats.every((w,i)=>{
      const old=this.previous[i];
      return old.source===w && old.x===w.x && old.y===w.y && old.radius===w.radius && old.kind===w.kind &&
        old.angle===w.angle && old.arc===w.arc && old.innerRadius===w.innerRadius &&
        old.halfWidth===w.halfWidth && old.lanes===w.lanes && old.spread===w.spread;
    }))return;
    this.version++;
    this.previous=threats.map(w=>({source:w,x:w.x,y:w.y,kind:w.kind,radius:w.radius,angle:w.angle,arc:w.arc,
      innerRadius:w.innerRadius,halfWidth:w.halfWidth,lanes:w.lanes,spread:w.spread}));
  }
  exit(unit:Point,pad:number,clear:Walkable,slot:number,seconds:number):ArmyExit|undefined {
    const memo=this.memory.get(unit),current=memo?.version===this.version;
    if(current && !memo.goal && seconds<memo.retry && Math.hypot(unit.x-memo.x,unit.y-memo.y)<9)return;
    const goal=armyExit(this.threats,unit,pad,clear,slot,current?memo.goal:undefined);
    if(goal||threatened(this.threats,unit,pad)){
      this.memory.set(unit,{version:this.version,x:unit.x,y:unit.y,goal,retry:seconds+.10+(slot*53%73)/1000});
    }else if(memo)this.memory.delete(unit);
    return goal;
  }
}

/** Back away while staying inside the ordinary weapon's usable range. */
export function rangedStandOff(unit:Point,target:Point,range:number,heading:number,clear?:Walkable):Point|undefined {
  const dx=unit.x-target.x,dy=unit.y-target.y,d=Math.hypot(dx,dy);
  if(d>=range*.66)return;
  const angle=d>.5?Math.atan2(dy,dx):heading*.618033989*Math.PI*2, band=range*.79;
  for(const turn of [0,.65,-.65,1.3,-1.3,2,-2,Math.PI]){
    const end={x:target.x+Math.cos(angle+turn)*band,y:target.y+Math.sin(angle+turn)*band};
    if(!clear||clear(unit,end))return end;
  }
}
/** Separate approach lanes relative to the commander; the destination stays stable while the soldier runs. */
export function sortieFlank(commander:Point,target:Point,range:number,slot:number,guardian:boolean):Point {
  const angle=Math.atan2(commander.y-target.y,commander.x-target.x)+(slot%3-1)*(guardian?.24:.82);
  return {x:target.x+Math.cos(angle)*range*.78,y:target.y+Math.sin(angle)*range*.78};
}
