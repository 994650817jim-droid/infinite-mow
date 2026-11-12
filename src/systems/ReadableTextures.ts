import Phaser from 'phaser';
/** Cached visual-only derivatives; original atlases and animation frame geometry remain intact. */
export function visualTextureKey(scene:Phaser.Scene,key:string):string {return scene.textures.exists(`readable_${key}`)?`readable_${key}`:key;}
export function createReadableTextures(scene:Phaser.Scene):void {
  const groups=[
    {keys:['shu_swordsman_walk_sheet','shu_swordsman_attack_sheet','shu_spearman_walk_sheet','shu_spearman_attack_sheet','shu_archer_walk_sheet','shu_archer_attack_sheet'],green:true,hero:false},
    {keys:['hero_walk_sheet','guanyu_walk_sheet','huangzhong_walk_sheet','zhuge_walk_sheet'],green:false,hero:true},
    {keys:['enemy_infantry_walk_sheet','enemy_shield_walk_sheet','enemy_archer_walk_sheet','enemy_cavalry_run_sheet','enemy_officer_walk_sheet','enemy_archer_attack_sheet'],green:false,hero:false},
  ];
  for(const group of groups)for(const key of group.keys){
    const target=`readable_${key}`;if(!scene.textures.exists(key)||scene.textures.exists(target))continue;
    const original=scene.textures.get(key),source=original.getSourceImage() as HTMLImageElement;
    const texture=scene.textures.createCanvas(target,source.width,source.height)!;
    const ctx=texture.context;ctx.drawImage(source,0,0);
    const image=ctx.getImageData(0,0,source.width,source.height),pixels=image.data,alpha=new Uint8ClampedArray(pixels.length/4);
    for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
      const i=(y*source.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      // Skin is warm orange (G noticeably above B); red cloth has G close to B.
      // Keep pale skin and all orange/brown skin shadows unchanged.
      if(group.green&&alpha[i/4]>0&&r>g*1.85&&r-b>40&&g<120&&g-b<14){const v=r*.4+g*.4+b*.2;pixels[i]=v*.65;pixels[i+1]=v*1.12;pixels[i+2]=v*.77;}
      if(alpha[i/4]>20)continue;
      // Never bleed a neighboring sprite cell into this frame's outline.
      const near=(x%96>0&&alpha[i/4-1]>180)||(x%96<95&&x+1<source.width&&alpha[i/4+1]>180)||(y%96>0&&alpha[i/4-source.width]>180)||(y%96<95&&y+1<source.height&&alpha[i/4+source.width]>180);
      if(near){pixels[i]=group.hero?206:35;pixels[i+1]=group.hero?205:31;pixels[i+2]=group.hero?169:23;pixels[i+3]=group.hero?155:210;}
    }
    ctx.putImageData(image,0,0);texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
    for(const name of original.getFrameNames()){const frame=original.get(name);texture.add(name,0,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight);}
  }
}
