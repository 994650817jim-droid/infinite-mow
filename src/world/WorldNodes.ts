import type {ChapterId} from '../data/chapters';
export interface WorldNode{id:string;name:string;x:number;y:number;kind:'home'|'battle'|'future';chapter?:ChapterId;campaign?:'qunxiong'|'guandu'|'chibi'|'jingnan'|'shu'|'hanzhong'|'xiangfan'|'yiling'|'nanzheng'|'beifa';
 /** 天下地图挑战关（可选、可反复挑战），如「虎牢关 · 三英战吕布」。 */
 challenge?:'lubu';region:string;owner:'player'|'neutral';}
/** Coordinates are normalized. 战役节点避开 WorldCities 城池标记（讨董卓移至洛阳与汜水关之间，官渡移至官渡城东南）。 */
export const WORLD_NODES:readonly WorldNode[]=[
 {id:'home',name:'义军营寨',x:.52,y:.56,kind:'home',region:'中原',owner:'player'},
 {id:'huangjin',name:'黄巾之乱',x:.58,y:.32,kind:'battle',chapter:'huangjin',region:'冀州',owner:'neutral'},
 {id:'hulao',name:'讨伐董卓',x:.456,y:.352,kind:'battle',chapter:'hulao',region:'司隶',owner:'neutral'},
 {id:'qunxiong',name:'群雄割据',x:.31,y:.56,kind:'battle',campaign:'qunxiong',region:'长安 · 宛城 · 寿春',owner:'neutral'},
 {id:'guandu',name:'官渡之战',x:.645,y:.527,kind:'battle',campaign:'guandu',region:'白马 · 延津 · 乌巢',owner:'neutral'},
 {id:'chibi',name:'赤壁之战',x:.49,y:.77,kind:'battle',campaign:'chibi',region:'长坂 · 赤壁 · 江陵',owner:'neutral'},
 {id:'jingnan',name:'平定荆南',x:.42,y:.9,kind:'battle',campaign:'jingnan',region:'桂阳 · 零陵 · 长沙',owner:'neutral'},
 {id:'shu',name:'入蜀',x:.115,y:.58,kind:'battle',campaign:'shu',region:'葭萌 · 落凤坡 · 成都',owner:'neutral'},
 {id:'nanzheng',name:'南征',x:.2,y:.8,kind:'battle',campaign:'nanzheng',region:'泸水 · 乌戈 · 孟获蛮洞',owner:'neutral'},
 {id:'xiangfan',name:'襄樊之战',x:.33,y:.63,kind:'battle',campaign:'xiangfan',region:'樊城 · 罾口川 · 麦城',owner:'neutral'},
 {id:'hanzhong',name:'汉中之战',x:.2,y:.43,kind:'battle',campaign:'hanzhong',region:'阳平关 · 定军山 · 汉水',owner:'neutral'},
 {id:'yiling',name:'夷陵之战',x:.47,y:.62,kind:'battle',campaign:'yiling',region:'猇亭 · 连营 · 火烧连营',owner:'neutral'},
 {id:'beifa',name:'北伐',x:.25,y:.36,kind:'battle',campaign:'beifa',region:'街亭 · 陈仓 · 五丈原',owner:'neutral'},
 {id:'lubu',name:'三英战吕布',x:.417,y:.488,kind:'battle',challenge:'lubu',region:'虎牢关',owner:'neutral'},
];
