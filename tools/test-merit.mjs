// 战功货币（2026-11-17 用户：「战功获得是击杀精英怪和 boss 获得」「残卷是需要去建筑换而不是自动换」）+ 正式模式武将等级入账。
// 电脑布局 1280×720。需要开发服务器 5173。用法：node tools/test-merit.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});

// 1) 正式模式（不带 ?dev=1）：打赢 1-1，武将经验入账、战功按击杀精英 / 首领入库，休整画面弹战报
await p.goto(base + '?autostart=1&layout=desktop', { timeout: 120000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const prod = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), hp = await window.__mod('/src/systems/HeroProgress.ts'), ms = await window.__mod('/src/systems/MasteryStore.ts');
  const flags = { dev: new URLSearchParams(location.search).get('dev'), dm: s.debugModified, dj: s.debugJumped, imm: s.player.damageImmune };
  const before = hp.heroInfo('zhaoyun').level, merit0 = ms.merit();
  // 真实击杀两名精英、一名首领（走 killEnemy，计数器由游戏自己加）
  for (const kind of ['elite', 'elite']) { const e = s.spawnEnemy(kind, s.player.x + 300, s.player.y, 1, true); e.hp = 0; s.killEnemy(e); }
  s.player.runXp = 200; s.bossKilled = true; s.runMerit.boss++; s.finish(true, 'boss');
  const body = s.resultTexts.body.text.split('\n');
  return { flags, before, after: hp.heroInfo('zhaoyun').level, merit: ms.merit() - merit0, hero: body.find(l => l.startsWith('武将等级')), line: body.find(l => l.startsWith('本场战功')), auto: body.some(l => /战功\s+\+\d+ 级/.test(l)), mode: s.mode };
});
ck('正式模式：调试标记都没有误置（dev / debugModified / debugJumped / damageImmune）', !prod.flags.dev && !prod.flags.dm && !prod.flags.dj && !prod.flags.imm, prod.flags);
ck('正式模式打赢 1-1：武将等级入账，结算写「武将等级 Lv.x → Lv.y」', prod.after > prod.before && /Lv\.1 → Lv\.\d/.test(prod.hero ?? ''), prod);
ck('战功只来自击杀精英 / 首领：精英 2 × 1 + 首领 1 × 10 = 12，存进存档；结算写「本场战功 +12（精英 2 · 首领 1）」；不再按等级自动换残卷', prod.merit === 12 && /本场战功\s+\+12（精英 2 · 首领 1）/.test(prod.line ?? '') && !prod.auto, prod);
await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene').children.getByName('rest-summary'), null, { timeout: 20000, polling: 100 });
const sum = await p.evaluate(() => window.__game.scene.getScene('GameScene').children.getByName('rest-summary').text);
ck('第一章各关打赢直接进休整：入营过场后弹「战报」，看得到武将等级与战功', /武将等级/.test(sum) && /本场战功/.test(sum), sum);
await p.screenshot({ path: 'assets/review/merit-rest-summary-1280x720.png' });

// 2) 讲武堂：战功换武学残卷，可选数量
const city = await p.evaluate(async () => {
  const ms = await window.__mod('/src/systems/MasteryStore.ts'), md = await window.__mod('/src/data/merit.ts'), out = { per: md.MERIT.perScroll, elite: md.MERIT.elite, boss: md.MERIT.boss };
  ms.addMerit(35 - ms.merit()); out.merit0 = ms.merit(); out.scroll0 = ms.scrolls();
  window.__game.scene.getScenes(true).forEach(sc => { if (sc.sys.settings.key !== 'CityScene') window.__game.scene.stop(sc.sys.settings.key); });
  window.__game.scene.start('CityScene'); await new Promise(r => setTimeout(r, 2500));
  const c = window.__game.scene.getScene('CityScene'); c.openMeritExchange(); await new Promise(r => setTimeout(r, 200));
  const root = () => c.children.getByName('town-merit'), tap = n => window.__find(root(), n)?.emit('pointerdown');
  out.have = window.__find(root(), 'merit-have')?.text;
  tap('merit-max'); await new Promise(r => setTimeout(r, 100)); out.maxQty = window.__find(root(), 'merit-qty')?.text;
  tap('merit-minus'); await new Promise(r => setTimeout(r, 100)); out.qty = window.__find(root(), 'merit-qty')?.text;
  tap('merit-exchange'); await new Promise(r => setTimeout(r, 150)); out.msg = window.__find(root(), 'merit-msg')?.text;
  out.merit1 = ms.merit(); out.scroll1 = ms.scrolls();
  out.fail = ms.exchangeMerit(5).ok;
  return out;
});
ck('数值写在 data/merit.ts（精英 +1、首领 +10、10 战功换 1 残卷，待复核）', city.per === 10 && city.elite === 1 && city.boss === 10, city);
ck('讲武堂「战功换残卷」：显示现有战功与残卷，「最多」= 3 张，减到 2 张兑换：战功 35 → 15、残卷 +2', /战功 35/.test(city.have ?? '') && /× 3/.test(city.maxQty ?? '') && /× 2/.test(city.qty ?? '') && city.merit1 === 15 && city.scroll1 - city.scroll0 === 2 && /残卷 ×2/.test(city.msg ?? ''), city);
ck('战功不足时不能换', city.fail === false, city);
await p.screenshot({ path: 'assets/review/merit-academy-exchange-1280x720.png' });

const academy = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); c.children.getByName('town-merit')?.destroy(); return typeof c.openMeritExchange === 'function'; });
ck('控制台无报错', errors.length === 0 && academy, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
