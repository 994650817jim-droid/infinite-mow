import type {Ally} from '../entities/Ally';
import type {Player} from '../entities/Player';
import type {CampGroup} from '../data/camp';
import type {TroopKind} from '../data/legion';
import {FORMATION, FORMATIONS, type FormationId} from '../data/formations';
/**
 * Cached multi-row anchors, not rigid movement or collision corrections.
 * 军阵（data/formations.ts，formation-design.md）：shape 为 null 时是「常阵」（原来的三排：近战在前、长枪居中、远程 / 军医在后）；
 * 选了阵就按阵型生成站位。坐标系：x = 横向、y = 朝前（主将移动方向）。入阵人数（cap）以内的士兵进阵（inForm），其余排在后军、不吃阵势。
 * 长蛇阵不用固定偏移：沿主将走过的路径（trail）排成一列。
 */
const KIND_ORDER: readonly TroopKind[] = ['guardian', 'swordsman', 'spearman', 'halberdier', 'rider', 'archer', 'crossbowman', 'medic'];
/** 随从阵位（局部坐标；按随从人数 1 / 2 / 3）。常阵不在这里（FollowerSquad 自己的身后阵位）。 */
const FOLLOWER_SLOTS: Record<Exclude<FormationId, 'snake'>, Array<Array<{x: number; y: number}>>> = {
  circle: [[{x: 0, y: 46}], [{x: -42, y: 14}, {x: 42, y: 14}], [{x: -44, y: 10}, {x: 44, y: 10}, {x: 0, y: -44}]],
  wedge: [[{x: 0, y: -40}], [{x: -46, y: 8}, {x: 46, y: 8}], [{x: -46, y: 8}, {x: 46, y: 8}, {x: 0, y: -42}]],
  crane: [[{x: 0, y: -44}], [{x: -44, y: -2}, {x: 44, y: -2}], [{x: -44, y: -2}, {x: 44, y: -2}, {x: 0, y: -46}]],
  geese: [[{x: 0, y: -44}], [{x: -40, y: -42}, {x: 40, y: -42}], [{x: -42, y: -42}, {x: 42, y: -42}, {x: 0, y: -50}]],
  bazhen: [[{x: 0, y: -50}], [{x: -46, y: -20}, {x: 46, y: -20}], [{x: -46, y: -24}, {x: 46, y: -24}, {x: 0, y: 50}]],
};
export class LegionFormation {
 private offsets=new Map<number,{x:number;y:number}>();
 private angle=-Math.PI/2;private lastX:number;private lastY:number;
 narrow=false;private members:Ally[]=[];private groups:Partial<Record<TroopKind,CampGroup>>={};
 extent=0;
 /** 当前阵（null = 常阵）。 */
 shape:FormationId|null=null;
 /** 入阵人数上限（8 + 2 × 统御）。 */
 cap=Infinity;
 /** 在阵里的士兵 id（吃阵势）。 */
 readonly inForm=new Set<number>();
 /** 锚点（守城「部曲守门」：城门内一点、朝城外）；null = 跟着主将。 */
 anchor:{x:number;y:number;facing:number}|null=null;
 private get bx(){return this.anchor?this.anchor.x:this.player.x;}
 private get by(){return this.anchor?this.anchor.y:this.player.y;}
 /** 入阵士兵站位的中心（局部坐标；阵纹铺在这里）。 */
 center={x:0,y:0};
 /** 长蛇阵：每名士兵在队列里的序号（随从占前 3 个）。 */
 private column=new Map<number,number>();
 /** 主将走过的路径（长蛇阵用），最新在前。 */
 private trail:Array<{x:number;y:number}>=[];
 constructor(private player:Player){this.lastX=player.x;this.lastY=player.y;}
 /** 朝向（弧度）。 */
 get facing():number{return this.angle;}
 /** 护阵拴绳修正（加在 TACTICS.guardLeash 上；常阵 0）。 */
 get leashAdj():number{return this.shape?FORMATIONS[this.shape].leash-260:0;}
 setShape(shape:FormationId|null,cap:number){if(shape===this.shape&&cap===this.cap)return;this.shape=shape;this.cap=cap;if(shape==='snake'&&!this.trail.length)this.trail=[{x:this.player.x,y:this.player.y}];this.rebuild(this.members,this.groups);}
 rebuild(units:Ally[],groups:Partial<Record<TroopKind,CampGroup>>){
  this.members=units;this.groups=groups;this.offsets.clear();this.inForm.clear();this.column.clear();
  if(!this.shape){this.rebuildPlain(units,groups);for(const u of units)if(u.active)this.inForm.add(u.id);return;}
  const live=units.filter(u=>u.active).sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind)||a.id-b.id);
  const isBack=(u:Ally)=>u.def.ranged||u.kind==='medic';
  const melee=live.filter(u=>!isBack(u)),back=live.filter(isBack),cap=Math.min(this.cap,live.length);
  // 入阵名额按近战 / 远程人数比例分，免得一种兵占满
  const mCap=Math.min(melee.length,Math.max(cap-back.length,Math.round(cap*melee.length/Math.max(1,live.length)))),bCap=Math.min(back.length,cap-mCap);
  const M=melee.slice(0,mCap),B=back.slice(0,bCap),rest=[...melee.slice(mCap),...back.slice(bCap)];
  for(const u of [...M,...B])this.inForm.add(u.id);
  const S=FORMATION.spacing,put=(u:Ally,x:number,y:number)=>{const nx=this.narrow&&this.shape!=='snake'?x*.72:x;this.offsets.set(u.id,{x:nx,y});this.extent=Math.max(this.extent,Math.hypot(nx,y));};
  this.extent=0;
  switch(this.shape){
   case 'circle':{ // 外圈近战、内圈远程 / 军医，主将居中
    const ri=B.length?Math.max(56,B.length*34/(2*Math.PI)):0,ro=Math.max(ri+44,90,M.length*S/(2*Math.PI));
    M.forEach((u,i)=>{const a=(i+.5)/Math.max(1,M.length)*Math.PI*2;put(u,Math.cos(a)*ro,Math.sin(a)*ro);});
    B.forEach((u,i)=>{const a=i/Math.max(1,B.length)*Math.PI*2+Math.PI/2;put(u,Math.cos(a)*ri,Math.sin(a)*ri);});break;}
   case 'wedge':{ // 箭头朝前：近战排成楔形在前，远程两列在主将身后（箭羽）
    let rows=0,n=0;while(n<M.length){rows++;n+=rows;}
    const tip=58+(rows-1)*30;let i=0;
    for(let r=0;r<rows&&i<M.length;r++)for(let j=0;j<=r&&i<M.length;j++,i++)put(M[i],(j-r/2)*40,tip-r*30);
    B.forEach((u,k)=>{const side=k%2?1:-1,row=Math.floor(k/2);put(u,side*(42+Math.floor(row/4)*36),-40-(row%4)*34);});break;}
   case 'crane':{ // 两翼向前张开（口朝前），远程一排在主将身后
    M.forEach((u,i)=>{const side=i%2?1:-1,k=Math.floor(i/2),pos=k%7,line=Math.floor(k/7);put(u,side*(58+pos*30),8+pos*26-line*34);});
    B.forEach((u,j)=>{const per=8,row=Math.floor(j/per),cnt=Math.min(per,B.length-row*per);put(u,(j%per-(cnt-1)/2)*36,-52-row*34);});break;}
   case 'geese':{ // 远程一字横开（主将在中），近战与军医在后排挡
    const R=B.filter(u=>u.kind!=='medic'),medic=B.filter(u=>u.kind==='medic'),rear=[...M,...medic];
    R.forEach((u,j)=>{const per=12,row=Math.floor(j/per),k=j%per,side=k%2?1:-1;put(u,side*(46+Math.floor(k/2)*36),18+row*34);});
    rear.forEach((u,j)=>{const per=9,row=Math.floor(j/per),cnt=Math.min(per,rear.length-row*per);put(u,(j%per-(cnt-1)/2)*S,-54-row*36);});break;}
   case 'bazhen':{ // 八队站八门方位
    const all=[...M,...B];all.forEach((u,i)=>{const g=i%8,k=Math.floor(i/8),a=g/8*Math.PI*2+Math.PI/2,r=FORMATION.bazhen.ring+Math.floor(k/2)*30,lat=(k%2?1:-1)*(k?12:0);put(u,Math.cos(a)*r-Math.sin(a)*lat,Math.sin(a)*r+Math.cos(a)*lat);});break;}
   case 'snake':{const all=[...M,...B];all.forEach((u,i)=>{this.column.set(u.id,i+3);this.offsets.set(u.id,{x:(i%5-2)*34,y:-(50+Math.floor(i/5)*34)});}); /* 偏移只在有锚点（守门）时用：收成 5 列的方块，平时沿路径排一列 */this.extent=FORMATION.snake.lead+(all.length+3)*FORMATION.snake.gap;break;}
  }
  {let sx=0,sy=0,n=0;for(const u of [...M,...B]){const o=this.offsets.get(u.id);if(o){sx+=o.x;sy+=o.y;n++;}}this.center=this.shape==='snake'||!n?{x:0,y:0}:{x:sx/n,y:sy/n};}
  // 后军：入阵人数之外的士兵排在阵后
  const back0=this.shape==='snake'?0:Math.max(70,this.extent*.75)+40;
  rest.forEach((u,j)=>{if(this.shape==='snake'){const i=this.column.size;this.column.set(u.id,i+3);this.offsets.set(u.id,{x:0,y:0});return;}const per=8,row=Math.floor(j/per),cnt=Math.min(per,rest.length-row*per);put(u,(j%per-(cnt-1)/2)*S,-back0-row*S);});
 }
 /** 常阵（原来的三排）。 */
 private rebuildPlain(units:Ally[],groups:Partial<Record<TroopKind,CampGroup>>){
  const lanes:{front:Ally[];middle:Ally[];rear:Ally[]}={front:[],middle:[],rear:[]};
  for(const u of units)if(u.active){const group=groups[u.kind]??(u.def.ranged||u.kind==='medic'?'rear':u.kind==='spearman'?'middle':'front');lanes[group].push(u);}
  const total=lanes.front.length+lanes.middle.length+lanes.rear.length,columns=Math.max(3,Math.ceil(Math.sqrt(total)*1.25*(this.narrow?.72:1))),spacing=38;
  const middleRows=Math.ceil(lanes.middle.length/columns);this.extent=0;
  for(const group of ['front','middle','rear']as const){const list=lanes[group];list.forEach((u,i)=>{const row=Math.floor(i/columns),rowCount=Math.min(columns,list.length-row*columns),x=(i%columns-(rowCount-1)/2)*spacing,y=group==='front'?70+row*spacing:group==='middle'?-60-row*spacing:-(middleRows?60+middleRows*spacing+30:80)-row*spacing;this.offsets.set(u.id,{x,y});this.extent=Math.max(this.extent,Math.hypot(x,y));});}
 }
 setNarrow(narrow:boolean){if(narrow===this.narrow)return;this.narrow=narrow;this.rebuild(this.members,this.groups);}
 update(dt:number){const dx=this.player.x-this.lastX,dy=this.player.y-this.lastY;this.lastX=this.player.x;this.lastY=this.player.y;
  if(this.shape==='snake'){const t=this.trail,h=t[0];if(!h||Math.hypot(this.player.x-h.x,this.player.y-h.y)>=FORMATION.snake.trailStep){t.unshift({x:this.player.x,y:this.player.y});const keep=Math.ceil(this.extent/FORMATION.snake.trailStep)+12;if(t.length>keep)t.length=keep;}}
  if(this.anchor){this.angle=this.anchor.facing;return;}
  if(Math.hypot(dx,dy)<.2||Math.hypot(dx,dy)>100)return;const target=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(target-this.angle),Math.cos(target-this.angle));this.angle+=delta*(1-Math.exp(-2.5*dt));}
 /** 沿路径往后 d 像素的点（路径不够长时沿朝向反方向延伸）。 */
 private along(d:number):{x:number;y:number}{
  let px=this.bx,py=this.by,left=d;
  for(const p of this.trail){const seg=Math.hypot(p.x-px,p.y-py);if(seg>=left&&seg>0){const k=left/seg;return{x:px+(p.x-px)*k,y:py+(p.y-py)*k};}left-=seg;px=p.x;py=p.y;}
  const back=this.angle+Math.PI;return{x:px+Math.cos(back)*left,y:py+Math.sin(back)*left};
 }
 /** 局部坐标 → 世界坐标。 */
 world(p:{x:number;y:number}){return this.toWorld(p);}
 private toWorld(p:{x:number;y:number}){const c=Math.cos(this.angle),s=Math.sin(this.angle);return{x:this.bx+c*p.y-s*p.x,y:this.by+s*p.y+c*p.x};}
 position(u:Ally){
  if(this.shape==='snake'&&!this.anchor){const i=this.column.get(u.id);if(i!==undefined)return this.along(FORMATION.snake.lead+i*FORMATION.snake.gap);}
  return this.toWorld(this.offsets.get(u.id)??{x:0,y:-80});
 }
 /** 随从阵位（世界坐标）；常阵返回 null（FollowerSquad 用自己的身后阵位）。 */
 followerSlot(i:number,n:number):{x:number;y:number}|null{
  if(!this.shape||this.anchor)return null; // 部曲守门时随从仍跟着主将
  if(this.shape==='snake')return this.along(FORMATION.snake.lead+i*FORMATION.snake.gap);
  const k=Math.min(3,Math.max(1,n))-1,p=FOLLOWER_SLOTS[this.shape][k][i]??{x:0,y:-50};return this.toWorld(p);
 }
 /** 某点相对主将朝向的局部坐标（锋矢「正前方」判断用）。 */
 local(x:number,y:number):{x:number;y:number}{const dx=x-this.bx,dy=y-this.by,c=Math.cos(this.angle),s=Math.sin(this.angle);return{x:-s*dx+c*dy,y:c*dx+s*dy};}
 /** 局部偏移（测试 / 小地图示意用）。 */
 offsetOf(u:Ally){return this.offsets.get(u.id)??null;}
 clear(){this.offsets.clear();this.inForm.clear();this.column.clear();this.trail=[];this.members=[];this.narrow=false;this.extent=0;this.angle=-Math.PI/2;this.lastX=this.player.x;this.lastY=this.player.y;}
}
