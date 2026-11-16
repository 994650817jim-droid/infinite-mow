// 战地招募 / 第一章告捷弹窗 UI 回归 + 截图：node tools/test-ui-polish.mjs <before|after>（需 dev server 5173）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after';
const out = 'assets/review/ui-polish';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
let fail = 0;
const hideDev = p => p.evaluate(() => { for (const el of document.querySelectorAll('body > div')) if ((el.textContent || '').includes('DEV 测试面板')) el.style.display = 'none'; });
const check = (n, ok, d) => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, d ? JSON.stringify(d) : ''); };
try {
  for (const desktop of [false, true]) {
    const lay = desktop ? 'desktop' : 'mobile';
    const p = await b.newPage({ viewport: desktop ? { width: 1280, height: 720 } : { width: 390, height: 844 }, isMobile: !desktop, hasTouch: !desktop });
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // 1) 战地招募
    await p.goto(`http://127.0.0.1:5173/?dev=1&autostart=1&stage=1&layout=${lay}`);
    await p.waitForFunction(() => window.__game?.scene.isActive('GameScene'), null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.waveIndex = 1; s.scheduleRecruit(); s.openRecruit(); });
    await p.waitForTimeout(400);
    await hideDev(p); await p.screenshot({ path: `${out}/${tag}-${lay}-recruit.png` });
    check(`${lay} recruit mode`, await p.evaluate(() => window.__game.scene.getScene('GameScene').mode === 'recruit'));
    check(`${lay} recruit cards on screen`, await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), W = s.scale.gameSize.width, H = s.scale.gameSize.height; return s.legionUI.rows.filter(r => r.root.visible).every(r => { const g = r.bg.getBounds(); return g.left >= 0 && g.right <= W && g.top >= 0 && g.bottom <= H && r.buy.getBounds().bottom <= g.bottom + 1; }); }));
    // hover state on first card
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const r = s.legionUI.rows.find(r => r.root.visible); r.buy.emit('pointerover'); });
    await p.waitForTimeout(200);
    await hideDev(p); await p.screenshot({ path: `${out}/${tag}-${lay}-recruit-hover.png` });
    await p.evaluate(() => window.__game.scene.getScene('GameScene').chooseRecruit(0));
    await p.waitForTimeout(150);
    check(`${lay} recruit closes after choose`, await p.evaluate(() => window.__game.scene.getScene('GameScene').mode !== 'recruit'));
    // 2) 第一章告捷
    await p.goto(`http://127.0.0.1:5173/?dev=1&chapter=huangjin&stage=3&autostart=1&layout=${lay}`);
    await p.waitForFunction(() => window.__game?.scene.isActive('GameScene'), null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.bossKilled = true; s.finish(true, 'boss'); });
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return !s.children.getByName('rest-intro') && s.children.getByName('chapter1-volunteers')?.visible; }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(300);
    await hideDev(p); await p.screenshot({ path: `${out}/${tag}-${lay}-victory.png` });
    check(`${lay} volunteers notice shown`, await p.evaluate(() => !!window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers')));
    await p.evaluate(() => { const n = window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers'); n.getByName('volunteers-confirm').emit('pointerover'); });
    await p.waitForTimeout(200);
    await hideDev(p); await p.screenshot({ path: `${out}/${tag}-${lay}-victory-hover.png` });
    await p.evaluate(() => { const n = window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers'); const c = n.getByName('volunteers-confirm'); c.emit('pointerdown'); c.emit('pointerup'); });
    await p.waitForTimeout(400);
    check(`${lay} confirm enters camp`, await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return !s.children.getByName('chapter1-volunteers') && s.mode === 'rest'; }));
    await p.close();
  }
} finally { await b.close(); }
check('no console/page errors', errors.length === 0, errors.slice(0, 5));
process.exit(fail ? 1 : 0);
