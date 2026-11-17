import Phaser from 'phaser';
import {canPickLord,lordFinal,lordHero,lordRules} from '../systems/RosterStore';
import {HEADING_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D} from '../config';
import {HeroWarCard} from './HeroWarCard';
import {CHARACTERS} from '../data/characters';
import {homeCommand} from './HomeCommand';
/** 每页 4 名武将（电脑一行 4 张、手机 2×2），武将多于 4 名时用 ‹ › 翻页。 */
const PER=4;
export class HomeHeroPicker{
 readonly root:Phaser.GameObjects.Container;private candidate=0;private page=0;private cards:HeroWarCard[]=[];private pageText?:Phaser.GameObjects.Text;private hint?:Phaser.GameObjects.Text;private armed=-1;
 get preview():Phaser.GameObjects.Image{return this.cards[this.candidate].art;}
 private get pages(){return Math.ceil(CHARACTERS.length/PER);}
 constructor(private s:Phaser.Scene,private confirm:(index:number)=>void,private close:()=>void){
 this.root=s.add.container(0,0).setDepth(300).setVisible(false).setName('hero-picker');this.root.add(s.add.rectangle(W/2,H/2,W,H,0x17130e,1).setInteractive());
 const text=(x:number,y:number,value:string,size:number)=>s.add.text(x,y,value,{fontFamily:HEADING_FONT,fontSize:size+'px',color:'#e6c88e',resolution:2}).setOrigin(.5);
 const pad=D?0:Math.max(0,Math.round((H-960)/2));
 this.root.add(text(W/2,D?40:57+pad,'点将 · 义军将录',D?30:29));this.root.add(text(W/2,D?77:99+pad,'择一良将，匡扶汉室',13));
 CHARACTERS.forEach((c,i)=>{const k=i%PER,w=D?198:216,h=330,x=D?W/2+(k-2)*214+8:46+k%2*232,y=D?109+Math.abs(k-1.5)*8:137+pad+Math.floor(k/2)*352;
  const card=new HeroWarCard(s,x,y,w,h);card.hit.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});card.root.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});this.root.add(card.root);this.cards.push(card);
 });
 if(this.pages>1){
  // 翻页：电脑放在卡片两侧，手机放在标题两侧
  const py=D?109+165:99+pad,lx=D?26:58,rx=D?W-26:W-58;
  const arrow=(x:number,label:string,name:string,dir:number)=>{const t=s.add.text(x,py,label,{fontFamily:HEADING_FONT,fontSize:(D?44:34)+'px',color:'#e6c88e',resolution:2}).setOrigin(.5).setName(name).setInteractive({useHandCursor:true});t.on('pointerdown',()=>this.turn(dir));this.root.add(t);};
  arrow(lx,'‹','hero-page-prev',-1);arrow(rx,'›','hero-page-next',1);
  this.pageText=text(W/2,D?H-86:H-142,'',14).setStroke('#120904',4);this.root.add(this.pageText);
 }
 const back=homeCommand(s,D?W/2-140:128,D?H-43:H-82,D?160:160,60,'返回');back.hit.setName('hero-picker-close').on('pointerdown',()=>this.close());this.root.add([back.g,back.hit,back.caption]);
 const ok=homeCommand(s,D?W/2+105:356,D?H-43:H-82,D?260:248,64,'确认出战',true);ok.hit.setName('hero-confirm').setData('padDefault',true).on('pointerdown',()=>this.tryConfirm());
 this.hint=text(W/2,D?H-86-26:H-142-28,'',D?17:15).setColor('#ff9a72').setStroke('#120904',4).setBackgroundColor('rgba(18,9,4,0.82)').setPadding(16,5,16,5).setName('hero-locked-hint');this.root.add(this.hint);this.root.add([ok.g,ok.hit,ok.caption]);
 }
 /** 择主公：主公规则生效、且这一下会定下（或改选）主公时，要点两次「确认出战」。 */
 private tryConfirm():void{const c=CHARACTERS[this.candidate];if(!c)return;
  if(!canPickLord(c.id)){this.hint?.setText(this.lockText()).setVisible(true);return;}
  const decides=lordRules()&&(!lordHero()||!lordFinal());
  if(decides&&this.armed!==this.candidate){this.armed=this.candidate;this.hint?.setColor('#ffd98a').setText(`主公选定后本存档不可更改 · 再点一次「确认出战」，以 ${c.name} 为主公`).setVisible(true);return;}
  this.armed=-1;this.confirm(this.candidate);}
 private lockText():string{const l=lordHero();return `主公已定为 ${CHARACTERS.find(c=>c.id===l)?.name??''} · 本存档不可更换（其他武将可在招贤馆招为随行）`;}
 private turn(dir:number){this.page=(this.page+dir+this.pages)%this.pages;this.refreshArt();}
 open(index:number):void{this.candidate=index;this.page=Math.floor(index/PER);this.root.setVisible(true);this.refreshArt();}
 refreshArt(_animate=false):void{
  this.cards.forEach((c,i)=>{const on=Math.floor(i/PER)===this.page;c.root.setVisible(on);c.hit.setVisible(on);if(c.hit.input)c.hit.input.enabled=on;if(on){c.setHero(i);c.setSelected(i===this.candidate);c.root.setAlpha(canPickLord(CHARACTERS[i].id)?1:.4);}});
  if(this.armed!==this.candidate)this.armed=-1;
  const lock=!canPickLord(CHARACTERS[this.candidate]?.id??'zhaoyun');if(this.armed<0)this.hint?.setColor('#ff9a72').setText(lock?this.lockText():lordRules()&&!lordHero()?'择一良将为主公 · 选定后本存档不可更改':'');this.hint?.setVisible(!!this.hint.text);
  this.pageText?.setText(`第 ${this.page+1} / ${this.pages} 页 · 共 ${CHARACTERS.length} 将`);
 }
}
