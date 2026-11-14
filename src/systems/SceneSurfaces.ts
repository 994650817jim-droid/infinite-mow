import Phaser from 'phaser';
/** Cached render derivatives. Originals, sprite origins and gameplay footprints stay intact. */
function track(scene:Phaser.Scene,key:string):void {const keys=scene.registry.get('battleTextureKeys') as string[]|undefined;if(keys&&!keys.includes(key))keys.push(key);}
export function terrainSurface(scene:Phaser.Scene,sourceKey:string,scale:number):{key:string;scale:number}{
 const key='surface_v1_'+sourceKey;if(scene.textures.exists(key))return{key,scale:2};
 const source=scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
 const size=Math.max(64,Math.round(source.width*scale/2));
 const texture=scene.textures.createCanvas(key,size*2,size*2)!;const ctx=texture.context;
 ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,size,size);
 const image=ctx.getImageData(0,0,size,size),p=image.data;
 // Slightly compress harsh ground contrast; retain the chapter's own earth palette.
 for(let i=0;i<p.length;i+=4){const l=.3*p[i]+.59*p[i+1]+.11*p[i+2];for(let c=0;c<3;c++)p[i+c]=Math.round((p[i+c]*.95+l*.05)/3)*3;}
 // Paired edge pixels meet exactly, with a short feather into the untouched interior.
 const band=8;
 for(let y=0;y<size;y++)for(let d=0;d<band;d++)for(let c=0;c<3;c++){
  const a=(y*size+d)*4+c,b=(y*size+size-1-d)*4+c,avg=(p[a]+p[b])/2,t=(1-d/band)*.5;
  p[a]=Math.round(p[a]*(1-t)+avg*t);p[b]=Math.round(p[b]*(1-t)+avg*t);
  if(d===0)p[a]=p[b]=Math.round(avg);
 }
 for(let x=0;x<size;x++)for(let d=0;d<band;d++)for(let c=0;c<3;c++){
  const a=(d*size+x)*4+c,b=((size-1-d)*size+x)*4+c,avg=(p[a]+p[b])/2,t=(1-d/band)*.5;
  p[a]=Math.round(p[a]*(1-t)+avg*t);p[b]=Math.round(p[b]*(1-t)+avg*t);if(d===0)p[a]=p[b]=Math.round(avg);
 }
 // Build four restrained macro variants. Their border bands remain identical,
 // while quiet soil islands interrupt the repeated ruts inside each tile.
 let best=Infinity,sampleX=16,sampleY=16;
 for(let y=16;y<size-32;y+=16)for(let x=16;x<size-32;x+=16){let sum=0,sum2=0;for(let yy=0;yy<12;yy++)for(let xx=0;xx<12;xx++){const i=((y+yy)*size+x+xx)*4,l=(p[i]+p[i+1]+p[i+2])/3;sum+=l;sum2+=l*l;}const variance=sum2/144-(sum/144)**2;if(variance<best){best=variance;sampleX=x;sampleY=y;}}
 for(let v=0;v<4;v++){
  const variant=new ImageData(new Uint8ClampedArray(p),size,size),q=variant.data;
  for(let patch=0;patch<2;patch++){
   const cx=size*(.28+((v*37+patch*19)%41)/100),cy=size*(.25+((v*23+patch*31)%46)/100),rx=size*.18,ry=size*.14;
   for(let y=16;y<size-16;y++)for(let x=16;x<size-16;x++){
    const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d>=1)continue;
    const alpha=Math.min(.68,(1-d)*1.4),i=(y*size+x)*4,src=((sampleY+y%12)*size+sampleX+x%12)*4;
    for(let c=0;c<3;c++)q[i+c]=Math.round(q[i+c]*(1-alpha)+p[src+c]*alpha);
   }
  }
  ctx.putImageData(variant,v%2*size,Math.floor(v/2)*size);
 }
 texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);track(scene,key);return{key,scale:2};
}
export function architecturalSurface(scene:Phaser.Scene):void{
 const key='sishui_props_refined';if(scene.textures.exists(key))return;
 const source=scene.textures.get('sishui_props').getSourceImage() as HTMLImageElement;
 const texture=scene.textures.createCanvas(key,512,256)!,ctx=texture.context;ctx.imageSmoothingEnabled=true;ctx.drawImage(source,0,0,512,256);
 const image=ctx.getImageData(0,0,512,256),p=image.data;
 for(let i=0;i<p.length;i+=4){if(p[i+3]<24){p[i+3]=0;continue;}for(let c=0;c<3;c++)p[i+c]=Math.round(p[i+c]/6)*6;}
 ctx.putImageData(image,0,0);for(let i=0;i<8;i++)texture.add(i,0,i%4*128,Math.floor(i/4)*128,128,128);
 texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);track(scene,key);
}

