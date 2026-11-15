import {getSishuiEncounter} from './sishui';
import {getXingyangEncounter} from './xingyang';
import { ENEMY_DEFS, enemyHpScale, pickEnemyKind, spawnBurst, spawnInterval, type EnemyDef } from './enemies';
import { WAVES, type WaveDef } from './waves';
import type { EnemyKind } from '../types';

export type ChapterId = 'huangjin' | 'hulao';
export interface ChapterDef {
  id: ChapterId;
  name: string;
  label: string;
  description: string;
  bossName: string;
  bossStyle: 'zhangjiao' | 'lubu' | 'zhangliang' | 'zhangbao' | 'huaxiong' | 'xurong' | 'lijue' | 'zhangxiu' | 'yuanshu' | 'yanliang' | 'wenchou' | 'chunyuqiong';
  stage?: 1 | 2 | 3;
  westStage?: 1 | 2 | 3;
  waves: readonly WaveDef[];
  recruitWaves: readonly number[];
  enemies: Readonly<Record<EnemyKind, EnemyDef>>;
  ground: string;
  hpScale(elapsed: number): number;
  spawnInterval(elapsed: number): number;
  spawnBurst(elapsed: number): number;
  pickEnemy(elapsed: number): EnemyKind;
  victoryTitle: string;
  victoryText: string;
}

const hulaoWaves = ['关前哨骑', '西凉列阵', '弩骑夹击', '铁甲压境', '飞骑冲阵', '虎牢精锐', '关门死战', '吕布出阵']
  .map((name, index) => ({ name, start: index * 45 }));
const WEST_WALK_SCALE: Partial<Record<EnemyKind, number>> = {
  "infantry": 0.7334183673469387,
  "shield": 0.7318501170960187,
  "archer": 0.6467941507311585,
  "cavalry": 0.912751677852349,
  "elite": 0.8524397413286301
};
const west = (kind: EnemyKind, hp: number, speed: number, damage: number): EnemyDef => ({
  ...ENEMY_DEFS[kind], hp, speed, damage, tint: 0xffffff,
  walkVisual: { texture: `xiliang_${kind}_walk`, scale: WEST_WALK_SCALE[kind] ?? 1, groundY: .875 },
});

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'huangjin', name: '黄巾之乱', label: '第一章 · 黄巾之乱',
    description: '六波黄巾敌军 · 张角法术与九霄天雷', bossName: '张角', bossStyle: 'zhangjiao',
    waves: WAVES, recruitWaves: [1, 2, 3, 4, 5], enemies: ENEMY_DEFS, ground: 'ground_ai2',
    hpScale: enemyHpScale, spawnInterval, spawnBurst, pickEnemy: pickEnemyKind,
    victoryTitle: '大破黄巾', victoryText: '张角伏诛，黄巾已破',
  },
  {
    id: 'hulao', name: '讨伐董卓', label: '第二章 · 讨伐董卓',
    description: '八波西凉敌军 · 吕布横扫与蓄力冲锋', bossName: '吕布', bossStyle: 'lubu',
    waves: hulaoWaves, recruitWaves: [1, 2, 3, 5, 7], ground: 'ground_hulao',
    enemies: {
      infantry: west('infantry', 22, 88, 6), shield: west('shield', 45, 66, 8),
      archer: west('archer', 18, 60, 5), cavalry: west('cavalry', 34, 86, 8),
      elite: west('elite', 280, 48, 15),
      boss: { ...ENEMY_DEFS.boss, texture: 'boss_lubu', hp: 3200, speed: 48, damage: 16 },
    },
    hpScale: elapsed => 1 + Math.max(0, elapsed) / 420,
    spawnInterval: elapsed => elapsed < 20 ? .8 : elapsed < 45 ? .6 : elapsed < 135 ? .5 : elapsed < 225 ? .46 : .42,
    spawnBurst: elapsed => elapsed < 45 ? 1 : elapsed < 180 ? 2 : 3,
    pickEnemy: elapsed => {
      const r = Math.random();
      if (elapsed < 15) return 'infantry';
      if (elapsed < 45) return r < .6 ? 'infantry' : 'shield';
      if (elapsed < 90) return r < .3 ? 'infantry' : r < .55 ? 'shield' : r < .8 ? 'archer' : 'cavalry';
      return r < .15 ? 'infantry' : r < .45 ? 'shield' : r < .65 ? 'archer' : 'cavalry';
    },
    victoryTitle: '威震虎牢', victoryText: '击退吕布，虎牢关告捷',
  },
];

export function getChapter(id?: string): ChapterDef {
  return CHAPTERS.find(chapter => chapter.id === id) ?? CHAPTERS[0];
}
export function chapterBossTime(chapter: ChapterDef): number {
  return chapter.waves[chapter.waves.length - 1].start;
}

/** 第二章试玩参数；调平衡时集中修改，不散落在行为系统中。 */
export const LUBU_COMBAT = {
  sweepRadius: 150, sweepAngle: 220, sweepDamage: 24,
  sweepWarnMs: 650, enragedSweepWarnMs: 550, sweepFlashMs: 180,
  sweepCooldown: 2.8, enragedSweepCooldown: 2.2,
  dashLength: 300, dashSpeed: 650, dashHalfWidth: 40, dashDamage: 18,
  dashWarnMs: 850, enragedDashWarnMs: 750,
  dashCooldown: 6.5, enragedDashCooldown: 5,
  recoveryMs: 650, enragedMoveMul: 1.15,
  ultEnergyPerSecond: 12, ultRadius: 190, ultDamage: 32,
  ultTakeoffMs: 450, ultAirborneMs: 1650, ultDropMs: 240, ultLandingMs: 650,
  ultKnockupMs: 650, ultFieldMs: 6000,
  ultPhysicalDamageMul: .4, ultMagicDamageMul: .4,
} as const;

/** Huangjin sub-stages share the existing battle engine, not ChapterId/save economy IDs. */
export type YellowStage = 1 | 2 | 3;
export const YELLOW_STAGES = [
 {stage:1 as const,name:'广宗外围',boss:'张梁',title:'人公将军'},
 {stage:2 as const,name:'下曲阳破阵',boss:'张宝',title:'地公将军'},
 {stage:3 as const,name:'广宗决战',boss:'张角',title:'天公将军'},
];
export const DONGZHUO_STAGES=[{stage:1 as const,name:'汜水关',boss:'华雄'},{stage:2 as const,name:'荥阳',boss:'徐荣'},{stage:3 as const,name:'虎牢关',boss:'吕布'}];
export function getBattleChapter(id?:string, stage:YellowStage=1,westStage:YellowStage=3):ChapterDef {
 const base=getChapter(id);if(base.id==='hulao'){const n=DONGZHUO_STAGES.find(s=>s.stage===westStage)?.stage??3;return n===1?{...getSishuiEncounter(),westStage:1,victoryText:'汜水关告捷 · 荥阳之战已解锁'}:n===2?{...getXingyangEncounter(),westStage:2,victoryText:'荥阳破围 · 虎牢关已解锁'}:{...base,westStage:3,name:'2-3 虎牢关',label:'讨伐董卓 · 虎牢关',victoryText:'吕布败退 · 讨伐董卓告捷 · 三国天下开启'};}
 const info=YELLOW_STAGES[stage-1]??YELLOW_STAGES[0];stage=info.stage;
 if(stage===3)return {...base,stage,name:'1-3 广宗决战',ground:'yellow_ground_3',victoryTitle:'黄巾平定',victoryText:'雷云消散 · 讨伐董卓已解锁'};
 const boss=stage===1?'zhangliang':'zhangbao';
 const names=stage===1?['外围哨兵','长枪阻路','张梁迎战']:['营寨前锋','弓盾合击','地符封路','张宝祭阵'];
 return {...base,stage,name:`1-${stage} ${info.name}`,ground:`yellow_ground_${stage}`,bossName:info.boss,bossStyle:boss,
 waves:names.map((name,i)=>({name,start:i*60})),recruitWaves:stage===1?[1,2]:[1,2,3],
 enemies:{...ENEMY_DEFS,boss:{...ENEMY_DEFS.boss,texture:`yellow_${boss}_walk`,walkVisual:{texture:`yellow_${boss}_walk`,scale:1.35,groundY:91/96},attackVisual:`yellow_${boss}_${stage===1?'attack':'cast'}`,hp:stage===1?1100:1700,speed:stage===1?54:35,damage:stage===1?12:14}},
 hpScale:t=>1+t/600,spawnInterval:t=>t<60?.8:.6,spawnBurst:t=>t<60?1:2,
 pickEnemy:t=>{
  if(stage===1)return 'infantry';
  if(stage===2){
   const r=Math.random();
   // 1-2 opens with cavalry and archers; shield soldiers join at wave four.
   if(t>=180){
    if(r<.24)return 'infantry';
    if(r<.46)return 'cavalry';
    if(r<.72)return 'archer';
    return 'shield';
   }
   return r<.35?'infantry':r<.67?'cavalry':'archer';
  }
  return pickEnemyKind(t);
 },
 victoryTitle:`${info.boss}败退`,victoryText:`1-${stage} ${info.name}已突破 · 下一关已解锁`};
}
