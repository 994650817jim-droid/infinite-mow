// 军医（用户 2026-11-20：「军医随着章节往后推越贵，还有军医再营寨城市也有」）：
// 价格随章节复利递增；行营（战斗场景）/ 营寨 / 城池三处同一章同价；营寨、城池能治存档点里的伤并扣营寨军粮；军医与旅商分开。
// 电脑布局 960×540，截图 assets/review/medic/{camp,city}-{building,panel}.png。用法：BASE=http://127.0.0.1:5173/ node tools/test-medic-anywhere.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/medic';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
let pass = 0, fail = 0; const ok = (c, m, d) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + m + (c || d === undefined ? '' : ' · ' + JSON.stringify(d))); };
const camp = { version: 2, heroes: { zhaoyun: { character: 'zhaoyun', chapter: 'hulao', army: { food: 50, dead: 0, recruited: 0, levels: {}, soldiers: [{ kind: 'swordsman', hp: 20, max: 60 }, { kind: 'spearman', hp: 70, max: 70 }] }, player: { stats: {}, weapons: [], hpFrac: .4, followerHp: { r1: 0, r2: 1 } } } } };
await p.addInitScript(cs => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_city_intro_v3', '1'); localStorage.setItem('im_mount_guide_v1', '1'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_campaign_v1', JSON.stringify(cs)); sessionStorage.setItem('seeded', '1'); }, camp);
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
// 世界：第一章、虎牢关、群雄三关都打完 → 天下进度到官渡；营寨档（主帐 1 级），占许昌（中城）
await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); Object.assign(s, { yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, worldAvailable: true, provisions: 1000, tutorialSeen: true }); s.cleared.huangjin = true; s.cleared.hulao = true; s.ownedCities = ['xuchang']; s.capturedEver = ['xuchang']; s.town.levels.hall = 1; localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1'); });
// 1) 价格曲线与章节
const pr = await p.evaluate(async () => { const m = await import('/src/data/campMedic.ts'), c = await import('/src/town/CampMedic.ts'); const kinds = ['small', 'full', 'army'];
  const rows = kinds.map(k => Array.from({ length: 12 }, (_, i) => m.medicPrice(k, i + 1)));
  const wch = c.worldMedicChapter();
  return { rows, inc: rows.every(r => r.every((v, i) => !i || v > r[i - 1])), late: rows.map(r => +(r[11] / r[0]).toFixed(2)), fullOk: Array.from({ length: 12 }, (_, i) => m.medicPrice('full', i + 1, .05) >= Math.round(m.medicPrice('small', i + 1) * 1.8)).every(Boolean),
    wch, siege: m.medicChapter('SiegeGameScene', 'hulao', wch), guandu: m.medicChapter('GuanduGameScene', 'hulao', wch), small: m.medicPrice('small', wch), army: m.medicPrice('army', wch) }; });
ok(pr.inc && pr.fullOk, '价格每章都比上一章贵（小治 / 大治 / 全军），大治至少小治 ×1.8 · 第 12 章约为第 1 章 ×' + pr.late.join(' / '));
ok(pr.wch === 4 && pr.guandu === 4 && pr.siege === 4, '章节：天下进度到官渡 = 第 4 章；行营官渡关、攻城战都按第 4 章（攻城不再回落第 1 章）', pr);
// 2) 营寨军医
await p.evaluate(() => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('CityScene')));
await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').hits?.length, null, { timeout: 60000 }); await p.waitForTimeout(1800);
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.mountGuide?.stop?.(); });
const cb = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), m = c.hits.find(h => h.name === 'bld-medic'), s = c.hits.find(h => h.name === 'bld-merchant'); if (!m) return null; const a = m.getBounds(), q = s?.getBounds(); return { sep: !q || !Phaser.Geom.Rectangle.Overlaps(a, q), x: m.x, y: m.y, tag: c.pano.getByName('medic-tent')?.getByName('tag-medic')?.text }; });
ok(cb && cb.tag === '军医' && cb.sep, '营寨有「军医」帐，与旅商分开（点击区不相交）', cb);
await p.evaluate(({ x, y }) => { const c = window.__game.scene.getScene('CityScene'); c.zoomAt(1, 480, 300); c.scrollTo(x - 480, y - 300, false); }, cb); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/camp-building.png` });
const panel = async scene => p.evaluate(sc => { const s = window.__game.scene.getScene(sc), m = s.children.getByName('medic-panel'); if (!m) return null; const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.list);
  const btn = k => all.find(o => o.name === 'medic-' + k); return { small: btn('small')?.getData('price'), full: btn('full')?.getData('price'), army: btn('army')?.getData('price'), on: ['small', 'full', 'army'].map(k => !!btn(k)?.input?.enabled), hp: all.find(o => o.name === 'medic-hp')?.text, art: !!all.find(o => o.name === 'camp-medic-art') }; }, scene);
const press = (scene, k) => p.evaluate(([sc, k]) => { const s = window.__game.scene.getScene(sc), m = s.children.getByName('medic-panel'); const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.list); all.find(o => o.name === 'medic-' + k).emit('pointerdown'); }, [scene, k]);
const save = () => p.evaluate(async () => ({ grain: (await import('/src/world/WorldStore.ts')).loadWorld().provisions, c: JSON.parse(localStorage.getItem('im_campaign_v1')).heroes.zhaoyun }));
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), h = c.hits.find(x => x.name === 'bld-medic'); h.emit('pointerdown'); h.emit('pointerup'); });
await p.waitForFunction(() => window.__game.scene.getScene('CityScene').children.getByName('medic-panel'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
let pn = await panel('CityScene');
ok(pn && pn.small === pr.small && pn.army === pr.army && pn.on.every(Boolean) && pn.hp === '生命 40%', '营寨军医面板：价格与行营同章同价（小治 ' + pr.small + '、全军 ' + pr.army + '），主将 40%，三档都可点', pn);
await p.screenshot({ path: `${out}/camp-panel.png` });
const g0 = (await save()).grain; await press('CityScene', 'small'); await p.waitForTimeout(300); let sv = await save();
ok(sv.grain === g0 - pr.small && Math.abs(sv.c.player.hpFrac - .65) < 1e-6, '营寨小治：扣营寨军粮 ' + pr.small + '、存档点主将 40% → 65%', { g0, sv: sv.grain, hp: sv.c.player.hpFrac });
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
// 3) 城池军医（许昌）
await p.evaluate(() => window.__game.scene.getScene('CityScene').scene.start('TownScene', { city: 'xuchang' }));
await p.waitForFunction(() => window.__game.scene.isActive('TownScene') && window.__game.scene.getScene('TownScene').hits?.length, null, { timeout: 60000 }); await p.waitForTimeout(1800);
const tb = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), m = t.hits.find(h => h.name === 'bld-hq-medic'), s = t.hits.find(h => h.name === 'bld-hq-merchant'); if (!m) return null; return { sep: !s || !Phaser.Geom.Rectangle.Overlaps(m.getBounds(), s.getBounds()), tag: t.pano.getByName('tag-hq-medic')?.text, x: m.x, y: m.y }; });
ok(tb && tb.tag === '军医' && tb.sep, '城池有「军医」医馆，与旅商分开', tb);
await p.evaluate(({ x, y }) => { const t = window.__game.scene.getScene('TownScene'); t.zoomAt(1, 480, 300); t.scrollTo(x - 480, y - 330); }, tb); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/city-building.png` });
await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'), h = t.hits.find(x => x.name === 'bld-hq-medic'); h.emit('pointerdown'); h.emit('pointerup'); });
await p.waitForFunction(() => window.__game.scene.getScene('TownScene').children.getByName('medic-panel'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
pn = await panel('TownScene');
ok(pn && pn.small === pr.small && pn.army === pr.army && pn.hp === '生命 65%', '城池军医面板：同章同价，读到营寨治过的 65%', pn);
await p.screenshot({ path: `${out}/city-panel.png` });
const g1 = (await save()).grain; await press('TownScene', 'army'); await p.waitForTimeout(300); sv = await save();
ok(sv.grain === g1 - pr.army && sv.c.player.followerHp.r1 === 1 && sv.c.army.soldiers.every(s => s.hp === s.max), '城池为全军疗伤：扣军粮 ' + pr.army + '，随从与部曲存档点回满', { g1, g: sv.grain, f: sv.c.player.followerHp, s: sv.c.army.soldiers });
pn = await panel('TownScene'); ok(!pn.on[2], '全军已无恙：「为全军疗伤」不可再点');
ok(errors.length === 0, '无页面报错 ' + JSON.stringify(errors.slice(0, 3)));
console.log(`\n${pass}/${pass + fail} passed`);
await b.close(); process.exit(fail ? 1 : 0);
