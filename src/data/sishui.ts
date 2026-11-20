import {getChapter,type ChapterDef} from './chapters';

/** Phase17 first-batch encounter. Preview progress is deliberately separate from campaign saves. */
export function getSishuiEncounter():ChapterDef {
  const west=getChapter('hulao');
  return {...west,name:'2-1 汜水关',label:'第二章 · 讨伐董卓 · 汜水关',description:'汜水列阵 · 华雄迎战',bossName:'华雄',bossStyle:'huaxiong',
    waves:['关外前哨','西凉列阵','华雄出阵'].map((name,i)=>({name,start:i*45})),recruitWaves:[1,2],
    enemies:{...west.enemies,boss:{...west.enemies.boss,texture:'huaxiong_walk',walkVisual:{texture:'huaxiong_walk',scale:1.1,groundY:114/128},attackVisual:'huaxiong_attack',hp:1800,speed:55,damage:14}},
    victoryTitle:'威震汜水',victoryText:'华雄败退 · 本批测试完成'};
}
