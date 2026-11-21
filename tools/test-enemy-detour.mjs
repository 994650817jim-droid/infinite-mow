// 小兵绕栅栏（2026-11-20 用户「小怪逻辑有问题，会卡在栏杆」，截图 1-3 广宗决战——1-2 首领追击转进 1-3 时，下曲阳法坛营前那排木栅留在场上）：
// 在 1-2 下曲阳法坛营木栅（左右两段，中间 240 宽营门）的北侧刷一队近战，主将站在木栅南侧正对着；
// ① 关掉绕障导航（旧行为）：近战贴在木栅后面过不来；② 打开（新行为）：N 秒内从营门绕到主将身边；③ 远程兵照旧不绕（可隔栏放箭）；④ 没有敌兵穿进木栅碰撞框；⑤ 无报错。
// 用法：BASE=http://127.0.0.1:5187/ [GIF=1] node tools/test-enemy-detour.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/enemy-detour'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { try { localStorage.setItem('im_story', 'off'); } catch { /* */ } });
await p.goto(base + '?dev=1&layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 2, character: 'zhaoyun', weapon: 'spear' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
// 木栅左段：法坛营在开局点北 760，木栅框 y = -640…-610，左段 x = -682…-136，营门 -136…136
const fence = await p.evaluate(S0 => { const s = eval(S0); return s.sishuiObstacles.footprints.filter(f => f.bottom - f.top < 60 && f.right - f.left > 300).map(f => ({ ...f })); }, S);
const L = fence.find(f => f.right < 0);
/** 摆一队兵在木栅北侧（左段中间正后方），主将站木栅南侧正对着；返回初始。 */
const trial = (useFlow, kinds) => p.evaluate(([S0, useFlow, kinds, L]) => { const s = eval(S0); if (s.mode !== 'none') s.setMode('none');
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.devTimeScale = 2; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; w.cd = 1e9; });
  const cx = (L.left + L.right) / 2; s.player.sprite.setPosition(cx, L.bottom + 170);
  window.__flowOff = !useFlow; if (!window.__flowWrap) { window.__flowWrap = true; const f = s.enemyFlow, orig = f.steer.bind(f); f.steer = (x, y, o) => window.__flowOff ? false : orig(x, y, o); }
  window.__T = kinds.map((k, i) => { const e = s.spawnEnemy(k, cx - 90 + (i % 4) * 60, L.top - 110 - Math.floor(i / 4) * 55, 1, true); e.hp = e.maxHp = 1e7; return e; });
  return window.__T.length; }, [S, useFlow, kinds, L]);
const measure = () => p.evaluate(([S0, L]) => { const s = eval(S0), P = s.player; if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.children.getByName('recruit-panel')?.destroy?.(); s.setMode('none'); } /* 招兵 / 三选一弹窗会暂停战斗：测试期间清掉 */ return window.__T.map(e => ({ kind: e.kind, d: Math.round(Math.hypot(e.x - P.x, e.y - P.y)), north: e.y < L.top, inFence: e.x > L.left + 4 && e.x < L.right - 4 && e.y > L.top + 4 && e.y < L.bottom - 4 })); }, [S, L]);
const watch = async (ms, shotName) => { let inFence = 0, n = 0; const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = await measure(); inFence += m.filter(x => x.inFence).length;
  if (process.env.GIF && shotName) await p.screenshot({ path: `${out}/frames/${shotName}-${String(n).padStart(3, '0')}.png`, clip: { x: 240, y: 60, width: 800, height: 600 } }); n++; await p.waitForTimeout(process.env.GIF ? 120 : 250); } return { last: await measure(), inFence }; };
if (process.env.GIF) mkdirSync(out + '/frames', { recursive: true });
const MELEE = ['infantry', 'infantry', 'infantry', 'infantry', 'shield', 'shield', 'infantry', 'infantry'];

ck('找到下曲阳法坛营木栅（左段 + 营门）', !!L && L.right - L.left > 300, fence);
// ① 旧行为（导航关）：直线顶在木栅后面
await trial(false, MELEE);
const off = await watch(9000, 'off');
const offNear = off.last.filter(x => x.d < 140).length, offStuck = off.last.filter(x => x.north).length;
ck('对照：关掉绕障导航时近战贴在木栅后面过不来（复现用户截图）', offStuck >= MELEE.length - 1, { near: offNear, stuckNorth: offStuck, d: off.last.map(x => x.d) });
await p.screenshot({ path: `${out}/before-stuck.png` });
// ② 新行为：从营门绕过来
await trial(true, MELEE);
const t0 = Date.now(); let on = null, at = null;
for (let i = 0; i < 60; i++) { on = await watch(500, 'on'); if (on.last.filter(x => x.d < 140).length >= MELEE.length - 1) { at = Math.round((Date.now() - t0) / 1000 * 2); break; } }
const flow = await p.evaluate(S0 => ({ ...eval(S0).enemyFlow.stats }), S);
ck('绕障导航：近战从营门绕到主将身边（≥7/8 到 140 内）', at !== null, { gameSec: at, d: on.last.map(x => x.d), flow });
ck('绕路时没有敌兵穿进木栅碰撞框', on.inFence === 0 && off.inFence === 0, { on: on.inFence, off: off.inFence });
ck('导航开销：重建一次 < 8 毫秒', flow.ms < 8, flow);
await p.screenshot({ path: `${out}/after-detour.png` });
// ③ 远程兵照旧不绕（隔栏放箭）
await trial(true, ['archer', 'archer', 'archer']);
const ar = await watch(5000);
ck('远程兵（弓手）不绕路：留在木栅北侧隔栏放箭', ar.last.every(x => x.north), ar.last);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
