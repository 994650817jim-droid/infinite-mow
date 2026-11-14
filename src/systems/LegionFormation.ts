import type {Ally} from '../entities/Ally';
import type {Player} from '../entities/Player';
import type {CampGroup} from '../data/camp';
import type {TroopKind} from '../data/legion';
/** Cached multi-row anchors, not rigid movement or collision corrections. */
export class LegionFormation {
 private offsets=new Map<number,{x:number;y:number}>();
 private angle=-Math.PI/2;private lastX:number;private lastY:number;
 narrow=false;private members:Ally[]=[];private groups:Partial<Record<TroopKind,CampGroup>>={};
 extent=0;
 constructor(private player:Player){this.lastX=player.x;this.lastY=player.y;}
 rebuild(units:Ally[],groups:Partial<Record<TroopKind,CampGroup>>){
  this.members=units;this.groups=groups;this.offsets.clear();const lanes:{front:Ally[];middle:Ally[];rear:Ally[]}={front:[],middle:[],rear:[]};
  for(const u of units)if(u.active){const group=groups[u.kind]??(u.def.ranged||u.kind==='medic'?'rear':u.kind==='spearman'?'middle':'front');lanes[group].push(u);}
  const total=lanes.front.length+lanes.middle.length+lanes.rear.length,columns=Math.max(3,Math.ceil(Math.sqrt(total)*1.25*(this.narrow?.72:1))),spacing=38;
  const middleRows=Math.ceil(lanes.middle.length/columns);this.extent=0;
  for(const group of ['front','middle','rear']as const){const list=lanes[group];list.forEach((u,i)=>{const row=Math.floor(i/columns),rowCount=Math.min(columns,list.length-row*columns),x=(i%columns-(rowCount-1)/2)*spacing,y=group==='front'?70+row*spacing:group==='middle'?-60-row*spacing:-(middleRows?60+middleRows*spacing+30:80)-row*spacing;this.offsets.set(u.id,{x,y});this.extent=Math.max(this.extent,Math.hypot(x,y));});}
 }
 setNarrow(narrow:boolean){if(narrow===this.narrow)return;this.narrow=narrow;this.rebuild(this.members,this.groups);}
 update(dt:number){const dx=this.player.x-this.lastX,dy=this.player.y-this.lastY;this.lastX=this.player.x;this.lastY=this.player.y;if(Math.hypot(dx,dy)<.2||Math.hypot(dx,dy)>100)return;const target=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(target-this.angle),Math.cos(target-this.angle));this.angle+=delta*(1-Math.exp(-2.5*dt));}
 position(u:Ally){const p=this.offsets.get(u.id)??{x:0,y:-80},c=Math.cos(this.angle),s=Math.sin(this.angle);return{x:this.player.x+c*p.y-s*p.x,y:this.player.y+s*p.y+c*p.x};}
 clear(){this.offsets.clear();this.members=[];this.narrow=false;this.extent=0;this.angle=-Math.PI/2;this.lastX=this.player.x;this.lastY=this.player.y;}
}
