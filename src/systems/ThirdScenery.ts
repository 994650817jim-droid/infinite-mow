import {paintCampRoad} from './CampRoad';
import Phaser from 'phaser';import {actorDepth}from'../config';import type{ThirdStage}from'../data/thirdChapter';
/** Existing art, four distinct layouts (4 = 江陵城下：石板广场、城门箭楼、十字大道); no illustrated camp image is tiled. */
export type SceneryStage=ThirdStage|4;
export function thirdScenery(scene:Phaser.Scene,stage:SceneryStage,spawnProp?:(frame:number,x:number,y:number,size:number)=>void){
 const key='third_ground_'+stage;if(!scene.textures.exists(key)){const tex=scene.textures.createCanvas(key,512,512)!;const g=tex.context;g.imageSmoothingEnabled=false;const source=scene.textures.get(stage===2?'xingyang_ground':stage===1||stage===4?'ground_hulao':'ground_ai2').getSourceImage()as HTMLImageElement;g.drawImage(source,0,0,512,512);

 if(stage===2){g.fillStyle='rgba(8,18,32,.66)';g.fillRect(0,0,512,512);}
 if(stage===3){g.fillStyle='rgba(114,96,48,.16)';g.fillRect(0,0,512,512);}
 if(stage===4){g.fillStyle='rgba(72,70,66,.34)';g.fillRect(0,0,512,512);}
 tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.NEAREST);}
 // Roads are world layout strips, not intersections repeated in every ground tile.
 const roadKey='third_road_'+stage;
 const roadWidth=stage===1||stage===4?172:stage===2?124:164;
 if(!scene.textures.exists(roadKey)){
  const road=scene.textures.createCanvas(roadKey,stage===3?512:roadWidth,stage===3?164:512)!;
  const ctx=road.context;ctx.imageSmoothingEnabled=false;
  if(stage===3){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
   c.drawImage(scene.textures.get(key).getSourceImage() as HTMLCanvasElement,0,0);paintCampRoad(c);
   ctx.drawImage(canvas,0,174,512,164,0,0,512,164);
  }else{
   ctx.fillStyle=stage===1?'#766450':stage===4?'#6b6863':'#343335';ctx.fillRect(0,0,roadWidth,512);
   for(let y=0;y<512;y+=16)for(let x=-12;x<roadWidth;x+=24){
    ctx.fillStyle=stage===1?((x+y)%3?'#81715a':'#695b49'):stage===4?((x+y)%3?'#7a7770':'#5f5c57'):((x+y)%3?'#44403d':'#353536');
    ctx.fillRect(x+(y%32?6:0),y+1,20,13);
   }
  }
  // Stippled transparent shoulders soften the join without changing collision.
  const image=ctx.getImageData(0,0,road.width,road.height);
  for(let y=0;y<road.height;y++)for(let x=0;x<road.width;x++){
   const edge=stage===3?Math.min(y,road.height-1-y):Math.min(x,road.width-1-x);
   if(edge<10)image.data[(y*road.width+x)*4+3]*=Math.max(0,Math.min(1,(edge+((x*13+y*7)%7)-3)/10));
  }
  ctx.putImageData(image,0,0);road.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
 }
 if(stage===3)scene.add.tileSprite(0,-190,8192,164,roadKey).setDepth(1);
 else{
  scene.add.tileSprite(0,0,roadWidth,8192,roadKey).setDepth(1);
  if(stage===2||stage===4)scene.add.tileSprite(0,0,roadWidth,8192,roadKey).setRotation(Math.PI/2).setDepth(1);
 }
 // Direct scene children sort against actors; a container would isolate their depth.
 const place=(frame:number,x:number,y:number,size:number)=>{if(frame>=3&&spawnProp){spawnProp(frame,x,y,size);return;}scene.add.image(x,y,'sishui_props_refined',frame).setOrigin(.5,1).setDisplaySize(size,size).setDepth(actorDepth(y));};

 // Central approach stays open. Props belong to actual garrison/supply areas.
 const camps=stage===1?[
  {x:-340,y:200,kind:'infantry' as const,name:'西凉前哨营'},
  {x:350,y:-440,kind:'cavalry' as const,name:'铁骑驻营'}
 ]:stage===2?[
  {x:-270,y:340,kind:'infantry' as const,name:'夜袭枪兵营'},
  {x:290,y:-400,kind:'archer' as const,name:'伏弓营'}
 ]:stage===4?[
  {x:-340,y:230,kind:'shield' as const,name:'江陵守军营'},
  {x:360,y:-430,kind:'archer' as const,name:'城头弓营'}
 ]:[
  {x:-330,y:210,kind:'shield' as const,name:'寿春亲军营'},
  {x:340,y:-420,kind:'archer' as const,name:'旗令弓营'}
 ];
 for(const c of camps){
  place(4,c.x+113,c.y-8,92);
  place(3,c.x-110,c.y+42,90);
  place(6,c.x-98,c.y-74,86);
  place(7,c.x+108,c.y+80,72);
 }
 if(stage===1){place(0,0,-280,300);for(const x of[-250,250])place(1,x,-265,126);}
 if(stage===2){for(const x of[-145,145])place(7,x,-65,72);scene.add.rectangle(0,0,4000,4000,0x091526,.12).setDepth(18);}
 if(stage===3)place(0,0,-300,230);
 if(stage===4){place(0,0,-300,320);for(const x of[-270,270])place(1,x,-285,130);for(const x of[-150,150])place(7,x,140,70);}
 const boxes=stage===1?[{left:-125,right:125,top:-340,bottom:-285},...[-250,250].map(x=>({left:x-34,right:x+34,top:-300,bottom:-265}))]:stage===3?[{left:-85,right:85,top:-345,bottom:-305}]:stage===4?[{left:-135,right:135,top:-365,bottom:-305},...[-270,270].map(x=>({left:x-36,right:x+36,top:-320,bottom:-285}))]:[];
 return{key,boxes,camps};
}
