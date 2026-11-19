// 首领台词侧边立绘卡（2026-11-18 夜，ui/StoryBarkCard.ts）：首领登场 / 倒下等剧情 bark 出侧边小卡——对的立绘、敌方右 / 我方左、
// 不暂停战斗、2.7 秒后自己滑走、挨得近的排队；头顶只冒「！」；剧情设置关掉时不出。电脑布局 1280×720。
// 另拍张角 / 华雄 / 曹仁登场三张截图到 assets/review/story-barkcard/。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-story-barkcard.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-barkcard';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 }); await p.waitForTimeout(1200);
// 场上放首领（血条、军令都在），关掉升级窗；之后每段直接起对应章节的导演按 bark 播
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
  setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40);
  window.__dir = async (chapterId, stage, team = ['liubei', 'guanyu', 'zhangfei']) => { const St = await import('/src/systems/Story.ts'); return new St.StoryDirector({ scene: s, chapterId, stage, ctx: { lord: team[0], team: () => team, recruited: () => false }, pause: () => s.setMode('story'), resume: () => s.setMode('none') }); };
  // 先把这次要用的立绘载好（游戏里 StoryDirector 开局就预载本关说话人；这里的导演是临时起的，测的是卡，不测磁盘快慢）
  await new Promise(r => { const keys = ['zhangjiao', 'lubu', 'dongzhuo', 'caoren', 'huaxiong'].map(k => 'ink_cast_' + k).filter(k => !s.textures.exists(k)); if (!s.textures.exists('ink_hero_zhangfei')) s.load.image('ink_hero_zhangfei', 'assets/ink-scroll/zhangfei.webp');
    for (const k of keys) s.load.image(k, 'assets/ink-cast/' + k.slice(9) + '.webp'); s.load.once('complete', r); s.load.start(); setTimeout(r, 8000); });
  window.__cards = () => s.children.list.filter(o => o.name === 'story-bark-card').map(o => ({ side: o.getData('side'), name: o.getData('name'), portrait: o.getData('portrait') ?? null, x: Math.round(o.x), y: Math.round(o.y), alpha: +o.alpha.toFixed(2) }));
});
await p.waitForTimeout(3200); // 首领自己的登场台词（若有）先放完
// ?story=1 时关前军情卷轴会开着（mode story）：收掉卷轴、回到战斗，再量「出卡不暂停」
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (const o of s.children.list.filter(o => typeof o.name === 'string' && o.name.startsWith('story-'))) o.destroy(); s.data.set('__storyBarkCards', undefined); if (s.mode === 'story') s.setMode('none'); });
await p.waitForTimeout(300);
// 1) 张角登场：右边出卡、立绘对、头顶只冒「！」、不暂停（mode 仍 none，战斗时钟在走）、约 3 秒后自己滑走
const r1 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), d = await window.__dir('huangjin', 3);
  // 立绘没载时卡会等最多 1.5 秒再出（机器忙时载得慢）：先等卡出来，出来 0.4 秒后看暂停与否，再量它多久自己收
  const t0 = s.combatNow, spoke = d.bossIntro(s.boss?.sprite ?? s.player.sprite); let at700 = [], tA = 0;
  for (let k = 0; k < 60 && !at700.length; k++) { await wait(50); at700 = window.__cards(); tA = performance.now(); }
  await wait(400); const mode = s.mode, ran = Math.round(s.combatNow - t0);
  const bubble = s.children.list.filter(o => o.name === 'story-bark').map(o => (function deep(x) { return x.type === 'Text' ? x.text : (x.list ?? []).map(deep).join(''); })(o));
  let gone = null; for (let k = 0; k < 80 && gone === null; k++) { if (!window.__cards().length) gone = Math.round(performance.now() - tA); else await wait(80); } // 卡共约 3.2 秒（滑入 0.26 + 停 2.7 + 滑出 0.26）
  const at3600 = gone !== null && gone <= 4500 ? [] : window.__cards();
  return { spoke, at700, mode, ran, bubble, gone, at3600 };
});

ck('张角登场：滑入侧边卡，立绘 ink_cast_zhangjiao，名字「张角」', r1.spoke && r1.at700.length === 1 && r1.at700[0].side === 'right' && r1.at700[0].portrait === 'ink_cast_zhangjiao' && r1.at700[0].name === '张角', r1);
ck('电脑布局：敌方台词也在左下角（卡左边 ≤ 120、顶边 ≥ 280）', r1.at700.length === 1 && r1.at700[0].x <= 120 && r1.at700[0].y >= 280, r1.at700[0]);
ck('不暂停：出卡时仍在战斗（mode none），战斗时钟照走', r1.mode === 'none' && r1.ran > 200 /* 机器忙时帧率低，0.7 秒真实时间里战斗时钟只走 0.3–0.9 秒；暂停时是 0 */, { mode: r1.mode, ran: r1.ran });
ck('头顶不重复台词：只冒一个「！」（没有大字整句）', !r1.bubble.some(t => t.includes('苍天') || t.length > 4), r1.bubble);
ck('约 3 秒后自己滑走（出现后 4.5 秒内收掉）', r1.at3600.length === 0, r1.at3600);
// 2) 排队：2-3 吕布、董卓挨着喊，同一时刻只有一张卡，先吕布、再董卓
const r2 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), d = await window.__dir('hulao', 3);
  for (let k = 0; k < 80 && window.__cards().length; k++) await wait(80); // 等上一张收完
  const tgt = s.boss?.sprite ?? s.player.sprite; d.line('hulao-3.lubu_enter', tgt); await wait(80); d.line('hulao-3.dongzhuo_enter', tgt); const seen = []; let maxAt = 0;
  for (let t = 0; t < 70; t++) { const c = window.__cards(); maxAt = Math.max(maxAt, c.length); for (const x of c) { const k = x.name + '|' + x.portrait; if (seen[seen.length - 1] !== k) seen.push(k); } await wait(100); }
  return { seen, maxAt };
});
ck('排队：挨着喊的两句一张一张出（同时最多 1 张），先吕布、再董卓，各是自己的立绘', r2.maxAt === 1 && r2.seen.join() === '吕布|ink_cast_lubu,董卓|ink_cast_dongzhuo', r2);
// 3) 我方从左边：2-3 张飞「三姓家奴！」（张飞在队）
const r3 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), d = await window.__dir('hulao', 3, ['liubei', 'guanyu', 'zhangfei']);
  for (let k = 0; k < 80 && window.__cards().length; k++) await wait(80); const spoke = d.line('hulao-3.zhangfei_jeer', s.player.sprite); let c = []; for (let k = 0; k < 60 && !c.length; k++) { await wait(50); c = window.__cards(); } await wait(400); c = window.__cards(); await wait(3200); return { spoke, c };
});
ck('我方同在左下：张飞「三姓家奴！」我方卡、武将水墨立绘、与敌方同一位置', r3.spoke && r3.c.length === 1 && r3.c[0].side === 'left' && r3.c[0].name === '张飞' && !!r3.c[0].portrait && r3.c[0].x <= 120, r3);
// 4) 三张登场截图：张角（上面已拍）、华雄、曹仁
for (const [ch, st, file] of [['huangjin', 3, 'zhangjiao-intro'], ['hulao', 1, 'huaxiong-intro'], ['chibi', 3, 'caoren-intro']]) {
  await p.evaluate(async ([ch, st]) => { const s = window.__game.scene.getScene('GameScene'), d = await window.__dir(ch, st); d.bossIntro(s.boss?.sprite ?? s.player.sprite); }, [ch, st]);
  await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${file}.png` }); await p.waitForTimeout(3000);
}
// 5) 剧情设置关掉：不出卡（导演也不说）
const r5 = await p.evaluate(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)); for (let k = 0; k < 80 && window.__cards().length; k++) await wait(80); /* 先等上一步截图的卡收完 */ localStorage.setItem('im_story', 'off'); const s = window.__game.scene.getScene('GameScene'), d = await window.__dir('huangjin', 1);
  const spoke = d.bossIntro(s.player.sprite); await wait(500); const c = window.__cards(); localStorage.removeItem('im_story'); return { spoke, c };
});
ck('剧情设置关掉：首领台词不说、不出卡', r5.spoke === false && r5.c.length === 0, r5);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
