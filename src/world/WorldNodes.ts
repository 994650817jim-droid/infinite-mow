import type {ChapterId} from '../data/chapters';
export interface WorldNode{id:string;name:string;x:number;y:number;kind:'home'|'battle'|'future';chapter?:ChapterId;campaign?:'qunxiong';region:string;owner:'player'|'neutral';}
/** Coordinates are normalized; ownership/region are reserved for later city occupation. */
export const WORLD_NODES:readonly WorldNode[]=[
 {id:'home',name:'义军营寨',x:.52,y:.56,kind:'home',region:'中原',owner:'player'},
 {id:'huangjin',name:'黄巾之乱',x:.58,y:.32,kind:'battle',chapter:'huangjin',region:'冀州',owner:'neutral'},
 {id:'hulao',name:'讨伐董卓',x:.43,y:.40,kind:'battle',chapter:'hulao',region:'司隶',owner:'neutral'},
 {id:'qunxiong',name:'群雄割据',x:.31,y:.56,kind:'battle',campaign:'qunxiong',region:'长安 · 宛城 · 寿春',owner:'neutral'},
 {id:'guandu',name:'官渡 · 开发中',x:.62,y:.48,kind:'future',region:'兖州',owner:'neutral'},
 {id:'chibi',name:'赤壁 · 开发中',x:.49,y:.77,kind:'future',region:'荆州',owner:'neutral'},
];
