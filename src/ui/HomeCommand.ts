import Phaser from 'phaser';
import {HEADING_FONT,RENDER_SCALE} from '../config';
import {uiSfx} from '../systems/Sfx';

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

/** 首页/军营通用命令按钮。返回 g（底板图像）、hit、caption、paint(state) 与旧接口一致。 */
export function homeCommand(scene:Phaser.Scene,x:number,y:number,width:number,height:number,label:string,primary=false,enabled=true,fontSize?:number){
 const g=scene.add.image(x,y,commandTexture(scene,width,height,primary,enabled?'normal':'disabled')).setDisplaySize(width+PAD*2,height+PAD*2);
 const hit=scene.add.rectangle(x,y,width,height,0,0.001);if(enabled)hit.setInteractive({useHandCursor:true});
 const size=fontSize??(primary?Math.min(24,Math.round(height*.4)):Math.min(18,Math.round(height*.34)));
 const caption=scene.add.text(x,y,label,{fontFamily:HEADING_FONT,fontSize:size+'px',fontStyle:'bold',color:!enabled?'#8e8576':primary?'#f8e6bf':'#e8d3a6',resolution:2}).setOrigin(.5).setLetterSpacing(primary?6:label.length>4?1:3).setShadow(0,1,'#120a05',3,true,true);
 let current:CommandState='normal';
 const paint=(state:string='normal')=>{
  if(!enabled)return;
  const s:CommandState=state==='hover'||state==='pressed'||state==='selected'?state:'normal';current=s;
  g.setTexture(commandTexture(scene,width,height,primary,s)).setDisplaySize(width+PAD*2,height+PAD*2).setY(y+(s==='pressed'?1:0));
  caption.setY(y+(s==='pressed'?1:0)).setColor(s==='hover'||s==='selected'?'#fff3d4':primary?'#f8e6bf':'#e8d3a6');
 };
 paint();
 if(enabled)hit.on('pointerdown',()=>{const battle=(scene as unknown as {sfx?:{play(k:string):void}}).sfx;if(battle)battle.play('uiClick');else{const s=uiSfx();s.unlock();s.play('uiClick');}});
 hit.on('pointerover',()=>{if(current!=='selected')paint('hover');}).on('pointerout',()=>{if(current!=='selected')paint();}).on('pointerdown',()=>paint('pressed')).on('pointerup',()=>paint('hover'));
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
