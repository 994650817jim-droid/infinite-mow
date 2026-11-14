/** Baked pixel road: existing earth remains visible between weathered timber repairs. */
export function paintCampRoad(g:CanvasRenderingContext2D){
 let seed=23717;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const image=g.getImageData(0,0,512,512),p=image.data;
 // Broken, stippled shoulders blend into the original soil instead of a rectangular overlay.
 for(let y=174;y<338;y+=2)for(let x=0;x<512;x+=2){const edge=Math.abs(y-256),shoulder=Math.max(0,1-edge/82),grain=rand();if(grain>shoulder*.84)continue;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const k=((y+dy)*512+x+dx)*4;p[k]=Math.round(p[k]*.88+9);p[k+1]=Math.round(p[k+1]*.86+6);p[k+2]=Math.round(p[k+2]*.88+4);}}
 g.putImageData(image,0,0);
 // Discontinuous wheel ruts; low contrast, with periodic wrapping across texture edges.
 for(const y of[227,284])for(let x=0;x<512;x+=4){if(rand()<.23)continue;g.fillStyle='rgba(48,35,23,.18)';g.fillRect(x,y+(rand()<.3?1:0),3,2);}
 const palette=['#68533a','#725b40','#786145','#65513a','#80684b'];
 // Two small timber reinforcement patches, with earth gaps and uneven ends.
 for(const [start,count]of[[62,7],[310,5]])for(let i=0;i<count;i++){
  if(rand()<.13)continue;const x=start+i*13,top=220+Math.floor(rand()*10),height=56+Math.floor(rand()*13),width=10+Math.floor(rand()*2);
  g.fillStyle='rgba(32,25,18,.23)';g.fillRect(x+1,top+2,width+1,height);
  g.fillStyle=palette[Math.floor(rand()*palette.length)];g.fillRect(x,top,width,height);
  g.fillStyle='rgba(179,144,96,.30)';g.fillRect(x+1,top+1,1,height-3);
  g.fillStyle='rgba(36,29,22,.30)';g.fillRect(x+width-1,top+2,1,height-2);
  for(let k=0;k<3;k++){g.fillStyle=k%2?'rgba(39,30,20,.22)':'rgba(170,137,92,.20)';g.fillRect(x+2+Math.floor(rand()*5),top+8+Math.floor(rand()*25),1,10+Math.floor(rand()*14));}
  g.fillStyle='#493c2b';g.fillRect(x+3,top+5,2,2);g.fillRect(x+3,top+height-7,2,2);
  // Missing corners expose the underlying dirt, avoiding pristine identical plank ends.
  g.fillStyle='#695035';g.fillRect(x,top,2,1);
 }
 // Fine dirt deposits along timber edges, not large floating shadows.
 for(let i=0;i<130;i++){const x=Math.floor(rand()*512),y=213+Math.floor(rand()*87);g.fillStyle=rand()<.5?'rgba(114,85,49,.24)':'rgba(56,43,27,.19)';g.fillRect(x,y,2+Math.floor(rand()*3),1);}
}
