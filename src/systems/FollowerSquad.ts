import Phaser from 'phaser';
import { heroAttrs, heroLevel, type HeroKey } from './HeroProgress';
import { BALANCE, DEPTH, FONT } from '../config';
import { getCharacter } from '../data/characters';
import { QUALITIES, type ItemQuality } from '../data/items';
import { FOLLOW, TEMPLATES, type FollowerTemplate } from '../data/recruits';
import { BOSS_VS_ALLY, RECALL } from '../data/legion';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { visualTextureKey } from './ReadableTextures';
import { framesFigure, sheetFigureHeight } from './SpriteMetrics';
import { ACTION_MS, HERO_ACTIONS, type ActionFrame } from '../data/heroActions';
import type { CharacterPassives } from './CharacterPassives';
import { HINT_MOCK, groundScar } from '../ui/HintStyle';
import { followerLevelCap, rankBonus, type Recruit } from './RosterStore';
import { loadout, type GearOwner } from './ItemStore';
import { emptyGear, gearFromItems, type GearStats } from './ItemEffects';
import type { ItemInstance } from '../data/items';

/**
 * 随行武将（RECRUIT_PLAN.md §4，参考《战锤：幸存者》的随从）：一直紧贴主公，不离阵去追敌人。
 * - 阵位：主公身后固定阵位（1 人正后；2 人左后 / 右后；3 人左后 / 右后 / 正后），离主公约 56 像素，随主公移动方向平滑转动；
 *   用指数平滑追阵位（几乎同步，不抖、不滑步），不做碰撞，不会被敌人卡住；偏离超过 160 像素直接归位。
 * - 攻击：只打自己射程内的敌人；近战（枪 / 刀）出手时朝目标前出 22 像素，随后自动回位。四种模板（枪扫一圈 / 刀前方扇形 / 弓单发远射 / 谋延迟火点）。可玩名将暂用与其兵器相近的模板（专属武器跟随版待做，见计划）。
 * - 受伤：每 0.4 秒结算贴身敌人的接触伤害（首领 ×3）。血量打空就倒在原地（播倒地 / 受伤动作），不攻击、不再受伤；
 *   主将走到身边 60 像素内站满 5 秒救起（离开时进度每秒回退 1 秒），带 40% 生命归队。主将头顶环形读条 +「救援」，倒地者头上「救」字，屏幕外给方向箭头。
 * - 动作：名将用 HERO_ACTIONS 自己的攻击 / 倒地帧；无名之辈与史事名将复用蜀军兵种 v2 攻击帧（枪 = 长枪兵、刀 = 刀盾兵、弓 = 弓兵）和军医施术动作（谋），
 *   兵种没有倒地帧，倒地时复用站立帧侧倒 + 下沉 + 变暗。
 * - 不进后备兵编制，不占同屏敌人名额；目标查找走空间网格，每人每 0.15 秒最多查一次。
 * 美术：可玩名将用自己的行走图；史事名将 / 无名之辈用蜀军兵种行走图（谋士复用军医长袍形象）+ 头顶品质色名牌。
 */
type Query = (x: number, y: number, r: number) => Enemy[];
type Hit = (enemy: Enemy, damage: number, fire: boolean) => void;
/** 招式特效种类（招募会话在 attack() 里推入，画法在 updateFx）：'blade-sweep' 刀·横斩一圈 / 'spear-thrust' 枪·突刺直线（tx,ty 为终点）/ 'heal' 谋·包扎回血 / 'block' 刀·格挡闪光。 */
export type FollowerFxKind = FollowerTemplate | 'arrow' | 'puff' | 'blade-sweep' | 'spear-thrust' | 'heal' | 'block';
interface Fx { kind: FollowerFxKind; x: number; y: number; tx: number; ty: number; angle: number; at: number; until: number; hitAt?: number; damage?: number; owner?: Follower; scar?: boolean; img?: Phaser.GameObjects.Image }
/**
 * 无名随行（枪 / 刀 / 弓 / 谋）出手特效（2026-11-17 用户：「很多大众脸攻击特效要改一下」）：原来全是代码画的弧线 / 直线 / 圆，
 * 改成复用现成手绘序列帧，按兵器区分、比名将招牌弱（小、淡、短）：
 *  枪 = 月白横扫弧光 fx_flank_streak（冷钢蓝调）；刀 = 半月刀气 fx_drag_wave（暖白）；弓 = 箭矢贴图 arrow 飞行；
 *  谋 = 火星聚拢 hero_small_paint 第 3 行 → 地火 fx_ground_fire；救起 = 星芒 fx_strike_glint。缺图时退回原来的代码画法。
 */
const FFX: Record<string, { key: string; frames: number; size: number; alpha: number; tint?: number; add: boolean; first?: number }> = {
  spear: { key: 'fx_flank_streak', frames: 6, size: 118, alpha: .62, tint: 0xcfe0ff, add: true },
  blade: { key: 'fx_drag_wave', frames: 6, size: 92, alpha: .7, add: true },
  gather: { key: 'hero_small_paint', frames: 4, size: 96, alpha: .7, add: true, first: 12 },
  fire: { key: 'fx_ground_fire', frames: 6, size: 92, alpha: .8, add: false },
  puff: { key: 'fx_strike_glint', frames: 6, size: 48, alpha: .8, add: true },
  sweep: { key: 'fx_drag_wave', frames: 6, size: 112, alpha: .62, tint: 0xffe6c4, add: true },
  thrust: { key: 'refined_spear', frames: 6, size: 150, alpha: .78, add: false },
  heal: { key: 'hero_small_paint', frames: 6, size: 104, alpha: .7, tint: 0xa8f0a0, add: true, first: 6 },
  block: { key: 'fx_strike_glint', frames: 6, size: 34, alpha: .85, tint: 0xd6e6ff, add: true },
};
const FX_CAP = 24;

const QUALITY_POWER: Record<ItemQuality, number> = { white: 1, green: 1.15, blue: 1.3, purple: 1.5, orange: 1.6 };
const TROOP_SHEET: Record<FollowerTemplate, string> = { spear: 'shu_spearman_walk_sheet', blade: 'shu_swordsman_walk_sheet', bow: 'shu_archer_walk_sheet', strategist: 'legion_medic_walk' };
/** 无名之辈 / 史事名将的出手动作：复用兵种攻击图（v2 切帧后帧名 atk_方向_0/1；军医施术图帧名 方向_0..3）。弓兵攻击表各行都朝右拉弓，朝左时镜像（同后备兵）。 */
const TROOP_ATTACK: Record<FollowerTemplate, string> = { spear: 'shu_spearman_attack_sheet', blade: 'shu_swordsman_attack_sheet', bow: 'shu_archer_attack_sheet', strategist: 'legion_medic_action' };
type Dir = 'down' | 'up' | 'left' | 'right';
export type FollowerAct = 'attack' | 'skill' | 'hurt' | 'die';
interface ActState { key: string; frames: ActionFrame[]; mirror: boolean; start: number; until: number; hold: boolean }
const heroSheet = (id: string) => id === 'zhaoyun' ? 'hero_walk_sheet' : `${id}_walk_sheet`;

export class Follower {
  hp = 1; maxHp = 1; cooldown = 0; target: Enemy | null = null; nextQuery = 0; nextContact = 0;
  /** 出击时追的目标与重选时间。 */
  sortieTarget: Enemy | null = null; sortieUntil = 0;
  /** 上一帧是否在追击；护阵收回（RECALL）状态、开始时间、最近距离与最近一次靠近的时间。 */
  chasing = false; recalling = false; recallAt = 0; recallBest = 0; recallBestAt = 0;
  /** 倒地（等主将来救）与救援进度（秒）；救起次数。 */
  downed = false; reviveProgress = 0; revives = 0; bossImmuneUntil = 0;
  /** 正在播的动作（攻击 / 受伤 / 倒地），播完回到行走帧；倒地动作定格在最后一帧。 */
  act: ActState | null = null;
  private readonly fits = new Map<string, { k: number; originY: number }>();
  /** 倒地标记与屏幕外箭头的文字（用到才建）。 */
  mark?: Phaser.GameObjects.Text; arrowText?: Phaser.GameObjects.Text;
  slot = 0; dir: 'down' | 'up' | 'left' | 'right' = 'down'; walk = 0; lastX = 0; lastY = 0; hurtUntil = 0; downs = 0; kills = 0; hits = 0;
  /** 近战前出的偏移（出手时设、之后衰减回 0）与面向目标的时限。 */
  lx = 0; ly = 0; faceUntil = 0;
  /** 可玩名将随行：本命武器执行器（战斗场景 createFollowerWeapon 提供）、武器等级、伤害 / 冷却倍率。没有执行器时用模板攻击。 */
  weaponRun: ((dt: number, now: number) => void) | null = null; weaponLevel = 1; weaponDamageMul = 1; weaponCooldownMul = 1;
  /** 名将随行自己的天赋被动（战斗场景建本命武器时挂上；按 FOLLOW.passiveScale 折算）。 */
  passive: CharacterPassives | null = null;
  readonly sprite: Phaser.GameObjects.Image; readonly shadow: Phaser.GameObjects.Ellipse; readonly label: Phaser.GameObjects.Text; readonly bar: Phaser.GameObjects.Graphics;
  readonly sheet: string; readonly template: FollowerTemplate; readonly damage: number; readonly speedMul: number; readonly haste: number; readonly gear: GearStats; level: number;
  constructor(readonly scene: Phaser.Scene, readonly recruit: Recruit, x: number, y: number, leaderLevelHp: number) {
    this.template = recruit.template;
    const t = TEMPLATES[this.template], b = rankBonus(recruit), hero = recruit.hero ? getCharacter(recruit.hero) : null, q = QUALITY_POWER[recruit.quality];
    const own = hero ? heroSheet(hero.id) : '';
    this.sheet = own && scene.textures.exists(own) ? own : scene.textures.exists(TROOP_SHEET[this.template]) ? TROOP_SHEET[this.template] : 'hero_walk_sheet';
    // 自己身上的兵装（行囊里给这名武将穿的，不叠到主将身上；招来的 r_ 武将不骑马）
    let g = emptyGear(); try { g = gearFromItems(Object.values(loadout((recruit.hero ?? recruit.id) as GearOwner)).filter((i): i is ItemInstance => !!i)); } catch { /* 行囊不可用 */ }
    this.gear = g;
    // 武将等级：可玩名将用自己加过的属性点（武力 / 体魄），招来的 r_ 武将按等级直接成长
    let dmgLv = 1, hpLv = 1; this.level = 1;
    try { const key = (recruit.hero ?? recruit.id) as HeroKey; this.level = Math.min(heroLevel(key), followerLevelCap()); // 随行等级不超过随行上限（主公不会出现在随行里）
      if (recruit.hero) { const a = heroAttrs(key); dmgLv = 1 + FOLLOW.mightDamage * a.strength; hpLv = 1 + FOLLOW.constitutionHp * a.strength; }
      else { dmgLv = 1 + FOLLOW.levelDamage * Math.max(0, this.level - 1); hpLv = 1 + FOLLOW.levelHp * Math.max(0, this.level - 1); } } catch { /* 等级存档不可用 */ }
    this.damage = t.damage * q * (hero?.damageMul ?? 1) * (1 + b.damage) * (1 + g.damage) * (1 + g.crit) * dmgLv;
    this.maxHp = Math.round(t.hp * q * (hero?.hpMul ?? 1) * (1 + b.hp) * (1 + g.hp) * hpLv * leaderLevelHp); this.hp = this.maxHp;
    this.speedMul = t.speed * (hero?.speedMul ?? 1) * (1 + g.move);
    this.haste = (1 + b.haste) * (1 + g.attackSpeed);
    if (hero) {
      this.weaponLevel = Math.max(1, FOLLOW.weaponLevelAt.filter(lv => this.level >= lv).length);
      this.weaponDamageMul = FOLLOW.heroDamageMul * hero.damageMul * (1 + b.damage) * (1 + g.damage) * (1 + g.crit) * dmgLv;
      this.weaponCooldownMul = FOLLOW.heroCooldownMul / this.haste;
    }
    this.cooldown = .3 + Math.random() * .4;
    this.shadow = scene.add.ellipse(x, y + 2, 34, 12, 0x000000, .28).setDepth(DEPTH.player - 2);
    this.sprite = scene.add.image(x, y, visualTextureKey(scene, this.sheet), 'down_0').setOrigin(.5, .86).setDepth(DEPTH.player - 1);
    const fh = this.sprite.frame.height || 96; this.sprite.setScale(70 / fh);
    if (!hero && this.sheet === 'hero_walk_sheet') this.sprite.setTint(QUALITIES[recruit.quality].color);
    this.label = scene.add.text(x, y - 66, recruit.name.replace(/（.*）/, ''), { fontFamily: FONT, fontSize: '13px', color: QUALITIES[recruit.quality].css, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.player + 1).setStroke('#120c06', 3);
    this.bar = scene.add.graphics().setDepth(DEPTH.player + 1);
    this.lastX = x; this.lastY = y;
  }
  get x() { return this.sprite.x; } get y() { return this.sprite.y; }
  /** 平常的行走速度（像素 / 秒）：主将基础移速 × 自己的移速倍率。收回时 × RECALL.speedMul。 */
  get walkSpeed(): number { return BALANCE.player.speed * this.speedMul; }
  /** 倒地期间不行动（本命武器执行器也按这个判断）。 */
  get resting() { return this.downed; }
  setVisible(on: boolean) { this.sprite.setVisible(on); this.shadow.setVisible(on); this.label.setVisible(on); this.bar.setVisible(on); }
  place(x: number, y: number) { this.sprite.setPosition(x, y); this.lastX = x; this.lastY = y; }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); this.label.destroy(); this.bar.destroy(); this.mark?.destroy(); this.arrowText?.destroy(); }
  /** 行走帧缩放（人物约 70 像素高）。 */
  get walkScale(): number { const k = visualTextureKey(this.scene, this.sheet), fh = this.scene.textures.getFrame(k, 'down_0')?.height || 96; return 70 / fh; }
  /**
   * 播动作。名将：HERO_ACTIONS 的攻击（四向，朝左镜像朝右）/ 招牌 / 受伤 / 倒地帧；
   * 无名之辈与史事名将：只有攻击动作，复用兵种攻击图。返回是否播出（没有对应帧时 false）。
   */
  play(kind: FollowerAct, dir: Dir, now: number): boolean {
    if (this.downed && kind !== 'die' && kind !== 'hurt') return false;
    const hero = this.recruit.hero, set = hero ? HERO_ACTIONS[hero] : undefined;
    let key = '', frames: ActionFrame[] | undefined, mirror = false;
    if (set && this.scene.textures.exists(set.texture)) {
      key = set.texture;
      if (kind === 'attack' || (kind === 'skill' && !set.skill?.length)) { if (dir === 'left') { frames = set.attack.left ?? set.attack.right; mirror = !set.attack.left; } else frames = set.attack[dir]; }
      else { frames = set[kind]; mirror = dir === 'left'; }
    } else if (!hero && kind === 'attack') {
      key = TROOP_ATTACK[this.template]; if (!this.scene.textures.exists(key)) return false;
      if (this.template === 'strategist') frames = [0, 1, 2, 3].map(i => `${dir}_${i}`);
      else if (this.template === 'bow') { frames = ['atk_right_0', 'atk_right_1']; mirror = dir === 'left'; }
      else frames = [`atk_${dir}_0`, `atk_${dir}_1`];
    }
    if (!key || !frames?.length || !frames.every(fr => this.scene.textures.get(key).has(String(fr)))) return false;
    const hold = kind === 'die';
    this.act = { key, frames, mirror, start: now, until: now + (ACTION_MS[kind] ?? 260), hold };
    return true;
  }
  /** 动作帧 → 缩放与脚底锚点（同主将的做法：按「站姿人物高度」之比统一缩放，脚线对齐行走帧，切换时人物不忽大忽小、脚不上下跳）。 */
  fitFor(key: string, ref: ActionFrame[]): { k: number; originY: number } {
    const hit = this.fits.get(key); if (hit) return hit;
    const walkKey = visualTextureKey(this.scene, this.sheet), walkFrameH = this.scene.textures.getFrame(walkKey, 'down_0')?.height || 96, actFrameH = this.scene.textures.getFrame(key, ref[0])?.height || 96;
    const walkRef = framesFigure(this.scene, walkKey, (['down', 'left', 'right', 'up'] as const).flatMap(d => [0, 1, 2, 3].map(i => `${d}_${i}`)));
    const actRef = framesFigure(this.scene, key, ref);
    const walkH = walkRef?.height ?? sheetFigureHeight(this.scene, walkKey) ?? 90, actH = actRef?.height ?? sheetFigureHeight(this.scene, key) ?? 90;
    const kw = 70 / walkFrameH, k = kw * walkH / actH;
    const walkFoot = ((walkRef?.bottom ?? walkFrameH * .96) + 1 - walkFrameH * .86) * kw;
    const fit = { k, originY: Phaser.Math.Clamp(((actRef?.bottom ?? actFrameH * .89) + 1 - walkFoot / k) / actFrameH, .3, .95) };
    if (walkRef && actRef) this.fits.set(key, fit);
    return fit;
  }
}

export class FollowerSquad {
  readonly members: Follower[] = [];
  private readonly fx: Fx[] = [];
  /** 出手特效图片池（同屏上限 FX_CAP，超出只出伤害不出图）。 */
  private readonly fxPool: Phaser.GameObjects.Image[] = []; private fxLive = 0;
  /** 命中火花（场景设置）：按兵器类型出现成的手绘命中图，弱于名将。 */
  onHitFx?: (e: Enemy, kind: FollowerTemplate, fromX: number, fromY: number) => void;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly buf: Enemy[] = [];
  /** 统计（测试 / 平衡用）。 */
  readonly stats = { damage: 0, hits: 0, teleports: 0, downs: 0, revives: 0, maxDist: 0, recalls: 0, recallTeleports: 0 };
  /** 救援界面：主将头顶环形读条与「救援」字样、屏幕外方向箭头（都在世界坐标里画，箭头贴可见范围边缘）。 */
  private readonly rescueGfx: Phaser.GameObjects.Graphics; private readonly rescueText: Phaser.GameObjects.Text; private readonly hud: Phaser.GameObjects.Graphics;
  /** 当前吃主将全局伤害加成的倍率（本命武器结算时用）。 */
  share = 1;
  /** 当前是否出击（读部曲指令）。 */
  sortie = false;
  /** 随行实际在用的规则（FOLLOW）。测试改参数要改这一份：常开的 dev server 热更新后，测试自己 import 的 recruits.ts 可能是另一个模块实例。 */
  readonly rules = FOLLOW;
  /** 本命武器命中时记账（测试 / 平衡用）。 */
  credit(f: Follower, damage: number): void { this.stats.damage += damage; this.stats.hits++; f.hits++; }
  /** 阵位朝向（给本命武器的 heading 用）。 */
  get facing(): number { return this.heading; }
  /** 阵位朝向（主公移动方向，平滑后；起始朝下）。 */
  private heading = Math.PI / 2; private px = NaN; private py = NaN;
  /** 主公速度（平滑后）：追阵位时提前量（前馈），匀速跑动时不落后。 */
  private vx = 0; private vy = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, recruits: Recruit[], private readonly query: Query, private readonly hit: Hit, private readonly leaderDamage: () => number) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    this.rescueGfx = scene.add.graphics().setDepth(DEPTH.player + 3).setName('follower-rescue-ring');
    this.rescueText = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#ffe3a0', resolution: 2 }).setOrigin(.5).setDepth(DEPTH.player + 3).setStroke('#2a1408', 4).setVisible(false).setName('follower-rescue-text');
    this.hud = scene.add.graphics().setDepth(DEPTH.player + 40).setName('follower-rescue-arrows');
    const n = recruits.length;
    recruits.forEach((r, i) => { const s = this.slotPos(i, n), f = new Follower(scene, r, s.x, s.y, 1); f.slot = i; this.members.push(f); });
    // 可玩名将用本命武器（场景支持时）；测试面板与正式出征共用这里
    const make = (scene as { createFollowerWeapon?: (f: Follower, squad: FollowerSquad) => ((dt: number, now: number) => void) | null }).createFollowerWeapon;
    if (make) for (const f of this.members) if (f.recruit.hero) f.weaponRun = make.call(scene, f, this);
  }
  /** 阵位相对主公后方的角度偏移：1 人正后；2 人左后 / 右后；3 人左后 / 右后 / 正后。 */
  private static readonly OFFSETS: readonly (readonly number[])[] = [[0], [0], [-.8, .8], [-1, 1, 0]];
  private slotPos(i: number, n: number): { x: number; y: number } {
    const offs = FollowerSquad.OFFSETS[Math.min(3, Math.max(1, n))], a = this.heading + Math.PI + (offs[i] ?? 0), r = FOLLOW.slotRadius * (offs[i] === 0 && n === 3 ? 1.15 : 1);
    return { x: this.player.x + Math.cos(a) * r, y: this.player.y + Math.sin(a) * r };
  }

  update(dt: number, now: number): void {
    const p = this.player, n = this.members.length, dmgShare = 1 + FOLLOW.shareLeaderDamage * (Math.max(.2, this.leaderDamage()) - 1); this.share = dmgShare;
    // 部曲 HUD 的「出击」也带上随行（护阵时紧贴主将）
    const sortie = (this.scene as { legion?: { order?: string } }).legion?.order === 'sortie'; this.sortie = sortie;
    this.gfx.clear();
    for (const f of this.members) {
      if (f.downed) { this.updateDowned(f, dt, now); this.render(f, now); continue; }
      // 阵位 + 近战前出偏移（指数衰减回位）
      const decay = Math.exp(-8 * dt); f.lx *= decay; f.ly *= decay;
      const sortieTarget = sortie ? this.sortieTarget(f, now) : null;
      if (f.passive) f.passive.areaMul = sortie ? FOLLOW.sortieRangeMul : 1; // 出击：名将武器范围放大
      if (sortieTarget) { this.chase(f, sortieTarget, dt, now); f.chasing = true; f.recalling = false; }
      else {
      const s = this.slotPos(f.slot, n), lead = 1 / FOLLOW.followK, gx = s.x + f.lx + this.vx * lead, gy = s.y + f.ly + this.vy * lead, d = Math.hypot(gx - f.x, gy - f.y);
      // 刚停止追击（切回护阵 / 附近没敌人了）且离阵位较远：进入收回状态，按行走速度跑回去（不再一下子被拉回来）
      if (f.chasing && d > RECALL.enterDist && !f.recalling) { f.recalling = true; f.recallAt = now; f.recallBest = d; f.recallBestAt = now; this.stats.recalls++; }
      f.chasing = false;
      if (f.recalling) this.recall(f, gx, gy, d, dt, now);
      else {
      if (d > FOLLOW.snap) this.teleport(f, gx, gy);
      this.move(f, gx, gy, dt, now);
      }
      }
      // 可玩名将：本命武器自己找目标、出手（以随行为发射源）
      if (f.weaponRun) { f.weaponRun(dt, now); }
      else {
      // 索敌：护阵时只找自己射程内的敌人（不离阵去追）；出击时射程 ×sortieRangeMul，优先出击目标
      const t = TEMPLATES[f.template], range = t.range * (sortie ? FOLLOW.sortieRangeMul : 1);
      if (sortieTarget && Math.hypot(sortieTarget.x - f.x, sortieTarget.y - f.y) <= range) f.target = sortieTarget;
      if (f.target && (!f.target.active || Math.hypot(f.target.x - f.x, f.target.y - f.y) > range)) f.target = null;
      if (!f.target && now >= f.nextQuery) { f.nextQuery = now + 150; f.target = this.nearest(f.x, f.y, range, f.x, f.y); }
      // 攻击
      f.cooldown -= dt;
      if (f.target && f.cooldown <= 0) {
        f.cooldown = t.cooldown / 1000 / f.haste; this.attack(f, f.target, now, f.damage * dmgShare); f.faceUntil = now + 320;
        if (f.template === 'spear' || f.template === 'blade') { const a = Math.atan2(f.target.y - f.y, f.target.x - f.x); f.lx = Math.cos(a) * FOLLOW.lunge; f.ly = Math.sin(a) * FOLLOW.lunge; }
      }
      }
      if (f.gear.regen > 0) f.hp = Math.min(f.maxHp, f.hp + f.gear.regen * dt);
      // 接触伤害
      if (now >= f.nextContact) {
        f.nextContact = now + 400; let dmg = 0, boss = 0;
        for (const e of this.query(f.x, f.y, 26)) if (e.active && Math.hypot(e.x - f.x, e.y - f.y) < 22 + (e.def.radius ?? 14)) { if (e.kind === 'boss') boss += e.def.damage * FOLLOW.bossMul; else dmg += e.def.damage; }
        // 首领打随从：再 × BOSS_VS_ALLY.mul，挨一下后 immuneMs 内不再吃首领伤害（与士兵同一套）
        if (boss > 0 && now >= f.bossImmuneUntil) { dmg += boss * BOSS_VS_ALLY.mul; f.bossImmuneUntil = now + BOSS_VS_ALLY.immuneMs; }
        if (dmg > 0) this.hurt(f, dmg, now);
      }
      this.render(f, now);
      this.stats.maxDist = Math.max(this.stats.maxDist, Math.hypot(f.x - p.x, f.y - p.y));
    }
    this.drawRescue(now);
    // 阵位朝向：跟主公的移动方向平滑转动（停下时保持）
    if (Number.isFinite(this.px) && dt > 0) { const mx = p.x - this.px, my = p.y - this.py, kv = 1 - Math.exp(-10 * dt), jump = Math.hypot(mx, my) > 60; this.vx = jump ? 0 : this.vx + (mx / dt - this.vx) * kv; this.vy = jump ? 0 : this.vy + (my / dt - this.vy) * kv; if (Math.hypot(mx, my) > .4) { const to = Math.atan2(my, mx), d = Phaser.Math.Angle.Wrap(to - this.heading); this.heading += d * (1 - Math.exp(-FOLLOW.turnRate * dt)); } }
    this.px = p.x; this.py = p.y;
    this.updateFx(now);
  }
  /** 外部伤害（首领技能等）。 */
  hurt(f: Follower, damage: number, now: number): void {
    if (f.downed) return; // 倒地期间不被追打补刀
    if (f.passive) { if (f.passive.isInvulnerable(now)) return; const m = f.passive.damageTakenMultiplier(now); damage *= 1 - (1 - m) * FOLLOW.passiveScale; f.passive.onDamage(now); }
    f.hp -= damage * Math.max(0, 1 - f.gear.reduce); f.hurtUntil = now + 140;
    if (f.hp <= 0) this.down(f, now); else if (!f.act || now >= f.act.until) f.play('hurt', f.dir, now);
  }
  /** 倒在原地：名将播倒地动作并定格；兵种复用站立帧侧倒 + 下沉 + 变暗。 */
  down(f: Follower, now: number): void {
    f.hp = 0; f.downed = true; f.reviveProgress = 0; f.downs++; this.stats.downs++; f.target = null; f.lx = f.ly = 0; f.walk = 0;
    if (!f.play('die', f.dir, now)) f.act = null;
  }
  /** 救起：带 FOLLOW.reviveHp 生命，回到阵位继续战斗。 */
  revive(f: Follower, now: number): void {
    f.downed = false; f.reviveProgress = 0; f.revives++; this.stats.revives++; f.act = null; f.hp = Math.max(1, Math.round(f.maxHp * (this.player.growth.followerRevive()?.hp ?? FOLLOW.reviveHp))); // 统御·同袍
    f.sprite.setAngle(0).clearTint().setAlpha(1); f.cooldown = .3; f.nextContact = now + 600; f.mark?.setVisible(false); f.arrowText?.setVisible(false);
    this.puff(f.x, f.y, now);
  }
  /** 主将在半径内：每秒 +1 秒进度；离开：每秒回退 FOLLOW.reviveDecay 秒（缓慢回退，不清零）。 */
  private updateDowned(f: Follower, dt: number, now: number): void {
    const d = Math.hypot(this.player.x - f.x, this.player.y - f.y);
    f.reviveProgress = d <= FOLLOW.reviveRadius ? f.reviveProgress + dt : Math.max(0, f.reviveProgress - dt * FOLLOW.reviveDecay);
    if (f.reviveProgress >= FOLLOW.reviveSec * (this.player.growth.followerRevive()?.secMul ?? 1)) this.revive(f, now); // 统御·同袍
  }
  /** 救援界面：主将头顶环形读条 +「救援」、倒地者头上「救」字、屏幕外方向箭头。 */
  private drawRescue(now: number): void {
    const g = this.rescueGfx, hud = this.hud, p = this.player; g.clear(); hud.clear();
    let best: Follower | null = null;
    for (const f of this.members) {
      if (!f.downed) continue;
      if (Math.hypot(p.x - f.x, p.y - f.y) <= FOLLOW.reviveRadius && (!best || f.reviveProgress > best.reviveProgress)) best = f;
      // 倒地者头上「救」字（脉动）
      if (!f.mark) f.mark = this.scene.add.text(0, 0, '救', { fontFamily: FONT, fontSize: '16px', color: '#fff2c8', backgroundColor: '#b8322a', padding: { x: 4, y: 1 }, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.player + 2).setName('follower-down-mark');
      f.mark.setVisible(true).setPosition(f.x, f.y - 88 + Math.sin(now / 180) * 3).setScale(1 + .08 * Math.sin(now / 160));
      // 屏幕外：屏幕边缘方向箭头
      const cam = this.scene.cameras.main, v = cam.worldView;
      if (!v.contains(f.x, f.y - 20)) {
        // 箭头画在世界坐标里、贴着当前可见范围的边缘（随镜头每帧重画），不受镜头缩放影响
        const cx = v.x + v.width / 2, cy = v.y + v.height / 2, a = Math.atan2(f.y - cy, f.x - cx);
        const m = 34, tx = Math.cos(a), ty = Math.sin(a), s = Math.min((v.width / 2 - m) / Math.max(1e-6, Math.abs(tx)), (v.height / 2 - m) / Math.max(1e-6, Math.abs(ty)));
        const ax = cx + tx * s, ay = cy + ty * s;
        hud.fillStyle(0xb8322a, .95).fillCircle(ax, ay, 15).lineStyle(2, 0xffe3a0, 1).strokeCircle(ax, ay, 15);
        hud.fillStyle(0xffe3a0, 1).fillTriangle(ax + tx * 26, ay + ty * 26, ax + tx * 14 - ty * 9, ay + ty * 14 + tx * 9, ax + tx * 14 + ty * 9, ay + ty * 14 - tx * 9);
        if (!f.arrowText) f.arrowText = this.scene.add.text(0, 0, '救', { fontFamily: FONT, fontSize: '14px', color: '#fff2c8', resolution: 2 }).setOrigin(.5).setDepth(DEPTH.player + 41).setName('follower-down-arrow');
        f.arrowText.setVisible(true).setPosition(ax, ay);
      } else f.arrowText?.setVisible(false);
    }
    if (best) {
      const x = p.x, y = p.y - 100, r = 17, k = Math.min(1, best.reviveProgress / (FOLLOW.reviveSec * (this.player.growth.followerRevive()?.secMul ?? 1)));
      g.fillStyle(0x140c06, .7).fillCircle(x, y, r + 4);
      g.lineStyle(5, 0x3a2a1c, 1).strokeCircle(x, y, r);
      g.lineStyle(5, 0xffcf5a, 1).beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
      this.rescueText.setVisible(true).setPosition(x, y - r - 16).setText(`救援 ${best.recruit.name.replace(/（.*）/, '')}`);
    } else this.rescueText.setVisible(false);
  }
  private nearest(cx: number, cy: number, r: number, fx: number, fy: number): Enemy | null {
    this.buf.length = 0; let best: Enemy | null = null, bd = Infinity;
    for (const e of this.query(cx, cy, r, )) { if (!e.active || e.invulnerable) continue; const d = (e.x - fx) ** 2 + (e.y - fy) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  /** 出击目标：主将 sortieSeek 内，首领 > 精锐 > 离随行最近；每 0.2 秒重选一次（目标没了立刻重选）。 */
  private sortieTarget(f: Follower, now: number): Enemy | null {
    const cur = f.sortieTarget;
    if (cur && cur.active && !cur.invulnerable && Math.hypot(cur.x - this.player.x, cur.y - this.player.y) <= FOLLOW.sortieSeek + 40 && now < f.sortieUntil) return cur;
    let best: Enemy | null = null, score = Infinity;
    for (const e of this.query(this.player.x, this.player.y, FOLLOW.sortieSeek)) {
      if (!e.active || e.invulnerable || e.isSupplySlot) continue;
      const rank = e.kind === 'boss' ? 0 : e.kind === 'elite' ? 1 : 2, d = Math.hypot(e.x - f.x, e.y - f.y), sc = rank * 10000 + d;
      if (sc < score) { score = sc; best = e; }
    }
    f.sortieTarget = best; f.sortieUntil = now + 200; return best;
  }
  /** 出击追击：以 sortieSpeed 冲到目标的攻击距离上；离主将最远 sortieLeash，超出沿方向收回。 */
  private chase(f: Follower, e: Enemy, dt: number, now: number): void {
    const reach = f.weaponRun ? 70 : TEMPLATES[f.template].range * .7, d = Math.hypot(e.x - f.x, e.y - f.y) || 1;
    let gx = e.x - (e.x - f.x) / d * reach, gy = e.y - (e.y - f.y) / d * reach;
    const lx = gx - this.player.x, ly = gy - this.player.y, ld = Math.hypot(lx, ly);
    if (ld > FOLLOW.sortieLeash) { gx = this.player.x + lx / ld * FOLLOW.sortieLeash; gy = this.player.y + ly / ld * FOLLOW.sortieLeash; }
    const dx = gx - f.x, dy = gy - f.y, dist = Math.hypot(dx, dy), step = Math.min(dist, FOLLOW.sortieSpeed * f.speedMul * dt);
    if (step > .25) {
      f.sprite.setPosition(f.x + dx / dist * step, f.y + dy / dist * step); f.walk += step; f.passive?.onMove(now);
      if (now >= f.faceUntil) f.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    } else f.walk = 0;
    f.lastX = f.x; f.lastY = f.y;
  }
  private teleport(f: Follower, x: number, y: number): void { f.place(x, y); f.target = null; this.stats.teleports++; f.sprite.setAlpha(.3); this.scene.tweens.add({ targets: f.sprite, alpha: 1, duration: 220 }); }
  /**
   * 护阵收回（RECALL）：正在播的出手 / 受伤动作先播完；之后转身朝阵位、播行走帧、以 行走速度 × RECALL.speedMul 跑回去。
   * 回到 doneDist 以内恢复紧贴跟随。兜底：收回超过 fallbackMs 仍离阵位超过 farPx（约 1.5 屏）或 stuckMs 内没再靠近，直接归位。
   */
  private recall(f: Follower, gx: number, gy: number, d: number, dt: number, now: number): void {
    if (d < f.recallBest - RECALL.progressPx) { f.recallBest = d; f.recallBestAt = now; }
    if (now - f.recallAt > RECALL.fallbackMs && (d > RECALL.farPx || now - f.recallBestAt > RECALL.stuckMs)) { this.teleport(f, gx, gy); f.recalling = false; this.stats.recallTeleports++; return; }
    if (d <= RECALL.doneDist) { f.recalling = false; this.move(f, gx, gy, dt, now); return; }
    if (f.act && !f.act.hold && now < f.act.until) { f.walk = 0; f.lastX = f.x; f.lastY = f.y; return; } // 先把这一下打完
    const dx = gx - f.x, dy = gy - f.y, step = Math.min(d, f.walkSpeed * RECALL.speedMul * dt);
    f.sprite.setPosition(f.x + dx / d * step, f.y + dy / d * step); f.walk += step; f.passive?.onMove(now);
    f.faceUntil = 0; f.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; // 面朝阵位跑
    f.lastX = f.x; f.lastY = f.y;
  }
  /** 指数平滑追阵位（与帧率无关），走路距离推动行走帧，朝向跟随移动方向（出手后短时间朝向目标）。 */
  private move(f: Follower, gx: number, gy: number, dt: number, now: number) {
    const k = 1 - Math.exp(-FOLLOW.followK * dt), dx = (gx - f.x) * k, dy = (gy - f.y) * k, step = Math.hypot(dx, dy);
    f.sprite.setPosition(f.x + dx, f.y + dy);
    if (step > .25) {
      f.walk += step; f.passive?.onMove(now);
      if (now >= f.faceUntil && step > .6) { const horiz = f.dir === 'left' || f.dir === 'right', useX = horiz ? Math.abs(dx) * 1.2 >= Math.abs(dy) : Math.abs(dx) > Math.abs(dy) * 1.2; f.dir = useX ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; }
    } else f.walk = 0;
    f.lastX = f.x; f.lastY = f.y;
  }
  /** 随行名将普通出手音效（没有本命武器时，按模板；GameScene 接到 Sfx）。 */
  attackSound: ((template: FollowerTemplate) => void) | null = null;
  private attack(f: Follower, e: Enemy, now: number, damage: number) {
    this.attackSound?.(f.template);
    const a = Math.atan2(e.y - f.y, e.x - f.x);
    f.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.cos(a) < 0 ? 'left' : 'right' : Math.sin(a) < 0 ? 'up' : 'down';
    f.play('attack', f.dir, now);
    const deal = (x: Enemy, n: number, fire = false) => { const live = x.active; this.hit(x, n, fire); this.stats.damage += n; this.stats.hits++; f.hits++; if (live) this.onHitFx?.(x, f.template, f.x, f.y); };
    if (f.template === 'spear') {
      let k = 0; for (const x of this.query(f.x, f.y, TEMPLATES.spear.range)) { if (k >= 6) break; if (x.active && Math.hypot(x.x - f.x, x.y - f.y) <= TEMPLATES.spear.range) { deal(x, damage); k++; } }
      this.fx.push({ kind: 'spear', x: f.x, y: f.y, tx: 0, ty: 0, angle: a, at: now, until: now + 220 });
    } else if (f.template === 'blade') {
      let k = 0; const R = TEMPLATES.blade.range;
      for (const x of this.query(f.x, f.y, R)) { if (k >= 6) break; if (!x.active) continue; const d = Math.hypot(x.x - f.x, x.y - f.y), da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(x.y - f.y, x.x - f.x) - a)); if (d <= R && (da < .9 || d < 26)) { deal(x, damage); k++; } }
      this.fx.push({ kind: 'blade', x: f.x, y: f.y, tx: 0, ty: 0, angle: a, at: now, until: now + 200 });
    } else if (f.template === 'bow') {
      deal(e, damage); this.fx.push({ kind: 'arrow', x: f.x, y: f.y - 30, tx: e.x, ty: e.y - 20, angle: a, at: now, until: now + 140 });
    } else {
      this.fx.push({ kind: 'strategist', x: e.x, y: e.y, tx: e.x, ty: e.y, angle: a, at: now, until: now + 620, hitAt: now + 320, damage, owner: f });
    }
  }
  private updateFx(now: number) {
    const g = this.gfx;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const fx = this.fx[i], k = Math.min(1, (now - fx.at) / (fx.until - fx.at));
      if (fx.hitAt && now >= fx.hitAt && fx.damage !== undefined) {
        let n = 0; for (const x of this.query(fx.tx, fx.ty, 48)) { if (n >= 8) break; if (x.active && Math.hypot(x.x - fx.tx, x.y - fx.ty) <= 48) { this.hit(x, fx.damage, true); this.stats.damage += fx.damage; this.stats.hits++; if (fx.owner) fx.owner.hits++; n++; if (n <= 2) this.onHitFx?.(x, 'strategist', fx.tx, fx.ty - 40); } }
        fx.hitAt = undefined; this.dropImg(fx); // 火点：聚拢帧换成地火帧
      }
      if (now >= fx.until) { this.dropImg(fx); this.fx.splice(i, 1); continue; }
      // 招式（招募会话 2026-11-17）：横斩 = 半月刀气绕身转一圈；突刺 = 手绘枪影从随行刺向终点；包扎 = 脚下绿金光圈；格挡 = 小星芒。缺图时不画
      if (fx.kind === 'blade-sweep') { this.paint(fx, 'sweep', fx.x + Math.cos(fx.angle + k * Math.PI * 2) * 26, fx.y - 16 + Math.sin(fx.angle + k * Math.PI * 2) * 20, k, fx.angle + k * Math.PI * 2); continue; }
      if (fx.kind === 'spear-thrust') { const len = Math.hypot(fx.tx - fx.x, fx.ty - fx.y) || 1; this.paint(fx, 'thrust', fx.x + (fx.tx - fx.x) * (.35 + .25 * k), fx.y - 14 + (fx.ty - fx.y) * (.35 + .25 * k), k, fx.angle, len / 150, len / 150 * 64 / 384 * 1.6); continue; }
      if (fx.kind === 'heal') { this.paint(fx, 'heal', fx.x, fx.y - 22, k, 0); continue; }
      if (fx.kind === 'block') { this.paint(fx, 'block', fx.x, fx.y - 24, k, fx.angle); continue; }
      if (fx.kind === 'puff') { if (!this.paint(fx, 'puff', fx.x, fx.y, k, 0)) { g.lineStyle(4, 0xe8f2ff, .8 * (1 - k)); g.strokeCircle(fx.x, fx.y, 20 + 20 * k); } continue; }
      if (fx.kind === 'spear' && this.paint(fx, 'spear', fx.x + Math.cos(fx.angle) * 20, fx.y - 14 + Math.sin(fx.angle) * 20, k, fx.angle)) continue;
      if (fx.kind === 'blade' && this.paint(fx, 'blade', fx.x + Math.cos(fx.angle) * 30, fx.y - 16 + Math.sin(fx.angle) * 30, k, fx.angle)) continue;
      if (fx.kind === 'arrow' && this.scene.textures.exists('arrow')) {
        if (!fx.img) fx.img = this.takeImg('arrow');
        fx.img?.setPosition(fx.x + (fx.tx - fx.x) * k, fx.y + (fx.ty - fx.y) * k).setRotation(fx.angle).setDisplaySize(26, 5).setTint(0xffe0a3).setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
        continue;
      }
      if (fx.kind === 'strategist') { const pre = fx.hitAt !== undefined, kk = pre ? (now - fx.at) / Math.max(1, (fx.hitAt ?? now) - fx.at) : (now - ((fx.until - fx.at) * .52 + fx.at)) / ((fx.until - fx.at) * .48);
        if (this.paint(fx, pre ? 'gather' : 'fire', fx.tx, pre ? fx.ty : fx.ty - 18, Math.max(0, Math.min(.999, kk)), 0, 1, pre ? .62 : 1)) continue; }
      if (fx.kind === 'spear') { g.lineStyle(4, 0xe8f2ff, .8 * (1 - k)); g.beginPath(); g.arc(fx.x, fx.y - 16, TEMPLATES.spear.range * (.6 + .4 * k), fx.angle - 2.4 * k - .6, fx.angle + .6); g.strokePath(); }
      else if (fx.kind === 'blade') { g.lineStyle(5, 0xffe2a8, .85 * (1 - k)); g.beginPath(); g.arc(fx.x, fx.y - 16, TEMPLATES.blade.range * .8, fx.angle - .9, fx.angle - .9 + 1.8 * Math.min(1, k * 1.6)); g.strokePath(); }
      else if (fx.kind === 'arrow') { const hx = fx.x + (fx.tx - fx.x) * k, hy = fx.y + (fx.ty - fx.y) * k; g.lineStyle(2, 0xfff1c8, .9); g.lineBetween(hx - Math.cos(fx.angle) * 18, hy - Math.sin(fx.angle) * 18, hx, hy); }
      else if (HINT_MOCK) { if (HINT_MOCK === 'b' && fx.hitAt === undefined && !fx.scar) { fx.scar = true; groundScar(this.scene, fx.tx, fx.ty, 48, 'fire'); } }
      else { const pre = fx.hitAt !== undefined; g.fillStyle(pre ? 0xff8a3a : 0xffb347, pre ? .25 + .25 * k : .5 * (1 - k)); g.fillCircle(fx.tx, fx.ty, pre ? 48 * (.4 + .6 * k) : 48); if (pre) { g.lineStyle(2, 0xffc070, .7); g.strokeCircle(fx.tx, fx.ty, 48); } }
    }
  }
  private puff(x: number, y: number, now: number) { this.fx.push({ kind: 'puff', x, y: y - 20, tx: 0, ty: 0, angle: 0, at: now, until: now + 300 }); }
  /** 取一张特效图（超过上限返回 undefined，这次不出图）。 */
  private takeImg(key: string): Phaser.GameObjects.Image | undefined {
    if (!this.scene.textures.exists(key) || this.fxLive >= FX_CAP) return undefined;
    this.fxLive++; const img = this.fxPool.pop() ?? this.scene.add.image(0, 0, key, 0).setName('follower-fx');
    return img.setTexture(key, 0).setVisible(true).setAlpha(1).clearTint().setDepth(DEPTH.fx - .5);
  }
  private dropImg(fx: Fx): void { if (!fx.img) return; fx.img.setVisible(false); this.fxPool.push(fx.img); fx.img = undefined; this.fxLive--; }
  /** 按 FFX 播一段帧；返回 false 表示缺图（调用方退回代码画法）。 */
  private paint(fx: Fx, style: keyof typeof FFX, x: number, y: number, k: number, rot: number, sx = 1, sy = 1): boolean {
    const st = FFX[style]; if (!this.scene.textures.exists(st.key)) return false;
    if (!fx.img) { fx.img = this.takeImg(st.key); if (!fx.img) return true; }
    if (fx.img.texture.key !== st.key) fx.img.setTexture(st.key);
    fx.img.setFrame((st.first ?? 0) + Math.min(st.frames - 1, Math.floor(k * st.frames))).setPosition(x, y).setRotation(rot).setDisplaySize(st.size * sx, st.size * sy)
      .setAlpha(st.alpha * (k > .75 ? (1 - k) / .25 : 1)).setBlendMode(st.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (st.tint !== undefined) fx.img.setTint(st.tint); else fx.img.clearTint();
    return true;
  }
  private render(f: Follower, now: number) {
    const a = f.act;
    if (a && (a.hold || now < a.until)) {
      const t = Math.min(.999, Math.max(0, (now - a.start) / Math.max(1, a.until - a.start))), fr = a.frames[a.hold && now >= a.until ? a.frames.length - 1 : Math.floor(t * a.frames.length)];
      const key = visualTextureKey(this.scene, a.key), fit = f.fitFor(key, a.frames);
      if (f.sprite.texture.key !== key || f.sprite.frame.name !== String(fr)) f.sprite.setTexture(key, fr);
      f.sprite.setFlipX(a.mirror).setScale(fit.k).setOrigin(.5, fit.originY);
    } else {
      if (a) f.act = null;
      const moving = !f.downed && f.walk > 0, frame = moving ? Math.floor(f.walk / 14) % 4 : 0, key = visualTextureKey(this.scene, f.sheet), name = `${f.dir}_${frame}`;
      if (this.scene.textures.get(key).has(name) && (f.sprite.frame.name !== name || f.sprite.texture.key !== key)) f.sprite.setTexture(key, name);
      f.sprite.setFlipX(false).setScale(f.walkScale).setOrigin(.5, .86);
    }
    // 倒地：没有倒地帧的（兵种）复用站立帧侧倒 + 下沉；都变暗
    if (f.downed) { if (!f.act) f.sprite.setAngle(f.dir === 'left' ? -84 : 84).setOrigin(.5, .7); f.sprite.setTint(0x8a7a6a); f.sprite.setAlpha(.92); }
    else if (now < f.hurtUntil) f.sprite.setTintFill(0xffd0c0); else if (f.sprite.tintFill || f.sprite.isTinted) { f.sprite.clearTint(); if (!f.recruit.hero && f.sheet === 'hero_walk_sheet') f.sprite.setTint(QUALITIES[f.recruit.quality].color); }
    f.shadow.setPosition(f.x, f.y + 2); f.label.setPosition(f.x, f.y - 66);
    f.sprite.setDepth(DEPTH.player - 1 + f.y / 100000);
    const w = 36, r = Math.max(0, f.hp / f.maxHp); f.bar.clear();
    if (r < 1) { f.bar.fillStyle(0x1a0f08, .8).fillRect(f.x - w / 2, f.y - 58, w, 4); f.bar.fillStyle(r > .4 ? 0x6fd06a : 0xe0603a, 1).fillRect(f.x - w / 2, f.y - 58, w * r, 4); }
  }
  clear(): void { for (const f of this.members) f.destroy(); this.members.length = 0; for (const fx of this.fx) fx.img?.destroy(); for (const img of this.fxPool) img.destroy(); this.fxPool.length = 0; this.fxLive = 0; this.fx.length = 0; this.gfx.destroy(); this.rescueGfx.destroy(); this.rescueText.destroy(); this.hud.destroy(); }
}
