import Phaser from 'phaser';
import {FONT,HEADING_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D} from '../config';
import {HeroWarCard} from './HeroWarCard';
import {CHARACTERS} from '../data/characters';
import {homeCommand} from './HomeCommand';
export class HomeHeroPicker{
 readonly root:Phaser.GameObjects.Container;private candidate=0;private cards:HeroWarCard[]=[];
 get preview():Phaser.GameObjects.Image{return this.cards[this.candidate].art;}
 constructor(private s:Phaser.Scene,private confirm:(index:number)=>void,private close:()=>void){
 this.root=s.add.container(0,0).setDepth(300).setVisible(false).setName('hero-picker');this.root.add(s.add.rectangle(W/2,H/2,W,H,0x17130e,1).setInteractive());
 const text=(x:number,y:number,value:string,size:number)=>s.add.text(x,y,value,{fontFamily:HEADING_FONT,fontSize:size+'px',color:'#e6c88e',resolution:2}).setOrigin(.5);
 const pad=D?0:Math.max(0,Math.round((H-960)/2));
 this.root.add(text(W/2,D?40:57+pad,'点将 · 义军将录',D?30:29));this.root.add(text(W/2,D?77:99+pad,'择一良将，匡扶汉室',13));
 CHARACTERS.forEach((c,i)=>{const w=D?198:216,h=D?330:330,x=D?W/2+(i-2)*214+8:46+i%2*232,y=D?109+Math.abs(i-1.5)*8:137+pad+Math.floor(i/2)*352;
 const card=new HeroWarCard(s,x,y,w,h);card.hit.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});card.root.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});this.root.add(card.root);this.cards.push(card);

 });
 const back=homeCommand(s,D?W/2-140:128,D?H-43:H-82,D?160:160,60,'返回');back.hit.setName('hero-picker-close').on('pointerdown',()=>this.close());this.root.add([back.g,back.hit,back.caption]);
 const ok=homeCommand(s,D?W/2+105:356,D?H-43:H-82,D?260:248,64,'确认出战',true);ok.hit.setName('hero-confirm').setData('padDefault',true).on('pointerdown',()=>this.confirm(this.candidate));this.root.add([ok.g,ok.hit,ok.caption]);
 }
 open(index:number):void{this.candidate=index;this.root.setVisible(true);this.refreshArt();}
 refreshArt(_animate=false):void{this.cards.forEach((c,i)=>{c.setHero(i);c.setSelected(i===this.candidate);});}
}
