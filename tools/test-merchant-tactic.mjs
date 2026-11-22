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
  const fromSix = new Set(), lvls = new Set(); let sixManual = 0; for (let i = 0; i < 2000; i++) { const o = M.rollMerchantTactic(book(six), rng, 1); if (o?.kind === 'manual') sixManual++; else if (o) { fromSix.add(o.id); lvls.add(o.level); } }
  const full = Object.fromEntries(ids.slice(0, 6).map(id => [id, 3])); let fullHit = 0, fullManual = 0; for (let i = 0; i < 500; i++) { const o = M.rollMerchantTactic(book(full), rng, 1); if (o?.kind === 'manual') fullManual++; else if (o) fullHit++; }
  const one = M.rollMerchantTactic(book({ [ids[0]]: 1 }), () => .0, 1);
  return { chance: I.MERCHANT_TACTIC.chance, price: I.MERCHANT_TACTIC.price, rate: hit / N, kinds: kinds.size, total: ids.length, fromSix: [...fromSix], lvls: [...lvls], six, fullHit, fullManual, sixManual, one };
});
ck('出现概率按配置（' + r.chance + '）：6000 次进营实测 ' + (r.rate * 100).toFixed(1) + '%', Math.abs(r.rate - r.chance) < .025, { rate: r.rate, chance: r.chance });
ck('空构筑时所有战法都可能出现', r.kinds === r.total, { kinds: r.kinds, total: r.total });
const sixOk = r.fromSix.length === 2 && r.fromSix.every(id => r.six[id] < 3) && r.lvls.every(l => l === 1 || l === 2);
// 2026-11-20：流派重做后，势够高时货架可能是「流派心法」（kind manual），不算战法卷轴，单独统计
ck('已学满 6 种：战法卷轴只出已学且未满 3 级的（精进），不出新战法、不出满级的（另可出流派心法）', sixOk, { fromSix: r.fromSix, lvls: r.lvls, manual: r.sixManual });
ck('6 种都满 3 级：不再出战法卷轴（只可能出流派心法）', r.fullHit === 0, { tactic: r.fullHit, manual: r.fullManual });
ck('价格按已学等级取 price[等级]（精进 Lv.1→2 收 price[1]）', r.one?.level === 1 && r.one?.price === r.price[1], r.one);
// 主修两派（11-20「关于流派也是最多往两个流派发展」）：真构筑学了火攻、弓弩后，商人不再捎第三派的战法卷轴 / 心法
const mj = await p.evaluate(async () => {
  const M = await window.__mod('systems/CampMarket.ts'), B = await window.__mod('data/builds.ts');
  const b = new B.BuildState(); b.learn('ember'); b.learn('ember'); b.learn('eagle'); b.learn('eagle');
  const book = { level: id => b.rank(id), canLearn: id => b.canLearn(id), manualsRead: () => b.manuals, canManual: sc => b.canManual(sc) };
  const seen = {}; let n = 0; for (let i = 0; i < 3000; i++) { const o = M.rollMerchantTactic(book, Math.random, 1); if (!o) continue; n++; const sc = o.kind === 'manual' ? 'manual:' + o.school : B.tacticSchool(o.id) ?? 'general'; seen[sc] = (seen[sc] ?? 0) + 1; }
  return { majors: b.majors(), seen, n };
});
ck('主修火攻 · 弓弩：3000 次进营，商人只捎这两派（或通用）的战法 / 心法，没有第三派', mj.n > 0 && Object.keys(mj.seen).every(k => /^(manual:)?(fire|archery|general)$/.test(k)), mj);

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
ck('买下：立即学会（Lv.0→1）、扣随军钱币 = 标价、标为已售', buy1.before === 0 && buy1.after === 1 && buy1.food0 - buy1.food1 === o1.offer.price && buy1.sold, buy1);
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
ck('随军钱币不足：按钮不可点、买不了、不扣粮', !poor.interactive && !poor.ok && poor.same && poor.food === 10, poor);

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
  const close = MS.openMerchantShop(s, { wallet: { name: '钱币', get: () => grain, spend: n => grain >= n ? (grain -= n, true) : false }, tier: 0, onBuyItem: it => bought.push(it.uid) });
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
ck('营寨旅商用调用方给的钱包（钱币）、买下回调收货', shared.bought === 1 && shared.grain < 1000 && /^钱币 \d+/.test(shared.purse ?? ''), shared);
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
  let grain = 1000; const w = { name: '钱币', get: () => grain, spend: n => grain >= n ? (grain -= n, true) : false };
  let close = MS.openMerchantShop(s, { wallet: w, tier: 0, hero: 'zhaoyun' }); await new Promise(r => setTimeout(r, 200));
  let btn = window.__find(s.children.getByName('merchant-shop'), 'camp-tactic-buy'); out.noBuildEnabled = !!btn?.input?.enabled; const deep = c => (c.list ?? []).flatMap(o => [o, ...deep(o)]); out.noBuildLabel = deep(s.children.getByName('merchant-shop')).find(o => typeof o.text === 'string' && /研习/.test(o.text))?.text; close();
  localStorage.setItem(C.CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes: { zhaoyun: { character: 'zhaoyun', player: { build: { tactics: { deflect: 1 } }, weapons: [] }, army: { food: 300 } } } }));
  close = MS.openMerchantShop(s, { wallet: w, tier: 0, hero: 'zhaoyun' }); await new Promise(r => setTimeout(r, 200));
  window.__find(s.children.getByName('merchant-shop'), 'camp-tactic-buy').emit('pointerdown');
  out.saved = JSON.parse(localStorage.getItem(C.CAMPAIGN_KEY)).heroes.zhaoyun.player.build.tactics; out.grain = grain; out.sold = ST.currentMerchantStock(0).tactic.sold; close(); return out;
});
ck('营寨旅商：武将还没有征程构筑时卷轴不能买（显示「出征后可研习」）', !camp.noBuildEnabled && /出征后可研习/.test(camp.noBuildLabel ?? ''), camp);
ck('营寨旅商：买下战法写进征程构筑（下次出征带上）、扣钱币、标已售', camp.saved?.rally === 1 && camp.saved?.deflect === 1 && camp.grain === 850 && camp.sold, camp);

// 人物名牌与对话气泡（「对话框要优化一下」）：漆匾名牌 + 朱印 + 头顶宣纸气泡，台词几秒一换，鼠标移到人物上换下一句
const talk = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; ui.open('test-talk-' + Math.random(), '测试'); ui.setVisible(true); ui.tab = 2; ui.tacticOffer = null; ui.render();
  await new Promise(r => setTimeout(r, 600)); ui.render();
  const f = n => window.__find(ui.root, n), line = f('camp-merchant-art-line'), out = { plate: !!f('camp-merchant-art-plate'), seal: !!f('camp-merchant-art-seal'), bubble: !!f('camp-merchant-art-bubble'), name: f('camp-merchant-art-name')?.text, first: line?.text };
  const art = f('camp-merchant-art'), bub = f('camp-merchant-art-bubble'); out.bubbleAboveHead = bub && art && bub.y < art.y - art.displayHeight + 40; out.bubbleClearOfCards = bub && bub.x + bub.displayWidth <= 236;
  await new Promise(r => setTimeout(r, 6400)); out.later = f('camp-merchant-art-line')?.text; out.alpha = f('camp-merchant-art-line')?.alpha;
  f('camp-merchant-art').emit('pointerover'); await new Promise(r => setTimeout(r, 1200)); out.hovered = f('camp-merchant-art-line')?.text;
  out.lines = f('camp-merchant-art-line')?.getData('lines');
  ui.tab = 4; ui.render(); await new Promise(r => setTimeout(r, 600)); ui.render(); out.medic = { plate: !!f('camp-medic-art-plate'), bubble: !!f('camp-medic-art-bubble'), line: f('camp-medic-art-line')?.text };
  return out;
});
ck('人物名牌：漆匾 + 朱印 + 名字；头顶有宣纸对话气泡（不压到卡片）', talk.plate && talk.seal && talk.bubble && talk.name === '军需商人' && talk.bubbleAboveHead && talk.bubbleClearOfCards, talk);
ck('台词几秒一换（淡出淡入后完全显示），鼠标移到人物上换下一句；军医同款', talk.lines?.includes(talk.first) && talk.later !== talk.first && talk.alpha === 1 && talk.hovered !== talk.later && talk.medic.plate && talk.medic.bubble && !!talk.medic.line, talk);

// 卷轴卡排版：所有战法 × 新学 / 精进 1→2 / 2→3 都放得下（效果整句不截断、不压到冷却行、字号 ≥ 10），悬停看完整说明
const fit = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, B = await window.__mod('data/builds.ts'), MS = await window.__mod('ui/MerchantShop.ts');
  s.legion.food = 500; ui.open('test-fit-' + Math.random(), '测试'); ui.tab = 2; const bad = []; let n = 0, tip = null;
  for (const id of Object.keys(B.TACTICS)) for (const level of [0, 1, 2]) {
    ui.tacticOffer = { id, kind: 'tactic', level, price: 150, sold: false }; ui.render(); n++;
    const f = name => window.__find(ui.root, name), desc = f('camp-tactic-desc'), cd = f('camp-tactic-cd'), card = f('camp-tactic-card'), badge = f('camp-tactic-badge');
    const want = MS.tacticCardText(id, level + 1), size = parseFloat(desc.style.fontSize), lines = desc.getWrappedText().join('');
    const cardRight = card.x + card.displayWidth / 2;
    const problem = [];
    if (desc.y + desc.height > desc.getData('limit') + .5) problem.push('溢出 ' + Math.round(desc.y + desc.height - desc.getData('limit')) + 'px');
    if (lines.replace(/\s/g, '') !== want.effect.replace(/\s/g, '')) problem.push('文字被截');
    if (size < 10) problem.push('字号 ' + size);
    if (!/。$/.test(want.effect) && /。/.test(B.tacticDescription(id, level + 1))) problem.push('效果不是整句');
    if (desc.x + desc.width > cardRight) problem.push('超出右边');
    if (!cd || cd.y < desc.y + desc.height) problem.push('冷却行被压');
    if (badge?.text !== (level ? '精进' : '新学')) problem.push('漆牌');
    if (problem.length) bad.push(id + ' Lv' + (level + 1) + '：' + problem.join('、'));
    if (id === 'traction' && level === 0) { const h = f('camp-tactic-hover'); h.emit('pointerover', { x: 600, y: 300 }); const t = s.children.list.find(o => o.name === 'item-tooltip' && o.visible); tip = t ? t.list.filter(o => typeof o.text === 'string').map(o => o.text).join(' | ') : null; h.emit('pointerout'); }
  }
  return { n, bad, tip };
});
ck('卷轴卡：全部 ' + fit.n + ' 种（战法 × 新学 / 精进）效果整句放得下、不截断、不压冷却行、字号 ≥ 10、漆牌对', fit.n >= 75 && fit.bad.length === 0, fit.bad.slice(0, 8));
ck('卷轴卡悬停看完整说明（牵机：含「对首领无效」）', /对首领无效/.test(fit.tip ?? '') && /牵机/.test(fit.tip ?? ''), fit.tip);

// 存档点同步
const save = await p.evaluate(async () => {
  const C = await window.__mod('systems/Campaign.ts');
  localStorage.setItem(C.CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes: { zhaoyun: { character: 'zhaoyun', player: { build: { tactics: { deflect: 1 } }, weapons: [] }, army: { food: 300 } } } }));
  C.patchCampaignTactics('zhaoyun', { deflect: 2, rally: 1 }, 110);
  const v = JSON.parse(localStorage.getItem(C.CAMPAIGN_KEY)).heroes.zhaoyun; return { tactics: v.player.build.tactics, food: v.army.food };
});
ck('买下后改存档点：战法与随军钱币同步（关页面再进不丢、不退粮）', save.tactics.deflect === 2 && save.tactics.rally === 1 && save.food === 110, save);
ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
