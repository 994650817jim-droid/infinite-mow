import type Phaser from 'phaser';
import { mythicBoss, type MythicTier, type MythicWarning } from '../data/mythicGauntlet';

const DIRECTIONS = ['ghost','divine'] as const;
const STAMPS = ['trail','impact'] as const;
type Stamp = typeof STAMPS[number];
const stampKey = (tier: MythicTier, shape: Stamp) => 'mythic_telegraph_'+tier+'_'+shape;
const fieldArt = new WeakMap<Phaser.GameObjects.Graphics,{ images: Phaser.GameObjects.Image[]; used: number }>();

export function preloadMythicTelegraph(scene: Phaser.Scene): void {
  for (const tier of DIRECTIONS) {
    for (const shape of STAMPS) {
      const key = stampKey(tier,shape);
      if (!scene.textures.exists(key)) scene.load.image(key,'assets/mythic-gauntlet/telegraph-'+tier+'-'+shape+'.png');
    }
  }
}

export function clearMythicWarning(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
  const art = fieldArt.get(graphics);
  if (!art) return;
  for (let i=0;i<art.used;i++) art.images[i].setVisible(false);
  art.used=0;
}

function stamp(g: Phaser.GameObjects.Graphics, tier: MythicTier, shape: Stamp, x: number, y: number,
  width: number, height: number, rotation: number, alpha: number): void {
  const key = stampKey(tier,shape);
  if (!g.scene.textures.exists(key)) return;
  let art = fieldArt.get(g);
  if (!art) {
    art={images:[],used:0};
    const images=art.images;
    g.once('destroy',() => { for (const image of images) image.destroy(); fieldArt.delete(g); });
    fieldArt.set(g,art);
  }
  if (art.used>=8) return;
  const image = art.images[art.used] ?? g.scene.add.image(0,0,key);
  art.images[art.used++]=image;
  if (image.texture.key!==key) image.setTexture(key);
  if (image.depth!==g.depth-.1) image.setDepth(g.depth-.1);
  image.setPosition(x,y).setDisplaySize(width,height).setRotation(rotation).setAlpha(alpha).setVisible(true);
}

/** Subtle anchor pixels along both sides. No continuous closed border. */
function drawLane(g: Phaser.GameObjects.Graphics,w: MythicWarning,angle: number,color: number,amount: number,age: number): void {
  const length=w.radius, half=w.halfWidth??25;
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const x=(along: number,side: number) => w.x+dx*along-dy*side;
  const y=(along: number,side: number) => w.y+dy*along+dx*side;
  stamp(g,w.mythic,'trail',x(length*.5,0),y(length*.5,0),length,half*2,angle,amount);
  // Short paths suggest the exact danger corridor without framing or flooding it.
  const count=Math.min(6,Math.max(3,Math.round(length/50)));
  for(let i=0;i<count;i++){
    const along=length*(i+.7)/(count+.45);
    const side=(i%2===0?1:-1)*half;
    const end=Math.min(length,along+length*.065);
    g.lineStyle(2.6,0x201610,amount*.62).lineBetween(x(along,side),y(along,side),x(end,side*.44),y(end,side*.44));
    g.lineStyle(1.3,color,amount*.82).lineBetween(x(along,side),y(along,side),x(end,side*.44),y(end,side*.44));
    g.lineStyle(1.8,color,amount*.58).lineBetween(x(along,0),y(along,0),x(end,0),y(end,0));
  }
  const tip=length;
  const back=Math.min(16,half);
  g.lineStyle(2.1,color,amount*.96)
    .lineBetween(x(tip,0),y(tip,0),x(tip-back,half*.41),y(tip-back,half*.41))
    .lineBetween(x(tip,0),y(tip,0),x(tip-back,-half*.36),y(tip-back,-half*.36));
  g.fillStyle(color,amount*.88).fillCircle(x(tip,0),y(tip,0),1.7)
    .fillCircle(x(tip,half),y(tip,half),1.2).fillCircle(x(tip,-half),y(tip,-half),1.2);
  if(w.resolved) {
    // A brief, fading afterglow on each actual lane. The server/solo strike still resolves once.
    const intensity = Math.max(0,1-age/.19);
    for(const side of [-.55,0,.55]){
      g.lineStyle(side===0?2.2:1.2,color,amount*intensity*(side===0?.92:.55))
        .lineBetween(x(length*.04,half*side),y(length*.04,half*side),x(length*.98,half*side),y(length*.98,half*side));
    }
  }
}

function arcMarks(g: Phaser.GameObjects.Graphics,x: number,y: number,radius: number,from: number,arc: number,count: number,
  fraction: number,width: number,color: number,alpha: number): void {
  const step=arc/count;
  g.lineStyle(width,color,alpha);
  for(let index=0;index<count;index++){
    const a=from+index*step;
    g.beginPath().arc(x,y,radius,a,a+step*fraction).strokePath();
  }
}

function drawGroundMarks(g: Phaser.GameObjects.Graphics,w: MythicWarning,color: number,amount: number,progress: number): void {
  const {x,y,radius,angle}=w;
  if(w.kind==='sweep'){
    const arc=Math.PI*2/3;
    const start=angle-arc/2;
    for(const [r,width,alpha,fraction] of [[1,2,.8,.38],[.68,1.5,.5,.65],[.45,1,.44,.46]]) {
      arcMarks(g,x,y,radius*r,start+arc*.05,arc*.9,4,fraction,width,color,amount*alpha);
    }
    // The outer arc and two short tips show the true limits of the 120-degree sweep.
    g.lineStyle(1.5,color,amount*.76);
    for(const edge of [start,start+arc]) {
      const dx=Math.cos(edge)*radius,dy=Math.sin(edge)*radius;
      g.lineBetween(x+dx*.90,y+dy*.90,x+dx,y+dy);
    }
    // Strike direction at the leading edge, sized so the visual stays inside the sector.
    const r=radius*(.20+progress*.16);
    stamp(g,w.mythic,'impact',x+Math.cos(angle)*r,y+Math.sin(angle)*r,radius*.42,radius*.42,angle,amount*.62);
    return;
  }
  const inner=w.innerRadius??0;
  const band=radius-inner;
  if(w.kind==='ring'){
    arcMarks(g,x,y,radius,angle,Math.PI*2,11,.32,2,color,amount*.8);
    arcMarks(g,x,y,inner,angle+.11,Math.PI*2,11,.44,1.5,color,amount*.74);
    for(let i=0;i<4;i++){
      const a=angle+Math.PI*.5*i;
      const reach=inner+band*.5;
      stamp(g,w.mythic,'impact',x+Math.cos(a)*reach,y+Math.sin(a)*reach,band*.78,band*.78,a,amount*.68);
    }
    return;
  }
  arcMarks(g,x,y,radius,angle,Math.PI*2,8,.28,1.6,color,amount*.75);
  stamp(g,w.mythic,'impact',x,y,radius*1.22,radius*1.22,angle,amount*(.54+progress*.22));
}

export function drawMythicWarning(g: Phaser.GameObjects.Graphics,w: MythicWarning,id: string,now: number): void {
  const progress=Math.max(0,Math.min(1,(now-w.startsAt)/Math.max(.01,w.endsAt-w.startsAt)));
  const fade=Math.max(0,1-(now-w.endsAt)/.32);
  const amount=w.resolved?.48+fade*.49:.66+progress*.31;
  const accent=mythicBoss(id)?.ink??(w.mythic==='ghost'?0x84d9c8:0xe5c285);
  // Keep a bright ochre cue in the wind-up, so danger stays readable on either terrain.
  const color=w.resolved ? accent : progress>.72 ? 0xffc384 : 0xff9c65;
  if(w.kind==='line'){
    const lanes=w.lanes??1;
    for(let i=0;i<lanes;i++) drawLane(g,w,w.angle+(i-(lanes-1)/2)*(w.spread??0),color,amount,Math.max(0,now-w.endsAt));
  } else drawGroundMarks(g,w,color,amount,progress);
}
