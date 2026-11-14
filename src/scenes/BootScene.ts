import {GROWTH_ICON_IDS} from '../ui/GrowthIcons';
import {TACTICS,TREASURES} from '../data/builds';
import {loadWorld,worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {createReadableTextures} from '../systems/ReadableTextures';
import { GAME_WIDTH } from '../config';
import { createGameTextures, createWalkPlaceholders, registerWalkSheet } from '../systems/TextureFactory';

export class BootScene extends Phaser.Scene {
  private shellOnly=false;
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet('build_vfx','assets/build-vfx/styles-ai-v1.png',{frameWidth:64,frameHeight:64});
    this.load.spritesheet('refined_spear','assets/combat-refined/spear-sequence.png',{frameWidth:384,frameHeight:64});
    this.load.spritesheet('refined_impact','assets/combat-refined/impact-sequence.png',{frameWidth:64,frameHeight:64});
    for(const id of GROWTH_ICON_IDS)this.load.image('growth_icon_'+id,'assets/growth-icons/'+id+'.png');
    for(const id of [...Object.keys(TACTICS),...Object.keys(TREASURES)])this.load.image('build_icon_'+id,'assets/build/'+id+'.png');
    const params=new URLSearchParams(window.location.search);
    this.shellOnly=false;
    if(this.shellOnly){if(!this.textures.exists('art_panel'))this.load.image('art_panel','assets/processed/overhaul/bronze-panel-mobile.png');return;}
    const homeSave=loadWorld(),homeChapter=homeSave.yellowStages>=3||homeSave.cleared.huangjin||homeSave.legacyHulaoAccess?'dongzhuo':'huangjin';
    const homeLayout=GAME_WIDTH>600?'desktop':'mobile';
    this.load.image('epic_bg_'+homeChapter+'_'+homeLayout,'assets/epic-home/'+homeChapter+'-'+homeLayout+'.webp');
    let homeHero='zhaoyun';try{const id=localStorage.getItem('im_last_hero');if(id&&['zhaoyun','guanyu','huangzhong','zhuge'].includes(id))homeHero=id;}catch{}
    this.load.image('epic_hero_'+homeHero,'assets/epic-home/'+homeHero+'.webp');
    // Menu fallback and rest screens share the rest_camp texture allocation.
    // Both formal west stages can be selected after this boot; preload their existing atlases once.
    this.load.spritesheet('xurong','assets/phase17/xurong/sheet.png',{frameWidth:128,frameHeight:128});
    this.load.image('xingyang_ground','assets/phase17/xurong/ground.png');
    for(const key of ['walk','attack','actions','sweep'])this.load.spritesheet('huaxiong_'+key,'assets/phase17/huaxiong/'+key+'.png',{frameWidth:128,frameHeight:128});
    this.load.image('huaxiong_portrait','assets/phase17/huaxiong/portrait.png');
    this.load.spritesheet('sishui_props','assets/phase17/huaxiong/props.png',{frameWidth:256,frameHeight:256});
    for(const key of ['zhangliang_walk','zhangliang_attack','zhangbao_walk','zhangbao_cast','spear_walk','spear_attack','archer_walk','archer_attack','shield_walk','shield_attack','shaman_walk','shaman_cast'])this.load.spritesheet(`yellow_${key}`,`assets/processed/yellow/${key==='spear_walk'?'spear-walk-v2':key==='spear_attack'?'spear-attack-v2':key}.png`,{frameWidth:96,frameHeight:96});
    for(const key of ['swordsman-walk-v4','swordsman-attack-v4','shield-walk-v4','shield-attack-v4','spear-walk-v4'])this.load.spritesheet(`yellow_${key}`,`assets/processed/yellow/${key}.png`,{frameWidth:96,frameHeight:96});
    for(const [key,file] of [['brazier_burning','brazier_burning-v4.png'],['brazier_breaking','brazier_breaking-v4.png'],['ground_fire','ground_fire-v4.png']] as const)this.load.spritesheet(key,`assets/processed/yellow/${file}`,{frameWidth:444,frameHeight:444});
    for(let i=1;i<=3;i++)this.load.image(`yellow_ground_${i}`,`assets/processed/yellow/ground-${i}.png`);
    for(const key of ['yellow_shaman_ground_sigil_warning','zhangbao_earth_rift_warning_and_burst','zhangbao_earth_shockwave','zhangbao_earth_wall_spawn','zhangbao_ritual_circle','zhangliang_call_reinforcements','zhangliang_charge_warning','zhangliang_slash','yellow_archer_arrow','yellow_shield_short_stab'])this.load.spritesheet(key,`assets/processed/yellow/${key}.png`,{frameWidth:128,frameHeight:128});
    this.load.spritesheet('yellow_props','assets/processed/yellow/camp-props.png',{frameWidth:128,frameHeight:128});
    this.load.spritesheet('yellow_contact_shadow','assets/processed/yellow/camp-props-contact-shadows-v1.png',{frameWidth:128,frameHeight:128});
    for(const key of ['zhang_bao_altar','zhang_jiao_altar'])this.load.image(key,`assets/processed/yellow/${key}.png`);
    this.load.spritesheet('prop_debris','assets/processed/yellow/prop-debris.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('prop_break_fx','assets/processed/yellow/prop-break-fx.png',{frameWidth:96,frameHeight:96});
    this.load.image('yellow_arrow','assets/processed/yellow/arrow-tight.png');
    this.load.image('rest_camp','assets/world/rest-camp.webp');
    this.load.image('legion_halberdier_action','assets/processed/legion/halberdier-attack-v1.png');
    this.load.image('art_fx','assets/processed/overhaul/combat-fx-mobile.png');
    this.load.image('art_props', 'assets/processed/overhaul/battlefield-props-mobile.png');
    this.load.image('art_panel', 'assets/processed/overhaul/bronze-panel-mobile.png');
    this.load.image('ground_overhaul_hulao', 'assets/processed/overhaul/hulao-ground-mobile.png');
    this.load.image('ground_overhaul_huangjin', 'assets/processed/overhaul/huangjin-ground-mobile.png');
    for (const kind of ['medic', 'crossbowman']) this.load.spritesheet(`legion_${kind}_action`, `assets/processed/legion/${kind}-action.png`, { frameWidth: 96, frameHeight: 96 });
    for (const kind of ['medic', 'crossbowman', 'guardian', 'rider', 'halberdier']) {
      this.load.spritesheet(`legion_${kind}_walk`, `assets/processed/legion/${kind}-walk.png`, { frameWidth: 96, frameHeight: 96 });
    }
    for (const kind of ['takeoff', 'hover', 'landing', 'warning', 'field']) {
      this.load.spritesheet(`lubu_ult_${kind}`, `assets/processed/hulao/ultimate-new/${kind}.png`, { frameWidth: 256, frameHeight: 256 });
    }
    this.load.spritesheet('boss_lubu', 'assets/processed/hulao/lubu-walk.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('lubu_attack', 'assets/processed/hulao/lubu-attack.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('lubu_slash', 'assets/processed/hulao/lubu-slash.png', { frameWidth: 544, frameHeight: 544 });
    this.load.image('ground_hulao', 'assets/processed/hulao/ground.png');
    for (const kind of ['infantry', 'shield', 'archer', 'cavalry', 'elite']) {
      this.load.spritesheet(`xiliang_${kind}_walk`, `assets/processed/xiliang/${kind}-walk.png`, { frameWidth: 96, frameHeight: 96 });
    }
    this.load.image('hero_zhaoyun', 'assets/processed/hero_zhaoyun.png');
    this.load.image('enemy_infantry', 'assets/processed/enemy_infantry.png');
    this.load.image('enemy_archer', 'assets/processed/enemy_archer.png');
    this.load.image('enemy_shield', 'assets/processed/enemy_shield.png');
    this.load.image('enemy_cavalry', 'assets/processed/enemy_cavalry.png');
    this.load.image('enemy_elite', 'assets/processed/enemy_elite.png');
    this.load.image('boss_zhangjiao', 'assets/processed/boss_zhangjiao.png');
    this.load.image('ground_ai', 'assets/processed/ground_ai.png');
    this.load.image('ground_ai2', 'assets/processed/ground_ai2.png');
    this.load.spritesheet('hero_walk_sheet', 'assets/processed/hero_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('guanyu_walk_sheet', 'assets/processed/guanyu_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('huangzhong_walk_sheet', 'assets/processed/huangzhong_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_infantry_walk_sheet', 'assets/processed/enemy_infantry_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_shield_walk_sheet', 'assets/processed/enemy_shield_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_archer_walk_sheet', 'assets/processed/enemy_archer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_archer_attack_sheet', 'assets/processed/enemy_archer_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_cavalry_run_sheet', 'assets/processed/enemy_cavalry_run_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_cavalry_charge_sheet', 'assets/processed/enemy_cavalry_charge_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_officer_walk_sheet', 'assets/processed/enemy_officer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_swordsman_walk_sheet', 'assets/processed/shu_swordsman_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_swordsman_attack_sheet', 'assets/processed/shu_swordsman_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_archer_walk_sheet', 'assets/processed/shu_archer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.image('icon_shu_swordsman', 'assets/processed/icon_shu_swordsman.png');
    this.load.image('icon_shu_archer', 'assets/processed/icon_shu_archer.png');
    this.load.image('icon_shu_spearman', 'assets/processed/icon_shu_spearman.png');
    this.load.spritesheet('shu_archer_attack_sheet', 'assets/processed/shu_archer_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_spearman_walk_sheet', 'assets/processed/shu_spearman_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_spearman_attack_sheet', 'assets/processed/shu_spearman_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zhuge_walk_sheet', 'assets/processed/zhuge_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zhuge_attack_sheet', 'assets/processed/zhuge_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.image('portrait_zhuge', 'assets/processed/portrait_zhuge.png');
    this.load.image('spear_thrust', 'assets/processed/spear_thrust.png');
    this.load.spritesheet('guandao_slash_sheet', 'assets/processed/guandao_slash_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('huangzhong_portrait', 'assets/processed/huangzhong_portrait.png');
    this.load.image('guanyu_portrait', 'assets/processed/guanyu_portrait.png');
    this.load.image('item_drum', 'assets/processed/item_drum.png');
    this.load.image('item_whetstone', 'assets/processed/item_whetstone.png');
    this.load.image('item_armor', 'assets/processed/item_armor.png');
    this.load.image('item_wine', 'assets/processed/item_wine.png');
    this.load.image('item_oil', 'assets/processed/item_oil.png');
    this.load.image('item_torch', 'assets/processed/item_torch.png');
    this.load.image('item_ring', 'assets/processed/item_ring.png');
    this.load.image('item_quiver', 'assets/processed/item_quiver.png');

    this.load.image('arrow', 'assets/processed/enemy_arrow.png');
    this.load.image('ui_card', 'assets/processed/ui_card.png');
    this.load.image('ui_panel', 'assets/processed/ui_panel.png');
    this.load.image('ui_button', 'assets/processed/ui_button.png');
    this.load.image('icon_1', 'assets/processed/icon_1.png');
    this.load.image('icon_2', 'assets/processed/icon_2.png');
    this.load.image('icon_3', 'assets/processed/icon_3.png');
  }

  create(): void {
    if(this.shellOnly){const hint=document.getElementById('boot-hint');if(hint)hint.style.display='none';this.scene.start('CityScene');return;}
    for(const key of ['zhangliang_walk','zhangliang_attack','zhangbao_walk','zhangbao_cast','spear_walk','spear_attack','archer_walk','archer_attack','shield_walk','shield_attack','shaman_walk','shaman_cast']){
      const tex=this.textures.get(`yellow_${key}`);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)tex.add(`${dir}_${col}`,0,col*96,row*96,96,96);});
    }
    for(const key of ['swordsman-walk-v4','swordsman-attack-v4','shield-walk-v4','shield-attack-v4','spear-walk-v4']){
      const tex=this.textures.get(`yellow_${key}`);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)tex.add(`${dir}_${col}`,0,col*96,row*96,96,96);});
    }
    createGameTextures(this);
    const halberd=this.textures.get('legion_halberdier_action');
    ['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)halberd.add(`${dir}_${col}`,0,col*128,row*112,128,112);});
    const fx=this.textures.get('art_fx'), fxImage=fx.getSourceImage();
    for(let row=0;row<2;row++)for(let col=0;col<4;col++){const x=Math.round(col*fxImage.width/4),y=Math.round(row*fxImage.height/2);fx.add(String(row*4+col),0,x,y,Math.round((col+1)*fxImage.width/4)-x,Math.round((row+1)*fxImage.height/2)-y);}
    const props=this.textures.get('art_props'), image=props.getSourceImage();
    for(let row=0;row<2;row++)for(let col=0;col<4;col++){const x=Math.round(col*image.width/4),y=Math.round(row*image.height/2);props.add(String(row*4+col),0,x,y,Math.round((col+1)*image.width/4)-x,Math.round((row+1)*image.height/2)-y);}
    createWalkPlaceholders(this);
    registerWalkSheet(this);
    for (const kind of ['medic', 'crossbowman']) {
      const texture = this.textures.get(`legion_${kind}_action`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96); });
    }
    for (const kind of ['medic', 'crossbowman', 'guardian', 'rider', 'halberdier']) {
      const texture = this.textures.get(`legion_${kind}_walk`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96);
      });
    }
    // Exclude the original transparent margin without altering the source PNG.
    this.textures.get('spear_thrust').add('tight', 0, 31, 51, 460, 62);
    for (const key of ['boss_lubu', 'lubu_attack']) {
      const texture = this.textures.get(key);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 256, row * 256, 256, 256);
      });
    }
    for (const kind of ['infantry', 'shield', 'archer', 'cavalry', 'elite']) {
      const texture = this.textures.get(`xiliang_${kind}_walk`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96);
      });
    }
    try {
      document.body.style.backgroundColor = '#14100c';
      document.body.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(20,16,12,0) 40%, rgba(8,6,4,0.82) 100%)';
      document.body.style.backgroundSize = '100% 100%';
    } catch {
      // ignore
    }
    // Filter by content: nearest for sprite atlases, linear for downsampled terrain.
    // Text textures created later retain linear filtering for legible small Chinese text.
    for (const key of this.textures.getTextureKeys()) {
      this.textures.get(key).setFilter((key.startsWith('ground') && !key.startsWith('ground_overhaul')) || key === 'shadow'
        ||key.startsWith('epic_') ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    }
    for(const key of ['huaxiong_walk','huaxiong_attack']){if(!this.textures.exists(key))continue;const t=this.textures.get(key);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)if(!t.has(dir+'_'+col))t.add(dir+'_'+col,0,col*128,row*128,128,128);});}
    createReadableTextures(this);
    const hint = document.getElementById('boot-hint');
    if (hint) hint.style.display = 'none';
    this.registry.set('battleReady',true);
    this.registry.set('battleTextureKeys',this.textures.getTextureKeys().filter(k=>!k.startsWith('__')&&!k.startsWith('ui_war_')&&k!=='art_panel'&&k!=='icon_guandao'));
    if(import.meta.env.DEV&&new URLSearchParams(location.search).get('dev')==='1'&&new URLSearchParams(location.search).has('thirdStage')){this.scene.start('ThirdChapterScene');}else if(this.registry.get('pendingThird')){this.registry.remove('pendingThird');this.scene.start('ThirdChapterScene');}else this.scene.start('MenuScene');
  }
}
