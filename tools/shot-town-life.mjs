// 城池全景截图（用户 2026-11-19：「城市市民穿模在建筑物上走，而且多一些市民建筑塞满城市。中间的桥生成也有问题，多点市民互动」）：
// 电脑布局 960×540，小 / 中 / 大城各截全景上半、下半两张（TIERS 可选 small,medium,large），另可点一位居民看喊话（BARK=1）。
// 用法：BASE=http://127.0.0.1:5173/ TAG=after [TIERS=medium] [BUILT=1] [BARK=1] node tools/shot-town-life.mjs → assets/review/town-life/<TAG>-<档>-{top,bottom}.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/town-life';
const tiers = (process.env.TIERS ?? 'small,medium,large').split(','), CITY = { small: 'guandu', medium: 'xuchang', large: 'luoyang' };
mkdirSync(out, { recursive: true });
// TIERS 也可直接写城池 id（如 runan）；OFFICE = 府衙等级（默认 1）
const OWNED = ['xuchang', 'luoyang', 'guandu', 'runan'], OFFICE = +(process.env.OFFICE ?? 1);
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: OWNED, eraSeen: 2, capturedEver: OWNED, alerts: [], lastLost: [], chapterSeen: 3,
  cities: Object.fromEntries(OWNED.map(id => [id, { office: OFFICE, tuntian: process.env.BUILT ? 1 : 0, muster: process.env.BUILT ? 1 : 0 }])),
  town: { year: 188, season: 2, levels: { hall: 3, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 0, granary: 1, pavilion: 0 }, focus: {}, report: null, tech: [], drill: 0 } };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(sv => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); }, save);
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
for (const t of tiers) {
  await p.evaluate(id => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('TownScene', { city: id })), CITY[t] ?? t);
  await p.waitForFunction(() => window.__game.scene.isActive('TownScene') && window.__game.scene.getScene('TownScene').hits?.length, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  for (const [name, y] of [['top', 0], ['bottom', 1e4]]) { await p.evaluate(y => window.__game.scene.getScene('TownScene').scrollTo(0, y), y); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${tag}-${t}-${name}.png` }); }
  if (process.env.REF) { // 比例参照：每种建筑旁站一个居民（同走动居民的大小），放大到 1:1 截两处
    await p.evaluate(() => { const s = window.__game.scene.getScene('TownScene'), w = s.folk.walkers[0].img, list = [...s.pano.list];
      for (const o of list) { if (o.type !== 'Image' || !(/^(house-|hq-(talent|academy|stable|barracks)$)/.test(o.name) || /^town_(office|tuntian|muster)_/.test(o.texture.key))) continue;
        const m = s.add.image(o.x - o.displayWidth * .38, o.y + 2, 'folk_man', 'down_0').setOrigin(.5, .92).setScale(w.scaleX).setName('ref-folk'); m.zy = o.y + 3; s.pano.add(m); }
      s.folk.sortPano(); });
    for (const [name, x, y] of process.env.REF.split(';').map(v => v.split(','))) { await p.evaluate(([x, y]) => { const s = window.__game.scene.getScene('TownScene'); s.zoomAt(1, 480, 300); s.scrollTo(+x, +y); }, [x, y]); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${tag}-${t}-ref-${name}.png` }); }
    await p.evaluate(() => window.__game.scene.getScene('TownScene').zoomAt(0.1, 480, 300));
  }
  if (process.env.BARK) {
    const r = await p.evaluate(() => { const s = window.__game.scene.getScene('TownScene'), w = s.folk?.walkers?.find(w => w.img.visible); if (!w) return null; const R = window.__game.canvas.getBoundingClientRect(), k = R.width / window.__game.scale.width, z = s.pano.scaleX; return { x: R.left + (w.img.x * z + s.pano.x) * k, y: R.top + ((w.img.y - 10) * z + s.pano.y) * k }; });
    if (r) { await p.mouse.click(r.x, r.y); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-${t}-bark.png` }); }
  }
}
console.log('errors', JSON.stringify(errors.slice(0, 3)));
await b.close();
