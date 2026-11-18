// 第九章「襄樊之战」冒烟测试（src/scenes/XiangfanGameScene.ts、systems/Flood.ts、systems/Breakout.ts、data/xiangfanChapter.ts）：
// 选关三关、汉中通关后开放；9-1 樊城：章首卷轴、北面城墙、曹仁（v2）→ 倒地 → 宝箱 → 进军营；
// 9-2 水淹七军：开场卷轴、场地有界、洪水预警 → 洪峰推进 → 水中敌人被冲走 / 受伤 / 自身减速，主将涉水变慢掉血、站高地无事；庞德半血抬棺狂暴；
// 9-3 麦城突围：限时、合围刷兵在谷道里、近出口吕蒙截道、拒马封路，击败吕蒙后冲进出口才胜利、章末卷轴；超时失败。
// 电脑布局 1280×720，逐帧 game.step。截图存 assets/review/xiangfan/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-xiangfan.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/xiangfan';
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 9, intelSeq: 1 };
const S = "window.__game.scene.getScene('XiangfanGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(stage, hero = 'zhaoyun') {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`9-${stage} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(`9-${stage} ${m.text()}`); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([st, hero]) => { const g = window.__game; g.registry.set('xiangfanStage', st); g.registry.set('runConfig', { character: hero, thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('XiangfanGameScene'); else { g.registry.set('pendingWarlord', 'XiangfanGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [stage, hero]);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('XiangfanGameScene'); return window.__game.scene.isActive('XiangfanGameScene') && s.player; }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(S0 => {
    const g = window.__game, s = eval(S0); window.__S = s; s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false;
    g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && s.mode !== 'story' && s.mode !== 'rest' && s.mode !== 'result' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
    window.__clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); };
    window.__story = name => { let n = 0; for (let i = 0; i < 20; i++) { const c = s.children.getByName(name); if (!c) break; const hit = c.list.find(o => o.name === name + '-next' || o.name === name + '-confirm'); if (!hit) break; hit.emit('pointerup'); n++; window.__step(1); } return n; };
  }, S);
  await p.evaluate(() => window.__step(4));
  return p;
}
const step = (p, n) => p.evaluate(n => window.__step(n), n);
const st = p => p.evaluate(() => window.__S.xfState);
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const killBoss = async p => {
  await p.evaluate(() => { const s = window.__S; if (!s.boss?.active) s.spawnBoss(); });
  await step(p, 30);
  const before = await p.evaluate(() => ({ boss: !!window.__S.boss?.active, tex: window.__S.boss?.sprite.texture.key }));
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.damageImmune = false; s.player.hp = s.player.maxHp; s.player.invulnUntil = s.combatNow + 120000; s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 40; i++) { const o = await p.evaluate(() => { const s = window.__S; if (s.boss?.active) s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); /* 半血换阶段有 1.5 秒转场无敌（首领招式框架），一下打不死就接着打 */ window.__step(20); s.collectBossChests?.(); const c = s.bossChests?.[0]; if (c && c.x !== undefined) s.player.sprite.setPosition(c.x, c.y); return s.over || s.xfState.pendingWin; }); if (o) break; }
  await step(p, 10);
  return before;
};

// ---------- 选关 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push('select ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start('XiangfanChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('XiangfanChapterScene'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => { const s = window.__game.scene.getScene('XiangfanChapterScene'), w = await import('/src/world/WorldStore.ts'), t = await import('/src/world/ChapterTimeline.ts'); const ids = t.CHAPTER_TIMELINE.map(c => c.id); return { cards: [1, 2, 3].map(i => !!s.children.getByName('xiangfan-stage-' + i)), deploy: !!s.children.getByName('xiangfan-deploy'), open: w.arcUnlocked('xiangfan'), order: ['jingnan', 'shu', 'hanzhong', 'xiangfan'].map(k => ids.indexOf(k)) }; });
  await shot(p, '0-select');
  ck('选关：第九章三关卡片、出征按钮；汉中通关后襄樊开放；时间线 …入蜀 → 汉中 → 襄樊', r.cards.every(Boolean) && r.deploy && r.open && r.order.every((v, i, o) => v >= 0 && (i === 0 || v > o[i - 1])), r);
  await p.close();
}

// ---------- 9-1 樊城 ----------
{
  const p = await open(1);
  const s0 = await p.evaluate(() => ({ story: !!window.__S.children.getByName('xf-opening'), mode: window.__S.mode, wall: window.__S.sishuiObstacles.footprints.length }));
  await p.evaluate(() => window.__story('xf-opening'));
  ck('9-1：章首卷轴（冻结战斗）；北面城墙碰撞框', s0.story && s0.mode === 'story' && s0.wall === 1, s0);
  const bk = await killBoss(p);
  const end = await p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory, mode: window.__S.mode }));
  await shot(p, '1-victory');
  ck('9-1：曹仁（第五章 v2 图）出场 → 倒地 → 宝箱 → 樊城告捷、进军营', bk.boss && bk.tex === 'chibi_caoren' && end.over && end.victory && end.mode === 'rest', { bk, end });
  await p.close();
}

// ---------- 9-2 水淹七军 ----------
{
  const p = await open(2);
  const s0 = await p.evaluate(() => ({ story: !!window.__S.children.getByName('xf-flood'), foot: window.__S.sishuiObstacles.footprints.length }));
  await p.evaluate(() => window.__story('xf-flood'));
  ck('9-2：开场卷轴；场地四面有界', s0.story && s0.foot === 4, s0);
  // 主将站在平地（不在高地），左侧放木桩敌兵
  await p.evaluate(() => { const s = window.__S, f = s.xfFlood; window.__clear(); s.spawnTimer = s.eliteTimer = 1e9; s.player.sprite.setPosition(-200, 150); window.__dummies = [[-700, 0], [-600, 200], [-300, -150]].map(([x, y]) => { const e = s.spawnEnemy('infantry', x, y, 1, true); if (e) { e.hp = e.maxHp = 5000; } return e; }).filter(Boolean); window.__dx = window.__dummies.map(e => e.x); f.trigger(); });
  await step(p, 30);
  const warn = await st(p);
  await shot(p, '2-warn');
  await step(p, 200); await shot(p, '2-rising');
  await step(p, 200);
  const r = await p.evaluate(() => { const s = window.__S, f = s.xfFlood, pl = s.player; const hp0 = pl.hp; pl.damageImmune = false; pl.invulnUntil = 0; return { state: f.state, front: f.frontX, wetPlayer: f.wet(pl.x, pl.y), slow: pl.envSpeedMul, moved: window.__dummies.map((e, i) => Math.round(e.x - window.__dx[i])), hurt: window.__dummies.map(e => Math.round(e.maxHp - e.hp)), stats: { ...f.stats } }; });
  const hpw = await p.evaluate(() => { const s = window.__S, pl = s.player, hp = pl.hp; window.__step(120); const d = hp - pl.hp; pl.sprite.setPosition(-520, -330); pl.hp = pl.maxHp; const h2 = pl.hp; pl.invulnUntil = 0; window.__step(120); const d2 = h2 - pl.hp; const safe = { slow: pl.envSpeedMul, wet: s.xfFlood.wet(pl.x, pl.y) }; pl.damageImmune = true; return { inWater: Math.round(d * 10) / 10, onMound: Math.round(d2 * 10) / 10, safe }; });
  ck('9-2：洪水先预警，再从西面推进漫场', warn.flood.state === 'warn' && (r.state === 'full' || r.state === 'rising') && r.front > 0, { warn: warn.flood, r: { state: r.state, front: r.front } });
  ck('9-2：水中敌人被冲向下游、持续受伤', r.moved.every(m => m > 20) && r.hurt.every(h => h > 0), { moved: r.moved, hurt: r.hurt });
  ck('9-2：主将涉水变慢、掉血；站上高地不受影响', r.wetPlayer && r.slow < 1 && hpw.inWater > 0 && hpw.onMound === 0 && !hpw.safe.wet && hpw.safe.slow === 1, { r: { wet: r.wetPlayer, slow: r.slow }, hpw });
  const rage = await p.evaluate(() => { const s = window.__S; s.spawnBoss(); window.__step(10); const b = s.boss; const sp0 = b.def.speed; b.hp = b.maxHp * .45; window.__step(5); return { rage: s.xfState.rage, sp0, sp1: b.def.speed, tex: b.sprite.texture.key }; });
  await step(p, 20); await shot(p, '2-rage');
  ck('9-2：庞德半血抬棺狂暴（移速提升）', rage.rage && rage.sp1 > rage.sp0, rage);
  await killBoss(p);
  const end = await p.evaluate(() => ({ over: window.__S.over, victory: window.__S.victory }));
  ck('9-2：击败庞德 → 水淹七军告捷', end.over && end.victory, end);
  await p.close();
}

// ---------- 9-3 麦城突围 ----------
{
  const p = await open(3, 'guanyu');
  const s0 = await st(p);
  await step(p, 120);
  const sp = await p.evaluate(() => { const s = window.__S; window.__clear(); for (let i = 0; i < 10; i++) s.spawnAroundPlayer('infantry', true); const es = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { n: es.length, maxX: Math.max(...es.map(e => Math.abs(e.x))), timer: s.children.getByName('xf-breakout')?.text }; });
  await shot(p, '3-surrounded');
  ck('9-3：突围计时、合围刷兵都在谷道里', s0.breakout.left >= 170 && sp.n >= 8 && sp.maxX <= 420 && /突围/.test(sp.timer), { s0: s0.breakout, sp });
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.sprite.setPosition(0, -1800); }); await step(p, 40);
  const b1 = await st(p);
  await shot(p, '3-lvmeng');
  ck('9-3：接近出口 → 吕蒙截道、拒马封路', b1.breakout.boss && !b1.breakout.gate && !!b1.boss, b1);
  await killBoss(p);
  const mid = await p.evaluate(() => ({ over: window.__S.over, ...window.__S.xfState.breakout, pending: window.__S.xfState.pendingWin }));
  await p.evaluate(() => { const s = window.__S; window.__clear(); s.player.sprite.setPosition(0, -2440); }); await step(p, 40);
  const end = await p.evaluate(() => { const s = window.__S, c = s.children.getByName('xf-ending'); return { over: s.over, victory: s.victory, story: !!c, text: c ? c.list.filter(o => o.type === 'Text').map(o => o.text).join('|').slice(0, 160) : '' }; });
  await shot(p, '3-ending');
  ck('9-3：击败吕蒙后不立即结算，拒马撤开；冲进出口 → 突围成功、章末卷轴（主将关羽改写）', !mid.over && mid.gate && mid.pending && end.over && end.victory && end.story && /云长/.test(end.text), { mid, end });
  await p.close();
}
{
  const p = await open(3);
  const r = await p.evaluate(() => { const s = window.__S; s.elapsed = 181; window.__step(10); return { over: s.over, victory: s.victory }; });
  ck('9-3：超过 180 秒未冲出 → 失败', r.over && r.victory === false, r);
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
