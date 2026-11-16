// 战法「踏风步」专属表现（src/systems/WindstepFx.ts，青叶轻风）：蓄力脚边风纹步尘、蓄满靴边卷风绕叶、
// 命中爆一小团碎叶风刃；与迂回袭（暗金影袭）同时生效时两套都在、分在不同高度。伤害不变（增伤 10/15/20%）。
// 电脑布局 1280×720，逐帧 game.step。截图 / 连续帧存 assets/review/windstep/<TAG>/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ [TAG=after] node tools/test-windstep.mjs [--record-only]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', recordOnly = process.argv.includes('--record-only');
const out = `assets/review/windstep/${tag}`; mkdirSync(`${out}/frames`, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { if (recordOnly) return; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
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
const fx = () => p.evaluate(G0 => { const s = eval(G0), f = s.windFx; return f ? { ...f.stats, ready: f.isReady, leaves: s.children.list.filter(o => o.name === 'wind-ready-leaf' && o.visible).length } : {}; }, G);

for (const [label, tactics] of [['lv3', { windstep: 3 }], ['with-flank', { windstep: 3, flank: 3 }]]) {
  await p.evaluate(([G0, t]) => { const s = eval(G0); s.player.growth.build.tactics = { ...t }; window.__sfx.length = 0; }, [G, tactics]);
  // 1. 蓄力：向右走（约 3 个身位 = 120 像素）
  await p.evaluate(() => window.__v.set(1, 0));
  await step(12);
  const early = await fx();
  ck(`${label}：移动时脚边风纹与步尘，未满时无卷风`, early.wisps > 0 && !early.ready && early.leaves === 0, early);
  for (let i = 0; i < 6; i++) { await step(5); await shot(`frames/${label}-charge-${String(i).padStart(2, '0')}`); }
  await step(30);
  const full = await fx(), sfx = await p.evaluate(() => [...new Set(window.__sfx)]);
  ck(`${label}：蓄满——靴边卷风、三片青叶绕脚 + 轻响`, full.ready && full.leaves === 3 && sfx.includes('windReady'), { full, sfx });
  await p.evaluate(() => window.__v.set(0, 0)); await step(12);
  await shot(`${label}-ready`);
  // 2. 命中：前方木桩，放开冷却等下一击
  const res = await p.evaluate(G0 => {
    const s = eval(G0), pl = s.player; window.__hits = []; const orig = s.__origHit ??= s.hitEnemy.bind(s);
    s.hitEnemy = (e, dmg, now, src, ...rest) => { const hp = e.hp, r = orig(e, dmg, now, src, ...rest); if (e.__keep) window.__hits.push({ id: e.spawnId, dmg: Math.round(hp - e.hp), weapon: rest[0] !== false }); return r; };
    for (const [dx, dy] of [[75, 0], [105, -30], [110, 28], [135, 2]]) { const e = s.spawnEnemy('infantry', pl.x + dx, pl.y + dy, 1, true); if (e) { e.hp = e.maxHp = 1e7; e.speed = 0; e.__keep = true; } }
    s.rebuildGrid(); for (const w of pl.weapons) w.cooldownLeft = 0; return { bursts: s.windFx?.stats.bursts ?? 0 };
  }, G);
  for (let i = 0; i < 16; i++) { await step(2, false); await shot(`frames/${label}-hit-${String(i).padStart(2, '0')}`, 380, 240, 50); if (i === 3) await shot(`${label}-hit`, 380, 240, 50); }
  const after = await fx(), sfx2 = await p.evaluate(() => [...new Set(window.__sfx)]), hits = await p.evaluate(() => window.__hits);
  ck(`${label}：命中——命中点爆一小团碎叶风刃（一次）；卷风收起`, after.bursts === res.bursts + 1 && !after.ready && after.leaves === 0 && sfx2.includes('windHit'), { after, sfx2 });
  if (label === 'with-flank') {
    const flank = await p.evaluate(G0 => eval(G0).flankFx?.stats ?? null, G);
    ck('与迂回袭同时生效：两套表现都触发（金色分身扑击 + 青叶碎叶），互不吞掉', flank && flank.strikes >= 1 && after.bursts >= 1, { flank, wind: after });
  }
  // 伤害不变：踏风步那一击 = 普通命中 × 1.2（Lv3）
  const main = hits.filter(h => h.weapon).map(h => h.dmg);
  ck(`${label}：踏风步增伤仍为 20%（首击 / 普通命中）`, main.length >= 2 && Math.abs(Math.max(...main) / Math.min(...main) - 1.2) < .06, { main: main.slice(0, 8) });
  await p.evaluate(G0 => { const s = eval(G0); for (const e of s.enemies) { e.__keep = false; if (e.active) e.hp = 0; } }, G);
  await step(30);
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
if (!recordOnly) console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
