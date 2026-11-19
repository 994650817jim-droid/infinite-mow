// 攻城守军有限（data/siegeMedium.ts SIEGE_GARRISON，SiegeGameScene 守军池；用户 2026-11-17「关于攻城是没有波数的，这个要设计不可以无限刷等级」）：
// - 顶部显示「守军 剩/总 · 限时」；普通刷兵、敌营增援从池里出，池（本段份额）用完后不再来人、不再回涨；
// - 站着不动刷很久：经验在池空后不再增长；敌营每营最多增援 3 批，拆营扣掉没出的兵；
// - 池空后必刷的兵（目标 / 剧情）照出但不给经验；进到下一段（县衙）放出后段份额。
// 电脑布局 1280×720，逐帧 game.step。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-siege-finite.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 520) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng', 'xiangyang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5 };
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
    window.__S = s; window.__M = s.siegeMid; window.__M.prof.limitSeconds = 99999; // 测「刷很久」：去掉限时
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none' && s.mode !== 'paused') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    // 把场上的兵都打死（走 killEnemy，掉经验球），再把经验球收走计数（= 这一轮可拿的经验）
    window.__sweep = () => { let k = 0; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') { s.hitEnemy(e, 1e7, s.combatNow, 'melee', false, false); k++; } let xp = 0; for (const gm of s.gems) if (gm.active) { xp += gm.value; gm.active = false; gm.img.setVisible(false); } return { k, xp }; };
  }, G);
  return { p, city };
}
const step = (p, n) => p.evaluate(n => window.__step(n), n);
const gi = p => p.evaluate(() => window.__S.garrisonInfo);

// ================= 小城：站在城外刷 =================
{
  const { p, city } = await open('small');
  const g0 = await gi(p), hud = await p.evaluate(G0 => eval(G0).children.getByName('siege-garrison')?.text, G);
  ck(`小城（${city}）：有守军池，顶部显示「守军 剩/总 · 限时」`, !!g0 && g0.total >= 120 && /守军 \d+\/\d+/.test(hud ?? '') && /限时/.test(hud ?? ''), { g0, hud });
  // 站在营地旁的兵来源：普通刷兵 + 敌营增援（让主将走到敌营附近激活）
  await p.evaluate(() => { const c = window.__S.enemyCamps.camps[0]; if (c) window.__S.player.sprite.setPosition(c.point.x + 200, c.point.y + 200); });
  // 记录每个刷出来的兵的位置（普通刷兵 + 敌营增援）
  await p.evaluate(() => { const s = window.__S, orig = s.spawnEnemy.bind(s); window.__spawns = []; s.spawnEnemy = (k, x, y, ...r) => { const e = orig(k, x, y, ...r); if (e && k !== 'boss') window.__spawns.push([Math.round(e.x), Math.round(e.y)]); return e; }; });
  const log = [];
  for (let r = 0; r < 70; r++) { await step(p, 120); const sw = await p.evaluate(() => window.__sweep()); const g = await gi(p); log.push({ t: Math.round(await p.evaluate(() => window.__S.elapsed)), ...sw, spent: g.spent, cut: g.cut, left: g.left, cap: g.cap }); }
  const last = log.slice(-20), xpTail = last.reduce((n, x) => n + x.xp, 0), xpAll = log.reduce((n, x) => n + x.xp, 0), spentEnd = log.at(-1).spent;
  ck('站在城外刷 140 秒：已出守军不超过本段份额（城外段）、不回涨', log.every((x, i) => x.spent + x.cut <= x.cap && (i === 0 || x.left <= log[i - 1].left)), { first: log[0], end: log.at(-1) });
  const full = log.findIndex(x => x.spent + x.cut >= x.cap), after = full >= 0 ? log.slice(full + 2) : [];
  ck('本段份额用完后不再来人：之后（≥20 秒）场上没有新兵、已出数不变', after.length >= 10 && after.every(x => x.k === 0 && x.spent === spentEnd), { fullAt: log[full]?.t, n: after.length, bad: after.filter(x => x.k || x.spent !== spentEnd), spentEnd });
  ck('经验在守军用完后不再增长（最后 40 秒经验 0；之前拿到过经验）', xpTail === 0 && xpAll > 0, { xpAll, xpTail });
  const sp = await p.evaluate(async () => { const M = (await import('/src/data/siegeMedium.ts')).MID_SIEGE.outside, a = M.arena, rearY = a.bottom - (a.bottom - a.top) * .3, ps = window.__spawns;
    return { n: ps.length, rearY, behind: ps.filter(([, y]) => y > rearY).slice(0, 5), gate: ps.filter(([x, y]) => Math.abs(x) <= M.gate.halfW + 220 && y <= M.wallY + 120).length, flank: ps.filter(([x]) => Math.abs(x) > 300).length }; });
  ck('城外段：刷兵都不在场地下方 30%（我方营地 / 冲车来路）', sp.n > 10 && sp.behind.length === 0, sp);
  ck('城外段：兵从城门出城为主，两翼（敌营）为辅', sp.gate > sp.n * .35 && sp.flank > 0 && sp.gate + sp.flank === sp.n, sp);
  const camps = await p.evaluate(() => window.__S.enemyCamps.camps.map(c => ({ batches: c.batches, destroyed: c.destroyed, label: c.label.text })));
  ck('敌营每营最多增援 3 批，用完显示「援兵已尽」', camps.every(c => c.batches <= 3) && camps.some(c => c.batches >= 1), camps);
  // 池空 / 份额用完后必刷的兵：照出、不给经验
  const forced = await p.evaluate(() => { const s = window.__S, e = s.scriptedSpawn(() => s.spawnEnemy('infantry', s.player.x + 120, s.player.y, 1, true)), plain = s.spawnEnemy('infantry', s.player.x + 160, s.player.y, 1, true); const unpaid = s.garrisonInfo.unpaid; const r = window.__sweep(); return { spawned: !!e, plainBlocked: !plain, unpaid, xp: r.xp }; });
  ck('份额用完后剧情 / 目标必刷的兵照出但不给经验；普通强制刷兵不再出', forced.spawned && forced.plainBlocked && forced.unpaid >= 1 && forced.xp === 0, forced);
  // 进县衙（经城内段）：放出后段份额（又能来人），总数仍不超过守军总数
  await p.evaluate(() => { const s = window.__S, M = window.__M; s.player.sprite.setPosition(0, -470); for (let i = 0; i < 6; i++) { const t = M.priorityTarget(400); if (t) s.hitEnemy(t, 1e7, s.combatNow, 'melee', false, false); } });
  for (let i = 0; i < 40 && (await p.evaluate(() => window.__M.phase)) !== 'hall'; i++) { await p.evaluate(() => { const M = window.__M; if (M.phase === 'street') for (const pt of M.points) pt.state = 'secured'; }); await step(p, 20); } // 小城也有城内段（攻城城内段改造）：要点直接记作占稳
  await step(p, 600); const gh = await gi(p);
  ck('进到县衙段：放出后段份额（上限 = 守军总数），已出总数不超过守军总数', (await p.evaluate(() => window.__M.phase)) === 'hall' && gh.cap === gh.total && gh.spent + gh.cut <= gh.total, gh);
  await p.close();
}
// ================= 大城：吊桥未放时不从城里出兵 =================
{
  const { p, city } = await open('large');
  const r = await p.evaluate(async () => { const L = (await import('/src/data/siegeMedium.ts')).LARGE_SIEGE, M = (await import('/src/data/siegeMedium.ts')).MID_SIEGE.outside, a = M.arena, rearY = a.bottom - (a.bottom - a.top) * .3; const out = []; for (let i = 0; i < 400; i++) { const q = window.__M.spawnPoint('infantry'); if (q) out.push(q); }
    const camps = window.__S.enemyCamps.camps.map(c => [c.point.x, c.point.y]); return { n: out.length, north: out.filter(q => q.y < L.moat.bottom).length, behind: out.filter(q => q.y > rearY).length, camps, rearY, bridge: window.__M.bridgeDown }; });
  ck(`大城（${city}）：吊桥未放时刷兵都在护城河南岸两翼、不在身后；两座敌营在左右两翼、不在我方身后`, !r.bridge && r.n > 50 && r.north === 0 && r.behind === 0 && r.camps.length === 2 && r.camps.every(([x, y]) => Math.abs(x) > 300 && y < r.rearY) && r.camps[0][0] * r.camps[1][0] < 0, r);
  await p.close();
}
// ================= 中城：拆营扣守军 =================
{
  const { p, city } = await open('medium');
  const g0 = await gi(p);
  const cut = await p.evaluate(() => { const s = window.__S, c = s.enemyCamps.camps[0]; const before = s.garrisonInfo; s.hitEnemy(c.enemy, 1e7, s.combatNow, 'melee', false, false); return { before, after: s.garrisonInfo, batches: c.batches, destroyed: c.destroyed }; });
  ck(`中城（${city}）：守军总数比小城多；拆掉一座敌营，扣掉它没出的兵（3 批 × 3 人）`, g0.total > 120 && cut.destroyed && cut.after.cut - cut.before.cut === (3 - cut.batches) * 3, { total: g0.total, cut });
  // 冲车蒙皮顶棚：普通箭 ×0.25；受击后 0.5 秒免伤
  const arm = await p.evaluate(() => { const M = window.__M, r = M.ram; r.guardUntil = 0; const h0 = r.hp; M.damageRam(40, 'arrow'); const h1 = r.hp; M.damageRam(40, 'arrow'); const h2 = r.hp; r.guardUntil = 0; M.damageRam(40, 'melee'); return { arrow: h0 - h1, guarded: h1 - h2, melee: h1 - r.hp, alert: M.goalLine() }; });
  ck('冲车：普通箭只吃 25%（40 → 10），受击后 0.5 秒内再中箭不掉血，敌兵砍照常；顶部提示「冲车受击」', Math.abs(arm.arrow - 10) < .01 && arm.guarded === 0 && Math.abs(arm.melee - 40) < .01 && /冲车受击/.test(arm.alert), arm);
  // 只挨城头箭雨（清掉所有敌兵、主将离冲车远远的、不扑火）：冲车撑过 45 秒
  const surv = await p.evaluate(() => { const s = window.__S, M = window.__M, r = M.ram; r.hp = M.ramCfg.hp; r.guardUntil = 0; r.burnUntil = 0; s.player.sprite.setPosition(520, 120); const z0 = M.stats.zones, t0 = s.elapsed, f0 = M.stats.fireArrows;
    for (let i = 0; i < 2700; i += 30) { window.__step(30); for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); s.player.sprite.setPosition(520, 120); }
    return { sec: Math.round(s.elapsed - t0), state: M.ram.state, hp: Math.round(M.ram.hp), max: M.ramCfg.hp, zones: M.stats.zones - z0, fire: M.stats.fireArrows - f0, lost: M.stats.ramsLost }; });
  ck('冲车只挨城头箭雨（含受损后的火箭）、主将不管：撑过 45 秒', surv.sec >= 44 && surv.state !== 'wreck' && surv.lost === 0 && surv.zones > 5, surv);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
