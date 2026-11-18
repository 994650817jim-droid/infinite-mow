import type { DualPlan } from '../systems/DualBoss';
import type { GuanduBoss } from '../systems/GuanduBoss';
import type { BossMoveset } from '../systems/BossMoveset';
import { BOSS_MOVES, type BossMovesetDef, type MoveDef } from './bossMoves';

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

/** 8-2 定军山：张郃本关步战（不骑马）——一阶段巧变阵 + 连环枪 + 长枪贯阵，二阶段沿用 8-1 的亲卫死战。 */
export function zhangheDualDef(base: BossMovesetDef): BossMovesetDef {
  const qiaobian = base.p1.moves.find(m => m.kind === 'summon'), lian = base.p2.moves.find(m => m.kind === 'sweep'), guan = base.p2.moves.find(m => m.kind === 'thrust');
  return { ...base, mount: undefined,
    p1: { name: '枪阵之将', caption: '巧变阵 · 连环枪 · 长枪贯阵', gapMs: base.p1.gapMs, speedMul: 1.1, moves: ([qiaobian, lian && { ...lian, times: 2 }, guan] as Array<MoveDef | undefined>).filter((m): m is MoveDef => !!m) },
    p2: { ...base.p2, name: '死战', caption: '亲卫护体时张郃减伤' } };
}

/** 8-2 定军山 · 夏侯渊（左、骑马疾行）+ 张郃（右、步战枪阵）。huangzhong：黄忠在队（斩夏侯渊横幅）；onHill：主将站在山头上。 */
export function dingjunPlan(o: { huangzhong: boolean; onHill: () => boolean; xiahouyuan: BossMovesetDef }): DualPlan {
  const X = o.xiahouyuan, charge = X.p1.moves.find(m => m.kind === 'charge'), ride = X.p1.moves.find(m => m.kind === 'ride');
  return {
    group: '定军山',
    retreatAt: { zhanghe: DINGJUN_DUAL.zhangheRetreat },
    lines: {
      xiahouyuan: { intro: '典军校尉夏侯渊，三日五百，六日一千！', rage: '儁乂退了？好——老夫一人足矣！' },
      zhanghe: { intro: '妙才将军，东围交给郃。', retreat: '郃先退一步，妙才将军保重！', retreatLast: '此地不可久留——撤！' },
    },
    combos: [
      // 东西二围：张郃在主将一侧立一排枪墙（连砸三次，约 2 秒），夏侯渊从另一侧朝枪墙长冲——横着躲开冲锋道，别夹在冲锋道和枪墙之间
      { id: 'erwei', name: '东西二围', caption: '一侧枪墙 · 一侧长冲 · 横着闪开',
        lines: [['zhanghe', '枪阵——立！'], ['xiahouyuan', '撞上去！']],
        place: (a, _b, p) => { const t = Math.atan2(p.y - a.enemy.y, p.x - a.enemy.x), c = Math.cos(t), s = Math.sin(t); return [{ x: p.x - c * 300, y: p.y - s * 300 }, { x: p.x + c * 190, y: p.y + s * 190 }]; },
        fire: (a, b, p, now, warnMul) => {
          const t = Math.atan2(p.y - a.enemy.y, p.x - a.enemy.x), c = Math.cos(t), s = Math.sin(t), W = DINGJUN_DUAL.wall;
          const cx = p.x + c * W.dist, cy = p.y + s * W.dist, pts = Array.from({ length: W.count }, (_, k) => { const off = (k - (W.count - 1) / 2) * W.gap; return { x: cx - s * off, y: cy + c * off }; });
          (b.ctrl as unknown as BossMoveset).comboWall('枪阵', pts, W.r, W.windupMs * warnMul, W.dmg, W.times, W.every, now);
          if (charge) (a.ctrl as unknown as BossMoveset).combo({ ...charge, back: false } as MoveDef, now, { aim: { x: cx, y: cy }, warnMul });
        } },
      // 夺回山头（主将站在山头上时代替东西二围）：张郃在主将周围召一圈枪兵，夏侯渊绕阵放箭雨
      { id: 'shantou', name: '夺回山头', caption: '枪兵合围 · 绕阵箭雨 · 下山或硬顶',
        lines: [['xiahouyuan', '山头岂容他占！']],
        place: () => [null, null],
        fire: (a, b, _p, now, warnMul) => {
          const qb = zhangheDualDef(BOSS_MOVES.zhanghe).p1.moves.find(m => m.kind === 'summon');
          if (qb) (b.ctrl as unknown as BossMoveset).combo(qb, now, { warnMul });
          if (ride) (a.ctrl as unknown as BossMoveset).combo(ride, now, { warnMul });
        } },
    ],
    pick: d => o.onHill() ? d.plan.combos[1] : d.plan.combos[0],
    // 夏侯渊先倒 → 张郃不狂怒，「代督退兵」：召 4 名亲卫（减伤）、30 秒撤军倒计时；打到 15% 或倒计时到 → 收拢残兵退走、掉宝箱、告捷
    react: (d, fallen, other, how, now) => {
      if (fallen.id !== 'xiahouyuan') return false; // 张郃先退走 → 夏侯渊照常狂怒（默认）
      const h = d.h, e = other.enemy, D = DINGJUN_DUAL;
      if (how === 'killed' && o.huangzhong) { h.bark(fallen.enemy, '黄忠', '夏侯渊，老夫这一刀，可还快？'); h.banner('定军山 · 斩夏侯渊', false, '老将黄忠 · 一刀斩之'); }
      other.status = '代督退兵'; other.retreatAt = now + D.retreatMs; other.guardMul = D.guardMul;
      for (let k = 0; k < D.guards; k++) { const ang = k / D.guards * Math.PI * 2, g = h.spawn('infantry', e.x + Math.cos(ang) * 80, e.y + Math.sin(ang) * 60); if (g) other.guards.push(g); }
      h.scene.time.delayedCall(1500, () => { if (!other.done && e.active) { h.bark(e, other.name, '妙才将军……！诸军听令，收拢残兵，退守阳平！'); h.banner('张郃代督退兵', false, `${Math.round(D.retreatMs / 1000)} 秒后撤军 · 打到 ${Math.round(D.zhangheRetreat * 100)}% 也会退走`); } });
      return true;
    },
  };
}
/** 8-2 定军山数值（初值，交平衡会话）。 */
export const DINGJUN_DUAL = {
  zhangheRetreat: .15, retreatMs: 30000, guards: 4, guardMul: .45,
  wall: { count: 5, gap: 58, r: 34, dist: 110, windupMs: 850, dmg: 1.0, times: 3, every: 700 },
} as const;
