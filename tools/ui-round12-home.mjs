// 主页精简 + 章节选择（电脑 1280×720 / 1920×1080）。存档：新档、打到第五章（赤壁打完 1 关）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round12-home.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round12';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const MID = { version: 10, buildings: { barracks: 1, farm: 1, clinic: 1 }, cities: {}, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true } };
for (const [save, label] of [[null, 'fresh'], [MID, 'mid']]) for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(s => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); if (s) { localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 })); } }, save);
  await p.goto(`${base}?layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') && window.__game.scene.getScene('MenuScene').startButton, null, { timeout: 90000 }); await p.waitForTimeout(1800);
  const texts = await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.list.filter(o => o.type === 'Text' && o.visible && o.alpha > 0).map(o => o.text).filter(t => t && t.length > 1));
  console.log(label, vp.width, 'texts', texts.length, JSON.stringify(texts).slice(0, 400));
  await p.screenshot({ path: `${out}/${tag}-home-${label}-${vp.width}x${vp.height}.png` });
  // 点「匡扶汉室」
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown')); await p.waitForTimeout(1200);
  const sel = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), r = m?.children.getByName('chapter-select'); if (!r) return { open: false, scene: window.__game.scene.getScenes(true).map(s => s.scene.key) };
    const cards = []; const walk = l => { for (const o of l) { if (/^chapter-card-/.test(o.name ?? '')) cards.push({ n: o.name, locked: !!o.getData('locked'), on: !!o.input?.enabled }); if (o.list) walk(o.list); } }; walk(r.list); return { open: true, cards }; });
  if (tag !== 'before') {
    ck(`${label} ${vp.width}×${vp.height}：点「匡扶汉室」打开章节选择，12 章`, sel.open && sel.cards?.length === 12, sel);
    const open = (sel.cards ?? []).filter(c => !c.locked).length;
    ck(`${label} ${vp.width}×${vp.height}：已打到的章节可点，未打到的锁住`, label === 'fresh' ? open === 1 : open === 5, sel.cards?.map(c => c.n + (c.locked ? '🔒' : '')));
  }
  await p.screenshot({ path: `${out}/${tag}-select-${label}-${vp.width}x${vp.height}.png` });
  await ctx.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
