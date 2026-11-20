// 剧情 / 关卡一致性审计（2026-11-20）：把各关的关卡定义、剧情节点、支线、劝降、解锁、副将、兵种配比导出成 JSON 供交叉核对。
// 用法：BASE=http://127.0.0.1:5187/ node tools/_p/story-dump.mjs <out.json>
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'story-dump.json';
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
const d = await p.evaluate(async () => {
  const imp = m => import('/src/data/' + m + '.ts');
  const [C, T, G, CB, J, SH, HZ, XF, YL, NZ, BF, ST, SP, SR, SU, HU, ER, CH, SM] = await Promise.all(['chapters', 'thirdChapter', 'guanduChapter', 'chibiChapter', 'jingnanChapter', 'shuChapter', 'hanzhongChapter', 'xiangfanChapter', 'yilingChapter', 'nanzhengChapter', 'beifaChapter', 'story/index', 'stagePhases', 'sideRoutes', 'surrender', 'heroUnlocks', 'enemyRoster', 'characters', 'stageMaps'].map(imp));
  const pick = c => ({ id: c.id, name: c.name, label: c.label, description: c.description, bossName: c.bossName, bossStyle: c.bossStyle, waves: (c.waves ?? []).map(w => w.name ?? w.label ?? ''), victoryText: c.victoryText, tip: c.tip ?? c.hint ?? null });
  const stages = {};
  for (const s of [1, 2, 3]) {
    const add = (k, f) => { try { stages[k] = pick(f()); } catch (e) { stages[k] = { error: String(e).slice(0, 120) }; } };
    add('1-' + s, () => C.getBattleChapter('huangjin', s)); add('2-' + s, () => C.getBattleChapter('hulao', 1, s));
    add('3-' + s, () => T.thirdBattle(s)); add('4-' + s, () => G.guanduBattle(s)); add('5-' + s, () => CB.chibiBattle(s)); add('6-' + s, () => J.jingnanBattle(s));
    add('7-' + s, () => SH.shuBattle(s, () => true)); add('8-' + s, () => HZ.hanzhongBattle(s)); add('9-' + s, () => XF.xiangfanBattle(s)); add('10-' + s, () => YL.yilingBattle(s)); add('11-' + s, () => NZ.nanzhengBattle(s)); add('12-' + s, () => BF.beifaBattle(s));
  }
  const strip = n => n && ({ id: n.id, type: n.type, title: n.title, kicker: n.kicker, lines: n.lines?.map(l => ({ who: l.who, text: l.text, tip: l.tip, ifFollower: l.ifFollower, ifRecruited: l.ifRecruited, ifLord: l.ifLord, ifFollowers: l.ifFollowers })), variants: n.variants && Object.fromEntries(Object.entries(n.variants).map(([k, v]) => [k, v.map(l => ({ who: l.who, text: l.text }))])), boss: n.boss, choices: n.choices?.map(c => ({ label: c.label, reply: c.reply.map(l => ({ who: l.who, text: l.text })) })) });
  const story = {};
  for (const [k, ch] of Object.entries(ST.STORY_CHAPTERS)) story[k] = { open: strip(ch.open), close: strip(ch.close), closeAfter: ch.closeAfter?.map(strip), camp: ch.camp?.map(strip), bonds: ch.bonds?.map(x => ({ id: x.id, name: x.name, members: x.members, lines: x.lines })), barks: ch.barks?.map(strip), midScrolls: ch.midScrolls?.map(strip),
    stages: Object.fromEntries(Object.entries(ch.stages).map(([s, v]) => [s, { before: v.before?.map(strip), brief: strip(v.brief), bossIntro: strip(v.bossIntro), bossPhase: strip(v.bossPhase), bossFall: strip(v.bossFall), bossFalls: v.bossFalls && Object.fromEntries(Object.entries(v.bossFalls).map(([a, n]) => [a, strip(n)])), after: v.after?.map(strip), choice: strip(v.choice) }])) };
  const surrender = Object.values(SU).find(v => Array.isArray(v) && v[0]?.tier) ?? Object.entries(SU).filter(([k, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([k]) => k);
  return { stages, story, cast: ST.STORY_CAST, lieutenants: SP.LIEUTENANTS, eventNames: SP.EVENT_NAMES, chapterIndex: SP.CHAPTER_INDEX, side: SR.SIDE_ROUTES, surrender, surrenderKeys: Object.keys(SU), heroUnlocks: Object.fromEntries(Object.entries(HU).filter(([k, v]) => typeof v !== 'function')), stageMix: ER.STAGE_MIX, characters: CH.CHARACTERS.map(c => ({ id: c.id, name: c.name, portrait: c.portrait })) };
});
writeFileSync(out, JSON.stringify(d, null, 1)); console.log('wrote', out, Object.keys(d.stages).length, 'stages', Object.keys(d.story).length, 'story chapters');
await b.close();
