import {thirdChapterUnlocked} from '../world/WorldStore';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {WORLD_NODES,type WorldNode} from '../world/WorldNodes';
import {loadWorld} from '../world/WorldStore';
import {chapterUnlocked} from '../systems/ChapterProgress';
export class WorldMapScene extends Phaser.Scene {
 private layer!:Phaser.GameObjects.Container;private selected:WorldNode=WORLD_NODES[0];private detail!:Phaser.GameObjects.Text;private action!:ReturnType<typeof worldButton>;
 private markers:Array<{node:WorldNode;root:Phaser.GameObjects.Container}>=[];private area={x:20,y:110,w:W-40,h:H-360};private minZoom=1;private zoom=1;private pointerX=0;private pointerY=0;private pinch=0;private pinching=false;private readonly mapW=1536;private readonly mapH=1024;
 constructor(){super('WorldMapScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'strategy_art','assets/world/strategy-map.webp');}
 create(){
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}worldShell(this,this.registry.get('worldReveal')?'三国天下开启':'三国天下');if(this.registry.get('worldReveal')){this.registry.remove('worldReveal');this.cameras.main.fadeIn(900,0,0,0);}releaseWorldArt(this,'strategy_art');this.markers=[];const s=loadWorld();worldText(this,24,64,`军功 ${s.merits}    粮草 ${s.provisions}`,15,'#bdcdb6');
  worldButton(this,W-105,43,'返回主城',()=>this.scene.start('CityScene'),150);
  const desktop=W>600;this.area={x:20,y:105,w:W-40,h:desktop?H-250:H-360};
  this.layer=this.add.container(0,0);this.layer.add(this.add.image(0,0,'strategy_art').setOrigin(0).setDisplaySize(this.mapW,this.mapH));
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.area.x,this.area.y,this.area.w,this.area.h);
  this.layer.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());
  for(const node of WORLD_NODES){const active=node.kind==='home'||node.campaign==='qunxiong'&&(thirdChapterUnlocked()||isChapterTestRun())||node.chapter&&chapterUnlocked(node.chapter),color=active?node.kind==='home'?0x88c5a4:0xe5c47d:0x747a6f;
   const marker=this.add.container(0,0);const circle=this.add.circle(0,0,18,0x16271e,.94).setStrokeStyle(2,color).setInteractive({useHandCursor:!!active}).setName(`node-${node.id}`);
   const icon=worldText(this,0,0,node.kind==='home'?'营':active?'战':'锁',13,active?'#f5dc9e':'#a4aa9c').setOrigin(.5);
   const label=worldText(this,0,25,node.name,13,active?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   circle.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10||this.pinching)return;this.selected=node;this.refresh();});marker.add([circle,icon,label]);this.markers.push({node,root:marker});
  }
  this.minZoom=Math.max(this.area.w/this.mapW,this.area.h/this.mapH);this.zoom=this.minZoom*1.2;
  this.layer.setScale(this.zoom).setPosition(W/2-this.mapW*.52*this.zoom,this.area.y+this.area.h/2-this.mapH*.45*this.zoom);this.clampMap();
  const inside=(p:Phaser.Input.Pointer)=>p.x>=this.area.x&&p.x<=this.area.x+this.area.w&&p.y>=this.area.y&&p.y<=this.area.y+this.area.h;
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{this.pointerX=p.x;this.pointerY=p.y;this.pinch=0;this.pinching=false;});
  this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(!p.isDown||!inside(p))return;const a=this.input.manager.pointers.filter(q=>q.isDown&&inside(q));if(a.length>=2){this.pinching=true;const distance=Phaser.Math.Distance.Between(a[0].x,a[0].y,a[1].x,a[1].y);if(this.pinch>0)this.setZoom(this.zoom*distance/this.pinch,(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);this.pinch=distance;}else{this.pinch=0;this.layer.x+=p.x-this.pointerX;this.layer.y+=p.y-this.pointerY;this.clampMap();}this.pointerX=p.x;this.pointerY=p.y;});
  this.input.on('wheel',(p:Phaser.Input.Pointer,_objs:unknown,_dx:number,dy:number)=>{if(inside(p))this.setZoom(this.zoom*(dy>0?.9:1.1),p.x,p.y);});
  const py=desktop?H-76:H-140,ph=desktop?132:200;panel(this,W/2,py,W-40,ph);
  this.detail=worldText(this,40,py-ph/2+14,'',desktop?14:16).setWordWrapWidth(desktop?W-300:W-80);
  this.action=worldButton(this,desktop?W-140:W/2,desktop?py:H-80,'进入主城',()=>this.enterNode(),desktop?190:W-100);this.action.image.setName('map-action');
  worldButton(this,W-55,this.area.y+35,'＋',()=>this.setZoom(this.zoom*1.2,W/2,this.area.y+this.area.h/2),48);
  worldButton(this,W-55,this.area.y+107,'－',()=>this.setZoom(this.zoom/1.2,W/2,this.area.y+this.area.h/2),48);
  worldText(this,30,this.area.y+this.area.h-25,'拖动查看 · 滚轮/双指缩放',11,'#fff0cf').setStroke('#15261c',3);this.refresh();
 }
 private setZoom(next:number,x:number,y:number){const z=Phaser.Math.Clamp(next,this.minZoom,this.minZoom*2.7),ratio=z/this.zoom;this.layer.x=x-(x-this.layer.x)*ratio;this.layer.y=y-(y-this.layer.y)*ratio;this.zoom=z;this.layer.setScale(z);this.clampMap();}
 private clampMap(){const a=this.area;this.layer.x=Phaser.Math.Clamp(this.layer.x,a.x+a.w-this.mapW*this.zoom,a.x);this.layer.y=Phaser.Math.Clamp(this.layer.y,a.y+a.h-this.mapH*this.zoom,a.y);for(const m of this.markers){const x=this.layer.x+m.node.x*this.mapW*this.zoom,y=this.layer.y+m.node.y*this.mapH*this.zoom;m.root.setPosition(x,y).setVisible(x>a.x+20&&x<a.x+a.w-20&&y>a.y+20&&y<a.y+a.h-45);}}
 private refresh(){const n=this.selected,locked=n.kind==='future'||(n.campaign==='qunxiong'?!thirdChapterUnlocked()&&!isChapterTestRun():!!n.chapter&&!chapterUnlocked(n.chapter));this.detail.setText(`${n.name}\n${n.region} · ${n.kind==='home'?'玩家领地':n.kind==='future'?'地区开发中':locked?n.campaign==='qunxiong'?'通关虎牢关后解锁':'通关黄巾之乱后解锁':'战役已开放'}\n${n.kind==='battle'?'战斗军粮为单局资源，战后另结算永久资源。':'从义军营寨出发，建设后再次出征。'}`);this.action.text.setText(locked?'尚未开放':n.kind==='home'?'进入主城':'选择武将 · 出征');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});}
 private enterNode(){const n=this.selected;if(n.campaign==='qunxiong'){if(thirdChapterUnlocked()||isChapterTestRun())this.scene.start('ThirdChapterScene');return;}if(n.kind==='home'){this.scene.start('CityScene');return;}if(!n.chapter||!chapterUnlocked(n.chapter))return;this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',n.chapter);if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
}
