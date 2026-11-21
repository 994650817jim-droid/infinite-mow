import { shouldPlayOpening } from '../systems/BattleSettings';
import { FIREPIT_ART } from '../data/fireProps';
import { TACTIC_ICON_ALIAS, SCHOOL_IDS } from '../data/schools';
import { LEAN_BOOT } from '../systems/LeanBoot';
import { loadScreen } from '../ui/LoadScreen';
let openingTried = false;
import { BOOT_TO_KEY } from '../systems/BattleSnapshot';
import {loadWarnFx} from '../ui/WarnFx';
import {HOME_ART_HEROES} from '../data/characters';
import {GROWTH_ICON_IDS} from '../ui/GrowthIcons';
import {BRANCH_ICON_READY} from '../data/weaponBranches';
import {TACTICS,TREASURES} from '../data/builds';
import {loadWorld,worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {createReadableTextures} from '../systems/ReadableTextures';
import { GAME_WIDTH } from '../config';
import { createGameTextures, createWalkPlaceholders, registerWalkSheet } from '../systems/TextureFactory';
import { HERO_ACTION_FILES } from '../data/heroActions';
import { applyHdHeroSheets } from '../systems/HdHeroSheets';
import { warmIffTextures } from '../systems/IffOverlay';
import { DRAG_ART_FILES } from '../data/dragArt';
import { loadSkillFx } from '../systems/SkillFxSheets';
import { loadEnvGround } from '../systems/EnvGround';
import { applyPropsV2, loadPropsV2 } from '../systems/PropsV2';
import { RENDER_SCALE } from '../config';
import { artStyle, v2Filter } from '../systems/ArtStyle';
import { applyArtStyleUrls, applyV2TroopFrames, isV2Texture, rotateV2StandFrames } from '../systems/ArtStyle';

export class BootScene extends Phaser.Scene {
  private shellOnly=false;
  /** 手机精简启动：首次只载入主页 / 界面资源，战斗图集等进战斗时再载入（见 systems/LeanBoot.ts），避免一次性解码几百张图撑爆 iOS 页面内存。 */
  private lean=false;
  /** 本遍加载里失败的文件键（loaderror）；create() 里据此自动重试 / 提示（2026-11-20 首屏加载优化）。 */
  private bootFailed:string[]=[];private bootTotal=0;
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const lean=this.lean=LEAN_BOOT&&!this.registry.get('loadBattle')&&!this.registry.get('battleReady');
    // 加载画面：水墨底 + 一行字 + 细金线进度（ui/LoadScreen）；开机叫「正在进入乱世」，进关叫「整军出征」
    this.bootFailed=[];loadScreen.show(this.registry.get('loadBattle')&&!this.registry.get('battleReady')?'整军出征':'正在进入乱世');
    const onProgress=(p:number):void=>loadScreen.progress(p),onError=(f:Phaser.Loader.File):void=>{this.bootFailed.push(String(f.key));};
    this.load.on('progress',onProgress);this.load.on('loaderror',onError);this.load.once('complete',(_l:unknown,ok:number,bad:number)=>{this.bootTotal=(ok??0)+(bad??0);this.registry.set('bootTotalMax',Math.max(this.bootTotal,Number(this.registry.get('bootTotalMax')??0)));this.load.off('progress',onProgress);this.load.off('loaderror',onError);});
    if(!lean)this.load.spritesheet('build_vfx','assets/build-vfx/styles-hp-v1.png',{frameWidth:128,frameHeight:128});   // 手绘版（2026-11-19，原 styles-ai-v1.png 是 64px 像素风；行序不变，后面多 8 个额外样式）
    // 特效型警示序列帧（src/ui/WarnFx.ts；缺图时首领招式退回细虚线 / 无提示）
    if(!lean){loadWarnFx(this.load); // 手绘版优先，缺图的种类退回像素版
    this.load.spritesheet('refined_spear','assets/combat-refined/spear-sequence.png',{frameWidth:384,frameHeight:64});
    this.load.spritesheet('refined_impact','assets/combat-refined/impact-sequence.png',{frameWidth:64,frameHeight:64});}
    // 军功信物手绘图（2026-11-18，data/gemFx.ts）：青铜古钱 / 金令牌各 4 帧高光，gem_fx 拾取闪光 + 光晕
    if(!lean){this.load.spritesheet('gem_tok_small','assets/gems/gem_tok_small.png',{frameWidth:64,frameHeight:64});
    this.load.spritesheet('gem_tok_large','assets/gems/gem_tok_large.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('gem_fx','assets/gems/gem_fx.png',{frameWidth:128,frameHeight:128});}
    // 三选一 / 增益栏图标：2026-11-14 起使用 ChatGPT 生成的厚涂图标（assets/upgrade-icons，tools/build-upgrade-icons.mjs 切图）；
    // 旧像素图标仍保留在 growth-icons / build 目录，未被删除。
    if(!lean)for(const id of GROWTH_ICON_IDS)this.load.image('growth_icon_'+id,'assets/upgrade-icons/'+id+'.webp');
    // 兵器专职分支卡面图标（ChatGPT 手绘，tools/prepare-branch-icons.py）：只载已出图的（BRANCH_ICON_READY）
    if(!lean)for(const id of BRANCH_ICON_READY)this.load.image('branch_icon_'+id,'assets/upgrade-icons/branch_'+id+'.webp');
    if(!lean)for(const id of [...Object.keys(TACTICS),...Object.keys(TREASURES)])this.load.image('build_icon_'+id,'assets/upgrade-icons/'+(TACTIC_ICON_ALIAS[id]??id)+'.webp'); // 流派重做新战法第 1 期借现有图标（火油罐 → 燎原灯、疾风 → 镇军盘），第 3 期出新图
    if(!lean){for(const sc of SCHOOL_IDS)this.load.image('build_icon_school_'+sc,'assets/schools/seal_'+sc+'.png');this.load.image('school_banner_combo','assets/schools/banner_combo.png');this.load.image('school_banner_awaken','assets/schools/banner_awaken.png');} // 流派重做第 3 期：六派徽印、合击 / 觉醒横幅
    // 水墨按钮底板（ChatGPT 生成，tools/prepare-button-art.mjs 切图）；homeCommand 有图即用，缺图退回程序画底板
    // 成就图标（解锁提示与成就面板用，约 200 KB）
    for(const id of ['first_win','zhangjiao','lubu','qunxiong','guandu','kills_1000','kills_10000','level_20','all_heroes','chaser','first_siege','cities_5','luoyang','defense','focus','town_build','town_all','town_lv3','money_500','caravan','events_10','year_190','potions_10','reserve_20'])this.load.image('ach_'+id,'assets/achievements/'+id+'.webp');
    // 兵装道具图标图集（帧名 = 道具 id）与战场宝箱 3 帧（ChatGPT 生成，tools/prepare-item-icons.mjs 切图）；缺图时 ItemQuality 退回程序化剪影
    this.load.atlas('item_icons','assets/items/item-icons.webp','assets/items/item-icons.json');
    this.load.spritesheet('item_chest','assets/items/item-chest.webp',{frameWidth:96,frameHeight:80});
    for(const n of ['primary-normal','primary-hover','primary-pressed','secondary-normal','secondary-hover','secondary-pressed','disabled'])this.load.image('btn_ink_'+n.replace('-','_'),'assets/ui-buttons/'+n+'.webp');
    const params=new URLSearchParams(window.location.search);
    this.shellOnly=false;
    if(this.shellOnly){if(!this.textures.exists('art_panel'))this.load.image('art_panel','assets/processed/overhaul/bronze-panel-mobile.png');return;}
    const homeSave=loadWorld(),homeChapter=homeSave.yellowStages>=3||homeSave.cleared.huangjin||homeSave.legacyHulaoAccess?'dongzhuo':'huangjin';
    const homeLayout=GAME_WIDTH>600?'desktop':'mobile';
    this.load.image('epic_bg_'+homeChapter+'_'+homeLayout,'assets/epic-home/'+homeChapter+'-'+homeLayout+'.webp');
    let homeHero='zhaoyun';try{const id=localStorage.getItem('im_last_hero');if(id&&['zhaoyun','guanyu','huangzhong','zhuge','zhangfei','huangyueying','pangtong','liubei','weiyan','machao','sunshangxiang','diaochan'].includes(id))homeHero=id;}catch{}
    if(HOME_ART_HEROES.includes(homeHero))this.load.image('epic_hero_'+homeHero,'assets/epic-home/'+homeHero+'.webp');
    // 武将卡立轴（生成美术）：外框、宣纸与当前武将的水墨立绘
    this.load.image('title_wordmark','assets/ui/title_wordmark.webp');this.load.image('ink_frame','assets/ink-scroll/frame.webp');this.load.image('ink_paper','assets/ink-scroll/paper.webp');
    if(HOME_ART_HEROES.includes(homeHero))this.load.image('ink_hero_'+homeHero,'assets/ink-scroll/'+homeHero+'.webp');
    if(lean){ // 手机精简启动到此为止：另外只带上主页 / 选将 / 章节卡会用到的小图（立绘头像、章节首领小像），走同一套 v2 画风换图
      this.load.image('rest_camp','assets/world/rest-camp.webp');this.load.image('hero_zhaoyun','assets/processed/hero_zhaoyun.png');
      this.load.image('portrait_zhuge','assets/processed/portrait_zhuge.png');
      for(const id of ['huangzhong','guanyu','machao','weiyan','liubei','pangtong','huangyueying','sunshangxiang','diaochan','zhangfei','lvbu','zhangliao','zhouyu','taishici','mengde','ganning','dianwei','sunquan','menghuo','zhurong'])this.load.image(id+'_portrait','assets/processed/'+id+'_portrait.png');
      this.load.image('huaxiong_portrait','assets/phase17/huaxiong/portrait.png');
      this.load.spritesheet('xurong','assets/phase17/xurong/sheet.png',{frameWidth:128,frameHeight:128});
      this.load.spritesheet('boss_lubu','assets/processed/hulao/lubu-walk.png',{frameWidth:256,frameHeight:256});
      applyArtStyleUrls(this.load);return;
    }
    // Menu fallback and rest screens share the rest_camp texture allocation.
    // Both formal west stages can be selected after this boot; preload their existing atlases once.
    this.load.spritesheet('xurong','assets/phase17/xurong/sheet.png',{frameWidth:128,frameHeight:128});
    this.load.image('xingyang_ground','assets/phase17/xurong/ground.png');
    for(const key of ['walk','attack','actions','sweep'])this.load.spritesheet('huaxiong_'+key,'assets/phase17/huaxiong/'+key+'.png',{frameWidth:128,frameHeight:128});
    this.load.image('huaxiong_portrait','assets/phase17/huaxiong/portrait.png');
    this.load.spritesheet('sishui_props','assets/phase17/huaxiong/props.png',{frameWidth:256,frameHeight:256});
    // 首领遗珍「黄巾力士」专用手绘图（2026-11-18：和敌方黄巾区分）：行走 / 攻击（v2 兵种规格）、符阵光圈 + 化符序列帧（黑底叠加）、「力」字符牌
    this.load.spritesheet('lishi_walk','assets/processed-v2/troops/lishi_walk.png',{frameWidth:160,frameHeight:160});
    this.load.spritesheet('lishi_attack','assets/processed-v2/troops/lishi_attack.png',{frameWidth:208,frameHeight:208});
    this.load.spritesheet('lishi_fx','assets/relic-fx/lishi_fx.jpg',{frameWidth:256,frameHeight:256});
    this.load.image('lishi_tag','assets/relic-fx/lishi_tag.png');
    for(const key of ['zhangliang_walk','zhangliang_attack','zhangbao_walk','zhangbao_cast','spear_walk','spear_attack','archer_walk','archer_attack','shield_walk','shield_attack','shaman_walk','shaman_cast'])this.load.spritesheet(`yellow_${key}`,`assets/processed/yellow/${key==='spear_walk'?'spear-walk-v2':key==='spear_attack'?'spear-attack-v2':key}.png`,{frameWidth:96,frameHeight:96});
    // 黄巾长枪兵 v5：128 帧、行走 / 刺击同一比例（tools/prepare-yellow-spear.mjs）
    for(const key of ['spear-walk-v5','spear-attack-v5'])this.load.spritesheet(`yellow_${key}`,`assets/processed/yellow/${key}.png`,{frameWidth:128,frameHeight:128});
    for(const key of ['swordsman-walk-v4','swordsman-attack-v4','shield-walk-v4','shield-attack-v4','spear-walk-v2'])this.load.spritesheet(`yellow_${key}`,`assets/processed/yellow/${key}.png`,{frameWidth:96,frameHeight:96});
    if(!this.textures.exists(FIREPIT_ART.key))this.load.spritesheet(FIREPIT_ART.key,FIREPIT_ART.file,{frameWidth:FIREPIT_ART.cell,frameHeight:FIREPIT_ART.cell}); // 篝火燃烧 8 帧（战场石圈篝火也用）
    for(const [key,file] of [['brazier_burning','brazier_burning-v4.png'],['brazier_breaking','brazier_breaking-v4.png'],['ground_fire','ground_fire-v4.png']] as const)this.load.spritesheet(key,`assets/processed/yellow/${file}`,{frameWidth:444,frameHeight:444});
    for(let i=1;i<=3;i++)this.load.image(`yellow_ground_${i}`,`assets/processed/yellow/ground-${i}.png`);
    for(const key of ['yellow_shaman_ground_sigil_warning','zhangbao_earth_rift_warning_and_burst','zhangbao_earth_shockwave','zhangbao_earth_wall_spawn','zhangbao_ritual_circle','zhangliang_call_reinforcements','zhangliang_charge_warning','zhangliang_slash','yellow_archer_arrow','yellow_shield_short_stab'])this.load.spritesheet(key,`assets/processed/yellow/${key}.png`,{frameWidth:128,frameHeight:128});
    this.load.spritesheet('yellow_props','assets/processed/yellow/camp-props.png',{frameWidth:128,frameHeight:128});
    // 战场回血道具（酒罐 / 药篓 / 酒葫芦 / 草药包），tools/prepare-heal-props.mjs 生成
    this.load.spritesheet('heal_props','assets/heal-props/heal_props.png',{frameWidth:128,frameHeight:128});
    // 回血药手绘药罐（由 troop-portraits-v2/potion_card.png 缩成 128px）：用药按钮、地上的药、药囊图标；替代程序画的像素药瓶
    this.load.image('potion_jar','assets/heal-props/potion_jar.webp');
    // 战场回血（systems/BattleHeal，美术会话 ChatGPT 出图、洋红抠底）：heal_food 0 干粮 / 1 酒肉；heal_spot_herb 药草丛 0 茂盛 / 1 采过（256 格）
    this.load.spritesheet('heal_food','assets/heal-props/heal_food.png',{frameWidth:256,frameHeight:256});
    this.load.spritesheet('heal_spot_herb','assets/heal-props/herb_patch.png',{frameWidth:256,frameHeight:256});
    // 首领招降档位印（手绘朱印，Gemini 生成后白底抠透明）：可降 / 难降 / 宁死不降 + 降将栏「首领」小印
    for(const k of ['can','hard','never','boss'])this.load.image('seal_'+k,'assets/ui-seals/seal_'+k+'.png');
    // 军令圆钮图标（电脑版 HUD「护阵 / 出击」，沿用手绘增益图标）
    this.load.image('hud_order_guard','assets/upgrade-icons/deflect.webp');this.load.image('hud_order_sortie','assets/upgrade-icons/pursuit.webp');
    this.load.spritesheet('yellow_contact_shadow','assets/processed/yellow/camp-props-contact-shadows-v1.png',{frameWidth:128,frameHeight:128});
    for(const key of ['zhang_bao_altar','zhang_jiao_altar'])this.load.image(key,`assets/processed/yellow/${key}.png`);
    this.load.spritesheet('prop_debris','assets/processed/yellow/prop-debris.png',{frameWidth:96,frameHeight:96});
    this.load.spritesheet('prop_break_fx','assets/processed/yellow/prop-break-fx.png',{frameWidth:96,frameHeight:96});
    this.load.image('yellow_arrow','assets/processed/yellow/arrow-tight.png');
    this.load.image('rest_camp','assets/world/rest-camp.webp');
    // 第一章通关剧情「中山商旅 · 献马」专属插画（缺图时剧情卷轴退回 rest_camp 横幅）
    this.load.image('story_merchant_horse','assets/story/merchant_horse.webp');
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
    // 人物画风 v2：张角另有行走 / 施法方向表（v1 没有，只有一张静态图）；占位 URL 由 applyArtStyleUrls 换成 v2 文件
    if (isV2Texture('zhangjiao_walk')) for (const key of ['zhangjiao_walk', 'zhangjiao_cast']) this.load.image(key, 'assets/processed/boss_zhangjiao.png');
    this.load.image('ground_ai', 'assets/processed/ground_ai.png');
    this.load.image('ground_ai2', 'assets/processed/ground_ai2.png');
    this.load.spritesheet('hero_walk_sheet', 'assets/processed/hero_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('guanyu_walk_sheet', 'assets/processed/guanyu_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('machao_walk_sheet', 'assets/processed/machao_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('weiyan_walk_sheet', 'assets/processed/weiyan_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('liubei_walk_sheet', 'assets/processed/liubei_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('pangtong_walk_sheet', 'assets/processed/pangtong_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('huangyueying_walk_sheet', 'assets/processed/huangyueying_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('sunshangxiang_walk_sheet', 'assets/processed/sunshangxiang_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('diaochan_walk_sheet', 'assets/processed/diaochan_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zhangfei_walk_sheet', 'assets/processed/zhangfei_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    // P2 吕布：只有 v2 行走图（4×4、每格 176）
    this.load.spritesheet('lvbu_walk_sheet', 'assets/processed-v2/lvbu_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('zhangliao_walk_sheet', 'assets/processed-v2/zhangliao_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('zhouyu_walk_sheet', 'assets/processed-v2/zhouyu_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('taishici_walk_sheet', 'assets/processed-v2/taishici_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('mengde_walk_sheet', 'assets/processed-v2/mengde_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('ganning_walk_sheet', 'assets/processed-v2/ganning_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('dianwei_walk_sheet', 'assets/processed-v2/dianwei_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('sunquan_walk_sheet', 'assets/processed-v2/sunquan_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('menghuo_walk_sheet', 'assets/processed-v2/menghuo_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    this.load.spritesheet('zhurong_walk_sheet', 'assets/processed-v2/zhurong_walk_sheet.png', { frameWidth: 176, frameHeight: 176 });
    // P3 孟获「驱兽冲阵」：借第十一章南中猛兽 / 象兵行走图（另起键，不和章节里按 v2 帧名切的同一张图撞）
    this.load.spritesheet('mh_beast_sheet', 'assets/processed-v2/enemies/enemy_beast_walk.png', { frameWidth: 144, frameHeight: 144 });
    this.load.spritesheet('mh_elephant_sheet', 'assets/processed-v2/enemies/nz_elephant_walk.png', { frameWidth: 176, frameHeight: 176 });
    this.load.image('dianwei_halberd', 'assets/allies-v2/dianwei_halberd.png'); // P3 典韦掷戟（随军典韦同一张）
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
    // 武将动作图集（HERO_ACTIONS_PLAN.md）：128×128，4 列 × 7 行
    for (const [key, url] of Object.entries(HERO_ACTION_FILES)) this.load.spritesheet(key, url, { frameWidth: 128, frameHeight: 128 });
    // 我方士兵倒地帧（AllyCorpses）：4 兵种 × 4 帧，128×128
    for (const id of ['a', 'b']) this.load.spritesheet(`troop_deaths_${id}`, `assets/troop-deaths/troop_deaths_${id}.png`, { frameWidth: 128, frameHeight: 128 });
    // 诸葛亮「烈焰战旗」：战旗、八卦火阵预警地纹、6 帧爆炸（tools/prepare-flame-banner-art.mjs）
    this.load.image('zhuge_banner', 'assets/flame-banner/zhuge_banner.png');
    this.load.image('fire_sigil', 'assets/flame-banner/fire_sigil.png');
    for (const sheet of ['a', 'b', 'c', 'd']) this.load.spritesheet('hero_fx_' + sheet, 'assets/hero-fx/fx_' + sheet + '.png', { frameWidth: 256, frameHeight: 256 });
    // 魏延「谁敢杀我」6 向裂波：手绘透明序列帧（2026-11-17 Gemini 出图，替换程序画地裂纹），6 帧竖排，每帧 1024×256
    this.load.spritesheet('weiyan_crack', 'assets/hero-fx/weiyan_crack.png', { frameWidth: 1024, frameHeight: 256 });
    // 庞统火雷与连环铁链贴图（ChatGPT 生成，tools/prepare-weiyan-pangtong-icons.mjs 切出）
    this.load.image('pangtong_mine', 'assets/hero-fx/pangtong_mine.png'); this.load.image('pangtong_chain', 'assets/hero-fx/pangtong_chain.png');
    // 庞统铁索连环手绘特效（2026-11-17 替换原像素图集 pangtong_fx，旧文件保留不再加载）：
    //  pangtong_paint 6×4 每帧 256：火雷爆炸 / 沿索火苗 / 地火 / 雷芯闪；pangtong_chain_hot 6 帧每帧 1024×130：烧红铁索平铺
    this.load.spritesheet('pangtong_paint', 'assets/hero-fx/pangtong_paint.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('pangtong_chain_hot', 'assets/hero-fx/pangtong_chain_hot.png', { frameWidth: 1024, frameHeight: 130 });
    // 黄忠神射像素特效（6×4，每帧 256，黑底叠加）：神射爆裂 / 进入神射金光 / 神射箭拖光 / 宝刀未老；缺图时退回程序化过渡
    // 2026-11-17 换成手绘 huangzhong_paint（Gemini 出图，行序不变：神射爆裂 / 进入神射光柱 / 神射箭拖光 / 宝刀未老火焰），旧像素图 huangzhong_fx 保留不再加载
    this.load.spritesheet('huangzhong_paint', 'assets/hero-fx/huangzhong_paint.png', { frameWidth: 256, frameHeight: 256 });
    // 被动满层战吼像素特效（2 行 × 6 帧，每帧 256×512，黑底叠加）：脚下声浪冲击 / 身上迸发的气势
    // 2026-11-17 换成手绘 warcry_paint（Gemini 出图），旧像素图 warcry_fx 保留不再加载
    this.load.spritesheet('warcry_paint', 'assets/hero-fx/warcry_paint.png', { frameWidth: 256, frameHeight: 512 });
    // 赵云被动「七进七出」手绘特效（2026-11-18 ChatGPT 出图，黑底叠加；说明见 src/data/zhaoyunFx.ts）
    this.load.spritesheet('zhaoyun_scales', 'assets/hero-fx/zhaoyun_scales.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('zhaoyun_thrust', 'assets/hero-fx/zhaoyun_thrust.png', { frameWidth: 384, frameHeight: 384 });
    this.load.spritesheet('zhaoyun_aura', 'assets/hero-fx/zhaoyun_aura.png', { frameWidth: 256, frameHeight: 256 });
    // 其余 11 将脚下被动刻度（2026-11-18 用户「每个角色都加类似于赵云脚下那个被动」；说明见 src/data/passiveGauge.ts）
    this.load.spritesheet('passive_gauge_a', 'assets/hero-fx/passive_gauge_a.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('passive_gauge_b', 'assets/hero-fx/passive_gauge_b.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('passive_gauge_c', 'assets/hero-fx/passive_gauge_c.png', { frameWidth: 128, frameHeight: 128 });
    // 马超虎头湛金枪手绘特效（6×4，每帧 256，透明底；2026-11-17 Gemini 出图替换原像素图集 machao_fx，旧文件保留不再加载）：上挑弧光 / 落地砸地 / 冲锋尘土拖影 / 枪尖破风
    this.load.spritesheet('machao_paint', 'assets/hero-fx/machao_paint.png', { frameWidth: 256, frameHeight: 256 });
    // 2026-11-16 专属武器贴图（tools/prepare-hero-icon-sheet.mjs 切出）与执刀侍婢行走图
    for (const k of ['sun_knife', 'diaochan_fan', 'huangzhong_arrow', 'charm_heart', 'charm_broken', 'zhangfei_spear']) this.load.image(k, 'assets/hero-fx/' + k + '.png');
    this.load.spritesheet('sun_maid_walk', 'assets/hero-fx/sun_maid_walk.png', { frameWidth: 96, frameHeight: 96 });
    // 武将小特效手绘图集（2026-11-17 Gemini 出图，6×3 每帧 256，透明底叠加）：侍婢刀光 / 刘备仁德金光 / 诸葛亮火星聚拢；替换像素 sun_maid_slash（旧文件保留不再加载）与程序画光圈、火星
    this.load.spritesheet('hero_small_paint', 'assets/hero-fx/hero_small_paint.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('flame_burst', 'assets/flame-banner/flame_burst.png', { frameWidth: 256, frameHeight: 256 });
    // 诸葛亮七星灯 · 天火手绘序列帧（2026-11-18 Gemini 黑底出图，tools/build-zhuge-tianhuo-fx.mjs）：8×3 每帧 256（星位 / 天火落下 / 八阵图）+ 东风火龙横条 6 帧 512×128
    this.load.spritesheet('zhuge_tianhuo', 'assets/hero-fx/zhuge_tianhuo.png', { frameWidth: 256, frameHeight: 256 }); this.load.spritesheet('zhuge_eastwind', 'assets/hero-fx/zhuge_eastwind.png', { frameWidth: 512, frameHeight: 128 });
    this.load.spritesheet('zhuge_ember', 'assets/hero-fx/zhuge_ember.png', { frameWidth: 256, frameHeight: 256 }); // 天火余烬「星火焦土」8 帧（2026-11-18 晚，即梦手绘）
    this.load.spritesheet('zhuge_wind', 'assets/hero-fx/zhuge_wind.png', { frameWidth: 512, frameHeight: 128 }); // 借东风「东风气流」8 帧（2026-11-18 晚，即梦手绘）
    this.load.image('portrait_zhuge', 'assets/processed/portrait_zhuge.png');
    this.load.image('spear_thrust', 'assets/processed/spear_thrust.png');
    this.load.spritesheet('guandao_slash_sheet', 'assets/processed/guandao_slash_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('huangzhong_portrait', 'assets/processed/huangzhong_portrait.png');
    this.load.image('guanyu_portrait', 'assets/processed/guanyu_portrait.png');
    this.load.image('machao_portrait', 'assets/processed/machao_portrait.png');
    this.load.image('weiyan_portrait', 'assets/processed/weiyan_portrait.png');
    this.load.image('liubei_portrait', 'assets/processed/liubei_portrait.png');
    this.load.image('pangtong_portrait', 'assets/processed/pangtong_portrait.png');
    this.load.image('huangyueying_portrait', 'assets/processed/huangyueying_portrait.png');
    this.load.image('sunshangxiang_portrait', 'assets/processed/sunshangxiang_portrait.png');
    this.load.image('diaochan_portrait', 'assets/processed/diaochan_portrait.png');
    this.load.image('zhangfei_portrait', 'assets/processed/zhangfei_portrait.png');
    this.load.image('lvbu_portrait', 'assets/processed/lvbu_portrait.png');
    this.load.image('zhangliao_portrait', 'assets/processed/zhangliao_portrait.png');
    this.load.image('zhouyu_portrait', 'assets/processed/zhouyu_portrait.png');
    this.load.image('taishici_portrait', 'assets/processed/taishici_portrait.png');
    this.load.image('mengde_portrait', 'assets/processed/mengde_portrait.png');
    this.load.image('ganning_portrait', 'assets/processed/ganning_portrait.png');
    this.load.image('dianwei_portrait', 'assets/processed/dianwei_portrait.png');
    this.load.image('sunquan_portrait', 'assets/processed/sunquan_portrait.png');
    this.load.image('menghuo_portrait', 'assets/processed/menghuo_portrait.png');
    this.load.image('zhurong_portrait', 'assets/processed/zhurong_portrait.png');
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
    // 本命武器 / 通用被动 / 稀有：新厚涂图标（程序化 icon_* 在已存在时不会再生成）
    for(const [key,id] of [['icon_1','weapon_spear'],['icon_2','weapon_crossbow'],['icon_3','weapon_flame'],['icon_guandao','weapon_guandao'],['icon_zhenbei','weapon_zhenbei'],['icon_lianhuan','weapon_lianhuan'],['icon_sunknives','weapon_sunknives'],['icon_fans','weapon_fans'],['icon_baodiao','weapon_baodiao'],['icon_shemao','weapon_shemao'],['icon_zhanjin','weapon_zhanjin'],['icon_shuanggu','weapon_shuanggu'],['icon_fangtian','weapon_fangtian'],['icon_pozhen','weapon_pozhen'],['icon_zhiti','zhiti'],['icon_huochuan','weapon_huochuan'],['icon_dongfeng','dongfeng'],['icon_donglai','weapon_donglai'],['icon_yitian','weapon_yitian'],['icon_jinfan','weapon_jinfan_gou'],['icon_tieji','weapon_shuang_tieji'],['icon_guding','weapon_guding_dao'],['icon_nanman','weapon_nanman_dao'],['icon_huoyan','weapon_huoyan_feiqiang'],['icon_wushuang','wushuang'],['icon_passive','passive'],['icon_rare','rare']] as const)this.load.image(key,'assets/upgrade-icons/'+id+'.webp');
    // 人物画风 v2（?art=v2）：有新图的图集换成 v2 文件，键名不变
    applyArtStyleUrls(this.load);
    // 关羽拖刀斩专属图（拖刀行走 / 拖刀上撩，src/data/dragArt.ts）：只在 v2 画风、且已登记文件时加载
    if (artStyle() === 'v2') for (const [key, file] of Object.entries(DRAG_ART_FILES)) this.load.image(key, file);
    // 技艺 / 战法手绘特效序列帧（拖刀斩、迂回袭、踏风步；public/assets/skill-fx/）
    loadSkillFx(this.load);
    // 场地环境互动 v2 道具（火油桶 / 四势力军旗 / 营帐 / 塌营帐，4×4、256 格）
    this.load.spritesheet('env_props', 'assets/env-v2/props.png', { frameWidth: 256, frameHeight: 256 });
    // 地面与道路 v2（第二～五章）
    loadEnvGround(this.load);
    // 障碍物 / 道具 v2（黄巾营地、关隘营寨三势力、回血道具、第二章地面装饰、火盆与碎裂序列帧）；缺图沿用旧图
    loadPropsV2(this.load);
  }

  create(): void {
    // 有文件没载上：自动重试两遍（已载入的键 Phaser 会跳过，只补缺的）；还不行就提示后继续——缺的图各处都有备用画面，不让玩家卡在加载页；大半都失败（多半断网）则停在加载页给「重试」
    if(this.bootFailed.length){
      const n=Number(this.registry.get('bootRetry')??0),total=Math.max(1,this.bootTotal,Number(this.registry.get('bootTotalMax')??0)),bad=this.bootFailed.length;
      if(n<2){this.registry.set('bootRetry',n+1);loadScreen.note(`有 ${bad} 个素材没载上，正在重试（${n+1}/2）…`);this.time.delayedCall(900,()=>this.scene.restart());return;}
      this.registry.set('bootRetry',0);this.registry.set('bootTotalMax',0);
      if(bad>total*.5){loadScreen.fail(`素材大多没载上（${bad}/${total}），请检查网络后重试。`,()=>this.scene.restart());return;}
      loadScreen.note(`有 ${bad} 个素材没能载入，已用备用画面继续。`);console.warn('[Boot] 未载入的素材：',this.bootFailed.slice(0,30).join(', '));
    }else{this.registry.set('bootRetry',0);this.registry.set('bootTotalMax',0);}
    if(this.shellOnly){const hint=document.getElementById('boot-hint');if(hint)hint.style.display='none';this.scene.start('CityScene');return;}
    if(this.lean){
      // 手机精简启动：只载入了主页 / 界面资源。设好过滤方式就进主页；战斗图集到进战斗时再载入（systems/LeanBoot.ts 拦截战斗场景的启动）
      for(const key of this.textures.getTextureKeys())this.textures.get(key).setFilter((key.startsWith('ground')&&!key.startsWith('ground_overhaul'))||key==='shadow'||key.startsWith('epic_')||key.startsWith('growth_icon_')||key.startsWith('build_icon_')?Phaser.Textures.FilterMode.LINEAR:Phaser.Textures.FilterMode.NEAREST);
      const hint=document.getElementById('boot-hint');if(hint)hint.style.display='none';
      this.registry.set('battleReady',false);
      this.registry.set('shellTextureKeys',this.textures.getTextureKeys()); // 回主页卸载战斗图集时保留这些（LeanBoot）
      this.goNext();return;
    }
    applyPropsV2(this.textures);
    for(const key of ['zhangliang_walk','zhangliang_attack','zhangbao_walk','zhangbao_cast','spear_walk','spear_attack','archer_walk','archer_attack','shield_walk','shield_attack','shaman_walk','shaman_cast']){
      const tex=this.textures.get(`yellow_${key}`);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)tex.add(`${dir}_${col}`,0,col*96,row*96,96,96);});
    }
    for(const key of ['swordsman-walk-v4','swordsman-attack-v4','shield-walk-v4','shield-attack-v4','spear-walk-v2']){
      const tex=this.textures.get(`yellow_${key}`);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)tex.add(`${dir}_${col}`,0,col*96,row*96,96,96);});
    }
    for(const key of ['spear-walk-v5','spear-attack-v5']){const tex=this.textures.get(`yellow_${key}`);['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)tex.add(`${dir}_${col}`,0,col*128,row*128,128,128);});}
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
      const texture = this.textures.get(key), n = ((texture.getSourceImage() as {width?: number}).width ?? 1024) / 4; // v1 256 格，v2 288 格
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * n, row * n, n, n);
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
        ||key.startsWith('epic_')
        // 厚涂图标（128px 缩到约 52px 显示）用线性过滤，避免锯齿
        ||key.startsWith('growth_icon_')||key.startsWith('build_icon_')||(key.startsWith('icon_shu_')&&isV2Texture(key))||/^icon_(1|2|3|guandao|passive|rare)$/.test(key) ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    }
    for(const key of ['huaxiong_walk','huaxiong_attack']){if(!this.textures.exists(key))continue;const t=this.textures.get(key),n=((t.getSourceImage() as {width?:number}).width??512)/4;['down','left','right','up'].forEach((dir,row)=>{for(let col=0;col<4;col++)if(!t.has(dir+'_'+col))t.add(dir+'_'+col,0,col*n,row*n,n,n);});}
    createReadableTextures(this);
    applyHdHeroSheets(this, ['hero_walk_sheet', ...Object.keys(HERO_ACTION_FILES).map(k => k.replace(/_actions$/, '_walk_sheet'))], Object.keys(HERO_ACTION_FILES));
    // 人物画风 v2：武将行走图的停步帧换成双脚并拢的那一帧（见 rotateV2StandFrames）
    for (const key of ['hero_walk_sheet', ...Object.keys(HERO_ACTION_FILES).map(k => k.replace(/_actions$/, '_walk_sheet'))]) rotateV2StandFrames(this, key);
    // 人物画风 v2：兵种图集按 v2 格子重切帧（旧的 96 / 128×112 切法会切错）
    applyV2TroopFrames(this);
    // 拖刀图切帧：行走 4×4（下 / 左 / 右 / 上），上撩 1 行 4 帧（'0'..'3'）
    for (const key of Object.keys(DRAG_ART_FILES)) {
      if (!this.textures.exists(key)) continue;
      const t = this.textures.get(key), src = t.getSourceImage() as { width: number; height: number }, cell = src.width / 4, walk = key.includes('_walk_');
      if (walk) ['down', 'left', 'right', 'up'].forEach((d, r) => { for (let c = 0; c < 4; c++) if (!t.has(`${d}_${c}`)) t.add(`${d}_${c}`, 0, c * cell, r * cell, cell, cell); });
      else for (let c = 0; c < 4; c++) if (!t.has(String(c))) t.add(String(c), 0, c * cell, 0, cell, src.height);
      t.setFilter(v2Filter(RENDER_SCALE));
    }
    const hint = document.getElementById('boot-hint');
    if (hint) hint.style.display = 'none';
    this.registry.set('battleReady',true);
    // 敌我区分：部曲 / 敌军换色（与描边）贴图在浏览器空闲时逐张预生成，进战斗时不再卡顿
    warmIffTextures(this.game);
    // 界面通用贴图（水墨按钮、小镇美术）常驻，不随战斗图集卸载。
    // 营寨自己的手绘图（city_* / camp_*，CityScene 载入）也不记进来：2026-11-18 用户「打完一关之后再回去营寨……出现bug」——原来营寨图被当战斗图集卸掉，回营寨退回程序画占位
    this.registry.set('battleTextureKeys',this.textures.getTextureKeys().filter(k=>!/^(city_|camp_)/.test(k)&&!k.startsWith('__')&&!k.startsWith('ui_war_')&&!k.startsWith('btn_ink_')&&!k.startsWith('town_')&&!k.startsWith('ach_')&&k!=='art_panel'&&k!=='icon_guandao'));
    this.goNext();
  }
  /** 启动后去哪：测试入口 / 待进的战斗 / 开场 / 主页 / 天下地图。 */
  private goNext():void{
    loadScreen.hide();
    if(import.meta.env.DEV&&new URLSearchParams(location.search).get('dev')==='1'&&new URLSearchParams(location.search).has('thirdStage')){this.scene.start('ThirdChapterScene');}else if(this.registry.get('pendingThird')){this.registry.remove('pendingThird');this.scene.start('ThirdChapterScene');}else if(this.registry.get('pendingWarlord')){const key=String(this.registry.get('pendingWarlord'));this.registry.remove('pendingWarlord');const pd=this.registry.get('pendingBattleData');this.registry.remove('pendingBattleData');this.scene.start(key,pd);}else{let to:string|null=null;try{to=sessionStorage.getItem(BOOT_TO_KEY);sessionStorage.removeItem(BOOT_TO_KEY);}catch{/* 存储不可用 */}const opening=!openingTried&&!to&&shouldPlayOpening();openingTried=true;this.scene.start(to==='WorldMapScene'&&worldUnlocked()?'WorldMapScene':opening?'OpeningScene':'MenuScene');} /* 开场动画：每页只在第一次启动时考虑（回战斗重载图集也会经过这里） */ // 战斗中「撤退」回滚重载后直接回天下地图
  }

}
