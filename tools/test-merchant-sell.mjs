// 卖装备给军需商人（2026-11-19 用户「分解不需要背包，可以去军需商人卖装备」）。电脑布局；需要开发服务器。
// 1 行囊里没有「分解」：没有分解白 / 绿、自动分解白、单件分解按钮；2 军需商人「出售兵装」只列未穿戴、非首领遗珍的；
// 3 「选白绿」一键选 + 出售：随军粮按卖价增加、行囊里没了；4 紫 / 橙先弹确认：取消不卖、确认才卖；5 营寨旅商（军粮钱包）也能卖。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-merchant-sell.mjs [截图目录]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', shots = process.argv[2];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => {
  window.__find = (root, name) => { const list = root.list ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  window.__names = root => { const out = []; const walk = c => { for (const o of c.list ?? []) { if (o.name) out.push(o.name); if (o.list) walk(o); } }; walk(root); return out; };
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\/?(src\/)?/, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {}, autoSalvageWhite: true })); sessionStorage.setItem('seeded', '1'); }
});
// 正式模式（不带 dev=1），行营买卖都进 / 出真实行囊
await p.goto(base + '?autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 90000 });
await p.waitForTimeout(1200);

// 种一批兵装：白 / 绿 / 蓝 / 紫 / 橙各 1、首领遗珍 1、穿着的蓝 1（旧档里「自动分解白」开着也不再把白色折掉）
const seed = await p.evaluate(async () => {
  const I = await window.__mod('data/items.ts'), S = await window.__mod('systems/ItemStore.ts');
  const mk = q => I.rollItem(q, Math.random, 'armor', 2), items = { white: mk('white'), green: mk('green'), blue: mk('blue'), purple: mk('purple'), orange: mk('orange'), worn: mk('blue'), relic: I.rollRelic('relic_jiujie') };
  S.addItems(Object.values(items)); S.equipItem('zhaoyun', items.worn.uid);
  const bag = S.loadItems().bag.map(i => i.uid);
  return { uids: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.uid])), q: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.quality])), bagHas: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, bag.includes(v.uid)])) };
});
ck('种的兵装都进了行囊（旧档「自动分解白」开着也不再折掉白色）', Object.values(seed.bagHas).every(Boolean), seed.bagHas);

// 1 行囊里没有分解
const bag = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.over = true; s.openBattleBag(true); await new Promise(r => setTimeout(r, 400));
  const ui = s.children.getByName('item-bag'), names = window.__names(ui);
  return { open: !!ui, salvage: names.filter(n => /salvage|auto-white/.test(n)), hint: names.includes('item-sell-hint') };
});
ck('行囊里没有「分解」：没有分解白 / 绿、自动分解白、单件分解；改提示去军需商人出售', bag.open && bag.salvage.length === 0 && bag.hint, bag);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.closeBattleBag?.(); const bagUi = s.children.getByName('item-bag'); bagUi?.destroy?.(); });

// 2–4 行营军需商人「出售兵装」
const sell = await p.evaluate(async ([u]) => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, I = await window.__mod('data/items.ts'), S = await window.__mod('systems/ItemStore.ts'), out = {};
  s.legion.food = 100; ui.open('test-sell-' + Date.now(), '测试'); ui.setVisible(true); ui.chapterNo = 2; ui.tab = 2; ui.notice = ''; ui.render(); await new Promise(r => setTimeout(r, 150));
  window.__find(ui.root, 'merchant-mode-sell').emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
  const listed = window.__names(ui.root).filter(n => n.startsWith('merchant-sell-item-')).map(n => n.slice('merchant-sell-item-'.length));
  out.listed = Object.fromEntries(Object.entries(u).map(([k, uid]) => [k, listed.includes(uid)]));
  // 选白绿 → 出售
  const food0 = s.legion.food, want = I.sellPrice({ quality: 'white' }, 2) + I.sellPrice({ quality: 'green' }, 2);
  window.__find(ui.root, 'merchant-sell-low').emit('pointerdown'); await new Promise(r => setTimeout(r, 60));
  window.__find(ui.root, 'merchant-sell-go').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  const bag1 = S.loadItems().bag.map(i => i.uid); out.low = { gained: s.legion.food - food0, want, whiteGone: !bag1.includes(u.white), greenGone: !bag1.includes(u.green), notice: ui.detail?.text };
  // 紫：先确认；取消不卖
  window.__find(ui.root, 'merchant-sell-item-' + u.purple).emit('pointerdown'); await new Promise(r => setTimeout(r, 60));
  window.__find(ui.root, 'merchant-sell-go').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  out.confirmText = window.__find(ui.root, 'merchant-sell-confirm-text')?.text;
  window.__find(ui.root, 'merchant-sell-cancel').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  out.afterCancel = { purpleStill: S.loadItems().bag.some(i => i.uid === u.purple), confirmGone: !window.__find(ui.root, 'merchant-sell-confirm-text') };
  return out;
}, [seed.uids]);
ck('出售页只列未穿戴、非首领遗珍的（穿着的蓝、遗珍不在单子上）', sell.listed.white && sell.listed.green && sell.listed.blue && sell.listed.purple && sell.listed.orange && !sell.listed.worn && !sell.listed.relic, sell.listed);
ck('「选白绿」一键选中 → 出售：随军粮按卖价增加（第 2 章），白 / 绿从行囊拿走', sell.low.gained === sell.low.want && sell.low.whiteGone && sell.low.greenGone && /卖出 2 件/.test(sell.low.notice ?? ''), sell.low);
ck('紫装出售先弹确认（写明件名与卖价）；取消就不卖', /紫 \/ 橙/.test(sell.confirmText ?? '') && sell.afterCancel.purpleStill && sell.afterCancel.confirmGone, { t: sell.confirmText, ...sell.afterCancel });
if (shots) await p.evaluate(async u => { const ui = window.__game.scene.getScene('GameScene').campUI; window.__find(ui.root, 'merchant-sell-go').emit('pointerdown'); await new Promise(r => setTimeout(r, 120)); }, seed.uids);
if (shots) await p.screenshot({ path: shots + '/merchant-sell-confirm.png' });
const conf = await p.evaluate(async ([u]) => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, I = await window.__mod('data/items.ts'), S = await window.__mod('systems/ItemStore.ts');
  if (!window.__find(ui.root, 'merchant-sell-confirm')) { window.__find(ui.root, 'merchant-sell-go').emit('pointerdown'); await new Promise(r => setTimeout(r, 80)); }
  const food0 = s.legion.food; window.__find(ui.root, 'merchant-sell-confirm').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  return { gained: s.legion.food - food0, want: I.sellPrice({ quality: 'purple' }, 2), gone: !S.loadItems().bag.some(i => i.uid === u.purple), wornKept: S.loadItems().bag.some(i => i.uid === u.worn) };
}, [seed.uids]);
ck('确认后紫装卖出、随军粮 + 卖价；穿着的蓝装始终没被动', conf.gone && conf.gained === conf.want && conf.wornKept, conf);
if (shots) { await p.waitForTimeout(150); await p.screenshot({ path: shots + '/merchant-sell.png' }); }

// 5 营寨旅商：军粮钱包（gain）也能卖
const camp = await p.evaluate(async ([u]) => {
  const s = window.__game.scene.getScene('GameScene'), MS = await window.__mod('ui/MerchantShop.ts'), I = await window.__mod('data/items.ts'), S = await window.__mod('systems/ItemStore.ts');
  s.campUI.setVisible(false); let grain = 500;
  const close = MS.openMerchantShop(s, { wallet: { name: '军粮', get: () => grain, spend: n => grain >= n ? (grain -= n, true) : false, gain: n => { grain += n; } }, tier: 0, chapter: 3 });
  await new Promise(r => setTimeout(r, 200)); const root = s.children.getByName('merchant-shop');
  window.__find(root, 'merchant-mode-sell').emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  const r2 = s.children.getByName('merchant-shop'); window.__find(r2, 'merchant-sell-item-' + u.blue).emit('pointerdown'); await new Promise(r => setTimeout(r, 60));
  window.__find(s.children.getByName('merchant-shop'), 'merchant-sell-go').emit('pointerdown'); await new Promise(r => setTimeout(r, 80));
  const out = { grain, want: 500 + I.sellPrice({ quality: 'blue' }, 3), gone: !S.loadItems().bag.some(i => i.uid === u.blue), purse: window.__find(s.children.getByName('merchant-shop'), 'merchant-purse')?.text };
  close(); return out;
}, [seed.uids]);
ck('营寨旅商（军粮）也能出售：蓝装卖出、军粮 + 第 3 章卖价、钱袋显示更新', camp.grain === camp.want && camp.gone && camp.purse === '军粮 ' + camp.want, camp);
ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
