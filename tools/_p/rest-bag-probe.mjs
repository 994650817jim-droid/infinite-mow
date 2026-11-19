// 行营休整点「行囊」打不开的探针（2026-11-20）：点击处最上层是谁、点后状态
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const d = await b.newPage({ viewport: { width: 1280, height: 720 } });
await d.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await d.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await d.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.__DEV_ACTIONS.winNow(); });
for (let i = 0; i < 40; i++) { const mode = await d.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode === 'bossloot') s.chooseUpgrade(0); return s.mode; }); if (mode === 'rest') break; await d.waitForTimeout(1000); }
await d.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s.mode === 'rest' && s.campUI?.root.visible && !s.children.getByName('rest-intro'); }, null, { timeout: 60000 }).catch(() => {});
await d.waitForTimeout(1200);
const at = await d.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), btn = s.campUI.root.list.find(o => o.name === 'camp-bag'), bb = btn?.getBounds(), r = window.__game.canvas.getBoundingClientRect(), cam = s.cameras.main, k = r.width / cam.width * cam.zoom;
  const ptr = s.input.activePointer, wx = bb?.centerX, wy = bb?.centerY; const hits = s.input.manager.hitTest({ x: wx * (r.width / cam.width), y: wy * (r.height / cam.height) }, s.input._list, cam).map(o => `${o.name || o.type}@${o.depth}`).slice(0, 6);
  return { found: !!btn, x: r.left + bb.centerX * k, y: r.top + bb.centerY * k, mode: s.mode, over: s.over, summary: !!s.children.getByName('rest-summary'), card: !!s.children.getByName('rest-summary-card'), hits, btnInteractive: !!btn?.input?.enabled, btnName: btn?.name, rootVisible: s.campUI.root.visible }; });
console.log('before', JSON.stringify(at));
await d.mouse.click(at.x, at.y); await d.waitForTimeout(500);
const after = await d.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { bag: !!s.children.getByName('item-bag'), mode: s.mode, summary: !!s.children.getByName('rest-summary'), card: !!s.children.getByName('rest-summary-card') }; });
console.log('after click 1', JSON.stringify(after));
await d.mouse.click(at.x, at.y); await d.waitForTimeout(500);
console.log('after click 2', JSON.stringify(await d.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { bag: !!s.children.getByName('item-bag'), mode: s.mode }; })));
await b.close();
