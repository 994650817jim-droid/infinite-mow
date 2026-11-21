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
    /** 城门楼半宽（门楼在走道上，主将可以走过去）：按城门楼图（外侧城垛与墙段齐平时约 990 宽）。 */
    gateHalf: 340,
    /** 马道（内侧女墙的两个缺口，上下城头）：离城门的 x、半宽。 */
    rampX: 1150, rampHalf: 60,
    /** 城内深度、城外深度（场地边界）、两侧外留。 */
    city: 650, outside: 1000, flank: 500,
    /** 府衙：内侧女墙以北多远。 */
    keepDy: 380,
  },
  /** 城头分段：每段一个梯口（段中点），4 个垛口位（避开梯口 ±mouth），梯口 2 个驻守位。 */
  posts: { crenelDy: 40, crenels: 4, mouth: 70, guardDx: 36, guardDy: 95, rampDy: 210, reserveDy: 70, reserveGap: 34, reserveCols: 8 },
  /** 墙上的远程兵射程 ×（够得到墙脚：外沿到墙脚 330）。 */
  wallRangeMul: 1.6,
  /** 预备队补位间隔（毫秒）；E 一次叫几个近战上来（去主将所在这段）。 */
  refillMs: 5000, callReserve: 3,
  /** 镜头：主将在城头（走道带里）时往城外（下方）让多少像素。 */
  camera: { onWall: 120 },
  /** 刷兵口（城外）：墙脚以南 dy，x 三处 ± jitter；攻城主将在墙脚以南 bossDy。 */
  spawn: { dy: 820, xs: [-900, 0, 900] as readonly number[], jitter: 200, bossDy: 600 },
  /** 2.5D 城墙图（复用 2-3 洛阳那套，data/dongzhuo.ts wallArt 的像素标注）：crenel = 外侧城垛顶、ground = 墙脚、walk = 走道石板带。 */
  art: {
    seg: { file: 'assets/siege-v2/luoyang/wall_seg.png', w: 1339, h: 464, crenel: 92, ground: 452, walkTop: 50, walkBot: 90 },
    gate: { file: 'assets/siege-v2/luoyang/wall_gate.png', w: 836, h: 643, crenel: 276, ground: 605 },
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
  { let x = X0; for (const r of ramps) { boxes.push({ left: x, right: r - L.rampHalf, top: innerTop, bottom: top + 6 }); x = r + L.rampHalf; } boxes.push({ left: x, right: X1, top: innerTop, bottom: top + 6 }); }
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
  if (Math.abs(at.x - r) > 40) return { x: r, y: inCity(at) ? g.innerTop - 40 : g.top + 30 };
  return { x: r, y: inCity(at) ? g.top + 40 : g.innerTop - 60 };
}
