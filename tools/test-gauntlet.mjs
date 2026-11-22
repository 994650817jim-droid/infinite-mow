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
// 名将池（适配表 gauntlet-roster.md，分批接入）：BATCH = 已接入的批次名单
const BATCH1 = ['zhangliang', 'zhangbao', 'lijue', 'guosi', 'zhangxiu', 'caochun', 'caimao', 'zhaofan', 'liudu', 'huangzhong'];
const BATCH2 = ['huaxiong', 'xurong', 'yanliang', 'yanghuai', 'zhangren', 'pangde', 'sunhuan', 'mangyachang', 'zhurong', 'zhanghe'];
const NEW = [...BATCH1, ...BATCH2, 'dongzhuo', 'wenchou', 'xiahouyuan', 'luxun', 'simayi', 'wutugu'];
// 第三批：新接入董卓、文丑 + 第一版里几位按适配表升级（随身布置 / 随行护卫 / 三擒 / 前后两套 / 蜜水不限时）；巡检全部走一遍，曹仁再在第 7 阵看后段那套
const BATCH3 = ['dongzhuo', 'wenchou', 'chunyuqiong', 'liuzhang', 'zhuran', 'hanxuan', 'lvmeng', 'caoren@4', 'caoren@7', 'menghuo', 'yuanshu'];
// 第四批：高地圈（夏侯渊 / 曹操）、火带（陆逊）、随身营垒（司马懿）、随身箭楼 + 专属图（郝昭）、火油罐藤甲（兀突骨）
const BATCH4 = ['xiahouyuan', 'caocao', 'luxun', 'simayi', 'haozhao', 'wutugu'];
const SWEEP = [...BATCH1, ...BATCH2, ...BATCH3, ...BATCH4];
{ const M2 = await load('src/data/bossMoves.ts'), BM = M2.BOSS_MOVES, ids = P.map(b => b.id);
  ck(`名将池：第一版 12 位 + 已接入 ${NEW.length} 位，不重名；每位有出场段（前 / 中 / 后 / 守关）与解锁关卡`, P.length === 12 + NEW.length && new Set(P.map(b => b.name)).size === P.length && NEW.every(id => ids.includes(id)) && P.every(b => ['front', 'mid', 'late', 'gate'].includes(b.tier) && /^[a-z]+-[123]$/.test(b.clearKey)), P.map(b => b.name + ':' + b.tier));
  const over = P.filter(b => b.ctrl === 'moveset').map(b => { const d = BM[b.arc + '.' + b.id] ?? BM[b.id] ?? M.GAUNTLET_MOVES?.[b.id], drop = b.drop ?? [], names = d ? [...new Set([...d.p1.moves, ...d.p2.moves].map(m => m.name).filter(n => !drop.includes(n)))] : null; return { id: b.id, names, dropOk: drop.every(n => d && [...d.p1.moves, ...d.p2.moves].some(m => m.name === n)) }; });
  ck('招式框架名将都有招式配置；按适配表删的招确实存在（删完每阶段仍有招）', over.every(o => o.names && o.names.length && o.dropOk), over.filter(o => !o.names || !o.dropOk)); }
{ const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7), T = ['front', 'mid', 'late', 'gate'];
  let okAll = true, sample = null;
  for (let r = 0; r < 40; r++) { const rr = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(r + 3), order = M.pickBosses(P, rr), tiers = order.map(b => b.tier);
    const ok = order.length === 10 && new Set(order.map(b => b.id)).size === 10 && tiers.slice(0, 3).every(t => t === 'front') && tiers.slice(3, 6).every(t => t === 'mid') && tiers.slice(6, 9).every(t => t === 'late' || t === 'gate') && tiers.slice(6, 9).filter(t => t === 'gate').length <= 1 && tiers[9] === 'gate';
    if (!ok) { okAll = false; sample = tiers; } if (!sample && r === 0) sample = order.map(b => b.name); }
  ck('四段制抽将（全池）：1～3 阵前段、4～6 中段、7～9 后段（守关最多借一位）、第 10 阵守关；不重复（40 局）', okAll, sample);
  const small = M.pickBosses(P.filter(b => b.id === 'zhangjiao' || b.id === 'lubu'), rnd);
  ck('池子不到十位（刚打完第二章：张角、吕布）时轮着重复、不连着两阵同一位；第十阵是守关档的吕布', small.length === 10 && small.every((b, i) => i === 0 || b.id !== small[i - 1].id) && small[9].id === 'lubu', small.map(b => b.id));
  const early = M.pickBosses(M.unlockedPool(k => /^(huangjin|hulao|third)-/.test(k)), rnd);
  ck('缺段往前借：只打到第三章时，第 4 阵是中段唯一的袁术，其余中 / 后段先借前段没出过的、借完再轮，第十阵守关（吕布或董卓）；不连着同一位', early.slice(0, 3).every(b => b.tier === 'front') && early[3].id === 'yuanshu' && early[9].tier === 'gate' && new Set(early.slice(0, 7).map(b => b.id)).size === 7 && early.every((b, i) => i === 0 || b.id !== early[i - 1].id), early.map(b => b.name));
  const seen = []; let last = null, okE = true; for (let i = 0; i < P.length - 1; i++) { const b = M.endlessBoss(P, last, rnd, seen); if (b === last || seen.includes(b)) okE = false; seen.push(b); last = b; }
  ck('无尽：全池循环，不连着同一位、一轮里不重复', okE, seen.length); }
{ const s = [1, 5, 10, 11, 15].map(n => M.waveScale(n));
  ck('每阵强度递增；第十阵以后（无尽）继续乘、刷兵量封顶 ' + G.endless.countCap, s.every((x, i) => i === 0 || (x.hp > s[i - 1].hp && x.bossHp > s[i - 1].bossHp)) && M.waveScale(40).count <= G.endless.countCap, s.map(x => +x.hp.toFixed(2))); }
ck('能抽的名将 = 战役里打败过的（测试存档全开）；一个没打过也保底张角', M.unlockedPool(k => k === 'huangjin-3' || k === 'hulao-3').map(b => b.name).sort().join() === ['张角', '董卓', '吕布'].sort().join() && M.unlockedPool(() => false)[0]?.id === 'zhangjiao' && M.unlockedPool(() => false, true).length === P.length);
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
  p.on('pageerror', e => errors.push(e.message.slice(0, 200) + ' @ ' + String(e.stack ?? '').split('\n').slice(1, 4).map(l => l.trim().replace(/https?:\/\/[^/]+\//, '').replace(/\?t=\d+/, '')).join(' < ')));
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
    const trk = () => ev(() => { const t = window.__S.gauntletTrack?.stats; return t ? { pos: +t.pos.toFixed(4), x: +t.markerX.toFixed(1), nodeX: t.nodeX.map(v => +v.toFixed(1)), states: [...t.states], caption: t.caption, seal: window.__S.gauntletTrack.root.list.some(n => n.list?.some?.(o => o.name === 'gauntlet-node-seal')) } : null; });
    const mow = await ev(() => { const s = window.__S; return { enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, spawned: s.gStats.spawned, waveLine: s.hudTexts.wave.text, chapterLine: s.hudTexts.chapter.text }; });
    const tr1 = await trk(); await wait(1500); const tr2 = await trk();
    await p.screenshot({ path: OUT + '/gauntlet-1-mow.png' });
    ck('割草：杂兵一波波刷出来；左上角不再写「第 N/10 阵」、计时器下不再写关名（看顶部进度条）', mow.enemies > 5 && mow.waveLine === '' && mow.chapterLine === '', mow);
    ck('十阵进度条 · 割草：10 个节点都是暗的「？」，标从起点往第一个节点匀速走（随时间前进、还没到节点），小字「第 1/10 阵 · 距名将登场 mm:ss」', !!tr1 && tr1.nodeX.length === 10 && tr1.states.every(s => s === 'dark') && tr2.x > tr1.x && tr2.pos > tr1.pos && tr2.pos < .1 && tr2.x < tr2.nodeX[0] && /^第 1\/10 阵 · 距名将登场 \d\d:\d\d$/.test(tr2.caption), { tr1: tr1 && { pos: tr1.pos, x: tr1.x }, tr2 });
    /** 让这一阵的名将登场（割草时间拨到头），返回名将信息。 */
    const bossUp = async () => { await ev(() => { const s = window.__S; if (s.gPhase === 'mow') s.gAt = s.elapsed - 70; }); const ok = await until(() => !!window.__S.boss?.active && window.__S.gPhase === 'boss', 8000); await unblock();
      return { ok, ...(await ev(() => { const s = window.__S, bz = s.boss; return { name: s.gCur?.name, id: s.gCur?.id, hp: bz?.maxHp, tex: bz?.sprite.texture.key, ctrl: !!s.gauntletCtrl || !!s.lubu || !!s.zhangjiao || !!s.huaxiong || !!s.xurong, stall: s.bossStallCfg.quotaSec, guards: s.enemies.filter(e => e.active && (e.kind === 'elite' || e.kind === 'shield') && bz && Math.hypot(e.x - bz.x, e.y - bz.y) < 160).length, hud: s.gauntletTrack?.stats.caption ?? '' }; })) }; };
    const kill = () => ev(() => { const s = window.__S; for (let k = 0; k < 4 && s.gPhase === 'boss' && s.boss?.active; k++) { s.boss.hp = 0; s.killEnemy(s.boss); } return s.gPhase; }); /* 孟获三擒：倒下原地再起两次，连斩到阵过为止 */
    const lootOpen = () => until(() => window.__S.mode === 'bossloot', 6000);
    const b1 = await bossUp(); await wait(1200); await p.screenshot({ path: OUT + '/gauntlet-2-boss.png' });
    const tr3 = await trk(), tr3b = await ev(() => { const t = window.__S.gauntletTrack; const n = t.root.getByName('gauntlet-node-1'); return { nodeImg: n?.list?.some(o => o.type === 'Image' && String(o.texture?.key).startsWith('gauntlet_head_')), breathe: window.__S.tweens.getTweensOf(t.root.getByName('gauntlet-marker')).length > 0 }; });
    ck('十阵进度条 · 名将登场：标停在第 1 个节点上（呼吸式放大），节点换成名将小头像，小字写名将名字', Math.abs(tr3.x - tr3.nodeX[0]) < .5 && tr3.states[0] === 'up' && tr3b.nodeImg && tr3b.breathe && tr3.caption.includes(b1.name), { x: tr3.x, node: tr3.nodeX[0], states: tr3.states.slice(0, 2), caption: tr3.caption, ...tr3b });
    { const lay = await ev(() => { const s = window.__S, find = (list, name) => { for (const o of list) { if (o.name === name) return o; if (o.list) { const f = find(o.list, name); if (f) return f; } } return null; }, R = o => { if (!o || !o.visible) return null; const b = o.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) }; };
        const tr = s.gauntletTrack.root, kids = tr.list.filter(o => o.visible && (o.name?.startsWith('gauntlet-node-') || o.name === 'gauntlet-marker' || o.name === 'gauntlet-track-caption')), box = kids.map(R).filter(Boolean).reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) }));
        return { track: box, timer: R(s.hudTexts.timer), chapter: R(s.hudTexts.chapter), scroll: R(find(s.children.list, 'battle-map-scroll')), pause: R(find(s.children.list, 'hud-pause')), W: s.scale.width }; });
      const hit = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
      ck('十阵进度条不压顶部的计时器、关名、舆图卷轴、设置按钮（1280×720）', !hit(lay.track, lay.timer) && !hit(lay.track, lay.chapter) && !hit(lay.track, lay.scroll) && !hit(lay.track, lay.pause), lay); }
    ck('名将登场：带亲兵（精锐 / 刀盾围在身边），有出招控制器，首领防拖关掉，顶上写名将名', b1.ok && b1.ctrl && b1.guards >= 2 && b1.stall >= 1e9 && b1.hud.includes(b1.name), b1);
    const ph = await kill(); const opened = await lootOpen(); const tr4 = await trk();
    ck('十阵进度条 · 斩将：第 1 个节点变成已斩（盖朱印），标还停在节点上', tr4.states[0] === 'killed' && tr4.seal && Math.abs(tr4.x - tr4.nodeX[0]) < .5, { states: tr4.states.slice(0, 2), seal: tr4.seal, caption: tr4.caption });
    const loot = await ev(() => { const s = window.__S; return { phase: s.gPhase, kills: s.gKills.length, opts: s.upgradeOptions.map(o => o.id), left: s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && e.sprite.alpha > .9).length, cleared: s.gStats.cleared }; });
    ck('斩将：清场（杂兵退散）→ 战利品三选一（收为副将 / 取其辎重 / 军资）', ph === 'clear' && opened && loot.kills === 1 && loot.opts.length === 3 && loot.opts[0] === 'gauntlet_follow' && loot.opts[1] === 'gauntlet_spoils' && /^supply_/.test(loot.opts[2]) && loot.cleared > 0, loot);
    await ev(() => window.__S.chooseUpgrade(0)); await wait(400);
    const fol = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { n: s.gauntletFollowers.length, name: f?.label.text, tex: f?.sprite.texture.key, look: f?.look?.tex, mode: s.mode }; });
    ck('收为副将：他在场（名牌「副将 · 名字」、用他自己的首领图）', fol.n === 1 && fol.name === '副将 · ' + b1.name && fol.tex === fol.look && fol.mode === 'none', fol);
    await ev(() => { const s = window.__S; s.gAt = s.elapsed - 10; }); await until(() => window.__S.gPhase === 'mow' && window.__S.gWave === 2, 4000); await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; if (f) for (let i = 0; i < 3; i++) s.spawnEnemy('elite', f.x + 26 + i * 12, f.y + 8, undefined, true); }); /* 精锐贴着副将刷（杂兵从屏边走过来、又先被主将砍光，副将摸不到） */
    for (let i = 0; i < 10 && !(await ev(() => (window.__S.gauntletFollowers[0]?.f.dealt ?? 0) > 0)); i++) { await wait(600); await unblock(); }
    const atk = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { wave: s.gWave, dealt: Math.round(f?.dealt ?? 0), hits: f?.hits ?? 0, hp1: +s.chapter.hpScale(0).toFixed(2) }; });
    ck('下一阵：第 2 阵割草、杂兵生命按阵加强；副将会攻击（造成伤害）', atk.wave === 2 && atk.hp1 > 1 && atk.dealt > 0, atk);
    { const t5 = await trk(); ck('十阵进度条 · 下一阵：标从第 1 个节点继续往第 2 个节点走，第 1 个节点留着已斩印，第 2 个还是暗的', t5.pos > .1 && t5.pos < .2 && t5.x > t5.nodeX[0] && t5.x < t5.nodeX[1] && t5.states[0] === 'killed' && t5.states[1] === 'dark' && t5.caption.startsWith('第 2/10 阵 · 距名将登场'), { pos: t5.pos, caption: t5.caption, states: t5.states.slice(0, 3) }); }
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
    // 11-21 总制作人：头像放大并排整齐（同尺寸底牌、脚踩同一条底线、不压奖励格）；结算期间不弹「成就解锁」（压标题），延后到下一个场景
    const look = await ev(() => { const s = window.__S, L = s.resultPanel.list, f = L.filter(o => o.name === 'gauntlet-face'), pl = L.filter(o => o.name === 'gauntlet-face-plate'), rw = s.resultPanel.getByName('result-rewards');
      return { minH: Math.round(Math.min(...f.map(o => o.displayHeight))), plateH: pl[0]?.height ?? 0, bases: [...new Set(f.map(o => Math.round(o.y)))], plateBottom: Math.round(pl[0] ? pl[0].y + pl[0].height / 2 : 0), rewardsY: Math.round(rw?.y ?? 0), toast: s.children.list.filter(o => o.name === 'achievement-toast').length }; });
    ck('结算头像：每位一块同尺寸底牌（≥ 80 高）、人像 ≥ 50 高、脚踩同一条底线，奖励格在头像排下面；结算画面上没有「成就解锁」提示', look.plateH >= 80 && look.minH >= 50 && look.bases.length === 1 && look.rewardsY > look.plateBottom && look.toast === 0, look);
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
    // 新接入名将巡检（适配表分批）：逐位强制登场 → 图在、有出招控制器、几秒内出招 → 斩 → 战利品（黄忠收为副将，其余取辎重）→ 下一位
    { await until(() => { const s = window.__game.scene.getScene('GauntletGameScene'); return s?.player?.alive && s.elapsed > .5; }, 30000);
      await ev(() => { const s = window.__game.scene.getScene('GauntletGameScene'); window.__S = s; s.gEndless = true; s.player.damageImmune = true; });
      const rows = [], FOLLOW = 'huangzhong', SHOTS = { caochun: 'gauntlet-5-newboss.png', huaxiong: 'gauntlet-7-huaxiong.png', dongzhuo: 'gauntlet-8-dongzhuo-escort.png', chunyuqiong: 'gauntlet-9-props.png' };
      /** 第三批的额外检查（登场、出招之后，斩之前）：随身布置 / 护卫 / 蜜水 / 曹仁两套。返回 { ok, ... }。 */
      const PROPS = { wenchou: ['cart', 3], chunyuqiong: ['granary', 3], liuzhang: ['gate', 1], zhuran: ['tent', 3] };
      const extra = async id0 => {
        const id = id0.split('@')[0], x = await ev(() => window.__S.gauntletExtras);
        if (PROPS[id]) { const [art, n] = PROPS[id], before = x;
          await ev(() => { const s = window.__S, p = s.gProps.find(q => !q.broken); if (p) { p.e.hp = 0; s.killEnemy(p.e); } }); await wait(400);
          const after = await ev(() => ({ ...window.__S.gauntletExtras, shaken: window.__S.gauntletCtrl?.metrics?.shaken ?? null }));
          return { ok: before.props.length === n && before.props.every(p => p.art === art) && before.propsMul < 1 && after.props.filter(p => p.broken).length === 1 && (id !== 'liuzhang' || before.pinned) && (after.shaken === null || after.shaken > 0), n: before.props.length, mul: before.propsMul, pinned: before.pinned, broken: after.props.filter(p => p.broken).length, shaken: after.shaken }; }
        if (id === 'dongzhuo' || id === 'hanxuan') { const before = x.escort;
          await ev(() => { const s = window.__S, E = s.gEscort; if (E) s.hitEnemy(E.e, E.e.hp, s.combatNow, 'melee', false, false); }); await wait(1400);
          const after = await ev(() => window.__S.gauntletExtras.escort);
          return { ok: !!before && before.active && before.name === (id === 'dongzhuo' ? '吕布' : '黄忠') && !after, escort: before?.name, after }; }
        if (id === 'yuanshu') { const o = await ev(() => window.__S.gauntletCtrl?.opts); return { ok: !!o?.endlessHoney, opts: o }; }
        if (id === 'xiahouyuan' || id === 'caocao') { await ev(() => { window.__S.gHillAt = window.__S.combatNow; }); await wait(2600);
          const h = (await ev(() => window.__S.gauntletExtras)).hill; if (h) await ev(h => { const s = window.__S; s.player.sprite.x = h.x; s.player.sprite.y = h.y; }, h); await wait(150);
          const h2 = (await ev(() => window.__S.gauntletExtras)).hill; return { ok: !!h && h.up && !!h2?.playerIn, hill: h2 }; }
        if (id === 'luxun') { await ev(() => { window.__S.gBandAt = window.__S.combatNow; }); await wait(1100); await p.screenshot({ path: OUT + '/gauntlet-10-luxun-fireband.png' }); await wait(3200);
          const b = (await ev(() => window.__S.gauntletExtras)).band; return { ok: b.bands >= 1 && b.cells > 20, band: b }; }
        if (id === 'simayi') { const c = await ev(() => window.__S.gauntletCtrl?.constructor?.name); return { ok: c === 'SimayiBoss' && x.forts === 4, ctrl: c, forts: x.forts }; }
        if (id === 'haozhao') { const fired = await until(() => (window.__S.gauntletExtras.strikes?.fired ?? 0) > 0, 9000); await p.screenshot({ path: OUT + '/gauntlet-11-haozhao-towers.png' });
          const x2 = await ev(() => window.__S.gauntletExtras);
          return { ok: x.props.length === 2 && x.props.every(p => p.art === 'tower') && fired, towers: x.props.length, strikes: x2.strikes }; } // 郝昭新图版式不对，先没接（见 gauntlet-v1.md）
        if (id === 'wutugu') { const before = x; await ev(() => { const s = window.__S; for (const p of s.gProps) if (!p.broken && p.e.active) { p.e.hp = 0; s.killEnemy(p.e); } }); await wait(400); const after = await ev(() => window.__S.gauntletExtras);
          return { ok: before.props.length === 2 && before.props.every(p => p.art === 'jar') && before.propsMul < .5 && after.armorBurned && after.propsMul === 1, jars: before.props.length, mul: before.propsMul, burned: after.armorBurned }; }
        if (id === 'caoren') { const c = await ev(() => window.__S.gauntletCtrl?.constructor?.name); return { ok: c === (+id0.split('@')[1] >= 7 ? 'BossMoveset' : 'CaorenBoss'), ctrl: c, wave: id0.split('@')[1] }; }
        return { ok: true };
      };
      for (const id0 of SWEEP) {
        const [id, atWave] = id0.split('@');
        await unblock();
        await ev(async ([id, atWave]) => { const s = window.__S, G = await import('/src/data/gauntlet.ts'); if (atWave) s.gWave = +atWave; s.gOrder[s.gWave - 1] = G.GAUNTLET_POOL.find(x => x.id === id); s.gPhase = 'mow'; s.gAt = s.elapsed - 999; }, [id, atWave]);
        const up = await until(() => window.__S.gPhase === 'boss' && !!window.__S.boss?.active, 8000);
        await ev(() => { const s = window.__S, bz = s.boss; if (bz) { s.player.sprite.x = bz.x - 150; s.player.sprite.y = bz.y + 60; } }); /* Player.x 是 sprite.x 的 getter：挪 sprite */
        await ev(() => { window.__castSeen = false; });
        const cast = await until(() => { const s = window.__S, st = s.gauntletState; if (s.mode === 'levelup') s.chooseUpgrade(0); if (st && !['approach', 'idle', 'dead'].includes(st)) window.__castSeen = true; return Object.values(s.gauntletCtrl?.metrics ?? {}).some(v => typeof v === 'number' && v > 0) || window.__castSeen; }, 12000); /* 开局 / 升级三选一会暂停战斗：等的时候顺手选掉；原生控制器（华雄 / 徐荣）看状态离开「逼近」 */
        if (SHOTS[id0]) { await wait(400); await p.screenshot({ path: OUT + '/' + SHOTS[id0] }); }
        const row = await ev(() => { const s = window.__S, bz = s.boss, c = s.gauntletCtrl, tex = bz?.sprite.texture.key; return { id: s.gCur?.id, tex, texOk: !!tex && tex !== '__MISSING' && tex !== '__DEFAULT' && s.textures.get(tex).frameTotal > 4, ctrl: c?.constructor?.name ?? (s.huaxiong ? 'HuaxiongBoss' : s.xurong ? 'XurongBoss' : null), moves: c?.metrics?.moves ?? 0, mounted: !!c?.mounted }; });
        row.extra = await extra(id0);
        if (id === 'menghuo') { // 三擒：前两次倒下原地再起（还在场、阵没过），第三次才斩
          const r = []; for (let k = 0; k < 2; k++) { await ev(() => { const s = window.__S, bz = s.boss; if (bz) { bz.hp = 0; s.killEnemy(bz); } }); await wait(300); r.push(await ev(() => ({ rises: window.__S.gauntletExtras.rises, alive: !!window.__S.boss?.active, phase: window.__S.gPhase, hp: Math.round(window.__S.boss?.hp / window.__S.boss?.maxHp * 100) }))); }
          row.extra = { ok: r[0].rises === 1 && r[1].rises === 0 && r.every(x => x.alive && x.phase === 'boss' && x.hp >= 35), r }; }
        await ev(() => { const s = window.__S, bz = s.boss; if (bz) { bz.hp = 0; s.killEnemy(bz); } });
        const down = await until(() => window.__S.gPhase === 'clear', 6000), loot = await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode === 'bossloot'; }, 8000);
        if (id === 'hanxuan') { const n = await ev(() => window.__S.upgradeOptions[0]?.name); row.extra = { ...row.extra, ok: row.extra.ok && n === '收为副将 · 黄忠', follow: n }; }
        await ev(follow => window.__S.chooseUpgrade(follow ? 0 : 1), id === FOLLOW);
        if (id === FOLLOW) { await wait(1200); const f = await ev(() => { const s = window.__S, g = s.gauntletFollowers.at(-1); return g ? { name: g.f.label.text, look: g.f.look?.tex, tex: g.f.sprite.texture.key, boss: g.boss.id } : null; }); row.follower = f;
          await ev(() => { const s = window.__S, g = s.gauntletFollowers.at(-1); if (g) { s.player.sprite.x = g.f.sprite.x + 200; s.player.sprite.y = g.f.sprite.y; } }); await wait(120); /* 主将挪开，副将还没跟上：两人分开拍 */ await p.screenshot({ path: OUT + '/gauntlet-6-newfollower.png' }); }
        await ev(() => { const s = window.__S; s.gAt = s.elapsed - 60; });
        rows.push({ ...row, want: id, up, cast, down, loot, sweep: id0 });
      }
      const bad = rows.filter(r => !(r.up && r.id === r.want && r.texOk && r.ctrl && r.cast && r.down && r.loot));
      ck(`新接入名将巡检（${rows.length} 场）：逐位登场、首领图在、有出招控制器、几秒内出招、能被斩、斩后有战利品`, bad.length === 0, bad.length ? bad : rows.map(r => r.sweep + (r.mounted ? '(骑)' : '') + ':' + r.moves));
      const b4 = rows.filter(r => BATCH4.includes(r.sweep));
      ck('第四批适配：高地圈（夏侯渊 / 曹操：出现、主将站上去算在里面）、陆逊火带（报风向、顺风扫过、点燃）、司马懿随身营垒 4 座、郝昭随身箭楼 2 座放箭雨、兀突骨火油罐（罐在几乎不受伤，罐碎藤甲着火）', b4.length === BATCH4.length && b4.every(r => r.extra?.ok), b4.some(r => !r.extra?.ok) ? b4.filter(r => !r.extra?.ok).map(r => ({ id: r.sweep, ...r.extra })) : b4.map(r => r.sweep));
      const b3 = rows.filter(r => BATCH3.includes(r.sweep));
      ck('第三批适配：随身布置（文丑辎重车 / 淳于琼粮垛 / 刘璋城门钉住 / 朱然营帐：在时减伤、打掉一件会倒、官渡控制器僵直）、随行护卫（董卓吕布 / 韩玄黄忠：打到三成血退场）、韩玄那阵收黄忠、孟获倒下原地再起两次、袁术蜜水不限时、曹仁第 7 阵起换樊城那套', b3.length === BATCH3.length && b3.every(r => r.extra?.ok), b3.some(r => !r.extra?.ok) ? b3.filter(r => !r.extra?.ok).map(r => ({ id: r.sweep, ...r.extra })) : b3.map(r => r.sweep));
      { await unblock(); await ev(() => { const s = window.__S; if (s.mode === 'bossloot') s.chooseUpgrade(1); s.gWave = 10; s.gEndless = true; s.gauntletTrack.setWave(1, true); s.gauntletTrack.setWave(10, true); s.nextWave(); }); await wait(400); /* 巡检把阵数推过第十阵了：先把进度条拨回第一轮 */
        const e = await ev(() => { const t = window.__S.gauntletTrack.stats; return { cycle: t.cycle, states: [...t.states], pos: t.pos, caption: t.caption, gate: !!window.__S.gauntletTrack.root.getByName('gauntlet-node-10').list.find(o => o.type === 'Text' && o.style?.fontSize === '13px') }; });
        ck('十阵进度条 · 无尽：第 11 阵起换一轮（节点全回到暗的、标回到起点，守关节点不再放大），小字「无尽 · 第 11 阵」', e.cycle === 1 && e.states.every(x => x === 'dark') && e.pos < .1 && !e.gate && e.caption.startsWith('无尽 · 第 11 阵'), e); }
      const fr = rows.find(r => r.want === FOLLOW)?.follower;
      ck('新名将收为副将：黄忠在场（名牌「副将 · 黄忠」、用他自己的首领图）', !!fr && fr.name === '副将 · 黄忠' && fr.look === fr.tex && fr.boss === FOLLOW, fr); }
    ck('帧率：三位副将 + 名将 + 割草同屏（无头浏览器 1280×720）平均 ≥ 30', fps.avg >= 30 && fps.followers === 3, fps);
    ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
  } catch (e) { fail++; console.log('FAIL 异常 · ' + e.message.split('\n')[0]); }
  await b.close();
}
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
