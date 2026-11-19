import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyDef } from '../data/enemies';
import { DEPTH, HEADING_FONT, actorDepth } from '../config';
import { MID_SIEGE_FILES } from './SiegeMidArt';
import { Strikes } from './BeifaSystems';
import { SishuiObstacles } from './SishuiObstacles';
import { playSheet } from './SkillFxSheets';
import { emitBossPhase } from './BossPhase';
import { ART_V2_FILES, isV2Texture, regridV2 } from './ArtStyle';
import { HORSE_V2, RIDE } from './HeroMount';
import { BOSS_RIDE_ART, bossRideKey } from './BossMount';
import { warnFx } from '../ui/WarnFx';
import { preloadCutscene } from './Cutscene';
import { preloadBossDeath } from './BossDeathArt';
import { LUBU_KILLS_DONGZHUO } from '../data/cutscenes/lubuKillsDongzhuo';
import type { CutsceneScript } from '../data/cutscenes/types';
import { LUOYANG } from '../data/dongzhuo';

/**
 * 2-3 洛阳 · 董卓与吕布同场（用户 2026-11-18 设计）：
 *  ① 董卓 · 吕布 同时出阵：董卓站在北面城墙上（刀枪不入、不移动），在城头纵火、放箭雨；弱化吕布（步战、血 ×0.5、攻 ×0.6，一招方天横扫）在城下和主将打。
 *  ② 吕布打到 1/3 血：打不死（锁血），喊「哼，来日再战！」，唤来赤兔，骑上逃出画面。
 *  ③ 吕布逃走后董卓从城墙走下来，可以打了（沿用原董卓控制器：纵火、铁骑、飞熊军、半血迁都）。
 *  ④ 董卓打到 20% 血：慢动作，吕布骑赤兔杀回，一戟斩董卓（顿帧 + 震屏）——「国贼董卓，今日授首！」，再骑马离去；董卓倒地掉宝箱，照常结算。
 * 每段都发 boss-phase（董卓：城下 = 2、授首 = 3），打击感会话的慢动作 / 踉跄可接。数值初值，交平衡会话。
 * 美术复用：攻城城墙图集（城墙段 / 城门）、吕布 v2 行走 / 攻击图、赤兔（horses-v2）与吕布骑乘图（有就用）、手绘扬尘 / 斩击序列帧。
 */
export const DZ_LUBU = {
  wallY: -330, wallHalf: 900, segW: 230, gateW: 270, perchUp: 200, perchDx: 210,
  /** 城内纵深：两端侧墙往北延伸多远、再用北墙合上（城墙专项检查：洛阳城墙原来两端敞着，绕过去就到了城里）。 */ cityDepth: 2000,
  lubuHpMul: .5, lubuDmgMul: .6, lubuSpeed: 74, lubuReach: 70, fleeAt: 1 / 3,
  sweepEveryMs: 4500, sweepR: 150, sweepArc: Math.PI * .75, sweepWarnMs: 700, sweepDmgMul: 1.3,
  wallVolleyEverySec: 7, wallVolleyPoints: 3, volleyR: 66, volleyWarnMs: 1300, playerRatio: .05, allyDamage: 12,
  descendMs: 1100, finishAt: .2, finishSlowMs: 1600, finishSlow: .35,
} as const;

/** perch = 董卓、吕布都在城头（摧毁营寨阶段）；leaping = 吕布跃下城头；wall = 城下战吕布（原有）；之后照旧。 */
export type DzPhase = 'perch' | 'leaping' | 'wall' | 'fleeing' | 'descending' | 'down' | 'finale' | 'done';
export interface DzHost {
  scene: Phaser.Scene; player: Player; legion: Legion; now: () => number;
  spawnLubu: (def: EnemyDef, x: number, y: number) => Enemy | null;
  lubuBase: () => EnemyDef;
  banner: (t: string, danger: boolean, c?: string) => void; sfx: (k: string) => void;
  /** 让首领（董卓）倒下：走正常的击杀 → 倒地 → 宝箱流程。 */
  killBoss: () => void;
  enemies: () => Enemy[]; allies: () => import('../entities/Ally').Ally[];
  hitFeel: () => { hitStop(ms: number, force?: boolean): boolean; slowMo(ms: number, scale: number): void; shake(k: 'small' | 'medium' | 'big'): void } | undefined;
  /** 播过场（剧情设置关掉时返回 false）。 */
  cutscene?: (script: CutsceneScript, anchors: Record<string, { x: number; y: number } | undefined>, done: (skipped: boolean) => void) => boolean;
  /** 场上某武将（主将 / 随行）的精灵。 */
  heroSprite?: (id: string) => { x: number; y: number } | undefined;
  /** 剧情台词（故事系统 StoryDirector.line，data/story/hulao.ts 的 barks；按剧情设置决定播不播）。没播返回 false。 */
  line?: (id: string, target: { x: number; y: number }) => boolean;
  /** 战斗中途卷轴（StoryDirector.midScroll，data/story/hulao.ts 的 midScrolls：暂停战斗、显示对白立绘）。没播返回 false。 */
  scroll?: (id: string) => boolean;
  /** 2-3 重做：吕布什么时候跃下城头（营寨全毁）。不传或一开始就是 true：照原来，吕布开局就在城下。 */
  ready?: () => boolean;
}

export class DongzhuoLubu {
  phase: DzPhase = 'wall';
  lubu: Enemy | null = null;
  private art: Phaser.GameObjects.GameObject[] = []; readonly obstacles: SishuiObstacles; private strikes: Strikes;
  private perch = { x: 0, y: 0 }; private gate = { x: 0, y: 0 }; private letDie = false; private dzLineAt = 0; private nextSweep = 0; private sweep: { at: number; a: number; id: string } | null = null; private volleyAt = 0;
  private anim: ((now: number) => boolean) | null = null;
  /** 吕布在城头的站位（踱步中心）。 */ private lubuHome = { x: 0, y: 0 };
  readonly metrics = { sweeps: 0, volleys: 0, lockHits: 0, leaps: 0, pushedSouth: 0 };
  constructor(private h: DzHost, readonly dongzhuo: Enemy) {
    const P = DZ_LUBU, L = LUOYANG, s = h.scene, now = h.now(), p = h.player, wy = p.y + P.wallY;
    // 城头站位：董卓在城门楼左边、吕布在右边（站在门楼正后方会被门楼挡住）；脚底在前墙垛下沿，前墙挡住腿、身子露在墙头上
    this.perch = { x: p.x - P.perchDx, y: wy - P.perchUp }; this.gate = { x: p.x, y: wy };
    preloadCutscene(s, LUBU_KILLS_DONGZHUO, () => {}); preloadBossDeath(s, 'dongzhuo');
    // 洛阳城（用户「2-3只有很长一段城墙，不用把玩家困在里面」）：北边一道很长的城墙（±LUOYANG.wallHalf，两端角楼收口），没有侧墙、没有南边界，城下一侧全开。
    // 绕墙端走不过去：keepSouth 每帧把墙线以北的敌兵 / 主将 / 随行挪回墙南（不分 x），城墙等于无限长；墙北不刷兵（southSpawn）。
    const X0 = p.x - L.wallHalf, X1 = p.x + L.wallHalf;
    // 碰撞按 1000 宽切块（导航按最大半边长查询，整块太大会拖慢；同 sealCityWall.slab）
    this.obstacles = new SishuiObstacles([]);
    for (let x = X0 - 60; x < X1 + 60; x += 1000) this.obstacles.footprints.push({ left: x, right: Math.min(x + 1000, X1 + 60), top: wy - 70, bottom: wy - 8 });
    this.strikes = new Strikes({ scene: s, player: p, army: h.legion, now: h.now });
    // 城墙（用户「生成那张可以站在立体上的城墙素材」，2.5D 城墙图：后女墙 → 城头走道 → 外侧城垛 → 正立面）。
    // 每张图画两遍：整张在城头人物身后；从外侧城垛顶往下裁一层盖在城头人物身前（挡住腿）——董卓 / 吕布就「站在走道上、城垛后面」。
    // 层级：整张 actorDepth(wy) - .03 < 城头人物 actorDepth(wy) - .02 < 城垛层 actorDepth(wy) - .01 < 城下的人。
    const A = L.wallArt, key = (n: string): string => 'luoyang_wall_' + n;
    const piece = (n: 'seg' | 'gate' | 'corner', x: number, flip = false, name = 'luoyang-wall'): void => {
      const d = A[n], k = s.textures.get(key(n)).getSourceImage() as { width: number; height: number }, sc = A.scale * ('mul' in d ? d.mul : 1);
      for (const front of [false, true]) {
        const im = s.add.image(x, wy, key(n)).setOrigin(.5, d.ground / k.height).setScale(sc).setFlipX(flip).setDepth(actorDepth(wy) - (front ? .01 : .03)).setName(front ? name + '-front' : name);
        if (front) im.setCrop(0, d.crenel, k.width, k.height - d.crenel);
        this.art.push(im);
      }
    };
    const build = (): void => {
      if (s.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      const full = A.seg.w * A.scale, step = full - A.overlap * A.scale, gateHalf = A.gate.w * A.scale * A.gate.mul / 2, end = L.wallHalf + 40;
      // 墙段从城门楼两侧往外排到角楼（最外一段压在角楼身后），相邻段重叠 overlap 藏住两端斜角；城门楼、角楼后画，盖住接缝
      for (const side of [-1, 1]) for (let x = gateHalf - 4 + full / 2; x - full / 2 < end; x += step) piece('seg', p.x + side * x, side > 0);
      piece('gate', p.x, false, 'luoyang-gate');
      piece('corner', X0 - 40, false, 'luoyang-tower'); piece('corner', X1 + 40, true, 'luoyang-tower');
    };
    { const need = (['seg', 'gate', 'corner'] as const).filter(n => !s.textures.exists(key(n)));
      if (!need.length) build(); else { for (const n of need) s.load.image(key(n), A[n].file); s.load.once('complete', build); if (!s.load.isLoading()) s.load.start(); } }
    // 赤兔（horses-v2）与吕布骑乘图（有就载）：逃走 / 杀回时用
    { const hk = 'horse_v2_chitu_walk'; if (!s.textures.exists(hk) && ART_V2_FILES[hk]) { s.load.image(hk, ART_V2_FILES[hk]); s.load.once('filecomplete-image-' + hk, () => regridV2(s, hk)); } else if (s.textures.exists(hk) && !s.textures.get(hk).has('down_0')) regridV2(s, hk);
      const rk = bossRideKey('lubu'); if (BOSS_RIDE_ART.has('lubu') && !s.textures.exists(rk)) s.load.spritesheet(rk, 'assets/ride-v2/boss_lubu_ride.png', { frameWidth: RIDE.cell, frameHeight: RIDE.cell });
      if (!s.load.isLoading()) s.load.start(); }
    // 董卓上城：刀枪不入、不动
    dongzhuo.invulnerable = true; dongzhuo.sprite.setPosition(this.perch.x, this.perch.y);
    // 弱化吕布：步战，用吕布 v2 行走 / 攻击图
    const base = h.lubuBase(), v2 = isV2Texture('boss_lubu');
    const def: EnemyDef = { ...base, kind: 'elite', texture: 'boss_lubu', walkVisual: { texture: 'boss_lubu', scale: v2 ? .5 : 218 / 256, groundY: v2 ? 256 / 288 : 224 / 256, matched: true }, attackVisual: 'lubu_attack',
      hp: Math.round(base.hp * P.lubuHpMul), damage: Math.round(base.damage * P.lubuDmgMul), speed: P.lubuSpeed, radius: 30, xp: 40, tint: 0xffffff, variant: undefined, behavior: undefined };
    // 2-3 重做：营寨没摧毁完时，吕布先站在城头（董卓右边），打不到、不追人，沿城头来回踱步；营寨全毁后跃下城头
    const onWall = !!h.ready && !h.ready();
    this.lubuHome = { x: p.x + P.perchDx, y: wy - P.perchUp };
    this.lubu = h.spawnLubu(def, onWall ? this.lubuHome.x : p.x + 60, onWall ? this.lubuHome.y : wy + 90);
    if (this.lubu) this.lubu.controlImmune = true;
    if (onWall && this.lubu) { this.phase = 'perch'; this.lubu.invulnerable = true; this.lubu.def = { ...this.lubu.def, speed: 0 }; }
    // 登场台词：吕布先喊，董卓（城头）隔一会儿再喊
    if (this.lubu && !onWall) h.line?.('hulao-3.lubu_enter', this.lubu.sprite);
    this.dzLineAt = now + 2400;
    this.nextSweep = now + 2500; this.volleyAt = now + 3500;
    // 2026-11-18 夜：董卓、吕布登上城头时播一段卷轴（对白立绘露脸），播了就不再喊城头那句 bark
    if (h.scroll?.('hulao-3.on_wall')) this.dzLineAt = 0;
    if (onWall) h.banner('董卓 · 吕布 坐镇城头', true, '城头上打不到他们 · 先摧毁营寨');
    else h.banner('董卓 · 吕布 出阵', true, '董卓坐镇城头（打不到）· 先打退吕布');
    s.events.on('postupdate', this.tick, this);
    s.events.once('shutdown', () => this.clear());
  }
  /** XiliangBattle 是否该停下董卓自己的移动（城头 / 走下城 / 授首时）。 */
  get holdsDongzhuo(): boolean { return this.phase !== 'down'; }
  get lubuLeft(): boolean { return this.phase !== 'wall' && this.phase !== 'fleeing'; }
  /** 董卓还在城头（城头对峙 / 吕布跃下 / 战吕布 / 吕布逃走）：底部首领血条、名牌、屏外箭头都不给董卓（用户「董卓吕布出来之前不要显示血条」）；小地图照常标。 */
  get hidesBossBar(): boolean { return this.phase === 'perch' || this.phase === 'leaping' || this.phase === 'wall' || this.phase === 'fleeing'; }
  /** 用户「吕布下来应该是吕布血条」：跃下起到逃出画面，首领血条 / 名牌显示吕布；董卓下城后换回董卓。 */
  get lubuFocus(): Enemy | null { const l = this.lubu; return l?.active && (this.phase === 'leaping' || this.phase === 'wall' || this.phase === 'fleeing') ? l : null; }

  /** GameScene.killEnemy 开头调用：吕布打到底不死（锁在 1/3），触发逃走。返回 true 表示拦下了这次击杀。 */
  preventKill(e: Enemy): boolean {
    // 董卓下城后一下打穿 20%：先锁 1 血，交给「吕布斩董卓」
    if (e === this.dongzhuo && this.phase === 'down') { e.hp = 1; this.finale(); return true; }
    if (e === this.dongzhuo && this.phase === 'finale' && !this.letDie) { e.hp = 1; return true; }
    if (e !== this.lubu || this.phase !== 'wall') return false;
    e.hp = Math.ceil(e.maxHp * DZ_LUBU.fleeAt); this.metrics.lockHits++; this.startFlee(); return true;
  }
  /** 吕布 1/3 血锁：受伤时把伤害截到 1/3 线（GameScene.hitEnemy 调用）。 */
  clampDamage(e: Enemy, raw: number): number {
    if (e !== this.lubu) return raw;
    if (this.phase !== 'wall') return 0;
    const floor = e.maxHp * DZ_LUBU.fleeAt;
    if (e.hp - raw <= floor) { this.metrics.lockHits++; this.h.scene.time.delayedCall(0, () => this.startFlee()); return Math.max(0, e.hp - floor); }
    return raw;
  }

  private say(target: { x: number; y: number }, text: string, color = '#ffe08a'): void {
    const s = this.h.scene, t = s.add.text(target.x, target.y - 120, text, { fontFamily: HEADING_FONT, fontSize: '26px', color, stroke: '#1a0e08', strokeThickness: 6, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.dmgText + 2).setName('dz-lubu-say').setScale(1.4);
    const t0 = s.time.now, run = (): void => { const k = (s.time.now - t0) / 2200; if (k >= 1 || !t.active) { s.events.off('postupdate', run); t.destroy(); return; } t.setScale(1 + .4 * Math.max(0, 1 - k * 8)).setPosition(target.x, target.y - 120 - k * 24).setAlpha(k > .8 ? (1 - k) * 5 : 1); };
    s.events.on('postupdate', run);
  }

  /** 赤兔：从画面边奔来 / 驮着吕布离去。返回马与（有骑乘图时的）骑者图。 */
  private horse(x: number, y: number, dir: 'left' | 'right'): { horse: Phaser.GameObjects.Image | null; rider: Phaser.GameObjects.Image | null } {
    const s = this.h.scene, hk = 'horse_v2_chitu_walk';
    const horse = s.textures.exists(hk) && s.textures.get(hk).has('down_0') ? s.add.image(x, y, hk, `${dir}_0`).setOrigin(.5, HORSE_V2.foot / HORSE_V2.cell).setScale(HORSE_V2.scale).setDepth(actorDepth(y)).setName('dz-chitu') : null;
    const rk = bossRideKey('lubu'), rider = BOSS_RIDE_ART.has('lubu') && s.textures.exists(rk) ? s.add.image(x, y, rk, (dir === 'left' ? 1 : 2) * 4).setOrigin(.5, (RIDE.foot + RIDE.stirrup / RIDE.scale) / RIDE.cell).setScale(RIDE.scale).setDepth(actorDepth(y) + .01).setName('dz-lubu-rider') : null;
    return { horse, rider };
  }
  /** ② 吕布锁血：喊话、唤赤兔、骑走。 */
  private startFlee(): void {
    if (this.phase !== 'wall' || !this.lubu) return;
    const s = this.h.scene, l = this.lubu, cam = s.cameras.main; this.phase = 'fleeing';
    l.invulnerable = true; this.sweep = null;
    if (!this.h.line?.('hulao-3.lubu_retreat', l.sprite)) this.say(l, '哼，来日再战！'); this.h.banner('吕布唤赤兔', false, '吕布败走 · 董卓下城');
    const fromLeft = l.x > cam.worldView.centerX, sx = fromLeft ? cam.worldView.left - 80 : cam.worldView.right + 80, dir: 'left' | 'right' = fromLeft ? 'right' : 'left';
    const { horse, rider } = this.horse(sx, l.y, dir);
    const t0 = s.time.now, arrive = 700, leave = 1100, ex = fromLeft ? cam.worldView.right + 200 : cam.worldView.left - 200;
    this.anim = now => {
      const t = now - t0;
      if (t < arrive) { const k = t / arrive; horse?.setPosition(Phaser.Math.Linear(sx, l.x, k), l.y).setFrame(`${dir}_${Math.floor(t / 90) % 4}`); return false; }
      const k = Math.min(1, (t - arrive) / leave), x = Phaser.Math.Linear(l.x, ex, k), back: 'left' | 'right' = dir === 'right' ? 'right' : 'left';
      horse?.setPosition(x, l.y).setFrame(`${back}_${Math.floor(t / 80) % 4}`);
      if (rider) { rider.setPosition(x, l.y).setFrame((back === 'left' ? 1 : 2) * 4 + Math.floor(t / 90) % 4); l.sprite.setAlpha(0); } else l.sprite.setPosition(x, l.y - 30);
      if (k >= 1) { horse?.destroy(); rider?.destroy(); l.sprite.setAlpha(1); l.deactivate(); this.lubu = null; this.descend(); return true; } // 敌人对象会被对象池复用，离场后不再引用
      return false;
    };
  }
  /** ③ 董卓走下城：可以打了。 */
  private descend(): void {
    const s = this.h.scene, d = this.dongzhuo, P = DZ_LUBU; this.phase = 'descending';
    this.h.scroll?.('hulao-3.dongzhuo_descend'); // 吕布败走、董卓亲自下城：卷轴（对白立绘）
    const y0 = d.y, y1 = this.perch.y + P.perchUp + 70, t0 = s.time.now;
    this.anim = now => { const k = Math.min(1, (now - t0) / P.descendMs); d.sprite.y = Phaser.Math.Linear(y0, y1, k); if (k >= 1) { this.phase = 'down'; d.invulnerable = false; emitBossPhase(s, { boss: d, phase: 2, dismount: false, name: '董卓' }); this.h.banner('董卓下城', true, '国贼亲自督战 · 打他！'); this.h.line?.('hulao-3.dongzhuo_down', d.sprite); playSheet(s, 'fx_collapse_dust', d.x, d.y + 4, { size: 160, ms: 560, depth: DEPTH.fx, originY: .8, name: 'dz-down-dust' }); return true; } return false; };
  }
  /** ④ 董卓 20%：过场「吕布斩董卓」（data/cutscenes/lubuKillsDongzhuo.ts）；剧情关掉时走下面的简短演出。 */
  private finale(): void {
    if (this.phase !== 'down') return;
    const d = this.dongzhuo; this.phase = 'finale'; d.invulnerable = true; this.anim = null;
    emitBossPhase(this.h.scene, { boss: d, phase: 3, dismount: false, name: '董卓' });
    const played = this.h.cutscene?.(LUBU_KILLS_DONGZHUO, { dongzhuo: d.sprite, gate: this.gate, zhangfei: this.h.heroSprite?.('zhangfei') }, () => this.slain(true));
    if (!played) this.quickFinale();
  }
  /** 过场演完 / 跳过：董卓倒下（过场里已演过倒地，不再重播）、掉宝箱。 */
  private slain(viaCutscene: boolean): void {
    const d = this.dongzhuo, s = this.h.scene;
    this.phase = 'done'; d.invulnerable = false; this.letDie = true; this.h.killBoss();
    if (viaCutscene) for (const o of [...s.children.list]) if (o.name === 'boss-fall-frames' || o.name === 'boss-fall') o.destroy();
  }
  /** 剧情设置关掉时：吕布杀回一戟斩之（不停战斗）。 */
  private quickFinale(): void {
    const s = this.h.scene, d = this.dongzhuo, cam = s.cameras.main, P = DZ_LUBU;
    this.h.hitFeel()?.slowMo(P.finishSlowMs, P.finishSlow);
    this.h.banner('吕布杀回', true, '方天画戟 · 直取董卓');
    const fromLeft = d.x > cam.worldView.centerX, sx = fromLeft ? cam.worldView.left - 80 : cam.worldView.right + 80, dir: 'left' | 'right' = fromLeft ? 'right' : 'left', tx = d.x + (fromLeft ? -70 : 70);
    const { horse, rider } = this.horse(sx, d.y + 10, dir);
    const fallback = rider ? null : s.add.image(sx, d.y - 20, 'boss_lubu', `${dir}_0`).setOrigin(.5, .89).setScale(isV2Texture('boss_lubu') ? .5 : 218 / 256).setDepth(actorDepth(d.y) + .02).setName('dz-lubu-return');
    const t0 = s.time.now, run = 650, ex = fromLeft ? cam.worldView.right + 220 : cam.worldView.left - 220; let struck = false;
    this.anim = now => {
      const t = now - t0;
      if (t < run) { const k = t / run, x = Phaser.Math.Linear(sx, tx, k); horse?.setPosition(x, d.y + 10).setFrame(`${dir}_${Math.floor(t / 80) % 4}`); rider?.setPosition(x, d.y + 10).setFrame((dir === 'left' ? 1 : 2) * 4 + Math.floor(t / 90) % 4); fallback?.setPosition(x, d.y - 20).setFrame(`${dir}_${Math.floor(t / 90) % 4}`); return false; }
      if (!struck) {
        struck = true;
        rider?.setFrame((dir === 'left' ? 5 : 6) * 4 + 1); // 马上出招行
        playSheet(s, 'fx_drag_wave', d.x, d.y - 30, { size: 260, ms: 420, depth: DEPTH.fx + 1, rotation: dir === 'right' ? 0 : Math.PI, name: 'dz-lubu-slash' });
        playSheet(s, 'fx_strike_glint', d.x, d.y - 50, { size: 180, ms: 360, depth: DEPTH.fx + 2, name: 'dz-lubu-glint' });
        this.h.hitFeel()?.hitStop(160, true); this.h.hitFeel()?.shake('big'); this.h.sfx('flameBoom');
        if (!this.h.line?.('hulao-3.lubu_return', { x: tx, y: d.y })) this.say({ x: tx, y: d.y }, '国贼董卓，今日授首！', '#ffb08a');
        d.invulnerable = false; this.letDie = true; this.h.killBoss();
      }
      if (t < run + 900) return false;
      const k = Math.min(1, (t - run - 900) / 1000), x = Phaser.Math.Linear(tx, ex, k);
      horse?.setPosition(x, d.y + 10).setFrame(`${dir}_${Math.floor(t / 80) % 4}`); rider?.setPosition(x, d.y + 10).setFrame((dir === 'left' ? 1 : 2) * 4 + Math.floor(t / 90) % 4); fallback?.setPosition(x, d.y - 20);
      if (k >= 1) { horse?.destroy(); rider?.destroy(); fallback?.destroy(); this.phase = 'done'; return true; }
      return false;
    };
  }

  /** 每帧（postupdate）：城墙碰撞、城头放箭、吕布横扫、动画、20% 授首。 */
  /** 场地内（城墙以南，城下一侧全开），留 r 的边：随机补给 / 物件只放在这里面。 */
  inArena(_x: number, y: number, r = 0): boolean { return y > this.gate.y + r; }
  /** 城门位置（舆图画城门楼）。 */
  get gatePos(): { x: number; y: number } { return this.gate; }
  /** 城墙南沿（碰撞框下沿）。以北是城里：不刷兵、不许有敌兵。 */
  get wallLine(): number { return this.gate.y - 8; }
  /** 用户「城墙那一侧不需要生成小兵」：刷兵点落在城北的，按主将南北翻过来（离主将距离不变，仍在屏外）；翻过来还在墙北就贴墙南沿。 */
  southSpawn(x: number, y: number, r = 20): { x: number; y: number } {
    const line = this.wallLine + r; if (y >= line) return { x, y };
    const py = this.h.player.y; let ny = py + (py - y); if (ny < line) ny = line + 10 + Math.random() * 70;
    return { x, y: ny };
  }
  /** 用户「还是有很多小兵穿过城墙」：碰撞框只推出最近的一边，快的 / 被击退的会从墙框北边出去；这里每帧把墙北的敌兵挪回墙南（城头的董卓、吕布、城头守军除外）。 */
  private keepSouth(): void {
    const line = this.wallLine;
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || e === this.dongzhuo || e === this.lubu || e.def.behavior === 'wall' || e.y >= line + e.radius - .5) continue;
      if (e.y < line - 90) { const f = this.southSpawn(e.x, e.y, e.radius); e.sprite.setPosition(f.x, f.y); } else e.sprite.y = line + e.radius;
      this.metrics.pushedSouth++;
    }
    // 主将 / 随行：城墙两端绕过去也进不了城北（城墙等于无限长，用户「不用把玩家困在里面」——南边全开，只挡北边）
    const p = this.h.player; if (p.y < line + p.radius) p.sprite.y = line + p.radius;
    for (const a of this.h.allies()) if (a.active && a.y < line + a.radius) a.push(0, line + a.radius - a.y);
  }
  /** 镜头上让（GameScene.updateCamera 叠加，负数 = 往上）：董卓还在城头时，主将离城墙越近、镜头往上让得越多，最多 cameraLift（让城头的董卓 / 吕布进画面）。 */
  cameraBias(py: number): number {
    if (this.phase === 'down' || this.phase === 'finale' || this.phase === 'done') return 0;
    const L = LUOYANG, d = py - this.gate.y; return -L.cameraLift * Phaser.Math.Clamp((L.cameraNear - d) / (L.cameraNear - 40), 0, 1);
  }
  /** 城头踱步：走（播行走帧）→ 到头停一下 → 回头；用户「吕布不会动」。 */
  private paceAt = 0; private chaseAt = 0;
  private pace(now: number, depth: number): void {
    const l = this.lubu; if (!l?.active) return;
    const L = LUOYANG, T = L.paceMs + L.paceRestMs, c = now % (2 * T);
    const k = c < L.paceMs ? c / L.paceMs : c < T ? 1 : c < T + L.paceMs ? 1 - (c - T) / L.paceMs : 0;
    const e = k * k * (3 - 2 * k), x = this.lubuHome.x - L.paceRange + 2 * L.paceRange * e, dx = x - l.x;
    const dt = this.paceAt ? Math.min(.1, Math.max(.001, (now - this.paceAt) / 1000)) : 1 / 60; this.paceAt = now;
    l.intentDx = dx; l.intentDy = 0;
    l.sprite.setPosition(x, this.lubuHome.y).setDepth(depth);
    l.updateWalk(dt, dx, 0);
  }
  /** 营寨全毁：吕布大喝一声、沿抛物线从城头跃下，落地扬尘震屏，然后照原来的城下战（1/3 血逃走）。 */
  private startLeap(): void {
    const l = this.lubu, s = this.h.scene, L = LUOYANG, P = DZ_LUBU;
    if (!l?.active) { this.phase = 'wall'; return; }
    this.phase = 'leaping'; this.metrics.leaps++;
    if (!this.h.line?.('hulao-3.lubu_enter', l.sprite)) this.say(l, '人中吕布，马中赤兔！谁来送死？');
    // 横幅交给关卡目标（「营寨尽毁 · 吕布跃下城头！」，data/dongzhuo.ts），这里只喊台词，不叠第二条横幅
    this.h.sfx('bossSummon');
    const x0 = l.x, y0 = l.y, x1 = this.gate.x + L.landDx, y1 = this.gate.y + L.landDy, t0 = s.time.now;
    this.anim = now => {
      const k = Math.min(1, (now - t0) / L.leapMs), x = Phaser.Math.Linear(x0, x1, k), y = Phaser.Math.Linear(y0, y1, k) - Math.sin(Math.PI * k) * L.leapArc;
      if (l.active) { l.sprite.setPosition(x, y).setDepth(DEPTH.fx - 1); l.intentDx = x1 - x0; l.intentDy = 0; }
      if (k < 1) return false;
      // 落地：扬尘、震屏，吕布可以打了
      playSheet(s, 'fx_collapse_dust', x1, y1 + 4, { size: 200, ms: 620, depth: DEPTH.fx, originY: .8, name: 'dz-lubu-land' });
      this.h.hitFeel()?.shake('big'); this.h.sfx('hitHeavy');
      if (l.active) { l.invulnerable = false; l.def = { ...l.def, speed: P.lubuSpeed }; }
      this.phase = 'wall'; this.nextSweep = this.h.now() + 1800;
      return true;
    };
  }
  private tick(): void {
    const s = this.h.scene, now = this.h.now(), p = this.h.player, P = DZ_LUBU;
    if (this.phase === 'done') return;
    this.obstacles.resolve(p, this.h.allies(), this.h.enemies());
    this.keepSouth();
    this.strikes.update();
    { const a = this.anim; if (a && a(s.time.now) && this.anim === a) this.anim = null; } // 动画里可能接着开下一段（逃走 → 下城），别把新的清掉
    const d = this.dongzhuo;
    if (this.dzLineAt && now >= this.dzLineAt) { this.dzLineAt = 0; if (d.active) this.h.line?.('hulao-3.dongzhuo_enter', d.sprite); }
    if (this.phase === 'perch' || this.phase === 'leaping' || this.phase === 'wall') {
      // 城头上的人：层级夹在后墙垛与前墙之间（前墙挡腿），每帧压回（敌兵自己的更新会按脚底改层级）
      const onWallDepth = actorDepth(this.gate.y) - .02;
      if (d.active) d.sprite.setPosition(this.perch.x, this.perch.y).setDepth(onWallDepth);
      // 城头箭雨
      if (now >= this.volleyAt) { this.volleyAt = now + P.wallVolleyEverySec * 1000; this.metrics.volleys++; for (let k = 0; k < P.wallVolleyPoints; k++) { const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 60 + Math.random() * 90; this.strikes.add('arrows', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, P.volleyR, P.volleyWarnMs, P.playerRatio, P.allyDamage); } }
      // 吕布在城头（营寨阶段）：沿城头来回踱步（走 → 停 → 回头），打不到；营寨全毁就跃下
      if (this.phase === 'perch') { this.pace(now, onWallDepth); if (this.h.ready?.()) this.startLeap(); }
    }
    if (this.phase === 'wall') {
      // 吕布：追主将，定时方天横扫（扇形预警）
      const l = this.lubu;
      // 用户「吕布不会动」根因：群体移动（EnemyMovement）把 controlImmune 的敌人速度清零，吕布一直站桩。这里自己推他走（照样免控），出手 / 横扫预警时站定
      if (l?.active && !this.sweep && l.attackUntil <= now) {
        const dt = this.chaseAt ? Math.min(.1, Math.max(.001, (now - this.chaseAt) / 1000)) : 1 / 60, dx = p.x - l.x, dy = p.y - l.y, dist = Math.hypot(dx, dy);
        if (dist > P.lubuReach) { const st = Math.min(dist - P.lubuReach, P.lubuSpeed * dt), mx = dx / dist * st, my = dy / dist * st; l.sprite.x += mx; l.sprite.y += my; l.intentDx = mx; l.intentDy = my; l.updateWalk(dt, mx, my); }
      }
      this.chaseAt = now;
      if (l?.active) {
        if (!this.sweep && now >= this.nextSweep && Math.hypot(p.x - l.x, p.y - l.y) < 260) { const a = Math.atan2(p.y - l.y, p.x - l.x); this.sweep = { at: now + P.sweepWarnMs, a, id: 'dz-lubu-sweep-' + this.metrics.sweeps }; l.startAttack(now, Math.abs(Math.cos(a)) > .7 ? (Math.cos(a) < 0 ? 'left' : 'right') : Math.sin(a) < 0 ? 'up' : 'down'); this.h.banner('方天横扫', false); }
        if (this.sweep) {
          const prog = 1 - (this.sweep.at - now) / P.sweepWarnMs;
          warnFx(s).sector(this.sweep.id, l.x, l.y, P.sweepR, this.sweep.a, prog, now);
          if (now >= this.sweep.at) {
            warnFx(s).shapeImpact(this.sweep.id, 'sweep', l.x, l.y, P.sweepR, this.sweep.a, now);
            const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - l.y, p.x - l.x) - this.sweep.a));
            if (p.alive && Math.hypot(p.x - l.x, p.y - l.y) <= P.sweepR + p.radius * .5 && da <= P.sweepArc / 2) p.takeDamage(l.def.damage * P.sweepDmgMul, now);
            this.h.legion.hurtArea(l.x, l.y, P.sweepR, l.def.damage * P.sweepDmgMul * .6, now, this.sweep.a, P.sweepArc);
            this.sweep = null; this.nextSweep = now + P.sweepEveryMs; this.metrics.sweeps++;
          }
        }
      }
    }
    if (this.phase === 'down' && d.active && d.hp <= d.maxHp * P.finishAt) this.finale();
  }
  /** 开发预览（?dev=1&cutscene=lubu_kills_dongzhuo）：吕布已逃、董卓已下城，直接进「吕布斩董卓」。 */
  devFinale(): void {
    if (this.phase !== 'wall' && this.phase !== 'down' && this.phase !== 'perch') return;
    this.lubu?.deactivate(); this.lubu = null; this.anim = null; this.sweep = null;
    const d = this.dongzhuo; d.sprite.setPosition(this.perch.x, this.perch.y + DZ_LUBU.perchUp + 70); d.invulnerable = false; d.hp = Math.max(1, Math.floor(d.maxHp * .15));
    this.phase = 'down'; this.finale();
  }
  snapshot() { const l = this.lubu, d = this.dongzhuo; return { phase: this.phase, dzInv: !!d.invulnerable, dzHp: Math.round(d.hp), dzMax: d.maxHp, dzY: Math.round(d.y), lubu: l ? { active: l.active, hp: Math.round(l.hp), max: l.maxHp, inv: !!l.invulnerable, baseHp: l.def.hp } : { active: false, hp: 0, max: 0, inv: false, baseHp: 0 }, metrics: { ...this.metrics }, pending: this.strikes.pending }; }
  clear(): void { this.h.scene.events.off('postupdate', this.tick, this); for (const a of this.art) a.destroy(); this.art = []; this.strikes.clear(); }
}
