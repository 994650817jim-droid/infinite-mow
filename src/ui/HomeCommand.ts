import Phaser from 'phaser';
import {HEADING_FONT,RENDER_SCALE,IS_DESKTOP} from '../config';
import {uiSfx} from '../systems/Sfx';
import {lqButton,lqLabelColor,type LqState} from './LacquerKit';

type CommandState='normal'|'hover'|'pressed'|'selected'|'disabled';
const PAD=14;

/** 凹角牌匾外形：四角向内弧切，近似漆木匾额。 */
function plaque(ctx:CanvasRenderingContext2D,l:number,t:number,w:number,h:number,r:number):void{
 const R=l+w,B=t+h;ctx.beginPath();ctx.moveTo(l+r,t);ctx.lineTo(R-r,t);ctx.arc(R,t,r,Math.PI,Math.PI/2,true);ctx.lineTo(R,B-r);ctx.arc(R,B,r,Math.PI*1.5,Math.PI,true);
 ctx.lineTo(l+r,B);ctx.arc(l,B,r,0,-Math.PI/2,true);ctx.lineTo(l,t+r);ctx.arc(l,t,r,Math.PI/2,0,true);ctx.closePath();
}

/** Canvas 生成的按钮底板（真实渐变、描金、柔光），按渲染倍率绘制以保证高清。 */
function commandTexture(scene:Phaser.Scene,width:number,height:number,primary:boolean,state:CommandState):string{
 const S=RENDER_SCALE,key=`home-cmd-${width}x${height}-${primary?1:0}-${state}-${S}`;
 if(scene.textures.exists(key))return key;
 const cw=width+PAD*2,ch=height+PAD*2,canvas=document.createElement('canvas');canvas.width=Math.ceil(cw*S);canvas.height=Math.ceil(ch*S);
 const ctx=canvas.getContext('2d')!;ctx.scale(S,S);
 const l=PAD,t=PAD,r=Math.min(11,height*.24),lit=state==='hover'||state==='selected',down=state==='pressed',off=state==='disabled';
 const rim=off?'#5f574a':lit?'#f0d08c':primary?'#d4ad66':'#a9874f';
 // 外投影与悬停光晕
 ctx.save();plaque(ctx,l,t+(down?1:2),width,height,r);ctx.shadowColor=lit?(primary?'rgba(240,170,90,.55)':'rgba(230,196,128,.45)'):'rgba(0,0,0,.65)';ctx.shadowBlur=lit?16:8;ctx.shadowOffsetY=lit?0:3;ctx.fillStyle='#000';ctx.fill();ctx.restore();
 // 漆面渐变
 const face=ctx.createLinearGradient(0,t,0,t+height);
 if(off){face.addColorStop(0,'#2b2823');face.addColorStop(1,'#1a1814');}
 else if(primary){face.addColorStop(0,down?'#7a2619':lit?'#b8432d':'#a3392a');face.addColorStop(.55,down?'#5a1b12':lit?'#86291c':'#73231a');face.addColorStop(1,down?'#3d110b':'#4a140d');}
 else{face.addColorStop(0,down?'#221b13':lit?'#3d3122':'#30271c');face.addColorStop(1,down?'#120e09':lit?'#211a12':'#18130d');}
 plaque(ctx,l,t,width,height,r);ctx.fillStyle=face;ctx.fill();
 // 上半高光
 ctx.save();plaque(ctx,l,t,width,height,r);ctx.clip();const sheen=ctx.createLinearGradient(0,t,0,t+height*.55);sheen.addColorStop(0,primary?'rgba(255,214,170,.20)':'rgba(255,230,190,.10)');sheen.addColorStop(1,'rgba(255,230,190,0)');ctx.fillStyle=sheen;ctx.fillRect(l,t,width,height*.55);
 // 细密漆纹
 ctx.globalAlpha=primary?.06:.05;ctx.strokeStyle='#000';ctx.lineWidth=1;for(let x=l-height;x<l+width;x+=5){ctx.beginPath();ctx.moveTo(x,t+height);ctx.lineTo(x+height,t);ctx.stroke();}ctx.restore();
 // 描金外框与内线
 plaque(ctx,l+.75,t+.75,width-1.5,height-1.5,r);ctx.strokeStyle=rim;ctx.lineWidth=1.5;ctx.stroke();
 plaque(ctx,l+4.5,t+4.5,width-9,height-9,Math.max(3,r-4));ctx.strokeStyle=primary?'rgba(246,214,150,.42)':'rgba(214,180,118,.32)';ctx.lineWidth=1;ctx.stroke();
 // 两端菱形与引线
 const cy=t+height/2,gold=off?'#6b6253':lit?'#f6dc9e':primary?'#e2bf78':'#bd9b5f';ctx.fillStyle=gold;ctx.strokeStyle=gold;ctx.lineWidth=1;
 if(width>=124)for(const side of[-1,1]){const x=side<0?l+17:l+width-17;ctx.beginPath();ctx.moveTo(x,cy-4);ctx.lineTo(x+4,cy);ctx.lineTo(x,cy+4);ctx.lineTo(x-4,cy);ctx.closePath();ctx.fill();
  if(width>=160){ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(x-side*7,cy);ctx.lineTo(x-side*(primary?30:20),cy);ctx.stroke();ctx.globalAlpha=1;}}
 scene.textures.addCanvas(key,canvas);return key;
}

/** 水墨按钮美术（public/assets/ui-buttons，BootScene 加载；tools/prepare-button-art.mjs 切图）。
 * 每张贴图 1061×204，墨身约占中间 68% 高、中心比画布中心高约 6%；左右各 18% 为笔锋，拉伸时不变形。 */
const INK={capRatio:.18,bodyRatio:.68,bodyOffset:-.06,overhang:1.1};
export function buttonArt(scene:Phaser.Scene,primary:boolean,state:CommandState):{key:string;w:number;h:number;cap:number}|null{
 const key=state==='disabled'?'btn_ink_disabled':`btn_ink_${primary?'primary':'secondary'}_${state==='selected'?'hover':state}`;
 if(!scene.textures.exists(key))return null;
 const src=scene.textures.get(key).getSourceImage() as {width:number;height:number};
 return{key,w:src.width,h:src.height,cap:Math.round(src.width*INK.capRatio)};
}
/** 把墨身对齐到按钮矩形：高按墨身比例放大，笔锋略超出两端；窄按钮横向压缩笔锋。 */
export function fitArt(g:Phaser.GameObjects.NineSlice,a:{w:number;h:number;cap:number},width:number,height:number,y:number,pressed:boolean):void{
 const dispH=height/INK.bodyRatio,k=a.h/dispH,dispW=width*INK.overhang,nsW=Math.max(dispW*k,a.cap*2+4);
 g.setSlices(nsW,a.h,a.cap,a.cap,0,0);g.setScale(dispW/nsW,1/k).setY(y-INK.bodyOffset*dispH+(pressed?1:0));
}

/** 首页/军营通用命令按钮。返回 g（底板图像）、hit、caption、paint(state) 与旧接口一致。 */
export function homeCommand(scene:Phaser.Scene,x:number,y:number,width:number,height:number,label:string,primary=false,enabled=true,fontSize?:number){
 // 2026-11-21 总制作人「每屏只留一个水墨主按钮」：电脑版次要按钮（原黑色水墨）一律改漆金（homeLqCommand，接口相同）
 if((!primary||!enabled)&&IS_DESKTOP)return homeLqCommand(scene,x,y,width,height,label,Math.min(18,fontSize??Math.round(height*.38)),enabled);
 // 有青铜按钮美术时用三段拉伸（两端花纹不变形）；缺图时退回程序画底板
 const art=buttonArt(scene,primary,enabled?'normal':'disabled');
 let g:Phaser.GameObjects.Image|Phaser.GameObjects.NineSlice;
 if(art){g=scene.add.nineslice(x,y,art.key,undefined,art.w,art.h,art.cap,art.cap,0,0);fitArt(g,art,width,height,y,false);}
 else g=scene.add.image(x,y,commandTexture(scene,width,height,primary,enabled?'normal':'disabled')).setDisplaySize(width+PAD*2,height+PAD*2);
 const hit=scene.add.rectangle(x,y,width,height,0,0.001);if(enabled)hit.setInteractive({useHandCursor:true});
 const size=fontSize??(primary?Math.min(24,Math.round(height*.4)):Math.min(18,Math.round(height*.34)));
 const caption=scene.add.text(x,y,label,{fontFamily:HEADING_FONT,fontSize:size+'px',fontStyle:'bold',color:!enabled?(art?'#3a332a':'#8e8576'):primary?'#f8e6bf':'#e8d3a6',resolution:2}).setOrigin(.5).setLetterSpacing(primary?6:label.length>4?1:3).setShadow(0,1,'#120a05',3,true,true);
 // 水墨底的浅灰笔触上，米色字对比不足（主城底栏 15px 尤甚）：加一圈深墨描边
 if(art&&enabled)caption.setStroke(primary?'#2a0c06':'#16100a',primary?3:4);
 let current:CommandState='normal';
 const paint=(state:string='normal')=>{
  if(!enabled)return;
  const s:CommandState=state==='hover'||state==='pressed'||state==='selected'?state:'normal';current=s;
  const a=buttonArt(scene,primary,s);
  if(a&&g instanceof Phaser.GameObjects.NineSlice){g.setTexture(a.key);fitArt(g,a,width,height,y,s==='pressed');}
  else if(g instanceof Phaser.GameObjects.Image)g.setTexture(commandTexture(scene,width,height,primary,s)).setDisplaySize(width+PAD*2,height+PAD*2).setY(y+(s==='pressed'?1:0));
  caption.setY(y+(s==='pressed'?1:0)).setColor(s==='hover'||s==='selected'?'#fff3d4':primary?'#f8e6bf':'#e8d3a6');
 };
 paint();
 if(enabled)hit.on('pointerdown',()=>{const battle=(scene as unknown as {sfx?:{play(k:string):void}}).sfx;if(battle)battle.play('uiClick');else{const s=uiSfx();s.unlock();s.play('uiClick');}});
 hit.on('pointerover',()=>{if(current!=='selected'){paint('hover');uiSfx().play('uiHover');}}).on('pointerout',()=>{if(current!=='selected')paint();}).on('pointerdown',()=>paint('pressed')).on('pointerup',()=>paint('hover'));
 /** 整体移到新的纵坐标（按钮、文字、点击区一起），保留当前状态。 */
 const setY=(ny:number)=>{y=ny;hit.setY(ny);paint(current);};
 return{g,hit,caption,paint,setY,get y(){return y;}};
}

/**
 * 通用漆面面板：切角、暗漆竖向渐变、描金外框+内线、四角金色折角。按渲染倍率绘制并缓存。
 * accent 为 true 时外框更亮（选中/当前页）。
 */
export function warPanelTexture(scene:Phaser.Scene,width:number,height:number,accent=false):string{
 const S=RENDER_SCALE,w=Math.round(width),h=Math.round(height),key=`war-panel-${w}x${h}-${accent?1:0}-${S}`;
 if(scene.textures.exists(key))return key;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil((w+16)*S);canvas.height=Math.ceil((h+16)*S);
 const ctx=canvas.getContext('2d')!;ctx.scale(S,S);ctx.translate(8,8);
 const c=10,shape=(i:number)=>{ctx.beginPath();ctx.moveTo(c+i,i);ctx.lineTo(w-c-i,i);ctx.lineTo(w-i,c+i);ctx.lineTo(w-i,h-c-i);ctx.lineTo(w-c-i,h-i);ctx.lineTo(c+i,h-i);ctx.lineTo(i,h-c-i);ctx.lineTo(i,c+i);ctx.closePath();};
 ctx.save();shape(0);ctx.shadowColor=accent?'rgba(232,192,120,.35)':'rgba(0,0,0,.55)';ctx.shadowBlur=accent?14:8;ctx.shadowOffsetY=accent?0:3;ctx.fillStyle='#000';ctx.fill();ctx.restore();
 const face=ctx.createLinearGradient(0,0,0,h);face.addColorStop(0,'rgba(44,34,23,.94)');face.addColorStop(1,'rgba(22,17,11,.96)');shape(0);ctx.fillStyle=face;ctx.fill();
 ctx.save();shape(0);ctx.clip();const sheen=ctx.createLinearGradient(0,0,0,Math.min(70,h*.4));sheen.addColorStop(0,'rgba(255,226,170,.08)');sheen.addColorStop(1,'rgba(255,226,170,0)');ctx.fillStyle=sheen;ctx.fillRect(0,0,w,Math.min(70,h*.4));ctx.restore();
 shape(.75);ctx.strokeStyle=accent?'#e4c27f':'#9b7d4b';ctx.lineWidth=1.5;ctx.stroke();
 shape(5);ctx.strokeStyle='rgba(214,178,112,.22)';ctx.lineWidth=1;ctx.stroke();
 ctx.strokeStyle=accent?'#f0d08c':'#c4a266';ctx.lineWidth=1.5;
 for(const [x,y,sx,sy] of [[5,5,1,1],[w-5,5,-1,1],[5,h-5,1,-1],[w-5,h-5,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*14);ctx.lineTo(x,y);ctx.lineTo(x+sx*14,y);ctx.stroke();}
 scene.textures.addCanvas(key,canvas);return key;
}

/**
 * 升级三选一卡面：切角漆面、按类别着色的顶部光带与描边、图标徽章底座、角饰；稀有（宝物）外圈金光。
 * medallion 为徽章圆心（卡片局部坐标），hover 时描边提亮并外发光。
 */
export function upgradeCardTexture(scene:Phaser.Scene,width:number,height:number,accent:number,medallion:{x:number;y:number;r:number},hover=false,rare=false):string{
 const S=RENDER_SCALE,w=Math.round(width),h=Math.round(height),key=`upcard-${w}x${h}-${accent.toString(16)}-${medallion.x}-${medallion.y}-${hover?1:0}-${rare?1:0}-${S}`;
 if(scene.textures.exists(key))return key;
 const P=16,canvas=document.createElement('canvas');canvas.width=Math.ceil((w+P*2)*S);canvas.height=Math.ceil((h+P*2)*S);
 const ctx=canvas.getContext('2d')!;ctx.scale(S,S);ctx.translate(P,P);
 const rgb=(n:number,a=1)=>`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;
 const light=(n:number,k:number)=>{const r=n>>16&255,g=n>>8&255,b=n&255;return (Math.min(255,Math.round(r+(255-r)*k))<<16)|(Math.min(255,Math.round(g+(255-g)*k))<<8)|Math.min(255,Math.round(b+(255-b)*k));};
 const c=12,shape=(i:number)=>{ctx.beginPath();ctx.moveTo(c+i,i);ctx.lineTo(w-c-i,i);ctx.lineTo(w-i,c+i);ctx.lineTo(w-i,h-c-i);ctx.lineTo(w-c-i,h-i);ctx.lineTo(c+i,h-i);ctx.lineTo(i,h-c-i);ctx.lineTo(i,c+i);ctx.closePath();};
 ctx.save();shape(0);ctx.shadowColor=rare?'rgba(255,205,110,.65)':hover?rgb(light(accent,.35),.6):'rgba(0,0,0,.6)';ctx.shadowBlur=rare||hover?16:9;ctx.shadowOffsetY=rare||hover?0:4;ctx.fillStyle='#000';ctx.fill();ctx.restore();
 const body=ctx.createLinearGradient(0,0,0,h);body.addColorStop(0,'#2a2017');body.addColorStop(1,'#120d09');shape(0);ctx.fillStyle=body;ctx.fill();
 ctx.save();shape(0);ctx.clip();
 const band=Math.min(h*.62,medallion.y+medallion.r+40),wash=ctx.createLinearGradient(0,0,0,band);wash.addColorStop(0,rgb(accent,hover?.55:.42));wash.addColorStop(1,rgb(accent,0));ctx.fillStyle=wash;ctx.fillRect(0,0,w,band);
 if(medallion.x<w*.4){const side=ctx.createLinearGradient(0,0,medallion.x*2.6,0);side.addColorStop(0,rgb(accent,hover?.38:.28));side.addColorStop(1,rgb(accent,0));ctx.fillStyle=side;ctx.fillRect(0,0,medallion.x*2.6,h);}
 ctx.globalAlpha=.05;ctx.strokeStyle='#000';for(let x=-h;x<w;x+=6){ctx.beginPath();ctx.moveTo(x,h);ctx.lineTo(x+h,0);ctx.stroke();}ctx.globalAlpha=1;
 // 徽章底座
 const m=medallion,glow=ctx.createRadialGradient(m.x,m.y,4,m.x,m.y,m.r*1.9);glow.addColorStop(0,rgb(light(accent,.3),.5));glow.addColorStop(1,rgb(accent,0));ctx.fillStyle=glow;ctx.fillRect(m.x-m.r*2,m.y-m.r*2,m.r*4,m.r*4);
 const disc=ctx.createRadialGradient(m.x,m.y-m.r*.3,2,m.x,m.y,m.r);disc.addColorStop(0,'#3a2c1e');disc.addColorStop(1,'#140e09');ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,Math.PI*2);ctx.fillStyle=disc;ctx.fill();
 ctx.lineWidth=2;ctx.strokeStyle=rgb(light(accent,.45));ctx.stroke();ctx.beginPath();ctx.arc(m.x,m.y,m.r+5,0,Math.PI*2);ctx.lineWidth=1;ctx.strokeStyle=rgb(light(accent,.3),.45);ctx.stroke();
 ctx.restore();
 const rim=rare?'#f3cf7c':rgb(light(accent,hover?.55:.32));
 shape(.75);ctx.strokeStyle=rim;ctx.lineWidth=hover||rare?2:1.5;ctx.stroke();
 shape(5);ctx.strokeStyle=rgb(light(accent,.4),.22);ctx.lineWidth=1;ctx.stroke();
 ctx.strokeStyle=rim;ctx.lineWidth=1.5;for(const [x,y,sx,sy] of [[6,6,1,1],[w-6,6,-1,1],[6,h-6,1,-1],[w-6,h-6,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*16);ctx.lineTo(x,y);ctx.lineTo(x+sx*16,y);ctx.stroke();}
 scene.textures.addCanvas(key,canvas);return key;
}

/** 在已有文字按钮后面垫一块水墨按钮美术（招募卡等容器内的按钮用）：返回 NineSlice，缺图时返回 null。cx / cy 为按钮中心。 */
export function inkPlate(scene:Phaser.Scene,prev:Phaser.GameObjects.NineSlice|null|undefined,cx:number,cy:number,width:number,height:number,primary:boolean,state:'normal'|'hover'|'pressed'|'disabled'):Phaser.GameObjects.NineSlice|null{
 const a=buttonArt(scene,primary,state);if(!a)return null;
 const g=prev??scene.add.nineslice(cx,cy,a.key,undefined,a.w,a.h,a.cap,a.cap,0,0);
 g.setTexture(a.key).setX(cx);fitArt(g,a,width,height,cy,state==='pressed');return g;
}

/**
 * 三选一卡 · 水墨预览版（?levelup=ink，2026-11-17 用户「水墨风我看看再决定」，默认不启用）：
 * 陈年宣纸（ink_paper）为底，四边淡墨晕染、干笔墨框；徽章位是一团淡墨；悬停时边缘墨色加深、透出朱砂光。
 * 尺寸与 upgradeCardTexture 一致（外留 16px），命中区逻辑不变。
 */
export function inkUpgradeCardTexture(scene:Phaser.Scene,width:number,height:number,medallion:{x:number;y:number;r:number},hover=false,rare=false):string{
 const S=RENDER_SCALE,w=Math.round(width),h=Math.round(height),key=`upcard-ink-${w}x${h}-${medallion.x}-${medallion.y}-${hover?1:0}-${rare?1:0}-${S}`;
 if(scene.textures.exists(key))return key;
 const P=16,canvas=document.createElement('canvas');canvas.width=Math.ceil((w+P*2)*S);canvas.height=Math.ceil((h+P*2)*S);
 const ctx=canvas.getContext('2d')!;ctx.scale(S,S);ctx.translate(P,P);
 // 投影 / 悬停朱砂光
 ctx.save();ctx.shadowColor=rare?'rgba(255,190,90,.7)':hover?'rgba(190,60,40,.55)':'rgba(0,0,0,.55)';ctx.shadowBlur=hover||rare?18:10;ctx.shadowOffsetY=hover||rare?0:4;ctx.fillStyle='#000';ctx.fillRect(2,2,w-4,h-4);ctx.restore();
 // 宣纸
 if(scene.textures.exists('ink_paper')){const src=scene.textures.get('ink_paper').getSourceImage() as HTMLImageElement,k=Math.max(w/src.width,h/src.height);ctx.drawImage(src,(src.width-w/k)/2,(src.height-h/k)/2,w/k,h/k,0,0,w,h);}
 else{const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#efe5ce');g.addColorStop(1,'#d8c7a3');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
 // 四边淡墨晕染
 const edge=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.32,w/2,h/2,Math.max(w,h)*.72);edge.addColorStop(0,'rgba(40,30,20,0)');edge.addColorStop(1,hover?'rgba(40,24,14,.55)':'rgba(40,30,20,.4)');ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);
 // 徽章位：一团淡墨
 const m=ctx.createRadialGradient(medallion.x,medallion.y,2,medallion.x,medallion.y,medallion.r*1.25);m.addColorStop(0,'rgba(30,24,18,.55)');m.addColorStop(.7,'rgba(30,24,18,.28)');m.addColorStop(1,'rgba(30,24,18,0)');ctx.fillStyle=m;ctx.beginPath();ctx.arc(medallion.x,medallion.y,medallion.r*1.25,0,Math.PI*2);ctx.fill();
 // 干笔墨框：多条略抖的细线叠出飞白
 let seed=w*7+h*13;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let k=0;k<5;k++){ctx.strokeStyle=`rgba(20,16,12,${hover?.5:.38})`;ctx.lineWidth=.8+rnd()*1.6;ctx.beginPath();const j=()=>(rnd()-.5)*2.2,o=2+k*.7;ctx.moveTo(o+j(),o+j());ctx.lineTo(w-o+j(),o+j());ctx.lineTo(w-o+j(),h-o+j());ctx.lineTo(o+j(),h-o+j());ctx.closePath();ctx.stroke();}
 // 稀有：朱砂角印
 if(rare){ctx.fillStyle='rgba(168,40,28,.85)';ctx.fillRect(w-26,8,18,18);}
 scene.textures.addCanvas(key,canvas);return key;
}

/**
 * 水墨按钮皮（2026-11-17 用户批准 UI 审查「剩下的漆金方钮换水墨」）：与 LacquerKit.lqSkin 同接口，
 * 给一个文字命中对象垫一块水墨笔触底，跟随悬停 / 按下 / 禁用 / 选中（选中与 primary 用朱墨）。缺水墨图时返回 null，调用方退回 lqSkin。
 */
export function inkSkin(scene:Phaser.Scene,target:Phaser.GameObjects.Text,size:()=>{w:number;h:number},o:{active?:()=>boolean;enabled?:()=>boolean;primary?:boolean}={}):{gfx:Phaser.GameObjects.NineSlice;repaint:(s?:string)=>void}|null{
 if(!scene.textures.exists('btn_ink_primary_normal'))return null;
 let state:'normal'|'hover'|'pressed'='normal',plate:Phaser.GameObjects.NineSlice|null=null;
 const repaint=(s?:string)=>{
  if(s==='hover'||s==='pressed'||s==='normal')state=s;else if(s==='idle')state='normal';else if(s==='down')state='pressed';
  if(!target.scene)return;
  const en=o.enabled?o.enabled():true,on=!!o.active?.()||!!o.primary,{w,h}=size(),st=!en?'disabled':state;
  plate=inkPlate(scene,plate,target.x,target.y,w,h,on,st);plate?.setVisible(target.visible).setScrollFactor(0);
  target.setColor(!en?'#3a332a':st==='hover'?'#fff3d4':on?'#f8e6bf':'#e8d3a6').setStroke(!en?'#00000000':on?'#2a0c06':'#16100a',3);
 };
 target.on('pointerover',()=>repaint('hover')).on('pointerout',()=>repaint('normal')).on('pointerdown',()=>repaint('pressed')).on('pointerup',()=>repaint('hover'));
 repaint();
 return plate?{gfx:plate,repaint}:null;
}

/**
 * 次要按钮的漆金版（2026-11-21 制作人验收「一屏一个水墨按钮」：主页「更换武将 / 主公 · xx」原来是黑色水墨）。
 * 接口同 homeCommand（g / hit / caption / paint / setY / y），调用方不用改；外观是漆底描金（LacquerKit.lqButton）。
 */
export function homeLqCommand(scene:Phaser.Scene,x:number,y:number,width:number,height:number,label:string,fontSize=17,enabled=true){
 const g=scene.add.graphics(),hit=scene.add.rectangle(x,y,width,height,0,0.001);if(enabled)hit.setInteractive({useHandCursor:true});
 const caption=scene.add.text(x,y,label,{fontFamily:HEADING_FONT,fontSize:fontSize+'px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setLetterSpacing(2).setShadow(0,1,'#120a05',3,true,true);
 let current='normal';
 const paint=(state:string='normal')=>{
  current=state;const st:LqState=!hit.input?.enabled?'off':state==='hover'?'hover':state==='pressed'?'down':state==='selected'?'on':'idle';
  g.clear();const d=lqButton(g,x,y,width,height,st,'quiet');caption.setPosition(x,y+d).setColor(lqLabelColor(st));
 };
 paint();
 if(enabled)hit.on('pointerdown',()=>{const battle=(scene as unknown as {sfx?:{play(k:string):void}}).sfx;if(battle)battle.play('uiClick');else{const s=uiSfx();s.unlock();s.play('uiClick');}});
 hit.on('pointerover',()=>{if(current!=='selected'){paint('hover');uiSfx().play('uiHover');}}).on('pointerout',()=>{if(current!=='selected')paint();}).on('pointerdown',()=>paint('pressed')).on('pointerup',()=>paint('hover'));
 const setY=(ny:number)=>{y=ny;hit.setY(ny);paint(current);};
 return{g,hit,caption,paint,setY,get y(){return y;}};
}
