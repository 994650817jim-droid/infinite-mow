import type {Player} from '../entities/Player';
import type {Enemy} from '../entities/Enemy';
import type {Ally} from '../entities/Ally';

/** Permanent building footprints. Not Enemy instances: no HP, targeting, drops or destruction. */
export class SishuiObstacles {
  readonly footprints:{left:number;right:number;top:number;bottom:number}[];
  /** footprints：自定义碰撞框（汜水关关墙由 SishuiPass 给，开门后会移除关门那一段）；不给时用旧的关门 + 两座箭楼。 */
  constructor(footprints?:{left:number;right:number;top:number;bottom:number}[]){this.footprints=footprints??[
    {left:-100,right:100,top:-292,bottom:-234},
    {left:-274,right:-186,top:-260,bottom:-228},
    {left:186,right:274,top:-260,bottom:-228},
  ];}
  /** 不受碰撞的敌兵（守城 v2：正在爬云梯 / 摔下城的，人在墙面上）。 */
  pass?:(e:Enemy)=>boolean;
  private pushX=0;private pushY=0;
  private correction(x:number,y:number,r:number,box:typeof this.footprints[number]):boolean{
    if(x<box.left-r||x>box.right+r||y<box.top-r||y>box.bottom+r)return false;
    const qx=Math.max(box.left,Math.min(box.right,x)),qy=Math.max(box.top,Math.min(box.bottom,y));
    const dx=x-qx,dy=y-qy,d=Math.hypot(dx,dy);if(d>=r)return false;
    if(d>.001){this.pushX=dx/d*(r-d);this.pushY=dy/d*(r-d);return true;}
    const left=x-box.left,right=box.right-x,top=y-box.top,bottom=box.bottom-y,min=Math.min(left,right,top,bottom);
    this.pushX=min===left?-(left+r):min===right?right+r:0;
    this.pushY=min===top?-(top+r):min===bottom?bottom+r:0;return true;
  }
  resolve(player:Player,allies:readonly Ally[],enemies:readonly Enemy[]):void{
    for(const box of this.footprints){
      if(this.correction(player.x,player.y,player.radius,box)){player.sprite.x+=this.pushX;player.sprite.y+=this.pushY;}
      for(const a of allies)if(a.active&&this.correction(a.x,a.y,a.radius,box))a.push(this.pushX,this.pushY);
      for(const e of enemies)if(e.active&&!e.isSupplySlot&&!this.pass?.(e)&&this.correction(e.x,e.y,e.radius,box)){e.sprite.x+=this.pushX;e.sprite.y+=this.pushY;}
    }
  }
}
