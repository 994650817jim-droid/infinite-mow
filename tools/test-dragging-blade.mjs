// 关羽本命修习「拖刀斩」专属表现（src/systems/DraggingBladeFx.ts）：蓄力火星与划痕、蓄满刀焰与轻响、
// 青色半月刀气向前飞出并碎散、命中闪光、三级金色回旋刀气；刀气倍率 0.8/1/1.2、回旋 0.6，触发距离 400/340/280（2026-11-16 用户：拖刀斩不要太容易触发）。
// 电脑布局 1280×720，逐帧 game.step（60fps）。截图 / 连续帧存 assets/review/dragging-blade/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-dragging-blade.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/dragging-blade';
mkdirSync(`${out}/frames`, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'guanyu', weapon: 'guandao' }); s.scene.restart(); }, G);
await p.waitForTimeout(400);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'guanyu' && s.__DEV_ACTIONS; }, null, { timeout: 60000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
await p.waitForTimeout(400);
await p.evaluate(G0 => {
  const g = window.__game, s = eval(G0); g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0);
  s.readMove = () => window.__v.clone().normalize();
  window.__step = (n, hold) => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; if (hold) for (const w of s.player.weapons) w.cooldownLeft = 99; g.step(window.__T, 1000 / 60); for (const e of s.enemies) if (e.active && !e.isSupplySlot && !e.__keep) e.hp = 0; } };
  window.__shot = () => { const c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x - wv.x) * k, y: c.top + (s.player.y - wv.y) * k, k }; };
}, G);
const step = (n, hold = true) => p.evaluate(([a, h]) => window.__step(a, h), [n, hold]);
const shot = async (name, w = 330, h = 220) => { const r = await p.evaluate(() => window.__shot()); await p.screenshot({ path: `${out}/${name}.png`, clip: { x: Math.max(0, r.x - w * r.k / 2), y: Math.max(0, r.y - h * r.k * .55), width: w * r.k, height: h * r.k } }); };
const fx = () => p.evaluate(G0 => { const s = eval(G0), f = s.dragFx, gr = s.player.growth; return f ? { ...f.stats, ready: f.isReady, ratio: +f.ratio.toFixed(2), travel: Math.round(gr.travel), flame: !!s.children.getByName('drag-ready-flame')?.visible } : null; }, G);

for (const lv of [1, 3]) {
  await p.evaluate(([G0, l]) => { const s = eval(G0); s.player.growth.masteries.dragging_blade = l; s.player.growth.travel = 0; }, [G, lv]);
  // 1. 蓄力：向右拖刀走，火星与划痕随进度增加；未蓄满前没有刀焰
  await p.evaluate(G0 => { const s = eval(G0); window.__sfx = []; if (!s.sfx.__hooked) { const o = s.sfx.play.bind(s.sfx); s.sfx.play = k => { window.__sfx.push(k); o(k); }; s.sfx.__hooked = true; } window.__v.set(1, 0); }, G);
  await step(20);
  const early = await fx();
  if (lv === 3) for (let i = 0; i < 6; i++) { await step(6); await shot(`frames/charge-${String(i).padStart(2, '0')}`); }
  else await step(36);
  const mid = await fx();
  ck(`Lv${lv}：移动时刀尖拖地，留下划痕与火星；未满时无刀焰`, early && early.grooves > 0 && early.sparks > 0 && !early.ready && !early.flame, { early, mid });
  // 2. 蓄满：越过门槛（400/340/280，约 10/8.5/7 个身位）时出刀焰、播轻响
  await step(180);
  const full = await fx(), sfx = await p.evaluate(() => window.__sfx);
  ck(`Lv${lv}：移动约 ${[10, 8.5, 7][lv - 1]} 个身位后蓄满：刀尖青色刀焰 + 轻响`, full.ready && full.flame && full.readyCount >= 1 && sfx.includes('bladeReady'), { full, sfx: [...new Set(sfx)] });
  await p.evaluate(() => { window.__v.set(0, 0); }); await step(10);
  if (lv === 3) await shot('ready-flame');
  // 3. 释放：前方放三个木桩敌人，放开冷却等下一刀
  const res = await p.evaluate(G0 => {
    const s = eval(G0), pl = s.player; window.__hits = []; const orig = s.__origHit ??= s.hitEnemy.bind(s);
    s.hitEnemy = (e, dmg, now, src, ...rest) => { if (e.__keep) window.__hits.push({ id: e.spawnId, dmg: Math.round(dmg), t: Math.round(s.combatNow) }); return orig(e, dmg, now, src, ...rest); };
    for (const [dx, dy] of [[70, 0], [105, -25], [110, 30]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } }
    for (const w of pl.weapons) w.cooldownLeft = 0;
    return { before: s.dragFx.stats.waves };
  }, G);
  const frames = lv === 3 ? 22 : 30;
  for (let i = 0; i < frames; i++) { await step(2, false); if (lv === 3 || i < 14) await shot(`frames/release-lv${lv}-${String(i).padStart(2, '0')}`, 380, 240); if (lv === 3 && i === 4) await shot('release-crescent', 380, 240); if (lv === 3 && i === 16) await shot('release-spin', 380, 240); }
  const after = await fx(), hits = await p.evaluate(() => window.__hits);
  const waves = await p.evaluate(G0 => ({ crescent: eval(G0).children.list.filter(o => o.name === 'drag-crescent-wave').length }), G);
  ck(`Lv${lv}：释放半月刀气（青色，向前飞出后碎散），命中有闪光；蓄力清零、刀焰熄灭`, after.waves === res.before + 1 && after.flashes >= 3 && !after.ready && after.travel < 20 && !after.flame && waves.crescent === 0, { after, waves });
  if (lv === 3) ck('Lv3：再追加金色回旋刀气（与半月刀气区分）', after.spins >= 1, { spins: after.spins });
  else ck('Lv1：没有回旋刀气', after.spins === 0, { spins: after.spins });
  // 伤害判定不变：同一刀里刀气对每个木桩各结算一次
  const byId = {}; for (const h of hits) (byId[h.id] ??= []).push(h.dmg);
  // 倍率：刀气 = 普攻基础伤害 × 0.8（Lv1）/ 1.2（Lv3），回旋 × 0.6。每个木桩第一下是普攻（同一刀里先结算），之后是刀气 / 回旋
  const okRatio = Object.values(byId).every(a => { const base = a[0], r = a.slice(1).map(d => d / base); return r.some(x => Math.abs(x - [.8, 1, 1.2][lv - 1]) < .04) && (lv < 3 || r.some(x => Math.abs(x - .6) < .04)); });
  ck(`Lv${lv}：刀气伤害仍按原判定结算（每个木桩 普攻 + 刀气${lv === 3 ? ' + 回旋' : ''}，倍率 ${[.8, 1, 1.2][lv - 1]}${lv === 3 ? ' / 0.6' : ''}）`, Object.values(byId).length === 3 && Object.values(byId).every(a => a.length >= (lv === 3 ? 3 : 2)) && okRatio, byId);
  await p.evaluate(G0 => { const s = eval(G0); for (const e of s.enemies) { e.__keep = false; if (e.active) e.hp = 0; } }, G);
  await step(30);
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
