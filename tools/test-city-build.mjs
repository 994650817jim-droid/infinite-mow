// 城池建设第一批（city-build-proposal.md；用户要求精简，只有府衙 / 屯田 / 募兵所；屯田按场结算、结算画面列明细）：v9→v10 迁移、建造规则、结算产出、失守保留、天下地图 → 进入城池（电脑布局）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5190/ node tools/test-city-build.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/city-build';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const page = async (save, layout = 'desktop') => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  return p;
};
const store = (p, fn, arg) => p.evaluate(async ([src, arg]) => { const w = await import('/src/world/WorldStore.ts'); const c = await import('/src/data/cityBuildings.ts'); return (0, eval)(src)(w, c, arg); }, [fn.toString(), arg]);
const OWNED = ['xuchang', 'runan', 'luoyang', 'guandu', 'chenliu'];
const save9 = { version: 9, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: OWNED, eraSeen: 2, capturedEver: OWNED, alerts: [], lastLost: [], chapterSeen: 3,
  town: { year: 188, season: 2, levels: { hall: 3, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 0, granary: 1, pavilion: 0 }, focus: { xuchang: 'farm', runan: 'military', luoyang: 'military', chenliu: 'farm' }, report: null, tech: [], drill: 0 } };
// 旧「城池发展」每战产出（v9 FOCUS_INCOME），用来对照迁移后不吃亏
const OLD = { small: { balanced: [10, 0], farm: [16, 0], military: [5, 1] }, medium: { balanced: [28, 0], farm: [40, 0], military: [14, 1] }, large: { balanced: [55, 0], farm: [80, 0], military: [28, 2] } };

// —— 1. v9 → v10 迁移 ——
{
  const p = await page(save9);
  const r = await store(p, (w, c) => { const s = w.loadWorld(); w.saveWorld(); const raw = JSON.parse(localStorage.getItem('im_world_v1')), bak = JSON.parse(localStorage.getItem('im_world_backup_v1'));
    return { cities: s.cities, grain: s.provisions, focus: s.town.focus, ver: raw.version, bak: bak?.version, again: w.loadWorld().provisions }; });
  const tiers = await p.evaluate(async ids => { const m = await import('/src/world/WorldCities.ts'); return Object.fromEntries(ids.map(id => [id, m.cityById(id).tier])); }, OWNED);
  const incomes = await p.evaluate(async ([ids, tiers]) => { const w = await import('/src/world/WorldStore.ts'), c = await import('/src/data/cityBuildings.ts'); return Object.fromEntries(ids.map(id => [id, c.cityIncome(tiers[id], w.cityLevels(id))])); }, [OWNED, tiers]);
  ck('迁移：重农城 → 屯田 1 级，重军城 → 募兵所 1 级，其余府衙 1 级', r.cities.xuchang.tuntian === 1 && r.cities.chenliu.tuntian === 1 && r.cities.runan.muster === 1 && r.cities.luoyang.muster === 1 && r.cities.guandu.office === 1 && r.cities.guandu.tuntian === 0 && OWNED.every(id => r.cities[id].office === 1), r.cities);
  const refund = 60 + 60 + 120 + 60; // 许昌 / 汝南 / 陈留（中城 60）、洛阳（大城 120），各退一次改方向的军粮
  ck('迁移：改方向花的钱币按档次退还一次；城池发展清空；再读不重复退', r.grain === 1000 + refund && Object.keys(r.focus).length === 0 && r.again === r.grain, { grain: r.grain, expect: 1000 + refund, again: r.again });
  ck('迁移：写盘为 v10，旧档留在备份', r.ver === 10 && r.bak === 9, r);
  const rows = OWNED.map(id => { const f = save9.town.focus[id] ?? 'balanced', [g, t] = OLD[tiers[id]][f]; return { id, tier: tiers[id], focus: f, old: [g, t], now: [incomes[id].grain, incomes[id].troops] }; });
  ck('迁移：每座城每战产出（钱币、后备兵）都不低于原来', rows.every(x => x.now[0] >= x.old[0] && x.now[1] >= x.old[1]), rows);
  console.log('  对照：' + rows.map(x => `${x.id}(${x.tier},${x.focus}) 原 ${x.old[0]}粮+${x.old[1]}兵 → 现 ${x.now[0]}粮+${x.now[1]}兵`).join('；'));
  await p.close();
}

// —— 2. 建造规则、结算、失守保留 ——
{
  const p = await page({ ...save9, version: 10, provisions: 5000, cities: { guandu: { office: 1, tuntian: 0, muster: 0 }, sishui: { office: 2, tuntian: 1, muster: 0 } }, town: { ...save9.town, focus: {} } });
  const r = await store(p, (w, c) => {
    const o = {};
    o.t1 = w.cityBuild('guandu', 'tuntian'); o.t2 = w.cityBuild('guandu', 'tuntian'); o.m1 = w.cityBuild('guandu', 'muster'); o.m2 = w.cityBuild('guandu', 'muster');
    o.o2 = w.cityBuild('guandu', 'office'); o.o3 = w.cityBuild('guandu', 'office'); o.t2b = w.cityBuild('guandu', 'tuntian');
    o.notMine = w.cityBuild('ye', 'tuntian'); o.mediumCost = c.cityBuildCost('tuntian', 'medium', 0); o.largeCost = c.cityBuildCost('office', 'large', 1);
    o.lv = w.cityLevels('guandu'); o.grain = w.loadWorld().provisions;
    // 结算：各城产出合计、募兵所送兵
    const before = w.loadWorld(), id = w.beginExpedition('hulao', 1), res = w.settleExpedition(id, { chapter: 'hulao', victory: true, bossKilled: true, elapsed: 300, kills: 300, reason: 'boss', debug: false });
    o.cityGrain = res.season?.cityGrain; o.cityTroops = res.season?.cityTroops; o.farms = res.season?.farms; o.line = w.cityIncomeLine(res); o.reserveGain = Object.values(w.loadWorld().reserve).reduce((a, b) => a + b, 0) - Object.values(before.reserve).reduce((a, b) => a + b, 0);
    o.lost = w.loadWorld().cities.sishui;
    return o; });
  ck('小城：屯田 1 级 80；2 级要府衙 Lv2；募兵所小城最高 1 级', r.t1.ok && !r.t2.ok && r.t2.message.includes('府衙 Lv2') && r.m1.ok && !r.m2.ok, r);
  ck('小城：府衙升 2 级后屯田可升 2 级；府衙小城最高 2 级；不是我方城池不能建', r.o2.ok && !r.o3.ok && r.t2b.ok && r.lv.office === 2 && r.lv.tuntian === 2 && r.lv.muster === 1 && !r.notMine.ok, r);
  ck('价格按档次放大：中城屯田 1 级 120，大城府衙 2 级 400', r.mediumCost === 120 && r.largeCost === 400, r);
  ck('结算：各城钱币与募兵所后备兵按建筑计入（只有官渡募兵所 1 级 → 1 人）', r.cityGrain > 0 && r.cityTroops === 1 && r.reserveGain === 1, r);
  ck('屯田按场结算、自动入账：结算明细「屯田供粮：官渡 +20」（小城 2 级 × 10）', JSON.stringify(r.farms) === JSON.stringify([{ city: '官渡', grain: 20 }]) && r.line.includes('屯田供粮：官渡 +20'), { farms: r.farms, line: r.line });
  ck('失守 / 未占领的城建筑等级保留在存档里', r.lost?.office === 2 && r.lost?.tuntian === 1, r.lost);
  await p.close();
}

// —— 3. 天下地图 → 进入城池 → 建造（电脑布局） ——
{
  const p = await page({ ...save9, version: 10, provisions: 800, cities: {}, town: { ...save9.town, focus: {} } });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('WorldMapScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const sel = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); m.selected = { kind: 'city', city: m.cityMarkers.find(x => x.city.id === 'luoyang').city }; m.refresh(); return { action: m.action.text.text, on: !!m.action.image.input?.enabled }; });
  ck('天下地图选中我方城池：按钮是「进入城池」', sel.action === '进入城池' && sel.on, sel);
  await p.screenshot({ path: `${out}/map-enter-city.png` });
  await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').action.image.emit('pointerup'));
  await p.waitForFunction(() => window.__game.scene.isActive('TownScene'), null, { timeout: 30000 }); await p.waitForTimeout(1500);
  const ui = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'); return { blds: t.hits.map(h => h.name).filter(n => !/^bld-hq-/.test(n)).sort(), hq: t.hits.map(h => h.name).filter(n => /^bld-hq-/.test(n)).sort(), header: t.children.getByName('town-header')?.text, income: t.children.getByName('town-income')?.text, grain: t.children.getByName('town-grain')?.text }; });
  ck('进入洛阳：全景里只有府衙、屯田、募兵所（城墙箭楼不做），顶栏写档次与产出', ui.blds.join() === 'bld-muster,bld-office,bld-tuntian' && ui.header.includes('大城') && ui.income.includes('每战产出') && ui.grain === '钱币 800', ui);
  await p.screenshot({ path: `${out}/town-large-desktop.png` });
  // 营寨功能建筑分署（11-19「城市也应该有义军营寨那些功能建筑」）：招贤馆 / 讲武堂 / 军营（马厩此档已开放也画）+ 旅商；点讲武堂进营寨同一面板，关掉回城
  ck('城里画出营寨功能建筑分署与旅商（统一大本营）', ['bld-hq-academy', 'bld-hq-barracks', 'bld-hq-merchant', 'bld-hq-talent'].every(n => ui.hq.includes(n)), ui.hq);
  await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(h => h.name === 'bld-hq-academy'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').children.getByName('town-card'), null, { timeout: 60000 });
  const hqCard = await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('town-card')?.getByName('town-card-title')?.text);
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('town-card').getByName('town-card-close').emit('pointerdown'));
  await p.waitForFunction(() => window.__game.scene.isActive('TownScene') && window.__game.scene.getScene('TownScene').hits?.length, null, { timeout: 60000 }); await p.waitForTimeout(800);
  const backCity = await p.evaluate(() => window.__game.scene.getScene('TownScene').cityId);
  ck('点城里的讲武堂：打开营寨同一个讲武堂面板，返回后回到洛阳', /讲武堂/.test(hqCard ?? '') && backCity === 'luoyang', { hqCard, backCity });
  await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(h => h.name === 'bld-hq-merchant'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForFunction(() => window.__game.scene.getScene('TownScene').children.getByName('merchant-shop'), null, { timeout: 30000 });
  ck('城里的旅商打开同一个军需商人', true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // 民居与居民：纯装饰，不可点、不挡建筑（用户 2026-11-17）
  const life = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), folk = [...t.folk.walkers.filter(w => w.img.visible).map(w => w.img), ...t.folk.ambient.map(a => a.img)], houses = t.pano.list.filter(o => /^house-/.test(o.name ?? ''));
    return { folk: t.folk.count, npc: t.folk.ambient.length, houses: houses.length, folkInput: folk.some(o => o.input), houseInput: houses.some(o => o.input) }; });
  ck('洛阳（大城、府衙 1 级）：民居店铺成街区（街区规划，至少 4 座；另有营寨功能建筑分署）、走动居民 10 人 + 小景人物，都不接收点击（11-20 加密）', life.houses >= 4 && life.folk === 10 && life.npc >= 4 && !life.folkInput && !life.houseInput, life);
  // 把一个居民挪到府衙正中，用真实鼠标点那里：仍然打开府衙面板
  const spot = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(h => h.name === 'bld-office'), w = t.folk.walkers[0]; w.pause = 99; const wx = h.x, wy = h.y; w.img.setPosition(wx, wy + h.height * .3); w.img.setScale(w.img.scaleX * 3);
    const R = window.__game.canvas.getBoundingClientRect(), k = R.width / window.__game.scale.width * t.cameras.main.zoom; const z = t.pano.scaleX; return { x: R.left + (wx * z + t.pano.x) * k, y: R.top + (wy * z + t.pano.y) * k }; });
  await p.waitForTimeout(100); await p.mouse.click(spot.x, spot.y); await p.waitForTimeout(400);
  const blocked = await p.evaluate(() => { const c = window.__game.scene.getScene('TownScene').children.getByName('town-build-card'); const title = c?.getByName('town-build-card-title')?.text; c?.destroy(); return title; });
  ck('居民挡在府衙上时，点击仍然打开府衙面板（居民不挡建筑）', blocked === '府衙 · Lv1', blocked);
  await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'); t.folk.walkers[0].pause = 0; t.folk.walkers[0].img.setScale(t.folk.walkers[0].img.scaleX / 3); });
  await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(h => h.name === 'bld-tuntian'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForTimeout(300);
  const card = await p.evaluate(() => { const c = window.__game.scene.getScene('TownScene').children.getByName('town-build-card'); return { title: c?.getByName('town-build-card-title')?.text, cost: c?.getByName('town-build-cost')?.text }; });
  await p.screenshot({ path: `${out}/town-card-desktop.png` });
  await p.evaluate(() => window.__game.scene.getScene('TownScene').children.getByName('town-build-card').getByName('town-build-upgrade').emit('pointerdown'));
  await p.waitForTimeout(500);
  const after = await store(p, w => ({ lv: w.cityLevels('luoyang'), grain: w.loadWorld().provisions }));
  ck('点屯田 → 面板（未建，钱币 160）→ 建造：屯田 1 级、扣 160', card.title === '屯田 · 未建' && card.cost === '花费：钱币 160' && after.lv.tuntian === 1 && after.grain === 640, { card, after });
  await p.screenshot({ path: `${out}/town-after-build-desktop.png` });
  const before = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'); return { h: t.pano.list.filter(o => /^house-/.test(o.name ?? '')).length, f: t.folk.count }; });
  await store(p, w => { const s = w.loadWorld(); s.provisions += 2000; localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1'); });
  await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(h => h.name === 'bld-office'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__game.scene.getScene('TownScene').children.getByName('town-build-card').getByName('town-build-upgrade').emit('pointerdown'));
  await p.waitForTimeout(600);
  const grown = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'); return { h: t.pano.list.filter(o => /^house-/.test(o.name ?? '')).length, f: t.folk.count }; });
  ck('府衙升到 2 级：民居、居民都变多（大城民居变多、10→12 人）', before.h >= 4 && before.f === 10 && grown.h > before.h && grown.f === 12, { before, grown });
  await p.screenshot({ path: `${out}/town-large-life-desktop.png` });
  // 中城、小城各看一眼
  for (const id of ['xuchang', 'guandu']) {
    await p.evaluate(id => window.__game.scene.getScene('TownScene').scene.start('TownScene', { city: id }), id);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/town-${id}-desktop.png` });
  }
  await p.evaluate(() => window.__game.scene.getScene('TownScene').children.getByName('town-back').emit('pointerdown'));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 30000 }); await p.waitForTimeout(800);
  const back = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); return m.selected.kind === 'city' ? m.selected.city.id : m.selected.kind; });
  ck('「返回天下地图」回到地图并选中刚才的城', back === 'guandu', back);
  await p.close();
}

console.log(errors.length ? 'ERRORS\n' + errors.slice(0, 10).join('\n') : 'no page errors');
ck('无页面错误', !errors.length, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
