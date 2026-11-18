// 营寨全景截图（电脑布局 1920×1080，全景纵向分上 / 下两张）：营寨档（大殿 1 级）、第一章已通关（坐骑开放、马厩自动建成）。
// GRID=1 时在全景上叠 100 像素坐标网格（只用于摆装饰时找空地，不进游戏）。
// 用法：BASE=http://127.0.0.1:5197/ TAG=before GRID=1 node tools/shot-camp-pano.mjs → assets/review/camp-pano/<TAG>-top.png / <TAG>-bottom.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'shot', OUT = 'assets/review/camp-pano';
mkdirSync(OUT, { recursive: true });
const save = { version: 10, yellowStages: 3, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true }, merits: 0, provisions: 120, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2, intelSeq: 1, mountTutorialDone: true,
  town: { year: 185, season: 1, levels: { hall: 1, barracks: 1, farm: 1, academy: 1, talent: 1, stable: 0, granary: 0, pavilion: 0 }, focus: {}, report: null, tech: [], drill: 0 } };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop' + (process.env.Q ?? ''));
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(2200);
if (process.env.GRID) await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), k = c.k, g = c.add.graphics(); for (let x = 0; x <= 1536; x += 100) g.lineStyle(1, 0xff3030, .7).lineBetween(x * k, 0, x * k, 1024 * k); for (let y = 0; y <= 1024; y += 100) g.lineStyle(1, 0x30a0ff, .7).lineBetween(0, y * k, 1536 * k, y * k); c.pano.add(g); for (let x = 0; x <= 1500; x += 100) for (let y = 0; y <= 1000; y += 200) c.pano.add(c.add.text(x * k + 2, y * k + 2, `${x},${y}`, { fontSize: '11px', color: '#ffff60', backgroundColor: '#000a' })); });
for (const [name, frac] of [['top', 0], ['bottom', 1]]) {
  await p.evaluate(f => { const c = window.__game.scene.getScene('CityScene'); c.scrollTo(0, (1024 * c.k - c.vr.h) * f, false); }, frac);
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
}
const info = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); return { k: c.k, vr: c.vr, camp: c.campLife?.info, stable: c.hits.some(h => h.name === 'bld-stable') }; });
console.log(JSON.stringify(info), errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
await b.close();
