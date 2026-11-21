// 战败流程（共享笔记 defeat-flow.md，用户 2026-11-20「被打败被打死后做一段剧情然后回到最近的城市或者营寨，需要给一些惩罚。然后还可以再次挑战」）：
// 主将倒下 → 慢动作压暗 + 对话卡 → 惩罚（存档点负伤 / 部曲折损 / 营寨军粮）→ 「退守 X」→ 真的进那座城 / 营寨（败退提示）→ 回地图选中这一仗；战败的关还能再出征。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-defeat-flow.mjs   截图在 assets/review/defeat-flow/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defeat-flow'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const camp = { version: 2, heroes: { zhaoyun: { player: { hpFrac: .9, followerHp: {} }, army: { soldiers: Array.from({ length: 10 }, (_, i) => ({ id: 's' + i, kind: 'spear' })) } } } };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await p.addInitScript(([w, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_campaign_v1', JSON.stringify(c)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, [world, camp]);
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun' });
  for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start('ThirdGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return window.__game.scene.isActive('ThirdGameScene') && s?.player && s.elapsed > .5; }, null, { timeout: 120000 });
const before = await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); return { prov: W.loadWorld().provisions, stage: window.__game.scene.getScene('ThirdGameScene').hardStage(), playable: W.arcStagePlayable('qunxiong', 2) }; });
// 主将倒下（剧情开着，看对话卡）
await p.evaluate(() => { globalThis.__IM_DEFEAT_LIVE = true; localStorage.setItem('im_story', 'full'); const s = window.__game.scene.getScene('ThirdGameScene'); window.__S = s; s.finish(false, 'death'); });
// 慢动作 / 压暗 / 结算面板先不出：倒下后 0.3 秒看；对话卡要先载手绘件 / 立绘再滑入、逐字打出（机器忙时超过 1.5 秒），另等它出字（结算面板 3 秒后才出）
await p.waitForTimeout(300);
const early = await p.evaluate(() => { const s = window.__S; return { slow: s.devTimeScale, panel: s.resultPanel.visible, t0: performance.now() }; });
const cardText = () => window.__S.children.list.filter(o => o.name === 'story-bark-card' && o.visible).flatMap(o => o.list ?? []).filter(o => o.type === 'Text').map(o => o.text).join(' | ');
await p.waitForFunction(f => /主公|撤|退|将军|护住/.test(eval('(' + f + ')')()), cardText.toString(), { timeout: 2600 }).catch(() => {});
const cardMs = await p.evaluate(t0 => Math.round(performance.now() - t0 + 300), early.t0);
const mid = await p.evaluate(() => { const s = window.__S; return { dim: s.children.getByName('defeat-dim')?.alpha ?? 0, slow: s.devTimeScale, panel: s.resultPanel.visible, cards: s.children.list.filter(o => o.type === 'Container' && o.depth >= 1400 && o.depth < 1500 && o.visible).length, texts: s.children.list.filter(o => o.depth >= 1400 && o.depth < 1500).flatMap(o => o.list ?? []).filter(o => o.type === 'Text').map(o => o.text).join(' | ').slice(0, 200) }; });
await p.screenshot({ path: OUT + '/defeat-card.png' });
ck('倒下后：慢动作（×0.35）+ 压暗 + 对话卡，结算面板先不出', early.slow < .5 && mid.dim > .4 && !early.panel && /主公|撤|退|将军|护住/.test(mid.texts), { ...mid, early: { slow: early.slow, panel: early.panel }, cardMs });
await p.waitForTimeout(2600);
const res = await p.evaluate(async () => { const s = window.__S, W = await import('/src/world/WorldStore.ts'), c = JSON.parse(localStorage.getItem('im_campaign_v1')).heroes.zhaoyun;
  return { panel: s.resultPanel.visible, slow: s.devTimeScale, btn: s.resultPanel.getByName('result-home')?.text, body: s.resultTexts.body.text.slice(-120), hp: c.player.hpFrac, troops: c.army.soldiers.length, prov: W.loadWorld().provisions, stages: W.arcStages('qunxiong'), playable: W.arcStagePlayable("qunxiong", 2), notes: s.defeatNotes, dbg: { wu: W.worldUnlocked(), prev: s.encounterPreview, rt: s.defeatRetreat, live: s.defeatLive(), has: typeof s.runDefeatFlow } }; });
ck('结算面板晚出、慢动作恢复；按钮改「退守 义军营寨」（没有城就退营寨）', res.panel && res.slow === 1 && res.btn === '退守 义军营寨', res);
ck('惩罚：存档点主将生命 ≤55%、部曲 10→7、营寨军粮 1000→920，结算正文写明', res.hp === .55 && res.troops === 7 && res.prov === before.prov - 80 && /战败惩罚/.test(res.body), { before, res });
ck('关卡没平定：群雄篇章进度不变，第 ' + before.stage + ' 关照样可以再出征', res.stages === 1 && before.playable && res.playable, { before: before.playable, after: res.playable, stages: res.stages });
// 退守 → 真的进营寨（第六轮试玩：原来回天下地图、选中的是城，主按钮进城而不是接着打）→ 营寨弹败退提示 → 回地图选中这一仗
await p.evaluate(() => window.__S.resultPanel.getByName('result-home').emit('pointerdown'));
await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').children.getByName('city-toast'), null, { timeout: 30000 });
await p.waitForTimeout(600);
const camp2 = await p.evaluate(() => ({ toast: window.__game.scene.getScene('CityScene').children.getByName('city-toast')?.text ?? '' }));
await p.screenshot({ path: OUT + '/retreat-notice.png' });
ck('退守义军营寨：真的进营寨，弹败退提示（列惩罚、军医 / 募兵所、可再出征）', /失利/.test(camp2.toast) && /退守义军营寨/.test(camp2.toast) && /部曲折损/.test(camp2.toast) && /再出征/.test(camp2.toast), camp2);
await p.evaluate(() => window.__game.scene.getScene('CityScene').children.getByName('city-map')?.emit('pointerdown'));
await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 30000 }); await p.waitForTimeout(1500);
const sel = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); return { kind: m.selected?.kind, node: m.selected?.node?.id }; });
ck('出营寨回天下地图：选中的是这一仗的关卡（主按钮就是再出征）', sel.kind === 'node' && !!sel.node, sel);
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
