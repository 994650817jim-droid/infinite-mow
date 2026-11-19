import {getSishuiEncounter} from './sishui';
import type {ChapterDef} from './chapters';
import {tuneStage} from './stageTuning';
import {factionKey,type PaletteId} from '../systems/FactionPalette';
import type {EnemyDef} from './enemies';
export type ThirdStage=1|2|3;
export const THIRD_STAGES=[
 {stage:1 as const,name:'长安突围',boss:'李傕',id:'lijue',story:'长安烽火未息，西凉铁骑封路。破开两翼，率众突围。'},
 {stage:2 as const,name:'宛城夜袭',boss:'张绣',id:'zhangxiu',story:'夜火映城，枪影伏巷。守住后阵，避开连环突刺。'},
 {stage:3 as const,name:'寿春讨逆',boss:'袁术',id:'yuanshu',story:'伪帝据营，旗令如林。击破亲军，瓦解寿春军势。'},
];
/** 第三章敌军配色（用户 11-19 批准换色）：3-1 李傕、3-2 张绣是凉州残部——深铁灰带锈褐（liangzhou），3-3 袁术用袁术势力紫（yuanshu）；只换衣甲红色，图不变。ThirdGameScene 开局按这里生成换色贴图。 */
export function thirdPalette(stage:ThirdStage):PaletteId{return stage===3?'yuanshu':'liangzhou';}
const recolor=(es:Record<string,EnemyDef>,p:PaletteId)=>Object.fromEntries(Object.entries(es).map(([k,d])=>[k,k==='boss'||!d.walkVisual?d:{...d,walkVisual:{...d.walkVisual,texture:factionKey(p,d.walkVisual.texture)}}])) as typeof es;
/** The battle engine's west-army template is reused; progression uses WorldStore's qunxiong arc. */
/** 第三章关卡（已套用 stageTuning 的刷怪节奏与小怪成长）。 */
export function thirdBattle(stage:ThirdStage):ChapterDef{return tuneStage(rawThirdBattle(stage),'qunxiong',stage);}
function rawThirdBattle(stage:ThirdStage):ChapterDef{const base0=getSishuiEncounter(),base={...base0,enemies:recolor(base0.enemies,thirdPalette(stage)) as typeof base0.enemies},d=THIRD_STAGES[stage-1];return{...base,name:`3-${stage} ${d.name}`,label:`第三章 · 群雄割据 · ${d.name}`,description:d.story,bossName:d.boss,bossStyle:d.id as ChapterDef['bossStyle'],westStage:3,
 waves:(stage===1?['城外前锋','侧翼铁骑','长安破围']:stage===2?['夜巷探路','暗处伏兵','张绣出阵']:['寿春前营','弓阵压制','袁术号令']).map((name,i)=>({name,start:i*45})),recruitWaves:[1,2],
 enemies:{...base.enemies,...(stage===2?{infantry:{...base.enemies.infantry,hp:34,damage:7}}:{})/* 3-2 张绣是西凉军：原来借了黄巾长枪兵的图（用户 11-19「3-2还有黄巾兵出来」），改用本章西凉步卒，数值不变 */,boss:{...base.enemies.boss,texture:'third_'+d.id,walkVisual:undefined,attackVisual:undefined,hp:[1900,1800,2300][stage-1],speed:[48,62,35][stage-1],damage:[14,12,13][stage-1]}},
 pickEnemy:t=>{const r=Math.random();return stage===1?(t<30?'infantry':r<.5?'infantry':r<.8?'cavalry':'archer'):stage===2?(r<.55?'infantry':r<.82?'archer':'elite'):(r<.3?'shield':r<.65?'archer':r<.88?'infantry':'elite');},
 victoryTitle:d.boss+'败退',victoryText:stage===3?'寿春军势瓦解 · 群雄割据告捷':d.name+'突破 · 进入军营休整'};}
