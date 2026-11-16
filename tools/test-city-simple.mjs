// 营寨简化（统一军粮 / 分阶段开放 / 讲武堂科技 / 马厩接口 / 第一章后营寨指引）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5190/ node tools/test-city-simple.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/city-simplify';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const page = async (save, layout = 'mobile', extra = {}) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(([sv, ex]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (sv) localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); for (const [k, v] of Object.entries(ex)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [save, extra]);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  return p;
};
const store = (p, fn, arg) => p.evaluate(async ([src, arg]) => { const w = await import('/src/world/WorldStore.ts'); const t = await import('/src/town/TownData.ts'); return (0, eval)(src)(w, t, arg); }, [fn.toString(), arg]);
const base8 = { version: 8, yellowStages: 3, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };

// —— 1. v8 → v9 存档迁移 ——
{
  const old = { ...base8, merits: 100, provisions: 200, cleared: { huangjin: true, hulao: true }, dongzhuoStages: 3, ownedCities: ['xuchang', 'runan'], capturedEver: ['xuchang', 'runan'],
    town: { money: 50, year: 186, season: 2, tax: 'high', pendingEvent: 'drought', caravans: [{ to: 'xuchang', cargo: 30, value: 20 }], focus: { xuchang: 'trade', runan: 'farm' }, report: null, mods: {}, boon: { damage: .1 },
      levels: { hall: 2, barracks: 2, farm: 3, clinic: 3, house: 2, market: 1, post: 1, smithy: 3, drill: 1, granary: 1, wall: 2, tavern: 1, pavilion: 0 } } };
  const p = await page(old);
  const r = await store(p, w => { const s = w.loadWorld(); w.saveWorld(); const raw = JSON.parse(localStorage.getItem('im_world_v1')), bak = JSON.parse(localStorage.getItem('im_world_backup_v1')); return { s, rawVersion: raw.version, bakVersion: bak?.version }; });
  const s = r.s, t = s.town, refund = 126 + 120 + 200 + 175, expect = 200 + 100 * 2 + Math.round(70 * 1.5) + refund; // 2026-11-16 平衡：军功 → 军粮 ×2（原 ×1.5），退还里的军功部分同步变
  ck('迁移：军功、钱（含在途商队）折成军粮，民居 / 市集 / 驿站 / 酒肆按原价全额退还', s.provisions === expect && s.merits === 0, { got: s.provisions, expect });
  ck('迁移：旧加成建筑点亮科技（医术、磨砺、百炼、坚甲、操练）', ['medicine', 'forge', 'forge2', 'armor', 'drill_points'].every(id => t.tech.includes(id)) && t.tech.length === 5, t.tech);
  ck('迁移：讲武堂等级不高于主帐，保留主帐 / 军营 / 农田 / 粮仓', t.levels.academy === 2 && t.levels.hall === 2 && t.levels.barracks === 2 && t.levels.farm === 3 && t.levels.granary === 1 && t.levels.stable === 0, t.levels);
  ck('迁移：删掉的建筑与税 / 事件 / 钱字段不再存在', !('house' in t.levels) && !('money' in t) && !('tax' in t) && !('pendingEvent' in t) && !('caravans' in t), Object.keys(t));
  ck('迁移：“重商”改回均衡，“重农”保留；季度计数保留', !t.focus.xuchang && t.focus.runan === 'farm' && t.year === 186 && t.season === 2, { focus: t.focus, y: t.year, s: t.season });
  ck('迁移：写盘为 v9，旧档留在备份', r.rawVersion === 9 && r.bakVersion === 8, r);
  const again = await store(p, w => w.loadWorld().provisions);
  ck('迁移：再次读档不重复折算', again === expect, again);
  await p.close();
}

// —— 2. 新存档：营寨阶段、建造 / 扩建前提、科技 ——
{
  const p = await page({ ...base8, provisions: 3000 });
  const r = await store(p, (w, t) => {
    const o = {}; let s = w.loadWorld(); o.start = { ...s.town.levels };
    o.open = Object.fromEntries(Object.keys(t.TOWN_BUILDINGS).map(id => [id, t.buildingOpen(s.town, id)]));
    o.stable = w.townUpgrade('stable'); o.hallBlocked = w.townUpgrade('hall');
    o.potionNoAcademy = w.researchTech('potion');
    o.academy = w.townUpgrade('academy'); o.potion = w.researchTech('potion'); o.potionAgain = w.researchTech('potion');
    o.rangedNeeds = w.researchTech('drill_ranged'); o.tier2 = w.researchTech('medicine');
    o.melee = w.researchTech('drill_melee'); o.forge = w.researchTech('forge');
    s = w.loadWorld(); o.after = { grain: s.provisions, tech: s.town.tech };
    o.eff = w.permanentEffects();
    // 第二章通关后可扩建县城，开放马厩
    const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.cleared.hulao = true; raw.dongzhuoStages = 3; localStorage.setItem('im_world_v1', JSON.stringify(raw)); localStorage.removeItem('im_world_backup_v1');
    o.hall = w.townUpgrade('hall'); o.stable2 = w.townUpgrade('stable'); o.cap = w.stableCapacity(); o.lvl = w.stableLevel();
    o.focusLocked = w.setCityFocus('xuchang', 'farm');
    return o;
  });
  ck('新档：营寨起步 主帐 / 军营 / 农田 Lv1，其余未建', r.start.hall === 1 && r.start.barracks === 1 && r.start.farm === 1 && !r.start.academy && !r.start.stable, r.start);
  ck('营寨阶段只开放主帐、军营、农田、讲武堂、招贤馆', r.open.hall && r.open.barracks && r.open.farm && r.open.academy && r.open.talent && !r.open.stable && !r.open.granary && !r.open.pavilion, r.open);
  ck('马厩需县城；主帐扩建需第二章通关', !r.stable.ok && r.stable.message.includes('县城') && !r.hallBlocked.ok && r.hallBlocked.message.includes('第二章'), [r.stable, r.hallBlocked]);
  ck('讲武堂未建不能研究；建成后研究回血药扣军粮；不能重复研究', !r.potionNoAcademy.ok && r.academy.ok && r.potion.ok && !r.potionAgain.ok, [r.potionNoAcademy, r.potion, r.potionAgain]);
  ck('前置与层数限制（弓弩操练需刀枪操练；第二层需讲武堂 Lv2）', !r.rangedNeeds.ok && !r.tier2.ok && r.tier2.message.includes('Lv2'), [r.rangedNeeds, r.tier2]);
  ck('花费正确：讲武堂 150 + 回血药 150 + 刀枪 150 + 磨砺 150', r.after.grain === 3000 - 150 - 150 - 150 - 150 && r.melee.ok && r.forge.ok, r.after);
  ck('出征效果：回血药 2 份 30%、刀盾 / 长枪开局 Lv2、伤害 +4%', r.eff.potions?.count === 2 && r.eff.potions.ratio === .3 && r.eff.troopLevels.swordsman === 2 && r.eff.troopLevels.spearman === 2 && Math.abs(r.eff.damageBonus - .04) < 1e-9, r.eff);
  ck('第二章后扩建县城、建马厩（接口：等级 1、可养 2 匹）', r.hall.ok && r.stable2.ok && r.lvl === 1 && r.cap === 2, [r.hall, r.stable2, r.cap]);
  ck('城池发展在州府前不开放', !r.focusLocked.ok && r.focusLocked.message.includes('州府'), r.focusLocked);
  await p.close();
}

// —— 2b. 招贤馆建筑：从招募存档读入旧等级；升级花军粮、不受主帐等级限制 ——
{
  const p = await page({ ...base8, provisions: 5000 }, 'mobile', { im_roster_v1: JSON.stringify({ version: 1, hall: 2 }) });
  const r = await store(p, (w, t) => { const o = { lv0: w.talentLevel() }; w.saveWorld(); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, hall: 1 })); o.lv1 = w.talentLevel(); o.up = w.townUpgrade('talent'); o.lv2 = w.talentLevel(); o.max = w.townUpgrade('talent'); o.cost = t.nextCost(w.loadWorld().town, 'talent'); o.grain = w.loadWorld().provisions; return o; });
  ck('招贤馆：读入旧招募存档的 2 级，写盘后不再重读', r.lv0 === 2 && r.lv1 === 2, r);
  ck('招贤馆：营寨（主帐 Lv1）也能升到 3 级，花军粮 1800（招募会话的价目）', r.up.ok && r.lv2 === 3 && !r.max.ok && r.cost === null && r.grain === 5000 - 1800, r);
  await p.close();
}

// —— 2c. 军营练兵：价格 80+40n、上限随已开放章节、乘法叠加 ——
{
  const p = await page({ ...base8, provisions: 5000 });
  const r = await store(p, (w, t) => { const o = { d0: w.drillInfo() }; const ups = []; for (let i = 0; i < 20; i++) { const x = w.trainTroops(); if (!x.ok) { o.stop = x.message; break; } ups.push(x.ok); } o.n = ups.length; o.d1 = w.drillInfo(); o.grain = w.loadWorld().provisions; o.eff = w.permanentEffects().troopDrill; o.c12 = t.drillCost(12); o.cap5 = t.drillCap(5); return o; });
  const spent = Array.from({ length: r.n }, (_, i) => 80 + 40 * (i + 1)).reduce((a, b) => a + b, 0);
  ck('练兵：从 0 级起，1 级 120 军粮，12 级 560，五章全开上限 12', r.d0.level === 0 && r.d0.cost === 120 && r.c12 === 560 && r.cap5 === 12, r);
  ck('练兵：升到章节上限即停（提示开放新章节），扣费正确，倍率 1.15^n', r.n === r.d0.cap && r.n >= 2 && r.d1.level === r.n && r.stop.includes('上限') && r.grain === 5000 - spent && Math.abs(r.eff - Math.pow(1.15, r.n)) < 1e-9, { ...r, spent });
  await p.close();
}

// —— 3. 结算只给军粮；招募折扣；道具分解折军粮 ——
{
  const p = await page({ ...base8, provisions: 1000, cleared: { huangjin: true, hulao: true }, dongzhuoStages: 3, reserve: { swordsman: 4 } });
  const r = await store(p, w => {
    const o = {}; const id = w.beginExpedition('hulao', 1); const before = w.loadWorld().provisions;
    o.res = w.settleExpedition(id, { chapter: 'hulao', victory: true, bossKilled: true, elapsed: 300, kills: 500, reason: 'boss', debug: false });
    const s = w.loadWorld(); o.delta = s.provisions - before; o.merits = s.merits; o.report = s.town.report; o.line = w.cityIncomeLine(o.res);
    o.price = w.recruitCost('swordsman'); w.addTownMoney(10); o.money = w.loadWorld().provisions - s.provisions;
    return o;
  });
  ck('出征结算：只进军粮（军功恒为 0），面板一行写营寨收成', r.res.merits === 0 && r.merits === 0 && r.delta === r.res.provisions && r.res.provisions > 0 && r.line.includes('营寨 · 农田 +20') && !r.line.includes('钱'), r);
  ck('后备兵口粮按人头扣（4 人）', r.report?.upkeep === 4 && r.report.grain === 20, r.report);
  ck('招募价无折扣时为原价；道具分解 10 钱 → 15 军粮', r.price === 10 && r.money === 15, { price: r.price, money: r.money });
  await p.close();
}

// —— 4. 营寨界面：手机 / 电脑，无税率 / 商贸 / 季报；讲武堂面板研究 ——
for (const layout of ['mobile', 'desktop']) {
  const p = await page({ ...base8, provisions: 800 }, layout);
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(1200);
  const ui = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), n = x => !!c.children.getByName(x); const b = name => { const o = c.children.getByName(name); return o ? o.getBounds() : null; };
    return { nav: ['city-map', 'city-academy', 'city-focus', 'city-expedition', 'city-tax', 'city-trade', 'city-report', 'city-build'].map(n), grain: c.children.getByName('city-grain')?.text, hint: c.children.getByName('city-hint')?.text,
      blds: c.hits.map(h => h.name), recruit: b('city-recruit'), grainBox: b('city-grain'), boon: b('city-boon'), mapBtn: b('city-map') }; });
  ck(`${layout}：底栏只有 天下地图 / 讲武堂 / 出征（营寨无城池、税率、商贸、季报）`, ui.nav.join() === 'true,true,false,true,false,false,false,false', ui.nav);
  ck(`${layout}：顶部显示军粮与扩建提示`, ui.grain === '军粮 800' && ui.hint.includes('第二章'), [ui.grain, ui.hint]);
  ck(`${layout}：全景只画营寨阶段的建筑`, ui.blds.sort().join() === 'bld-academy,bld-barracks,bld-farm,bld-hall,bld-talent', ui.blds);
  const overlap = (a, c) => a && c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
  ck(`${layout}：右上招募按钮不与军粮文字相叠`, !overlap(ui.recruit, ui.grainBox), [ui.recruit, ui.grainBox]);
  await p.screenshot({ path: `${out}/city-${layout}.png` });
  // 建讲武堂 → 打开科技面板 → 研究回血药
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); const h = c.hits.find(h => h.name === 'bld-academy'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('town-card').getByName('town-upgrade').emit('pointerdown'));
  await p.waitForTimeout(600);
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('city-academy').emit('pointerdown'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/tech-${layout}.png` });
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('town-tech').getByName('tech-potion').emit('pointerdown'));
  await p.waitForTimeout(300);
  const after = await store(p, w => { const s = w.loadWorld(); return { grain: s.provisions, tech: s.town.tech, academy: s.town.levels.academy }; });
  ck(`${layout}：界面上建讲武堂并研究回血药`, after.academy === 1 && after.tech.includes('potion') && after.grain === 800 - 150 - 150, after);
  await p.close();
}

// —— 4b. 军营面板练兵（电脑布局）——
{
  const p = await page({ ...base8, provisions: 500 }, 'desktop');
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); const h = c.hits.find(h => h.name === 'bld-barracks'); h.emit('pointerdown'); h.emit('pointerup'); });
  await p.waitForTimeout(300);
  const before = await p.evaluate(() => { const card = window.__game.scene.getScene('CityScene').children.getByName('town-card'); const t = card.getByName('town-card-drill'), b = card.getByName('town-drill'), up = card.getByName('town-upgrade'); return { text: t?.text, drill: b?.getBounds(), up: up?.getBounds() }; });
  await p.screenshot({ path: `${out}/drill-card-desktop.png` });
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('town-card').getByName('town-drill').emit('pointerdown'));
  await p.waitForTimeout(400);
  const after = await store(p, w => ({ lv: w.drillInfo().level, grain: w.loadWorld().provisions }));
  const overlap = (a, c) => a && c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
  ck('军营面板：显示练兵等级，按钮不与「升级」相叠，点一下升 1 级扣 120', before.text?.startsWith('练兵 0 /') && !overlap(before.drill, before.up) && after.lv === 1 && after.grain === 380, { before, after });
  await p.close();
}

// —— 5. 第一章后：天下地图营寨提示，进营一次后消失 ——
{
  const p = await page({ ...base8, provisions: 50 });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('WorldMapScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 30000 }); await p.waitForTimeout(1500);
  const tip1 = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); let found = false; m.children.each(function walk(o) { if (o.name === 'home-intro-tip') found = true; if (o.list) o.list.forEach(walk); }); return found; });
  await p.screenshot({ path: `${out}/map-home-tip.png` });
  await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').scene.start('CityScene'));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene')); await p.waitForTimeout(600);
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('city-map').emit('pointerdown'));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(1200);
  const tip2 = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); let found = false; m.children.each(function walk(o) { if (o.name === 'home-intro-tip') found = true; if (o.list) o.list.forEach(walk); }); return found; });
  ck('第一章后地图上营寨有“你的营寨”提示；进营再出来提示消失（营寨⇄地图来回）', tip1 && !tip2, { tip1, tip2 });
  await p.close();
}

// —— 6. 战斗开局：回血药进药囊、刀盾 / 长枪开局 Lv2 ——
{
  const save = { ...base8, version: 9, provisions: 100, town: { year: 185, season: 1, levels: { hall: 1, barracks: 2, farm: 1, academy: 1, stable: 0, granary: 0, pavilion: 0 }, focus: {}, report: null, tech: ['potion', 'drill_melee'], drill: 2 } };
  const p = await page(save);
  await p.evaluate(async () => { const { getCharacter } = await import('/src/data/characters.ts'); const m = window.__game.scene.getScene('MenuScene'); m.registry.set('worldCampaign', true); m.registry.remove('campaignTransfer'); m.registry.set('runConfig', { chapter: 'huangjin', stage: 1, character: 'zhaoyun', weapon: getCharacter('zhaoyun').startWeapon }); m.scene.start('GameScene'); });
  await p.waitForFunction(() => { const g = window.__game.scene.getScene('GameScene'); return window.__game.scene.isActive('GameScene') && g.player && g.legion; }, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const g = window.__game.scene.getScene('GameScene'); return { pouch: g.supplies?.pouch.map(x => x.amount), maxHp: g.player.maxHp, lv: { ...g.legion.levels }, units: g.legion.units.filter(u => u.active).map(u => [u.kind, u.level, u.maxHp]), drill: g.legion.drillMultiplier }; });
  ck('开局药囊 2 份回血药（每份 30% 生命）', r.pouch?.length === 2 && r.pouch.every(a => a === Math.round(r.maxHp * .3)), r);
  ck('刀盾 / 长枪开局 Lv2，军营增援兵按 Lv2 入列', r.lv.swordsman === 2 && r.lv.spearman === 2 && r.lv.archer === 1 && r.units.length >= 1 && r.units.every(([k, l]) => !['swordsman', 'spearman'].includes(k) || l === 2), r);
  ck('练兵 2 级：部曲倍率 1.3225，刀盾兵生命 = 85 × 1.3（Lv2）× 1.3225', Math.abs(r.drill - 1.3225) < 1e-9 && r.units.filter(([k]) => k === 'swordsman').every(([, , hp]) => hp === Math.round(85 * 1.3 * 1.3225)), r);
  await p.screenshot({ path: `${out}/battle-potions.png` });
  await p.close();
}

console.log(errors.length ? 'ERRORS\n' + errors.slice(0, 10).join('\n') : 'no page errors');
ck('无页面错误', !errors.length, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
