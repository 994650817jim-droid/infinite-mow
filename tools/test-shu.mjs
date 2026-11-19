// 第七章「入蜀」冒烟测试（src/scenes/ShuGameScene.ts、systems/MountainPass.ts、data/shuChapter.ts）：
// 选关界面三关；7-1 葭萌关：章首剧情卷轴、山道两侧坡壁挡路、山坡伏兵（预警后冲下）、滚石（预警箭道后滚过、碾伤敌我）、敌兵只从山道来、首领倒地 → 宝箱 → 告捷进军营；
// 7-2 落凤坡：开场卷轴、庞统随军、落凤箭（预警箭道）、庞统倒下 → 结局卷轴「凤雏陨落」；主将是庞统时无随军庞统、箭射主将、结局「凤雏得救」；
// 7-3 成都：攻城（城门 → 巷战 → 州府）、刘璋（v2）出场、亲卫护盾、击败 → 插旗 → 成都归我方、结算「建设城池」、章末卷轴。
// 电脑布局 1280×720，逐帧 game.step。截图存 assets/review/shu/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-shu.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/shu';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi', 'shu'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 7, intelSeq: 1 };
const S = "window.__game.scene.getScene('ShuGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(stage, hero = 'zhaoyun') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`7-${stage} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(`7-${stage} ${m.text()}`); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([st, hero]) => { const g = window.__game; g.registry.set('shuStage', st); g.registry.set('runConfig', { character: hero, thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('ShuGameScene'); else { g.registry.set('pendingWarlord', 'ShuGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [stage, hero]);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('ShuGameScene'); return window.__game.scene.isActive('ShuGameScene') && s.player; }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(S0 => {
    const g = window.__game, s = eval(S0); window.__S = s; s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false;
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute'); if (s.mode !== 'none' && s.mode !== 'story' && s.mode !== 'rest' && s.mode !== 'result' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__story = name => { let n = 0; for (let i = 0; i < 20; i++) { const c = s.children.getByName(name); if (!c) break; const hit = c.list.find(o => o.name === name + '-next' || o.name === name + '-confirm'); if (!hit) break; hit.emit('pointerup'); n++; window.__step(1); } return n; };
  }, S);
  await p.evaluate(() => window.__step(4));
  return p;
}
const step = (p, n) => p.evaluate(n => window.__step(n), n);
const st = p => p.evaluate(() => window.__S.shuState);
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const killBoss = async p => {
  await p.evaluate(() => { const s = window.__S; if (!s.boss?.active) s.spawnBoss(); });
  await step(p, 30);
  const before = await p.evaluate(() => ({ boss: !!window.__S.boss?.active, tex: window.__S.boss?.sprite.texture.key }));
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 120000; s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 40; i++) { const o = await p.evaluate(() => { const s = window.__S; window.__step(20); s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c && c.x !== undefined) s.player.sprite.setPosition(c.x, c.y); return s.over; }); if (o) break; }
  await step(p, 10);
  return before;
};

// ---------- 选关 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('select ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start('ShuChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('ShuChapterScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => { const s = window.__game.scene.getScene('ShuChapterScene'), w = await import('/src/world/WorldStore.ts'), t = await import('/src/world/ChapterTimeline.ts'); return { cards: [1, 2, 3].map(i => !!s.children.getByName('shu-stage-' + i)), deploy: !!s.children.getByName('shu-deploy'), open: w.arcUnlocked('shu'), timeline: t.CHAPTER_TIMELINE.map(c => c.id).includes('shu') }; });
  await shot(p, '0-select');
  ck('选关：第七章三关卡片、出征按钮；第六章荆南通关后入蜀开放；天下地图时间线有第七章', r.cards.every(Boolean) && r.deploy && r.open && r.timeline, r);
  await p.close();
}

// ---------- 7-1 葭萌关 ----------
{
  const p = await open(1);
  const s0 = await p.evaluate(() => ({ story: !!window.__S.children.getByName('shu-opening'), mode: window.__S.mode }));
  await shot(p, '1-story');
  const n = await p.evaluate(() => window.__story('shu-opening'));
  const s1 = await p.evaluate(() => ({ mode: window.__S.mode, pass: window.__S.shuState.pass, foot: window.__S.sishuiObstacles.footprints.length }));
  const HW = await p.evaluate(async () => (await import('/src/systems/MountainPass.ts')).MOUNTAIN_PASS.halfWidth);
  ck(`7-1：章首剧情卷轴（冻结战斗）→ 看完继续；山道半宽 ${HW[0]}（MOUNTAIN_PASS）、两侧坡壁碰撞框`, s0.story && s0.mode === 'story' && n >= 2 && s1.mode === 'none' && s1.pass?.halfW === HW[0] && s1.foot >= 2 /* 两侧坡壁 + 有边场地后来加的边（11-19 起 4 个） */, { s0, n, s1 });
  // 刷兵只在山道里
  const sp = await p.evaluate(() => { const s = window.__S; window.__clear(); for (let i = 0; i < 8; i++) s.spawnAroundPlayer('infantry', true); const es = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { n: es.length, maxX: Math.max(...es.map(e => Math.abs(e.x))) }; });
  ck('7-1：敌兵只从山道前后来（不在坡壁里）', sp.n >= 6 && sp.maxX <= HW[0] - 30, { ...sp, halfW: HW[0] });
  // 山坡伏兵
  const amb = await p.evaluate(() => { const s = window.__S, m = s.shuPass; window.__clear(); m.ambushAt = s.combatNow; window.__step(70); const es = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { ambushes: m.stats.ambushes, n: es.length, edge: es.filter(e => Math.abs(e.x) > 200).length }; });
  ck('7-1：山坡伏兵——预警后从两侧坡上冲下', amb.ambushes >= 1 && amb.n >= 2 && amb.edge >= 2, amb);
  await shot(p, '1-ambush');
  // 滚石：放几个木桩敌兵在滚石线上
  const bo = await p.evaluate(() => { const s = window.__S, m = s.shuPass, pl = s.player; window.__clear(); m.boulderAt = s.combatNow; m.ambushAt = s.combatNow + 1e6; window.__step(2); const b0 = m.boulders[0]; const dummies = [-150, 0, 150].map(x => { const e = s.spawnEnemy('infantry', x, b0.y, 1, true); if (e) { e.def = { ...e.def, speed: 0 }; e.hp = e.maxHp = 1e5; } return e; }).filter(Boolean); window.__bd = dummies.map(e => [e, e.x, b0.y]); pl.sprite.setPosition(80, b0.y); pl.damageImmune = false; pl.invulnUntil = 0; pl.hp = pl.maxHp; const hp0 = pl.hp; return { lane: !!b0, y: Math.round(b0.y), dummies: dummies.length, hp0 }; });
  for (let i = 0; i < 24; i++) { await p.evaluate(() => { for (const [e, x, y] of window.__bd) if (e.active) e.sprite.setPosition(x, y); window.__step(8); }); if (i === 12) await shot(p, '1-boulder'); }
  const bo2 = await p.evaluate(() => { const s = window.__S, m = s.shuPass; s.player.damageImmune = true; return { hits: m.stats.boulderHits, kills: m.stats.boulderKills, hp: Math.round(s.player.hp), max: Math.round(s.player.maxHp), left: m.boulders.length, dummies: window.__bd.map(([e]) => [e.active, Math.round(e.maxHp - e.hp)]) }; });
  ck('7-1：滚石——先铺预警箭道，再从坡上滚过，碾伤山道上的敌兵与主将', bo.lane && bo2.hits >= 2 && bo2.hp < bo2.max && bo2.left === 0, { bo, bo2 });
  const bk = await killBoss(p);
  const end1 = await p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory, mode: window.__S.mode }));
  await shot(p, '1-victory');
  ck('7-1：首领杨怀出场（v2 图到之前用李傕图过渡）→ 倒地 → 宝箱 → 葭萌关告捷、进军营休整', bk.boss && end1.over && end1.victory && end1.mode === 'rest', { bk, end1 });
  await p.close();
}

// ---------- 7-2 落凤坡（主将赵云：随军庞统落凤） ----------
{
  const p = await open(2);
  const s0 = await p.evaluate(() => ({ story: !!window.__S.children.getByName('shu-luofeng') }));
  await p.evaluate(() => window.__story('shu-luofeng'));
  const s1 = await st(p);
  const HW2 = await p.evaluate(async () => (await import('/src/systems/MountainPass.ts')).MOUNTAIN_PASS.halfWidth[1]);
  ck(`7-2：落凤坡开场卷轴；庞统随军（有血量）；山道更窄（${HW2}）`, s0.story && s1.pass?.pangtong?.hp > 0 && s1.pass?.halfW === HW2, s1);
  const vol = await p.evaluate(() => { const s = window.__S, m = s.shuPass; window.__clear(); m.boulderAt = m.ambushAt = s.combatNow + 1e6; m.volleyAt = s.combatNow; window.__step(3); return { lanes: m.lanes.length, volleys: m.stats.volleys }; });
  await step(p, 40); await shot(p, '2-volley');
  const vol2 = await p.evaluate(() => { const s = window.__S, m = s.shuPass; return { hp: m.pangtong.hp, hits: m.stats.pangtongHits }; });
  await step(p, 60);
  const vol3 = await p.evaluate(() => window.__S.shuPass.pangtong);
  ck('7-2：张任落凤箭——朝庞统铺 2 条预警箭道，站在箭道里会中箭', vol.lanes === 2 && vol.volleys === 1 && vol3.hp < 260, { vol, vol2, vol3 });
  await p.evaluate(() => window.__S.shuPass.hurtPangtong(1e4));
  const fell = await st(p);
  ck('7-2：庞统倒下 →「凤雏中箭」（关卡继续）', fell.pangtongFell && fell.pass.pangtong.down, fell);
  await killBoss(p);
  const end = await p.evaluate(() => { const s = window.__S, c = s.children.getByName('shu-luofeng-end'); return { over: s.over, victory: s.victory, story: !!c, text: c ? c.list.filter(o => o.type === 'Text').map(o => o.text).join('|').slice(0, 200) : '' }; });
  await shot(p, '2-ending');
  ck('7-2：击败张任 → 结局卷轴「凤雏陨落」', end.over && end.victory && end.story && /凤雏陨落/.test(end.text), end);
  await p.close();
}
// ---------- 7-2 主将是庞统：改写台词、箭射主将 ----------
{
  const p = await open(2, 'pangtong');
  const t = await p.evaluate(() => { const c = window.__S.children.getByName('shu-luofeng'); return c ? c.list.filter(o => o.type === 'Text').map(o => o.text).join('|') : ''; });
  await p.evaluate(() => window.__story('shu-luofeng'));
  const s1 = await st(p);
  const vol = await p.evaluate(() => { const s = window.__S, m = s.shuPass, pl = s.player; window.__clear(); m.boulderAt = m.ambushAt = s.combatNow + 1e6; m.volleyAt = s.combatNow; window.__step(3); pl.damageImmune = false; pl.invulnUntil = 0; pl.hp = pl.maxHp; const hp = pl.hp; m.lanes.forEach(l => { l.x = pl.x - 300; l.y = pl.y; l.angle = 0; }); window.__step(90); const d = hp - pl.hp; pl.damageImmune = true; return { d: Math.round(d) }; });
  ck('7-2（主将庞统）：开场台词改写（凤雏亲临）、没有随军庞统、落凤箭射向主将', /天命何足惧/.test(t) && s1.pass.pangtong === null && vol.d > 0, { t: t.slice(0, 80), pt: s1.pass.pangtong, vol });
  await killBoss(p);
  const end = await p.evaluate(() => { const c = window.__S.children.getByName('shu-luofeng-end'); return c ? c.list.filter(o => o.type === 'Text').map(o => o.text).join('|').slice(0, 200) : ''; });
  ck('7-2（主将庞统）：结局「凤雏得救」、台词改写', /凤雏得救/.test(end) && /张任的伏兵/.test(end), end);
  await p.close();
}

// ---------- 7-3 成都（攻城） ----------
{
  const p = await open(3);
  const s0 = await st(p);
  await shot(p, '3-outside');
  ck('7-3：成都攻城——城外段、城门 1900', s0.mid?.phase === 'outside' && s0.mid.gate === 1900, s0);
  const r = await p.evaluate(async () => { const s = window.__S, m = s.shuMid; m.hitGate(1e6); window.__step(140); const street = m.phase; for (const pt of m.points) pt.state = 'secured'; window.__step(140); const hall = m.phase; window.__step(90); return { street, hall, boss: !!s.boss?.active, tex: s.boss?.sprite.texture.key }; });
  await shot(p, '3-hall');
  ck('7-3：破门 → 巷战 → 州府，刘璋出场（v2 图）', r.street === 'street' && r.hall === 'hall' && r.boss && r.tex === 'shu_liuzhang', r);
  const sh = await p.evaluate(() => { const s = window.__S, m = s.shuMid, bo = s.boss; bo.hp = bo.maxHp = 1e6; m.guardsAt = s.combatNow; window.__step(3); const hp0 = bo.hp; s.hitEnemy(bo, 1000, s.combatNow, 'melee', false, false); const withG = hp0 - bo.hp; window.__clear(); const hp1 = bo.hp; s.hitEnemy(bo, 1000, s.combatNow + 1, 'melee', false, false); return { guards: m.stats.guardWaves, withG: Math.round(withG), noG: Math.round(hp1 - bo.hp) }; });
  ck('7-3：东州亲卫在场时刘璋减伤', sh.guards >= 1 && sh.withG < sh.noG, sh);
  await killBoss(p);
  await step(p, 120);
  const end = await p.evaluate(async () => { const s = window.__S, w = await import('/src/world/WorldStore.ts'), c = s.children.getByName('shu-ending'); return { over: s.over, victory: s.victory, owned: w.loadWorld().ownedCities.includes('chengdu'), home: s.resultPanel.getByName('result-home')?.text, story: !!c }; });
  await shot(p, '3-ending');
  ck('7-3：击败刘璋 → 州府插旗 → 成都归我方、结算「建设城池」、章末剧情卷轴', end.over && end.victory && end.owned && end.home === '建设城池' && end.story, end);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
