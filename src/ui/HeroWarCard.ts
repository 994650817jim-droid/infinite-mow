import Phaser from 'phaser';
import {CHARACTERS} from '../data/characters';
import {MARTIALS} from '../systems/RunGrowth';
import {WEAPON_META} from '../data/upgrades';
import {CHARACTER_PASSIVES} from '../data/passives';
import {FONT,HEADING_FONT,TITLE_FONT,RENDER_SCALE,IS_DESKTOP} from '../config';
const titles=['游龙先锋','重甲武圣','百步神射','卧龙军师'];const roles=['突进','近战','远程','法术'];
/** 闲章与题句（原创短句，取材常见三国典故）。 */
const leisure=['常胜','忠义','神射','卧龙'];
const verses=['长坂单骑护幼主','千里单骑寻故主','定军山下斩夏侯','隆中一对定三分'];
type FrameState='normal'|'hover'|'selected'|'pressed';

/** 立轴形制尺寸：木轴、天头（上）、地头（下）、两侧绫边；画心为宣纸。 */
interface ScrollLayout{rod:number;top:number;bottom:number;side:number;px:number;py:number;pw:number;ph:number;small:boolean}
function layoutOf(w:number,h:number):ScrollLayout{
 const small=w<250,rod=small?13:16,top=small?18:24,bottom=small?12:16,side=small?8:11;
 const px=side,py=rod+top,pw=w-side*2,ph=h-py-rod-bottom;return{rod,top,bottom,side,px,py,pw,ph,small};
}
const HANG=18; // 挂绳在卡片上方占用的高度
const canvasOf=(w:number,h:number,scale=RENDER_SCALE)=>{const c=document.createElement('canvas');c.width=Math.ceil(w*scale);c.height=Math.ceil(h*scale);const ctx=c.getContext('2d')!;ctx.scale(scale,scale);return{c,ctx};};
const rng=(seed:number)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

/** 圆柱木轴：明暗、高光、木纹，两端雕花轴头。 */
function drawRod(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,hh:number):void{
 const g=ctx.createLinearGradient(0,y,0,y+hh);g.addColorStop(0,'#3a2213');g.addColorStop(.25,'#9a6a3e');g.addColorStop(.45,'#c08a54');g.addColorStop(.7,'#6b4325');g.addColorStop(1,'#2a170b');
 ctx.fillStyle=g;ctx.fillRect(x+8,y+1,w-16,hh-2);
 ctx.globalAlpha=.18;ctx.strokeStyle='#2a160a';ctx.lineWidth=.6;for(let i=0;i<w;i+=7){ctx.beginPath();ctx.moveTo(x+8+i,y+2);ctx.bezierCurveTo(x+11+i,y+hh*.4,x+5+i,y+hh*.6,x+9+i,y+hh-2);ctx.stroke();}ctx.globalAlpha=1;
 for(const side of[0,1]){
  const cx=side?x+w-6:x+6,cy=y+hh/2,r=hh*.62;
  const cap=ctx.createRadialGradient(cx-r*.3,cy-r*.35,1,cx,cy,r);cap.addColorStop(0,'#fff0c0');cap.addColorStop(.45,'#d8a94e');cap.addColorStop(1,'#6a4612');
  ctx.beginPath();ctx.ellipse(cx,cy,r*.72,r,0,0,Math.PI*2);ctx.fillStyle=cap;ctx.fill();ctx.strokeStyle='#4a2f0a';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.ellipse(cx,cy,r*.38,r*.55,0,0,Math.PI*2);ctx.strokeStyle='rgba(255,236,170,.75)';ctx.stroke();
  ctx.fillStyle='#8a5e1a';ctx.fillRect(side?x+w-14:x+10,y+1,4,hh-2);
 }
}
/** 回纹（雷纹）横带。 */
function meander(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,color:string,size:number):void{
 ctx.strokeStyle=color;ctx.lineWidth=1;
 for(let i=x;i<x+w-size;i+=size+2){ctx.beginPath();ctx.moveTo(i,y+size);ctx.lineTo(i,y);ctx.lineTo(i+size,y);ctx.lineTo(i+size,y+size*.7);ctx.lineTo(i+size*.35,y+size*.7);ctx.lineTo(i+size*.35,y+size*.35);ctx.lineTo(i+size*.68,y+size*.35);ctx.stroke();}
}

/** 立轴底：挂绳、木轴、织锦天头地头、惊燕、绫边、金线、宣纸与淡墨远山。 */
function scrollTexture(s:Phaser.Scene,w:number,h:number):string{
 const key=`ink-scroll2-${w}x${h}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const L=layoutOf(w,h),{rod,top,bottom,px,py,pw,ph}=L,{c,ctx}=canvasOf(w,h+HANG),r=rng(w*31+h);
 ctx.translate(0,HANG);
 // 挂绳与挂钩
 ctx.strokeStyle='#6a4a2a';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(w*.38,2);ctx.lineTo(w/2,-HANG+5);ctx.lineTo(w*.62,2);ctx.stroke();
 ctx.fillStyle='#c9a35a';ctx.beginPath();ctx.arc(w/2,-HANG+4,3,0,Math.PI*2);ctx.fill();
 // 绫边整体（深青），细斜纹
 const silk=ctx.createLinearGradient(0,0,w,h);silk.addColorStop(0,'#283741');silk.addColorStop(1,'#19242c');ctx.fillStyle=silk;ctx.fillRect(2,rod-2,w-4,h-rod*2+4);
 ctx.save();ctx.beginPath();ctx.rect(2,rod-2,w-4,h-rod*2+4);ctx.clip();ctx.globalAlpha=.07;ctx.strokeStyle='#b8ccd6';for(let x=-h;x<w;x+=4){ctx.beginPath();ctx.moveTo(x,h);ctx.lineTo(x+h,0);ctx.stroke();}ctx.globalAlpha=1;ctx.restore();
 // 天头 / 地头：赭色织锦 + 回纹带
 for(const [y0,hh] of [[rod-1,top+1],[h-rod-bottom,bottom+1]] as const){
  const b=ctx.createLinearGradient(0,y0,0,y0+hh);b.addColorStop(0,'#5b3a22');b.addColorStop(1,'#46291a');ctx.fillStyle=b;ctx.fillRect(2,y0,w-4,hh);
  ctx.globalAlpha=.55;meander(ctx,8,y0+hh/2-3,w-16,'#c9a35a',6);ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(201,163,90,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,y0+.5);ctx.lineTo(w-2,y0+.5);ctx.moveTo(2,y0+hh-.5);ctx.lineTo(w-2,y0+hh-.5);ctx.stroke();
 }
 // 惊燕：天头上两条垂带
 for(const fx of[.3,.7]){const x=w*fx-3;ctx.fillStyle='#7a5a3a';ctx.fillRect(x,rod-1,6,top+1);ctx.strokeStyle='rgba(230,200,140,.6)';ctx.lineWidth=.8;ctx.strokeRect(x+.5,rod-.5,5,top);}
 // 宣纸
 const paper=ctx.createLinearGradient(0,py,0,py+ph);paper.addColorStop(0,'#efe5ce');paper.addColorStop(.55,'#e7dabd');paper.addColorStop(1,'#dccba8');ctx.fillStyle=paper;ctx.fillRect(px,py,pw,ph);
 ctx.save();ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip();
 // 淡墨远山：三层，越远越淡；薄雾带；远处飞鸟
 const ridge=(base:number,amp:number,alpha:number,seed:number)=>{const rr=rng(seed);ctx.fillStyle=`rgba(46,40,34,${alpha})`;ctx.beginPath();ctx.moveTo(px,py+ph);let y=py+ph*base;ctx.lineTo(px,y);for(let x=px;x<=px+pw;x+=pw/14){y=py+ph*(base-amp*(.4+.6*Math.abs(Math.sin(x/pw*5+seed))))+(rr()-.5)*6;ctx.lineTo(x,y);}ctx.lineTo(px+pw,py+ph);ctx.closePath();ctx.fill();};
 ridge(.5,.16,.05,3);ridge(.6,.12,.07,7);ridge(.72,.08,.08,11);
 const mist=ctx.createLinearGradient(0,py+ph*.52,0,py+ph*.68);mist.addColorStop(0,'rgba(239,229,206,0)');mist.addColorStop(.5,'rgba(239,229,206,.7)');mist.addColorStop(1,'rgba(239,229,206,0)');ctx.fillStyle=mist;ctx.fillRect(px,py+ph*.5,pw,ph*.2);
 ctx.strokeStyle='rgba(40,34,28,.45)';ctx.lineWidth=1;for(let i=0;i<3;i++){const bx=px+pw*(.12+i*.07),by=py+ph*(.2+i*.025);ctx.beginPath();ctx.moveTo(bx-4,by);ctx.quadraticCurveTo(bx-2,by-2.5,bx,by);ctx.quadraticCurveTo(bx+2,by-2.5,bx+4,by);ctx.stroke();}
 // 纤维、斑驳、做旧暗边
 for(let i=0;i<pw*ph/80;i++){ctx.strokeStyle=`rgba(120,96,60,${.035+r()*.05})`;ctx.lineWidth=.6;const x=px+r()*pw,y=py+r()*ph,a=r()*Math.PI,l=3+r()*9;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);ctx.stroke();}
 for(let i=0;i<16;i++){const x=px+r()*pw,y=py+r()*ph,rad=10+r()*40,g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,'rgba(150,118,70,.07)');g.addColorStop(1,'rgba(150,118,70,0)');ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);}
 const edge=ctx.createRadialGradient(px+pw/2,py+ph/2,Math.min(pw,ph)*.35,px+pw/2,py+ph/2,Math.max(pw,ph)*.75);edge.addColorStop(0,'rgba(90,64,30,0)');edge.addColorStop(1,'rgba(90,64,30,.3)');ctx.fillStyle=edge;ctx.fillRect(px,py,pw,ph);
 ctx.restore();
 // 画心金线（隔水）
 ctx.strokeStyle='#c9a35a';ctx.lineWidth=1.2;ctx.strokeRect(px-2.5,py-2.5,pw+5,ph+5);ctx.strokeStyle='rgba(60,44,26,.6)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,pw-1,ph-1);
 // 木轴
 drawRod(ctx,0,0,w,rod);drawRod(ctx,0,h-rod,w,rod);
 s.textures.addCanvas(key,c);return key;
}

/** 篆刻印：白文朱底 + 内框 + 印泥斑驳。oval 为椭圆闲章（两字竖排）。 */
function sealTexture(s:Phaser.Scene,text:string,size:number,oval=false,font=TITLE_FONT):string{
 const key=`ink-seal-${text}-${size}-${oval?1:0}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const w=oval?Math.round(size*.72):size,h=size,{c,ctx}=canvasOf(w,h),r=rng(text.charCodeAt(0)*13+size);
 ctx.fillStyle='#a8281c';
 if(oval){ctx.beginPath();ctx.ellipse(w/2,h/2,w/2-1,h/2-1,0,0,Math.PI*2);ctx.fill();}
 else{ctx.beginPath();ctx.moveTo(1,2);ctx.lineTo(w-2,1);ctx.lineTo(w-1,h-2);ctx.lineTo(2,h-1);ctx.closePath();ctx.fill();}
 ctx.strokeStyle='#f3e2c4';ctx.lineWidth=Math.max(1,size*.05);
 if(oval){ctx.beginPath();ctx.ellipse(w/2,h/2,w/2-3.5,h/2-3.5,0,0,Math.PI*2);ctx.stroke();}else ctx.strokeRect(3.5,3.5,w-7,h-7);
 ctx.fillStyle='#f6e6c8';ctx.textAlign='center';ctx.textBaseline='middle';
 const chars=[...text];if(chars.length===1){ctx.font=`${Math.round(size*.62)}px ${font}`;ctx.fillText(chars[0],w/2,h/2+1);}
 else{ctx.font=`${Math.round(h*(oval?.3:.34))}px ${font}`;chars.forEach((ch,i)=>ctx.fillText(ch,w/2,h*(.3+i*.42)));}
 ctx.globalCompositeOperation='destination-out';for(let i=0;i<size*1.6;i++){ctx.fillStyle=`rgba(0,0,0,${.35+r()*.5})`;ctx.beginPath();ctx.arc(r()*w,r()*h,.4+r()*1.2,0,Math.PI*2);ctx.fill();}
 ctx.globalCompositeOperation='source-over';
 s.textures.addCanvas(key,c);return key;
}

/** 名字后的干笔墨痕（竖向）。 */
function brushTexture(s:Phaser.Scene,w:number,h:number):string{
 const key=`ink-brush-${w}x${h}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const {c,ctx}=canvasOf(w,h),r=rng(w*7+h);
 for(let i=0;i<w*1.6;i++){const x=w*.5+(r()-.5)*w*.8,len=h*(.55+r()*.45),y0=(h-len)*r()*.6;ctx.strokeStyle=`rgba(40,32,24,${.025+r()*.05})`;ctx.lineWidth=.8+r()*1.6;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x+(r()-.5)*4,y0+len);ctx.stroke();}
 s.textures.addCanvas(key,c);return key;
}

/**
 * 立绘水墨化：按明暗转墨色深浅，保留约两成原色作“淡彩”；四周与下半身墨晕淡出，干笔噪点；
 * 右上名列处墨色淡出（columnFrom 为名列起点，按立绘宽度比例）。
 */
function inkPortrait(source:HTMLImageElement|HTMLCanvasElement,cw:number,ch:number,seed:number,columnFrom=2):HTMLCanvasElement{
 const sw=source.width,sh=source.height;let cropW=sw,cropH=Math.round(sw*ch/cw);if(cropH>sh){cropH=sh;cropW=Math.round(sh*cw/ch);}
 const c=document.createElement('canvas');c.width=cropW;c.height=cropH;const ctx=c.getContext('2d',{willReadFrequently:true})!;
 ctx.drawImage(source,Math.round((sw-cropW)/2),0,cropW,cropH,0,0,cropW,cropH);
 const img=ctx.getImageData(0,0,cropW,cropH),d=img.data,r=rng(seed);
 const inkR=27,inkG=23,inkB=18;
 for(let y=0;y<cropH;y++)for(let x=0;x<cropW;x++){
  const i=(y*cropW+x)*4,a=d[i+3]/255;if(a<=0)continue;
  const R=d[i],G=d[i+1],B=d[i+2],L=(R*.3+G*.59+B*.11)/255;
  const ink=Math.min(1,Math.pow(1-L,.8)*1.25);
  const fx=x/cropW,fy=y/cropH,n=(r()-.5)*.18;
  const side=Math.min(1,Math.min(fx,1-fx)/.12+n),top=Math.min(1,fy/.05),bottom=fy<.6?1:Math.max(0,1-(fy-.6)/.36+n);
  const fadeX=fx<=columnFrom?1:Math.max(.12,1-(fx-columnFrom)/.1),wy=fy<.56?1:fy>.66?0:1-(fy-.56)/.1,col=1-(1-fadeX)*wy;
  const mask=Math.max(0,Math.min(side,top,bottom))*col;
  const tint=.2+.15*(1-ink);
  d[i]=inkR+(R-inkR)*tint;d[i+1]=inkG+(G-inkG)*tint;d[i+2]=inkB+(B-inkB)*tint;
  d[i+3]=Math.round(255*Math.min(1,ink*1.15)*a*mask*(.9+.1*r()));
 }
 ctx.putImageData(img,0,0);return c;
}


/**
 * 生成美术立轴（public/assets/ink-scroll/frame.webp，原图裁切坐标 ×0.75）。
 * 横向五段：左（轴头+绫边+左惊燕）固定 / 中左拉伸 / 挂结固定 / 中右拉伸 / 右固定；
 * 纵向三段：挂绳+天头+惊燕固定 / 中段拉伸 / 地头+木轴固定。卡片坐标 y=0 对应上木轴顶。
 */
/** 挂绳段纵向压缩比例（避免顶到上方标题）。 */
const HANG_K=.62;
const INK={src:.75,w:944,h:1520,rod:98,cols:[0,260,430,515,684,944],rows:[0,460,1300,1520],paper:[140,292,806,1362],tabL:192,tabR:753,tabTip:462,body:72};
export const INK_FRAME_KEY='ink_frame',INK_PAPER_KEY='ink_paper',inkHeroKey=(id:string)=>'ink_hero_'+id;
/** 每张卡的缩放（原图像素→卡片像素）：宽度决定，竖向不足时单独压缩。 */
function inkScale(w:number,h:number){const b=Math.max(.17,Math.min(.32,w/1100));const bv=Math.min(b,(h-4)/(INK.rows[1]-INK.rod+INK.rows[3]-INK.rows[2]));return{b,bv};}
interface InkLayout extends ScrollLayout{b:number;bv:number;tabTip:number;tabL:number;tabR:number;body:number}
function inkLayout(w:number,h:number):InkLayout{
 const {b,bv}=inkScale(w,h),[x0,y0,x1,y1]=INK.paper;
 const px=x0*b,py=(y0-INK.rod)*bv,pw=w-(INK.w-x1)*b-px,ph=h-(INK.h-y1)*bv-py;
 return{rod:INK.rod*bv*HANG_K,top:0,bottom:0,side:INK.body*b,px,py,pw,ph,small:w<250,b,bv,tabTip:(INK.tabTip-INK.rod)*bv,tabL:INK.tabL*b,tabR:w-(INK.w-INK.tabR)*b,body:INK.body*b};
}
/** 九宫（5×3）拼出指定尺寸的立轴外框；画心为透明孔。 */
function inkFrameTexture(s:Phaser.Scene,w:number,h:number):string{
 const key=`ink-frame4-${w}x${h}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const {b,bv}=inkScale(w,h),src=s.textures.get(INK_FRAME_KEY).getSourceImage() as HTMLImageElement,k=INK.src;
 const hang=INK.rod*bv*HANG_K,{c,ctx}=canvasOf(w,h+hang);ctx.imageSmoothingQuality='high';
 const C=INK.cols,fixed=(C[1]-C[0])+(C[3]-C[2])+(C[5]-C[4]),stretch=Math.max(0,w-fixed*b),span=(C[2]-C[1])+(C[4]-C[3]);
 const dw=[(C[1]-C[0])*b,stretch*(C[2]-C[1])/span,(C[3]-C[2])*b,stretch*(C[4]-C[3])/span,(C[5]-C[4])*b];
 const R=[0,INK.rod,...INK.rows.slice(1)],top=(R[2]-R[1])*bv,bottom=(R[4]-R[3])*bv,dh=[hang,top,Math.max(0,h-top-bottom),bottom];
 let dy=0;for(let r=0;r<4;r++){let dx=0;for(let q=0;q<5;q++){if(dw[q]>0&&dh[r]>0)ctx.drawImage(src,C[q]*k,R[r]*k,(C[q+1]-C[q])*k,(R[r+1]-R[r])*k,dx,dy,dw[q]+.6,dh[r]+.6);dx+=dw[q];}dy+=dh[r];}
 s.textures.addCanvas(key,c)?.setFilter(Phaser.Textures.FilterMode.LINEAR);return key;
}
/** 收卷：只留上木轴（至 ROLL_TOP）与地头+下木轴（自 ROLL_BOT），名字写在地头织锦上。 */
const ROLL_TOP=176,ROLL_BOT=1370,ROLL_NAME=1411;
/** 从已拼好的外框里取出“地头+下木轴”，收卷动画中随卷起位置上移。 */
function rollTexture(s:Phaser.Scene,frameKey:string,w:number,h:number,hang:number,rollH:number):string{
 const key='ink-roll-'+frameKey;if(s.textures.exists(key))return key;
 const src=s.textures.get(frameKey).getSourceImage() as HTMLCanvasElement,k=src.height/(h+hang),{c,ctx}=canvasOf(w,rollH);
 ctx.drawImage(src,0,Math.round((hang+h-rollH)*k),src.width,Math.round(rollH*k),0,0,w,rollH);
 s.textures.addCanvas(key,c)?.setFilter(Phaser.Textures.FilterMode.LINEAR);return key;
}
/** 立绘：裁进画心，人物偏左给名列留位，下部渐隐给题跋留白。 */
function inkHeroTexture(s:Phaser.Scene,id:string,pw:number,ph:number,small:boolean):string{
 const key=`ink-hero3-${id}-${Math.round(pw)}x${Math.round(ph)}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const src=s.textures.get(inkHeroKey(id)).getSourceImage() as HTMLImageElement,{c,ctx}=canvasOf(pw,ph);ctx.imageSmoothingQuality='high';
 const dh=ph*(small?.98:1.02),dw=dh*src.width/src.height,dx=Math.min(pw*.44-dw/2,pw-dw)+(small?2:0);
 ctx.drawImage(src,dx,small?2:0,dw,dh);
 const fade=ctx.createLinearGradient(0,ph*.62,0,ph);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(.55,'rgba(0,0,0,.55)');fade.addColorStop(1,'rgba(0,0,0,.92)');
 ctx.globalCompositeOperation='destination-out';ctx.fillStyle=fade;ctx.fillRect(0,ph*.62,pw,ph*.38);ctx.globalCompositeOperation='source-over';
 s.textures.addCanvas(key,c)?.setFilter(Phaser.Textures.FilterMode.LINEAR);return key;
}

function glowTexture(s:Phaser.Scene,w:number,h:number,state:FrameState,inset=1):string{
 const key=`ink-glow3-${w}x${h}-${Math.round(inset)}-${state}-${RENDER_SCALE}`;if(s.textures.exists(key))return key;
 const {c,ctx}=canvasOf(w+28,h+28);ctx.translate(14,14);
 if(state!=='normal'){ctx.save();ctx.shadowColor=state==='selected'?'rgba(240,196,110,.85)':'rgba(240,210,150,.45)';ctx.shadowBlur=state==='selected'?24:12;ctx.strokeStyle=state==='selected'?'#efcf88':'rgba(230,200,140,.8)';ctx.lineWidth=2;ctx.strokeRect(inset,4,w-inset*2,h-8);ctx.restore();}
 s.textures.addCanvas(key,c);return key;
}

/**
 * 武将卡 · 立轴画卷。优先使用生成美术（紫檀轴、织锦天地头、靛青云纹绫边、惊燕、陈年宣纸 + 水墨淡彩立绘）；
 * 素材未加载时退回程序化画卷。名列悬于右惊燕之下，定位印与题句悬于左惊燕之下，底部题跋与闲章。
 */
export class HeroWarCard{
 readonly root:Phaser.GameObjects.Container;readonly art:Phaser.GameObjects.Image;readonly name:Phaser.GameObjects.Text;readonly weapon:Phaser.GameObjects.Text;readonly hit:Phaser.GameObjects.Rectangle;
 private scroll:Phaser.GameObjects.Image;private paper:Phaser.GameObjects.Image;private glow:Phaser.GameObjects.Image;private nameV:Phaser.GameObjects.Text;private brush:Phaser.GameObjects.Image;private title:Phaser.GameObjects.Text;private seal:Phaser.GameObjects.Image;private roleSeal:Phaser.GameObjects.Image;private role:Phaser.GameObjects.Text;private verse:Phaser.GameObjects.Text;private leisureSeal:Phaser.GameObjects.Image;private skills:Phaser.GameObjects.Text;private passive:Phaser.GameObjects.Text;private rules:Phaser.GameObjects.Graphics;
 private roll?:Phaser.GameObjects.Image;private foldName?:Phaser.GameObjects.Text;private rollH=0;private prog=1;private rollTween?:Phaser.Tweens.Tween;
 private folded=false;private index=-1;private artKey='';private chosen=false;private readonly L:ScrollLayout;private readonly painted:boolean;private readonly colX:number;private readonly nameTop:number;
 constructor(private s:Phaser.Scene,x:number,y:number,readonly width:number,readonly height:number){
  const w=width,h=height;this.painted=s.textures.exists(INK_FRAME_KEY)&&s.textures.exists(INK_PAPER_KEY);
  const I=this.painted?inkLayout(w,h):undefined,L=this.L=I??layoutOf(w,h),{px,py,pw,ph,small}=L;
  this.root=s.add.container(x,y);
  this.glow=s.add.image(-14,-14,glowTexture(s,w,h,'normal',I?I.body:1)).setOrigin(0).setDisplaySize(w+28,h+28);
  this.paper=s.add.image(px,py,I?INK_PAPER_KEY:'__WHITE').setOrigin(0).setDisplaySize(pw,ph).setVisible(!!I);
  this.art=s.add.image(px+pw*.4,py+4,CHARACTERS[0].portrait).setOrigin(.5,0);
  const hang=I?I.rod:HANG;
  this.scroll=s.add.image(0,-hang,I?inkFrameTexture(s,w,h):scrollTexture(s,w,h)).setOrigin(0).setDisplaySize(w,h+hang);
  const ink=(tx:number,ty:number,value:string,size:number,color='#2a2017',font=HEADING_FONT)=>s.add.text(tx,ty,value,{fontFamily:font,fontSize:size+'px',color,resolution:2});
  if(I){this.rollH=(INK.h-ROLL_BOT)*I.bv;this.roll=s.add.image(0,h-this.rollH,rollTexture(s,this.scroll.texture.key,w,h,hang,this.rollH)).setOrigin(0).setDisplaySize(w,this.rollH).setVisible(false);
   this.foldName=ink(w/2,0,'',small?18:22,'#fff0cf',TITLE_FONT).setOrigin(.5).setStroke('#3a2210',4).setLetterSpacing(small?4:8).setAlpha(0).setVisible(false);}
  const nameSize=small?28:38;
  // 名列：画卷版挂在右惊燕之下（不出画心）；程序版沿用右侧竖列
  this.colX=I?Math.min(I.tabR,px+pw-nameSize/2-(small?5:7)):px+pw-(small?24:31);
  this.nameTop=I?I.tabTip+(small?5:7):py+(small?12:16);
  this.brush=s.add.image(this.colX,this.nameTop-(small?4:6),brushTexture(s,small?40:52,small?96:128)).setOrigin(.5,0).setDisplaySize(small?40:52,small?96:128);
  this.nameV=ink(this.colX,this.nameTop,'',nameSize,'#17120d',TITLE_FONT).setOrigin(.5,0).setLineSpacing(small?-4:-6).setStroke('#efe3c6',I?4:0);
  this.title=ink(this.colX-nameSize/2-(small?9:12),this.nameTop+(small?4:6),'',small?12:14,'#5b4630').setOrigin(.5,0).setLineSpacing(2).setStroke('#ece1c8',I?3:0);
  this.seal=s.add.image(this.colX,0,sealTexture(s,'蜀',small?26:32)).setDisplaySize(small?26:32,small?26:32).setOrigin(.5,0).setRotation(-.05);
  const leftX=I?Math.max(px+(small?15:18),I.tabL):px+(small?17:20),leftTop=I?I.tabTip+(small?5:7):py+(small?10:12);
  this.roleSeal=s.add.image(leftX,leftTop,sealTexture(s,'突进',small?30:36,false,HEADING_FONT)).setOrigin(.5,0).setDisplaySize(small?30:36,small?30:36).setRotation(.04);
  this.role=ink(-9999,-9999,'',11).setVisible(false);
  this.verse=ink(leftX,leftTop+(small?36:44),'',small?10:12,'#4a3a2a').setOrigin(.5,0).setLineSpacing(small?1:2).setStroke('#ece1c8',3).setAlpha(.86);
  // 手机点将页的小卷轴：省去题句，避免压住立绘
  if(I&&small&&!IS_DESKTOP)this.verse.setVisible(false);
  // 题跋区：上下双墨线 + 兵器（大）/ 天赋（朱）/ 武艺（墨），右下角椭圆闲章
  this.rules=s.add.graphics();const ry=py+ph-(small?62:74),rx=small?10:14;
  this.rules.lineStyle(1,0x3c2c1c,.55).lineBetween(px+rx,ry,px+pw-rx,ry).lineBetween(px+rx,ry+3,px+pw-rx,ry+3).lineStyle(1,0x3c2c1c,.3).lineBetween(px+rx,py+ph-7,px+pw-rx,py+ph-7);
  this.rules.fillStyle(0xa8281c,.85).fillRect(px+pw/2-2.5,ry-1,5,5);
  this.name=ink(-9999,-9999,'',12).setVisible(false);
  const stroke=(t:Phaser.GameObjects.Text)=>I?t.setStroke('#efe4c9',3):t;
  this.weapon=stroke(ink(px+pw/2,ry+(small?7:9),'',small?15:17,'#1f1710').setOrigin(.5,0).setLetterSpacing(2));
  this.passive=stroke(ink(px+pw/2,ry+(small?27:32),'',small?11:12,'#8a2a1c',FONT).setOrigin(.5,0));
  this.skills=stroke(ink(px+pw/2,ry+(small?42:50),'',small?11:12,'#5b4630',FONT).setOrigin(.5,0));
  this.leisureSeal=s.add.image(px+pw-(small?12:16),py+ph-(small?11:14),sealTexture(s,'常胜',small?26:32,true)).setOrigin(.5,1).setDisplaySize(Math.round((small?26:32)*.72),small?26:32).setRotation(.06).setAlpha(.92);
  this.hit=s.add.rectangle(w/2,h/2,w,h,0,0.001).setInteractive({useHandCursor:true});
  // 画卷版：外框（含惊燕）压在立绘之上；文字与印在最上层
  this.root.add([this.glow,this.paper,this.art,this.scroll,...(this.roll?[this.roll]:[]),...(this.foldName?[this.foldName]:[]),this.brush,this.nameV,this.title,this.seal,this.roleSeal,this.verse,this.rules,this.weapon,this.passive,this.skills,this.leisureSeal,this.role,this.name,this.hit]);
  this.paint();
  this.hit.on('pointerover',()=>this.paint('hover')).on('pointerout',()=>this.paint()).on('pointerdown',()=>this.paint('pressed')).on('pointerup',()=>this.paint());
 }
 private get detail(){return [this.art,this.paper,this.brush,this.title,this.seal,this.roleSeal,this.verse,this.rules,this.weapon,this.passive,this.skills,this.leisureSeal];}
 private paint(state:FrameState='normal'):void{
  const st:FrameState=state==='normal'&&this.chosen?'selected':state;
  const h=this.folded?this.foldedHeight:this.height,inset=this.painted?(this.L as InkLayout).body:1;
  this.glow.setTexture(glowTexture(this.s,this.width,h,st==='pressed'?'hover':st,inset)).setDisplaySize(this.width+28,h+28);
  this.root.setScale(st==='pressed'?.985:1);
 }
 private get foldedHeight(){return this.painted?Math.round((ROLL_TOP-INK.rod)*(this.L as InkLayout).bv+this.rollH):this.L.rod*2+44;}
 /** 画卷收放进度 p（1=展开，0=收起）：下木轴随 p 上移，外框/宣纸/立绘按卷起位置裁切，文字淡出，收起后地头上显示名字。 */
 private applyRoll(p:number):void{
  this.prog=p;const I=this.L as InkLayout,w=this.width,h=this.height,fh=this.foldedHeight,H=fh+(h-fh)*p,rollTop=H-this.rollH,open=p>=1;
  this.roll!.setVisible(!open).setY(rollTop);
  const fr=this.scroll.frame;if(open)this.scroll.setCrop();else this.scroll.setCrop(0,0,fr.width,(I.rod+rollTop)/(h+I.rod)*fr.height);
  for(const im of [this.paper,this.art]){const k=Phaser.Math.Clamp((rollTop-im.y)/Math.max(1,im.displayHeight),0,1);if(open)im.setCrop();else im.setCrop(0,0,im.frame.width,k*im.frame.height);im.setVisible(k>0);}
  const a=Phaser.Math.Clamp((p-.45)/.55,0,1),hideVerse=this.L.small&&!IS_DESKTOP;
  for(const item of [this.brush,this.nameV,this.title,this.seal,this.roleSeal,this.verse,this.rules,this.weapon,this.passive,this.skills,this.leisureSeal]){
   item.setAlpha(a*(item===this.verse?.86:item===this.leisureSeal?.92:1)).setVisible(a>0&&!(item===this.verse&&hideVerse));
  }
  const fa=Phaser.Math.Clamp(1-p*2.2,0,1);this.foldName!.setAlpha(fa).setVisible(fa>0).setY(rollTop+(ROLL_NAME-ROLL_BOT)*I.bv);
  this.glow.setVisible(p<=0||open);
  this.hit.setSize(w,H).setPosition(w/2,H/2);if(this.hit.input)this.hit.input.hitArea.setTo(0,0,w,H);
 }
 get isFolded():boolean{return this.folded;}
 /** 当前（收起/展开）状态下卷轴占用的高度。 */
 heightWhen(folded:boolean):number{return folded?this.foldedHeight:this.height;}
 setFolded(value:boolean,animate=false):void{
  if(this.painted){
   this.folded=value;this.rollTween?.stop();const to=value?0:1;
   if(!animate||this.prog===to){this.applyRoll(to);this.paint();return;}
   const from=this.prog;this.rollTween=this.s.tweens.addCounter({from:0,to:1,duration:Math.round(380*Math.abs(to-from)),ease:'Cubic.easeInOut',onUpdate:tw=>this.applyRoll(from+(to-from)*(tw.getValue()??0)),onComplete:()=>{this.applyRoll(to);this.paint();}});
   return;
  }
  this.folded=value;for(const item of this.detail)item.setVisible(!value&&(item!==this.paper||this.painted)&&!(item===this.verse&&this.painted&&this.L.small&&!IS_DESKTOP));
  const hh=value?this.foldedHeight:this.height;
  if(this.painted){const hang=INK.rod*inkScale(this.width,hh).bv*HANG_K;this.scroll.setTexture(inkFrameTexture(this.s,this.width,hh)).setPosition(0,-hang).setDisplaySize(this.width,hh+hang);}
  else this.scroll.setTexture(scrollTexture(this.s,this.width,hh)).setDisplaySize(this.width,hh+HANG);
  const small=this.L.small;
  if(value)this.nameV.setText(this.name.text).setOrigin(.5).setPosition(this.width/2,hh/2).setLineSpacing(0);
  else this.nameV.setText([...this.name.text].join('\n')).setOrigin(.5,0).setPosition(this.colX,this.nameTop).setLineSpacing(small?-4:-6);
  this.hit.setSize(this.width,hh).setPosition(this.width/2,hh/2);if(this.hit.input)this.hit.input.hitArea.setTo(0,0,this.width,hh);this.paint();
 }
 setSelected(value:boolean):void{this.chosen=value;this.paint();}
 setHero(index:number):void{
  const c=CHARACTERS[index],key='epic_hero_'+c.id,target=this.s.textures.exists(key)?key:c.portrait;
  const {px,py,pw,ph,small}=this.L;
  let artKey:string,place:()=>void;
  if(this.painted&&this.s.textures.exists(inkHeroKey(c.id))){
   artKey=inkHeroTexture(this.s,c.id,pw,ph,small);place=()=>this.art.setOrigin(0).setDisplaySize(pw,ph).setPosition(px,py);
  }else{
   const aw=Math.round(pw*.84),ah=Math.round(ph-(small?44:52));
   artKey=target;place=()=>{const k=Math.min(aw/this.art.width,ah*.8/this.art.height);this.art.setOrigin(.5,0).setScale(k).setPosition(px+pw*.4,py+ah*.08);};
   if(target===key){artKey='hero-card-ink-'+c.id+'-'+aw+'x'+ah;place=()=>this.art.setOrigin(.5,0).setDisplaySize(aw,ah).setPosition(px+pw*.4,py+4);
    if(!this.s.textures.exists(artKey)){const source=this.s.textures.get(key).getSourceImage() as HTMLImageElement;const artLeft=pw*.4-aw/2,colFrom=(pw-(small?66:84)-artLeft)/aw;this.s.textures.addCanvas(artKey,inkPortrait(source,aw,ah,index*97+aw,colFrom))?.setFilter(Phaser.Textures.FilterMode.LINEAR);}}
  }
  if(this.index!==index||this.artKey!==artKey){
   this.index=index;this.artKey=artKey;this.art.setTexture(artKey,'__BASE');place();
   this.s.tweens.killTweensOf(this.art);this.art.setAlpha(.3);this.s.tweens.add({targets:this.art,alpha:1,duration:220});
  }
  this.name.setText(c.name);this.foldName?.setText(c.name);
  // 画卷版收起时名字写在 foldName 上，竖排名始终更新（否则“先收起再进首页/换将”展开后名字为空）
  if(this.painted||!this.folded)this.nameV.setText([...c.name].join('\n'));else this.nameV.setText(c.name);
  this.title.setText([...titles[index]].join('\n'));
  const nameBottom=this.nameV.y+this.nameV.height;this.seal.setY(nameBottom+(small?4:6));
  this.brush.setDisplaySize(small?40:52,Math.max(small?96:128,this.nameV.height+(small?14:20)));
  this.role.setText(roles[index]);
  this.roleSeal.setTexture(sealTexture(this.s,roles[index],small?30:36,false,HEADING_FONT)).setDisplaySize(small?30:36,small?30:36);
  this.verse.setText([...verses[index]].join('\n'));
  this.leisureSeal.setTexture(sealTexture(this.s,leisure[index],small?26:32,true)).setDisplaySize(Math.round((small?26:32)*.72),small?26:32);
  this.weapon.setText(WEAPON_META[c.startWeapon].name);
  this.passive.setText('天赋 · '+CHARACTER_PASSIVES[c.id].name);
  this.skills.setText(Object.values(MARTIALS).filter(a=>a.character===c.id).map(a=>a.name).join('  ◆  ')).setWordWrapWidth(pw-12).setAlign('center');
 }
}
