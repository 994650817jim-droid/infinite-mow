import {playMenuMusic,menuMusic} from '../systems/Music';
import {takeDirectDepart} from '../systems/DirectDepart';
import {defaultHero,heroOwned,LOCKED_HINT} from '../systems/RosterStore';
import Phaser from 'phaser';
import {YILING_STAGES,YILING_SHEETS,yilingTexture,type YilingStage} from '../data/yilingChapter';
import {arcUnlocked,arcStageUnlocked,arcStagePlayable,arcStages,loadWorld,alertLossWarning} from '../world/WorldStore';
const yilingOpen=()=>arcUnlocked('yiling'),stageOpen=(n:number)=>arcStagePlayable('yiling',n),stageDone=(n:number)=>arcStages('yiling')>=n;
import {isChapterTestRun} from '../systems/ChapterProgress';
import {CHARACTERS,type CharacterId} from '../data/characters';
import {worldText,W,H} from '../world/WorldUI';
import {TITLE_FONT} from '../config';
import { loadBossSheet } from '../systems/ArtStyle';
import {storyScroll} from '../ui/StoryScroll';
import {IS_DESKTOP} from '../config';
/** 章头剧情卷轴只看一次（开发期不做存档迁移）。 */
const OPEN_KEY='im_story_yiling_open_v1';
type StageCard={bg:Phaser.GameObjects.Rectangle;strip:Phaser.GameObjects.Rectangle;status:Phaser.GameObjects.Text;art:Phaser.GameObjects.Image};
/** 第十章 · 夷陵之战 选关（与第三章选关同一布局）。 */
export class YilingChapterScene extends Phaser.Scene {
 private selected:YilingStage=1;private hero:CharacterId='zhaoyun';private cards:StageCard[]=[];private heroButtons:Phaser.GameObjects.Rectangle[]=[];private deployText!:Phaser.GameObjects.Text;private deployBg!:Phaser.GameObjects.Rectangle;
 constructor(){super('YilingChapterScene');}
 preload(){for(const [key,url] of Object.entries(YILING_SHEETS))if(!this.textures.exists(key))loadBossSheet(this.load,key,url);}
 private text(x:number,y:number,s:string,size=16,color='#ded2b9'){return worldText(this,x,y,s,size,color);}
 private action(x:number,y:number,w:number,h:number,label:string,fn:()=>void,primary=false){const bg=this.add.rectangle(x,y,w,h,primary?0x744530:0x241e1a,.96).setStrokeStyle(1,primary?0xc39b61:0x70604b).setInteractive({useHandCursor:true});const t=this.text(x,y,label,primary?22:17,primary?'#ffdf9d':'#d1c2a7').setOrigin(.5);bg.on('pointerover',()=>bg.setFillStyle(primary?0x8b5438:0x3a2c23)).on('pointerout',()=>bg.setFillStyle(primary?0x744530:0x241e1a)).on('pointerdown',()=>bg.setAlpha(bg.getData('locked')?.3:.7)).on('pointerup',()=>{bg.setAlpha(bg.getData('locked')?.35:1);fn();});return{bg,t};}
 create(){playMenuMusic(this, 'map');
  if(!this.registry.get('battleReady')){this.registry.set('pendingWarlord','YilingChapterScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');return;}
  this.cards=[];this.heroButtons=[];const desk=W>600,state=loadWorld(),test=isChapterTestRun();this.selected=Math.min(3,state.yilingStages+1)as YilingStage;{const pick=Number(this.registry.get('worldStagePick'));this.registry.remove('worldStagePick');if([1,2,3].includes(pick)&&(stageOpen(pick)||test))this.selected=pick as YilingStage;}
  try{this.hero=defaultHero(localStorage.getItem('im_last_hero'));}catch{this.hero=defaultHero(null);}
  // 2026-11-19 用户「打第三章的时候又出现这个老界面了」：电脑版从天下地图 / 选关 / 战役回顾出征时不显示本页（选将 + 选关），直接以主公打选中的关（DIRECT_DEPART，见 systems/DirectDepart.ts）
  if(takeDirectDepart(this)){this.depart();return;}
  this.cameras.main.setBackgroundColor('#191815');
  // Quiet campaign-map lines and mountain silhouettes, all behind interactive content.
  const g=this.add.graphics();g.fillStyle(0x29261f,.6);for(let i=0;i<8;i++)g.fillTriangle(i*W/6-140,H*.62,i*W/6+80,H*.2+(i%3)*44,i*W/6+290,H*.62);
  g.lineStyle(1,0x8a7049,.09);for(let y=110;y<H;y+=40)g.lineBetween(0,y,W,y-90);g.lineStyle(1,0xa98250,.45).lineBetween(28,desk?113:144,W-28,desk?113:144);
  this.text(30,desk?19:24,'征 战  ·  第 十 章',12,'#b69a6b');this.text(28,desk?40:49,'夷陵之战',desk?35:39,'#e8cf98').setFontFamily(TITLE_FONT);
  this.text(30,desk?86:106,'关羽败亡，荆州尽失。先主亲征东吴，猇亭、连营——与陆逊一决。',desk?14:17,'#b9ae99');
  this.action(W-83,desk?48:52,110,40,'返回地图',()=>this.scene.start('WorldMapScene')).bg.setName('yiling-return');
  if(test)this.text(W-30,desk?91:116,'试炼模式 · 全关可选',11,'#b09573').setOrigin(1,0);
  const cardY=desk?135:166,cw=desk?(W-84)/3:W-56,ch=desk?248:170;
  YILING_STAGES.forEach((d,i)=>{
   const x=desk?28+i*(cw+14):28,y=desk?cardY:cardY+i*(ch+14),open=stageOpen(d.stage)||test;
   const bg=this.add.rectangle(x+cw/2,y+ch/2,cw,ch,0x29231d,.94).setStrokeStyle(1,0x6a5740).setName('yiling-stage-'+d.stage).setInteractive({useHandCursor:open});
   const strip=this.add.rectangle(x+2,y+ch/2,3,ch-4,0xc8a468).setOrigin(0,.5);
   this.add.rectangle(x+cw/2,y+ch-22,cw-2,42,0x120f0d,.48);
   this.text(x+17,y+14,'0'+d.stage+'  /  '+d.tag,12,'#b2956d');
   const art=this.add.image(desk?x+cw-76:x+cw-73,desk?y+105:y+76,yilingTexture(d.id),0).setDisplaySize(desk?142:126,desk?142:126).setAlpha(open?1:.3);
   this.text(x+17,desk?y+145:y+47,d.name,desk?26:27,open?'#f0dfbb':'#9c9281');
   this.text(x+18,desk?y+182:y+88,open?d.boss+' · '+d.feature:stageDone(d.stage)?d.boss+' · 已平定':'战报未至 · 待前关告捷',desk?13:15,'#baad94');
   const status=this.text(x+cw-16,y+ch-22,'',13).setOrigin(1,.5);
   this.text(x+17,y+ch-22,'10-'+d.stage,13,'#9a8666').setOrigin(0,.5);
   bg.on('pointerover',()=>{if(open)bg.setFillStyle(0x3a2e23);}).on('pointerout',()=>this.refresh()).on('pointerdown',()=>{if(open){this.selected=d.stage;this.refresh();}});
   this.cards.push({bg,strip,status,art});
  });
  const hy=desk?431:787;
  this.text(30,desk?397:735,'出战武将',13,'#b6a07b');this.text(W-30,desk?397:735,'点击更换 · 不影响征程进度',11,'#8f8473').setOrigin(1,0);
  CHARACTERS.forEach((c,i)=>{const w=(W-50-5*CHARACTERS.length)/CHARACTERS.length,x=28+i*(w+5),a=this.action(x+w/2,hy,w,desk?42:55,c.name,()=>{if(!heroOwned(c.id))return;this.hero=c.id;this.refresh();});a.bg.setName('yiling-hero-'+c.id);if(!heroOwned(c.id)){a.bg.setAlpha(.35).setData('locked',LOCKED_HINT);a.t.setAlpha(.35);}this.heroButtons.push(a.bg);});
  g.lineStyle(1,0x8b704a,.45).lineBetween(28,desk?466:838,W-28,desk?466:838);
  const a=this.action(desk?W-178:W/2,desk?503:885,desk?300:W-56,desk?50:62,'',()=>this.depart(),true);this.deployBg=a.bg.setName('yiling-deploy');this.deployText=a.t;
  {const warn=isChapterTestRun()?'':alertLossWarning();if(warn)this.text(desk?W-178:W/2,desk?459:826,warn,desk?11:12,'#ff8a70').setOrigin(.5).setName('chapter-alert-warning');}
  if(desk)this.text(30,488,'军旗所向 · 率众再征',15,'#b8a17d');
  this.text(desk?30:W/2,desk?512:934,'关间可休整 · 成长与部队随军继承',11,'#8f8473').setOrigin(desk?0:.5,0);this.refresh();
  let seen=true;try{seen=localStorage.getItem(OPEN_KEY)==='1';}catch{}
  if(!seen)this.openStory();
 }
 /** 第十章开篇：为关羽报仇，先主东征；交代「火势蔓延」玩法。 */
 openStory(){const lord=CHARACTERS.find(c=>c.id===this.hero)?.name??'主公';
  storyScroll(this,W,H,IS_DESKTOP,{name:'story-yiling-open',confirmName:'story-yiling-open-confirm',kicker:'第十章 · 夷陵之战',title:'东征孙吴',
   lines:[{text:'章武元年，荆州尽归东吴。关羽虽杀出麦城，荆襄将士死伤殆尽。先主悲愤，倾国东征。'},
    {who:'秦宓',text:'国贼是曹丕，非孙权也。主公三思！'},
    {who:lord,text:'荆州之失、麦城之辱不雪，何以立于天地之间？传令：顺江东下，直取猇亭！'},
    {text:'本章前两关我军攻势：砍倒吴军军旗、拆掉吴军营帐。第三关陆逊「火烧连营」：看风向箭头，火往箭头方向烧，往上风口退；营帐着火会一烧一片。'}],
   reward:'本章玩法：火势蔓延',confirm:'东征孙吴',background:'rest_camp',onDone:()=>{try{localStorage.setItem(OPEN_KEY,'1');}catch{}}});}
 private depart(){if(!stageOpen(this.selected)&&!isChapterTestRun())return;if(!isChapterTestRun())try{localStorage.setItem('im_last_hero',this.hero);}catch{}this.registry.remove('campaignTransfer');this.registry.remove('yilingTransfer');this.registry.set('yilingStage',this.selected);this.registry.set('runConfig',{character:this.hero,thirdStage:this.selected});this.scene.start('YilingGameScene');}
 private refresh(){const save=loadWorld(),test=isChapterTestRun();this.cards.forEach((c,i)=>{const open=stageOpen(i+1)||test,chosen=this.selected===i+1;c.bg.setFillStyle(chosen?0x413020:0x29231d).setStrokeStyle(chosen?2:1,chosen?0xd7b778:0x65543f);c.strip.setVisible(chosen);c.status.setText(save.yilingStages>=i+1?'✓ 已告捷':!open?!yilingOpen()?'锁定 · 襄樊告捷':'锁定 · 完成前关':chosen?'◆ 当前出征':'可出征').setColor(chosen?'#f0ce8f':'#a99c86');});this.heroButtons.forEach((h,i)=>h.setFillStyle(CHARACTERS[i].id===this.hero?0x51402b:0x241e1a).setStrokeStyle(1,CHARACTERS[i].id===this.hero?0xd7b778:0x70604b).setAlpha(h.getData('locked')?.35:1));this.deployText.setText('出征  ·  '+YILING_STAGES[this.selected-1].name);}
}
