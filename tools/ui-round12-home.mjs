// 主页精简 + 章节选择（电脑 1280×720 / 1920×1080）。存档：新档、打到第五章（赤壁打完 1 关）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round12-home.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round12';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const MID = { version: 10, buildings: { barracks: 1, farm: 1, clinic: 1 }, cities: {}, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true } };
for (const [save, label] of [[null, 'fresh'], [MID, 'mid']]) for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(s => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); if (s) { localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 })); } }, save);
  await p.goto(`${base}?layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') && window.__game.scene.getScene('MenuScene').startButton, null, { timeout: 90000 }); await p.waitForTimeout(1800);
  const texts = await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.list.filter(o => o.type === 'Text' && o.visible && o.alpha > 0).map(o => o.text).filter(t => t && t.length > 1));
  console.log(label, vp.width, 'texts', texts.length, JSON.stringify(texts).slice(0, 400));
  await p.screenshot({ path: `${out}/${tag}-home-${label}-${vp.width}x${vp.height}.png` });
  // 点「匡扶汉室」
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton.emit('pointerdown')); await p.waitForTimeout(1200);
  // 2026-11-17 用户「点匡扶汉室是进入大地图，然后玩家自行选择」：天下已开 → 天下地图（在地图上选章，未到的章节锁住）；新档 → 直接出征 1-1
  if (label === 'mid') await p.waitForFunction(() => window.__game.scene.getScene('WorldMapScene')?.sys.isActive() && window.__game.scene.getScene('WorldMapScene').chips?.length, null, { timeout: 30000 }).catch(() => {});
  else await p.waitForFunction(() => window.__game.scene.isActive('GameScene'), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  const sel = await p.evaluate(() => { const scenes = window.__game.scene.getScenes(true).map(s => s.scene.key), w = window.__game.scene.getScene('WorldMapScene');
    const chips = w?.sys.isActive() ? w.chips.map(c => ({ id: c.id, state: c.state })) : []; return { scenes, chips }; });
  if (tag !== 'before') {
    if (label === 'fresh') ck(`fresh ${vp.width}×${vp.height}：新档点「匡扶汉室」直接出征 1-1`, sel.scenes.includes('GameScene') && !sel.scenes.includes('WorldMapScene'), sel.scenes);
    else {
      ck(`mid ${vp.width}×${vp.height}：点「匡扶汉室」进入天下地图（不再打开择章页），12 章在时间线上`, sel.scenes.includes('WorldMapScene') && sel.chips.length === 12, sel.scenes);
      const open = sel.chips.filter(c => c.state !== 'locked').length;
      ck(`mid ${vp.width}×${vp.height}：地图上已到的章节可点，未到的锁住`, open === 5, sel.chips.map(c => c.id + ':' + c.state));
    }
  }
  await p.screenshot({ path: `${out}/${tag}-after-start-${label}-${vp.width}x${vp.height}.png` });
  await ctx.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
