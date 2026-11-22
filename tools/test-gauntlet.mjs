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
/** 带 phaser 桩的打包（章节数据一路会引到场景工具里的 phaser）。 */
const stub = { name: 'stub', setup(b) { b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'const P = new Proxy(function(){}, { get: (t, k) => k === "__esModule" ? false : P, apply: () => P, construct: () => P }); export default P;', loader: 'js' })); } };
const loadStub = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [stub], loader: { '.png': 'empty', '.webp': 'empty' } }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
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
  ck('每阵刷兵量递增；第十阵以后（无尽）继续乘、封顶 ' + G.endless.countCap, s.every((x, i) => i === 0 || x.count > s[i - 1].count) && M.waveScale(40).count <= G.endless.countCap, s.map(x => +x.count.toFixed(2))); }
// 每阵兵种（11-21 统筹 A：从第一章的兵到最后的兵、从弱到强）：表 GAUNTLET_TROOPS + data/gauntletTroops.ts 折算
{ const T = await loadStub('src/data/gauntletTroops.ts'), WANT = ['huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi', 'jingnan', 'shu', 'yiling', 'nanzheng', 'beifa'];
  const sets = Array.from({ length: 16 }, (_, i) => T.waveTroopSet(i + 1));
  ck('每阵兵种：第 1～10 阵依次是黄巾 → 西凉 → 群雄 → 袁军 → 曹军 → 荆南 → 益州 → 吴军 → 南蛮 → 魏军（借那一章那一关的兵种 / 外形 / 配比）；无尽固定轮换最后三阵（吴 / 南蛮 / 魏）',
    sets.slice(0, 10).every((s, i) => s.troops.arc === WANT[i]) && sets.slice(10).every((s, i) => s.troops.arc === WANT[7 + i % 3]) && sets.every(s => typeof s.chapter.pickEnemy === 'function'), sets.map(s => s.troops.arc));
  const bad = []; for (let i = 1; i < sets.length; i++) for (const k of T.TROOP_KINDS) { const a = sets[i - 1], b = sets[i]; if (a.heavy[k]) continue; if (!(b.defs[k].hp > a.defs[k].hp && b.defs[k].damage >= a.defs[k].damage)) bad.push(`${i + 1}:${k} ${a.defs[k].hp}→${b.defs[k].hp}`); }
  const tg = sets.every((s, i) => i === 0 || (s.troops.infHp > sets[i - 1].troops.infHp && s.troops.infDmg > sets[i - 1].troops.infDmg && s.troops.bossHp > sets[i - 1].troops.bossHp && s.troops.bossDmg > sets[i - 1].troops.bossDmg));
  ck('强度单调：表里步卒 / 名将生命伤害逐阵涨；折算后每类兵（步 / 盾 / 弓 / 骑 / 精锐）都比上一阵强（重兵象兵不进链），无尽接着涨', tg && bad.length === 0, bad.length ? bad : sets.slice(0, 10).map(s => s.defs.infantry.hp + '/' + s.defs.elite.hp));
  const g = T.guardDef('nanzheng', 2, 'shield', 3);
  ck('名将亲兵：用他自己那一章的兵（南中藤甲兵），强度按本阵折算（第 3 阵不比本阵步卒厚太多）', /tengjia|f_liangzhou/.test(g.walkVisual?.texture ?? g.texture) && g.hp < sets[2].defs.shield.hp * 2.5 && g.hp > sets[2].defs.infantry.hp, { tex: g.walkVisual?.texture ?? g.texture, hp: g.hp }); }
// 局内 build 第二批（gauntlet-build.md）：稀有度四档、类别分散、将星卡（24 要星 + 4 主星）
{ const C = await loadStub('src/data/gauntletCards.ts'), ids = C.STAR_CARD_IDS, none = () => false;
  const p0 = C.starCardPool([], none), by = k => p0.filter(c => c.kind === k);
  const p1 = C.starCardPool(['strength.NC'], (a, t) => a === 'strength' && t === 1), p2 = C.starCardPool(['strength.K', 'agility.K'], none);
  ck('将星卡池：24 颗要星 + 4 颗主星不重样；专精按档位顺序出（一档精良、拿了一档才出二档）、12 颗带名字的要星稀有、主星传说且每局最多 2 颗',
    ids.length === 28 && new Set(ids).size === 28 && by('perk').length === 4 && by('perk').every(c => c.tier === 1 && c.rarity === 'fine') && by('named').length === 12 && by('named').every(c => c.rarity === 'rare') && by('keystone').length === 4 && by('keystone').every(c => c.rarity === 'legend')
    && p1.some(c => c.star === 'strength.NL1' && c.tier === 2 && c.rarity === 'rare') && !p1.some(c => c.star === 'strength.NC') && p2.filter(c => c.kind === 'keystone').length === 0, { perk: by('perk').map(c => c.star), named: by('named').length, keys: by('keystone').map(c => c.name) });
  const sums = C.RARITY_BY_WAVE.map(r => +r.w.reduce((a, b) => a + b, 0).toFixed(3)), roll = w => { let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, n = {}; for (let i = 0; i < 4000; i++) { const r = C.rollRarity(w, rnd); n[r] = (n[r] ?? 0) + 1; } return n; }, r1 = roll(1), r10 = roll(10);
  ck('稀有度四档随阵数：每段权重合计 1；第 1～3 阵不出传说、普通约七成，第 10 阵传说约一成、普通约四分之一；颜色沿用兵装品质色（白 / 蓝 / 紫 / 橙）',
    sums.every(x => x === 1) && !r1.legend && r1.common / 4000 > .65 && r10.legend / 4000 > .07 && r10.legend / 4000 < .13 && r10.common / 4000 < .3 && C.RARITY.legend.css === '#f2a24e' && C.RARITY.rare.css === '#c08af0', { sums, r1, r10 });
  const R = (id, name, kind = 'tactic') => C.cardRarity({ id, name, kind });
  ck('卡的类别与稀有度：本命 / 武艺 / 战法 / 将星 / 兵装 / 其他分得开；战法 Lv3 精良、精研 Lv4 稀有、武艺精熟稀有、专职稀有、精进 Lv7 传说、赌命稀有',
    C.cardCategory('signature_weapon_spear_orbit') === 'own' && C.cardCategory('martial_x_2') === 'own' && C.cardCategory('tactic_pursuit') === 'tactic' && C.cardCategory('gauntlet_star_strength.K') === 'star' && C.cardCategory('gauntlet_gear_1') === 'gear' && C.cardCategory('jinnang_x') === 'other'
    && R('tactic_a', '追袭 · Lv.3') === 'fine' && R('tactic_a', '追袭 · Lv.4') === 'rare' && R('tactic_a', '追袭 · Lv.1') === 'common' && R('martial_x_4', '某 · Lv.4', 'martial') === 'rare' && R('branch_x', '专职') === 'rare' && R('weapon_over_7', '某 · Lv.7') === 'legend' && R('gamble_x', '赌命 · 背嵬') === 'rare'); }
{ const S = src('src/scenes/GauntletGameScene.ts'), GS = src('src/scenes/GameScene.ts');
  ck('从 0 开局（接线）：兵装 / 信物 / 坐骑只读本局拿的（开局清空）、等级 / 经验不写回、战后不记武将经验、卡池全开并在离开时放回', S.includes('protected campaignGear() { return gearFromItems([...Object.values(this.gGear') && S.includes("protected campaignCharms(): ReturnType<GameScene['campaignCharms']> { return [...(this.gCharms ?? [])]; }") && S.includes('protected campaignHorse() { return this.gHorse; }') && S.includes('this.gGear = {}; this.gCharms = []; this.gHorse = undefined;') && S.includes('protected persistHeroProgress(): boolean { return false; }') && S.includes('protected lordHeroXp(): number { return 0; }')
    && S.includes("this.openPool(); this.events.once('shutdown', () => this.closePool());") && GS.includes('if (this.persistHeroProgress()) { setHeroProgress(id, this.player.level, this.player.xp); g.heroFree += pts; }') && GS.includes('this.player.growth.gear=this.campaignGear();') && GS.includes('this.mount=null;this.equipMount(this.campaignHorse());')); }
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
  const unblock = () => ev(() => { const s = window.__S, qiyu = () => s.mode === 'bossloot' && /^奇遇/.test(s.levelPanel.getByName('upgrade-title')?.text ?? ''); for (let i = 0; i < 6 && s.mode !== 'none' && (s.mode !== 'bossloot' || qiyu()) && !s.over; i++) { if (s.mode === 'levelup' || qiyu()) s.chooseUpgrade(0); else s.setMode('none'); } }); /* 奇遇面板也选掉 */
  try {
    // 战役存档里赵云 30 级（从 0 开局：进名将连战应是 1 级，打完也不改这条记录）
    await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.removeItem('im_gauntlet_best_test'); const h = JSON.parse(localStorage.getItem('im_heroes_v1') ?? 'null') ?? { version: 1, heroes: {}, migrated: true, firstClears: [], attrSet: 4 }; h.heroes.zhaoyun = { level: 30, xp: 100, attributes: {} }; localStorage.setItem('im_heroes_v1', JSON.stringify(h)); sessionStorage.setItem('seeded', '1'); } });
    await p.goto(BASE + '?dev=1&gauntlet=1&layout=desktop&story=off', { timeout: 180000 });
    const entered = await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GauntletGameScene'); return s?.player && window.__game.scene.isActive('GauntletGameScene') && s.elapsed > .5; }, null, { timeout: 180000 }).then(() => true, () => false);
    const st0 = await ev(() => { const s = window.__game.scene.getScene('GauntletGameScene'); window.__S = s; s.player.damageImmune = true; return { name: s.chapter.name, phase: s.gPhase, wave: s.gWave, order: s.gOrder.map(b => b.name), followers: s.followers?.members.length ?? 0, troops: s.legion.count, drops: !!s.itemDrops, story: !!s.storyDir?.chapterId }; });
    ck('开发构建 ?gauntlet=1 直接进名将连战：第 1 阵割草；没有部曲、随从、兵装掉落；十阵名单已抽好', entered && st0.name === '名将连战' && st0.phase === 'mow' && st0.wave === 1 && st0.followers === 0 && st0.troops === 0 && !st0.drops && st0.order.length === 10, st0);
    // 从 0 开局（11-21 统筹 B / 局内 build 第 5 条）：存档里 30 级的赵云进来是 1 级白板，卡池全开
    const z0 = await ev(() => { const s = window.__S; return { hero: s.runConfig.character, ...s.gauntletFrom0 }; });
    ck('从 0 开局：主将 1 级、经验 0、加点 0、没有星图 / 兵装 / 信物 / 坐骑 / 本命淬炼 / 战法心得；卡池全开（玩法不按进度藏，战法精研 5 级、战法格 7、武艺精熟 +2、专职精进 2）',
      z0.hero === 'zhaoyun' && z0.level === 1 && z0.xp === 0 && z0.attrs === 0 && z0.unallocated === 0 && z0.heroFree === 0 && z0.stars === 0 && z0.gear === 0 && z0.charms === 0 && z0.charmHp === 0 && !z0.mount && z0.temper === 0 && z0.xinde === 0
      && z0.caps.mech && z0.caps.rank === 5 && z0.caps.slot === 7 && z0.caps.extra === 2 && z0.caps.over === 2 && z0.soft === 17, z0);
    // 换一批 ×2 免费 → 之后 40 钱币起、每次 +30；排除 ×1（点一张，本局不再出现）
    const rx = await ev(async () => { const s = window.__S, F = () => ({ ...s.gauntletFrom0.reroll }); s.legion.food = 0; s.pendingLevels = Math.max(1, s.pendingLevels); s.forcePickNow = true; if (s.mode !== 'levelup') s.openUpgrade(); await new Promise(r => setTimeout(r, 300));
      const btn = s.levelPanel.getByName('upgrade-reroll'), ex = s.levelPanel.getByName('gauntlet-exclude'), ti = s.levelPanel.getByName('upgrade-title'), A = ex?.getBounds(), T = ti?.getBounds(), o = { mode: s.mode, exVisible: !!ex?.visible, exText: ex?.text, rr0: btn?.text, f0: F(), ids0: s.upgradeOptions.map(x => x.id), exHitsTitle: !!A && !!T && A.x < T.right && T.x < A.right && A.y < T.bottom && T.y < A.bottom };
      btn.emit('pointerdown'); o.f1 = F(); o.ids1 = s.upgradeOptions.map(x => x.id); btn.emit('pointerdown'); o.f2 = F(); o.rr2 = btn.text; o.rr2On = !!btn.input?.enabled;
      btn.emit('pointerdown'); o.f2b = F(); s.legion.food = 500; s.renderCards(); btn.emit('pointerdown'); o.food = s.legion.food; o.f3 = F();
      ex.emit('pointerdown'); o.excluding = s.gauntletFrom0.excluding; o.exText2 = ex.text; const target = s.upgradeOptions[1]?.id; s.chooseUpgrade(1); const a = s.gauntletFrom0;
      o.target = target; o.excluded = a.excluded; o.excludes = a.excludes; o.modeAfter = s.mode; o.stillShown = s.upgradeOptions.some(x => x.id === target); o.n = s.upgradeOptions.length;
      let seen = 0; for (let i = 0; i < 40; i++) if (s.upgradeChoices().some(x => x.id === target)) seen++; o.seen = seen; ex.emit('pointerdown'); o.exAgain = s.gauntletFrom0.excluding;
      s.chooseUpgrade(0); s.legion.food = 0; return o; });
    ck('换一批：每局 2 次免费（按钮写「免费 ×N」），用完后 40 钱币起、每次 +30（钱不够按不动）', rx.mode === 'levelup' && /免费 ×2/.test(rx.rr0) && rx.f0.free === 2 && rx.f1.free === 1 && rx.ids1.join() !== rx.ids0.join() && rx.f2.free === 0 && rx.f2.cost === 40 && /40 钱币/.test(rx.rr2) && !rx.rr2On && rx.f2b.paid === 0 && rx.food === 460 && rx.f3.paid === 1 && rx.f3.cost === 70, rx);
    ck('排除：每局 1 次（按钮在「换一批」正下方，不压面板标题）——点「排除一张」再点一张卡，那张换掉、本局不再出现（抽 40 次都不出）；用完按钮不再进排除', rx.exVisible && /排除一张/.test(rx.exText) && !rx.exHitsTitle && rx.excluding && rx.excluded.includes(rx.target) && rx.excludes === 0 && rx.modeAfter === 'levelup' && !rx.stillShown && rx.n === 3 && rx.seen === 0 && !rx.exAgain, rx);
    // 局内 build：三选一三类各一（同类重了换成将星 / 兵装）、卡面标稀有度；将星卡开关关着也生效、主星最多 2 颗
    const cb = await ev(async () => { const s = window.__S, C = await import('/src/data/gauntletCards.ts'), SM = await import('/src/data/starMap.ts'); let dup = 0, stars = 0;
      for (let i = 0; i < 40; i++) { const o = s.upgradeChoices(), cs = o.map(x => C.cardCategory(x.id)); if (new Set(cs).size < cs.length) dup++; if (cs.includes('star')) stars++; }
      s.pendingLevels = Math.max(1, s.pendingLevels); s.forcePickNow = true; if (s.mode !== 'levelup') s.openUpgrade(); await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < 30 && !s.upgradeOptions.some(o => o.id.startsWith('gauntlet_star_')); i++) { s.upgradeOptions = s.upgradeChoices(); s.renderCards(); }
      const marks = s.upgradeOptions.map((o, i) => { const t = s.levelPanel.list.flatMap(c => c.list ?? []).find(x => x.name === 'gauntlet-rarity-' + i); return { id: o.id, r: s.rarityOf(o), label: t?.visible ? t.text : null }; });
      await new Promise(r => setTimeout(r, 500)); return { dup, stars, marks, starMap: SM.starMapOn() }; });
    await p.screenshot({ path: OUT + '/gauntlet-15-cards-rarity.png' }); /* 卡面：稀有度 + 将星卡 */
    const sc = await ev(() => { const s = window.__S, g = s.player.growth, hp0 = s.player.maxHp, k = g.stars.length; s.lightCardStar('strength.NR1'); const hp1 = s.player.maxHp; s.lightCardStar('strength.K'); s.lightCardStar('agility.K');
      const keysLeft = s.extraCards().filter(x => x.option.id.startsWith('gauntlet_star_') && x.rarity === 'legend').length, r = { hp0, hp1, on: g.starOn('strength.NR1'), key: g.keyOn('strength.K'), keysLeft, attrs: Object.values(g.attributes).reduce((n, v) => n + v, 0) };
      g.stars = g.stars.slice(0, k); s.player.heal(s.player.maxHp); if (s.mode === 'levelup') s.chooseUpgrade(0); return r; }); /* 用完放回，不影响后面 */
    ck('三选一三类各一（抽 40 次没有同类两张；常出将星卡）；卡面右上角标稀有度（普通 / 精良 / 稀有 / 传说）', cb.dup === 0 && cb.stars >= 8 && cb.marks.length === 3 && cb.marks.every(m => m.label === { common: '普通', fine: '精良', rare: '稀有', legend: '传说' }[m.r]) && cb.marks.some(m => m.id.startsWith('gauntlet_star_')), cb);
    ck('将星卡：星图开关关着也生效（铁骨生命上限涨）、主星生效且拿满 2 颗后不再出；四维点数不变', !cb.starMap && sc.hp1 > sc.hp0 && sc.on && sc.key && sc.keysLeft === 0 && sc.attrs === 0, sc);
    // 兵装 / 信物 / 坐骑卡（局内有效、不进行囊）：传说兵装 + 稀有信物 + 传说坐骑，拿了穿上 / 戴上 / 骑上；三选一里四类专有卡都会出
    const kit = await ev(async () => { const s = window.__S, C = await import('/src/data/gauntletCards.ts'), bag0 = localStorage.getItem('im_items_v2'), kinds = new Set(); s.gWave = 8;
      for (let i = 0; i < 80; i++) for (const o of s.upgradeChoices()) { const m = /^gauntlet_(star|gear|charm|horse)_/.exec(o.id); if (m) kinds.add(m[1]); }
      const hp0 = s.player.maxHp, gc = s.gearCard('legend'), cc = s.charmCard('rare'), hc = s.horseCard('legend'); gc?.apply(); cc?.apply(); hc?.apply(); s.gWave = 1;
      const k = s.gauntletKit, r = { kinds: [...kinds].sort(), hp0, hp1: s.player.maxHp, kit: k, gearR: gc && s.rarityOf(gc), icons: [gc?.icon, cc?.icon, hc?.icon], bagSame: localStorage.getItem('im_items_v2') === bag0 };
      s.gGear = {}; s.gCharms = []; s.gHorse = undefined; s.refreshGear(); s.equipMount(undefined); r.after = s.gauntletKit; return r; }); /* 用完卸下，不影响后面 */
    ck('兵装 / 信物 / 坐骑卡：三选一里将星 / 兵装 / 信物 / 坐骑四类都会出；拿了就穿上（传说兵装带专属特效）、戴上（机制信物进宝物）、骑上（赤兔 / 绝影 / 的卢）；局内有效、不进行囊',
      kit.kinds.join() === 'charm,gear,horse,star' && Object.values(kit.kit.gear).some(v => /orange$/.test(v)) && kit.kit.charms.length === 1 && !!kit.kit.horse && kit.kit.mounted && kit.kit.specials.length >= 1 && kit.gearR === 'legend' && kit.icons.every(Boolean) && kit.bagSame && !kit.after.mounted && kit.after.charms.length === 0, kit);
    const troopsAt = {}; troopsAt[1] = (await ev(() => window.__S.gauntletFrom0.troops));
    /** 割草画面：场上杂兵用的图（第 1 / 5 / 10 阵对比兵种）。 */
    const onScreen = () => ev(() => { const s = window.__S, cam = s.cameras.main.worldView, n = {}; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && cam.contains(e.x, e.y)) { const k = e.def.walkVisual?.texture ?? e.def.texture; n[k] = (n[k] ?? 0) + 1; } return n; }); /* 按兵种定义的图（精灵上是渲染层加了前缀的派生图 iffA_…） */
    for (let i = 0; i < 9; i++) { await wait(2000); await unblock(); } /* 割草十几秒：杂兵围上来再拍 */
    const trk = () => ev(() => { const t = window.__S.gauntletTrack?.stats; return t ? { pos: +t.pos.toFixed(4), x: +t.markerX.toFixed(1), nodeX: t.nodeX.map(v => +v.toFixed(1)), states: [...t.states], caption: t.caption, seal: window.__S.gauntletTrack.root.list.some(n => n.list?.some?.(o => o.name === 'gauntlet-node-seal')) } : null; });
    const mow = await ev(() => { const s = window.__S; return { enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, spawned: s.gStats.spawned, waveLine: s.hudTexts.wave.text, chapterLine: s.hudTexts.chapter.text }; });
    const tr1 = await trk(); await wait(1500); const tr2 = await trk();
    await p.screenshot({ path: OUT + '/gauntlet-1-mow.png' }); troopsAt[1].screen = await onScreen();
    ck('割草：杂兵一波波刷出来；左上角不再写「第 N/10 阵」、计时器下不再写关名（看顶部进度条）', mow.enemies > 5 && mow.waveLine === '' && mow.chapterLine === '', mow);
    ck('十阵进度条 · 割草：10 个节点都是暗的「？」，标从起点往第一个节点匀速走（随时间前进、还没到节点），小字「第 1/10 阵 · 距名将登场 mm:ss」', !!tr1 && tr1.nodeX.length === 10 && tr1.states.every(s => s === 'dark') && tr2.x > tr1.x && tr2.pos > tr1.pos && tr2.pos < .1 && tr2.x < tr2.nodeX[0] && /^第 1\/10 阵 · 距名将登场 \d\d:\d\d$/.test(tr2.caption), { tr1: tr1 && { pos: tr1.pos, x: tr1.x }, tr2 });
    /** 让这一阵的名将登场（割草时间拨到头），返回名将信息。 */
    const bossUp = async () => { await ev(() => { const s = window.__S; if (s.gPhase === 'mow') s.gAt = s.elapsed - 70; }); const ok = await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return !!s.boss?.active && s.gPhase === 'boss'; }, 8000); await unblock(); /* 升级三选一会暂停战斗：等的时候顺手选掉 */
      return { ok, ...(await ev(() => { const s = window.__S, bz = s.boss; return { name: s.gCur?.name, id: s.gCur?.id, hp: bz?.maxHp, tex: bz?.sprite.texture.key, ctrl: !!s.gauntletCtrl || !!s.lubu || !!s.zhangjiao || !!s.huaxiong || !!s.xurong, stall: s.bossStallCfg.quotaSec, guards: s.enemies.filter(e => e.active && (e.kind === 'elite' || e.kind === 'shield') && bz && Math.hypot(e.x - bz.x, e.y - bz.y) < 160).length, hud: s.gauntletTrack?.stats.caption ?? '' }; })) }; };
    const kill = () => ev(() => { const s = window.__S; for (let k = 0; k < 4 && s.gPhase === 'boss' && s.boss?.active; k++) { s.boss.hp = 0; s.killEnemy(s.boss); } return s.gPhase; }); /* 孟获三擒：倒下原地再起两次，连斩到阵过为止 */
    const lootOpen = () => until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode === 'bossloot'; }, 8000); /* 从 0 开局升级多：斩将那几秒常弹升级三选一，等的时候顺手选掉 */
    const b1 = await bossUp();
    { const top = await ev(() => { const s = window.__S, vis = n => s.children.list.filter(o => o.name === n && o.visible && o.alpha > .05).length; return { notices: vis('combat-notice'), announce: vis('boss-announce'), timer: s.hudTexts.timer.visible, caption: s.gauntletTrack.root.getByName('gauntlet-track-caption').visible }; });
      ck('名将登场：顶部只留水墨横幅（称号 + 名字）——没有别的战场横幅，计时与进度条小字先藏', top.announce === 1 && top.notices === 0 && !top.timer && !top.caption, top); }
    await wait(3000); await unblock(); await wait(300); await p.screenshot({ path: OUT + '/gauntlet-2-boss.png' });
    const tr3 = await trk(), tr3b = await ev(() => { const t = window.__S.gauntletTrack; const n = t.root.getByName('gauntlet-node-1'); return { nodeImg: n?.list?.some(o => o.type === 'Image' && String(o.texture?.key).startsWith('gauntlet_head_')), breathe: window.__S.tweens.getTweensOf(t.root.getByName('gauntlet-marker')).length > 0 }; });
    ck('十阵进度条 · 名将登场：标骑在线上停在第 1 个节点前（呼吸式放大、不压头像），节点换成名将小头像，小字写名将名字', tr3.x < tr3.nodeX[0] && tr3.nodeX[0] - tr3.x < 45 && tr3.states[0] === 'up' && tr3b.nodeImg && tr3b.breathe && tr3.caption.includes(b1.name), { x: tr3.x, node: tr3.nodeX[0], states: tr3.states.slice(0, 2), caption: tr3.caption, ...tr3b });
    { const lay = await ev(() => { const s = window.__S, find = (list, name) => { for (const o of list) { if (o.name === name) return o; if (o.list) { const f = find(o.list, name); if (f) return f; } } return null; }, R = o => { if (!o || !o.visible) return null; const b = o.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) }; };
        const tr = s.gauntletTrack.root, kids = tr.list.filter(o => o.visible && (o.name?.startsWith('gauntlet-node-') || o.name === 'gauntlet-marker' || o.name === 'gauntlet-track-caption')), box = kids.map(R).filter(Boolean).reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) }));
        return { track: box, timer: R(s.hudTexts.timer), chapter: R(s.hudTexts.chapter), scroll: R(find(s.children.list, 'battle-map-scroll')), pause: R(find(s.children.list, 'hud-pause')), W: s.scale.width }; });
      const hit = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
      ck('十阵进度条不压顶部的计时器、关名、舆图卷轴、设置按钮（1280×720）', !hit(lay.track, lay.timer) && !hit(lay.track, lay.chapter) && !hit(lay.track, lay.scroll) && !hit(lay.track, lay.pause), lay); }
    ck('名将登场：带亲兵（精锐 / 刀盾围在身边），有出招控制器，首领防拖关掉，顶上写名将名', b1.ok && b1.ctrl && b1.guards >= 2 && b1.stall >= 1e9 && b1.hud.includes(b1.name), b1);
    const ph = await kill(); const opened = await lootOpen(); const tr4 = await trk();
    ck('十阵进度条 · 斩将：第 1 个节点变成已斩（盖朱印），标还停在节点前', tr4.states[0] === 'killed' && tr4.seal && tr4.x < tr4.nodeX[0] && tr4.nodeX[0] - tr4.x < 45, { states: tr4.states.slice(0, 2), seal: tr4.seal, caption: tr4.caption });
    const loot = await ev(() => { const s = window.__S; return { phase: s.gPhase, kills: s.gKills.length, opts: s.upgradeOptions.map(o => o.id), r3: s.upgradeOptions[2] ? s.rarityOf(s.upgradeOptions[2]) : null, left: s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && e.sprite.alpha > .9).length, cleared: s.gStats.cleared }; });
    ck('斩将：清场（杂兵退散）→ 战利品三选一（收为副将 / 取其辎重 / 保底一张稀有以上的将星 · 兵装 · 信物 · 坐骑卡）', ph === 'clear' && opened && loot.kills === 1 && loot.opts.length === 3 && loot.opts[0] === 'gauntlet_follow' && loot.opts[1] === 'gauntlet_spoils' && /^gauntlet_(star|gear|charm|horse)_/.test(loot.opts[2]) && (loot.r3 === 'rare' || loot.r3 === 'legend') && loot.cleared > 0, loot);
    await ev(() => window.__S.chooseUpgrade(0)); await wait(400);
    const fol = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { n: s.gauntletFollowers.length, name: f?.label.text, tex: f?.sprite.texture.key, look: f?.look?.tex, mode: s.mode }; });
    ck('收为副将：他在场（名牌「副将 · 名字」、用他自己的首领图）', fol.n === 1 && fol.name === '副将 · ' + b1.name && fol.tex === fol.look && (fol.mode === 'none' || fol.mode === 'levelup'), fol); /* 选完战利品可能接着弹攒着的升级三选一 */
    // 花钱币招兵（钱币小出口）：清场时屏幕下方出「招兵」按钮；点一次 3 名、价格随阵数；兵种 / 阶随阵数（第 7 阵起有轻骑 / 精锐戟兵、3 阶）
    { await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode === 'none' && s.gPhase === 'clear'; }, 6000); await wait(200);
      const rc = await ev(() => { const s = window.__S, b = s.children.getByName('gauntlet-recruit'), n0 = s.legion.count; s.legion.food = 500; s.update(s.time.now, 16); const vis = !!b?.visible, text = b?.text;
        b?.emit('pointerdown'); const n1 = s.legion.count, food1 = s.legion.food, kinds1 = s.legion.units.filter(u => u.active).map(u => u.kind);
        const w0 = s.gWave; s.gWave = 7; s.recruitTroops(); const k7 = s.legion.units.filter(u => u.active).map(u => u.kind).slice(-3), lv7 = s.legion.levels[k7[0]]; s.gWave = w0;
        s.legion.food = 0; s.update(s.time.now, 16); const dim = b?.alpha; return { vis, text, n0, n1, food1, kinds1, k7, lv7, dim, times: s.gRecruits.times }; });
      await p.screenshot({ path: OUT + '/gauntlet-18-recruit.png' });
      ck('花钱币招兵：斩将后清场时屏幕下方出「招兵」按钮（写兵种、阶、价格）；点一次招 3 名、扣 70 钱币（第 1 阵：刀盾 / 长枪）；第 7 阵起出轻骑 / 精锐戟兵等、3 阶；钱不够按钮变灰',
        rc.vis && /招兵 · 3 名 · 70 钱币/.test(rc.text) && rc.n1 === rc.n0 + 3 && rc.food1 === 430 && rc.kinds1.every(k => k === 'swordsman' || k === 'spearman') && rc.k7.length === 3 && ['spearman', 'archer', 'guardian', 'rider', 'halberdier'].includes(rc.k7[0]) && rc.lv7 === 3 && rc.dim < 1 && rc.times === 2, rc); }
    await ev(() => { const s = window.__S; s.gAt = s.elapsed - 10; }); await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.gPhase === 'mow' && s.gWave === 2; }, 6000); await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; if (f) for (let i = 0; i < 3; i++) s.spawnEnemy('elite', f.x + 26 + i * 12, f.y + 8, undefined, true); }); /* 精锐贴着副将刷（杂兵从屏边走过来、又先被主将砍光，副将摸不到） */
    for (let i = 0; i < 10 && !(await ev(() => (window.__S.gauntletFollowers[0]?.f.dealt ?? 0) > 0)); i++) { await wait(600); await unblock(); }
    const atk = await ev(() => { const s = window.__S, f = s.gauntletFollowers[0]?.f; return { wave: s.gWave, dealt: Math.round(f?.dealt ?? 0), hits: f?.hits ?? 0, inf: s.chapter.enemies.infantry.hp, arc: s.gauntletFrom0.troops.arc }; });
    ck('下一阵：第 2 阵割草、换第二章西凉兵且步卒更厚；副将会攻击（造成伤害）', atk.wave === 2 && atk.arc === 'hulao' && atk.inf > troopsAt[1].inf && atk.dealt > 0, atk);
    { const r = await ev(() => { const s = window.__S, pl = s.player, es = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { hold: s.victoryHold, guard: !!pl.victoryGuard, killed: s.bossKilled, rout: es.filter(e => e.routUntil > s.combatNow).length, toward: es.filter(e => (pl.x - e.x) * e.moveVx + (pl.y - e.y) * e.moveVy > 0).length, n: es.length }; });
      ck('下一阵割草：斩将后的收尾保护（主将无敌、全场杂兵溃退）只在清场那几秒——第 2 阵起收尾保护关掉、主将不无敌（个别被主将招式吓退的不算）', !r.hold && !r.guard && !r.killed && r.n > 3, r); }
    { const t5 = await trk(); ck('十阵进度条 · 下一阵：标从第 1 个节点继续往第 2 个节点走，第 1 个节点留着已斩印，第 2 个还是暗的', t5.pos > .1 && t5.pos < .2 && t5.x > t5.nodeX[0] && t5.x < t5.nodeX[1] && t5.states[0] === 'killed' && t5.states[1] === 'dark' && t5.caption.startsWith('第 2/10 阵 · 距名将登场'), { pos: t5.pos, caption: t5.caption, states: t5.states.slice(0, 3) }); }
    // 一路打到第十阵（战利品选辎重，第 2～3 阵再收两位副将凑满三位）
    let lastHp = b1.hp, okRun = true, qiyu3 = null; const names = [b1.name];
    for (let w = 2; w <= 10; w++) {
      if (w === 5 || w === 10) { for (let i = 0; i < 5; i++) { await wait(1200); await unblock(); } troopsAt[w] = { ...(await ev(() => window.__S.gauntletFrom0.troops)), screen: await onScreen() }; await p.screenshot({ path: OUT + `/gauntlet-${w === 5 ? 13 : 14}-wave${w}-mow.png` }); }
      const bw = await bossUp(); if (!bw.ok) { okRun = false; console.log('  阵 ' + w + ' 名将没出来', bw); break; } names.push(bw.name);
      await kill(); if (!(await lootOpen())) { okRun = false; console.log('  阵 ' + w + ' 战利品没弹'); break; }
      await ev(k => window.__S.chooseUpgrade(k), w <= 3 ? 0 : 1); await wait(300);
      if (w === 3) { const ok3 = await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode === 'bossloot' && /^奇遇/.test(s.levelPanel.getByName('upgrade-title')?.text ?? ''); }, 6000); await wait(700); await p.screenshot({ path: OUT + '/gauntlet-17-qiyu.png' });
        qiyu3 = { open: ok3, ...(await ev(() => { const s = window.__S, ids = s.upgradeOptions.map(o => o.id), k = Math.max(0, ids.findIndex(id => id.startsWith('gauntlet_formation_'))); const r = { title: s.levelPanel.getByName('upgrade-title')?.text, ids, rar: s.upgradeOptions.map(o => s.rarityOf(o)), pick: ids[k] }; s.chooseUpgrade(k); return { ...r, fm: s.gauntletFormations }; })) }; }
      if (w < 10) { await ev(() => { const s = window.__S; s.gAt = s.elapsed - 10; }); if (!(await until(wv => { const s = window.__S; if (s.mode === 'levelup' || (s.mode === 'bossloot' && /^奇遇/.test(s.levelPanel.getByName('upgrade-title')?.text ?? ''))) s.chooseUpgrade(0); return s.gWave === wv && s.gPhase === 'mow'; }, 6000, w + 1))) { okRun = false; break; } }
    }
    ck('一路打到第十阵：每阵一位名将（前后按章递进），副将凑满 3 位', okRun && names.length === 10 && (await ev(() => window.__S.gauntletFollowers.length)) === 3, names);
    { const qw = await ev(() => [...window.__S.gQiyuWaves]), big = id => /^gauntlet_(star_.*\.K|horse_|formation_|qiyu_weapon|gear_)/.test(id);
      ck('奇遇：第 3 / 6 / 9 阵斩将后（战利品之后）额外一次三选一，只出大件（主星 / 传说坐骑 / 军阵 / 本命连升两级 / 传说兵装），稀有以上；拿军阵进阵位', qw.join() === '3,6,9' && !!qiyu3?.open && qiyu3.ids.length === 3 && qiyu3.ids.every(big) && qiyu3.rar.every(r => r === 'rare' || r === 'legend') && (!qiyu3.pick.startsWith('gauntlet_formation_') || qiyu3.fm.loadout[0] === qiyu3.pick.replace('gauntlet_formation_', '')), { qw, qiyu3 }); }
    { const T = [1, 5, 10].map(w => troopsAt[w]), inf = T.map(t => t?.tex.infantry), top = t => Object.entries(t?.screen ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      const texOk = await ev(keys => keys.every(k => window.__S.textures.exists(k)), [...new Set(T.flatMap(t => Object.values(t?.tex ?? {})))]);
      ck('每阵兵种（截图第 1 / 5 / 10 阵割草）：黄巾 → 曹军 → 魏军，步卒图各不相同、图都在；第 5 / 10 阵屏幕上最多的兵就是本阵的兵；步卒一阵比一阵厚', T.every(Boolean) && T[0].arc === 'huangjin' && T[1].arc === 'chibi' && T[2].arc === 'beifa' && new Set(inf).size === 3 && texOk
        && [0, 1, 2].every(i => Object.values(T[i].tex).includes(top(T[i]))) && T[0].inf < T[1].inf && T[1].inf < T[2].inf, T.map(t => t && { arc: t.arc, inf: t.inf, tex: t.tex.infantry, top: top(t), screen: t.screen }).concat([{ texOk }])); }
    // 三位副将 + 名将 + 割草同屏量帧率（拨回一阵割草：先刷满杂兵，再叫名将）
    const fps = await ev(async () => { const s = window.__S; for (let i = 0; i < 120; i++) s.spawnAroundPlayer(i % 3 ? 'infantry' : 'shield', true); s.gAt = s.elapsed - 10; const t0 = performance.now(); let n = 0, min = 999; await new Promise(r => { const f = () => { n++; min = Math.min(min, window.__game.loop.actualFps); if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return { avg: Math.round(n / 3), min: Math.round(min), enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, followers: s.gauntletFollowers.length }; });
    console.log('  帧率（无头浏览器，三位副将 + 杂兵）：', JSON.stringify(fps));
    // 第十阵斩完 → 通关抉择 → 收兵结算
    await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return s.gPhase === 'choice' && s.mode === 'bossloot'; }, 16000);
    const choice = await ev(() => ({ phase: window.__S.gPhase, opts: window.__S.upgradeOptions.map(o => o.id), cleared: window.__S.gCleared }));
    ck('第十阵斩完：十阵通关，抉择「继续 · 无尽 / 收兵 · 结算」', choice.cleared && choice.opts.join() === 'gauntlet_endless,gauntlet_settle', choice);
    // 结算写回什么（统筹 B：局内经验 / 等级不写回战役存档，奖励写回）：开发存档下结算本来不入库，这里把「测试战斗」判定关掉，看真结算写了什么
    const save = () => ev(() => { const j = k => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } }; const h = j('im_heroes_v1')?.heroes?.zhaoyun; return { hero: h ? { level: h.level, xp: h.xp } : null, provisions: j('im_world_v1')?.provisions ?? 0, scrolls: j('im_mastery_v1')?.scrolls ?? 0 }; });
    const sv0 = await save(), lv10 = await ev(() => { const s = window.__S; s.debugRun = () => false; return s.player.level; });
    await ev(() => window.__S.chooseUpgrade(1)); const over = await until(() => window.__S.over && window.__S.mode === 'result', 6000); await wait(900);
    { const sv1 = await save(); ck('结算写回：钱币、武学残卷照给（入存档）；局内升到的等级 / 经验不写回武将存档（赵云仍是 30 级）', sv1.provisions > sv0.provisions && sv1.scrolls > sv0.scrolls && sv1.hero?.level === 30 && sv1.hero?.xp === 100 && sv0.hero?.level === 30 && lv10 >= 1, { before: sv0, after: sv1, runLevel: lv10 }); await ev(() => { delete window.__S.debugRun; }); }
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
          await ev(() => { const s = window.__S, E = s.gEscort; if (E) s.hitEnemy(E.e, E.e.hp, s.combatNow, 'melee', false, false); }); await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return !s.gauntletExtras.escort; }, 5000); /* 升级弹窗会暂停淡出：等的时候顺手选掉 */
          const after = await ev(() => window.__S.gauntletExtras.escort);
          return { ok: !!before && before.active && before.name === (id === 'dongzhuo' ? '吕布' : '黄忠') && (!after || after.leaving), escort: before?.name, after }; }
        if (id === 'yuanshu') { const o = await ev(() => window.__S.gauntletCtrl?.opts); return { ok: !!o?.endlessHoney, opts: o }; }
        if (id === 'xiahouyuan' || id === 'caocao') { await ev(() => { window.__S.gHillAt = window.__S.combatNow; }); await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return !!s.gauntletExtras.hill?.up; }, 8000); /* 从 0 开局升级多：升级三选一暂停战斗，按战斗时钟等高地立起 */
          const h = (await ev(() => window.__S.gauntletExtras)).hill; if (h) await ev(h => { const s = window.__S; s.player.sprite.x = h.x; s.player.sprite.y = h.y; }, h); await wait(150);
          const h2 = (await ev(() => window.__S.gauntletExtras)).hill; return { ok: !!h && h.up && !!h2?.playerIn, hill: h2 }; }
        if (id === 'luxun') { await ev(() => { window.__S.gBandAt = window.__S.combatNow; }); await wait(1100); await p.screenshot({ path: OUT + '/gauntlet-10-luxun-fireband.png' }); await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); const b = s.gauntletExtras.band; return b.cells > 20 && b.pending === 0; }, 9000);
          const b = (await ev(() => window.__S.gauntletExtras)).band; return { ok: b.bands >= 1 && b.cells > 20, band: b }; }
        if (id === 'simayi') { const c = await ev(() => window.__S.gauntletCtrl?.constructor?.name); return { ok: c === 'SimayiBoss' && x.forts === 4, ctrl: c, forts: x.forts }; }
        if (id === 'haozhao') { const fired = await until(() => { const s = window.__S; if (s.mode === 'levelup') s.chooseUpgrade(0); return (s.gauntletExtras.strikes?.fired ?? 0) > 0; }, 12000); /* 升级弹窗暂停战斗：等的时候顺手选掉 */ await p.screenshot({ path: OUT + '/gauntlet-11-haozhao-towers.png' });
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
        const e = await ev(() => { const t = window.__S.gauntletTrack.stats; return { cycle: t.cycle, states: [...t.states], pos: t.pos, caption: t.caption, gate: !!window.__S.gauntletTrack.root.getByName('gauntlet-node-10').list.find(o => o.type === 'Text' && o.style?.fontSize === '16px') }; });
        ck('十阵进度条 · 无尽：第 11 阵起换一轮（节点全回到暗的、标回到起点，守关节点不再放大），小字「无尽 · 第 11 阵」', e.cycle === 1 && e.states.every(x => x === 'dark') && e.pos < .1 && !e.gate && e.caption.startsWith('无尽 · 第 11 阵'), e); }
      const fr = rows.find(r => r.want === FOLLOW)?.follower;
      ck('新名将收为副将：黄忠在场（名牌「副将 · 黄忠」、用他自己的首领图）', !!fr && fr.name === '副将 · 黄忠' && fr.look === fr.tex && fr.boss === FOLLOW, fr); }
    // 主菜单入口（统筹 11-21：用户在主菜单找不到名将连战）：底部文字按钮一行最前面；点了用当前武将直接开打；结算「返回」回主菜单
    { await ev(() => { const s = window.__game.scene.getScenes(true).find(x => x.scene.key === 'GauntletGameScene'); (s ?? window.__S).scene.start('MenuScene'); });
      const menu = await until(() => window.__game.scene.isActive('MenuScene') && !!window.__game.scene.getScene('MenuScene').children.getByName('home-settings'), 30000); await wait(1500);
      const m = await ev(() => { const s = window.__game.scene.getScene('MenuScene'), g = s.children.getByName('home-gauntlet');
        const R = n => { const o = s.children.getByName(n); if (!o || !o.visible) return null; const b = o.getBounds(); return { n, x: Math.round(b.x), r: Math.round(b.right), y: Math.round(b.y), b: Math.round(b.bottom), cy: Math.round(b.centerY) }; };
        const row = ['home-gauntlet', 'home-saves', 'home-codex', 'home-review', 'home-settings', 'home-quit'].map(R).filter(Boolean).sort((a, b) => a.x - b.x);
        const st = o => o ? { font: o.style.fontFamily, size: o.style.fontSize, color: o.style.color, ls: o.letterSpacing } : null;
        return { has: !!g, text: g?.text, locked: g?.getData('locked') ?? null, first: row[0]?.n === 'home-gauntlet', overlap: row.some((a, i) => row.some((b, j) => i < j && a.x < b.r && b.x < a.r)), oneLine: new Set(row.map(o => o.cy)).size === 1, style: st(g), review: st(s.children.getByName('home-review')), n: row.length, row: row.map(o => o.n + ':' + o.x + '-' + o.r) }; });
      await p.screenshot({ path: OUT + '/gauntlet-12-menu.png' });
      const capsBack = await ev(() => window.__game.scene.getScene('GauntletGameScene').gauntletCaps);
      ck('离开名将连战：卡池全开改的全局开关放回（玩法按进度、战法精研 / 战法格 / 精熟 / 专职上限回到进来前）', capsBack.mech === false && capsBack.rank === 3 && capsBack.slot === 6 && capsBack.extra === 0 && capsBack.over === 0, capsBack);
      ck('主菜单入口：底部文字按钮一行最前面是「名将连战」（样式同「战役回顾」、一行不挤不换行），开发存档下可点', menu && m.has && m.text === '名将连战' && m.locked === false && m.first && !m.overlap && m.oneLine && JSON.stringify(m.style) === JSON.stringify(m.review), m);
      await ev(() => window.__game.scene.getScene('MenuScene').children.getByName('home-gauntlet').emit('pointerdown'));
      const inG = await until(() => { const s = window.__game.scene.getScene('GauntletGameScene'); return window.__game.scene.isActive('GauntletGameScene') && !!s?.player?.alive && s.elapsed > .3; }, 30000);
      const g0 = await ev(() => { const s = window.__game.scene.getScene('GauntletGameScene'), menuHero = window.__game.scene.getScene('MenuScene'); window.__S = s; return { from: s.gFrom, hero: s.runConfig.character }; });
      await ev(() => { const s = window.__S; s.player.damageImmune = false; s.player.hp = 1; s.player.takeDamage(99999, s.combatNow); });
      const over = await until(() => { const s = window.__S; return s.over && s.mode === 'result'; }, 10000); await wait(800);
      const homeText = await ev(() => { const h = window.__S.resultPanel.getByName('result-home'); const t = h?.text ?? null; h?.emit('pointerdown'); return t; });
      const back = await until(() => window.__game.scene.isActive('MenuScene'), 20000);
      ck('从主菜单进名将连战：用当前选中的武将直接开打；阵亡结算「返回主菜单」回到主菜单', inG && g0.from === 'menu' && !!g0.hero && over && homeText === '返回主菜单' && back, { inG, ...g0, over, homeText, back }); }
    ck('帧率：三位副将 + 名将 + 割草同屏（无头浏览器 1280×720）平均 ≥ 30', fps.avg >= 30 && fps.followers === 3, fps);
    ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
  } catch (e) { fail++; console.log('FAIL 异常 · ' + e.message.split('\n')[0]); }
  await b.close();
}
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
