import {LegionNavigation} from './LegionNavigation';
import {LegionFormation} from './LegionFormation';
import {CAMP_TRAINING,freshTraining,type CampTraining,type CampTrainingId,type CampGroup} from '../data/camp';
import {CommandBuild} from './CommandBuild';
import { ArtEffects } from './ArtEffects';
import Phaser from 'phaser';
import { Ally, type AllyView } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { LegionTactics, TACTICS } from './LegionTactics';
import { LegionProjectiles } from './LegionProjectiles';
import { SpatialGrid } from './SpatialGrid';
import { LEGION, TROOPS, TROOP_KINDS, type Order, type TroopKind, BOSS_VS_TROOPS, BOSS_VS_ALLY, BOSS_CHARGE, RECRUIT_PRICE } from '../data/legion';
import { DEPTH } from '../config';
import { AllyCorpses } from './AllyCorpses';
import { HINT_MOCK, groundScar } from '../ui/HintStyle';
import { playSheet } from './SkillFxSheets';

/** 战场支援援兵入场（用户 2026-11-17：「支援的兵不要立刻出现在武将脚下，而是场外进入到武将那里」）：比平时跑得快一点，3 秒还没到就直接归位。 */
export const ARRIVAL = { speedMul: 1.25, maxSeconds: 3, joinDist: 34, dustEvery: .16 } as const;
export interface LegionState { training?:CampTraining;groups?:Partial<Record<TroopKind,CampGroup>>; food: number; dead: number; recruited: number; levels: Record<TroopKind, number>; soldiers: Array<{ kind: TroopKind; hp: number;reserveSoldier?:boolean;/** 生命上限（营寨 / 城池军医判断伤兵用；旧档没有） */max?:number }> }

export class Legion {
  /** 部曲挨了一次打（扣血之后）：太史慈「信义」攒量用（GameScene 接）。 */
  onHurt?: (u: Ally, now: number) => void;
  /** 部曲阵亡：曹操「奸雄」攒量 + 回血用（GameScene 接）。 */
  onDeath?: (u: Ally, now: number) => void;
  /** 部曲集火目标：曹操倚天剑这一剑的目标（host.focusAllies 设；目标死了 / 换了一条命就失效）。 */
  focus: Enemy | null = null; focusLife = 0;
  training=freshTraining();groups:Partial<Record<TroopKind,CampGroup>>={};
  purchaseCampTraining(id:CampTrainingId):boolean{const def=CAMP_TRAINING[id],lv=this.training[id];if(!def||lv>=3||this.food<def.costs[lv])return false;this.food-=def.costs[lv];this.training[id]++;if(id==='hp')for(const u of this.units)if(u.active)u.applyCampaignHp(this.hpMultiplier());return true;}
  campTarget?:(u:Ally)=>Enemy|null;
  /** 第八章夺高地：占着山头时远程射程、部曲伤害倍率（HanzhongHills）。 */
  rangeMul=1;damageMul=1;
  /** 守城 v2（systems/DefenseWallV2）：给了就按岗位站（不跟主将、不退），postRangeMul 是岗位上的射程倍率（垛口远程兵够得到墙脚）。 */
  postOf?:(u:Ally)=>{x:number;y:number}|null;postRangeMul?:(u:Ally)=>number;
  /** 受伤倍率（守城 v2：城外射上来的箭打到垛口后的士兵 × 掩护倍率）。 */
  hurtMul?:(u:Ally,source?:{x:number;y:number;normal:boolean})=>number;
  /** 军阵（systems/FormationRuntime）：入阵士兵的伤害 / 受伤 / 射程倍率；没有 = 1。 */
  fm?:{dmg(u:Ally,e:Enemy):number;taken(u:Ally):number;range(u:Ally):number};
  /** 护阵 / 出击切换后（军阵的出击打法）。 */
  onOrder?:(o:Order)=>void;
  /** 军阵齐射（雁行出击）：借部曲的箭矢。 */
  volley(u:Ally,e:Enemy,amount:number,due:number):void{this.projectiles.fire(u,e,amount,due);}
  /** 部曲的战术中心：平时是主将，守城「部曲守门」时是城门内的锚点（拴绳、回撤、找安全点都按它算）。 */
  private centerProxy(player:Player):Player{const self=this;return{get x(){return self.formation?.anchor?.x??player.x;},get y(){return self.formation?.anchor?.y??player.y;}} as unknown as Player;}
  readonly command:CommandBuild;
  readonly formation:LegionFormation;
  readonly navigation=new LegionNavigation();
  /**
   * 我方绕障（2026-11-21 用户试玩「关于我自己的兵也会被围栏卡住」）：GameScene 接到敌兵绕障导航（EnemyFlowField，以主将为终点）。
   * flowRoute：去阵位 / 目标的连线被挡时给绕路路点（null = 直走或交回 navigation 局部绕角）；freeAt：阵位点压在栅栏 / 城墙里时挪到最近可走点。
   */
  flowRoute:((x:number,y:number,tx:number,ty:number)=>{x:number;y:number}|null)|null=null;
  freeAt:((x:number,y:number)=>{x:number;y:number})|null=null;
  /** 掉队卡住：离阵位 > STUCK.far 且 STUCK.ms 内没再靠近 → 在阵位旁可走点淡入归队。 */
  private readonly stuck=new Map<Ally,{best:number;at:number}>();readonly navStats={routed:0,rejoined:0};
  private visualAt=0;
  /** Legacy callers may still inspect capacity; recruitment has no gameplay cap. */
  readonly capacity=Infinity;
  /** 本场战地免费招兵每波人数（GameScene 开局按章节设定，LegionUI 显示用）。 */
  freeRecruitCount=1;
  private groupSignature='';
  awakeningDefense?:{incoming:(u:Ally,now:number)=>number;onAllyHurt:(u:Ally,now:number)=>void};
  defense?:{incoming:(u:Ally,now:number)=>number;onAllyHurt:(u:Ally,now:number)=>void};
  readonly grid = new SpatialGrid<Ally>(64);
  readonly levels = Object.fromEntries(TROOP_KINDS.map(k => [k, 1])) as Record<TroopKind, number>;
  readonly squads = new Map<TroopKind, Ally[][]>();
  healingMultiplier = 1;
  /** 营寨军营「练兵」：全体部曲生命、伤害、军医治疗量倍率（setDrill 设置，开局与每关都设）。 */
  drillMultiplier = 1;
  /** 设置练兵倍率，并按新倍率重算在场部曲的生命上限（保持血量比例）。 */
  setDrill(multiplier: number): void { this.drillMultiplier = Math.max(1, multiplier); for (const u of this.units) if (u.active) u.applyCampaignHp(this.hpMultiplier()); }
  private hpMultiplier(): number { return (1 + CAMP_TRAINING.hp.perLevel * this.training.hp) * this.drillMultiplier * this.player.growth.allyHpMultiplier(); } // 统御：部曲生命
  food: number = LEGION.startingFood; dead = 0; recruited = 0;
  order: Order = 'guard';
  private readonly projectiles: LegionProjectiles;
  private readonly tactics: LegionTactics;
  private readonly strikes:Array<{owner:Ally;life:number;target:Enemy;spawn:number;due:number;amount:number}>=[];
  private readonly heals: Array<{ owner: Ally; life: number; target: Ally; targetLife: number; due: number; amount: number }> = [];
  visibleCount = 0;
  private viewClock = 0; private combatClock = 0; private nextSquadSlot = 0;
  private stopped = false;
  /** 下一次 recruit 的入场点（场外）；用一次就清掉。没设时照旧出现在主将脚下（军营 / 开局 / 读档）。 */
  arriveFrom: { x: number; y: number } | null = null;
  /** 正在从场外跑来入列的援兵：剩余秒数、扬尘计时。跑来途中照常挨打，到了才入列（跟随 / 出击）。 */
  private readonly arriving = new Map<Ally, { left: number; dust: number; life: number }>();
  get arrivingCount(): number { return this.arriving.size; }
  isArriving(u: Ally): boolean { return this.arriving.has(u); }
  private readonly views: AllyView[] = [];
  /** 阵亡士兵的倒地动画与尸体（留 60 秒）。 */
  readonly corpses: AllyCorpses;
  private readonly near: Enemy[] = []; private readonly friends: Ally[] = [];
  private readonly effects: Array<{ x: number; y: number; tx: number; ty: number; until: number; heal: boolean; sweep: boolean; stab?:boolean; ranged?:boolean }> = [];
  private readonly artEffects: ArtEffects;
  private readonly gfx: Phaser.GameObjects.Graphics;
  /** 兵种出手音效（GameScene 接到 Sfx；HeroSfx.TROOP_ATTACK_SFX）。 */
  attackSound: ((kind: TroopKind) => void) | null = null;
  constructor(private readonly scene: Phaser.Scene, readonly units: Ally[], private readonly player: Player, _legacyCapacity?: number) {
    this.corpses = new AllyCorpses(scene);
    this.formation=new LegionFormation(player);this.artEffects=new ArtEffects(scene);
    this.command=new CommandBuild(scene,player.growth.build,units,player,(u,now)=>this.fx(u,u.x,u.y,now,true));
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    this.projectiles = new LegionProjectiles(scene); this.tactics = new LegionTactics(this.centerProxy(player),u=>this.command.target(u)??(this.focus?.active&&this.focus.spawnId===this.focusLife?this.focus:null)??this.campTarget?.(u)??null,u=>{const p=this.formation.position(u);return this.freeAt?this.freeAt(p.x,p.y):p;},o=>this.formation.extent+(o==='guard'?this.formation.leashAdj:0),(u,x,y,now)=>{const w=this.flowRoute?.(u.x,u.y,x,y);if(w){this.navStats.routed++;return w;}return this.navigation.steer(u.id,u.x,u.y,x,y,u.radius,now);});
  }
  get count(): number { let n = 0; for (const u of this.units) if (u.active) n++; return n; }
  recover(): void { for (const u of this.units) if (u.active) u.hp = u.maxHp; }
  exportState(): LegionState { return { training:{...this.training},groups:{...this.groups},food: this.food, dead: this.dead, recruited: this.recruited, levels: { ...this.levels }, soldiers: this.units.filter(u => u.active).map(u => ({ kind: u.kind, hp: u.hp,reserveSoldier:u.reserveSoldier||undefined,max:u.maxHp })) }; }
  restore(state: LegionState): void {
    this.clear();this.training=freshTraining();for(const id of Object.keys(this.training)as CampTrainingId[])this.training[id]=Math.max(0,Math.min(3,Math.floor(state.training?.[id]??0)));this.groups={...state.groups};this.command.setState(this.player.growth.build); Object.assign(this.levels, state.levels);
    for(const kind of TROOP_KINDS){const saved=state.soldiers.filter(s=>s.kind===kind),start=this.units.length;if(saved.length)this.recruit(kind,saved.length,true,true);saved.forEach((s,i)=>{const u=this.units[start+i];u.hp=Math.max(0,Math.min(u.maxHp,s.hp));u.reserveSoldier=s.reserveSoldier===true;});}for(const u of this.units){const p=this.formation.position(u);u.setPosition(p.x,p.y);}
    this.food = state.food; this.dead = state.dead; this.recruited = state.recruited; this.rebuildGrid();
  }
  /** 招兵价格随当前在编兵力递增：基础价 ×（1 + 0.2 × 在编人数），大军团需要更多军粮维持。extra 用于一次招多人时逐个累加。 */
  recruitCost(kind: TroopKind, extra = 0): number { const n = this.count + extra; return Math.max(1, Math.round(TROOPS[kind].cost * (RECRUIT_PRICE.a + RECRUIT_PRICE.b * n + RECRUIT_PRICE.c * n * n))); }
  /** Legacy bypass argument is accepted for old DEV/Campaign callers; all recruitment is uncapped. */
  recruit(kind: TroopKind, count = 1, free = false, _bypassCapacity = false): boolean {
    if (!TROOPS[kind] || !Number.isSafeInteger(count) || count <= 0) return false;
    if (!Number.isSafeInteger(TROOPS[kind].cost*count)) return false;
    let cost = 0; for (let i = 0; i < count; i++) cost += this.recruitCost(kind, i);
    const newborn:Ally[]=[],reusable=this.units.filter(u=>!u.active);
    if (!free && this.food < cost) return false;
    if (!free) this.food -= cost;
    for (let i = 0; i < count; i++) {
      const x = this.player.x + (i % 3 - 1) * 26, y = this.player.y + 55 + Math.floor(i / 3) * 26;
      let u = reusable.pop();
      if (u) u.reset(x, y, kind, this.levels[kind], this.nextSquadSlot++);
      else { u = new Ally(this.scene, x, y, kind, this.nextSquadSlot++); u.train(this.levels[kind]); this.units.push(u); }
      this.navigation.forget(u.id);u.applyCampaignHp(this.hpMultiplier());newborn.push(u);this.recruited++;
    }
    const from=this.arriveFrom;this.arriveFrom=null;
    this.regroup();newborn.forEach((u,i)=>{const p=this.formation.position(u);if(from){u.setPosition(from.x+(i%3-1)*30,from.y+Math.floor(i/3)*30);this.arriving.set(u,{left:ARRIVAL.maxSeconds,dust:0,life:u.lifeId});}else u.setPosition(p.x,p.y);u.ai.x=p.x;u.ai.y=p.y;}); this.viewClock = 1; this.rebuildGrid(); return true;
  }
  train(kind: TroopKind, free = false): boolean {
    const level = this.levels[kind]; if (!level || level >= 3) return false;
    const cost = LEGION.trainCost[level]; if (!free && this.food < cost) return false;
    if (!free) this.food -= cost; this.levels[kind]++;
    for (const u of this.units) if (u.active && u.kind === kind) u.train(this.levels[kind]);
    return true;
  }
  /** 护阵 / 出击。切回护阵：士兵进入收回状态（RECALL，按行走速度 ×1.2 跑回阵位，正在出手的打完再走）。 */
  cycleOrder(): void { this.order = this.order === 'guard' ? 'sortie' : 'guard'; const back = this.order === 'guard'; for (const u of this.units) { u.ai.nextThink = 0; u.ai.recall = back; u.ai.recallAt = 0; } this.onOrder?.(this.order); }
  private regroup(): void {
    this.squads.clear();
    for (const k of TROOP_KINDS) {
      const members = this.units.filter(u => u.active && u.kind === k), groups: Ally[][] = [];
      for (let i = 0; i < members.length; i += LEGION.squadSize) groups.push(members.slice(i, i + LEGION.squadSize));
      this.squads.set(k, groups);
    }
    this.formation.rebuild(this.units,this.groups);
    let slot = 0;
    // Ranged and healers occupy later, rearward slots in line formations.
    for (const k of ['guardian', 'swordsman', 'spearman', 'halberdier', 'rider', 'archer', 'crossbowman', 'medic'] as TroopKind[]) for (const squad of this.squads.get(k) ?? []) for (const u of squad) u.slot = slot++;
  }
  position(slot: number, count = this.count): { x: number; y: number } {
    const columns = Math.max(3, Math.ceil(Math.sqrt(count)*1.25));
    return { x: (slot % columns - (columns - 1) / 2) * 38, y: 70 + Math.floor(slot / columns) * 38 };
  }
  rebuildGrid(): void { this.grid.clear(); for (const u of this.units) if (u.active) this.grid.insert(u); }
  /** floor：最少留几点血（首领一招打死数到上限后留 1 血）。 */
  hurt(u: Ally, raw: number, now: number, source?: { x: number; y: number; normal: boolean }, floor = 0, ignoreHurtGap = false): boolean {
    if (!u.active || (!ignoreHurtGap && now < u.hurtUntil)) return false;
    const armor = u.def.armor + (u.kind === 'guardian' && u.level === 3 ? 5 : 0);
    let mitigation = Math.min(this.command.incoming(u,now),this.defense?.incoming(u,now)??1,this.awakeningDefense?.incoming(u,now)??1)*(this.fm?.taken(u)??1)*(this.hurtMul?.(u,source)??1);
    if (source?.normal) {
      const dx = source.x - u.x, dy = source.y - u.y, d = Math.hypot(dx, dy) || 1;
      const frontal = (dx * u.facingX + dy * u.facingY) / d >= .25;
      if (frontal && u.kind === 'guardian') { mitigation *= .55; u.ai.blockUntil = now + 180; }
      if (frontal && u.kind === 'swordsman' && now >= u.ai.blockReady) { mitigation *= .5; u.ai.blockReady = now + TACTICS.blockMs; u.ai.blockUntil = now + 180; }
    }
    mitigation*=1-CAMP_TRAINING.armor.perLevel*this.training.armor;
    let dmg = Math.max(1, Math.round(Math.max(1, raw - armor) * mitigation));
    if (u.shield > 0 && now < u.shieldUntil) { const a = Math.min(u.shield, dmg); u.shield -= a; dmg -= a; } // 太史慈突围护盾先扣
    u.hp = Math.max(Math.min(floor, u.hp), u.hp - dmg);
    u.hurtUntil = now + 350;
    this.onHurt?.(u, now);
    this.defense?.onAllyHurt(u,now);this.awakeningDefense?.onAllyHurt(u,now);
    if (!u.hp) {
      this.onDeath?.(u, now);
      this.corpses.spawn(u, u.view?.sprite, now);
      u.active = false; this.dead++; u.deathsReported = true; const v = u.release(); if (v) this.views.push(v); this.regroup();
     
    }
    return true;
  }
  /** 首领横扫提示：一圈淡金刀光，0.25 秒散去（不震屏）。 */
  private bossSweepFx(x: number, y: number, r: number): void {
    if (HINT_MOCK) { if (HINT_MOCK === 'b') groundScar(this.scene, x, y, r * .8, 'crack'); return; }
    const ring = this.scene.add.circle(x, y, r * .6, 0xffd27a, 0).setStrokeStyle(4, 0xffe0a0, .75).setDepth(DEPTH.fx);
    this.scene.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 250, onComplete: () => ring.destroy() });
  }
  /** 首领招式打到士兵（伤害 × BOSS_VS_TROOPS.skillMul）。各首领系统直接结算士兵伤害时都走这里。 */
  hurtByBoss(u: Ally, raw: number, now: number): boolean { return this.hurtFromBoss(u, raw * BOSS_VS_TROOPS.skillMul, now); }
  private bossCastAt = -1; private bossCastKills = 0;
  /**
   * 首领打士兵的唯一入口（招式 hurtByBoss / hurtArea、近身横扫都走这里）：× BOSS_VS_ALLY.mul；
   * 挨首领一下后 immuneMs 内不再吃首领伤害（同一招多次判定、持续伤害只算一次）；同一帧结算的一招最多打死 killCapPerCast 个，其余留 1 血。
   */
  hurtFromBoss(u: Ally, raw: number, now: number, source?: { x: number; y: number; normal: boolean }): boolean {
    if (!u.active || now < u.bossImmuneUntil) return false;
    if (now !== this.bossCastAt) { this.bossCastAt = now; this.bossCastKills = 0; }
    const ok = this.hurt(u, raw * BOSS_VS_ALLY.mul, now, source, this.bossCastKills >= BOSS_VS_ALLY.killCapPerCast ? 1 : 0);
    if (ok) { u.bossImmuneUntil = now + BOSS_VS_ALLY.immuneMs; if (!u.active) this.bossCastKills++; }
    return ok;
  }
  /**
   * 首领冲锋撞兵（平衡会话审计 S8：原来按冲锋起点时间结算，正在近战、刚挨过小兵的士兵受击间隔没过就被跳过，冲过兵阵几乎不伤兵）：
   * 每名士兵每次冲锋只判定一次（调用方去重），按当前时间结算、无视士兵自身 0.35 秒受击间隔；扣约 BOSS_CHARGE.hpFrac 的最大生命（护甲抵掉，阵型 / 防御 buff 照常减伤）；
   * 一次冲锋（castKey 相同）最多打死 BOSS_VS_ALLY.killCapPerCast 个，其余留 1 血；之后 immuneMs 内不再吃首领伤害。返回是否命中。
   * 不看首领免伤（bossImmuneUntil）：冲锋前一帧首领近身碰到的兵会有 0.5 秒首领免伤，原来冲锋那一下就被吞掉；冲锋本身每兵每次只判一次，叠不起来。
   */
  hurtByCharge(u: Ally, now: number, castKey: number): boolean {
    if (!u.active) return false;
    if (castKey !== this.bossCastAt) { this.bossCastAt = castKey; this.bossCastKills = 0; }
    const armor = u.def.armor + (u.kind === 'guardian' && u.level === 3 ? 5 : 0);
    const ok = this.hurt(u, u.maxHp * BOSS_CHARGE.hpFrac + armor, now, undefined, this.bossCastKills >= BOSS_VS_ALLY.killCapPerCast ? 1 : 0, true);
    if (ok) { u.bossImmuneUntil = now + BOSS_VS_ALLY.immuneMs; if (!u.active) this.bossCastKills++; }
    return ok;
  }
  /** 范围伤害：目前只有首领招式调用（张角雷、华雄、吕布、徐荣），按首领倍率结算。 */
  hurtArea(x: number, y: number, radius: number, damage: number, now: number, angle?: number, arc = Math.PI * 2): void {
    for (const u of this.grid.query(x, y, radius + 20, this.friends)) if (u.active && Math.hypot(u.x - x, u.y - y) <= radius + u.radius && (angle === undefined || Math.cos(Math.atan2(u.y - y, u.x - x) - angle) >= Math.cos(arc / 2))) this.hurtByBoss(u, damage, now);
  }
  onKill(enemy: Enemy): void { this.food += enemy.kind === 'boss' ? 20 : enemy.kind === 'elite' ? 5 : 1; }
  stop(): void { this.command.clear(); this.stopped = true; this.player.armyDamageTakenMul = 1; this.effects.length = 0; this.artEffects.clear(); this.heals.length = 0; this.strikes.length=0; this.projectiles.clear(); this.gfx.clear(); }
  clear(): void { this.corpses.clear(); this.command.clear();this.projectiles.clear(); this.heals.length = 0;this.strikes.length=0; for (const u of this.units) { const v = u.release(); if (v) this.views.push(v); } this.units.length = 0;this.navigation.clear();this.formation.clear(); this.squads.clear(); this.grid.clear(); }
  /** 援兵从场外跑向自己的阵位：到了（或 3 秒到点）才入列。 */
  private stepArrival(u: Ally, dt: number): void {
    const a = this.arriving.get(u)!; if (!u.active || u.lifeId !== a.life) { this.arriving.delete(u); return; }
    const p = this.formation.position(u); a.left -= dt; a.dust -= dt;
    u.moveTo(p.x, p.y, dt, u.def.speed * ARRIVAL.speedMul);
    if (a.dust <= 0) { a.dust = ARRIVAL.dustEvery; playSheet(this.scene, 'fx_collapse_dust', u.x, u.y + 8, { size: 46, depth: DEPTH.ground + 4, ms: 420, alpha: .42 }); }
    if (Math.hypot(p.x - u.x, p.y - u.y) <= ARRIVAL.joinDist || a.left <= 0) { if (a.left <= 0) u.setPosition(p.x, p.y); u.ai.x = p.x; u.ai.y = p.y; u.ai.nextThink = 0; this.arriving.delete(u); }
  }
  /** 掉队卡住（离阵位 260 以外、2 秒没靠近 40 像素）：在阵位旁的可走点淡入归队（不穿墙：落点由 freeAt 挑主将走得到的格）。出击追敌时不管。 */
  private rejoinIfStuck(u: Ally, now: number): void {
    if (this.order === 'sortie' && this.tactics.canAttack(u)) { this.stuck.delete(u); return; }
    const p = this.postOf?.(u) ?? this.formation.position(u), d = Math.hypot(p.x - u.x, p.y - u.y); let s = this.stuck.get(u);
    if (d < 260) { if (s) this.stuck.delete(u); return; }
    if (!s || d < s.best - 40) { this.stuck.set(u, { best: d, at: now }); return; }
    if (now - s.at < 2000) return;
    const q = this.freeAt!(p.x, p.y); u.setPosition(q.x, q.y); u.ai.x = q.x; u.ai.y = q.y; u.ai.nextThink = 0; this.stuck.delete(u); this.navStats.rejoined++;
    const sp = u.view?.sprite; if (sp) { sp.setAlpha(.3); this.scene.tweens.add({ targets: sp, alpha: 1, duration: 260 }); }
  }
  update(dt: number, now: number, enemies: Enemy[], enemyGrid: SpatialGrid<Enemy>, damage: (e: Enemy, n: number) => void): void {
    this.corpses.update(now);
    if (this.stopped) return;
    this.formation.setNarrow(this.navigation.nearWall(this.player.x,this.player.y,this.formation.narrow));this.formation.update(dt);const signature=JSON.stringify(this.groups);if(signature!==this.groupSignature){this.groupSignature=signature;this.regroup();for(const u of this.units)u.ai.nextThink=now+(u.id*53)%240;}
    this.command.update(now,(x,y,r)=>enemyGrid.query(x,y,r));
    this.projectiles.update(dt, now, enemyGrid, damage);
    if (this.stopped) return;
    for (let i = this.heals.length - 1; i >= 0; i--) {
      const h = this.heals[i]; if (now < h.due) continue;
      this.heals.splice(i, 1);
      if (h.owner.active && h.owner.lifeId === h.life && h.target.active && h.target.lifeId === h.targetLife && Math.hypot(h.owner.x - h.target.x, h.owner.y - h.target.y) <= h.owner.def.range) { h.target.hp = Math.min(h.target.maxHp, h.target.hp + h.amount); this.fx(h.owner, h.target.x, h.target.y, now, true); }
    }
    for(let i=this.strikes.length-1;i>=0;i--){const hit=this.strikes[i];if(now<hit.due)continue;this.strikes.splice(i,1);if(hit.owner.active&&hit.owner.lifeId===hit.life&&hit.target.active&&hit.target.spawnId===hit.spawn&&Math.hypot(hit.owner.x-hit.target.x,hit.owner.y-hit.target.y)<=hit.owner.def.range+hit.target.radius){this.fx(hit.owner,hit.target.x,hit.target.y,now,false);this.knock(hit.owner,hit.target,4,now);damage(hit.target,hit.amount);}if(this.stopped)return;}
    this.viewClock += dt; this.combatClock += dt;
    const stats = { range: this.rangeMul, melee: this.damageMul*this.player.growth.allyDamageMultiplier()*1, attackSpeed: 1 };
    for (const u of this.units) {
      if (!u.active) continue;
      u.beginStep();
      if (this.arriving.size && this.arriving.has(u)) { this.stepArrival(u, dt); continue; }
      u.simDebt += dt; const nearPlayer = Math.hypot(u.x - this.player.x, u.y - this.player.y) < 900;
      if (!nearPlayer && u.simDebt < LEGION.farStep) continue;
      const step = nearPlayer ? dt : u.simDebt; u.simDebt = 0;
      this.tactics.postOf = this.postOf;
      this.tactics.think(u, now, this.order, enemyGrid, this.grid);
      this.tactics.move(u, step, now, this.grid);
      u.cooldown = Math.max(0, u.cooldown - step);
      if (this.freeAt) this.rejoinIfStuck(u, now);
    }
    this.rebuildGrid();
    if (this.combatClock >= LEGION.nearStep) {
      this.combatClock = 0;
      for (const u of this.units) {
        if (!u.active || u.cooldown > 0 || u.kind === 'rider' && u.ai.mode === 'return' || u.ai.recall || this.arriving.has(u)) continue;
        const range = u.def.range * (u.def.ranged ? stats.range : u.kind === 'halberdier' && u.level === 3 ? 1.25 : 1) * (this.fm?.range(u) ?? 1) * (this.postRangeMul?.(u) ?? 1);
        if (u.kind === 'medic') {
          const wounded = this.grid.query(u.x, u.y, range, this.friends).filter(a => a.active && a.hp < a.maxHp && Math.hypot(a.x - u.x, a.y - u.y) <= range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          for (const friend of wounded.slice(0, u.level === 3 ? 3 : 1)) { u.act(friend.x, friend.y, now, 480); this.heals.push({ owner: u, life: u.lifeId, target: friend, targetLife: friend.lifeId, amount: u.def.damage * (1 + .35 * (u.level - 1)) * this.healingMultiplier * this.drillMultiplier, due: now + 240 }); }
          if (wounded.length) u.cooldown = u.def.cooldown * (1 - .1 * (u.level - 1)) / stats.attackSpeed;
          continue;
        }
        const defensive = !this.tactics.canAttack(u);
        const seekRange = defensive && !u.def.ranged ? Math.min(range, 55) : range;
        const target = this.tactics.select(u, enemyGrid, seekRange, defensive ? Infinity : this.order === 'guard' ? TACTICS.guardLeash+this.formation.extent+this.formation.leashAdj : TACTICS.sortieLeash+this.formation.extent);
        if (!target) continue;
        const candidates = enemyGrid.query(u.x, u.y, seekRange, this.near).filter(e => e.active && !e.invulnerable && Math.hypot(e.x - u.x, e.y - u.y) <= seekRange);
        candidates.sort((a, b) => a === target ? -1 : b === target ? 1 : (a.x - u.x) ** 2 + (a.y - u.y) ** 2 - (b.x - u.x) ** 2 - (b.y - u.y) ** 2);
        const hits = u.kind === 'halberdier' ? candidates.filter(e => Math.hypot(e.x - candidates[0].x, e.y - candidates[0].y) < 75) : candidates.slice(0, u.level === 3 && ['swordsman', 'archer'].includes(u.kind) ? 2 : u.kind === 'rider' && u.level === 3 ? 3 : 1);
        u.cooldown = u.def.cooldown / stats.attackSpeed; this.attackSound?.(u.kind); u.act(candidates[0].x, candidates[0].y, now, u.kind === 'crossbowman' ? 420 : u.def.ranged ? 340 : 300);
        for (const e of hits) {
          if (u.kind === 'rider' && u.ai.mode === 'charge') {
            if (u.ai.chargeHits.has(e.spawnId) || u.ai.chargeHits.size >= (u.level === 3 ? 3 : 1)) continue;
            u.ai.chargeHits.add(e.spawnId);
          }
          const amount = u.def.damage * this.drillMultiplier * (1+CAMP_TRAINING.attack.perLevel*this.training.attack) * (1 + .25 * (u.level - 1)) * stats.melee * (u.kind === 'spearman' && e.kind === 'cavalry' && u.level === 3 ? 2 : 1) * (this.fm?.dmg(u, e) ?? 1);
          if (u.def.ranged) { if (u.kind === 'crossbowman') { const total = Math.max(1, Math.round(amount)), first = u.level === 3 ? total : Math.ceil(total / 2), second = u.level === 3 ? total : Math.floor(total / 2); this.projectiles.fire(u, e, first, now + 180); if (second) this.projectiles.fire(u, e, second, now + 260); } else this.projectiles.fire(u, e, amount, now + 180); }
          else if(u.kind==='spearman'){this.strikes.push({owner:u,life:u.lifeId,target:e,spawn:e.spawnId,due:now+120,amount});}
          else { this.fx(u, e.x, e.y, now, false); this.knock(u, e, u.kind==='rider'?5:3, now); damage(e, amount); }
          if (this.stopped) return;
        }
      }
      for (const e of enemies) if (e.active && e.def.behavior!=='wall' && !e.isSupplySlot && !e.invulnerable && (e.controlImmune || now >= e.stunUntil) && e.contactCd <= 0) {
        const boss = e.kind === 'boss', reach = boss ? BOSS_VS_TROOPS.sweepReach : 2, victims = this.grid.query(e.x, e.y, e.radius + 20 + reach, this.friends);
        { let hitAny = false;
          // 首领：伤害 × contactMul，横扫身边 sweepReach 内所有士兵；其他敌人贴身一次只打一个
          for (const u of victims) if (u.active && Math.hypot(u.x - e.x, u.y - e.y) < u.radius + e.radius + reach) { if (boss) this.hurtFromBoss(u, e.def.damage * BOSS_VS_TROOPS.contactMul, now, { x: e.x, y: e.y, normal: false }); else this.hurt(u, e.def.damage, now, { x: e.x, y: e.y, normal: true }); hitAny = true; if (!boss && e.kind !== 'cavalry') e.startAttack(now, Math.abs(u.x - e.x) > Math.abs(u.y - e.y) ? u.x < e.x ? 'left' : 'right' : u.y < e.y ? 'up' : 'down'); if (!boss) break; }
          if (hitAny) { e.contactCd = 1; if (boss) this.bossSweepFx(e.x, e.y, e.radius + reach); } }
      }
    }
   
    if (this.viewClock >= .25) { this.viewClock = 0; this.selectViews(); }
    this.artEffects.update(now);
    this.gfx.clear();
    for (const u of this.units) if (u.active && u.view) {
      u.render(now);
      u.view.label.setVisible(false);
      if (now < u.ai.blockUntil) {
        const x=u.x+u.facingX*16,y=u.y+u.facingY*16-9;
        this.gfx.lineStyle(2,0xe1d5a7,.85).lineBetween(x-6,y-5,x-10,y-9).lineBetween(x+6,y-5,x+10,y-9);
        this.gfx.fillStyle(0xffedc0,.9).fillRect(x-2,y-6,4,3);
      }
      if (u.ai.mode === 'retreat') this.gfx.lineStyle(1, 0x8fd1b3, .55).lineBetween(u.x - 5, u.y + 17, u.x + 5, u.y + 17);
      if (u.ai.mode === 'charge') for(let trail=0;trail<3;trail++) {
        const offset=(trail-1)*6,dx=-u.ai.faceY*offset,dy=u.ai.faceX*offset;
        this.gfx.lineStyle(trail===1?3:1,0xd8c79c,trail===1?.35:.2)
          .lineBetween(u.x+dx-u.ai.faceX*(24+trail*4),u.y+dy-u.ai.faceY*(24+trail*4),u.x+dx-u.ai.faceX*5,u.y+dy-u.ai.faceY*5);
      }

    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; if (now >= e.until) { this.effects.splice(i, 1); continue; }
      const fade = Math.min(1,(e.until-now)/(e.heal?160:200));
      if (e.heal) {
        this.gfx.lineStyle(2,0x91cda7,fade).lineBetween(e.tx-4,e.ty-18,e.tx+4,e.ty-18).lineBetween(e.tx,e.ty-22,e.tx,e.ty-14);
        this.gfx.fillStyle(0xc8efbd,fade).fillRect(e.tx-10,e.ty-23-(1-fade)*7,2,2).fillRect(e.tx+8,e.ty-12-(1-fade)*8,2,2);
      } else {
        // 出手表现：长枪有“伸出→命中”的突刺过程，其余近战为目标处的弧形斩击；不再从士兵到敌人瞬间画直线。
        const t=1-fade,angle=Math.atan2(e.ty-e.y,e.tx-e.x),cx=Math.cos(angle),cy=Math.sin(angle),hitY=e.ty-8;
        if(e.stab){
          const sx=e.x+cx*12,sy=e.y-10+cy*12,reach=Math.min(1,t/.35),tx=sx+(e.tx-cx*6-sx)*reach,ty=sy+(hitY-sy)*reach;
          this.gfx.lineStyle(2,0x7a5a33,Math.min(1,fade*1.6)).lineBetween(sx,sy,tx,ty);
          this.gfx.fillStyle(0xe9edf2,Math.min(1,fade*1.8)).fillTriangle(tx+cx*7,ty+cy*7,tx-cy*3,ty+cx*3,tx+cy*3,ty-cx*3);
          if(reach<1)this.gfx.lineStyle(1,0xfff4d6,.5*fade).lineBetween(tx-cx*18,ty-cy*18,tx,ty);
        }else if(!e.sweep&&!e.ranged){
          const r=15,start=angle-1.1+t*.5,end=start+1.5*Math.min(1,t/.3+.2);
          this.gfx.lineStyle(4*fade+1,0xf5e8c6,.85*fade).beginPath().arc(e.tx,hitY,r,start,end,false).strokePath();
          this.gfx.lineStyle(1,0xffffff,.7*fade).beginPath().arc(e.tx,hitY,r-3,start+.2,end,false).strokePath();
        }
        if(!e.ranged&&t>.25){const k=(t-.25)/.75,len=4+k*7;this.gfx.lineStyle(2,0xffe2a0,fade);for(let i=0;i<4;i++){const a=angle+Math.PI+(i-1.5)*.55;this.gfx.lineBetween(e.tx+Math.cos(a)*(3+k*4),hitY+Math.sin(a)*(3+k*4),e.tx+Math.cos(a)*(3+len),hitY+Math.sin(a)*(3+len));}}
        if (e.sweep) {
          const angle=Math.atan2(e.ty-e.y,e.tx-e.x),radius=Math.min(100,Math.hypot(e.tx-e.x,e.ty-e.y));
          this.gfx.lineStyle(3,0xc4dbbf,fade*.6).beginPath().arc(e.x,e.y,radius,angle-.4,angle+.4,false).strokePath();
        }
      }
    }
  }
  /** 近战受击小幅后退，增加打击感；首领、免控、墙体与补给不受影响。 */
  private readonly knockedAt = new WeakMap<Enemy, number>();
  private knock(u: Ally, e: Enemy, px: number, now: number): void { if ((this.knockedAt.get(e) ?? -Infinity) > now - 120) return; this.knockedAt.set(e, now); if (!e.active || e.kind === 'boss' || e.controlImmune || e.def.behavior === 'wall' || e.isSupplySlot) return; const dx = e.x - u.x, dy = e.y - u.y, d = Math.hypot(dx, dy) || 1; e.sprite.x += dx / d * px; e.sprite.y += dy / d * px; }
  private fx(u: Ally, x: number, y: number, now: number, heal: boolean): void { if(!heal&&this.visibleCount>=60){if(now<this.visualAt)return;this.visualAt=now+24;} if(heal)this.artEffects.show(5,x,y-10,38,now,260); else if(u.kind==='rider')this.artEffects.show(6,x,y,44,now,180); else if(u.kind==='halberdier')this.artEffects.show(1,u.x,u.y,65,now,140,Math.atan2(y-u.y,x-u.x)); if (this.effects.length < 48 && u.view) this.effects.push({ x: u.x, y: u.y, tx: x, ty: y, until: now + 200, heal, sweep: u.kind === 'halberdier',stab:u.kind==='spearman',ranged:!!u.def.ranged }); }
  private selectViews(): void {
    const view=this.scene.cameras.main.worldView;
    const active=this.units.filter(u=>u.active&&u.x>=view.x-100&&u.x<=view.right+100&&u.y>=view.y-100&&u.y<=view.bottom+100);
    const show=new Set(active.map(u=>u.id));
    for(const u of this.units)if(u.view&&(!u.active||!show.has(u.id))){const v=u.release();if(v)this.views.push(v);}
    for(const u of active)if(!u.view)u.attach(this.views.pop()??Ally.makeView(this.scene));
    this.visibleCount=active.length;
  }
}
