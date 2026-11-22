// 营寨马厩 + 坐骑引导（用户 11-18「义军营寨有马厩……也要新手引导装备马」）：
// ① 第一章没通关：营中没有马厩；通关后进营寨：自动建成 1 级马厩、提示「营中已设马厩」一次，点马厩 → 进入马厩 → 看到已有的马、能骑乘；
// ② 坐骑引导（?tutorial=1 强制，测试跑默认不开）：马厩 → 选马骑乘 → 效果说明，三步截图；看完记存档、再进不出；「跳过引导」也记存档；「重看新手引导」清掉后重出；
// ③ 战斗里第一次骑马：开局一句操作提示，只出一次。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-camp-mount.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/camp-mount';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const save = (cleared, extra = {}) => ({ version: 10, yellowStages: cleared ? 3 : 2, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: cleared ? { huangjin: true } : {}, merits: 0, provisions: 120, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2, intelSeq: 1,
  town: { year: 185, season: 1, levels: { hall: 1, barracks: 1, farm: 1, academy: 1, talent: 1, stable: 0, granary: 0, pavilion: 0 }, focus: {}, report: null, tech: [], drill: 0 }, ...extra });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const C = "window.__game.scene.getScene('CityScene')";
async function page(sv, q = '', ch1 = true) {
  const p = await b.newPage({ viewport: { width: 1620, height: 900 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(([sv, ch1]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_town_intro3', '1'); localStorage.setItem('im_tutorial_done', '1'); if (ch1) localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } }, [sv, ch1]);
  await p.goto(base + '?layout=desktop' + q);
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  return p;
}
const toCity = async p => { await p.evaluate(() => window.__game.scene.getScenes(true).forEach(s => s.scene.start('CityScene'))); await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 30000 }); await p.waitForTimeout(1500); };
const world = p => p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld());
const find = (p, name) => p.evaluate(([C0, name]) => { const walk = l => { for (const o of l) { if (o.name === name) return true; if (o.list && walk(o.list)) return true; } return false; }; return walk(eval(C0).children.list); }, [C, name]);
const clickHit = (p, name) => p.evaluate(([C0, name]) => { const c = eval(C0); const walk = l => { for (const o of l) { if (o.name === name) return o; if (o.list) { const r = walk(o.list); if (r) return r; } } return null; }; const h = c.hits?.find(h => h.name === name) ?? walk(c.children.list); if (!h) return false; h.emit('pointerdown', { x: 0, y: 0 }); h.emit('pointerup', { x: 0, y: 0 }); return true; }, [C, name]);
const guide = p => p.evaluate(C0 => { const g = eval(C0).mountGuide; return g ? { step: g.step, seen: g.seen, line: g.line, active: g.active } : null; }, C);

// ① 没通关：没有马厩
{
  const p = await page(save(false), '', false); await toCity(p);
  const w = await world(p), has = await p.evaluate(C0 => eval(C0).hits.some(h => h.name === 'bld-stable'), C);
  ck('第一章没通关：营中没有马厩（不自动建）', w.town.levels.stable === 0 && !has, { stable: w.town.levels.stable, has });
  await p.close();
}
// ① 通关后：自动建成 1 级马厩，提示一次；点进去能看已有的马、能骑乘
{
  const p = await page(save(true, { mountTutorialDone: true })); await toCity(p);
  const w = await world(p), has = await p.evaluate(C0 => eval(C0).hits.some(h => h.name === 'bld-stable'), C);
  const toast = await p.evaluate(C0 => eval(C0).toastText?.text ?? '', C);
  ck('第一章通关后进营寨：自动建成 1 级马厩（不花钱币）、营寨画面上有马厩、提示「营中已设马厩」', w.town.levels.stable === 1 && has && w.provisions === 120 && /营中已设马厩/.test(toast), { stable: w.town.levels.stable, has, toast, grain: w.provisions });
  await p.screenshot({ path: `${OUT}/stable-built.png` });
  const card = await p.evaluate(C0 => { const c = eval(C0); c.focusOn('stable'); return true; }, C); void card; await p.waitForTimeout(300);
  await clickHit(p, 'bld-stable'); await p.waitForTimeout(400);
  const cardInfo = await p.evaluate(C0 => { const c = eval(C0), m = c.children.getByName('town-card'); const t = m ? m.list.filter(o => o.type === 'Text').map(o => o.text).join('|') : ''; return { open: !!m, t }; }, C);
  ck('点马厩：弹出马厩卡片（Lv1、营寨档不能升级）', cardInfo.open && /马厩/.test(cardInfo.t), cardInfo);
  await clickHit(p, 'town-card-func'); await p.waitForTimeout(600);
  const bag = await p.evaluate(C0 => { const c = eval(C0), walk = (l, out) => { for (const o of l) { if (o.name) out.push(o.name); if (o.list) walk(o.list, out); } return out; }; const names = walk(c.children.list, []); return { bag: names.includes('item-bag'), ride: names.filter(n => n.startsWith('stable-ride-') || n === 'stable-dismount') }; }, C);
  ck('进入马厩：马厩面板打开，能看到已有的马（驽马）并可骑乘', bag.bag && bag.ride.length >= 1, bag);
  await p.screenshot({ path: `${OUT}/stable-panel.png` });
  await p.close();
  const p2 = await page(save(true, { mountTutorialDone: true, town: { ...save(true).town, levels: { ...save(true).town.levels, stable: 1 } } })); await toCity(p2);
  const toast2 = await p2.evaluate(C0 => eval(C0).toastText?.text ?? '', C);
  ck('已建过马厩：再进营寨不再提示', !/营中已设马厩/.test(toast2), toast2);
  await p2.close();
}
// 营寨布局（有马厩的营寨档）：装饰数量、按用途成组；不压建筑点击区与名牌；每座建筑都能点开
{
  const sv = save(true, { mountTutorialDone: true }); sv.town.levels.stable = 1;
  const p = await page(sv); await toCity(p);
  const lay = await p.evaluate(C0 => { const c = eval(C0), cl = c.campLife, kids = cl.root.list, R = Phaser.Geom.Rectangle;
    const props = kids.filter(o => (o.name || '').startsWith('camp-prop-')), men = kids.filter(o => /^camp-(walker|drill|idle)/.test(o.name || ''));
    const zones = [...c.hits.map(h => ({ n: h.name, b: h.getBounds() })), ...c.pano.list.filter(o => (o.name || '').startsWith('tag-')).map(o => ({ n: o.name, b: o.getBounds() }))];
    const over = []; for (const pr of props) { const bb = pr.getBounds(), inner = new R(bb.x + bb.width * .2, bb.y + bb.height * .3, bb.width * .6, bb.height * .6); for (const z of zones) if (R.Overlaps(z.b, inner)) over.push(pr.name + '×' + z.n); }
    const kinds = {}; for (const pr of props) { const k = pr.name.replace('camp-prop-', ''); kinds[k] = (kinds[k] ?? 0) + 1; }
    return { props: props.length, men: men.length, kinds, over, hits: c.hits.map(h => h.name) }; }, C);
  ck('营寨装饰：≥20 件，马厩旁有拴马桩 + 马 + 草料、主帐前「义」旗、军营前操练；兵士 8–18 人不挤（11-18 全屏放大后加多）', lay.props >= 20 && lay.kinds.horse === 2 && lay.kinds.rail >= 1 && lay.kinds.fodder >= 1 && lay.kinds.flag >= 3 && lay.men >= 8 && lay.men <= 18, { props: lay.props, men: lay.men, kinds: lay.kinds });
  ck('营寨装饰不压建筑点击区、不挡名牌', lay.over.length === 0, lay.over.slice(0, 6));
  const clicks = []; for (const n of lay.hits) { await p.evaluate(C0 => eval(C0).children.getByName('town-card')?.destroy(), C); await clickHit(p, n); await p.waitForTimeout(150); clicks.push([n, await p.evaluate(C0 => !!eval(C0).children.getByName('town-card'), C)]); }
  ck('每座建筑都能点开（含马厩）', clicks.every(c => c[1]) && clicks.some(c => c[0] === 'bld-stable'), clicks);
  await p.close();
}
// ② 坐骑引导三步 + 只出一次 + 重看
{
  const p = await page(save(true), '&tutorial=1'); await toCity(p);
  const g1 = await guide(p), arrow1 = await p.evaluate(C0 => { const c = eval(C0); const walk = l => { for (const o of l) { if (o.name === 'tutorial-arrow') return o.visible; if (o.list) { const r = walk(o.list); if (r !== undefined) return r; } } }; return walk(c.children.list); }, C);
  await p.screenshot({ path: `${OUT}/guide-1-stable.png` });
  ck('坐骑引导 ①：指向马厩「营中已设马厩：点马厩换马」', g1?.step === 'stable' && /马厩/.test(g1.line) && arrow1, { g1, arrow1 });
  await clickHit(p, 'bld-stable'); await p.waitForTimeout(300); await clickHit(p, 'town-card-func'); await p.waitForTimeout(700);
  const g2 = await guide(p); await p.screenshot({ path: `${OUT}/guide-2-pick.png` });
  ck('坐骑引导 ②：马厩面板里「选一匹马，点骑乘」', g2?.step === 'pick' && /骑乘/.test(g2.line), g2);
  await p.evaluate(C0 => { const c = eval(C0); const walk = l => { for (const o of l) { if (o.name?.startsWith('stable-ride-')) return o; if (o.list) { const r = walk(o.list); if (r) return r; } } return null; }; const btn = walk(c.children.list); btn?.emit('pointerdown', { x: 0, y: 0 }); btn?.emit('pointerup', { x: 0, y: 0 }); }, C);
  await p.waitForTimeout(500);
  const g3 = await guide(p); await p.screenshot({ path: `${OUT}/guide-3-info.png` });
  const ridden = await p.evaluate(async () => (await import('/src/systems/ItemStore.ts')).heroHorse('zhaoyun')?.id ?? null);
  ck('坐骑引导 ③：骑上后讲效果（移速 / 受伤减免 / 践踏 / 马力）', g3?.step === 'info' && /移速/.test(g3.line) && /马力/.test(g3.line) && !!ridden, { g3, ridden });
  await p.waitForTimeout(6200);
  const g4 = await guide(p), w = await world(p);
  ck('坐骑引导看完：收起、记存档', g4?.step === 'done' && !g4.active && w.mountTutorialDone === true, { g4, flag: w.mountTutorialDone });
  await toCity(p); const again = await guide(p);
  ck('坐骑引导只出一次：再进营寨不出', !again, again);
  // 重看：设置「重看新手引导」（setTutorialSeen(false)）一并清掉
  await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setTutorialSeen(false));
  await toCity(p); const re = await guide(p);
  ck('「重看新手引导」后坐骑引导重新出现', re?.step === 'stable' && re.active, re);
  // 跳过
  await clickHit(p, 'tutorial-skip'); await p.waitForTimeout(300);
  const sk = await guide(p), w2 = await world(p);
  ck('「跳过引导」：收起并记存档', sk?.step === 'done' && w2.mountTutorialDone === true, { sk, flag: w2.mountTutorialDone });
  await p.close();
}
// ③ 战斗里第一次骑马：开局一句操作提示，只出一次
{
  const p = await page(save(true, { mountTutorialDone: true }), '');
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&tutorial=1');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 });
  await p.evaluate(async () => { const m = await import('/src/systems/ItemStore.ts'); m.rideHorse('zhaoyun', 'nag'); const s = window.__game.scene.getScene('GameScene'); s.scene.restart(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive() && s.mount !== undefined; }, null, { timeout: 60000 }); await p.waitForTimeout(800);
  const h1 = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { mounted: !!s.mount, line: s.mountHint?.line ?? '' }; });
  await p.screenshot({ path: `${OUT}/battle-ride-hint.png` });
  ck('战斗里第一次骑马：开局一句操作提示（马力 / 落马）', h1.mounted && /马力/.test(h1.line) && /落马/.test(h1.line), h1);
  await p.evaluate(() => { void window.__game.scene.getScene('GameScene').scene.restart(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 60000 }); await p.waitForTimeout(800);
  const h2 = await p.evaluate(() => window.__game.scene.getScene('GameScene').mountHint?.line ?? '');
  ck('第二次骑马出征：不再提示', !h2, h2);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
