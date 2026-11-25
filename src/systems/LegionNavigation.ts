import {SpatialGrid} from './SpatialGrid';
export interface LegionObstacle {left:number;right:number;top:number;bottom:number;}
interface Box extends LegionObstacle{x:number;y:number;}
/** Local corner routing only: no position corrections, no artificial movement speed. */
export class LegionNavigation {
 private grid=new SpatialGrid<Box>(128);private maxHalf=0;
 private near:Box[]=[];private routes=new Map<number,{x:number;y:number;tx:number;ty:number;box:string;until:number}>();
 private boxKeys=new Set<string>();
 private key(b:LegionObstacle){return `${b.left},${b.right},${b.top},${b.bottom}`;}
 setBoxes(boxes:readonly LegionObstacle[]){this.grid.clear();this.boxKeys.clear();this.maxHalf=0;for(const b of boxes){this.boxKeys.add(this.key(b));this.grid.insert({...b,x:(b.left+b.right)/2,y:(b.top+b.bottom)/2});this.maxHalf=Math.max(this.maxHalf,(b.right-b.left)/2,(b.bottom-b.top)/2);}}
 nearWall(x:number,y:number,wasNarrow=false){const range=wasNarrow?140:100;for(const b of this.grid.query(x,y,range+this.maxHalf,this.near)){const dx=Math.max(b.left-x,0,x-b.right),dy=Math.max(b.top-y,0,y-b.bottom);if(Math.hypot(dx,dy)<range)return true;}return false;}
 clearSegment(ax:number,ay:number,bx:number,by:number,r:number):boolean {
   const range=Math.hypot(bx-ax,by-ay)/2+this.maxHalf+r;
   return !this.grid.query((ax+bx)/2,(ay+by)/2,range,this.near).some(box=>this.crosses(ax,ay,bx,by,box,r));
 }
 private crosses(ax:number,ay:number,bx:number,by:number,b:Box,pad:number){let lo=0,hi=1;for(const [p,d,min,max]of [[ax,bx-ax,b.left-pad,b.right+pad],[ay,by-ay,b.top-pad,b.bottom+pad]]){if(Math.abs(d)<.001){if(p<=min||p>=max)return false;}else{const a=(min-p)/d,c=(max-p)/d;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(lo>=hi)return false;}}return lo<hi&&hi>0&&lo<1;}
 steer(id:number,x:number,y:number,tx:number,ty:number,r:number,now:number){const prior=this.routes.get(id);if(prior&&now<prior.until&&this.boxKeys.has(prior.box)&&Math.hypot(prior.tx-tx,prior.ty-ty)<96&&Math.hypot(prior.x-x,prior.y-y)>3)return prior;this.routes.delete(id);
 const length=Math.hypot(tx-x,ty-y);let nearest:Box|undefined,d=Infinity;
 for(const b of this.grid.query((x+tx)/2,(y+ty)/2,length/2+this.maxHalf+r,this.near))if(this.crosses(x,y,tx,ty,b,r+3)){const dist=Math.hypot(b.x-x,b.y-y);if(dist<d){d=dist;nearest=b;}}
 if(!nearest)return{x:tx,y:ty};const b=nearest,pad=r+8;let best={x:tx,y:ty},score=Infinity;
 for(const cx of[b.left-pad,b.right+pad])for(const cy of[b.top-pad,b.bottom+pad]){if(this.crosses(x,y,cx,cy,b,r+2))continue;const cost=Math.hypot(cx-x,cy-y)+Math.hypot(cx-tx,cy-ty)+(this.crosses(cx,cy,tx,ty,b,r+2)?(b.right-b.left+b.bottom-b.top)*2:0);if(cost<score){score=cost;best={x:cx,y:cy};}}
 if(Number.isFinite(score)){const route={...best,tx,ty,box:this.key(b),until:now+1200};this.routes.set(id,route);return route;}return{x:tx,y:ty};
 }
 forget(id:number){this.routes.delete(id);}
 clear(){this.grid.clear();this.boxKeys.clear();this.routes.clear();}
}
