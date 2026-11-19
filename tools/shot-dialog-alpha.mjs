// 战斗中对白半透明（2026-11-19 用户：「对话框想半透明」）前后对比截图：怪多的战场上，侧边立绘卡（张角登场）与战斗中途卷轴（2-3「国贼与飞将」）。
// 输出 assets/review/dialog-alpha/<TAG>-{card,midscroll}.png。用法：BASE=http://127.0.0.1:5173/ TAG=after node tools/shot-dialog-alpha.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/dialog-alpha';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 }); await p.waitForTimeout(1200);
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms));
  for (const o of s.children.list.filter(o => typeof o.name === 'string' && o.name.startsWith('story-'))) o.destroy(); if (s.mode === 'story') s.setMode('none');
  s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
  setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40);
  // 热闹的战场：右半屏一大片兵（卡片就压在上面）
  for (let i = 0; i < 70; i++) { const e = s.spawnEnemy(i % 5 ? 'infantry' : 'archer', s.player.x + 60 + (i % 10) * 34, s.player.y - 160 + Math.floor(i / 10) * 40, 1); if (e) { e.hp = e.maxHp = 1e6; e.stunUntil = 1e12; } }
  await wait(3000); for (const o of s.children.list.filter(o => o.name === 'story-bark-card')) o.destroy(); s.data.set('__storyBarkCards', undefined);
  const St = await import('/src/systems/Story.ts'); window.__mk = (ch, st) => new St.StoryDirector({ scene: s, chapterId: ch, stage: st, ctx: { lord: 'liubei', team: () => ['liubei', 'guanyu', 'zhangfei'], recruited: () => false }, pause: () => s.setMode('story'), resume: () => s.setMode('none') });
});
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); window.__mk('huangjin', 3).bossIntro(s.boss?.sprite ?? s.player.sprite); });
await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${tag}-card.png` }); await p.waitForTimeout(3000);
await p.evaluate(() => { localStorage.setItem('im_story_seen_v1', '[]'); window.__mk('hulao', 3).midScroll('hulao-3.on_wall'); });
await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-midscroll.png` });
console.log('→', `${out}/${tag}-{card,midscroll}.png`); await b.close();
