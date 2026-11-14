import {playMenuMusic,menuMusic} from '../systems/Music';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {loadWorld,worldUnlocked,recruitReserve} from '../world/WorldStore';
import {TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {createReadableTextures,visualTextureKey} from '../systems/ReadableTextures';
import {isChapterTestRun} from '../systems/ChapterProgress';
export class CityRecruitScene extends Phaser.Scene{
 private page=0;private content:Phaser.GameObjects.Container|undefined;private status!:Phaser.GameObjects.Text;private message='';private owned:string[]=[];
 constructor(){super('CityRecruitScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'city_recruit_art','assets/world/rest-camp.webp');this.owned=[];for(const kind of TROOP_KINDS){const def=TROOPS[kind],key=def.walkVisual?.texture??`${def.art}_walk_sheet`;if(!this.textures.exists(key)){this.load.spritesheet(key,def.walkVisual?`assets/processed/legion/${kind}-walk.png`:`assets/processed/${def.art}_walk_sheet.png`,{frameWidth:96,frameHeight:96});this.owned.push(key);}}}
 create(){playMenuMusic(this);if(!worldUnlocked()&&!isChapterTestRun()){this.scene.start('MenuScene');return;}worldShell(this,'主城招募');releaseWorldArt(this,'city_recruit_art');this.add.image(W/2,H/2,'city_recruit_art').setDisplaySize(Math.max(W,H*1.5),Math.max(H,W/1.5)).setAlpha(.35).setDepth(-1);for(const kind of TROOP_KINDS){const d=TROOPS[kind],key=d.walkVisual?.texture??`${d.art}_walk_sheet`;if(!this.textures.get(key).has('down_0'))this.textures.get(key).add('down_0',0,0,0,96,96);}createReadableTextures(this);
 this.events.once('shutdown',()=>{for(const key of this.owned){if(this.textures.exists(`readable_${key}`))this.textures.remove(`readable_${key}`);if(this.textures.exists(key))this.textures.remove(key);}});
 this.status=worldText(this,24,66,'',13,'#b9ceb8').setWordWrapWidth(W-48);
 worldButton(this,W/2,H-62,'返回义军营寨',()=>this.scene.start('CityScene'),240).image.setName('reserve-home');this.render();}
 private render(){this.content?.destroy(true);this.content=this.add.container(0,0);const s=loadWorld(),desktop=W>600;this.status.setText(`粮草 ${s.provisions} · 后备 ${Object.values(s.reserve).reduce((a,b)=>a+b,0)}人\n最多携带2名后备 + 军营增援，存活归营；中途放弃不返还`);
 const kinds=desktop?TROOP_KINDS:TROOP_KINDS.slice(this.page*4,this.page*4+4);
 kinds.forEach((kind,i)=>{const width=desktop?(W-70)/4:(W-54)/2,height=desktop?158:230,x=20+(i%(desktop?4:2))*(width+10),y=desktop?130+Math.floor(i/4)*175:175+Math.floor(i/2)*248;
 const frame=panel(this,x+width/2,y+height/2,width,height);const def=TROOPS[kind],key=visualTextureKey(this,def.walkVisual?.texture??`${def.art}_walk_sheet`),icon=this.add.image(x+40,y+65,key,'down_0').setDisplaySize(64,64);const title=worldText(this,x+14,y+14,def.name,17);const detail=worldText(this,x+78,y+48,`后备 ${s.reserve[kind]??0}\n${def.cost}粮草/人`,12,'#bfd0b8').setWordWrapWidth(width-86);
 const btn=worldButton(this,x+width/2,y+height-35,'招募1人',()=>{this.message=recruitReserve(kind).message;this.render();},width-24);btn.image.setName(`reserve-buy-${kind}`);this.content!.add([frame,icon,title,detail,btn.image,btn.text]);});
 const note=worldText(this,24,H-168,this.message||'新招兵种优先出征，超出编制的士兵继续留守。',12,'#d5c5a2').setWordWrapWidth(W-48);this.content.add(note);
 if(!desktop){const button=worldButton(this,W/2,H-118,this.page?'查看前四兵种':'查看后四兵种',()=>{this.page=1-this.page;this.render();},230);this.content.add([button.image,button.text]);}}
}
