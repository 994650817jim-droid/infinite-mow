import {playMenuMusic} from '../systems/Music';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {loadWorld,worldUnlocked,recruitReserve,recruitCost} from '../world/WorldStore';
import {TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {v2Filter} from '../systems/ArtStyle';
import {RENDER_SCALE} from '../config';

/** 兵种定位（与战斗中「战地招募」卡的标签一致：ui/LegionUI.ts ROLES）。 */
const ROLES:Record<TroopKind,[string,string]>={
 swordsman:['近战护卫','稳守前线'],spearman:['长枪突刺','克制骑兵'],archer:['远程弓箭','持续支援'],
 crossbowman:['连弩快射','高频压制'],guardian:['重甲大盾','承受伤害'],rider:['高速骑兵','主动冲击'],
 halberdier:['战戟横扫','范围攻击'],medic:['治疗友军','补充续航'],
};
const ROLE_COLOR:Record<TroopKind,string>={swordsman:'#e3a27c',spearman:'#9cc3e6',archer:'#a9d6a0',crossbowman:'#c4dc8f',guardian:'#e0c48a',rider:'#c7b3ef',halberdier:'#ec9c9c',medic:'#9fdcd8'};
/** 本页自带的 v2 兵种行走图（4×4，取「下」行双脚最并拢的一帧当站姿）。不借用战斗图集：进营寨时战斗图集已释放，借用会退回旧 Q 版。 */
const v2Key=(kind:TroopKind)=>`recruit_v2_${kind}`;
const v2Url=(kind:TroopKind)=>`assets/processed-v2/troops/${kind}_walk.png`;

/**
 * 营寨招募（后备兵）：电脑布局 4×2 兵种卡（大幅 v2 形象 + 定位 + 后备 / 价格 + 招募），顶栏写军粮、携带规则与提示；
 * 手机布局沿用原来的两列翻页。招募逻辑与价格在 WorldStore（recruitReserve / recruitCost）。
 */
export class CityRecruitScene extends Phaser.Scene{
 private page=0;private content:Phaser.GameObjects.Container|undefined;private status!:Phaser.GameObjects.Text;private notice!:Phaser.GameObjects.Text;private message='';private owned:string[]=[];
 constructor(){super('CityRecruitScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'city_recruit_art','assets/world/rest-camp.webp');this.owned=[];
  for(const kind of TROOP_KINDS){const key=v2Key(kind);if(!this.textures.exists(key)){this.load.image(key,v2Url(kind));this.owned.push(key);}}}
 create(){playMenuMusic(this);if(!worldUnlocked()&&!isChapterTestRun()){this.scene.start('MenuScene');return;}
  const D=W>600;worldShell(this,'营寨招募');releaseWorldArt(this,'city_recruit_art');
  this.add.image(W/2,H/2,'city_recruit_art').setDisplaySize(Math.max(W,H*1.5),Math.max(H,W/1.5)).setAlpha(.35).setDepth(-1);
  for(const kind of TROOP_KINDS)this.standFrame(v2Key(kind));
  this.events.once('shutdown',()=>{for(const key of this.owned)if(this.textures.exists(key))this.textures.remove(key);});
  // 顶栏：军粮 / 后备 / 携带规则（第一行），提示或招募结果（第二行）——都在卡片区之上，不压卡片
  this.status=worldText(this,D?220:24,D?24:66,'',D?14:13,'#cfdcc6').setWordWrapWidth(D?W-244:W-48).setName('reserve-status');
  this.notice=worldText(this,D?220:24,D?48:110,'',D?13:12,'#d5c5a2').setWordWrapWidth(D?W-244:W-48).setName('reserve-notice');
  if(!D)this.notice.setVisible(false);
  worldButton(this,W/2,H-(D?30:62),'返回义军营寨',()=>this.scene.start('CityScene'),240).image.setName('reserve-home');this.render();}
 /** 「下」行四帧里双脚最并拢的一帧（脚底一带横向跨度最小）作为站姿；读像素失败就用第 0 帧。 */
 private standFrame(key:string){
  if(!this.textures.exists(key))return;const t=this.textures.get(key);if(t.has('stand'))return;
  const src=t.getSourceImage() as HTMLImageElement,cell=src.width/4;let best=0;
  try{const c=document.createElement('canvas');c.width=src.width;c.height=cell;const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(src,0,0);const d=g.getImageData(0,0,src.width,cell).data,foot=cell-8,band=Math.max(4,Math.round(cell*.08));let min=Infinity;
   for(let col=0;col<4;col++){let lo=Infinity,hi=-Infinity;for(let y=foot-band;y<=foot;y++)for(let x=col*cell;x<(col+1)*cell;x++)if(d[(y*src.width+x)*4+3]>24){if(x<lo)lo=x;if(x>hi)hi=x;}const s=hi>=lo?hi-lo:Infinity;if(s<min-1){min=s;best=col;}}}catch{best=0;}
  t.add('stand',0,best*cell,0,cell,cell);t.setFilter(v2Filter(RENDER_SCALE));
 }
 private render(){
  this.content?.destroy(true);this.content=this.add.container(0,0);const s=loadWorld(),D=W>600,total=Object.values(s.reserve).reduce((a,b)=>a+b,0);
  this.status.setText(`军粮 ${s.provisions} · 后备 ${total} 人 · 每次出征最多带 2 名后备 + 军营增援`);
  this.notice.setText(this.message||"新招兵种优先出征，超出编制的士兵继续留守；存活归营，中途放弃不返还。").setColor(this.message?'#f3d48a':'#d5c5a2');
  if(D){this.renderDesktop(s);return;}
  // 手机：两列翻页（布局沿用原版，形象改用 v2）
  this.status.setText(`军粮 ${s.provisions} · 后备 ${total}人\n最多携带2名后备 + 军营增援，存活归营；中途放弃不返还`);
  TROOP_KINDS.slice(this.page*4,this.page*4+4).forEach((kind,i)=>{const width=(W-54)/2,height=230,x=20+(i%2)*(width+10),y=175+Math.floor(i/2)*248;
   const frame=panel(this,x+width/2,y+height/2,width,height),def=TROOPS[kind],icon=this.add.image(x+40,y+70,v2Key(kind),'stand').setOrigin(.5,.6);icon.setScale(80/icon.height);
   const title=worldText(this,x+14,y+14,def.name,17),detail=worldText(this,x+78,y+48,`后备 ${s.reserve[kind]??0}\n${recruitCost(kind,s)}军粮/人`,12,'#bfd0b8').setWordWrapWidth(width-86);
   const btn=worldButton(this,x+width/2,y+height-35,'招募1人',()=>this.buy(kind),width-24);btn.image.setName(`reserve-buy-${kind}`);this.content!.add([frame,icon,title,detail,btn.image,btn.text]);});
  const note=worldText(this,24,H-168,this.message||'新招兵种优先出征，超出编制的士兵继续留守。',12,'#d5c5a2').setWordWrapWidth(W-48);this.content.add(note);
  const button=worldButton(this,W/2,H-118,this.page?'查看前四兵种':'查看后四兵种',()=>{this.page=1-this.page;this.render();},230);this.content.add([button.image,button.text]);
 }
 /** 电脑：4×2 卡片，卡片区 y 78–462，与底部返回按钮（中心 H-30）之间留 ≥24 像素。 */
 private renderDesktop(s:ReturnType<typeof loadWorld>){
  const gap=12,x0=20,y0=78,cw=(W-x0*2-gap*3)/4,ch=186;
  TROOP_KINDS.forEach((kind,i)=>{
   const def=TROOPS[kind],x=x0+(i%4)*(cw+gap),y=y0+Math.floor(i/4)*(ch+gap),[tag,note]=ROLES[kind],have=s.reserve[kind]??0,cost=recruitCost(kind,s);
   const frame=panel(this,x+cw/2,y+ch/2,cw,ch).setName(`reserve-card-${kind}`);
   // 形象：左侧大幅 v2 站姿，脚下一圈淡影
   const shadow=this.add.ellipse(x+58,y+ch-22,78,16,0x000000,.35);
   const icon=this.add.image(x+58,y+ch-16,v2Key(kind),'stand').setOrigin(.5,1);icon.setScale(Math.min(150/icon.height,104/icon.width*1.35));
   // 右栏：名称、定位、后备、价格、招募
   const tx=x+112,tw=cw-122;
   const title=worldText(this,tx,y+14,def.name,18,'#f3dfb2');
   const role=worldText(this,tx,y+42,tag,13,ROLE_COLOR[kind]).setName(`reserve-role-${kind}`);
   const sub=worldText(this,tx,y+62,note,12,'#bfcab6').setWordWrapWidth(tw);
   const stock=worldText(this,tx,y+90,`后备 ${have} 人`,13,have?'#e9dcc0':'#9da592').setName(`reserve-have-${kind}`);
   const price=worldText(this,tx,y+110,`${cost} 军粮 / 人`,13,s.provisions>=cost?'#e8cf8f':'#d4887a').setName(`reserve-cost-${kind}`);
   const btn=worldButton(this,tx+tw/2,y+ch-28,'招募 1 人',()=>this.buy(kind),tw);btn.image.setName(`reserve-buy-${kind}`);
   this.content!.add([frame,shadow,icon,title,role,sub,stock,price,btn.image,btn.text]);
  });
 }
 private buy(kind:TroopKind){this.message=recruitReserve(kind).message;this.render();}
}
