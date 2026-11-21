// 敌兵密集时顶部 / 左上 / 右上浮动 HUD 字的可读性（2026-11-21 制作人验收：6-1 计时、关名、战况线压在敌兵上看不清）。
// 1-1 电脑布局：把一大片敌兵摆到屏幕上半部（计时 / 关名 / 战况线 / 随军粮 / 被动栏 / 击杀数底下），摆好后马上截图（敌兵还没走开）。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-hud-crowd.mjs   → assets/review/hud-crowd/<TAG>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/hud-crowd';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('s', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 3; }, null, { timeout: 180000 });
await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
  for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup();
  const cam = s.cameras.main, v = cam.worldView, P = s.player;
  // 屏幕上 30% 铺满敌兵（世界坐标，按镜头视野换算），左右各一片压在左上 / 右上浮动字底下
  for (let i = 0; i < 90; i++) { const x = v.x + 20 + (i % 15) * (v.width - 40) / 14, y = v.y + 12 + Math.floor(i / 15) * v.height * .055; s.spawnEnemy('infantry', x, y, 1, true); }
  for (const w of P.weapons) w.cooldownLeft = 1e9;
});
await p.waitForTimeout(600);
await p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
await p.screenshot({ path: `${OUT}/${TAG}.png` });
console.log('shot', TAG, JSON.stringify(errs.slice(0, 3)));
await b.close();
