// 行营休整：军需商人 / 军医两页截图（电脑版 960×540 → 1280×720）。用法：BASE=… node tools/shot-camp-stations.mjs <目录> <前缀>
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', dir = process.argv[2] ?? '.', pre = process.argv[3] ?? 'camp';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('s', '1'); } });
await p.goto(base + '?autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.campUI, null, { timeout: 60000 });
const tab = async t => { await p.evaluate(async t => { const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; s.over = true; s.legion.food = 500; s.player.hp = Math.round(s.player.maxHp * .55); if (!ui.root.visible) { ui.open('shot', '下一关'); ui.setVisible(true); } ui.tab = t; ui.notice = ''; ui.render(); }, t); await p.waitForTimeout(1500); await p.evaluate(t => { const ui = window.__game.scene.getScene('GameScene').campUI; ui.tab = t; ui.render(); }, t); await p.waitForTimeout(300); };
await tab(2); await p.screenshot({ path: `${dir}/${pre}-merchant.png` });
await tab(4); await p.screenshot({ path: `${dir}/${pre}-medic.png` });
await b.close();
