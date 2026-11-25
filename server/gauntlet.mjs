import {EMBER,CINDERS} from '../src/rules/burning.ts';
import {refreshRetinueHp} from './coop-retinue.mjs';
import {canDraftMark} from './coop-marks.mjs';
import { GAUNTLET, GAUNTLET_POOL, endlessBoss, pickBosses } from '../src/data/gauntlet.ts';
import { challengeBoss, mythicBoss, mythicSequence, mythicHit } from '../src/data/mythicGauntlet.ts';
import content from '../src/coop/gauntlet.json' with { type: 'json' };
import {FIELD_STARS, MARK_STAR, COMPANY_STARS, ironHpBonus} from '../src/data/coopStars.ts';

const pool = GAUNTLET_POOL.filter(boss => Object.hasOwn(content.bosses, boss.id));
export const TOTAL_WAVES = GAUNTLET.waves;

export function newGauntlet(warmup = 26) {
  return { wave: 1, cleared: 0, tier: 'mortal', milestones: 0, mythicQueue: [], stage: 'field', started: 0, warmup, lineup: pickBosses(pool), history: [], boss: null, warning: null, attackAt: 0, followup: null };
}

export function nextWave(room) {
  const run = room.run;
  run.wave++;
  run.stage = 'field';
  run.started = room.seconds;
  run.boss = null;
  clearBossAttack(run);
  room.spawnIn = 0;
}

export function bossForWave(run) {
  return challengeBoss(run.tier,run.wave,TOTAL_WAVES) ?? run.lineup[run.wave - 1] ?? endlessBoss(pool, run.history.at(-1) ?? null, Math.random, run.history);
}

// Co-op durability only: let existing warnings resolve over several attack cycles.
export const COOP_BOSS_BALANCE = Object.freeze({ phase2Power: 1.15, powerCap: 36, phase2Gap: .9, followupPower: .7, followupDelay: .45, recover: 1.5 });

export function bossStats(wave, id) {
  const mythic = mythicBoss(id);
  if (mythic) {
    const divine = mythic.tierName === 'divine';
    const local = Math.max(1,Math.min(10,wave-(divine?20:10)));
    return { hp:(divine?770:690)+local*8, touch:divine?20:18, power:divine?34:31 };
  }
  const hpMul = id === 'zhangxiu' && wave >= 2 ? 1.1 : 1;
  return { hp: Math.round(Math.min(700, 100 + 60 * wave) * hpMul), touch: Math.min(19, 10 + wave), power: Math.min(32, 12 + wave * 1.4) };
}

export function clearBossAttack(run) { if(run.dual){for(const s of run.dual.states)clearBossAttack(s);run.dual=null;} run.warning = null; run.followup = null; run.attackAt = 0; run.mythicQueue = []; }

/** Latch once; never cancel an already-visible warning or shorten its dodge window. */
export function updateBossPhase(run, time) {
  const b = run.boss;
  if (!b || b.hp <= 0 || b.enraged || b.hp > b.maxHp * .5) return false;
  b.enraged = true;
  if (!mythicBoss(b.general?.id??'')) run.attackAt = Math.min(run.attackAt, time + 1.2);
  return true;
}

/** One bounded sequence of existing geometric attacks; all followups get their own full warning. */
export function bossPattern(id, cast, phase2) {
  if (cast % 2 !== 1) return null;
  if (id === 'zhangjiao') return {kind:'circle',name:'连环天雷',fx:'thunder',radius:65,power:.65,next:{kind:'circle',name:'连环天雷 · 二雷',fx:'thunder',radius:65,power:.65,next:{kind:'circle',name:'连环天雷 · 三雷',fx:'thunder',radius:65,power:.65}}};
  if (id === 'huaxiong') return {kind:'ring',name:'裂地震环 · 贴近或撤离',fx:'quake',radius:phase2?185:160,innerRadius:70,power:1};
  if (id === 'zhangxiu') return {kind:'ring',name:'封步枪阵 · 内阵',fx:'spear',radius:128,innerRadius:92,power:.8,next:{kind:'ring',name:'封步枪阵 · 外阵',fx:'spear',radius:208,innerRadius:172,power:.8}};
  if (id === 'lubu' && phase2) return {kind:'line',name:'辕门连射 · 一箭',fx:'arrow',radius:300,power:1,next:{kind:'line',name:'辕门连射 · 二箭',fx:'arrow',radius:300,power:.7}};
  return null;
}

export function beginBossWarning(run, target, time, followup = false, nextPattern = null) {
  const b = run.boss;
  if (!b || b.hp <= 0 || !target || target.hp <= 0 || run.warning || (!followup && run.followup)) return false;
  const phase2 = !!b.enraged;
  const mythic = mythicBoss(b.general.id);
  if (mythic) {
    if (run.mythicQueue?.length) return false;
    const sequence = mythicSequence(mythic,b,target,b.attacks??0,phase2,time);
    b.attacks=(b.attacks??0)+1;
    const power=bossStats(run.wave,mythic.id).power*(phase2?1.1:1);
    run.mythicQueue=sequence.map(w => ({...w,power:w.power*power}));
    run.warning=run.mythicQueue[0];
    run.attackAt=sequence.at(-1).endsAt+(phase2?1.55:2);
    return true;
  }
  const pattern = followup ? nextPattern : bossPattern(b.general.id, b.attacks ?? 0, phase2);
  if (!followup) b.attacks = (b.attacks ?? 0) + 1;
  const warning = makeWarning(b, target, run.wave, time, pattern);
  const power = bossStats(run.wave).power;
  warning.power = (phase2 ? Math.min(COOP_BOSS_BALANCE.powerCap, power * COOP_BOSS_BALANCE.phase2Power) : power) * (pattern?.power ?? (followup ? COOP_BOSS_BALANCE.followupPower : 1));
  warning.phase2 = phase2; warning.followup = followup; warning.targetSlot = target.slot;
  // One extra telegraphed strike per Boss, not a recursively-triggering combo.
  warning.chain = phase2 && !followup && !b.echoUsed && !pattern;
  warning.next = pattern?.next ?? null;
  if (warning.chain) b.echoUsed = true;
  if (phase2) warning.name += followup ? ' · 追击' : ' · 奋威';
  run.warning = warning;
  const gap = Math.max(3.5, (6 - run.wave * .17) * (phase2 ? COOP_BOSS_BALANCE.phase2Gap : 1));
  run.attackAt = Math.max(time + gap, warning.endsAt + COOP_BOSS_BALANCE.recover);
  return true;
}

/** Server combat seconds only; call from the existing live-battle tick. */
export function resolveBossWarning(run, players, time, onHit) {
  if (!run.boss || run.boss.hp <= 0) { clearBossAttack(run); return; }
  if (mythicBoss(run.boss.general.id)) {
    const queue=run.mythicQueue;
    if(queue[0]?.resolved&&time>=queue[0].endsAt+.32) queue.shift();
    const warning=queue[0];
    run.warning=warning&&time>=warning.startsAt?warning:null;
    if(run.warning&&!warning.resolved&&time>=warning.endsAt){
      warning.resolved=true;
      for(const player of players) if(player.hp>0&&mythicHit(warning,player)) onHit(player,warning.power);
    }
    return;
  }
  const w = run.warning;
  if (w && !w.resolved && time >= w.endsAt) {
    w.resolved = true;
    for (const p of players) if (p.hp > 0 && hits(w, p)) onHit(p, w.power);
    if (w.chain || w.next) run.followup = { at: time + COOP_BOSS_BALANCE.followupDelay, previousSlot: w.targetSlot, pattern: w.next };
  }
  if (run.warning?.resolved && time >= run.warning.endsAt + .3) run.warning = null;
  if (run.followup && time >= run.followup.at && !run.warning) {
    const { previousSlot, pattern } = run.followup, boss = run.boss;
    run.followup = null;
    const nearby = players.filter(p => p.owner === undefined && p.hp > 0 && Math.hypot(p.x - boss.x, p.y - boss.y) < 245);
    // Give the other living nearby player a turn to dodge; never aim at a fallen/faraway teammate.
    const target = nearby.find(p => p.slot !== previousSlot) ?? nearby[0];
    if (target) beginBossWarning(run, target, time, true, pattern);
  }
}

export function makeWarning(boss, target, wave, time, pattern = null) {
  const [, baseKind, baseName] = content.bosses[boss.general.id];
  const kind = pattern?.kind ?? baseKind, name = pattern?.name ?? baseName;
  const origin = kind === 'circle' ? target : boss;
  const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
  const facing = Math.hypot(target.x - boss.x, target.y - boss.y) > 0 ? angle : 0;
  return {
    ownerId: boss.id, startsAt: time, kind, name, fx: pattern?.fx, x: origin.x, y: origin.y, angle: facing,
    radius: pattern?.radius ?? (kind === 'circle' ? 70 + Math.min(wave, 10) * 2 : kind === 'sweep' ? 119 : 235),
    innerRadius: pattern?.innerRadius ?? 0,
    endsAt: time + (kind === 'line' ? .85 : .95), resolved: false,
  };
}

export function hits(warning, player) {
  if (warning.mythic) return mythicHit(warning,player);
  const x = player.x - warning.x, y = player.y - warning.y;
  if (warning.kind === 'circle' || warning.kind === 'ring') { const d = Math.hypot(x, y); return d <= warning.radius && d >= (warning.innerRadius ?? 0); }
  const forward = x * Math.cos(warning.angle) + y * Math.sin(warning.angle);
  const side = -x * Math.sin(warning.angle) + y * Math.cos(warning.angle);
  if (warning.kind === 'line') { for(let i=0;i<(warning.lanes??1);i++){const a=(i-((warning.lanes??1)-1)/2)*(warning.spread??0),f=forward*Math.cos(a)+side*Math.sin(a),s=-forward*Math.sin(a)+side*Math.cos(a);if(f>=0&&f<=warning.radius&&Math.abs(s)<=(warning.halfWidth??25))return true;}return false; }
  return Math.hypot(x, y) <= warning.radius && Math.abs(Math.atan2(side, forward)) <= Math.PI / 3;
}

const REWARD_LIMIT = { damage: 4, haste: 3, health: 4, speed: 3 };

export function rewardsFor(player, wave=1) {
  const available = content.rewards.filter(({ id }) => (player.upgrades[id] ?? 0) < REWARD_LIMIT[id]);
  const choices = [];
  while (available.length && choices.length < 3) {
    choices.push(available.splice(Math.floor(Math.random() * available.length), 1)[0].id);
  }
  if (player.stars && (wave%3===0 || choices.length<3)) {
    const pool=canDraftMark(player)?[...FIELD_STARS,MARK_STAR]:FIELD_STARS;
    const supported=player.company?[...pool,...COMPANY_STARS]:pool;
    const eligible=player.starDraft>=4 && player.upgrades.ember>0?[...supported,CINDERS]:supported;
    const availableStars=eligible.filter(star=>!player.stars.includes(star.id));
    if(availableStars.length) {
      const star=availableStars[Math.floor(Math.random()*availableStars.length)];
      if(choices.length===3) choices.pop();
      choices.push(star.id);
    }
  }
  if(player.starDraft>=4 && (player.upgrades.ember??0)<3 && (wave%3===1 || choices.length<3)){
    if(choices.length===3)choices.splice(choices.findIndex(id=>Object.hasOwn(REWARD_LIMIT,id)),1);
    choices.push(EMBER.id);
  }
  if (choices.length < 3 && player.hp < player.maxHp) choices.push('heal');
  return choices;
}

export function grantReward(player, id) {
  if(id===MARK_STAR.id && !canDraftMark(player))return;
  if(id===EMBER.id){if(player.starDraft>=4 && (player.upgrades.ember??0)<3)player.upgrades.ember=(player.upgrades.ember??0)+1;return;}
  const cinders=id===CINDERS.id;
  if(cinders && !(player.starDraft>=4 && player.upgrades.ember>0))return;
  const companyStar=COMPANY_STARS.some(s=>s.id===id);
  if(companyStar&&!player.company)return;
  if(cinders || companyStar || id===MARK_STAR.id || FIELD_STARS.some(s=>s.id===id)) {
    if(!player.stars || player.stars.includes(id))return;
    player.stars.push(id);
    if(id==='command.NR1')refreshRetinueHp(player);
    if(id==='strength.NR1') {
      const ratio=player.hp/player.maxHp;
      player.maxHp=Math.round(player.maxHp*(1+ironHpBonus(true)));
      player.hp=Math.round(ratio*player.maxHp);
    }
    return;
  }
  if (id === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * .45));
    return;
  }
  player.upgrades[id] = (player.upgrades[id] ?? 0) + 1;
  if (id === 'health') {
    const base=100+15*player.upgrades.health;
    player.maxHp=Math.round(base*(1+ironHpBonus(player.stars?.includes('strength.NR1'))));
    player.hp=Math.min(player.maxHp,player.hp+15);
  }
}

/** Advance only during a live battle. Progress belongs to the fallen player. */
export function advanceRescue(players, now, dt) {
  const fallen = players.find(p => p.hp === 0);
  if (!fallen) return;
  const ally = players.find(p => p.hp > 0);
  if (!ally || Math.hypot(ally.x - fallen.x, ally.y - fallen.y) > 72) {
    fallen.rescue = 0;
    return;
  }
  fallen.rescue += dt;
  if (fallen.rescue + 1e-8 < content.rescueSeconds) return;
  fallen.rescue = 0;
  fallen.hp = Math.ceil(fallen.maxHp * .35);
  fallen.hurtUntil = now + 1800;
  fallen.dx = fallen.dy = fallen.inputAt = 0;
}
