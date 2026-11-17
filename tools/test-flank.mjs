// 战法「迂回袭」表现（src/systems/FlankFx.ts 第三版：手绘序列帧 flank_streak / strike_glint）：蓄力不提示；蓄满身侧小星芒慢闪 + 轻响；
// 触发一道月白侧袭弧光、被波及的敌人各一个星芒，0.5 秒内清干净；伤害判定不变（追击 35/45/55%）。
// 电脑布局 1280×720，逐帧 game.step。截图存 assets/review/flank/sheets/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-flank.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const style of ['sheets']) {
  const out = `assets/review/flank/${style}`; mkdirSync(`${out}/frames`, { recursive: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(style + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(style + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); s.__DEV_ACTIONS.closePopup?.();
    s.player.damageImmune = true; s.player.stats.critChance = 0; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0); s.readMove = () => window.__v.clone().normalize();
    window.__step = (n, hold) => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; if (hold) for (const w of s.player.weapons) w.cooldownLeft = 99; g.step(window.__T, 1000 / 60); for (const e of s.enemies) if (e.active && !e.isSupplySlot && !e.__keep) e.hp = 0; } };
    window.__clip = () => { const c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x - wv.x) * k, y: c.top + (s.player.y - wv.y) * k, k }; };
    window.__sfx = []; const o = s.sfx.play.bind(s.sfx); s.sfx.play = k => { window.__sfx.push(k); o(k); };
  }, G);
  const step = (n, hold = true) => p.evaluate(([a, h]) => window.__step(a, h), [n, hold]);
  const shot = async (name, w = 330, h = 220, dx = 0) => { const r = await p.evaluate(() => window.__clip()); await p.screenshot({ path: `${out}/${name}.png`, clip: { x: Math.max(0, r.x + dx * r.k - w * r.k / 2), y: Math.max(0, r.y - h * r.k * .55), width: w * r.k, height: h * r.k } }); };
  const fx = () => p.evaluate(G0 => { const s = eval(G0), f = s.flankFx, c = s.buildCombat.flankCharge(); return { ...c, ratio: +c.ratio.toFixed(2), ...(f ? { ...f.stats, ready: f.isReady, visible: s.children.list.filter(o => o.name === 'flank-streak' || o.name === 'flank-ready-glint').length } : {}) }; }, G);

  for (const lv of [1, 3]) {
    await p.evaluate(([G0, l]) => { const s = eval(G0); s.player.growth.build.tactics = { flank: l }; window.__sfx.length = 0; }, [G, lv]);
    await p.evaluate(() => window.__v.set(1, 0));
    await step(20);
    const early = await fx();
    ck(`${style} Lv${lv}：蓄力时没有任何提示（克制）`, early.ratio < 1 && !early.ready && early.visible === 0, early);
    if (lv === 3) for (let i = 0; i < 6; i++) { await step(4); await shot(`frames/charge-${String(i).padStart(2, '0')}`); }
    await step(80);
    const full = await fx(), sfx = await p.evaluate(() => [...new Set(window.__sfx)]);
    ck(`${style} Lv${lv}：蓄满——身侧小星芒慢闪 + 轻响`, full.ratio === 1 && full.ready && full.blinks > 0 && sfx.includes('flankReady'), { full, sfx });
    await p.evaluate(() => window.__v.set(0, 0)); await step(12);
    if (lv === 3) await shot('ready');
    const res = await p.evaluate(G0 => {
      const s = eval(G0), pl = s.player; window.__hits = []; const orig = s.__origHit ??= s.hitEnemy.bind(s);
      s.hitEnemy = (e, dmg, now, src, ...rest) => { const hp = e.hp, r = orig(e, dmg, now, src, ...rest); if (e.__keep) window.__hits.push({ dmg: Math.round(hp - e.hp), weapon: rest[0] !== false }); return r; };
      for (const [dx, dy] of [[75, 0], [105, -30], [110, 28], [135, 2]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } }
      s.rebuildGrid(); for (const w of pl.weapons) w.cooldownLeft = 0; return { strikes: s.flankFx.stats.strikes, sweeps: s.flankFx.stats.sweeps, hits: s.flankFx.stats.hits };
    }, G);
    let struck = -1;
    for (let i = 0; i < 30; i++) { await step(1, false); const f = await fx(); if (struck < 0 && f.strikes > res.strikes) struck = i; if (lv === 3 && i < 24) await shot(`frames/strike-${String(i).padStart(2, '0')}`, 300, 200, 50); if (lv === 3 && struck >= 0 && i === struck + 5) await shot('strike', 300, 200, 50); }
    const after = await fx(), sfx2 = await p.evaluate(() => [...new Set(window.__sfx)]);
    // 触发后 30 帧（0.5 秒）内应已全部消失；扫 / 插的道数 ≤2
    const sweeps = after.sweeps - res.sweeps, hits = after.hits - res.hits;
    ck(`${style} Lv${lv}：触发——一道月白侧袭弧光、被波及的 1–3 人各一个星芒，0.5 秒内清干净`, after.strikes === res.strikes + 1 && sweeps === 1 && hits >= 1 && hits <= 3 && after.visible === 0 && !after.ready && sfx2.includes('flankStrike'), { sweeps, hits, visible: after.visible, struckAtFrame: struck });
    const hitsDmg = await p.evaluate(() => window.__hits), derived = hitsDmg.filter(h => !h.weapon), main = hitsDmg.filter(h => h.weapon);
    const ratio = derived.length && main.length ? +(Math.max(...derived.map(h => h.dmg)) / Math.min(...main.map(h => h.dmg))).toFixed(2) : 0;
    ck(`${style} Lv${lv}：追击伤害仍为 ${[35, 45, 55][lv - 1]}%`, derived.length >= 1 && Math.abs(ratio - [.35, .45, .55][lv - 1]) < .06, { derived: derived.length, ratio });
    await p.evaluate(G0 => { const s = eval(G0); for (const e of s.enemies) { e.__keep = false; if (e.active) e.hp = 0; } }, G);
    await step(30);
  }
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
