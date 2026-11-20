import {getSishuiEncounter} from './sishui';
import type {ChapterDef} from './chapters';
export function getXingyangEncounter():ChapterDef{const base=getSishuiEncounter();return {...base,name:'2-2 荥阳之战',label:'第二章 · 讨伐董卓 · 荥阳',description:'道路伏击 · 徐荣统军',bossName:'徐荣',bossStyle:'xurong',waves:['荥阳斥候','道路伏击','徐荣统军'].map((name,i)=>({name,start:i*45})),recruitWaves:[1,2],enemies:{...base.enemies,boss:{...base.enemies.boss,texture:'xurong',walkVisual:{texture:'xurong',scale:1.1,groundY:114/128},attackVisual:undefined,hp:1900,speed:48,damage:12}},victoryTitle:'破围荥阳',victoryText:'徐荣败退 · 荥阳试玩完成'};}
/** 2-2 荥阳 · 徐荣伏营（统筹会话 2026-11-17 障碍物整改）：场地四角四顶伏兵营帐（可烧毁），「道路伏击」波起定时扬尘示警、随后伏兵从帐里冲出；
 *  全烧后余下刷兵变稀。原来摆在场地中间、不能互动的营帐 / 杂物去掉。数值初值，交平衡会话。 */
export const XINGYANG_AMBUSH={tents:[[-640,-300],[660,-260],[-620,330],[640,300]] as const,count:3,warnMs:1200,fromWave:1};
