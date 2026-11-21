import {getChapter,type ChapterDef} from './chapters';

/** Phase17 first-batch encounter. Preview progress is deliberately separate from campaign saves. */
export function getSishuiEncounter():ChapterDef {
  const west=getChapter('hulao');
  return {...west,name:'2-1 汜水关',label:'第二章 · 讨伐董卓 · 汜水关',description:'汜水列阵 · 华雄迎战',bossName:'华雄',bossStyle:'huaxiong',
    waves:['关外前哨','西凉列阵','华雄出阵'].map((name,i)=>({name,start:i*45})),recruitWaves:[1,2],
    // 2026-11-21 配兵审计：汜水关是关隘窄道，原表（虎牢）90 秒后骑兵 35%、步兵只有 15%；关前改为步 25% · 盾 30% · 弓 22% · 骑 23%（2-2 荥阳沿用）
    pickEnemy:(elapsed:number)=>{const r=Math.random();if(elapsed<15)return 'infantry';if(elapsed<45)return r<.6?'infantry':'shield';if(elapsed<90)return r<.3?'infantry':r<.55?'shield':r<.8?'archer':'cavalry';return r<.25?'infantry':r<.55?'shield':r<.77?'archer':'cavalry';},
    enemies:{...west.enemies,boss:{...west.enemies.boss,texture:'huaxiong_walk',walkVisual:{texture:'huaxiong_walk',scale:1.1,groundY:114/128},attackVisual:'huaxiong_attack',hp:1800,speed:55,damage:14}},
    victoryTitle:'威震汜水',victoryText:'华雄败退 · 汜水关告捷'};
}
