// 行营休整各页签截图（电脑布局 1280×720），给样式改版做前后对比：招兵营 / 军需商人 / 将帅帐（四个子页签各一张）/ 军医（有的话）。
// 用法：BASE=http://127.0.0.1:5188/ TAG=after node tools/shot-camp-rest.mjs   → assets/review/camp-rest/<TAG>-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/camp-rest';
mkdirSync(OUT, { recursive: true });
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  await p.goto(BASE + '?dev=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
  await ev(s => { s.legion.recruit('swordsman', 3, true); s.legion.recruit('archer', 2, true); s.player.hp = Math.round(s.player.maxHp * .45); for (const u of s.legion.units) if (u.active) u.hp = Math.round(u.maxHp * .6); s.legion.food = 188; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 120 && !(await ev(s => s.mode === 'rest')); i++) { await ev(s => { if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode === 'bossloot' || s.mode === 'levelup') s.__DEV_ACTIONS?.closePopup?.(); const c = s.bossChests?.find(c => !c.done && c.ready); if (c) { s.player.sprite.x = c.x; s.player.sprite.y = c.y; } }); await p.waitForTimeout(200); }
  // 等入营过场（墨迹揭开、首领遗珍提示）走完、行营界面真正显示
  for (let i = 0; i < 60 && !(await ev(s => s.mode === 'rest' && s.campUI.root.visible && !s.children.getByName('rest-intro'))); i++) { await ev(s => { const t = s.children.list.find(o => /rest-intro|relic-notice|boss-relic/.test(o.name ?? '')); t?.emit?.('pointerdown'); }); await p.waitForTimeout(250); }
  await p.waitForTimeout(800);
  await ev(s => { for (const o of s.children.list) if (/^rest-summary/.test(o.name ?? '') || /hero-bark|toast/.test(o.name ?? '')) o.setVisible?.(false); });
  const tabs = await ev(s => s.campUI.root.list.filter(o => /^camp-tab-\d$/.test(o.name ?? '')).map(o => o.name));
  for (const t of tabs) {
    await ev((s, n) => { s.campUI.root.getByName(n).emit('pointerdown'); }, t); await p.waitForTimeout(700);
    if (t === 'camp-tab-3') {
      for (let k = 0; k < 4; k++) { await ev((s, k) => { s.campUI.root.list.flatMap(o => o.list ?? []).find(o => o.name === 'camp-build-section-' + k)?.emit('pointerdown'); }, k); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${TAG}-${t}-${k}.png` }); }
    } else await p.screenshot({ path: `${OUT}/${TAG}-${t}.png` });
  }
  console.log('shots', TAG, tabs.join(' '));
} finally { await b.close(); }
