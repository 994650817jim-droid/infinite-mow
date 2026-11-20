// 招贤馆（2026-11-18 用户「主公不应该在这里」+ 截图排版问题）：
// ① 主公不在「麾下」名单、不能点随行、不计入麾下人数；老存档里被点成随行的读档时去掉；人才 / 降将里也没有主公；讲武堂「随行操练」名单也没有主公。
// ② 电脑版排版：内容留边距（不贴左边）、页签与行按钮改漆底描金，整页水墨笔刷最多 1 处（只给「返回营寨」）。
// 正式存档（天下已开，主公诸葛亮，麾下赵云 + 一位无名之辈；老存档里主公被点成随行）。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-talent-hall.mjs     SHOT=before 只截图（给改前对比用）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', shot = process.env.SHOT ?? 'after', out = 'assets/review/talent-hall';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 3000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu'], eraSeen: 1, capturedEver: ['guandu'], chapterSeen: 3, tutorialDone: true };
const hero = h => ({ id: h, kind: 'hero', hero: h, rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhuge', lordFinal: true, owned: [hero('zhuge'), hero('zhaoyun'), { id: 'r_1', kind: 'common', name: '李校尉', template: 'spear', quality: 'green', rank: 1, picks: [] }], followers: ['zhuge'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 1, hall: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(([w, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhuge'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, [world, roster]);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
const T = "window.__game.scene.getScene('TalentHallScene')";
const open = async tab => { await p.evaluate(tab => { const g = window.__game, cur = g.scene.getScenes(true)[0]; cur.scene.start('TalentHallScene', { tab }); }, tab); await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 30000 }); await p.waitForTimeout(700); };
/** 场景里所有对象（含容器子对象）。 */
const scan = () => p.evaluate(T0 => {
  const s = eval(T0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
  const vis = all.filter(o => o.visible !== false && (o.alpha ?? 1) > 0.01 && o.type !== 'Container' && o.type !== 'Graphics' && o.type !== 'Rectangle' && o.type !== 'Zone');
  const lefts = vis.map(o => { const bb = o.getBounds?.(); return bb ? { n: o.name || o.text?.slice?.(0, 12) || o.type, x: Math.round(bb.x) } : null; }).filter(Boolean).filter(o => o.x < 600);
  const ink = all.filter(o => /^btn_ink_(primary|secondary)/.test(o.texture?.key ?? '') && o.visible !== false).length;
  return { texts: all.filter(o => o.type === 'Text' && o.visible !== false).map(o => o.text), names: all.map(o => o.name).filter(Boolean), minLeft: Math.min(...lefts.map(o => o.x)), leftest: lefts.sort((a, b) => a.x - b.x).slice(0, 4), ink };
}, T);

await open('roster'); await p.screenshot({ path: `${out}/${shot}-roster-1280x720.png` });
const r0 = await scan();
await open('offers'); await p.screenshot({ path: `${out}/${shot}-offers-1280x720.png` });
const o0 = await scan();
if (shot === 'before') { console.log('before', JSON.stringify({ roster: { minLeft: r0.minLeft, ink: r0.ink, lord: r0.texts.filter(t => /主公/.test(t)) }, offers: { minLeft: o0.minLeft, ink: o0.ink } })); await b.close(); process.exit(0); }

// ① 主公不在麾下
await open('roster'); const r1 = await scan();
ck('麾下页：没有主公那一行（无「主公」字样、无诸葛亮的随行 / 遣散按钮），页签人数不含主公「麾下（2）」', !r1.texts.some(t => /主公/.test(t)) && !r1.names.includes('talent-follow-zhuge') && r1.texts.some(t => t === '麾下（2）') && r1.names.includes('talent-follow-zhaoyun') && r1.names.includes('talent-follow-r_1'), { texts: r1.texts.filter(t => /诸葛|主公|麾下/.test(t)), names: r1.names.filter(n => /follow/.test(n)) });
const st = await p.evaluate(async () => {
  const R = await import('/src/systems/RosterStore.ts'), s = R.loadRoster();
  const toggle = R.toggleFollower('zhuge'), after = R.loadRoster();
  return { lord: s.lord, followers: s.followers, list: R.rosterFollowers(s).map(r => r.id), toggle, after: after.followers, offers: [...s.offers, ...s.captives].map(o => o.hero ?? null), lead: R.followersFor('zhaoyun').map(r => r.id) };
});
ck('老存档里主公被点成随行：读档时去掉（随行 0 人）', st.lord === 'zhuge' && !st.followers.includes('zhuge'), st);
ck('主公不能点成随行（toggleFollower 拒绝，存档不变）', st.toggle.ok === false && /主公/.test(st.toggle.message) && !st.after.includes('zhuge'), st.toggle);
ck('麾下名单 rosterFollowers 不含主公；人才 / 降将里也没有主公；换别人出战时随行里也没有主公', JSON.stringify(st.list) === '["zhaoyun","r_1"]' && !st.offers.includes('zhuge') && !st.lead.includes('zhuge'), st);
// 随行 / 留守照常
await p.evaluate(T0 => { const s = eval(T0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list); all.find(o => o.name === 'talent-follow-zhaoyun').emit('pointerup'); }, T); await p.waitForTimeout(300);
const r2 = await scan();
ck('赵云点「随行」照常：随行 1/N，按钮变「留守」', r2.texts.some(t => /^随行 1\//.test(t)) && r2.texts.includes('留守'), r2.texts.filter(t => /随行|留守/.test(t)));
await p.screenshot({ path: `${out}/after-roster-following-1280x720.png` });

// ② 排版：留边距、水墨笔刷最多 1 处
ck('麾下页：内容不贴左边（最左的字 / 按钮 x ≥ 24 画面像素）', r1.minLeft >= 24, r1.leftest);
ck('人才页：内容不贴左边', o0.minLeft >= 24, o0.leftest);
ck('整页水墨笔刷最多 1 处（页签、升级、随行 / 留守 / 遣散、招募、刷新都改漆底描金）', r1.ink <= 1 && o0.ink <= 1, { roster: r1.ink, offers: o0.ink });

// ③ 讲武堂「随行操练」：名单里没有主公
await p.evaluate(() => { const g = window.__game, cur = g.scene.getScenes(true)[0]; cur.scene.start('CityScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').children.list.length > 5, null, { timeout: 60000 }); await p.waitForTimeout(1500);
const dr = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('CityScene'); s.techTab = 'drill'; s.openTech(); await new Promise(r => setTimeout(r, 600));
  const all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
  return { lord: all.some(o => /^drill-lord-/.test(o.name ?? '')), rows: all.filter(o => /^drill-preview-weapon-/.test(o.name ?? '')).map(o => o.name.replace('drill-preview-weapon-', '')), texts: all.filter(o => o.type === 'Text' && /主公/.test(o.text)).map(o => o.text) };
});
ck('讲武堂「随行操练」：名单只有赵云、李校尉，没有主公', !dr.lord && !dr.texts.length && JSON.stringify(dr.rows.sort()) === '["r_1","zhaoyun"]', dr);
await p.screenshot({ path: `${out}/after-drill-1280x720.png` });

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} 通过，${fail} 失败`);
await b.close(); process.exit(fail ? 1 : 0);
