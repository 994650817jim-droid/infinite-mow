// 2-3 火烧洛阳（董卓城头纵火 + 吕布同场，吕布逃走后董卓下城，20% 时吕布杀回斩之）与天下地图挑战关「虎牢关 · 三英战吕布」（首胜赤兔）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-dongzhuo.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const mk = (o = {}) => ({ version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2, intelSeq: 1, ...o });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')", L = "window.__game.scene.getScene('LubuGameScene')", M = "window.__game.scene.getScene('WorldMapScene')";
const page = async (layout, save) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  return p;
};
const start = async (p, key, cfg) => {
  await p.evaluate(([key, cfg]) => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start(key); else { g.registry.set('pendingWarlord', key); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [key, cfg]);
  await p.waitForFunction(key => window.__game.scene.isActive(key) && window.__game.scene.getScene(key).player, key, { timeout: 90000 }); await p.waitForTimeout(1200);
};
const quiet = (p, S) => p.evaluate(S0 => { const s = eval(S0); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; }, S);

// —— 2-3 火烧洛阳 · 董卓与吕布同场（细节见 test-dongzhuo-lubu）——
{
  const layout = 'desktop';
  const p = await page(layout, mk());
  await start(p, 'GameScene', { chapter: 'hulao', westStage: 3 }); await quiet(p, G);
  const a = await p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, boss: s.chapter.bossName, style: s.chapter.bossStyle, waves: s.chapter.waves.map(w => w.name), camps: s.objective?.standing.length }; }, G);
  ck(`[${layout}] 2-3「火烧洛阳」：首领董卓、单一战场与五座营寨`, a.name === '2-3 火烧洛阳' && a.boss === '董卓' && a.style === 'dongzhuo' && a.waves.length === 1 && a.camps === 5, a);
  const sp = await p.evaluate(async G0 => { const s = eval(G0); s.player.damageImmune = false; s.player.invulnUntil = 0; for (let i = 0; i < 40 && !s.xiliang.dongzhuo; i++) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); await new Promise(r => setTimeout(r, 150)); } const dz = s.xiliang.dongzhuo; return { mode: s.mode, now: Math.round(s.combatNow), ctrl: !!dz, joint: s.dzLubu?.snapshot(), sheet: s.dzLubu?.dongzhuo.walkSheet, atk: s.dzLubu?.dongzhuo.attackSheet }; }, G);
  ck('拆营前两将在城头', sp.joint?.phase === 'perch' && sp.joint.dzInv, sp);
  await p.evaluate(G0 => { const s = eval(G0); for (const camp of [...s.objective.standing]) { camp.hp = 1; s.hitEnemy(camp, 10, s.combatNow, 'melee', false, false); } }, G);
  await p.waitForFunction(G0 => eval(G0).dzLubu?.phase === 'wall', G, {timeout:12000});
  sp.joint = await p.evaluate(G0 => eval(G0).dzLubu.snapshot(), G);
  ck(`[${layout}] 董卓 · 吕布同时出阵：董卓在城头刀枪不入，吕布在城下`, sp.ctrl && sp.joint?.phase === 'wall' && sp.joint.dzInv && sp.joint.lubu?.active, sp);
  ck(`[${layout}] 董卓用正式图（行走 + 纵火号令动作）`, sp.sheet === 'dongzhuo_walk' && sp.atk === 'dongzhuo_attack', sp);
  const fire = await p.evaluate(async G0 => { const s = eval(G0), dz = s.xiliang.dongzhuo; dz.nextFire = s.combatNow; await new Promise(r => setTimeout(r, 400)); const n = dz.state.fires; const hp0 = s.player.hp; s.player.invulnUntil = 0; await new Promise(r => setTimeout(r, 2200)); return { n, hp0, hp1: s.player.hp }; }, G);
  ck(`[${layout}] 城头纵火：主将周围 3 处火（预警后燃烧，站在火里掉血）`, fire.n === 3 && fire.hp1 < fire.hp0, fire);
  await p.screenshot({ path: `${out}/${layout}-dongzhuo-fire.png` });
  const fl = await p.evaluate(async G0 => { const s = eval(G0); s.player.damageImmune = true; const l = s.dzLubu.lubu; for (let i = 0; i < 6 && !l.invulnerable; i++) s.hitEnemy(l, 500, s.combatNow, 'melee', false, false); for (let i = 0; i < 40 && s.dzLubu.phase !== 'down'; i++) await new Promise(r => setTimeout(r, 150)); return s.dzLubu.snapshot(); }, G);
  ck(`[${layout}] 吕布 1/3 血唤赤兔逃走 → 董卓下城、可以打`, fl.phase === 'down' && !fl.dzInv && !fl.lubu.active, fl);
  const v = await p.evaluate(async G0 => { const s = eval(G0), d = s.dzLubu.dongzhuo; d.hp = Math.floor(d.maxHp * .21); s.hitEnemy(d, d.maxHp * .02, s.combatNow, 'melee', false, false); for (let i = 0; i < 200 && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0); await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); } return { over: s.over, victory: s.victory, sub: s.resultTexts.subtitle.text, phase: s.dzLubu?.phase }; }, G);
  ck('董卓 20%：吕布杀回斩董卓 → 讨伐董卓告捷', v.victory && /董卓/.test(v.sub), v);
  const owned = await p.evaluate(() => (JSON.parse(localStorage.getItem('im_items_v2') ?? '{}').stable ?? { owned: [] }).owned);
  ck('击败董卓不送赤兔（赤兔只在三英战吕布首胜获得）', !owned.includes('chitu'), owned);
  await p.close();
}
// —— 天下地图挑战关：锁定 / 开放 / 首胜赤兔 / 再胜无赤兔 ——
{
  // 2026-11-18 用户「三英战吕布是打完第二章才开的」：2-2 荥阳告捷也不开，整章（2-3）通关才开
  const p = await page('mobile', mk({ dongzhuoStages: 2 }));
  const lock = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).lubuChallengeOpen());
  ck('第二章未通关（2-2 已过）：挑战关未开放', lock === false, lock);
  await p.close();
}
for (const layout of ['mobile', 'desktop']) {
  const p = await page(layout, mk({ dongzhuoStages: 3, cleared: { huangjin: true, hulao: true } }));
  await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(600);
  const node = await p.evaluate(M0 => { const s = eval(M0), m = s.markers.find(x => x.node.id === 'lubu'); s.selected = { kind: 'node', node: m.node }; s.centerOn(m.node); s.refresh(); return { title: s.detailTitle.text, body: s.detail.text, action: s.action.text.text, state: s.nodeState(m.node) }; }, M);
  ck(`[${layout}] 天下地图「三英战吕布」节点：可挑战、写明首胜得赤兔`, node.state === 'open' && /三英战吕布/.test(node.title) && /赤兔/.test(node.body) && node.action === '挑战吕布', node);
  await p.screenshot({ path: `${out}/${layout}-lubu-node.png` });
  if (layout === 'desktop') {
    await p.evaluate(M0 => eval(M0).action.image.emit('pointerup'), M);
    await p.waitForFunction(() => window.__game.scene.isActive('LubuGameScene') && window.__game.scene.getScene('LubuGameScene').player, null, { timeout: 90000 }); await p.waitForTimeout(1200);
    await quiet(p, L);
    const c = await p.evaluate(L0 => { const s = eval(L0); return { name: s.chapter.name, style: s.chapter.bossStyle, waves: s.chapter.waves.length }; }, L);
    ck('挑战关：虎牢关 · 三英战吕布、吕布招式、3 波', c.name === '虎牢关 · 三英战吕布' && c.style === 'lubu' && c.waves === 3, c);
    const win = async () => p.evaluate(async L0 => { const s = eval(L0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); for (let i = 0; i < 100 && !s.over; i++) { if (s.mode === 'parley') s.parley.choose('execute'); if (s.mode === 'bossloot' || s.mode === 'levelup') s.chooseUpgrade(0); await new Promise(r => setTimeout(r, 150)); s.collectBossChests?.(); } const st = JSON.parse(localStorage.getItem('im_items_v2') ?? '{}').stable ?? { owned: [] }; return { victory: s.victory, body: s.resultTexts.body.text, chitu: st.owned.filter(h => h === 'chitu').length, clears: JSON.parse(localStorage.getItem('im_world_v1')).lubuClears }; }, L);
    const w1 = await win();
    ck('首次击败吕布：赤兔入马厩、胜场 1', w1.victory && w1.chitu === 1 && w1.clears === 1 && /赤兔/.test(w1.body), w1);
    await p.screenshot({ path: `${out}/${layout}-lubu-result.png` });
    const replay = await p.evaluate(async L0 => {
      const s = eval(L0), w = await import('/src/world/WorldStore.ts');
      const receipt = s.receipt;
      const dup = w.settleLubuChallenge(receipt,{victory:true,bossKilled:true,debug:false,elapsed:120});
      return {playable:w.lubuChallengePlayable(), clears:w.lubuClears(), dup, horses:JSON.parse(localStorage.getItem('im_items_v2')).stable.owned.filter(k=>k==='chitu').length};
    }, L);
    ck('首胜后正式挑战已平定；重复结算不再给赤兔、功勋、钱币或胜场', !replay.playable && replay.clears===1 && replay.horses===1 && !replay.dup.first && replay.dup.provisions===0 && replay.dup.merits===0, replay);
    const ach = await p.evaluate(() => JSON.parse(localStorage.getItem('im_achievements') ?? '{}'));
    ck('成就「虎牢扬威」由击败吕布获得', JSON.stringify(ach).includes('lubu'), ach);
  }
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
