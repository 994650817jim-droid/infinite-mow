// 攻城战重做 · 扩展到小城 / 大城（src/systems/SiegeMidCity.ts，data/siegeMedium.ts SIEGE_PROFILES / LARGE_SIEGE）：
// 小城：城外（1 座箭楼、无冲车、木门主将直接砍）→ 县衙（县尉只横扫、不进二阶段）→ 插旗占领；限时 240 秒。
// 大城：城外（3 座箭楼；护城河挡路，冲车停在河边；砍断两根吊桥绳索放桥 / 到时守军放桥出城）→ 冲车撞门 → 瓮城（城头箭雨、滚木礌石预警后滚下、砍破内门）
//       → 巷战 → 内城（势力名将：第四章首领招式组、半血二阶段、亲卫护盾）→ 插旗占领。
// 电脑布局 1280×720，逐帧 game.step。截图存 assets/review/siege-tiers/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-siege-tiers.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/siege-tiers';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 520) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5, intelSeq: 1 };
const G = "window.__game.scene.getScene('SiegeGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(tier) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(tier + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(tier + ' ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const city = await p.evaluate(async tier => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    const id = c.CITIES.find(x => x.tier === tier && c.cityAttackable(x.id, s.ownedCities))?.id;
    const g = window.__game; g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
    return id;
  }, tier);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false;
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__S = s; window.__M = s.siegeMid;
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none' && s.mode !== 'paused') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__chop = (x, y) => { const pl = s.player; pl.sprite.setPosition(x, y); const t = window.__M.priorityTarget(400); if (t) s.hitEnemy(t, 1e7, s.combatNow, 'melee', false, false); return !!t; };
  }, G);
  return { p, city };
}
const step = (p, n) => p.evaluate(n => window.__step(n), n);
const goals = p => p.evaluate(G0 => ({ ...eval(G0).siegeGoals, text: eval(G0).children.getByName('siege-goal')?.text }), G);
const owned = (p, id) => p.evaluate(async id => (await import('/src/world/WorldStore.ts')).loadWorld().ownedCities.includes(id), id);
const waitPhase = async (p, ph, max = 400) => { for (let i = 0; i < max; i += 20) { if ((await p.evaluate(() => window.__M.phase)) === ph) return true; await step(p, 20); } return false; };
const killBoss = async p => {
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 120000; for (const g of window.__M.guards) g.e.active && g.e.deactivate(); s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 60; i++) { const o = await p.evaluate(() => { const s = window.__S; window.__step(20); s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c && c.x !== undefined) s.player.sprite.setPosition(c.x, c.y); return s.over; }); if (o) break; }
  return p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory, phase: window.__M.phase }));
};

// ================= 小城 =================
{
  const { p, city } = await open('small');
  const g0 = await goals(p);
  await p.screenshot({ path: `${OUT}/small-1-outside.png` });
  ck(`小城（${city}）：城外段，1 座箭楼、没有冲车、目标「砍破木门」`, g0.mid?.tier === 'small' && g0.mid.phase === 'outside' && g0.towers === 1 && !g0.mid.ram && /木门/.test(g0.text), { mid: g0.mid && { tier: g0.mid.tier, phase: g0.mid.phase, ram: g0.mid.ram }, towers: g0.towers, text: g0.text });
  // 11-19 用户「攻城战的场地和小兵生成方式和总体优化一下，我感觉小怪生成在我脸上，而且感觉攻城场地好小，也需要点我方小兵一起进攻」
  const big = await p.evaluate(() => { const m = window.__M, o = m.oa, c = m.city.arena; return { o, c, start: { x: window.__S.player.x, y: window.__S.player.y } }; });
  ck('11-19 城外场地加大：南北 ≥ 1500、左右跟城内段同宽（城墙、角楼、侧墙一条线）', big.o.bottom - big.o.top >= 1500 && big.o.left === big.c.left && big.o.right === big.c.right && big.o.right >= 800, big);
  // 刷兵审计：普通刷兵（spawnPoint）一律离主将 ≥ 450 或在镜头外
  await p.evaluate(() => { const m = window.__M, s = window.__S, orig = m.spawnPoint.bind(m); window.__sp = []; m.spawnPoint = k => { const q = orig(k); if (q) { const v = s.cameras.main.worldView, d = Math.hypot(q.x - s.player.x, q.y - s.player.y), off = q.x < v.left || q.x > v.right || q.y < v.top || q.y > v.bottom; window.__sp.push({ d: Math.round(d), off, ph: m.phase }); } return q; }; });
  await p.evaluate(() => { window.__S.player.sprite.setPosition(0, -240); }); // 主将贴近城门，最容易「刷到脸上」的位置
  await step(p, 900);
  const al = await p.evaluate(() => { const z = window.__S.allyPush, sq = z?.squads ?? []; const lead = sq.flatMap(q => q.members.filter(m => !m.dead)); return { alive: z?.alive ?? 0, squads: sq.length, rally: window.__M.rallyPoint(), ys: lead.map(m => Math.round(m.y)).slice(0, 6), map: !!window.__S.battleMap }; });
  await p.screenshot({ path: `${OUT}/small-0-assault-allies.png` });
  ck('11-19 我方义军：开局几秒后从后方出队，向城门推进（集结在木门前）', al.alive >= 4 && al.squads >= 1 && al.ys.some(y => y < 400) && al.rally && al.rally.y < -300, al);
  const chop = await p.evaluate(() => { window.__clear(); const ok = window.__chop(0, -470); return { ok, gate: window.__M.gateHp }; });
  // 攻城城内段改造（用户 11-18）：小城也有城内段（丁字街），3 处要点占 2 处开县衙
  const inSt = await waitPhase(p, 'street');
  await step(p, 60);
  const st = await p.evaluate(() => { const m = window.__M; return { n: m.points.length, need: m.city.need, goal: window.__S.children.getByName('siege-goal')?.text }; });
  await p.screenshot({ path: `${OUT}/small-2-street.png` });
  ck('小城：砍破木门 → 进城内（丁字街）：3 处要点，占 2 处开县衙', inSt && st.n === 3 && st.need === 2 && (st.goal ?? '').includes('要点 0/2'), st);
  {
    await step(p, 600);
    const r = await p.evaluate(() => { const m = window.__M, z = window.__S.allyPush, pts = m.points.map(q => ({ x: q.x, y: q.y, r: q.radius })), sp = window.__sp; const near = sp.filter(q => q.d < 450 && !q.off);
      return { spawns: sp.length, near: near.slice(0, 5), nearN: near.length, phases: [...new Set(sp.map(q => q.ph))], allies: z?.alive ?? 0, inCity: (z?.squads ?? []).flatMap(q => q.members.filter(mm => !mm.dead)).filter(mm => mm.y < -620).length, rally: m.rallyPoint(), plaza: pts.map(q => q.r) }; });
    await p.screenshot({ path: `${OUT}/small-2b-street-allies.png` });
    ck('11-19 刷兵不刷到脸上：城外 + 城内所有普通刷兵离主将 ≥ 450 或在镜头外', r.spawns > 10 && r.nearN === 0 && r.phases.includes('outside') && r.phases.includes('street'), r);
    ck('11-19 破门后义军涌进城、去最近的要点（要点圈加大成小广场）', r.allies >= 3 && r.inCity >= 3 && r.plaza.every(x => x >= 120), r);
  }
  // 全取：三处要点都占 → 结算军粮 +20%，结算列表写「全取」
  const ft = await p.evaluate(() => { const m = window.__M; for (const q of m.points) q.state = 'secured'; return { full: m.fullTake, share: m.provisionsBonus().share, line: m.settleLines()[0] }; });
  ck('小城：三处要点全占 → 「全取」结算钱币 +20%', ft.full && ft.share === .2 && /全取/.test(ft.line), ft);
  const toHall = await waitPhase(p, 'hall');
  await step(p, 80);
  const h = await p.evaluate(() => { const s = window.__S, b = s.boss; return { phase: window.__M.phase, boss: !!b?.active, hp: b?.maxHp, name: s.chapter.bossName, goal: s.children.getByName('siege-goal')?.text, py: Math.round(s.player.y) }; });
  await p.screenshot({ path: `${OUT}/small-3-hall.png` });
  ck('小城：占够 2 处要点 → 县衙门开 → 转场到县衙，县尉出场', chop.ok && chop.gate === 0 && toHall && h.boss && /县衙/.test(h.goal) && /县尉/.test(h.goal), { chop, h });
  const ph2 = await p.evaluate(() => { const s = window.__S; s.boss.hp = s.boss.maxHp * .3; window.__step(30); return window.__M.bossInfo; });
  ck('小城：县尉半血以下也不进二阶段（只有横扫）', ph2.phase2 === false, ph2);
  const end = await killBoss(p);
  ck('小城：击败县尉 → 宝箱 → 插旗占领 → 破城、城归我方', end.over && end.victory && end.phase === 'done' && await owned(p, city), end);
  await p.close();
}
{
  const { p } = await open('small');
  const t = await p.evaluate(() => { const s = window.__S; s.elapsed = window.__M.prof.limitSeconds + 1 + 45; /* 限时 + 援军阶段（data/siegeMedium · siegeTimer） */ window.__step(10); return { over: s.over, victory: s.victory, limit: window.__M.prof.limitSeconds }; });
  ck('小城：限时 270 秒 + 援军阶段 45 秒仍未破城 → 撤军（失败）', t.over && t.victory === false && t.limit === 270, t);
  await p.close();
}

// ================= 大城 =================
{
  const { p, city } = await open('large');
  const g0 = await goals(p);
  ck(`大城（${city}）：城外段，3 座箭楼、冲车在营地、吊桥未落、两根绳索、目标「砍断吊桥绳索」`, g0.mid?.tier === 'large' && g0.towers === 3 && g0.mid.ram?.state === 'move' && !g0.mid.bridge && g0.mid.ropes === 2 && /吊桥绳索/.test(g0.text), { tier: g0.mid?.tier, towers: g0.towers, bridge: g0.mid?.bridge, ropes: g0.mid?.ropes, text: g0.text });
  // 护送冲车：停在护城河南岸
  for (let i = 0; i < 30; i++) await p.evaluate(() => { const s = window.__S, r = window.__M.ramInfo; window.__clear(); s.player.sprite.setPosition(r.x + 60, r.y + 40); window.__step(20); });
  const r1 = (await goals(p)).mid.ram;
  await p.screenshot({ path: `${OUT}/large-1-moat.png` });
  const moatBottom = await p.evaluate(async () => (await import('/src/data/siegeMedium.ts')).LARGE_SIEGE.moat.bottom);
  ck('大城：吊桥未落时冲车停在护城河南岸，不撞门', r1.state === 'move' && r1.y > moatBottom && (await goals(p)).mid.gate === (await p.evaluate(() => window.__M.gateMax)), { ram: r1, moatBottom });
  // 砍两根绳索
  const cut = await p.evaluate(async () => { const L = (await import('/src/data/siegeMedium.ts')).LARGE_SIEGE.moat; const a = window.__chop(L.ropes[0].x, L.bottom + 90); const b2 = window.__chop(L.ropes[1].x, L.bottom + 90); window.__step(5); return { a, b: b2, bridge: window.__M.bridgeDown, cut: window.__M.stats.ropesCut }; });
  ck('大城：砍断两根吊桥绳索 → 吊桥落下', cut.a && cut.b && cut.bridge && cut.cut === 2, cut);
  // 全面检查 #5：吊桥落下、主将过了河——对岸的骑兵沿岸走到桥头过河，不贴着河岸往北挤
  const moat = await p.evaluate(async () => { const s = window.__S, L = (await import('/src/data/siegeMedium.ts')).LARGE_SIEGE.moat; const hp = s.player.sprite; const keep = { x: s.player.x, y: s.player.y };
    hp.setPosition(0, L.top - 60); window.__clear(); const e = s.spawnEnemy('cavalry', -260, L.bottom + 20, 1, true); if (!e) return { none: true }; e.hp = e.maxHp = 1e6;
    const x0 = Math.round(e.x); window.__step(360); const r = { x0, x: Math.round(e.x), y: Math.round(e.y), crossed: e.y < L.bottom - 20 || Math.abs(e.x) < L.bridgeHalfW }; e.deactivate(); hp.setPosition(keep.x, keep.y); return r; });
  ck('大城：吊桥落下后对岸骑兵沿岸走到桥头过河（不卡在河岸）', !moat.none && moat.crossed, moat);
  for (let i = 0; i < 90; i++) { const st = await p.evaluate(() => { const s = window.__S, r = window.__M.ramInfo; /* 11-19 场地加深，冲车路约 36 秒 */ window.__clear(); s.player.sprite.setPosition(r.x + 60, r.y + 40); window.__step(20); return r.state; }); if (st === 'ram') break; }
  const r2 = (await goals(p)).mid.ram;
  await p.screenshot({ path: `${OUT}/large-2-bridge.png` });
  ck('大城：吊桥落下后冲车过桥、到城门撞门', r2.state === 'ram', r2);
  await p.evaluate(() => window.__M.hitGate(1e7));
  const inBarb = await waitPhase(p, 'barbican');
  await step(p, 60);
  const bb = await p.evaluate(() => ({ phase: window.__M.phase, inner: window.__M.innerGateHp, px: Math.round(window.__S.player.x), goal: window.__S.children.getByName('siege-goal')?.text }));
  ck('大城：城门破 → 转场进瓮城（内门满血、目标「砍破内门」）', inBarb && bb.inner > 0 && bb.px > 2500 && /瓮城/.test(bb.goal), bb);
  // 滚木：放到主将这一列，打到主将
  const lg = await p.evaluate(() => { const s = window.__S, m = window.__M; window.__clear(); s.player.sprite.setPosition(3000, 0); s.player.damageImmune = false; s.player.invulnUntil = 0; s.player.hp = s.player.maxHp; m.logAt = s.combatNow; m.barbVolleyAt = s.combatNow + 1e6; window.__step(2); for (const l of m.logs) l.x = s.player.x; const hp = s.player.hp; window.__step(30); const warn = m.logs.some(l => !l.rolling); window.__step(120); const r = { warn, logs: m.stats.logs, hits: m.stats.logHits, dmg: Math.round(hp - s.player.hp) }; s.player.damageImmune = true; return r; });
  await p.screenshot({ path: `${OUT}/large-3-barbican.png` });
  ck('大城：瓮城滚木礌石——先铺预警箭道，再从北墙滚下，碾到主将掉血', lg.warn && lg.logs >= 1 && lg.hits >= 1 && lg.dmg > 0, lg);
  const vol = await p.evaluate(() => { const m = window.__M; m.barbVolleyAt = window.__S.combatNow; window.__step(5); return m.stats.volleys; });
  ck('大城：瓮城城头箭雨', vol >= 1, { vol });
  const inner = await p.evaluate(() => { window.__clear(); return window.__chop(3000, -400); });
  const inStreet = await waitPhase(p, 'street');
  ck('大城：砍破瓮城内门 → 进巷战', inner && inStreet, { inner, inStreet });
  // 大城角楼：没占的角楼往城里放箭雨；两座角楼都占下后箭雨停
  const tv = await p.evaluate(() => { const s = window.__S, m = window.__M; window.__clear(); const v0 = m.stats.cityVolleys; m.cityVolleyAt = s.combatNow; window.__step(3); const v1 = m.stats.cityVolleys;
    for (const q of m.points) if (q.kind === 'tower') q.state = 'secured'; m.cityVolleyAt = s.combatNow; window.__step(3); return { towers: m.points.filter(q => q.kind === 'tower').length, fired: v1 - v0, after: m.stats.cityVolleys - v1 }; });
  ck('大城：两座角楼在时往城里放箭雨（有预警圈）；两座都占下后箭雨停', tv.towers === 2 && tv.fired === 1 && tv.after === 0, tv);
  await p.evaluate(() => { for (const pt of window.__M.points) pt.state = 'secured'; });
  const inHall = await waitPhase(p, 'hall');
  await step(p, 90);
  const hb = await p.evaluate(() => { const s = window.__S; return { boss: !!s.boss?.active, ctrl: !!s.controller, name: s.chapter.bossName, goal: s.children.getByName('siege-goal')?.text }; });
  await p.screenshot({ path: `${OUT}/large-4-hall.png` });
  ck('大城：巷战据点守住 → 内城，势力名将出场（第四章首领招式组）', inHall && hb.boss && hb.ctrl && /大将/.test(hb.name) && /内城/.test(hb.goal), hb);
  const p2 = await p.evaluate(() => { const s = window.__S; s.boss.hp = s.boss.maxHp * .45; window.__step(60); return { mid: window.__M.bossInfo, ctrl: s.controller.phase2 }; });
  ck('大城：名将半血进二阶段（招式组二阶段 + 亲卫提前杀出）', p2.ctrl && p2.mid.phase2, p2);
  const end = await killBoss(p);
  ck('大城：击败名将 → 宝箱 → 插旗占领 → 破城、城归我方', end.over && end.victory && end.phase === 'done' && await owned(p, city), end);
  await p.close();
}
{
  const { p } = await open('large');
  const r = await p.evaluate(() => { const s = window.__S, m = window.__M; window.__clear(); m.startAt = s.combatNow - 121000; window.__step(5); const sally = s.enemies.filter(e => e.active && !e.isSupplySlot).length; return { bridge: m.bridgeDown, sally: m.stats.sally, n: sally }; });
  ck('大城：一直不砍绳索，守军到时自己放桥出城（多一波出城兵）', r.bridge && r.sally === 1 && r.n >= 4, r);
  const t = await p.evaluate(() => { const s = window.__S; s.elapsed = window.__M.prof.limitSeconds + 1 + 75; /* 限时 + 援军阶段 */ window.__step(10); return { over: s.over, victory: s.victory }; });
  ck('大城：限时 650 秒 + 援军阶段 75 秒仍未破城 → 撤军（失败）', t.over && t.victory === false, t);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
