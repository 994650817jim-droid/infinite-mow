// 第三章剧情（统筹 story-ch03.md）：新节点 幕间 interlude / 二阶段台词 bossPhase / 抉择 choice，
// 3-2 典韦守营（救下 / 战死两支）、3-3 传国玉玺抉择（写旗标、奖励、跳过默认、中途退出回滚、剧情关闭时不弹窗也定结果），
// 两段过场（辕门射戟、煮酒论英雄）按卷轴播，主公改写抽查（貂蝉章头、马超 3-1、诸葛亮 3-2、孙尚香 3-3）。电脑布局 1280×720，?story=1 强制播剧情。
// 截图 assets/review/story-ch03/。用法：BASE=http://127.0.0.1:5173/ node tools/test-story-ch03.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-ch03';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use/.test(m.text())) errors.push(m.text()); });
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.storyDir, null, { timeout: 90000 });
await p.waitForTimeout(800);
const T = "window.__game.scene.getScene('ThirdGameScene')";
/** 开第三章第 stage 关（lord 主公；clear 清掉剧情已看过 / 旗标） */
const third = async (stage, lord = 'zhaoyun', { clear = true } = {}) => {
  await p.evaluate(([stage, lord, clear]) => { if (clear) { localStorage.removeItem('im_story_seen_v1'); localStorage.removeItem('im_story_v1'); } const g = window.__game; window.__prevT = g.scene.getScene('ThirdGameScene')?.player;
    g.registry.set('thirdStage', stage); g.registry.set('runConfig', { ...(g.registry.get('runConfig') ?? {}), character: lord, weapon: undefined }); g.registry.remove('thirdTransfer'); g.registry.remove('campaignTransfer');
    const cur = g.scene.getScene('ThirdGameScene'); if (cur?.sys.isActive()) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('ThirdGameScene'); } }, [stage, lord, clear]);
  await p.waitForFunction(lord => { const s = window.__game.scene.getScene('ThirdGameScene'); return s?.sys.isActive() && s.player && s.player !== window.__prevT && s.runConfig?.character === lord && s.storyDir?.chapterId === 'qunxiong'; }, lord, { timeout: 90000 });
  await p.waitForTimeout(700);
};
const scroll = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); if (!c) return null;
  const texts = c.list.filter(o => o.type === 'Text').map(o => o.text).filter(Boolean), choices = c.list.filter(o => o.name?.includes('-choice-box-') && o.visible).length; return { name: c.name, texts, choices, mode: s.mode }; }, T);
const next = () => p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name?.startsWith('story-') && o.name !== 'story-bark' && o.name !== 'story-bark-card' && o.type === 'Container'); const hit = c?.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm'); if (hit?.input?.enabled !== false) hit?.emit('pointerup'); return !!hit; }, T);
const readAll = async () => { for (let i = 0; i < 40; i++) { const sc = await scroll(); if (!sc) { await p.waitForTimeout(400); if (!await scroll() && await p.evaluate(T0 => eval(T0).mode !== 'story', T)) return; continue; } if (sc.choices) return; await next(); await p.waitForTimeout(50); } };
const played = () => p.evaluate(T0 => [...eval(T0).storyDir.played], T);
const L = async (node, lord, team, flags = {}) => p.evaluate(async ([node, lord, team, flags]) => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags }));
  const n = node.split('/').reduce((o, k) => o?.[k], D.STORY_CHAPTERS.qunxiong); return St.resolveLines(n, { lord, team: () => [lord, ...team], recruited: () => false }).map(l => l.text); }, [node, lord, team, flags]);

// 1) 3-1：章头「长安之乱」→ 军情；首领二阶段大字台词；首次通关后幕间「徐州三让」只播一次
await third(1);
const open = await scroll(); await p.screenshot({ path: `${out}/chapter-open-1280x720.png` });
await readAll(); const p31 = await played();
ck('3-1：先播章头「长安之乱」，再播军情', open?.name === 'story-qunxiong-open' && p31.join() === 'qunxiong.open,qunxiong-1.brief', { open: open?.name, p31 });
const phase = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); }
  s.events.emit('boss-phase', { boss: s.boss, phase: 2, dismount: true, name: '李傕' }); await wait(120); return [...s.children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o)), ...(s.data.get('__storyBarkCardLog')?.splice(0) ?? [])] /* 2026-11-18 夜：有说话人的首领台词改出侧边立绘卡（头顶只冒「！」），卡的台词从日志读 */; }, T);
await p.screenshot({ path: `${out}/boss-phase-1280x720.png` });
ck('二阶段台词：boss-phase 事件 → 李傕「我的马——亲兵」大字', phase.some(t => t.includes('我的马')), phase);
const end31 = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); let done = 0; s.storyDir.stageEnd(() => { done++; }); await wait(300); return { done }; }, T);
const inter = await scroll(); await p.screenshot({ path: `${out}/interlude-xuzhou-1280x720.png` });
await readAll();
const end31b = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); let done = 0; s.storyDir.stageEnd(() => { done++; }); await wait(200); return { done, again: !!s.children.list.find(o => o.name === 'story-qunxiong-1-xuzhou') }; }, T);
ck('幕间：3-1 首次通关后播「徐州三让」（陶谦名字章占位），第二次不再播', inter?.name === 'story-qunxiong-1-xuzhou' && inter.texts.join().includes('陶谦') && end31.done === 0 && end31b.done === 1 && !end31b.again, { inter: inter?.name, end31, end31b });

// 2) 3-2：开打前过场「辕门射戟」→ 幕间「投奔许都」→ 军情；典韦守营
await third(2);
const yuan = await scroll(); await p.screenshot({ path: `${out}/cutscene-yuanmen-1280x720.png` });
await readAll(); const p32 = await played();
ck('3-2：过场「辕门射戟」（按卷轴）→ 幕间 → 军情', yuan?.name === 'story-qunxiong-2-yuanmen' && p32.join() === 'qunxiong-2.yuanmen,qunxiong-2.toucao,qunxiong-2.brief', { yuan: yuan?.name, p32 });
const dw = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; const d = s.dianwei; if (!d) return null;
  const es = []; for (let i = 0; i < 20; i++) { const e = s.spawnEnemy('archer', s.player.x + 300, s.player.y - 200 + i * 6, 1); if (e) { e.hp = e.maxHp = 1e6; es.push(e); } }
  const lured = es.filter(e => d.lures(e)).length; const d0 = es.filter(e => d.lures(e)).map(e => Math.hypot(e.x - d.x, e.y - d.y));
  await wait(2500); const d1 = es.filter(e => d.lures(e)).map(e => Math.hypot(e.x - d.x, e.y - d.y));
  return { lured, of: es.length, closer: d1.reduce((a, b) => a + b, 0) < d0.reduce((a, b) => a + b, 0), hp: Math.round(d.hp), swings: d.stats.swings, hurt: Math.round(d.stats.hurt) }; }, T);
await p.screenshot({ path: `${out}/dianwei-guard-1280x720.png` });
ck('典韦守营：营门有典韦，约四成敌兵改打他（往他身边走），他挥戟反击', !!dw && dw.lured >= 6 && dw.lured <= 10 && dw.closer, dw);
const fell = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.dianwei.hurt(99999, s.combatNow); const banner = true; s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); }
  s.boss.hp = 1; s.debugCrit = false; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(100);
  return { down: s.dianwei.down, flag: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.dianwei ?? null, overMode: s.mode, banner }; }, T);
const fellLines = await L('stages/2/after/0', 'zhaoyun', [], { dianwei: 'fell' }), savedLines = await L('stages/2/after/0', 'zhaoyun', [], { dianwei: 'saved' });
ck('典韦战死：不判负、张绣倒下时写 dianwei=fell；幕间播「重伤抢回、生死未卜」那一支（第二批可玩武将：不写战死，曹魏支线随曹操来投）', fell.down && fell.flag === 'fell' && fellLines.join().includes('生死未卜') && !fellLines.join().includes('还没砍够'), { fell, fellLines });
await third(2, 'zhaoyun', { clear: false });
const saved = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; const merit0 = (await import('/src/systems/MasteryStore.ts')).merit();
  s.spawnBoss(); for (let k = 0; k < 6 && s.mode === 'levelup'; k++) { s.chooseUpgrade(0); await wait(60); } s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, true); await wait(100);
  return { flag: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.dianwei ?? null, merit: (await import('/src/systems/MasteryStore.ts')).merit() - merit0 }; }, T);
ck('典韦得救：张绣倒下时典韦活着 → dianwei=saved，军功 +80；幕间换成「还没砍够」那一支', saved.flag === 'saved' && saved.merit === 80 && savedLines.join().includes('还没砍够'), { saved, savedLines });

// 3) 3-3：宝箱捡完 → 抉择「传国玉玺」→ 回应 → 章末「白门楼」→ 过场「煮酒论英雄」→ 结算
await third(3);
await readAll();
const choiceRes = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); const Bs = await import('/src/systems/BattleSnapshot.ts'); Bs.beginBattle('test-ch3');
  const W = await import('/src/world/WorldStore.ts'), grain0 = W.loadWorld().provisions; window.__grain0 = grain0; let finished = false; s.storyDir.stageEnd(() => { finished = true; }); window.__finished = () => finished; await wait(400); return { grain0 }; }, T);
const ch = await scroll(); await p.screenshot({ path: `${out}/choice-jade-1280x720.png` });
ck('抉择：卷轴最后一页换成「送还许都 / 暂且收下」两个按钮', ch?.name === 'story-qunxiong-3-jade' && ch.choices === 2, ch);
await p.evaluate(T0 => { const s = eval(T0); const c = s.children.list.find(o => o.name === 'story-qunxiong-3-jade'); c.list.find(o => o.name === 'story-qunxiong-3-jade-choice-box-1').list.find(o => o.name?.endsWith('-choice-1')).emit('pointerup'); }, T);
await p.waitForTimeout(300);
const reply = await scroll();
await readAll(); const p33 = await played();
const after33 = await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); return { flag: JSON.parse(localStorage.getItem('im_story_v1')).flags.jade_seal, grain: W.loadWorld().provisions - window.__grain0, finished: window.__finished() }; });
ck('选「暂且收下」：旗标 jade_seal=kept、钱币 +300、主公回一句「先由我保管」', after33.flag === 'kept' && after33.grain === 300 && reply?.texts.join().includes('先由我保管'), { after33, reply: reply?.texts });
ck('之后接章末「白门楼」和过场「煮酒论英雄」，播完才结算', p33.slice(-3).join() === 'qunxiong-3.jade,qunxiong.close,qunxiong.zhujiu' && after33.finished, { p33 });
const rolled = await p.evaluate(async () => { const Bs = await import('/src/systems/BattleSnapshot.ts'); const ok = Bs.rollbackBattle(); return { ok, flags: JSON.parse(localStorage.getItem('im_story_v1') ?? 'null')?.flags ?? null }; });
ck('中途退出回滚：玉玺旗标随快照回滚', rolled.ok && !rolled.flags?.jade_seal, rolled);
// 跳过抉择 = 默认「送还许都」；剧情关闭时不弹窗也定结果
await third(3);
await readAll();
await p.evaluate(async T0 => { const s = eval(T0); s.storyDir.stageEnd(() => {}); await new Promise(r => setTimeout(r, 300)); }, T);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
const skipFlag = await p.evaluate(() => JSON.parse(localStorage.getItem('im_story_v1')).flags.jade_seal);
await p.evaluate(async () => { localStorage.removeItem('im_story_v1'); localStorage.removeItem('im_story_seen_v1'); (await import('/src/systems/BattleSettings.ts')).setStoryMode('off'); });
await third(3, 'zhaoyun', { clear: false });
const offRes = await p.evaluate(async T0 => { const s = eval(T0); let done = false; s.storyDir.stageEnd(() => { done = true; }); await new Promise(r => setTimeout(r, 200)); return { done, flag: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.jade_seal ?? null, scroll: !!s.children.list.find(o => o.name?.startsWith('story-')) }; }, T);
await p.evaluate(async () => (await import('/src/systems/BattleSettings.ts')).setStoryMode('full'));
ck('跳过抉择按「送还许都」；剧情关闭时不弹窗也写 jade_seal=returned', skipFlag === 'returned' && offRes.done && offRes.flag === 'returned' && !offRes.scroll, { skipFlag, offRes });

// 4) 主公改写 / 随从条件抽查
const dcOpen = await L('open', 'diaochan', []), mcBrief = await L('stages/1/brief', 'machao', []), zgBrief = await L('stages/2/brief', 'zhuge', []), sxBrief = await L('stages/3/brief', 'sunshangxiang', []);
const closeDc = await L('close', 'diaochan', []), closeFollow = await L('close', 'zhaoyun', ['diaochan', 'zhangfei']), camp5a = await L('camp/4', 'zhaoyun', ['zhangfei']), camp5b = await L('camp/4', 'zhaoyun', []);
ck('主公改写：貂蝉章头有王允「蝉儿，快走」；马超 3-1「马家的骑法」；诸葛亮 3-2「卧龙岗」；孙尚香 3-3「替孙家打」', dcOpen.join().includes('蝉儿') && mcBrief.join().includes('马家的骑法') && zgBrief.join().includes('卧龙岗') && sxBrief.join().includes('孙家'), { dcOpen: dcOpen.length, mcBrief: mcBrief[1] });
ck('章末条件：貂蝉主公多两句「辕门那一箭」；貂蝉随行只低头不语，张飞在队骂三姓家奴', closeDc.join().includes('辕门那一箭') && !closeDc.join().includes('许久不语') && closeFollow.join().includes('许久不语') && closeFollow.join().includes('三姓家奴'), { closeDc: closeDc.length, closeFollow: closeFollow.length });
ck('营中闲话条件：张飞在队时他说「他也配？」，不在队时主公说「跳梁小丑」', camp5a.join().includes('他也配') && !camp5a.join().includes('跳梁') && camp5b.join().includes('跳梁小丑'), { camp5a, camp5b });

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
