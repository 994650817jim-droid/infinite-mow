/**
 * 守城 v2（共享笔记 defense-redesign-v2.md v2.2，用户批准「你的建议开工」）：视角翻转——屏幕下方 = 城外，中间 = 敌人要爬的外墙立面，
 * 墙顶 = 城头走道（主将 + 我方士兵往下打），最上方一条 = 城内。试玩版一座中城，分三段交付：
 *  a) 场地翻转 + 城头走道 + 镜头 + 我方士兵上墙站位（本文件的 layout / posts / camera / spawn）；
 *  b) 云梯攀爬 + 城头近战 + 占段夺回 + F 推梯 / 滚木 / 泼油 / 修门 + 冲车撞门；c) 出城冲阵 + 门破退守府衙 + 波次 + 首次引导。
 * 开关 defenseV2On()：网址 ?defenseV2=1 / 0 优先，其次存档设置 im_defense_v2 = '1'；默认关（旧守城照用）。
 * 坐标都相对开局点 O（主将站的地方）：W = 外沿垛口线（走道南沿），走道 [W − walk, W]，外墙立面 [W, F]，F = 墙脚线，城外 y > F，城内 y < 内侧女墙。
 * 所有数值交平衡会话。
 */
export const DEFENSE_V2_KEY = 'im_defense_v2';
export function defenseV2On(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  const q = new URLSearchParams(search).get('defenseV2'); if (q === '1') return true; if (q === '0') return false;
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(DEFENSE_V2_KEY) === '1'; } catch { return false; }
}

export const DEFENSE_V2 = {
  layout: {
    /** 开局点在走道中线（O.y = W − walk/2）、城门西侧 startDx。 */
    startDx: -700,
    /** 墙半宽（到角楼内侧）、走道宽（3.5 个身位）、外墙立面高、内侧女墙厚。 */
    half: 1300, walk: 240, face: 220, inner: 50,
    /** 走道图上沿 44 像素是内侧女墙顶（walkway_a / b）：女墙的碰撞往走道里伸 band，人不站到女墙顶上。 */
    band: 40,
    /** 城门楼半宽（门楼在走道上，主将可以走过去）：按城门楼图（外侧城垛与墙段齐平时约 990 宽）。 */
    gateHalf: 340,
    /** 马道（内侧女墙的两个缺口，上下城头）：离城门的 x、半宽。 */
    rampX: 1150, rampHalf: 60,
    /** 城内深度、城外深度（场地边界）、两侧外留。 */
    city: 650, outside: 1000, flank: 500,
    /** 府衙：内侧女墙以北多远。 */
    keepDy: 380,
    /** 开打时主将站在走道南半边（离外沿 heroDy，垛口后面）：镜头往城外让以后主将在画面上部，站南半边不顶到顶部计时器。 */
    heroDy: 90,
  },
  /** 城头分段：每段一个梯口（段中点），4 个垛口位（避开梯口 ±mouth），梯口 2 个驻守位。 */
  posts: { crenelDy: 40, crenels: 4, mouth: 70, guardDx: 36, guardDy: 95, rampDy: 175, reserveDy: 70, reserveGap: 34, reserveCols: 8 },
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
  /**
   * b 段：云梯与攀爬、城头近战、占段 / 夺回、一键 F（推梯 / 滚木 / 泼油 / 修门）、冲车撞门。时间用关内秒数，距离是世界像素。
   * （波次 / 喘息补满次数在 c 段接；c 段之前滚木 / 热油按 regenSec 慢慢回一次。）
   */
  assault: {
    /** 云梯车：开局 firstSec 秒第一架，之后每 everySec 秒一架，同时最多 max 架（每段一架）；开到墙脚后亮圈 warnMs 再立梯。
     *  被推倒 / 被滚木砸倒后 raiseMs 再立起来（车还在的话）；梯上每 climbGapMs 上一个人，爬完外墙要 climbSec 秒；
     *  一段城头敌兵满 segCap 个就不再上人；墙脚 footReach 以内的近战兵会排队上梯。 */
    ladder: { firstSec: 6, everySec: 16, max: 4, hp: 320, speed: 46, warnMs: 2000, raiseMs: 8000, climbGapMs: 1500, climbSec: 2.5, segCap: 8, footReach: 130, size: 150, footDy: 34 },
    /** 冲车：开局 firstSec 秒第一辆，之后每 everySec 秒，同时最多 max 辆；开到门前每 hitMs 撞一下扣 damage。 */
    ram: { firstSec: 28, everySec: 55, max: 1, hp: 600, speed: 28, hitMs: 1600, damage: 90, size: 150, footDy: 48 },
    /** 城门耐久（按城池档，同旧守城 DEFENSE.gateHp）；门前同时最多 cap 个砍门（每秒 自身伤害 × contactMul），首领 × bossMul；
     *  城外近战每 share 个里有 1 个（骑兵全部）去砍门，其余去排云梯。 */
    gate: { hp: { small: 1500, medium: 1900, large: 2500 } as Record<'small' | 'medium' | 'large', number>, reach: 64, cap: 6, contactMul: .4, bossMul: 3, share: 3 },
    /** 占段：一段里我方士兵全没了、且这段城头敌兵 ≥ minFoes → 这段变红、梯子上人 ×fastMul；这段敌兵清光即夺回。 */
    capture: { minFoes: 3, fastMul: 2, checkMs: 250 },
    /** 推下城：主将近战打中走道南沿 band 以内的普通兵（主将在它北边）→ 摔下城。 */
    push: { band: 64, fallMs: 420 },
    /** 主将在城头：武器范围 ×rampartMul；近战打墙面 / 墙脚（外沿以南）的 ×belowMelee。 */
    hero: { rampartMul: 1.3, belowMelee: .6 },
    /** 一键 F 的站位（离点 reach 以内）：梯口 = 梯子顶端；滚木架在梯口东侧 dx；油锅在门楼前沿；修门在门楼内侧（走道北沿）。 */
    spots: { reach: 70, ladderDy: 40, rackDx: 130, rackDy: 48, oilDy: 52, gateDy: 72 },
    /** 滚木：每个滚木架 charges 次（c 段之前每 regenSec 回一次）；砸这段的梯子（梯上的人摔下去、梯子倒、云梯车 −engineDamage）+ 墙脚 foot 以内 damage。 */
    logs: { charges: 2, regenSec: 45, damage: 160, engineDamage: 220, foot: 200, fallMs: 340 },
    /** 热油：charges 次、冷却 cdMs（c 段之前每 regenSec 回一次）；门前 radius 一片持续烧 ticks × tickMs，冲车 ×engineMul。 */
    oil: { charges: 3, regenSec: 40, cdMs: 5000, radius: 120, tickMs: 400, ticks: 10, damage: 22, engineMul: 4 },
    /** 修门：站定读条 channelMs（走开就断），+amount（占满耐久的比例），冷却 cdMs。 */
    repair: { channelMs: 3000, amount: .12, cdMs: 15000, moveTol: 24 },
    /** 头顶提示离主将脚下多高。 */
    promptDy: 86,
  },
  /** 刷兵口（城外）：墙脚以南 dy，x 三处 ± jitter；攻城主将在墙脚以南 bossDy。 */
  spawn: { dy: 820, xs: [-900, 0, 900] as readonly number[], jitter: 200, bossDy: 600 },
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
  boxes.push({ left: X0 - L.flank, right: X0, top: cityTop - L.flank, bottom: outBot + L.flank }, { left: X1, right: X1 + L.flank, top: cityTop - L.flank, bottom: outBot + L.flank });
  boxes.push({ left: X0 - L.flank, right: X1 + L.flank, top: cityTop - L.flank, bottom: cityTop }, { left: X0 - L.flank, right: X1 + L.flank, top: outBot, bottom: outBot + L.flank });
  const keep = { x: gx, y: innerTop - L.keepDy };
  const reserve = (i: number): Pt => ({ x: gx + ((i % P.reserveCols) - (P.reserveCols - 1) / 2) * P.reserveGap, y: innerTop - P.reserveDy - Math.floor(i / P.reserveCols) * P.reserveGap });
  return { gx, W, top, F, innerTop, cityTop, outBot, X0, X1, segs, ramps, posts, boxes, keep, reserve, start: { x: o.x, y: o.y } };
}
export type V2Geo = ReturnType<typeof v2Geometry>;

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
