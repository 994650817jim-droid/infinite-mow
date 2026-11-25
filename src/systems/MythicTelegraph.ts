import {drawZhouyuWind} from './ZhouyuWindArt';
import type Phaser from 'phaser';
import {drawWeiRanks,hideWeiRanks} from './WeiFormationArt';
import {weiPoint} from '../data/divineCaocao';
import { drawBossImpact } from './BossImpactMarks';
import { mythicBoss, type MythicTier, type MythicWarning } from '../data/mythicGauntlet';

const DIRECTIONS = ['ghost','divine'] as const;
const STAMPS = ['trail','impact'] as const;
type GroundWarning = Pick<MythicWarning, 'x'|'y'|'angle'|'radius'|'kind'|'halfWidth'|'innerRadius'|'lanes'|'spread'> & { mythic?: MythicTier };
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
  hideWeiRanks(graphics);
  spiritActors.get(graphics)?.setVisible(false);
  warningAccents.get(graphics)?.clear();
  graphics.clear();
  const art = fieldArt.get(graphics);
  if (!art) return;
  for (let i=0;i<art.used;i++) art.images[i].setVisible(false);
  art.used=0;
}

function stamp(g: Phaser.GameObjects.Graphics, tier: MythicTier | undefined, shape: Stamp, x: number, y: number,
  width: number, height: number, rotation: number, alpha: number): void {
  if (!tier) return;
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
function drawLane(g: Phaser.GameObjects.Graphics,w: GroundWarning,angle: number,color: number,amount: number): void {
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

function drawGroundMarks(g: Phaser.GameObjects.Graphics,w: GroundWarning,color: number,amount: number,progress: number): void {
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

/** Upright lightning or starfall above the target. Ground marks still show the actual footprint. */
function drawSkyImpact(g: Phaser.GameObjects.Graphics, w: MythicWarning, id: string, color: number, age: number): void {
  const fade = Math.max(0,1-age*1.45);
  if (!fade) return;
  const {x,y,radius} = w;
  const height = Math.min(208, radius*3.15);
  if (id === 'ghost_zhangjiao') {
    const points = [[-.21,-1],[-.27,-.78],[.16,-.64],[-.06,-.42],[.13,-.30],[0,0]];
    for (const [width,ink,alpha] of [[12,0x241632,.76],[7,color,.85],[2.6,0xffedff,1]]) {
      g.lineStyle(width,ink,alpha*fade).beginPath();
      g.moveTo(x+points[0][0]*radius,y+points[0][1]*height);
      for (const [dx,dy] of points.slice(1)) g.lineTo(x+dx*radius,y+dy*height);
      g.strokePath();
    }
    for (const [side,branch] of [[-1,.47],[1,.66]]) {
      g.lineStyle(2.1,color,.88*fade).beginPath().moveTo(x,y-height*branch)
        .lineTo(x+side*radius*.31,y-height*(branch-.08))
        .lineTo(x+side*radius*.61,y-height*(branch-.10)).strokePath();
    }
  } else {
    // A falling star shatters into smaller gold and violet fragments over the focal point.
    for (let i=-2;i<=2;i++) {
      const dx=i*radius*.27, dy=-height*(.76-.14*Math.abs(i)), size=(i===0?7:4)*(1+age*.5);
      const tipX=x+dx*(.58+age*.25), tipY=y+dy*(.28+age*.46);
      g.lineStyle(i===0?5:3,color,.83*fade).lineBetween(x+dx,y+dy,tipX,tipY);
      g.lineStyle(1.2,0xffefd3,fade).lineBetween(x+dx,y+dy,tipX,tipY);
      g.fillStyle(0xffeec8,fade).fillPoints([{x:tipX-size,y:tipY},{x:tipX,y:tipY-size*1.7},
        {x:tipX+size,y:tipY},{x:tipX,y:tipY+size*1.4}],true);
    }
  }
}

export function drawMortalWarning(g: Phaser.GameObjects.Graphics, w: GroundWarning & { startsAt?: number; endsAt: number; resolved: boolean }, now: number): void {
  const start = w.startsAt ?? w.endsAt - .9;
  const progress = Math.max(0, Math.min(1, (now - start) / Math.max(.01, w.endsAt - start)));
  const ink = progress < .72 ? 0xf19c68 : 0xffc384;
  const amount = .76 + .24 * progress;
  const age = Math.max(0, now - w.endsAt) / .32;
  const {x, y, radius, angle} = w;
  if (w.kind === 'line') {
    const count = w.lanes ?? 1;
    for (let i=0; i<count; i++) {
      const heading = angle + (i - (count-1)/2) * (w.spread ?? 0);
      if (w.resolved) drawBossImpact(g,{kind:'lane',x,y,angle:heading,len:radius,width:(w.halfWidth??25)*2},ink,0xffe9af,age);
      else drawLane(g,w,heading,ink,amount);
    }
  } else if (!w.resolved) {
    drawGroundMarks(g,w,ink,amount,progress);
    if (w.kind === 'circle') g.lineStyle(2,ink,amount).lineBetween(x-5,y,x+5,y).lineBetween(x,y-5,x,y+5);
    if (w.kind === 'ring') {
      const inner=w.innerRadius??0;
      arcMarks(g,x,y,(radius+inner)/2,angle,2*Math.PI,12,.45,Math.max(1,(radius-inner)*.55),ink,.18*amount);
    }
  } else if (w.kind === 'sweep') drawBossImpact(g,{kind:'sector',x,y,angle,r:radius,arc:Math.PI*2/3},ink,0xffe9af,age);
  else drawBossImpact(g,{kind:'circle',x,y,r:radius,inner:w.innerRadius},ink,0xffe9af,age);
}

const warningAccents = new WeakMap<Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics>();

function accentLayer(g: Phaser.GameObjects.Graphics) {
  let layer = warningAccents.get(g);
  if (!layer) {
    layer = g.scene.add.graphics().setDepth(46);
    warningAccents.set(g, layer);
    const owned = layer;
    g.once('destroy', () => owned.destroy());
  }
  return layer;
}

// Small notches remain visible through crowds without painting over the entire battlefield.
function edgeNotches(g: Phaser.GameObjects.Graphics, w: GroundWarning, color: number, alpha: number) {
  const line = w.kind === 'line';
  const radii = w.kind === 'ring' ? [w.radius,w.innerRadius ?? 0] : [w.radius];
  const count = line ? (w.lanes ?? 1)*4 : w.kind === 'sweep' ? 5 : 8;
  for (const r of radii) for (let i=0;i<count;i++) {
    const a = line ? w.angle+(Math.floor(i/4)-((w.lanes??1)-1)/2)*(w.spread??0)
      : w.angle+(w.kind==='sweep' ? (i/4-.5)*Math.PI*2/3 : i*Math.PI/4);
    const reach=line ? r*(i%4<2?.48:.92) : r;
    const side=line ? (i%2?1:-1)*(w.halfWidth??25) : 0;
    const dx=Math.cos(a),dy=Math.sin(a),x=w.x+dx*reach-dy*side,y=w.y+dy*reach+dx*side;
    g.lineStyle(4,0x241821,alpha).lineBetween(x,y,x-dx*7,y-dy*7);
    g.lineStyle(2,color,alpha).lineBetween(x,y,x-dx*7,y-dy*7);
  }
}

const spiritActors = new WeakMap<Phaser.GameObjects.Graphics,Phaser.GameObjects.Image>();
function drawSpirit(g:Phaser.GameObjects.Graphics,w:MythicWarning,now:number) {
  if(!w.spirit)return;
  const blade=w.spirit==='guanyu', ink=blade?0xa4dfc5:0xecc38b;
  if(w.nextFlag)g.lineStyle(2,0x786656,.78).lineBetween(w.nextFlag.x,w.nextFlag.y,w.nextFlag.x,w.nextFlag.y-18);
  g.lineStyle(2,ink,.9).lineBetween(w.x,w.y,w.x,w.y-30);
  g.fillStyle(ink,.85).fillTriangle(w.x,w.y-30,w.x+14,w.y-27,w.x,w.y-20);
  const key='mythic_divine_'+w.spirit+'_walk';
  if(!g.scene.textures.exists(key))return;
  let actor=spiritActors.get(g);
  if(!actor){
    actor=g.scene.add.image(0,0,key);
    spiritActors.set(g,actor);
    const owned=actor;
    g.once('destroy',()=>owned.destroy());
  }
  const dx=Math.cos(w.face),dy=Math.sin(w.face);
  const row=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
  const step=Math.min(3,Math.floor(Math.max(0,now-w.startsAt)*4));
  actor.setTexture(key,row*4+step).setOrigin(.5,.8).setDisplaySize(85,85).setPosition(w.x,w.y)
    .setTint(ink).setDepth(g.depth+1).setAlpha(w.resolved?.84:.54).setVisible(true);
}
export function drawMythicWarning(g: Phaser.GameObjects.Graphics,w: MythicWarning,id: string,now: number): void {
  if(w.wind){drawZhouyuWind(g,w,now);return;}
  if(w.wei){
    drawWeiRanks(g,w,now);
    if(w.wei.stance==='bow')for(const side of w.wei.lanes){
      const lane={...w,...weiPoint(w,0,side),wei:undefined,lanes:1};
      drawMythicWarning(g,lane,id,now);
    }
    return;
  }
  const progress=Math.max(0,Math.min(1,(now-w.startsAt)/Math.max(.01,w.endsAt-w.startsAt)));
  const h=w.halberd;
  if(h && now>=h.appears){
    const x=h.x,y=h.y,solid=now>=h.solid;
    if(h.broken){
      const left=Math.max(0,(h.recoverUntil-now)/3.2);
      g.lineStyle(3,0xb4eedc,.85).lineBetween(x-11,y+2,x-4,y-4).lineBetween(x+3,y,x+12,y-7);
      g.lineStyle(3,0xaaffd7,.85).beginPath().arc(x,y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*left).strokePath();
      return;
    }
    g.lineStyle(solid?3:2,solid?0xffe9ac:0xacb3bb,solid?.95:.5)
      .strokeEllipse(x,y,34,12).lineBetween(x-4,y+1,x+5,y-30)
      .lineBetween(x+5,y-30,x+8,y-39).lineBetween(x+5,y-26,x+17,y-32).lineBetween(x+17,y-32,x+16,y-37);
    if(w.charge && (!h.locked || w.resolved))return;
  }
  drawSpirit(g,w,now);
  const field=w.constellation;
  if (field) {
    if (w.closing && field.broken) return;
    for(let i=0;i<7;i++){
      const a=field.rotation+i*2*Math.PI/7;
      const x=field.center.x+Math.cos(a)*field.radius,y=field.center.y+Math.sin(a)*field.radius;
      const lit=i===0 && !field.broken && field.hp>0 && now>=field.opens && now<field.closes;
      const color=lit?0xffe8a5:0xa49bc9, size=lit?10:3;
      g.lineStyle(lit?3:1,color,lit?1:.66).lineBetween(x-size,y,x+size,y).lineBetween(x,y-size,x,y+size);
      if(lit)g.lineStyle(1,0xffdc85,1).strokeCircle(x,y,13).fillStyle(color,1).fillRect(x-6,y-19,field.hp*6,2);
    }
  }
  if (w.transit?.harmless) {
    for(let i=1;i<6;i++){
      const f=i/6;
      g.fillStyle(0xa3c6d2,.45).fillCircle(w.x+(w.transit.to.x-w.x)*f,w.y+(w.transit.to.y-w.y)*f,2);
    }
    return;
  }
  const scar=w.scar;
  if (scar && now>=scar.createdAt && now<scar.lightsAt) {
    if (scar.kind==='line') {
      const dx=Math.cos(scar.angle),dy=Math.sin(scar.angle);
      g.lineStyle(2,0x475856,.72);
      for (let i=0;i<6;i++) {
        const start=scar.radius*i/6,end=start+scar.radius*.085;
        g.lineBetween(scar.x+dx*start,scar.y+dy*start,scar.x+dx*end,scar.y+dy*end);
      }
    }
    else arcMarks(g,scar.x,scar.y,scar.radius,scar.angle-Math.PI/3,Math.PI*2/3,9,.46,2,0x638986,.6);
    if (w.retracesScar) return;
  }
  if (!w.resolved) edgeNotches(accentLayer(g),w,w.retracesScar?0x9ffff0:0xffdeb0,.90);
  const warming = w.retracesScar ? 0xabfff1 : progress>.72 ? 0xffc384 : 0xff9c65;
  const lanes = w.lanes ?? 1;
  if (!w.resolved) {
    const amount = .66+progress*.31;
    if (w.kind==='line') {
      for (let i=0;i<lanes;i++) drawLane(g,w,w.angle+(i-(lanes-1)/2)*(w.spread??0),warming,amount);
    } else drawGroundMarks(g,w,warming,amount,progress);
    return;
  }
  const age = Math.max(0,now-w.endsAt) / .32;
  const {x,y,radius,angle} = w;
  const ink = mythicBoss(id)?.ink ?? (w.mythic==='ghost'?0x84d9c8:0xe5c285);
  const light = w.mythic==='ghost' ? 0xd4f4ec : 0xfff0c9;
  if (w.kind==='line') {
    for (let i=0;i<lanes;i++) {
      const heading = angle+(i-(lanes-1)/2)*(w.spread??0);
      drawBossImpact(g,{kind:'lane',x,y,angle:heading,len:radius,width:(w.halfWidth??25)*2},ink,light,age);
    }
  } else if (w.kind==='sweep') drawBossImpact(g,{kind:'sector',x,y,r:radius,angle,arc:Math.PI*2/3},ink,light,age);
  else {
    drawBossImpact(g,{kind:'circle',x,y,r:radius,inner:w.innerRadius},ink,light,age);
    if (w.kind==='circle'&&(id==='ghost_zhangjiao'||id==='divine_zhugeliang')) drawSkyImpact(g,w,id,ink,age);
  }
}
