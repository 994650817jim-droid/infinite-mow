import type Phaser from 'phaser';
import type {MythicWarning} from '../data/mythicGauntlet';
import {windBand,windPoint} from '../data/divineZhouyu';

export function drawZhouyuWind(g:Phaser.GameObjects.Graphics,w:MythicWarning,now:number){
  const field=w.wind!;
  const dx=Math.cos(w.angle),dy=Math.sin(w.angle),wave=Math.sin(now*7)*2.4;
  // Place the pole on the viewer-facing shoulder so the tall boss sprite cannot cover its cloth.
  const flag=windPoint(w,17,(dx>=0?1:-1)*(field.width+30));
  const top={x:flag.x,y:flag.y-46};
  g.lineStyle(4,0x33231d,.93).lineBetween(flag.x,flag.y,top.x,top.y-3);
  g.lineStyle(1.6,0xead19a,1).lineBetween(flag.x-1,flag.y,top.x-1,top.y-4);
  if(field.calm){
    g.fillStyle(0x776556,.74).fillTriangle(top.x+1,top.y,top.x+6,top.y+7,top.x+1,top.y+20);
    return;
  }
  const tip={x:top.x+dx*37-dy*8,y:top.y+dy*18+wave};
  const belly={x:top.x+dx*24+dy*(3+wave),y:top.y+dy*9+wave+12};
  g.fillStyle(0xac382b,.97).fillTriangle(top.x,top.y,tip.x,tip.y,belly.x,belly.y)
    .fillTriangle(top.x,top.y,belly.x,belly.y,top.x,top.y+11);
  g.lineStyle(2,0xffdd94,.95).lineBetween(top.x,top.y,tip.x,tip.y);
  if(now>=field.extinguish)return;
  // Drifting sparks and two open shoulder markers show the wind before the first flame reaches the ground.
  for(let i=0;i<7;i++){
    const f=((now-w.startsAt)*.51+i*.153)%1;
    const p=windPoint(w,14+f*85,Math.sin(i*7+now)*4+(i%3-1)*13);
    g.lineStyle(1.8,0xffbf68,.75*Math.sin(Math.PI*f)).lineBetween(p.x-dx*7,p.y-dy*7-5,p.x,p.y-5);
  }
  if(now<field.ignite){
    for(const side of [-field.width,field.width]){
      const a=windPoint(w,31,side),b=windPoint(w,55,side),c=windPoint(w,49,side-Math.sign(side)*4);
      g.lineStyle(1.7,0xf2ba81,.67).lineBetween(a.x,a.y,b.x,b.y).lineBetween(b.x,b.y,c.x,c.y);
    }
    return;
  }
  const band=windBand(w,now);
  if(!band)return;
  const [back,front]=band;
  // Coals follow the head. Each curled tongue and ember stays anchored in the moving damage band.
  for(let i=0;i<17;i++){
    const ratio=(i*.61803398875)%1,side=(ratio*2-1)*field.width;
    const distance=back+(front-back)*((i*.367+now*.14)%1);
    const p=windPoint(w,distance,side),q=windPoint(w,Math.min(front,distance+9),side+Math.sin(i+now*3)*1.5);
    g.lineStyle(2.5,0xa04429,.7).lineBetween(p.x,p.y,q.x,q.y);
    g.fillStyle(0xffab48,.8).fillCircle(q.x,q.y,1.3);
  }
  const cooling=now>=field.crestEnds;
  const fade=cooling?Math.min(1,(field.extinguish-now)/.72):1;
  const edge=front-6;
  const a=windPoint(w,edge,-field.width),b=windPoint(w,edge,field.width);
  g.lineStyle(2.4,0xfdb35b,fade*.85).lineBetween(a.x,a.y,b.x,b.y);
  for(let i=0;i<11;i++){
    const side=field.width*(i/5-1),swirl=Math.sin(i*2.3+now*9);
    const foot=windPoint(w,edge-2,side),heel=windPoint(w,edge-8,side+3.3*swirl),nose=windPoint(w,edge+6,side+swirl*3);
    const height=(cooling?5:12+4*swirl)*fade;
    g.fillStyle(0xdf612b,fade*.83).fillTriangle(heel.x,heel.y,foot.x,foot.y+2,nose.x,nose.y-height);
    g.lineStyle(1.8,0xffdc89,fade).lineBetween(foot.x,foot.y,nose.x,nose.y-height*.63);
  }
}
