// 天下地图 V1 前后对比截图（2026-11-19 用户「天下地图ui修复」）：早期（第壹章已平、第贰章打到 2-1）默认视角 + 中期（打到第五章）全国视图。电脑版 1920×1080。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shots-worldmap-v1.mjs   → assets/review/worldmap-v1/<TAG>-early.png / <TAG>-mid.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/worldmap-v1';
mkdirSync(out, { recursive: true });
const common = { version: 7, worldAvailable: true, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], tutorialDone: true };
const early = { ...common, yellowStages: 3, dongzhuoStages: 1, warlordStages: 0, guanduStages: 0, cleared: { huangjin: true, hulao: false }, nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 0, capturedEver: [], chapterSeen: 2 };
const mid = { ...common, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 1, jingnanStages: 0, cleared: { huangjin: true, hulao: true }, nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang', 'chenliu', 'guandu', 'wancheng'], eraSeen: 3, capturedEver: ['xuchang', 'chenliu', 'guandu', 'wancheng'], chapterSeen: 5 };
const roster = { version: 1, lord: 'guanyu', lordFinal: true, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
for (const [name, sv] of [['early', early], ['mid', mid]]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([sv, rs]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_roster_v1', JSON.stringify(rs)); localStorage.setItem('im_last_hero', 'guanyu'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, [sv, roster]);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(2500);
  // 关掉新篇 / 引导弹窗
  await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); for (const n of ['era-intro', 'chapter-intro', 'world-guide']) s.children.getByName(n)?.destroy?.(); });
  if (name === 'mid') { await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.stepTier(-1, 480, 270); }); await p.waitForTimeout(1500); }
  await p.screenshot({ path: `${out}/${tag}-${name}.png` });
  await p.close();
}
await b.close();
console.log('shots', tag, errors.length ? errors.slice(0, 3) : 'no errors');
