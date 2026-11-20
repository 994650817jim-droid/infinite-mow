// 舆图展开时战斗暂停（2026-11-19 用户「打开小地图会暂停是我要要求的」）：电脑版正式模式（不带 dev）1-1，
// 按 M 展开舆图：舆图自己的飞出 / 展开动画照常播完（state 到 open）；之后 2.5 秒内战斗时钟 combatNow / elapsed 不走、敌人不动、按住 D 主将也不动；
// 再按 M 卷回：卷回动画播完（state closed）后战斗恢复，时钟和敌人继续走。截图 assets/review/battle-map/map-open-paused.png。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-map-no-pause.mjs   （文件名沿用，内容是「开图暂停」）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/battle-map';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.battleMap && s.mode === 'none' && s.elapsed > 3 && s.enemies.some(e => e.active && !e.isSupplySlot); }, null, { timeout: 180000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; });
await p.mouse.click(640, 360); // 让画布拿到键盘焦点
const snap = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), es = s.enemies.filter(e => e.active && !e.isSupplySlot).slice(0, 8);
  return { now: s.combatNow, elapsed: s.elapsed, mode: s.mode, open: s.battleMap?.bigOpen ?? false, state: s.battleMap?.stats.state, px: s.player.x, enemies: es.map(e => [Math.round(e.x), Math.round(e.y)]), icon: !!s.children.getByName('battle-map-scroll') }; });
const moved = (a, b) => a.enemies.filter((e, i) => b.enemies[i] && Math.hypot(b.enemies[i][0] - e[0], b.enemies[i][1] - e[1]) > 2).length;
const s0 = await snap();
await p.keyboard.press('KeyM');
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').battleMap?.stats.state === 'open', null, { timeout: 5000 }).catch(() => {});
const a = await snap();
await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD');
const b2 = await snap();
await p.screenshot({ path: `${out}/map-open-paused.png` });
ck('按 M：舆图飞出、展开动画播完（暂停中补间照常）；进入「map」模式', a.state === 'open' && a.mode === 'map' && b2.mode === 'map', { a: { state: a.state, mode: a.mode }, b: { state: b2.state, mode: b2.mode } });
ck('舆图开着 2.5 秒：战斗时钟不走（combatNow / elapsed 不变）', Math.abs(b2.now - a.now) < 1 && Math.abs(b2.elapsed - a.elapsed) < .001, { dNow: b2.now - a.now, dElapsed: b2.elapsed - a.elapsed });
ck('舆图开着 2.5 秒：敌人不动、按住 D 主将也不动', a.enemies.length > 0 && moved(a, b2) === 0 && Math.abs(b2.px - a.px) < 1, { moved: moved(a, b2), of: a.enemies.length, dx: b2.px - a.px });
await p.keyboard.press('KeyM');
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').battleMap?.stats.state === 'closed', null, { timeout: 5000 }).catch(() => {});
const c = await snap();
await p.waitForTimeout(2000);
const d = await snap();
ck('再按 M：卷回角上（closed）后恢复战斗（mode none），卷轴小图还在', c.state === 'closed' && c.mode === 'none' && c.icon, { state: c.state, mode: c.mode, icon: c.icon });
ck('卷回后 2 秒：战斗时钟在走、敌人在动', d.now - c.now > 1500 && moved(c, d) > 0, { dNow: d.now - c.now, moved: moved(c, d), of: c.enemies.length });
ck('开图前战斗本来就在走（对照）', a.now - s0.now > 100 || s0.now > 2000, { s0: s0.now, a: a.now });
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
await b.close();
process.exit(fail ? 1 : 0);
