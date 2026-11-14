import Phaser from 'phaser';
import {FONT,HEADING_FONT,TITLE_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D} from '../config';
import {CHRONICLE,type ChronicleArc} from '../data/chronicle';
import {loadWorld} from '../world/WorldStore';
import {homeCommand,warPanelTexture} from './HomeCommand';

type StageState='cleared'|'next'|'locked';
/** 从存档读出每章已平定的关数，以及该章是否已开放。 */
export function chronicleProgress():Record<ChronicleArc,{cleared:number;open:boolean}>{
 const s=loadWorld();
 const yellow=s.cleared.huangjin||s.legacyHulaoAccess?3:Math.max(0,Math.min(3,s.yellowStages));
 const dong=s.cleared.hulao?3:Math.max(0,Math.min(3,s.dongzhuoStages));
 return{huangjin:{cleared:yellow,open:true},dongzhuo:{cleared:dong,open:yellow>=3||s.legacyHulaoAccess},qunxiong:{cleared:Math.max(0,Math.min(3,s.warlordStages)),open:s.cleared.hulao}};
}

/**
 * 战役回顾 · 乱世编年：三章九关的史事卡片。已平定的关显示完整史录；下一关显示关名与“待出征”；
 * 更后面的关与未开放章节全部锁住。底部“前往选关”沿用原有的选关入口。
 */
export class CampaignChronicle{
 readonly root:Phaser.GameObjects.Container;private body:Phaser.GameObjects.Container;private chapter=0;
 private readonly progress=chronicleProgress();
 constructor(private scene:Phaser.Scene,private goSelect:(arc:ChronicleArc)=>void){
  this.root=scene.add.container(0,0).setDepth(560).setName('campaign-chronicle');
  this.root.add(scene.add.rectangle(W/2,H/2,W,H,0x120d09,1).setInteractive());
  const glow=scene.add.graphics();for(let i=0;i<36;i++){const k=i/36;glow.fillStyle(0x3a2716,.035).fillEllipse(W/2,D?120:170,(D?900:620)*(1-k*.8),(D?260:300)*(1-k*.8));}this.root.add(glow);
  const total=Object.values(this.progress).reduce((n,p)=>n+p.cleared,0);
  this.root.add(this.text(W/2,D?34:52,'战役回顾 · 乱世编年',D?30:30,'#f0d79e',TITLE_FONT).setOrigin(.5).setLetterSpacing(2));
  this.root.add(this.text(D?W-36:W/2,D?36:88,'已平定 '+total+' / 9',D?15:15,'#c9ad7a').setOrigin(D?1:.5,.5));
  // 默认打开最近有进展的章节
  const arcs:ChronicleArc[]=['huangjin','dongzhuo','qunxiong'];
  this.chapter=Math.max(0,arcs.reduce((last,a,i)=>this.progress[a].open?i:last,0));
  this.body=scene.add.container(0,0);this.root.add(this.body);
  this.render();
 }
 private text(x:number,y:number,value:string,size:number,color='#e7d4ae',font=FONT){return this.scene.add.text(x,y,value,{fontFamily:font,fontSize:size+'px',color,resolution:2}).setShadow(0,1,'#0a0603',3,true,true);}
 private render():void{
  this.body.removeAll(true);
  const arcs:ChronicleArc[]=['huangjin','dongzhuo','qunxiong'],c=CHRONICLE[this.chapter],p=this.progress[c.arc];
  // 章节页签
  const tabW=D?214:160,tabY=D?82:126;
  arcs.forEach((arc,i)=>{const info=this.progress[arc],x=W/2+(i-1)*(tabW+(D?12:10)),active=i===this.chapter;
   const frame=this.scene.add.image(x,tabY,warPanelTexture(this.scene,tabW,42,active)).setDisplaySize(tabW+16,58).setAlpha(info.open?1:.55);
   const name=CHRONICLE[i].title.split(' · ')[1];
   const label=this.text(x,tabY,info.open?name+'  '+info.cleared+'/3':name+' · 未开',D?16:15,active?'#fff0cc':info.open?'#d8c39a':'#857a68',HEADING_FONT).setOrigin(.5);
   const hit=this.scene.add.rectangle(x,tabY,tabW,42,0,.001).setInteractive({useHandCursor:true}).setName('chronicle-tab-'+i).on('pointerdown',()=>{this.chapter=i;this.render();});
   this.body.add([frame,label,hit]);
  });
  const introY=D?122:172;
  this.body.add(this.text(W/2,introY,c.years+'　'+(p.open?c.intro:'尚未开放 · 平定前一章后，揭开这段历史。'),D?14:15,p.open?'#cdb68c':'#857a68').setOrigin(.5,0).setAlign('center').setWordWrapWidth(D?W-120:W-60,true));
  // 三关史录卡
  const top=D?158:introY+(D?0:58),bottom=D?H-74:H-104,gap=D?14:14;
  const cardW=D?(W-68-gap*2)/3:W-48,cardH=D?bottom-top:Math.min(260,(bottom-top-gap*2)/3);
  c.stages.forEach((st,i)=>{
   const state:StageState=i<p.cleared?'cleared':p.open&&i===p.cleared?'next':'locked';
   const x=D?34+i*(cardW+gap):24,y=D?top:top+i*(cardH+gap),cx=x+cardW/2;
   const panel=this.scene.add.image(cx,y+cardH/2,warPanelTexture(this.scene,cardW,cardH,state==='next')).setDisplaySize(Math.round(cardW)+16,Math.round(cardH)+16).setAlpha(state==='locked'?.62:1);
   this.body.add(panel);this.body.add(this.scene.add.rectangle(cx,y+cardH/2,cardW,cardH,0,.001).setName('chronicle-card-'+i).setData('state',state));
   // 朱印：敌将姓名一字；锁定为灰印问号
   const sealX=x+(D?48:52),sealY=y+(D?52:Math.min(56,cardH*.28)),size=D?58:56;
   const seal=this.scene.add.rectangle(sealX,sealY,size,size,state==='cleared'?0x8e2a1c:state==='next'?0x5a2a1c:0x37322a).setStrokeStyle(2,state==='locked'?0x5f574a:0xe0bb72).setRotation(-.05);
   const sealChar=this.text(sealX,sealY,state==='locked'?'？':st.seal,D?30:30,state==='locked'?'#8a8172':'#f6dfae',HEADING_FONT).setOrigin(.5).setRotation(-.05);
   this.body.add([seal,sealChar]);
   // 已平定：卡片右下角淡淡的敌将大字水印。
   if(state==='cleared')this.body.add(this.scene.add.text(x+cardW-18,y+cardH-12,st.seal,{fontFamily:TITLE_FONT,fontSize:(D?120:Math.min(110,cardH*.55))+'px',color:'#c79a55',resolution:2}).setOrigin(1,1).setAlpha(.07));
   const tx=x+(D?92:96),locked=state==='locked';
   this.body.add(this.text(tx,y+(D?20:16),st.code+'　'+(locked?'？？？':st.year),12,locked?'#7d7364':'#bfa071'));
   this.body.add(this.text(tx,y+(D?38:34),locked?'未解锁':st.name,D?22:22,locked?'#8a8172':'#f3dfb6',HEADING_FONT));
   const badge=state==='cleared'?'已平定':state==='next'?'待出征':'';
   if(badge)this.body.add(this.text(x+cardW-14,y+(D?20:16),badge,12,state==='cleared'?'#a9d3a0':'#f0c389').setOrigin(1,0).setBackgroundColor('rgba(10,8,5,0.6)').setPadding(6,2));
   this.body.add(this.text(tx,y+(D?70:66),locked?'敌将 · ？？？':'敌将 · '+st.bossTitle+' '+(state==='cleared'?st.boss:'？？？'),13,locked?'#7d7364':'#d2b98c'));
   const lineY=y+(D?100:Math.min(100,cardH*.44));
   const line=this.scene.add.graphics();line.lineStyle(1,0xb69a62,locked?.18:.4).lineBetween(x+16,lineY,x+cardW-16,lineY);this.body.add(line);
   const storyText=state==='cleared'?st.story:state==='next'?'出征并平定此关后，解锁完整史录。':'攻克前一关后解锁此段史录。';
   const lines=Math.max(2,Math.floor((cardH-(lineY-y)-(state==='cleared'?46:20))/19));
   this.body.add(this.text(x+18,lineY+10,storyText,D?13:14,state==='cleared'?'#e2d3b3':'#9b8f7b').setWordWrapWidth(cardW-36,true).setLineSpacing(4).setMaxLines(lines));
   if(state==='cleared')this.body.add(this.text(x+18,y+cardH-(D?32:28),'影响：'+st.legacy,12,'#c9a96a').setWordWrapWidth(cardW-36,true).setMaxLines(D?2:1));
  });
  // 底部操作
  const by=H-(D?36:52);
  const back=homeCommand(this.scene,W/2,by,D?220:240,D?46:54,'返回首页',true);back.hit.setName('chronicle-close').on('pointerdown',()=>this.root.destroy());
  this.body.add([back.g,back.caption,back.hit]);
 }
}
