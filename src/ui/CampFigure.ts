import Phaser from 'phaser';
import {FONT,HEADING_FONT} from '../config';
import {lqButton} from './LacquerKit';

/**
 * 行营 / 营寨的人物（军需商人、军医）：2026-11-18 用户「军医和商人不要一个框框住」——人物不再放进卡框，
 * 直接站在帐中（水墨淡彩半身像，透明底，下摆本身化入淡墨），脚下一层淡影；旁边一块小漆牌写名字和一句话。
 * 立绘没载到时先空着，载好回调 onReady（宿主重绘）。
 */
export interface CampFigureSpec{key:string;path:string;name:string;line:string;objName:string;}
export const MERCHANT_FIGURE:CampFigureSpec={key:'camp_merchant_art',path:'assets/camp/merchant.webp',name:'军需商人',line:'「将军，看看货？」',objName:'camp-merchant-art'};
export const MEDIC_FIGURE:CampFigureSpec={key:'camp_medic_figure',path:'assets/camp/medic_figure.webp',name:'军医',line:'「将军，伤可不能拖。」',objName:'camp-medic-art'};
/** 人物放在哪：cx 中线、bottom 脚下（下摆）、height 立绘显示高度。 */
export interface FigurePlace{cx:number;bottom:number;height:number;}

const loading=new Set<string>();
export function loadCampFigure(scene:Phaser.Scene,spec:CampFigureSpec,done?:()=>void):void{
 if(scene.textures.exists(spec.key)){done?.();return;}
 const L=scene.load;if(!loading.has(spec.key)){loading.add(spec.key);L.image(spec.key,spec.path);}
 L.once(Phaser.Loader.Events.COMPLETE,()=>{loading.delete(spec.key);done?.();});if(!L.isLoading())L.start();
}
/** 画进 root：淡影 → 人物 → 名牌（名字 + 一句话）。返回是否已画出人物（false = 正在加载）。 */
export function drawCampFigure(scene:Phaser.Scene,root:Phaser.GameObjects.Container,spec:CampFigureSpec,at:FigurePlace,onReady?:()=>void):boolean{
 if(!scene.textures.exists(spec.key)){loadCampFigure(scene,spec,onReady);return false;}
 const {cx,bottom,height}=at,shadow=scene.add.graphics().setScrollFactor(0);
 for(const [k,a] of [[1,.10],[.78,.12],[.55,.14]] as const)shadow.fillStyle(0x080503,a).fillEllipse(cx,bottom-8,height*.62*k,26*k);
 const img=scene.add.image(cx,bottom,spec.key).setOrigin(.5,1).setScrollFactor(0).setName(spec.objName);img.setScale(height/img.height);
 // 名牌：漆底描金小匾，压在人物下摆的淡墨上
 const tw=Math.min(176,Math.max(132,height*.5)),th=48,ty=bottom-th/2-6,g=scene.add.graphics().setScrollFactor(0);lqButton(g,cx,ty,tw,th,'on','gold');
 const name=scene.add.text(cx,ty-10,spec.name,{fontFamily:HEADING_FONT,fontSize:'16px',color:'#ffe7b0',resolution:2}).setOrigin(.5).setLetterSpacing(3).setScrollFactor(0).setName(spec.objName+'-name');
 const line=scene.add.text(cx,ty+11,spec.line,{fontFamily:FONT,fontSize:'12px',color:'#f1dcb0',resolution:2}).setOrigin(.5).setScrollFactor(0);
 root.add([shadow,img,g,name,line]);return true;
}
