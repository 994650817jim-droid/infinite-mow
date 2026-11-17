// 战法「迂回袭」专属表现（src/systems/FlankFx.ts，暗金影袭）：蓄力疾风线与残影、蓄满绕身风刃与轻响、
// 触发时 1–3 个暗金残影扑向被波及的敌人并命中闪光；伤害判定不变（追击 35/45/55%）。
// 电脑布局 1280×720，逐帧 game.step。截图 / 连续帧存 assets/review/flank/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-flank.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/flank';
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
await p.evaluate(G0 => {
  const g = window.__game, s = eval(G0); s.__DEV_ACTIONS.closePopup?.();
  s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0); s.readMove = () => window.__v.clone().normalize();
  window.__step = (n, hold) => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; if (hold) for (const w of s.player.weapons) w.cooldownLeft = 99; g.step(window.__T, 1000 / 60); for (const e of s.enemies) if (e.active && !e.isSupplySlot && !e.__keep) e.hp = 0; } };
  window.__clip = () => { const c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x - wv.x) * k, y: c.top + (s.player.y - wv.y) * k, k }; };
  window.__sfx = []; const o = s.sfx.play.bind(s.sfx); s.sfx.play = k => { window.__sfx.push(k); o(k); };
}, G);
const step = (n, hold = true) => p.evaluate(([a, h]) => window.__step(a, h), [n, hold]);
const shot = async (name, w = 330, h = 220, dx = 0) => { const r = await p.evaluate(() => window.__clip()); await p.screenshot({ path: `${out}/${name}.png`, clip: { x: Math.max(0, r.x + dx * r.k - w * r.k / 2), y: Math.max(0, r.y - h * r.k * .55), width: w * r.k, height: h * r.k } }); };
const fx = () => p.evaluate(G0 => { const s = eval(G0), f = s.flankFx, c = s.buildCombat.flankCharge(); return { ...c, ratio: +c.ratio.toFixed(2), ...(f ? { ...f.stats, ready: f.isReady, blades: s.children.list.filter(o => o.name === 'flank-ready-blade' && o.visible).length } : {}) }; }, G);

for (const lv of [1, 3]) {
  await p.evaluate(([G0, l]) => { const s = eval(G0); s.player.growth.build.tactics.flank = l; window.__sfx.length = 0; }, [G, lv]);
  // 1. 蓄力
  await p.evaluate(() => window.__v.set(1, 0));
  await step(25);
  const early = await fx();
  ck(`Lv${lv}：移动时脚后疾风线，未满时无风刃`, early.streaks > 0 && !early.ready && early.blades === 0, early);
  if (lv === 3) for (let i = 0; i < 6; i++) { await step(5); await shot(`frames/charge-${String(i).padStart(2, '0')}`); }
  // 2. 蓄满
  await step(70);
  const full = await fx(), sfx = await p.evaluate(() => [...new Set(window.__sfx)]);
  ck(`Lv${lv}：移动约 ${[5, 4, 3.5][lv - 1]} 个身位后蓄满：绕身两片暗金风刃 + 轻响；七成后留残影`, full.ratio === 1 && full.ready && full.blades === 2 && full.ghosts > 0 && sfx.includes('flankReady'), { full, sfx });
  await p.evaluate(() => window.__v.set(0, 0)); await step(12);
  if (lv === 3) await shot('ready-blades');
  // 3. 触发：前方一簇 4 个木桩，放开冷却等下一击
  const res = await p.evaluate(G0 => {
    const s = eval(G0), pl = s.player; window.__hits = []; const orig = s.__origHit ??= s.hitEnemy.bind(s);
    s.hitEnemy = (e, dmg, now, src, ...rest) => { if (e.__keep) window.__hits.push({ id: e.spawnId, dmg: Math.round(dmg), weapon: rest[0] !== false }); return orig(e, dmg, now, src, ...rest); };
    for (const [dx, dy] of [[75, 0], [105, -30], [110, 28], [135, 2]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } }
    s.rebuildGrid(); for (const w of pl.weapons) w.cooldownLeft = 0; return { strikes: s.flankFx.stats.strikes, hits: s.flankFx.stats.hits };
  }, G);
  for (let i = 0; i < 20; i++) { await step(2, false); if (lv === 3) await shot(`frames/strike-${String(i).padStart(2, '0')}`, 380, 240, 50); if (lv === 3 && i === 3) await shot('strike', 380, 240, 50); }
  const after = await fx(), hits = await p.evaluate(() => window.__hits), sfx2 = await p.evaluate(() => [...new Set(window.__sfx)]);
  ck(`Lv${lv}：触发——暗金残影扑向被波及的敌人（1–3 个），命中爪痕闪光；风刃收起、蓄力清零`, after.strikes === res.strikes + 1 && after.hits - res.hits >= 1 && after.hits - res.hits <= 3 && !after.ready && after.blades === 0 && after.ratio < .2 && sfx2.includes('flankStrike'), after);
  // 伤害不变：追击伤害 = 该次命中基础伤害 × 0.35 / 0.55
  const derived = hits.filter(h => !h.weapon), main = hits.filter(h => h.weapon);
  const ratio = derived.length && main.length ? +(Math.max(...derived.map(h => h.dmg)) / Math.max(...main.map(h => h.dmg))).toFixed(2) : 0;
  ck(`Lv${lv}：追击伤害仍为 ${[35, 45, 55][lv - 1]}%（最多 3 人）`, derived.length >= 1 && derived.length <= 3 * 2 && Math.abs(ratio - [.35, .45, .55][lv - 1]) < .06, { derived: derived.length, ratio, hits: hits.slice(0, 8) });
  await p.evaluate(G0 => { const s = eval(G0); for (const e of s.enemies) { e.__keep = false; if (e.active) e.hp = 0; } }, G);
  await step(30);
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
