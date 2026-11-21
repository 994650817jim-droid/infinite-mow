import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import { DEFENSE_V2, assignPosts, cameraCenterY, isOutside, nextWaypoint, onWalk, segmentAt, v2Geometry, v2ReinforceNeed, type Post, type PostKind, type Pt, type V2Geo, type Segment } from '../data/defenseV2';
import type { Ally } from '../entities/Ally';

/**
 * 守城 v2 场地（共享笔记 defense-redesign-v2.md v2.2；试玩版 a 段）：视角翻转——城外在下、外墙立面在中间、城头走道在墙顶、城内在最上方。
 * 墙段 / 角楼复用 2-3 洛阳那套 2.5D 城墙（siege-v2/luoyang，正面朝城外）；走道（walkway_a / b 交替）和可通行城门楼（gate_passable_v2）是美术组为守城 v2 出的图。
 * 本段：场地与碰撞、镜头往城外让、刷兵口在城外、我方士兵自动上墙站垛口 / 梯口 / 马道口、预备队补位、E 叫预备队来主将这段。
 * 云梯 / 冲车 / 一键 F / 出城冲阵 / 府衙失守在 b、c 段接。
 */
export interface DefenseWallV2Host {
  scene: Phaser.Scene;
  player: () => Pt;
  units: () => readonly Ally[];
  banner: (title: string, danger: boolean, caption?: string, short?: string) => void;
}
/** auto = 按威胁自动派去的增援（威胁没了就回预备队）；E 叫来的不算 auto。 */
interface Slot { post: Post; life: number; auto?: boolean }

const KEY = { seg: 'luoyang_wall_seg', gate: 'defv2_gate_v2', gateBroken: 'defv2_gate_v2_broken', walkA: 'defv2_walkway_a', walkB: 'defv2_walkway_b', endR: 'defv2_wallend_r', endL: 'defv2_wallend_l', stair: 'defv2_stair_down' } as const;
const FILE: Record<keyof typeof KEY, string> = { seg: DEFENSE_V2.art.seg.file, gate: DEFENSE_V2.art.gate.file, gateBroken: DEFENSE_V2.art.gateBroken.file, walkA: DEFENSE_V2.art.walkway.a, walkB: DEFENSE_V2.art.walkway.b, endR: DEFENSE_V2.art.wallend.right, endL: DEFENSE_V2.art.wallend.left, stair: DEFENSE_V2.art.stair.file };
/**
 * 守城 v2 场地图在场景 preload 里先排进去（总制作人走查 G：加载慢时开打 9 秒城墙才建出来，只有地面、士兵和滚木悬在空地上）：
 * 有了这一步，DefenseWallV2 建场时图都在，同一帧建好，计时 / 刷兵 / 引导卡都在城墙建好之后。
 */
export function preloadDefenseV2Wall(scene: Phaser.Scene): void { for (const k of Object.keys(KEY) as Array<keyof typeof KEY>) if (!scene.textures.exists(KEY[k])) scene.load.image(KEY[k], FILE[k]); }

export class DefenseWallV2 {
  readonly g: V2Geo;
  private readonly art: Phaser.GameObjects.GameObject[] = [];
  private readonly slots = new Map<Ally, Slot>();
  private refillAt = 0; private alive = true; private reinforceAt = 0;
  /** 走道贴图的纹理名（walkway_a + b 横拼成一张；占段变红的那层复用）。 */
  readonly walkKey = 'defv2_walk_ab';
  /** 城门楼两层（整张在人后、外侧城垛往下在人前）；城门破了换成破门版（同尺寸同标注）。 */
  private gateBack: Phaser.GameObjects.Image | null = null; private gateFront: Phaser.GameObjects.Image | null = null; private gateBroken = false;
  /** 测试读。 */
  readonly stats = { built: false, assigned: 0, refills: 0, called: 0, autoSent: 0, autoBack: 0 };

  constructor(private readonly h: DefenseWallV2Host, start: Pt) {
    this.g = v2Geometry(start);
    const s = h.scene, need = (Object.keys(KEY) as Array<keyof typeof KEY>).filter(k => !s.textures.exists(KEY[k]));
    if (!need.length) this.build();
    else { for (const k of need) s.load.image(KEY[k], FILE[k]); s.load.once('complete', () => { if (this.alive) this.build(); }); if (!s.load.isLoading()) s.load.start(); }
  }

  /** 碰撞框（墙身、内侧女墙留马道缺口、四面封边）。 */
  get footprints() { return this.g.boxes; }
  /** 主将在城头时镜头往城外（下方）让（zoom = 设计倍率、H = 设计画面高；见 data/defenseV2 cameraCenterY）。 */
  cameraBias(p: Pt, zoom: number, H: number): number { const c = cameraCenterY(this.g, p, zoom, H); return c === null ? 0 : c - p.y; }
  isOutside(p: Pt): boolean { return isOutside(this.g, p); }
  spawnPoint(): Pt { const S = DEFENSE_V2.spawn, x = S.xs[Math.floor(Math.random() * S.xs.length)]; return { x: this.g.gx + x + (Math.random() - .5) * 2 * S.jitter, y: this.g.F + S.dy + (Math.random() - .5) * 120 }; }
  bossPoint(): Pt { return { x: this.g.gx, y: this.g.F + DEFENSE_V2.spawn.bossDy }; }

  // ———— 我方士兵上墙 ————
  /** 开局分岗（所有在编的兵），并直接放到岗位上（守城开打时守军已经在墙上）。 */
  assignAll(place = true): void {
    const units = this.h.units().filter(u => u.active);
    const map = assignPosts(units.map(u => ({ id: u.id, kind: u.kind, ranged: !!u.def.ranged, garrison: u.garrison })), this.g);
    this.slots.clear();
    for (const u of units) { const post = map.get(u.id); if (!post) continue; this.slots.set(u, { post, life: u.lifeId }); if (place) { u.setPosition(post.x, post.y); u.ai.x = post.x; u.ai.y = post.y; u.ai.nextThink = 0; } }
    this.stats.assigned = this.slots.size;
  }
  /** 这个兵现在该去哪（Legion.postOf）：有岗位就去岗位（城里 ↔ 城头走马道）；新来的兵进预备队。 */
  postOf(u: Ally): Pt | null {
    let s = this.slots.get(u);
    if (!s || s.life !== u.lifeId) { s = { post: this.reserveSlot(), life: u.lifeId }; this.slots.set(u, s); }
    return nextWaypoint(this.g, u, s.post);
  }
  /** 城头远程兵射程（居高临下，data height）：垛口位 ×crenelRange（够得到墙脚以外）；走道上别的远程兵 ×down.range。 */
  rangeMul(u: Ally): number { const H = DEFENSE_V2.height, s = this.slots.get(u); if (s && s.life === u.lifeId && s.post.kind === 'crenel') return H.crenelRange; return u.def.ranged && onWalk(this.g, u) ? H.down.range : 1; }
  /** 站在某类岗位（某段）上的兵（活着、岗位没换过）。 */
  holders(kind: PostKind, seg?: number): Ally[] { const out: Ally[] = []; for (const [u, s] of this.slots) if (s.post.kind === kind && (seg === undefined || s.post.seg === seg) && u.active && s.life === u.lifeId) out.push(u); return out; }
  /** 这个兵的岗位（测试 / 守城道具用）。 */
  postFor(u: Ally): Post | null { const s = this.slots.get(u); return s && s.life === u.lifeId ? s.post : null; }
  /**
   * 城防补员（喘息时）：新来的城防弓手按空着的垛口位分（前排先）、门楼守军回门楼平台，从城里走马道上去；没空位就进预备队。返回上墙几个。
   */
  addGarrison(units: readonly Ally[]): number {
    let n = 0; const free = this.g.posts.filter(p => p.kind === 'crenel' && !this.holder(p)).sort((a, b) => b.y - a.y), gates = this.g.posts.filter(p => p.kind === 'gate' && !this.holder(p));
    for (const u of units) { const post = u.def.ranged ? free.shift() : gates.shift(); this.slots.set(u, { post: post ?? this.reserveSlot(), life: u.lifeId }); u.ai.nextThink = 0; if (post) n++; }
    return n;
  }
  private reserveSlot(): Post { const used = new Set([...this.slots.values()].filter(v => v.post.kind === 'reserve').map(v => v.post.x + ',' + v.post.y)); for (let i = 0; i < 64; i++) { const r = this.g.reserve(i); if (!used.has(r.x + ',' + r.y)) return { kind: 'reserve', seg: -1, x: r.x, y: r.y }; } const r = this.g.reserve(0); return { kind: 'reserve', seg: -1, x: r.x, y: r.y }; }
  private holder(post: Post): Ally | null { for (const [u, s] of this.slots) if (s.post === post && u.active && s.life === u.lifeId) return u; return null; }
  private reserveUnits(ranged: boolean): Ally[] { const out: Ally[] = []; for (const [u, s] of this.slots) if (s.post.kind === 'reserve' && u.active && s.life === u.lifeId && !!u.def.ranged === ranged && u.kind !== 'rider' && u.kind !== 'medic') out.push(u); return out; }
  /** 预备队补位：梯口 / 马道口 / 垛口空了，就从预备队挑最近的一个上去（每 refillMs 一个）。 */
  /** paused = 出城冲阵中（门开着，预备队守门洞，不上城补位）。 */
  update(now: number, paused = false): void {
    if (paused || now < this.refillAt) return; this.refillAt = now + DEFENSE_V2.refillMs;
    for (const post of this.g.posts) {
      if (this.holder(post)) continue;
      const pool = this.reserveUnits(post.kind === 'crenel'); if (!pool.length) continue;
      pool.sort((a, b) => Math.hypot(a.x - post.x, a.y - post.y) - Math.hypot(b.x - post.x, b.y - post.y));
      this.slots.set(pool[0], { post, life: pool[0].lifeId }); pool[0].ai.nextThink = 0; this.stats.refills++;
      return; // 每次只补一个
    }
  }
  /** E：预备队里最多 callReserve 个近战上城，去主将所在这段的梯口两侧（临时岗位）。返回上来几个。 */
  /**
   * E（借鉴清单第 1 条改成紧急手段）：预备队全体——门内的近战，加上自动派去别段的增援——立刻压到主将这段。返回上来几个。
   */
  callReserve(x: number): number {
    const seg = segmentAt(this.g, x), pool = [...this.reserveUnits(false), ...this.autoUnits().filter(([, s]) => s.post.seg !== seg.i).map(([u]) => u)];
    pool.forEach((u, k) => { this.slots.set(u, { post: this.extraPost(seg, k, pool.length), life: u.lifeId }); u.ai.nextThink = 0; });
    this.stats.called += pool.length;
    this.h.banner(pool.length ? `预备队全体压上 · ${pool.length} 人` : '预备队已空', !pool.length, pool.length ? `去第 ${seg.i + 1} 段` : '城头的兵死了会从预备队补；战斗支援的新兵也进预备队', pool.length ? `预备队 ${pool.length} 人压上` : '预备队已空');
    return pool.length;
  }
  /** 第 k 个（共 n 个）增援在这段的站位：梯口两侧往外排，两排错开。 */
  private extraPost(seg: Segment, k: number, n: number): Post { const half = (seg.x1 - seg.x0) / 2 - 24, dx = Math.max(-half, Math.min(half, (k - (n - 1) / 2) * 34)); return { kind: 'extra', seg: seg.i, x: seg.ladderX + dx, y: this.g.W - (k % 2 ? 122 : 150) }; }
  private autoUnits(): Array<[Ally, Slot]> { return [...this.slots].filter(([u, s]) => s.auto && s.post.kind === 'extra' && u.active && s.life === u.lifeId); }
  /**
   * 预备队按威胁自动增援（借鉴清单第 1 条）：threats = 各段威胁（DefenseAssaultV2.threats）；每 checkMs 一次，
   * 威胁段派 v2ReinforceNeed 个近战过去（从离那段最近的预备队挑），威胁没了就回预备队。出城中（paused）不动。
   */
  autoReinforce(threats: readonly number[], now: number, paused = false): void {
    if (paused || now < this.reinforceAt) return; this.reinforceAt = now + DEFENSE_V2.reinforce.checkMs;
    for (const seg of this.g.segs) {
      const need = v2ReinforceNeed(threats[seg.i] ?? 0), sent = this.autoUnits().filter(([, s]) => s.post.seg === seg.i);
      for (const [u] of sent.slice(need)) { this.slots.set(u, { post: this.reserveSlot(), life: u.lifeId }); u.ai.nextThink = 0; this.stats.autoBack++; }
      for (let k = sent.length; k < need; k++) {
        const pool = this.reserveUnits(false); if (!pool.length) return;
        pool.sort((a, b) => Math.abs(a.x - seg.ladderX) - Math.abs(b.x - seg.ladderX)); const u = pool[0];
        this.slots.set(u, { post: this.extraPost(seg, k, need), life: u.lifeId, auto: true }); u.ai.nextThink = 0; this.stats.autoSent++;
      }
    }
  }
  /** 城门破了 / 堵上了：门楼两层一起换图（破门版：门板撞碎、门洞是暗通道），分层不变。墙图还没载入完就先记着，摆出来时再换。 */
  setGateBroken(on: boolean): void {
    this.gateBroken = on; const key = on ? KEY.gateBroken : KEY.gate, A = DEFENSE_V2.art.gate;
    if (!this.h.scene.textures.exists(key)) return;
    this.gateBack?.setTexture(key); if (this.gateFront) { this.gateFront.setTexture(key); this.gateFront.setCrop(0, A.crenel, A.w, A.h - A.crenel); }
  }
  /** 测试读：门楼现在用的贴图。 */
  get gateTexture(): string { return this.gateBack?.texture.key ?? ''; }
  /** 岗位一览（测试 / 截图用）。 */
  postsInfo(): Array<{ kind: string; seg: number; held: boolean }> { return this.g.posts.map(p => ({ kind: p.kind, seg: p.seg, held: !!this.holder(p) })); }

  // ———— 画面 ————
  private build(): void {
    const s = this.h.scene, g = this.g, A = DEFENSE_V2.art; if (!s.sys || s.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
    const sc = (g.F - (g.W - A.crenelOver)) / (A.seg.ground - A.seg.crenel); // 墙段缩放：外侧城垛顶在 W − crenelOver、墙脚在 F
    const pieceW = A.seg.w * sc, step = pieceW - 40;
    // 走道：walkway_a / b 横拼成一张（a、b 交替），1:1 横铺；图上沿（内侧女墙顶）对齐门楼后排女墙顶 walkTop（≈ 端头后排矮城垛顶，三条线之一），多出的压在外侧城垛后面
    const WK = A.walkway, walkKey = this.walkKey;
    if (!s.textures.exists(walkKey)) {
      const tex = s.textures.createCanvas(walkKey, WK.w * 2, WK.h)!, c = tex.context;
      c.drawImage(s.textures.get(KEY.walkA).getSourceImage() as HTMLImageElement, 0, 0); c.drawImage(s.textures.get(KEY.walkB).getSourceImage() as HTMLImageElement, WK.w, 0); tex.refresh();
    }
    // 城门楼那一截不铺（门楼图自带楼前平台；后排女墙垛口缺口里该看见城里的地，不是走道的女墙顶），两段的纹理接着 X0 对齐
    const gHalf = A.gate.w * ((g.F - (g.W - A.crenelOver)) / (A.gate.ground - A.gate.crenel)) / 2 - 12;
    const under = DEFENSE_V2.layout.endUnder;
    for (const [x0, x1] of [[g.X0 - under, g.gx - gHalf], [g.gx + gHalf, g.X1 + under]]) this.art.push(s.add.tileSprite((x0 + x1) / 2, g.walkTop + WK.h / 2, x1 - x0, WK.h, walkKey).setTilePosition(x0 - g.X0, 0).setDepth(DEPTH.ground + 2).setName('defv2-walk'));
    // 下城直梯（美术组 stair_down）：女墙带在缺口处让开（栏墙外缘那么宽，换成路面），直梯图底边对齐走道石板上沿 stairB、往城里（上方）伸；画在地面层，人都在它上面（深度按 y 正常排）
    { const S = A.stair, cw = S.rail[1] - S.rail[0];
      for (const r of g.ramps) {
        this.art.push(s.add.tileSprite(r, g.walkTop + WK.band / 2, cw, WK.band, walkKey).setTilePosition(r - cw / 2 - g.X0, WK.band + 60).setDepth(DEPTH.ground + 2.5).setName('defv2-ramp-gap'));
        this.art.push(s.add.image(r, g.stairB, KEY.stair).setOrigin(S.cx / S.w, 1).setDepth(DEPTH.ground + 2.6).setName('defv2-stair'));
      } }
    // 外墙立面：墙段图从外侧城垛顶往下裁（城垛盖住走道南沿上站着的人的腿），墙脚对齐 F；从城门楼两侧往外排
    // 墙段从城门楼图的两边往外排（按图的实际半宽，和段的几何一致）
    const gs = (g.F - (g.W - A.crenelOver)) / (A.gate.ground - A.gate.crenel), gateHalf = Math.min(DEFENSE_V2.layout.gateHalf, A.gate.w * gs / 2);
    // 定宽场地：从门楼两边铺到走道两端再往里盖 40（压在角楼底下），最后一块按剩下的宽裁掉（不伸出地图边）
    const reach = DEFENSE_V2.layout.half + 40;
    for (const side of [-1, 1]) for (let a = gateHalf - 20; a < reach; a += step) {
      const tw = Math.min(pieceW, reach - a) / sc, im = s.add.image(g.gx + side * a, g.F, KEY.seg).setOrigin(side > 0 ? 0 : 1, A.seg.ground / A.seg.h).setScale(sc).setFlipX(side > 0).setDepth(actorDepth(g.W)).setName('defv2-face');
      im.setCrop(A.seg.w - tw, A.seg.crenel, tw, A.seg.h - A.seg.crenel); /* 两边都裁原图右端那截：右边这几块是翻转的（实测 Phaser 翻转后裁剪框按原图算），左边不翻、贴门楼的是右端 */ this.art.push(im);
    }
    // 城门楼（可通行版）：墙脚对齐 F，外侧城垛和墙段齐平。画两层：整张在走道上所有人身后（楼阁、后排女墙、楼前平台），
    // 从外侧城垛往下裁一层盖在墙段和走道南沿的人前面（门楼正面不被墙段盖住、城垛挡住腿）——人从楼前平台走过，楼阁在人后面
    { this.gateBack = s.add.image(g.gx, g.F, KEY.gate).setOrigin(.5, A.gate.ground / A.gate.h).setScale(gs).setDepth(actorDepth(g.top) - .01).setName('defv2-gate'); this.art.push(this.gateBack);
      const front = s.add.image(g.gx, g.F, KEY.gate).setOrigin(.5, A.gate.ground / A.gate.h).setScale(gs).setDepth(actorDepth(g.W) + .005).setName('defv2-gate-front');
      front.setCrop(0, A.gate.crenel, A.gate.w, A.gate.h - A.gate.crenel); this.art.push(front); this.gateFront = front; if (this.gateBroken) this.setGateBroken(true);
      // 门楼后排女墙（楼阁两侧）原图带垛口、走道图是平压顶，接缝处一边垛口一边平顶——两侧盖一条走道图的女墙带，内侧女墙一路平顶接过去（楼阁不盖）
      const half = A.gate.w * gs / 2, pav = (A.gate.pavR - A.gate.pavL) / 2 * gs;
      for (const [x0, x1] of [[g.gx - half, g.gx - pav], [g.gx + pav, g.gx + half]]) this.art.push(s.add.tileSprite((x0 + x1) / 2, g.walkTop + WK.band / 2, x1 - x0, WK.band, walkKey).setTilePosition(x0 - g.X0, 0).setDepth(actorDepth(g.top) - .009).setName('defv2-gate-parapet')); }
    // 城墙端头（美术组 wallend_left / right，替掉原来压在走道端头上的独立角楼）：接在走道两端，和墙段同缩放（图下沿对齐墙脚）。
    // 画两层（同门楼）：整张在走道上所有人身后（平台、后排矮城垛、角楼），从外侧城垛往下裁一层盖在人前面（城垛挡腿）。端头外沿就是场地左右边，再往外是边带山崖。
    { const W2 = A.wallend, es = (g.F - (g.W - A.crenelOver)) / (W2.h - W2.crenel);
      for (const side of [-1, 1] as const) {
        const key = side > 0 ? KEY.endR : KEY.endL, x = side > 0 ? g.X1 : g.X0, ox = side > 0 ? 0 : 1;
        const back = s.add.image(x, g.F, key).setOrigin(ox, 1).setScale(es).setDepth(actorDepth(g.top) - .01).setName('defv2-end');
        const front = s.add.image(x, g.F, key).setOrigin(ox, 1).setScale(es).setDepth(actorDepth(g.W) + .005).setName('defv2-end-front');
        front.setCrop(0, W2.crenel, W2.w, W2.h - W2.crenel); this.art.push(back, front);
      } }
    // 城内：府衙（siege_mid_hall 帧 0）
    if (s.textures.exists('siege_mid_hall')) this.art.push(s.add.image(g.keep.x, g.keep.y, 'siege_mid_hall', 0).setOrigin(.5, .85).setDisplaySize(280, 280).setDepth(actorDepth(g.keep.y)).setName('defv2-keep'));
    // 城外：敌营（siege_mid_ram 帧 7 营帐）
    if (s.textures.exists('siege_mid_ram')) for (const dx of DEFENSE_V2.spawn.xs) this.art.push(s.add.image(g.gx + dx, g.F + DEFENSE_V2.spawn.dy + 90, 'siege_mid_ram', 7).setOrigin(.5, .85).setDisplaySize(190, 190).setDepth(actorDepth(g.F + DEFENSE_V2.spawn.dy + 90)).setName('defv2-camp'));
    this.stats.built = true;
  }
  clear(): void { this.alive = false; this.gateBack = this.gateFront = null; for (const o of this.art) o.destroy(); this.art.length = 0; this.slots.clear(); }
}
