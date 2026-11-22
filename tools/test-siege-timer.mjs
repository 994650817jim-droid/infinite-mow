// 攻城限时（2026-11-18 用户「攻城战设计一下 推荐」，参数 src/data/siegeTimer.ts）：
// 剩 60 秒预警「敌援将至」、计时变红 → 限时到「敌援抵达」（守军补充、两侧援兵、守将加强、随从伤害下降，仍可破城）
// → 援军阶段结束未破城「久攻不下 · 撤军」（失败、存档不扣，只收本季军粮）；提前破城（剩余过半）攻城奖励加成。
// 正式模式（无 ?dev，非测试局）：从天下地图出征陈留 / 许昌，走真实结算 settleSiege。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-siege-timer.mjs   截图在 assets/review/siege-timer/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/siege-timer';
mkdirSync(out, { recursive: true });
let fail = 0, pass = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; else pass++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu'], eraSeen: 1, capturedEver: ['guandu'], chapterSeen: 3, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setWorldRandom(() => .99)); // 不触发攻城后反扑
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const world = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('im_world_v1')); return { owned: s.ownedCities, ever: s.capturedEver, provisions: s.provisions, reserve: s.reserve, buildings: s.buildings, active: s.active?.state }; });
const toMap = async () => { await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(900); };
const go = async id => {
  await p.evaluate(([M0, id]) => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === id).hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, [M, id]);
  await waitBattle();
};
const waitBattle = async () => {
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && !s.over; }, null, { timeout: 90000 }); await p.waitForTimeout(800);
  // 主将满血续命（不用 damageImmune：那会把本场记成调试局、不写存档）
  await p.evaluate(G0 => { const s = eval(G0); clearInterval(window.__heal); window.__heal = setInterval(() => { if (s.player?.alive) s.player.hp = s.player.maxHp; if (s.mode !== 'none' && !s.over && s.mode !== 'pause') s.setMode('none'); }, 100); }, G);
};
const state = () => p.evaluate(G0 => {
  const s = eval(G0), texts = []; const walk = l => { for (const o of l) { if (o.type === 'Text' && o.visible && o.alpha > 0) texts.push(o.text); if (o.list) walk(o.list); } }; walk(s.children.list);
  const g = s.children.getByName('siege-garrison');
  return { ...s.siegeTimer, over: s.over, victory: s.victory, elapsed: +s.elapsed.toFixed(1), garrison: s.garrisonInfo, hud: g?.text, hudColor: g?.style.color, enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, texts: texts.filter(t => /敌援|援军|撤军|速攻/.test(t)), test: s.test, debug: !!(s.debugModified || s.debugJumped || s.player.damageImmune) };
}, G);
const at = async (sec, wait = 600) => { await p.evaluate(([G0, sec]) => { eval(G0).elapsed = sec; }, [G, sec]); await p.waitForTimeout(wait); return state(); };
const result = () => p.evaluate(G0 => { const s = eval(G0), n = s.resultPanel.getByName('result-notes'); return { sub: s.resultTexts.subtitle.text, body: s.resultTexts.body.text, speed: s.siegeTimer.speedBonus, notes: n?.visible ? n.text : '' }; }, G);

// ① 陈留（中城）：预警 → 援军 → 撤军
await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene')); await toMap();
const w0 = await world();
await go('chenliu');
const s0 = await state();
ck('正式模式出征陈留（非测试局、非调试），开局计时正常色、写「限时」', !s0.test && !s0.debug && s0.phase === 'normal' && /限时 \d+:\d\d/.test(s0.hud) && s0.hudColor === '#e8c99a' && s0.limit === 480, s0);
const s1 = await at(s0.limit - 59);
ck('剩 60 秒：横幅「敌援将至」，计时变红', s1.phase === 'warn' && s1.texts.some(t => t.includes('敌援将至')) && s1.hudColor === '#ff8a70' && /限时 0:5\d/.test(s1.hud), s1);
await p.screenshot({ path: `${out}/warn-1280x720.png` });
const before = s1.enemies, total0 = s1.garrison.total;
const s2 = await at(s0.limit + .5, 900);
ck('限时到不判负，进入「敌援抵达」（援军阶段）：横幅、计时改为「敌援已至 · 撤军」倒计时', !s2.over && s2.phase === 'reinforce' && s2.texts.some(t => t.includes('敌援抵达')) && /敌援已至 · 撤军 [01]:\d\d/.test(s2.hud) && s2.hudColor === '#ff8a70', s2);
ck('援军阶段：守军池补充约 30%，城外两侧来了第一批援兵', s2.reinf === Math.round(total0 * .3) && s2.garrison.left >= s2.reinf - 8 && s2.squads === 1 && s2.enemies >= before + 6, { reinf: s2.reinf, total0, left: s2.garrison.left, squads: s2.squads, before, after: s2.enemies });
ck('援军阶段：我军士气受挫，随从伤害 ×0.9', Math.abs(s2.allyMul - .9) < 1e-6, s2.allyMul);
await p.screenshot({ path: `${out}/reinforce-1280x720.png` });
const s3 = await at(s0.limit + 26, 700);
ck('援军阶段每 25 秒再来一批（中城共 2 批）', s3.squads === 2 && !s3.over, s3);
const s4 = await at(s0.limit + s0.reinforceSeconds + .5, 1200);
const r1 = await result(), w1 = await world();
ck('援军阶段结束未破城：撤军收场，判失败，结算写「久攻不下 · 撤军」', s4.over && s4.victory === false && r1.sub === '久攻不下 · 撤军' && r1.body.includes('撤军收场') && r1.notes.includes('撤军收场'), { s4: { over: s4.over, victory: s4.victory }, r1 });
ck('撤军不扣存档：城池 / 首占 / 建筑 / 后备兵不变，钱币不减（只收本季钱币），本场已结算', JSON.stringify([w1.owned, w1.ever, w1.buildings, w1.reserve]) === JSON.stringify([w0.owned, w0.ever, w0.buildings, w0.reserve]) && w1.provisions >= w0.provisions && w1.active === 'settled', { w0, w1 });
await p.screenshot({ path: `${out}/withdraw-result-1280x720.png` });

// ② 再战陈留：速攻破城（剩余过半）→ 攻城奖励加成
await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-restart').emit('pointerdown'), G); await waitBattle();
const s5 = await at(30);
ck('再战：限时重新开始（计时正常色、援军状态清零、随从伤害复原）', s5.phase === 'normal' && s5.reinf === 0 && s5.squads === 0 && Math.abs(s5.allyMul - 1) < 1e-6 && s5.hudColor === '#e8c99a', s5);
const reward = await p.evaluate(async () => (await import('/src/data/siege.ts')).SIEGE.medium.reward);
await p.evaluate(G0 => { const s = eval(G0); s.captured = true; s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(900);
const r2 = await result(), w2 = await world();
ck('剩余过半破城：速攻奖励，结算写「速攻破城 · 攻城奖励 +30%」', r2.speed && r2.sub.startsWith('陈留归入义军版图') && r2.body.includes('速攻破城 · 攻城奖励 +30%') && r2.notes.includes('速攻破城'), r2);
ck('速攻奖励写进存档：陈留归我方，钱币增加不少于（钱币 + 战功折粮）×1.3', w2.owned.includes('chenliu') && w2.provisions - w1.provisions >= Math.round(reward.provisions * 1.3), { gain: w2.provisions - w1.provisions, reward });
await p.screenshot({ path: `${out}/speed-result-1280x720.png` });

// ③ 许昌（中城）：援军阶段里仍可破城，但不算速攻
await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G); await toMap();
await go('xuchang');
const s6 = await at(480 + 5, 900);
ck('许昌：限时已过、援军阶段中，未判负', s6.phase === 'reinforce' && !s6.over, s6);
const bb = await p.evaluate(async G0 => { const s = eval(G0), e = s.enemies.find(x => x.active && !x.isSupplySlot); const d0 = e.def.damage; s.boss = e; await new Promise(r => setTimeout(r, 400)); const d1 = e.def.damage; await new Promise(r => setTimeout(r, 300)); return { d0, d1, d2: e.def.damage, buffed: s.siegeTimer.bossBuffed === e.spawnId }; }, G);
ck('援军阶段：守将伤害 ×1.15（只加一次，阶段中才出的守将也补上）', bb.buffed && Math.abs(bb.d1 / bb.d0 - 1.15) < 1e-6 && bb.d2 === bb.d1, bb);
await p.evaluate(G0 => { const s = eval(G0); s.captured = true; s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(900);
const r3 = await result(), w3 = await world();
ck('援军阶段里仍可破城：许昌归入版图；超时破城没有速攻奖励', r3.sub.startsWith('许昌归入义军版图') && !r3.speed && !r3.body.includes('速攻') && w3.owned.includes('xuchang'), { r3, owned: w3.owned });

// ④ 参数在 data/：三档城援军时长 / 规模递增
const T = await p.evaluate(async () => (await import('/src/data/siegeTimer.ts')).SIEGE_TIMER);
const tiers = ['small', 'medium', 'large'].map(k => T.tiers[k]);
ck('data/siegeTimer：小 / 中 / 大城援军时长与规模递增，预警 60 秒，速攻门槛剩余过半', T.warnSeconds === 60 && tiers.every((t, i) => !i || (t.reinforceSeconds > tiers[i - 1].reinforceSeconds && t.squadSize > tiers[i - 1].squadSize && t.garrisonRefill >= tiers[i - 1].garrisonRefill)) && T.speed.remainingShare === .5, T);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
await b.close(); process.exit(fail ? 1 : 0);
