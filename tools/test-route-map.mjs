// 天下地图 v2「征途」第 1 期验收（2026-11-19，world/RouteMap.ts + scenes/WorldMapScene.ts）。电脑布局，需要开发服务器。
// 检查：
//  1. 迷雾与节点：打下的关 cleared、可打的 open、再下一关 faint、其余藏在雾里；全图唯一「下一战」；挂靠关打下后攻城点露出（规则 B）；
//  2. 入口都在：主线（壹贰章直接开战 / 叁章起进各章选关页并带关号）、乱世、攻城（规则 C：不相邻也能攻，真进 SiegeGameScene 不被弹回）、
//     守城（告急）、入城（我方城池 → TownScene）、军情、三英战吕布（虎牢关，通关讨董后）、营寨；
//  3. 攻城归来：「某城 归入版图」横幅、选中该城；
//  4. 第 2 期动效：上次没露出的点 → 路线描画、迷雾散开、节点浮现；「下一战」在镜头外时边上出旗牌，点它飞回去；
//  5. 截图 3 张：章节视角、全图视角、下一战旗牌。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-route-map.mjs   → assets/review/route-map/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/route-map'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const base = { version: 10, warlordStages: 0, guanduStages: 0, worldAvailable: true, tutorialDone: true, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {} };
const MID = { ...base, yellowStages: 3, dongzhuoStages: 1, cleared: { huangjin: true, hulao: false }, chapterSeen: 2, ownedCities: ['chenliu'], capturedEver: ['chenliu'], eraSeen: 0 };
const LATE = { ...base, yellowStages: 3, dongzhuoStages: 3, cleared: { huangjin: true, hulao: true }, chapterSeen: 3, ownedCities: ['chenliu'], capturedEver: ['chenliu'], eraSeen: 1, alerts: [{ city: 'chenliu', attacker: 'dongzhuo', cause: 'era' }], intel: [{ id: 'i-test', kind: 'bounty', city: 'sishui', faction: 'dongzhuo', general: '胡轸', expires: 99999 }], intelSeq: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const open = async (save, extra, settle = 1500) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'guanyu', lordFinal: true, owned: [], followers: [] })); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(BASE + '?layout=desktop&map=v2', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setWorldRandom?.(() => .99));
  if (extra) await p.evaluate(extra);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'));
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene') && window.__game.scene.getScene('WorldMapScene').view, null, { timeout: 60000 }); await p.waitForTimeout(settle);
  // 截住出征：记下要进的场景与 registry，不真的开战（主线真开战见 test-map-depart，攻城真开战见下）
  await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), real = s.scene.start.bind(s.scene); window.__went = null; s.scene.start = (k, d) => { if (window.__realStart) return real(k, d); const r = s.registry; window.__went = { key: k, data: d ?? null, pending: r.get('pendingWarlord') ?? null, run: r.get('runConfig') ?? null, siege: r.get('siegeCity') ?? null, mode: r.get('siegeMode') ?? null, intel: r.get('intelEvent') ?? null, pick: r.get('worldStagePick') ?? null, hard: r.get('hardChapter') ?? null, direct: r.get('directDepart') ?? null }; }; });
  return p;
};
const M = "window.__game.scene.getScene('WorldMapScene')";
const pick = (p, id) => p.evaluate(([M0, id]) => { const s = eval(M0); const v = s.nodes.get(id); if (!v) return null; v.hit.emit('pointerup', { getDistance: () => 0 }); return { title: s.detailTitle.text, sub: s.detailSub.text, detail: s.detail.text, action: s.action.text.text, enabled: !!s.action.image.input?.enabled, hard: s.hardBtn.image.visible }; }, [M, id]);
const act = async (p, hard = false) => { await p.evaluate(([M0, h]) => { const s = eval(M0); (h ? s.hardBtn : s.action).image.emit('pointerup'); }, [M, hard]); await p.waitForTimeout(250); return p.evaluate(() => window.__went); };
const modalGo = async (p, name, go) => { await p.evaluate(([M0, n, g]) => { const s = eval(M0); s.children.getByName(n).getByName(g).emit('pointerup'); }, [M, name, go]); await p.waitForTimeout(200); return p.evaluate(() => window.__went); };

// ① 第二章中途：迷雾与节点
{
  const p = await open(MID);
  const v = await p.evaluate(M0 => { const s = eval(M0), vis = Object.fromEntries(s.view.vis); return { next: s.view.next, vis: { h1: vis['huangjin-3'], d1: vis['hulao-1'], d2: vis['hulao-2'], d3: vis['hulao-3'], q1: vis['qunxiong-1'], sishui: vis['siege-sishui'], luoyang: vis['siege-luoyang'], chenliu: vis['siege-chenliu'], lubu: vis['lubu'] }, drawn: [...s.nodes.keys()].length, flags: s.children.list.length && s.nodeLayer.list.filter(r => r.list?.some(o => o.name === 'next-flag')).length, fog: !!s.layer.list.find(o => o.name === 'world-fog'), roads: s.layer.list.find(o => o.name === 'world-roads')?.list.filter(o => o.type === 'Rope').length, sel: s.selected.node?.id }; }, M);
  ck('迷雾：1-3、2-1 已打下，2-2 可打、2-3 淡墨，群雄第一关在雾里；挑战未开', v.vis.h1 === 'cleared' && v.vis.d1 === 'cleared' && v.vis.d2 === 'open' && v.vis.d3 === 'faint' && v.vis.q1 === 'hidden' && v.vis.lubu === 'hidden', v.vis);
  ck('全图唯一「下一战」= 2-2，镜头默认选中它；地图上有迷雾层与手绘路（Rope）', v.next === 'hulao-2' && v.flags === 1 && v.sel === 'hulao-2' && v.fog && v.roads >= 6, v);
  ck('规则 B：汜水关挂在 2-1 后，2-1 打下即露出可攻；洛阳挂在 2-3 后仍在雾里；我方陈留一直露出', v.vis.sishui === 'open' && v.vis.luoyang === 'hidden' && v.vis.chenliu === 'cleared', v.vis);
  await p.screenshot({ path: `${OUT}/chapter-view.png` });
  const d = await pick(p, 'hulao-2');
  ck('详情栏：2-2 荥阳、写出战主公（存档主公关羽）、打下后散开到哪；按钮「出征」', d.title === '2-2 荥阳' && /主将 关羽/.test(d.detail) && /打下后 · 迷雾散开：2-3 火烧洛阳/.test(d.detail) && d.action === '出征' && d.enabled && !d.hard, d);
  const w1 = await act(p);
  ck('主线出征：讨董 2-2、主公关羽，直接进战斗（经 BootScene 载入）', (w1.key === 'GameScene' || w1.pending === 'GameScene') && w1.run?.chapter === 'hulao' && w1.run?.westStage === 2 && w1.run?.character === 'guanyu', w1);
  const r1 = await pick(p, 'hulao-1');
  ck('打下的关：「重打此关」', r1.action === '重打此关' && r1.enabled, r1);
  const f = await pick(p, 'hulao-3');
  ck('淡墨未开的关：不可出征（「尚未开放」）', f.action === '尚未开放' && !f.enabled, f);
  const h = await pick(p, 'huangjin-1');
  ck('第一章已平定：主线关多一个「乱世难度」', h.hard && h.action === '重打此关', h);
  const w2 = await act(p, true);
  ck('乱世：黄巾 1-1，registry hardChapter = huangjin', w2.hard === 'huangjin' && w2.run?.chapter === 'huangjin' && w2.run?.stage === 1, w2);
  const sg = await pick(p, 'siege-sishui');
  ck('攻城点（与营寨、我方城池都不相邻也能攻，规则 C）：「亲征 · 攻城」', sg.action === '亲征 · 攻城' && sg.enabled, sg);
  const own = await pick(p, 'siege-chenliu');
  ck('我方城池：「进入城池」→ TownScene', own.action === '进入城池', own);
  const w3 = await act(p);
  ck('入城：TownScene { city: chenliu }', w3.key === 'TownScene' && w3.data?.city === 'chenliu', w3);
  const camp = await pick(p, 'camp'); const w4 = await act(p);
  ck('营寨：「进入营寨」→ CityScene', camp.action === '进入营寨' && w4.key === 'CityScene', { camp, w4 });
  // 真开一场攻城：SiegeGameScene 用新规则，不把不相邻的汜水关弹回地图
  await pick(p, 'siege-sishui'); await act(p); await p.evaluate(() => { window.__realStart = true; });
  await p.evaluate(M0 => { const s = eval(M0); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, M);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const sgOk = await p.evaluate(() => ({ siege: window.__game.scene.isActive('SiegeGameScene'), map: window.__game.scene.isActive('WorldMapScene'), city: window.__game.scene.getScene('SiegeGameScene')?.city?.id }));
  ck('真进攻城战（汜水关）：SiegeGameScene 开着、没被弹回天下地图', sgOk.siege && !sgOk.map && sgOk.city === 'sishui', sgOk);
  await p.close();
}
// ② 讨董通关后：挑战、军情、守城、第叁章选关页、全图
{
  const p = await open(LATE);
  const v = await p.evaluate(M0 => { const s = eval(M0); return { next: s.view.next, lubu: s.view.vis.get('lubu'), luoyang: s.view.vis.get('siege-luoyang'), intel: s.nodes.has('intel-i-test') }; }, M);
  ck('讨董通关：下一战 = 群雄 3-1；虎牢关挑战露出；洛阳可攻；汜水关旁有军情令旗', v.next === 'qunxiong-1' && v.lubu === 'open' && v.luoyang === 'open' && v.intel, v);
  const l = await pick(p, 'lubu'); const w1 = await act(p);
  ck('三英战吕布（虎牢关）：「挑战吕布」→ LubuGameScene', l.title === '三英战吕布' && /虎牢关/.test(l.sub) && l.action === '挑战吕布' && (w1.key === 'LubuGameScene' || w1.pending === 'LubuGameScene'), { l, w1 });
  const i = await pick(p, 'intel-i-test'); await act(p); const w2 = await modalGo(p, 'intel-modal', 'intel-go');
  ck('军情：「亲征 · 军情」→ 出征面板 → IntelGameScene（intelEvent = i-test）', i.action === '亲征 · 军情' && (w2.key === 'IntelGameScene' || w2.pending === 'IntelGameScene') && w2.intel === 'i-test', { i, w2 });
  await p.evaluate(M0 => eval(M0).closeModal(), M);
  const a = await pick(p, 'siege-chenliu'); await act(p); const w3 = await modalGo(p, 'siege-modal', 'siege-go');
  ck('告急城池：「亲征 · 守城」→ 守城面板 → SiegeGameScene（siegeMode = defense）', a.action === '亲征 · 守城' && /告急/.test(a.detail) && (w3.key === 'SiegeGameScene' || w3.pending === 'SiegeGameScene') && w3.siege === 'chenliu' && w3.mode === 'defense', { a, w3 });
  await p.evaluate(M0 => eval(M0).closeModal(), M);
  const q = await pick(p, 'qunxiong-1'); const w4 = await act(p);
  ck('第叁章：「出征」→ ThirdChapterScene，worldStagePick = 1，并打「直接出征」标记（不显示选将 / 选关页）', q.action === '出征' && w4.key === 'ThirdChapterScene' && w4.pick === 1 && w4.direct === true, { q: q.title, w4 });
  await p.evaluate(M0 => { const s = eval(M0); s.setZoom(s.minZoom); }, M); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/overview.png` });
  await p.close();
}
// ③ 攻城归来：归入版图
{
  const p = await open({ ...MID, ownedCities: ['chenliu', 'sishui'], capturedEver: ['chenliu', 'sishui'] }, () => { window.__game.registry.set('mapCaptured', 'sishui'); // 横幅 4.2 秒后淡出：演出一建好就记下（无头浏览器载入慢，等到检查时可能已淡出）
    const P = Object.getPrototypeOf(window.__game.scene.getScene('WorldMapScene')), pc = P.playCapture; P.playCapture = function (c) { const r = pc.call(this, c), root = this.children.getByName('capture-reveal'); window.__cap = { title: root?.getByName('capture-banner')?.getByName('capture-banner-title')?.text, seal: !!root?.getByName('capture-seal') }; return r; }; }, 700);
  const c = await p.evaluate(M0 => { const s = eval(M0); return { ...window.__cap, sel: s.selected.node?.id, vis: s.view.vis.get('siege-sishui') }; }, M);
  ck('攻城归来：「汜水关 归入版图」横幅 + 朱印「归」，选中汜水关，节点变我方', c.title === '汜水关 归入版图' && c.seal && c.sel === 'siege-sishui' && c.vis === 'cleared', c);
  await p.close();
}
// ④ 第 2 期动效：上次进地图只露出到 2-1 → 这次 2-2 / 2-3 / 新攻城点算新露出，播描画、散雾、浮现；「下一战」旗牌
{
  const p = await open(MID, () => localStorage.setItem('im_route_seen_v1', JSON.stringify(['camp', 'huangjin-1', 'huangjin-2', 'huangjin-3', 'hulao-1'])), 3200);
  const f = await p.evaluate(M0 => { const s = eval(M0); return { fresh: [...s.fresh], fx: { ...s.fx }, a2: s.nodes.get('hulao-2')?.root.alpha, seen: JSON.parse(localStorage.getItem('im_route_seen_v1')).includes('hulao-2') }; }, M);
  ck('新露出的点：2-2、2-3 算新露出；路线描画完、迷雾散开、节点全部浮现（alpha 回到 1）；这次露出的点已记下', f.fresh.includes('hulao-2') && f.fresh.includes('hulao-3') && !f.fresh.includes('hulao-1') && f.fx.drawn >= 2 && f.fx.holes >= 2 && f.fx.popped === f.fresh.length && f.a2 === 1 && f.seen, f);
  // 镜头拉到西南角，下一战（2-2）在镜头外 → 边上出旗牌
  await p.evaluate(M0 => { const s = eval(M0); s.centerOn(150, 900); }, M); await p.waitForTimeout(300);
  const a = await p.evaluate(M0 => { const s = eval(M0), c = s.children.getByName('next-arrow'); return { vis: c?.visible, x: Math.round(c?.x ?? 0), y: Math.round(c?.y ?? 0), text: c?.getByName('next-arrow-text')?.text, area: s.area }; }, M);
  ck('「下一战」在镜头外：地图边上出「下一战 · 2-2」旗牌（在地图区内）', a.vis && /下一战 · 2-2/.test(a.text ?? '') && a.x > a.area.x && a.x < a.area.x + a.area.w && a.y > a.area.y && a.y < a.area.y + a.area.h, a);
  await p.screenshot({ path: `${OUT}/next-arrow.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('next-arrow').getByName('next-arrow-hit').emit('pointerup'), M); await p.waitForTimeout(1000);
  const b2 = await p.evaluate(M0 => { const s = eval(M0); return { sel: s.selected?.node?.id, vis: s.children.getByName('next-arrow').visible }; }, M);
  ck('点旗牌：选中 2-2 并飞过去，旗牌收起', b2.sel === 'hulao-2' && b2.vis === false, b2);
  await p.close();
}
// ⑤ 第一次进地图（没有记录）不播动效
{
  const p = await open(MID);
  const f = await p.evaluate(M0 => { const s = eval(M0); return { fresh: s.fresh.size, a2: s.nodes.get('hulao-2')?.root.alpha }; }, M);
  ck('第一次进地图：不播动效，节点直接露出', f.fresh === 0 && f.a2 === 1, f);
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
