// 剧情对话卡改前 / 改后截图（电脑布局 1280×720）：开战军情简报（1-2 下曲阳）、首领出场、首领倒下、战中对话（我方）、劝降弹窗、降将来投台词。
// 用法：BASE=http://127.0.0.1:5173/ node tools/shot-story-cards.mjs <输出目录> <前缀>
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', dir = process.argv[2] ?? '.', pre = process.argv[3] ?? 'story';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.removeItem('im_story_seen_v1'); sessionStorage.setItem('s', '1'); } });
// 1) 开战军情简报：1-2（?story=1 开局就弹）
await p.goto(base + '?dev=1&autostart=1&stage=2&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').children.list.some(o => typeof o.name === 'string' && o.name.startsWith('story-') && o.visible), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(1800);
await p.screenshot({ path: `${dir}/${pre}-brief.png` });
// 收掉简报，放首领，起导演
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene');
  for (const o of s.children.list.filter(o => typeof o.name === 'string' && o.name.startsWith('story-'))) o.destroy();
  if (s.mode === 'story') s.setMode('none'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
  setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 60);
  window.__dir = async (chapterId, stage, team = ['liubei', 'guanyu', 'zhangfei']) => { const St = await import('/src/systems/Story.ts'); return new St.StoryDirector({ scene: s, chapterId, stage, pause: () => { if (s.mode === 'none') s.setMode('story'); }, resume: () => { if (s.mode === 'story') s.setMode('none'); }, ctx: { lord: team[0], team: () => team, recruited: () => false } }); };
  await new Promise(r => { const keys = ['zhangjiao', 'huaxiong', 'lubu', 'dongzhuo'].map(k => 'ink_cast_' + k).filter(k => !s.textures.exists(k)); if (!s.textures.exists('ink_hero_zhangfei')) s.load.image('ink_hero_zhangfei', 'assets/ink-scroll/zhangfei.webp');
    for (const k of keys) s.load.image(k, 'assets/ink-cast/' + k.slice(9) + '.webp'); s.load.once('complete', r); s.load.start(); setTimeout(r, 8000); });
  window.__clearCards = () => { for (const o of s.children.list.filter(o => o.name === 'story-bark-card')) o.destroy(); s.data.set('__storyBarkCards', undefined); };
  window.__waitCard = async () => { for (let k = 0; k < 80; k++) { const c = s.children.list.find(o => o.name === 'story-bark-card'); if (c && c.alpha >= .99) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
});
await p.waitForTimeout(3500); await p.evaluate(() => window.__clearCards());
const shot = async (name, fn) => { await p.evaluate(() => window.__clearCards()); await p.evaluate(fn); await p.evaluate(() => window.__waitCard()); await p.waitForTimeout(900); await p.screenshot({ path: `${dir}/${pre}-${name}.png` }); };
// 2) 首领出场（1-3 张角）
await shot('bossIntro', async () => { const s = window.__game.scene.getScene('GameScene'), d = await window.__dir('huangjin', 3); window.__d3 = d; d.bossIntro(s.boss?.sprite ?? s.player.sprite); });
// 3) 首领倒下
await shot('bossFall', async () => { const s = window.__game.scene.getScene('GameScene'); window.__d3.bossFall(s.boss?.sprite ?? s.player.sprite); });
// 4) 战中对话（我方张飞）
await shot('battle', async () => { const s = window.__game.scene.getScene('GameScene'), d = await window.__dir('hulao', 3); d.line('hulao-3.zhangfei_jeer', s.player.sprite); });
// 5) 劝降弹窗（华雄）
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), S = await import('/src/data/surrender.ts'); window.__clearCards();
  s.parley?.clear?.(); s.parley = s.makeParley(() => s.boss, S.surrenderDef('hulao-1:huaxiong')); s.boss.hp = Math.max(1, Math.floor(s.boss.maxHp * .1)); s.parley.open();
});
await p.waitForTimeout(900); await p.screenshot({ path: `${dir}/${pre}-parley.png` });
// 6) 降将来投台词（华雄归降）
await shot('surrender', async () => { const s = window.__game.scene.getScene('GameScene'), S = await import('/src/data/surrender.ts'), St = await import('/src/systems/Story.ts'); s.parley?.clear?.(); s.parley = null; if (s.mode !== 'none') s.setMode('none'); const d = S.surrenderDef('hulao-1:huaxiong'); St.storyBark(s, s.boss?.sprite ?? s.player.sprite, d.name, S.surrenderLine(d, true, { lord: 'liubei', team: [], surrendered: [] })); });
console.log(errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
await b.close();
