// 第六章剧情（统筹 story-ch06.md，2026-11-18 用户确认）：章头按第五章 nanjun 两种写法；6-1 军情（拈阄）/ 赵范招降旗标 zhaofan / 幕间「赵云辞樊氏」（正史）；
// 6-2 刘度旗标 liudu；6-3 先黄忠后韩玄（按首领取台词）/ 黄忠劝降旗标 spared_huangzhong / 过场「魏延献城」→ 魏延去留抉择（weiyan_trust，只写旗标）→ 章末；
// 魏延主公不出抉择（固定 trusted）；黄忠主公第一阶段换韩玄部将杨龄（不弹招降窗）；羁绊「老当益壮」；闲话条件。电脑布局 1280×720，?story=1。
// 截图 assets/review/story-ch06/。用法：BASE=http://127.0.0.1:5173/ node tools/test-story-ch06.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-ch06';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); });
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info).slice(0, 500)}`); };
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.storyDir, null, { timeout: 90000 });
await p.waitForTimeout(800);
const KEY = 'JingnanGameScene', T = `window.__game.scene.getScene('${KEY}')`;
const jingnan = async (stage, lord = 'zhaoyun', flags = {}) => {
  await p.evaluate(([stage, lord, flags, KEY]) => { localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags })); const g = window.__game; window.__prevT = g.scene.getScene(KEY)?.player;
    g.registry.set('jingnanStage', stage); g.registry.set('runConfig', { ...(g.registry.get('runConfig') ?? {}), character: lord, weapon: undefined, thirdStage: stage }); g.registry.remove('campaignTransfer'); g.registry.remove('jingnanTransfer');
    const cur = g.scene.getScene(KEY); if (cur?.sys.isActive()) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(KEY); } }, [stage, lord, flags, KEY]);
  await p.waitForFunction(([lord, KEY]) => { const s = window.__game.scene.getScene(KEY); return s?.sys.isActive() && s.player && s.player !== window.__prevT && s.runConfig?.character === lord && s.storyDir?.chapterId === 'jingnan'; }, [lord, KEY], { timeout: 90000 });
  await p.waitForTimeout(700);
};
const scroll = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); if (!c) return null; const all = x => x.type === 'Text' ? [x.text] : (x.list ?? []).flatMap(all); return { name: c.name, texts: all(c).filter(Boolean) }; }, T);
const next = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm')?.emit('pointerup'); }, T);
const readAll = async () => { const seen = []; for (let i = 0; i < 80; i++) { const sc = await scroll(); if (!sc) { await p.waitForTimeout(400); if (!await scroll() && await p.evaluate(T0 => eval(T0).mode !== 'story', T)) return seen; continue; } seen.push(sc.texts.join('|')); await next(); await p.waitForTimeout(120); } return seen; };
const played = () => p.evaluate(T0 => [...eval(T0).storyDir.played], T);
const flags = () => p.evaluate(() => JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {});
const L = async (node, lord, team, fl = {}) => p.evaluate(async ([node, lord, team, fl]) => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags: fl }));
  const n = node.split('/').reduce((o, k) => o?.[k], D.STORY_CHAPTERS.jingnan); return St.resolveLines(n, { lord, team: () => [lord, ...team], recruited: () => false }).map(l => l.text + (l.who ? '@' + l.who : '')); }, [node, lord, team, fl]);
const barks = () => p.evaluate(T0 => [...eval(T0).children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o)), ...(eval(T0).data.get('__storyBarkCardLog')?.splice(0) ?? [])] /* 2026-11-18 夜：有说话人的首领台词改出侧边立绘卡（头顶只冒「！」），卡的台词从日志读 */, T);
/** 首领上场（关掉升级窗）；hit=true 时打到招降线 */
const boss = (hit = true) => p.evaluate(async ([T0, hit]) => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); 
  s.player.damageImmune = true; if (!s.boss?.active) s.spawnBoss(); for (let k = 0; k < 8 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); } await wait(200);
  if (hit) { s.boss.invulnerable = false; s.boss.hp = 2; s.debugCrit = false; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(150); if (s.parley) s.parley.constructor.random = () => 0; /* 用游戏里那份 Parley（热更新后测试 import 的是另一份模块） */ }
  return { name: s.chapter.bossName, panel: !!s.children.getByName('parley-panel'), key: s.parley?.def.key ?? null }; }, [T, hit]);

// 1) 6-1：章头按第五章 nanjun（seized：赵云抢先入江陵、鲁肃「总得给个说法」）→ 军情
await jingnan(1, 'zhaoyun', { nanjun: 'seized' });
const open = await scroll(); await p.screenshot({ path: `${out}/chapter-open-1280x720.png` });
const pages = await readAll(); const p61 = await played();
ck('6-1：章头（nanjun = seized：赵云抢先入江陵、鲁肃「总得给个说法」）→ 军情', open?.name === 'story-jingnan-open' && p61.join() === 'jingnan.open,jingnan-1.brief' && pages.some(t => t.includes('抢先入了江陵')) && pages.some(t => t.includes('总得给个说法')), { open: open?.name, p61 });
const ceded = await L('open', 'zhaoyun', [], { nanjun: 'ceded' }), none = await L('open', 'zhaoyun', []), ssx = await L('open', 'sunshangxiang', []);
ck('章头（ceded / 没做抉择）：「赤壁之后，周瑜得江陵」；孙尚香主公加「等我嫁过去再说」', ceded.some(t => t.startsWith('赤壁之后')) && none.join() === ceded.join() && ssx.some(t => t.includes('嫁过去')), { ceded: ceded.length, ssx: ssx.length });
const lot = await L('stages/1/brief', 'liubei', ['zhangfei', 'zhaoyun']), noZy = await L('stages/1/brief', 'guanyu', []);
ck('6-1 军情：张飞、赵云都在队拈阄定之；赵云不在队时主公「某愿往！」', lot.some(t => t.includes('拈阄')) && noZy.some(t => t === '某愿往！@{lord}') && !noZy.some(t => t.includes('拈阄')), { lot: lot.length, noZy });
// 赵范必降 → zhaofan = joined → 幕间「赵云辞樊氏」
const pz = await boss(); await p.evaluate(T0 => eval(T0).parley.choose('persuade'), T); await p.waitForTimeout(300);
const f61 = await flags();
ck('6-1 赵范「必降」：劝降写旗标 zhaofan = joined', pz.panel && pz.key === 'jingnan-1:zhaofan' && f61.zhaofan === 'joined', { pz, f61 });
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => {}); }, T); await p.waitForTimeout(300);
const fs = await scroll(); await p.screenshot({ path: `${out}/interlude-fanshi-1280x720.png` }); const fsPages = await readAll();
ck('6-1 幕间「赵云辞樊氏」（正史）：「卿兄犹我兄」「天下女不少」', fs?.name === 'story-jingnan-1-fanshi' && fsPages.some(t => t.includes('卿兄犹我兄')) && fsPages.some(t => t.includes('天下女不少')), { fs: fs?.name });
const slainFs = await L('stages/1/after/0', 'zhaoyun', [], { zhaofan: 'slain' });
ck('斩了赵范：樊氏一段不播，只一句「赵云领桂阳太守」', slainFs.length === 1 && slainFs[0].includes('领桂阳太守'), slainFs);

// 2) 6-2：斩杀刘度 → liudu = slain；幕间两种写法
await jingnan(2, 'zhaoyun'); await readAll();
await boss(); await p.evaluate(T0 => eval(T0).parley.choose('execute'), T); await p.waitForTimeout(300);
const f62 = await flags(), b62 = await barks();
ck('6-2 斩杀刘度：旗标 liudu = slain，倒下「我儿……零陵……」', f62.liudu === 'slain' && b62.some(t => t.includes('我儿')), { f62, b62 });
const a62j = await L('stages/2/after/0', 'zhaoyun', [], { liudu: 'joined' }), a62s = await L('stages/2/after/0', 'zhaoyun', [], { liudu: 'slain' });
ck('6-2 幕间：劝降时「刘贤缚邢道荣来献」，斩杀时「刘度死于阵中」', a62j.some(t => t.includes('缚邢道荣')) && a62s.some(t => t.includes('死于阵中')) && !a62s.some(t => t.includes('缚邢道荣')), { a62j: a62j.length, a62s: a62s.length });
// 刘贤 / 邢道荣台词（2026-11-18 补，带对白立绘）
const br62 = await L('stages/2/brief', 'zhaoyun', []), ph62 = await L('stages/2/bossPhase', 'zhaoyun', []), who = (arr, id, kw) => arr.some(t => t.endsWith('@' + id) && (!kw || t.includes(kw)));
ck('6-2：军情邢道荣自称「零陵上将」、刘贤劝守；二阶段刘贤应父亲；幕间劝降时刘贤献邢道荣、邢道荣服了，斩杀时刘贤开城（邢道荣不出声）',
  who(br62, 'xingdaorong', '零陵上将') && who(br62, 'liuxian') && who(ph62, 'liuxian') && who(a62j, 'liuxian', '邢道荣在此') && who(a62j, 'xingdaorong') && who(a62s, 'liuxian', '开城') && !who(a62s, 'xingdaorong') && !who(a62s, 'liuxian', '邢道荣在此'),
  { br62: br62.filter(t => /@(liuxian|xingdaorong)$/.test(t)), ph62, a62j: a62j.filter(t => /@(liuxian|xingdaorong)$/.test(t)) });
// 对白立绘补齐（2026-11-18）：第一、二章 9 人 + 徐庶 / 刘贤 / 邢道荣都有 ink_cast 立绘键
const noFace = await p.evaluate(async () => { const T = await import('/src/data/story/types.ts'); return ['jianyong', 'zhangliang', 'zhangbao', 'zhangjiao', 'huaxiong', 'xurong', 'dongzhuo', 'lubu', 'zhangshiping', 'xushu', 'liuxian', 'xingdaorong'].filter(k => T.STORY_CAST[k]?.portrait !== 'ink_cast_' + k); });
ck('对白立绘：第一、二章 9 人与徐庶 / 刘贤 / 邢道荣都接上 ink_cast 立绘', noFace.length === 0, noFace);

// 3) 6-3（赵云主公）：黄忠登场 → 劝降 spared_huangzhong = true → 韩玄登场「黄忠通敌」→ 韩玄倒下「魏延！你——」
await jingnan(3, 'zhaoyun'); await readAll();
const hz = await boss(false); const bHz = await barks();
ck('6-3 黄忠登场「老将黄汉升在此」（按当前首领取台词）', hz.name === '黄忠' && bHz.some(t => t.includes('黄汉升在此')), { hz, bHz });
await boss(true); await p.evaluate(T0 => eval(T0).parley.choose('persuade'), T);
await p.waitForFunction(T0 => { const s = eval(T0); return s.boss?.active && s.chapter.bossName === '韩玄'; }, T, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(400);
const f63 = await flags(), bHx = await barks();
ck('6-3 黄忠劝降：spared_huangzhong = true；韩玄登场「黄忠通敌，罪当处斩」', f63.spared_huangzhong === true && bHx.some(t => t.includes('黄忠通敌')), { f63, bHx });
const bPhase = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)), deep = x => x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); s.events.emit('boss-phase', { boss: s.boss, phase: 2, name: '韩玄' }); await wait(150); const a = s.children.list.filter(o => o.name === 'story-bark').map(deep); s.boss.invulnerable = false; s.boss.hp = 1; s.debugCrit = false; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(200); return a; }, T);
const bFall = [...bPhase, ...await barks()]; // 台词框只留一句：二阶段与倒下分两次取
ck('6-3 韩玄二阶段「伏兵何在」、倒下「魏延！你——」', bFall.some(t => t.includes('伏兵何在')) && bFall.some(t => t.includes('魏延！你')), bFall);
// 关末：过场「魏延献城」→ 魏延去留抉择（选「留用，但须提防」）→ 章末
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => { window.__fin63 = true; }); }, T); await p.waitForTimeout(400);
const wy = await scroll(); await p.screenshot({ path: `${out}/cutscene-weiyan-1280x720.png` });
const wyPages = []; for (let i = 0; i < 12; i++) { const sc = await scroll(); if (!sc || sc.name !== 'story-jingnan-3-weiyan') break; wyPages.push(sc.texts.join('|')); await next(); await p.waitForTimeout(150); }
const choice = await scroll(); await p.screenshot({ path: `${out}/choice-weiyan-1280x720.png` });
for (let i = 0; i < 6; i++) { const has = await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-jingnan-3-weiyan_trust'); const all = x => [x, ...(x.list ?? []).flatMap(all)]; return !!(c && all(c).find(o => o.name === 'story-jingnan-3-weiyan_trust-choice-box-1')?.visible); }, T); if (has) break; await next(); await p.waitForTimeout(120); }
await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-jingnan-3-weiyan_trust'); const all = x => [x, ...(x.list ?? []).flatMap(all)]; all(c).find(o => o.name === 'story-jingnan-3-weiyan_trust-choice-1')?.emit('pointerup'); }, T);
await p.waitForTimeout(300);
const endPages = await readAll(); const f63b = await flags(), pEnd = await played(), fin = await p.evaluate(() => window.__fin63);
ck('6-3 关末：过场「魏延献城」（黄忠「愿以残年」、诸葛亮「脑后有反骨」）→ 抉择「魏延去留」', wy?.name === 'story-jingnan-3-weiyan' && wyPages.some(t => t.includes('愿以残年')) && wyPages.some(t => t.includes('反骨')) && choice?.name === 'story-jingnan-3-weiyan_trust', { wy: wy?.name, choice: choice?.name });
ck('选「留用，但须提防」→ weiyan_trust = watched（不给数值）→ 章末「刘琦病卒」→ 才结算', f63b.weiyan_trust === 'watched' && endPages.some(t => t.includes('刘琦病卒')) && pEnd.includes('jingnan.close') && fin === true, { f63b, pEnd, fin });
const killedHz = await L('stages/3/after/0', 'zhaoyun', [], { spared_huangzhong: false });
ck('黄忠被斩：献城一段改为「老将黄忠负伤遁去」（11-19 武将解锁：被击杀则负伤遁去，第八章前来投）', killedHz.some(t => t.includes('负伤，引残兵遁去')) && !killedHz.some(t => t.includes('愿以残年')), killedHz.length);

// 4) 魏延主公：献城由主公提首级，不出抉择（weiyan_trust 固定 trusted）
await jingnan(3, 'weiyan'); await readAll();
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => { window.__fin63w = true; }); }, T); await p.waitForTimeout(300);
const wyLord = await readAll(); const fw = await flags(), pw = await played();
ck('魏延主公：「某魏文长，献长沙！」+ 刘备作保；不出抉择，weiyan_trust = trusted', wyLord.some(t => t.includes('某魏文长，献长沙')) && wyLord.some(t => t.includes('有功无罪')) && fw.weiyan_trust === 'trusted' && !pw.includes('jingnan-3.weiyan_trust'), { fw, pw });

// 5) 黄忠主公：军情改「也该择主了」；第一阶段首领换杨龄，不弹招降窗
await jingnan(3, 'huangzhong'); const hzPages = await readAll();
const yl = await boss(false); const bYl = await barks(); await p.screenshot({ path: `${out}/yangling-1280x720.png` });
const ylHit = await boss(true);
ck('黄忠主公：军情「也该择主了」；6-3 第一阶段首领「杨龄」（台词「你敢反？」），不弹招降窗', hzPages.some(t => t.includes('也该择主了')) && yl.name === '杨龄' && bYl.some(t => t.includes('杨龄')) && !ylHit.panel && ylHit.key === null, { yl, ylHit, bYl });

// 6) 羁绊「老当益壮」；闲话条件
const bond = await p.evaluate(async T0 => { const St = await import('/src/systems/Story.ts'), s = eval(T0);
  const d = new St.StoryDirector({ scene: s, chapterId: 'jingnan', stage: 1, ctx: { lord: 'zhaoyun', team: () => ['zhaoyun', 'huangzhong'], recruited: () => false }, pause() {}, resume() {} });
  return { zy: d.bondCritBonus('zhaoyun'), hz: d.bondCritBonus('huangzhong') }; }, T);
ck('羁绊「老当益壮」：黄忠 + 赵云同队暴击 +3%', bond.zy === .03 && bond.hz === .03, bond);
const w4 = await L('camp/3', 'liubei', ['weiyan'], { weiyan_trust: 'watched' }), w4b = await L('camp/3', 'liubei', ['weiyan'], { weiyan_trust: 'trusted' }), w5 = await L('camp/4', 'zhaoyun', ['weiyan'], { weiyan_trust: 'trusted' });
ck('闲话：weiyan_trust = watched 时「像看一头狼」，trusted 时「这条命就是皇叔的」', w4.length === 2 && w4b.length === 0 && w5.length === 2, { w4: w4.length, w4b: w4b.length, w5: w5.length });

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
