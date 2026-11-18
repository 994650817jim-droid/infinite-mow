import {propDisplaySize,mayMirrorProp} from '../data/sceneArt';
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { ChapterId } from '../data/chapters';

/** Decorative only. Deterministic world cells, bounded image pool, no combat RNG or colliders. */
export interface BattlefieldProp {key:string;x:number;y:number;frame:number;size:number;flip:boolean;texture?:'art_props';}
export class BattlefieldDetails {
  readonly props:BattlefieldProp[]=[];
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly quietPatches: Phaser.GameObjects.Image[] = [];
  private cellX = Infinity;
  private cellY = Infinity;
  private readonly cellSize = 224;
  private readonly columns = Math.ceil(GAME_WIDTH / this.cellSize) + 2;
  private readonly rows = Math.ceil(GAME_HEIGHT / this.cellSize) + 2;
  constructor(private readonly scene: Phaser.Scene, private readonly chapter: ChapterId,private readonly stage?:1|2|3,groundKey?:string) {
    this.makeTextures();
    const key=`quiet_soil_${chapter}_${stage??0}`;
    if(!scene.textures.exists(key)){
      const texture=scene.textures.createCanvas(key,128,128)!,ctx=texture.context;
      const source=scene.textures.get(groundKey??(stage?`yellow_ground_${stage}`:chapter==='huangjin'?'ground_overhaul_huangjin':'ground_overhaul_hulao')).getSourceImage() as HTMLImageElement;
      const sample=document.createElement('canvas');sample.width=source.width;sample.height=source.height;const sc=sample.getContext('2d')!;sc.drawImage(source,0,0);
      const pixels=sc.getImageData(0,0,sample.width,sample.height).data,palette:number[][]=[];
      for(let i=0;i<pixels.length&&palette.length<512;i+=44)if(pixels[i]>pixels[i+1]*1.22&&pixels[i+1]>pixels[i+2]*1.25)palette.push([pixels[i],pixels[i+1],pixels[i+2]]);
      const average=palette.length?[0,1,2].map(c=>Math.round(palette.reduce((sum,p)=>sum+p[c],0)/palette.length)):[140,110,70];
      if(palette.length)for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){
        const r=Math.hypot((x-64)/64,(y-64)/60),edge=Math.max(0,Math.min(1,(1-r)*3)),variation=this.hash(x>>2,y>>2,11)%3-1,color=average.map(c=>c+variation);
        ctx.fillStyle=`rgba(${color.join(',')},${Math.floor(edge*16)/16*.35})`;ctx.fillRect(x,y,2,2);
      }
      texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const quietCount=(Math.ceil(GAME_WIDTH/672)+2)*(Math.ceil(GAME_HEIGHT/672)+2);
    for(let i=0;i<quietCount;i++)this.quietPatches.push(scene.add.image(0,0,key).setDepth(DEPTH.ground+.2).setDisplaySize(460,350));
    for (let i=0;i<this.columns*this.rows*2;i++) {
      this.images.push(scene.add.image(0,0,`field_${chapter}_0`).setDepth(DEPTH.ground+1).setAlpha(.7));
    }
  }
  private structured=false;
  useStructuredLayout():void {this.structured=true;this.props.length=0;for(const image of [...this.images,...this.quietPatches])image.setVisible(false);}
  update(scrollX: number, scrollY: number): void {
    if(this.structured)return;
    const cx=Math.floor(scrollX/this.cellSize)-1,cy=Math.floor(scrollY/this.cellSize)-1;
    if(cx===this.cellX&&cy===this.cellY)return;
    this.cellX=cx;this.cellY=cy;this.props.length=0;
    let qi=0;
    const mx=Math.floor(scrollX/672)-1,my=Math.floor(scrollY/672)-1;
    for(let row=0;row<Math.ceil(GAME_HEIGHT/672)+2;row++)for(let col=0;col<Math.ceil(GAME_WIDTH/672)+2;col++){
      const x=mx+col,y=my+row,h=this.hash(x,y,13);
      this.quietPatches[qi++].setPosition(x*672+220+h%160,y*672+240+(h>>>8)%120).setFlipX((h&1)!==0);
    }
    let index=0;
    for(let row=0;row<this.rows;row++)for(let col=0;col<this.columns;col++)for(let n=0;n<2;n++) {
      const x=cx+col,y=cy+row,h=this.hash(x,y,n),img=this.images[index++];
      img.setTexture(`field_${this.chapter}_${h%4}`)
        .setPosition(x*this.cellSize+34+(h>>>8)%150,y*this.cellSize+34+(h>>>16)%150)
        .setFlipX((h&16)!==0).setScale(.75+(h%5)*.1).setAlpha(this.chapter==='huangjin'?.45:.4).setOrigin(.5).clearTint().setVisible(true);
      // Quiet and busy macro-regions; do not cover every cell with extra details.
      const region=this.hash(Math.floor(x/3),Math.floor(y/3),7);
      img.setVisible(region%5!==0 && h%3!==1 && (region%3!==0||n===0));
      if(n===0 && h%5===0 && region%4!==0) {
        // Flags are rarer than low rubble, and never appear in adjacent cells.
        const flag=(x%4===0 && y%4===0 && h%2===0);
        const frame=this.chapter==='huangjin'?(flag?0:1+h%3):(flag?4:5+h%3);
        // These frames have narrower silhouettes than crates and tents. Enlarge
        // them modestly so they read clearly at phone scale; BattlefieldSupplies
        // uses this same display size for footprint and contact shadow alignment.
        const baseSize=flag?104:frame===5?112:frame===6?108:120;
        if(this.stage){
          // Individual objects only; large tents restricted to sparse deterministic cells.
          const tent=this.stage===2&&x%6===0&&y%6===0;
          const choices=this.stage===3?[14,15,19,22,24,25,26,27,28,29,30,32,33]:[10,11,14,15,16,17,19,20,21,22,23,24,25,26,27,28];
          const prop=h%19===0?35:tent?h%4:flag?4+h%6:choices[h%choices.length];
          const size=propDisplaySize(prop);
          this.props.push({key:`prop-${x},${y}`,x:img.x,y:img.y,frame:prop,size,flip:mayMirrorProp(prop)&&(h&16)!==0});img.setVisible(false);
        }else if(this.chapter==='hulao'&&[4,5,7].includes(frame)){
          this.props.push({key:`prop-${x},${y}`,x:img.x,y:img.y,frame,size:frame===5?140:frame===7?128:baseSize,flip:false,texture:'art_props'});img.setVisible(false);
        }else img.setTexture('art_props',String(frame)).setDisplaySize(baseSize,baseSize).setOrigin(.5,.75).setFlipX(false).setAlpha(1).clearTint().setVisible(true);
      }
    }
  }
  private hash(x:number,y:number,n:number):number {
    let v=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(n+1,83492791);
    v=Math.imul(v^(v>>>16),0x45d9f3b);return (v^(v>>>16))>>>0;
  }
  private makeTextures():void {
    const grass=this.chapter==='huangjin';
    for(let kind=0;kind<4;kind++) {
      const key=`field_${this.chapter}_${kind}`;if(this.scene.textures.exists(key))continue;
      const g=this.scene.make.graphics({x:0,y:0});
      if(kind===0) {
        // Tufts: dark bases, broken olive/ochre blades, no oversized opaque patch.
        for(let i=0;i<11;i++) {
          const seed=this.hash(i,kind,2),x=9+(seed>>>5)%42,y=24+(seed>>>14)%24,h=4+seed%9;
          g.fillStyle(grass?0x44482a:0x665333,.6).fillRect(x-2,y,8,3);
          g.fillStyle(grass?0x637143:0x8b7846).fillRect(x,y-h,2,h).fillRect(x+2,y-h+3,2,h-3);
          g.fillStyle(grass?0x8c9459:0xafa16b,.85).fillRect(x,y-h,2,3);
        }
      } else if(kind===1) {
        for(let i=0;i<6;i++) {
          const seed=this.hash(i,kind,5),x=8+(seed>>>5)%43,y=15+(seed>>>14)%32,w=3+i%3*2;
          g.fillStyle(0x30291e,.45).fillRect(x-1,y+4,w+4,3);
          g.fillStyle(grass?0x807a65:0x8d7c68).fillRect(x,y,w,5);
          g.fillStyle(0xb4a48a,.75).fillRect(x+1,y,w-2,2);
        }
      } else if(kind===2) {
        // Interrupted parallel wheel grooves, still readable underneath characters.
        for(let i=0;i<7;i++)for(const offset of [0,13]) {
          g.fillStyle(0x473623,.27).fillRect(8+i*5+offset,10+i*6,3,7);
          g.fillStyle(0xc1a06b,.15).fillRect(11+i*5+offset,10+i*6,2,6);
        }
      } else {
        // Dry scattered straw in chapter one; charcoal and broken shaft in chapter two.
        for(let i=0;i<7;i++)g.fillStyle(grass?0xa28b54:0x3d342b,.55).fillRect(9+(i*13)%44,16+(i*7)%30,4+i%3*2,2);
        if(!grass)g.fillStyle(0x67513b,.7).fillRect(22,20,3,22).fillStyle(0xb39b70,.6).fillRect(22,20,1,20);
      }
      g.generateTexture(key,72,72);g.destroy();
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
