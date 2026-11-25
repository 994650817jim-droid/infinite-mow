import type Phaser from 'phaser';
import { DEPTH } from '../config';

export type ImpactShape =
  | { kind: 'lane'; x: number; y: number; angle: number; len: number; width: number }
  | { kind: 'sector'; x: number; y: number; angle: number; arc: number; r: number }
  | { kind: 'circle'; x: number; y: number; r: number; inner?: number };

type GroundLayer = Phaser.GameObjects.Graphics;
const layers = new WeakMap<Phaser.Scene, GroundLayer[]>();

/** Large release accents share a small pool. The painted sprites still play during busy volleys. */
export function borrowBossImpact(scene: Phaser.Scene): GroundLayer | undefined {
  let pool = layers.get(scene);
  if (!pool) {
    pool = [];
    layers.set(scene, pool);
    scene.events.once('shutdown', () => layers.delete(scene));
  }
  let layer = pool.find(g => !g.visible);
  if (!layer && pool.length < 8) {
    layer = scene.add.graphics().setDepth(DEPTH.enemy - 1).setName('boss-impact-accent');
    pool.push(layer);
  }
  return layer?.setVisible(true);
}

export function releaseBossImpact(layer: GroundLayer): void { layer.clear().setVisible(false); }

function crescent(g: GroundLayer, x: number, y: number, r: number, from: number, to: number, width: number): void {
  const points: Array<{x:number;y:number}> = [];
  const steps = 12;
  for (let i=0;i<=steps;i++) {
    const angle=from+(to-from)*i/steps;
    points.push({x:x+r*Math.cos(angle),y:y+r*Math.sin(angle)});
  }
  for (let i=steps;i>=0;i--) {
    const t=i/steps, angle=from+(to-from)*t;
    const inner=r-width*Math.sin(Math.PI*t)**.82;
    points.push({x:x+inner*Math.cos(angle),y:y+inner*Math.sin(angle)});
  }
  g.fillPoints(points,true);
}

/** Bright at release, then broken into small fragments. All marks stay within the strike. */
export function drawBossImpact(g: GroundLayer, s: ImpactShape, ink: number, light: number, progress: number): void {
  if (progress < 0 || progress >= 1) return;
  const fade = (1 - progress) ** 1.4;
  const hot = Math.max(0, 1 - progress * 2.7);
  const { x, y } = s;
  if (s.kind === 'lane') {
    const { angle, len, width } = s, half = width / 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const point = (along: number, side: number) => ({ x: x + dx * along - dy * side, y: y + dy * along + dx * side });
    const lobe = len * (.37 + progress * .38);
    g.fillStyle(0x201815, fade * .62).fillPoints([point(len*.025,0),point(lobe,-half*.88),point(len,0),point(lobe,half*.88)],true);
    g.fillStyle(ink, fade * .74).fillPoints([point(len*.04,0),point(lobe,-half*.59),point(len*.993,0),point(lobe,half*.54)],true);
    g.fillStyle(light, hot * .92).fillPoints([point(len*.10,0),point(lobe,-half*.18),point(len*.99,0),point(lobe,half*.11)],true);
    for (let i=0;i<4;i++) {
      const at = len * (.22 + i*.17 + progress*.059);
      const side = Math.min(half*.84,half*(.44+progress*.39)) * (i%2===0?-1:1);
      const a = point(at-len*.07,side*.64), b = point(at,side), c = point(at-len*.025,side*.93);
      g.fillStyle(i%2===0?light:ink,fade*.85).fillTriangle(a.x,a.y,b.x,b.y,c.x,c.y);
    }
    return;
  }
  if (s.kind === 'sector') {
    const start = s.angle - s.arc / 2;
    for (let i=0;i<3;i++) {
      const r = s.r*(.88-i*.18+progress*.06);
      const a = start+s.arc*(.04+i*.085+progress*.25);
      const b = start+s.arc*(.97-i*.09);
      const thickness=s.r*(.19-i*.061);
      g.fillStyle(0x241711,fade*.75);
      crescent(g,x,y,r,a,b,thickness);
      g.fillStyle(ink,fade*.95);
      crescent(g,x,y,r-1,a+s.arc*.02,b,thickness*.74);
      g.fillStyle(light,hot*.98);
      crescent(g,x,y,r-2,a+s.arc*.09,b,thickness*.30);
    }
    for (let i=0;i<6;i++) {
      const a=start+s.arc*(.10+i*.15), dx=Math.cos(a), dy=Math.sin(a);
      const r=s.r*(.65+.27*progress+(i%2)*.06), tip=Math.min(s.r,r+s.r*.045);
      g.fillStyle(i%2?ink:light,fade*.76).fillTriangle(
        x+dx*tip,y+dy*tip,x+dx*r-dy*1.8,y+dy*r+dx*1.8,x+dx*(r-7),y+dy*(r-7));
    }
    return;
  }
  const inner = s.inner ?? 0, band = s.r - inner, count = inner > 0 ? 10 : 8;
  for (let i=0;i<count;i++) {
    const a=(i+.25)*Math.PI*2/count;
    const dx=Math.cos(a), dy=Math.sin(a);
    const r=inner+band*(.29+progress*.50+(i%3)*.065);
    const knee=inner+band*(.15+progress*.28), root=inner+band*.08;
    const mx=x+dx*knee-dy*band*.11, my=y+dy*knee+dx*band*.11;
    const ax=x+dx*root, ay=y+dy*root, bx=x+dx*r, by=y+dy*r;
    g.lineStyle(4.5,0x241711,fade*.68).beginPath().moveTo(ax,ay).lineTo(mx,my).lineTo(bx,by).strokePath();
    g.lineStyle(2.2,ink,fade*.95).beginPath().moveTo(ax,ay).lineTo(mx,my).lineTo(bx,by).strokePath();
    g.lineStyle(1.15,light,hot).lineBetween(mx,my,bx,by);
    const tip=inner+band*(.64+progress*.29);
    g.fillStyle(i%2?ink:light,fade*.9).fillTriangle(x+dx*tip,y+dy*tip,bx-dy*2,by+dx*2,bx+dy*2,by-dx*2);
    if (inner > 0) {
      const edge = inner+band*(.1+progress*.78);
      g.lineStyle(2.5,ink,fade*.9).beginPath().arc(x,y,edge,a+.02,a+.37).strokePath();
      g.lineStyle(1.2,light,hot*.95).beginPath().arc(x,y,edge,a+.08,a+.30).strokePath();
    }
  }
  if (inner===0) {
    const size = band * (.12 + .24*progress);
    g.fillStyle(ink,fade*.8).fillPoints([
      {x:x-size,y},{x,y:y-size*1.36},{x:x+size,y},{x,y:y+size*.56},
    ],true);
    g.fillStyle(light,hot).fillPoints([
      {x:x-size*.62,y},{x,y:y-size*1.08},{x:x+size*.62,y},{x,y:y+size*.38},
    ],true);
  }
}
