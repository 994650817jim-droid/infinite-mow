// 剧情对白立绘补漏（2026-11-18 夜）：张世平在第一章章头说话（两种章头都有）；2-3 战斗中途卷轴（董卓吕布上城头 / 董卓下城，
// StoryDirector.midScroll）显示董卓 / 吕布对白立绘、暂停战斗、每存档一次。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-story-cast.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 60000 }); await p.waitForTimeout(1200);
// 1) 张世平：桃园三兄弟主公与其他主公两种章头都有他那句
const zsp = await p.evaluate(async () => { const St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'), n = D.STORY_CHAPTERS.huangjin.open;
  const r = lord => St.resolveLines(n, { lord, team: () => [lord], recruited: () => false }).map(l => (l.who ?? '') + ':' + l.text);
  return { liubei: r('liubei').filter(t => t.startsWith('zhangshiping:')), zhaoyun: r('zhaoyun').filter(t => t.startsWith('zhangshiping:')) }; });
ck('第一章章头：张世平赠马金铁资助义军（三兄弟主公、其他主公两种章头都有）', zsp.liubei.length === 1 && zsp.zhaoyun.length === 1, zsp);
// 2) 2-3 中途卷轴：在战斗场景里直接起一个 hulao 第 3 关的导演，按 id 播
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), St = await import('/src/systems/Story.ts'), wait = ms => new Promise(r => setTimeout(r, ms));
  localStorage.setItem('im_story_seen_v1', '[]');
  const find = n => { const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.name === n) return o; if (o.list) q.push(...o.list); } return null; };
  let paused = 0, resumed = 0, done = 0;
  const dir = new St.StoryDirector({ scene: s, chapterId: 'hulao', stage: 3, ctx: { lord: 'liubei', team: () => ['liubei', 'guanyu', 'zhangfei'], recruited: () => false }, pause: () => paused++, resume: () => resumed++ });
  const played = dir.midScroll('hulao-3.on_wall', () => done++);
  for (let t = 0; t < 40 && !find('story-hulao-3-on_wall-next') && !find('story-confirm'); t++) await wait(100);
  await wait(300);
  const faces = []; const face = () => { const f = find('story-hulao-3-on_wall-portrait'); return f?.visible ? f.texture.key : null; };
  faces.push(face());
  for (let k = 0; k < 8; k++) { const h = find('story-hulao-3-on_wall-next'); if (h) { h.emit('pointerup'); h.emit('pointerdown'); await wait(200); faces.push(face()); continue; }
    const c = find('story-confirm'); if (c) { c.emit('pointerup'); c.emit('pointerdown'); } await wait(300); break; }
  await wait(400);
  const again = dir.midScroll('hulao-3.on_wall');
  const descend = dir.midScroll('hulao-3.dongzhuo_descend'); await wait(500); const dFace = (() => { const f = find('story-hulao-3-dongzhuo_descend-portrait'); return f?.visible ? f.texture.key : null; })();
  for (let k = 0; k < 8; k++) { const h = find('story-hulao-3-dongzhuo_descend-next'); if (h) { h.emit('pointerup'); h.emit('pointerdown'); await wait(200); continue; } const c = find('story-confirm'); if (c) { c.emit('pointerup'); c.emit('pointerdown'); } await wait(300); break; }
  const missing = dir.midScroll('hulao-3.nope');
  return { played, faces: [...new Set(faces.filter(Boolean))], paused, resumed, done, seen: JSON.parse(localStorage.getItem('im_story_seen_v1') ?? '[]'), again, descend, dFace, missing };
});
ck('2-3「国贼与飞将」卷轴：董卓、吕布对白立绘都露脸，播时暂停战斗、播完恢复并回调', r.played && r.faces.includes('ink_cast_dongzhuo') && r.faces.includes('ink_cast_lubu') && r.paused >= 1 && r.resumed >= 1 && r.done === 1, r);
ck('2-3 中途卷轴每存档一次（看过不再播）；「董卓下城」卷轴显示董卓立绘；没有这一段返回 false', r.seen.includes('hulao-3.on_wall') && r.again === false && r.descend && r.dFace === 'ink_cast_dongzhuo' && r.missing === false, r);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
