// 天下地图 · 军情事件（名将悬赏 / 流寇袭扰 / 商队护送）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-intel.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
// 讨董后、群雄三关（时代二），已占许昌 / 汝南 / 官渡；eraSeen=2 不弹时局面板
const mk = (o = {}) => ({ version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'], ownedCities: ['xuchang', 'runan', 'guandu'], eraSeen: 2, capturedEver: ['xuchang', 'runan', 'guandu'], alerts: [], lastLost: [], chapterSeen: 4, ...o });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('IntelGameScene')";
const page = async (save, layout = 'mobile') => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  return p;
};
const toMap = async p => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'WorldMapScene') s.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(500); };
const store = (p, fn) => p.evaluate(async src => { const w = await import('/src/world/WorldStore.ts'); const i = await import('/src/world/WorldIntel.ts'); return (0, eval)(src)(w, i); }, fn.toString());
/** 写入指定军情（覆盖现有）。 */
const setIntel = (p, list) => p.evaluate(list => { const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.intel = list; raw.intelSeq = 99; localStorage.setItem('im_world_v1', JSON.stringify(raw)); localStorage.removeItem('im_world_backup_v1'); }, list);
const season = p => store(p, (w, i) => i.seasonIndex(w.loadWorld().town));
const launch = async (p, id) => {
  await p.evaluate(([M0, id]) => { const s = eval(M0); s.intelMarkers.find(m => m.event.id === id).root.getByName('intel-hit-' + id).emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); }, [M, id]);
  await p.waitForTimeout(200);
  await p.evaluate(M0 => eval(M0).children.getByName('intel-modal').getByName('intel-go').emit('pointerup'), M);
  await p.waitForFunction(() => window.__game.scene.isActive('IntelGameScene') && window.__game.scene.getScene('IntelGameScene').player, null, { timeout: 30000 }); await p.waitForTimeout(1200);
};
const waitOver = async p => { for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); if (await p.evaluate(G0 => { const s = eval(G0); s.collectBossChests?.(); return s.over; }, G)) break; } await p.waitForTimeout(400); };
const winBoss = async p => { await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G); await waitOver(p); };

// —— 1. 存档与刷新规则 ——
{
  const p = await page(mk());
  const r = await store(p, (w, i) => {
    const o = {};
    w.setWorldRandom(() => .3);
    o.first = w.ensureIntel(); o.again = w.ensureIntel(); const s = w.loadWorld(); o.list = s.intel; o.seq = s.intelSeq; o.now = i.seasonIndex(s.town);
    // 生成规则：多次随机检查
    let bad = [], kinds = new Set();
    for (let k = 0; k < 200; k++) { let a = k * 2654435761 >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; const ev = i.rollIntel({ era: 2, owned: ['xuchang', 'runan', 'guandu'], alerts: ['runan'], existing: [], season: 800, seq: 0, random: rnd });
      for (const e of ev) { kinds.add(e.kind); if (e.kind === 'bandit' && (!['xuchang', 'guandu'].includes(e.city))) bad.push(e); if (e.kind === 'escort' && !['xuchang', 'runan', 'guandu'].includes(e.city)) bad.push(e); if (e.kind === 'bounty' && (['xuchang', 'runan', 'guandu'].includes(e.city) || !e.general)) bad.push(e); }
      if (ev.length < 1 || ev.length > 2 || new Set(ev.map(e => e.city)).size !== ev.length) bad.push(ev); }
    o.bad = bad.slice(0, 3); o.kinds = [...kinds];
    o.full = i.rollIntel({ era: 2, owned: [], alerts: [], existing: [1, 2, 3].map(n => ({ id: 'x' + n, kind: 'bounty', city: 'luoyang', faction: 'caocao', expires: 1e4 })), season: 800, seq: 0, random: Math.random }).length;
    o.noOwned = i.rollIntel({ era: 2, owned: [], alerts: [], existing: [], season: 800, seq: 0, random: () => .5 }).every(e => e.kind !== 'bandit');
    w.setWorldRandom();
    return o;
  });
  ck('讨董后首次打开：刷出 1–2 件军情，只刷一次', r.first === true && r.again === false && r.list.length >= 1 && r.list.length <= 2 && r.seq > 0, r);
  ck('流寇只在未告急的我方城池、商队去我方城池、悬赏在敌方城池且有名将；同城不重复', r.bad.length === 0, r.bad);
  ck('三类军情都会出现', ['bounty', 'bandit', 'escort'].every(k => r.kinds.includes(k)), r.kinds);
  ck('已有 3 件时不再刷；没有城池时不刷流寇', r.full === 0 && r.noOwned, r);
  await p.close();
}
{
  const p = await page(mk({ cleared: { huangjin: true, hulao: false }, dongzhuoStages: 1, warlordStages: 0, ownedCities: [], capturedEver: [], eraSeen: 1 }));
  const r = await store(p, w => ({ spawned: w.ensureIntel(), list: w.intelEvents() }));
  ck('讨董前不刷军情', r.spawned === false && r.list.length === 0, r);
  await p.close();
}
// 季度结算：流寇未平 → 该城本季产出减半、过期移除；悬赏两季有效
{
  const p = await page(mk());
  const now = await season(p);
  await setIntel(p, [{ id: 'b1', kind: 'bandit', city: 'xuchang', faction: 'yellow', expires: now }, { id: 'h1', kind: 'bounty', city: 'luoyang', faction: 'caocao', general: '许褚', expires: now + 1 }]);
  const r = await store(p, w => {
    w.setWorldRandom(() => .99);
    const id = w.beginSiege('chenliu', true), res = w.settleSiege(id, { victory: false, bossKilled: false, debug: false, elapsed: 100, reward: { merits: 0, provisions: 0 }, firstBonus: 0 });
    const s = w.loadWorld(); w.setWorldRandom();
    return { raided: res.season?.raided, cityMerits: res.season?.cityMerits, ids: s.intel.map(e => e.id), line: w.cityIncomeLine(res) };
  });
  const base = await store(p, () => null);
  ck('流寇未平：季报记「许昌本季产出减半」，事件过期移除；悬赏仍在', r.raided?.includes('许昌') && !r.ids.includes('b1') && r.ids.includes('h1') && r.line.includes('流寇未平'), r);
  // 平定流寇后：不减产
  const now2 = await season(p);
  await setIntel(p, [{ id: 'b2', kind: 'bandit', city: 'xuchang', faction: 'yellow', expires: now2 }]);
  const r2 = await store(p, w => { w.setWorldRandom(() => .99); const before = w.loadWorld(); const id = w.beginIntel('b2'); const res = w.settleIntel(id, { success: true, victory: true, debug: false, elapsed: 120 }); const after = w.loadWorld(); w.setWorldRandom(); return { res: { merits: res.merits, provisions: res.provisions, resolved: res.resolved, raided: res.season?.raided ?? null, cityMerits: res.cityMerits }, gain: after.provisions - before.provisions, gone: !after.intel.some(e => e.id === 'b2'), again: w.settleIntel(id, { success: true, victory: true, debug: false, elapsed: 120 }).provisions }; });
  ck('平定流寇：奖励只进军粮（中城 军粮 60 + 军功 30 折 45，含营寨收成）、不减产、事件移除、不可重复结算', r2.res.resolved && r2.res.raided === null && r2.res.merits === 0 && r2.gain === r2.res.provisions && r2.res.provisions >= 105 - 50 && r2.gone && r2.again === 0, r2);
  // 商队被劫 → 事件移除；悬赏失败 → 保留
  const now3 = await season(p);
  await setIntel(p, [{ id: 'e1', kind: 'escort', city: 'runan', faction: 'han', expires: now3 }, { id: 'h2', kind: 'bounty', city: 'luoyang', faction: 'caocao', general: '典韦', expires: now3 + 1 }]);
  const r3 = await store(p, w => { w.setWorldRandom(() => .99); const a = w.beginIntel('e1'); w.settleIntel(a, { success: false, lost: true, victory: false, debug: false, elapsed: 30 }); const b2 = w.beginIntel('h2'); w.settleIntel(b2, { success: false, victory: false, debug: false, elapsed: 30 }); const s = w.loadWorld(); const d = w.beginIntel('h2'); const dbg = w.settleIntel(d, { success: true, victory: true, debug: true, elapsed: 200 }); w.abandonExpedition(d, []); w.setWorldRandom(); return { ids: s.intel.map(e => e.id), noSeason: s.town, dbg: dbg.merits, still: w.intelEvents().some(e => e.id === 'h2'), bad: w.beginIntel('nope') }; });
  ck('商车被毁：商队事件移除；悬赏失败（不足 60 秒）保留、不过季', !r3.ids.includes('e1') && r3.ids.includes('h2'), r3.ids);
  ck('测试战斗不发奖励、不移除事件；无效事件不能出征', r3.dbg === 0 && r3.still && r3.bad === '', r3);
  ck('旧存档（无军情字段）读入为空且可存回', await store(p, w => { const raw = JSON.parse(localStorage.getItem('im_world_v1')); delete raw.intel; delete raw.intelSeq; localStorage.setItem('im_world_v1', JSON.stringify(raw)); localStorage.removeItem('im_world_backup_v1'); const s = w.loadWorld(); return Array.isArray(s.intel) && s.intel.length === 0 && s.intelSeq === 0; }));
  void base;
  await p.close();
}

// —— 2. 地图：标记、军情匾、详情、出征面板；名将悬赏全流程 ——
for (const layout of ['mobile', 'desktop']) {
  const p = await page(mk(), layout);
  const now = await (async () => { await store(p, () => 0); return season(p); })();
  await setIntel(p, [{ id: 'h1', kind: 'bounty', city: 'chenliu', faction: 'caocao', general: '许褚', expires: now + 1 }, { id: 'b1', kind: 'bandit', city: 'xuchang', faction: 'yellow', expires: now }, { id: 'e1', kind: 'escort', city: 'runan', faction: 'han', expires: now }]);
  await toMap(p);
  const m = await p.evaluate(M0 => { const s = eval(M0); return { markers: s.intelMarkers.map(x => x.event.id), chip: s.children.getByName('world-intel')?.text, visible: s.intelMarkers.filter(x => x.root.visible).length }; }, M);
  ck(`[${layout}] 地图显示 3 个军情标记与「军情 3」匾`, m.markers.length === 3 && m.chip?.startsWith('军情 3') && m.visible >= 1, m);
  await p.evaluate(M0 => eval(M0).children.getByName('world-intel').emit('pointerup'), M);
  const d = await p.evaluate(M0 => { const s = eval(M0); return { sel: s.selected.kind === 'intel' && s.selected.event.id, title: s.detailTitle.text, body: s.detail.text, action: s.action.text.text }; }, M);
  ck(`[${layout}] 点军情匾：选中并显示军情详情（奖励、期限）`, d.sel === 'h1' && d.title.includes('名将悬赏') && d.body.includes('许褚') && d.body.includes('传奇兵装') && d.body.includes('剩余 2 季') && d.action.includes('军情'), d);
  await p.screenshot({ path: `${out}/${layout}-map-intel.png` });
  await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M); await p.waitForTimeout(250);
  const modal = await p.evaluate(M0 => { const r = eval(M0).children.getByName('intel-modal'); return r && r.list.filter(o => o.type === 'Text').map(o => o.text).join('\n'); }, M);
  ck(`[${layout}] 出征面板：胜利条件、奖励、武将选择`, !!modal && modal.includes('悬赏 · 许褚') && modal.includes('击败许褚') && modal.includes('出战武将'), modal);
  await p.screenshot({ path: `${out}/${layout}-intel-modal.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('intel-modal').getByName('intel-cancel').emit('pointerup'), M);
  if (layout === 'desktop') {
    // 名将悬赏：出征 → 击败名将 → 紫 / 橙兵装入行囊，事件移除
    const bagBefore = await p.evaluate(() => JSON.parse(localStorage.getItem('im_items_v2') ?? '{"bag":[]}').bag.length);
    const before = await store(p, w => w.loadWorld().provisions);
    await launch(p, 'h1');
    const g = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, waves: s.chapter.waves.map(w => w.name), boss: s.chapter.bossName, active: s.registry.get('runConfig')?.encounter }; }, G);
    ck('悬赏战：三波（第三波为名将出阵），首领为许褚', g.name === '悬赏 · 许褚' && g.waves.length === 3 && g.waves[2] === '许褚出阵' && g.boss === '许褚', g);
    await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); }, G); await p.waitForTimeout(600);
    ck('名将走第四章首领招式（有技能控制器）', await p.evaluate(G0 => !!eval(G0).controller && !!eval(G0).boss?.active, G));
    await p.screenshot({ path: `${out}/${layout}-bounty-battle.png` });
    await winBoss(p);
    const res = await p.evaluate(G0 => { const s = eval(G0); return { over: s.over, victory: s.victory, body: s.resultTexts.body.text, sub: s.resultTexts.subtitle.text }; }, G);
    const bag = await p.evaluate(() => JSON.parse(localStorage.getItem('im_items_v2') ?? '{"bag":[]}').bag);
    const after = await store(p, w => ({ grain: w.loadWorld().provisions, has: w.intelEvents().some(e => e.id === 'h1') }));
    const got = bag.length - bagBefore, top = bag.filter(x => x.quality === 'purple' || x.quality === 'orange').length;
    ck('击败许褚：胜利，结算显示悬赏兵装并入行囊（紫 / 橙）', res.victory && res.body.includes('入行囊') && got >= 1 && top >= 1, { res, got, top });
    ck('悬赏奖励军粮入账、事件移除', after.grain - before >= 80 && !after.has, { before, after });
    await p.screenshot({ path: `${out}/${layout}-bounty-result.png` });
    await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G);
    await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(400);
    ck('返回天下地图：悬赏标记消失', await p.evaluate(M0 => !eval(M0).intelMarkers.some(x => x.event.id === 'h1'), M));
  }
  await p.close();
}

// —— 3. 流寇袭扰：两波、寇首、平定 ——
{
  const p = await page(mk(), 'mobile');
  const now = await (async () => { await store(p, () => 0); return season(p); })();
  await setIntel(p, [{ id: 'b1', kind: 'bandit', city: 'xuchang', faction: 'yellow', expires: now }]);
  await toMap(p); await launch(p, 'b1');
  const g = await p.evaluate(G0 => { const s = eval(G0); return { waves: s.chapter.waves.map(w => w.name), boss: s.chapter.bossName }; }, G);
  ck('流寇战：两波（流寇袭扰 → 寇首现身），首领流寇寇首', g.waves.join() === '流寇袭扰,寇首现身' && g.boss === '流寇寇首', g);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/mobile-bandit-battle.png` });
  const before = await store(p, w => w.loadWorld().provisions);
  await winBoss(p);
  const after = await store(p, w => ({ grain: w.loadWorld().provisions, has: w.intelEvents().some(e => e.id === 'b1') }));
  const body = await p.evaluate(G0 => eval(G0).resultTexts.body.text, G);
  ck('平定流寇：胜利、军粮入账、事件移除、季报无减产', after.grain - before >= 20 && !after.has && body.includes('军情 · 军粮') && !body.includes('流寇未平'), { before, after, body });
  await p.close();
}

// —— 4. 商队护送：车旁前进 / 离车停步 / 敌兵劫掠 / 抵达 / 车毁 ——
for (const layout of ['mobile', 'desktop']) {
  const p = await page(mk(), layout);
  const now = await (async () => { await store(p, () => 0); return season(p); })();
  await setIntel(p, [{ id: 'e1', kind: 'escort', city: 'runan', faction: 'han', expires: now }]);
  await toMap(p); await launch(p, 'e1');
  const st0 = await p.evaluate(G0 => ({ ...eval(G0).escortState, el: eval(G0).elapsed, mode: eval(G0).mode, fps: window.__game.loop.actualFps }), G);
  await p.waitForTimeout(2000);
  const st1 = await p.evaluate(G0 => ({ ...eval(G0).escortState, el: eval(G0).elapsed, mode: eval(G0).mode, fps: window.__game.loop.actualFps }), G);
  ck(`[${layout}] 商车存在，玩家在旁时前进`, !!st0 && st1.y < st0.y - 10 && !st1.stopped, { st0, st1 });
  await p.screenshot({ path: `${out}/${layout}-escort-battle.png` });
  // 玩家离车 → 停步
  await p.evaluate(G0 => { const s = eval(G0); s.player.sprite.setPosition(s.player.x + 600, s.player.y); }, G); await p.waitForTimeout(800);
  const st2 = await p.evaluate(G0 => eval(G0).escortState, G); await p.waitForTimeout(800);
  const st3 = await p.evaluate(G0 => ({ ...eval(G0).escortState, hint: eval(G0).escortHint.text, pointer: eval(G0).cartPointer.visible && eval(G0).cartPointer.text }), G);
  ck(`[${layout}] 玩家离车：商车停步并提示`, st2.stopped && Math.abs(st3.y - st2.y) < 1 && st3.hint.includes('停步'), { st2, st3 });
  ck(`[${layout}] 商车在屏幕外：边缘箭头指向商车`, typeof st3.pointer === 'string' && st3.pointer.includes('◀ 商车'), st3);
  if (layout === 'mobile') await p.screenshot({ path: `${out}/${layout}-escort-stopped.png` });
  // 敌兵贴车 → 掉血
  const hp = await p.evaluate(async G0 => { const s = eval(G0), c = s.escortState; const e = s.spawnEnemy('infantry', c.x + 20, c.y + 10, 1, true); if (e) e.speed = 0; const h0 = s.escortState.hp; await new Promise(r => setTimeout(r, 900)); return { h0, h1: s.escortState.hp }; }, G);
  ck(`[${layout}] 敌兵贴近商车：车辆受损`, hp.h1 < hp.h0, hp);
  if (layout === 'mobile') {
    // 车毁 → 失败，事件移除
    await p.evaluate(G0 => { eval(G0).cartHp = 0; }, G); await waitOver(p);
    const r = await p.evaluate(G0 => { const s = eval(G0); return { victory: s.victory, sub: s.resultTexts.subtitle.text }; }, G);
    ck('商车被毁：失败、商队被劫、事件移除', !r.victory && r.sub.includes('商车被劫') && !(await store(p, w => w.intelEvents().length)), r);
  } else {
    // 抵达 → 胜利、得钱
    const money = await store(p, w => w.loadWorld().provisions);
    await p.evaluate(G0 => { const s = eval(G0); s.player.sprite.setPosition(s.cart.x, s.cart.y - 1480); s.cart.y -= 1490; }, G); await waitOver(p);
    const r = await p.evaluate(G0 => { const s = eval(G0); return { victory: s.victory, body: s.resultTexts.body.text, title: s.resultTexts.title.text }; }, G);
    const after = await store(p, w => ({ money: w.loadWorld().provisions, has: w.intelEvents().some(e => e.id === 'e1') }));
    ck('商车抵达：胜利、商队钱 120 折成军粮入营（≥ 180）、事件移除', r.victory && r.title === '商队抵达' && r.body.includes('军情 · 军粮 +') && after.money - money >= 180 && !after.has, { r, money, after });
    await p.screenshot({ path: `${out}/${layout}-escort-result.png` });
  }
  await p.close();
}

await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
