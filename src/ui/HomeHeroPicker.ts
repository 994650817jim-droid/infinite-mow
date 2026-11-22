import Phaser from 'phaser';
import {canPickLord,heroHired,lordFinal,lordHero,lordRules} from '../systems/RosterStore';
import {worldUnlocked} from '../world/WorldStore';
/** 已归附（可选为主将）但本档还没在招贤馆招为随从（2026-11-20 用户：解锁不等于能跟随）。 */
const needHire=(id:string):boolean=>{try{return heroUnlocked(id)&&worldUnlocked()&&!heroHired(id as Parameters<typeof heroHired>[0]);}catch{return false;}};
import {FONT,HEADING_FONT,TITLE_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D} from '../config';
import {HeroWarCard} from './HeroWarCard';
import {CHARACTERS} from '../data/characters';
import {homeCommand} from './HomeCommand';
import {lqSkin,lqHitBox} from './LacquerKit';
import {heroUnlocked} from '../systems/HeroUnlocks';
import {LOCKED_HINT,LOCKED_TITLE,LOCKED_HOW} from '../data/heroUnlocks';
/** 每页 4 名武将（电脑一行 4 张、手机 2×2），武将多于 4 名时用 ‹ › 翻页。
 *  2026-11-17 用户「这里ui也需要调整字体美术不统一」（电脑版）：一个大标题（与主页标题同字体同金色）、提示移到标题下（象牙白描边、无暗底、短句）、
 *  页码只写「1 / 3」放在卷轴与按钮之间；字体统一 TITLE / HEADING / FONT 三档，金 #efd399 / 象牙 #e8d8b2，描边 #120904。 */
const GOLD='#efd399',IVORY='#e8d8b2',STROKE='#120904';
const PER=4;
/**
 * 选项（默认 = 战役选将，行为不变）：free = 不看主将规则（名将连战这类不继承战役的模式：已归附 + 开局就有的武将都能选，不弹「定为主将」）；
 * title / okLabel / note = 大标题、确认按钮、标题下那行说明；name = 根容器名。
 */
export interface HeroPickerOpts{title?:string;okLabel?:string;free?:boolean;note?:string;name?:string}
export class HomeHeroPicker{
 readonly root:Phaser.GameObjects.Container;private candidate=0;private page=0;private cards:HeroWarCard[]=[];
 /** 显示顺序（CHARACTERS 下标）：已来投的在前、没来投的在后（2026-11-19 武将解锁，systems/HeroUnlocks）。 */
 private order:number[]=CHARACTERS.map((_,i)=>i);private lockTexts:Phaser.GameObjects.Text[]=[];private pageText?:Phaser.GameObjects.Text;private hint?:Phaser.GameObjects.Text;private armed=-1;
 /** 选中卷轴的金边 + 外光（2026-11-21 制作人验收：点了赵云后四张卷轴看起来一样）。 */private selG?:Phaser.GameObjects.Graphics;
 /** 确认按钮文字：从「匡扶汉室」进来是「确认出战」（确认后直接开打），从「更换武将」进来是「选定武将」。 */private okLabel='确认出战';private okCaption?:Phaser.GameObjects.Text;
 get preview():Phaser.GameObjects.Image{return this.cards[this.candidate].art;}
 private get pages(){return Math.ceil(CHARACTERS.length/PER);}
 constructor(private s:Phaser.Scene,private confirm:(index:number)=>void,private close:()=>void,private opts:HeroPickerOpts={}){
 this.root=s.add.container(0,0).setDepth(300).setVisible(false).setName(opts.name??'hero-picker');this.root.add(s.add.rectangle(W/2,H/2,W,H,0x17130e,1).setInteractive());
 const text=(x:number,y:number,value:string,size:number)=>s.add.text(x,y,value,{fontFamily:HEADING_FONT,fontSize:size+'px',color:'#e6c88e',resolution:2}).setOrigin(.5);
 const pad=D?0:Math.max(0,Math.round((H-960)/2));
 if(D)this.root.add(s.add.text(W/2,32,opts.title??'择 一 良 将',{fontFamily:TITLE_FONT,fontSize:'36px',color:GOLD,resolution:2}).setOrigin(.5).setLetterSpacing(6).setShadow(0,3,'#130a05',2,true,true).setName('hero-picker-title'));
 else{this.root.add(text(W/2,57+pad,opts.title??'点将 · 义军将录',29));this.root.add(text(W/2,99+pad,opts.note??'择一良将，匡扶汉室',13));}
 this.order=CHARACTERS.map((c,i)=>({i,u:heroUnlocked(c.id)})).sort((a,b)=>Number(b.u)-Number(a.u)||a.i-b.i).map(o=>o.i);
 CHARACTERS.forEach((_c,i)=>{const c=CHARACTERS[this.order[i]];const k=i%PER,w=D?198:216,h=330,x=D?W/2+(k-2)*214+8:46+k%2*232,y=D?88+Math.abs(k-1.5)*8:137+pad+Math.floor(k/2)*352;
  const card=new HeroWarCard(s,x,y,w,h);card.root.setData('baseY',y);card.hit.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});card.root.setName('pick-'+c.id).on('pointerdown',()=>{this.candidate=i;this.refreshArt();});{const lt=s.add.text(w/2,h*.56,'',{fontFamily:HEADING_FONT,fontSize:(D?15:15)+'px',color:'#f3e0b8',resolution:2,align:'center',wordWrap:{width:w-36,useAdvancedWrap:true}}).setOrigin(.5).setStroke(STROKE,4).setBackgroundColor('rgba(18,9,4,0.72)').setPadding(10,6).setName('pick-lock-'+c.id).setVisible(false);card.root.add(lt);this.lockTexts.push(lt);}this.root.add(card.root);this.cards.push(card);
 });
 this.selG=s.add.graphics().setName('hero-picker-selected');this.root.add(this.selG);
 if(this.pages>1){
  // 翻页：电脑放在卡片两侧，手机放在标题两侧
  const py=D?88+165:99+pad,lx=D?26:58,rx=D?W-26:W-58;
  const arrow=(x:number,label:string,name:string,dir:number)=>{const t=s.add.text(x,py,label,{fontFamily:HEADING_FONT,fontSize:(D?44:34)+'px',color:D?GOLD:'#e6c88e',resolution:2}).setOrigin(.5).setStroke(STROKE,D?4:0).setName(name).setInteractive({useHandCursor:true});t.on('pointerdown',()=>this.turn(dir));this.root.add(t);};
  arrow(lx,'‹','hero-page-prev',-1);arrow(rx,'›','hero-page-next',1);
  this.pageText=text(W/2,D?H-90:H-142,'',D?16:14).setStroke(STROKE,4).setColor(D?GOLD:'#e6c88e').setLetterSpacing(D?3:0);this.root.add(this.pageText);
 }
 // 一屏一个水墨按钮（2026-11-21 制作人验收）：「返回」改漆金小按钮
 const back=s.add.text(D?W/2-150:128,D?H-40:H-82,'返 回',{fontFamily:HEADING_FONT,fontSize:'17px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setInteractive({useHandCursor:true}).setName('hero-picker-close');lqHitBox(back,120,40);const backSkin=lqSkin(s,back,back,()=>({w:120,h:40}),{tone:'quiet'});back.on('pointerdown',()=>this.close());this.root.add([backSkin.gfx,back]);
 const ok=homeCommand(s,D?W/2+105:356,D?H-40:H-82,D?260:248,64,'确认出战',true);ok.hit.setName('hero-confirm').setData('padDefault',true).on('pointerdown',()=>this.tryConfirm());this.okCaption=ok.caption;
 // 提示：电脑放在标题下（象牙白 + 深色描边，不要暗底块，不压卷轴）；手机沿用原位
 this.hint=D?s.add.text(W/2,66,'',{fontFamily:FONT,fontSize:'15px',color:IVORY,resolution:2}).setOrigin(.5).setStroke(STROKE,4).setShadow(0,1,'#000',2,true,true).setName('hero-locked-hint')
  :text(W/2,H-142-28,'',15).setColor('#ff9a72').setStroke('#120904',4).setBackgroundColor('rgba(18,9,4,0.82)').setPadding(16,5,16,5).setName('hero-locked-hint');this.root.add(this.hint);this.root.add([ok.g,ok.hit,ok.caption]);
 }
 /** 这名武将能不能选：free（不继承战役的模式）只看是否已归附，否则还要过主将规则。 */
 private canPick(id:string):boolean{return this.opts.free||canPickLord(id as Parameters<typeof canPickLord>[0]);}
 /** 择主公：主公规则生效、且这一下会定下（或改选）主公时，要点两次「确认出战」。 */
 private tryConfirm():void{const c=CHARACTERS[this.order[this.candidate]];if(!c)return;
  if(!heroUnlocked(c.id)){this.hint?.setText(`${c.name} · ${LOCKED_HINT}`).setVisible(true);return;}
  if(!this.canPick(c.id)){this.hint?.setText(this.lockText()).setVisible(true);return;}
  const decides=!this.opts.free&&lordRules()&&(!lordHero()||!lordFinal());
  if(decides&&this.armed!==this.candidate){this.armed=this.candidate;this.hint?.setColor(D?GOLD:'#ffd98a').setText(D?`再点一次「${this.okLabel}」· 定 ${c.name} 为主将，选定后不可更改`:`主将选定后本存档不可更改 · 再点一次「${this.okLabel}」，以 ${c.name} 为主将`).setVisible(true);return;}
  this.armed=-1;this.confirm(this.order[this.candidate]);}
 private lockText():string{const l=lordHero(),n=CHARACTERS.find(c=>c.id===l)?.name??'';return D?`主将 · ${n} · 不可更换（其他武将可招为随行）`:`主将已定为 ${n} · 本存档不可更换（其他武将可在招贤馆招为随行）`;}
 private turn(dir:number){this.page=(this.page+dir+this.pages)%this.pages;this.refreshArt();}
 /** startAfter：从「匡扶汉室」打开（还没选过将）——确认后直接出征，按钮写「确认出战」；否则只是换将 / 定主公，按钮写「选定武将」。 */
 open(index:number,startAfter=false):void{this.okLabel=this.opts.okLabel??(startAfter?'确认出战':'选定武将');this.okCaption?.setText(this.okLabel);this.order=CHARACTERS.map((c,i)=>({i,u:heroUnlocked(c.id)})).sort((a,b)=>Number(b.u)-Number(a.u)||a.i-b.i).map(o=>o.i); /* 打开时按当前解锁重排 */index=Math.max(0,this.order.indexOf(index));if(!heroUnlocked(CHARACTERS[this.order[index]].id))index=0;this.candidate=index;this.page=Math.floor(index/PER);this.root.setVisible(true);this.refreshArt();}
 refreshArt(_animate=false):void{
  this.cards.forEach((c,i)=>{const on=Math.floor(i/PER)===this.page;c.root.setVisible(on);c.hit.setVisible(on);if(c.hit.input)c.hit.input.enabled=on;if(on){const id=CHARACTERS[this.order[i]].id,locked=!heroUnlocked(id);c.setHero(this.order[i]);c.setSelected(i===this.candidate);const sel=i===this.candidate;c.root.setAlpha(locked?1:!this.canPick(id)?.4:sel?1:.62).setY((c.root.getData('baseY') as number)-(sel?12:0)); /* 选中的抬起、其余压暗 */
   // 没归附：立绘压成墨色剪影 + 通用提示（用户：不写哪一章来投，只说需劝降招募）
   if(locked)c.art.setTintFill(0x17120c);else c.art.clearTint();this.lockTexts[i]?.setName('pick-lock-'+id).setText(locked?LOCKED_TITLE+'\n'+LOCKED_HOW:'').setVisible(locked);}});
  if(this.armed!==this.candidate)this.armed=-1;
  {const g=this.selG,c=this.cards[this.candidate];g?.clear();if(g&&c&&c.root.visible){const x=c.root.x,y=c.root.y,w=c.width,h=c.height;g.lineStyle(10,0xf0c860,.14).strokeRoundedRect(x-9,y-9,w+18,h+18,14).lineStyle(5,0xf0c860,.22).strokeRoundedRect(x-6,y-6,w+12,h+12,12).lineStyle(2.5,0xf3d48a,.95).strokeRoundedRect(x-3,y-3,w+6,h+6,10);}}
  const cid=CHARACTERS[this.order[this.candidate]]?.id??'zhaoyun',lock=!this.canPick(cid);
  if(!heroUnlocked(cid)&&this.armed<0){this.hint?.setColor(D?IVORY:'#ff9a72').setText(`${CHARACTERS[this.order[this.candidate]].name} · ${LOCKED_HINT}`);this.pageText?.setText(D?`${this.page+1} / ${this.pages}`:`第 ${this.page+1} / ${this.pages} 页 · 共 ${CHARACTERS.length} 将`);return;}if(this.armed<0)this.hint?.setColor(D?IVORY:'#ff9a72').setText(lock?(needHire(cid)?`${CHARACTERS[this.order[this.candidate]].name}已归附 · 随行需往招贤馆招募`:this.lockText()):this.opts.free?(this.opts.note??''):lordRules()&&!lordHero()?(D?'选定即为主将 · 不可更改':'择一良将为主将 · 选定后本存档不可更改'):'');this.hint?.setVisible(!!this.hint.text);
  this.pageText?.setText(D?`${this.page+1} / ${this.pages}`:`第 ${this.page+1} / ${this.pages} 页 · 共 ${CHARACTERS.length} 将`);
 }
}
