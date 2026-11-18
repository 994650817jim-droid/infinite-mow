import {playMenuMusic} from '../systems/Music';
import {defaultHero} from '../systems/RosterStore';
import {checkWorld} from '../systems/Achievements';
import {RENDER_SCALE,screenPoint,TITLE_FONT,HEADING_FONT} from '../config';
import {thirdChapterUnlocked,arcUnlocked} from '../world/WorldStore';
/** 群雄篇章节点：是否开放、未开放提示、进入的选关场景。 */
const CAMPAIGNS={qunxiong:{open:()=>thirdChapterUnlocked(),hint:'通关虎牢关后解锁',scene:'ThirdChapterScene'},guandu:{open:()=>arcUnlocked('guandu'),hint:'平定群雄割据后解锁',scene:'GuanduChapterScene'},chibi:{open:()=>arcUnlocked('chibi'),hint:'官渡之战告捷后解锁',scene:'ChibiChapterScene'},yiling:{open:()=>arcUnlocked('yiling'),hint:'襄樊之战后解锁',scene:'YilingChapterScene'},nanzheng:{open:()=>arcUnlocked('nanzheng'),hint:'夷陵之战告捷后解锁',scene:'NanzhengChapterScene'},beifa:{open:()=>arcUnlocked('beifa'),hint:'南征告捷后解锁',scene:'BeifaChapterScene'},xiangfan:{open:()=>arcUnlocked('xiangfan'),hint:'汉中之战告捷后解锁',scene:'XiangfanChapterScene'},shu:{open:()=>arcUnlocked('shu'),hint:'平定荆南后解锁',scene:'ShuChapterScene'},jingnan:{open:()=>arcUnlocked('jingnan'),hint:'赤壁之战告捷后解锁',scene:'JingnanChapterScene'},hanzhong:{open:()=>arcUnlocked('hanzhong'),hint:'入蜀告捷后解锁',scene:'HanzhongChapterScene'}} as const;
import {isChapterTestRun} from '../systems/ChapterProgress';
import {worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {inkPlate,homeCommand} from '../ui/HomeCommand';
import {lqPanel} from '../ui/LacquerKit';
type InkBtn={btn:ReturnType<typeof worldButton>;plate:Phaser.GameObjects.NineSlice|null;primary:boolean;hover:boolean};
import {WORLD_NODES,type WorldNode} from '../world/WorldNodes';
import {loadWorld,rewardGrain} from '../world/WorldStore';
import {citySize,CITY_TITLE} from '../town/TownData';
import {incomeText} from "../town/TownData";
import {cityIncome,emptyCityLevels} from "../data/cityBuildings";
import {cityLevels} from "../world/WorldStore";
import {chapterUnlocked} from '../systems/ChapterProgress';
import {CITIES,CITY_LINKS,CITY_INCOME,FACTIONS,HOME,SPECIALTIES,TIER_NAME,cityAttackable,cityById,cityOwner,eraDef,eraIndexFor,territorySummary,type CityDef,type EraId} from '../world/WorldCities';
import {cityMarker,factionLegend,markAlert,paintSelection,MARKER_FILES,type CityMarker} from '../world/WorldMapLayers';
import {CITY_ART_FILES,MARKERS_V2,cityMarkerV2,siegeArtV2,intelGlyphPos,intelPennant,nodeMarkerV2,paintSelectionV2,sealGraphics} from '../world/WorldMarkers';
import {REALM_V2,buildTerritory} from '../world/WorldTerritory';
import {factionCorner,factionStrip,lacquerPlate,ownerSeal,realmLabels,resourceBar,sealGlyph} from '../world/WorldMapChrome';
import {advanceEra,takeLostNotice,takeNewChapters,type CityAlert,type EraAdvance} from '../world/WorldStore';
import {CHAPTER_TIMELINE,CHAPTER_REGIONS,CITY_CHAPTER,STAGE_POINTS,chapterById,chapterIntro,chapterStages,chapterState,chapterStagesDone,citySiegeOpen,currentChapter,stageOpen,type ChapterState,type TimelineChapterId} from '../world/ChapterTimeline';
import {HARD_MODE,HARD_TITLES} from '../data/hardMode';
import {hardChapterCleared} from '../world/WorldStore';
import {defenseBossName} from '../data/siege';
import {SIEGE,FIRST_CAPTURE_BONUS,siegeBossName} from '../data/siege';
import {CHARACTERS,type CharacterId} from '../data/characters';
import {ensureIntel,intelEvents,lubuChallengeOpen,lubuClears} from '../world/WorldStore';
import {LUBU_CHALLENGE} from '../data/dongzhuo';
import {INTEL_INFO,intelBrief,intelReward,intelTitle,seasonIndex,type IntelEvent} from '../world/WorldIntel';
import {QUALITIES} from '../data/items';

/** 按字数折行（中文无空格），行首不落标点。 */
function wrapCJK(text:string,per:number):string{const out:string[]=[];let line='';for(const ch of text){if(line.length>=per&&!'，。、；：！？）」』”'.includes(ch)){out.push(line);line='';}line+=ch;}if(line)out.push(line);return out.join('\n');}
type Selection={kind:'node';node:WorldNode}|{kind:'city';city:CityDef}|{kind:'stage';chapter:TimelineChapterId;stage:number}|{kind:'intel';event:IntelEvent};
type IntelMarker={event:IntelEvent;city:CityDef;root:Phaser.GameObjects.Container;ring:Phaser.GameObjects.Arc};
/** 城池在地图上的可攻状态（2026-11-18 用户「让玩家更加清晰哪个地方可以进攻」）。 */
type CityStatus={kind:'own'|'alert'|'attack'|'gate'|'far'|'fog';reason:string};
type FogState='clear'|'dim'|'hidden';type FogPt={x:number;y:number;r:number;a:number;f:number};
/**
 * 宏大版天下地图（2026-11-18 用户「天下地图可以做宏大点」）：Gemini 3.1 Pro 以旧战略图为布局参考 1:1 重绘的东汉舆图，
 * 放大到 4608×3072 切 3×3 块（public/assets/world/grand/），按镜头范围按需载入；低清总图 overview 先垫底。?map=v1 回旧图。
 * 坐标空间不变（1536×1024 地图像素），城池 / 章节 / 关卡点一一沿用，tools/test-grand-map.mjs 校验。
 */
export const GRAND_MAP=(()=>{try{return new URLSearchParams(location.search).get('map')!=='v1';}catch{return true;}})();
const TILE_COLS=3,TILE_ROWS=3;
/** 镜头三档（相对铺满视口的最小缩放）：全国 / 州郡 / 城池。城池档地图约 3.5 倍屏宽。 */
export const ZOOM_TIERS=[1,2,3.6] as const,ZOOM_NAMES=['全国','州郡','城池'] as const;
/** 城池挖雾半径（地图像素）。 */
const FOG_R={large:135,medium:115,small:95} as const,CHAPTER_R=120;
const TIER_RANK={small:0,medium:1,large:2} as const,TIER_STARS={small:'★☆☆',medium:'★★☆',large:'★★★'} as const;

/**
 * 天下地图：原画地图 + 势力领地染色 + 三档城池标记 + 战役节点。
 * W1：城池可查看归属、时代、相邻与可攻打状态；攻城战在 W2 开放。
 */
export class WorldMapScene extends Phaser.Scene {
 private layer!:Phaser.GameObjects.Container;private selected:Selection={kind:'node',node:WORLD_NODES[0]};private detail!:Phaser.GameObjects.Text;private detailTitle!:Phaser.GameObjects.Text;private detailRule!:Phaser.GameObjects.Graphics;private seal!:ReturnType<typeof ownerSeal>;private detailBox={x:0,y:0,w:0};private action!:ReturnType<typeof worldButton>;
 private markers:Array<{node:WorldNode;root:Phaser.GameObjects.Container}>=[];private cityMarkers:CityMarker[]=[];private links!:Phaser.GameObjects.Graphics;private legend?:Phaser.GameObjects.Container;
 private era:EraId=1;private owned:string[]=[];private capturedEver:string[]=[];private siegeModal?:Phaser.GameObjects.Container;private territory?:Phaser.GameObjects.Container;private alerts:CityAlert[]=[];private notice?:Phaser.GameObjects.Container;
 /** 章节时间线条（地图下方）：按史事顺序的五章，点选即聚焦对应战役节点。 */
 /** 选中章节的三关路线：屏幕坐标关卡标记 + 虚线路线（随地图平移缩放重排）。 */
 private pins:Array<{stage:number;x:number;y:number;root:Phaser.GameObjects.Container}>=[];private route?:Phaser.GameObjects.Graphics;private routeChapter?:TimelineChapterId;private mapMask?:Phaser.GameObjects.Graphics;
 /** 「天下未定」纸雾（地图像素坐标的 RenderTexture，随章节开放揭开）。 */
 private tilesArmed=false;private tiles:Array<{r:number;c:number;img?:Phaser.GameObjects.Image;loading:boolean}>=[];private tierLabel?:Phaser.GameObjects.Text;private lastTap={id:'',t:0};private legendRect?:Phaser.Geom.Rectangle;private factionBtn?:Phaser.GameObjects.Text;
 private fogImg?:Phaser.GameObjects.Image;private fogStamp?:Phaser.GameObjects.Image;private fogKey='';private fogPainted=false;private fogVis=new Map<string,FogState>();private hardBtn!:ReturnType<typeof worldButton>;private actionHome={x:0,y:0,w:0};
 /** 军情事件标记（城池右上方的小印）。 */
 private intel:IntelEvent[]=[];private intelMarkers:IntelMarker[]=[];
 private chips:Array<{id:TimelineChapterId;node:WorldNode;g:Phaser.GameObjects.Graphics;x:number;y:number;w:number;h:number;state:ChapterState}>=[];
 /** 电脑版（2026-11-17 用户「这里太乱了…看到的地图太小了」）：右下角小卡 + 悬停提示 + 细时间线。 */
 private card?:{x:number;y:number;w:number;h:number};private tip?:Phaser.GameObjects.Container;private detailFull='';private factionStripC?:Phaser.GameObjects.Container;private timelineRect?:Phaser.Geom.Rectangle;private inks:InkBtn[]=[];private detailView?:Phaser.GameObjects.Text;
 private area={x:20,y:110,w:W-40,h:H-360};private viewBottom=0;private timelineY=0;private detailPh=0;private minZoom=1;private zoom=1;private pointerX=0;private pointerY=0;private pinch=0;private pinching=false;private readonly mapW=1536;private readonly mapH=1024;
 /** 可攻标记 / 不可攻原因 / 「下一步」引导（2026-11-18）。 */
 private status=new Map<string,CityStatus>();private guide?:Phaser.GameObjects.Graphics;private guideLabel?:Phaser.GameObjects.Container;private guideTarget?:{x:number;y:number;from:{x:number;y:number};text:string;id:string};
 constructor(){super('WorldMapScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'strategy_art',GRAND_MAP?'assets/world/grand/overview.webp':'assets/world/strategy-map.webp');if(GRAND_MAP)worldAssets(this,'world_water','assets/world/grand/water_mask.png');if(GRAND_MAP&&!this.textures.exists('wgrand_banner'))this.load.spritesheet('wgrand_banner','assets/world/grand/banner_wave.png',{frameWidth:192,frameHeight:128});
  // W5 城池徽框与军旗（缩小显示，用线性过滤）
  for(const [key,url] of Object.entries(MARKER_FILES))worldAssets(this,key,url);
  if(MARKERS_V2)for(const [key,url] of Object.entries(CITY_ART_FILES))worldAssets(this,key,url);
  // 战争迷雾手绘素材（Gemini 3.1 Pro，public/assets/world/fog/originals/PROMPTS.md）
  worldAssets(this,'wfog_tile','assets/world/fog/fog_tile.webp');for(const [k,f] of [['wfog_brush','fog_brush.png'],['wfog_disperse','fog_disperse.png']] as const)if(!this.textures.exists(k))this.load.spritesheet(k,'assets/world/fog/'+f,{frameWidth:256,frameHeight:256});
  this.load.once('complete',()=>{for(const key of [...Object.keys(MARKER_FILES),...Object.keys(CITY_ART_FILES)])if(this.textures.exists(key))this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);});}
 create(){playMenuMusic(this);try{checkWorld(loadWorld());}catch{/* 存档不可用 */}
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}const shellTitle=worldShell(this,this.registry.get('worldReveal')?'三国天下开启':'三国天下');if(W>600)shellTitle.setFontFamily(TITLE_FONT).setFontSize(22).setColor('#efd399').setOrigin(0,.5).setPosition(16,25).setStroke('#120904',4);if(this.registry.get('worldReveal')){this.registry.remove('worldReveal');this.cameras.main.fadeIn(900,0,0,0);}releaseWorldArt(this,'strategy_art');this.markers=[];this.cityMarkers=[];this.legend=undefined;this.inks=[];this.detailView=undefined;this.timelineRect=undefined;this.card=undefined;
  this.siegeModal=undefined;this.territory=undefined;this.notice=undefined;this.pins=[];this.route=undefined;this.routeChapter=undefined;this.fogImg=undefined;this.fogStamp=undefined;this.fogKey='';this.fogVis=new Map();this.status=new Map();this.guide=undefined;this.guideLabel=undefined;this.guideTarget=undefined;this.registry.remove('hardChapter');const advance=isChapterTestRun()?null:advanceEra(),lost=isChapterTestRun()?[]:takeLostNotice();if(!isChapterTestRun())ensureIntel();const s=loadWorld();this.intel=intelEvents();this.intelMarkers=[];this.owned=s.ownedCities;this.alerts=s.alerts;this.capturedEver=s.capturedEver;this.era=!s.cleared.hulao?0:eraIndexFor({hulaoCleared:s.cleared.hulao,warlordStages:s.warlordStages,guanduStages:s.guanduStages});
  const desktop=W>600;
  // 顶部资源栏（军粮 / 城池），漆底描金
  const res=resourceBar(this,desktop?shellTitle.x+shellTitle.width+12:24,desktop?25:88,[{glyph:"粮",label:"军粮",value:s.provisions,tint:0x7a5a22},{glyph:'城',label:'城池',value:this.owned.length,tint:0x2f6b45}],desktop);
  {const back=worldButton(this,desktop?W-74:W-105,desktop?25:43,"返回营寨",()=>this.scene.start("CityScene"),desktop?132:150);if(desktop){back.image.setDisplaySize(132,40);back.text.setFontSize(15);back.image.setName('world-back');}} // 2026-11-18 用户嫌水墨特效多：本界面只留出征主按钮一处笔刷，返回用漆底描金
  // 2026-11-16 用户反馈「大地图画面大点，下面的说明可以透明」：地图一直铺到屏幕底边，
  // 章节时间线与详情面板改为半透明漆底浮在地图上；viewBottom 以下（被浮层盖住的部分）不放标记、不接拖动。
  this.detailPh=desktop?124:244;const detailTop=H-(desktop?6:36)-this.detailPh;
  this.area=desktop?{x:8,y:50,w:W-16,h:H-50-8}:{x:20,y:118,w:W-40,h:H-12-118};
  this.timelineY=detailTop-(desktop?40+6:54+8);this.viewBottom=this.timelineY-4;
  // 电脑版：地图铺满顶栏以下（约 89% 高），时间线与详情改成浮在地图角上的小件，标记一直排到地图底边
  if(desktop){this.timelineY=H-8-30;this.viewBottom=H-8;}
  this.layer=this.add.container(0,0);this.layer.add(this.add.image(0,0,'strategy_art').setOrigin(0).setDisplaySize(this.mapW,this.mapH).setName('world-base'));
  this.tiles=[];this.tilesArmed=false;this.legendRect=undefined;this.tierLabel=undefined;if(GRAND_MAP)for(let r=0;r<TILE_ROWS;r++)for(let c=0;c<TILE_COLS;c++)this.tiles.push({r,c,loading:false});
  // 势力范围：加权分区疆域 + 国界 / 郡界 + 疆域大字（随地图缩放）
  // 刚攻下的城（攻城结算写 registry mapCaptured）：先算出攻下前的疆域，演出时由旧疆域淡入新疆域
  const capId=String(this.registry.get('mapCaptured')??'');this.registry.remove('mapCaptured');const captured=!isChapterTestRun()&&this.owned.includes(capId)?cityById(capId):undefined;const prevRealm:Phaser.GameObjects.Image[]=[],nowRealm:Phaser.GameObjects.Image[]=[];
  if(captured){const old=buildTerritory(this,this.era,this.owned.filter(id=>id!==captured.id));for(const k of ['realm_prev_fx','realm_prev_fx_player'])if(this.textures.exists(k))this.textures.remove(k);this.textures.renameTexture(old.key,'realm_prev_fx');if(this.textures.exists(old.key+'_player'))this.textures.renameTexture(old.key+'_player','realm_prev_fx_player');}
  const realm=buildTerritory(this,this.era,this.owned);nowRealm.push(this.add.image(0,0,realm.key).setOrigin(0).setDisplaySize(this.mapW,this.mapH).setName('world-realm'));
  if(REALM_V2&&this.textures.exists(realm.key+'_player'))nowRealm.push(this.add.image(0,0,realm.key+'_player').setOrigin(0).setDisplaySize(this.mapW,this.mapH).setBlendMode(Phaser.BlendModes.ADD).setName('world-realm-player'));
  this.layer.add(nowRealm);
  if(captured){prevRealm.push(this.add.image(0,0,'realm_prev_fx').setOrigin(0).setDisplaySize(this.mapW,this.mapH).setName('world-realm-prev'));if(REALM_V2&&this.textures.exists('realm_prev_fx_player'))prevRealm.push(this.add.image(0,0,'realm_prev_fx_player').setOrigin(0).setDisplaySize(this.mapW,this.mapH).setBlendMode(Phaser.BlendModes.ADD));this.layer.add(prevRealm);for(const o of nowRealm)o.setAlpha(0);}
  {const rl=realmLabels(this,realm.labels);if(desktop)for(const t of rl)if(t.name!=='realm-player')t.setAlpha(.3).setScale(.8); /* 电脑版：势力大字淡一些、小一些，不压关卡印 */this.layer.add(rl);}
  this.buildFog();
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.area.x,this.area.y,this.area.w,this.area.h);
  this.layer.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());this.mapMask=mask;
  // 选中城池时显示其道路相邻（屏幕坐标）
  this.links=this.add.graphics();this.links.setMask(mask.createGeometryMask());
  for(const city of CITIES){const m=(MARKERS_V2?cityMarkerV2:cityMarker)(this,city,cityOwner(city.id,this.era,this.owned));m.hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;const now=this.time.now,dbl=this.lastTap.id===city.id&&now-this.lastTap.t<350;this.lastTap={id:city.id,t:now};this.selected={kind:'city',city};this.refresh();if(dbl)this.flyTo(city.x,city.y,this.minZoom*ZOOM_TIERS[2]);});if(this.alertFor(city.id)){markAlert(this,m);if(MARKERS_V2)siegeArtV2(this,m);}this.cityMarkers.push(m);}
  // 纸雾下的城池：不显示、不可点（已占 / 告急城池始终可见）
  for(const m of this.cityMarkers){const fog=this.fogVis.get(m.city.id)??'clear';m.root.setData('fog',fog).setData('fogged',fog==='hidden');}
  this.paintCityStatus();
  const current=currentChapter(s).id;
  // 第一章后初入天下：营寨上挂“你的营寨”提示，直到第一次进营（CityScene 记 im_home_seen）
  let homeIntro=false;try{homeIntro=localStorage.getItem("im_home_seen")!=="1"&&!isChapterTestRun();}catch{homeIntro=false;}
  const homeSize=citySize(s.town);
  for(const node of WORLD_NODES){const st=this.nodeState(node),active=st!=='locked',info=this.chapterOf(node),color=st==='home'?0x88c5a4:st==='cleared'?0x9fd18a:active?0xe5c47d:0x747a6f;
   const marker=this.add.container(0,0);
   // 当前该打的一章：金色脉冲圈
   if(st==='open'&&info?.id===current){const ring=(MARKERS_V2?this.add.ellipse(0,6,40,14):this.add.circle(0,0,18)).setStrokeStyle(3,0xffd27a,.9).setName(`node-pulse-${node.id}`);marker.add(ring);this.tweens.add({targets:ring,scale:1.8,alpha:0,duration:1300,repeat:-1,ease:'Sine.easeOut'});}
   const glyphText=st==='home'?'营':st==='cleared'?'捷':active?'战':'锁',labelText=info?`${info.numeral} · ${node.name}`:st==='home'&&homeSize>1?`义军${CITY_TITLE[homeSize]}`:node.name;
   if(st==='home'&&homeIntro){const ring=(MARKERS_V2?this.add.ellipse(0,6,46,16):this.add.circle(0,0,20)).setStrokeStyle(3,0x9fe0b4,.95).setName('home-pulse');marker.add(ring);this.tweens.add({targets:ring,scale:1.9,alpha:0,duration:1200,repeat:-1,ease:'Sine.easeOut'});
    const tip=worldText(this,0,-56,'你的营寨 · 点此进入',13,'#eaffd8').setOrigin(.5).setBackgroundColor('#1d3a26e6').setPadding(8,4,8,4).setName('home-intro-tip');marker.add(tip);this.tweens.add({targets:tip,y:-61,yoyo:true,repeat:-1,duration:700,ease:'Sine.easeInOut'});}
   // v2：牙旗 / 营帐 + 名牌；命中区沿用 node-<id>
   const v2=MARKERS_V2?nodeMarkerV2(this,st,glyphText,labelText,active):null;
   const circle=(v2?v2.hit:this.add.circle(0,0,18,st==='cleared'?0x3a2a12:0x16271e,.94).setStrokeStyle(2,color)).setInteractive({useHandCursor:true}).setName(`node-${node.id}`).setData('state',st);
   const icon=v2?null:worldText(this,0,0,glyphText,13,st==='cleared'?'#ffe7a8':active?'#f5dc9e':'#a4aa9c').setOrigin(.5);
   const label=v2?null:worldText(this,0,25,labelText,13,active?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   circle.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'node',node};this.refresh();});marker.add(v2?[...v2.parts,circle]:[circle,icon!,label!]);if(v2)marker.setData('label',v2.label).setData('plate',v2.plate).setData('icon',v2.icon);marker.setData('locked',st==='locked');this.markers.push({node,root:marker});
  }
  for(const event of this.intel){const city=cityById(event.city);if(city)this.intelMarkers.push(this.intelMarker(event,city));}
  this.minZoom=Math.max(this.area.w/this.mapW,this.area.h/this.mapH);this.zoom=this.minZoom*(desktop?ZOOM_TIERS[1]:1.2);
  this.layer.setScale(this.zoom).setPosition(W/2-this.mapW*.52*this.zoom,(this.area.y+this.viewBottom)/2-this.mapH*.45*this.zoom);this.clampMap();
  const inside=(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);return p.x>=this.area.x&&p.x<=this.area.x+this.area.w&&p.y>=this.area.y&&p.y<=this.viewBottom;};
  this.input.on('pointerdown',(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);this.pointerX=p.x;this.pointerY=p.y;this.pinch=0;this.pinching=false;});
  this.input.on('pointermove',(q:Phaser.Input.Pointer)=>{if(!q.isDown||!inside(q))return;const p=screenPoint(q),a=this.input.manager.pointers.filter(o=>o.isDown&&inside(o)).map(screenPoint);if(a.length>=2){this.pinching=true;const distance=Phaser.Math.Distance.Between(a[0].x,a[0].y,a[1].x,a[1].y);if(this.pinch>0)this.setZoom(this.zoom*distance/this.pinch,(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);this.pinch=distance;}else{this.pinch=0;this.layer.x+=p.x-this.pointerX;this.layer.y+=p.y-this.pointerY;this.clampMap();}this.pointerX=p.x;this.pointerY=p.y;});
  // 滚轮按档缩放（全国 / 州郡 / 城池），以鼠标处为中心平滑过渡；双指仍连续缩放
  this.input.on('wheel',(q:Phaser.Input.Pointer,_objs:unknown,_dx:number,dy:number)=>{const p=screenPoint(q);if(inside(q))this.stepTier(dy>0?-1:1,p.x,p.y);});
  // 地图外框：描金细线
  const frame=this.add.graphics();frame.lineStyle(2,0xc9a35e,.9).strokeRect(this.area.x-1,this.area.y-1,this.area.w+2,this.area.h+2).lineStyle(1,0x000000,.6).strokeRect(this.area.x-4,this.area.y-4,this.area.w+8,this.area.h+8);
  // 详情面板：漆底描金 + 势力旗印 + 标题 / 势力色分隔线 / 正文
  const cw=300,ch=128,cx0=W-8-cw-8,cy0=H-8-ch-8;if(desktop)this.card={x:cx0,y:cy0,w:cw,h:ch};
  const ph=this.detailPh,py=desktop?cy0+ch-30:H-36-ph/2,top=desktop?cy0:py-ph/2;
  // 半透明漆底：地图从下面透出来，字仍清楚（字带描边）
  const plate=this.add.graphics().setName('world-card-plate');if(desktop)lacquerPlate(plate,cx0,cy0,cw,ch,.95);else lacquerPlate(plate,20,top,W-40,ph,.72);
  const sealSize=desktop?34:58;this.seal=ownerSeal(this,desktop?cx0+12+sealSize/2:W-40-sealSize/2-14,desktop?cy0+12+sealSize/2:top+sealSize/2+14,sealSize);
  const tx=desktop?cx0+12+sealSize+10:40;this.detailBox={x:tx,y:top,w:desktop?cx0+cw-12-tx:W-80-sealSize-16};
  this.detailTitle=worldText(this,tx,top+(desktop?10:12),'',desktop?16:22,'#f6dc9a').setName('world-detail-title');if(desktop)this.detailTitle.setFontFamily(HEADING_FONT).setStroke('#120904',3);
  this.detailRule=this.add.graphics();
  this.detail=worldText(this,tx,top+(desktop?36:50),'',desktop?12:15,'#e4dcc4').setWordWrapWidth(desktop?cx0+cw-12-tx:W-80-sealSize-16,true).setLineSpacing(desktop?2:4);if(desktop){this.detailView=worldText(this,this.detail.x,this.detail.y,'',12,'#e4dcc4').setLineSpacing(2).setName('world-detail-view');this.detail.setVisible(false);} // 电脑版：detail 保留全文（逻辑 / 测试读取），小卡只显示前两行
  // 电脑版小卡只写两行；鼠标移到卡上看全文（如「战斗中的随军粮只在本局有效…」）
  if(desktop){const hit=this.add.rectangle(cx0+cw/2,cy0+(ch-56)/2,cw,ch-56,0,.001).setInteractive().setName('world-card');hit.on('pointerover',()=>this.showTip(this.detailFull,cx0+cw,cy0-6,1)).on('pointerout',()=>this.hideTip());}
  this.action=worldButton(this,desktop?cx0+cw/2:W/2,desktop?py:H-36-38,"进入营寨",()=>{if(this.selected.kind==='city'){const c=this.selected.city,alert=!!this.alertFor(c.id);if(!alert&&this.owned.includes(c.id)){this.scene.start('TownScene',{city:c.id});return;}this.openSiege(c,alert);}else if(this.selected.kind==='intel')this.openIntel(this.selected.event);else this.launch(false);},desktop?cw-24:W-100);this.action.image.setName('map-action');this.actionHome={x:this.action.image.x,y:this.action.image.y,w:desktop?cw-24:W-100};
  this.hardBtn=worldButton(this,this.actionHome.x,this.actionHome.y,'乱世难度',()=>this.launch(true),this.actionHome.w);this.hardBtn.image.setName('map-hard').setTint(0xd98a6a);this.hardBtn.text.setColor('#2a0d08');if(desktop){this.inkify(this.action,true);this.inkify(this.hardBtn,false);}
  // 缩放按钮在地图标记之上（关卡印 / 令旗的深度 3–5）
  for(const b of [worldButton(this,desktop?W-34:W-55,this.area.y+(desktop?26:35),'＋',()=>this.stepTier(1,W/2,(this.area.y+this.viewBottom)/2),desktop?38:48),worldButton(this,desktop?W-34:W-55,this.area.y+(desktop?70:107),'－',()=>this.stepTier(-1,W/2,(this.area.y+this.viewBottom)/2),desktop?38:48)]){b.image.setDepth(8);b.text.setDepth(9);}
  // 当前镜头档位小字（＋－ 下方）
  {const t=worldText(this,desktop?W-34:W-55,this.area.y+(desktop?100:140),'',11,'#efe0b4').setOrigin(.5).setPadding(6,3).setDepth(9).setName('world-zoom-tier');const g=this.add.graphics().setDepth(8);this.tierLabel=t;t.setData('plate',g);this.paintTier();}
  // 年号与时代：点击展开势力图例
  const resRight=desktop?res.getBounds().right+12:0;
  const era=eraDef(this.era),chipG=this.add.graphics(),chip=worldText(this,desktop?resRight:this.area.x+12,desktop?12:this.area.y+12,`公元${era.year}年 · ${era.name}  ▾`,desktop?13:16,'#f6dc9a').setPadding(desktop?10:12,desktop?5:7).setInteractive({useHandCursor:true}).setName('world-era');
  chip.on('pointerup',()=>this.toggleLegend());
  // 领地：城池数、每次出征产出、生效特产
  const land=worldText(this,chip.x+chip.width+8,chip.y,`领地 ${this.owned.length}  ▾`,desktop?13:16,'#bff0c8').setPadding(desktop?10:12,desktop?5:7).setInteractive({useHandCursor:true}).setName('world-territory');
  land.on('pointerup',()=>this.toggleTerritory());
  const intelChip=this.intel.length?worldText(this,land.x+land.width+8,chip.y,`军情 ${this.intel.length}  ▸`,desktop?13:16,'#ffc49a').setPadding(desktop?10:12,desktop?5:7).setInteractive({useHandCursor:true}).setName('world-intel'):null;
  intelChip?.on('pointerup',()=>this.nextIntel());
  lacquerPlate(chipG,chip.x,chip.y,chip.width,chip.height,.9);lacquerPlate(chipG,land.x,land.y,land.width,land.height,.9,0x7fc48f);if(intelChip){lacquerPlate(chipG,intelChip.x,intelChip.y,intelChip.width,intelChip.height,.9,0xd0704a);intelChip.setDepth(1);}chipG.setDepth(chip.depth);chip.setDepth(1);land.setDepth(1);
  // 底边：势力排行（按城池数）+ 操作提示
  if(desktop){const last=intelChip??land,fb=worldText(this,last.x+last.width+8,chip.y,'势力  ▾',13,'#f2e6c8').setPadding(10,5).setInteractive({useHandCursor:true}).setName('world-factions');lacquerPlate(chipG,fb.x,fb.y,fb.width,fb.height,.9,0xc9a35e);fb.setDepth(1);
   // 2026-11-18：势力图例放地图左上角竖排（各势力色块 + 城数），默认展开、点「势力」收起；收起状态记在本机
   let open=true;try{open=localStorage.getItem('im_world_legend')!=='0';}catch{/* 存储不可用 */}
   this.factionStripC=factionCorner(this,this.area.x+8,this.area.y+8,this.era,this.owned).setDepth(20).setVisible(open);this.factionBtn=fb;fb.setText(open?'势力  ▴':'势力  ▾');this.legendRect=open?this.factionStripC.getBounds():undefined;
   fb.on('pointerup',()=>{const v=!this.factionStripC!.visible;this.legend?.destroy();this.legend=undefined;this.territory?.destroy();this.territory=undefined;this.factionStripC!.setVisible(v);fb.setText(v?'势力  ▴':'势力  ▾');this.legendRect=v?this.factionStripC!.getBounds():undefined;try{localStorage.setItem('im_world_legend',v?'1':'0');}catch{/* 存储不可用 */}this.clampMap();});}
  else factionStrip(this,this.area.x+10,this.viewBottom-24,this.area.w-20,this.era,this.owned,desktop);
  // 操作提示垫一块漆底小牌：地图拖到哪里，提示都不会和城名 / 章节标签叠在一起难以辨认
  if(!desktop){const hint=worldText(this,desktop?this.area.x+this.area.w-18:this.area.x+20,this.viewBottom-(desktop?20:56),'拖动查看 · 滚轮/双指缩放 · 点城池查看',desktop?11:12,'#f2e3c0').setOrigin(desktop?1:0,.5).setPadding(10,5).setName('world-hint');
   const hb=hint.getBounds(),hg=this.add.graphics().setName('world-hint-plate');lacquerPlate(hg,hb.x,hb.y,hb.width,hb.height,.86);hint.setDepth(1);}
  // 攻城归来：选中并居中该城
  const focus=cityById(String(this.registry.get('mapFocusCity')??''));this.registry.remove('mapFocusCity');
  const focusIntel=this.intel.find(e=>e.id===this.registry.get('mapFocusIntel'));this.registry.remove('mapFocusIntel');
  if(focus){this.selected={kind:'city',city:focus};this.layer.setPosition(this.area.x+this.area.w/2-focus.x*this.zoom,(this.area.y+this.viewBottom)/2-focus.y*this.zoom);this.clampMap();}
  // 章节时间线；战役告捷归来聚焦新章节，否则默认选中当前该打的一章
  this.buildTimeline(desktop);
  this.buildGuide();
  const focusNode=WORLD_NODES.find(n=>n.id===this.registry.get('mapFocusNode'));this.registry.remove('mapFocusNode');
  if(focusIntel){this.selected={kind:'intel',event:focusIntel};this.centerOnCity(cityById(focusIntel.city)!);}
  else if(!focus){const pick=focusNode??WORLD_NODES.find(n=>this.chapterOf(n)?.id===current);if(pick)this.selected={kind:'node',node:pick};if(focusNode)this.centerOn(focusNode);else if(desktop)this.focusPlayer();} // 电脑版默认聚焦玩家势力与下一个目标（2026-11-18）
  this.refresh();
  const fresh=isChapterTestRun()?0:takeNewChapters();
  if(fresh>0)this.revealChapter();
  if(advance||lost.length)this.showNotice(advance,lost);
  if(captured){this.selected={kind:'city',city:captured};this.refresh();this.playCapture(captured,nowRealm,prevRealm);}
  this.tilesArmed=true;this.updateTiles();
 }
 /** 镜头范围内的舆图分块：可见才显示，未载入的按需载入（全国档用低清总图即可）；其余隐藏，不画。 */
 private updateTiles(){if(!this.tiles.length||!this.layer||!this.tilesArmed)return; // create 里镜头还在摆位，等摆好再按最终视野载入
 const z=this.zoom,a=this.area,x0=(a.x-this.layer.x)/z,y0=(a.y-this.layer.y)/z,x1=x0+a.w/z,y1=y0+a.h/z,tw=this.mapW/TILE_COLS,th=this.mapH/TILE_ROWS,need=z>=this.minZoom*1.35;
  for(const t of this.tiles){const vis=t.c*tw<x1&&(t.c+1)*tw>x0&&t.r*th<y1&&(t.r+1)*th>y0,key=`wgrand_${t.r}_${t.c}`;
   if(t.img){t.img.setVisible(vis&&need);continue;} // 全国档用低清总图即可，分块不画
   if(!vis||!need)continue;
   if(this.textures.exists(key)){this.addTile(t,key);continue;}
   if(t.loading)continue;t.loading=true;this.load.image(key,`assets/world/grand/tile_${t.r}_${t.c}.webp`);this.load.once(`filecomplete-image-${key}`,()=>{t.loading=false;if(this.scene.isActive()&&this.layer?.active){this.addTile(t,key);this.updateTiles();}});if(!this.load.isLoading())this.load.start();}}
 private addTile(t:{r:number;c:number;img?:Phaser.GameObjects.Image},key:string){if(t.img)return;this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);const tw=this.mapW/TILE_COLS,th=this.mapH/TILE_ROWS;
  t.img=this.add.image(t.c*tw,t.r*th,key).setOrigin(0).setDisplaySize(tw+.5,th+.5).setName(`world-tile-${t.r}-${t.c}`);this.layer.addAt(t.img,1);}
 /** 当前最接近的镜头档。 */
 private tierIndex(){let best=0;ZOOM_TIERS.forEach((k,i)=>{if(Math.abs(this.zoom-this.minZoom*k)<Math.abs(this.zoom-this.minZoom*ZOOM_TIERS[best]))best=i;});return best;}
 private paintTier(){const t=this.tierLabel;if(!t)return;t.setText(ZOOM_NAMES[this.tierIndex()]);const g=t.getData('plate') as Phaser.GameObjects.Graphics;g.clear();lacquerPlate(g,t.x-t.width/2,t.y-t.height/2,t.width,t.height,.85);}
 /** 换档：以 (x,y) 为中心平滑缩放到相邻一档。 */
 private stepTier(dir:number,x:number,y:number){const i=Phaser.Math.Clamp(this.tierIndex()+dir,0,ZOOM_TIERS.length-1),z=this.minZoom*ZOOM_TIERS[i];if(Math.abs(z-this.zoom)<1e-4)return;
  this.tweens.killTweensOf(this.zoomProxy);this.zoomProxy.z=this.zoom;this.tweens.add({targets:this.zoomProxy,z,duration:320,ease:'Sine.easeInOut',onUpdate:()=>this.setZoom(this.zoomProxy.z,x,y)});}
 private zoomProxy={z:1};
 /** 镜头推到地图点 (mx,my)、缩放 z（双击城池推近、打开地图时聚焦）。 */
 private flyTo(mx:number,my:number,z:number,dur=450){z=Phaser.Math.Clamp(z,this.minZoom,this.minZoom*ZOOM_TIERS[2]);const fx=this.layer.x,fy=this.layer.y,fz=this.zoom,cx=this.area.x+this.area.w/2,cy=(this.area.y+this.viewBottom)/2,tx=cx-mx*z,ty=cy-my*z;
  this.tweens.killTweensOf(this.zoomProxy);this.zoomProxy.z=0;const go=(k:number)=>{this.zoom=fz+(z-fz)*k;this.layer.setScale(this.zoom);this.layer.x=fx+(tx-fx)*k;this.layer.y=fy+(ty-fy)*k;this.clampMap();this.paintTier();};
  if(dur<=0){go(1);return;}this.tweens.add({targets:this.zoomProxy,z:1,duration:dur,ease:'Sine.easeInOut',onUpdate:()=>go(this.zoomProxy.z)});}
 /** 打开地图：框住营寨、我方城池与「下一步」目标，在州郡档以内取能全部放下的缩放。 */
 private focusPlayer(){const pts=[{x:HOME.x,y:HOME.y},...this.owned.map(i=>cityById(i)).filter((c):c is CityDef=>!!c).map(c=>({x:c.x,y:c.y}))];if(this.guideTarget)pts.push({x:this.guideTarget.x,y:this.guideTarget.y});
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),bx0=Math.min(...xs)-120,bx1=Math.max(...xs)+120,by0=Math.min(...ys)-110,by1=Math.max(...ys)+110,fit=Math.min(this.area.w/(bx1-bx0),(this.viewBottom-this.area.y)/(by1-by0));
  this.flyTo((bx0+bx1)/2,(by0+by1)/2,Math.min(this.minZoom*ZOOM_TIERS[1],Math.max(this.minZoom,fit)),0);}
/** 城池可攻状态：我方 / 告急 / 可攻 / 章节未开 / 不相邻（给出先攻哪座）。 */
 private cityStatusOf(c:CityDef):CityStatus{
  if(this.alertFor(c.id))return{kind:'alert',reason:'告急：守住可解除'};
  if(this.owned.includes(c.id))return{kind:'own',reason:'你的城池'};
  if(cityAttackable(c.id,this.owned)){if(!citySiegeOpen(c.id,loadWorld())&&!isChapterTestRun()){const g=chapterById(CITY_CHAPTER[c.id]??'hulao');return{kind:'gate',reason:`未解锁：通关第${g.numeral}章「${g.title}」后开放攻城`};}return{kind:'attack',reason:'与你的领地相邻，可以攻打'};}
  const step=this.firstStep(c.id);return{kind:'far',reason:step?`尚不相邻：需先攻下${step}`:'尚不相邻：先攻下相邻城池'};}
 /** 通往某城最近一步：从目标沿道路倒推，取与我方领地相邻、离目标最近的城（至多两座）。 */
 private firstStep(target:string):string{const dist=new Map<string,number>([[target,0]]),q=[target];
  while(q.length){const id=q.shift()!;for(const n of CITY_LINKS.get(id)??[]){if(n===HOME.id||dist.has(n)||this.owned.includes(n))continue;dist.set(n,dist.get(id)!+1);q.push(n);}}
  const cands=CITIES.filter(c=>c.id!==target&&dist.has(c.id)&&cityAttackable(c.id,this.owned));if(!cands.length)return '';const best=Math.min(...cands.map(c=>dist.get(c.id)!));
  return cands.filter(c=>dist.get(c.id)===best).slice(0,2).map(c=>c.name).join(' 或 ');}
 /** 可攻：脚下朱红细描边（缓慢明暗）+「可攻」漆牌；不可攻：城郭与旗调暗；电脑版悬停显示城名、档次、守军、推荐等级、奖励或原因。 */
 private paintCityStatus(){this.status.clear();
  for(const m of this.cityMarkers){const fog=this.fogVis.get(m.city.id)??'clear',st:CityStatus=fog==='hidden'?{kind:'fog',reason:'迷雾未散，需先攻下相邻城池'}:this.cityStatusOf(m.city);this.status.set(m.city.id,st);m.root.setData('status',st.kind);
   const icon=m.root.getData('icon') as Phaser.GameObjects.Image|undefined,flag=(m.root.getData('flag') as Phaser.GameObjects.GameObject[]|undefined)??[];
   // 迷雾下：不画城郭和旗，名牌换成「？」
   if(st.kind==='fog'){icon?.setVisible(false);for(const f of flag)(f as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);(m.root.getData('plate') as Phaser.GameObjects.Components.Visible|undefined)?.setVisible(false);m.root.setData('plate',null);m.label.setText('？').setColor('#e8dcc0').setStroke('#2a2016',3).setAlpha(.85);}
   else if(fog==='dim'){icon?.setAlpha(.45);for(const f of flag)(f as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(.45);}
   if(st.kind==='far'||st.kind==='gate'){icon?.setAlpha(.55).setTint(0xb8b2a4);for(const f of flag)(f as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(.55);(m.root.getData('plate') as Phaser.GameObjects.Components.Alpha|undefined)?.setAlpha(.75);m.label.setAlpha(.75);}
   if(st.kind==='attack'&&MARKERS_V2){const ring=this.add.graphics().setName('attack-ring-'+m.city.id);ring.lineStyle(1.6,0xd2462c,1).strokeEllipse(0,3,m.outer*2.2,13);m.root.addAt(ring,0);this.tweens.add({targets:ring,alpha:{from:.95,to:.3},duration:1100,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    const tt=worldText(this,0,0,'可攻',11,'#ffe2a0').setOrigin(.5).setFontFamily(HEADING_FONT),g=this.add.graphics();lacquerPlate(g,-tt.width/2-6,-tt.height/2-2,tt.width+12,tt.height+4,.92,0xd2462c);
    m.root.add(this.add.container(m.outer*.62,-m.top*.62,[g,tt]).setName('attack-tag-'+m.city.id));}
   if(W>600)m.hit.on('pointerover',()=>{const p=this.toScreen(m.city.x,m.city.y);this.showTip(this.cityTip(m.city),p.x,p.y-m.top-4,.5);}).on('pointerout',()=>this.hideTip());}}
 /** 城池悬停提示。 */
 private cityTip(c:CityDef):string{const st=this.status.get(c.id),owner=cityOwner(c.id,this.era,this.owned),inc=cityIncome(c.tier,owner==='player'?cityLevels(c.id):emptyCityLevels()),head=`${c.name} · ${TIER_NAME[c.tier]} · ${c.region}`;
  if(!st)return head;
  if(st.kind==='fog')return '？ · 迷雾未散\n迷雾未散，需先攻下相邻城池';
  if(st.kind==='own')return `${head}\n我方城池 · 每战 ${incomeText(inc)}\n点选后「进入城池」建设`;
  if(st.kind==='alert'){const a=this.alertFor(c.id)!;return `${head} · 告急\n${FACTIONS[a.attacker].name}来犯：守住可解除，出征别处则失守`;}
  const T=SIEGE[c.tier],first=!this.capturedEver.includes(c.id),k=first?1+FIRST_CAPTURE_BONUS:1;
  const base=`守军：${FACTIONS[owner].name} · 推荐等级 ${TIER_STARS[c.tier]}\n奖励：军粮 +${rewardGrain(T.reward.merits*k,T.reward.provisions*k)}${first?'（首次 +50%）':''} · 占领后每战 ${incomeText(inc)}`;
  return st.kind==='attack'?`${head} · 可攻\n${base}`:`${head} · 不可攻\n${st.reason.replace(/^未解锁：|^尚不相邻：/,'')}\n${base}`;}
 /** 「下一步」引导：告急城 > 当前主线章节 > 最易攻的可攻城（小城优先、离营寨近）；从最近的我方据点画一条淡金虚线箭头。 */
 private buildGuide(){const s=loadWorld();let to:{x:number;y:number}|null=null,text='',id='';
  const alert=this.alerts.map(a=>cityById(a.city)).find((c):c is CityDef=>!!c);
  if(alert){to={x:alert.x,y:alert.y};text=`下一步 · 守${alert.name}`;id=alert.id;}
  else{const cur=currentChapter(s),node=WORLD_NODES.find(n=>this.chapterOf(n)?.id===cur.id);
   if(node&&this.nodeState(node)==='open'){to={x:node.x*this.mapW,y:node.y*this.mapH};text=`下一步 · 第${cur.numeral}章「${cur.title}」`;id='node-'+node.id;}
   else{const c=this.cityMarkers.filter(m=>this.status.get(m.city.id)?.kind==='attack'&&!m.root.getData('fogged')).map(m=>m.city).sort((a,b)=>TIER_RANK[a.tier]-TIER_RANK[b.tier]||Math.hypot(a.x-HOME.x,a.y-HOME.y)-Math.hypot(b.x-HOME.x,b.y-HOME.y))[0];
    if(c){to={x:c.x,y:c.y};text=`下一步 · 攻${c.name}`;id=c.id;}}}
  if(!to)return;const t0=to;
  const from=[{x:HOME.x,y:HOME.y},...this.owned.map(i=>cityById(i)).filter((c):c is CityDef=>!!c).map(c=>({x:c.x,y:c.y}))].sort((a,b)=>Math.hypot(a.x-t0.x,a.y-t0.y)-Math.hypot(b.x-t0.x,b.y-t0.y))[0];
  this.guideTarget={x:t0.x,y:t0.y,from,text,id};
  this.guide=this.add.graphics().setDepth(2).setName('world-next-guide');if(this.mapMask)this.guide.setMask(this.mapMask.createGeometryMask());
  const t=worldText(this,0,0,text,12,'#ffe2a0').setOrigin(.5).setName('world-next-text'),g=this.add.graphics();lacquerPlate(g,-t.width/2-8,-t.height/2-3,t.width+16,t.height+6,.85);
  this.guideLabel=this.add.container(0,0,[g,t]).setDepth(4).setName('world-next-label');}
 private layoutGuide(){const g=this.guide,t=this.guideTarget,lab=this.guideLabel;if(!g||!t||!lab)return;g.clear();
  const a=this.toScreen(t.from.x,t.from.y),b=this.toScreen(t.x,t.y),len=Math.hypot(b.x-a.x,b.y-a.y),ar=this.area,show=(x:number,y:number)=>x>ar.x+60&&x<ar.x+ar.w-60&&y>ar.y+16&&y<this.viewBottom-16&&!(this.card&&x>this.card.x-60&&y>this.card.y-20);
  if(len<90){const lw=(lab.list[1] as Phaser.GameObjects.Text).width,x=b.x+lw/2+40,y=b.y-24;lab.setPosition(x,y).setVisible(show(x,y));return;} // 目标就在我方据点旁：不画线，牌子立在目标右侧
  const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len,s0=28,s1=len-36,dash=(w:number,c:number,al:number)=>{g.lineStyle(w,c,al);for(let d=s0;d<s1;d+=13)g.lineBetween(a.x+ux*d,a.y+uy*d,a.x+ux*Math.min(d+7,s1),a.y+uy*Math.min(d+7,s1));};
  dash(3,0x1b120b,.3);dash(1.5,0xffe2a0,.7);const ex=a.x+ux*s1,ey=a.y+uy*s1;g.fillStyle(0xffe2a0,.8).fillTriangle(ex+ux*10,ey+uy*10,ex-uy*5,ey+ux*5,ex+uy*5,ey-ux*5);
  const mx=a.x+ux*len*.5,my=a.y+uy*len*.5-14;lab.setPosition(mx,my).setVisible(show(mx,my));}
 /** 「XX 归入版图」：镜头对准新城，军旗落下插定，朱印「归」盖下，旧疆域淡出、新疆域染上；顶部漆牌横幅数秒后收起。素材：W2-5 军旗、W2-8 方印（手绘）。 */
 private playCapture(c:CityDef,now:Phaser.GameObjects.Image[],prev:Phaser.GameObjects.Image[]){
  const m=this.cityMarkers.find(x=>x.city.id===c.id);this.centerOnCity(c);
  this.animateFog(this.fogPoints(this.owned.filter(i=>i!==c.id)),c.x,c.y,300);
  this.tweens.add({targets:now,alpha:1,duration:1600,delay:500,ease:'Sine.easeInOut'});
  this.tweens.add({targets:prev,alpha:0,duration:1600,delay:500,ease:'Sine.easeInOut',onComplete:()=>{for(const o of prev)o.destroy();for(const k of ['realm_prev_fx','realm_prev_fx_player'])if(this.textures.exists(k))this.textures.remove(k);}});
  for(const f of (m?.root.getData('flag') as Phaser.GameObjects.GameObject[]|undefined)??[]){const o=f as unknown as {y:number;alpha:number},y=o.y;o.y=y-36;o.alpha=0;this.tweens.add({targets:o,y,alpha:1,duration:520,delay:250,ease:'Back.easeOut'});}
  const p=this.toScreen(c.x,c.y),root=this.add.container(0,0).setDepth(45).setName('capture-reveal');
  const seal=this.add.container(p.x+(m?.outer??20)+18,p.y-(m?.top??30)*.55).setName('capture-seal');
  if(this.textures.exists('wm2_seal_open'))seal.add(this.add.image(0,0,'wm2_seal_open').setDisplaySize(38,38));else{const g=this.add.graphics();g.fillStyle(0x9a2a1c,1).fillRoundedRect(-17,-17,34,34,4);seal.add(g);}
  seal.add(worldText(this,0,0,'归',19,'#fff3dc').setOrigin(.5).setFontFamily(TITLE_FONT).setStroke('#3a0c06',2));
  seal.setScale(2.4).setAlpha(0).setAngle(-8);this.tweens.add({targets:seal,scale:1,alpha:1,duration:260,delay:950,ease:'Quad.easeIn',onComplete:()=>this.cameras.main.shake(140,.003)});root.add(seal);
  const inc=cityIncome(c.tier,cityLevels(c.id)),title=worldText(this,0,0,`${c.name} 归入版图`,26,'#f6dc9a').setOrigin(.5).setFontFamily(TITLE_FONT).setStroke('#120904',4).setName('capture-title'),sub=worldText(this,0,30,`${TIER_NAME[c.tier]} · 每战 ${incomeText(inc)} · 点城池可建设`,13,'#e4dcc4').setOrigin(.5);
  const bw=Math.max(title.width,sub.width)+56,g=this.add.graphics();lacquerPlate(g,-bw/2,-24,bw,72,.94,0xe5c47d);
  const banner=this.add.container(W/2,this.area.y+40,[g,title,sub]).setName('capture-banner').setAlpha(0);root.add(banner);
  this.tweens.add({targets:banner,alpha:1,y:this.area.y+48,duration:450,delay:300});
  this.time.delayedCall(4200,()=>{if(root.active)this.tweens.add({targets:root,alpha:0,duration:500,onComplete:()=>root.destroy()});});}
 private alertFor(id:string){return this.alerts.find(a=>a.city===id);}
 private chapterOf(node:WorldNode){const id=node.chapter??node.campaign;return CHAPTER_TIMELINE.find(c=>c.id===id);}
 /** 节点状态：营寨 / 已平定 / 已开放 / 未解锁。开放判定沿用原规则（ChapterProgress / arcUnlocked）。 */
 private nodeState(node:WorldNode):'home'|ChapterState{if(node.kind==='home')return 'home';if(node.challenge)return lubuChallengeOpen()||isChapterTestRun()?(lubuClears()>0?'cleared':'open'):'locked';if(node.kind==='future')return 'locked';const info=this.chapterOf(node);if(info&&chapterStagesDone(info.id,loadWorld())>=3)return 'cleared';const open=node.campaign?CAMPAIGNS[node.campaign].open()||isChapterTestRun():!!node.chapter&&chapterUnlocked(node.chapter);return open?'open':'locked';}
 private centerOn(node:WorldNode){this.layer.setPosition(this.area.x+this.area.w/2-node.x*this.mapW*this.zoom,(this.area.y+this.viewBottom)/2-node.y*this.mapH*this.zoom);this.clampMap();}
 /** 章节时间线条：壹 黄巾 → 贰 讨董 → 叁 群雄 → 肆 官渡 → 伍 赤壁，显示年份与状态。 */
 private buildTimeline(desktop:boolean){
  if(desktop){this.buildSlimTimeline();return;}
  this.chips=[];const s=loadWorld(),y=this.timelineY,h=desktop?40:54,gap=desktop?14:8,n=CHAPTER_TIMELINE.length,w=(this.area.w-gap*(n-1))/n;
  const line=this.add.graphics().setName('chapter-timeline');line.lineStyle(2,0xc9a35e,.5).lineBetween(this.area.x+w/2,y+h/2,this.area.x+this.area.w-w/2,y+h/2);
  CHAPTER_TIMELINE.forEach((c,i)=>{const node=WORLD_NODES.find(x=>this.chapterOf(x)?.id===c.id);if(!node)return;const st=this.nodeState(node) as ChapterState,x=this.area.x+i*(w+gap),done=chapterStagesDone(c.id,s);
   const g=this.add.graphics();this.chips.push({id:c.id,node,g,x,y,w,h,state:st});
   const status=st==='cleared'?(hardChapterCleared(c.id)?'✓ 乱世':'✓ 已平定'):st==='open'?(done?`进行中 ${done}/3`:'可出征'):'未解锁';
   worldText(this,x+w/2,y+(desktop?13:17),`${c.numeral} ${c.title}`,14,st==='locked'?'#a4a79b':'#f6e3b4').setOrigin(.5).setName(`chapter-chip-title-${c.id}`);
   worldText(this,x+w/2,y+(desktop?30:39),`${c.year}年 · ${status}`,11,st==='cleared'?'#bfe3a6':st==='open'?'#ffd98a':'#9a9d92').setOrigin(.5).setName(`chapter-chip-status-${c.id}`);
   this.add.rectangle(x+w/2,y+h/2,w,h,0x000000,.001).setInteractive({useHandCursor:true}).setName(`chapter-chip-${c.id}`).setData('state',st).on('pointerup',()=>{this.selected={kind:'node',node};this.centerOn(node);this.refresh();});
  });
 }
  /** 电脑版细时间线：地图左下角一条漆底细条，十二章一章一个点（已平定绿 / 可出征金 / 未解锁灰），选中的章点放大并写章名；悬停显示章名、年份、状态。 */
  private buildSlimTimeline(){
   this.chips=[];const s=loadWorld(),n=CHAPTER_TIMELINE.length,step=24,x0=this.area.x+16,y=this.timelineY,w=step*(n-1)+150;
   const bg=this.add.graphics().setName('chapter-timeline-slim').setDepth(6);lacquerPlate(bg,x0-12,y-15,w,30,.82);this.timelineRect=new Phaser.Geom.Rectangle(x0-12,y-15,w,30);bg.lineStyle(1,0xc9a35e,.55).lineBetween(x0,y,x0+step*(n-1),y);
   CHAPTER_TIMELINE.forEach((c,i)=>{const node=WORLD_NODES.find(x=>this.chapterOf(x)?.id===c.id);if(!node)return;const st=this.nodeState(node) as ChapterState,x=x0+i*step,done=chapterStagesDone(c.id,s);
    const g=this.add.graphics().setDepth(7);this.chips.push({id:c.id,node,g,x,y,w:0,h:0,state:st});
    const status=st==='cleared'?(hardChapterCleared(c.id)?'✓ 乱世':'✓ 已平定'):st==='open'?(done?`进行中 ${done}/3`:'可出征'):'未解锁';
    // 章名 / 状态文字保留（测试与悬停提示读取），平时不显示
    worldText(this,x,y,`${c.numeral} ${c.title}`,12,'#f6e3b4').setVisible(false).setName(`chapter-chip-title-${c.id}`);
    worldText(this,x,y,`${c.year}年 · ${status}`,11,'#d6cdb4').setVisible(false).setName(`chapter-chip-status-${c.id}`);
    this.add.circle(x,y,10,0x000000,.001).setDepth(8).setInteractive({useHandCursor:true}).setName(`chapter-chip-${c.id}`).setData('state',st)
     .on('pointerup',()=>{this.selected={kind:'node',node};this.centerOn(node);this.refresh();})
     .on('pointerover',()=>this.showTip(`第${c.numeral}章 · ${c.title}\n${c.year}年 · ${status}`,x,y-16,.5))
     .on('pointerout',()=>this.hideTip());
   });
   this.add.text(0,0,'',{fontFamily:HEADING_FONT,fontSize:'13px',color:'#ffe2a0',resolution:2}).setOrigin(0,.5).setStroke('#120904',3).setDepth(7).setName('chapter-timeline-name');
   // 图例：主线章节（牙旗「战」）与可攻城池（朱红描边 +「可攻」牌）分开说明
   const kx=x0-12+w+8,key=this.add.container(kx,y).setDepth(6).setName('world-map-key'),parts:Array<[string,string,string]>=[['战','#ffd98a','主线章节'],['可攻','#ff9a80','可攻城池'],['义','#bff0c8','我方城池']];let cx=10;const items:Phaser.GameObjects.GameObject[]=[];
   for(const [g,col,label] of parts){const a=worldText(this,cx,0,g,11,col).setOrigin(0,.5).setFontFamily(HEADING_FONT),b=worldText(this,cx+a.width+4,0,label,11,'#d6cdb4').setOrigin(0,.5);items.push(a,b);cx+=a.width+4+b.width+12;}
   const kg=this.add.graphics();lacquerPlate(kg,0,-12,cx,24,.82);key.add([kg,...items]);this.timelineRect=new Phaser.Geom.Rectangle(x0-12,y-15,kx+cx-(x0-12),30);
  }
  /** 悬停提示（漆底小牌）：ax 为提示框水平锚点（0 左对齐 / .5 居中 / 1 右对齐），y 为底边。 */
  private showTip(text:string,x:number,y:number,ax:number){this.hideTip();if(!text)return;const t=worldText(this,0,0,text,12,'#eadfc4').setLineSpacing(3).setWordWrapWidth(320,true);
   const w=t.width+20,h=t.height+12,left=Phaser.Math.Clamp(x-w*ax,6,W-6-w),top=Math.max(this.area.y+4,y-h);const g=this.add.graphics();lacquerPlate(g,0,0,w,h,.95);t.setPosition(10,6);
   this.tip=this.add.container(left,top,[g,t]).setDepth(60).setName('world-tip');}
  private hideTip(){this.tip?.destroy();this.tip=undefined;}
 private paintChips(){const sel=this.selected.kind==='node'?this.chapterOf(this.selected.node)?.id:undefined;
   if(this.card){const name=this.children.getByName('chapter-timeline-name') as Phaser.GameObjects.Text|null,last=this.chips[this.chips.length-1];
    for(const c of this.chips){const on=c.id===sel,col=c.state==='cleared'?0x7fc48f:c.state==='open'?0xe5c47d:0x6b6f66;c.g.clear().fillStyle(0x000000,.5).fillCircle(c.x,c.y+1,on?7:5).fillStyle(col,1).fillCircle(c.x,c.y,on?6:4);if(on)c.g.lineStyle(2,0xffe2a0,1).strokeCircle(c.x,c.y,9);}
    const cur=CHAPTER_TIMELINE.find(c=>c.id===sel);name?.setText(cur?`${cur.numeral} · ${cur.title}`:'').setPosition((last?.x??0)+16,last?.y??0);return;}
  for(const c of this.chips){c.g.clear();lacquerPlate(c.g,c.x,c.y,c.w,c.h,.78,c.state==='cleared'?0x7fc48f:c.state==='open'?0xe5c47d:0x6b6f66);if(c.id===sel)c.g.lineStyle(2,0xffe2a0,1).strokeRoundedRect(c.x-2,c.y-2,c.w+4,c.h+4,7);}}
 /** 有告急城池时出征别处的警示（空串表示无告急）。 */
 private lossWarning(){const names=this.alerts.map(a=>cityById(a.city)?.name).filter(Boolean);return names.length?`⚠ ${names.join('、')}告急：此时出征别处，${names.length>1?'这些城池':'该城'}将失守！`:'';}
 /** W4 时局变化 / 城池失守 提示面板。 */
 private showNotice(advance:EraAdvance|null,lost:string[]){
  const desk=W>600,pw=Math.min(W-40,540),root=this.add.container(0,0).setDepth(70).setName('era-modal');this.notice=root;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.78).setInteractive());
  const lines:string[]=[];let title='城池失守';
  if(advance){const e=eraDef(advance.to);title=`时局变化 · 公元${e.year}年`;lines.push(`【${e.name}】${e.summary}`);
   const moved=advance.changes.map(c=>`${cityById(c.city)?.name}：${FACTIONS[c.from].name} → ${FACTIONS[c.to].name}`);
   if(moved.length)lines.push('城池易主：'+(moved.length>8?moved.slice(0,8).join('；')+`；等 ${moved.length} 城`:moved.join('；')));
   if(advance.fallen.length)lines.push('势力覆灭：'+advance.fallen.map(f=>FACTIONS[f].name).join('、'));
   lines.push(advance.alerts.length?'边城告急：'+advance.alerts.map(a=>`${cityById(a.city)?.name}（${FACTIONS[a.attacker].name}来犯）`).join('、')+'\n点选告急城池即可守城；若出征别处，告急城池将失守。':'我方城池暂无战事。');}
  if(lost.length)lines.push(`上次出征时告急未救，${lost.map(id=>cityById(id)?.name).join('、')}已失守。`);
  const text=worldText(this,0,0,lines.join('\n\n'),desk?15:16,'#e4dcc4').setWordWrapWidth(pw-48,true).setLineSpacing(5);
  const ph=Math.min(H-80,text.height+150),px=W/2-pw/2,py=H/2-ph/2;root.add(this.modalPanel(pw,ph));
  root.add(worldText(this,px+24,py+20,title,24,'#f0d79e'));text.setPosition(px+24,py+64);root.add(text);
  this.modalButton(root,W/2,py+ph-(desk?44:54),pw*.5,'知道了',true,'era-ok',()=>{root.destroy();this.notice=undefined;});
 }
 private toggleLegend(){
  this.territory?.destroy();this.territory=undefined;
  if(this.legend){this.legend.destroy();this.legend=undefined;return;}
  // 留出右侧缩放按钮
  const w=Math.min(this.area.w-24-76,520),era=eraDef(this.era);
  this.factionStripC?.setVisible(false);
  this.legend=factionLegend(this,this.area.x+12,this.area.y+(W>600?8:52),this.era,this.owned,w).setDepth(20);
  const box=this.legend.list[0] as Phaser.GameObjects.Rectangle;
  const summary=worldText(this,12,box.height+6,era.summary,13,'#d6cdb4').setWordWrapWidth(w-24);
  box.setSize(w,box.height+summary.height+14);this.legend.add(summary);
 }
/** 领地面板：城池数（大/中/小）、每次出征产出合计、生效的大城特产与城池列表。 */
 private toggleTerritory(){
  this.legend?.destroy();this.legend=undefined;
  if(this.territory){this.territory.destroy();this.territory=undefined;return;}
  const w=Math.min(this.area.w-24-76,520),sum=territorySummary(this.owned),root=this.add.container(this.area.x+12,this.area.y+(W>600?8:52)).setDepth(20).setName('territory-panel');this.factionStripC?.setVisible(false);
  const lines=this.owned.length?[
   `我方城池 ${this.owned.length} 座 · 大城 ${sum.counts.large} / 中城 ${sum.counts.medium} / 小城 ${sum.counts.small}`,
   (()=>{const s=loadWorld(),t={grain:0,troops:0};for(const id of this.owned){const c=cityById(id);if(!c)continue;const inc=cityIncome(c.tier,cityLevels(id,s));t.grain+=inc.grain;t.troops+=inc.troops;}return `每战产出（各城建筑）：${incomeText(t)}`;})(),
   sum.specialties.length?'大城特产：\n'+sum.specialties.map(x=>`· ${x.city.name}「${x.specialty.title}」${x.specialty.text}`).join('\n'):'大城特产：尚无（攻占大城可获得永久加成）',
   '城池：'+this.owned.map(id=>cityById(id)?.name).filter(Boolean).join('、'),
  ]:['尚无城池。','攻下与营寨相邻的城池（许昌、汝南、官渡）后，每次出征结算都会获得城池产出；攻占大城还有永久特产加成。'];
  const text=worldText(this,12,10,lines.join('\n'),14,'#d6e6d0').setWordWrapWidth(w-24).setLineSpacing(5);
  root.add([this.add.rectangle(0,0,w,text.height+20,0x0f1c15,.95).setOrigin(0).setStrokeStyle(1,0x7fc48f,.7),text]);this.territory=root;
 }
 private setZoom(next:number,x:number,y:number){const z=Phaser.Math.Clamp(next,this.minZoom,this.minZoom*ZOOM_TIERS[2]),ratio=z/this.zoom;this.layer.x=x-(x-this.layer.x)*ratio;this.layer.y=y-(y-this.layer.y)*ratio;this.zoom=z;this.layer.setScale(z);this.clampMap();this.paintTier();}
 private toScreen(mx:number,my:number){return{x:this.layer.x+mx*this.zoom,y:this.layer.y+my*this.zoom};}
 private clampMap(){const a=this.area;this.layer.x=Phaser.Math.Clamp(this.layer.x,a.x+a.w-this.mapW*this.zoom,a.x);this.layer.y=Phaser.Math.Clamp(this.layer.y,a.y+a.h-this.mapH*this.zoom,a.y);
  const c=this.card,tl=this.timelineRect,visible=(x:number,y:number)=>x>a.x+14&&x<a.x+a.w-14&&y>a.y+14&&y<this.viewBottom-30&&!(c&&x>c.x-24&&y>c.y-36)&&!(tl&&x<tl.right+20&&y>tl.y-30)&&!(this.legendRect&&this.legendRect.contains(x,y-10)); // 电脑版：右下小卡、左下时间线、左上势力图例下面不放标记
  for(const m of this.markers){const x=this.layer.x+m.node.x*this.mapW*this.zoom,q=this.liftOffCity(x,this.layer.y+m.node.y*this.mapH*this.zoom);m.root.setPosition(q.x,q.y).setVisible(visible(q.x,q.y)&&!(this.routeChapter&&this.chapterOf(m.node)?.id===this.routeChapter));}
  // 小城名字在放大后才显示，避免默认视图拥挤
  const showSmall=this.zoom>=this.minZoom*1.65;
  // 军旗高出徽框，靠近地图上沿时整个标记隐藏，免得旗子伸出地图框
  for(const m of this.cityMarkers){const p=this.toScreen(m.city.x,m.city.y),flag=m.root.getData('banner')?m.outer+40:m.top;m.root.setPosition(p.x,p.y).setVisible(visible(p.x,p.y)&&p.y-flag>a.y);m.label.setVisible(m.city.tier!=='small'||showSmall||this.isSelected(m.city));(m.root.getData('plate') as Phaser.GameObjects.Graphics|undefined)?.setVisible(m.label.visible);}
  this.layoutRoute(visible);
  if(MARKERS_V2)this.declutterLabels();
  for(const m of this.intelMarkers){const p=this.toScreen(m.city.x,m.city.y),x=p.x+20,y=p.y-30;m.root.setPosition(x,y).setVisible(visible(x,y)&&y-(MARKERS_V2?30:16)>a.y+(MARKERS_V2?46:0)&&(this.fogVis.get(m.city.id)??'clear')!=='hidden');}
  this.drawLinks();
  this.layoutGuide();
  this.updateTiles();
 }
 /** v2：章节牙旗 / 关卡印落在城郭上时挪开：依次试城上方、右侧、左侧、名牌下方，取第一个不压到别的城的位置。 */
 private liftOffCity(x:number,y:number,pin=false):{x:number;y:number}{if(!MARKERS_V2)return{x,y};
  const cities=this.cityMarkers.filter(m=>!m.root.getData('fogged')).map(m=>({m,p:this.toScreen(m.city.x,m.city.y)}));
  // 牙旗 / 关卡印占据锚点上方约 44、下方约 26（名牌）；城占据城郭顶到名牌底
  const hitAt=(px:number,py:number,skip?:CityMarker)=>cities.find(c=>c.m!==skip&&Math.abs(c.p.x-px)<c.m.outer+18&&py-44<c.p.y+30&&py+26>c.p.y-c.m.top-6);
  // 同时压到几座城时，以最近的那座为准（否则可能按地图框外的城去挪）
  const under=cities.filter(c=>hitAt(x,y)&&Math.abs(c.p.x-x)<c.m.outer+18&&y-44<c.p.y+30&&y+26>c.p.y-c.m.top-6).sort((a,b)=>Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y))[0];if(!under)return{x,y};
  const {m,p}=under,side=m.outer+30;
  const a=this.area,inMap=(c:{x:number;y:number})=>c.x>a.x+20&&c.x<a.x+a.w-20&&c.y-44>a.y&&c.y+26<this.viewBottom;
  // 关卡印必须留在史实位置附近：只允许抬到城郭正上方（且不出地图框），否则不动
  if(pin){const up={x,y:p.y-m.top-26};return inMap(up)?up:{x,y};}
  // 章节牙旗：计分 = 压到几座城（含原城）；取分最低的位置，挪不出地图边框；全都更差就留在原处
  const cost=(c:{x:number;y:number})=>cities.filter(q=>Math.abs(q.p.x-c.x)<q.m.outer+18&&c.y-44<q.p.y+30&&c.y+26>q.p.y-q.m.top-6).length;
  let best={x,y},bestCost=cost(best);
  // 电脑布局地图区很矮（约 266），城上方常出框：再试名牌下方（+80，避开本城名牌）与更远的左右
  for(const c of [{x,y:p.y-m.top-26},{x:p.x+side,y:p.y},{x:p.x-side,y:p.y},{x,y:p.y+80},{x:p.x+side+40,y:p.y},{x:p.x-side-40,y:p.y},{x:p.x-side,y:p.y+60},{x:p.x+side,y:p.y+60}]){if(!inMap(c))continue;const k=cost(c);if(k<bestCost){best=c;bestCost=k;if(!k)break;}}
  return best;}
 /** v2：名牌按优先级避让（选中城 > 关卡印 > 章节牙旗 > 大城 > 中城 > 小城）。图标（城郭、牙旗、关卡印）也算障碍：
  * 关卡标签被挡时翻到印的上方；城名牌与已摆好的名牌或别家图标重叠时本轮隐藏。地图缩放 / 拖动后重算。 */
 private declutterLabels(){const placed:Phaser.Geom.Rectangle[]=[],pad=2,inter=Phaser.Geom.Intersects.RectangleToRectangle;
  const icons:Array<{r:Phaser.Geom.Rectangle;owner:Phaser.GameObjects.Container}>=[];
  const addIcon=(o:unknown,owner:Phaser.GameObjects.Container)=>{const g=o as Phaser.GameObjects.Components.GetBounds|undefined;if(!g||!owner.visible)return;const r=g.getBounds();r.setTo(r.x+4,r.y+10,Math.max(0,r.width-8),Math.max(0,r.height-14));icons.push({r,owner});};
  for(const p of this.pins)addIcon(p.root.getData('icon'),p.root);
  for(const m of this.markers)addIcon(m.root.getData('icon'),m.root);
  for(const m of this.cityMarkers)addIcon(m.root.getData('icon'),m.root);
  const box=(t:Phaser.GameObjects.Text)=>{const b=t.getBounds();b.setTo(b.x-6-pad,b.y-pad,b.width+12+pad*2,b.height+pad*2);return b;};
  const clash=(b:Phaser.Geom.Rectangle,owner:Phaser.GameObjects.Container)=>placed.some(r=>inter(r,b))||icons.some(i=>i.owner!==owner&&inter(i.r,b));
  const take=(t:Phaser.GameObjects.Text|undefined,owner:Phaser.GameObjects.Container,plate?:Phaser.GameObjects.Graphics,must=false)=>{if(!t||!t.visible)return;let b=box(t);
   if(clash(b,owner)&&!must){t.setVisible(false);plate?.setVisible(false);return;}plate?.setVisible(true);placed.push(b);};
  // 底边的势力排行条、操作提示牌也算障碍：被压住的城名牌直接隐藏，免得只露半截
  const chrome:Phaser.Geom.Rectangle[]=[];for(const name of ['world-faction-strip','world-hint','world-era','world-territory','world-intel','world-card']){const o=this.children.getByName(name) as unknown as Phaser.GameObjects.Components.GetBounds|null;if(o){chrome.push(o.getBounds());placed.push(o.getBounds());}}if(this.timelineRect){chrome.push(this.timelineRect);placed.push(this.timelineRect);}
  const shown=(c:Phaser.GameObjects.Container)=>c.visible;
  {const sel=this.cityMarkers.find(m=>this.isSelected(m.city));if(sel&&shown(sel.root))take(sel.label,sel.root,sel.root.getData('plate'),true);}
  // 关卡标签：默认在印下方，被挡就翻到印上方；两处都挡仍显示（关卡名不能丢）
  for(const p of this.pins)if(shown(p.root)){const t=p.root.getData('label') as Phaser.GameObjects.Text|undefined;if(!t)continue;t.setVisible(true).setPosition(0,24);
   // 依次试：印下方、印上方（不出地图框）、印右侧、印左侧；都挡就留在下方
   const a=this.area,inside=()=>{const b=t.getBounds();return b.y>a.y+4&&b.x>a.x+4&&b.right<a.x+a.w-4;},hw=t.width/2+22;
   const spots=[[0,24],[0,-26],[hw,0],[-hw,0]];let ok=false;for(const [sx,sy] of spots){t.setPosition(sx,sy);if(inside()&&!clash(box(t),p.root)){ok=true;break;}}if(!ok)t.setPosition(0,24);
   take(t,p.root,undefined,true);}
  for(const m of this.markers)if(shown(m.root)){const t=m.root.getData('label') as Phaser.GameObjects.Text|undefined;t?.setVisible(true);
   // 电脑版：未解锁章节只留锁印，不写章名（用户「太乱了」）
   if(t&&this.card&&m.root.getData('locked')){t.setVisible(false);(m.root.getData('plate') as Phaser.GameObjects.Graphics|undefined)?.setVisible(false);continue;}
   // 章节名牌压到底栏 / 顶部按钮下时隐藏（牙旗仍在，点开详情可见章名）
   if(t&&chrome.some(r=>inter(r,box(t)))){t.setVisible(false);(m.root.getData('plate') as Phaser.GameObjects.Graphics|undefined)?.setVisible(false);continue;}take(t,m.root,m.root.getData('plate'),true);}
  for(const tier of ['large','medium','small'] as const)for(const m of this.cityMarkers)if(m.city.tier===tier&&shown(m.root)&&!this.isSelected(m.city))take(m.label,m.root,m.root.getData('plate'));}
 private isSelected(city:CityDef){return this.selected.kind==='city'&&this.selected.city.id===city.id;}
 private drawLinks(){
  this.links.clear();if(this.selected.kind!=='city')return;
  const from=this.selected.city,p=this.toScreen(from.x,from.y);
  for(const id of CITY_LINKS.get(from.id)??[]){const to=id===HOME.id?HOME:cityById(id)!,q=this.toScreen(to.x,to.y);
   // 虚线
   const len=Math.hypot(q.x-p.x,q.y-p.y),n=Math.max(1,Math.floor(len/10));this.links.lineStyle(2,0xffe9a8,.85);
   for(let i=0;i<n;i+=2){const t0=i/n,t1=Math.min(1,(i+1)/n);this.links.lineBetween(p.x+(q.x-p.x)*t0,p.y+(q.y-p.y)*t0,p.x+(q.x-p.x)*t1,p.y+(q.y-p.y)*t1);}
  }
 }
 /** 详情面板：标题 + 势力色分隔线 + 正文 + 旗印。 */
 private setDetail(title:string,color:number,glyph:string,body:string){
  this.detailTitle.setText(title);this.seal.set(color,glyph);
  const y=this.detailTitle.y+this.detailTitle.height+4,w=Math.min(this.detailBox.w,Math.max(this.detailTitle.width+60,300));
  this.detailRule.clear().fillStyle(color,1).fillRect(this.detailTitle.x,y,w*.35,2).fillStyle(0xc9a35e,.55).fillRect(this.detailTitle.x+w*.35,y+.5,w*.65,1);
  this.detail.setText(body);this.detailFull=body;if(this.card){const w=this.detail.getWrappedText(body);this.detailView?.setText(w.length>2?w[0]+'\n'+(w[1].length>=Math.max(...w.map(l=>l.length))-1?w[1].replace(/.$/,'…'):w[1]+' …'):w.join('\n')); /* 第二行本来就短（如「你的城池」）时不吃掉末字，在后面加省略号 */} /* 电脑版小卡两行放不下：第二行以「…」收尾，全文悬停可见 */
 }
 private refresh(){this.refreshInner();this.syncInks();}
 /** 攻城 / 军情 / 时局弹窗底板：电脑版漆底描金（2026-11-17 用户批准 UI 审查 C），手机仍用原底板。 */
 private modalPanel(pw:number,ph:number):Phaser.GameObjects.GameObject{if(W<=600)return panel(this,W/2,H/2,pw,ph);const g=this.add.graphics();lqPanel(g,W/2-pw/2,H/2-ph/2,pw,ph);return g;}
 /** 弹窗按钮：电脑版水墨笔触（主按钮朱墨），手机仍是漆金按钮；命中对象名不变，pointerup 触发。 */
 private modalButton(root:Phaser.GameObjects.Container,x:number,y:number,w:number,label:string,primary:boolean,name:string,fn:()=>void){
  if(W>600){const b=homeCommand(this,x,y,w,46,label,primary);b.hit.setName(name).on('pointerup',fn);root.add([b.g,b.caption,b.hit]);return;}
  const wb=worldButton(this,x,y,label,fn,w);wb.image.setName(name);root.add([wb.image,wb.text]);}
 /** 电脑版按钮换水墨笔触（同主页 / 营寨 / 结算）：原漆金按钮图透明保留做命中区，墨迹底跟随其位置、大小、可点状态。 */
 private inkify(btn:ReturnType<typeof worldButton>,primary:boolean){if(!this.textures.exists('btn_ink_primary_normal'))return;const e:InkBtn={btn,plate:null,primary,hover:false};this.inks.push(e);
  btn.image.on('pointerover',()=>{e.hover=true;this.syncInk(e);}).on('pointerout',()=>{e.hover=false;this.syncInk(e);}).on('pointerdown',()=>this.syncInk(e)).on('pointerup',()=>this.syncInk(e));this.syncInk(e);}
 private syncInks(){for(const e of this.inks)this.syncInk(e);}
 private syncInk(e:InkBtn){const im=e.btn.image,t=e.btn.text,on=!!im.input?.enabled;
  e.plate=inkPlate(this,e.plate,im.x,im.y,im.displayWidth*.86,Math.min(im.displayHeight,40),e.primary,on?(e.hover?'hover':'normal'):'disabled');
  if(e.plate)e.plate.setVisible(im.visible).setDepth(im.depth);
  // 原漆金图换成透明贴图（不能用 alpha≈0：手柄焦点会跳过近乎透明的对象），大小与命中区不变
  if(im.texture.key!=='__DEFAULT'){const w=im.displayWidth,h=im.displayHeight;im.setTexture('__DEFAULT').setDisplaySize(w,h);}im.setAlpha(1).clearTint();t.setDepth(Math.max(t.depth,im.depth+1)).setStroke(e.primary?'#2a0c06':'#16100a',3).setColor(!on?'#8e8576':e.hover?'#fff3d4':e.primary?'#f8e6bf':'#e8d3a6');}
 private refreshInner(){
  const sel=this.selected,routeId=sel.kind==='stage'?sel.chapter:sel.kind==='node'?this.chapterOf(sel.node)?.id:undefined;this.showRoute(routeId);
  for(const m of this.cityMarkers)(MARKERS_V2?paintSelectionV2:paintSelection)(m,this.isSelected(m.city));this.clampMap();this.paintChips();
  for(const m of this.intelMarkers)m.ring.setStrokeStyle(this.selected.kind==='intel'&&this.selected.event.id===m.event.id?3:0,0xfff0c0,1);
  if(this.selected.kind==='intel'){this.intelDetail(this.selected.event);return;}
  if(this.selected.kind==='city'&&this.status.get(this.selected.city.id)?.kind==='fog'){this.setDetail('迷雾未散',0x4a4f46,'？','迷雾未散，需先攻下相邻城池\n攻下周边城池后，此处的迷雾会散开。');this.action.text.setText('尚不可攻打');this.action.image.setAlpha(.45).disableInteractive();this.layoutActions(false);return;}
  if(this.selected.kind==='city'){
   const c=this.selected.city,owner=cityOwner(c.id,this.era,this.owned),era=eraDef(this.era),attack=cityAttackable(c.id,this.owned);
   const neighbors=[...(CITY_LINKS.get(c.id)??[])].map(id=>id===HOME.id?'义军营寨':cityById(id)!.name).join('、');
   const inc=cityIncome(c.tier,owner==='player'?cityLevels(c.id):emptyCityLevels()),sp=SPECIALTIES[c.id],yieldText=`${owner==='player'?'产出（进入城池可建设）':'占领后产出'}：每战 ${incomeText(inc)}${sp?` · 特产「${sp.title}」${sp.text}`:''}`;
   // 攻城分区：城池所属章节通关后才可攻打（守城不受限）
   const gateChapter=chapterById(CITY_CHAPTER[c.id]??'hulao');
   const alert=this.alertFor(c.id),gate=!citySiegeOpen(c.id,loadWorld())&&!isChapterTestRun()&&!alert&&owner!=='player',usable=(attack||!!alert)&&!gate,warn=attack?this.lossWarning():'';
   this.setDetail(`${c.name} · ${TIER_NAME[c.tier]} · ${c.region}`,FACTIONS[owner].color,sealGlyph(owner),`归属：${FACTIONS[owner].name}（公元${era.year}年 · ${era.name}）\n${alert?`告急：${FACTIONS[alert.attacker].name}来犯！守住可解除；出征别处则此城失守`:owner==='player'?'你的城池':gate?`通关第${gateChapter.numeral}章「${gateChapter.title}」后开放攻城`:attack?warn||'与你的领地相邻，可以攻打':this.status.get(c.id)?.reason??'尚不相邻：先攻下相邻城池'}\n${yieldText}\n相邻：${neighbors}`);
   const enter=owner==='player'&&!alert;
   this.action.text.setText(alert?'亲征 · 守城':enter?'进入城池':gate?`${gateChapter.short}后开放攻城`:attack?'亲征 · 攻城':'尚不可攻打');this.action.image.setAlpha(usable||enter?1:.45);if(usable||enter)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
   this.layoutActions(false);return;
  }
  if(this.selected.kind==='stage'){this.refreshStage(this.selected.chapter,this.selected.stage);return;}
  const n=this.selected.node,st=this.nodeState(n),locked=st==='locked',info=this.chapterOf(n),save=loadWorld(),done=info?chapterStagesDone(info.id,save):0;
  if(n.challenge){this.challengeDetail(n,st);return;}
  if(n.kind==='home'||!info){const next=currentChapter(save),cleared=CHAPTER_TIMELINE.filter(c=>chapterStagesDone(c.id,save)>=3).length;this.setDetail(n.name,FACTIONS.player.color,n.kind==='home'?'营':'锁',`${n.region} · ${n.kind==='home'?'玩家领地':'地区开发中'}\n从义军营寨出发，建设后再次出征。\n章节进度 ${cleared}/${CHAPTER_TIMELINE.length} · ${cleared>=CHAPTER_TIMELINE.length?'诸章皆已平定':`下一章：第${next.numeral}章「${next.title}」`}`);}
  else{const hard=hardChapterCleared(info.id),status=locked?`未解锁：${info.hint}`:st==='cleared'?`已平定（3/3 关）· ${hard?`乱世已平 · 称号「${HARD_TITLES[info.id]}」`:'可重温，或挑战乱世难度'}`:done?`进行中：已过 ${done}/3 关`:'已开放：可出征';
   this.setDetail(`第${info.numeral}章 · ${n.name}`,st==='cleared'?0x5f8f4e:locked?0x4a4f46:0x8e2a1e,st==='cleared'?'捷':locked?'锁':'战',`公元${info.year}年（${info.era}） · ${n.region}\n${status}\n${locked?'按史事时序逐章解锁。':this.lossWarning()||'战斗中的随军粮只在本局有效，战后另结算营寨军粮。'}`);}
  this.action.text.setText(locked?'尚未解锁':n.kind==='home'?"进入营寨":st==='cleared'?'重温 · 出征':'出征');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});
  this.layoutActions(st==='cleared');}
/** 挑战关「虎牢关 · 三英战吕布」详情：开放条件、首通奖励赤兔、胜场。 */
 private challengeDetail(n:WorldNode,st:'home'|ChapterState){const locked=st==='locked',wins=lubuClears(),r=LUBU_CHALLENGE.reward,rr=LUBU_CHALLENGE.repeatReward;
  this.setDetail(`挑战 · ${n.region} · ${n.name}`,locked?0x4a4f46:0x8c2a2a,locked?'锁':'布',`${locked?'未解锁：讨伐董卓第二关「荥阳」告捷后开放':wins?`已胜 ${wins} 场 · 可反复挑战`:'可选挑战 · 不影响讨董进度'}
吕布横扫与蓄力冲锋 · 三波后吕布出阵
奖励：${wins?`军粮 +${rewardGrain(rr.merits,rr.provisions)}`:`首胜得名马「赤兔」（入马厩）· 军粮 +${rewardGrain(r.merits,r.provisions)}`}${this.lossWarning()?'\n'+this.lossWarning():''}`);
  this.action.text.setText(locked?'尚未解锁':'挑战吕布');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});this.layoutActions(false);}
 private launchChallenge(){let hero:CharacterId=defaultHero(null);try{hero=defaultHero(localStorage.getItem('im_last_hero'));}catch{/* storage unavailable */} // 挑战关也只用主公出战（用户规则 2026-11-16）
  this.registry.remove('campaignTransfer');this.registry.set('runConfig',{character:hero});
  if(this.registry.get('battleReady'))this.scene.start('LubuGameScene');else{this.registry.set('pendingWarlord','LubuGameScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
/** 攻城出征面板：守军、时长、胜利条件、奖励，主公亲征。 */
 private openSiege(city:CityDef,defense=false){
  const alert=defense?this.alertFor(city.id):undefined;
  if(this.status.get(city.id)?.kind==='fog')return;
  if(this.siegeModal||(defense?!alert:!cityAttackable(city.id,this.owned)||(!citySiegeOpen(city.id,loadWorld())&&!isChapterTestRun())))return;
  const warn=alert?'':this.lossWarning(),dy=warn?(W>600?36:54):0;
  const owner=alert?alert.attacker:cityOwner(city.id,this.era,this.owned),T=SIEGE[city.tier],first=!this.capturedEver.includes(city.id),k=first?1+FIRST_CAPTURE_BONUS:1,desk=W>600;
  let hero:CharacterId=defaultHero(null);try{hero=defaultHero(localStorage.getItem('im_last_hero'));}catch{/* storage unavailable */}
  const root=this.add.container(0,0).setDepth(60).setName('siege-modal');this.siegeModal=root;
  const pw=Math.min(W-40,520),ph=(desk?400:560)+dy,px=W/2-pw/2,py=H/2-ph/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.72).setInteractive());
  root.add(this.modalPanel(pw,ph));
  const t=(x:number,y:number,s:string,size=16,color='#ede3c9')=>{const o=worldText(this,x,y,s,size,color);root.add(o);return o;};
  t(px+24,py+20,`${alert?'守卫':'攻打'} ${city.name}`,24,'#f0d79e').setFontFamily(W>600?TITLE_FONT:HEADING_FONT);t(px+24,py+54,`${TIER_NAME[city.tier]} · ${city.region} · ${alert?'来犯':'守军'}：${FACTIONS[owner].name}`,14,FACTIONS[owner].css);
  const how=city.tier==='small'?'拔掉帅旗，再占领府衙（限 2 分 30 秒）':city.tier==='medium'?'摧毁两座箭楼（会放箭），再占领府衙（限 3 分 30 秒）':'破城门、毁两座箭楼、击败大将，再占领府衙（限 5 分 30 秒）';
  const body=alert?`胜利条件：击退${city.tier==='small'?'两':city.tier==='medium'?'三':'四'}波来犯之敌，击败敌将（无城门）
敌将：${defenseBossName(city,owner)}
守城奖励：军粮 +${rewardGrain(T.reward.merits/2,T.reward.provisions/2)}，告急解除
失败城池仍在，可再守；改去别处出征则此城失守。`:`胜利条件：${how}
${city.tier==='large'?'守城大将：'+siegeBossName(city,owner):'守军：'+FACTIONS[owner].name+' · 占领府衙即破城'}
占领奖励：军粮 +${rewardGrain(T.reward.merits*k,T.reward.provisions*k)}${first?'（首次攻占 +50%）':''}
失败不损失城池与资源，可再次攻打。`;
  const info=t(px+24,py+86,body,14,'#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw-48);
  if(warn)t(px+24,info.y+info.height+4,warn,13,'#ff8a70').setWordWrapWidth(pw-48).setName('siege-warning');
  this.lordLine(root,px+24,py+dy+(desk?214:236),pw-48,hero,'siege-lord');
  const close=()=>{root.destroy();this.siegeModal=undefined;};
  this.modalButton(root,px+pw*.27,py+ph-(desk?48:58),pw*.38,'返回',false,'siege-cancel',close);
  this.modalButton(root,px+pw*.73,py+ph-(desk?48:58),pw*.38,alert?'出征守城':'出征攻城',true,'siege-go',()=>this.launchSiege(city,hero,!!alert));
 }
 /** 攻城 / 守城 / 军情只由主公亲征（用户 2026-11-17「攻城取消选择武将，所有地图占领需要自己亲历亲为」）：面板只写出战的主公，不能换将。 */
 private lordLine(root:Phaser.GameObjects.Container,x:number,y:number,w:number,hero:CharacterId,name:string){
  const n=CHARACTERS.find(c=>c.id===hero)?.name??hero;
  root.add(worldText(this,x,y,'出战',13,'#b6a07b'));
  if(W>600){const g=this.add.graphics();lqPanel(g,x,y+20,w,44,{shadow:false,glow:false});root.add(g);root.add(this.add.rectangle(x+w/2,y+42,w,44,0x000000,0).setName(name));}
  else root.add(this.add.rectangle(x+w/2,y+42,w,44,0x51402b,.96).setStrokeStyle(1,0xd7b778).setName(name));
  root.add(worldText(this,x+w/2,y+42,`主公 ${n} · 亲征`,18,'#f0d79e').setOrigin(.5).setName(name+'-text'));
 }
 private launchSiege(city:CityDef,hero:CharacterId,defense=false){
  if(!isChapterTestRun())try{localStorage.setItem('im_last_hero',hero);}catch{/* storage unavailable */}
  this.registry.remove('campaignTransfer');this.registry.set('siegeCity',city.id);if(defense)this.registry.set('siegeMode','defense');else this.registry.remove('siegeMode');this.registry.set('runConfig',{character:hero});
  if(this.registry.get('battleReady'))this.scene.start('SiegeGameScene');else{this.registry.set('pendingWarlord','SiegeGameScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');}
 }
 /** 出征：主按钮（hard=false）或「乱世难度」（hard=true）。章节节点从下一关出征，关卡标记从该关出征。 */
 private launch(hard:boolean){const sel=this.selected;if(sel.kind==='city'||sel.kind==='intel')return;
  if(sel.kind==='node'&&sel.node.challenge){if(this.nodeState(sel.node)!=='locked')this.launchChallenge();return;}
  if(sel.kind==='stage'){if(!stageOpen(sel.chapter,sel.stage,loadWorld())&&!isChapterTestRun())return;this.enterStage(sel.chapter,sel.stage,hard);return;}
  const info=this.chapterOf(sel.node);if(!info||sel.node.kind==='home'){this.enterNode();return;}
  if(this.nodeState(sel.node)==='locked')return;this.enterStage(info.id,undefined,hard);}
 private enterStage(id:TimelineChapterId,stage:number|undefined,hard:boolean){
  if(hard&&chapterState(id,loadWorld())==='cleared')this.registry.set('hardChapter',id);else this.registry.remove('hardChapter');
  if(id==='qunxiong'||id==='guandu'||id==='chibi'||id==='jingnan'||id==='shu'||id==='hanzhong'||id==='xiangfan'||id==='yiling'||id==='nanzheng'||id==='beifa'){if(stage)this.registry.set('worldStagePick',stage);this.scene.start(CAMPAIGNS[id].scene);return;}
  this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',id);if(stage)this.registry.set('selectedWorldStage',stage);
  if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
 /** 出征按钮布局：已平定章节并列显示「乱世难度」。 */
 private layoutActions(showHard:boolean){const desk=W>600,h=this.actionHome,a=this.action,b=this.hardBtn,bh=desk?48:62;
  b.image.setVisible(showHard);b.text.setVisible(showHard);if(showHard)b.image.setInteractive({useHandCursor:true});else b.image.disableInteractive();
  const place=(btn:ReturnType<typeof worldButton>,x:number,y:number,w:number)=>{btn.image.setPosition(x,y).setDisplaySize(w,this.card?40:bh);btn.text.setPosition(x,y);if(this.card)btn.text.setFontSize(w<150?14:15);};
  if(!showHard){place(a,h.x,h.y,h.w);return;}
  const id=this.selected.kind==='stage'?this.selected.chapter:this.selected.kind==='node'?this.chapterOf(this.selected.node)?.id:undefined;b.text.setText(id&&hardChapterCleared(id)?'乱世难度 ✓':'乱世难度');
  if(desk&&!this.card){place(b,h.x,h.y-27,h.w);place(a,h.x,h.y+27,h.w);}else{const half=(h.w-12)/2;place(b,h.x-h.w/2+half/2,h.y,half);place(a,h.x+h.w/2-half/2,h.y,half);}}
 /** 关卡详情：史事、首领、年号与出征状态。 */
 private refreshStage(id:TimelineChapterId,stage:number){const save=loadWorld(),info=chapterById(id),d=chapterStages(id)[stage-1],done=stage<=chapterStagesDone(id,save),open=stageOpen(id,stage,save)||isChapterTestRun(),cleared=chapterState(id,save)==='cleared';
  if(!d)return;const status=done?'✓ 已告捷 · 可重打此关':open?'可出征':chapterState(id,save)==='locked'?`未解锁：${info.hint}`:'先通关前一关';
  this.setDetail(`${d.code} ${d.name}`,done?0x5f8f4e:open?0x8e2a1e:0x4a4f46,d.seal,`${d.year} · 首领 ${d.boss}（${d.bossTitle}） · 第${info.numeral}章「${info.title}」\n${d.story}\n${status}${cleared&&open?` · 乱世：敌军生命×${HARD_MODE.enemyHp}、首领×${HARD_MODE.bossHp}`:''}`);
  this.action.text.setText(open?(done?'重打此关 · 选将':'从此关出征'):'尚未开放');this.action.image.setAlpha(open?1:.45);if(open)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
  this.layoutActions(cleared&&open);}
 /** 显示某章三关路线（重复调用同一章不重建）。 */
 private showRoute(id:TimelineChapterId|undefined){if(id===this.routeChapter)return;this.routeChapter=id;for(const p of this.pins)p.root.destroy();this.pins=[];
  if(!this.route){this.route=this.add.graphics().setDepth(2);if(this.mapMask)this.route.setMask(this.mapMask.createGeometryMask());}
  this.route.clear();if(!id)return;const save=loadWorld(),stages=chapterStages(id),done=chapterStagesDone(id,save);
  STAGE_POINTS[id].forEach((pt,i)=>{const n=i+1,d=stages[i];if(!d)return;const isDone=n<=done,open=stageOpen(id,n,save)||isChapterTestRun(),next=open&&!isDone;
   const root=this.add.container(0,0).setDepth(3).setName(`stage-pin-root-${id}-${n}`),g=this.add.graphics(),r=15;
   if(next){const ring=this.add.circle(0,0,r).setStrokeStyle(3,0xffd27a,.9);root.add(ring);this.tweens.add({targets:ring,scale:1.9,alpha:0,duration:1200,repeat:-1,ease:'Sine.easeOut'});}
   const pts=[{x:0,y:-r},{x:r,y:0},{x:0,y:r},{x:-r,y:0}];if(MARKERS_V2){g.destroy();}else g.fillStyle(isDone?0x3a2a12:open?0x5a1a12:0x2a2d28,.95).fillPoints(pts,true).lineStyle(2,isDone?0x9fd18a:open?0xffd27a:0x747a6f,1).strokePoints(pts,true,true);
   const glyph=worldText(this,0,0,isDone?'捷':open?d.seal:'锁',12,isDone?'#ffe7a8':open?'#ffe2a0':'#a4aa9c').setOrigin(.5);
   const label=worldText(this,0,24,`${d.code} ${d.name}`,12,open?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   const hit=this.add.circle(0,0,r+6,0x000000,.001).setInteractive({useHandCursor:true}).setName(`stage-pin-${id}-${n}`).setData('state',isDone?'cleared':open?'open':'locked');
   hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'stage',chapter:id,stage:n};this.refresh();});
   root.add([MARKERS_V2?sealGraphics(this,isDone?'cleared':open?'open':'locked',r):g,glyph,label,hit]);root.setData('label',label).setData('icon',hit);this.pins.push({stage:n,x:pt.x,y:pt.y,root});});}
 /** 路线重排：关卡标记跟随地图；关卡之间画虚线与箭头。 */
 private layoutRoute(visible:(x:number,y:number)=>boolean){if(!this.route)return;this.route.clear();const sel=this.selected;
  const pts=this.pins.map(p=>{const s0=this.toScreen(p.x,p.y),s=this.liftOffCity(s0.x,s0.y,true);p.root.setPosition(s.x,s.y).setVisible(visible(s.x,s.y));const on=sel.kind==='stage'&&sel.chapter===this.routeChapter&&sel.stage===p.stage;p.root.setScale(on?1.25:1);return s;});
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;if(len<40)continue;
   this.route.lineStyle(3,0x1b120b,.55);for(let t=20;t<len-20;t+=14)this.route.lineBetween(a.x+ux*t,a.y+uy*t,a.x+ux*Math.min(t+8,len-20),a.y+uy*Math.min(t+8,len-20));
   this.route.lineStyle(2,0xffd27a,.95);for(let t=20;t<len-20;t+=14)this.route.lineBetween(a.x+ux*t,a.y+uy*t,a.x+ux*Math.min(t+8,len-20),a.y+uy*Math.min(t+8,len-20));
   const mx=a.x+ux*len*.5,my=a.y+uy*len*.5;this.route.fillStyle(0xffd27a,1).fillTriangle(mx+ux*8,my+uy*8,mx-ux*5-uy*6,my-uy*5+ux*6,mx-ux*5+uy*6,my-uy*5-ux*6);}}
 /**
  * 战争迷雾（2026-11-18 用户「还有需要做战争迷雾觉得比较好点」）：视野由「已占城池 + 已开章节」推算，不加存档字段。
  * clear：我方城池、相邻（可攻 / 章节未开）城、告急城、已开章节地区内的城；dim：clear 城的邻城（半透明、看得到城名）；hidden：其余（城名「？」、不能点攻）。
  * 画面：手绘宣纸云雾平铺（wfog_tile）铺满，用手绘墨晕笔刷（wfog_brush）按视野挖开、边缘柔和；结果存成按局面命名的动态纹理，城池归属或章节变化时才重画。
  */
 private visibility(owned:readonly string[]=this.owned,except?:TimelineChapterId):Map<string,FogState>{
  const s=loadWorld(),regions=this.chapterAreas(except),v=new Map<string,FogState>();
  for(const c of CITIES){const clear=owned.includes(c.id)||!!this.alertFor(c.id)||cityAttackable(c.id,owned)||regions.some(r=>Math.hypot(r.x-c.x,r.y-c.y)<r.r*.85);v.set(c.id,clear?'clear':'hidden');}
  for(const c of CITIES)if(v.get(c.id)==='clear')for(const n of CITY_LINKS.get(c.id)??[])if(v.get(n)==='hidden')v.set(n,'dim');
  return v;}
 /** 挖雾点：营寨、已开章节地区（三瓣云形笔刷）、clear 城（全透）、dim 城（半透）。 */
 private fogPoints(owned:readonly string[]=this.owned,except?:TimelineChapterId):FogPt[]{
  const v=this.visibility(owned,except),out:FogPt[]=[{x:HOME.x,y:HOME.y,r:150,a:1,f:0}];
  for(const r of this.chapterAreas(except))out.push({x:r.x,y:r.y,r:r.r,a:1,f:2});
  for(const c of CITIES){const st=v.get(c.id),r=FOG_R[c.tier];if(st==='clear')out.push({x:c.x,y:c.y,r,a:1,f:c.tier==='large'?3:0});else if(st==='dim')out.push({x:c.x,y:c.y,r:r*.85,a:.5,f:1});}
  return out;}
 /** 已开章节的地区：该章三关所在地（关卡点周围 CHAPTER_R），比旧纸雾的大圆小，迷雾才有意义。 */
 private chapterAreas(except?:TimelineChapterId){const s=loadWorld();return CHAPTER_TIMELINE.filter(c=>c.id!==except&&chapterState(c.id,s)!=='locked').flatMap(c=>STAGE_POINTS[c.id].map(p=>({x:p.x,y:p.y,r:CHAPTER_R})));}
 private fogBrush(){if(!this.fogStamp)this.fogStamp=this.make.image({x:0,y:0,key:'wfog_brush',frame:0,add:false});return this.fogStamp;}
 /** 把一组挖雾点画进动态纹理：先平铺宣纸云雾，再逐点擦除。 */
 private paintFogTex(dt:Phaser.Textures.DynamicTexture,pts:FogPt[]){dt.clear();for(let x=0;x<this.mapW;x+=512)for(let y=0;y<this.mapH;y+=512)dt.stamp('wfog_tile',undefined,x,y,{originX:0,originY:0});
  const b=this.fogBrush();for(const p of pts){b.setFrame(p.f).setDisplaySize(p.r*2.6,p.r*2.6).setAlpha(p.a);dt.erase(b,p.x,p.y);}b.setAlpha(1);}
 private fogTexture(key:string,pts:FogPt[],force=false):Phaser.Textures.DynamicTexture|null{
  let dt=this.textures.exists(key)?this.textures.get(key) as Phaser.Textures.DynamicTexture:null;if(dt&&!force)return dt;
  if(!dt)dt=this.textures.addDynamicTexture(key,this.mapW,this.mapH);if(!dt)return null;this.paintFogTex(dt,pts);return dt;}
 private buildFog(){if(isChapterTestRun()||!this.textures.exists('wfog_tile')||!this.textures.exists('wfog_brush'))return;
  const s=loadWorld();this.fogVis=this.visibility();
  // 缓存键：已开章节 + 已占城池 + 告急城；局面不变时直接复用上次画好的纹理
  this.fogKey='wfog_v_'+CHAPTER_TIMELINE.filter(c=>chapterState(c.id,s)!=='locked').length+'_'+this.owned.join('.')+'_'+this.alerts.map(x=>x.city).join('.');
  for(const k of this.textures.getTextureKeys())if(k.startsWith('wfog_v_')&&k!==this.fogKey)this.textures.remove(k);
  const fresh=!this.textures.exists(this.fogKey);if(!this.fogTexture(this.fogKey,this.fogPoints()))return;this.fogPainted=fresh;
  this.fogImg=this.add.image(0,0,this.fogKey).setOrigin(0).setDisplaySize(this.mapW,this.mapH).setAlpha(.9).setName('world-fog');this.layer.add(this.fogImg);}
 /** 迷雾散开：先显示变化前的迷雾，从 (cx,cy) 起墨晕由近及远逐点擦开新视野，并在中心播手绘云雾散开序列帧；结束换回缓存纹理。 */
 private animateFog(prev:FogPt[],cx:number,cy:number,delay:number){const img=this.fogImg;if(!img||!this.fogKey)return;const anim=this.fogTexture('wfog_anim',prev,true);if(!anim)return;img.setTexture('wfog_anim');
  const now=this.fogPoints(),fresh=now.filter(p=>!prev.some(q=>Math.abs(q.x-p.x)<1&&Math.abs(q.y-p.y)<1&&q.a>=p.a)),b=this.fogBrush(),o={t:0},key=this.fogKey;
  this.tweens.add({targets:o,t:1,delay,duration:1800,ease:'Sine.easeOut',onUpdate:()=>{for(const p of fresh){const k=Phaser.Math.Clamp(o.t*1.5-Math.hypot(p.x-cx,p.y-cy)/700,0,1);if(k<=0)continue;b.setFrame(p.f).setDisplaySize(p.r*2.6*k,p.r*2.6*k).setAlpha(p.a*.3);anim.erase(b,p.x,p.y);}b.setAlpha(1);},
   onComplete:()=>{if(img.active)img.setTexture(key);if(this.textures.exists('wfog_anim'))this.textures.remove('wfog_anim');}});
  if(this.textures.exists('wfog_disperse')){if(!this.anims.exists('wfog-disperse'))this.anims.create({key:'wfog-disperse',frames:this.anims.generateFrameNumbers('wfog_disperse',{start:0,end:7}),frameRate:5});
   const spr=this.add.sprite(cx,cy,'wfog_disperse',0).setDisplaySize(300,300).setAlpha(0).setName('fog-disperse');this.layer.add(spr);
   this.tweens.add({targets:spr,alpha:.95,duration:250,delay});this.tweens.add({targets:spr,scale:spr.scale*1.5,duration:1700,delay,ease:'Sine.easeOut'});
   this.time.delayedCall(delay,()=>spr.play('wfog-disperse'));spr.once('animationcomplete',()=>spr.destroy());}}
 /** 新篇解锁：镜头移到新章节，纸雾展卷揭开，并显示章节引言（点按或数秒后收起）。 */
 private revealChapter(){const c=currentChapter(loadWorld()),node=WORLD_NODES.find(n=>this.chapterOf(n)?.id===c.id);if(node&&this.selected.kind==='node'&&this.selected.node===node)this.centerOn(node);
  if(this.fogImg){const r=STAGE_POINTS[c.id][0];this.animateFog(this.fogPoints(this.owned,c.id),r.x,r.y,200);}
  const desk=W>600,pw=Math.min(this.area.w-40,desk?560:460),root=this.add.container(W/2,this.area.y+(desk?110:130)).setDepth(40).setName('chapter-unlock-banner');
  const title=worldText(this,0,0,`新篇解锁 · 第${c.numeral}章「${c.title}」`,desk?20:22,'#ffe2a0').setOrigin(.5,0).setStroke('#1b120b',4);
  const fs=desk?13:15,intro=worldText(this,0,0,`公元${c.year}年（${c.era}）\n${wrapCJK(chapterIntro(c.id),Math.floor((pw-40)/fs))}`,fs,'#eadfc4').setOrigin(.5,0).setAlign('center').setLineSpacing(3);
  const ph=title.height+intro.height+34;title.setY(-ph/2+12);intro.setY(title.y+title.height+8);
  const g=this.add.graphics();lacquerPlate(g,-pw/2,-ph/2,pw,ph,.95,0xe5c47d);const hit=this.add.rectangle(0,0,pw,ph,0x000000,.001).setInteractive({useHandCursor:true}).setName('chapter-unlock-close');
  root.add([g,title,intro,hit]);root.setAlpha(0);const close=()=>{if(!root.active)return;this.tweens.add({targets:root,alpha:0,duration:350,onComplete:()=>root.destroy()});};hit.on('pointerup',close);
  this.tweens.add({targets:root,alpha:1,duration:450});this.time.delayedCall(5200,close);}
 /* —— 军情事件（WorldIntel.ts）—— */
 private intelMarker(event:IntelEvent,city:CityDef):IntelMarker{const info=INTEL_INFO[event.kind],root=this.add.container(0,0).setName('intel-'+event.id);
  const pulse=this.add.circle(0,0,15).setStrokeStyle(2,info.color,.9);this.tweens.add({targets:pulse,scale:1.9,alpha:0,duration:1500,repeat:-1,ease:'Sine.easeOut'});
  const ring=this.add.circle(0,0,17).setStrokeStyle(0,0xfff0c0,1);
  const body=(MARKERS_V2?this.add.circle(2,-12,18,0,.001):this.add.circle(0,0,14,info.color,.95).setStrokeStyle(2,0x1a120b,.9)).setInteractive({useHandCursor:true}).setName('intel-hit-'+event.id);
  const glyph=worldText(this,MARKERS_V2?intelGlyphPos(this).x:0,MARKERS_V2?intelGlyphPos(this).y:0,info.glyph,MARKERS_V2?12:14,'#fff6dc').setOrigin(.5).setStroke('#2a160c',3);
  if(MARKERS_V2){pulse.setPosition(0,12).setScale(1,.35);}
  body.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'intel',event};this.refresh();});
  root.add(MARKERS_V2?[pulse,ring,intelPennant(this,info.color),glyph,body]:[pulse,ring,body,glyph]);root.setDepth(5);return{event,city,root,ring};}
 /** 军情匾：依次选中下一件军情并居中。 */
 private nextIntel(){if(!this.intel.length)return;const i=this.selected.kind==='intel'?this.intel.findIndex(e=>e.id===(this.selected as {event:IntelEvent}).event.id):-1,event=this.intel[(i+1)%this.intel.length];this.selected={kind:'intel',event};const c=cityById(event.city);if(c)this.centerOnCity(c);this.refresh();}
 private centerOnCity(c:CityDef){this.layer.setPosition(this.area.x+this.area.w/2-c.x*this.zoom,(this.area.y+this.viewBottom)/2-c.y*this.zoom);this.clampMap();}
 private intelRewardText(event:IntelEvent){const r=intelReward(event),parts=[`军粮 +${rewardGrain(r.merits,r.provisions,r.money)}`];return parts.join(' · ')+(r.item?` · ${QUALITIES[r.item.quality].label}·${QUALITIES[r.item.quality].name}兵装 1 件（${Math.round(r.item.orangeChance*100)}% 为${QUALITIES.orange.label}·${QUALITIES.orange.name}）`:'');}
 private intelLeft(event:IntelEvent){const left=event.expires-seasonIndex(loadWorld().town)+1;return left>1?`剩余 ${left} 季（含本季）`:'仅限本季';}
 private intelDetail(event:IntelEvent){const info=INTEL_INFO[event.kind],c=cityById(event.city),f=FACTIONS[event.faction]?.name??'';
  this.setDetail(`${info.name} · ${intelTitle(event).split(' · ')[1]}`,info.color,info.glyph,`${this.intelLeft(event)}${c?` · ${c.name}（${c.region}）`:''}
${intelBrief(event,f)}
奖励：${this.intelRewardText(event)}${this.lossWarning()?'\n'+this.lossWarning():''}`);
  this.action.text.setText('亲征 · 军情');this.action.image.setAlpha(1).setInteractive({useHandCursor:true});this.layoutActions(false);}
 /** 军情出征面板：说明、奖励、期限，主公亲征。 */
 private openIntel(event:IntelEvent){
  if(this.siegeModal)return;const info=INTEL_INFO[event.kind],desk=W>600,warn=this.lossWarning(),dy=warn?(desk?36:54):0;
  let hero:CharacterId=defaultHero(null);try{hero=defaultHero(localStorage.getItem('im_last_hero'));}catch{/* storage unavailable */}
  const root=this.add.container(0,0).setDepth(60).setName('intel-modal');this.siegeModal=root;
  const pw=Math.min(W-40,520),ph=(desk?400:560)+dy,px=W/2-pw/2,py=H/2-ph/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.72).setInteractive());root.add(this.modalPanel(pw,ph));
  const t=(x:number,y:number,str:string,size=16,color='#ede3c9')=>{const o=worldText(this,x,y,str,size,color);root.add(o);return o;};
  t(px+24,py+20,intelTitle(event),24,'#f0d79e').setFontFamily(W>600?TITLE_FONT:HEADING_FONT);t(px+24,py+54,`军情 · ${info.name} · ${this.intelLeft(event)}`,14,info.css);
  const how=event.kind==='escort'?'胜利条件：商车抵达终点（守在车旁它才前进，约 90 秒）':event.kind==='bandit'?'胜利条件：清剿两波流寇，击败寇首（约 2 分钟）':`胜利条件：清剿三波亲兵，击败${event.general}（约 3 分钟）`;
  const fail=event.kind==='escort'?'商车被毁则商队被劫、此事作罢；超时或阵亡可再战。':event.kind==='bandit'?'失败可再战；本季未平定，该城本季产出减半。':'失败可再战，期限内悬赏有效。';
  const body=`${how}
奖励：${this.intelRewardText(event)}
${fail}`;
  const infoText=t(px+24,py+86,body,14,'#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw-48);
  if(warn)t(px+24,infoText.y+infoText.height+4,warn,13,'#ff8a70').setWordWrapWidth(pw-48).setName('intel-warning');
  this.lordLine(root,px+24,py+dy+(desk?214:236),pw-48,hero,'intel-lord');
  const close=()=>{root.destroy();this.siegeModal=undefined;};
  this.modalButton(root,px+pw*.27,py+ph-(desk?48:58),pw*.38,'返回',false,'intel-cancel',close);
  this.modalButton(root,px+pw*.73,py+ph-(desk?48:58),pw*.38,'出征',true,'intel-go',()=>this.launchIntel(event,hero));
 }
 private launchIntel(event:IntelEvent,hero:CharacterId){
  if(!isChapterTestRun())try{localStorage.setItem('im_last_hero',hero);}catch{/* storage unavailable */}
  this.registry.remove('campaignTransfer');this.registry.set('intelEvent',event.id);this.registry.set('runConfig',{character:hero});
  if(this.registry.get('battleReady'))this.scene.start('IntelGameScene');else{this.registry.set('pendingWarlord','IntelGameScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');}
 }
 private enterNode(){if(this.selected.kind!=='node')return;const n=this.selected.node;if(n.campaign){const c=CAMPAIGNS[n.campaign];if(c.open()||isChapterTestRun())this.scene.start(c.scene);return;}if(n.kind==='home'){this.scene.start('CityScene');return;}if(!n.chapter||!chapterUnlocked(n.chapter))return;this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',n.chapter);if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
}
