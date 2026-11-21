// 逐关 HUD 截图（mech=real）：新档 1-1、1-1 打完进 1-2、1-2 打完进 1-3、第一章通关进 2-1。看开放前该藏的东西有没有藏干净。
// 用法：BASE=http://127.0.0.1:5241/ node tools/shot-hud-unlocks.mjs   截图在 assets/review/hud-unlocks/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/hud-unlocks'; mkdirSync(OUT, { recursive: true });
const fresh = { version: 10, yellowStages: 0, cleared: { huangjin: false, hulao: false }, worldAvailable: false, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'], tutorialDone: true };
const worlds = [['1-1', fresh, 1], ['1-2', { ...fresh, yellowStages: 1 }, 2], ['1-3', { ...fresh, yellowStages: 2 }, 3], ['2-1', { ...fresh, yellowStages: 3, cleared: { huangjin: true, hulao: false }, worldAvailable: true, nodes: ['home', 'huangjin', 'hulao'], chapterSeen: 2 }, 1]];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const out = {};
for (const [name, w, stage] of worlds) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(w => { if (sessionStorage.getItem('__i')) return; sessionStorage.setItem('__i', '1'); localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tut_done', '1'); }, w);
  await p.goto(BASE + `?dev=1&mech=real&autostart=1&stage=${stage}&layout=desktop&story=off`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').elapsed > .5, null, { timeout: 120000 });
  if (name === '2-1') { await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 1 }); s0.scene.restart(); }); await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter?.id === 'hulao' && s.elapsed > .8; }, null, { timeout: 120000 }); }
  await p.waitForTimeout(2500);
  out[name] = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 6 && s.mode !== 'none'; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); }
    const vis = []; const walk = (l, depth) => { for (const o of l) { if (!o.visible) continue; if (o.scrollFactorX === 0 && (o.name || typeof o.text === 'string')) vis.push((o.name || '') + (typeof o.text === 'string' && o.text ? '「' + o.text.slice(0, 24) + '」' : '')); if (o.list) walk(o.list, depth + 1); } }; walk(s.children.list, 0);
    return { stage: s.chapter?.id + '-' + (s.chapter?.stage ?? s.chapter?.westStage), hud: vis.filter(Boolean).slice(0, 80) }; });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await p.close();
}
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
await b.close();
