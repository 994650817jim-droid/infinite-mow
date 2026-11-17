// 第十一章「南征」冒烟测试（src/scenes/NanzhengGameScene.ts、systems/Nanman.ts、data/nanzhengChapter.ts）：
// 选关三关、襄樊通关后开放（夷陵字段合进来前的预留）、时间线接在襄樊之后；
// 11-1 泸水：章首卷轴、毒泉（站进去掉血减速、出来恢复）、象兵冲撞（预警箭道 → 直线冲撞，撞到主将掉血击退）、忙牙长 → 告捷进军营；
// 11-2 藤甲兵：开场卷轴、藤甲物理只吃两成、碰火盆得「火攻」→ 火攻藤甲三倍并引燃身边敌兵、烧伤持续掉血、击败兀突骨；
// 11-3 七擒孟获：开场卷轴、孟获前两次被击倒都逃走（隐身无敌）再杀回来、第三次才倒地 → 宝箱 → 胜利 + 章末「心服」卷轴。
// 电脑布局 1280×720，逐帧 game.step。截图存 assets/review/nanzheng/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-nanzheng.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/nanzheng';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 3, nanzhengStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 11, intelSeq: 1 };
const S = "window.__game.scene.getScene('NanzhengGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(stage, hero = 'zhaoyun') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`11-${stage} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(`11-${stage} ${m.text()}`); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([st, hero]) => { const g = window.__game; g.registry.set('nanzhengStage', st); g.registry.set('runConfig', { character: hero, thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('NanzhengGameScene'); else { g.registry.set('pendingWarlord', 'NanzhengGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [stage, hero]);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('NanzhengGameScene'); return window.__game.scene.isActive('NanzhengGameScene') && s.player; }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(S0 => {
    const g = window.__game, s = eval(S0); window.__S = s; s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false;
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && s.mode !== 'story' && s.mode !== 'rest' && s.mode !== 'result' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__story = name => { let n = 0; for (let i = 0; i < 20; i++) { const c = s.children.getByName(name); if (!c) break; const hit = c.list.find(o => o.name === name + '-next' || o.name === name + '-confirm'); if (!hit) break; hit.emit('pointerup'); n++; window.__step(1); } return n; };
    window.__dummy = (kind, x, y, hp = 1e5) => { const e = s.spawnEnemy(kind, x, y, 1, true); if (e) { e.hp = e.maxHp = hp; e.def = { ...e.def, speed: 0 }; } return e; };
  }, S);
  await p.evaluate(() => window.__step(4));
  return p;
}
const step = (p, n) => p.evaluate(n => window.__step(n), n);
const st = p => p.evaluate(() => window.__S.nzState);
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const finishOff = async p => {
  for (let i = 0; i < 40; i++) { const o = await p.evaluate(() => { const s = window.__S; window.__step(20); s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c && c.x !== undefined) s.player.sprite.setPosition(c.x, c.y); return s.over; }); if (o) break; }
  await step(p, 10);
};
const hitBoss = p => p.evaluate(() => { const s = window.__S; window.__clear(); s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 120000; s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); s.player.damageImmune = true; });
const killBoss = async p => {
  await p.evaluate(() => { const s = window.__S; if (!s.boss?.active) s.spawnBoss(); });
  await step(p, 30);
  const before = await p.evaluate(() => ({ boss: !!window.__S.boss?.active, tex: window.__S.boss?.sprite.texture.key }));
  await hitBoss(p); await finishOff(p);
  return before;
};

// ---------- 选关 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('select ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start('NanzhengChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('NanzhengChapterScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => { const s = window.__game.scene.getScene('NanzhengChapterScene'), w = await import('/src/world/WorldStore.ts'), t = await import('/src/world/ChapterTimeline.ts'); const ids = t.CHAPTER_TIMELINE.map(c => c.id); return { cards: [1, 2, 3].map(i => !!s.children.getByName('nanzheng-stage-' + i)), deploy: !!s.children.getByName('nanzheng-deploy'), open: w.arcUnlocked('nanzheng'), after: ids.indexOf('nanzheng') > ids.indexOf('xiangfan'), last: ids.slice(-3) }; });
  await shot(p, '0-select');
  ck('选关：第十一章三关卡片、出征按钮；襄樊通关后南征开放（夷陵字段预留）；时间线在襄樊之后', r.cards.every(Boolean) && r.deploy && r.open && r.after, r);
  await p.close();
}

// ---------- 11-1 泸水 ----------
{
  const p = await open(1);
  const s0 = await p.evaluate(() => ({ story: !!window.__S.children.getByName('nz-opening'), mode: window.__S.mode }));
  await p.evaluate(() => window.__story('nz-opening'));
  const st0 = await st(p);
  ck('11-1：章首卷轴（冻结战斗）；场上 5 处毒泉', s0.story && s0.mode === 'story' && st0.pools === 5, { s0, pools: st0.pools });
  // 毒泉：站进第一处毒泉 2 秒，再站到外面 2 秒
  const poi = await p.evaluate(() => { const s = window.__S, pl = s.player, n = s.nzNanman, pool = n.pools[0]; window.__clear(); s.spawnTimer = s.eliteTimer = 1e9; pl.damageImmune = false; pl.invulnUntil = 0; pl.hp = pl.maxHp; pl.sprite.setPosition(pool.x, pool.y); window.__step(120); const inHp = pl.maxHp - pl.hp, inSlow = pl.envSpeedMul; pl.hp = pl.maxHp; pl.sprite.setPosition(0, -100); window.__step(120); const outHp = pl.maxHp - pl.hp; pl.damageImmune = true; return { inHp: Math.round(inHp * 10) / 10, inSlow, outHp: Math.round(outHp * 10) / 10, outSlow: pl.envSpeedMul, ticks: n.stats.poisonTicks }; });
  ck('11-1：毒泉——站进去持续掉血、移速变慢；出来就恢复', poi.inHp > 0 && poi.inSlow < 1 && poi.outHp === 0 && poi.outSlow === 1, poi);
  // 象兵：放一头象在主将右边 360 处
  const ele = await p.evaluate(() => { const s = window.__S, pl = s.player; window.__clear(); pl.sprite.setPosition(0, -100); const e = s.spawnEnemy('cavalry', 360, -100, 1, true); e.hp = e.maxHp = 1e5; s.nzNanman.charges.get(e.uid); window.__ele = e; window.__step(2); const c = s.nzNanman.charges.get(e.uid); if (c) c.at = s.combatNow; pl.damageImmune = false; pl.invulnUntil = 0; pl.hp = pl.maxHp; return { tex: e.sprite.texture.key, r: e.radius }; });
  let warnSeen = false;
  for (let i = 0; i < 12; i++) { const w = await p.evaluate(() => { window.__step(5); const c = window.__S.nzNanman.charges.get(window.__ele.uid); window.__S.player.sprite.setPosition(0, -100); return c?.state; }); if (w === 'warn') { warnSeen = true; if (i < 6) await shot(p, '1-elephant-warn'); } }
  await step(p, 60);
  const e2 = await p.evaluate(() => { const s = window.__S, pl = s.player; const r = { charges: s.nzNanman.stats.charges, hits: s.nzNanman.stats.chargeHits, hp: Math.round(pl.hp), max: Math.round(pl.maxHp), eleX: Math.round(window.__ele.x) }; pl.damageImmune = true; return r; });
  ck('11-1：象兵——先出预警箭道，再直线冲撞，撞到主将掉血', warnSeen && e2.charges >= 1 && e2.hits >= 1 && e2.hp < e2.max, { ele, warnSeen, e2 });
  const bk = await killBoss(p);
  const end = await p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory, mode: window.__S.mode }));
  await shot(p, '1-victory');
  ck('11-1：忙牙长（过渡图）出场 → 倒地 → 宝箱 → 泸水告捷、进军营', bk.boss && bk.tex === 'guandu_chunyuqiong' && end.over && end.victory && end.mode === 'rest', { bk, end });
  await p.close();
}

// ---------- 11-2 藤甲兵 ----------
{
  const p = await open(2);
  const s0 = await p.evaluate(() => !!window.__S.children.getByName('nz-tengjia'));
  await p.evaluate(() => window.__story('nz-tengjia'));
  ck('11-2：开场卷轴', s0, s0);
  const r = await p.evaluate(() => {
    const s = window.__S, n = s.nzNanman, pl = s.player; window.__clear(); s.spawnTimer = s.eliteTimer = 1e9; pl.sprite.setPosition(-700, 600); n.fireUntil = 0;
    const t = window.__dummy('shield', -500, 600), inf = window.__dummy('infantry', -500, 680), lost = (e, src) => { const h = e.hp; s.hitEnemy(e, 100, s.combatNow, src, false, false); return h - e.hp; };
    const phys = lost(t, 'melee'), infPhys = lost(inf, 'melee');
    // 碰火盆
    const br = { x: -300, y: -220 }; pl.sprite.setPosition(br.x, br.y); window.__step(3); const fire = n.fireActive;
    pl.sprite.setPosition(-700, 600);
    const t2 = window.__dummy('shield', 300, 600), near = window.__dummy('shield', 360, 620), far = window.__dummy('shield', 900, 600);
    const fireLoss = lost(t2, 'melee'), infFire = lost(inf, 'melee');
    return { phys, infPhys, fire, fireLoss, infFire, burning: [n.isBurning(t2), n.isBurning(near), n.isBurning(far)], ignites: n.stats.ignites, uids: [near.uid] };
  });
  await shot(p, '2-fire');
  ck('11-2：藤甲兵刀枪不入（物理只吃约两成）', r.phys > 0 && r.phys / r.infPhys < .35, r);
  ck('11-2：碰火盆得「火攻」→ 火攻藤甲约三倍伤害，并引燃身边的藤甲（远处的不燃）', r.fire && r.fireLoss / r.infFire > 2 && r.burning[0] && r.burning[1] && !r.burning[2], r);
  const burn = await p.evaluate(() => { const s = window.__S, n = s.nzNanman, e = s.enemies.find(x => x.active && x.uid === window.__nearUid); return { ticks0: n.stats.burnTicks }; });
  await p.evaluate(u => { window.__nearUid = u; }, r.uids[0]);
  const hp0 = await p.evaluate(() => window.__S.enemies.find(x => x.active && x.uid === window.__nearUid)?.hp);
  await step(p, 90);
  const hp1 = await p.evaluate(() => ({ hp: window.__S.enemies.find(x => x.active && x.uid === window.__nearUid)?.hp, ticks: window.__S.nzNanman.stats.burnTicks }));
  await shot(p, '2-burning');
  ck('11-2：被引燃的藤甲持续烧伤掉血', hp1.ticks > burn.ticks0 && hp1.hp < hp0, { hp0, hp1 });
  const bk = await killBoss(p);
  const end = await p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory }));
  ck('11-2：兀突骨（过渡图）出场 → 击败 → 藤甲兵告捷', bk.tex === 'guandu_yanliang' && end.over && end.victory, { bk, end });
  await p.close();
}

// ---------- 11-3 七擒孟获 ----------
{
  const p = await open(3);
  const s0 = await p.evaluate(() => !!window.__S.children.getByName('nz-menghuo'));
  await p.evaluate(() => window.__story('nz-menghuo'));
  ck('11-3：开场卷轴', s0, s0);
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); }); await step(p, 30);
  const log = [];
  for (let k = 0; k < 2; k++) {
    await hitBoss(p); await step(p, 50);
    const a = await p.evaluate(() => ({ ...window.__S.nzState, over: window.__S.over, active: window.__S.boss?.active, inv: window.__S.boss?.invulnerable, vis: window.__S.boss?.sprite.visible }));
    if (k === 0) await shot(p, '3-escape');
    await step(p, 420);
    const b2 = await p.evaluate(() => ({ ...window.__S.nzState, inv: window.__S.boss?.invulnerable, vis: window.__S.boss?.sprite.visible, hp: Math.round(window.__S.boss.hp / window.__S.boss.maxHp * 100) }));
    log.push({ a: { captured: a.captured, hidden: a.hidden, over: a.over, active: a.active, inv: a.inv, vis: a.vis }, b: { captured: b2.captured, hidden: b2.hidden, inv: b2.inv, vis: b2.vis, hp: b2.hp } });
  }
  await shot(p, '3-return');
  ck('11-3：孟获前两次被击倒都逃走（隐身无敌、不结算），过一会儿杀回来（满血左右）', log.every((l, i) => l.a.captured === i + 1 && l.a.hidden && !l.a.over && l.a.active && l.a.inv && !l.b.hidden && !l.b.inv && l.b.vis && l.b.hp >= 80), log);
  await hitBoss(p); await finishOff(p);
  const end = await p.evaluate(() => { const s = window.__S, c = s.children.getByName('nz-ending'); return { over: s.over, victory: s.victory, captured: s.nzState.captured, story: !!c, text: c ? c.list.filter(o => o.type === 'Text').map(o => o.text).join('|').slice(0, 160) : '' }; });
  await shot(p, '3-ending');
  ck('11-3：第三擒才倒地 → 宝箱 → 南征告捷、章末「心服」卷轴', end.over && end.victory && end.captured === 3 && end.story && /孟获/.test(end.text), end);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
