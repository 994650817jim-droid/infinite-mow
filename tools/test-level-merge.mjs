// 取消局内等级，只留武将等级（2026-11-17，level-merge-proposal.md）。电脑布局 1280×720。
// 需要开发服务器 5173。用法：node tools/test-level-merge.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
const battle = async (q, prep = true) => {
  await p.goto(base + q, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').mode !== undefined, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  if (prep) await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; });
};

// 1) 经验表
await battle('?dev=1&autostart=1&stage=1&layout=desktop');
const table = await p.evaluate(async () => {
  const h = await window.__mod('/src/data/heroLevels.ts'), rg = await window.__mod('/src/systems/RunGrowth.ts');
  const cum = lv => { let n = 0; for (let i = 1; i < lv; i++) n += h.heroXpToNext(i); return n; };
  return { cum: [5, 10, 15, 20, 25, 30].map(cum), same: rg.xpToNext(12) === h.heroXpToNext(12), rate: h.HERO_XP_RATE, guar: h.PICK_GUARANTEE, per: h.OVERFLOW_XP_PER_GRAIN };
});
ck('新经验表：累计 Lv5 100 / Lv10 1280 / Lv15 7280 / Lv20 16030 / Lv25 27280 / Lv30 40780', JSON.stringify(table.cum) === '[100,1280,7280,16030,27280,40780]' && table.same, table);
ck('倍率主线 1.0 / 其余 0.5；保底主线 4、其余 3；满级 50 经验折 1 军粮', table.rate.main === 1 && table.rate.side === .5 && table.guar.main === 4 && table.guar.side === 3 && table.per === 50, table);

// 2) 战斗中：等级即武将等级，升级弹三选一并给属性点；HUD 不再有「战功 Lv」
const live = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), hp = await window.__mod('/src/systems/HeroProgress.ts'), g = s.player.growth;
  const out = { start: s.player.level, hero: hp.heroInfo('zhaoyun').level, rate: s.heroXpRate(), hud: s.hudTexts.level.text, un0: g.unallocated };
  const gained = s.player.gainXp(g.scaleXp(100, s.heroXpRate()), hp.levelCap()); s.onHeroLevelUp(gained);
  out.gained = gained; out.level = s.player.level; out.pending = s.pendingLevels; out.un = g.unallocated; out.mode = s.mode;
  out.title = s.levelPanel.getByName('upgrade-title')?.text; out.hint = s.levelPanel.getByName('upgrade-points-hint')?.text;
  while (s.mode === 'levelup') s.chooseUpgrade(0); s.hudAcc = 1; s.updateHud(); out.hud2 = s.hudTexts.level.text;
  out.saved = hp.heroInfo('zhaoyun').level; // 测试战斗不写存档
  return out;
});
ck('开局等级 = 武将等级（Lv1），主线首次经验倍率 1.0', live.start === 1 && live.hero === 1 && live.rate === 1, live);
ck('打怪经验直接升武将等级：100 经验 → Lv5，弹 4 次三选一、各给 1 个属性点', live.gained === 4 && live.level === 5 && live.pending === 4 && live.un - live.un0 === 4 && live.mode === 'levelup' && /武将升级/.test(live.title ?? '') && /武将 Lv\.5/.test(live.hint ?? ''), live);
ck('HUD 只写武将 Lv，没有「战功」', !/战功/.test(live.hud) && !/战功/.test(live.hud2 ?? '') && /Lv\.5/.test(live.hud2 ?? ''), live);
ck('测试战斗不写武将等级存档', live.saved === 1, live);

// 3) 每关保底「军略」：波次清完补到 1 / 2 / 3，开首领宝箱补到 4；升级多就不补；军略不给属性点
await battle('?dev=1&autostart=1&stage=2&layout=desktop');
const g1 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, out = { un0: g.unallocated };
  // 走真实波次推进：时间拨到第 2 波
  const w = s.chapter.waves; s.elapsed = (w[1].start ?? w[1].at ?? w[1].time ?? 0) + .5; s.update(s.time.now, 16);
  out.modeAfter = s.mode; if (s.mode !== 'levelup') s.resumePendingChoices();
  out.wave = s.waveIndex; out.given1 = s.picksGiven; out.military = s.militaryPending; out.title = s.levelPanel.getByName('upgrade-title')?.text; out.hint = s.levelPanel.getByName('upgrade-points-hint')?.text;
  while (s.mode === 'levelup') s.chooseUpgrade(0);
  out.un1 = g.unallocated; out.military1 = s.militaryPending;
  s.ensurePicks(2); out.again = s.picksGiven;
  s.grantBossChest(); out.chest = s.picksGiven; while (s.mode === 'levelup') s.chooseUpgrade(0);
  s.ensurePicks(9); out.capped = s.picksGiven;
  return out;
});
ck('第 1 波清完：补 1 次「军略」三选一（标题写军略，不给属性点）', g1.wave >= 1 && g1.given1 === g1.wave && /军略/.test(g1.title ?? '') && /不给属性点/.test(g1.hint ?? '') && g1.un1 === g1.un0 && g1.military1 === 0, g1);
ck('已够数不重复补；开首领宝箱补到 4 次；保底最多 4 次', g1.again === Math.max(2, g1.given1) && g1.chest === 4 && g1.capped === 4, g1);

// 3b) 第 3 波之后直接是首领（波次不再推进）：首领登场时补到 3 次
await battle('?dev=1&autostart=1&stage=3&layout=desktop');
const g3 = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), before = s.picksGiven; s.spawnBoss(); return { before, after: s.picksGiven, boss: !!s.boss?.active }; });
ck('首领登场时保底补到 3 次（平衡会话实测发现第 3 次原来不触发）', g3.before === 0 && g3.after === 3 && g3.boss, g3);

// 4) 上限：到章节上限后最多再存 1 级经验，其余折军粮
const cap = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, h = await window.__mod('/src/data/heroLevels.ts');
  pl.level = 10; pl.xp = 0; pl.xpNext = h.heroXpToNext(10); pl.overflowXp = 0;
  const gained = pl.gainXp(5000, 10);
  return { gained, level: pl.level, xp: pl.xp, next: pl.xpNext, overflow: pl.overflowXp };
});
ck('战斗中到上限 Lv10：不再升级，经验最多存 1 级（1100），多出的记作溢出', cap.gained === 0 && cap.level === 10 && cap.xp === 1100 && cap.overflow === 3900, cap);

// 5) 重打已通关的关：经验倍率 0.5、保底 3 次
await p.evaluate(async () => { const hp = await window.__mod('/src/systems/HeroProgress.ts'); hp.claimFirstClear('huangjin-1'); (await window.__mod('/src/systems/BattleSnapshot.ts')).commitBattle(); /* 测试在战斗中直接改存档代替结算：先提交本场，免得跳转时被「中途退出」回滚（2026-11-17） */ });
await battle('?dev=1&autostart=1&stage=1&layout=desktop');
const rep = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.ensurePicks(9); return { replay: s.campaignReplay, rate: s.heroXpRate(), picks: s.picksGiven }; });
ck('重打旧关：经验 ×0.5，保底最多 3 次', rep.replay && rep.rate === .5 && rep.picks === 3, rep);

// 6) 征程构筑不存局内等级 / 经验，版本 2
const camp = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), c = await window.__mod('/src/systems/Campaign.ts');
  c.saveCampaignBuild('zhaoyun', c.packCampaign('zhaoyun', s.player, s.legion)); const raw = JSON.parse(localStorage.getItem('im_campaign_v1'));
  const pl = raw.heroes.zhaoyun.player; return { version: raw.version, level: 'level' in pl, xp: 'xp' in pl, xpNext: 'xpNext' in pl };
});
ck('征程构筑去掉局内等级 / 经验字段，版本 +1', camp.version === 2 && !camp.level && !camp.xp && !camp.xpNext, camp);

// 7) 正式模式（不带 ?dev=1）：战斗中升级立刻写入武将等级；结算写 Lv.a → Lv.b；满级多出的经验折军粮
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); });
await battle('?autostart=1&layout=desktop', false);
const prod = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), hp = await window.__mod('/src/systems/HeroProgress.ts'), ws = await window.__mod('/src/world/WorldStore.ts'), g = s.player.growth;
  const out = { debug: s.debugRun(), start: s.player.level };
  const gained = s.player.gainXp(g.scaleXp(2880, s.heroXpRate()), hp.levelCap()); s.onHeroLevelUp(gained);
  out.level = s.player.level; out.saved = hp.heroInfo('zhaoyun').level; out.free = hp.heroFreePoints('zhaoyun'); out.heroFree = g.heroFree;
  while (s.mode === 'levelup') s.chooseUpgrade(0);
  const grain0 = ws.loadWorld().provisions; s.bossKilled = true; s.finish(true, 'boss');
  const body = s.resultTexts.body.text.split('\n'); out.line = body.find(l => l.startsWith('武将等级')); out.grainLine = body.find(l => l.startsWith('经验已满'));
  out.grain = ws.loadWorld().provisions - grain0; out.final = hp.heroInfo('zhaoyun');
  return out;
});
ck('正式模式：战斗中升到上限 Lv10 立刻写入存档，属性点同步可加', !prod.debug && prod.level === 10 && prod.saved === 10 && prod.free === 9 && prod.heroFree === 9, prod);
ck('结算写「武将等级 Lv.1 → Lv.10」，满级多出的经验按 50 : 1 折军粮', /Lv\.1 → Lv\.10/.test(prod.line ?? '') && /折军粮 \+\d+/.test(prod.grainLine ?? '') && prod.grain > 0 && prod.final.level === 10 && prod.final.xp <= prod.final.next, prod);
await p.screenshot({ path: 'assets/review/level-merge-result-1280x720.png' });

// 8) 三选一节奏（PICK_PACE，2026-11-17 用户：「中期好像3选一触发的太频繁了」）：第二章起同关两次面板至少隔 minGapSec 秒，
//    攒着的升级 / 保底合成一个面板连选；首领宝箱 / 转关补发不等间隔；第一章不受影响（上面 1–7 都在 1-1 跑）
await battle('?dev=1&autostart=1&chapter=hulao&westStage=1&layout=desktop');
const pace = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), h = await window.__mod('/src/data/heroLevels.ts'), gap = h.PICK_PACE.minGapSec, wait = ms => new Promise(r => setTimeout(r, ms));
  const panel = () => ({ mode: s.mode, title: s.levelPanel.getByName('upgrade-title')?.text, given: s.picksGiven, pending: s.pendingLevels });
  const out = { ch: s.chapter.id, on: s.paceOn(), gap, waves: h.PICK_PACE.waves };
  s.picksGiven = 0; s.pendingLevels = 0; s.militaryPending = 0; s.lastPickAt = -1e9; s.chapter = { ...s.chapter, recruitWaves: [] }; s.freeRecruit = false; s.pendingRecruit = false; // 波次招募弹窗不参与
  s.elapsed = 46; s.ensurePicks(h.PICK_PACE.waves[0]); out.wave1 = panel(); while (s.mode === 'levelup') s.chooseUpgrade(0);
  // 10 秒后连升 2 级：间隔不够，先攒着
  s.elapsed = 56; s.onHeroLevelUp(2); out.queued = panel();
  // 第 2 波清完不再单独补（waves[1] = 1）
  s.ensurePicks(h.PICK_PACE.waves[1]); out.wave2 = panel();
  // 到点：合成一个面板「连选 2 张」，选完第 1 张原地换一批
  s.elapsed = 46 + gap + 1; await wait(400); out.merged = panel();
  if (s.mode === 'levelup') s.chooseUpgrade(0); out.second = panel(); while (s.mode === 'levelup') s.chooseUpgrade(0); out.after = panel();
  // 首领宝箱：补到 4 张，刚开过面板也立刻弹（不等间隔）
  s.elapsed += 5; s.grantBossChest(); out.chest = panel(); while (s.mode === 'levelup') s.chooseUpgrade(0);
  // 转关 / 一次补多张：同一个面板连选
  s.picksGiven = 0; s.ensurePicks(4, true); out.burst = panel(); let n = 0; while (s.mode === 'levelup' && n < 9) { s.chooseUpgrade(0); n++; } out.burstChoices = n;
  return out;
});
ck('第二章起套用节奏：最短间隔 50 秒，保底节点 1 / 1 / 2', pace.ch === 'hulao' && pace.on && pace.gap >= 45 && pace.gap <= 60 && pace.waves.join() === '1,1,2', pace);
ck('第 1 波清完弹 1 次；10 秒后连升 2 级不弹（攒着），第 2 波也不另补', pace.wave1.mode === 'levelup' && pace.queued.mode === 'none' && pace.queued.pending === 2 && pace.wave2.mode === 'none' && pace.wave2.pending === 2, pace);
ck('间隔到点：合成一个面板「连选 2 张」，选完第 1 张原地换一批（仍是同一面板）', pace.merged.mode === 'levelup' && /连选 2 张（第 1 张）/.test(pace.merged.title ?? '') && pace.second.mode === 'levelup' && /第 2 张/.test(pace.second.title ?? '') && pace.after.mode === 'none', pace);
ck('首领宝箱补到 4 张、不等间隔立刻弹', pace.chest.mode === 'levelup' && pace.chest.given === 4, pace.chest);
ck('一次补 4 张：同一面板连选 4 张', /连选 4 张/.test(pace.burst.title ?? '') && pace.burstChoices === 4, { burst: pace.burst, n: pace.burstChoices });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
