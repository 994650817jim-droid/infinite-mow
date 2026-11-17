// 行囊美术重设计（电脑 1280×720）：主页行囊（关羽穿戴）、悬停卡、详情卡、马厩、战斗中行囊；并检查版面不重叠。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round11-bag.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round11';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use: troop_portrait/.test(m.text())) errors.push(m.text()); });
await p.goto(`${base}?dev=1&layout=desktop`);
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(1000);
const find = `const find = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = find(o, n); if (x) return x; } return null; };`;
// 种一批兵装：关羽穿 4 件 + 赤兔，行囊里各品质若干
await p.evaluate(async () => {
  localStorage.setItem('im_chapter1_cleared', 'true');
  const st = await import('/src/systems/ItemStore.ts'), it = await import('/src/data/items.ts');
  st.resetItemCache?.(); st.setAutoSalvageWhite(false);
  const q = ['orange', 'purple', 'blue', 'green', 'white'], add = [];
  for (let i = 0; i < 26; i++) add.push(it.rollItem(q[i % 5]));
  for (const slot of it.SLOT_ORDER.filter(x => x !== 'relic')) add.push(it.rollItem(slot === 'boots' ? 'orange' : 'blue', Math.random, slot));
  st.addItems(add);
  for (const slot of it.SLOT_ORDER.filter(x => x !== 'relic')) { const x = st.loadItems().bag.find(i => it.itemSlot(i) === slot && !st.equippedBy(st.loadItems(), i.uid)); if (x) st.equipItem('guanyu', x.uid); }
  try { st.grantHorse('chitu'); st.rideHorse('guanyu', 'chitu'); } catch { /* 马厩未开 */ }
});
const open = () => p.evaluate(async () => { const m = window.__game.scene.getScene('MenuScene'), U = await import('/src/ui/ItemBagUI.ts'); m.children.getByName('item-bag')?.getData('ui')?.close(); new U.ItemBagUI(m, { hero: 'guanyu' }); });
await open(); await p.waitForTimeout(1500); await open(); await p.waitForTimeout(500); // 第一次会按需加载立绘 / 头像 / 卷轴纸
const lay = await p.evaluate(new Function(`return (() => { ${find}
  const m = window.__game.scene.getScene('MenuScene'), bag = m.children.getByName('item-bag'), body = bag.list[0];
  const box = o => { const g = o.getBounds(); return { n: o.name, x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }; };
  const all = []; const walk = l => { for (const o of l) { if (/^item-(slot|cell|hero|filter)-/.test(o.name ?? '') && o.visible !== false) all.push(box(o)); if (o.list && !/^item-(slot|cell)-/.test(o.name ?? '')) walk(o.list); } }; walk(body.list);
  const hit = (a, c) => a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1, ov = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (hit(all[i], all[j])) ov.push(all[i].n + '×' + all[j].n);
  return { n: all.length, ov, out: all.filter(a => a.x < 0 || a.y < 0 || a.x + a.w > 960 || a.y + a.h > 540).map(a => a.n), portrait: !!find(body, 'item-portrait'), medals: all.filter(a => /^item-hero-/.test(a.n)).length, slots: all.filter(a => /^item-slot-(?!label)/.test(a.n)).map(a => a.n) };
})()`));
ck('将印、槽位、筛选、行囊格互不重叠，都在屏幕内', lay.n > 20 && !lay.ov.length && !lay.out.length, lay);
ck('立绘居中（全身厚涂）、7 个槽位、圆形将印', lay.portrait && lay.slots.length === 7 && lay.medals >= 4, { slots: lay.slots, medals: lay.medals });
await p.screenshot({ path: `${out}/${tag}-desktop-bag.png` });
// 悬停卡
const pos = await p.evaluate(new Function(`return (() => { ${find} const m = window.__game.scene.getScene('MenuScene'), bag = m.children.getByName('item-bag'), c = find(bag, 'item-cell-2'), r = document.querySelector('canvas').getBoundingClientRect(), k = r.width / 960, g = c.getBounds(); return { x: r.x + (g.x + g.width / 2) * k, y: r.y + (g.y + g.height / 2) * k }; })()`));
await p.mouse.move(pos.x, pos.y); await p.waitForTimeout(300);
const tip = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), t = m.children.getByName('item-tooltip'); return { vis: !!t?.visible, name: t?.list.find(o => o.name === 'item-tooltip-name')?.text }; });
ck('悬停显示属性卡（品质色顶带 + 名字）', tip.vis && !!tip.name, tip);
await p.screenshot({ path: `${out}/${tag}-desktop-bag-hover.png` });
await p.mouse.move(5, 5);
// 详情卡
await p.evaluate(new Function(`return (() => { ${find} const m = window.__game.scene.getScene('MenuScene'), c = find(m.children.getByName('item-bag'), 'item-cell-0'); c.emit('pointerdown'); c.emit('pointerup'); })()`)); await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/${tag}-desktop-bag-detail.png` });
await p.evaluate(new Function(`return (() => { ${find} const m = window.__game.scene.getScene('MenuScene'); find(m.children.getByName('item-bag'), 'item-detail-close')?.emit('pointerdown'); })()`)); await p.waitForTimeout(200);
// 换个武将（将印）
await p.evaluate(new Function(`return (() => { ${find} const m = window.__game.scene.getScene('MenuScene'); find(m.children.getByName('item-bag'), 'item-hero-zhaoyun')?.emit('pointerdown'); })()`)); await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/${tag}-desktop-bag-zhaoyun.png` });
// 战斗中行囊
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(800);
await p.evaluate(() => window.__game.scene.getScene('GameScene').openBattleBag()); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/${tag}-desktop-battle-bag.png` });
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
