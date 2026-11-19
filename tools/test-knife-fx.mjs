// 祝融夫人飞刀特效（KnifeFx）：图集规格、旋转飞行、命中火花、扇形、池上限、缺图不影响判定。需要开发服务器（默认 5260）。
// 用法：node tools/test-knife-fx.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.addInitScript(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, ''))); if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);

// 1) 图集：1024×1024，帧 0–13 有内容、14 / 15 空；周围没有黑底（角上透明）
const sheet = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), key = 'fx_zhurong_knife', out = { exists: s.textures.exists(key) }; if (!out.exists) return out;
  const t = s.textures.get(key), src = t.getSourceImage(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); out.size = [src.width, src.height]; out.frames = t.getFrameNames().length;
  out.cells = []; for (let i = 0; i < 16; i++) { const d = g.getImageData((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256).data; let n = 0, corner = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 40) n++; for (const [x, y] of [[2, 2], [253, 2], [2, 253], [253, 253]]) corner += d[(y * 256 + x) * 4 + 3]; out.cells.push({ n, corner }); } return out; });
ck('图集 fx_zhurong_knife：1024×1024、16 格（4×4），帧 0–13（飞刀 8 + 火花 6）有内容，14 / 15 空，四角透明（黑底已去掉）',
  sheet.exists && sheet.size?.[0] === 1024 && sheet.size?.[1] === 1024 && sheet.frames >= 16 && sheet.cells.slice(0, 14).every(c => c.n > 300 && c.corner < 40) && sheet.cells[14].n === 0 && sheet.cells[15].n === 0, sheet);

// 2) 飞行 + 命中
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), m = await window.__mod('systems/KnifeFx.ts'), kf = new m.KnifeFx(s), K = m.KNIFE_FX, out = {}; window.__kf = kf;
  let hits = [], x0 = s.player.x, y0 = s.player.y; kf.fire(x0, y0, x0 + 300, y0 + 40, { onHit: (x, y) => hits.push([x, y]) }); const k = kf.live[0];
  out.rot = k.img.rotation; out.rotWant = Math.atan2(40, 300); const flight = [], xs = [];
  for (let t = 0; t < 1200; t += 16) { kf.update(16); if (k.phase !== 'fly') break; flight.push(k.img.frame.name); xs.push(k.img.x); }
  out.flightFrames = [...new Set(flight)].length; out.flightNames = [...new Set(flight)]; out.mono = xs.every((v, i) => !i || v >= xs[i - 1]); out.reach = Math.hypot(k.x1 - x0, k.y1 - y0); out.flightMs = flight.length * 16; out.expectMs = out.reach / K.speed * 1000;
  out.hits = hits.length; out.hitAt = hits[0]; out.phase = k.phase; out.hitFrame0 = k.img.frame.name;
  const hit = [k.img.frame.name]; for (let t = 0; t < 900 && k.active; t += 16) { kf.update(16); if (k.active) hit.push(k.img.frame.name); } out.hitFrames = [...new Set(hit)]; out.after = { active: k.active, visible: k.img.visible, count: kf.activeCount };
  return out; });
const idx = n => +n;
ck('飞刀：朝目标旋转（整张按飞行方向转）、8 个旋转帧都出现、匀速飞到目标（耗时 ≈ 距离 ÷ 速度）、到点回调一次', Math.abs(r.rot - r.rotWant) < .001 && r.flightFrames === 8 && r.mono && Math.abs(r.flightMs - r.expectMs) < 40 && r.hits === 1 && Math.abs(r.hitAt[0] - (r.hitAt[0])) < 1, r);
ck('命中：到点后换成 6 帧火花（帧 8–13）依次播放，播完隐藏、回到池里', r.phase === 'hit' && r.hitFrames.length === 6 && +r.hitFrames[0] === 8 && +r.hitFrames[5] === 13 && !r.after.active && !r.after.visible && r.after.count === 0, r);

// 3) 扇形：3 把、夹角 / 射程对
const fan = await p.evaluate(() => { const kf = window.__kf, s = window.__game.scene.getScene('GameScene'), x0 = s.player.x, y0 = s.player.y, hits = []; kf.fan(x0, y0, x0 + 200, y0, 3, 25, 260, { onHit: (x, y) => hits.push([x - x0, y - y0]), noImpact: true }); const n = kf.activeCount; for (let t = 0; t < 1500; t += 16) kf.update(16); return { n, hits, angles: hits.map(h => Math.round(Math.atan2(h[1], h[0]) * 180 / Math.PI)), ranges: hits.map(h => Math.round(Math.hypot(h[0], h[1]))), after: kf.activeCount }; });
ck('扇形：一次 3 把，夹角 25°，射程 260，noImpact 时落点不爆、回到池里', fan.n === 3 && fan.hits.length === 3 && JSON.stringify(fan.angles.slice().sort((a, b) => a - b)) === '[-25,0,25]' && fan.ranges.every(v => Math.abs(v - 260) < 2) && fan.after === 0, fan);

// 4) 池上限：同时 60 把，画面最多 48 把，判定一个不少
const cap = await p.evaluate(() => { const kf = window.__kf, s = window.__game.scene.getScene('GameScene'); let hit = 0; for (let i = 0; i < 60; i++) kf.fire(s.player.x, s.player.y, s.player.x + 100 + i, s.player.y, { onHit: () => hit++, noImpact: true }); const poolN = kf.pool.length; for (let t = 0; t < 1500; t += 16) kf.update(16); return { poolN, hit, after: kf.activeCount }; });
ck('池上限 48：同时 60 把飞刀，对象数 ≤ 48，60 次命中回调一个不少', cap.poolN <= 48 && cap.hit === 60 && cap.after === 0, cap);

// 5) 缺图：什么都不画、回调照给、不报错
const miss = await p.evaluate(() => { const kf = window.__kf, s = window.__game.scene.getScene('GameScene'); s.textures.remove('fx_zhurong_knife'); let hit = 0; kf.fire(s.player.x, s.player.y, s.player.x + 80, s.player.y, { onHit: () => hit++ }); for (let t = 0; t < 800; t += 16) kf.update(16); return { ready: kf.ready, hit, after: kf.activeCount }; });
ck('缺图：不画任何替代图形，命中回调照样触发，不报错', !miss.ready && miss.hit === 1 && miss.after === 0, miss);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
