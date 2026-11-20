// 其他势力支线 P1（other-factions-design.md，用户 2026-11-19「批准开工」）：讨伐令开放 → 地图节点 / 详情 / 出征 → 支线战斗（首领、劝降键、终局双首领、白门楼吕布战）
// → 结算（攻城关并城、终局并入领地 + 势力特产、劝降一次性、打过的关不能再打）→ 解锁钩子 persuaded。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-side-routes.mjs   截图在 assets/review/side-routes/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/side-routes'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) + (ok ? '' : ' … ' + JSON.stringify(d).slice(360, 900)) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = async () => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, world);
  return p;
};
async function battle(key, reg) {
  const p = await page();
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); for (const [k, v] of Object.entries(st.reg)) s0.registry.set(k, v);
    s0.registry.set('runConfig', { character: 'zhaoyun' }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, { key, reg });
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > .5; }, key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') return; else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, key);
  return p;
}
const toBoss = async p => { for (let i = 0; i < 24 && !(await p.evaluate(() => !!window.__S.boss?.active)); i++) { await p.evaluate(() => { const s = window.__S; if (s.elapsed < 200) { s.elapsed = 212; s.lastPickAt = -1e9; } window.__calm(); }); await p.waitForTimeout(500); } };

// ① 江东 · 南郡终局：周瑜 + 太史慈双首领（借吴将图），劝降键
{
  const p = await battle('SideNanjunGameScene', { side_nanjunStage: 2 });
  const c = await p.evaluate(() => { const s = window.__S; return { name: s.chapter.name, boss: s.chapter.bossName, key: s.surrenderKey(), tex: s.textures.exists('side_zhouyu'), partnerTex: s.textures.exists('side_taishici') }; });
  await toBoss(p); await p.waitForTimeout(2200); await p.evaluate(() => window.__calm());
  const d = await p.evaluate(() => { const s = window.__S; return { labels: s.dual?.entries.map(e => e.ctrl.label) ?? [], dual: s.dual?.entries.map(e => e.name) ?? [], keys: s.dual?.entries.map(e => e.parley?.def?.key ?? null) ?? [], group: s.dual?.plan.group }; });
  await p.screenshot({ path: `${OUT}/nanjun-dual.png` });
  ck('南郡终局：章节名「江东 · 南郡」、首领周瑜、劝降键 nanjun-2:zhouyu、首领图已载入', /江东 · 南郡/.test(c.name) && c.boss === '周瑜' && c.key === 'nanjun-2:zhouyu' && c.tex && c.partnerTex, c);
  ck('南郡终局双首领：周瑜 + 太史慈同场，各有劝降窗（nanjun-2:zhouyu / nanjun-2:taishici）', d.dual.includes('周瑜') && d.dual.includes('太史慈') && d.keys.includes('nanjun-2:taishici') && !d.labels.some(l => /白衣|昭武|吕蒙|朱然/.test(l)), d);
  await p.close();
}
// ② 吕布 · 下邳第一关小沛（攻城关：城墙 + 城门）与白门楼吕布战
{
  const p = await battle('SideXiapiGameScene', { side_xiapiStage: 1 });
  await toBoss(p);
  const c = await p.evaluate(() => { const s = window.__S; return { name: s.chapter.name, boss: s.boss?.def?.texture, bossName: s.chapter.bossName, key: s.surrenderKey(), parley: !!s.parley }; });
  ck('下邳 · 小沛：首领曹性（side_caoxing 图）出阵、劝降键 xiapi-1:caoxing、有招降窗', /小沛/.test(c.name) && c.bossName === '曹性' && c.boss === 'side_caoxing' && c.key === 'xiapi-1:caoxing' && c.parley, c);
  await p.close();
  const q = await battle('SideLubuGameScene', {});
  const l = await q.evaluate(() => { const s = window.__S; return { name: s.chapter.name, key: s.surrenderKey(), style: s.chapter.bossStyle }; });
  ck('下邳终局「白门楼」：三英战吕布的吕布战（bossStyle lubu）、劝降键 xiapi-4:lubu', /白门楼/.test(l.name) && l.key === 'xiapi-4:lubu' && l.style === 'lubu', l);
  await toBoss(q); await q.waitForTimeout(2600); await q.evaluate(() => window.__calm());
  const cg = await q.evaluate(() => { const s = window.__S, e = s.chengong; return { on: !!e?.active, tex: e?.sprite.texture.key, tag: s.children.getByName('chengong-tag')?.text, ratio: e && s.boss ? +(e.maxHp / s.boss.maxHp).toFixed(2) : 0, boss: s.boss?.active }; });
  await q.evaluate(() => { const s = window.__S, e = s.chengong; if (e) s.player.sprite.setPosition(e.x - 120, e.y + 150); }); await q.waitForTimeout(700); await q.screenshot({ path: OUT + '/baimen-chengong.png' });
  ck('白门楼：吕布出阵后陈宫在后排现身（专属图 side_chengong、名牌「公台 · 陈宫」、生命约吕布 35%）', cg.on && cg.tex === 'side_chengong' && /陈宫/.test(cg.tag ?? '') && Math.abs(cg.ratio - .35) < .08 && cg.boss, cg);
  await q.evaluate(() => { const s = window.__S; s.cgPlotAt = 0; }); await q.waitForTimeout(400);
  const plot = await q.evaluate(() => ({ plots: window.__S.cgStats.plots }));
  await q.evaluate(() => { const s = window.__S, e = s.chengong; e.invulnerable = false; s.hitEnemy(e, e.maxHp * 3, s.combatNow, 'melee', false, false); }); await q.waitForTimeout(500);
  const fell = await q.evaluate(() => { const s = window.__S; return { fell: s.cgStats.fell, over: s.over, killed: s.bossKilled, boss: !!s.boss?.active, lubu: s.surrenderKey(), never: true }; });
  ck('陈宫献计（吕布短时加伤）；陈宫倒下＝拒降就义，不结算本关（吕布还在、还是本关首领）', plot.plots >= 1 && fell.fell && !fell.over && !fell.killed && fell.boss && fell.lubu === 'xiapi-4:lubu', { plot, fell });
  await q.close();
}
// ④ P1b 各支线终局（ROUTES=逗号分隔，默认当前批次）：首领、借来的首领图、双首领同伴、招式名已改成本人、敌兵贴图都在
{
  const ROUTES = (process.env.ROUTES ?? 'gongsun,hebei,jiangxia').split(',').filter(Boolean);
  const BORROWED = /白衣|昭武|桂阳|零陵|益州牧|长沙|荆州水军|西凉铁骑|西凉悍将|北地枪王|白水|落凤|南蛮王|乌戈|蛮将|抬榇|宗室|巧变|疾行之将/;
  let shot = false;
  for (const id of ROUTES) {
    const info = await (async () => { const p0 = await page(); await p0.goto(BASE + '?dev=1&layout=desktop'); await p0.waitForFunction(() => window.__game, null, { timeout: 120000 }); const r = await p0.evaluate(async id => { const m = await import('/src/data/sideRoutes.ts'), rt = m.sideRoute(id); return { n: rt.stages.length, key: m.SIDE_SCENE_KEY(id), stage: rt.stages[rt.stages.length - 1] }; }, id); await p0.close(); return r; })();
    const p = await battle(info.key, { ['side_' + id + 'Stage']: info.n });
    const early = await p.evaluate(() => { const s = window.__S; return s.enemies.filter(e => e.active).map(e => e.sprite.texture.key).filter(k => k === '__MISSING' || !window.__S.textures.exists(k)); });
    await toBoss(p); await p.waitForTimeout(2200); await p.evaluate(() => window.__calm());
    const c = await p.evaluate(id => { const s = window.__S; return { boss: s.chapter.bossName, tex: s.boss?.sprite.texture.key, key: s.surrenderKey(), dual: s.dual?.entries.map(e => e.name) ?? [], labels: s.dual ? s.dual.entries.map(e => e.ctrl.label) : [s.hudTexts.bossEnergy.text], missing: s.enemies.filter(e => e.active).map(e => e.sprite.texture.key).filter(k => k === '__MISSING') }; }, id);
    if (!shot) { await p.screenshot({ path: OUT + '/' + id + '-final.png' }); shot = true; }
    const want = [info.stage.boss.name, ...(info.stage.partner ? [info.stage.partner.name] : [])];
    ck(id + ' 终局：首领 ' + want.join(' + ') + '（side_ 借图）出阵、劝降键、招式名已改、无缺图', c.boss === info.stage.boss.name && /^side_/.test(c.tex ?? '') && c.key === id + '-' + info.n + ':' + info.stage.boss.id && want.every(n => !info.stage.partner || c.dual.includes(n)) && !c.labels.some(l => BORROWED.test(l)) && !early.length && !c.missing.length, { ...c, early });
    await p.close();
  }
}
// ③ 天下地图（真实进度：第三章已平定）→ 讨伐令节点、详情、出征；结算并城、特产、打过不能再打、解锁钩子
{
  const p = await page();
  await p.goto(BASE + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene')); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(1800);
  const m = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), mk = s.markers.find(x => x.node.id === 'side-xiapi'); if (mk) { s.centerOn(mk.node); s.selected = { kind: 'node', node: mk.node }; s.refresh(); }
    return { xiapi: !!mk, state: mk && s.nodeState(mk.node), nanjun: s.markers.some(x => x.node.id === 'side-nanjun'), caowei: s.markers.some(x => x.node.id === 'side-caowei'), gongsun: s.markers.some(x => x.node.id === 'side-gongsun'), hebei: s.markers.some(x => x.node.id === 'side-hebei'), pulse: !!mk?.root.list.find(o => o.name === 'node-pulse-side-xiapi'), detail: s.detail.text, title: s.detailTitle?.text, action: s.action.text.text }; });
  await p.screenshot({ path: `${OUT}/map-xiapi.png` });
  ck('第三章已平定：地图出现「讨伐 · 吕布」讨伐令（开放 + 红色脉冲）；江东、曹魏未开放不画', m.xiapi && m.state === 'open' && m.pulse && !m.nanjun && !m.caowei && m.gongsun && !m.hebei, m);
  ck('讨伐令详情（两行）：第 1/4 关「小沛」攻城 · 首领曹性；讨平后并入下邳 + 特产；按钮「出征 · 小沛」', /第 1\/4 关「小沛」攻城 · 首领 曹性$/m.test(m.detail) && m.detail.split(String.fromCharCode(10)).length === 2 && /并入 下邳/.test(m.detail) && /并州狼骑/.test(m.detail) && m.action === '出征 · 小沛', m);
  const r = await p.evaluate(async () => {
    const S = await import('/src/world/SideRouteStore.ts'), W = await import('/src/world/WorldStore.ts'), U = await import('/src/data/surrender.ts'), H = await import('/src/systems/HeroUnlocks.ts');
    const dmg0 = W.permanentEffects().damageBonus, prov0 = W.loadWorld().provisions;
    const s1 = S.settleSideStage('xiapi', 1, { victory: true, debug: false }), open1 = S.sideStageOpen('xiapi', 1), open2 = S.sideStageOpen('xiapi', 2), open3 = S.sideStageOpen('xiapi', 3);
    S.settleSideStage('xiapi', 2, { victory: true, debug: false }); const s3 = S.settleSideStage('xiapi', 3, { victory: true, debug: false }), s4 = S.settleSideStage('xiapi', 4, { victory: true, debug: false });
    const st = S.sideState('xiapi'), again = S.settleSideStage('xiapi', 4, { victory: true, debug: false }), reopen = [1, 2, 3, 4].some(n => S.sideStageOpen('xiapi', n));
    const w = W.loadWorld(); w.lubuClears = 1; localStorage.setItem('im_world_v1', JSON.stringify(w));
    return { s1: s1.provisions, open1, open2, open3, s3: s3.annexed, s4: { done: s4.done, msg: s4.message }, st, again: again.provisions, reopen, owned: W.ownedCities(), dmg: +(W.permanentEffects().damageBonus - dmg0).toFixed(3), prov: W.loadWorld().provisions - prov0, persuaded: H.realProgress().persuaded?.('lubu'), lubuPlay: W.lubuChallengePlayable(), arc1: W.arcStagePlayable('qunxiong', 1) };
  });
  ck('结算：首关军粮、顺序开放（打过的第 1 关不能再进、第 2 关开、第 3 关未开）；下邳关并入下邳；终局「讨伐告成」、并州狼骑伤害 +3%', r.s1 > 0 && !r.open1 && r.open2 && !r.open3 && r.s3.includes('下邳') && r.owned.includes('xiapi') && r.s4.done && /讨伐告成/.test(r.s4.msg) && r.dmg === .03 && r.prov > 0, r);
  ck('打过的关不能再打：支线四关全部关闭、再结算不发奖励；三英战吕布胜过一次不能再打；第三章已平定的关不能再进；劝降一次性（没有再战加成），persuaded(lubu) = false', r.st.done && r.st.retries === undefined && !r.reopen && r.again === 0 && !r.lubuPlay && !r.arc1 && r.persuaded === false, r);
  await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.scene.restart(); }); await p.waitForTimeout(2200);
  const m2 = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), pick = id => { const mk = s.markers.find(x => x.node.id === id); s.selected = { kind: 'node', node: mk.node }; s.refresh(); return { state: s.nodeState(mk.node), detail: s.detail.text, action: s.action.text.text, on: !!s.action.image.input?.enabled }; }; return { side: pick('side-xiapi'), lubu: pick('lubu'), ch3: pick('qunxiong') }; });
  ck('天下地图：讨平的讨伐令、三英战吕布、已平定的第三章都写「已平定」、按钮置灰（讨伐令写势力之主远走）', m2.side.state === 'cleared' && /已平定/.test(m2.side.detail) && /远走/.test(m2.side.detail) && m2.side.action === '已平定' && !m2.side.on && m2.lubu.action === '已平定' && !m2.lubu.on && m2.ch3.action === '已平定' && !m2.ch3.on && /不再出征/.test(m2.ch3.detail), m2);
  await p.screenshot({ path: OUT + '/map-sealed.png' });
  const go = await p.evaluate(() => { const g = window.__game, s = g.scene.getScene('WorldMapScene'); let started = null; const sp = s.scene.start.bind(s.scene); s.scene.start = (k, d) => { started = k; return sp(k, d); }; for (const id of ['side-xiapi', 'lubu', 'qunxiong']) { s.selected = { kind: 'node', node: s.markers.find(x => x.node.id === id).node }; s.launch(false); } return g.registry.get('pendingWarlord') ?? started; });
  ck('已平定的点不能出征（讨伐令 / 三英战吕布 / 第三章都进不去）', go === null, go);
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 6));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
