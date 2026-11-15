import type {ChapterId} from '../data/chapters';
export interface WorldNode{id:string;name:string;x:number;y:number;kind:'home'|'battle'|'future';chapter?:ChapterId;campaign?:'qunxiong'|'guandu'|'chibi';region:string;owner:'player'|'neutral';}
/** Coordinates are normalized. 战役节点避开 WorldCities 城池标记（讨董卓移至洛阳与汜水关之间，官渡移至官渡城东南）。 */
export const WORLD_NODES:readonly WorldNode[]=[
 {id:'home',name:'义军营寨',x:.52,y:.56,kind:'home',region:'中原',owner:'player'},
 {id:'huangjin',name:'黄巾之乱',x:.58,y:.32,kind:'battle',chapter:'huangjin',region:'冀州',owner:'neutral'},
 {id:'hulao',name:'讨伐董卓',x:.456,y:.352,kind:'battle',chapter:'hulao',region:'司隶',owner:'neutral'},
 {id:'qunxiong',name:'群雄割据',x:.31,y:.56,kind:'battle',campaign:'qunxiong',region:'长安 · 宛城 · 寿春',owner:'neutral'},
 {id:'guandu',name:'官渡之战',x:.645,y:.527,kind:'battle',campaign:'guandu',region:'白马 · 延津 · 乌巢',owner:'neutral'},
 {id:'chibi',name:'赤壁之战',x:.49,y:.77,kind:'battle',campaign:'chibi',region:'长坂 · 赤壁 · 江陵',owner:'neutral'},
];
