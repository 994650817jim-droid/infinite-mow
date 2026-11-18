// 行营休整（本关已结算、正式模式）在军需商人买的兵装立即收入行囊，休整中打开行囊能看到（2026-11-18 用户报「休整买的装备背包没显示」）。
// 需要开发服务器 5173。用法：node tools/test-camp-buy-bag.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(() => {
  window.__find = (root, name) => { const list = root.list ?? root.getChildren?.() ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; };
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {}, autoSalvageWhite: false })); sessionStorage.setItem('seeded', '1'); }
});
// 正式模式（不带 ?dev=1），否则按测试战斗规则不入行囊
await p.goto(base + '?autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 30000 });
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, out = {};
  const st = await window.__mod('/src/systems/ItemStore.ts');
  s.over = true; s.legion.food = 500; // 模拟本关已结算、进入行营休整
  ui.open('test-rest-' + Date.now(), '测试'); ui.setVisible(true); ui.tab = 2; ui.render?.();
  await new Promise(r => setTimeout(r, 150));
  const item = ui.itemOffers[0], before = st.loadItems().bag.length, loot = s.itemDrops?.runLoot.length ?? 0;
  window.__find(ui.root, 'camp-item-goods-0')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 100));
  out.inBag = st.loadItems().bag.some(i => i.uid === item.uid); out.bagDelta = st.loadItems().bag.length - before; out.lootDelta = (s.itemDrops?.runLoot.length ?? 0) - loot;
  out.notice = ui.detail?.text;
  s.openBattleBag(true); await new Promise(r => setTimeout(r, 300));
  const bag = s.children.getByName('item-bag'); out.bagOpen = !!bag;
  out.shown = [...Array(20).keys()].some(i => window.__find(bag, 'item-cell-' + i)?.getData('uid') === item.uid);
  return out;
});
ck('休整时买下的兵装立即进行囊（不再推进已结算的本局缴获）', r.inBag && r.bagDelta === 1 && r.lootDelta === 0, r);
ck('购入提示写「已收入行囊」', /已收入行囊/.test(r.notice ?? ''), r.notice);
ck('休整中打开行囊能看到刚买的兵装', r.bagOpen && r.shown, r);
ck('控制台无报错', errors.length === 0, errors);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
