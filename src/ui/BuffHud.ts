import {activeCombos,AWAKEN} from '../data/schoolCombos';
import {SCHOOLS,SCHOOL_IDS,TIER_STEPS,tierOf} from '../data/schools';
import Phaser from 'phaser';
import type {Player} from '../entities/Player';
import {TACTICS,TREASURES,tacticDescription,type TacticId} from '../data/builds';
import {charmDef} from '../data/charms';
import {PASSIVE_RULES} from '../data/passives';
import {LVBU} from '../data/lvbu';
import {WEAPON_META,martialDescription} from '../data/upgrades';
import {MARTIALS,DRAG_TRAVEL,ATTRIBUTE_INFO,attributeIcon,type MasteryId,type AttributeId,type RunGrowth} from '../systems/RunGrowth';
import {FONT,DEPTH,IS_DESKTOP as D} from '../config';
import {type BuffProgress,countProgress,distanceProgress,chargeProgress,timerProgress} from './BuffProgress';
interface BuffEntry {id:string;icon:string;name:string;desc:string;/** 类别与生效方式（说明首行）。 */kind:string;badge:string;mark?:string;rare?:boolean;remaining?:number;/** 「每 N 次 / 每 N 秒 / 攒满」类的触发进度。 */progress?:BuffProgress|null;}
interface Slot {root:Phaser.GameObjects.Container;frame:Phaser.GameObjects.Graphics;image:Phaser.GameObjects.Image;badge:Phaser.GameObjects.Text;mark:Phaser.GameObjects.Text;hit:Phaser.GameObjects.Rectangle;entry?:BuffEntry;key:string;wasReady:boolean;flashUntil:number;}
/** 战法 / 宝物 / 觉醒 / 遗物的触发进度由 GameScene 提供（读各战斗系统，见 ui/BuffProgress）。 */
export type BuffProgressSource=(id:string,now:number)=>BuffProgress|null;
/** 进度条：图标框下方 5 像素一条（不碰右下角等级数字、左上角标）；满格变亮金，框外描金呼吸，刚满时闪一下。 */
const BAR_Y=37,BAR_W=36,FLASH_MS=420;
/** 武学（本命武器修习）的计数直接读 RunGrowth（公开字段）。 */
function masteryProgress(id:MasteryId,lv:number,g:RunGrowth,now:number):BuffProgress|null{
 switch(id){
  case 'dragon_charge':return countProgress(g.slashCount,4,'下一刀青龙重斩','刀',true);
  case 'kaishan':return countProgress(g.slashCount,4,'下一刀重劈','刀',true);
  case 'dragging_blade':return distanceProgress(g.travel,DRAG_TRAVEL[lv-1],'下一刀拖刀斩');
  case 'steady_aim':return chargeProgress(g.stationarySeconds*1000,5000,'满蓄：暴击 +'+5*(2+lv)+'%','静止');
  case 'pearl_volley':{const n=[5,4,3][lv-1];return countProgress(g.shotCount,n,'下一箭连珠齐射','箭');}
  case 'eight_trigrams':return g.flagCount>=2&&now<g.formationReadyAt?timerProgress(g.formationReadyAt,10000,now,'','阵法冷却'):countProgress(g.flagCount,3,'下次施法布八阵');
 }
 return null;
}
/** Small pooled HUD. Informational taps never reach the movement joystick. */
export class BuffHud {
 readonly root:Phaser.GameObjects.Container;
 private readonly slots:Slot[]=[];private readonly tip:Phaser.GameObjects.Container;private readonly tipBg:Phaser.GameObjects.Graphics;private readonly tipTitle:Phaser.GameObjects.Text;private readonly tipText:Phaser.GameObjects.Text;
 private now=0;private tipUntil=0;private holdUntil=0;private lastId='';private tipLine='';private readonly maximum=D?10:20;
 constructor(scene:Phaser.Scene){
  this.root=scene.add.container(22,180).setScrollFactor(0).setDepth(DEPTH.hud+3).setName('battle-buffs');
  const label=(x:number,y:number,value:string,size:number,color='#e9d2a0')=>scene.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color,resolution:2,stroke:'#17140d',strokeThickness:2}).setScrollFactor(0);
  this.root.add(label(0,0,'增益',11,'#c2b48f'));
  for(let i=0;i<this.maximum;i++){
   const x=i%2*42,y=24+Math.floor(i/2)*42,root=scene.add.container(x,y),frame=scene.add.graphics(),image=scene.add.image(18,18,'icon_passive').setDisplaySize(27,27),badge=label(32,32,'',11).setOrigin(1,1),mark=label(3,2,'',10,'#ddc594');
   // 命中框必须自身 scrollFactor=0：输入检测按对象自身的 scrollFactor 换算，否则镜头跟随主角后悬停/点按都落空
   const hit=scene.add.rectangle(18,18,40,40,0,0.001).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('buff-slot-'+i);
   const slot:Slot={root,frame,image,badge,mark,hit,key:'',wasReady:false,flashUntil:0};root.add([frame,image,mark,badge,hit]);this.root.add(root);this.slots.push(slot);
   hit.on('pointerover',()=>this.showTip(slot,1600)).on('pointerout',()=>{if(this.now>=this.holdUntil)this.hideTip();}).on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event?.stopPropagation();this.holdUntil=this.now+2400;this.showTip(slot,2400);});
  }
  this.tip=scene.add.container(90,24).setVisible(false);this.tipBg=scene.add.graphics();this.tipTitle=label(10,8,'',15);this.tipText=label(10,34,'',13,'#d4c7ad').setWordWrapWidth(228,true).setLineSpacing(3);this.tip.add([this.tipBg,this.tipTitle,this.tipText]);this.root.add(this.tip);
 }
 private hideTip():void{this.tip.setVisible(false);this.tipUntil=0;this.lastId='';this.tipLine='';}
 private showTip(slot:Slot,duration:number):void{
  const e=slot.entry;if(!e)return;this.lastId=e.id;this.tipUntil=this.now+duration;this.renderTip(slot,e);
 }
 /** 说明文字只在内容变化时重排（进度行按 0.1 秒 / 1 次的粒度变，不会每帧重建）。 */
 private renderTip(slot:Slot,e:BuffEntry):void{
  this.tipLine=e.progress?.text??'';
  this.tipTitle.setText(e.name);this.tipText.setText('【'+e.kind+'】\n'+e.desc+(this.tipLine?'\n▸ '+this.tipLine:''));const h=Math.max(68,this.tipText.height+46);
  this.tipBg.clear().fillStyle(0x17140d,.94).fillRect(0,0,248,h).lineStyle(1,0xb09056,.7).strokeRect(0,0,248,h);
  this.tip.setPosition(90,Math.min(slot.root.y,D?270:430)).setVisible(true);
 }
 /** 图标下方的像素进度条：N ≤ 12 逐格，否则连续；满格亮金 + 框外描金呼吸，刚满时外框白金闪一下。 */
 private drawProgress(slot:Slot,p:BuffProgress,now:number):void{
  const g=slot.frame,ready=p.ready,on=ready?0xffe08a:0xc99a4e,off=0x4d4230;
  if(ready&&!slot.wasReady)slot.flashUntil=now+FLASH_MS;slot.wasReady=ready;
  g.fillStyle(0x0d0b07,.9).fillRect(0,BAR_Y,BAR_W,5);
  if(p.seg>1){
   const inner=BAR_W-2,pw=Math.max(1,Math.floor((inner-(p.seg-1))/p.seg)),total=pw*p.seg+p.seg-1,x0=1+Math.floor((inner-total)/2),filled=Math.round(p.cur);
   for(let k=0;k<p.seg;k++)g.fillStyle(k<filled?on:off,1).fillRect(x0+k*(pw+1),BAR_Y+1,pw,3);
  }else{
   g.fillStyle(off,1).fillRect(1,BAR_Y+1,BAR_W-2,3).fillStyle(on,1).fillRect(1,BAR_Y+1,Math.round((BAR_W-2)*Math.min(1,p.max?p.cur/p.max:1)),3);
  }
  if(ready)g.lineStyle(1,0xffd879,.45+.4*Math.sin(now/150)).strokeRect(-.5,-.5,37,37);
  if(now<slot.flashUntil)g.lineStyle(2,0xfff2c8,(slot.flashUntil-now)/FLASH_MS).strokeRect(-2,-2,40,44);
 }
 /** 合击 / 觉醒再次触发时（不出小签）：让这些流派的徽印（觉醒 / 势档图标）闪一下。 */
 flashSchools(schools:string[]):void{const ids=new Set(schools.flatMap(s=>['awakening_'+s,'school_'+s]));for(const sl of this.slots)if(ids.has(sl.key))sl.flashUntil=this.now+FLASH_MS;}
 update(player:Player,now:number,visible:boolean,progressOf?:BuffProgressSource):void{
  this.now=now;if(!visible){this.root.setVisible(false);this.hideTip();return;}
  const g=player.growth,entries:BuffEntry[]=[];
  // 觉醒（6 势）：每关最多 AWAKEN.perStage 次、有冷却，图标下方进度条走冷却
  {const t=g.build.tags();for(const sc of SCHOOL_IDS)if(t[sc]>=6){const d=SCHOOLS[sc];entries.push({id:'awakening_'+sc,icon:d.icon,name:'觉醒 · '+d.tiers[6].name,desc:d.tiers[6].desc.replace(/^觉醒：/,'')+'\n身边敌人聚多了自动释放；每关最多 '+AWAKEN.perStage+' 次，两次之间至少 '+AWAKEN.cooldownMs/1000+' 秒。',kind:'觉醒 · '+d.name+' 6 势',badge:'醒',mark:d.short,rare:true});}}
  // 流派档位（2026-11-19 流派重做）：到 2 / 4 势的派各一个图标，角标写势
  {const t=g.build.tags();for(const sc of SCHOOL_IDS){const n=t[sc],tier=tierOf(n);if(tier<2)continue;const d=SCHOOLS[sc],got=TIER_STEPS.filter(x=>n>=x);entries.push({id:'school_'+sc,icon:d.icon,name:d.name+' · 势 '+n,desc:got.map(x=>x+' 势「'+d.tiers[x].name+'」：'+d.tiers[x].desc).join('\n'),kind:'流派 · '+got.map(x=>d.tiers[x].name).join(' · '),badge:String(n),rare:tier>=4});}}
  if(g.berserkUntil>now)entries.push({id:'berserk',icon:'growth_icon_berserk',name:'狂战丹',desc:'武器伤害提高25%，攻击速度提高20%。限时效果，进入新关卡会清除。',kind:'丹药 · 限时 '+Math.ceil((g.berserkUntil-now)/1000)+' 秒',badge:Math.ceil((g.berserkUntil-now)/1000)+'s',mark:'药',remaining:Math.min(1,(g.berserkUntil-now)/10000)});
  {const left=player.passive.wushuangLeft(now);if(left>0)entries.push({id:'lvbu_wushuang',icon:'icon_wushuang',name:'无双',desc:'狂暴：每次出手连打两次，攻速、移速 ×'+LVBU.haste+'，不会被击飞。',kind:'被动 · 限时 '+(left/1000).toFixed(1)+' 秒',badge:Math.ceil(left/1000)+'s',remaining:Math.min(1,left/LVBU.frenzyMs),rare:true});}
  {const left=player.passive.chargeGuardLeft(now);if(left>0)entries.push({id:'tieqi_guard',icon:'icon_zhanjin',name:'铁骑余威',desc:'锦马冲锋之后，受到的伤害减少'+Math.round((1-PASSIVE_RULES.chargeGuardMul)*100)+'%。',kind:'被动 · 限时 '+(left/1000).toFixed(1)+' 秒',badge:Math.ceil(left/1000)+'s',remaining:left/PASSIVE_RULES.chargeGuardMs,rare:true});}
  for(const id of g.build.treasures){const d=TREASURES[id];entries.push({id:'treasure_'+id,icon:'build_icon_'+id,name:d.name,desc:d.desc,kind:'信物 · 宝物',badge:'信',rare:true});}
  for(const id of Object.keys(g.masteries)as MasteryId[])if(g.masteries[id]>0){const d=MARTIALS[id];entries.push({id:'mastery_'+id,icon:'growth_icon_'+id,name:d.name+' Lv.'+g.masteries[id],desc:martialDescription(id,g.masteries[id]),kind:'武学 · 本命武器修习',badge:String(g.masteries[id]),mark:d.name.slice(0,2),progress:masteryProgress(id,g.masteries[id],g,now)});}
  for(const id of Object.keys(g.build.tactics)as TacticId[]){const level=g.build.level(id),d=TACTICS[id];if(level)entries.push({id:'tactic_'+id,icon:'build_icon_'+id,name:d.name+' Lv.'+level,desc:tacticDescription(id,level),kind:'战法',badge:String(level)});}
  // 合击排在战法后面（多了会挤进「其余 N 项」，不挤掉战法图标）
  for(const c of activeCombos(g.build.tags()))entries.push({id:'combo_'+c.id,icon:SCHOOLS[c.a].icon,name:'合击 · '+c.name,desc:c.desc,kind:'合击 · '+SCHOOLS[c.a].name+' × '+SCHOOLS[c.b].name,badge:'合',mark:SCHOOLS[c.a].short+SCHOOLS[c.b].short,rare:true});
  for(const w of player.weapons)if(w.level>1)entries.push({id:'weapon_'+w.id,icon:({spear_orbit:'icon_1',crossbow:'icon_2',guandao:'icon_guandao',flame_banner:'icon_3',zhenbei_blade:'icon_zhenbei',lianhuan_mines:'icon_lianhuan',sun_knives:'icon_sunknives',diaochan_fans:'icon_fans',baodiao_bow:'icon_baodiao',dangyang_roar:'icon_shemao',zhanjin_lance:'icon_zhanjin',shuanggu_swords:'icon_shuanggu',fangtian_ji:'icon_fangtian'})[w.id],name:WEAPON_META[w.id].name+' Lv.'+w.level,desc:WEAPON_META[w.id].desc+'。已强化至 Lv.'+w.level+'，详细属性可在修习面板查看。',kind:'本命武器 · 自动攻击',badge:String(w.level),mark:'兵'});
  for(const id of Object.keys(g.attributes)as AttributeId[])if(g.attributes[id]>0)entries.push({id:'attribute_'+id,icon:attributeIcon(id),name:ATTRIBUTE_INFO[id].name+' '+g.attributes[id]+'/'+g.attrMax,desc:ATTRIBUTE_INFO[id].effect,kind:'属性 · 常驻',badge:String(g.attributes[id]),mark:ATTRIBUTE_INFO[id].name[0]});
  for(const k of Object.keys(g.charmLegend)as (keyof typeof g.charmLegend)[]){const d=charmDef('charm_'+k);if(d)entries.push({id:'relic_'+k,icon:d.icon,name:d.name,desc:d.desc(g.charmLegend[k]?'orange':'purple'),kind:'信物 · 传奇',badge:'信',rare:true});}
  const overflow=entries.length>this.maximum,show=entries.slice(0,overflow?this.maximum-1:this.maximum);
  if(overflow){const rest=entries.slice(this.maximum-1);show.push({id:'overflow',icon:'icon_passive',name:'其余'+rest.length+'项增益',desc:rest.map(e=>e.name).join('、')+'。完整战法和宝物说明可在暂停菜单查看。',kind:'更多',badge:'+'+rest.length});}
  // 只为显示中的条目取进度（武学已在上面算好）
  if(progressOf)for(const e of show)if(e.progress===undefined&&e.id!=='overflow')e.progress=progressOf(e.id,now);
  this.root.setVisible(show.length>0);
  for(let i=0;i<this.slots.length;i++){
   const slot=this.slots[i],entry=show[i];slot.root.setVisible(!!entry);slot.entry=entry;if(!entry)continue;
   if(slot.key!==entry.id){slot.key=entry.id;slot.wasReady=!!entry.progress?.ready;slot.flashUntil=0;slot.image.setTexture(player.scene.textures.exists(entry.icon)?entry.icon:'icon_passive').setDisplaySize(27,27);}
   slot.badge.setText(entry.badge).setColor(entry.rare?'#f0d08b':'#d9e8d3');slot.mark.setText(entry.mark??'');
   slot.frame.clear().fillStyle(0x191711,.62).fillRect(0,0,36,36).lineStyle(1,entry.rare?0xc0a068:0x637a64,.7).strokeRect(.5,.5,35,35);
   if(entry.remaining!==undefined)slot.frame.fillStyle(0xca8d52,.9).fillRect(2,34,32*entry.remaining,2);
   if(entry.progress)this.drawProgress(slot,entry.progress,now);else slot.wasReady=false;
  }
  if(this.tip.visible){
   const at=this.slots.find(s=>s.entry?.id===this.lastId);
   if(now>=this.tipUntil||!at?.entry)this.hideTip();
   else if((at.entry.progress?.text??'')!==this.tipLine)this.renderTip(at,at.entry);
  }
 }
}
