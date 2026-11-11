import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const chapter = process.argv[2] === 'hulao' ? 'hulao' : 'huangjin';
const out = `assets/review/batch-01/mobile-${chapter}`; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const deadline = setTimeout(() => { console.error('Mobile smoke timeout'); void browser.close().finally(() => process.exit(2)); }, 45000);
const results = [];
try {
  for (const [width, height] of [[360, 800], [390, 844], [430, 932]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:5173/?autostart=1&chapter=${chapter}`); await page.waitForFunction(() => !!window.__IM);
      await page.evaluate(() => { window.__IM.god(); window.__IM.setTime(61); });
      await page.waitForFunction(() => window.__IM.mode === 'recruit');
      const cardPoint = kind => page.evaluate(kind => {
        const s = window.__game.scene.getScene('GameScene'), item = kind === 'recruit' ? s.recruitViews[0].bg : s.cardViews[0].bg;
        const b = item.getBounds(), c = document.querySelector('canvas').getBoundingClientRect();
        return { x: c.x + (b.x + b.width / 2) * c.width / s.scale.width, y: c.y + (b.y + b.height / 2) * c.height / s.scale.height };
      }, kind);
      await page.screenshot({ path: `${out}/recruit-${width}.png` });
      let point = await cardPoint('recruit'); await page.touchscreen.tap(point.x, point.y);
      await page.waitForFunction(() => window.__IM.mode === 'none');
      const recruit = await page.evaluate(() => window.__IM.allyInfo().length);
      await page.evaluate(async () => {
        const s = window.__game.scene.getScene('GameScene'); window.__IM.addLevel();
        const { buildUpgradeOptions } = await import('/src/data/upgrades.ts');
        for (let i = 0; i < 100; i++) { const options = buildUpgradeOptions(s.player, s.player.weapons); if (options.some(o => o.id === 'up_spear_orbit')) { s.upgradeOptions = options; s.renderCards(); break; } }
      });
      await page.screenshot({ path: `${out}/upgrade-${width}.png` });
      const textFit = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene');
        return s.cardViews.every(v => { const card = v.bg.getBounds(), text = v.desc.getBounds(); return text.bottom <= card.bottom && text.top >= v.name.getBounds().bottom && text.top >= card.top; });
      });
      point = await cardPoint('upgrade'); await page.touchscreen.tap(point.x, point.y);
      await page.waitForFunction(() => window.__IM.mode === 'none');
      if (width === 390) {
        await page.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); s.boss.hp = 1100; });
        await page.waitForTimeout(450); await page.screenshot({ path: `${out}/boss-shield-mobile.png` });
        await page.evaluate(() => window.__game.scene.getScene('GameScene').togglePause());
        await page.screenshot({ path: `${out}/pause-mobile.png` });
      }
      const noScroll = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight);
      const result = { width, height, recruit, upgradeClicked: true, textFit, noScroll, errors };
      results.push(result); console.log('MOBILE', JSON.stringify(result));
    } finally { await context.close(); }
  }
  writeFileSync(`${out}/mobile-smoke.json`, JSON.stringify(results, null, 2));
  if (results.some(r => r.recruit !== 1 || !r.textFit || !r.noScroll || r.errors.length)) process.exitCode = 1;
} finally { clearTimeout(deadline); await browser.close(); }
