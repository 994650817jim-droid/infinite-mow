import type Phaser from 'phaser';
import {shadowPosition} from '../data/ghostZhangxiu';
import {mythicArtKey,type MythicWarning} from '../data/mythicGauntlet';

const doubles=new WeakMap<Phaser.GameObjects.Graphics,Phaser.GameObjects.Image>();
export function hideSpearDouble(g:Phaser.GameObjects.Graphics):void { doubles.get(g)?.setVisible(false); }
export function drawSpearShadow(g:Phaser.GameObjects.Graphics,marks:Phaser.GameObjects.Graphics,w:MythicWarning,now:number):void{
  const field=w.shadow;
  if(!field||field.folded)return;
  const p=shadowPosition(w,now,true);if(!p)return;
  const c=Math.cos(w.angle),s=Math.sin(w.angle),row=Math.abs(c)>Math.abs(s)?(c<0?1:2):(s<0?3:0);
  const key=mythicArtKey('ghost_zhangxiu','attack');
  if(g.scene.textures.exists(key)){
    let double=doubles.get(g);
    if(!double){
      double=g.scene.add.image(0,0,key);
      doubles.set(g,double);const owned=double;g.once('destroy',()=>owned.destroy());
    }
    double.setTexture(key,row*3+(now>=field.launchAt?1:0)).setOrigin(.5,208/232)
      .setPosition(p.x,p.y-5-Math.sin(now*7)*3).setDisplaySize(165,165).setDepth(45)
      .setTint(0x9e9cdd).setAlpha(w.resolved?.22:.53).setVisible(true);
  }
  // The floating silhouette only leaves pale hanging wisps. All dust and furrows belong to the planted foot.
  for(let i=0;i<5;i++){
    const d=(i+.5)*w.radius/5;
    const x=field.fake.x+c*d,y=field.fake.y+s*d-4;
    g.lineStyle(1.4,0xa7a8da,.48).lineBetween(x,y,x+c*10,y+s*10-2);
  }
  if(now<field.plantAt)return;
  const age=now-field.plantAt, ink=0xeac794;
  for(let i=0;i<9;i++){
    const a=2*Math.PI*i/9+.2,spread=12+Math.min(age,.48)*(28+i%3*15);
    const x=w.x+Math.cos(a)*spread,y=w.y+Math.sin(a)*spread*.44;
    marks.fillStyle(i%2?0xcaa473:0xf8e1ba,Math.max(.18,.82-age*.75))
      .fillEllipse(x,y-Math.min(6,age*9),3+i%3*2,2+i%2*2);
  }
  for(let i=0;i<4;i++){
    const d=14+i*Math.min(w.radius*.2,43),x=w.x+c*d,y=w.y+s*d;
    marks.lineStyle(3.5,0x3f3737,.85).lineBetween(x-c*9,y-s*9,x+c*6,y+s*6);
    marks.lineStyle(1.7,ink,.9).lineBetween(x-c*8,y-s*8,x+c*5,y+s*5)
      .lineBetween(x+c*5,y+s*5,x-c*2-s*3,y-s*2+c*3);
  }
}
