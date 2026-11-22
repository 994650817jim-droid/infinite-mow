// 战法流派重做第 4 期（2026-11-19）验收：军需商人「流派心法」+ 武将谱「流派亲和」页。电脑布局，需要开发服务器。
// 检查：
//  1. 商人：势最高那派到 2 势、没研读过时会出该派心法（比战法贵）；研读过就不再出那派；
//  2. 研读：本局构筑该派 +1 势、存进构筑快照（换关带着），读档还原；同一派不能研读两次；
//  3. 武将谱「流派亲和」页：本将亲和、六派三档、势的来源、十二将亲和表；
//  4. 截图（轻测试 2 张）：商人心法卡、流派亲和页。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-schools-p4.mjs   → assets/review/schools/{merchant-manual,codex-affinity}.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/schools'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.waitForTimeout(1500);

// 1. 商人出心法
const roll = await p.evaluate(async () => {
  const cm = await window.__mod('systems/CampMarket.ts'), lv = { ember: 2, spread: 1, chain: 1 };
  const book = read => ({ canLearn: id => (lv[id] ?? 0) < 3, level: id => lv[id] ?? 0, manualsRead: () => read });
  let manual = 0, fire = 0, other = 0, n = 0, price = 0, tacPrice = 0;
  for (let i = 0; i < 2000; i++) { const o = cm.rollMerchantTactic(book([]), Math.random, 1); if (!o) continue; n++; if (o.kind === 'manual') { manual++; price = o.price; if (o.school === 'fire') fire++; else other++; } else tacPrice = Math.max(tacPrice, o.price); }
  let again = 0; for (let i = 0; i < 2000; i++) { const o = cm.rollMerchantTactic(book(['fire']), Math.random, 1); if (o?.kind === 'manual') again++; }
  return { rate: manual / n, fire, other, price, tacPrice, again };
});
ck('商人：火攻 3 势时约 30% 换成「火攻心法」（只出势最高那派），比战法贵', roll.rate > .2 && roll.rate < .4 && roll.other === 0 && roll.price > roll.tacPrice, roll);
ck('研读过火攻心法：不再出火攻心法', roll.again === 0, roll.again);

// 2. 研读、存档、读档
const learn = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), cm = await window.__mod('systems/CampMarket.ts'), builds = await window.__mod('data/builds.ts');
  const b = s.player.growth.build; b.tactics = { ember: 2, spread: 1 }; b.manuals = []; const before = b.tags().fire;
  const opt = cm.campOption({ id: 'manual', kind: 'manual', school: 'fire', level: 0, price: 320, sold: false }, s.player); opt.apply(s.player, s.player.weapons, s.player.growth);
  const after = b.tags().fire, again = cm.campOption({ id: 'manual', kind: 'manual', school: 'fire', level: 0, price: 320, sold: false }, s.player);
  const snap = b.snapshot(), copy = new builds.BuildState(); copy.restore(JSON.parse(JSON.stringify(snap)));
  return { before, after, again: !!again, snap, restored: copy.tags().fire, src: b.sources('fire'), name: opt.name, desc: opt.desc };
});
ck('研读火攻心法：火攻势 +1、来源记「心法」；同一派不能再研读', learn.after === learn.before + 1 && learn.src.manual === 1 && !learn.again, learn);
ck('心法存进构筑快照，读档还原（换关带着）', learn.snap.manuals?.includes('fire') && learn.restored === learn.after, learn.snap);

// 截图 1：营寨旅商摊位上的心法卡
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), ms = await window.__mod('systems/MerchantStock.ts'), shop = await window.__mod('ui/MerchantShop.ts');
  s.setMode?.('pause'); const st = ms.currentMerchantStock(1); st.tactic = { id: 'manual', kind: 'manual', school: 'warrior', level: 0, price: 320, sold: false }; ms.saveMerchantStock(st);
  let food = 900; window.__closeShop = shop.openMerchantShop(s, { wallet: { name: '钱币', get: () => food, spend: n => (food -= n, true) }, tier: 1, hero: 'zhaoyun' });
});
await p.waitForTimeout(900);
const card = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), out = {}; const walk = l => { for (const o of l) { if (o.name?.startsWith('camp-tactic')) out[o.name] = o.text ?? ''; if (o.list) walk(o.list); } }; walk(s.children.list); return out; });
await p.screenshot({ path: `${OUT}/merchant-manual.png` });
ck('商人心法卡：写「猛将 · 流派心法」「猛将心法」、效果「本次征程猛将势 +1」，按钮写研读 / 价钱', /流派心法/.test(card['camp-tactic-school'] ?? '') && /猛将心法/.test(card['camp-tactic-name'] ?? '') && /势 \+1/.test(card['camp-tactic-desc'] ?? ''), card);
await p.evaluate(() => window.__closeShop?.());

// 3. 武将谱「流派亲和」页（截图 2）
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), m = await window.__mod('ui/HeroCodexUI.ts');
  window.__codex = new m.HeroCodexUI(s, 'zhaoyun'); window.__codex.tab = 'schools'; window.__codex.render();
});
await p.waitForTimeout(700);
const page = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), out = {}; const walk = l => { for (const o of l) { if (o.name && /codex-(schools|school-|aff-|tab-schools)/.test(o.name)) out[o.name] = o.text ?? ''; if (o.list) walk(o.list); } }; walk(s.children.list); return out; });
await p.screenshot({ path: `${OUT}/codex-affinity.png` });
ck('流派亲和页：赵云亲和骑突 · 猛将；六派都列出；势的来源写到「流派心法」；十二将亲和表', /骑突 · 猛将/.test(page['codex-schools-affinity'] ?? '') && ['fire', 'stratagem', 'archery', 'cavalry', 'warrior', 'formation'].every(k => page['codex-school-' + k] !== undefined) && /流派心法/.test(page['codex-schools-sources'] ?? '') && Object.keys(page).filter(k => k.startsWith('codex-aff-')).length >= 12, page);
ck('无页面报错', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
