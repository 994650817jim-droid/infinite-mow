// 行囊格子清晰度对比截图（电脑布局）：种白 / 绿 / 蓝 / 紫 / 橙各几件、1 件穿着、1 件首领遗珍、2 件本局缴获（「新」），打开行营行囊并悬停一格。
// 用法：BASE=http://127.0.0.1:5173/ node tools/shot-bag-cells.mjs <输出目录> <前缀>
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', dir = process.argv[2] ?? '.', pre = process.argv[3] ?? 'bag';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\/?(src\/)?/, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {} })); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 90000 });
await p.waitForTimeout(1200);
const hover = await p.evaluate(async () => {
  const I = await window.__mod('data/items.ts'), S = await window.__mod('systems/ItemStore.ts'), s = window.__game.scene.getScene('GameScene');
  let seed = 7; const rng = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const qs = ['white', 'green', 'blue', 'purple', 'orange', 'green', 'blue', 'white', 'purple', 'green'], slots = ['armor', 'helm', 'boots', 'token'];
  const items = qs.map((q, i) => I.rollItem(q, rng, slots[i % 4], 2)), relic = I.rollRelic('relic_jiujie', rng);
  S.addItems([...items, relic]); S.equipItem('zhaoyun', items[2].uid); S.equipItem('zhaoyun', relic.uid);
  // 本局缴获两件（「新」角标）
  const loot = [I.rollItem('blue', rng, 'boots', 2), I.rollItem('orange', rng, 'helm', 2)]; s.itemDrops?.runLoot.push(...loot);
  s.over = true; s.openBattleBag(true); await new Promise(r => setTimeout(r, 600));
  const bag = s.children.getByName('item-bag'), find = (c, n) => { for (const o of c.list ?? []) { if (o.name === n) return o; if (o.list) { const r = find(o, n); if (r) return r; } } return null; };
  const cell = find(bag, 'item-cell-3'), m = cell.getWorldTransformMatrix(), cam = s.cameras.main, z = cam.zoom, sc = window.__game.canvas.getBoundingClientRect().width / window.__game.canvas.width;
  return { x: m.tx * z * sc, y: m.ty * z * sc };
});
await p.screenshot({ path: `${dir}/${pre}-grid.png` });
// 悬停第 4 格（直接发 pointerover；提示框按格子定位，与指针位置无关）
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), bag = s.children.getByName('item-bag'), find = (c, n) => { for (const o of c.list ?? []) { if (o.name === n) return o; if (o.list) { const r = find(o, n); if (r) return r; } } return null; }; find(bag, 'item-cell-3')?.emit('pointerover', { x: 0, y: 0, worldX: 0, worldY: 0 }); });
await p.waitForTimeout(400); void hover;
await p.screenshot({ path: `${dir}/${pre}-hover.png` });
await b.close();
