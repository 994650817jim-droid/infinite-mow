// 武将谱「战法心得」页（电脑 1280×720 / 960×540）：分类名与战法卡不重叠、字号统一、三种状态、悬停说明。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round10-xinde.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round10';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
for (const vp of [{ width: 1280, height: 720 }, { width: 960, height: 540 }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use: troop_portrait/.test(m.text())) errors.push(m.text()); });
  await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(800);
  const res = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), find = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = find(o, n); if (x) return x; } return null; };
    const ms = await import('/src/systems/MasteryStore.ts'), C = await import('/src/ui/HeroCodexUI.ts');
    ms.addScrolls?.(3); // 让一些未解锁战法显示「够解锁」
    s.togglePause(); await new Promise(r => setTimeout(r, 150)); C.openHeroCodex(s, 'zhaoyun'); await new Promise(r => setTimeout(r, 150));
    const root = s.children.getByName('hero-codex'); find(root, 'codex-tab-xinde').emit('pointerdown'); await new Promise(r => setTimeout(r, 120));
    const body = root.list[0], texts = body.list.filter(o => o.type === 'Text' && o.visible);
    const tiles = body.list.filter(o => /^codex-tactic-(?!desc)/.test(o.name ?? '')).map(o => { const g = o.getBounds(); return { n: o.name, x: g.x, y: g.y, w: g.width, h: g.height }; });
    const hit = (a, c) => a.x < c.x + c.w - .5 && c.x < a.x + a.w - .5 && a.y < c.y + c.h - .5 && c.y < a.y + a.h - .5;
    const labels = texts.filter(t => t.style?.fontFamily?.includes('IMWarHeading')).map(t => { const g = t.getBounds(); return { n: t.text, x: g.x, y: g.y, w: g.width, h: g.height }; });
    const tileOverlap = [], labelOverlap = [];
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (hit(tiles[i], tiles[j])) tileOverlap.push(tiles[i].n + '×' + tiles[j].n);
    for (const l of labels) for (const t of tiles) if (hit(l, t)) labelOverlap.push(l.n + '×' + t.n);
    const sizes = [...new Set(texts.filter(t => tiles.some(x => Math.abs((t.y) - (x.y + x.h / 2)) < 2 && t.x > x.x && t.x < x.x + x.w) && /^(✓ )?[一-龥]{2,4}$/.test(t.text)).map(t => t.style.fontSize + '@' + t.scaleX))];
    const bottomY = Math.max(...tiles.map(t => t.y + t.h)), panelBottom = s.scale.height ? 540 : 540;
    const desc = find(root, 'codex-tactic-desc');
    // 悬停：说明栏换成战法效果
    const target = tiles.find(t => /pursuit|chain|tactic-guard/.test(t.n)) ?? tiles[0]; const tobj = find(root, target.n); tobj.emit('pointerover');
    const hoverText = desc.text;
    return { n: tiles.length, tileOverlap, labelOverlap, sizes, rows: new Set(tiles.map(t => Math.round(t.y))).size, bottomY, hoverText, panelBottom };
  });
  ck(`${vp.width}×${vp.height} 全部战法都有卡（≥24）`, res.n >= 24, res.n);
  ck(`${vp.width}×${vp.height} 战法卡互不重叠、不压分类名`, !res.tileOverlap.length && !res.labelOverlap.length, { t: res.tileOverlap, l: res.labelOverlap });
  ck(`${vp.width}×${vp.height} 战法名字号统一、不缩放`, res.sizes.length === 1 && /@1$/.test(res.sizes[0]), res.sizes);
  ck(`${vp.width}×${vp.height} 每个分类一行（8 行），用满面板高度`, res.rows === 8 && res.bottomY > 400, { rows: res.rows, bottom: res.bottomY });
  ck(`${vp.width}×${vp.height} 悬停显示战法效果`, /：/.test(res.hoverText) && !/把鼠标移到/.test(res.hoverText), res.hoverText);
  await p.screenshot({ path: `${out}/${tag}-desktop-xinde-hover-${vp.width}x${vp.height}.png` });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), r = s.children.getByName('hero-codex'); const find = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = find(o, n); if (x) return x; } return null; }; for (const o of r.list[0].list) if (/^codex-tactic-/.test(o.name ?? '')) o.emit('pointerout'); });
  await p.waitForTimeout(100);
  await p.screenshot({ path: `${out}/${tag}-desktop-xinde-${vp.width}x${vp.height}.png` });
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
