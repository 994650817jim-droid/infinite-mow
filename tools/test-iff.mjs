// 敌我区分样品（src/systems/IffOverlay.ts，?iff=a / b / c / 组合）：电脑布局 1280×720 摆一场敌我混战，
// 每种方案截一张全屏对比图到 assets/review/iff/；检查无参数时不创建叠加层、各方案生效、150 敌同屏的叠加耗时。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-iff.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/iff';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const MODES = (process.env.MODES ?? 'none,a,b,c,ab,ac').split(',');
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const mode of MODES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(mode + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(mode + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop${mode === 'none' ? '' : '&iff=' + mode}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  // 固定的混战：左侧 8 名部曲，右前方一群黄巾（含 2 名精锐），两军交错
  const r = await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.();
    g.loop.sleep(); let T = performance.now(); const step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; g.step(T, 1000 / 60); } };
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    const px = s.player.x, py = s.player.y; s.legion.clear?.();
    ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'].forEach((k, i) => { s.legion.recruit(k, 1, true); s.allies.at(-1)?.setPosition(px - 40 + (i % 4) * 34, py + 40 + Math.floor(i / 4) * 44); });
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const e = s.spawnEnemy(i === 5 || i === 17 ? 'elite' : i % 4 === 0 ? 'shield' : 'infantry', px + 30 + rnd() * 230, py - 120 + rnd() * 240, 1, true); if (e) e.hp = e.maxHp = 1e6; }
    step(75);
    s.scene.pause();
    return { iff: !!s.iff, stats: s.iff ? { ...s.iff.stats } : null, overlays: s.children.list.filter(o => o.name === 'iff-overlay').length };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/iff-${mode}.png` });
  if (mode === 'none') ck('无参数时不创建叠加层（画面不变）', !r.iff && r.overlays === 0, r);
  else {
    const want = { a: r.stats.recolored > 0, b: r.stats.marks > 0, c: r.stats.outlines > 0 };
    ck(`?iff=${mode}：方案生效`, [...mode].every(m => want[m]) && r.stats.units >= 30, r);
  }
  // 性能：150 名敌军同屏时叠加层每帧耗时
  if (mode !== 'none') {
    const perf = await p.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'), px = s.player.x, py = s.player.y;
      for (let i = 0; i < 124; i++) { const e = s.spawnEnemy(i % 9 === 0 ? 'archer' : 'infantry', px - 500 + (i % 16) * 62, py - 300 + Math.floor(i / 16) * 70, 1, true); if (e) e.hp = e.maxHp = 1e6; }
      s.iff.update(); const n = 120, t0 = performance.now(); for (let i = 0; i < n; i++) s.iff.update(); return { msPerFrame: +((performance.now() - t0) / n).toFixed(3), enemies: s.enemies.filter(e => e.active).length, units: s.iff.stats.units };
    });
    ck(`?iff=${mode}：150 敌同屏叠加层每帧 < 1.5ms`, perf.msPerFrame < 1.5 && perf.enemies >= 140, perf);
  }
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
