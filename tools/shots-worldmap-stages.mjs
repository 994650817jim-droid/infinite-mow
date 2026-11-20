// 天下地图 V1 关卡点对位前后截图（2026-11-19 用户「这里我感觉有点怪」）：第二章（2-1 已过）、第三章、第五章、第九章，
// 每张以该章为当前章、镜头对准本章关卡（州郡档）。也顺带检查关卡点与同名城池的屏幕距离。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shots-worldmap-stages.mjs   → assets/review/worldmap-v1/stages-<TAG>-ch*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/worldmap-v1';
mkdirSync(out, { recursive: true });
const common = { version: 7, worldAvailable: true, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], tutorialDone: true, nodes: ['home', 'huangjin', 'hulao'], eraSeen: 3, capturedEver: [], ownedCities: [] };
const saves = {
  ch2: { ...common, yellowStages: 3, dongzhuoStages: 1, warlordStages: 0, cleared: { huangjin: true, hulao: false }, chapterSeen: 2, eraSeen: 0 },
  ch3: { ...common, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, cleared: { huangjin: true, hulao: true }, chapterSeen: 3 },
  ch5: { ...common, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 1, cleared: { huangjin: true, hulao: true }, chapterSeen: 5, ownedCities: ['xuchang'], capturedEver: ['xuchang'] },
  ch9: { ...common, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 1, cleared: { huangjin: true, hulao: true }, chapterSeen: 9, ownedCities: ['xuchang'], capturedEver: ['xuchang'] },
};
const roster = { version: 1, lord: 'guanyu', lordFinal: true, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [], report = {};
for (const [name, sv] of Object.entries(saves)) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await p.addInitScript(([sv, rs]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_roster_v1', JSON.stringify(rs)); localStorage.setItem('im_last_hero', 'guanyu'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, [sv, roster]);
  await p.goto(base + '?layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); for (const n of ['era-intro', 'chapter-intro', 'world-guide']) s.children.getByName(n)?.destroy?.();
    const pins = s.pins ?? []; if (pins.length) { const cx = pins.reduce((a, q) => a + q.x, 0) / pins.length, cy = pins.reduce((a, q) => a + q.y, 0) / pins.length; s.flyTo(cx, cy, s.zoom, 0); }
    return null; });
  await p.waitForTimeout(1200);
  report[name] = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene');
    return (s.pins ?? []).map(q => { const lab = q.root.getData('label'); const near = s.cityMarkers.map(m => ({ n: m.city.name, d: Math.hypot(m.root.x - q.root.x, m.root.y - q.root.y) })).sort((a, b) => a.d - b.d)[0];
      return { stage: q.stage, label: lab?.text, visible: q.root.visible, nearCity: near?.n, screenDist: Math.round(near?.d ?? -1) }; }); });
  await p.screenshot({ path: `${out}/stages-${tag}-${name}.png` });
  await p.close();
}
await b.close();
console.log(JSON.stringify(report, null, 1));
console.log('errors', errors.slice(0, 3));
