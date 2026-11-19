// 首领台词卡三套设计稿截图（2026-11-19，给用户挑）：同一片怪多的战场，华雄登场（敌方、西凉骁将、董卓军赤色）分别用 A 电影感 / B 手卷 / C 极简。
// 输出 assets/review/barkcard-styles/style-{A,B,C}.png。用法：BASE=http://127.0.0.1:5173/ node tools/shot-barkcard-styles.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/barkcard-styles';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 }); await p.waitForTimeout(1200);
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms));
  for (const o of s.children.list.filter(o => typeof o.name === 'string' && o.name.startsWith('story-'))) o.destroy(); if (s.mode === 'story') s.setMode('none');
  s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
  setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40);
  for (let i = 0; i < 70; i++) { const e = s.spawnEnemy(i % 5 ? 'infantry' : 'archer', s.player.x + 60 + (i % 10) * 34, s.player.y - 160 + Math.floor(i / 10) * 40, 1); if (e) { e.hp = e.maxHp = 1e6; e.stunUntil = 1e12; } }
  await new Promise(r => { if (!s.textures.exists('ink_cast_huaxiong')) { s.load.image('ink_cast_huaxiong', 'assets/ink-cast/huaxiong.webp'); s.load.once('complete', r); s.load.start(); setTimeout(r, 6000); } else r(); });
  await wait(3200); for (const o of s.children.list.filter(o => o.name === 'story-bark-card')) o.destroy(); s.data.set('__storyBarkCards', undefined);
  const St = await import('/src/systems/Story.ts'); window.__say = () => new St.StoryDirector({ scene: s, chapterId: 'hulao', stage: 1, ctx: { lord: 'liubei', team: () => ['liubei', 'guanyu', 'zhangfei'], recruited: () => false }, pause: () => {}, resume: () => {} }).bossIntro(s.boss?.sprite ?? s.player.sprite);
});
for (const st of ['A', 'B', 'C']) {
  await p.evaluate(st => { localStorage.setItem('im_barkcard_style', st); window.__say(); }, st);
  // 等卡出来、入场动画（墨迹 / 展开 / 逐字）走完
  await p.waitForFunction(() => window.__game.scene.getScene('GameScene').children.list.some(o => o.name === 'story-bark-card'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(st === 'C' ? 1500 : 1000); await p.screenshot({ path: `${out}/style-${st}.png` });
  await p.waitForFunction(() => !window.__game.scene.getScene('GameScene').children.list.some(o => o.name === 'story-bark-card'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300);
}
await p.evaluate(() => localStorage.removeItem('im_barkcard_style'));
console.log('→', `${out}/style-{A,B,C}.png`, 'errors', JSON.stringify(errors.slice(0, 3))); await b.close();
