// 夜间性能优化的回归：伤害数字位图字体（池化 BitmapText、合并累加、暴击放大、四种样式字体都生成）+ 凸多边形扇形三角化的凸性判断（凹的仍走 earcut）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-perf-tweaks.mjs     截图 assets/review/perf/dmg-numbers.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/'; mkdirSync('assets/review/perf', { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && window.__IM; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const R = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/RenderTweaks.ts')) ?? '/src/systems/RenderTweaks.ts');
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); window.__IM.god(); window.__IM.killAllEnemies(); s.spawnTimer = s.eliteTimer = 1e9; const px = s.player.x, py = s.player.y, o = {};
    s.spawnDamageText(px + 40, py - 60, 100, false); s.spawnDamageText(px + 42, py - 58, 23, false); // 同位置同类合并 → 123
    s.spawnDamageText(px - 60, py - 60, 999, true); s.spawnDamageText(px, py - 100, 55, false, true, 'heal'); s.spawnDamageText(px + 90, py - 90, 7, false, false); s.spawnDamageText(px - 90, py - 100, 66, false, true, 'boss'); s.spawnDamageText(px + 20, py - 130, 31, false, true, 'spell');
    const act = s.dmgFx.filter(f => f.active); o.texts = act.map(f => f.text.text).sort(); o.kinds = act.map(f => f.kind).sort(); o.bitmap = act.every(f => f.text.type === 'BitmapText'); o.crit = act.find(f => f.crit)?.text.scale;
    o.fonts = ['hit', 'crit', 'spell', 'boss', 'heal', 'ally'].filter(k => s.cache.bitmapFont.has('dmgfont_' + k)).length; o.noTextObjects = act.every(f => !f.text.canvas);
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
    const star = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, r = i % 2 ? 4 : 10; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
    const circle = Array.from({ length: 24 }, (_, i) => ({ x: Math.cos(i / 24 * Math.PI * 2) * 8, y: Math.sin(i / 24 * Math.PI * 2) * 8 })), dup = [...sq, sq[3], sq[0]];
    o.convex = [R.isConvex(sq), R.isConvex(circle), R.isConvex(dup)]; o.concave = [R.isConvex(L), R.isConvex(star), R.isConvex([{ x: 0, y: 0 }, { x: 5, y: 5 }])];
    await new Promise(r => setTimeout(r, 400)); return o; });
  ck('伤害数字：同位置同类合并累加（100 + 23 → 123），其余样式各一条', r.texts.includes('123') && r.texts.includes('999') && r.texts.includes('+55') && r.texts.includes('66') && r.texts.includes('31'), r.texts);
  ck('全是 BitmapText（不再每个数字一张 canvas）；暴击放大 1.45；五种样式字体已生成', r.bitmap && r.noTextObjects && Math.abs(r.crit - 1.45) < .3 && r.fonts >= 5, { bitmap: r.bitmap, crit: r.crit, fonts: r.fonts });
  ck('凸多边形（方 / 圆 / 带重复点）走扇形；凹多边形（L / 星 / 退化）仍走 earcut', r.convex.every(Boolean) && r.concave.every(v => v === false), { convex: r.convex, concave: r.concave });
  await p.waitForTimeout(150); await p.screenshot({ path: 'assets/review/perf/dmg-numbers.png', clip: { x: 390, y: 140, width: 500, height: 330 } });
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
