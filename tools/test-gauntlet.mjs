// 名将连战第一版（data/gauntlet.ts、scenes/GauntletGameScene.ts）测试。
// 一、纯 node：开关默认关、名将池（每章一位，换人 / 关机制写明）、十阵抽将顺序、每阵强度与无尽、结算奖励、接线（关着时不加地图入口）。
// 二、实机（给 BASE 才跑）：开发构建 ?dev=1&gauntlet=1 直接进 → 割草 → 名将登场（亲兵、首领防拖关掉）→ 斩将 → 清场 + 战利品三选一 → 收副将（在场、用名将自己的图、会攻击）
//    → 下一阵（强度递增）→ 一路打到第十阵 → 通关抉择 → 收兵结算（最高记录写入）；重开一局阵亡结算；三位副将 + 名将 + 割草同屏量帧率。截图 3 张 → assets/review/gauntlet/。
// 用法：node tools/test-gauntlet.mjs　或　BASE=http://127.0.0.1:5197/ node tools/test-gauntlet.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

// ———— 一、纯 node
const M = await load('src/data/gauntlet.ts'), G = M.GAUNTLET, P = M.GAUNTLET_POOL;
ck('开关默认关；?gauntlet=1 开、?gauntlet=0 关', M.gauntletOn('') === false && M.gauntletOn('?gauntlet=1') === true && M.gauntletOn('?gauntlet=0') === false && M.gauntletOn('?dev=1') === false);
ck('名将池 12 位，每章一位（第 1～12 章）；换掉的三位写明原首领（董卓 / 陆逊 / 司马懿）', P.length === 12 && P.every((b, i) => b.chapter === i + 1) && ['lubu', 'zhuran', 'haozhao'].every(id => /董卓|陆逊|司马懿/.test(P.find(b => b.id === id)?.replaces ?? '')), P.map(b => b.name));
{ const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), order = M.pickBosses(P, rnd), ch = order.map(b => b.chapter), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  ck('十阵抽将：前几阵抽前几章的、后几阵抽后几章的；第十阵守关名将出自最后一档；全池时不重复', order.length === 10 && avg(ch.slice(0, 3)) < avg(ch.slice(-3)) && ch[9] >= 9 && new Set(order.map(b => b.id)).size === 10, ch);
  const small = M.pickBosses(P.slice(0, 2), rnd);
  ck('池子不到十位（刚打完第二章：张角、吕布）时轮着重复、不连着两阵同一位', small.length === 10 && small.every((b, i) => i === 0 || b.id !== small[i - 1].id), small.map(b => b.id)); }
{ const s = [1, 5, 10, 11, 15].map(n => M.waveScale(n));
  ck('每阵强度递增；第十阵以后（无尽）继续乘、刷兵量封顶 ' + G.endless.countCap, s.every((x, i) => i === 0 || (x.hp > s[i - 1].hp && x.bossHp > s[i - 1].bossHp)) && M.waveScale(40).count <= G.endless.countCap, s.map(x => +x.hp.toFixed(2))); }
ck('能抽的名将 = 战役里打败过的（测试存档全开）；一个没打过也保底张角', M.unlockedPool(k => k === 'huangjin-3' || k === 'hulao-3').length === 2 && M.unlockedPool(() => false).length === 1 && M.unlockedPool(() => false, true).length === 12);
ck('结算奖励按斩将数（军粮 ×' + G.reward.provisionsPerKill + '、每 ' + G.reward.scrollsEvery + ' 位一张残卷），首次通关另给大奖', M.gauntletReward(3, false).provisions === 3 * G.reward.provisionsPerKill && M.gauntletReward(10, true).scrolls === 5 + G.reward.firstClear.scrolls && M.gauntletReward(0, false).provisions === 0);
{ const S = src('src/scenes/GauntletGameScene.ts'), R = src('src/world/RouteMap.ts'), WN = src('src/world/WorldNodes.ts'), V1 = src('src/scenes/WorldMapSceneV1.ts'), W = src('src/scenes/WorldMapScene.ts'), B = src('src/scenes/BootScene.ts'), MN = src('src/main.ts'), F = src('src/systems/FollowerSquad.ts');
  ck('接线：场景注册；天下地图入口只在开关开着时加（关着时地图一模一样）、第二章打完开放；开发构建 ?gauntlet=1 直接进', MN.includes('const GauntletBattleScene=gauntletGameSceneClass(BattleScene);') && MN.includes('LubuBattleScene, GauntletBattleScene,') && R.includes("if (gauntletOn()) nodes.push({ id: 'gauntlet', kind: 'challenge'") && R.includes("after: stageId('hulao', 3) });\n") && W.includes("if (n.kind === 'challenge' && n.id === 'gauntlet') { this.launchGauntlet(); return; }") && B.includes("import.meta.env.DEV&&q.get('gauntlet')==='1'")
    && WN.includes("...(gauntletOn()?[{id:'gauntlet',name:'名将连战'") && V1.includes("if(node.gauntlet)return chapterStagesDone('hulao',loadWorld())>=3||isChapterTestRun()?'open':'locked';") && V1.includes("if(node.gauntlet&&st==='locked')continue;") && V1.includes("this.scene.start('GauntletGameScene')"));
  ck('不带行营 / 整军 / 随从 / 剧情、不掉战役兵装、不记战役进度、首领防拖关掉', S.includes("this.registry.remove('worldCampaign')") && S.includes("encounter: 'qunxiong'") && S.includes('this.followers?.clear(); this.followers = null;') && S.includes('this.itemDrops = null;') && S.includes('protected lootBlocked() { return true; }') && S.includes('this.bossStallCfg = { quotaSec: 1e9, enrageSec: 1e9 }'));
  ck('副将：随行系统本局临时随从 + 名将自己的首领图（4×8 首领图 / 四方向行走表）', S.includes('this.followers.addTemp(r,') && S.includes('f.look = { tex: a.tex, layout: a.layout') && F.includes('private renderLook(f: Follower, now: number): void')); }

// ———— 二、实机
const BASE = process.env.BASE;
if (BASE) {
  const { chromium } = await import('playwright');
  const OUT = 'assets/review/gauntlet'; mkdirSync(OUT, { recursive: true });
  const errors = [];
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const wait = ms => p.waitForTimeout(ms), ev = (f, a) => p.evaluate(f, a);
  const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await wait(200); } return false; };
  /** 升级三选一 / 战斗支援之类的弹窗先关掉（战利品面板 bossloot 不动，测试自己选）。 */
  const unblock = () => ev(() => { const s = window.__S; for (let i = 0; i < 6 && s.mode !== 'none' && s.mode !== 'bossloot' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade(0); else s.setMode('none'); } });
  try {
    await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.removeItem('im_gauntlet_best_test'); sessionStorage.setItem('seeded', '1'); } });
    await p.goto(BASE + '?dev=1&gauntlet=1&layout=desktop&story=off', { timeout: 180000 });
    const entered = await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GauntletGameScene'); return s?.player && window.__game.scene.isActive('GauntletGameScene') && s.elapsed > .5; }, null, { timeout: 180000 }).then(() => true, () => false);
    const st0 = await ev(() => { const s = window.__game.scene.getScene('GauntletGameScene'); window.__S = s; s.player.damageImmune = true; return { name: s.chapter.name, phase: s.gPhase, wave: s.gWave, order: s.gOrder.map(b => b.name), followers: s.followers?.members.length ?? 0, troops: s.legion.count, drops: !!s.itemDrops, story: !!s.storyDir?.chapterId }; });
    ck('开发构建 ?gauntlet=1 直接进名将连战：第 1 阵割草；没有部曲、随从、兵装掉落；十阵名单已抽好', entered && st0.name === '名将连战' && st0.phase === 'mow' && st0.wave === 1 && st0.followers === 0 && st0.troops === 0 && !st0.drops && st0.order.length === 10, st0);
    for (let i = 0; i < 9; i++) { await wait(2000); await unblock(); } /* 割草十几秒：杂兵围上来再拍 */
    const mow = await ev(() => { const s = window.__S; return { enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, spawned: s.gStats.spawned, hud: s.hudTexts.wave.text }; });
    await p.screenshot({ path: OUT + '/gauntlet-1-mow.png' });
    ck('割草：杂兵一波波刷出来，顶上写「第 1/10 阵 · 割草 N 秒」', mow.enemies > 5 && /第 1\/10 阵 · 割草/.test(mow.hud), mow);
    /** 让这一阵的名将登场（割草时间拨到头），返回名将信息。 */
    const bossUp = async () => { await ev(() => { const s = window.__S; if (s.gPhase === 'mow') s.gAt = s.elapsed - 70; }); const ok = await until(() => !!window.__S.boss?.active && window.__S.gPhase === 'boss', 8000); await unblock();
      return { ok, ...(await ev(() => { const s = window.__S, bz = s.boss; return { name: s.gCur?.name, id: s.gCur?.id, hp: bz?.maxHp, tex: bz?.sprite.texture.key, ctrl: !!s.gauntletCtrl || !!s.lubu || !!s.zhangjiao, stall: s.bossStallCfg.quotaSec, guards: s.enemies.filter(e => e.active && (e.kind === 'elite' || e.kind === 'shield') && bz && Math.hypot(e.x - bz.x, e.y - bz.y) < 160).length, hud: s.hudTexts.wave.text }; })) }; };
    const kill = () => ev(() => { const s = window.__S, bz = s.boss; if (bz?.active) { bz.hp = 0; s.killEnemy(bz); } return s.gPhase; });
    const lootOpen = () => until(() => window.__S.mode === 'bossloot', 6000);
    const b1 = await bossUp(); await wait(1200); await p.screenshot({ path: OUT + '/gauntlet-2-boss.png' });
    ck('名将登场：带亲兵（精锐 / 刀盾围在身边），有出招控制器，首领防拖关掉，顶上写名将名', b1.ok && b1.ctrl && b1.guards >= 2 && b1.stall >= 1e9 && b1.hud.includes(b1.name), b1);
    const ph = await kill(); const opened = await lootOpen();
    const loot = await ev(() => { const s = window.__S; return { phase: s.gPhase, kills: s.gKills.length, opts: s.upgradeOptions.map(o => o.id), left: s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && e.sprite.alpha > .9).length, cleared: s.gStats.cleared }; });
    ck('斩将：清场（杂兵退散）→ 战利品三选一（收为副将 / 取其辎重 / 军资）', ph === 'clear' && opened && loot.kills === 1 && loot.opts.join() === 'gauntlet_follow,gauntlet_spoils,supply_grain' && loot.cleared > 0, loot);
    await ev(() => window.__S.chooseUpgrade(0)); await wait(400);
    const fol = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { n: s.gauntletFollowers.length, name: f?.label.text, tex: f?.sprite.texture.key, look: f?.look?.tex, mode: s.mode }; });
    ck('收为副将：他在场（名牌「副将 · 名字」、用他自己的首领图）', fol.n === 1 && fol.name === '副将 · ' + b1.name && fol.tex === fol.look && fol.mode === 'none', fol);
    await ev(() => { const s = window.__S; s.gAt = s.elapsed - 10; }); await until(() => window.__S.gPhase === 'mow' && window.__S.gWave === 2, 4000); await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; if (f) for (let i = 0; i < 3; i++) s.spawnEnemy('elite', f.x + 26 + i * 12, f.y + 8, undefined, true); }); /* 精锐贴着副将刷（杂兵从屏边走过来、又先被主将砍光，副将摸不到） */
    for (let i = 0; i < 10 && !(await ev(() => (window.__S.gauntletFollowers[0]?.f.dealt ?? 0) > 0)); i++) { await wait(600); await unblock(); }
    const atk = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { wave: s.gWave, dealt: Math.round(f?.dealt ?? 0), hits: f?.hits ?? 0, hp1: +s.chapter.hpScale(0).toFixed(2) }; });
    ck('下一阵：第 2 阵割草、杂兵生命按阵加强；副将会攻击（造成伤害）', atk.wave === 2 && atk.hp1 > 1 && atk.dealt > 0, atk);
    // 一路打到第十阵（战利品选辎重，第 2～3 阵再收两位副将凑满三位）
    let lastHp = b1.hp, okRun = true; const names = [b1.name];
    for (let w = 2; w <= 10; w++) {
      const bw = await bossUp(); if (!bw.ok) { okRun = false; console.log('  阵 ' + w + ' 名将没出来', bw); break; } names.push(bw.name);
      await kill(); if (!(await lootOpen())) { okRun = false; console.log('  阵 ' + w + ' 战利品没弹'); break; }
      await ev(k => window.__S.chooseUpgrade(k), w <= 3 ? 0 : 1); await wait(300);
      if (w < 10) { await ev(() => { const s = window.__S; s.gAt = s.elapsed - 10; }); if (!(await until(wv => window.__S.gWave === wv && window.__S.gPhase === 'mow', 4000, w + 1))) { okRun = false; break; } }
    }
    ck('一路打到第十阵：每阵一位名将（前后按章递进），副将凑满 3 位', okRun && names.length === 10 && (await ev(() => window.__S.gauntletFollowers.length)) === 3, names);
    // 三位副将 + 名将 + 割草同屏量帧率（拨回一阵割草：先刷满杂兵，再叫名将）
    const fps = await ev(async () => { const s = window.__S; for (let i = 0; i < 120; i++) s.spawnAroundPlayer(i % 3 ? 'infantry' : 'shield', true); s.gAt = s.elapsed - 10; const t0 = performance.now(); let n = 0, min = 999; await new Promise(r => { const f = () => { n++; min = Math.min(min, window.__game.loop.actualFps); if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return { avg: Math.round(n / 3), min: Math.round(min), enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, followers: s.gauntletFollowers.length }; });
    console.log('  帧率（无头浏览器，三位副将 + 杂兵）：', JSON.stringify(fps));
    // 第十阵斩完 → 通关抉择 → 收兵结算
    await until(() => window.__S.gPhase === 'choice' && window.__S.mode === 'bossloot', 14000);
    const choice = await ev(() => ({ phase: window.__S.gPhase, opts: window.__S.upgradeOptions.map(o => o.id), cleared: window.__S.gCleared }));
    ck('第十阵斩完：十阵通关，抉择「继续 · 无尽 / 收兵 · 结算」', choice.cleared && choice.opts.join() === 'gauntlet_endless,gauntlet_settle', choice);
    await ev(() => window.__S.chooseUpgrade(1)); const over = await until(() => window.__S.over && window.__S.mode === 'result', 6000); await wait(900);
    const res = await ev(() => { const s = window.__S; return { title: s.resultTexts.subtitle.text, body: s.resultTexts.body.text, faces: s.resultPanel.list.filter(o => o.name === 'gauntlet-face').length, best: JSON.parse(localStorage.getItem('im_gauntlet_best_test') ?? 'null') }; });
    await p.screenshot({ path: OUT + '/gauntlet-3-result.png' });
    ck('收兵结算：通关副标题、打到第 10 阵、斩将 10 位（头像一排）、用时、最高连斩写进存档单独的键（测试存档 _test）', over && /通关/.test(res.title) && /第 10 阵/.test(res.body) && /斩将　　10 位/.test(res.body) && /用时/.test(res.body) && res.faces === 10 && res.best?.kills === 10, res);
    // 重开一局：阵亡结算（不覆盖更高的记录）
    await ev(() => { window.__S.scene.restart(); }); await until(() => { const s = window.__game.scene.getScene('GauntletGameScene'); return s?.player?.alive && s.elapsed > .5 && !s.over; }, 30000);
    const dead = await ev(async () => { const s = window.__game.scene.getScene('GauntletGameScene'); window.__S = s; s.player.damageImmune = false; s.player.hp = 1; s.player.takeDamage(99999, s.combatNow); await new Promise(r => setTimeout(r, 1500)); return { over: s.over, title: s.resultTexts.subtitle.text, body: s.resultTexts.body.text, best: JSON.parse(localStorage.getItem('im_gauntlet_best_test') ?? 'null') }; });
    ck('阵亡结算：止步第 1 阵、斩将 0；最高连斩还是 10（低的不覆盖）', dead.over && /止步第 1 阵/.test(dead.title) && dead.best?.kills === 10 && /最高连斩　10/.test(dead.body), dead);
    // 天下地图入口：结算「返回天下地图」→ 地图聚焦名将连战入口（开关开着、第二章已通关 / 测试存档）
    await ev(() => { const h = window.__S.resultPanel.getByName('result-home'); h?.emit('pointerdown'); }); const onMap = await until(() => window.__game.scene.isActive('WorldMapScene'), 30000); await wait(2500);
    // 天下地图有两版：默认 V1（WorldNodes 节点 + 牙旗），?map=v2 是路线图；两版都认
    const node = await ev(() => { const m = window.__game.scene.getScene('WorldMapScene'), v2 = m?.view?.vis?.get?.('gauntlet'), mk = m?.markers?.find?.(x => x.node.id === 'gauntlet'), v1 = mk ? mk.root.list.find(o => o.name === 'node-gauntlet')?.getData('state') : undefined;
      return { vis: v2 ?? v1 ?? null, focus: m?.selected?.node?.id ?? null, map: m?.view ? 'v2' : 'v1' }; });
    await p.screenshot({ path: OUT + '/gauntlet-4-map.png' });
    ck('天下地图入口：开关开着时有「名将连战」点（第二章打完开放），从结算回地图时选中它', onMap && node.vis === 'open' && node.focus === 'gauntlet', node);
    { await ev(() => { const m = window.__game.scene.getScene('WorldMapScene'); m.launch(false); }); const back = await until(() => window.__game.scene.isActive('GauntletGameScene'), 30000);
      ck('从地图入口出战 → 进名将连战第 1 阵', back && await ev(() => window.__game.scene.getScene('GauntletGameScene').gWave === 1), back); }
    ck('帧率：三位副将 + 名将 + 割草同屏（无头浏览器 1280×720）平均 ≥ 30', fps.avg >= 30 && fps.followers === 3, fps);
    ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
  } catch (e) { fail++; console.log('FAIL 异常 · ' + e.message.split('\n')[0]); }
  await b.close();
}
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
