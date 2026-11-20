// 第七–十二章剧本（2026-11-20 补齐，data/story/shu|hanzhong|xiangfan|yiling|nanzheng|beifa.ts）：
// 数据：六章都登记；每关首领登场 / 倒下台词；没有场景卷轴的关有军情（有场景开场卷轴的关不重复）；说话人都认得；宁死不降的倒下台词不写降；
// 入队规则：庞统台词看落凤坡旗标、马超 7-3 打完前不说话、黄忠第七章的台词要求在队、8-1 负伤遁去的黄忠伤愈来投；第十章不再写关羽 / 张飞已死。
// 场景：8-1（?story=1）开打先播军情卷轴、首领登场说台词。截图 assets/review/story-ch07-12/。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-story-ch07-12.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-ch07-12'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use|Failed to load resource|favicon|image ink_cast_/.test(m.text())) errors.push(m.text()); /* 首领血条（ui/BossHud）按首领 id 试载 ink_cast_<id> 立绘，第七章起很多首领还没立绘：已知、与剧本无关 */ });
let pass = 0, fail = 0; const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} · ${JSON.stringify(d).slice(0, 460)}`); };
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 });

const data = await p.evaluate(async () => {
  const D = await import('/src/data/story/index.ts'), T = await import('/src/data/story/types.ts'), C = await import('/src/data/characters.ts'), S = await import('/src/data/surrender.ts'), St = await import('/src/systems/Story.ts'), Y = await import('/src/data/yilingChapter.ts');
  const arcs = ['shu', 'hanzhong', 'xiangfan', 'yiling', 'nanzheng', 'beifa'], heroes = new Set(C.CHARACTERS.map(c => c.id));
  const nodes = []; for (const a of arcs) { const ch = D.STORY_CHAPTERS[a]; if (!ch) continue; for (const [st, sn] of Object.entries(ch.stages)) for (const [k, n] of Object.entries(sn)) { if (!n) continue; if (k === 'bossFalls' || k === 'bossIntros' || k === 'bossPhases') for (const m of Object.values(n)) nodes.push({ a, st, k, n: m }); else if (Array.isArray(n)) n.forEach(m => nodes.push({ a, st, k, n: m })); else nodes.push({ a, st, k, n }); } for (const c of ch.camp) nodes.push({ a, st: 'camp', k: 'camp', n: c }); }
  const unknown = []; for (const { a, n } of nodes) for (const l of n.lines) if (l.who && l.who !== '{lord}' && !heroes.has(l.who) && !T.STORY_CAST[l.who]) unknown.push(a + ':' + l.who);
  const shape = Object.fromEntries(arcs.map(a => [a, [1, 2, 3].map(i => { const s = D.STORY_CHAPTERS[a]?.stages[i]; return (s?.brief ? 'B' : '-') + (s?.bossIntro ? 'I' : '-') + (s?.bossPhase ? 'P' : '-') + (s?.bossFall ? 'F' : '-'); }).join(' ')]));
  // 宁死不降（never）的首领：倒下台词不写「降」
  const defs = S.SURRENDER_DEFS;
  const neverKeys = (Array.isArray(defs) ? defs : Object.values(defs)).filter(d => d.tier === 'never' && arcs.some(a => d.key?.startsWith(a + '-'))).map(d => d.key);
  const fallTexts = k => { const [arcSt] = k.split(':'), [a, st] = arcSt.split('-'), s = D.STORY_CHAPTERS[a]?.stages[+st]; return [s?.bossFall, ...Object.values(s?.bossFalls ?? {})].filter(Boolean).flatMap(n => n.lines.map(l => l.text)); };
  const neverBad = neverKeys.filter(k => fallTexts(k).some(t => /降/.test(t)));
  const R = (n, lord, team, flags = {}) => { localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags })); return St.resolveLines(n, { lord, team: () => [lord, ...team], recruited: () => false }).map(l => (l.who ?? '') + ':' + l.text); };
  const shu3 = D.STORY_CHAPTERS.shu.stages[3].brief, hz1 = D.STORY_CHAPTERS.hanzhong.stages[1].brief;
  const res = {
    pangSaved: R(shu3, 'zhaoyun', [], { luofeng: 'saved' }).filter(t => t.startsWith('pangtong:')).length, pangFell: R(shu3, 'zhaoyun', [], { luofeng: 'fell' }).filter(t => t.startsWith('pangtong:')).length,
    machao73: R(shu3, 'zhaoyun', []).filter(t => t.startsWith('machao:')).length, machaoScout: R(shu3, 'zhaoyun', []).some(t => t.startsWith('scout:') && /马超/.test(t)),
    hzCh7: nodes.filter(x => x.a === 'shu').flatMap(x => x.n.lines).filter(l => l.who === 'huangzhong' && !l.ifFollower && !l.ifFollowers?.includes('huangzhong')).length,
    hzBack: R(hz1, 'zhaoyun', [], { spared_huangzhong: false }).filter(t => /箭伤已愈/.test(t)).length, hzSpared: R(hz1, 'zhaoyun', [], { spared_huangzhong: true }).filter(t => /箭伤已愈/.test(t)).length,
    yilingStory: Y.YILING_STAGES[0].story, dualFalls: Object.keys(D.STORY_CHAPTERS.hanzhong.stages[2].bossFalls ?? {}),
    missing: T.MISSING_PORTRAITS_CH712.length,
  };
  return { shape, unknown, neverKeys, neverBad, res, total: nodes.length };
});
ck('六章都登记；每关有首领登场 / 二阶段 / 倒下台词；没有场景开场卷轴的关（7-3、8-x、9-3、10-x、12-x）有军情，有开场卷轴的关不重复写', JSON.stringify(data.shape) === JSON.stringify({ shu: '-IPF -IPF BIPF', hanzhong: 'BIPF BIPF BIPF', xiangfan: '-IPF -IPF BIPF', yiling: 'BIPF BIPF BIPF', nanzheng: '-IPF -IPF -IPF', beifa: 'BIPF BIPF BIPF' }), data.shape);
ck('说话人都认得（武将 / 主公 / STORY_CAST）', data.unknown.length === 0, data.unknown);
ck('宁死不降的首领（张任 / 夏侯渊 / 曹仁 / 庞德 / 孙桓 / 兀突骨 / 张郃 / 郝昭）倒下台词不写「降」', data.neverKeys.length >= 6 && data.neverBad.length === 0, { never: data.neverKeys, bad: data.neverBad });
const r = data.res;
ck('庞统：落凤坡得救时 7-3 军情有他的话，陨落时没有（旗标 luofeng）', r.pangSaved === 1 && r.pangFell === 0, r);
ck('马超 7-3 打完才来投：7-3 军情里他不说话，只有斥候报信；7-3 章末卷轴写来投', r.machao73 === 0 && r.machaoScout, r);
ck('黄忠：第七章台词都要求在队；8-1 军情里负伤遁去的黄忠伤愈来投（劝降过的不重复）', r.hzCh7 === 0 && r.hzBack === 1 && r.hzSpared === 0, r);
ck('8-2 双首领按倒下的首领分台词；第十章不再写「为报关羽之仇」；缺立绘清单已登记', r.dualFalls.includes('xiahouyuan') && r.dualFalls.includes('zhanghe') && /荆州之耻/.test(r.yilingStory) && r.missing >= 20, r);

// 场景：8-1 阳平关，开打先播军情卷轴，首领登场说台词
await p.evaluate(() => { localStorage.removeItem('im_story_seen_v1'); localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags: {} })); const g = window.__game;
  g.registry.set('hanzhongStage', 1); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 1 }); g.registry.remove('campaignTransfer'); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('HanzhongGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('HanzhongGameScene'); return s?.sys.isActive() && s.player; }, null, { timeout: 90000 });
const T = "window.__game.scene.getScene('HanzhongGameScene')";
await p.waitForFunction(T0 => !!eval(T0).children.getByName('story-hanzhong-1-brief'), T, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(600);
const brief = await p.evaluate(T0 => { const s = eval(T0), c = s.children.getByName('story-hanzhong-1-brief'); const txt = []; const walk = o => { if (o.type === 'Text') txt.push(o.text); (o.list ?? []).forEach(walk); }; if (c) walk(c); return { shown: !!c, mode: s.mode, text: txt.join('|').slice(0, 300) }; }, T);
await p.screenshot({ path: `${out}/hanzhong-1-brief.png` });
ck('8-1 开打：先播「8-1 · 军情 · 阳平关」卷轴（法正夺高地），战斗暂停', brief.shown && brief.mode === 'story' && /阳平关/.test(brief.text), brief);
for (let i = 0; i < 30; i++) { const more = await p.evaluate(T0 => { const s = eval(T0), c = s.children.list.find(o => o.name?.startsWith('story-') && o.type === 'Container' && o.name !== 'story-bark-card'); if (!c) return false; const h = c.list.find(o => o.name?.endsWith('-next') || o.name === 'story-confirm'); h?.emit('pointerup'); h?.emit('pointerdown'); return true; }, T); if (!more) break; await p.waitForTimeout(250); }
const intro = await p.evaluate(async T0 => { const s = eval(T0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.damageImmune = true; if (!s.boss?.active) s.spawnBoss(); for (let k = 0; k < 30; k++) { if (s.mode === 'levelup') s.chooseUpgrade(0); await wait(100); } return { boss: s.chapter.bossName, log: (s.data.get('__storyBarkCardLog') ?? []).join('|') }; }, T);
await p.screenshot({ path: `${out}/hanzhong-1-boss.png` });
ck('8-1 首领张郃登场说台词「张儁乂在此！阳平关前，寸土不让！」', /张儁乂在此/.test(intro.log), intro);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 4));
await b.close();
console.log(`\n${pass}/${pass + fail} 通过`); process.exit(fail ? 1 : 0);
