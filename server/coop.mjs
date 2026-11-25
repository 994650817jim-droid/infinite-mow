import {tryIgnite,tickBurns,fireWire} from './coop-burning.mjs';
import {paySpoils,companyStatus,companyWire,recruitCompany,updateRetinue,strikeRetainer} from './coop-retinue.mjs';
import {BOSS_VS_TROOPS,BOSS_VS_ALLY} from '../src/data/legion.ts';
import {strikeSpellMark, visibleSpellMarks} from './coop-marks.mjs';
import { startHebei, stepHebei, resolveHebei, dualDeaths, dualState, dualWarnings } from './coop-dual.mjs';
import { GAUNTLET_POOL } from '../src/data/gauntlet.ts';
import { challengeChoices, mythicBoss } from '../src/data/mythicGauntlet.ts';
import { createServer } from 'node:http';
import { randomInt, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { TYPES, chooseTroop, initTroop, troopHit, prepareTroops, stepTroop, clearTroops } from './coop-roster.mjs';
import world from '../src/coop/arena.json' with { type: 'json' };

import { bossForWave, bossStats, advanceRescue, grantReward, beginBossWarning, clearBossAttack, resolveBossWarning, updateBossPhase, newGauntlet, nextWave, rewardsFor, TOTAL_WAVES } from './gauntlet.mjs';

import { CHARACTERS } from '../src/data/characters.ts';
import { ironIncoming, backwaterDamage, vanguardDamage, vanguardSpeed } from '../src/data/coopStars.ts';

const heroes = new Map(CHARACTERS.map(hero => [hero.id, hero]));
const attackProfiles = {
  spear_orbit: { range: 142, interval: .55 },
  baodiao_bow: { range: 205, interval: .85 },
  crossbow: { range: 205, interval: .8 },
  flame_banner: { range: 190, interval: .9 },
  huochuan_ling: { range: 190, interval: .9 },
};
const closeAttack = { range: 125, interval: .75 };

const STEP = 50;
const MAX_ROOMS = 40;
const MAX_ENEMIES = 48;

const ROOM_TTL = 10 * 60_000;
const INPUT_TTL = 450;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const playersIn = room => [...room.players.values()];

export function createCoopServer({ origins = [], allowLocal = true, gauntletWarmup, gauntletLineup, reconnectMs = 30_000, emberRandom = Math.random, troopRandom = Math.random, rooms = new Map() } = {}) {
  const http = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const network = new WebSocketServer({ noServer: true, maxPayload: 512, perMessageDeflate: false });

  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 128_000) socket.send(JSON.stringify(message));
  }
  function broadcast(room, message) {
    for (const player of room.players.values()) send(player.socket, message);
  }
  function disband(room, reason) {
    rooms.delete(room.code);
    broadcast(room, { type: 'closed', reason });
    for (const player of room.players.values()) {
      player.socket.close(1000, reason);
    }
  }
  const missing = room => playersIn(room).filter(p => p.disconnectedAt != null);
  function connection(room, now = Date.now()) {
    const absent = missing(room);
    broadcast(room, { type: 'connection', paused: absent.length > 0,
      remaining: absent.length ? Math.max(0, Math.ceil((Math.min(...absent.map(p => p.disconnectedAt)) + reconnectMs - now) / 1000)) : 0 });
  }
  function session(room, player) {
    send(player.socket, { type: 'session', code: room.code, slot: player.slot, token: player.token, graceMs: reconnectMs });
  }
  function restore(room, now) {
    if (!missing(room).length && room.pausedAt != null) {
      const gap = now - room.pausedAt;
      for (const p of playersIn(room)) { p.hurtUntil += gap; p.inputAt = 0; p.dx = p.dy = 0; }
      if (room.idleSince != null) room.idleSince += gap;
      room.pausedAt = null;
    }
    if (room.phase === 'lobby') lobby(room);
    else if (room.phase === 'draft' || room.phase === 'checkpoint') updateDraft(room);
    else snapshot(room);
    connection(room, now);
  }
  function lobby(room) {
    const picks = playersIn(room).map(({ slot, hero }) => ({ slot, hero }));
    for (const player of room.players.values()) {
      send(player.socket, { type: 'lobby', code: room.code, slot: player.slot, count: room.players.size, mode: room.mode, picks });
    }
  }
  function createRoom(now, extreme) {
    if (rooms.size >= MAX_ROOMS) return null;
    let code;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); }
    while (rooms.has(code));
    const room = { code, created: now, mode: 'gauntlet', run: newGauntlet(gauntletWarmup,extreme), players: new Map(), phase: 'lobby', enemies: [], seconds: 0, kills: 0, nextEnemyId: 0, spawnIn: 0, snapshots: 0 };
    // Trusted server/test configuration only; clients cannot choose encounters.
    if(gauntletLineup?.length){const ids=gauntletLineup.map(id=>GAUNTLET_POOL.find(b=>b.id===id));if(ids.every(Boolean))room.run.lineup=ids;}
    rooms.set(code, room);
    return room;
  }
  function spawn(room, boss = false, general, troop) {
    const edge = randomInt(4);
    const x = edge === 0 ? 24 : edge === 1 ? world.width - 24 : randomInt(24, world.width - 24);
    const y = edge === 2 ? 24 : edge === 3 ? world.height - 24 : randomInt(24, world.height - 24);
    const hp = general ? bossStats(room.run.wave, general.id, room.run.roster.ghost.length).hp : boss ? 64 : 4 + Math.min(3, Math.floor(((room.run?.wave ?? 1) - 1) / 4));
    const enemy = { id: ++room.nextEnemyId, x, y, hp, maxHp: hp, boss, general, hitIn: 0 };
    if (troop) initTroop(enemy, troop, room.seconds);
    room.enemies.push(enemy);
    return enemy;
  }
  const waveWarmup = run => run.tier==='ghost'||run.tier==='divine' ? Math.min(8,run.warmup) : run.warmup;
  function snapshot(room) {
    broadcast(room, {
      type: 'state', seconds: Math.floor(room.seconds), battleMs: Math.round(room.seconds*1000), kills: room.kills,
      players: playersIn(room).map(({ slot, hero, x, y, hp, maxHp, rescue, dir, moving, strike, stars, company }) => ({ slot, hero, x, y, hp, maxHp, rescue, dir, moving, strike, stars,order:company?.order })),
      enemies: room.enemies.map(({ id, x, y, hp, maxHp, boss, general, troop, cue, face, speedBuff, enraged }) => ({ id, x, y, hp, maxHp, boss, troop, cue, face, enraged: !!enraged, boosted: speedBuff > 1, general: general && { id: general.id, name: general.name } })),
      burning:fireWire(room),retainers:companyWire(room),
      spellMarks: visibleSpellMarks(room),
      shots: (room.shots ?? []).map(({x,y,angle,slow})=>({x,y,angle,net:!!slow})), troopEffects: room.troopEffects ?? [],
      gauntlet: room.run && { wave: room.run.wave, cleared: room.run.cleared, total: TOTAL_WAVES, mythicSize: room.run.roster.ghost.length,
        tier: room.run.tier, milestones: room.run.milestones, remaining: room.run.stage === 'field' ? Math.max(0, Math.ceil(waveWarmup(room.run) - room.seconds + room.run.started)) : 0,
        general: room.run.boss && { id: room.run.boss.general.id, name: room.run.boss.general.name },
        upcoming: { id: room.run.upcoming.id, name: room.run.upcoming.name }, warning: room.run.warning, warnings: dualWarnings(room.run), dual: !!room.run.dual },
    });
  }
  function draft(room, checkpoint = false) {
    room.phase = checkpoint ? 'checkpoint' : 'draft';
    room.votes = [null, null];
    room.idleSince = Date.now();
    for (const player of room.players.values()) player.choices = checkpoint ? [] : rewardsFor(player,room.run.wave);
    updateDraft(room);
  }
  function updateDraft(room) {
    const ready = playersIn(room).filter(player => !player.choices?.length).length;
    for (const player of room.players.values()) {
      send(player.socket, { type: 'draft', wave: room.run.wave, total: TOTAL_WAVES, mythicSize: room.run.roster.ghost.length, general: room.run.history.at(-1).dual ? '河北双雄 · 颜良 / 文丑' : room.run.history.at(-1).name,
      party: playersIn(room).map(({ slot, hero, hp, maxHp, choices, stars, upgrades }) => ({ slot, hero, hp, maxHp, ember:upgrades.ember, ready: !choices?.length, company:companyStatus(room.players.get(slot),room.run.wave), stars })),
        votes: room.votes, choices: player.choices ?? [], ready, checkpoint: room.phase === 'checkpoint', tier: room.run.tier,
        continuation: room.phase==='checkpoint'?challengeChoices(room.run.tier,room.run.wave,TOTAL_WAVES,room.run.roster.ghost.length):[] });
    }
    if (room.phase === 'draft' && !missing(room).length && ready === room.players.size) beginNextWave(room);
  }
  function beginNextWave(room) {
    clearTroops(room);
    for (const player of room.players.values()) {
      player.dx = 0;
      player.dy = 0;
      player.inputAt = 0;
      player.fireIn = 0;
    }
    if(room.run.nextTier) {
      room.run.tier=room.run.nextTier;
      room.run.nextTier=null;
    }
    nextWave(room);
    room.run.upcoming = bossForWave(room.run);
    room.phase = 'battle';
    snapshot(room);
  }
  function bossDefeated(room) {
    for(const player of room.players.values()){delete player.casting;delete player.burns;}
    clearTroops(room);
    const run = room.run;
    run.cleared++;paySpoils(room);
    run.history.push(run.upcoming);
    run.history = run.history.slice(-40);
    clearBossAttack(run);
    run.boss = null;
    room.enemies.length = 0;
    for (const player of room.players.values()) {
      player.rescue = 0;
      player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * .35));
      player.moving = false;
    }
    const checkpoint=challengeChoices(run.tier,run.wave,TOTAL_WAVES,run.roster.ghost.length).length>0;
    if(checkpoint) run.milestones=run.tier==='mortal'?1:run.tier==='ghost'?2:3;
    snapshot(room);
    draft(room,checkpoint);
  }
  function strikePlayers(room, now) {
    const party=playersIn(room),targets=[...party];let fallen=0;
    for(const p of party)if(p.company)targets.push(...p.company.units);
    const hit=(target,damage)=>{
      if(target.owner===undefined)return hurt(target,damage,now);
      if(strikeRetainer(room,target,damage*BOSS_VS_TROOPS.skillMul,true,fallen>=BOSS_VS_ALLY.killCapPerCast?1:0)&&target.hp===0)fallen++;
    };
    if(room.run?.dual)resolveHebei(room.run,targets,room.seconds,hit);
    else if(room.run)resolveBossWarning(room.run,targets,room.seconds,hit);
  }
  function hurt(player, damage, now) {
    if (now < player.hurtUntil) return false;
    damage*=ironIncoming(player.stars?.includes('strength.NR1'));
    player.hp = Math.max(0, player.hp - Math.round(damage));
    if (!player.hp) player.moving = false;
    player.hurtUntil = now + 550;
    return true;
  }
  function tick(room, now, dt) {
    room.seconds += dt;
    prepareTroops(room, dt, hurt, now);
    const live = playersIn(room).filter(player => player.hp > 0);
    for (const player of live) {
      const vx = now - player.inputAt <= INPUT_TTL ? player.dx : 0;
      const vy = now - player.inputAt <= INPUT_TTL ? player.dy : 0;
      const speed = 174 * (1 + .07 * (player.upgrades.speed ?? 0)) * (room.seconds < (player.slowUntil ?? 0) ? 1 - player.slow : 1);
      const x = Math.max(24, Math.min(world.width - 24, player.x + vx * speed * dt));
      const y = Math.max(24, Math.min(world.height - 24, player.y + vy * speed * dt));
      player.moving = x !== player.x || y !== player.y;
      if (player.moving) player.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0);
      player.x = x;
      player.y = y;
      player.fireIn -= dt;
      if (player.fireIn > 0) continue;
      let nearest;
      const attack = attackProfiles[heroes.get(player.hero).startWeapon] ?? closeAttack;
      let best = attack.range;
      for (const enemy of room.enemies) {
        if (enemy.hp <= 0) continue;
        const distance = Math.hypot(enemy.x - x, enemy.y - y);
        if (distance < best) { nearest = enemy; best = distance; }
      }
      if (!nearest) continue;
      player.fireIn = attack.interval * .91 ** (player.upgrades.haste ?? 0);
      const vanguard=player.stars?.includes('bridge0.h');
      const power=(3+(player.upgrades.damage??0))*vanguardDamage(vanguard,true)*backwaterDamage(player.stars?.includes('strength.NR2'),player.hp/player.maxHp);
      player.fireIn/=vanguardSpeed(vanguard);
      player.strike = { n: player.strike.n + 1, x: nearest.x, y: nearest.y };
      troopHit(room, nearest, player, power);
      tryIgnite(player,nearest,power,room.seconds*1000,emberRandom);
      if(player.stars?.includes('intellect.NX1')) strikeSpellMark(room,player,nearest,power);
    }
    updateRetinue(room,dt);
    if(room.run.dual)stepHebei(room.run,live,room.seconds,dt);
    for (const enemy of room.enemies) {
      if (enemy.hp <= 0) continue;
      let target;
      let nearest = Infinity;
      for (const player of live) {
        if (player.hp <= 0) continue;
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distance < nearest) { target = player; nearest = distance; }
      }
      if (!target) continue;
      if (stepTroop(room, enemy, target, dt, {hurt, now, spawn:()=>spawn(room), cap:MAX_ENEMIES-(room.run.stage==='field'?(room.run.upcoming?.dual?2:1):0)})) continue;
      if (enemy.general) {
        const run = dualState(room.run,enemy)??room.run;
        if(room.run.dual?.gather || room.seconds<(room.run.dual?.soloUntil??0))continue;
        updateBossPhase(run, room.seconds);
        if ((run.warning && !run.warning.resolved) || (mythicBoss(enemy.general.id) && room.seconds<run.attackAt-.8 && run.mythicQueue.length)) continue;
        if (!room.run.dual && nearest < 245 && room.seconds >= run.attackAt && beginBossWarning(run, target, room.seconds)) continue;
      }
      enemy.hitIn -= dt;
      const reach = enemy.boss ? 32 : 21;
      if (nearest > reach) {
        const step = Math.min(nearest - reach, (enemy.boss ? 72*(enemy.dualRage?1.15:1) : 64 * (TYPES[enemy.troop]?.mul.speed ?? 1)) * (enemy.speedBuff ?? 1) * dt);
        enemy.x += (target.x - enemy.x) * step / nearest;
        enemy.y += (target.y - enemy.y) * step / nearest;
      } else if (enemy.hitIn <= 0) {
        const damage = enemy.general ? bossStats(room.run.wave,enemy.general.id).touch * (room.run.dual ? .8*(enemy.dualRage?1.25:1) : 1) : Math.min(11, 5 + Math.floor(room.run.wave / 2));
        if (hurt(target, damage * (TYPES[enemy.troop]?.mul.damage ?? 1) * (enemy.damageBuff ?? 1), now)) enemy.hitIn = .85;
      }
    }
    strikePlayers(room, now);
    tickBurns(room);
    const beaten = room.run.dual ? dualDeaths(room.run,room.seconds) : room.enemies.some(enemy => enemy.boss && enemy.hp <= 0);
    const oldCount = room.enemies.filter(e=>!e.escaped).length;
    room.enemies = room.enemies.filter(enemy => enemy.hp > 0);
    room.kills += oldCount - room.enemies.length;
    if (live.every(player => player.hp <= 0)) { finish(room, false); return; }
    if (beaten) { bossDefeated(room); return; }
    advanceRescue(playersIn(room), now, dt);
    const run = room.run;
    if (run?.stage === 'field' && room.seconds >= run.started + waveWarmup(run)) {
      run.stage = 'boss';
      if(run.upcoming.dual==='hebei'){
        const yan=spawn(room,true,GAUNTLET_POOL.find(b=>b.id==='yanliang')),wen=spawn(room,true,run.upcoming),p=live[0];
        yan.x=Math.max(30,p.x-180);wen.x=Math.min(930,p.x+180);yan.y=wen.y=Math.max(30,p.y-140);startHebei(run,yan,wen,room.seconds);
      }else {run.boss = spawn(room, true, run.upcoming);run.attackAt = room.seconds + 2;}
    }
    room.spawnIn -= dt;
    if (room.spawnIn <= 0 && room.enemies.length < MAX_ENEMIES - (run?.stage === 'field' ? (run.upcoming?.dual?2:1) : 0)) {
      spawn(room, false, undefined, chooseTroop(room, troopRandom));
      room.spawnIn = Math.max(.72, 1.22 - run.wave * .038) * (run.boss ? 1.6 : 1) * (run.dual ? 1/.7 : 1);
    }
    if (++room.snapshots % 2 === 0) snapshot(room);
  }
  function finish(room, victory) {
    if (room.phase === 'finished') return;
    room.phase = 'finished';
    if (room.run) clearBossAttack(room.run);
    room.idleSince = Date.now();
    snapshot(room);
    const reason = !victory ? 'defeated' : room.run.milestones === 3 ? 'completed' : 'withdrawn';
    room.result = { type: 'result', victory, reason, kills: room.kills, generals: room.run.cleared,
      milestones: room.run.milestones, seconds: Math.floor(room.seconds),
      party: playersIn(room).map(p => ({ slot: p.slot, hero: p.hero, men: p.company?.units.length ?? 0,
        lost: p.company?.deaths ?? 0, coins: p.company?.coins ?? 0, stars: [...(p.stars ?? [])] })) };
    broadcast(room, room.result);
  }

  network.on('connection', socket => {
    let room;
    let player;
    let alive = true;
    let count = 0;
    let nextReset = 0;
    const opened = Date.now();
    socket.on('error', () => socket.terminate());
    socket.on('pong', () => { alive = true; });
    socket.heartbeat = () => {
      if (!alive || (!room && Date.now() - opened > 30_000)) { socket.terminate(); return; }
      alive = false;
      socket.ping();
    };
    socket.on('message', (raw, binary) => {
      if (binary) return;
      const now = Date.now();
      if (now >= nextReset) { count = 0; nextReset = now + 1000; }
      if (++count > 45) { socket.close(1008, 'rate limit'); return; }
      let command;
      try { command = JSON.parse(raw.toString()); } catch { return; }
      if (!command || typeof command !== 'object') return;
      if (!room && command.type === 'resume') {
        const candidate = typeof command.code === 'string' && rooms.get(command.code);
        const member = candidate && typeof command.token === 'string' && playersIn(candidate).find(p => p.token === command.token);
        if (!member || member.disconnectedAt == null || now - member.disconnectedAt >= reconnectMs) {
          send(socket, { type: 'error', message: '重连已失效，请重新创建房间' }); return;
        }
        room = candidate; player = member; player.socket = socket; player.disconnectedAt = null;
        session(room, player);
        if (room.phase === 'finished') send(socket, room.result);
        else restore(room, now);
        return;
      }
      if (room && command.type === 'leave') {
        if (room.phase === 'finished') {
          room.players.delete(player.slot);
          if (!room.players.size) rooms.delete(room.code);
        } else if (room.phase !== 'lobby' || player.slot === 0) disband(room, 'teammate-left');
        else { room.players.delete(player.slot); restore(room, now); }
        room = undefined; socket.close(1000, 'left'); return;
      }
      if (room && missing(room).length) return;
      if (!room && (command.type === 'create' || command.type === 'join')) {
        const available = new Set(Array.isArray(command.heroes) ? command.heroes.filter(id => heroes.has(id)) : []);
        if (!available.size) {
          send(socket, { type: 'error', message: '没有可出战武将，请刷新游戏后重试' });
          return;
        }
        const candidate = command.type === 'create'
          ? createRoom(now, command.extreme === true)
          : typeof command.code === 'string' && /^[A-Z2-9]{6}$/.test(command.code) && rooms.get(command.code);
        if (!candidate || candidate.phase !== 'lobby' || candidate.players.size >= 2) {
          send(socket, { type: 'error', message: command.type === 'create' ? '服务器房间已满' : '房间不存在、已满或已开战' });
          return;
        }
        room = candidate;
        const slot = room.players.size === 0 ? 0 : 1;
        player = { socket, token: randomBytes(24).toString('hex'), disconnectedAt: null, slot, available, hero: null, x: world.width / 2 + (slot ? 48 : -48), y: world.height / 2, hp: 100, maxHp: 100, rescue: 0, upgrades: {}, dir: 0, moving: false,
          fireIn: 0, dx: 0, dy: 0, inputAt: 0, hurtUntil: 0, strike: { n: 0, x: 0, y: 0 } };
        if([1,2,3,4].includes(command.starDraft)){player.starDraft=command.starDraft;player.stars=[];}
        room.players.set(slot, player);
        session(room, player);
        lobby(room);
      } else if (room?.phase === 'lobby' && command.type === 'pickHero' && player.available.has(command.hero)) {
        player.hero = command.hero;
        lobby(room);
      } else if (room?.phase === 'lobby' && command.type === 'start' && player.slot === 0 && room.players.size === 2
        && playersIn(room).every(member => member.hero !== null)) {
        room.phase = 'battle';
        if (room.run) room.run.upcoming = bossForWave(room.run);
        snapshot(room);
       } else if(room?.phase==='draft'&&command.type==='recruit'&&!missing(room).length){
        if(recruitCompany(room,player,command))updateDraft(room);
      } else if(room?.phase==='battle'&&command.type==='order'&&player.company&&!missing(room).length){
        if(command.order==='guard'||command.order==='sortie')player.company.order=command.order;
      } else if (room?.phase === 'draft' && command.type === 'reward' && player.choices?.includes(command.id)) {
        grantReward(player, command.id);
        player.choices = [];
        updateDraft(room);
      } else if (room?.phase === 'checkpoint' && command.wave === room.run.wave) {
        if (command.type === 'finish') {
          finish(room, true);
        } else {
          const choice = command.type === 'endless' ? 'endless' : command.type === 'challenge' ? command.tier : null;
          if (!challengeChoices(room.run.tier,room.run.wave,TOTAL_WAVES,room.run.roster.ghost.length).includes(choice)) return;
          if (room.votes[player.slot] === choice) return;
          room.votes[player.slot] = choice;
          if (room.votes.every(vote => vote === choice)) {
            room.run.nextTier = choice;
            draft(room);
          } else updateDraft(room);
        }
      } else if (room?.phase === 'battle' && command.type === 'input' && Number.isFinite(command.dx) && Number.isFinite(command.dy)) {
        const limit = Math.max(1, Math.hypot(command.dx, command.dy));
        player.dx = command.dx / limit;
        player.dy = command.dy / limit;
        player.inputAt = now;
      }
    });
    socket.on('close', () => {
      if (!room || !rooms.has(room.code) || player.socket !== socket) return;
      if (room.phase === 'finished') { player.disconnectedAt = Date.now(); return; }
      player.disconnectedAt = Date.now(); player.dx = player.dy = 0; player.inputAt = 0; player.moving = false;
      room.pausedAt ??= player.disconnectedAt;
      for (const p of playersIn(room)) { p.dx = p.dy = 0; p.moving = false; }
      if (room.phase === 'battle') snapshot(room); connection(room);
    });
  });
  http.on('upgrade', (request, socket, head) => {
    let permitted = false;
    const origin = request.headers.origin;
    if (typeof origin === 'string') {
      try {
        const url = new URL(origin);
        permitted = origins.includes(origin) || (allowLocal && url.protocol === 'http:' && url.host === request.headers.host);
      } catch { /* malformed browser origin */ }
    }
    if (!permitted || request.url !== '/coop-socket' || network.clients.size >= MAX_ROOMS * 3) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    network.handleUpgrade(request, socket, head, ws => network.emit('connection', ws, request));
  });
  let last = Date.now();
  const sim = setInterval(() => {
    const now = Date.now();
    const dt = Math.max(0, Math.min(.10, (now - last) / 1000));
    last = now;
    for (const room of rooms.values()) {
      if (room.phase === 'finished') {
        if (now - room.idleSince >= reconnectMs) disband(room, 'expired');
        continue;
      }
      const absent = missing(room);
      if (absent.length) {
        if (absent.some(p => now - p.disconnectedAt >= reconnectMs)) disband(room, 'reconnect-timeout');
        else if (!room.connectionAt || now - room.connectionAt >= 1000) { connection(room, now); room.connectionAt = now; }
        continue;
      }
      if (room.phase !== 'battle' && now - (room.idleSince ?? room.created) >= ROOM_TTL) disband(room, 'expired');
      else if (room.phase === 'battle') tick(room, now, dt);
    }
  }, STEP);
  const heartbeat = setInterval(() => { for (const socket of network.clients) socket.heartbeat(); }, 15_000);
  http.on('close', () => { clearInterval(sim); clearInterval(heartbeat); network.close(); });
  return {
    http,
    close() {
      for (const socket of network.clients) socket.terminate();
      return new Promise(resolve => http.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origins = (process.env.COOP_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const { http } = createCoopServer({ origins, allowLocal: !origins.length });
  const host = process.env.COOP_HOST ?? '127.0.0.1';
  const port = Number(process.env.COOP_PORT ?? 8787);
  http.listen(port, host, () => console.log(`Co-op listening on ${host}:${port}`));
}
