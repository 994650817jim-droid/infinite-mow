/**
 * 守城 v2（共享笔记 defense-redesign-v2.md v2.2，用户批准「你的建议开工」）：视角翻转——屏幕下方 = 城外，中间 = 敌人要爬的外墙立面，
 * 墙顶 = 城头走道（主将 + 我方士兵往下打），最上方一条 = 城内。试玩版一座中城，分三段交付：
 *  a) 场地翻转 + 城头走道 + 镜头 + 我方士兵上墙站位（本文件的 layout / posts / camera / spawn）；
 *  b) 云梯攀爬 + 城头近战 + 占段夺回 + F 推梯 / 滚木 / 泼油 / 修门 + 冲车撞门；c) 出城冲阵 + 门破退守府衙 + 波次 + 首次引导。
 * 开关 defenseV2On()：网址 ?defenseV2=1 / 0 优先，其次存档设置 im_defense_v2 = '1'；默认关（旧守城照用）。
 * 坐标都相对开局点 O（主将站的地方）：W = 外沿垛口线（走道南沿），走道 [W − walk, W]，外墙立面 [W, F]，F = 墙脚线，城外 y > F，城内 y < 内侧女墙。
 * 所有数值交平衡会话。
 */
import type { StageMapDef } from './stageMaps';
export const DEFENSE_V2_KEY = 'im_defense_v2';
export function defenseV2On(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  const q = new URLSearchParams(search).get('defenseV2'); if (q === '1') return true; if (q === '0') return false;
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(DEFENSE_V2_KEY) === '1'; } catch { return false; }
}

export const DEFENSE_V2 = {
  layout: {
    /** 开局点在走道中线（O.y = W − walk/2）、城门西侧 startDx（第 2 段中间）。 */
    startDx: -470,
    /** 墙半宽（到角楼内侧）、走道宽（3.5 个身位）、外墙立面高、内侧女墙厚。 */
    /**
     * 有边场地（用户「防守战不要是无限大地图，这样城墙就可以铺开」）：走道从城门往两边各 half（走道全长 2·half = 1780，
     * 主将基础移速 178 → 一头跑到另一头 10 秒），两端角楼贴着地图左右边（corner = 角楼占的宽，场地边界在角楼外沿往里 20）。
     */
    half: 890, walk: 240, face: 220, inner: 50, corner: 272,
    /** 走道图上沿 44 像素是内侧女墙顶（walkway_a / b）：女墙的碰撞往走道里伸 band，人不站到女墙顶上。 */
    band: 40,
    /** 城门楼半宽（门楼在走道上，主将可以走过去）：按城门楼图（外侧城垛与墙段齐平时约 990 宽）。 */
    gateHalf: 327,
    /** 马道（内侧女墙的两个缺口，上下城头）：离城门的 x、半宽。 */
    rampX: 402, rampHalf: 50,
    /** 城内深度、城外深度（场地边界）、两侧外留。 */
    city: 520, outside: 1000, flank: 500,
    /** 场地边外的边带厚度（山崖 / 民居 / 敌营营栅画在这里；镜头最多看到边带为止）。 */
    edgeBand: 220,
    /** 府衙：内侧女墙以北多远。 */
    keepDy: 360,
    /** 开打时主将站在走道南半边（离外沿 heroDy，垛口后面）：镜头往城外让以后主将在画面上部，站南半边不顶到顶部计时器。 */
    heroDy: 90,
  },
  /** 城头分段：每段一个梯口（段中点），4 个垛口位（避开梯口 ±mouth），梯口 2 个驻守位。 */
  posts: { crenelDy: 40, crenels: 4, mouth: 40, guardDx: 36, guardDy: 95, rampDy: 175, reserveDy: 70, reserveGap: 34, reserveCols: 8 },
  /** 墙上的远程兵射程 ×（够得到墙脚：外沿到墙脚 330）。 */
  wallRangeMul: 1.6,
  /** 预备队补位间隔（毫秒）；E 一次叫几个近战上来（去主将所在这段）。 */
  refillMs: 5000, callReserve: 3,
  /**
   * 镜头（b 段，总制作人 a 段验收第 2 条：墙脚以下的城外地面只有约 110 像素一条）：主将在城头时
   * 电脑布局把战场镜头再拉远到 ×zoomMul，镜头锁在「墙脚线在屏幕下方留 outside 设计像素」的位置；主将走到走道北沿时
   * 镜头跟着往上让，保证主将脚下离屏幕顶至少 heroMin 设计像素（不钻到顶部计时器下面）。城内那一侧多裁掉。
   */
  camera: { zoomMul: .82, outside: 195, heroMin: 110 },
  /** 横幅：计时器下方那一行（设计像素 y）；第一次（完整句子）/ 之后（短句）停留多久（毫秒）。 */
  notice: { y: 66, firstMs: 2600, shortMs: 1500 },
  /**
   * b 段：云梯与攀爬、城头近战、占段 / 夺回、一键 F（推梯 / 滚木 / 泼油 / 修门）、冲车撞门。时间用关内秒数，距离是世界像素。
   * （波次 / 喘息补满次数在 c 段接；c 段之前滚木 / 热油按 regenSec 慢慢回一次。）
   */
  assault: {
    /** 云梯车：开局 firstSec 秒第一架，之后每 everySec 秒一架，同时最多 max 架（每段一架）；开到墙脚后亮圈 warnMs 再立梯。
     *  被推倒 / 被滚木砸倒后 raiseMs 再立起来（车还在的话）；梯上每 climbGapMs 上一个人，爬完外墙要 climbSec 秒；
     *  一段城头敌兵满 segCap 个就不再上人；墙脚 footReach 以内的近战兵会排队上梯。 */
    ladder: { firstSec: 6, everySec: 16, max: 4, hp: 320, speed: 46, warnMs: 2000, raiseMs: 8000, climbGapMs: 1000, climbSec: 2.0, segCap: 8, footReach: 130, size: 150, footDy: 34 },
    /**
     * 冲车（c 段验收第 1 条：城门的主要威胁改成冲车）：同时最多 max 辆；开到门前每 hitMs 撞一下，扣城门满耐久的 hitPct（按比例，各档城门一样几下破）。
     * 开得比原来快（speed），每波 ramAt 秒就出来，免得一波快完了才到门前。
     */
    ram: { firstSec: 28, everySec: 55, max: 2, hp: 600, speed: 40, hitMs: 1600, hitPct: .0082, size: 150, footDy: 48 },
    /**
     * 城门耐久（按城池档，同旧守城 DEFENSE.gateHp）。步兵砍门只是慢慢磨（c 段验收第 1 条：原来每人每秒 自身伤害 × 0.4、同时 6 个，后期一波就砍破）：
     * 每人每秒扣满耐久的 chopPct（跟敌兵伤害无关），门前同时最多 cap 个；攻城主将 bossPct；喘息 / 出城开着门时不砍。
     * 城外近战每 share 个里有 1 个（骑兵全部）去砍门，其余去排云梯。
     */
    gate: { hp: { small: 1500, medium: 1900, large: 2500 } as Record<'small' | 'medium' | 'large', number>, reach: 64, cap: 4, chopPct: .0003, bossPct: .004, share: 3 },
    /** 主将站在门楼上：每 everyMs 往门前一片（城门左右 halfW、墙脚往外 depth）放一轮箭，打最近的 targets 个（砍门的、冲车）（c 段验收第 2 条：门楼不只是个按 F 的点）。 */
    gateShot: { everyMs: 650, targets: 2, damage: 34, halfW: 200, depth: 170 },
    /** 垛口掩护（c 段验收第 3 条）：城外射上来的箭打到走道上的我方士兵 × arrowMul（原来城外弓手对着主将放箭，箭先打在垛口后的士兵身上）；打到城头上的主将 × heroArrowMul。 */
    cover: { arrowMul: .4, heroArrowMul: .7 },
    /** 城外同屏敌兵上限（c 段验收第 1 条：原来峰值 120～150 全堆在门前）；多出来的预算换成云梯车 / 冲车（waves.ladders / rams）。 */
    outsideCap: 70,
    /** 门破了：门洞处持续的尘土（每 dustMs 一团）和火光（地火序列帧 fires 团）。 */
    broken: { dustMs: 1400 },
    /** 占段：一段里我方士兵全没了、且这段城头敌兵 ≥ minFoes → 这段变红、梯子上人 ×fastMul；这段敌兵清光即夺回。 */
    capture: { minFoes: 3, fastMul: 2, checkMs: 250 },
    /** 推下城：主将近战打中走道南沿 band 以内的普通兵（主将在它北边）→ 摔下城。 */
    push: { band: 64, fallMs: 420 },
    /**
     * 推梯要按住（总制作人试玩：原来按一下就倒，认真守的玩家一场 0 个登城、主将不掉血）：站在梯口按住 F holdMs，梯上每多一个人 +perClimberMs；
     * 走开 moveTol 以上、松手就断（重新按）；挨一下打往回退 hitBackMs（打断但不清零——原来挨打就清零，登城的兵正落在梯口打主将，推不倒、越积越多）。先给保守值，交平衡会话。
     */
    pushHold: { holdMs: 800, perClimberMs: 250, moveTol: 24, hitBackMs: 300 },
    /** 主将在城头：武器范围 ×rampartMul；近战打墙面 / 墙脚（外沿以南）的 ×belowMelee。 */
    hero: { rampartMul: 1.3, belowMelee: .6 },
    /** 一键 F 的站位（离点 reach 以内）：梯口 = 梯子顶端；滚木架在梯口东侧 dx；油锅在门楼前沿；修门在门楼内侧（走道北沿）。 */
    spots: { reach: 70, ladderDy: 40, rackDx: 84, rackDy: 48, oilDy: 52, gateDy: 72 },
    /** 滚木：每个滚木架 charges 次（喘息时补满）；砸这段的梯子（梯上的人摔下去、梯子倒、云梯车 −engineDamage）+ 墙脚 foot 以内 damage。 */
    logs: { charges: 2, damage: 160, engineDamage: 220, foot: 200, fallMs: 340 },
    /** 热油：charges 次（喘息时补满）、冷却 cdMs；门前 radius 一片持续烧 ticks × tickMs，冲车 ×engineMul。 */
    oil: { charges: 3, cdMs: 5000, radius: 120, tickMs: 400, ticks: 10, damage: 22, engineMul: 4 },
    /** 修门：站定读条 channelMs（走开就断），+amount（占满耐久的比例），冷却 cdMs。门破了以后喘息时可以「堵门」：读条不冷却，修回 reopenPct 就把门关上（换回完好的门）。 */
    repair: { channelMs: 3000, amount: .12, cdMs: 15000, moveTol: 24, reopenPct: .4 },
    /** 头顶提示离主将脚下多高。 */
    promptDy: 86,
  },
  /**
   * c 段 · 波次（设计第七节）：按城池档几波（小 3 / 中 4 / 大 5）；每波攻 attackSec → 喘息 restSec（Space 跳过；喘息够跑一趟修门，
   * 借鉴清单第 6 条：不够就加长、不加按钮）；末波 finalSec，攻城主将出阵，守满或败主将即胜。
   * 每波器械（按第几波取，超出取最后一个）：云梯车架数 ladders（减去出城砸掉的 ladderCut）、冲车 rams；这一波开始后 ladderAt 秒起每 ladderGap 秒一架、冲车同理。
   */
  waves: {
    count: { small: 3, medium: 4, large: 5 } as Record<'small' | 'medium' | 'large', number>,
    attackSec: 65, restSec: 20, finalSec: 90,
    ladders: [3, 4, 4, 4, 4] as readonly number[], rams: [1, 1, 1, 2, 2] as readonly number[],
    ladderAt: 4, ladderGap: 8, ramAt: 8, ramGap: 30,
  },
  /**
   * 守得干净有奖（借鉴清单第 2 条）：每波攻完结算——没失守过的段每段 perSeg 随军粮 + 城门剩余比例 × gate；
   * 四段全无失再给部曲伤害 ×cleanMul 持续到下一波攻完。随军粮是战斗内的钱（行营招兵），不算单场缴获上限里的永久收益。
   */
  reward: { perSeg: 15, gate: 40, cleanMul: 1.1 },
  /**
   * 目标节奏（c 段验收第 1 条，可调；tools/shot-defense-v2-pace.mjs 两种打法各打一局对数）：
   * 只守云梯不管门（推梯 / 滚木，不泼油、不出城、不修门）→ 城门大约在第 gateBreakWave 波后段才破；
   * 只守门不管云梯（泼油 / 出城砸冲车 / 喘息修门，不推梯、不放滚木）→ 第 segLostWave 波起有段失守、敌兵从城头下城；
   * 两条线都用好 → 城门守到最后。两条线压力大致对等，逼玩家来回跑。
   */
  pacing: { gateBreakWave: 3, segLostWave: 2 },
  /**
   * c 段 · 出城冲阵（设计第五节，按 3 天砍版）：每波攻城 afterSec 秒后（或喘息时）门楼内侧亮「F · 出城冲阵」，每波一次；
   * 开门 durationSec 秒，回到门洞 returnR 以内就关门回城头，时间到直接拉回城门内（不做关在外面）。
   * 出城那一刻：主将兵器冷却清零、移速 ×speedMul 持续 speedSec（武将配合只做通用这条）。出城期间 E 不可用、预备队不上城补位。
   * 砸掉云梯车：那一段这一波不再立梯，下一波少一架梯子；砸掉冲车：这一波不再来冲车。
   */
  sortie: { afterSec: 20, durationSec: 20, returnR: 70, speedMul: 1.2, speedSec: 6, outDy: 70 },
  /**
   * c 段 · 门破退守府衙：城门破了，城外近战走到门洞「穿过去」（门洞在城楼底下看不见，淡出淡入）到城门内侧；
   * 城里离主将远于 raidDist 的敌兵去砍府衙（同时最多 cap 个，每秒 自身伤害 × contactMul）；府衙耐久（按城池档，同旧守城）归零 = 府衙失守。
   * 门楼内侧 F「下城守府衙」/ 城门内侧 F「上城头」：主将走门楼里的楼梯上下（不用绕到马道）。
   */
  keep: { hp: { small: 1600, medium: 2000, large: 2600 } as Record<'small' | 'medium' | 'large', number>, raidDist: 340, reach: 90, cap: 8, chopPct: .0007, passR: 28, passHalf: 80, passDepth: 40, tunnelMul: 3, insideDy: 50, stairDy: 60 },
  /**
   * 借鉴清单第 1 条 · 预备队按威胁自动增援：每 checkMs 算各段威胁（立着的梯子 ×ladder + 这段城头敌兵 + 失守 lost），
   * 威胁 ≥ 1 的段派 ceil(威胁 / per) 个预备队近战过去（每段最多 max 个）；那段没威胁了就回预备队。
   * E 改成紧急手段：预备队全体（含已派去别段的）压到主将这段。
   */
  reinforce: { checkMs: 1000, ladder: 2, lost: 3, per: 2, max: 3 },
  /** 一键预览（?dev=1&defenseV2=1&defensePreview=1，测试存档、不写正式存档）：直接进一场中城守城（陈留），补一支部曲上墙。 */
  preview: { city: 'chenliu', army: [['archer', 6], ['swordsman', 6], ['spearman', 6], ['rider', 2]] as ReadonlyArray<readonly ['archer' | 'swordsman' | 'spearman' | 'rider', number]> },
  /** 首次引导（只出一次，存档 key）：按事件弹左下角的军师卡。 */
  guideKey: 'im_defense_v2_guide_v1',
  guide: {
    start: '敌军从城外（下方）攻来，会架梯爬墙。我军已上墙守垛口、梯口；预备队会自己补到吃紧的那段，按 E 让预备队全体压到你这段。',
    ladder: '云梯立起来了——站到梯口按 F 推梯，梯上的人全摔下去；梯子多就去这段的滚木架按 F 砸。',
    ram: '冲车在撞门——到门楼油锅按 F 泼热油（专克冲车）；城门掉血了，站门楼内侧按 F 修门。',
    sortie: '城门这一波可以开一次：站门楼内侧按 F 出城冲阵，砸云梯车、冲车，20 秒内回到城门洞。',
    rest: '喘息：滚木、热油都补满了，预备队在补岗。想快点打下一波就按 Space。',
    gate: '城门破了！敌兵会冲府衙——站门楼内侧按 F 下城守府衙，府衙破了就算失守。',
  } as Record<string, string>,
  /** 刷兵口（城外）：墙脚以南 dy，x 三处 ± jitter；攻城主将在墙脚以南 bossDy。 */
  spawn: { dy: 820, xs: [-620, 0, 620] as readonly number[], jitter: 160, bossDy: 600 },
  /**
   * 2.5D 城墙图：墙段 / 角楼复用 2-3 洛阳那套（data/dongzhuo.ts wallArt 的像素标注；crenel = 外侧城垛顶、ground = 墙脚）。
   * 走道（美术组 walkway_a / b，1024×256 不透明、左右无缝，上沿 band 像素是内侧女墙顶）：游戏里 1:1，a / b 交替横铺，上沿对齐走道北沿。
   * 城门楼（美术组 gate_passable_v2，合成版，总制作人验收）：rear = 后排女墙顶、base = 楼阁台基下沿；和墙段同缩放（外侧城垛顶→墙脚 = 墙段），
   * 楼前是和走道同款的石板平台，人从楼前走过、楼阁在人后面。
   */
  art: {
    seg: { file: 'assets/siege-v2/luoyang/wall_seg.png', w: 1339, h: 464, crenel: 92, ground: 452, walkTop: 50, walkBot: 90 },
    walkway: { a: 'assets/siege-v2/defense-v2/walkway_a.png', b: 'assets/siege-v2/defense-v2/walkway_b.png', w: 1024, h: 256, band: 44 },
    gate: { file: 'assets/siege-v2/defense-v2/gate_passable_v2.png', w: 873, h: 816, rear: 186, base: 260, crenel: 449, ground: 809 },
    /** 破门版门楼（同尺寸同标注，只有拱门不同：门板撞碎、门洞是暗通道）：城门耐久归零换上，喘息堵门修回 reopenPct 换回完好的。 */
    gateBroken: { file: 'assets/siege-v2/defense-v2/gate_passable_v2_broken.png' },
    corner: { file: 'assets/siege-v2/luoyang/wall_corner.png', w: 487, h: 674, crenel: 205, ground: 640 },
    /** 外侧城垛顶比 W 高多少（城垛压住走道南沿，站在后面的人腿被挡住）。 */
    crenelOver: 50,
  },
} as const;

export interface Box { left: number; right: number; top: number; bottom: number }
export interface Pt { x: number; y: number }
export interface Segment { i: number; x0: number; x1: number; ladderX: number }
export type PostKind = 'crenel' | 'guard' | 'ramp' | 'reserve' | 'extra';
export interface Post { kind: PostKind; seg: number; x: number; y: number }

/** 场地几何（纯函数）：o = 开局点。 */
export function v2Geometry(o: Pt) {
  const L = DEFENSE_V2.layout, P = DEFENSE_V2.posts, gx = o.x - L.startDx, W = o.y + L.walk / 2, top = W - L.walk, F = W + L.face;
  const innerTop = top - L.inner, cityTop = innerTop - L.city, outBot = F + L.outside, X0 = gx - L.half, X1 = gx + L.half;
  // 四段：西 2 段、东 2 段（城门楼两侧各两段）
  const span = (L.half - L.gateHalf) / 2;
  const segs: Segment[] = [[X0, X0 + span], [X0 + span, gx - L.gateHalf], [gx + L.gateHalf, gx + L.gateHalf + span], [gx + L.gateHalf + span, X1]].map(([a, b], i) => ({ i, x0: a, x1: b, ladderX: (a + b) / 2 }));
  const ramps = [gx - L.rampX, gx + L.rampX];
  const posts: Post[] = [];
  for (const s of segs) {
    // 垛口：段内均分，避开梯口 ±mouth
    const xs: number[] = []; const n = P.crenels, w = s.x1 - s.x0;
    for (let k = 0; k < n + 1 && xs.length < n; k++) { const x = s.x0 + w * (k + .5) / (n + 1); if (Math.abs(x - s.ladderX) > P.mouth) xs.push(x); }
    for (let k = 0; xs.length < n; k++) xs.push(s.x0 + 30 + k * 40);
    for (const x of xs.slice(0, n)) posts.push({ kind: 'crenel', seg: s.i, x, y: W - P.crenelDy });
    for (const dx of [-P.guardDx, P.guardDx]) posts.push({ kind: 'guard', seg: s.i, x: s.ladderX + dx, y: W - P.guardDy });
  }
  ramps.forEach((x, k) => posts.push({ kind: 'ramp', seg: k === 0 ? 0 : 3, x, y: W - P.rampDy }));
  // 碰撞：墙身（走道南沿到墙脚，含关着的城门）、内侧女墙（马道处留缺口）、四面封边、角楼
  const boxes: Box[] = [{ left: X0, right: X1, top: W - 6, bottom: F - 18 }];
  { let x = X0; for (const r of ramps) { boxes.push({ left: x, right: r - L.rampHalf, top: innerTop, bottom: top + L.band }); x = r + L.rampHalf; } boxes.push({ left: x, right: X1, top: innerTop, bottom: top + L.band }); }
  // 场地边界：走道两端外是角楼（贴地图左右边）；城外 / 城里横向到角楼外沿，纵向城里到 cityTop、城外到 outBot
  const bounds = { left: X0 - L.corner, right: X1 + L.corner, top: cityTop, bottom: outBot };
  // 角楼：墙头那一层（内侧女墙到墙脚）走道两端以外都挡住；城外 / 城里的人可以走到角楼底下（到场地边）
  boxes.push({ left: bounds.left - L.flank, right: X0, top: innerTop, bottom: F - 18 }, { left: X1, right: bounds.right + L.flank, top: innerTop, bottom: F - 18 });
  // 四面封边（StageArena 也会把人挪回场内；这里给寻路和刷兵避让用）
  boxes.push({ left: bounds.left - L.flank, right: bounds.left, top: cityTop - L.flank, bottom: outBot + L.flank }, { left: bounds.right, right: bounds.right + L.flank, top: cityTop - L.flank, bottom: outBot + L.flank });
  boxes.push({ left: bounds.left - L.flank, right: bounds.right + L.flank, top: cityTop - L.flank, bottom: cityTop }, { left: bounds.left - L.flank, right: bounds.right + L.flank, top: outBot, bottom: outBot + L.flank });
  const keep = { x: gx, y: innerTop - L.keepDy };
  const reserve = (i: number): Pt => ({ x: gx + ((i % P.reserveCols) - (P.reserveCols - 1) / 2) * P.reserveGap, y: innerTop - P.reserveDy - Math.floor(i / P.reserveCols) * P.reserveGap });
  return { gx, W, top, F, innerTop, cityTop, outBot, X0, X1, bounds, segs, ramps, posts, boxes, keep, reserve, start: { x: o.x, y: o.y } };
}
export type V2Geo = ReturnType<typeof v2Geometry>;

/**
 * 有边场地定义（交给 StageArena：镜头夹在边界 + 边带以内、每帧把人挪回场内、边外画山崖 / 民居 / 营栅）。
 * 北边（城里）民居、南边（城外）敌营营栅、东西两边山崖；刷兵关口 = 城外三处敌营。
 */
export function v2ArenaDef(g: V2Geo): StageMapDef {
  const S = DEFENSE_V2.spawn;
  return { kind: 'arena', bounds: { ...g.bounds }, edges: { n: 'houses', s: 'palisade', w: 'cliff', e: 'cliff' }, gates: S.xs.map(x => ({ x: g.gx + x, y: g.F + S.dy })), band: DEFENSE_V2.layout.edgeBand, forest: 'pine' };
}

/** 主将在不在走道带里（镜头往城外让）。 */
export function onWalk(g: V2Geo, p: Pt): boolean { return p.y >= g.top - 20 && p.y <= g.W + 10 && p.x >= g.X0 && p.x <= g.X1; }
/** 这一点在不在城外（墙脚以南）。 */
export function isOutside(g: V2Geo, p: Pt): boolean { return p.y >= g.F; }
/** 这一点在哪一段（不在段里返回离得最近的段）。 */
export function segmentAt(g: V2Geo, x: number): Segment { let best = g.segs[0], bd = Infinity; for (const s of g.segs) { const d = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0; if (d < bd) { bd = d; best = s; } } return best; }

export interface UnitLite { id: number; kind: string; ranged: boolean }
const MELEE = new Set(['swordsman', 'spearman', 'guardian', 'halberdier', 'lishi']);
/**
 * 自动站位（纯函数）：远程兵进垛口（四段轮着填，先填离城门远的段）；近战兵先进梯口驻守（每段 2 个，轮着填），再进马道口；
 * 骑兵、军医、多出来的都进门内预备队。返回 id → 岗位。
 */
export function assignPosts(units: readonly UnitLite[], g: V2Geo): Map<number, Post> {
  const out = new Map<number, Post>(), segOrder = [0, 3, 1, 2];
  const queue = (kind: PostKind): Post[] => { const by = segOrder.map(s => g.posts.filter(p => p.kind === kind && p.seg === s)), res: Post[] = []; for (let k = 0; by.some(b => b[k]); k++) for (const b of by) if (b[k]) res.push(b[k]); return res; };
  const crenels = queue('crenel'), guards = queue('guard'), ramps = g.posts.filter(p => p.kind === 'ramp');
  let reserveN = 0; const toReserve = (u: UnitLite) => { const r = g.reserve(reserveN++); out.set(u.id, { kind: 'reserve', seg: -1, x: r.x, y: r.y }); };
  for (const u of units) {
    if (u.ranged) { const p = crenels.shift(); if (p) out.set(u.id, p); else toReserve(u); continue; }
    if (MELEE.has(u.kind)) { const p = guards.shift() ?? ramps.shift(); if (p) out.set(u.id, p); else toReserve(u); continue; }
    toReserve(u);
  }
  return out;
}

/**
 * 去岗位的下一个落脚点：城里和城头之间只能走马道（内侧女墙的缺口）。
 * 人在城里、岗位在城头（或反过来）→ 先去最近的马道口；过了缺口再去岗位。
 */
export function nextWaypoint(g: V2Geo, at: Pt, post: Pt): Pt {
  const inCity = (p: Pt) => p.y < g.innerTop - 4, onWallP = (p: Pt) => p.y >= g.top - 30;
  if (inCity(at) === inCity(post) && !(inCity(at) && onWallP(post))) return post;
  const r = g.ramps.reduce((a, b) => Math.abs(b - at.x) < Math.abs(a - at.x) ? b : a, g.ramps[0]);
  const walkIn = g.top + DEFENSE_V2.layout.band + 24; // 过了女墙带才算上到走道
  if (Math.abs(at.x - r) > 40) return { x: r, y: inCity(at) ? g.innerTop - 40 : walkIn };
  return { x: r, y: inCity(at) ? walkIn + 10 : g.innerTop - 60 };
}

// ———— b 段 ————
/** 一键 F 的站位（纯函数）：每段梯口（梯子顶端）、每段滚木架、门楼前沿油锅、门楼内侧修门（c 段出城也在这）。 */
export function v2Spots(g: V2Geo) {
  const S = DEFENSE_V2.assault.spots;
  return {
    ladders: g.segs.map(s => ({ seg: s.i, x: s.ladderX, y: g.W - S.ladderDy })),
    racks: g.segs.map(s => ({ seg: s.i, x: s.ladderX + S.rackDx, y: g.W - S.rackDy })),
    oil: { x: g.gx, y: g.W - S.oilDy },
    gate: { x: g.gx, y: g.top + S.gateDy },
  };
}
export type V2SpotKind = 'ladder' | 'rack' | 'oil' | 'gate';
/** 主将站在哪个 F 位上（优先级 梯口 > 滚木架 > 门楼油锅 > 门洞修门）；ladderUp(seg) = 这段梯子正立着（倒着 / 没有就不算梯口）。 */
export function spotAt(g: V2Geo, p: Pt, ladderUp: (seg: number) => boolean): { kind: V2SpotKind; seg: number } | null {
  const S = v2Spots(g), r = DEFENSE_V2.assault.spots.reach, near = (q: Pt) => Math.hypot(p.x - q.x, p.y - q.y) <= r;
  for (const l of S.ladders) if (ladderUp(l.seg) && near(l)) return { kind: 'ladder', seg: l.seg };
  for (const k of S.racks) if (near(k)) return { kind: 'rack', seg: k.seg };
  if (near(S.oil)) return { kind: 'oil', seg: -1 };
  if (near(S.gate)) return { kind: 'gate', seg: -1 };
  return null;
}
/** 点在哪一段的城头（走道带里、段的 x 范围内）；不在返回 −1。 */
export function walkSegment(g: V2Geo, p: Pt): number {
  if (p.y < g.top - 4 || p.y > g.W + 4) return -1;
  for (const s of g.segs) if (p.x >= s.x0 && p.x < s.x1) return s.i;
  return -1;
}
/**
 * 镜头中心 y（纯函数；主将不在城头返回 null）：zoom = 设计倍率（镜头 zoom / RENDER_SCALE），H = 设计画面高。
 * 锁在「墙脚线离屏幕底 camera.outside」；主将往北走时跟着上让，主将脚下离屏幕顶不少于 camera.heroMin。
 */
export function cameraCenterY(g: V2Geo, p: Pt, zoom: number, H: number): number | null {
  if (!onWalk(g, p)) return null;
  const C = DEFENSE_V2.camera, lock = g.F - (H / 2 - C.outside) / zoom, cap = p.y + (H / 2 - C.heroMin) / zoom;
  return Math.max(p.y, Math.min(lock, cap));
}
/** 爬梯速度（像素 / 秒）：从墙脚爬到翻上垛口（W − 26）用 climbSec 秒。 */
export function climbSpeed(g: V2Geo): number { return (g.F - (g.W - 26)) / DEFENSE_V2.assault.ladder.climbSec; }

// ———— c 段 ————
/** 守城 v2 波次（纯函数）：第 i 波开始的关内秒数；末波开始 = 攻城主将出阵。 */
export function v2WaveStarts(n: number): number[] { const W = DEFENSE_V2.waves, out: number[] = []; for (let i = 0; i < n; i++) out.push(i * (W.attackSec + W.restSec)); return out; }
/** 关内秒数 el 时在第几波、哪个阶段、这一阶段还剩几秒（末波打满 finalSec 即 done）。 */
export function v2Phase(n: number, el: number): { wave: number; phase: 'attack' | 'rest' | 'final' | 'done'; left: number; start: number } {
  const W = DEFENSE_V2.waves, cyc = W.attackSec + W.restSec, i = Math.min(n - 1, Math.floor(el / cyc)), start = i * cyc, within = el - start;
  if (i === n - 1) return within >= W.finalSec ? { wave: i, phase: 'done', left: 0, start } : { wave: i, phase: 'final', left: W.finalSec - within, start };
  return within < W.attackSec ? { wave: i, phase: 'attack', left: W.attackSec - within, start } : { wave: i, phase: 'rest', left: cyc - within, start };
}
/** 第 i 波的器械：云梯车 / 冲车各几架（超出表取最后一个；云梯车减去出城砸掉的 cut，最少 1）。 */
export function v2Engines(i: number, cut = 0): { ladders: number; rams: number } {
  const W = DEFENSE_V2.waves, at = (a: readonly number[]) => a[Math.min(i, a.length - 1)];
  return { ladders: Math.max(1, at(W.ladders) - cut), rams: at(W.rams) };
}
/** 一波攻完的赏粮（守得干净有奖）：没失守过的段 × perSeg + 城门剩余比例 × gate。 */
export function v2WaveReward(lostSegs: number, gateRatio: number): { food: number; clean: boolean } {
  const R = DEFENSE_V2.reward, held = Math.max(0, 4 - lostSegs);
  return { food: Math.round(held * R.perSeg + Math.max(0, Math.min(1, gateRatio)) * R.gate), clean: lostSegs === 0 };
}
/** 各段要派几个预备队（借鉴清单第 1 条）：威胁 = 立着的梯子 × ladder + 这段城头敌兵 + 失守 × lost。 */
export function v2ReinforceNeed(threat: number): number { const R = DEFENSE_V2.reinforce; return threat < 1 ? 0 : Math.min(R.max, Math.ceil(threat / R.per)); }
