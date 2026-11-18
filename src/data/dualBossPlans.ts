import type { DualPlan } from '../systems/DualBoss';
import type { GuanduBoss } from '../systems/GuanduBoss';

/**
 * 双首领关的组合数据（dual-boss-spec 第四、五节；台词按 5.1 / 5.2）。框架见 systems/DualBoss.ts。
 * 配合技全用两人现成招式组合，预警走现成手绘 WarnFx；摆位在主将身边（世界坐标），两人快步到位后同时起手（预警 ×1.5）。
 */

/** 4-2 延津 · 河北双雄：颜良（左、步战大刀）+ 文丑（右、骑马回马枪）。 */
export const HEBEI_PLAN: DualPlan = {
  group: '河北双雄',
  outcomeFlag: 'hebei_outcome',
  lines: {
    yanliang: { fall: '文丑兄弟……替我……', rage: '文丑！——我要你们偿命！', shaken: '文丑你……也罢！你降你的，我颜良只有战死！' },
    wenchou: { intro: '兄长，你我合兵，看谁挡得住河北双雄！', fall: '兄长……先走一步……', rage: '颜良兄弟——！今日不杀尽你们，誓不还河北！', shaken: '兄长……你怎么能降！' },
  },
  combos: [
    // 夹击：颜良从左上、文丑从右上各拉一条冲锋道，在主将脚下交叉成 X；只有 X 的四个夹角能躲（斜着走出去）
    { id: 'jiaji', name: '河北双雄 · 夹击', caption: '冲锋道交叉成 X · 斜着走出去',
      lines: [['yanliang', '左边归我！'], ['wenchou', '右边交给我！']],
      place: (_a, _b, p) => { const d = 150, k = Math.SQRT1_2; return [{ x: p.x - d * k, y: p.y - d * k }, { x: p.x + d * k, y: p.y - d * k }]; },
      fire: (a, b, p, now, warnMul) => {
        (a.ctrl as unknown as GuanduBoss).combo(0, now, { angle: Math.atan2(p.y - a.enemy.y, p.x - a.enemy.x), warnMul });
        (b.ctrl as unknown as GuanduBoss).combo(0, now, { angle: Math.atan2(p.y - b.enemy.y, p.x - b.enemy.x), warnMul });
      } },
    // 刀枪合璧（二阶段才有）：颜良贴着主将原地回旋一圈，文丑从圈外往圈里放 5 道骑射——圈外安全，出圈只能走箭道之间的空隙
    { id: 'heben', name: '刀枪合璧', caption: '回旋圈 + 五道骑射 · 从箭道空隙出圈',
      lines: [['wenchou', '兄长，圈住他！'], ['yanliang', '哪里走！']],
      place: (_a, _b, p) => [{ x: p.x - 50, y: p.y - 20 }, { x: p.x + 240, y: p.y - 70 }],
      fire: (a, b, _p, now, warnMul) => {
        (a.ctrl as unknown as GuanduBoss).combo(1, now, { single: true, warnMul });
        (b.ctrl as unknown as GuanduBoss).combo(1, now, { lanes: 5, angle: Math.atan2(a.enemy.y - b.enemy.y, a.enemy.x - b.enemy.x), warnMul });
      } },
  ],
  // 一阶段只有夹击；任一人进二阶段后两招轮流
  pick: (d, n) => d.entries.some(x => x.ctrl.phase2) ? d.plan.combos[n % 2] : d.plan.combos[0],
};
