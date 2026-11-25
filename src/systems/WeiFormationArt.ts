import type Phaser from 'phaser';
import {weiPoint} from '../data/divineCaocao';
import type {MythicWarning} from '../data/mythicGauntlet';

const ranks=new WeakMap<Phaser.GameObjects.Graphics,Phaser.GameObjects.Image[]>();
export function hideWeiRanks(g:Phaser.GameObjects.Graphics):void {
  const figures=ranks.get(g);
  if(figures?.[0]?.visible)for(const figure of figures)figure.setVisible(false);
}
export function drawWeiRanks(g:Phaser.GameObjects.Graphics,w:MythicWarning,now:number):void {
  const order=w.wei;
  if(!order)return;
  let figures=ranks.get(g);
  if(!figures){
    const owned:Phaser.GameObjects.Image[]=[];
    ranks.set(g,owned);figures=owned;
    g.once('destroy',()=>owned.forEach(v=>v.destroy()));
  }
  const c=Math.cos(w.angle),s=Math.sin(w.angle);
  const row=Math.abs(c)>Math.abs(s)?(c<0?1:2):(s<0?3:0);
  const progress=Math.min(1,Math.max(0,(now-w.startsAt)/.48));
  const gold=0xf6cd74,bronze=0xa87c46,teal=0x94e0ce;
  let used=0;
  const soldier=(side:number,front:number,bow:boolean,lower:number)=>{
    const primary=bow?'enemy_archer_walk_sheet':'enemy_shield_walk_sheet';
    const key=g.scene.textures.exists(primary)?primary:(bow?'coop_ally_archer':'coop_ally_guardian');
    if(!g.scene.textures.exists(key))return;
    const spot=weiPoint(w,front,side);
    const fig=figures[used]??(figures[used]=g.scene.add.image(0,0,key));
    used++;
    const frame=row*4+(progress<1?Math.floor(progress*4):0);
    fig.setTexture(key,frame).setPosition(spot.x,spot.y+lower).setOrigin(.5,.85).setDisplaySize(49,49-lower)
      .setDepth(Math.max(g.depth+2,45)).setAlpha(w.resolved?.72:.94).setTint(bow?0xffe2b4:0xe8d2aa).setVisible(true);
  };
  const flag=(side:number,rise:number,color:number)=>{
    const pos=weiPoint(w,40,side), height=17+rise*29;
    const end=weiPoint(w,59,side);
    g.lineStyle(3,0x302720,.94).lineBetween(pos.x,pos.y,pos.x,pos.y-height);
    g.lineStyle(1.5,gold,1).lineBetween(pos.x,pos.y,pos.x,pos.y-height);
    g.fillStyle(color,.96).fillTriangle(pos.x,pos.y-height,end.x,end.y-height+6,pos.x,pos.y-height+14);
  };
  if(order.stance==='standDown'){
    flag(-45,1-progress,bronze);flag(45,1-progress,bronze);
  }else if(order.stance==='shield'){
    const end=83;
    const corners=[weiPoint(w,0,-end),weiPoint(w,w.radius,-end),weiPoint(w,w.radius,end),weiPoint(w,0,end)];
    g.fillStyle(bronze,w.resolved?.36:.1).fillPoints(corners,true);
    g.lineStyle(w.resolved?4:2,gold,.85).lineBetween(corners[1].x,corners[1].y,corners[2].x,corners[2].y);
    for(const side of [-66,-33,0,33,66]){
      soldier(side,49,false,(1-progress)*7);
      for(const front of [79,106]){
        const p=weiPoint(w,front,side),l=weiPoint(w,front-7,side-5),r=weiPoint(w,front-7,side+5);
        g.lineStyle(2,gold,.63).lineBetween(l.x,l.y,p.x,p.y).lineBetween(p.x,p.y,r.x,r.y);
      }
    }
    flag(-88,.12,bronze);flag(88,.12,bronze);
  }else if(order.stance==='bow'){
    for(const side of [-1,1])soldier(order.gap+side*(25+77*progress),52,false,7*progress);
    for(const lane of order.lanes)soldier(lane*(.64+.36*progress),21,true,0);
    for(const edge of [-1,1])flag(order.gap+edge*39,progress,teal);
  }
}
