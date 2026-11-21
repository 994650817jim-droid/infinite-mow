// 对白卡实机对比图：往 2-3 中途卷轴里临时塞一段「新旧立绘轮流说话」的对白，每句各截一张，存 assets/review/story-portraits/。
// 用法：BASE=http://127.0.0.1:5262/ WHO=zhangliao,liuxun,fazheng,zhouyu,masu,jiangwei node tools/shot-story-portraits.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/story-portraits', WHO = (E.WHO ?? 'zhangliao,liuxun,fazheng,zhouyu,masu,jiangwei').split(',');
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(1200);
await p.evaluate(async who => {
  const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts');
  const ch = D.STORY_CHAPTERS.hulao; ch.midScrolls = [...(ch.midScrolls ?? []), { id: 'hulao-3.portrait_test', type: 'bark', external: true, kicker: '对白立绘对比', title: '新旧水墨立绘', lines: who.map(w => ({ who: w, text: '这是对白卡上的立绘效果，请对比新旧人物的画风与大小。' })) }];
  const s = window.__game.scene.getScene('GameScene'); window.__dir = new St.StoryDirector({ scene: s, chapterId: 'hulao', stage: 3, ctx: { lord: 'liubei', team: () => ['liubei'], recruited: () => false }, pause: () => {}, resume: () => {} });
  window.__dir.midScroll('hulao-3.portrait_test');
}, WHO);
await p.waitForTimeout(1500);
for (let k = 0; k < WHO.length; k++) {
  await p.screenshot({ path: `${OUT}/${String(k + 1).padStart(2, '0')}_${WHO[k]}.png` });
  const nxt = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const find = n => { const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.name === n) return o; if (o.list) q.push(...o.list); } return null; }; const f = find('story-hulao-3-portrait_test-next') ?? find('story-confirm'); if (f) { f.emit('pointerup'); f.emit('pointerdown'); return true; } return false; });
  await p.waitForTimeout(600); if (!nxt) break;
}
console.log('页面错误：', errs.slice(0, 3)); await b.close();
