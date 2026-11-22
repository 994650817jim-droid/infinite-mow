// 营寨旅商（用户 2026-11-18：「营寨增加个旅商就是军需商人」）：营寨里有「旅商」货摊，点开是军需商人面板；
// 与行营休整同一个商人、同一份货（ui/MerchantShop、systems/MerchantStock）：用营寨军粮买、买下进行囊；营寨里不换货、已售不补（刷不出货），打赢新一关的休整才换。电脑布局 960×540，截图到 assets/review/camp-full/merchant-*.png。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-camp-merchant.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/camp-full';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
let pass = 0, fail = 0; const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + m); };
await p.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_city_intro_v3', '1'); localStorage.setItem('im_mount_guide_v1', '1'); sessionStorage.setItem('seeded', '1'); });
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
const world = patch => p.evaluate(async patch => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); Object.assign(s, patch.set ?? {}); if (patch.huangjin) s.cleared.huangjin = true; if (patch.hulao) s.cleared.hulao = true; if (patch.receipt) s.receipts.push({ id: patch.receipt, merits: 0, provisions: 0 }); localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1'); }, patch);
const enterCamp = async () => {
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('CityScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').hits?.length, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.mountGuide?.stop?.(); });
};
const stock = () => p.evaluate(() => JSON.parse(localStorage.getItem('im_merchant_v1') ?? 'null'));
const food = () => p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions);
const bagUids = () => p.evaluate(async () => (await import('/src/systems/ItemStore.ts')).loadItems().bag.map(i => i.uid));
const openStall = () => p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), h = c.hits.find(x => x.name === 'bld-merchant'); h.emit('pointerdown'); h.emit('pointerup'); });
const panel = () => p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), m = c.children.getByName('merchant-shop'); if (!m) return null; const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.list);
  return { names: all.filter(o => /camp-item-name-/.test(o.name)).map(o => o.text), buy: all.filter(o => /camp-item-goods-/.test(o.name)).map(o => o.input?.enabled ?? false), art: !!all.find(o => o.name === 'camp-merchant-art'), purse: all.find(o => o.name === 'merchant-purse')?.text }; });
const buy = i => p.evaluate(i => { const c = window.__game.scene.getScene('CityScene'), m = c.children.getByName('merchant-shop'); const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.list); all.find(o => o.name === 'camp-item-goods-' + i).emit('pointerdown'); }, i);

// 1) 营寨档（第一章通关、未占城），军粮 800，还没打过仗
await world({ set: { yellowStages: 3, worldAvailable: true, provisions: 800, tutorialSeen: true, receipts: [] }, huangjin: true });
await enterCamp();
const stall = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), h = c.hits.find(x => x.name === 'bld-merchant'), tag = c.pano.getByName('merchant-stall')?.getByName('tag-merchant'), badge = c.pano.getByName('merchant-stall')?.getByName('merchant-badge');
  const hb = h?.getBounds(), cl = c.campLife, props = cl ? cl.root.list.filter(o => o.type === 'Image' && o.texture?.key === 'camp_props_v2') : [];
  const overlap = hb ? props.filter(o => { const r = o.getBounds(), dx = Math.min(r.right, hb.right) - Math.max(r.x, hb.x), dy = Math.min(r.bottom, hb.bottom) - Math.max(r.y, hb.y); return dx > 20 && dy > 20; }).length : -1;
  return { hit: !!h, tag: tag?.text, badge: !!badge, overlap, x: h?.x, y: h?.y }; });
ok(stall.hit && stall.tag === '旅商', '营寨有「旅商」货摊（点击区 bld-merchant + 名牌）' + JSON.stringify(stall));
ok(stall.badge, '货摊上挂军需商人头像牌（立绘裁脸）');
ok(stall.overlap === 0, '营寨装饰不压货摊（重叠件数 ' + stall.overlap + '）');
await p.evaluate(({ x, y }) => { const c = window.__game.scene.getScene('CityScene'); c.scrollTo(x - c.vr.w / 2, y - c.vr.h * .55, false); }, stall); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/merchant-stall.png` });
await openStall(); await p.waitForFunction(() => window.__game.scene.getScene('CityScene').children.getByName('merchant-shop'), null, { timeout: 15000 }); await p.waitForTimeout(500);
let pn = await panel(), st = await stock();
ok(pn && pn.names.length === 4 && pn.art && /钱币 800/.test(pn.purse), '点货摊打开军需商人（共用面板）：≥4 张货 + 立绘 ' + JSON.stringify(pn?.names));
ok(st && st.key === 'camp' && st.items.length === 4, '共用货架：还没进过行营时营寨摆一份（键 camp）');
await p.screenshot({ path: `${out}/merchant-panel.png` });
// 2) 买第 1 件：扣营寨军粮、进行囊、按钮变「已售罄」
const f0 = await food(), price = { green: 60, blue: 120, purple: 260 }[st.items[0].quality];
await buy(0); await p.waitForTimeout(300);
const f1 = await food(), bag1 = await bagUids(); st = await stock(); pn = await panel();
ok(f1 === f0 - price, `扣营寨钱币 ${f0} → ${f1}（价 ${price}）`);
ok(bag1.includes(st.items[0].uid), '买下的兵装进了行囊');
ok(st.sold[0] && !pn.buy[0], '第 1 件标为售罄、按钮不可点');
await buy(0); await p.waitForTimeout(200); ok(await food() === f1 && (await bagUids()).length === bag1.length, '再点售罄的不扣粮、不重复进包');
await p.screenshot({ path: `${out}/merchant-bought.png` });
// 3) 同一仗之间反复进出营寨：同一批货、卖掉的不补
const uids = st.items.map(o => o.uid);
await enterCamp(); await openStall(); await p.waitForTimeout(600);
let st2 = await stock(); pn = await panel();
ok(JSON.stringify(st2.items.map(o => o.uid)) === JSON.stringify(uids) && st2.sold[0], '重进营寨：同一批货，售出的仍售罄');
await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.isActive('CityScene'), null, { timeout: 120000 });
await enterCamp(); await openStall(); await p.waitForTimeout(600); st2 = await stock();
ok(JSON.stringify(st2.items.map(o => o.uid)) === JSON.stringify(uids) && st2.sold[0], '刷新页面再进：仍是同一批货');
// 4) 军粮不够：按钮禁用、点了不扣
await world({ set: { provisions: 30 } }); await enterCamp(); await openStall(); await p.waitForTimeout(600); pn = await panel();
ok(pn.buy.every(x => !x), '钱币 30：所有兵装购入按钮禁用');
await buy(1); await p.waitForTimeout(200); ok(await food() === 30 && !(await stock()).sold[1], '钱币不足时点击不扣粮、不售出');
await p.screenshot({ path: `${out}/merchant-poor.png` });
// 5) 打完一仗回营寨（世界存档多一条结算）营寨也不换货；打赢新一关进行营休整（新休整键）才换，回营寨看到的是新货
await world({ set: { provisions: 800 }, receipt: 'exp-test-1', hulao: true }); await enterCamp(); await openStall(); await p.waitForTimeout(600);
ok(JSON.stringify((await stock()).items.map(o => o.uid)) === JSON.stringify(uids), '只回营寨不换货（行营休整才换）');
await p.evaluate(async () => { const m = await import('/src/systems/MerchantStock.ts'); m.merchantStockForVisit('hulao-2', 1); });
await enterCamp(); await openStall(); await p.waitForTimeout(600);
const st3 = await stock(); pn = await panel();
ok(st3.key === 'hulao-2' && st3.items.every(o => !uids.includes(o.uid)) && pn.names.length >= 4 && pn.buy.slice(0, 4).every(x => x), '行营休整换货后营寨旅商卖的是同一批新货、都能买');
// 6) 关闭面板后能继续拖动全景（弹窗层级不残留）
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), m = c.children.getByName('merchant-shop'); const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.list); all.find(o => o.name === 'merchant-close').emit('pointerdown'); });
await p.waitForTimeout(200);
ok(await p.evaluate(() => !window.__game.scene.getScene('CityScene').children.getByName('merchant-shop') && !window.__game.scene.getScene('CityScene').anyModal()), '「离开」关闭面板，营寨恢复可平移');
ok(errors.length === 0, '无页面报错 ' + JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass}/${pass + fail} passed`);
await b.close(); process.exit(fail ? 1 : 0);
