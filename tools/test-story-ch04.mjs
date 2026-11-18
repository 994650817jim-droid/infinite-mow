// 第四章剧情（统筹 story-ch04.md）：章头「衣带诏」→ 幕间「土山约三事」→ 军情；读第三章旗标 jade_seal / dianwei；
// 关羽在队 / 不在队：颜良倒下的台词、「斩颜良」横幅与旗标；二阶段台词；章末「乌巢火起」+ 过场「千里走单骑」；
// 主公改写（刘备、关羽称呼去重、张飞）；羁绊「古城」暴击；闲话「打过 4-1」条件。电脑布局 1280×720，?story=1 强制播剧情。
// 截图 assets/review/story-ch04/。用法：BASE=http://127.0.0.1:5173/ node tools/test-story-ch04.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-ch04';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); });
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.storyDir, null, { timeout: 90000 });
await p.waitForTimeout(800);
const T = "window.__game.scene.getScene('GuanduGameScene')";
/** 开第四章第 stage 关；flags 预置旗标（第三章结果） */
const guandu = async (stage, lord = 'zhaoyun', flags = {}) => {
  await p.evaluate(([stage, lord, flags]) => { localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags })); const g = window.__game; window.__prevT = g.scene.getScene('GuanduGameScene')?.player;
    g.registry.set('guanduStage', stage); g.registry.set('runConfig', { ...(g.registry.get('runConfig') ?? {}), character: lord, weapon: undefined }); g.registry.remove('campaignTransfer');
    for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GuanduGameScene'); }, [stage, lord, flags]);
  await p.waitForFunction(lord => { const s = window.__game.scene.getScene('GuanduGameScene'); return s?.sys.isActive() && s.player && s.player !== window.__prevT && s.runConfig?.character === lord && s.storyDir?.chapterId === 'guandu'; }, lord, { timeout: 90000 });
  await p.waitForTimeout(700);
};
const scroll = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container'); if (!c) return null; return { name: c.name, texts: c.list.filter(o => o.type === 'Text').map(o => o.text).filter(Boolean), mode: s.mode }; }, T);
const next = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container'); c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm')?.emit('pointerup'); }, T);
/** 读完当前一串卷轴，收集每页文字 */
const readAll = async () => { const seen = []; for (let i = 0; i < 60; i++) { const sc = await scroll(); if (!sc) { await p.waitForTimeout(400); if (!await scroll() && await p.evaluate(T0 => eval(T0).mode !== 'story', T)) return seen; continue; } seen.push(sc.texts.join('|')); await next(); await p.waitForTimeout(40); } return seen; };
const played = () => p.evaluate(T0 => [...eval(T0).storyDir.played], T);
const L = async (node, lord, team, flags = {}) => p.evaluate(async ([node, lord, team, flags]) => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags }));
  const n = node.split('/').reduce((o, k) => o?.[k], D.STORY_CHAPTERS.guandu); return St.resolveLines(n, { lord, team: () => [lord, ...team], recruited: () => false }).map(l => l.text + (l.who ? '@' + l.who : '')); }, [node, lord, team, flags]);
/** 打倒本关首领（关掉升级弹窗） */
const killBoss = () => p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); }
  await wait(100); s.boss.invulnerable = false; s.boss.hp = 1; s.debugCrit = false; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(150);
  return { barks: s.children.list.filter(o => o.name === 'story-bark').map(o => (o.list ?? []).map(t => t.text).join(':')), banner: s.children.list.filter(o => o.type === 'Text' && o.visible && /斩颜良|诛文丑/.test(o.text)).map(o => o.text), flags: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {} }; }, T);

// 1) 4-1：章头（jade_seal=kept → 程昱一句）→ 幕间「土山约三事」→ 军情（dianwei=saved → 典韦一句）
await guandu(1, 'zhaoyun', { jade_seal: 'kept', dianwei: 'saved' });
const open = await scroll(); await p.screenshot({ path: `${out}/chapter-open-1280x720.png` });
const pages = await readAll(); const p41 = await played();
ck('4-1：章头「衣带诏」→ 幕间「土山约三事」→ 军情', open?.name === 'story-guandu-open' && p41.join() === 'guandu.open,guandu-1.tushan,guandu-1.brief', { open: open?.name, p41 });
ck('读第三章旗标：私留玉玺时章头有程昱「玉玺……恐怕就在刘备军中」；典韦得救时军情有典韦「中军有某守着」', pages.some(t => t.includes('程昱') && t.includes('玉玺')) && pages.some(t => t.includes('典韦') && t.includes('中军有某守着')), { n: pages.length });
const plainOpen = await L('open', 'zhaoyun', []), plainBrief = await L('stages/1/brief', 'zhaoyun', []);
ck('旗标没有时：不出程昱、典韦那两句', !plainOpen.join().includes('程昱') && !plainBrief.join().includes('典韦'), { plainOpen: plainOpen.length, plainBrief: plainBrief.length });

// 2) 关羽不在队：颜良默认台词，无横幅、无旗标；二阶段台词
const phase = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); }
  s.events.emit('boss-phase', { boss: s.boss, phase: 2, dismount: true, name: '颜良' }); await wait(120); return s.children.list.filter(o => o.name === 'story-bark').map(o => (o.list ?? []).map(t => t.text).join(':')); }, T);
await p.screenshot({ path: `${out}/boss-phase-1280x720.png` });
ck('二阶段台词：颜良「坠马又如何？」', phase.some(t => t.includes('坠马又如何')), phase);
const noGy = await killBoss();
ck('关羽不在队：颜良倒下说「何时到了我面前」，没有「斩颜良」横幅与旗标', noGy.barks.some(t => t.includes('何时到了我面前')) && !noGy.banner.length && !noGy.flags.yanliang_by_guanyu, noGy);

// 3) 关羽是主公：土山 / 军情称呼去重；颜良倒下换关羽「插标卖首」+ 横幅「斩颜良」+ 旗标
await guandu(1, 'guanyu');
const gyPages = await readAll();
ck('关羽主公：称呼去重（张辽「云长，困守土山」、曹操「云长，可愿随我」，不出现「云长、关羽」）', gyPages.some(t => t.includes('云长，困守土山')) && gyPages.some(t => t.includes('云长，可愿随我')) && !gyPages.some(t => t.includes('云长、关羽')), { n: gyPages.length });
const gy = await killBoss();
await p.screenshot({ path: `${out}/yanliang-banner-1280x720.png` });
ck('关羽在队：颜良倒下换成关羽「插标卖首」+ 横幅「斩颜良」+ 旗标 yanliang_by_guanyu', gy.barks.some(t => t.includes('插标卖首')) && gy.banner.some(t => t.includes('斩颜良')) && gy.flags.yanliang_by_guanyu === true, gy);
// 首次通关后幕间
await p.evaluate(T0 => { eval(T0).storyDir.stageEnd(() => {}); }, T); await p.waitForTimeout(300);
const after41 = await scroll(); await readAll();
ck('4-1 首次通关后幕间「云长神人」（曹操「今后遇张翼德，不可轻敌」）', after41?.name === 'story-guandu-1-after', after41?.name);

// 4) 4-2 文丑（关羽主公）：「诛文丑」横幅 + 旗标
await guandu(2, 'guanyu');
await readAll();
const wc = await killBoss();
ck('4-2：关羽在队「诛文丑」横幅 + 旗标 wenchou_by_guanyu', wc.banner.some(t => t.includes('诛文丑')) && wc.flags.wenchou_by_guanyu === true && wc.barks.some(t => t.includes('可识得关某')), wc);

// 5) 4-3：开打前过场「许攸夜奔」；关末：章末「乌巢火起」→ 过场「千里走单骑」→ 结算
await guandu(3, 'zhaoyun', { dianwei: 'saved' });
const xy = await scroll(); await p.screenshot({ path: `${out}/cutscene-xuyou-1280x720.png` });
const xyPages = await readAll(); const p43 = await played();
ck('4-3：过场「许攸夜奔」（按卷轴）→ 军情（典韦「护在马前」）', xy?.name === 'story-guandu-3-xuyou' && p43.join() === 'guandu-3.xuyou,guandu-3.brief' && xyPages.some(t => t.includes('护在马前')), { xy: xy?.name, p43 });
const endRes = await p.evaluate(async T0 => { const s = eval(T0); window.__fin = false; s.storyDir.stageEnd(() => { window.__fin = true; }); await new Promise(r => setTimeout(r, 300)); return true; }, T);
const closePage = await scroll(); await p.screenshot({ path: `${out}/chapter-close-1280x720.png` });
const endPages = await readAll(); const pEnd = await played(); const fin = await p.evaluate(() => window.__fin);
ck('关末：章末「乌巢火起」→ 过场「千里走单骑」（过五关斩六将、古城张飞擂鼓）→ 才结算', endRes && closePage?.name === 'story-guandu-close' && pEnd.slice(-2).join() === 'guandu.close,guandu.danqi' && endPages.some(t => t.includes('过五关，斩六将')) && endPages.some(t => t.includes('擂鼓三通')) && fin, { pEnd, fin });

// 6) 主公改写抽查（不进场景，直接解析）
const lbOpen = await L('open', 'liubei', []), lbClose = await L('close', 'liubei', []), lbDanqi = await L('closeAfter/0', 'liubei', []), zfDanqi = await L('closeAfter/0', 'zhangfei', []), gyClose = await L('close', 'guanyu', []), zyDanqi = await L('closeAfter/0', 'zhaoyun', []), zyFollow = await L('closeAfter/0', 'liubei', ['zhaoyun']);
ck('刘备主公：章头「刘备兵败，未能脱身」；章末「大哥，就是今夜」；单骑张飞「真从曹营出来了？」', lbOpen.join().includes('刘备兵败，未能脱身') && lbClose.join().includes('就是今夜') && lbDanqi.join().includes('真从曹营出来了'), { lbOpen: lbOpen.length });
ck('张飞主公：单骑里不怀疑二哥（无「错怪你了」），改成「咱俩一起砍了他」', zfDanqi.join().includes('咱俩一起砍了他') && !zfDanqi.join().includes('错怪你了'), zfDanqi.length);
ck('关羽主公：章末称呼去重「兄长有了下落！收拾行装」', gyClose.some(t => t.startsWith('兄长有了下落！收拾行装')), gyClose);
ck('赵云在队：单骑末尾多一句「赵云持枪立于一旁」，不在队时没有', zyFollow.join().includes('持枪立于一旁') && !lbDanqi.join().includes('持枪立于一旁'), { zyFollow: zyFollow.length, lbDanqi: lbDanqi.length });

// 7) 羁绊「古城」（关羽 + 张飞）暴击 +5%；闲话「打过 4-1」条件
const bond = await p.evaluate(async T0 => { const St = await import('/src/systems/Story.ts'), s = eval(T0);
  const d = new St.StoryDirector({ scene: s, chapterId: 'guandu', stage: 2, ctx: { lord: 'guanyu', team: () => ['guanyu', 'zhangfei'], recruited: () => false }, pause() {}, resume() {} });
  const d2 = new St.StoryDirector({ scene: s, chapterId: 'guandu', stage: 2, ctx: { lord: 'guanyu', team: () => ['guanyu'], recruited: () => false }, pause() {}, resume() {} });
  return { with: d.bondCritBonus('guanyu'), without: d2.bondCritBonus('guanyu'), bonds: d.bonds.map(b => b.id) }; }, T);
ck('羁绊「古城」：关羽 + 张飞同队暴击 +5%，缺一人不给', bond.with === .05 && bond.without === 0 && bond.bonds.join() === 'bond.gucheng', bond);
const sx0 = await L('camp/5', 'sunshangxiang', []), sx1 = await L('camp/5', 'sunshangxiang', [], { cleared_guandu_1: true });
ck('闲话：孙尚香主公、打过 4-1 才说「兄长伯符遇刺」', sx0.length === 0 && sx1.join().includes('伯符遇刺'), { sx0, sx1: sx1.length });

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
