// 敌军死亡特效样片：录制 + 性能（2026-11-18）。需要开发服务器（默认 5260）。
// 用法：node tools/deathfx-proto.mjs [record|perf|all]；输出到 assets/review/deathfx/
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5260/', out = 'assets/review/deathfx', what = process.argv[2] ?? 'all';
fs.mkdirSync(out, { recursive: true });
const MODES = [['base', ''], ['a', '&deathfx=a'], ['b', '&deathfx=b'], ['c', '&deathfx=c']];
const url = q => `${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`;
const ready = async p => { await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.xpNext = 1e9; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } s.legion?.allies?.forEach?.(a => { a.active = false; }); }); };

// 一群黄巾兵：固定摆位（可复现），不动；精英几个
const spawn = (p, rows, cols, elites) => p.evaluate(({ rows, cols, elites }) => {
  const s = window.__game.scene.getScene('GameScene'), list = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = s.player.x + 140 + c * 46 - (cols * 46) / 2 + 120, y = s.player.y + r * 40 - (rows * 40) / 2 - 10, kind = elites.includes(r * cols + c) ? 'elite' : 'infantry';
    const e = s.spawnEnemy(kind, x, y, 1, true); if (!e) continue; e.speed = 0; e.hp = e.maxHp = 9999; list.push(e);
  }
  window.__targets = list; return list.length;
}, { rows, cols, elites });
// 清屏前在页面左上角闪一个洋红块（约 250ms），录像里用它精确对齐每次清屏的时刻
const mark = p => p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;background:#f0f;z-index:99999'; document.body.appendChild(d); setTimeout(() => d.remove(), 250); });
// 一刀清屏：从左到右扫过，约 160ms
const sweep = (p, ms = 160) => p.evaluate(ms => { const s = window.__game.scene.getScene('GameScene'), list = [...window.__targets].sort((a, b) => a.x - b.x); list.forEach((e, i) => setTimeout(() => { if (!e.active) return; e.hp = 0; s.killEnemy(e); }, (i / list.length) * ms)); return list.length; }, ms);

const times = {};
if (what === 'record' || what === 'all') {
  for (const [name, q] of MODES) {
    const ctx = await chromium.launch({ channel: 'chrome', headless: true }).then(b => b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${out}/raw-${name}`, size: { width: 1280, height: 720 } } }).then(c => ({ b, c })));
    const t0 = Date.now(); const p = await ctx.c.newPage(); await p.goto(url(q), { timeout: 180000, waitUntil: 'domcontentloaded' }); await ready(p);
    // 片段（约 5 秒）：站好 0.7s → 一刀清屏（实时）→ 再摆一群 → 0.25 倍慢放重播一次，方便看清细节
    await spawn(p, 4, 9, [3, 21]); await p.waitForTimeout(700);
    await mark(p); await p.waitForTimeout(120); const t1 = (Date.now() - t0) / 1000; await sweep(p); await p.waitForTimeout(1000);
    await spawn(p, 4, 9, [3, 21]); await p.waitForTimeout(500);
    await p.evaluate(() => { window.__game.scene.getScene('GameScene').devTimeScale = .25; });
    await mark(p); await p.waitForTimeout(120); const t2 = (Date.now() - t0) / 1000; await sweep(p, 40); await p.waitForTimeout(2300);
    await p.evaluate(() => { window.__game.scene.getScene('GameScene').devTimeScale = 1; });
    times[name] = { t1, t2 }; await p.waitForTimeout(1500);
    // 静帧：再慢放一次（时间放到 6%），在特效 ≈50 / 130 / 250ms 处各截一张
    await spawn(p, 4, 9, [3, 21]); await p.waitForTimeout(600);
    await p.evaluate(() => { window.__game.scene.getScene('GameScene').devTimeScale = .06; }); await sweep(p, 20);
    await p.waitForTimeout(800); await p.screenshot({ path: `${out}/still-${name}-1.png` });
    await p.waitForTimeout(1300); await p.screenshot({ path: `${out}/still-${name}-2.png` });
    await p.waitForTimeout(2000); await p.screenshot({ path: `${out}/still-${name}-3.png` });
    await ctx.c.close(); await ctx.b.close();
    const v = fs.readdirSync(`${out}/raw-${name}`).find(f => f.endsWith('.webm')); fs.renameSync(`${out}/raw-${name}/${v}`, `${out}/clip-${name}.webm`); fs.rmdirSync(`${out}/raw-${name}`);
    console.log('recorded', name, JSON.stringify(times[name]));
  }
  fs.writeFileSync(`${out}/clip-times.json`, JSON.stringify(times));
}

if (what === 'perf' || what === 'all') {
  const rows = [];
  for (const [name, q] of MODES) for (let rep = 0; rep < 2; rep++) {
    const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await p.goto(url(q), { timeout: 180000, waitUntil: 'domcontentloaded' }); await ready(p);
    const n = await spawn(p, 10, 15, []); await p.waitForTimeout(1500);
    const res = await p.evaluate(async () => {
      const s = window.__game.scene.getScene('GameScene'), frames = [];
      const sample = ms => new Promise(res => { const t0 = performance.now(); let last = t0; const loop = t => { frames.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop); });
      await sample(1000); const idle = frames.splice(0).slice(1);
      const list = [...window.__targets]; for (const e of list) { e.hp = 0; s.killEnemy(e); }   // 150 个同一帧清屏
      await sample(2500); const clear = frames.splice(0).slice(1);
      const fps = a => 1000 / (a.reduce((x, y) => x + y, 0) / a.length), worst = a => Math.max(...a);
      return { idleFps: fps(idle), clearFps: fps(clear), clearWorstMs: worst(clear), fx: s.deathFx ? s.deathFx.played : 0, poolLive: s.deathFx?.liveCount ?? 0, objects: s.children.length };
    });
    rows.push({ mode: name, rep, n, ...res }); console.log(JSON.stringify({ mode: name, rep, n, idleFps: +res.idleFps.toFixed(1), clearFps: +res.clearFps.toFixed(1), worstMs: +res.clearWorstMs.toFixed(1), played: res.fx, objects: res.objects }));
    await b.close();
  }
  fs.writeFileSync(`${out}/perf.json`, JSON.stringify(rows, null, 1));
}
