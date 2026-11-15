import {activeAwakenings} from '../data/awakenings';
import Phaser from 'phaser';
import type {Player} from '../entities/Player';
import {TACTICS,TREASURES,tacticDescription,type TacticId} from '../data/builds';
import {RELICS} from '../data/relics';
import {WEAPON_META,martialDescription} from '../data/upgrades';
import {MARTIALS,ATTRIBUTE_INFO,type MasteryId,type AttributeId} from '../systems/RunGrowth';
import {FONT,DEPTH,IS_DESKTOP as D} from '../config';
interface BuffEntry {id:string;icon:string;name:string;desc:string;/** 类别与生效方式（说明首行）。 */kind:string;badge:string;mark?:string;rare?:boolean;remaining?:number;}
interface Slot {root:Phaser.GameObjects.Container;frame:Phaser.GameObjects.Graphics;image:Phaser.GameObjects.Image;badge:Phaser.GameObjects.Text;mark:Phaser.GameObjects.Text;hit:Phaser.GameObjects.Rectangle;entry?:BuffEntry;key:string;}
/** Small pooled HUD. Informational taps never reach the movement joystick. */
export class BuffHud {
 readonly root:Phaser.GameObjects.Container;
 private readonly slots:Slot[]=[];private readonly tip:Phaser.GameObjects.Container;private readonly tipBg:Phaser.GameObjects.Graphics;private readonly tipTitle:Phaser.GameObjects.Text;private readonly tipText:Phaser.GameObjects.Text;
 private now=0;private tipUntil=0;private holdUntil=0;private lastId='';private readonly maximum=D?10:20;
 constructor(scene:Phaser.Scene){
  this.root=scene.add.container(22,180).setScrollFactor(0).setDepth(DEPTH.hud+3).setName('battle-buffs');
  const label=(x:number,y:number,value:string,size:number,color='#e9d2a0')=>scene.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color,resolution:2,stroke:'#17140d',strokeThickness:2}).setScrollFactor(0);
  this.root.add(label(0,0,'增益',11,'#c2b48f'));
  for(let i=0;i<this.maximum;i++){
   const x=i%2*42,y=24+Math.floor(i/2)*42,root=scene.add.container(x,y),frame=scene.add.graphics(),image=scene.add.image(18,18,'icon_passive').setDisplaySize(27,27),badge=label(32,32,'',11).setOrigin(1,1),mark=label(3,2,'',10,'#ddc594');
   // 命中框必须自身 scrollFactor=0：输入检测按对象自身的 scrollFactor 换算，否则镜头跟随主角后悬停/点按都落空
   const hit=scene.add.rectangle(18,18,40,40,0,0.001).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('buff-slot-'+i);
   const slot:Slot={root,frame,image,badge,mark,hit,key:''};root.add([frame,image,mark,badge,hit]);this.root.add(root);this.slots.push(slot);
   hit.on('pointerover',()=>this.showTip(slot,1600)).on('pointerout',()=>{if(this.now>=this.holdUntil)this.hideTip();}).on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event?.stopPropagation();this.holdUntil=this.now+2400;this.showTip(slot,2400);});
  }
  this.tip=scene.add.container(90,24).setVisible(false);this.tipBg=scene.add.graphics();this.tipTitle=label(10,8,'',15);this.tipText=label(10,34,'',13,'#d4c7ad').setWordWrapWidth(228,true).setLineSpacing(3);this.tip.add([this.tipBg,this.tipTitle,this.tipText]);this.root.add(this.tip);
 }
 private hideTip():void{this.tip.setVisible(false);this.tipUntil=0;this.lastId='';}
 private showTip(slot:Slot,duration:number):void{
  const e=slot.entry;if(!e)return;this.lastId=e.id;this.tipUntil=this.now+duration;
  this.tipTitle.setText(e.name);this.tipText.setText('【'+e.kind+'】\n'+e.desc);const h=Math.max(68,this.tipText.height+46);
  this.tipBg.clear().fillStyle(0x17140d,.94).fillRect(0,0,248,h).lineStyle(1,0xb09056,.7).strokeRect(0,0,248,h);
  this.tip.setPosition(90,Math.min(slot.root.y,D?270:430)).setVisible(true);
 }
 update(player:Player,now:number,visible:boolean):void{
  this.now=now;if(!visible){this.root.setVisible(false);this.hideTip();return;}
  const g=player.growth,entries:BuffEntry[]=[];
  for(const a of activeAwakenings(g.build.tags()))entries.push({id:'awakening_'+a.id,icon:a.icon,name:a.name,desc:a.desc,kind:'觉醒 · 常驻',badge:'醒',rare:true});
  if(g.berserkUntil>now)entries.push({id:'berserk',icon:'growth_icon_berserk',name:'狂战丹',desc:'武器伤害提高25%，攻击速度提高20%。限时效果，进入新关卡会清除。',kind:'丹药 · 限时 '+Math.ceil((g.berserkUntil-now)/1000)+' 秒',badge:Math.ceil((g.berserkUntil-now)/1000)+'s',mark:'药',remaining:Math.min(1,(g.berserkUntil-now)/10000)});
  for(const id of g.build.treasures){const d=TREASURES[id];entries.push({id:'treasure_'+id,icon:'build_icon_'+id,name:d.name,desc:d.desc,kind:'宝物',badge:'宝',rare:true});}
  for(const id of Object.keys(g.masteries)as MasteryId[])if(g.masteries[id]>0){const d=MARTIALS[id];entries.push({id:'mastery_'+id,icon:'growth_icon_'+id,name:d.name+' Lv.'+g.masteries[id],desc:martialDescription(id,g.masteries[id]),kind:'武学 · 本命武器修习',badge:String(g.masteries[id]),mark:d.name.slice(0,2)});}
  for(const id of Object.keys(g.build.tactics)as TacticId[]){const level=g.build.level(id),d=TACTICS[id];if(level)entries.push({id:'tactic_'+id,icon:'build_icon_'+id,name:d.name+' Lv.'+level,desc:tacticDescription(id,level),kind:'战法',badge:String(level)});}
  for(const w of player.weapons)if(w.level>1)entries.push({id:'weapon_'+w.id,icon:({spear_orbit:'icon_1',crossbow:'icon_2',guandao:'icon_guandao',flame_banner:'icon_3'})[w.id],name:WEAPON_META[w.id].name+' Lv.'+w.level,desc:WEAPON_META[w.id].desc+'。已强化至 Lv.'+w.level+'，详细属性可在修习面板查看。',kind:'本命武器 · 自动攻击',badge:String(w.level),mark:'兵'});
  for(const id of Object.keys(g.attributes)as AttributeId[])if(g.attributes[id]>0)entries.push({id:'attribute_'+id,icon:'growth_icon_'+id,name:ATTRIBUTE_INFO[id].name+' '+g.attributes[id]+'/5',desc:ATTRIBUTE_INFO[id].effect,kind:'属性 · 常驻',badge:String(g.attributes[id]),mark:ATTRIBUTE_INFO[id].name[0]});
  for(const id of g.trinkets){const d={tiger_tally:{name:'虎符',desc:'友军伤害提高20%。',icon:'growth_icon_tiger_tally'},heart_mirror:{name:'护心镜',desc:'武将受到伤害减少15%。',icon:'growth_icon_heart_mirror'},wind_boots:{name:'疾风靴',desc:'移动速度提高10%。',icon:'growth_icon_wind_boots'}}[id];entries.push({id:'trinket_'+id,...d,kind:'饰品 · 常驻',badge:'饰',rare:true});}
  for(const id of player.relics){const d=RELICS.find(r=>r.id===id);if(d)entries.push({id:'relic_'+id,icon:d.icon,name:d.name,desc:d.desc,kind:'遗物',badge:'遗',rare:true});}
  const overflow=entries.length>this.maximum,show=entries.slice(0,overflow?this.maximum-1:this.maximum);
  if(overflow){const rest=entries.slice(this.maximum-1);show.push({id:'overflow',icon:'icon_passive',name:'其余'+rest.length+'项增益',desc:rest.map(e=>e.name).join('、')+'。完整战法和宝物说明可在暂停菜单查看。',kind:'更多',badge:'+'+rest.length});}
  this.root.setVisible(show.length>0);
  for(let i=0;i<this.slots.length;i++){
   const slot=this.slots[i],entry=show[i];slot.root.setVisible(!!entry);slot.entry=entry;if(!entry)continue;
   if(slot.key!==entry.id){slot.key=entry.id;slot.image.setTexture(player.scene.textures.exists(entry.icon)?entry.icon:'icon_passive').setDisplaySize(27,27);}
   slot.badge.setText(entry.badge).setColor(entry.rare?'#f0d08b':'#d9e8d3');slot.mark.setText(entry.mark??'');
   slot.frame.clear().fillStyle(0x191711,.62).fillRect(0,0,36,36).lineStyle(1,entry.rare?0xc0a068:0x637a64,.7).strokeRect(.5,.5,35,35);
   if(entry.remaining!==undefined)slot.frame.fillStyle(0xca8d52,.9).fillRect(2,34,32*entry.remaining,2);
  }
  if(this.tip.visible&&(now>=this.tipUntil||!show.some(e=>e.id===this.lastId)))this.hideTip();
 }
}
