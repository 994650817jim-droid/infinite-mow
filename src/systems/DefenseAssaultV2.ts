import Phaser from 'phaser';
import { DEPTH, FONT, GAME_WIDTH, actorDepth } from '../config';
import { DEFENSE_V2, climbSpeed, spotAt, v2Engines, v2Phase, v2Spots, v2WaveReward, walkSegment, type Pt, type V2Geo, type V2SpotKind } from '../data/defenseV2';
import { isRangedSpawn } from '../data/gateSpawn';
import type { Enemy } from '../entities/Enemy';
import type { Ally } from '../entities/Ally';

/**
 * 守城 v2 试玩版 b 段（共享笔记 defense-redesign-v2.md v2.2 第二、四、六节；按 3 天砍版）：
 * - 云梯车从城外开到墙脚某段 → 墙脚亮圈 → 梯子立在外墙面上 → 墙脚排队的近战兵一个接一个沿梯子往上爬（过渡：用敌兵背面行走帧往上挪，
 *   不是手绘攀爬帧）→ 翻上垛口落到走道上，和梯口驻守 / 主将近战（不做翻垛口 0.6 秒停顿）。
 * - 占段：一段里我方士兵全没了、且这段城头敌兵 ≥ 3 → 这段走道变红、这段梯子上人 ×2；这段敌兵清光即夺回（预备队照常自动补位）。
 * - 一键 F（头顶提示）：梯口推梯（梯上的人摔下城）、滚木架放滚木（砸这段的梯子 + 墙脚）、门楼油锅泼油（门前一片持续烧，专克冲车）、门楼内侧修门（站定读条）。
 * - 冲车开到门前撞门（第二战线）；城外近战每 3 个有 1 个（骑兵全部）去砍门；攻城主将先砍门。门破了先只报「城门被破」（敌兵进城、退守府衙在 c 段接）。
 * - 主将近战把走道南沿的普通兵打下城 → 摔死（精英 / 首领不会）。
 * 特效全用现有手绘图 / 序列帧（云梯车、冲车、滚木堆、地火、水墨圈），不画代码像素特效。数值全在 data/defenseV2.ts DEFENSE_V2.assault。
 */
export interface AssaultHost {
  scene: Phaser.Scene;
  g: V2Geo;
  player: () => Pt & { alive?: boolean };
  units: () => readonly Ally[];
  enemies: () => readonly Enemy[];
  now: () => number;
  elapsed: () => number;
  tier: 'small' | 'medium' | 'large';
  /** 器械（云梯车 / 冲车）：可被武器打的高耐久物件。 */
  spawnTarget: (x: number, y: number, hp: number, size: number, tex: string, frame: number) => Enemy | null;
  hit: (e: Enemy, dmg: number) => void;
  /** 直接击杀（摔下城）：走正常击杀结算（经验 / 掉落 / 战功）。 */
  kill: (e: Enemy) => void;
  advance: (e: Enemy, nx: number, ny: number, dt: number) => void;
  hpScale: () => number;
  /** 横幅：short = 同类提示第二次起只出这句短的（总制作人 b 段验收第 3 条）。 */
  banner: (t: string, danger: boolean, c?: string, short?: string) => void;
  sfx: (k: string) => void;
  /** 走道贴图纹理（占段变红那层复用）。 */
  walkKey: string;
  // ———— c 段 ————
  /** 这一场几波（按城池档）。 */
  waves: number;
  /** 跳过喘息：把关内时间拨到 sec。 */
  skipTo: (sec: number) => void;
  /** 守满末波 / 府衙失守。 */
  win: () => void; lose: () => void;
  /** 随军粮（守得干净有奖）；部曲伤害临时加成（mul，到 untilSec 关内秒数为止）。 */
  gainFood: (n: number) => void; allyBuff: (mul: number, untilSec: number) => void;
  /** 主将传送（出城 / 回城 / 门楼楼梯）；出城那一刻：兵器冷却清零、移速加成。 */
  teleport: (x: number, y: number) => void; heroBoost: (speedMul: number, sec: number) => void;
  /** 首次引导卡（每个 key 只出一次）。 */
  guide: (key: string) => void;
  /** 实心布景（府衙）登记进场景碰撞。 */
  block: (img: Phaser.GameObjects.Image, frameKey: string) => void;
  /** 手绘序列帧特效（木屑 / 尘土）；没载入就不放。 */
  fx: (key: string, x: number, y: number, size: number, depth: number) => void;
  /** Space 是否刚按下（喘息时跳过）。 */
  skipPressed: () => boolean;
}
type LadderState = 'drive' | 'warn' | 'up' | 'down';
interface Ladder { seg: number; x: number; cart: Enemy; life: number; state: LadderState; until: number; img: Phaser.GameObjects.Image | null; ring: Phaser.GameObjects.Image | null; label: Phaser.GameObjects.Text; next: number; climbers: Set<Enemy> }
interface Ram { e: Enemy; life: number; x: number; y: number; next: number; label: Phaser.GameObjects.Text; atGate: boolean }

/** 梯身取云梯车图（siege_mid_ladder 帧 0）梯子最上面那截：顶端一截 + 一档横杆一节竖着平铺（下面那截后面压着车篷，不取）。 */
const LADDER_CROP = { x: 103, w: 52, capY: 5, capH: 20, y: 25, h: 18, scale: .6 } as const;
/** 背面冲车（撞锤朝上、朝城门开）：车轮底边在格内 y = 244；行进时上下颠 bob 像素、撞门那一下往城门冲 lunge 像素再回弹。 */
const RAM_BACK = { key: 'defv2_ram_back', file: 'assets/siege-v2/defense-v2/ram_back.png', foot: 244 / 256, bob: 1.5, lunge: 9 } as const;

export class DefenseAssaultV2 {
  readonly gate: { hp: number; max: number; open: boolean };
  private ladders: Ladder[] = []; private rams: Ram[] = [];
  private climbing = new Map<Enemy, { lad: Ladder; life: number }>(); private falling = new Map<Enemy, number>();
  private atGate = new Map<Enemy, number>();
  private captured = [false, false, false, false]; private overlays: Array<Phaser.GameObjects.TileSprite | null> = [null, null, null, null]; private checkAt = 0;
  private logs: number[]; private oil: { charges: number; cd: number };
  private burning: { until: number; next: number; fires: Phaser.GameObjects.Sprite[] } | null = null;
  private channel: { start: number; x: number; y: number } | null = null; private repairCd = 0;
  // ———— c 段：波次 / 出城 / 府衙 ————
  /** 当前第几波（0 起）、阶段；这一波排好的器械（关内秒数）。 */
  wave = 0; phase: 'attack' | 'rest' | 'final' | 'done' = 'attack'; private phaseKey = ''; private queue: Array<{ at: number; kind: 'ladder' | 'ram' }> = [];
  /** 出城砸掉的云梯车（下一波少几架）；这一波不再立梯的段；这一波不再来冲车。 */
  private ladderCut = 0; private nextCut = 0; private segBlocked = [-1, -1, -1, -1]; private ramCutWave = -1;
  /** 这一波失守过的段（守得干净有奖）。 */
  private waveLost = new Set<number>();
  /** 出城冲阵：哪一波用过、开着到几时（combatNow）。 */
  private sortie = { usedWave: -1, open: false, until: 0 };
  /** 府衙耐久；城里砍府衙的人（最后一次贴上来的时刻）。 */
  readonly keep: { hp: number; max: number }; private atKeep = new Map<Enemy, number>(); private keepBar: Phaser.GameObjects.Graphics; private keepText: Phaser.GameObjects.Text; private keepBlocked = false;
  /** 屏幕顶一行状态（喘息 / 出城时）；门楼上的出城倒计时。 */
  private status: Phaser.GameObjects.Text; private gateCount: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text; private bar: Phaser.GameObjects.Graphics; private barText: Phaser.GameObjects.Text;
  private objs: Phaser.GameObjects.GameObject[] = []; private done = false; private gateWarn = 1;
  /** F 位的小字签（滚木 / 热油 / 修门）：主将走近时收起，头顶只留当前会触发的那一个提示（b 段验收第 4 条）。 */
  private spotLabels: Array<{ o: Phaser.GameObjects.Text; x: number; y: number }> = [];
  /** 测试读。 */
  readonly stats = { ladders: 0, raised: 0, climbs: 0, landed: 0, pushed: 0, logs: 0, oil: 0, repairs: 0, rams: 0, ramHits: 0, gateHits: 0, fell: 0, captures: 0, retakes: 0, carts: 0, ramsBroken: 0, rewardFood: 0, sorties: 0, sortieKills: 0, passed: 0, keepHits: 0 };

  constructor(private readonly h: AssaultHost) {
    const A = DEFENSE_V2.assault, s = h.scene, g = h.g;
    this.gate = { hp: A.gate.hp[h.tier], max: A.gate.hp[h.tier], open: false };
    this.logs = g.segs.map(() => A.logs.charges); this.oil = { charges: A.oil.charges, cd: 0 };
    this.keep = { hp: DEFENSE_V2.keep.hp[h.tier], max: DEFENSE_V2.keep.hp[h.tier] };
    // 背面冲车（美术组 ram_back：一行 4 格，帧 0 / 1 行进、2 撞击预备、3 撞击前冲，车轮底边在格内 y = 244）
    if (!s.textures.exists(RAM_BACK.key)) { s.load.spritesheet(RAM_BACK.key, RAM_BACK.file, { frameWidth: 256, frameHeight: 256 }); if (!s.load.isLoading()) s.load.start(); }
    const sp = v2Spots(g), label = (x: number, y: number, t: string) => { const o = s.add.text(x, y, t, { fontFamily: FONT, fontSize: '13px', color: '#ffd28a', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 2); this.objs.push(o); return o; };
    // 滚木架（瓮城套件帧 5 滚木堆）、油锅位、修门位：一个小字签，不加框
    for (const r of sp.racks) { if (s.textures.exists('siege_mid_barb')) this.objs.push(s.add.image(r.x, r.y + 14, 'siege_mid_barb', 5).setOrigin(.5, .8).setDisplaySize(84, 84).setDepth(actorDepth(r.y)).setName('defv2-rack')); this.spotLabels.push({ o: label(r.x, r.y + 30, '滚木').setName('defv2-rack-label'), x: r.x, y: r.y }); }
    this.spotLabels.push({ o: label(sp.oil.x, sp.oil.y + 26, '热油').setName('defv2-oil-label'), x: sp.oil.x, y: sp.oil.y }, { o: label(sp.gate.x, sp.gate.y + 22, '修门').setName('defv2-gate-label'), x: sp.gate.x, y: sp.gate.y });
    this.prompt = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: '#ffe9bd', fontStyle: 'bold', resolution: 2, stroke: '#140d07', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText + 1).setVisible(false).setName('defv2-prompt');
    this.bar = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('defv2-gate-bar');
    this.barText = s.add.text(g.gx, g.F - 212, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe1a0', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-gate-text');
    this.objs.push(this.prompt, this.bar, this.barText);
    // 府衙血条（城里，府衙图上方）；城门内侧的楼梯口（F 上城头）
    this.keepBar = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('defv2-keep-bar');
    this.keepText = s.add.text(g.keep.x, g.keep.y + 70, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe1a0', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-keep-text');
    const st = this.citySpot(); this.spotLabels.push({ o: label(st.x, st.y + 22, '上城').setName('defv2-stair-label'), x: st.x, y: st.y });
    // 屏幕顶一行（计时器下方）：喘息 / 出城时的状态；门楼上的出城倒计时
    this.status = s.add.text(GAME_WIDTH / 2, DEFENSE_V2.notice.y, '', { fontFamily: FONT, fontSize: '15px', color: '#f3e3bf', fontStyle: 'bold', resolution: 2, stroke: '#140d07', strokeThickness: 4 }).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud + 1).setVisible(false).setName('defv2-status');
    this.gateCount = s.add.text(g.gx, g.F - 240, '', { fontFamily: FONT, fontSize: '18px', color: '#ffe9bd', fontStyle: 'bold', resolution: 2, stroke: '#140d07', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText).setVisible(false).setName('defv2-gate-count');
    this.objs.push(this.keepBar, this.keepText, this.status, this.gateCount);
  }
  /** 城门内侧的楼梯口（城里，门楼正下方）：F 上城头；门破后从门楼内侧 F 下到这里。 */
  private citySpot(): Pt { const g = this.h.g; return { x: g.gx, y: g.innerTop - DEFENSE_V2.keep.stairDy }; }
  /** 喘息中（不刷兵、梯子不上人、冲车不撞门）。 */
  get resting(): boolean { return this.phase === 'rest'; }
  /** 出城中（E 不可用、预备队不上城补位）。 */
  get sortieOpen(): boolean { return this.sortie.open; }
  /** 各段威胁（预备队按威胁自动增援）：立着的梯子 × ladder + 这段城头敌兵 + 失守 × lost。 */
  threats(): number[] {
    const R = DEFENSE_V2.reinforce;
    return this.h.g.segs.map(sg => this.ladders.filter(l => l.seg === sg.i && (l.state === 'up' || l.state === 'warn')).length * R.ladder + this.segFoes(sg.i) + (this.captured[sg.i] ? R.lost : 0));
  }
  /** 舆图：四段城头的状态、城门 / 府衙血量、云梯车 / 冲车位置。 */
  fort() {
    const g = this.h.g;
    return {
      walls: g.segs.map(sg => ({ x0: sg.x0, x1: sg.x1, y: g.W, state: (this.captured[sg.i] ? 'lost' : this.ladders.some(l => l.seg === sg.i && l.state !== 'drive') ? 'ladder' : 'ok') as 'ok' | 'ladder' | 'lost' })),
      gate: { x: g.gx, y: g.F, ratio: this.gate.hp / this.gate.max, open: this.gate.open }, keep: { x: g.keep.x, y: g.keep.y, ratio: this.keep.hp / this.keep.max },
      engines: [...this.ladders.filter(l => this.alive(l.cart, l.life)).map(l => ({ x: l.cart.x, y: l.cart.y, kind: 'ladder' as const })), ...this.rams.filter(r => this.alive(r.e, r.life)).map(r => ({ x: r.e.x, y: r.e.y, kind: 'ram' as const }))],
    };
  }

  // ———— 场景接口 ————
  /** 不受碰撞（正在爬 / 正在摔的，人在墙面上）。 */
  ghost(e: Enemy): boolean { return this.climbing.has(e) || this.falling.has(e); }
  /** 这段被占着（测试 / 舆图用）。 */
  get segmentsCaptured(): readonly boolean[] { return this.captured; }
  /** 屏边指示：在撞门的冲车、被占的段。 */
  guideTargets(): Array<{ key: string; x: number; y: number; label: string }> {
    const out: Array<{ key: string; x: number; y: number; label: string }> = [];
    for (const r of this.rams) if (r.atGate && this.alive(r.e, r.life)) out.push({ key: 'ram', x: r.e.x, y: r.e.y - 60, label: '冲车撞门' });
    this.captured.forEach((c, i) => { if (c) out.push({ key: 'seg' + i, x: this.h.g.segs[i].ladderX, y: this.h.g.W - 100, label: '城头失守' }); });
    return out;
  }
  snapshot() {
    return { gate: Math.round(this.gate.hp), gateMax: this.gate.max, gateOpen: this.gate.open, ladders: this.ladders.map(l => ({ seg: l.seg, state: l.state, climbers: l.climbers.size })), rams: this.rams.map(r => ({ atGate: r.atGate })),
      climbing: this.climbing.size, captured: [...this.captured], logs: [...this.logs], oil: this.oil.charges, stats: { ...this.stats } };
  }

  update(dt: number): void {
    if (this.done) return;
    const now = this.h.now(), el = this.h.elapsed(), A = DEFENSE_V2.assault;
    this.updateWaves(el);
    if (this.done) return;
    for (const q of [...this.queue]) if (el >= q.at) { this.queue.splice(this.queue.indexOf(q), 1); const ok = q.kind === 'ladder' ? this.spawnLadder() : this.spawnRam(); if (!ok && this.phase !== 'rest') this.queue.push({ at: el + 3, kind: q.kind }); } // 没地方（四段都有梯 / 冲车满了）：3 秒后再看
    this.updateLadders(now, dt); this.updateRams(now, dt); this.updateBurning(now); this.updateChannel(now); this.updateSortie(now);
    if (now >= this.checkAt) { this.checkAt = now + A.capture.checkMs; this.checkSegments(); }
    if (!this.gate.open && this.gate.hp <= 0) this.breakGate();
    if (!this.keepBlocked) { const img = this.h.scene.children.getByName('defv2-keep') as Phaser.GameObjects.Image | null; if (img) { this.keepBlocked = true; this.h.block(img, 'siege_mid_hall#0'); } } // 府衙大堂挡人（墙图异步载入，等它摆出来）
    if (this.keep.hp <= 0) { this.done = true; this.h.lose(); return; }
    this.paint(now);
  }

  // ———— 波次：攻 → 喘息（Space 跳过）→ … → 末波（攻城主将）；守满末波即胜 ————
  private updateWaves(el: number): void {
    const W = DEFENSE_V2.waves, ph = v2Phase(this.h.waves, el), key = ph.phase + ph.wave;
    if (key !== this.phaseKey) {
      const prev = this.phase; this.phaseKey = key; this.wave = ph.wave; this.phase = ph.phase;
      if (ph.phase === 'done') { this.done = true; this.h.win(); return; }
      if (ph.phase === 'rest') this.enterRest(); else this.enterAttack(ph.wave, ph.start, ph.phase === 'final');
      void prev;
    }
    if (ph.phase === 'rest' && this.h.skipPressed()) this.h.skipTo(ph.start + W.attackSec + W.restSec);
  }
  private enterAttack(i: number, start: number, final: boolean): void {
    const W = DEFENSE_V2.waves, n = v2Engines(i, this.nextCut); this.ladderCut = this.nextCut; this.nextCut = 0; this.waveLost.clear();
    this.queue = [];
    for (let k = 0; k < n.ladders; k++) this.queue.push({ at: start + W.ladderAt + k * W.ladderGap, kind: 'ladder' });
    for (let k = 0; k < n.rams; k++) this.queue.push({ at: start + W.ramAt + k * W.ramGap, kind: 'ram' });
    this.h.banner(final ? '末波 · 敌将来攻' : `第 ${i + 1}/${this.h.waves} 波 · 攻城`, true, final ? '守满这一波，或击败攻城主将' : `云梯车 ${n.ladders} 架${n.rams ? ` · 冲车 ${n.rams} 辆` : ''}${this.ladderCut ? `（出城砸掉的少了 ${this.ladderCut} 架）` : ''}`, final ? '末波 · 敌将来攻' : `第 ${i + 1}/${this.h.waves} 波`);
  }
  /** 喘息：结算这一波（守得干净有奖）、滚木 / 热油补满、器械不再来。 */
  private enterRest(): void {
    const A = DEFENSE_V2.assault, R = DEFENSE_V2.reward, W = DEFENSE_V2.waves, el = this.h.elapsed();
    this.queue = []; this.logs = this.logs.map(() => A.logs.charges); this.oil.charges = A.oil.charges; this.oil.cd = 0;
    const lost = this.waveLost.size, r = v2WaveReward(lost, this.gate.open ? 0 : this.gate.hp / this.gate.max); this.h.gainFood(r.food); this.stats.rewardFood += r.food;
    if (r.clean) this.h.allyBuff(R.cleanMul, el + W.restSec + W.attackSec);
    this.h.banner(r.clean ? `四段无失 · 赏粮 ${r.food}` : `失守 ${lost} 段 · 赏粮 ${r.food}`, false, (r.clean ? `下一波部曲伤害 +${Math.round((R.cleanMul - 1) * 100)}% · ` : '') + '喘息：滚木、热油补满 · Space 跳过', r.clean ? `四段无失 · 赏粮 ${r.food}` : `失守 ${lost} 段 · 赏粮 ${r.food}`);
    this.h.guide('rest');
  }

  // ———— 出城冲阵 ————
  /** 这一波还能不能出城（攻城 afterSec 秒后，或喘息时；每波一次；门没破、末波也行）。 */
  private sortieReady(): boolean {
    if (this.gate.open || this.sortie.open || this.sortie.usedWave === this.wave || this.phase === 'done') return false;
    const ph = v2Phase(this.h.waves, this.h.elapsed()); return ph.phase === 'rest' || this.h.elapsed() - ph.start >= DEFENSE_V2.sortie.afterSec;
  }
  private startSortie(): void {
    const S = DEFENSE_V2.sortie, g = this.h.g; this.sortie = { usedWave: this.wave, open: true, until: this.h.now() + S.durationSec * 1000 }; this.stats.sorties++;
    this.h.teleport(g.gx, g.F + S.outDy); this.h.heroBoost(S.speedMul, S.speedSec); this.h.sfx('gong');
    this.h.fx('fx_collapse_dust', g.gx, g.F + 20, 150, actorDepth(g.F) + .1);
    this.h.banner('出城冲阵！', true, `城门开 ${S.durationSec} 秒——砸云梯车、冲车，时间到前回到城门洞`, '出城冲阵');
  }
  /** 关门：回到门洞（回城头门楼内侧）或时间到被拉回。 */
  private endSortie(pulled: boolean): void {
    const g = this.h.g, sp = v2Spots(g).gate; this.sortie.open = false; this.h.teleport(sp.x, sp.y);
    this.h.banner(pulled ? '城门关了 · 拉回城内' : '回城 · 关门', !pulled ? false : true, undefined, pulled ? '城门关了' : '回城关门');
  }
  private updateSortie(now: number): void {
    if (!this.sortie.open) return; const g = this.h.g, p = this.h.player(), S = DEFENSE_V2.sortie;
    if (now >= this.sortie.until) { this.endSortie(true); return; }
    if (now > this.sortie.until - (S.durationSec - 1.2) * 1000 && Math.abs(p.x - g.gx) < S.returnR && p.y < g.F + 45) this.endSortie(false); // 刚出来那一秒不算回
  }

  // ———— 门破：敌兵穿门洞进城、砍府衙 ————
  /** 走到门洞，穿过去（门洞在城楼底下看不见：淡出，在城门内侧淡入）。 */
  private toArch(e: Enemy, dt: number): boolean {
    const g = this.h.g, K = DEFENSE_V2.keep, ax = g.gx + ((e.spawnId % 5) - 2) * 14, ay = g.F + 8;
    if (Math.hypot(ax - e.x, ay - e.y) > K.passR) return this.walk(e, ax, ay, dt, 2);
    const s = this.h.scene, life = e.spawnId; e.sprite.setPosition(ax, g.innerTop - K.insideDy).setAlpha(0); this.stats.passed++;
    s.tweens.add({ targets: e.sprite, alpha: 1, duration: 260, onUpdate: tw => { if (e.spawnId !== life) { tw.stop(); e.sprite.setAlpha(1); } } });
    return true;
  }
  /** 城里：离主将远（> raidDist）的去砍府衙（同时最多 cap 个），近的照常和主将打。 */
  private raid(e: Enemy, dt: number): boolean {
    const K = DEFENSE_V2.keep, g = this.h.g, p = this.h.player(); if (e.isSupplySlot || e.kind === 'boss' || Math.hypot(p.x - e.x, p.y - e.y) <= K.raidDist) return false;
    const kx = g.keep.x + ((e.spawnId % 7) - 3) * 22, ky = g.keep.y + 30, d = Math.hypot(kx - e.x, ky - e.y);
    if (d <= K.reach) { const now = this.h.now(); let n = 0; for (const [k, t] of this.atKeep) { if (!k.active || now - t >= 250) this.atKeep.delete(k); else if (k !== e) n++; } if (n < K.cap) { this.atKeep.set(e, now); this.keep.hp -= e.def.damage * K.contactMul * dt; this.stats.keepHits++; } e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    return this.walk(e, kx, ky, dt, 6);
  }

  // ———— 云梯 ————
  private alive(e: Enemy, life: number): boolean { return e.active && e.spawnId === life && e.hp > 0; }
  private spawnLadder(): boolean {
    const A = DEFENSE_V2.assault.ladder, g = this.h.g, s = this.h.scene;
    if (this.ladders.length >= A.max) return false;
    const free = g.segs.filter(sg => !this.ladders.some(l => l.seg === sg.i) && this.segBlocked[sg.i] !== this.wave); if (!free.length) return false; // 这一波砸掉过车的段不再立梯
    const sg = free[Math.floor(Math.random() * free.length)], x = sg.ladderX, y = g.F + DEFENSE_V2.spawn.dy - 80;
    const cart = this.h.spawnTarget(x, y, Math.round(A.hp * Math.sqrt(Math.max(1, this.h.hpScale()))), A.size, s.textures.exists('siege_mid_ladder') ? 'siege_mid_ladder' : 'sishui_props_refined', 0); if (!cart) return false;
    const label = s.add.text(x, y - A.size - 8, '云梯车', { fontFamily: FONT, fontSize: '14px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-ladder-label');
    this.ladders.push({ seg: sg.i, x, cart, life: cart.spawnId, state: 'drive', until: 0, img: null, ring: null, label, next: 0, climbers: new Set() });
    this.stats.ladders++; this.stats.carts++;
    if (this.stats.ladders === 1) this.h.banner('云梯车来了', true, '开到墙脚就立梯——站梯口按 F 推梯，或用滚木砸');
    return true;
  }
  private ladderTexture(): string {
    const s = this.h.scene, key = 'defv2_ladder', C = LADDER_CROP; if (s.textures.exists(key)) return key; if (!s.textures.exists('siege_mid_ladder')) return '';
    const src = s.textures.get('siege_mid_ladder').getSourceImage() as HTMLImageElement, g = this.h.g;
    const rows = Math.ceil(((g.F - (g.W - DEFENSE_V2.art.crenelOver) + 24) / C.scale - C.capH) / C.h), H = C.capH + rows * C.h;
    const tex = s.textures.createCanvas(key, C.w, H)!, c = tex.context;
    c.drawImage(src, C.x, C.capY, C.w, C.capH, 0, 0, C.w, C.capH);
    for (let r = 0; r < rows; r++) c.drawImage(src, C.x, C.y, C.w, C.h, 0, C.capH + r * C.h, C.w, C.h);
    tex.refresh(); return key;
  }
  /** 立梯：梯身贴在外墙面上，梯顶钩在外侧城垛上、梯脚落在墙脚。 */
  private raise(l: Ladder): void {
    const s = this.h.scene, g = this.h.g, key = this.ladderTexture(); l.state = 'up'; l.next = this.h.now() + 600; this.stats.raised++; this.h.guide('ladder');
    l.ring?.destroy(); l.ring = null; l.cart.sprite.setFrame(1);
    if (!key) return;
    const top = g.W - DEFENSE_V2.art.crenelOver - 12, hgt = g.F + 12 - top;
    if (!l.img) l.img = s.add.image(l.x, top, key).setOrigin(.5, 0).setDepth(actorDepth(g.W) + .003).setName('defv2-ladder');
    const im = l.img, sc = hgt / im.height; s.tweens.killTweensOf(im);
    im.setVisible(true).setAlpha(1).setPosition(l.x, top).setScale(sc, sc * .2);
    s.tweens.add({ targets: im, scaleY: sc, duration: 380, ease: 'Back.easeOut' });
  }
  /** 梯子倒（推梯 / 滚木）：往城外倒，梯上的人摔下去；车还在的话 raiseMs 后重新立。 */
  private topple(l: Ladder, why: 'push' | 'log'): number {
    const s = this.h.scene, g = this.h.g, n = l.climbers.size; l.state = 'down'; l.until = this.h.now() + DEFENSE_V2.assault.ladder.raiseMs; l.cart.sprite.setFrame(0);
    for (const c of [...l.climbers]) this.fall(c); l.climbers.clear();
    const im = l.img; if (im) { s.tweens.killTweensOf(im); s.tweens.add({ targets: im, y: g.F - 60, scaleY: im.scaleY * .18, alpha: 0, duration: 460, ease: 'Quad.easeIn', onComplete: () => im.setVisible(false) }); }
    if (why === 'push') { this.stats.pushed++; this.h.banner('推倒云梯', false, n ? `梯上 ${n} 人摔下城` : '车还在，过一会儿会再立起来'); }
    this.h.sfx('gong'); return n;
  }
  private updateLadders(now: number, dt: number): void {
    const A = DEFENSE_V2.assault.ladder, g = this.h.g, footY = g.F + A.footDy;
    for (const l of [...this.ladders]) {
      if (!this.alive(l.cart, l.life)) {
        this.wreck(l.x, footY, 'siege_mid_ladder', 3); for (const c of [...l.climbers]) this.fall(c); l.climbers.clear(); l.img?.destroy(); l.ring?.destroy(); l.label.destroy(); this.ladders.splice(this.ladders.indexOf(l), 1);
        this.segBlocked[l.seg] = this.wave; if (this.sortie.open) { this.nextCut++; this.stats.sortieKills++; } // 这一波这段不再立梯；出城砸掉的，下一波少一架
        this.h.banner('云梯车被毁', false, `第 ${l.seg + 1} 段这一波不会再立梯` + (this.sortie.open ? ' · 下一波少一架' : ''), '云梯车被毁'); continue;
      }
      const cart = l.cart;
      if (l.state === 'drive') {
        const y = Math.max(footY, cart.y - A.speed * dt); cart.sprite.setPosition(l.x, y).setDepth(actorDepth(y)); l.label.setPosition(l.x, y - A.size - 8);
        if (y <= footY) { l.state = 'warn'; l.until = now + A.warnMs; this.ringAt(l); }
        continue;
      }
      if (l.state === 'warn' && now >= l.until) { this.raise(l); continue; }
      if (l.state === 'down' && now >= l.until) { l.state = 'warn'; l.until = now + A.warnMs; this.ringAt(l); continue; }
      if (l.state !== 'up') continue;
      for (const c of l.climbers) if (!c.active) l.climbers.delete(c);
      if (this.resting) continue; // 喘息：梯子不上人
      // 上人：墙脚排队的近战兵里挑最近的一个；这段城头满 segCap 不上
      const fast = this.captured[l.seg] ? DEFENSE_V2.assault.capture.fastMul : 1;
      if (now < l.next || this.segFoes(l.seg) + l.climbers.size >= A.segCap) continue;
      let best: Enemy | null = null, bd = Infinity;
      for (const e of this.h.enemies()) { if (!this.climbable(e) || this.climbing.has(e) || this.falling.has(e)) continue; const dx = Math.abs(e.x - l.x), dy = e.y - g.F; if (dx > A.footReach || dy < -10 || dy > 120) continue; const d = dx + Math.abs(dy - 20); if (d < bd) { bd = d; best = e; } }
      if (!best) continue;
      l.next = now + A.climbGapMs / fast; l.climbers.add(best); this.climbing.set(best, { lad: l, life: best.spawnId }); this.stats.climbs++;
    }
  }
  /** 墙脚亮圈（水墨笔圈 siege_capture 帧 1，染红、一闪一闪）。 */
  private ringAt(l: Ladder): void {
    const s = this.h.scene, g = this.h.g; l.ring?.destroy(); l.ring = null; if (!s.textures.exists('siege_capture')) return;
    const r = s.add.image(l.x, g.F + 14, 'siege_capture', 1).setDisplaySize(150, 64).setTint(0xff6a4a).setAlpha(.9).setDepth(actorDepth(g.F) + .002).setName('defv2-ladder-ring');
    s.tweens.add({ targets: r, alpha: .35, duration: 300, yoyo: true, repeat: -1 }); l.ring = r;
  }
  private climbable(e: Enemy): boolean { return e.active && !e.isSupplySlot && e.hp > 0 && e.kind !== 'boss' && e.kind !== 'cavalry' && e.def.behavior !== 'wall' && !isRangedSpawn(e.kind, e.def); }
  /** 这段城头（走道上）的敌兵数（不含还在梯子上的）。 */
  private segFoes(seg: number): number { let n = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.hp > 0 && !this.climbing.has(e) && walkSegment(this.h.g, e) === seg) n++; return n; }
  /** 摔下城：普通兵摔死（正常击杀结算）；精英摔回墙脚、掉 35% 血；首领不会。 */
  private fall(e: Enemy): void {
    this.climbing.delete(e); if (!e.active || e.kind === 'boss' || this.falling.has(e)) return;
    const s = this.h.scene, g = this.h.g, life = e.spawnId, elite = e.kind === 'elite', A = DEFENSE_V2.assault.push;
    this.falling.set(e, life); this.stats.fell++;
    const tx = e.x + (Math.random() - .5) * 40, ty = g.F + 18 + Math.random() * 30, spin = (Math.random() < .5 ? -1 : 1) * (elite ? 0 : 75);
    s.tweens.add({ targets: e.sprite, x: tx, y: ty, angle: spin, duration: A.fallMs, ease: 'Quad.easeIn', onUpdate: tw => { if (e.spawnId !== life || !e.active) { tw.stop(); e.sprite.setAngle(0); this.falling.delete(e); } }, onComplete: () => {
      this.falling.delete(e); e.sprite.setAngle(0); if (!e.active || e.spawnId !== life) return;
      if (elite) this.h.hit(e, e.maxHp * .35); else this.h.kill(e);
    } });
  }

  // ———— 敌兵步进（场景 customEnemyStep 转来）————
  step(e: Enemy, dt: number): boolean {
    const c = this.climbing.get(e);
    if (c) {
      if (e.spawnId !== c.life || c.lad.state !== 'up') { this.climbing.delete(e); c.lad.climbers.delete(e); return false; }
      const g = this.h.g, sp = climbSpeed(g) * (this.captured[c.lad.seg] ? DEFENSE_V2.assault.capture.fastMul : 1), dy = sp * dt, tx = c.lad.x + ((e.spawnId % 3) - 1) * 5;
      e.sprite.x += (tx - e.x) * Math.min(1, 10 * dt); e.sprite.y -= dy;
      e.moveVx = 0; e.moveVy = -sp; e.intentDx = 0; e.intentDy = -dy; // 背面行走帧往上挪（过渡，不冒充手绘攀爬帧）
      if (e.y <= g.W - 26) { e.sprite.y = g.W - 26; this.climbing.delete(e); c.lad.climbers.delete(e); this.stats.landed++; } // 翻上垛口，落到走道上
      return true;
    }
    if (this.falling.has(e)) { e.moveVx = e.moveVy = 0; return true; }
    const g = this.h.g;
    if (e.y < g.innerTop - 4) return this.raid(e, dt); // 城里：离主将远的去砍府衙
    if (e.y < g.F - 24) return false; // 走道上：照常追人
    const A = DEFENSE_V2.assault;
    if (e.kind === 'cavalry' && e.active && !e.isSupplySlot) return this.gate.open ? this.toArch(e, dt) : this.toGate(e, dt, A.gate.contactMul); // 骑兵不爬梯：砍门；门破了穿门洞进城
    if (!this.climbable(e)) return false;
    if (this.gate.open && e.spawnId % 3 !== 0) return this.toArch(e, dt); // 门破了：三个里两个走门洞进城，一个照旧爬梯
    if (!this.gate.open && e.spawnId % A.gate.share === 0) return this.toGate(e, dt, A.gate.contactMul);
    // 排云梯：最近一架已经到墙脚的梯子，梯脚两侧排开等着
    let lad: Ladder | null = null, ld = Infinity; for (const l of this.ladders) if (l.state !== 'drive') { const d = Math.abs(l.x - e.x) + (l.state === 'up' ? 0 : 200); if (d < ld) { ld = d; lad = l; } }
    if (!lad) return false; // 还没有梯子：照常往主将那边挤（挤在墙脚）
    const qx = lad.x + ((e.spawnId % 9) - 4) * 17, qy = g.F + 22 + (e.spawnId % 3) * 15;
    return this.walk(e, qx, qy, dt, 12);
  }
  private walk(e: Enemy, x: number, y: number, dt: number, stop: number): boolean {
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d <= stop) { e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true;
  }
  /** 去门前砍门（门前同时最多 cap 个，多的在后面等）。 */
  private toGate(e: Enemy, dt: number, mul: number): boolean {
    const A = DEFENSE_V2.assault.gate, g = this.h.g, spread = ((e.spawnId % 9) - 4) * 20, gx = g.gx + spread, gy = g.F + 26 + (e.spawnId % 2) * 14;
    const d = Math.hypot(gx - e.x, gy - e.y);
    if (d <= A.reach) { if (this.slot(e, A.cap)) { this.atGate.set(e, this.h.now()); this.gate.hp -= e.def.damage * mul * dt; this.stats.gateHits++; } e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    return this.walk(e, gx, gy, dt, 4);
  }
  private slot(e: Enemy, cap: number): boolean {
    const now = this.h.now(); if (this.atGate.has(e) && now - (this.atGate.get(e) ?? 0) < 250) return true;
    let n = 0; for (const [k, t] of this.atGate) { if (!k.active || now - t >= 250) this.atGate.delete(k); else n++; }
    return n < cap;
  }
  /** 攻城主将：门没破先来砍门（× bossMul）；门破了交回原招式（进城在 c 段接）。 */
  bossStep(e: Enemy, dt: number): boolean {
    if (e.y < this.h.g.F - 24) return false;
    if (this.gate.open) return this.toArch(e, dt); // 门破了：攻城主将穿门洞进城，进城后交回原招式
    const A = DEFENSE_V2.assault.gate, g = this.h.g, d = Math.hypot(g.gx - e.x, g.F + 40 - e.y);
    if (d <= A.reach + 10) { this.gate.hp -= e.def.damage * A.contactMul * A.bossMul * dt; e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    return this.walk(e, g.gx, g.F + 40, dt, 4);
  }
  /** 主将近战打中走道南沿的普通兵（主将在它北边）→ 推下城。返回 true = 推下去了。 */
  tryPushOff(e: Enemy, from: Pt): boolean {
    const g = this.h.g, P = DEFENSE_V2.assault.push;
    if (!e.active || e.isSupplySlot || e.kind === 'elite' || e.kind === 'boss' || e.def.behavior === 'wall' || this.ghost(e)) return false;
    if (e.y < g.W - P.band || e.y > g.W || from.y > e.y - 8 || e.x < g.X0 || e.x > g.X1) return false;
    this.fall(e); return true;
  }

  // ———— 冲车 ————
  private spawnRam(): boolean {
    const A = DEFENSE_V2.assault.ram, g = this.h.g, s = this.h.scene;
    if (this.gate.open || this.rams.length >= A.max || this.ramCutWave === this.wave) return true; // 门破了 / 这一波的冲车被出城砸了：不再来（返回 true 不重排）
    const x = g.gx + (Math.random() - .5) * 60, y = g.F + DEFENSE_V2.spawn.dy - 60, back = s.textures.exists(RAM_BACK.key);
    const e = this.h.spawnTarget(x, y, Math.round(A.hp * Math.sqrt(Math.max(1, this.h.hpScale()))), A.size, back ? RAM_BACK.key : s.textures.exists('siege_mid_ram') ? 'siege_mid_ram' : 'sishui_props_refined', 0); if (!e) return false;
    if (back) e.sprite.setOrigin(.5, RAM_BACK.foot); // 车轮底边对齐落点
    const label = s.add.text(x, y - A.size - 8, '冲车', { fontFamily: FONT, fontSize: '14px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defv2-ram-label');
    this.rams.push({ e, life: e.spawnId, x, y, next: 0, label, atGate: false }); this.stats.rams++;
    this.h.banner('冲车来了', true, '撞城门——站门楼油锅按 F 泼热油（专克冲车）');
    return true;
  }
  private updateRams(now: number, dt: number): void {
    const A = DEFENSE_V2.assault.ram, g = this.h.g, s = this.h.scene, ty = g.F + A.footDy;
    for (const r of [...this.rams]) {
      if (!this.alive(r.e, r.life)) {
        this.wreck(r.x, ty, 'siege_mid_ram', 5); r.label.destroy(); this.rams.splice(this.rams.indexOf(r), 1); this.stats.ramsBroken++;
        if (this.sortie.open) { this.ramCutWave = this.wave; this.stats.sortieKills++; } // 出城砸掉：这一波不再来冲车
        this.h.banner('冲车被毁', false, this.sortie.open ? '这一波不会再来冲车' : undefined, '冲车被毁'); continue;
      }
      const back = r.e.sprite.texture.key === RAM_BACK.key;
      if (!r.atGate) { // 行进：帧 0 / 1 交替 + 随轮子节奏上下颠 1～2 像素
        r.y = Math.max(ty, r.y - A.speed * dt); const bob = back ? Math.sin(now / 95) * RAM_BACK.bob : 0;
        r.e.sprite.setPosition(r.x, r.y + bob).setDepth(actorDepth(r.y)); if (back) r.e.sprite.setFrame(Math.floor(now / 190) % 2); r.label.setPosition(r.x, r.y - A.size - 8); if (r.y <= ty) { r.atGate = true; this.h.guide('ram'); } continue;
      }
      if (this.gate.open || this.resting || this.sortie.open || now < r.next) continue; // 门破了 / 喘息 / 出城开着门：不撞
      r.next = now + A.hitMs; this.gate.hp -= A.damage; this.stats.ramHits++; this.h.sfx('bossHit');
      if (back) { // 撞门：帧 2 预备 → 帧 3 往城门短促前冲 lunge 像素再回弹，门上木屑（手绘序列帧）
        const sp = r.e.sprite, life = r.life; sp.setFrame(2);
        s.tweens.add({ targets: sp, y: r.y - RAM_BACK.lunge, duration: 110, delay: 120, ease: 'Quad.easeIn', yoyo: true, hold: 60, onStart: () => { if (r.e.spawnId === life) sp.setFrame(3); }, onComplete: () => { if (r.e.spawnId === life) sp.setFrame(0).setY(r.y); } });
        this.h.scene.time.delayedCall(230, () => this.h.fx('fx_death_props', g.gx + (Math.random() - .5) * 40, g.F - 50, 120, actorDepth(g.F) + .2));
      } else s.tweens.addCounter({ from: 0, to: 3, duration: 360, onUpdate: tw => { if (r.e.active) r.e.sprite.setFrame(Math.floor(tw.getValue() ?? 0) % 4); }, onComplete: () => { if (r.e.active) r.e.sprite.setFrame(0); } });
      const v = s.cameras.main.worldView; if (v.contains(g.gx, g.F)) s.cameras.main.shake(80, .0018);
    }
  }
  private wreck(x: number, y: number, tex: string, frame: number): void {
    const s = this.h.scene; if (!s.textures.exists(tex)) return;
    const im = s.add.image(x, y, tex, frame).setOrigin(.5, 1).setDisplaySize(140, 140).setDepth(actorDepth(y - 20)).setName('defv2-wreck');
    s.tweens.add({ targets: im, alpha: 0, delay: 6000, duration: 900, onComplete: () => im.destroy() });
  }
  private breakGate(): void {
    const g = this.h.g; this.gate.open = true; this.gate.hp = 0; this.h.sfx('gong'); if (this.sortie.open) this.endSortie(true);
    for (const dx of [-60, 0, 60]) this.h.fx('fx_collapse_dust', g.gx + dx, g.F - 40, 170, actorDepth(g.F) + .2); // 城门塌（手绘尘土序列帧）
    this.h.banner('城门被破！', true, '敌军要从门洞冲进城——退守府衙（门楼内侧按 F 下城）', '城门被破'); this.h.guide('gate');
  }

  // ———— 一键 F ————
  private spot(): { kind: V2SpotKind; seg: number } | null { const p = this.h.player(); return spotAt(this.h.g, p, seg => this.ladders.some(l => l.seg === seg && l.state === 'up')); }
  /** F：按站的位置做一件事。返回 true（守城 v2 里 F 不再当「出击」）。 */
  interact(): boolean {
    if (this.done) return true;
    const now = this.h.now(), p = this.h.player(), cs = this.citySpot();
    if (Math.hypot(p.x - cs.x, p.y - cs.y) <= DEFENSE_V2.assault.spots.reach) { const gs = v2Spots(this.h.g).gate; this.h.teleport(gs.x, gs.y); return true; } // 城门内侧楼梯：上城头
    const sp = this.spot(); if (!sp) return true;
    if (sp.kind === 'gate' && this.sortieReady()) { this.startSortie(); return true; } // 门楼内侧：能出城时 F = 出城冲阵
    if (sp.kind === 'gate' && this.gate.open) { this.h.teleport(cs.x, cs.y); return true; } // 门破了：F = 下城守府衙
    if (sp.kind === 'ladder') { const l = this.ladders.find(q => q.seg === sp.seg && q.state === 'up'); if (l) this.topple(l, 'push'); return true; }
    if (sp.kind === 'rack') { if (this.logs[sp.seg] > 0) this.dropLog(sp.seg); else this.h.sfx('playerHurt'); return true; }
    if (sp.kind === 'oil') { if (this.oil.charges > 0 && now >= this.oil.cd) this.pourOil(); else this.h.sfx('playerHurt'); return true; }
    if (sp.kind === 'gate') { if (!this.gate.open && this.gate.hp < this.gate.max && now >= this.repairCd && !this.channel) { const p = this.h.player(); this.channel = { start: now, x: p.x, y: p.y }; } else this.h.sfx('playerHurt'); return true; }
    return true;
  }
  private dropLog(seg: number): void {
    const A = DEFENSE_V2.assault.logs, g = this.h.g, s = this.h.scene, l = this.ladders.find(q => q.seg === seg && q.state !== 'drive'), x = l?.x ?? g.segs[seg].ladderX;
    this.logs[seg]--; this.stats.logs++;
    const hit = () => {
      const k = Math.sqrt(Math.max(1, this.h.hpScale())); let n = 0;
      if (l && l.state === 'up') n = this.topple(l, 'log');
      if (l && this.alive(l.cart, l.life)) this.h.hit(l.cart, A.engineDamage * k);
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.hp > 0 && !this.falling.has(e) && Math.abs(e.x - x) < A.foot && e.y > g.F - 30 && e.y < g.F + 160) this.h.hit(e, A.damage * k);
      this.h.banner('滚木！', false, (n ? `梯上 ${n} 人砸下城 · ` : '') + `第 ${seg + 1} 段还剩 ${this.logs[seg]} 次`);
    };
    if (!s.textures.exists('siege_mid_barb')) { hit(); return; }
    const log = s.add.image(x, g.W - 40, 'siege_mid_barb', 5).setDisplaySize(104, 104).setDepth(actorDepth(g.F) + .2).setName('defv2-log');
    s.tweens.add({ targets: log, y: g.F + 10, angle: 200, duration: A.fallMs, ease: 'Quad.easeIn', onComplete: () => { hit(); s.tweens.add({ targets: log, x: x + (Math.random() < .5 ? -1 : 1) * 160, angle: 520, alpha: 0, duration: 700, onComplete: () => log.destroy() }); } });
    this.h.sfx('gong');
  }
  private pourOil(): void {
    const O = DEFENSE_V2.assault.oil, g = this.h.g, s = this.h.scene, now = this.h.now(), fires: Phaser.GameObjects.Sprite[] = [];
    this.oil.charges--; this.oil.cd = now + O.cdMs; this.stats.oil++;
    if (s.textures.exists('ground_fire')) for (const dx of [-80, 0, 80]) fires.push(s.add.sprite(g.gx + dx, g.F + 44, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(130, 130).setDepth(actorDepth(g.F + 44) + .05).setName('defv2-oil'));
    this.burning?.fires.forEach(f => f.destroy());
    this.burning = { until: now + O.tickMs * O.ticks, next: now, fires };
    this.h.banner('热油！', false, `门前一片持续烧 · 还剩 ${this.oil.charges} 次`);
  }
  private updateBurning(now: number): void {
    const b = this.burning; if (!b) return; const O = DEFENSE_V2.assault.oil, g = this.h.g;
    b.fires.forEach((f, i) => f.setFrame(Math.floor(now / 120 + i) % 8));
    if (now >= b.until) { for (const f of b.fires) f.destroy(); this.burning = null; return; }
    if (now < b.next) return; b.next = now + O.tickMs;
    const k = Math.sqrt(Math.max(1, this.h.hpScale())), cx = g.gx, cy = g.F + 40;
    for (const e of this.h.enemies()) if (e.active && e.hp > 0 && Math.hypot(e.x - cx, (e.y - cy) * 1.4) <= O.radius) this.h.hit(e, O.damage * k * (this.rams.some(r => r.e === e) ? O.engineMul : 1));
  }
  private updateChannel(now: number): void {
    const c = this.channel; if (!c) return; const R = DEFENSE_V2.assault.repair, p = this.h.player();
    if (this.gate.open || Math.hypot(p.x - c.x, p.y - c.y) > R.moveTol) { this.channel = null; return; }
    if (now - c.start < R.channelMs) return;
    this.channel = null; this.repairCd = now + R.cdMs; this.gate.hp = Math.min(this.gate.max, this.gate.hp + this.gate.max * R.amount); this.stats.repairs++;
    this.h.banner('城门补好了一些', false, `+${Math.round(R.amount * 100)}% · 现在 ${Math.round(this.gate.hp / this.gate.max * 100)}%`);
  }
  // ———— 占段 / 夺回 ————
  /** 这段走道变红（复用走道贴图染红叠一层，不画代码特效；墙图是异步载入的，第一次用到时再建）。 */
  private markSeg(i: number, on: boolean): void {
    const s = this.h.scene, g = this.h.g, sg = g.segs[i];
    if (on && !this.overlays[i] && s.textures.exists(this.h.walkKey)) { const o = s.add.tileSprite((sg.x0 + sg.x1) / 2, (g.top + g.W) / 2, sg.x1 - sg.x0, g.W - g.top, this.h.walkKey).setTilePosition(sg.x0 - g.X0, 0).setTint(0xff5a40).setAlpha(.55).setDepth(DEPTH.ground + 3).setName('defv2-captured'); this.overlays[i] = o; this.objs.push(o); }
    this.overlays[i]?.setVisible(on);
  }
  private checkSegments(): void {
    const g = this.h.g, C = DEFENSE_V2.assault.capture;
    g.segs.forEach(sg => {
      const foes = this.segFoes(sg.i), guards = this.h.units().filter(u => u.active && walkSegment(g, u) === sg.i).length;
      if (!this.captured[sg.i] && guards === 0 && foes >= C.minFoes) { this.captured[sg.i] = true; this.stats.captures++; this.waveLost.add(sg.i); this.markSeg(sg.i, true); this.h.banner(`第 ${sg.i + 1} 段城头失守！`, true, '这段梯子上人更快——清掉这段的敌兵就夺回', `第 ${sg.i + 1} 段失守`); }
      else if (this.captured[sg.i] && foes === 0) { this.captured[sg.i] = false; this.stats.retakes++; this.markSeg(sg.i, false); this.h.banner(`夺回第 ${sg.i + 1} 段`, false, '预备队会上来补驻守', `夺回第 ${sg.i + 1} 段`); }
    });
  }

  // ———— 画面：头顶提示、城门血条 ————
  private promptText(now: number): string {
    const p = this.h.player(), cs = this.citySpot();
    if (this.sortie.open) { const left = Math.max(0, Math.ceil((this.sortie.until - now) / 1000)), g = this.h.g; return Math.abs(p.x - g.gx) < 160 && p.y < g.F + 140 ? `回到门洞关门 · ${left} 秒` : ''; }
    if (Math.hypot(p.x - cs.x, p.y - cs.y) <= DEFENSE_V2.assault.spots.reach) return 'F · 上城头';
    const sp = this.spot(); if (!sp) return '';
    if (sp.kind === 'gate' && this.sortieReady()) return 'F · 出城冲阵';
    if (sp.kind === 'gate' && this.gate.open) return 'F · 下城守府衙';
    if (sp.kind === 'ladder') return 'F · 推梯';
    if (sp.kind === 'rack') return this.logs[sp.seg] > 0 ? `F · 滚木 ×${this.logs[sp.seg]}` : '滚木用完';
    if (sp.kind === 'oil') return this.oil.charges <= 0 ? '热油用完' : now < this.oil.cd ? `热油冷却 ${Math.ceil((this.oil.cd - now) / 1000)} 秒` : `F · 泼油 ×${this.oil.charges}`;
    if (this.gate.open) return '';
    if (this.channel) return `修门中 ${Math.max(0, (DEFENSE_V2.assault.repair.channelMs - (now - this.channel.start)) / 1000).toFixed(1)} 秒`;
    if (now < this.repairCd) return `修门冷却 ${Math.ceil((this.repairCd - now) / 1000)} 秒`;
    return this.gate.hp >= this.gate.max ? '城门完好' : 'F · 修门';
  }
  private paint(now: number): void {
    const p = this.h.player(), t = this.promptText(now), g = this.h.g;
    // 头顶提示；主将在画面最上面时（镜头往城外让，城头在画面上部）头顶会压到计时器，改放脚下
    const v = this.h.scene.cameras.main.worldView, above = p.y - DEFENSE_V2.assault.promptDy, py = v.height > 0 && (above - v.y) / v.height < .17 ? p.y + 26 : above;
    this.prompt.setText(t).setVisible(!!t && p.alive !== false).setPosition(p.x, py);
    for (const l of this.spotLabels) l.o.setVisible(Math.hypot(p.x - l.x, p.y - l.y) > 120);
    // 府衙血条（城里，府衙图上方）
    { const kk = Math.max(0, this.keep.hp / this.keep.max), kb = this.keepBar.clear(), kw = 150, kx = g.keep.x - kw / 2, ky = g.keep.y + 54; // 府衙大堂台基下面（上面太高，镜头看府衙时出画）
      kb.fillStyle(0x140a06, .85).fillRect(kx - 1, ky - 1, kw + 2, 9).fillStyle(0xd8432a, 1).fillRect(kx, ky, kw * kk, 7); this.keepText.setText(`府衙 ${Math.round(kk * 100)}%`); }
    // 屏幕顶一行：喘息 / 出城时的状态（横幅出着时先让开）；门楼上的出城倒计时
    { const ph = v2Phase(this.h.waves, this.h.elapsed()), notice = this.h.scene.children.list.some(o => o.name === 'combat-notice'), gp = this.gate.open ? '城门已破' : `城门 ${Math.round(this.gate.hp / this.gate.max * 100)}%`, kp = `府衙 ${Math.round(this.keep.hp / this.keep.max * 100)}%`, left = this.h.waves - 1 - this.wave;
      const line = this.sortie.open ? `出城冲阵 · 剩 ${Math.max(0, Math.ceil((this.sortie.until - now) / 1000))} 秒 · 回到城门洞关门` : this.phase === 'rest' ? `喘息 ${Math.ceil(ph.left)} 秒 · ${gp} · ${kp} · 还有 ${left} 波 · Space 跳过` : '';
      this.status.setText(line).setVisible(!!line && !notice);
      this.gateCount.setVisible(false); } // 门楼上的倒计时和头顶提示 / 顶上一行重复，镜头跟到城外时还压在计时器上——不显示
    if (this.sortieReady()) this.h.guide('sortie');
    const k = Math.max(0, this.gate.hp / this.gate.max), b = this.bar.clear(), w = 150, x = g.gx - w / 2, y = g.F - 198;
    if (this.gate.open) { this.barText.setText('城门已破').setColor('#ff8a70'); return; }
    b.fillStyle(0x140a06, .85).fillRect(x - 1, y - 1, w + 2, 9).fillStyle(k < .3 ? 0xd8432a : 0xd8a03a, 1).fillRect(x, y, w * k, 7);
    this.barText.setText(`城门 ${Math.round(k * 100)}%`).setColor(k < .3 ? '#ff8a70' : '#ffe1a0');
    // 城门告急（70% / 40% / 15%）：横幅提一次
    for (const th of [.7, .4, .15]) if (k <= th && this.gateWarn > th) { this.gateWarn = th; this.h.banner(`城门 ${Math.round(k * 100)}%`, true, th <= .4 ? '站门楼内侧按 F 修门，或去门楼泼热油' : '冲车在撞门', `城门 ${Math.round(k * 100)}%`); break; }
  }

  clear(): void {
    this.done = true;
    for (const e of this.falling.keys()) if (e.active) e.sprite.setAngle(0);
    this.climbing.clear(); this.falling.clear();
    for (const l of this.ladders) { l.label.destroy(); l.img?.destroy(); l.ring?.destroy(); } for (const r of this.rams) r.label.destroy();
    for (const f of this.burning?.fires ?? []) f.destroy(); this.burning = null;
    for (const o of this.objs) o.destroy(); this.objs = []; this.ladders = []; this.rams = []; this.overlays = [null, null, null, null];
  }
}
