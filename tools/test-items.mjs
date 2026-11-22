// 加点节奏（每 2 级 1 点）与兵装道具：掉落 / 拾取 / 宝箱 / 首领、结算入行囊（败退一半、测试不入）、
// 2026-11-17：开发模式（?dev=1）用独立的测试存档、正式模式有主公锁定；主页也用 ?dev=1，和战斗读写同一份测试存档。
// 穿戴后加成生效、行囊面板（主页与暂停）、行营兵装货架。手机 390×844 与电脑 1280×720 各截图。
// 需要开发服务器 5173。用法：node tools/test-items.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/items';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')", M = "window.__game.scene.getScene('MenuScene')";
// 在场景里按名字递归找对象（容器嵌套）
const FIND = `window.__find=(root,name)=>{const list=root.list??root.getChildren?.()??[];for(const o of list){if(o.name===name)return o;if(o.list){const r=window.__find(o,name);if(r)return r;}}return null;};
window.__tap=o=>{o.emit('pointerdown');o.emit('pointerup');};
window.__mod=async part=>import(performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes(part))??('/src/'+part.replace(/^\\/?(src\\/)?/,'')));`;

async function page(layout, viewport) {
  const p = await b.newPage({ viewport, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(FIND);
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {}, autoSalvageWhite: false })); sessionStorage.setItem('seeded', '1'); } });
  return p;
}
const battle = async (p, layout) => {
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 30000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(400);
};

// ———————————— 手机 ————————————
const p = await page('mobile', { width: 390, height: 844 });
await battle(p, 'mobile');

// 1) 局内升级 = 战功（2026-11-16 起属性点改由武将等级给，见 test-hero-level）
const pace = await p.evaluate(G0 => {
  const s = eval(G0), pl = s.player, g = pl.growth, out = {};
  pl.level = 1; pl.xp = 0; pl.xpNext = 16; g.unallocated = 0; for (const k in g.attributes) g.attributes[k] = 0;
  const up = () => { const need = pl.xpNext - pl.xp; return pl.gainXp(need); };
  up(); out.lv2 = [pl.level, g.unallocated];
  up(); out.lv3 = [pl.level, g.unallocated];
  up(); out.lv4 = [pl.level, g.unallocated];
  // 一次连升 3 级（4 → 7）：到达 6 级一次
  const big = pl.xpNext + 200 + 300; const gained = pl.gainXp(big); out.jump = [gained, pl.level, g.unallocated];
  return out;
}, G);
ck('等级按武将经验表升（2026-11-17 只留武将等级）；Player.gainXp 本身不加点（加点由 onHeroLevelUp 给）', pace.lv2[0] === 2 && pace.lv3[0] === 3 && pace.lv4[0] === 4 && pace.lv4[1] === 0 && pace.jump[2] === 0, pace);
// 升级面板提示与三选一仍每级一次
const hint = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, out = {};
  pl.level = 3; s.pendingLevels = 1; s.openUpgrade(); await new Promise(r => setTimeout(r, 200));
  out.odd = s.levelPanel.getByName('upgrade-points-hint')?.text; out.cards = s.upgradeOptions.length; out.mode = s.mode;
  return out;
}, G);
ck('升级三选一仍出现（3 张卡），面板提示「武将 Lv.3」', hint.mode === 'levelup' && hint.cards === 3 && /武将 Lv.3/.test(hint.odd), hint);
await p.screenshot({ path: `${out}/mobile-levelup-hint.png` });
const hint2 = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, out = {};
  s.pendingLevels = 0; s.setMode('none');
  pl.level = 4; s.pendingLevels = 1; s.openUpgrade(); await new Promise(r => setTimeout(r, 100));
  out.even = s.levelPanel.getByName('upgrade-points-hint')?.text; s.pendingLevels = 0; s.setMode('none');
  pl.growth.unallocated = 0; pl.level = 5; s.attributeReturn = 'none'; s.renderAttributePanel(); out.panel = s.attributePointsText.text;
  return out;
}, G);
ck('武将 Lv.4 面板提示', /武将 Lv.4/.test(hint2.even), hint2);
ck('属性面板：点数用完时提示怎么得点（2026-11-20：现为「Lv25 前每级 1 点、之后每 2–3 级 1 点」）', /属性点已用完/.test(hint2.panel) && /每级 1 点/.test(hint2.panel), hint2);

// 2) 掉落与拾取
const drops = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, d = s.itemDrops, out = {};
  d.runLoot.length = 0; d.clear();
  d.rng = () => 0; // 必定掉落（普通敌 0 < 0.4%），品质取第一档
  const e = s.spawnEnemy('infantry', pl.x + 300, pl.y, 1); s.killEnemy(e);
  out.ground = d.ground.length; out.groundQ = d.ground[0]?.item.quality; out.dropVisible = !!s.children.getByName('item-drop');
  d.rng = Math.random;
  pl.sprite.setPosition(d.ground[0].x, d.ground[0].y); await new Promise(r => setTimeout(r, 300));
  out.picked = d.runLoot.length; out.groundAfter = d.ground.length; out.text = s.children.getByName('item-pickup-text')?.text;
  // 普通敌掉率：2 万次随机约 0.4%
  let n = 0; const roll = () => Math.random(); for (let i = 0; i < 20000; i++) if (roll() < 0.004) n++; out.rate = n / 20000;
  // 首领：直接收入，至少蓝
  d.onKill({ kind: 'boss', x: pl.x, y: pl.y }); out.boss = d.runLoot.slice(1).map(i => i.quality);
  // 宝箱：走近打开，掉 1–2 件至少绿
  const lootBefore = d.runLoot.length; const c = d.spawnChest(pl.x + 200, pl.y); out.chestVisible = !!s.children.getByName('item-chest');
  pl.sprite.setPosition(c.x, c.y); await new Promise(r => setTimeout(r, 250));
  out.chestOpened = d.chests.length === 0; const fromChest = d.ground.map(g => g.item.quality); out.chestItems = fromChest;
  pl.sprite.setPosition(c.x + 8, c.y + 18); await new Promise(r => setTimeout(r, 300));
  out.total = d.runLoot.length; out.summary = d.summary(); out.chestItems = d.runLoot.slice(lootBefore).map(i => i.quality);
  return out;
}, G);
ck('普通敌必定掉落（rng=0）：地上出现带光柱的白色道具', drops.ground === 1 && drops.groundQ === 'white' && drops.dropVisible, drops);
ck('走近自动拾取：收入本局缴获，弹出品质色名字', drops.picked === 1 && drops.groundAfter === 0 && /^获得 · 白 · /.test(drops.text ?? ''), drops);
ck('首领击杀必得兵装（直接收入），不出白（第一档首领表 55% 绿 / 45% 蓝，data/items WEIGHTS.boss）', drops.boss.length >= 1 && drops.boss.every(q => q !== 'white'), drops);
ck('宝箱：走近打开，掉 1–2 件至少绿色，再走近拾取', drops.chestVisible && drops.chestOpened && drops.chestItems.length >= 1 && drops.chestItems.length <= 2 && drops.chestItems.every(q => q !== 'white') && drops.total === 1 + drops.boss.length + drops.chestItems.length, drops);
await p.screenshot({ path: `${out}/mobile-battle-pickup.png` });

// 3) 数据表规模与品质掉率
const data = await p.evaluate(async () => {
  const m = await window.__mod('/src/data/items.ts'), out = {};
  out.base = m.BASE_ITEMS.length; out.legends = m.LEGENDS.length; out.slots = Object.keys(m.SLOTS).length;
  const count = (src, tier) => { const c = { white: 0, green: 0, blue: 0, purple: 0, orange: 0 }; for (let i = 0; i < 40000; i++) c[m.rollQuality(src, tier)]++; return c; };
  out.normal0 = count('normal', 0); out.normal3 = count('normal', 3); out.boss = count('boss', 0);
  const items = ['white', 'green', 'blue', 'purple', 'orange'].map(q => m.rollItem(q, Math.random, 'armor')); /* 甲胄：不会抽到信物库新信物（词条规则不同，见 test-charms） */ out.affixCounts = items.map(i => i.affixes.length); out.orangeSpecial = !!items[4].special;
  return out;
});
ck('32 种基础道具 + 15 件橙色名器、4 个兵装槽 + 「Boss遗物」槽（无兵刃、坐骑）', data.base === 32 && data.legends === 15 && data.slots === 5, data);
ck('第一章普通敌品质约 白70 / 绿28 / 蓝2 / 无紫橙（2026-11-19 掉落随章节）', Math.abs(data.normal0.white / 40000 - .70) < .02 && Math.abs(data.normal0.blue / 40000 - .02) < .01 && data.normal0.purple === 0 && data.normal0.orange === 0, data.normal0);
ck('后期章节品质上浮（橙 / 紫更多）', data.normal3.purple > data.normal0.purple * 1.5 && data.normal3.white < data.normal0.white, data.normal3);
ck('首领不出白；一二章首领最多蓝', data.boss.white === 0 && data.boss.purple === 0 && data.boss.orange === 0, data.boss);
ck('词条数：白1 绿2 蓝3 紫4 橙4 + 专属特效', JSON.stringify(data.affixCounts) === '[1,2,3,4,4]' && data.orangeSpecial, data);

// 4) 结算入行囊
const dep = await p.evaluate(async G0 => {
  const s = eval(G0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts'), out = {};
  localStorage.removeItem('im_items_v1'); localStorage.removeItem('im_items_v2'); st.resetItemCache(); st.setAutoSalvageWhite(false);
  out.debug = st.depositRunLoot(s.itemDrops.runLoot, { victory: true, elapsed: 200, debug: true }).kept.length; out.afterDebug = st.loadItems().bag.length;
  out.win = st.depositRunLoot(s.itemDrops.runLoot, { victory: true, elapsed: 200, debug: false }).kept.length; out.afterWin = st.loadItems().bag.length;
  const four = ['white', 'green', 'purple', 'blue'].map(q => items.rollItem(q));
  const lose = st.depositRunLoot(four, { victory: false, elapsed: 30, debug: false }); out.lose = lose.kept.map(i => i.quality); out.lost = lose.lost;
  out.saved = JSON.parse(localStorage.getItem('im_items_v2')).bag.length;
  const slots = await window.__mod('/src/systems/SaveSlots.ts'); out.slotKey = slots.PROGRESS_KEYS.includes('im_items_v2');
  return out;
}, G);
ck('测试 / 调试战斗不入行囊', dep.debug === 0 && dep.afterDebug === 0, dep);
ck('胜利带回全部本局缴获', dep.win === drops.total && dep.afterWin === drops.total, dep);
ck('阵亡且不足 60 秒只带回一半（品质高的）', dep.lost === 2 && JSON.stringify(dep.lose) === '["purple","blue"]', dep);
ck('行囊写入 im_items_v2，且随存档位切换', dep.saved === drops.total + 2 && dep.slotKey, dep);

// 5) 穿戴后加成生效
const gear = await p.evaluate(async G0 => {
  const s = eval(G0), st = await window.__mod('/src/systems/ItemStore.ts'), fx = await window.__mod('/src/systems/ItemEffects.ts'), items = await window.__mod('/src/data/items.ts'), out = {};
  const sword = { uid: 'test-sword', base: 'gold_seal', quality: 'purple', affixes: [{ id: 'damage', value: .066 }, { id: 'crit', value: .02 }] };
  const horse = { uid: 'test-chitu', base: 'qinggang', quality: 'orange', affixes: [{ id: 'move', value: .04 }], special: 'slayer' };
  const helm = { uid: 'test-helm', base: 'iron_helm', quality: 'blue', affixes: [{ id: 'reduce', value: .03 }] };
  st.addItems([sword, horse, helm]); out.equip = st.equipItem('zhaoyun', 'test-sword') && st.equipItem('guanyu', 'test-chitu');
  out.zhao = fx.gearFor('zhaoyun'); out.guan = fx.gearFor('guanyu');
  // 同一件只能一人穿：赵云改穿赤兔，关羽身上的被取下
  st.equipItem('zhaoyun', 'test-helm'); st.equipItem('zhaoyun', 'test-chitu'); out.guanAfter = Object.keys(st.loadout('guanyu')).length; out.zhaoSlots = Object.keys(st.loadout('zhaoyun')).sort();
  const g = s.player.growth, before = g.damageMultiplier(0), crit0 = g.criticalBonus(), boss0 = g.gearHitMultiplier('boss');
  g.gear = fx.gearFor('zhaoyun'); out.boss = [boss0, g.gearHitMultiplier('boss')]; st.equipItem('zhaoyun', 'test-sword'); g.gear = fx.gearFor('zhaoyun'); out.dmg = [before, g.damageMultiplier(0)]; out.crit = [crit0, g.criticalBonus()];
  g.gear = fx.emptyGear();
  out.salvageWorn = st.salvageItems(['test-sword']);
  return out;
}, G);
ck('穿戴：赵云信物加伤害 / 暴击，关羽青釭剑（信物）带「斩将」', gear.equip && gear.zhao.damage === .066 && gear.zhao.crit === .02 && gear.guan.boss === .25 && gear.guan.specials.includes('slayer'), gear);
ck('一件兵装同时只属于一位武将', gear.guanAfter === 0 && JSON.stringify(gear.zhaoSlots) === '["helm","token"]', gear);
ck('开局加成进战斗属性：伤害、暴击、对首领伤害提高', gear.dmg[1] > gear.dmg[0] && gear.crit[1] > gear.crit[0] && gear.boss[1] > gear.boss[0], gear);
ck('已穿戴的兵装不能分解', gear.salvageWorn === 0, gear);

// 6) 暂停 → 行囊（本局缴获并在行囊网格最前，角上标「新」；不再有单独分页）
const pauseBag = await p.evaluate(async G0 => {
  const s = eval(G0); s.itemDrops.runLoot.length = 0;
  const items = await window.__mod('/src/data/items.ts'); for (const q of ['orange', 'purple', 'blue', 'green', 'white']) s.itemDrops.runLoot.push(items.rollItem(q));
  s.togglePause(); await new Promise(r => setTimeout(r, 200));
  s.pausePanel.getByName('pause-bag').emit('pointerdown'); await new Promise(r => setTimeout(r, 200));
  const bag = s.children.getByName('item-bag'), out = { open: !!bag };
  out.cells = [0, 1, 2, 3, 4].map(i => !!window.__find(bag, 'item-cell-' + i)); out.lootCells = [0, 1, 2, 3, 4].filter(i => window.__find(bag, 'item-cell-' + i)?.getData('loot') && window.__find(window.__find(bag, 'item-cell-' + i), 'item-new-badge')).length; out.noTab = !window.__find(bag, 'item-tab-loot') && !window.__find(bag, 'item-tab-bag'); out.first = s.itemDrops.runLoot.find(i => i.uid === window.__find(bag, 'item-cell-0').getData('uid'))?.quality;
  out.noHero = !window.__find(bag, 'item-hero-guanyu');
  window.__tap(window.__find(bag, 'item-cell-0')); await new Promise(r => setTimeout(r, 150));
  const bag2 = s.children.getByName('item-bag'); out.detail = window.__find(bag2, 'item-detail-name')?.text; out.noEquip = !window.__find(bag2, 'item-equip');
  return out;
}, G);
ck('暂停菜单「行囊」：没有缴获分页，5 件缴获排在网格最前（橙色第一）并标「新」，战斗中不显示武将切换', pauseBag.open && pauseBag.cells.every(Boolean) && pauseBag.noTab && pauseBag.lootCells === 5 && pauseBag.first === 'orange' && pauseBag.noHero, pauseBag);
ck('点缴获弹详情卡；测试战斗的缴获不能穿（不入行囊）', !!pauseBag.detail && pauseBag.noEquip, pauseBag);
await p.screenshot({ path: `${out}/mobile-pause-bag-detail.png` });
await p.evaluate(G0 => { const s = eval(G0), bag = s.children.getByName('item-bag'); window.__find(bag, 'item-detail-name') && s.children.getByName('item-bag'); }, G);
await p.evaluate(G0 => { const s = eval(G0), bag = s.children.getByName('item-bag'); const c = window.__find(bag, 'item-cell-0'); c && window.__tap(c); }, G).catch(() => {});
await p.waitForTimeout(150);
await p.screenshot({ path: `${out}/mobile-pause-bag.png` });
ck('Esc 先关行囊，再按一次继续战斗', await p.evaluate(async G0 => { const s = eval(G0); s.togglePause(); await new Promise(r => setTimeout(r, 100)); if (s.children.getByName('item-bag') || s.mode !== 'pause') return false; s.togglePause(); await new Promise(r => setTimeout(r, 150)); return !s.children.getByName('item-bag') && s.mode === 'none'; }, G));

// 7) 行营军需商人（2026-11-17 起只卖兵装：4 件，各槽 1 件）
const camp = await p.evaluate(async G0 => {
  const s = eval(G0), ui = s.campUI, out = {}; if (!ui) return { none: true };
  s.legion.food = 500; ui.open('test-camp-' + Date.now(), '测试'); ui.setVisible(true); ui.tab = 2; ui.render?.(); await new Promise(r => setTimeout(r, 150));
  const items = await window.__mod('/src/data/items.ts'); out.slots = ui.itemOffers.map(i => items.itemSlot(i)); out.qualities = ui.itemOffers.map(i => i.quality);
  out.tactics = !!window.__find(ui.root, 'camp-description-0'); // 旧的战法 / 宝物卡不该再出现
  const label = () => window.__find(ui.root, 'camp-item-price-0')?.text; const btn = window.__find(ui.root, 'camp-item-goods-0'); out.label = label(); out.quality = ui.itemOffers[0]?.quality;
  const card = window.__find(ui.root, 'camp-item-card-0'), rs = s.cameras.main.zoom; card?.emit('pointerover', { x: 120 * rs, y: 120 * rs }); const tip = s.children.list.find(o => o.name === 'item-tooltip' && o.visible); /* 场景里可能已有加点面板等别的提示框，取弹出来的那个 */ out.tip = !!tip?.visible && tip.list.some(o => o.name === 'item-tooltip-name' && o.text.length > 0); card?.emit('pointerout'); out.tipHidden = !tip?.visible;
  const before = s.itemDrops.runLoot.length, food = s.legion.food; btn?.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  out.bought = s.itemDrops.runLoot.length - before; out.cost = food - s.legion.food; out.sold = window.__find(ui.root, 'camp-item-price-0')?.text;
  return out;
}, G);
ck('行营军需商人只卖兵装：4 件，甲胄 / 头盔 / 战靴 / 信物各一，第一章绿 / 蓝；不再有战法和宝物', !camp.none && JSON.stringify(camp.slots) === '["armor","helm","boots","token"]' && camp.qualities.every(q => q === 'green' || q === 'blue') && !camp.tactics, camp);
ck('花随军钱币买下一件，记入本局缴获，按钮变「已售罄」', camp.bought === 1 && (camp.cost === 60 || camp.cost === 120) && /购入 · [0-9]+粮/.test(camp.label ?? '') && /已售罄/.test(camp.sold ?? ''), camp);
ck('行营商店的兵装：悬停弹出属性提示框，移开隐藏', camp.tip && camp.tipHidden, camp);
await p.screenshot({ path: `${out}/mobile-camp-shelf.png` });
await p.evaluate(G0 => eval(G0).campUI.setVisible(false), G);

// 8) 主页行囊（可穿戴）
await p.goto(base + '?dev=1&layout=mobile');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.getByName('home-achievements-plaque'), null, { timeout: 30000 });
await p.waitForTimeout(800);
const homeBag = await p.evaluate(async M0 => {
  const m = eval(M0), out = {}, st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts');
  const add = []; for (let i = 0; i < 14; i++) add.push(items.rollItem(['white', 'green', 'blue', 'purple', 'orange'][i % 5])); st.addItems(add);
  /* 2026-11-16：主页已不放行囊匾（用户「界面的行囊可以不要」），行囊界面本身照旧，这里直接打开 */ if (m.children.getByName('home-bag-plaque')) throw new Error('主页仍有行囊匾'); { const UI = await window.__mod('/src/ui/ItemBagUI.ts'); new UI.ItemBagUI(m, { hero: 'zhaoyun' }); } await new Promise(r => setTimeout(r, 300));
  let bag = m.children.getByName('item-bag'); out.open = !!bag; if (!bag) return out;
  out.count = window.__find(bag, 'item-bag-count')?.text; out.heroes = ['zhaoyun', 'guanyu', 'huangyueying'].map(id => !!window.__find(bag, 'item-hero-' + id));
  const cell = window.__find(bag, 'item-cell-0'), uid = cell.getData('uid'); window.__tap(cell); await new Promise(r => setTimeout(r, 150));
  bag = m.children.getByName('item-bag'); out.detail = window.__find(bag, 'item-detail-name')?.text;
  const equip = window.__find(bag, 'item-equip'); if (equip) { equip.emit('pointerdown'); await new Promise(r => setTimeout(r, 150)); }
  bag = m.children.getByName('item-bag'); out.worn = Object.values(st.loadout('zhaoyun')).some(i => i.uid === uid); out.summary = window.__find(bag, 'item-gear-summary')?.text;
  window.__find(bag, 'item-filter-token').emit('pointerdown'); await new Promise(r => setTimeout(r, 100)); bag = m.children.getByName('item-bag');
  out.filterOk = st.loadItems().bag.filter(i => items.itemSlot(i) === 'token').length === [...Array(40).keys()].filter(i => window.__find(bag, 'item-cell-' + i)).length;
  window.__find(bag, 'item-filter-all').emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  return out;
}, M);
ck('主页右上「行囊」打开面板，可切换各位武将', homeBag.open && homeBag.heroes.every(Boolean), homeBag);
ck('点道具 → 详情 → 穿戴，装备槽与兵装加成更新', !!homeBag.detail && homeBag.worn && !/尚未穿戴/.test(homeBag.summary ?? ''), homeBag);
ck('槽位筛选只显示该槽位道具', homeBag.filterOk, homeBag);
await p.screenshot({ path: `${out}/mobile-home-bag.png` });
await p.evaluate(async M0 => { const m = eval(M0), bag = m.children.getByName('item-bag'); const c1 = window.__find(bag, 'item-cell-1'); c1 && window.__tap(c1); await new Promise(r => setTimeout(r, 150)); }, M);
await p.screenshot({ path: `${out}/mobile-home-bag-detail.png` });
const salv = await p.evaluate(async M0 => { const m = eval(M0), st = await window.__mod('/src/systems/ItemStore.ts'); let bag = m.children.getByName('item-bag'); window.__find(bag, 'item-detail')?.list[0]?.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  // 2026-11-19 用户「分解不需要背包，可以去军需商人卖装备」：行囊里没有分解按钮；卖白 / 绿走商人出售（界面流程见 test-merchant-sell）
  bag = m.children.getByName('item-bag'); const names = []; const walk = l => { for (const o of l) { if (o.name) names.push(o.name); if (o.list) walk(o.list); } }; walk(bag.list);
  const s0 = st.loadItems(), before = s0.bag.length, low = st.sellableItems(s0).filter(i => i.quality === 'white' || i.quality === 'green').map(i => i.uid), worn = s0.bag.filter(i => st.equippedBy(s0, i.uid)).length;
  const sold = st.sellItems(low), after = st.loadItems(); return { noSalvage: !names.some(n => /^item-salvage/.test(n)) /* 旧物卡的「全部分解」（item-legacy-salvage）另算 */, before, after: after.bag.length, sold: sold.length, wanted: low.length, worn, wornAfter: after.bag.filter(i => st.equippedBy(after, i.uid)).length, low: after.bag.filter(i => (i.quality === 'white' || i.quality === 'green') && !st.equippedBy(after, i.uid)).length }; }, M);
ck('行囊里没有「分解」；白 / 绿改为卖给军需商人：卖出后离开行囊，已穿戴的不在出售之列', salv.noSalvage && salv.wanted > 0 && salv.sold === salv.wanted && salv.after === salv.before - salv.sold && salv.low === 0 && salv.wornAfter === salv.worn, salv);
await p.evaluate(M0 => window.__find(eval(M0).children.getByName('item-bag'), 'item-bag-close').emit('pointerdown'), M);
ck('关闭行囊', await p.evaluate(M0 => !eval(M0).children.getByName('item-bag'), M));
await p.screenshot({ path: `${out}/mobile-home.png` });
await p.close();

// ———————————— 电脑 1280×720 ————————————
const d = await page('desktop', { width: 1280, height: 720 });
await d.goto(base + '?dev=1&layout=desktop');
await d.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive() && window.__game.scene.getScene('MenuScene').children.getByName('home-achievements-plaque'), null, { timeout: 30000 });
await d.waitForTimeout(800);
await d.evaluate(async M0 => { const m = eval(M0), st = await window.__mod('/src/systems/ItemStore.ts'), items = await window.__mod('/src/data/items.ts');
  const add = []; for (let i = 0; i < 30; i++) add.push(items.rollItem(['white', 'green', 'blue', 'purple', 'orange'][i % 5])); st.addItems(add);
  for (const slot of items.SLOT_ORDER) { const it = st.loadItems().bag.find(x => items.itemSlot(x) === slot && x.quality !== 'white'); if (it) st.equipItem('guanyu', it.uid); }
  /* 2026-11-16：主页已不放行囊匾（用户「界面的行囊可以不要」），行囊界面本身照旧，这里直接打开 */ if (m.children.getByName('home-bag-plaque')) throw new Error('主页仍有行囊匾'); { const UI = await window.__mod('/src/ui/ItemBagUI.ts'); new UI.ItemBagUI(m, { hero: 'zhaoyun' }); } await new Promise(r => setTimeout(r, 300));
  window.__find(m.children.getByName('item-bag'), 'item-hero-guanyu').emit('pointerdown'); await new Promise(r => setTimeout(r, 200)); }, M);
const dk = await d.evaluate(M0 => { const bag = eval(M0).children.getByName('item-bag'); return { open: !!bag, slots: ['armor', 'helm', 'boots', 'token'].filter(s => window.__find(bag, 'item-slot-label-' + s)?.text !== { armor: '甲胄', helm: '头盔', boots: '战靴', token: '信物' }[s]).length, summary: window.__find(bag, 'item-gear-summary')?.text }; }, M);
ck('电脑布局：行囊左右分栏，关羽 4 槽穿满并显示加成', dk.open && dk.slots === 4 && !!dk.summary, dk);
await d.screenshot({ path: `${out}/desktop-home-bag.png` });
await d.evaluate(async M0 => { const bag = eval(M0).children.getByName('item-bag'); window.__tap(window.__find(bag, 'item-slot-token')); await new Promise(r => setTimeout(r, 150)); }, M);
await d.screenshot({ path: `${out}/desktop-home-bag-detail.png` });
// 电脑战斗：升级提示、暂停行囊、地面掉落
await battle(d, 'desktop');
await d.evaluate(async G0 => { const s = eval(G0), pl = s.player, dr = s.itemDrops, items = await window.__mod('/src/data/items.ts');
  for (const [q, dx, dy] of [['orange', 120, -40], ['purple', -110, 30], ['blue', 60, 90], ['green', -60, -100], ['white', 160, 60]]) dr.drop(items.rollItem(q), pl.x + dx, pl.y + dy);
  dr.spawnChest(pl.x - 170, pl.y - 20); await new Promise(r => setTimeout(r, 300)); }, G);
await d.screenshot({ path: `${out}/desktop-battle-drops.png` });
await d.evaluate(async G0 => { const s = eval(G0), ui = s.campUI; s.legion.food = 500; ui.open('dk-camp', '测试'); ui.setVisible(true); ui.tab = 2; ui.render(); await new Promise(r => setTimeout(r, 200)); }, G);
await d.screenshot({ path: `${out}/desktop-camp-shelf.png` });
await d.evaluate(G0 => eval(G0).campUI.setVisible(false), G);
await d.evaluate(async G0 => { const s = eval(G0); s.player.level = 5; s.pendingLevels = 1; s.openUpgrade(); await new Promise(r => setTimeout(r, 200)); }, G);
ck('电脑布局升级面板提示（武将 Lv.5）', /武将 Lv.5/.test(await d.evaluate(G0 => eval(G0).levelPanel.getByName('upgrade-points-hint')?.text, G)));
await d.screenshot({ path: `${out}/desktop-levelup-hint.png` });
await d.evaluate(async G0 => { const s = eval(G0); s.pendingLevels = 0; s.setMode('none'); const items = await window.__mod('/src/data/items.ts'); s.itemDrops.runLoot.push(items.rollItem('purple'), items.rollItem('blue'));
  s.togglePause(); await new Promise(r => setTimeout(r, 150)); }, G);
await d.screenshot({ path: `${out}/desktop-pause.png` });
await d.evaluate(async G0 => { const s = eval(G0); s.pausePanel.getByName('pause-bag').emit('pointerdown'); await new Promise(r => setTimeout(r, 200)); }, G);
await d.screenshot({ path: `${out}/desktop-pause-bag.png` });
await d.close();

ck('控制台无报错', errors.length === 0, errors.slice(0, 8));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
