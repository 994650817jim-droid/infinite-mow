import Phaser from 'phaser';
import {FONT,HEADING_FONT} from '../config';
import {LQ,lqDiamond} from './LacquerKit';

/**
 * 行营 / 营寨的人物（军需商人、军医）：2026-11-18 用户「军医和商人不要一个框框住」——人物不再放进卡框，
 * 直接站在帐中（水墨淡彩半身像，透明底，下摆本身化入淡墨），脚下一层淡影。
 * 2026-11-18 用户「对话框要优化一下」：名字与台词拆开——
 * - 名牌：黑漆描金小匾，标题字写名字，右上角压一枚手绘朱印（印里一个字）；
 * - 台词：头顶一只宣纸对话气泡（手绘墨笔描边、小尾巴指向人物），几句台词轮换，每隔几秒淡出淡入；鼠标移到人物上换下一句。
 * 立绘 / 气泡没载到时先空着，载好回调 onReady（宿主重绘）。
 */
export interface CampFigureSpec{key:string;path:string;name:string;seal:string;lines:readonly string[];objName:string;}
export const MERCHANT_FIGURE:CampFigureSpec={key:'camp_merchant_art',path:'assets/camp/merchant.webp',name:'军需商人',seal:'商',objName:'camp-merchant-art',
 lines:['将军，看看货？','刚到的好甲，就这几件。','粮够就买，过了这村……','战法卷轴？可遇不可求。']};
export const MEDIC_FIGURE:CampFigureSpec={key:'camp_medic_figure',path:'assets/camp/medic_figure.webp',name:'军医',seal:'医',objName:'camp-medic-art',
 lines:['将军，伤可不能拖。','药已煎好，趁热。','弟兄们的伤，交给老朽。']};
/** 人物放在哪：cx 中线、bottom 脚下（下摆）、height 立绘显示高度。 */
export interface FigurePlace{cx:number;bottom:number;height:number;}
/** 手绘对话气泡与朱印（ChatGPT 出图，tools/prepare-camp-bubble.mjs 抠图）。气泡尾巴在左下。 */
const BUBBLE={key:'camp_speech_bubble',path:'assets/camp/speech_bubble.webp'},SEAL={key:'camp_seal',path:'assets/camp/seal.webp'};
/** 台词轮换间隔（毫秒，真实时间）与淡入淡出时长。 */
export const CAMP_LINE_MS=5200,CAMP_LINE_FADE=380;

const loading=new Set<string>();
/** 每个人物当前说到第几句（重绘不从头再来）。 */
const saying=new Map<string,number>();
function load(scene:Phaser.Scene,list:Array<{key:string;path:string}>,done?:()=>void):boolean{
 const miss=list.filter(t=>!scene.textures.exists(t.key));if(!miss.length)return true;
 const L=scene.load;for(const t of miss)if(!loading.has(t.key)){loading.add(t.key);L.image(t.key,t.path);}
 L.once(Phaser.Loader.Events.COMPLETE,()=>{for(const t of miss)loading.delete(t.key);done?.();});if(!L.isLoading())L.start();return false;
}
export function loadCampFigure(scene:Phaser.Scene,spec:CampFigureSpec,done?:()=>void):void{if(load(scene,[spec,BUBBLE,SEAL],done))done?.();}

/** 画进 root：淡影 → 人物 → 名牌（漆匾 + 朱印）→ 头顶对话气泡（台词轮换）。返回是否已画出人物（false = 正在加载）。 */
export function drawCampFigure(scene:Phaser.Scene,root:Phaser.GameObjects.Container,spec:CampFigureSpec,at:FigurePlace,onReady?:()=>void):boolean{
 if(!load(scene,[spec,BUBBLE,SEAL],onReady))return false;
 const {cx,bottom,height}=at,top=bottom-height,shadow=scene.add.graphics().setScrollFactor(0);
 for(const [k,a] of [[1,.10],[.78,.12],[.55,.14]] as const)shadow.fillStyle(0x080503,a).fillEllipse(cx,bottom-8,height*.62*k,26*k);
 const img=scene.add.image(cx,bottom,spec.key).setOrigin(.5,1).setScrollFactor(0).setName(spec.objName).setInteractive({pixelPerfect:false});img.setScale(height/img.height);
 root.add([shadow,img]);
 // 名牌：黑漆描金小匾（LacquerKit 配色），右上角压朱印
 const name=scene.add.text(0,0,spec.name,{fontFamily:HEADING_FONT,fontSize:'17px',color:LQ.title,resolution:2}).setOrigin(.5).setLetterSpacing(4).setScrollFactor(0).setName(spec.objName+'-name');
 const pw=Math.round(name.width+44),ph=32,px=cx-pw/2,py=bottom-ph-4,g=scene.add.graphics().setScrollFactor(0).setName(spec.objName+'-plate');
 g.fillStyle(0x000000,.4).fillRoundedRect(px+3,py+4,pw,ph,7).fillStyle(LQ.lacquer,.97).fillRoundedRect(px,py,pw,ph,7);
 g.fillStyle(LQ.lacquerHi,.35).fillRect(px+5,py+4,pw-10,ph*.35);
 g.lineStyle(1.5,LQ.gold,.95).strokeRoundedRect(px+3,py+3,pw-6,ph-6,5);g.fillStyle(LQ.goldHi,1);for(const [dx,dy] of [[px+3,py+ph/2],[px+pw-3,py+ph/2]])lqDiamond(g,dx,dy,4);
 name.setPosition(cx-6,py+ph/2);
 const sx=px+pw-8,sy=py+2,seal=scene.add.image(sx,sy,SEAL.key).setScrollFactor(0).setDisplaySize(26,26).setAngle(-8).setName(spec.objName+'-seal');
 const sealChar=scene.add.text(sx,sy,spec.seal,{fontFamily:HEADING_FONT,fontSize:'13px',color:'#a3261c',fontStyle:'bold',resolution:2}).setOrigin(.5).setAngle(-8).setScrollFactor(0);
 root.add([g,name,seal,sealChar]);
 // 对话气泡：在头顶偏右，尾巴（左下）指向人物头部
 const bw=150,bub=scene.add.image(cx-35,top-52,BUBBLE.key).setOrigin(0).setScrollFactor(0).setName(spec.objName+'-bubble').setTint(0xb3a07e);bub.setScale(bw/bub.width); // 气泡压暗成陈年旧纸色（「白色背景看着就很突出」），不刺眼
 const tx=bub.x+bw*.52,ty=bub.y+bub.displayHeight*.42;
 const line=scene.add.text(tx,ty,spec.lines[(saying.get(spec.objName)??0)%Math.max(1,spec.lines.length)]??'',{fontFamily:FONT,fontSize:'12px',color:'#1e1208',resolution:2,align:'center',lineSpacing:1,wordWrap:{width:bw*.78,useAdvancedWrap:true}}).setOrigin(.5).setScrollFactor(0).setName(spec.objName+'-line');
 root.add([bub,line]);
 // 台词轮换：按真实时间走（休整时场景补间暂停），淡出 → 换句 → 淡入；鼠标移到人物上立刻换下一句
 let idx=(saying.get(spec.objName)??0)%Math.max(1,spec.lines.length),t=0,next=-1;const show=(i:number)=>{idx=(i+spec.lines.length)%spec.lines.length;saying.set(spec.objName,idx);next=-1;t=0;line.setText(spec.lines[idx]);};
 const step=()=>{if(!line.active){scene.events.off('postupdate',step);return;}if(spec.lines.length<2)return;const dt=scene.game.loop.delta;t+=dt;
  if(next<0&&t>=CAMP_LINE_MS){next=idx+1;t=0;}
  if(next>=0){const k=Math.min(1,t/CAMP_LINE_FADE);if(line.getData('phase')!=='in'){line.setAlpha(1-k);if(k>=1){show(next);line.setData('phase','in');next=-2;}}}
  if(next===-2){const k=Math.min(1,t/CAMP_LINE_FADE);line.setAlpha(k);if(k>=1){next=-1;line.setData('phase','');t=0;}}};
 scene.events.on('postupdate',step);line.once('destroy',()=>scene.events.off('postupdate',step));
 img.on('pointerover',()=>{if(spec.lines.length>1&&next===-1){next=idx+1;t=0;line.setData('phase','');}});
 line.setData('lines',spec.lines).setData('show',show);
 return true;
}
