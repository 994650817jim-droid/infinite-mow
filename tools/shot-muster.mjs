// 点将出征页前后对比（2026-11-18 用户「按了出征之后，显示这个画面，想要修改」）：天下地图点第贰章 → 出征 → 选将页。电脑版 1920×1080。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-muster.mjs   输出 assets/review/muster/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'now', out = 'assets/review/muster';
mkdirSync(out, { recursive: true });
const save = { version: 7, yellowStages: 3, dongzhuoStages: 1, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 0, capturedEver: [], chapterSeen: 2, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(1500);
// 地图上点第贰章节点 → 出征
await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), n = s.markers.find(m => m.node.chapter === 'hulao' || m.node.id === 'hulao'); s.selected = { kind: 'node', node: n.node }; s.refresh(); s.action.image.emit('pointerup'); });
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/${TAG}-muster.png` });
const info = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); return { muster: !!m.muster, chapter: m.selectedChapter, west: m.selectedWestStage, start: m.startLabel?.text, cards: m.charCards.length, layoutLink: !!m.children.list.find(o => o.type === 'Text' && o.visible && /手机布局/.test(o.text)) }; });
console.log(TAG, JSON.stringify(info));
if (process.env.TAG === 'after') {
  // 换一位武将 + 切到下一关，再截一张
  await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.children.getByName('muster-hero-guanyu')?.emit('pointerdown'); });
  await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${TAG}-muster-guanyu.png` });
}
await b.close();
console.log(errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
