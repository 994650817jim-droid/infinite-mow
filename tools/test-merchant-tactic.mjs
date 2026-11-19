// 行营军需商人偶尔卖 1 卷战法（2026-11-18 用户「军需商人也可能会卖功法，和需要军需商人立绘」）。
// 1 出现概率按 data/items MERCHANT_TACTIC.chance；2 规则（最多 6 种、每种到 3 级，已满不出）；3 买下立即学会 / 精进、扣随军粮；
// 4 粮不够不能买；5 存档点同步（patchCampaignTactics）；6 立绘；截图有 / 无战法两种。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-merchant-tactic.mjs [截图目录]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', shots = process.argv[2];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => {
  window.__find = (root, name) => { const list = root.list ?? root.getChildren?.() ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 60000 });

// 1–2 概率与规则（纯逻辑，固定种子）
const r = await p.evaluate(async () => {
  const M = await window.__mod('systems/CampMarket.ts'), I = await window.__mod('data/items.ts'), B = await window.__mod('data/builds.ts');
  let seed = 12345; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const book = t => ({ level: id => t[id] ?? 0, canLearn: id => (t[id] ?? 0) < 3 && ((t[id] ?? 0) > 0 || Object.keys(t).length < 6) });
  const N = 6000; let hit = 0; const kinds = new Set(); for (let i = 0; i < N; i++) { const o = M.rollMerchantTactic(book({}), rng); if (o) { hit++; kinds.add(o.id); } }
  const ids = Object.keys(B.TACTICS);
  const six = Object.fromEntries(ids.slice(0, 6).map((id, k) => [id, k < 3 ? 3 : k - 2])); // 前 3 种满级，后 3 种 1 / 2 / 3 级
  const fromSix = new Set(), lvls = new Set(); for (let i = 0; i < 2000; i++) { const o = M.rollMerchantTactic(book(six), rng, 1); if (o) { fromSix.add(o.id); lvls.add(o.level); } }
  const full = Object.fromEntries(ids.slice(0, 6).map(id => [id, 3])); let fullHit = 0; for (let i = 0; i < 500; i++) if (M.rollMerchantTactic(book(full), rng, 1)) fullHit++;
  const one = M.rollMerchantTactic(book({ [ids[0]]: 1 }), () => .0, 1);
  return { chance: I.MERCHANT_TACTIC.chance, price: I.MERCHANT_TACTIC.price, rate: hit / N, kinds: kinds.size, total: ids.length, fromSix: [...fromSix], lvls: [...lvls], six, fullHit, one };
});
ck('出现概率按配置（' + r.chance + '）：6000 次进营实测 ' + (r.rate * 100).toFixed(1) + '%', Math.abs(r.rate - r.chance) < .025, { rate: r.rate, chance: r.chance });
ck('空构筑时所有战法都可能出现', r.kinds === r.total, { kinds: r.kinds, total: r.total });
const sixOk = r.fromSix.length === 2 && r.fromSix.every(id => r.six[id] < 3) && r.lvls.every(l => l === 1 || l === 2);
ck('已学满 6 种：只出已学且未满 3 级的（精进），不出新战法、不出满级的', sixOk, { fromSix: r.fromSix, lvls: r.lvls });
ck('6 种都满 3 级：一卷也不出', r.fullHit === 0, r.fullHit);
ck('价格按已学等级取 price[等级]（精进 Lv.1→2 收 price[1]）', r.one?.level === 1 && r.one?.price === r.price[1], r.one);

// 3–6 游戏内：开行营军需商人
const open = (withTactic, food) => p.evaluate(async ([withTactic, food]) => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, M = await window.__mod('systems/CampMarket.ts');
  s.over = true; s.legion.food = food;
  ui.open('test-tactic-' + Math.random(), '测试'); ui.setVisible(true); ui.tab = 2; ui.notice = '';
  ui.tacticOffer = withTactic ? M.rollMerchantTactic(s.player.growth.build, Math.random, 1) : null; ui.render();
  return { offer: ui.tacticOffer && { ...ui.tacticOffer } };
}, [withTactic, food]);
const artReady = () => p.waitForFunction(() => window.__game.scene.getScene('GameScene').textures.exists('camp_merchant_art'), null, { timeout: 15000 }).then(() => true, () => false);

await open(false, 500); const art = await artReady(); await p.waitForTimeout(300);
const noT = await p.evaluate(() => { const ui = window.__game.scene.getScene('GameScene').campUI; return { card: !!window.__find(ui.root, 'camp-tactic-card'), buy: !!window.__find(ui.root, 'camp-tactic-buy'), art: !!window.__find(ui.root, 'camp-merchant-art'), goods: [0, 1, 2, 3].every(i => !!window.__find(ui.root, 'camp-item-goods-' + i)) }; });
ck('军需商人立绘（电脑版左侧）已载入并显示', art && noT.art, { art, ...noT });
ck('没捎战法时：只有 4 件兵装，没有战法卷轴', !noT.card && !noT.buy && noT.goods, noT);
if (shots) await p.screenshot({ path: shots + '/merchant-no-tactic.png' });

const o1 = await open(true, 500); await p.waitForTimeout(300);
if (shots) await p.screenshot({ path: shots + '/merchant-with-tactic.png' });
const buy1 = await p.evaluate(async id => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, b = s.player.growth.build, out = { before: b.level(id), food0: s.legion.food };
  out.name = window.__find(ui.root, 'camp-tactic-name')?.text; out.desc = window.__find(ui.root, 'camp-tactic-desc')?.text;
  window.__find(ui.root, 'camp-tactic-buy').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  out.after = b.level(id); out.food1 = s.legion.food; out.sold = ui.tacticOffer.sold; out.notice = ui.detail.text;
  window.__find(ui.root, 'camp-tactic-buy').emit('pointerdown'); out.after2 = b.level(id); out.food2 = s.legion.food; // 再点无效
  return out;
}, o1.offer.id);
ck('卷轴卡写战法名与等级、下一级效果', !!buy1.name && buy1.name.includes('Lv.') && !!buy1.desc, { name: buy1.name, desc: buy1.desc });
ck('买下：立即学会（Lv.0→1）、扣随军粮 = 标价、标为已售', buy1.before === 0 && buy1.after === 1 && buy1.food0 - buy1.food1 === o1.offer.price && buy1.sold, buy1);
ck('已售后再点不重复学、不再扣粮；提示写「本局立即生效」', buy1.after2 === 1 && buy1.food2 === buy1.food1 && /本局立即生效/.test(buy1.notice), buy1);

// 精进：已学 1 级的那一种再出现 → 升到 2 级，收 price[1]
const up = await p.evaluate(async id => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, I = await window.__mod('data/items.ts'); s.legion.food = 500;
  ui.open('test-up-' + Math.random(), '测试'); ui.tab = 2; ui.tacticOffer = { id, kind: 'tactic', level: 1, price: I.MERCHANT_TACTIC.price[1], sold: false }; ui.notice = ''; ui.render();
  const lbl = window.__find(ui.root, 'camp-tactic-buy'); window.__find(ui.root, 'camp-tactic-buy').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  return { lv: s.player.growth.build.level(id), spent: 500 - s.legion.food, price: I.MERCHANT_TACTIC.price[1] };
}, o1.offer.id);
ck('精进：已学 Lv.1 的战法再买 → Lv.2，收 price[1]', up.lv === 2 && up.spent === up.price, up);

// 粮不够：按钮不可点，点了也不学
const poor = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, M = await window.__mod('systems/CampMarket.ts'); s.legion.food = 10;
  ui.open('test-poor-' + Math.random(), '测试'); ui.tab = 2; ui.tacticOffer = M.rollMerchantTactic(s.player.growth.build, Math.random, 1); ui.render();
  const id = ui.tacticOffer.id, lv = s.player.growth.build.level(id), btn = window.__find(ui.root, 'camp-tactic-buy');
  const ok = M.buyMerchantTactic(ui.tacticOffer, s.player, s.legion);
  return { interactive: !!btn.input?.enabled, ok, same: s.player.growth.build.level(id) === lv, food: s.legion.food };
});
ck('随军粮不足：按钮不可点、买不了、不扣粮', !poor.interactive && !poor.ok && poor.same && poor.food === 10, poor);

// 共用货架：同一关的休整键再进不换货、已售保留；营寨旅商（openMerchantShop）打开的是同一份货，在那边买的这边也售罄
const shared = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, MS = await window.__mod('ui/MerchantShop.ts'), ST = await window.__mod('systems/MerchantStock.ts'), out = {};
  s.legion.food = 500; ui.open('test-shared-A', '测试'); ui.tab = 2; ui.notice = ''; ui.render();
  const uids = () => ui.itemOffers.map(i => i.uid).join(',');
  out.a = uids(); window.__find(ui.root, 'camp-item-goods-0').emit('pointerdown');
  ui.open('test-shared-B', '测试'); out.b = uids(); ui.open('test-shared-A', '测试'); out.back = uids(); // 换键会换货（新的一关），回到旧键不会变回旧货
  ui.open('test-shared-C', '测试'); out.c = uids(); ui.open('test-shared-C', '测试'); out.c2 = uids(); ui.tab = 2; ui.render();
  window.__find(ui.root, 'camp-item-goods-0').emit('pointerdown'); out.restSold = [...ui.itemSold];
  ui.setVisible(false);
  let grain = 1000; const bought = [];
  const close = MS.openMerchantShop(s, { wallet: { name: '军粮', get: () => grain, spend: n => grain >= n ? (grain -= n, true) : false }, tier: 0, onBuyItem: it => bought.push(it.uid) });
  await new Promise(r => setTimeout(r, 400));
  const shop = s.children.getByName('merchant-shop'); out.shopOpen = !!shop; out.campItems = ST.currentMerchantStock(0).items.map(i => i.uid).join(',');
  out.goods0Enabled = !!window.__find(shop, 'camp-item-goods-0')?.input?.enabled;
  window.__find(shop, 'camp-item-goods-1').emit('pointerdown'); out.grain = grain; out.bought = bought.length;
  out.purse = window.__find(s.children.getByName('merchant-shop'), 'merchant-purse')?.text;
  out.tacticLabel = window.__find(s.children.getByName('merchant-shop'), 'camp-tactic-buy') ? 'has' : 'none';
  window.__shotClose = close; return out;
});
ck('同一关的休整键再进：货不变（不能靠重进刷货），换了一关才换货', shared.c === shared.c2 && shared.a !== shared.b && shared.back !== shared.a, shared);
ck('营寨旅商打开的是同一份货：行营卖掉的那件这边也售罄，这边能买别的', shared.shopOpen && shared.campItems === shared.c && !shared.goods0Enabled && shared.restSold[0], shared);
ck('营寨旅商用调用方给的钱包（军粮）、买下回调收货', shared.bought === 1 && shared.grain < 1000 && /^军粮 \d+/.test(shared.purse ?? ''), shared);
if (shots) await p.screenshot({ path: shots + '/merchant-camp-stall.png' });
const back = await p.evaluate(async () => {
  window.__shotClose(); const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; ui.setVisible(true); ui.tab = 2; ui.render();
  return { closed: !s.children.getByName('merchant-shop'), sold: [...ui.itemSold] };
});
ck('关掉旅商回到行营：营寨里买的那件在行营也是售罄', back.closed && back.sold[0] && back.sold[1], back);
await p.reload(); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 60000 });
const reload = await p.evaluate(async () => { const ST = await window.__mod('systems/MerchantStock.ts'); const st = ST.currentMerchantStock(0); return { key: st.key, sold: st.sold }; });
ck('关页面重开：货架与已售都还在', reload.key === 'test-shared-C' && reload.sold[0] && reload.sold[1], reload);

// 营寨旅商卖战法：写进征程构筑（没有征程构筑时不能买）
const camp = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), MS = await window.__mod('ui/MerchantShop.ts'), ST = await window.__mod('systems/MerchantStock.ts'), C = await window.__mod('systems/Campaign.ts'), out = {};
  localStorage.removeItem(C.CAMPAIGN_KEY); const st = ST.currentMerchantStock(0); st.tactic = { id: 'rally', kind: 'tactic', level: 0, price: 150, sold: false }; ST.saveMerchantStock(st);
  let grain = 1000; const w = { name: '军粮', get: () => grain, spend: n => grain >= n ? (grain -= n, true) : false };
  let close = MS.openMerchantShop(s, { wallet: w, tier: 0, hero: 'zhaoyun' }); await new Promise(r => setTimeout(r, 200));
  let btn = window.__find(s.children.getByName('merchant-shop'), 'camp-tactic-buy'); out.noBuildEnabled = !!btn?.input?.enabled; const deep = c => (c.list ?? []).flatMap(o => [o, ...deep(o)]); out.noBuildLabel = deep(s.children.getByName('merchant-shop')).find(o => typeof o.text === 'string' && /研习/.test(o.text))?.text; close();
  localStorage.setItem(C.CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes: { zhaoyun: { character: 'zhaoyun', player: { build: { tactics: { deflect: 1 } }, weapons: [] }, army: { food: 300 } } } }));
  close = MS.openMerchantShop(s, { wallet: w, tier: 0, hero: 'zhaoyun' }); await new Promise(r => setTimeout(r, 200));
  window.__find(s.children.getByName('merchant-shop'), 'camp-tactic-buy').emit('pointerdown');
  out.saved = JSON.parse(localStorage.getItem(C.CAMPAIGN_KEY)).heroes.zhaoyun.player.build.tactics; out.grain = grain; out.sold = ST.currentMerchantStock(0).tactic.sold; close(); return out;
});
ck('营寨旅商：武将还没有征程构筑时卷轴不能买（显示「出征后可研习」）', !camp.noBuildEnabled && /出征后可研习/.test(camp.noBuildLabel ?? ''), camp);
ck('营寨旅商：买下战法写进征程构筑（下次出征带上）、扣军粮、标已售', camp.saved?.rally === 1 && camp.saved?.deflect === 1 && camp.grain === 850 && camp.sold, camp);

// 存档点同步
const save = await p.evaluate(async () => {
  const C = await window.__mod('systems/Campaign.ts');
  localStorage.setItem(C.CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes: { zhaoyun: { character: 'zhaoyun', player: { build: { tactics: { deflect: 1 } }, weapons: [] }, army: { food: 300 } } } }));
  C.patchCampaignTactics('zhaoyun', { deflect: 2, rally: 1 }, 110);
  const v = JSON.parse(localStorage.getItem(C.CAMPAIGN_KEY)).heroes.zhaoyun; return { tactics: v.player.build.tactics, food: v.army.food };
});
ck('买下后改存档点：战法与随军粮同步（关页面再进不丢、不退粮）', save.tactics.deflect === 2 && save.tactics.rally === 1 && save.food === 110, save);
ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
