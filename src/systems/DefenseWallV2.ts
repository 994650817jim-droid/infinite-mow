import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import { DEFENSE_V2, assignPosts, cameraCenterY, isOutside, nextWaypoint, segmentAt, v2Geometry, type Post, type Pt, type V2Geo } from '../data/defenseV2';
import type { Ally } from '../entities/Ally';

/**
 * 守城 v2 场地（共享笔记 defense-redesign-v2.md v2.2；试玩版 a 段）：视角翻转——城外在下、外墙立面在中间、城头走道在墙顶、城内在最上方。
 * 墙图复用 2-3 洛阳那套 2.5D 城墙（siege-v2/luoyang：墙段 / 城门楼 / 角楼，正面朝城外），走道是同一张图里的石板带一条条往上铺（手绘图拼接，不是代码画的）。
 * 本段：场地与碰撞、镜头往城外让、刷兵口在城外、我方士兵自动上墙站垛口 / 梯口 / 马道口、预备队补位、E 叫预备队来主将这段。
 * 云梯 / 冲车 / 一键 F / 出城冲阵 / 府衙失守在 b、c 段接。
 */
export interface DefenseWallV2Host {
  scene: Phaser.Scene;
  player: () => Pt;
  units: () => readonly Ally[];
  banner: (title: string, danger: boolean, caption?: string) => void;
}
interface Slot { post: Post; life: number }

const KEY = { seg: 'luoyang_wall_seg', gate: 'luoyang_wall_gate', corner: 'luoyang_wall_corner' } as const;

export class DefenseWallV2 {
  readonly g: V2Geo;
  private readonly art: Phaser.GameObjects.GameObject[] = [];
  private readonly slots = new Map<Ally, Slot>();
  private refillAt = 0; private alive = true;
  /** 城门楼整张图（楼阁在走道上的那层）：有人走进门楼范围时半透明（新图到之前的过渡）。 */
  private gateBack: Phaser.GameObjects.Image | null = null; private gateHalfArt = 0;
  /** 走道贴图的纹理名（占段变红的那层复用）。 */
  readonly walkKey = 'defv2_walk';
  /** 测试读。 */
  readonly stats = { built: false, assigned: 0, refills: 0, called: 0 };

  constructor(private readonly h: DefenseWallV2Host, start: Pt) {
    this.g = v2Geometry(start);
    const s = h.scene, need = (Object.keys(KEY) as Array<keyof typeof KEY>).filter(k => !s.textures.exists(KEY[k]));
    if (!need.length) this.build();
    else { for (const k of need) s.load.image(KEY[k], DEFENSE_V2.art[k].file); s.load.once('complete', () => { if (this.alive) this.build(); }); if (!s.load.isLoading()) s.load.start(); }
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
    const map = assignPosts(units.map(u => ({ id: u.id, kind: u.kind, ranged: !!u.def.ranged })), this.g);
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
  /** 垛口上的远程兵射程加长（够得到墙脚）。 */
  rangeMul(u: Ally): number { const s = this.slots.get(u); return s && s.life === u.lifeId && s.post.kind === 'crenel' ? DEFENSE_V2.wallRangeMul : 1; }
  private reserveSlot(): Post { const used = new Set([...this.slots.values()].filter(v => v.post.kind === 'reserve').map(v => v.post.x + ',' + v.post.y)); for (let i = 0; i < 64; i++) { const r = this.g.reserve(i); if (!used.has(r.x + ',' + r.y)) return { kind: 'reserve', seg: -1, x: r.x, y: r.y }; } const r = this.g.reserve(0); return { kind: 'reserve', seg: -1, x: r.x, y: r.y }; }
  private holder(post: Post): Ally | null { for (const [u, s] of this.slots) if (s.post === post && u.active && s.life === u.lifeId) return u; return null; }
  private reserveUnits(ranged: boolean): Ally[] { const out: Ally[] = []; for (const [u, s] of this.slots) if (s.post.kind === 'reserve' && u.active && s.life === u.lifeId && !!u.def.ranged === ranged && u.kind !== 'rider' && u.kind !== 'medic') out.push(u); return out; }
  /** 预备队补位：梯口 / 马道口 / 垛口空了，就从预备队挑最近的一个上去（每 refillMs 一个）。 */
  update(now: number, dt = 1 / 60): void {
    this.fadeGate(dt);
    if (now < this.refillAt) return; this.refillAt = now + DEFENSE_V2.refillMs;
    for (const post of this.g.posts) {
      if (this.holder(post)) continue;
      const pool = this.reserveUnits(post.kind === 'crenel'); if (!pool.length) continue;
      pool.sort((a, b) => Math.hypot(a.x - post.x, a.y - post.y) - Math.hypot(b.x - post.x, b.y - post.y));
      this.slots.set(pool[0], { post, life: pool[0].lifeId }); pool[0].ai.nextThink = 0; this.stats.refills++;
      return; // 每次只补一个
    }
  }
  /** E：预备队里最多 callReserve 个近战上城，去主将所在这段的梯口两侧（临时岗位）。返回上来几个。 */
  callReserve(x: number): number {
    const seg = segmentAt(this.g, x), pool = this.reserveUnits(false).slice(0, DEFENSE_V2.callReserve);
    pool.forEach((u, k) => { const dx = (k - (pool.length - 1) / 2) * 52; this.slots.set(u, { post: { kind: 'extra', seg: seg.i, x: seg.ladderX + dx, y: this.g.W - 150 }, life: u.lifeId }); u.ai.nextThink = 0; });
    this.stats.called += pool.length;
    this.h.banner(pool.length ? '预备队上城' : '预备队已空', !pool.length, pool.length ? `${pool.length} 人去第 ${seg.i + 1} 段梯口` : '城头的兵死了会从预备队补；战斗支援的新兵也进预备队');
    return pool.length;
  }
  /** 城门楼过渡：主将或任何士兵站在门楼范围的走道上 → 楼阁淡到 gateFade.alpha（人画在楼阁上层，看着不像在屋顶上走）。 */
  private fadeGate(dt: number): void {
    const im = this.gateBack; if (!im?.active) return; const F = DEFENSE_V2.gateFade, g = this.g, half = this.gateHalfArt + F.pad;
    const inside = (p: Pt) => Math.abs(p.x - g.gx) < half && p.y > g.top - 30 && p.y < g.W + 6;
    const busy = inside(this.h.player()) || this.h.units().some(u => u.active && inside(u));
    const target = busy ? F.alpha : 1; im.setAlpha(im.alpha + (target - im.alpha) * Math.min(1, F.lerp * dt));
  }
  /** 测试读：门楼楼阁当前透明度。 */
  get gateAlpha(): number { return this.gateBack?.alpha ?? 1; }
  /** 岗位一览（测试 / 截图用）。 */
  postsInfo(): Array<{ kind: string; seg: number; held: boolean }> { return this.g.posts.map(p => ({ kind: p.kind, seg: p.seg, held: !!this.holder(p) })); }

  // ———— 画面 ————
  private build(): void {
    const s = this.h.scene, g = this.g, A = DEFENSE_V2.art; if (!s.sys || s.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
    const segImg = s.textures.get(KEY.seg).getSourceImage() as HTMLImageElement;
    const sc = (g.F - (g.W - A.crenelOver)) / (A.seg.ground - A.seg.crenel); // 墙段缩放：外侧城垛顶在 W − crenelOver、墙脚在 F
    const pieceW = A.seg.w * sc, step = pieceW - 40;
    // 走道（过渡，俯视走道条到图前）：同一张图里的石板带一条条往上铺成 walk 高。只取石板带中间（两端斜边、上沿阴影线不要——
    // 原来连这几处一起铺，铺出来是一排排楔形深缝和横条）；每条错开 + 左右镜像 / 上下镜像交替，看不出是同一条重复
    const walkKey = this.walkKey, innerKey = 'defv2_inner', B = A.walkBand, bw = B.x1 - B.x0, bh = B.y1 - B.y0, band = Math.round(bh * sc), tw = Math.round(bw * sc);
    if (!s.textures.exists(walkKey)) {
      const rows = Math.ceil((g.W - g.top + 40) / band), H = rows * band, tex = s.textures.createCanvas(walkKey, tw, H)!, c = tex.context;
      c.fillStyle = '#a19d90'; c.fillRect(0, 0, tw, H);
      for (let r = 0; r < rows; r++) {
        const off = (r * 389) % tw, fx = r % 2 === 1, fy = r % 3 === 1;
        for (const dx of [-off, tw - off]) { c.save(); c.translate(dx + (fx ? tw : 0), r * band + (fy ? band : 0)); c.scale(fx ? -1 : 1, fy ? -1 : 1); c.drawImage(segImg, B.x0, B.y0, bw, bh, 0, 0, tw, band); c.restore(); }
      }
      tex.refresh();
    }
    if (!s.textures.exists(innerKey)) { const ih = Math.ceil(A.seg.walkTop * sc), iw = Math.round(pieceW), tex = s.textures.createCanvas(innerKey, iw, ih)!; tex.context.drawImage(segImg, 0, 0, A.seg.w, A.seg.walkTop, 0, 0, iw, ih); tex.refresh(); }
    const wallW = g.X1 - g.X0;
    this.art.push(s.add.tileSprite((g.X0 + g.X1) / 2, (g.top + g.W) / 2 + 10, wallW, g.W - g.top + 20, walkKey).setDepth(DEPTH.ground + 2).setName('defv2-walk'));
    const ih = A.seg.walkTop * sc;
    this.art.push(s.add.tileSprite((g.X0 + g.X1) / 2, g.top - ih / 2 + 6, wallW, ih, innerKey).setDepth(actorDepth(g.top - 2)).setName('defv2-inner'));
    // 外墙立面：墙段图从外侧城垛顶往下裁（城垛盖住走道南沿上站着的人的腿），墙脚对齐 F；从城门楼两侧往外排
    const face = (x: number, flip: boolean): void => {
      const im = s.add.image(x, g.F, KEY.seg).setOrigin(.5, A.seg.ground / A.seg.h).setScale(sc).setFlipX(flip).setDepth(actorDepth(g.W)).setName('defv2-face');
      im.setCrop(0, A.seg.crenel, A.seg.w, A.seg.h - A.seg.crenel); this.art.push(im);
    };
    // 墙段从城门楼图的两边往外排（按图的实际半宽，和段的几何一致；原来用数据里的 gateHalf，墙面低了以后门楼变窄，中间漏出一截地面）
    const gateHalf = Math.min(DEFENSE_V2.layout.gateHalf, A.gate.w * ((g.F - (g.W - A.crenelOver)) / (A.gate.ground - A.gate.crenel)) / 2);
    for (const side of [-1, 1]) for (let x = gateHalf - 20 + pieceW / 2; x - pieceW / 2 < DEFENSE_V2.layout.half; x += step) face(g.gx + side * x, side > 0);
    // 城门楼：墙脚对齐 F，外侧城垛和墙段齐平。画两层（同 2-3 洛阳）：整张在走道上的人身后（人走过门楼看得见），
    // 从外侧城垛往下裁一层盖在墙段和走道南沿的人前面（门楼正面不被墙段盖住、城垛挡住腿）
    { const gs = (g.F - (g.W - A.crenelOver)) / (A.gate.ground - A.gate.crenel);
      this.gateBack = s.add.image(g.gx, g.F, KEY.gate).setOrigin(.5, A.gate.ground / A.gate.h).setScale(gs).setDepth(actorDepth(g.top) - .01).setName('defv2-gate'); this.art.push(this.gateBack); this.gateHalfArt = A.gate.w * gs / 2;
      const front = s.add.image(g.gx, g.F, KEY.gate).setOrigin(.5, A.gate.ground / A.gate.h).setScale(gs).setDepth(actorDepth(g.W) + .005).setName('defv2-gate-front');
      front.setCrop(0, A.gate.crenel, A.gate.w, A.gate.h - A.gate.crenel); this.art.push(front); }
    // 角楼：在墙两端外侧（不压走道）
    { const cs = (g.F - (g.W - A.crenelOver)) / (A.corner.ground - A.corner.crenel), half = A.corner.w * cs / 2;
      for (const [x, flip] of [[g.X0 - half + 10, false], [g.X1 + half - 10, true]] as const) this.art.push(s.add.image(x, g.F, KEY.corner).setOrigin(.5, A.corner.ground / A.corner.h).setScale(cs).setFlipX(flip).setDepth(actorDepth(g.W) + .01).setName('defv2-corner')); }
    // 城内：马道斜坡（siege_mid_city 帧 4）、府衙（siege_mid_hall 帧 0）
    if (s.textures.exists('siege_mid_city')) for (const x of g.ramps) this.art.push(s.add.image(x, g.innerTop + 8, 'siege_mid_city', 4).setOrigin(.5, .9).setDisplaySize(170, 170).setDepth(actorDepth(g.innerTop - 30)).setName('defv2-ramp'));
    if (s.textures.exists('siege_mid_hall')) this.art.push(s.add.image(g.keep.x, g.keep.y, 'siege_mid_hall', 0).setOrigin(.5, .85).setDisplaySize(280, 280).setDepth(actorDepth(g.keep.y)).setName('defv2-keep'));
    // 城外：敌营（siege_mid_ram 帧 7 营帐）
    if (s.textures.exists('siege_mid_ram')) for (const dx of DEFENSE_V2.spawn.xs) this.art.push(s.add.image(g.gx + dx, g.F + DEFENSE_V2.spawn.dy + 90, 'siege_mid_ram', 7).setOrigin(.5, .85).setDisplaySize(190, 190).setDepth(actorDepth(g.F + DEFENSE_V2.spawn.dy + 90)).setName('defv2-camp'));
    this.stats.built = true;
  }
  clear(): void { this.alive = false; this.gateBack = null; for (const o of this.art) o.destroy(); this.art.length = 0; this.slots.clear(); }
}
