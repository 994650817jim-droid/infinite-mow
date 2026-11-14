import {playMenuMusic,menuMusic} from '../systems/Music';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {loadWorld,saveWorld,BUILDINGS,upgradeBuilding,upgradeCost,storageUnavailable,incompatibleSave,type BuildingId} from '../world/WorldStore';
export class CityScene extends Phaser.Scene {
 private selected:BuildingId='barracks'; private detail!:Phaser.GameObjects.Text;private resources!:Phaser.GameObjects.Text;private message!:Phaser.GameObjects.Text;private upgrade!:ReturnType<typeof worldButton>;
 private readonly labels:Partial<Record<BuildingId,Phaser.GameObjects.Text>>={};
 constructor(){super('CityScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'city_art','assets/world/camp.webp');if(!this.textures.exists('art_panel'))this.load.image('art_panel','assets/processed/overhaul/bronze-panel-mobile.png');}
 create(){playMenuMusic(this);
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}
  // Battle atlases are reloaded on the next expedition, never kept alongside strategic artwork.
  const keys=this.registry.get('battleTextureKeys') as string[]|undefined;
  if(keys){for(const key of keys)if(this.textures.exists(key))this.textures.remove(key);this.registry.remove('battleTextureKeys');this.registry.set('battleReady',false);}
  saveWorld();worldShell(this,'义军营寨');releaseWorldArt(this,'city_art');
  worldButton(this,W-105,43,'招募后备',()=>this.scene.start('CityRecruitScene'),150).image.setName('city-recruit');
  this.resources=worldText(this,24,65,'',15,'#c9d7be');
  const desktop=W>600,artY=desktop?105:125,artH=desktop?210:330,artW=W-40;
  const cityImage=this.add.image(W/2,artY+artH/2,'city_art').setDisplaySize(artW,artW*2/3);
  const cityMask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(20,artY,artW,artH);cityImage.setMask(cityMask.createGeometryMask());this.events.once('shutdown',()=>cityMask.destroy());
  // Hotspots follow the actual three building clusters painted into the town image.
  (['barracks','farm','clinic'] as BuildingId[]).forEach((id,i)=>{
   const x=20+artW*[.17,.51,.84][i],y=artY+artH*.50;
   const hit=this.add.rectangle(x,y,artW*.28,artH*.42,0,0).setInteractive({useHandCursor:true}).setName(`building-${id}`);
   hit.on('pointerdown',()=>{this.selected=id;this.refresh();});
   this.labels[id]=worldText(this,x,artY+artH*.79,'',desktop?15:16,'#f3e0a5').setOrigin(.5).setBackgroundColor('#15261f').setPadding(6,5).setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.selected=id;this.refresh();});
  });
  const py=desktop?383:615,ph=desktop?118:250;
  panel(this,W/2,py,W-40,ph);
  this.detail=worldText(this,40,py-ph/2+18,'',desktop?15:17).setWordWrapWidth(W-80);
  this.upgrade=worldButton(this,desktop?W-150:W/2,desktop?py+25:py+ph/2-40,'升级建筑',()=>{const result=upgradeBuilding(this.selected);this.message.setText(result.message);this.refresh();},desktop?190:W-100);this.upgrade.image.setName('city-upgrade');
  this.message=worldText(this,24,desktop?H-90:H-148,'',12,'#c9bf99').setWordWrapWidth(W-48);
  worldButton(this,desktop?125:W*.27,H-(desktop?42:63),'天下地图',()=>this.scene.start('WorldMapScene'),desktop?180:W*.40).image.setName('city-map');
  worldButton(this,desktop?350:W*.73,H-(desktop?42:63),'出征备战',()=>{this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter','huangjin');this.openPreparation();},desktop?180:W*.40).image.setName('city-expedition');
  this.refresh();
 }
 private openPreparation(){if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
 private refresh(){const s=loadWorld();this.resources.setText(`军功 ${s.merits}    粮草 ${s.provisions}  · 永久资源`);for(const id of ['barracks','farm','clinic'] as BuildingId[])this.labels[id]?.setText(`${this.selected===id?'◆ ':''}${BUILDINGS[id].name} Lv${s.buildings[id]}`).setColor(this.selected===id?'#ffe5a5':'#d6ddc7');const b=BUILDINGS[this.selected],lv=s.buildings[this.selected],cost=upgradeCost(lv),next=cost?`下级：${b.description(lv+1)}\n消耗 ${cost.merits} 军功 · ${cost.provisions} 粮草`:'已达最高等级';this.detail.setText(`${b.name} · Lv${lv}\n${b.description(lv)}\n${next}`);const can=!!cost&&s.merits>=cost.merits&&s.provisions>=cost.provisions;this.upgrade.image.setAlpha(can?1:.5);this.upgrade.text.setText(cost?'升级建筑':'已满级');if(storageUnavailable)this.message.setText(incompatibleSave?'存档版本较新，请使用较新版本游戏；本次仅临时游玩':'浏览器存储不可用，进度仅保留本次会话');}
}
