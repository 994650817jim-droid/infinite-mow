// 义军营寨的营帐与兵士（src/town/CampLife.ts，CityScene 营寨档）：
// 营寨档有营帐 / 大旗 / 火塘 / 兵器架等装饰与 8–14 名兵士（巡逻、走动、校场操练、火塘边站着）；装饰不挡建筑点击、不压建筑外框、不接收点击；
// 兵士会走动、操练会换帧、大旗会摆；升县城后不画营寨装饰。
// 前后对比截图：1280×720 / 1620×900 / 1920×1080（before = ?camplife=0），存 assets/review/camp-life/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-camp-life.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/camp-life';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const save = (hall = 1) => ({ version: 10, yellowStages: 3, dongzhuoStages: hall > 1 ? 3 : 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: hall > 1 }, merits: 0, provisions: 120, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2, intelSeq: 1,
  town: { year: 185, season: 1, levels: { hall, barracks: 0, farm: 0, academy: 1, talent: 1, stable: 0, granary: 0, pavilion: 0 }, focus: {}, report: null, tech: [], drill: 0 } });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function openCity(w, h, sv, q = '') {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errors.push(`${w} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_|Failed to load resource/.test(m.text())) errors.push(`${w} ${m.text()}`); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, sv);
  await p.goto(base + '?layout=desktop' + q); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene')));
  await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(1800);
  return p;
}
const info = p => p.evaluate(() => {
  const c = window.__game.scene.getScene('CityScene'), cl = c.campLife; if (!cl) return { camp: false, size: null };
  const root = cl.root, kids = root.list, pano = c.pano, ox = pano.x, oy = pano.y;
  const hitBoxes = c.hits.map(h => h.getBounds());
  const props = kids.filter(o => (o.name || '').startsWith('camp-prop-')), men = kids.filter(o => /^camp-(walker|drill|idle)/.test(o.name || ''));
  const overlap = props.filter(o => { const bb = o.getBounds(); return hitBoxes.some(hb => Phaser.Geom.Rectangle.Overlaps(hb, new Phaser.Geom.Rectangle(bb.x + bb.width * .2, bb.y + bb.height * .3, bb.width * .6, bb.height * .6))); }).map(o => o.name);
  const idxRoot = pano.list.indexOf(root), idxBuild = pano.list.findIndex(o => o.texture?.key?.startsWith('city_') && !o.texture.key.startsWith('city_bg'));
  return { camp: true, info: cl.info, props: props.length, men: men.length, kinds: [...new Set(props.map(o => o.name.replace('camp-prop-', '')))], interactive: kids.filter(o => o.input?.enabled).length, overlap, below: idxRoot >= 0 && (idxBuild < 0 || idxRoot < idxBuild), walkers: kids.filter(o => /^camp-walker-/.test(o.name || '')).map(w => [Math.round(w.x), Math.round(w.y)]) };
});

for (const [w, h] of [[1280, 720], [1620, 900], [1920, 1080]]) {
  const pb = await openCity(w, h, save(1), '&camplife=0'); await pb.screenshot({ path: `${OUT}/before-${w}x${h}.png` }); await pb.close();
  const p = await openCity(w, h, save(1));
  const a = await info(p);
  await p.screenshot({ path: `${OUT}/after-${w}x${h}.png` });
  await p.waitForTimeout(1500);
  const b2 = await info(p);
  const moved = (a.walkers ?? []).filter((w, i) => b2.walkers?.[i] && (w[0] !== b2.walkers[i][0] || w[1] !== b2.walkers[i][1])).length;
  ck(`${w}×${h}：营寨档有营帐 / 大旗 / 火塘 / 兵器架等装饰（≥8 件）与兵士（8–18 人；11-18 全屏放大后营帐、兵士加多）`, a.camp && a.props >= 8 && a.men >= 8 && a.men <= 18 && ['tent', 'flag', 'fire'].every(k => a.kinds.includes(k)), a);
  ck(`${w}×${h}：装饰画在建筑之下、不接收点击、不压建筑点击区`, a.below && a.interactive === 0 && a.overlap.length === 0, { below: a.below, interactive: a.interactive, overlap: a.overlap });
  ck(`${w}×${h}：兵士在走动（1.5 秒内至少 4 人移动了位置）`, moved >= 4, { moved, n: a.walkers?.length });
  // 建筑照常能点（点讲武堂弹出面板）
  const click = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), h = c.hits.find(h => h.name === 'bld-academy'); if (!h) return 'no-hit'; h.emit('pointerdown'); h.emit('pointerup'); return !!c.children.getByName('town-card'); });
  ck(`${w}×${h}：建筑照常能点（讲武堂弹出面板）`, click === true, click);
  await p.close();
}
// 升县城：不画营寨装饰
{
  const p = await openCity(1280, 720, save(2));
  const a = await info(p); await p.screenshot({ path: `${OUT}/county-1280x720.png` });
  ck('升县城后（营寨扩成县城）不画营寨装饰', a.camp === false, a);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
