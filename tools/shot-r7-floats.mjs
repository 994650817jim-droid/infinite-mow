// 第五轮复测（2026-11-21）：拾取飘字排队、避开台词；成就提示挪到顶部居中。1-1 电脑布局。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-r7-floats.mjs → assets/review/r7-fix/floats.png、achievement.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/r7-fix'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 500))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('f')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('f', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 180000 });
const r = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const St = await import('/src/systems/Story.ts'); St.storyBark(s, { x: s.player.x, y: s.player.y - 110 }, '曹性', '小沛守不住了……曹性愿降。');
  const It = await import('/src/data/items.ts'); const D = s.itemDrops; D.gainScrolls(3); const mk = q => It.rollItem(q);
  try { D.collect(mk('purple')); D.collect(mk('blue')); } catch (e) { return 'collect err ' + e; }
  const fl = s.children.list.filter(o => /pickup-text/.test(o.name ?? '')).map(o => { const bb = o.getBounds(); return [o.text, Math.round(bb.top), Math.round(bb.bottom)]; });
  const bark = s.children.list.find(o => o.name === 'story-bark' && o.visible); const bb = bark?.getBounds();
  return { fl, bark: bb ? [Math.round(bb.top), Math.round(bb.bottom)] : null }; });
await p.waitForTimeout(500); await p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
await p.screenshot({ path: `${OUT}/floats.png` });
const rows = Array.isArray(r.fl) ? r.fl.map(x => [x[1], x[2]]).sort((a, c) => a[0] - c[0]) : [];
const noOverlap = rows.every((x, i) => i === 0 || x[0] >= rows[i - 1][1] - 2), clearBark = !r.bark || rows.every(x => x[1] <= r.bark[0] + 2 || x[0] >= r.bark[1] - 2);
ck('拾取飘字：三条错开不重叠，也不压台词', rows.length >= 3 && noOverlap && clearBark, r);
await p.evaluate(async () => { const A = await import('/src/systems/Achievements.ts'); localStorage.removeItem('im_achievements_v1'); A.unlock('first_win'); });
await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/achievement.png` });
const ach = await p.evaluate(() => { const s = window.__game.scene.getScenes(true).at(-1); const t = s.children.list.find(o => o.name === 'achievement-toast'); return t ? [Math.round(t.x), Math.round(t.y)] : null; });
ck('成就提示在顶部居中（不在右上角压按钮）', !!ach && Math.abs(ach[0] - 480) < 4 && ach[1] > 100, ach);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
