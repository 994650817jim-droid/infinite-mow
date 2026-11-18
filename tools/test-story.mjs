// 剧情系统（2026-11-17，systems/Story.ts + data/story/）：章头 / 关前军情 / 羁绊 / 首领登场与倒下 / 章末 / 营中闲话；
// 只播一次、可跳过（Esc / 「跳过」）、主公改写、随从条件、旗标读写与中途退出回滚、设置关闭不播、引导在军情之后开。电脑布局 1280×720。
// 测试跑默认不播剧情，这里用 ?story=1 强制。截图 assets/review/story/。用法：BASE=http://127.0.0.1:5173/ node tools/test-story.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story';
mkdirSync(out, { recursive: true });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'] };
const rec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = (lord, fs) => ({ version: 1, lord, lordFinal: true, owned: [rec(lord), ...fs.map(rec)], followers: fs, offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 3 });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); });
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
await p.addInitScript(([w, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, roster('zhaoyun', [])]);
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.storyDir, null, { timeout: 90000 });
const G = "window.__game.scene.getScene('GameScene')";
const S = () => p.evaluate(() => import('/src/systems/Story.ts').then(() => true));
await S();
/** 以某主公 / 随行 / 关卡重开战斗（可选先清已看过） */
const restart = async (lord, fs = [], { chapter = 'huangjin', stage = 1, clearSeen = true } = {}) => {
  await p.evaluate(([G0, r, lord, chapter, stage, clearSeen]) => { if (clearSeen) localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = eval(G0); window.__prevPlayer = s.player;
    s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: lord, weapon: undefined, chapter, stage: chapter === 'huangjin' ? stage : undefined, westStage: chapter === 'hulao' ? stage : undefined }); s.registry.remove('campaignTransfer'); s.scene.restart(); }, [G, roster(lord, fs), lord, chapter, stage, clearSeen]);
  await p.waitForTimeout(400);
  await p.waitForFunction(([lord, n]) => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prevPlayer && s.runConfig?.character === lord && s.storyDir && (s.followers?.members.length ?? 0) === n; }, [lord, fs.length], { timeout: 60000 });
  await p.waitForTimeout(900);
};
const scroll = () => p.evaluate(G0 => { const s = eval(G0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.type === 'Container'); if (!c) return null;
  const texts = c.list.filter(o => o.type === 'Text').map(o => o.text).filter(Boolean); const portrait = c.list.find(o => o.name?.endsWith('-portrait')), seal = c.list.find(o => o.name?.endsWith('-seal'));
  return { name: c.name, texts, portrait: portrait?.visible ? portrait.texture.key : null, seal: seal?.visible ? seal.text : null, mode: s.mode }; }, G);
const next = () => p.evaluate(G0 => { const s = eval(G0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.type === 'Container'); const hit = c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm'); hit?.emit('pointerup'); return !!hit; }, G);
const readAll = async () => { for (let i = 0; i < 24; i++) { if (!await scroll()) { await p.waitForTimeout(400); if (!await scroll() && await p.evaluate(G0 => eval(G0).mode !== 'story', G)) return; continue; } await next(); await p.waitForTimeout(60); } }; // 下一段卷轴可能在等立绘载入，空档里多等一下

// 1) 章头（非刘关张主公改写）+ 立绘 / 名字章 + 暂停
await restart('zhaoyun');
const open1 = await scroll();
await p.screenshot({ path: `${out}/chapter-open-1280x720.png` });
ck('进 1-1：先播章头卷轴，战斗暂停（mode story）', open1?.name === 'story-huangjin-open' && open1.mode === 'story', open1);
await next(); await next(); const open3 = await scroll();
ck('主公改写：赵云当主公，第 3 句由「赵云」说「愿随义军」，左侧显示赵云水墨立绘', open3?.texts.some(t => t.startsWith('赵云')) && open3.texts.some(t => t.includes('愿随义军')) && open3.portrait === 'ink_hero_zhaoyun', open3);
await readAll();
const after1 = await p.evaluate(G0 => { const s = eval(G0); return { played: s.storyDir.played, mode: s.mode }; }, G);
ck('章头读完接关前军情；全部读完回到战斗', after1.played.join() === 'huangjin.open,huangjin-1.brief' && after1.mode === 'none', after1);

// 2) 只播一次：再进 1-1 不再播（不清已看过）
await restart('zhaoyun', [], { clearSeen: false });
const again = await p.evaluate(G0 => { const s = eval(G0); return { played: s.storyDir.played, mode: s.mode }; }, G);
ck('已看过：重打 1-1 不再播章头和军情', again.played.length === 0 && again.mode === 'none', again);

// 3) 跳过：Esc 跳过章头 → 军情出现 → 点「跳过」→ 回到战斗，两段都记为已看
await restart('zhaoyun');
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
const briefShown = await scroll();
await p.screenshot({ path: `${out}/stage-brief-1280x720.png` });
ck('Esc 跳过章头后接着出关前军情（斥候为名字章）', briefShown?.name === 'story-huangjin-1-brief' && briefShown.seal?.split(String.fromCharCode(10)).join('') === '斥候', briefShown);
await p.evaluate(G0 => { const s = eval(G0); s.children.list.find(o => o.name === 'story-huangjin-1-brief')?.list.find(o => o.name?.endsWith('-skip'))?.emit('pointerup'); }, G);
await p.waitForTimeout(100);
const skipped = await p.evaluate(() => { const seen = JSON.parse(localStorage.getItem('im_story_seen_v1') ?? '[]'); const s = window.__game.scene.getScene('GameScene'); return { seen, mode: s.mode, left: !!s.children.list.find(o => o.name?.startsWith('story-huangjin')) }; });
ck('「跳过」关掉军情，跳过也记为已看，战斗继续', skipped.seen.includes('huangjin.open') && skipped.seen.includes('huangjin-1.brief') && skipped.mode === 'none' && !skipped.left, skipped);

// 4) 刘备当主公 + 关张随行：原版章头（刘备说「大丈夫」）、羁绊「桃园」追加在军情后、三人伤害 +5%
await restart('liubei', ['guanyu', 'zhangfei']);
const lb = await scroll();
const bond = await p.evaluate(G0 => { const s = eval(G0); return { bonds: s.storyDir.bonds.map(b => b.id), lordMul: s.storyDir.bondDamageMul('liubei'), followerMul: s.followers.members.map(m => +m.weaponDamageMul.toFixed(3)) }; }, G);
await next(); await next();
const lb3 = await scroll();
ck('刘备主公：章头用原版（第 3 句刘备说「大丈夫不与国家出力」）', lb3?.texts.some(t => t.includes('大丈夫')) && lb3.portrait === 'ink_hero_liubei', { lb: lb?.name, lb3 });
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
const brief2 = await scroll();
ck('羁绊「桃园」：刘关张同队，军情末尾追加张飞台词与加成提示，三人伤害 ×1.05', bond.bonds.join() === 'bond.taoyuan' && bond.lordMul === 1.05 && brief2?.texts.join('|').match(/4 \/ 5|1 \/ 5/), { bond, brief2 });
await p.keyboard.press('Escape'); await p.waitForTimeout(150);

// 5) 首领登场 / 倒下大字台词
const boss = await p.evaluate(async G0 => { const s = eval(G0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); } s.boss.sprite.setPosition(s.player.x + 160, s.player.y - 40); await wait(250);
  const intro = s.children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o));
  return { intro, played: [...s.storyDir.played] }; }, G);
await p.screenshot({ path: `${out}/boss-line-1280x720.png` });
ck('首领登场：张梁大字台词「人公将军在此」', boss.intro.some(t => t.includes('张梁') && t.includes('人公将军')), boss);
const fall = await p.evaluate(async G0 => { const s = eval(G0), wait = ms => new Promise(r => setTimeout(r, ms)); s.debugCrit = false; s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); await wait(150);
  return { lines: s.children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o)) }; }, G);
ck('首领倒下：张梁「黄天……何不佑我」', fall.lines.some(t => t.includes('黄天')), fall);

// 6) 旗标：写入 → 中途退出回滚时旗标回滚、已看过不回滚
const flags = await p.evaluate(async () => { const St = await import('/src/systems/Story.ts'), Bs = await import('/src/systems/BattleSnapshot.ts');
  Bs.beginBattle('test'); St.setStoryFlag('spared_test'); St.markStorySeen('test.node'); const before = St.storyFlag('spared_test');
  const rolled = Bs.rollbackBattle(); return { before, after: St.storyFlag('spared_test') ?? null, seenKept: St.storySeen('test.node'), rolled }; });
ck('旗标：中途退出回滚后 storyFlags 回到进关前，已看过保留', flags.before === true && flags.after === null && flags.seenKept && flags.rolled, flags);

// 7) 设置：关闭 → 不播；只看章头章末 → 播章头不播军情
await p.evaluate(async () => (await import('/src/systems/BattleSettings.ts')).setStoryMode('off'));
await restart('zhaoyun');
const off = await p.evaluate(G0 => { const s = eval(G0); return { played: s.storyDir.played, mode: s.mode }; }, G);
await p.evaluate(async () => (await import('/src/systems/BattleSettings.ts')).setStoryMode('chapter'));
await restart('zhaoyun'); await readAll();
const chapOnly = await p.evaluate(G0 => eval(G0).storyDir.played, G);
await p.evaluate(async () => (await import('/src/systems/BattleSettings.ts')).setStoryMode('full'));
ck('设置「关闭」不播任何剧情；「只看章头章末」只播章头', off.played.length === 0 && off.mode === 'none' && chapOnly.join() === 'huangjin.open', { off, chapOnly });

// 8) 第二章：章头（曹操、袁绍名字章）、2-1 关羽在队才说「酒且斟下」
await restart('zhaoyun', ['guanyu'], { chapter: 'hulao', stage: 1 });
const ch2 = await scroll(); await readAll();
const ch2played = await p.evaluate(G0 => eval(G0).storyDir.played, G);
ck('第二章 2-1：章头「酸枣会盟」+ 军情', ch2?.name === 'story-hulao-open' && ch2played.join() === 'hulao.open,hulao-1.brief', { ch2: ch2?.name, ch2played });
const lines21 = await p.evaluate(async () => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); const n = D.STORY_CHAPTERS.hulao.stages[1].brief;
  const w = St.resolveLines(n, { lord: 'zhaoyun', team: () => ['zhaoyun', 'guanyu'], recruited: () => false }).length, wo = St.resolveLines(n, { lord: 'zhaoyun', team: () => ['zhaoyun'], recruited: () => false }).length; return { w, wo }; });
ck('随从条件：关羽在队时军情多一句「酒且斟下」', lines21.w === lines21.wo + 1, lines21);
const ext = await p.evaluate(G0 => { const s = eval(G0); return { said: s.storyDir.line('hulao-3.lubu_enter', s.player.sprite), wrongStage: s.storyDir.line('nope', s.player.sprite) }; }, G);
ck('外部触发台词：storyDir.line(id) 能说第二章 bark（供 2-3 首领战调用）', ext.said === true && ext.wrongStage === false, ext);

// 9) 章末：1-3 首领宝箱捡完后先播章末，再进战报
await restart('zhaoyun', [], { chapter: 'huangjin', stage: 3, clearSeen: false });
const close = await p.evaluate(async G0 => { const s = eval(G0), wait = ms => new Promise(r => setTimeout(r, ms)); localStorage.setItem('im_story_seen_v1', JSON.stringify(['huangjin.open', 'huangjin-3.brief'])); let finished = false; const f = s.finish.bind(s); s.finish = (...a) => { finished = true; return f(...a); };
  s.storyDir.chapterClose(() => s.finish(true, 'boss')); await wait(300); const c = s.children.list.find(o => o.name === 'story-huangjin-close'); return { shown: !!c, finishedBefore: finished, mode: s.mode }; }, G);
await readAll(); await p.waitForTimeout(200);
const closeAfter = await p.evaluate(G0 => ({ mode: eval(G0).mode, seen: JSON.parse(localStorage.getItem('im_story_seen_v1')).includes('huangjin.close') }), G);
ck('章末：先播「黄巾平定」卷轴，读完才结算（第一章进入行营休整 / 结算）', close.shown && !close.finishedBefore && ['result', 'rest'].includes(closeAfter.mode) && closeAfter.seen, { close, closeAfter });

// 10) 营中闲话：义军营寨底栏出现小对话条，出现即记为已看；不挡「天下地图 · 出征」
await p.evaluate(() => { localStorage.removeItem('im_story_seen_v1'); const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').children.getByName('city-map'), null, { timeout: 30000 });
await p.waitForTimeout(1500);
const camp = await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'), t = s.children.getByName('camp-talk'), m = s.children.getByName('city-map'); if (!t) return null;
  const tb = t.getBounds(), mb = m.getBounds(); return { text: t.list.find(o => o.name === 'camp-talk-text')?.text, overlap: Phaser.Geom.Rectangle.Overlaps(tb, mb), seen: JSON.parse(localStorage.getItem('im_story_seen_v1') ?? '[]') }; });
await p.screenshot({ path: `${out}/camp-talk-1280x720.png` });
ck('营中闲话：营寨底栏出现一段（按存档进度选章），记为已看，不压「天下地图 · 出征」', !!camp?.text && !camp.overlap && camp.seen.some(id => id.includes('.camp')), camp);

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
