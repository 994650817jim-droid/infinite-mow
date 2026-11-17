import Phaser from 'phaser';
import {canPickLord,lordFinal,lordHero,lordRules} from '../systems/RosterStore';
import {FONT,HEADING_FONT,TITLE_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D} from '../config';
import {HeroWarCard} from './HeroWarCard';
import {CHARACTERS} from '../data/characters';
import {homeCommand} from './HomeCommand';
/** 每页 4 名武将（电脑一行 4 张、手机 2×2），武将多于 4 名时用 ‹ › 翻页。
 *  2026-11-17 用户「这里ui也需要调整字体美术不统一」（电脑版）：一个大标题（与主页标题同字体同金色）、提示移到标题下（象牙白描边、无暗底、短句）、
 *  页码只写「1 / 3」放在卷轴与按钮之间；字体统一 TITLE / HEADING / FONT 三档，金 #efd399 / 象牙 #e8d8b2，描边 #120904。 */
const GOLD='#efd399',IVORY='#e8d8b2',STROKE='#120904';
const PER=4;
export class HomeHeroPicker{
 readonly root:Phaser.GameObjects.Container;private candidate=0;private page=0;private cards:HeroWarCard[]=[];private pageText?:Phaser.GameObjects.Text;private hint?:Phaser.GameObjects.Text;private armed=-1;
 get preview():Phaser.GameObjects.Image{return this.cards[this.candidate].art;}
 private get pages(){return Math.ceil(CHARACTERS.length/PER);}
 constructor(private s:Phaser.Scene,private confirm:(index:number)=>void,private close:()=>void){
 this.root=s.add.container(0,0).setDepth(300).setVisible(false).setName('hero-picker');this.root.add(s.add.rectangle(W/2,H/2,W,H,0x17130e,1).setInteractive());
 const text=(x:number,y:number,value:string,size:number)=>s.add.text(x,y,value,{fontFamily:HEADING_FONT,fontSize:size+'px',color:'#e6c88e',resolution:2}).setOrigin(.5);
 const pad=D?0:Math.max(0,Math.round((H-960)/2));
 if(D)this.root.add(s.add.text(W/2,32,'择 一 良 将',{fontFamily:TITLE_FONT,fontSize:'36px',color:GOLD,resolution:2}).setOrigin(.5).setLetterSpacing(6).setShadow(0,3,'#130a05',2,true,true).setName('hero-picker-title'));
 else{this.root.add(text(W/2,57+pad,'点将 · 义军将录',29));this.root.add(text(W/2,99+pad,'择一良将，匡扶汉室',13));}
 CHARACTERS.forEach((c,i)=>{const k=i%PER,w=D?198:216,h=330,x=D?W/2+(k-2)*214+8:46+k%2*232,y=D?88+Math.abs(k-1.5)*8:137+pad+Math.floor(k/2)*352;
  const card=new HeroWarCard(s,x,y,w,h);card.hit.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});card.root.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});this.root.add(card.root);this.cards.push(card);
 });
 if(this.pages>1){
  // 翻页：电脑放在卡片两侧，手机放在标题两侧
  const py=D?88+165:99+pad,lx=D?26:58,rx=D?W-26:W-58;
  const arrow=(x:number,label:string,name:string,dir:number)=>{const t=s.add.text(x,py,label,{fontFamily:HEADING_FONT,fontSize:(D?44:34)+'px',color:D?GOLD:'#e6c88e',resolution:2}).setOrigin(.5).setStroke(STROKE,D?4:0).setName(name).setInteractive({useHandCursor:true});t.on('pointerdown',()=>this.turn(dir));this.root.add(t);};
  arrow(lx,'‹','hero-page-prev',-1);arrow(rx,'›','hero-page-next',1);
  this.pageText=text(W/2,D?H-90:H-142,'',D?16:14).setStroke(STROKE,4).setColor(D?GOLD:'#e6c88e').setLetterSpacing(D?3:0);this.root.add(this.pageText);
 }
 const back=homeCommand(s,D?W/2-140:128,D?H-40:H-82,D?160:160,60,'返回');back.hit.setName('hero-picker-close').on('pointerdown',()=>this.close());this.root.add([back.g,back.hit,back.caption]);
 const ok=homeCommand(s,D?W/2+105:356,D?H-40:H-82,D?260:248,64,'确认出战',true);ok.hit.setName('hero-confirm').setData('padDefault',true).on('pointerdown',()=>this.tryConfirm());
 // 提示：电脑放在标题下（象牙白 + 深色描边，不要暗底块，不压卷轴）；手机沿用原位
 this.hint=D?s.add.text(W/2,66,'',{fontFamily:FONT,fontSize:'15px',color:IVORY,resolution:2}).setOrigin(.5).setStroke(STROKE,4).setShadow(0,1,'#000',2,true,true).setName('hero-locked-hint')
  :text(W/2,H-142-28,'',15).setColor('#ff9a72').setStroke('#120904',4).setBackgroundColor('rgba(18,9,4,0.82)').setPadding(16,5,16,5).setName('hero-locked-hint');this.root.add(this.hint);this.root.add([ok.g,ok.hit,ok.caption]);
 }
 /** 择主公：主公规则生效、且这一下会定下（或改选）主公时，要点两次「确认出战」。 */
 private tryConfirm():void{const c=CHARACTERS[this.candidate];if(!c)return;
  if(!canPickLord(c.id)){this.hint?.setText(this.lockText()).setVisible(true);return;}
  const decides=lordRules()&&(!lordHero()||!lordFinal());
  if(decides&&this.armed!==this.candidate){this.armed=this.candidate;this.hint?.setColor(D?GOLD:'#ffd98a').setText(D?`再点一次「确认出战」· 定 ${c.name} 为主公，选定后不可更改`:`主公选定后本存档不可更改 · 再点一次「确认出战」，以 ${c.name} 为主公`).setVisible(true);return;}
  this.armed=-1;this.confirm(this.candidate);}
 private lockText():string{const l=lordHero(),n=CHARACTERS.find(c=>c.id===l)?.name??'';return D?`主公 · ${n} · 不可更换（其他武将可招为随行）`:`主公已定为 ${n} · 本存档不可更换（其他武将可在招贤馆招为随行）`;}
 private turn(dir:number){this.page=(this.page+dir+this.pages)%this.pages;this.refreshArt();}
 open(index:number):void{this.candidate=index;this.page=Math.floor(index/PER);this.root.setVisible(true);this.refreshArt();}
 refreshArt(_animate=false):void{
  this.cards.forEach((c,i)=>{const on=Math.floor(i/PER)===this.page;c.root.setVisible(on);c.hit.setVisible(on);if(c.hit.input)c.hit.input.enabled=on;if(on){c.setHero(i);c.setSelected(i===this.candidate);c.root.setAlpha(canPickLord(CHARACTERS[i].id)?1:.4);}});
  if(this.armed!==this.candidate)this.armed=-1;
  const lock=!canPickLord(CHARACTERS[this.candidate]?.id??'zhaoyun');if(this.armed<0)this.hint?.setColor(D?IVORY:'#ff9a72').setText(lock?this.lockText():lordRules()&&!lordHero()?(D?'选定即为主公 · 不可更改':'择一良将为主公 · 选定后本存档不可更改'):'');this.hint?.setVisible(!!this.hint.text);
  this.pageText?.setText(D?`${this.page+1} / ${this.pages}`:`第 ${this.page+1} / ${this.pages} 页 · 共 ${CHARACTERS.length} 将`);
 }
}
