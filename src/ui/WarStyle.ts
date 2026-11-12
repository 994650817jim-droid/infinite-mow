import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
export const WAR = { ink: 0x10221b, wood: 0x302c20, gold: 0xc7aa6a, jade: 0x74ad97, muted: 0x849b87, cream: '#eee4ca', danger: 0xbf6550 } as const;
export function warText(size: number, color: string = WAR.cream) { return { fontFamily: size>=20?HEADING_FONT:FONT, fontSize: `${size}px`, color, resolution: 2, stroke: '#111710', strokeThickness: 1 }; }
/** Draw only on state changes, never from a per-frame animation. Pixel-cut corners and subtle wood grain. */
export function warFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, accent: number = WAR.gold, fill = true): void {
  const cut = 5;
  const points = [{x:x+cut,y},{x:x+w-cut,y},{x:x+w,y:y+cut},{x:x+w,y:y+h-cut},{x:x+w-cut,y:y+h},{x:x+cut,y:y+h},{x,y:y+h-cut},{x,y:y+cut}];
  if (fill) g.fillStyle(WAR.ink,.96).fillPoints(points,true);
  g.lineStyle(1,accent,.6).strokePoints(points,true);
  g.lineStyle(1,WAR.jade,.055);
  for (let gy=y+12;gy<y+h-5;gy+=14) g.lineBetween(x+7,gy,x+w-7,gy);
  for (const cx of [x+3,x+w-3]) for (const cy of [y+3,y+h-3]) {
    const sx=cx<x+w/2?1:-1,sy=cy<y+h/2?1:-1;
    g.lineStyle(2,accent,.9).lineBetween(cx,cy,cx+sx*10,cy).lineBetween(cx,cy,cx,cy+sy*10);
  }
}
/** Runtime-generated presentation textures; original artwork is preserved. */
export function ensureWarTextures(scene: Phaser.Scene): void {
  if(!scene.textures.exists('icon_guandao')) {
    const g=scene.make.graphics({x:0,y:0});
    g.fillStyle(0x1e382b).fillCircle(32,32,28).lineStyle(2,0x9fbd87).strokeCircle(32,32,27);
    g.lineStyle(5,0x17251e).lineBetween(15,51,39,18);
    g.lineStyle(3,0xc0a771).lineBetween(15,51,39,18);
    g.fillStyle(0xc9dfbf).fillPoints([{x:35,y:19},{x:40,y:8},{x:51,y:10},{x:54,y:17},{x:51,y:27},{x:43,y:34},{x:45,y:24}],true);
    g.lineStyle(2,0xf1efd1).lineBetween(40,9,51,11).lineBetween(51,11,53,17);
    g.fillStyle(0x76a482).fillRect(37,21,7,4).fillStyle(0xd7bc7e).fillRect(33,26,6,3);
    g.generateTexture('icon_guandao',64,64);g.destroy();
    scene.textures.get('icon_guandao').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for (const [key,w,h,accent] of [['ui_war_card',600,148,WAR.gold],['ui_war_panel',600,480,WAR.jade],['ui_war_button',360,64,WAR.gold]] as const) {
    if(scene.textures.exists(key))continue;
    if(scene.textures.exists('art_panel')) {
      const source=scene.textures.get('art_panel').getSourceImage() as HTMLImageElement;
      const canvas=scene.textures.createCanvas(key,w,h)!;
      const ctx=canvas.context;ctx.imageSmoothingEnabled=false;
      const sw=source.width,sh=source.height,edge=Math.round(sw*.11),b=key==='ui_war_button'?10:16;
      const sx=[0,edge,sw-edge],sy=[0,edge,sh-edge],ssx=[edge,sw-edge*2,edge],ssy=[edge,sh-edge*2,edge];
      const dx=[0,b,w-b],dy=[0,b,h-b],dw=[b,w-b*2,b],dh=[b,h-b*2,b];
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)ctx.drawImage(source,sx[col],sy[row],ssx[col],ssy[row],dx[col],dy[row],dw[col],dh[row]);
      if(key==='ui_war_button'){ctx.fillStyle='rgba(197,162,83,0.88)';ctx.fillRect(b,b,w-b*2,h-b*2);}
      canvas.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);continue;
    }
    const g=scene.make.graphics({x:0,y:0});
    warFrame(g,1,1,w-2,h-2,accent);
    if(key==='ui_war_button')g.fillStyle(WAR.gold,.95).fillRect(7,7,w-14,h-14).lineStyle(1,0xf3dda4,.7).strokeRect(10,10,w-20,h-20);
    g.generateTexture(key,w,h);g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
