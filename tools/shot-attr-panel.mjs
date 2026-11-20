// 「武将修习 · 属性分配」面板截图（电脑布局）：以指定武将 / 等级 / 加点开局后打开面板，截整屏。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ HERO=guanyu LV=11 STR=6 FREE=3 NAME=after node tools/shot-attr-panel.mjs     输出 assets/review/attr-panel/<NAME>-<HERO>-<LV>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', HERO = E.HERO ?? 'zhaoyun', LV = +(E.LV ?? 11), NAME = E.NAME ?? 'shot', OUT = 'assets/review/attr-panel'; mkdirSync(OUT, { recursive: true });
const pts = { strength: +(E.STR ?? 0), agility: +(E.AGI ?? 0), intellect: +(E.INT ?? 0), command: +(E.CMD ?? 0) }, FREE = +(E.FREE ?? 0);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1200);
  await p.evaluate(async ([h, lv, pts]) => {
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 4, heroes: { [h]: { level: lv, xp: 0, attributes: pts } } }));
    (await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/HeroProgress.ts')) ?? '/src/systems/HeroProgress.ts')).resetHeroCache();
    const s = window.__game.scene.getScene('GameScene'); s.registry.remove('campaignTransfer'); s.registry.set('runConfig', { character: h, chapter: 'huangjin', stage: 1 }); s.scene.start('GameScene');
  }, [HERO, LV, pts]);
  await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.player.growth.character === h; }, HERO, { timeout: 90000, polling: 500 }); await p.waitForTimeout(1500);
  await p.evaluate(free => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.player.growth.unallocated = free; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }, FREE);
  await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/${NAME}-${HERO}-${LV}.png` });
  console.log('shot', `${OUT}/${NAME}-${HERO}-${LV}.png`, 'errors', errs.slice(0, 3));
} finally { await b.close(); }
