// 军中设置前后对比（2026-11-18 用户「这里设计ui也要优化」）：主页设置 + 战斗暂停设置。电脑版 1920×1080。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-settings.mjs   输出 assets/review/settings/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'now', out = 'assets/review/settings';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
const page = async q => { const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }); await p.goto(base + q, { timeout: 180000 }); return p; };
// 主页
{ const p = await page('?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').openHomeSettings()); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${TAG}-home.png` }); console.log('SHOT home');
  if (TAG === 'after') for (const t of ['view', 'battle', 'story']) { await p.evaluate(t => window.__game.scene.getScene('MenuScene').children.getByName('home-settings-panel').list.find(o => o.name === 'settings-tab-' + t)?.emit('pointerdown'), t); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${TAG}-home-${t}.png` }); }
  await p.close(); }
// 战斗暂停
{ const p = await page('?dev=1&autostart=1&stage=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { for (const id of ['dev-panel', 'dev-layout-toggle', 'dev-test-save']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.togglePause(); });
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${TAG}-pause.png` }); console.log('SHOT pause');
  if (TAG === 'after') { await p.evaluate(() => window.__game.scene.getScene('GameScene').pausePanel.list.find(o => o.name === 'settings-tab-view')?.emit('pointerdown')); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${TAG}-pause-view.png` }); }
  await p.close(); }
await b.close();
console.log(errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
