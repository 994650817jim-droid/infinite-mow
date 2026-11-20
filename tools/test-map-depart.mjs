// 天下地图出征直达战斗（2026-11-18 用户「应该不需要这个画面，因为只有主公可以出战」）：第壹 / 贰章出征不再经选将页，
// 直接以存档主公开战；小卡写「主公 X 亲征 / 随行 …」；点关卡印可选关（已过的关「重打此关」）。电脑版 1920×1080。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-map-depart.mjs   截图在 assets/review/map-depart/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/map-depart';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) : '')); };
// 讨董 2-1 已过；主公关羽（不是缺省的赵云），最近出战记的是赵云
const save = { version: 7, yellowStages: 3, dongzhuoStages: 1, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 0, capturedEver: [], chapterSeen: 2, tutorialDone: true };
const roster = { version: 1, lord: 'guanyu', lordFinal: true, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const open = async (sv0 = save) => {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(([sv, rs]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_roster_v1', JSON.stringify(rs)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } window.__menuSeen = false; }, [sv0, roster]);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene') && !window.__game.scene.isActive('MenuScene')); await p.waitForTimeout(1800);
  // 从这里起盯着：出征后 MenuScene（选将页）不能有任何一帧是开着的
  await p.evaluate(() => { const g = window.__game; window.__arcSeen = []; g.events.on('step', () => { if (g.scene.isActive('MenuScene')) window.__menuSeen = true; for (const sc of g.scene.getScenes(true)) if (/ChapterScene$/.test(sc.scene.key) && !window.__arcSeen.includes(sc.scene.key)) window.__arcSeen.push(sc.scene.key); }); });
  return p;
};
const M = "window.__game.scene.getScene('WorldMapScene')";
const battle = p => p.evaluate(() => { const g = window.__game, gs = g.scene.getScene('GameScene'), rc = g.registry.get('runConfig'); return { active: g.scene.isActive('GameScene'), menu: g.scene.isActive('MenuScene'), menuSeen: window.__menuSeen, chapter: rc?.chapter, west: rc?.westStage, hero: rc?.character, player: gs?.player?.growth?.character ?? gs?.runConfig?.character, campaign: g.registry.get('worldCampaign') }; });

// ① 第贰章节点：小卡写出战主公；出征 → 直接进战斗（2-2，下一个未通关）
{
  const p = await open();
  const card = await p.evaluate(M0 => { const s = eval(M0); const n = s.markers.find(m => m.node.chapter === 'hulao' || m.node.id === 'hulao'); s.selected = { kind: 'node', node: n.node }; s.refresh(); return { title: s.detailTitle.text, detail: s.detail.text, view: s.detailView?.text, action: s.action.text.text }; }, M);
  ck('第贰章小卡：第一行进度、第二行「主公 关羽 亲征」（存档主公，不是缺省赵云）；按钮「出征」', /第贰章/.test(card.title) && card.view?.split('\n')[1]?.startsWith('主公 关羽') && card.action === '出征', card);
  await p.screenshot({ path: `${out}/1-map-card.png` });
  await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const r = await battle(p);
  ck('出征直接进战斗：讨董 2-2（下一个未通关）、主公关羽出战，没经过选将页（MenuScene 一帧都没开）', r.active && !r.menu && !r.menuSeen && r.chapter === 'hulao' && r.west === 2 && r.hero === 'guanyu' && r.campaign === true, r);
  await p.screenshot({ path: `${out}/2-battle-start.png` });
  await p.close();
}
// ② 点关卡印 2-1（已过）：写「已平定」、不能再出征（main 097922d「打过的关不能再打」）
{
  const p = await open();
  const pin = await p.evaluate(M0 => { const s = eval(M0); const n = s.markers.find(m => m.node.chapter === 'hulao' || m.node.id === 'hulao'); s.selected = { kind: 'node', node: n.node }; s.refresh(); s.selected = { kind: 'stage', chapter: 'hulao', stage: 1 }; s.refresh(); return { title: s.detailTitle.text, view: s.detailView?.text, action: s.action.text.text }; }, M);
  // 2026-11-19（main 097922d「打过的关不能再打」）：已过的关卡印写「已平定」、不能再出征
  ck('关卡印 2-1（已过）：写「已平定」、按钮不能再出征', /汜水关/.test(pin.title) && pin.action === '已平定' && /已平定/.test(pin.view ?? ''), pin);
  await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ battle: window.__game.scene.isActive('GameScene'), map: window.__game.scene.isActive('WorldMapScene') }));
  ck('点「已平定」不会进战斗、仍在天下地图', !r.battle && r.map, r);
  await p.close();
}
// ③④ 2026-11-19 用户「打第三章的时候又出现这个老界面了」：第三章起（各章自己的选关场景）也直接出征，不显示「出战武将」选将页
const arcCase = async (label, extra, chapter, scene, stageKey, expectStage, shot) => {
  const p = await open({ ...save, dongzhuoStages: 3, cleared: { huangjin: true, hulao: true }, ...extra });
  const card = await p.evaluate(([M0, ch]) => { const s = eval(M0); const n = s.markers.find(m => m.node.chapter === ch || m.node.id === ch); if (!n) return null; s.centerOn?.(n.node); s.selected = { kind: 'node', node: n.node }; s.refresh(); return { title: s.detailTitle.text, action: s.action.text.text, state: s.nodeState(n.node) }; }, [M, chapter]);
  await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M);
  await p.waitForFunction(k => window.__game.scene.isActive(k) && window.__game.scene.getScene(k).player, scene, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const r = await p.evaluate(([k, sk]) => { const g = window.__game, rc = g.registry.get('runConfig'); return { active: g.scene.isActive(k), hero: rc?.character, stage: g.registry.get(sk), arcSeen: window.__arcSeen, arcActive: g.scene.getScenes(true).map(x => x.scene.key).filter(x => /ChapterScene$/.test(x)), menuSeen: window.__menuSeen }; }, [scene, stageKey]);
  ck(`${label}：出征直接进战斗（${scene}），主公关羽、第 ${expectStage} 关；章节场景只转一下、选将页没画出来`, !!card && card.state !== 'locked' && r.active && r.hero === 'guanyu' && r.stage === expectStage && !r.arcActive.length && !r.menuSeen, { card, r });
  if (shot) await p.screenshot({ path: `${out}/${shot}.png` });
  await p.close();
};
await arcCase('第叁章「群雄割据」（3-1 已过）', { warlordStages: 1 }, 'qunxiong', 'ThirdGameScene', 'thirdStage', 2, '3-ch3-battle');
await arcCase('第柒章「蜀」（第七章起）', { warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 0 }, 'shu', 'ShuGameScene', 'shuStage', 1, '4-ch7-battle');
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
