// 点将（主公）页：字体统一、提示移出卷轴区、按钮 / 页码不压卷轴（电脑 1280×720 / 1920×1080）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round13-picker.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round13';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.goto(`${base}?layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.heroPicker, null, { timeout: 90000 }); await p.waitForTimeout(1000);
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.ensureHomeArt?.(true); m.heroPicker.open(1); }); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').heroPicker.open(1)); await p.waitForTimeout(400);
  const lay = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), r = m.heroPicker.root, box = o => { const g = o.getBounds(); return { n: o.name || o.text || o.type, x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }; };
    const cards = r.list.filter(o => /^pick-/.test(o.name ?? '') && o.visible).map(o => { const h = o.list.find(x => x.type === 'Rectangle'); const g = h.getBounds(); return { n: o.name, x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }; });
    const texts = r.list.filter(o => o.type === 'Text' && o.visible && o.text).map(o => ({ ...box(o), t: o.text, font: o.style.fontFamily.split(',')[0], color: o.style.color, bg: o.style.backgroundColor }));
    const hit = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
    const ov = []; for (const t of texts) for (const c of cards) if (hit(t, c)) ov.push(t.t.slice(0, 10) + '×' + c.n);
    for (const n of ['hero-picker-close', 'hero-confirm']) { const o = r.list.find(x => x.name === n); if (o) for (const c of cards) if (hit(box(o), c)) ov.push(n + '×' + c.n); }
    return { cards: cards.length, texts, ov };
  });
  console.log(vp.width, JSON.stringify(lay.texts.map(t => `${t.t}|${t.font}|${t.color}${t.bg ? '|bg' : ''}`)));
  if (tag !== 'before') {
    ck(`${vp.width}×${vp.height} 文字 / 按钮都不压卷轴`, lay.cards === 4 && !lay.ov.length, lay.ov);
    ck(`${vp.width}×${vp.height} 提示没有暗底块`, !lay.texts.some(t => t.bg), lay.texts.filter(t => t.bg).map(t => t.t));
  }
  await p.screenshot({ path: `${out}/${tag}-picker-${vp.width}x${vp.height}.png` });
  await ctx.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
