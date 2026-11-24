import Phaser from 'phaser';
import {CHARACTERS} from '../data/characters';
import {TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {CHARACTER_PASSIVES} from '../data/passives';
import {WEAPON_META,weaponName} from '../data/upgrades';
import {MARTIALS} from '../systems/RunGrowth';
import {FONT,HEADING_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,BALANCE,TITLE_FONT} from '../config';
import {visualTextureKey} from '../systems/ReadableTextures';
import {lqButton,lqHitBox,lqPanel,lqSkin,type LqState} from './LacquerKit';
import {SURRENDER_MOVES} from '../data/surrenderMoves';
import {SURRENDER_DEFS,YUJIN} from '../data/surrender';
import {TEMPLATES} from '../data/recruits';
import {CODEX_PASSIVES} from '../data/codexPassives';
import {HERO_STATS} from '../data/heroStats';
import {heroUnlocked} from '../systems/HeroUnlocks';
import {heroOwned,lordRules,lordHero} from '../systems/RosterStore';
import {LOCKED_HINT} from '../data/heroUnlocks';
import {CODEX_ENEMIES,CODEX_CHAPTERS,chapterEnemies,enemyCodexBody} from '../data/enemyCodex';
import {ART_V2_FILES} from '../systems/ArtStyle';
import {surrenderedIds} from '../systems/SurrenderStore';
const SURRENDERED=Object.keys(SURRENDER_MOVES).map(id=>{const d=SURRENDER_DEFS.find(x=>x.id===id&&x.template);return id===YUJIN.id?{id,name:YUJIN.name,title:'七军统帅',template:YUJIN.template}:{id,name:d?.name??id,title:d?.title??'',template:d?.template??'blade'};});
const TROOP_ROLE:Record<TroopKind,string>={swordsman:'前排近战，兼顾承伤与输出。',spearman:'长距离近战，适合应对骑兵。',archer:'远程射击，注意与敌军保持距离。',crossbowman:'连续远程输出，身板较薄。',guardian:'高生命与护甲，适合前线承伤。',rider:'移动迅速，适合追击与机动。',halberdier:'近战范围攻击，适合密集敌群。',medic:'治疗受伤友军，不主动攻击敌人。'};
type Tab='hero'|'troop'|'surrender'|'enemy';
/** 首页只读图鉴；选将仍经过现有主公与解锁规则，不在这里发放任何成长。 */
export class GameCodex {
 readonly root:Phaser.GameObjects.Container;
 private content:Phaser.GameObjects.Container;
 private tab:Tab='hero';private index=0;private page=0;private ownedOnly=false;private enemyChapter=1;
 private memory:Record<Tab,number>={hero:0,troop:0,surrender:0,enemy:0};
 private tabs:Array<{repaint:(s?:LqState)=>void}>=[];
 private detail?:Phaser.GameObjects.Text;private mask?:Phaser.Display.Masks.GeometryMask;private maskGraphics?:Phaser.GameObjects.Graphics;
 private viewport=new Phaser.Geom.Rectangle();private scroll=0;private maxScroll=0;private track?:Phaser.GameObjects.Graphics;private scrollHint?:Phaser.GameObjects.Text;
 private drag?:{id:number;y:number};private loads=new Set<string>();
 constructor(private scene:Phaser.Scene,private selectHero:(index:number)=>void){
  this.root=scene.add.container(0,0).setDepth(550).setScrollFactor(0).setName('game-codex').setData('ui',this);this.content=scene.add.container(0,0);
  this.root.add(scene.add.rectangle(W/2,H/2,W,H,0x0c0805,1).setInteractive());
  if(!D){const frame=scene.add.graphics();lqPanel(frame,8,8,W-16,H-16,{shadow:false});this.root.add(frame);}
  this.root.add(this.text(W/2,D?36:42,'将士图鉴',28,D?TITLE_FONT:HEADING_FONT).setOrigin(.5).setColor('#efd399'));
  const types:Tab[]=['hero','troop','surrender','enemy'];
  this.tabs=['武将','我军','降将','敌军'].map((label,i)=>{const t=this.text(W/2+(i-1.5)*124,D?76:90,label,18,HEADING_FONT).setOrigin(.5).setInteractive({useHandCursor:true}).setName('codex-tab-'+i).on('pointerup',()=>{this.memory[this.tab]=this.index;this.tab=types[i];this.index=this.memory[this.tab];const entries=this.tab==='hero'&&this.ownedOnly?CHARACTERS.map((c,i)=>({c,i})).filter(x=>heroUnlocked(x.c.id)).map(x=>x.i):null;this.page=Math.floor((entries?Math.max(0,entries.indexOf(this.index)):this.index)/this.perPage);this.render();});const skin=lqSkin(scene,t,t,()=>({w:110,h:D?40:56}),{tone:'auto',on:()=>this.tab===types[i]});lqHitBox(t,110,D?40:56);this.root.add([skin.gfx,t]);return skin;});
  this.root.add(this.content);
  this.button(this.root,W/2,H-(D?34:44),'返回','codex-close',()=>this.close(),180);
  scene.input.on('wheel',this.wheel);scene.input.on('pointerdown',this.down);scene.input.on('pointermove',this.move);scene.input.on('pointerup',this.up);scene.input.on('pointerupoutside',this.up);
  scene.input.keyboard?.on('keydown-ESC',this.escape);
  scene.load.on('complete',this.loaded);
  this.root.once('destroy',()=>{scene.input.off('wheel',this.wheel);scene.input.off('pointerdown',this.down);scene.input.off('pointermove',this.move);scene.input.off('pointerup',this.up);scene.input.off('pointerupoutside',this.up);scene.input.keyboard?.off('keydown-ESC',this.escape);scene.load.off('complete',this.loaded);this.mask?.destroy();this.maskGraphics?.destroy();});
  this.render();
 }
 private get perPage(){return D?12:8;}
 close():void{if(this.root.active)this.root.destroy();}
 private escape=()=>this.close();
 private loaded=()=>{if(this.root.active)this.render();};
 private text(x:number,y:number,value:string,size=16,font=FONT){return this.scene.add.text(x,y,value,{fontFamily:font,fontSize:size+'px',color:'#e9d5b0',resolution:2}).setScrollFactor(0);}
 private button(parent:Phaser.GameObjects.Container,x:number,y:number,label:string,name:string,run:()=>void,w=120,enabled=true){const t=this.text(x,y,label,D?15:19,HEADING_FONT).setOrigin(.5).setName(name);if(enabled)t.setInteractive({useHandCursor:true}).on('pointerup',run);const skin=lqSkin(this.scene,t,t,()=>({w,h:D?42:60}),{tone:'quiet',enabled:()=>enabled});if(enabled)lqHitBox(t,w,D?42:60);else t.setAlpha(.45);parent.add([skin.gfx,t]);return t;}
 private point(p:Phaser.Input.Pointer){return p.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;}
 private wheel=(p:Phaser.Input.Pointer,_o:unknown,_x:number,y:number)=>{if(this.root.active&&this.viewport.contains(this.point(p).x,this.point(p).y))this.scrollTo(this.scroll+y*.7);};
 private down=(p:Phaser.Input.Pointer)=>{const v=this.point(p);if(this.viewport.contains(v.x,v.y))this.drag={id:p.id,y:v.y};};
 private move=(p:Phaser.Input.Pointer)=>{if(this.drag?.id===p.id&&p.isDown){const y=this.point(p).y;this.scrollTo(this.scroll+this.drag.y-y);this.drag.y=y;}};
 private up=()=>{this.drag=undefined;};
 private scrollTo(n:number){this.scroll=Phaser.Math.Clamp(n,0,this.maxScroll);this.detail?.setY(this.viewport.y-this.scroll);const v=this.viewport,g=this.track?.clear();if(g&&this.maxScroll>0){const h=Math.max(26,v.height*v.height/(v.height+this.maxScroll)),y=v.y+(v.height-h)*this.scroll/this.maxScroll;g.fillStyle(0x78613c,.35).fillRect(v.right+7,v.y,3,v.height).fillStyle(0xc6a263,.9).fillRect(v.right+7,y,3,h);}this.scrollHint?.setText(this.maxScroll>0?(this.scroll>=this.maxScroll-1?'已到末尾 · 向下拖动回看':D?'滚轮查看详情':'在详情内上下滑动'):'资料已完整显示');}
 private troopKey(kind:TroopKind){const d=TROOPS[kind],key=visualTextureKey(this.scene,d.walkVisual?.texture??d.art+'_walk_sheet');if(this.scene.textures.exists(key))return key;const custom='codex_troop_'+kind;if(!this.scene.textures.exists(custom)&&!this.loads.has(custom)){this.loads.add(custom);this.scene.load.image(custom,'assets/processed-v2/troops/'+kind+'_walk.png');if(!this.scene.load.isLoading())this.scene.load.start();}if(this.scene.textures.exists(custom)){const t=this.scene.textures.get(custom);if(!t.has('down_0')){const cell=(t.getSourceImage() as HTMLImageElement).width/4;t.add('down_0',0,0,0,cell,cell);}}return custom;}
 private enemyKey(index:number){const e=CODEX_ENEMIES[index],source=e.art.walk;if(this.scene.textures.exists(source))return source;const key='codex_'+source,url=ART_V2_FILES[source];if(!url)return '';if(!this.scene.textures.exists(key)&&!this.loads.has(key)){this.loads.add(key);this.scene.load.image(key,url);if(!this.scene.load.isLoading())this.scene.load.start();}if(this.scene.textures.exists(key)){const tex=this.scene.textures.get(key);if(!tex.has('down_0')){const n=(tex.getSourceImage() as HTMLImageElement).width/4;tex.add('down_0',0,0,0,n,n);}}return key;}
 private render():void{
  this.detail?.clearMask();this.mask?.destroy();this.mask=undefined;this.maskGraphics?.destroy();this.maskGraphics=undefined;this.content.removeAll(true);this.detail=undefined;this.track=undefined;this.scrollHint=undefined;this.drag=undefined;for(const t of this.tabs)t.repaint();
  const hero=this.tab==='hero',sur=this.tab==='surrender',foe=this.tab==='enemy',unlocked=new Set(CHARACTERS.filter(c=>heroUnlocked(c.id)).map(c=>c.id));
  const all=foe?chapterEnemies(this.enemyChapter).map(i=>({i,name:CODEX_ENEMIES[i].name,locked:false})):hero?CHARACTERS.map((c,i)=>({i,name:c.name,locked:!unlocked.has(c.id)})):sur?SURRENDERED.map((c,i)=>({i,name:c.name,locked:false})):TROOP_KINDS.map((k,i)=>({i,name:TROOPS[k].name,locked:false}));
  const items=hero&&this.ownedOnly?all.filter(c=>!c.locked):all;
  if(!items.some(c=>c.i===this.index))this.index=items[0]?.i??0;
  const pages=Math.max(1,Math.ceil(items.length/this.perPage));this.page=Phaser.Math.Clamp(this.page,0,pages-1);
  const gx=24,listW=D?362:W-48,cw=(listW-24)/4,ch=D?78:88,gap=8,gy=D?154:194;
  this.content.add(this.text(gx,D?112:144,foe?'敌军 · '+items.length+'类':hero?'已解锁 '+unlocked.size+'/'+CHARACTERS.length:sur?'专属招式 · '+items.length+'位':'我方兵种 · '+items.length+'类',D?14:17).setName('codex-count'));
  if(hero)this.button(this.content,gx+listW-66,D?120:154,this.ownedOnly?'已解锁':'全部武将','codex-filter',()=>{this.ownedOnly=!this.ownedOnly;this.page=0;this.render();},132);
  if(foe)this.button(this.content,gx+listW-86,D?120:154,CODEX_CHAPTERS[this.enemyChapter].short+' ▸','codex-enemy-chapter',()=>{this.enemyChapter=(this.enemyChapter+1)%CODEX_CHAPTERS.length;this.index=chapterEnemies(this.enemyChapter)[0]??0;this.page=0;this.render();},172);
  for(const [slot,item]of items.slice(this.page*this.perPage,(this.page+1)*this.perPage).entries()){
   const x=gx+cw/2+(slot%4)*(cw+gap),y=gy+ch/2+Math.floor(slot/4)*(ch+gap),sel=this.index===item.i;
   const g=this.scene.add.graphics();let state:LqState=sel?'on':'idle';const paint=()=>{g.clear();lqButton(g,x,y,cw,ch,state,sel?'cinnabar':'quiet');};paint();
   const hit=this.scene.add.rectangle(x,y,cw,ch,0,.001).setInteractive({useHandCursor:true}).setName('codex-item-'+item.i).on('pointerup',()=>{this.index=item.i;this.render();}).on('pointerover',()=>{if(!sel){state='hover';paint();}}).on('pointerout',()=>{if(!sel){state='idle';paint();}});this.content.add([g,hit]);
   const key=foe?this.enemyKey(item.i):hero?CHARACTERS[item.i].portrait:sur?'':this.troopKey(TROOP_KINDS[item.i]);
   if(key&&this.scene.textures.exists(key)){const tex=this.scene.textures.get(key),frame=hero?undefined:tex.has('down_0')?'down_0':0,img=this.scene.add.image(x,y-12,key,frame);img.setScale(Math.min((D?38:44)/img.width,(D?38:44)/img.height));if(item.locked)img.setTintFill(0x655c4d);this.content.add(img);}
   else if(!sur)this.content.add(this.text(x,y-12,hero||foe?item.name.slice(0,1):TROOPS[TROOP_KINDS[item.i]].mark,20).setOrigin(.5));
   this.content.add(this.text(x,sur?y-8:y+14,item.name,foe?(D?12:16):D?14:18,HEADING_FONT).setOrigin(.5).setColor(sel?'#fff3d6':item.locked?'#a4977e':'#e9d5b0'));
   if(item.locked)this.content.add(this.text(x,y+31,'未归附',D?10:12).setOrigin(.5).setColor('#a4977e'));
   if(sur)this.content.add(this.text(x,y+13,surrenderedIds().includes(SURRENDERED[item.i].id)?'已归附':'招式资料',11).setOrigin(.5));
  }
  const listBottom=gy+Math.min(D?3:2,Math.ceil(items.length/4))*(ch+gap);
  if(pages>1){this.button(this.content,gx+48,listBottom+(D?22:30),'上一页','codex-prev',()=>{this.page--;this.render();},96,this.page>0);this.content.add(this.text(gx+listW/2,listBottom+(D?22:30),(this.page+1)+' / '+pages,14).setOrigin(.5).setName('codex-page'));this.button(this.content,gx+listW-48,listBottom+(D?22:30),'下一页','codex-next',()=>{this.page++;this.render();},96,this.page<pages-1);}
  const x=D?420:30,y=D?116:listBottom+(pages>1?80:18),width=D?W-x-32:W-72;
  let name='',body='',status='';
  if(foe){const e=CODEX_ENEMIES[this.index];name=e.name;status=CODEX_CHAPTERS[this.enemyChapter].title+' · 战术资料';body=enemyCodexBody(e);}
  else if(hero){const c=CHARACTERS[this.index],locked=!unlocked.has(c.id),stats=HERO_STATS[c.id];name=c.name+' · '+(c.faction??'蜀');status=locked?LOCKED_HINT:lordRules()&&lordHero()===c.id?'本档主公 · 已解锁':'已解锁 · 武将资料';
   body=locked?LOCKED_HINT+'\n\n继续征战，留意来投与劝降机会。归附后可查看完整兵器、被动与武艺资料。':c.desc+'\n\n基础本色（Lv.1）\n力量 '+stats.base[0]+' · 敏捷 '+stats.base[1]+' · 智力 '+stats.base[2]+' · 统御 '+stats.base[3]+'\n模板生命 '+Math.round(BALANCE.player.maxHp*c.hpMul)+' · 模板移速 '+Math.round(BALANCE.player.speed*c.speedMul)+'\n角色伤害系数 ×'+c.damageMul.toFixed(2)+'\n模板数值未计入四维本色、等级、装备、星图与战役加成；实战以属性面板为准。\n\n本命兵器 · '+weaponName(c.startWeapon,c.id)+'\n'+WEAPON_META[c.startWeapon].desc+'\n\n天赋被动 · '+CHARACTER_PASSIVES[c.id].name+'\n'+CODEX_PASSIVES[c.id]+'\n\n专属武艺（各最高Lv.3）\n'+Object.values(MARTIALS).filter(m=>m.character===c.id).map(m=>m.name+'：'+m.desc).join('\n\n');
  }else if(sur){const c=SURRENDERED[this.index],m=SURRENDER_MOVES[c.id];name=c.name+' · '+c.title;status=surrenderedIds().includes(c.id)?'本档已归附':'随行招式资料 · 不代表已招募';body='随行兵器\n按「'+TEMPLATES[c.template].name+'」模板出手。\n\n专属招式 · '+m.name+'\n'+m.desc+'\n\n触发条件\n累计出手 '+m.every+' 次，且距上次至少 '+m.cd/1000+' 秒，两项同时满足才释放。\n\n基础倍率\n每段为随行普通攻击的 '+Math.round(m.dmg*100)+'%，每段最多命中 '+m.maxHits+' 名敌人。\n\n识别提示\n预警与命中特效为友军淡青色。可玩武将与降将随行招式不是同一套技能。\n\n来源：'+m.from;
  }else{const k=TROOP_KINDS[this.index],d=TROOPS[k];name=d.name;status='基础Lv.1 · 不含训练和增益';body='兵种定位\n'+TROOP_ROLE[k]+'\n\n基础属性\n生命 '+d.hp+' · 护甲 '+d.armor+'\n'+(k==='medic'?'基础治疗':'每次伤害')+' '+d.damage+' · 行动间隔 '+d.cooldown+'秒\n'+(k==='medic'?'治疗距离':'攻击距离')+' '+d.range+' · 移速 '+d.speed+'\n\n招募\n基础价格 '+d.cost+' 钱币；实际费用随在编人数变化，请以招募界面为准。\n\n兵种升阶\n'+d.perk+'\n\n配合说明\n护阵时跟随保护主将，出击时按现有索敌规则作战。定位是配队建议，不代表强制站位或专门锁定某类敌人。\n\n实际属性会受到训练、装备、武将与军团效果影响；不设固定兵力人数上限。';}
  this.content.add(this.text(x,y,name,D?23:22,HEADING_FONT).setColor('#f6dc9a').setName('codex-detail-title').setWordWrapWidth(width,true));
  this.content.add(this.text(x,y+34,status,D?13:17).setColor('#cbb88d').setName('codex-status').setWordWrapWidth(width,true));
  const footer=H-(D?108:152),dy=y+76,vh=Math.max(88,footer-dy-(D?36:24));
  this.viewport.setTo(x,dy,width-16,vh);this.detail=this.text(x,dy,body,D?16:20).setLineSpacing(6).setWordWrapWidth(width-16,true).setName('codex-detail');this.content.add(this.detail);
  this.maskGraphics=this.scene.add.graphics().setScrollFactor(0).setVisible(false);this.maskGraphics.fillStyle(0xffffff).fillRect(x,dy,width,vh);this.mask=this.maskGraphics.createGeometryMask();this.detail.setMask(this.mask);this.maxScroll=Math.max(0,this.detail.height-vh);this.track=this.scene.add.graphics();this.content.add(this.track);
  this.scrollHint=this.text(x+width/2,dy+vh+12,'',D?11:14).setOrigin(.5).setColor('#ab9979').setName('codex-scroll-hint');this.content.add(this.scrollHint);this.scrollTo(0);
  if(hero){const c=CHARACTERS[this.index],allowed=heroOwned(c.id),label=allowed?'选择此武将出战':unlocked.has(c.id)?'本档主公已确定':'尚未归附';this.button(this.content,D?x+width/2:W/2,H-(D?90:116),label,'codex-select-hero',()=>{if(!heroOwned(c.id))return;this.selectHero(this.index);this.close();},D?260:280,allowed);}
 }
}
