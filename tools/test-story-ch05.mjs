// 第五章剧情（统筹 story-ch05.md，2026-11-18 用户确认）：章头「三顾茅庐」→ 5-1 军情 / 曹纯 / 长坂桥幕间（张飞正史原句）/ 七进七出（击杀虎豹骑 77）；
// 5-2 过场「借东风」→ 军情 → 蔡瑁招降（旗标 caimao、魏延在队 / 刘备主公专属台词）→ 过场「华容道」；5-3 军情 → 江陵抉择（nanjun）→ 章末两种写法与插画；
// 羁绊「卧龙凤雏」冷却 -5%；营中闲话条件；主公改写抽查。电脑布局 1280×720，?story=1 强制播剧情。截图 assets/review/story-ch05/。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-story-ch05.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-ch05';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); });
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info).slice(0, 500)}`); };
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.storyDir, null, { timeout: 90000 });
await p.waitForTimeout(800);
const KEY = 'ChibiGameScene', T = `window.__game.scene.getScene('${KEY}')`;
/** 开第五章第 stage 关；flags 预置旗标；follow 随行武将（直接塞进 followers 不现实，团队判定改用 storyCtx 覆盖） */
const chibi = async (stage, lord = 'zhaoyun', flags = {}) => {
  await p.evaluate(([stage, lord, flags, KEY]) => { localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags })); const g = window.__game; window.__prevT = g.scene.getScene(KEY)?.player;
    g.registry.set('chibiStage', stage); g.registry.set('runConfig', { ...(g.registry.get('runConfig') ?? {}), character: lord, weapon: undefined, thirdStage: stage }); g.registry.remove('campaignTransfer'); g.registry.remove('chibiTransfer');
    const cur = g.scene.getScene(KEY); if (cur?.sys.isActive()) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(KEY); } }, [stage, lord, flags, KEY]);
  await p.waitForFunction(([lord, KEY]) => { const s = window.__game.scene.getScene(KEY); return s?.sys.isActive() && s.player && s.player !== window.__prevT && s.runConfig?.character === lord && s.storyDir?.chapterId === 'chibi'; }, [lord, KEY], { timeout: 90000 });
  await p.waitForTimeout(700);
};
const scroll = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); if (!c) return null; const all = x => x.type === 'Text' ? [x.text] : (x.list ?? []).flatMap(all); return { name: c.name, texts: all(c).filter(Boolean) }; }, T);
const next = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm')?.emit('pointerup'); }, T);
const readAll = async () => { const seen = []; for (let i = 0; i < 80; i++) { const sc = await scroll(); if (!sc) { await p.waitForTimeout(400); if (!await scroll() && await p.evaluate(T0 => eval(T0).mode !== 'story', T)) return seen; continue; } seen.push(sc.texts.join('|')); await next(); await p.waitForTimeout(120); } return seen; };
const played = () => p.evaluate(T0 => [...eval(T0).storyDir.played], T);
const flags = () => p.evaluate(() => JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {});
const L = async (node, lord, team, fl = {}) => p.evaluate(async ([node, lord, team, fl]) => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags: fl }));
  const n = node.split('/').reduce((o, k) => o?.[k], D.STORY_CHAPTERS.chibi); return St.resolveLines(n, { lord, team: () => [lord, ...team], recruited: () => false }).map(l => l.text + (l.who ? '@' + l.who : '')); }, [node, lord, team, fl]);
const barks = () => p.evaluate(T0 => [...eval(T0).children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o)), ...(eval(T0).data.get('__storyBarkCardLog')?.splice(0) ?? [])] /* 2026-11-18 夜：有说话人的首领台词改出侧边立绘卡（头顶只冒「！」），卡的台词从日志读 */, T);
const texts = () => p.evaluate(T0 => (function all(xs) { return xs.flatMap(o => o.type === 'Text' ? [o.text] : all(o.list ?? [])); })(eval(T0).children.list), T);
/** 首领上场并打到招降线（弹窗）；random 固定劝降成功 */
const toParley = () => p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); 
  s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 8 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); } await wait(150);
  s.boss.invulnerable = false; s.boss.hp = 2; s.debugCrit = false; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(150); if (s.parley) s.parley.constructor.random = () => 0; /* 用游戏里那份 Parley（热更新后测试 import 的是另一份模块） */ return { panel: !!s.children.getByName('parley-panel'), key: s.parley?.def.key, tier: s.parley?.def.tier }; }, T);

// 1) 5-1：章头「三顾茅庐」→ 军情（赵云主公「小主人和夫人交给云」）
await chibi(1, 'zhaoyun');
const open = await scroll(); await p.screenshot({ path: `${out}/chapter-open-1280x720.png` });
const pages = await readAll(); const p51 = await played();
ck('5-1：章头「三顾茅庐」→ 军情（赵云主公多一句「小主人和夫人交给云」）', open?.name === 'story-chibi-open' && p51.join() === 'chibi.open,chibi-1.brief' && pages.some(t => t.includes('小主人和夫人交给云')) && pages.some(t => t.includes('跨有荆、益')), { open: open?.name, p51 });
const zfOpen = await L('open', 'liubei', ['zhangfei']), hyyOpen = await L('open', 'huangyueying', []), wyBrief = await L('stages/1/brief', 'weiyan', []);
ck('章头：张飞在队「去屋后放一把火」；黄月英主公「你还装睡？」；5-1 魏延主公「襄阳城上开门迎皇叔」', zfOpen.join().includes('放一把火') && hyyOpen.join().includes('你还装睡') && wyBrief.join().includes('襄阳城上开门'), { zf: zfOpen.length, hyy: hyyOpen.length, wy: wyBrief.length });
// 徐庶辞行荐诸葛（2026-11-18 补台词 + 对白立绘）
const xsOpen = await L('open', 'liubei', []);
ck('章头：徐庶辞行，亲口荐「隆中有卧龙」（说话人 xushu）', xsOpen.some(t => t.includes('卧龙') && t.endsWith('@xushu')), xsOpen.filter(t => t.includes('@xushu')));
// 首领登场 / 二阶段
const intro = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 8 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); } await wait(150);
  const deep = x => x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''), grab = () => [...s.children.list.filter(o => o.name === 'story-bark').map(deep), ...(s.data.get('__storyBarkCardLog')?.splice(0) ?? [])]; const a = grab(); // 首领台词出侧边立绘卡，台词从卡的日志读
  s.events.emit('boss-phase', { boss: s.boss, phase: 2, dismount: true, name: '曹纯' }); await wait(150); return [...a, ...grab()]; }, T);
const b51 = intro; // 主将台词框只留一句：登场与二阶段分两次取
ck('5-1 曹纯：登场「一个也不许放过」、坠马二阶段「围起来，困死他」', b51.some(t => t.includes('一个也不许放过')) && b51.some(t => t.includes('困死他')), b51);
// 首次通关后幕间：长坂桥（张飞正史原句）
await p.evaluate(T0 => { const s = eval(T0); s.boss?.deactivate(); s.storyDir.stageEnd(() => { window.__fin51 = true; }); }, T); await p.waitForTimeout(300);
const bridge = await scroll(); await p.screenshot({ path: `${out}/interlude-bridge-1280x720.png` }); const bridgePages = await readAll();
ck('5-1 首次通关后幕间「长坂桥」：赵云献阿斗、刘备掷子、张飞「身是张益德也，可来共决死！」（正史原句）', bridge?.name === 'story-chibi-1-bridge' && bridgePages.some(t => t.includes('身是张益德也，可来共决死')) && !bridgePages.some(t => t.includes('燕人张翼德')), { name: bridge?.name });

// 2) 七进七出：赵云主公击杀虎豹骑 77 骑 → 横幅 + 大字台词 + 旗标；关羽主公（无赵云）不触发
const qj = async () => p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; const out = { at76: null };
  for (let i = 0; i < 77; i++) { const e = s.spawnEnemy('cavalry', s.player.x + 200, s.player.y, 1, true); if (!e) continue; e.hp = 1; s.killEnemy(e); if (i === 75) out.at76 = JSON.parse(localStorage.getItem('im_story_v1')).flags.qijin_qichu ?? null; }
  await wait(250); out.flag = JSON.parse(localStorage.getItem('im_story_v1')).flags.qijin_qichu ?? null; out.kills = s.qijin?.kills; return out; }, T);
await chibi(1, 'zhaoyun'); await readAll();
const q1 = await qj(); const q1b = await barks(), q1t = await texts(); await p.screenshot({ path: `${out}/qijin-1280x720.png` });
ck('七进七出：赵云在队击杀虎豹骑第 77 骑达成（76 骑时未达成）→ 横幅「七进七出」+ 赵云「常山赵子龙在此！」+ 旗标 qijin_qichu', q1.at76 === null && q1.flag === true && q1t.some(t => t.includes('七进七出')) && q1b.some(t => t.includes('常山赵子龙在此')), { q1, q1b });
await chibi(1, 'guanyu'); await readAll();
const q2 = await qj();
ck('七进七出：赵云不在队（关羽主公）击杀 77 骑不触发', q2.flag === null, q2);

// 3) 5-2：过场「借东风」（卷轴）→ 军情；蔡瑁招降成功 → caimao = joined；魏延主公时魏延先问「襄阳城上放箭」
await chibi(2, 'weiyan');
const df = await scroll(); await p.screenshot({ path: `${out}/cutscene-dongfeng-1280x720.png` }); const dfPages = await readAll(); const p52 = await played();
ck('5-2：过场「借东风」（按卷轴：孙权斫案、只欠东风、七星坛、黄盖点火）→ 军情', df?.name === 'story-chibi-2-dongfeng' && p52.join() === 'chibi-2.dongfeng,chibi-2.brief' && dfPages.some(t => t.includes('只欠东风')) && dfPages.some(t => t.includes('与此案同')), { df: df?.name, p52 });
const pl52 = await toParley();
await p.evaluate(T0 => eval(T0).parley.choose('persuade'), T); await p.waitForTimeout(300); const b52a = await barks(); await p.waitForTimeout(1400);
const b52 = [...b52a, ...await barks()], f52 = await flags(); // 台词框只留一句：魏延先问、1.4 秒后蔡瑁答
ck('5-2 蔡瑁「可降」：劝降成功写旗标 caimao = joined；魏延在队先问「襄阳城上放箭」，蔡瑁答「当日各为其主」', pl52.panel && pl52.key === 'chibi-2:caimao' && f52.caimao === 'joined' && b52.some(t => t.includes('襄阳城上放箭')) && b52.some(t => t.includes('各为其主')), { pl52, f52, b52 });
await chibi(2, 'liubei'); await readAll();
await toParley(); await p.evaluate(T0 => eval(T0).parley.choose('persuade'), T); await p.waitForTimeout(300);
const lb52 = await barks();
ck('5-2 刘备主公：蔡瑁归降说「当年檀溪之事，瑁实有罪」', lb52.some(t => t.includes('檀溪')), lb52);
await chibi(2, 'zhaoyun'); await readAll();
await toParley(); await p.evaluate(T0 => eval(T0).parley.choose('execute'), T); await p.waitForTimeout(300);
const f52b = await flags(), ex52 = await barks();
ck('5-2 斩杀蔡瑁：旗标 caimao = slain，倒下「丞相……北军……完了」', f52b.caimao === 'slain' && ex52.some(t => t.includes('北军')), { f52b, ex52 });
// 打完后：过场「华容道」
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => {}); }, T); await p.waitForTimeout(300);
const hr = await scroll(); await p.screenshot({ path: `${out}/cutscene-huarong-1280x720.png` }); const hrPages = await readAll();
ck('5-2 打完：过场「华容道」（卷轴：伏一旅之师、五关斩将、关羽「散开！」）', hr?.name === 'story-chibi-2-huarong' && hrPages.some(t => t.includes('五关斩将')) && hrPages.some(t => t.includes('散开')), { hr: hr?.name });

// 4) 5-3：军情（诸葛亮主公改写）→ 关末江陵抉择：选「趁虚入城」→ nanjun = seized、军粮 +300、章末「已取城了」+ 插画换 seized
const zgBrief = await L('stages/3/brief', 'zhuge', []);
ck('5-3 诸葛亮主公：「八门金锁阵」由主公说，「从生门入」改刘备说', zgBrief.some(t => t.includes('八门金锁阵') && t.endsWith('@{lord}')) && zgBrief.some(t => t.includes('从生门入') && t.endsWith('@liubei')), zgBrief);
await chibi(3, 'zhaoyun');
await readAll();
const grain0 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions);
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => { window.__fin53 = true; }); }, T); await p.waitForTimeout(400);
const ch = await scroll(); await p.screenshot({ path: `${out}/choice-nanjun-1280x720.png` });
const btns = await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-chibi-3-nanjun'); const all = x => [x, ...(x.list ?? []).flatMap(all)]; return c ? all(c).map(o => o.name).filter(n => n?.includes('choice')) : []; }, T);
// 翻到最后一页再点「趁虚入城」（第二个按钮）
for (let i = 0; i < 6; i++) { const has = await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-chibi-3-nanjun'); const all = x => [x, ...(x.list ?? []).flatMap(all)]; const box = c && all(c).find(o => o.name === 'story-chibi-3-nanjun-choice-box-1'); return !!box?.visible; }, T); if (has) break; await next(); await p.waitForTimeout(120); }
await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-chibi-3-nanjun'); const all = x => [x, ...(x.list ?? []).flatMap(all)]; all(c).find(o => o.name === 'story-chibi-3-nanjun-choice-1')?.emit('pointerup'); }, T);
await p.waitForTimeout(300);
const after53 = await readAll(); const f53 = await flags(), pEnd = await played(), fin = await p.evaluate(() => window.__fin53);
const grain1 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions);
const ill = await p.evaluate(async () => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); return St.nodeIllustration(D.STORY_CHAPTERS.chibi.close); });
ck('5-3 江陵抉择：两个按钮，选「趁虚入城」→ nanjun = seized、军粮 +300', ch?.name === 'story-chibi-3-nanjun' && btns.includes('story-chibi-3-nanjun-choice-0') && btns.includes('story-chibi-3-nanjun-choice-1') && f53.nanjun === 'seized' && grain1 - grain0 === 300, { ch: ch?.name, btns, f53, grain: grain1 - grain0 });
ck('5-3 章末（seized）：赵云「已取城了」、周瑜金疮迸裂；插画换 story_jiangling_seized；播完才结算', after53.some(t => t.includes('已取城了')) && after53.some(t => t.includes('金疮迸裂')) && ill === 'story_jiangling_seized' && pEnd.includes('chibi.close') && fin === true, { ill, pEnd, fin, after53 });
const ceded = await L('close', 'zhaoyun', [], { nanjun: 'ceded' }), none = await L('close', 'zhaoyun', []), ssx = await L('close', 'sunshangxiang', [], { nanjun: 'ceded' });
ck('章末（ceded / 没做抉择）：周瑜领南郡、鲁肃「荆州日后还须商议」；孙尚香主公多一句讨荆州的伏笔', ceded.some(t => t.includes('鲁肃') || t.endsWith('@lusu')) && none.join() === ceded.join() && ssx.some(t => t.includes('借给皇叔')), { ceded: ceded.length, ssx: ssx.length });
// 剧情关闭（跳过）时抉择默认史实 ceded
const offRes = await p.evaluate(async () => { localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags: {} })); const BS = await import('/src/systems/BattleSettings.ts'); const prev = localStorage.getItem('im_story'); localStorage.setItem('im_story', 'off');
  return { prev }; });
await chibi(3, 'zhaoyun');
const offFlag = await p.evaluate(async T0 => { const s = eval(T0); let done = false; s.storyDir.stageEnd(() => { done = true; }); await new Promise(r => setTimeout(r, 300)); return { done, flag: JSON.parse(localStorage.getItem('im_story_v1')).flags.nanjun, scroll: !!s.children.list.find(o => o.name?.startsWith('story-chibi')) }; }, T);
await p.evaluate(prev => { if (prev) localStorage.setItem('im_story', prev); else localStorage.removeItem('im_story'); }, offRes.prev);
ck('剧情关闭：不弹抉择，按史实写 nanjun = ceded', offFlag.done && offFlag.flag === 'ceded' && !offFlag.scroll, offFlag);

// 5) 羁绊「卧龙凤雏」冷却 -5%；营中闲话两人条件
const bond = await p.evaluate(async T0 => { const St = await import('/src/systems/Story.ts'), s = eval(T0);
  const d = new St.StoryDirector({ scene: s, chapterId: 'chibi', stage: 1, ctx: { lord: 'zhuge', team: () => ['zhuge', 'pangtong'], recruited: () => false }, pause() {}, resume() {} });
  const d2 = new St.StoryDirector({ scene: s, chapterId: 'chibi', stage: 1, ctx: { lord: 'zhuge', team: () => ['zhuge'], recruited: () => false }, pause() {}, resume() {} });
  return { with: d.bondCooldownMul('zhuge'), pt: d.bondCooldownMul('pangtong'), without: d2.bondCooldownMul('zhuge') }; }, T);
ck('羁绊「卧龙凤雏」：诸葛亮 + 庞统同队冷却 ×0.95，缺一人不给', bond.with === .95 && bond.pt === .95 && bond.without === 1, bond);
const c1 = await L('camp/0', 'liubei', ['zhangfei', 'zhuge']), c1b = await L('camp/0', 'liubei', ['zhangfei']), c8 = await L('camp/7', 'liubei', [], { caimao: 'joined' }), c8b = await L('camp/7', 'liubei', [], { caimao: 'slain' });
ck('闲话：张飞、诸葛亮都在队才说「博望坡那一把火」；蔡瑁归降才说「降过两回」', c1.length === 3 && c1b.length === 0 && c8.length === 2 && c8b.length === 0, { c1: c1.length, c1b: c1b.length, c8: c8.length, c8b: c8b.length });

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
