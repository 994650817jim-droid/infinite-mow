import type { DualPlan, DualCombo, DualHost } from '../systems/DualBoss';
import { playSheet } from '../systems/SkillFxSheets';
import { DEPTH } from '../config';
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

/**
 * 3-1 长安 · 李傕（左、骑西凉马）+ 郭汜（右、步战厚背砍刀）：双首领第二批。
 * 「内讧」（史载贾诩、杨奉离间，李郭相攻于长安）：两人互不信任，「猜忌」满了就反目互斗——
 *  - 主将在 CHANGAN_FEUD.pairWindowMs 内先后打到两人（挑拨）：猜忌 +pairGain；
 *  - 任一人 heavyWindowMs 内掉了 heavyFrac 以上的血（怪同伴不救）：猜忌 +heavyGain，挨打的那个骂一句；
 *  - 猜忌慢慢回落；满 100 → 「李郭内讧」：两人冲向对方互砍一刀（各掉 friendly 的血），然后各愣 stunMs（收招破绽），这期间受伤 ×vuln；
 *    之后 cooldownMs 内猜忌不涨。血条下方的小字显示「猜忌 NN%」/「内讧」。
 * 一人了结后内讧作废（剩下那个照常狂怒 / 心乱）。数值初值，交平衡会话。
 */
export const CHANGAN_FEUD = {
  pairWindowMs: 2500, pairGain: 22, pairCdMs: 900,
  heavyFrac: .1, heavyWindowMs: 4000, heavyGain: 34, heavyCdMs: 5000,
  decayPerSec: 3, cooldownMs: 14000, stunMs: 2600, friendly: .06, vuln: 1.25, comboDelayMs: 8000,
} as const;
const FEUD_LINES: Record<string, { blame: string; feud: string }> = {
  lijue: { blame: '郭阿多！你在一旁看戏么？！', feud: '郭汜！你竟敢暗算于我——' },
  guosi: { blame: '李稚然，你袖手旁观，是要借刀杀我？', feud: '李傕！长安是我的，休想独吞！' },
};
export type ChanganPlan = DualPlan & { feudState(): { meter: number; feuds: number; vulnUntil: number; quietUntil: number } };
export function changanPlan(): ChanganPlan {
  const F = CHANGAN_FEUD, lastHit: Record<string, number> = {}, hpLog: Record<string, Array<[number, number]>> = {};
  let pending = false, meter = 0, lastPair = -1e9, lastHeavy = -1e9, quietUntil = 0, vulnUntil = 0, prev = 0, feuds = 0;
  const L = BOSS_MOVES.lijue, G = BOSS_MOVES.guosi;
  const mv = (d: BossMovesetDef, ph: 'p1' | 'p2', kind: MoveDef['kind']): MoveDef | undefined => d[ph].moves.find(m => m.kind === kind);
  const feudCombo: DualCombo = {
    id: 'neihong', name: '李郭内讧', caption: `反目互斗 · ${(F.stunMs / 1000).toFixed(1)} 秒破绽、受伤 +${Math.round((F.vuln - 1) * 100)}%`,
    lines: [['lijue', FEUD_LINES.lijue.feud], ['guosi', FEUD_LINES.guosi.feud]],
    // 两人冲向对方（各停在中点外 40）
    place: (a, b) => { const mx = (a.enemy.x + b.enemy.x) / 2, my = (a.enemy.y + b.enemy.y) / 2, t = Math.atan2(b.enemy.y - a.enemy.y, b.enemy.x - a.enemy.x), c = Math.cos(t) * 40, s = Math.sin(t) * 40; return [{ x: mx - c, y: my - s }, { x: mx + c, y: my + s }]; },
    fire: (a, b, _p, now) => {
      const h = a.enemy.scene, mx = (a.enemy.x + b.enemy.x) / 2, my = (a.enemy.y + b.enemy.y) / 2;
      for (const x of [a, b]) { x.ctrl.forceRecover(now, F.stunMs); x.kit?.recover(now, F.stunMs); }
      vulnUntil = now + F.stunMs; feuds++;
      // 互砍一刀：走宿主的友军伤害（飘字、倒地、招降都照常）
      for (const x of [a, b]) host?.hurt?.(x.enemy, Math.round(x.enemy.maxHp * F.friendly));
      h.cameras.main.shake(260, .006);
      playSheet(h, 'fx_strike_glint', mx, my - 40, { size: 220, ms: 420, depth: DEPTH.fx + .3, add: true, name: 'dual-feud-clash' });
      playSheet(h, 'fx_drag_sparks', mx, my - 20, { size: 180, ms: 520, depth: DEPTH.fx + .2, add: true, name: 'dual-feud-sparks' });
    },
  };
  let host: DualHost | undefined;
  return {
    group: '李郭',
    lines: {
      lijue: { intro: '长安是我西凉儿郎的！谁敢挡路？', fall: '郭汜……你为何不来救我……', rage: '郭阿多死了？——那长安就是我一个人的！', shaken: '郭汜你个软骨头……也罢，我李傕自己来！' },
      guosi: { intro: '李稚然，城中金帛，你我对半分！', fall: '李傕……你这竖子……又不救我……', rage: '李傕！哈哈——今日之后，长安归我郭汜！', shaken: '稚然降了？……天下哪有我郭汜的容身之处！' },
    },
    combos: [
      // 西凉劫掠：李傕绕主将半圈落箭雨（坠马后改连劈），郭汜从侧面拖刀突进——别站在突进线上，也别在箭雨圈里停
      { id: 'jielue', name: '西凉劫掠', caption: '绕阵箭雨 + 拖刀突进 · 别站在突进线上',
        lines: [['guosi', '抢！给我抢！'], ['lijue', '围住他！']],
        place: (_a, _b, p) => [null, { x: p.x + 230, y: p.y - 30 }],
        fire: (a, b, p, now, warnMul) => {
          const ride = a.ctrl.phase2 ? mv(L, 'p2', 'sweep') : mv(L, 'p1', 'ride'), thrust = mv(G, 'p2', 'thrust');
          if (ride) (a.ctrl as unknown as BossMoveset).combo(ride, now, { warnMul });
          if (thrust) (b.ctrl as unknown as BossMoveset).combo(thrust, now, { aim: { x: p.x, y: p.y }, warnMul });
        } },
      // 分掠两翼（任一人进二阶段后）：两人从主将左右各连劈三刀——往上下走出夹缝
      { id: 'liangyi', name: '分掠两翼', caption: '左右夹砍 · 往上下走',
        lines: [['lijue', '左翼归我！'], ['guosi', '右翼的金帛是我的！']],
        place: (_a, _b, p) => [{ x: p.x - 110, y: p.y }, { x: p.x + 110, y: p.y }],
        fire: (a, b, p, now, warnMul) => {
          const sa = mv(L, 'p2', 'sweep'), sb = mv(G, 'p2', 'sweep');
          if (sa) (a.ctrl as unknown as BossMoveset).combo(sa, now, { aim: { x: p.x, y: p.y }, warnMul });
          if (sb) (b.ctrl as unknown as BossMoveset).combo(sb, now, { aim: { x: p.x, y: p.y }, warnMul });
        } },
    ],
    pick: (d, n) => d.entries.some(x => x.ctrl.phase2) ? d.plan.combos[n % 2] : d.plan.combos[0],
    tick: (d, now) => {
      host = d.h;
      const dt = prev ? Math.min(.25, (now - prev) / 1000) : 0; prev = now;
      const al = d.alive, both = al.length === 2 && d.entries.length === 2;
      if (!both) { for (const x of d.entries) if (/^(猜忌|内讧)/.test(x.status)) x.status = ''; return; }
      // 掉血太快（同伴不救）
      for (const x of al) {
        const log = hpLog[x.id] ??= []; log.push([now, x.enemy.hp]); while (log.length && now - log[0][0] > F.heavyWindowMs) log.shift();
        if (now >= quietUntil && now - lastHeavy >= F.heavyCdMs && log.length && log[0][1] - x.enemy.hp >= x.enemy.maxHp * F.heavyFrac) {
          lastHeavy = now; meter = Math.min(100, meter + F.heavyGain); log.length = 0; d.h.bark(x.enemy, x.name, FEUD_LINES[x.id]?.blame ?? '');
        }
      }
      if (meter >= 100) pending = true;
      if (now >= quietUntil && !pending) meter = Math.max(0, meter - F.decayPerSec * dt);
      // 满了：反目互斗——等两人手上的招放完（期间不起新招、不放配合技），再冲向对方
      if (pending) {
        for (const x of al) x.ctrl.holdUntil(now + 120);
        if (!d.comboActive && al.every(x => !x.ctrl.busy())) { pending = false; meter = 0; quietUntil = now + F.cooldownMs; d.delayCombo(now + F.comboDelayMs); d.startCombo(feudCombo, now); }
      }
      const st = now < vulnUntil ? '内讧' : meter >= 1 ? `猜忌 ${Math.round(meter)}%` : '';
      for (const x of al) x.status = st;
    },
    incomingMul: (d, x, ally, now) => {
      if (d.alive.length < 2) return 1;
      if (!ally) {
        lastHit[x.id] = now; const o = d.partner(x);
        if (o && now >= quietUntil && now - (lastHit[o.id] ?? -1e9) <= F.pairWindowMs && now - lastPair >= F.pairCdMs) { lastPair = now; meter = Math.min(100, meter + F.pairGain); }
      }
      return now < vulnUntil && !ally ? F.vuln : 1;
    },
    // 测试读：猜忌、内讧次数、破绽到点
    feudState: () => ({ meter, feuds, vulnUntil, quietUntil }),
  };
}

/**
 * 11-3 南中 · 孟获（左、步战）+ 祝融夫人（右、飞刀）：双首领第二批。七擒照旧由 NanzhengGameScene 管：
 * 孟获前两次被击倒 → 逃回蛮洞（DualBoss.setAway：不出招、不当主目标、不放配合技），祝融喊一句断后、马上补一轮飞刀；过一会儿孟获从别处杀回来。
 *  - 配合技「夫妻同心」：孟获从一侧蛮王冲阵、祝融从另一侧（与冲锋道垂直）扇射飞刀——斜着躲；
 *    二阶段起与「火神助阵」轮流：孟获原地震地三圈、祝融七刀从圈外射进来——从刀缝出圈。
 *  - 孟获第三擒真倒（心服）而祝融还在：祝融「随夫归降」——不狂怒，放下兵刃退走（宝箱 / 心服照旧按最后一人走）；
 *    祝融先被打倒：孟获照常狂怒（「夫人！」），七擒照旧。
 */
export function nanzhongPlan(): DualPlan {
  const M = BOSS_MOVES.menghuo, Z = BOSS_MOVES.zhurong;
  const mv = (d: BossMovesetDef, ph: 'p1' | 'p2', kind: MoveDef['kind']): MoveDef | undefined => d[ph].moves.find(m => m.kind === kind);
  return {
    group: '南中夫妇',
    lines: {
      menghuo: { intro: '我乃南蛮王孟获！夫人，随我杀出去！', rage: '夫人——！蛮兵听令，给我杀！一个不留！', shaken: '……夫人降了？' },
      zhurong: { intro: '大王且看妾身飞刀！', fall: '大王……妾身先去了……', rage: '大王！——你们这些汉人，还我大王来！', shaken: '大王都服了……罢了，妾身也降。', retreat: '大王既已心服，妾身也放下兵刃。' },
    },
    combos: [
      { id: 'fuqi', name: '夫妻同心', caption: '一侧冲阵 · 一侧飞刀 · 斜着躲',
        lines: [['zhurong', '大王，我来掩护！'], ['menghuo', '冲！']],
        place: (a, _b, p) => { const t = Math.atan2(p.y - a.enemy.y, p.x - a.enemy.x), c = Math.cos(t), s = Math.sin(t); return [{ x: p.x - c * 280, y: p.y - s * 280 }, { x: p.x + s * 230, y: p.y - c * 230 }]; },
        fire: (a, b, p, now, warnMul) => {
          const charge = mv(M, 'p1', 'charge'), fan = mv(Z, b.ctrl.phase2 ? 'p2' : 'p1', 'fan');
          if (charge) (a.ctrl as unknown as BossMoveset).combo(charge, now, { aim: { x: p.x, y: p.y }, warnMul });
          if (fan) (b.ctrl as unknown as BossMoveset).combo(fan, now, { aim: { x: p.x, y: p.y }, warnMul });
        } },
      { id: 'huoshen', name: '火神助阵', caption: '震地三圈 + 七刀 · 从刀缝出圈',
        lines: [['menghuo', '大地都要在我脚下颤抖！'], ['zhurong', '七刀——走！']],
        place: (_a, _b, p) => [{ x: p.x - 40, y: p.y - 10 }, { x: p.x + 260, y: p.y - 60 }],
        fire: (a, b, p, now, warnMul) => {
          const rings = mv(M, 'p2', 'rings'), fan = mv(Z, 'p2', 'fan');
          if (rings) (a.ctrl as unknown as BossMoveset).combo(rings, now, { warnMul });
          if (fan) (b.ctrl as unknown as BossMoveset).combo(fan, now, { aim: { x: p.x, y: p.y }, warnMul });
        } },
    ],
    pick: (d, n) => d.entries.some(x => x.ctrl.phase2) ? d.plan.combos[n % 2] : d.plan.combos[0],
    react: (d, fallen, other, how, now) => {
      if (fallen.id !== 'menghuo' || how !== 'killed') return false; // 祝融先倒 → 孟获照常狂怒
      // 孟获心服（第三擒）：祝融随夫归降，1.6 秒后放下兵刃退走
      other.status = '随夫归降'; other.retreatAt = now + 1600; other.ctrl.holdUntil(now + 5000);
      d.h.scene.time.delayedCall(500, () => { if (!other.done && other.enemy.active) d.h.bark(other.enemy, other.name, d.plan.lines.zhurong.shaken ?? ''); });
      return true;
    },
  };
}
