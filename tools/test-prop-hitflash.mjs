// 战场物件受击不再整块刷白（2026-11-20 制作人巡检：1-1 军阵实战截图里栅栏是纯白剪影，像贴图丢失——部曲 / 主将连着打物件时每 220ms 白 60ms，截图常拍到）。
// 1-1：对每个物件（栅栏 / 拒马 / 营具等）连打 1.5 秒、每 40ms 取样：① 从不 tintFill（不刷白）；② 受击时有暖色着色；③ 停手后恢复原色；
// ④ 普通敌兵照旧受击闪白；⑤ 无报错。截图：物件受击中。用法：BASE=http://127.0.0.1:5187/ node tools/test-prop-hitflash.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/prop-hitflash'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { try { localStorage.setItem('im_story', 'off'); } catch { /* */ } });
await p.goto(base + '?dev=1&layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('MenuScene'); s0.registry.set('runConfig', { chapter: 'huangjin', stage: 1, character: 'zhaoyun', weapon: 'spear' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && window.__game.scene.isActive('GameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('GameScene')";
const props = await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; w.cd = 1e9; });
  window.__P = s.enemies.filter(e => e.isSupplySlot && e.active); for (const e of window.__P) e.hp = e.maxHp = 1e6;
  // 镜头移到第一个物件（截图用）
  const f = window.__P.find(e => /yellow_props/.test(e.sprite.texture.key)) ?? window.__P[0]; s.player.sprite.setPosition(f.x - 160, f.y - 40);
  // 一个普通敌兵做对照
  window.__E = s.spawnEnemy('infantry', f.x - 260, f.y, 1, true); window.__E.hp = window.__E.maxHp = 1e6;
  return window.__P.map(e => `${e.sprite.texture.key}:${e.sprite.frame.name}`); }, S);
ck('1-1 场上有可破坏物件', props.length >= 3, props);
const fills = [], tints = [], enemyFill = []; let shot = false;
const t0 = Date.now();
while (Date.now() - t0 < 1500) {
  const r = await p.evaluate(S0 => { const s = eval(S0); if (s.mode !== 'none' && !s.over) { s.pendingRecruit = false; s.pendingLevels = 0; s.setMode('none'); }
    for (const e of window.__P) if (e.active) s.hitEnemy(e, 1, s.combatNow, 'melee', true, false);
    if (window.__E.active) s.hitEnemy(window.__E, 1, s.combatNow, 'melee', true, false);
    return { fill: window.__P.filter(e => e.sprite.tintFill).length, tinted: window.__P.filter(e => e.sprite.isTinted && !e.sprite.tintFill).length, eFill: !!window.__E.sprite.tintFill }; }, S);
  fills.push(r.fill); tints.push(r.tinted); enemyFill.push(r.eFill);
  if (!shot && r.tinted > 0) { shot = true; await p.screenshot({ path: `${out}/prop-hit-after.png` }); }
  await p.waitForTimeout(40);
}
ck('物件连打 1.5 秒：从不整块刷白（tintFill 采样全为 0）', fills.every(n => n === 0), { samples: fills.length, maxFill: Math.max(...fills) });
ck('物件受击时有暖色着色（看得出挨打）', tints.some(n => n > 0), { tintedSamples: tints.filter(n => n > 0).length });
await p.waitForTimeout(600);
const rest = await p.evaluate(() => window.__P.filter(e => e.active).map(e => ({ k: e.sprite.texture.key, tinted: e.sprite.isTinted, fill: e.sprite.tintFill })));
ck('停手后物件恢复原色', rest.every(x => !x.tinted && !x.fill), rest);
ck('普通敌兵照旧受击闪白（对照不变）', enemyFill.some(Boolean), { whiteSamples: enemyFill.filter(Boolean).length });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
