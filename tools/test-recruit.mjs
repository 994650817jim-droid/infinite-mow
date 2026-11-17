// 招贤馆（人才库）与随行武将：存档迁移、刷新与保底、招募 / 招降、随行上限、选将锁定、战斗内贴身跟随。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-recruit.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const world = (o = {}) => ({ version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 5000, provisions: 100000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'], ownedCities: ['xuchang', 'runan', 'guandu'], eraSeen: 2, capturedEver: ['xuchang', 'runan', 'guandu'], alerts: [], lastLost: [], chapterSeen: 4, ...o });
// 老存档：关羽穿过一件兵装（应随迁移保留）
const items = { version: 1, bag: [{ uid: 't1', base: 'blade_ring', quality: 'white', affixes: [] }], loadouts: { guanyu: { weapon: 't1' } }, salvaged: 0 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const page = async (layout = 'mobile', query = '', extra = {}) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(([sv, it, ex]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_items_v1', JSON.stringify(it)); localStorage.setItem('im_last_hero', 'zhaoyun'); for (const [k, v] of Object.entries(ex)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [world(), items, extra]);
  await p.goto(base + '?layout=' + layout + query);
  await p.waitForFunction(() => window.__game?.scene.getScenes(true).length, null, { timeout: 90000 });
  return p;
};
const R = (p, fn, arg) => p.evaluate(async ([src, a]) => { const r = await import('/src/systems/RosterStore.ts'); const w = await import('/src/world/WorldStore.ts'); return (0, eval)(src)(r, w, a); }, [fn.toString(), arg]);

// —— 0. 主公（用户规则 2026-11-16：每个存档开局选定主公，之后不能更换；测试入口不限制）——
{
  // 新存档：没有任何进度，开局择主公（确认出战要点两次），定下后其他武将不能出战、主页入口锁住
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('lord-new ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('lord-new console ' + m.text()); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') && window.__game.scene.getScene('MenuScene').heroPicker, null, { timeout: 90000 }); await p.waitForTimeout(600);
  const n = await p.evaluate(async () => {
    const R = await import('/src/systems/RosterStore.ts'), M = window.__game.scene.getScene('MenuScene'), o = {};
    o.lord0 = R.lordHero(); o.notice = !!M.children.getByName('lord-notice'); o.anyOk = R.heroOwned('diaochan');
    const pk = M.heroPicker; pk.open(4); const ok = pk.root.getByName('hero-confirm');
    ok.emit('pointerdown'); o.afterOne = R.lordHero(); o.hint = pk.root.getByName('hero-locked-hint').text;
    ok.emit('pointerdown'); o.lord = R.lordHero(); o.final = R.lordFinal();
    o.others = ['zhaoyun', 'guanyu', 'diaochan'].map(h => R.heroOwned(h)); o.change = R.setLord('zhaoyun').ok; o.still = R.lordHero();
    o.entry = M.children.list.some(x => x.text === '主公 · 张飞'); o.locked = !!M.children.getByName('choose-hero').getData('locked');
    return o;
  });
  ck('新存档：开局没有主公、谁都能选，不弹老存档提示', n.lord0 === null && n.anyOk && !n.notice, n);
  ck('择主公要点两次确认，提示「主公选定后本存档不可更改」', n.afterOne === null && /不可更改/.test(n.hint) && n.lord === 'zhangfei' && n.final, n);
  ck('主公定下后：其他武将不能出战、不能改选，主页入口显示「主公 · 张飞」并锁住', n.others.every(x => !x) && !n.change && n.still === 'zhangfei' && n.entry && n.locked, n);
  await p.screenshot({ path: `${out}/lord-locked-desktop.png` });
  await p.close();
}
{
  // 老存档（有进度、没主公）：按最近出战的武将自动定主公，进主页弹一次提示；「就用」保持，「改选」可换一次
  const p = await page('desktop');
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene') && window.__game.scene.getScene('MenuScene').heroPicker, null, { timeout: 90000 }); await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/lord-notice-desktop.png` });
  const k = await p.evaluate(async () => {
    const R = await import('/src/systems/RosterStore.ts'), M = window.__game.scene.getScene('MenuScene'), o = {};
    o.lord = R.lordHero(); o.final0 = R.lordFinal(); const nt = M.children.getByName('lord-notice'); o.notice = !!nt;
    o.entry0 = M.children.list.some(x => x.text === '改选主公');
    nt.getByName('lord-repick').emit('pointerdown'); o.pickerOpen = M.heroPicker.root.visible;
    const pk = M.heroPicker; pk.open(1); const ok = pk.root.getByName('hero-confirm'); ok.emit('pointerdown'); ok.emit('pointerdown');
    o.lord2 = R.lordHero(); o.final2 = R.lordFinal(); o.again = R.setLord('zhaoyun').ok;
    return o;
  });
  ck('老存档：自动以最近出战的赵云为主公，弹一次提示，入口显示「改选主公」', k.lord === 'zhaoyun' && !k.final0 && k.notice && k.entry0, k);
  ck('老存档改选一次（关羽）后锁定，不能再改', k.pickerOpen && k.lord2 === 'guanyu' && k.final2 && !k.again, k);
  const kp = await page('desktop', '', {});
  await kp.waitForFunction(() => window.__game.scene.isActive('MenuScene') && window.__game.scene.getScene('MenuScene').heroPicker, null, { timeout: 90000 }); await kp.waitForTimeout(400);
  const keep = await kp.evaluate(async () => { const R = await import('/src/systems/RosterStore.ts'), M = window.__game.scene.getScene('MenuScene'); M.children.getByName('lord-notice').getByName('lord-keep').emit('pointerdown'); return { lord: R.lordHero(), final: R.lordFinal(), entry: M.children.list.some(x => x.text === '主公 · 赵云') }; });
  ck('老存档选「就用赵云」：主公锁定为赵云', keep.lord === 'zhaoyun' && keep.final && keep.entry, keep);
  await kp.close();
  // 测试入口不受限制
  const d = await page('desktop', '&dev=1');
  await d.waitForFunction(() => window.__game?.scene.getScenes(true).length, null, { timeout: 90000 }); await d.waitForTimeout(800);
  const dv = await d.evaluate(async () => { const R = await import('/src/systems/RosterStore.ts'); return { rules: R.lordRules(), zf: R.heroOwned('zhangfei'), dc: R.heroOwned('diaochan') }; });
  ck('开发测试（?dev=1）不受主公限制', !dv.rules && dv.zf && dv.dc, dv);
  await d.close(); await p.close();
}

// —— 1. 存档：老档迁移、天下首开只送主公、选将锁定 ——
{
  const p = await page('mobile', '', { im_achievements: JSON.stringify({ unlocked: {}, counters: {}, heroes: ['huangzhong', 'zhaoyun'] }) });
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const r = await R(p, (r) => { const s = r.loadRoster(); return { lord: s.lord, owned: s.owned.map(x => x.hero).filter(Boolean), zf: r.heroOwned('zhangfei'), def: r.defaultHero('zhangfei'), offers: s.offers.length, enforced: r.rosterEnforced(), raw: !!localStorage.getItem('im_roster_v1') }; });
  ck('老存档迁移：主公赵云 + 穿过兵装的关羽 + 打赢过仗的黄忠', r.lord === 'zhaoyun' && r.owned.join() === 'zhaoyun,guanyu,huangzhong', r);
  ck('未招募的张飞不可出战，默认回主公', !r.zf && r.def === 'zhaoyun' && r.enforced, r);
  ck('招贤馆 1 级 3 个席位，已写入 im_roster_v1', r.offers === 3 && r.raw, r);
  const f = await R(p, (r) => { localStorage.removeItem('im_roster_v1'); localStorage.setItem('im_last_hero', 'machao'); r.rosterFreshUnlock(); const owned = r.ownedHeroes(); r.rosterFreshUnlock(); return { owned, again: r.ownedHeroes() }; });
  ck('天下首开只送主公一人（马超），重复调用不覆盖', f.owned.join() === 'machao' && f.again.join() === 'machao', f);
  const slots = await p.evaluate(async () => (await import('/src/systems/SaveSlots.ts')).PROGRESS_KEYS.includes('im_roster_v1'));
  ck('人才库随存档位切换（PROGRESS_KEYS）', slots);
  // 选将：第三章选将面板锁定未拥有的武将
  await p.evaluate(() => { localStorage.setItem('im_last_hero', 'zhangfei'); const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('ThirdChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('ThirdChapterScene'), null, { timeout: 120000 }); await p.waitForTimeout(600);
  const t = await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdChapterScene'); const before = s.hero; const zf = s.children.getByName('third-hero-zhangfei'); zf.emit('pointerdown'); zf.emit('pointerup'); return { before, after: s.hero, locked: zf.getData('locked'), alpha: zf.alpha, mc: s.children.getByName('third-hero-machao').getData('locked') }; });
  ck('第三章选将：张飞锁定（灰显、点了不换），默认主公马超', t.before === 'machao' && t.after === 'machao' && t.locked && t.alpha < .5 && !t.mc, t);
  await p.close();
}

// —— 2. 招贤馆规则：刷新费用、保底、招募扣粮、招降、随行上限、将阶 ——
{
  const p = await page('mobile');
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const r = await R(p, (r, w) => {
    const o = {}; r.setRosterRandom(() => .99); // 全部出大众脸（不出名将）
    const p0 = w.loadWorld().provisions; r.loadRoster();
    o.c1 = r.refreshCost(); r.manualRefresh(); o.c2 = r.refreshCost(); o.spent = p0 - w.loadWorld().provisions;
    // 保底：已刷 2 次（含开局 1 次自动）；继续刷到出现可玩名将
    let n = 0; while (n < 12 && !r.loadRoster().offers.some(x => x.kind === 'hero')) { r.manualRefresh(); n++; }
    o.pityAt = n; o.dry = r.loadRoster().dry;
    const s = r.loadRoster(), hi = s.offers.findIndex(x => x.kind === 'hero'), hero = s.offers[hi]?.hero, before = w.loadWorld().provisions;
    o.rec = r.recruit(hi); o.heroOwned = r.heroOwned(hero); o.cost = before - w.loadWorld().provisions;
    o.followers = r.loadRoster().followers;
    // 招降：随机 0 → 必俘
    r.setRosterRandom(() => 0); o.cap = r.tryCapture('bounty', '张郃', 'yuanshao'); o.capAgain = r.tryCapture('bounty', '张郃', 'yuanshao');
    const b2 = w.loadWorld().provisions; o.capRec = r.recruit(0, true); o.capCost = b2 - w.loadWorld().provisions;
    // 随行上限 1：第二人加不进；升招贤馆后可以
    const zh = r.loadRoster().owned.find(x => x.name === '张郃');
    o.full = r.toggleFollower(zh.id); w.addTownMoney(1000); o.hall = r.upgradeHall(); o.add = r.toggleFollower(zh.id); o.cap2 = r.followerCap();
    o.rank = r.rankUp(zh.id, 'weapon'); o.bonus = r.rankBonus(r.loadRoster().owned.find(x => x.id === zh.id));
    o.lordDismiss = r.dismiss('zhaoyun');
    o.zhId = zh.id;
    r.setRosterRandom(); return o;
  });
  ck('手动刷新：第一次 30 军粮，之后 60', r.c1 === 30 && r.c2 === 60 && r.spent === 30, r);
  ck('保底：连续未出名将第 7 次刷新必出', r.pityAt <= 6 && r.dry === 0, { pityAt: r.pityAt, dry: r.dry });
  ck('招募可玩名将扣 900 军粮，只能随行、不能当主将出战（主公规则）', r.rec.ok && !r.heroOwned && r.cost === 900 && r.followers.length === 1, r);
  ck('击败敌将俘获进降将栏，不重复', r.cap === '张郃' && r.capAgain === null, r);
  ck('招降六折（300 军粮）', r.capRec.ok && r.capCost === 300, r);
  ck('随行上限 1；升级招贤馆后可带 2 人', !r.full.ok && r.hall.ok && r.add.ok && r.cap2 === 2, r);
  // 随行装备：招来的 r_ 武将可以穿戴，存档校验接受 r_ 键、丢掉非法键；行囊只列麾下；遣散时卸回行囊
  const g = await p.evaluate(async id => {
    // 故意用另一个模块实例（带查询参数），模拟常开 dev server 热更新后 RosterStore 与测试各持一份行囊缓存的情况
    const I = await import('/src/systems/ItemStore.ts?inst=test'), R = await import('/src/systems/RosterStore.ts'), o = {};
    I.addItems([{ uid: 'g1', base: 'lamellar', quality: 'blue', affixes: [{ id: 'damage', value: .05 }] }]);
    o.equip = I.equipItem(id, 'g1'); o.worn = Object.keys(I.loadout(id));
    const raw = JSON.parse(localStorage.getItem('im_items_v2')); raw.loadouts.hacker = { armor: 'g1' }; raw.loadouts.r_x = { armor: 'g1' }; localStorage.setItem('im_items_v2', JSON.stringify(raw)); I.resetItemCache();
    const s = I.loadItems(); o.keys = Object.keys(s.loadouts).sort(); o.kept = I.equippedBy(s, 'g1');
    o.horse = I.rideHorse(id, null); o.owners = R.gearOwners().map(x => x.id); o.name = R.ownerName(id);
    // 常开的 dev server 热更新过 ItemStore 时，测试导入的模块和 RosterStore 引用的可能是两个实例（各有内存缓存）：清缓存后从存档读
    o.dismiss = R.dismiss(id); I.resetItemCache(); o.after = I.equippedBy(I.loadItems(), 'g1') ?? null; o.inBag = I.loadItems().bag.some(i => i.uid === 'g1');
    return o;
  }, r.zhId);
  ck('招来的武将能穿兵装，存档只认可玩武将与 r_ 编号', g.equip && g.worn.join() === 'armor' && g.kept === r.zhId && !g.keys.includes('hacker') && !g.keys.includes('r_x'), g);
  ck('招来的武将不能骑马；行囊武将列表 = 麾下（含招来的人）', g.horse === false && g.owners.includes(r.zhId) && g.owners.includes('zhaoyun') && g.owners.length < 12 && g.name === '张郃', g);
  ck('遣散时兵装卸回行囊', g.dismiss.ok && g.after === null && g.inBag, g);
  // 招贤馆是营寨建筑时（主城会话 e960199 起）：等级与 WorldStore.talentLevel() 一致，升级转调营寨 townUpgrade('talent')，只有一套等级
  const h = await p.evaluate(async () => {
    // 不往建筑表里注入东西（常开 dev server 热更新后，测试与 RosterStore 拿到的可能是不同模块实例）；营寨与世界存档故意用另一个实例导入，只经 localStorage 交互
    const T = await import('/src/town/TownData.ts?inst=test'), R = await import('/src/systems/RosterStore.ts'), W = await import('/src/world/WorldStore.ts?inst=test'), o = {};
    o.inTown = 'talent' in T.TOWN_BUILDINGS; if (!o.inTown) return o;
    o.lv = R.hallLevel(); o.tl = W.talentLevel(); const p0 = W.loadWorld().provisions;
    o.up = R.upgradeHall(); o.cost = p0 - W.loadWorld().provisions; o.lv2 = R.hallLevel(); o.tl2 = W.talentLevel(); o.cap = R.followerCap(); o.rank = R.rankCap();
    o.max = R.upgradeHall(); return o;
  });
  if (h.inTown) ck('招贤馆是营寨建筑：等级与营寨一致，升 3 级扣 1800 军粮，随行 3 人，满级不能再升', h.lv === 2 && h.tl === 2 && h.up.ok && h.cost === 1800 && h.lv2 === 3 && h.tl2 === 3 && h.cap === 3 && h.rank === 10 && !h.max.ok, h);
  else ck('招贤馆尚未进营寨：沿用招募存档里的等级', !h.inTown, h);
  ck('将阶：兵器线 +6% 伤害；主公不能遣散', r.rank.ok && Math.abs(r.bonus.damage - .06) < 1e-9 && !r.lordDismiss.ok, r);
  await p.close();
}

// —— 3. 招贤馆界面（手机 / 电脑截图）——
for (const layout of ['mobile', 'desktop']) {
  const p = await page(layout);
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await R(p, (r) => { r.setRosterRandom(() => 0); r.tryCapture('bounty', '许褚', 'caocao'); r.setRosterRandom(); });
  await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const hasBtn = await p.evaluate(() => !!window.__game.scene.getScene('CityScene').children.getByName('city-talent'));
  ck(`${layout} 主城有「招贤馆」入口`, hasBtn);
  await p.screenshot({ path: `${out}/city-${layout}.png` });
  await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('city-talent').emit('pointerdown'));
  await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 30000 }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/hall-offers-${layout}.png` });
  const u = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container'); const names = c.list.map(x => x.name).filter(Boolean); const btn = c.getByName('talent-offer-0'); btn.emit('pointerup'); return { names }; });
  await p.waitForTimeout(200);
  const msg = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container'); return c.getByName('talent-message')?.text; });
  ck(`${layout} 人才页：席位、降将、刷新按钮；点招募有提示`, u.names.includes('talent-offer-0') && u.names.includes('talent-captive-0') && u.names.includes('talent-face') && u.names.includes('talent-refresh') && /应募|不足|已满/.test(msg ?? ''), { names: u.names.slice(0, 12), msg });
  await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container'); c.getByName('talent-tab-roster').emit('pointerup'); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/hall-roster-${layout}.png` });
  const rn = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'), c = s.children.list.find(x => x.type === 'Container'); return c.list.filter(x => x.name === 'talent-roster-name').map(x => x.text); });
  ck(`${layout} 麾下页列出主公与已招武将`, rn.some(t => t.includes('赵云') && t.includes('主公')) && rn.length >= 2, rn);
  await p.close();
}

// —— 4. 战斗：随行贴身跟随、出手、瞬移、倒下休整 ——
{
  const roster = { version: 1, lord: 'zhaoyun', owned: [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun', name: '赵云', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'zhangfei', kind: 'hero', hero: 'zhangfei', name: '张飞', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'r_1', kind: 'common', name: '王勇', template: 'bow', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'named', name: '张郃', template: 'strategist', quality: 'purple', rank: 1, picks: [] }], followers: ['zhangfei', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
  // 武将等级（HeroProgress）：张飞 Lv.5 加过武力 2、体魄 1；王勇（r_1）Lv.11；张郃（r_2）没有记录，用起始等级
  const zero = { might: 0, quickness: 0, critical: 0, constitution: 0, agility: 0 };
  const heroes = { version: 1, migrated: true, heroes: { zhangfei: { level: 5, xp: 0, attributes: { ...zero, might: 2, constitution: 1 } }, r_1: { level: 11, xp: 0, attributes: zero } } };
  const p = await page('mobile', '&dev=1&autostart=1&stage=1&followers=1', { im_roster_v1: JSON.stringify(roster), im_heroes_v1: JSON.stringify(heroes) });
  const G = "window.__game.scene.getScene('GameScene')";
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const a = await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; const f = s.followers; return { n: f?.members.length, names: f?.members.map(m => m.recruit.name), sheets: f?.members.map(m => m.sheet), dmg: f?.members.map(m => +m.damage.toFixed(2)), hp: f?.members.map(m => m.maxHp), lv: f?.members.map(m => m.level) }; }, G);
  // 期望值：张飞 枪 16 × 橙 1.6 × 伤害倍率 1.2 × (1 + 5%×2) = 33.79，生命 220 × 1.6 × 1.1 × (1 + 10%×1) = 426；
  // 王勇 弓 18 × 绿 1.15 × (1 + 3%×10) = 26.91，生命 160 × 1.15 × (1 + 4%×10) = 258
  ck('随行按武将等级成长：可玩名将用自己的属性点，招来的人按等级', a.dmg?.[0] === 33.79 && a.hp?.[0] === 426 && a.dmg?.[1] === 26.91 && a.hp?.[1] === 258 && a.lv?.[1] === 11, a);
  ck('三名随行进入战斗（张飞用自己的行走图，大众脸用兵种图）', a.n === 3 && a.sheets[0] === 'zhangfei_walk_sheet' && a.sheets[1] === 'shu_archer_walk_sheet', a);
  // 敌人围上来：随行出手
  await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (let i = 0; i < 24; i++) { const ang = i / 24 * Math.PI * 2; s.spawnEnemy('infantry', pl.x + Math.cos(ang) * 170, pl.y + Math.sin(ang) * 170, 3); } }, G);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${out}/battle-followers.png` });
  const h = await p.evaluate(G0 => { const s = eval(G0); return { ...s.followers.stats, perHit: s.followers.members.map(m => m.hits) }; }, G);
  ck('随行自动打主将附近的敌人（三人都有出手）', h.hits > 5 && h.perHit.every(x => x > 0), h);
  ck('随行不离主将超过 260 像素（瞬移除外）', h.maxDist <= 262 || h.teleports > 0, h);
  // 主将瞬间远离：随行瞬移回身边
  const t = await p.evaluate(async G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; const before = s.followers.stats.teleports; s.player.sprite.setPosition(s.player.x + 700, s.player.y); await new Promise(r => setTimeout(r, 800)); return { tp: s.followers.stats.teleports - before, d: s.followers.members.map(m => Math.round(Math.hypot(m.x - s.player.x, m.y - s.player.y))) }; }, G);
  ck('主将远离 480 像素以上时随行瞬移回来', t.tp >= 3 && t.d.every(d => d < 200), t);
  // 倒下休整 20 秒
  const d = await p.evaluate(G0 => { const s = eval(G0), f = s.followers, m = f.members[1]; f.hurt(m, 1e6, s.combatNow); return { resting: m.resting, vis: m.sprite.visible, left: Math.round((m.restUntil - s.combatNow) / 1000) }; }, G);
  ck('随行被打倒：撤下休整 20 秒，不会本局阵亡', d.resting && !d.vis && d.left === 20, d);
  const back = await p.evaluate(async G0 => { const s = eval(G0), m = s.followers.members[1]; m.restUntil = s.combatNow + 50; await new Promise(r => setTimeout(r, 500)); return { resting: m.resting, vis: m.sprite.visible, hp: m.hp === m.maxHp }; }, G);
  ck('休整结束满血归队', !back.resting && back.vis && back.hp, back);
  await p.close();
}

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
