// 攻城战重做 · 中城样板（src/systems/SiegeMidCity.ts，data/siegeMedium.ts）：三段推进逐项检查 + 分段录 GIF。
// ① 城外：箭楼 2 座、城头箭雨有预警（落点圈）、毁一座箭楼箭雨减弱；冲车要护送才走、被打毁后回营地再领、到城门撞门；城门破 → 倒塌 → 推进转场。
// ② 巷战：2 个据点，站圈占下插旗补员，守军反扑守 20 秒；离开据点被敌兵占住 5 秒失守；屋顶伏兵；街上火油桶；两点守住 → 内城门开 → 转场。
// ③ 府衙：守将出场；亲卫从回廊杀出、在场时守将减伤；≤50% 二阶段（横扫 + 冲锋）；击败 → 宝箱 → 插旗占领 → 胜利、城归我方、结算按钮「建设城池」。
// 电脑布局 1280×720，逐帧 game.step。连续帧与 GIF 存 assets/review/siege-medium/。需要开发服务器（和 ffmpeg 生成 GIF）。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-siege-medium.mjs
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/siege-medium';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 520) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5, intelSeq: 1 };
const G = "window.__game.scene.getScene('SiegeGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
const city = await p.evaluate(async () => {
  const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
  const id = c.CITIES.find(x => x.tier === 'medium' && c.cityAttackable(x.id, s.ownedCities))?.id;
  const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
  for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
  return id;
});
await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => {
  const g = window.__game, s = eval(G0); s.__DEV_ACTIONS?.closePopup?.();
  s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false;
  g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0); s.readMove = () => window.__v.clone();
  window.__S = s; window.__M = s.siegeMid;
  window.__modes = {}; window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { window.__modes[s.mode] = (window.__modes[s.mode] ?? 0) + 1; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'upgrade') s.chooseUpgrade?.(0); if (s.mode !== 'none' && s.mode !== 'paused') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
  window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
}, G);
const step = n => p.evaluate(n => window.__step(n), n);
const goals = () => p.evaluate(G0 => eval(G0).siegeGoals, G);
let frameNo = 0, seg = '';
const startSeg = name => { seg = name; frameNo = 0; const d = `${OUT}/${name}`; if (existsSync(d)) rmSync(d, { recursive: true }); mkdirSync(d, { recursive: true }); };
const shot = async () => p.screenshot({ path: `${OUT}/${seg}/${String(frameNo++).padStart(3, '0')}.png` });
const rec = async (steps, every = 4, before) => { for (let i = 0; i < steps; i += every) { if (before) await before(i); await step(every); await shot(); } };
const gif = name => { try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${OUT}/${name}/%03d.png`, '-vf', 'fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', `${OUT}/${name}.gif`]); return true; } catch (e) { console.log('ffmpeg 失败', String(e).slice(0, 200)); return false; } };

// ========== ① 城外 ==========
startSeg('1-outside');
const g0 = await goals();
ck(`中城（${city}）：进入城外段，箭楼 2 座、城门满血、冲车在营地`, g0.mid?.phase === 'outside' && g0.towers === 2 && g0.mid.gate > 0 && g0.mid.ram?.state === 'move', g0.mid);
// 主将不靠近：冲车不动
await p.evaluate(() => { const s = window.__S; s.player.sprite.setPosition(-400, 0); window.__clear(); }); await step(60);
const r0 = (await goals()).mid.ram;
ck('冲车：主将不在护送半径内时不前进', Math.abs(r0.y - g0.mid.ram.y) < 1, { before: g0.mid.ram, after: r0 });
// 主将贴着冲车走：冲车前进；同时录箭雨
await rec(160, 4, async () => p.evaluate(() => { const s = window.__S, r = s.siegeMid.ramInfo; s.player.sprite.setPosition(r.x + 60, r.y + 40); }));
const g1 = await goals();
ck('冲车：主将护送时向城门前进', g1.mid.ram.y < r0.y - 40, { from: r0.y, to: g1.mid.ram.y });
ck('城头箭雨：按时放箭、每轮落点先显示预警圈（2 座箭楼时 3 处）', g1.mid.stats.volleys >= 1 && g1.mid.stats.zones >= 3, g1.mid.stats);
// 箭雨伤害：主将站在落点里会掉血（取消无敌）
const hurt = await p.evaluate(async () => { const s = window.__S, m = s.siegeMid; s.player.damageImmune = false; s.player.invulnUntil = 0; s.player.hp = s.player.maxHp; const hp = s.player.hp; m.volleyAt = s.combatNow; window.__step(2); const z = m.zones[0]; m.zones.forEach(q => { q.x = s.player.x; q.y = s.player.y; }); window.__step(80); const d = hp - s.player.hp; s.player.damageImmune = true; return { d: Math.round(d), z: !!z }; });
ck('城头箭雨：落点预警结束后命中，站在圈里的主将受伤', hurt.d > 0, hurt);
// 毁一座箭楼：箭雨间隔变长、落点变少
const weak = await p.evaluate(() => { const s = window.__S, m = s.siegeMid; const t = m.towers[0]; s.hitEnemy(t.e, 1e7, s.combatNow, 'melee', false, false); window.__step(2); m.zones.length = 0; const n0 = m.stats.zones; m.volleyAt = s.combatNow; window.__step(2); return { alive: m.towersAlive, zones: m.stats.zones - n0, next: Math.round(m.volleyAt - s.combatNow) }; });
ck('打掉一座箭楼：箭雨减弱（每轮 2 处、间隔 4.4 秒）', weak.alive === 1 && weak.zones === 2 && weak.next > 4000, weak);
// 冲车被毁 → 回营地再领
const wreck = await p.evaluate(() => { const s = window.__S, m = s.siegeMid; m.ram.guardUntil = 0; m.damageRam(1e6); /* 冲车受击后有 0.5 秒免伤（11-17 蒙皮顶棚），测试先清掉 */ window.__step(2); return { state: m.ramInfo.state, lost: m.stats.ramsLost }; });
ck('冲车被打毁（变残骸、提示回营地）', wreck.state === 'wreck' && wreck.lost === 1, wreck);
const re = await p.evaluate(async () => { const s = window.__S, m = s.siegeMid, c = (await import('/src/data/siegeMedium.ts')).MID_SIEGE.outside.camp; /* 11-19 场地加深：营地位置读数据 */ s.player.sprite.setPosition(c.x, c.y); window.__step(200); const early = { state: m.ramInfo.state, readyIn: m.ramInfo.readyIn }; window.__step(360); return { early, state: m.ramInfo.state, taken: m.stats.ramsTaken, level: m.ramInfo.level }; });
ck('回营地重领：有冷却（8 秒内领不到，冷却后领到新冲车）；攻城器械默认 0 级', re.early.state === 'wreck' && re.early.readyIn > 0 && re.state === 'move' && re.taken === 2 && re.level === 0, re);
const lv = await p.evaluate(async () => { const d = await import('/src/data/siegeMedium.ts'); return [0, 2, 9].map(l => d.ramStats(l)); });
ck('攻城器械等级接口：耐久 / 撞门速度 / 撞门伤害 / 冷却 / 备用台数随等级加成，越界夹到表内', lv[1].hp > lv[0].hp && lv[1].hitEveryMs < lv[0].hitEveryMs && lv[1].gateDamage > lv[0].gateDamage && lv[1].respawnMs < lv[0].respawnMs && lv[1].spare === 1 && lv[2].level === 3, lv);
// 敌兵会去打冲车
const aggro = await p.evaluate(() => { const s = window.__S, m = s.siegeMid, r = m.ramInfo; window.__clear(); s.player.sprite.setPosition(r.x + 150, r.y + 120); const hp0 = r.hp; const es = [0, 1, 2, 3, 4, 5].map(i => s.spawnEnemy('infantry', r.x - 160 + i * 20, r.y - 140, 1, true)).filter(Boolean); window.__step(200); return { hp0, hp: Math.round(m.ramInfo?.hp ?? 0), state: m.ramInfo?.state, n: es.length }; });
ck('敌兵优先围攻冲车（冲车掉血）', aggro.hp < aggro.hp0, aggro);
// 护送冲车到城门、撞门
await p.evaluate(() => { const s = window.__S, m = s.siegeMid; window.__clear(); if (m.ramInfo.state === 'wreck') { m.ram.state = 'move'; } m.ram.hp = 9999; m.ram.y = -380; /* 跳过中段护送（20 秒路程前面已验证会走） */ });
await rec(240, 4, async () => p.evaluate(() => { const s = window.__S, r = s.siegeMid.ramInfo; window.__clear(); s.player.sprite.setPosition(r.x + 70, r.y + 50); }));
await step(150);
const g2 = await goals();
ck('冲车到城门开始撞门，城门掉血', g2.mid.ram.state === 'ram' && g2.mid.stats.ramHits >= 1 && g2.mid.gate < 1400, { ram: g2.mid.ram, hits: g2.mid.stats.ramHits, gate: g2.mid.gate });
// 城门将破：录倒塌与转场
await p.evaluate(() => { const m = window.__S.siegeMid; m.gateHp = 60; });
await rec(200, 4, async () => p.evaluate(() => window.__clear()));
const g3 = await goals();
ck('城门破 → 倒塌 → 推进转场进巷战（主将到街口）', g3.mid.phase === 'street' && g3.mid.stats.transitions === 1, { phase: g3.mid.phase, y: await p.evaluate(() => Math.round(window.__S.player.y)) });
ck('城外段 GIF', gif('1-outside'));

// ========== ② 巷战 ==========
startSeg('2-street');
const s0 = await goals();
const barrels = await p.evaluate(() => window.__S.supplies.envProps().filter(x => x.env === 'barrel').length);
const P = await p.evaluate(() => window.__S.siegeMid.points.map(q => [q.x, q.y])), line0 = await p.evaluate(() => window.__S.siegeMid.goalLine());
ck('城内：4 处要点（粮仓 / 市集 / 武库 / 兵营）待占、占 3 处开府衙、街上有火油桶', s0.mid.points.length === 4 && s0.mid.points.every(x => x.state === 'open') && barrels >= 3 && line0.includes('要点 0/3'), { points: s0.mid.points, barrels, line0 });
const allies0 = await p.evaluate(() => window.__S.allies.filter(a => a.active).length);
// 站进粮仓圈：占领 → 插旗补员 → 反扑守 20 秒（录像）
await rec(320, 6, async () => p.evaluate(P => { const s = window.__S; s.player.sprite.setPosition(P[0][0], P[0][1]); for (const e of s.enemies) if (e.active && !e.isSupplySlot && Math.hypot(e.x - P[0][0], e.y - P[0][1]) < 80) e.hp = Math.min(e.hp, 1); }, P));
const cut0 = await p.evaluate(() => window.__S.garrisonInfo.cut);
const s1 = await goals(), allies1 = await p.evaluate(() => window.__S.allies.filter(a => a.active).length);
ck('据点：站圈占下 → 插旗、补员、守军反扑', s1.mid.points[0].state !== 'open' && allies1 > allies0, { p: s1.mid.points[0], allies0, allies1 });
await p.evaluate(P => { const s = window.__S; for (let i = 0; i < 20; i++) { s.player.sprite.setPosition(P[0][0], P[0][1]); window.__step(60); window.__clear(); } }, P);
const s2 = await goals();
ck('据点：顶住反扑 20 秒 → 守住', s2.mid.points[0].state === 'secured', s2.mid.points[0]);
const gc = await p.evaluate(() => ({ ...window.__S.garrisonInfo }));
ck('联动 · 守军池：占稳粮仓直接扣守军池 8%（顶部「守军 x / y」同步）', gc.cut - cut0 === Math.round(gc.total * .08), { cut0, ...gc });
// 市集：占下后离开、敌兵占点 5 秒 → 失守
const lost = await p.evaluate(P => { const s = window.__S, m = s.siegeMid, [x, y] = P[1]; s.allyPush?.clear(); /* 11-19 起圈里有我方义军不算失守：这里只测「没人守」的情况 */ window.__clear(); m.points[1].squad = true; /* 只测「失守」：先清场、不出守点小队（小队长在时占领减半，5 秒占不下） */ s.player.sprite.setPosition(x, y); window.__step(300); const st = m.points[1].state; s.player.sprite.setPosition(0, -720); const e = s.spawnEnemy('shield', x, y, 1, true); if (e) { e.def = { ...e.def, speed: 0 }; e.hp = e.maxHp = 1e6; } window.__step(380); return { before: st, after: m.points[1].state }; }, P);
ck('据点：主将离开、敌兵占点累计 5 秒 → 失守', lost.before === 'held' && lost.after === 'open', lost);
// 屋顶伏兵
const amb = await p.evaluate(() => { const s = window.__S, m = s.siegeMid; window.__clear(); const n0 = m.stats.ambushes; m.ambushAt = s.combatNow; window.__step(60); const roof = s.enemies.filter(e => e.active && !e.isSupplySlot && m.city.roofs.some(r => Math.abs(e.x - r.x) < 40 && Math.abs(e.y - r.y) < 120) /* 跳下补间期间敌兵按起跳点（房檐上方 90）移动，落地点偏北 */).length; return { ambushes: m.stats.ambushes - n0, roof, p: [Math.round(s.player.x), Math.round(s.player.y)], at: s.enemies.filter(e => e.active && !e.isSupplySlot).map(e => [Math.round(e.x), Math.round(e.y)]) }; });
ck('房檐伏兵：预警后从主将附近的房檐跳下', amb.ambushes === 1 && amb.roof >= 2, amb);
// 再占市集、武库并守住（共 3 处）→ 府衙门开 → 转场（录像）；兵营不占
// 第二步：守点小队 / 小队长 / 占领圈状态（兵营：只测，不占）
const sq = await p.evaluate(P => { const s = window.__S, m = s.siegeMid, k = 3, q = m.points[k]; window.__clear();
  q.squad = false; q.leader = null; s.player.sprite.setPosition(P[k][0], P[k][1] + 760); window.__step(4); const before = q.squad; s.player.sprite.setPosition(P[k][0], P[k][1] + 420); window.__step(4); const squad = q.squad, leader = m.pointsInfo[k].leader;
  if (q.leader?.e) { q.leader.e.def = { ...q.leader.e.def, speed: 0, damage: 0 }; q.leader.e.hp = q.leader.e.maxHp = 1e6; }
  for (const e of s.enemies) if (e.active && !e.isSupplySlot && e !== q.leader?.e) e.deactivate();
  s.player.sprite.setPosition(P[k][0], P[k][1] + 30); q.progress = 0; window.__step(60); const slow = q.progress, info = m.pointsInfo[k];
  window.__clear(); q.progress = 0; window.__step(60); const fast = q.progress; q.progress = 0;
  return { before, squad, leader, slow: +slow.toFixed(3), fast: +fast.toFixed(3), reason: info.view.reason, tint: info.view.tint, leaders: m.stats.leaders }; }, P);
ck('守点小队：主将走近才从要点杀出（小队长 = 精锐）；小队长在时占领读条减半、圈转朱红、圈下写原因', !sq.before && sq.squad && sq.leader && sq.slow < sq.fast * .7 && sq.tint === 0xd8503a && /小队长/.test(sq.reason), sq);
const far = await p.evaluate(() => { const s = window.__S, m = s.siegeMid; window.__clear(); s.player.sprite.setPosition(0, -1500); window.__step(3); return m.pointsInfo.map(q => ({ n: q.name, st: q.state, far: q.view.far, arrow: q.view.arrow, flag: q.view.flag })); });
ck('远处：要点圈收起名牌（far）；屏外没占的要点有令箭指过去；已占的插着旗、不再指', far.every(q => q.far) && far.filter(q => q.st !== 'secured').some(q => q.arrow) && far.filter(q => q.st === 'secured').every(q => q.flag && !q.arrow), far);
const food0 = await p.evaluate(() => window.__S.legion.food);
const mid3 = await p.evaluate(P => { const s = window.__S, m = s.siegeMid; window.__clear(); for (const k of [1, 2]) for (let i = 0; i < 30; i++) { if (m.phase !== 'street') break; s.player.sprite.setPosition(P[k][0], P[k][1]); window.__step(60); window.__clear(); if (m.points[k].state === 'secured') break; } return { phase: m.phase, secured: m.securedCount }; }, P);
await rec(160, 4, async () => p.evaluate(() => window.__clear()));
const s3 = await goals();
const eff = await p.evaluate(() => { const m = window.__S.siegeMid; return { food: window.__S.legion.food, mul: m.outgoingMul(), taken: { ...m.taken } }; });
ck('要点作用：市集守住立刻随军粮 +60；武库守住我军伤害 ×1.08；占过的要点记账（第三步结算用）', eff.food - food0 >= 60 && eff.mul === 1.08 && eff.taken.market === 1 && eff.taken.armory === 1 && eff.taken.granary === 1, { food0, ...eff });
ck('占够 3 处要点（兵营没占）→ 府衙门开 → 推进转场进府衙', s3.mid.phase === 'hall' && s3.mid.stats.transitions === 2 && s3.mid.points.filter(q => q.state === 'secured').length === 3, { mid3, phase: s3.mid.phase, points: s3.mid.points });
ck('巷战段 GIF', gif('2-street'));

// ========== ③ 府衙 ==========
startSeg('3-hall');
await rec(120, 4);
const h0 = await p.evaluate(() => { const s = window.__S; return { boss: !!s.boss?.active, name: s.chapter.bossName, y: Math.round(s.boss?.y ?? 0) }; });
ck('府衙：守将出场', h0.boss, h0);
// 亲卫：定时从回廊杀出；在场时守将减伤
const guard = await p.evaluate(() => { const s = window.__S, m = s.siegeMid, b = s.boss; b.hp = b.maxHp = 1e6; m.guardsAt = s.combatNow; window.__step(3); const n = m.guardsAlive; const hp0 = b.hp; s.hitEnemy(b, 1000, s.combatNow, 'melee', false, false); const withG = hp0 - b.hp; window.__clear(); m.guardsAlive; const hp1 = b.hp; s.hitEnemy(b, 1000, s.combatNow + 1, 'melee', false, false); const noG = hp1 - b.hp; return { n, withG: Math.round(withG), noG: Math.round(noG), waves: m.stats.guardWaves }; });
ck('亲卫从回廊杀出；亲卫在场时守将只受约 35% 伤害', guard.n === 3 && guard.withG > 0 && guard.noG > 0 && Math.abs(guard.withG / guard.noG - .35) < .08, guard);
// 一阶段横扫、二阶段冲锋（录像）
await p.evaluate(() => { const s = window.__S, b = s.boss; b.hp = b.maxHp = 2000; s.player.sprite.setPosition(b.x + 90, b.y + 60); });
await rec(200, 4, async () => p.evaluate(() => window.__clear()));
const ph1 = await goals();
await p.evaluate(() => { const s = window.__S, b = s.boss; b.hp = b.maxHp * .45; s.player.sprite.setPosition(b.x + 260, b.y + 120); });
await rec(260, 4, async () => p.evaluate(() => window.__clear()));
const ph2 = await goals();
ck('守将两阶段：一阶段放横扫，≤50% 进二阶段并放冲锋', ph1.mid.stats.bossSkills >= 1 && ph2.mid.boss.phase2 && ph2.mid.stats.bossSkills > ph1.mid.stats.bossSkills, { s1: ph1.mid.stats.bossSkills, s2: ph2.mid.stats.bossSkills, b: ph2.mid.boss });
// 击败守将 → 宝箱 → 插旗占领 → 胜利（录像）
await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 60000; /* 结算不按调试局算 */ s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); });
await rec(160, 4, async () => p.evaluate(() => { const s = window.__S; const c = s.bossChests?.[0]; if (c) s.player.sprite.setPosition(c.x ?? s.player.x, c.y ?? s.player.y); s.collectBossChests?.(); }));
for (let i = 0; i < 20; i++) { const o = await p.evaluate(() => { window.__step(30); window.__S.collectBossChests?.(); return window.__S.over; }); if (o) break; }
await step(20); await shot();
const end = await p.evaluate(async G0 => { const s = eval(G0), w = await import('/src/world/WorldStore.ts'); return { over: s.over, victory: s.victory, phase: s.siegeMid?.phase, owned: w.loadWorld().ownedCities.includes(s.city.id), home: s.resultPanel.getByName('result-home')?.text, body: s.resultTexts.body.text, link: { refill: +s.siegeMid.refillMul().toFixed(2), squads: s.siegeMid.squadCut(), bonus: s.siegeMid.provisionsBonus(), full: s.siegeMid.fullTake }, folk: { ...s.siegeMid.folk?.stats } }; }, G);
await p.screenshot({ path: OUT + '/result.png' });
ck('联动 · 限时：占了 3 处（含粮仓）→ 敌援补兵 ×0.25（每处 −15%、粮仓再 −30%）、城外援兵少 3 批；结算军粮 +30%（粮仓）+ 市集一笔 40，没全取', end.link.refill === .25 && end.link.squads === 3 && end.link.bonus.share === .3 && end.link.bonus.flat === 40 && !end.link.full, end.link);
ck('结算列表：「城内要点 3/4」，占了的写作用、没占的兵营写「未占」', /城内要点 3\/4/.test(end.body) && /✓ 粮仓/.test(end.body) && /✓ 市集.*百姓归附/.test(end.body) && /· 兵营　未占/.test(end.body), end.body.split('\n').filter(l => /要点|✓|·/.test(l)));
ck('百姓（电脑版）：入城时四散跑回民居；占下要点后从附近民居出来；市集归附时一齐作揖', end.folk.fled > 0 && end.folk.came >= 13 && end.folk.bowed === 1, end.folk);
ck('击败守将 → 宝箱 → 插旗占领 → 攻占成功、城归我方、结算按钮「建设城池」', end.over && end.victory && end.owned && end.phase === 'done' && end.home === '建设城池', end);
ck('府衙段 GIF', gif('3-hall'));
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
