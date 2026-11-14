import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const seconds = Math.max(5, Math.min(45, Number(process.argv.find(a => a.startsWith('--seconds='))?.split('=')[1]) || 20));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const deadline = setTimeout(() => { console.error('Performance smoke timeout'); void browser.close().finally(() => process.exit(2)); }, (seconds + 30) * 1000);
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?autostart=1'); await page.waitForFunction(() => !!window.__IM);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene'); window.__IM.god(); window.__IM.clearWeapons(); window.__IM.killAllEnemies();
    s.spawnTimer = 1e8; s.eliteTimer = 1e8; s.spawnBoss(); s.boss.sprite.setPosition(180, 0); s.boss.hp = s.boss.maxHp = 1e9;
    for (let i = 0; i < 149; i++) { const a = i * Math.PI * 2 / 149, e = s.spawnEnemy('elite', Math.cos(a) * 180, Math.sin(a) * 180, 1); e.hp = e.maxHp = 1e9; }
    for (const id of ['spear_orbit', 'crossbow', 'guandao', 'flame_banner']) { window.__IM.giveWeapon(id); s.player.weapons.at(-1).level = 5; }
    for (const kind of ['swordsman', 'archer', 'spearman', 'swordsman', 'spearman']) window.__IM.spawnAlly(kind);
  });
  if(process.argv.includes('--martials'))await page.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');for(const id of Object.keys(s.player.growth.masteries))s.player.growth.masteries[id]=3;s.legion.recruit('swordsman',15,true,true);});
  await page.waitForTimeout(1000);
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore = await cdp.send('Runtime.getHeapUsage');
  const sample = await page.evaluate(seconds => new Promise(resolve => {
    const s = window.__game.scene.getScene('GameScene'), start = performance.now(); let last = start, min = 999, max = 0; const frames = [];
    function tick(now) { frames.push(now - last); last = now; const n = window.__IM.enemies; min = Math.min(min, n); max = Math.max(max, n);
      if (now - start < seconds * 1000) return requestAnimationFrame(tick);
      const slow = frames.slice().sort((a, b) => b - a).slice(0, Math.ceil(frames.length * .01));
      resolve({ seconds: (now - start) / 1000, fps: frames.length * 1000 / (now - start), low1: 1000 / (slow.reduce((a, b) => a + b, 0) / slow.length), enemyMin: min, enemyMax: max, allies: s.allies.length, weapons: s.player.weapons.length, children: s.children.length, bolts: s.bolts.length, bullets: s.bullets.length, gridBuckets: s.grid.cells.size + s.grid.bucketPool.length });
    } requestAnimationFrame(tick);
  }), seconds);
  await cdp.send('HeapProfiler.collectGarbage'); const heapAfter = await cdp.send('Runtime.getHeapUsage');
  const result = { browser: browser.version(), viewport: '390x844', headless: true, mobileHardware: false, audioUnlocked: false, sample, heapBefore, heapAfter, errors };
  mkdirSync('screenshots/codex-fixes', { recursive: true }); writeFileSync('screenshots/codex-fixes/perf-smoke.json', JSON.stringify(result, null, 2));
  console.log('PERF', JSON.stringify(result));
  if (errors.length || sample.enemyMin !== 150 || sample.enemyMax !== 150) process.exitCode = 1;
} finally { clearTimeout(deadline); await browser.close(); }
