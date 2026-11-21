// 剧情对话出场「黑框一闪」检查（2026-11-20 用户「每次剧情对话会先浮现出一个黑框框然后快速消失」）：
// 战中台词卡、首领登场卡、开战简报、降将来投、劝降——每种触发后从游戏画布逐帧抓图（每次渲染完、约每 30ms 一帧），
// 从「第一次出现」的前一帧起抓：台词卡抓 700ms（旧的入场墨迹 0–680ms），其余抓 330ms。
// 输出：<dir>/<prefix>-<case>.png 联络图；控制台 JSON 每帧「新增近黑像素 %」（亮度 < 28、触发前那帧不黑的像素，全屏 1/4 采样）。
// 判读：台词卡区域不该出现一大块新增暗色（旧版峰值来自转图丢了透明通道的墨迹晕开）；简报 / 劝降本来就是整屏压暗的弹窗。
// 用法：BASE=http://127.0.0.1:5173/ node tools/shot-story-flash.mjs <输出目录> <前缀>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', dir = process.argv[2] ?? '.', pre = process.argv[3] ?? 'flash';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(base + '?dev=1&autostart=1&stage=2&layout=desktop&story=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), g = window.__game;
  for (const o of s.children.list.filter(o => typeof o.name === 'string' && o.name.startsWith('story-'))) o.destroy();
  if (s.mode === 'story') s.setMode('none'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
  s.openUpgrade = s.openUpgradeNow = () => {}; // 抓帧期间不弹升级窗（否则整屏压暗混进结果）
  window.__calm = async () => { for (let k = 0; k < 40 && s.mode !== 'none'; k++) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); else s.__DEV_ACTIONS.closePopup?.(); if (s.mode === 'story') s.setMode('none'); await new Promise(r => setTimeout(r, 100)); } return s.mode; };
  window.__dir = async (chapterId, stage, team = ['liubei', 'guanyu', 'zhangfei']) => { const St = await import('/src/systems/Story.ts'); return new St.StoryDirector({ scene: s, chapterId, stage, pause: () => { if (s.mode === 'none') s.setMode('story'); }, resume: () => { if (s.mode === 'story') s.setMode('none'); }, ctx: { lord: team[0], team: () => team, recruited: () => false } }); };
  window.__clear = () => { for (const o of s.children.list.filter(o => typeof o.name === 'string' && (o.name.startsWith('story-') || o.name === 'boss-announce'))) o.destroy(); s.data.set('__storyBarkCards', undefined); s.parley?.clear?.(); s.parley = null; s.storyHolds = 0; if (s.mode === 'story') s.setMode('none'); };
  window.__re = /^(story-|parley|boss-announce)/;
  window.__present = () => s.children.list.some(o => o.visible !== false && typeof o.name === 'string' && window.__re.test(o.name));
  // 每次渲染完（postrender，WebGL 缓冲还在）若距上一张 ≥ 28ms 就把画布缩到 640×360 存一张
  window.__grab = (ms) => new Promise(res => {
    const out = [], t0 = performance.now(); let last = -1e9;
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const cx = cv.getContext('2d', { willReadFrequently: true });
    const snap = () => { const t = performance.now() - t0; if (t - last < 28 && out.length) return; last = t; cx.drawImage(g.canvas, 0, 0, 640, 360); out.push({ t: Math.round(t), on: window.__present(), url: cv.toDataURL('image/jpeg', .8), px: cx.getImageData(0, 0, 640, 360).data }); };
    g.events.on('postrender', snap);
    setTimeout(() => { g.events.off('postrender', snap); res(out); }, ms);
  });
});
await p.waitForTimeout(3500);
// [名字, 认「出现」的对象名正则（字符串）, 抓多久 ms, 触发函数]
const cases = [
  ['battle', '^story-bark-card$', 700, async () => { const s = window.__game.scene.getScene('GameScene'), d = await window.__dir('hulao', 3); d.line('hulao-3.zhangfei_jeer', s.player.sprite); }],
  ['bossIntro', '^story-bark-card$', 700, async () => { const s = window.__game.scene.getScene('GameScene'), d = await window.__dir('huangjin', 3); d.bossIntro(s.boss?.sprite ?? s.player.sprite); }],
  ['brief', '^story-', 330, async () => { const s = window.__game.scene.getScene('GameScene'), St = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts'); const n = D.STORY_CHAPTERS.huangjin.stages[2].brief, ctx = { lord: 'liubei', team: () => ['liubei', 'guanyu', 'zhangfei'], recruited: () => false }; s.setMode('story'); St.playStoryScroll(s, n, St.resolveLines(n, ctx), ctx, '开战', () => {}); }],
  ['surrender', '^story-', 330, async () => { const s = window.__game.scene.getScene('GameScene'), S = await import('/src/data/surrender.ts'), St = await import('/src/systems/Story.ts'); const d = S.surrenderDef('hulao-1:huaxiong'); St.storyBark(s, s.boss?.sprite ?? s.player.sprite, d.name, S.surrenderLine(d, true, { lord: 'liubei', team: [], surrendered: [] })); }],
  ['parley', '^(parley|story-)', 330, async () => { const s = window.__game.scene.getScene('GameScene'), S = await import('/src/data/surrender.ts'); s.parley = s.makeParley(() => s.boss, S.surrenderDef('hulao-1:huaxiong')); s.boss.hp = Math.max(1, Math.floor(s.boss.maxHp * .1)); s.parley.open(); }],
];
const report = {};
for (const [name, re, win, fn] of cases) {
  await p.evaluate(() => window.__clear()); const m = await p.evaluate(() => window.__calm()); if (m !== 'none') console.log(name, 'mode still', m); await p.waitForTimeout(700);
  const res = await p.evaluate(async ({ src, re, win }) => {
    window.__re = new RegExp(re);
    const fn = eval('(' + src + ')'); const base = (await window.__grab(40))[0];
    const grabP = window.__grab(3000 + win); fn(); const all = await grabP;
    const k1 = all.findIndex(f => f.on); if (k1 < 0) return { missing: true, stats: [], urls: [], t: [] }; const k0 = Math.max(0, k1 - 1), tStart = all[k0]?.t ?? 0, frames = all.filter((f, i) => i >= k0 && f.t - tStart <= win + 10).map(f => ({ ...f, t: f.t - tStart }));
    const dark = (d, i) => d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 < 28;
    const stats = frames.map(f => { let n = 0; for (let i = 0; i < f.px.length; i += 16) if (dark(f.px, i) && !dark(base.px, i)) n++; return { t: f.t, newDark: +(n / (f.px.length / 16) * 100).toFixed(2) }; });
    return { stats, urls: frames.map(f => f.url), t: frames.map(f => f.t) };
  }, { src: fn.toString(), re, win });
  if (res.missing) console.log(name, 'NOT SHOWN within window');
  report[name] = { peak: Math.max(0, ...res.stats.map(s => s.newDark)), frames: res.stats.map(s => `${s.t}:${s.newDark}`).join(' ') };
  const cells = res.urls.map((u, i) => `<div style="position:relative"><img src="${u}" width="320"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:bold 14px sans-serif;text-shadow:0 0 3px #000">${res.t[i]}ms</span></div>`).join('');
  const sheet = await b.newPage({ viewport: { width: 1300, height: 400 } });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:16px sans-serif"><div style="padding:4px">${pre} · ${name}（从出现前一帧起逐帧，约 30ms 一帧，抓 ${win}ms）</div><div style="display:grid;grid-template-columns:repeat(4,320px);gap:4px;padding:4px">${cells}</div></body>`);
  await sheet.screenshot({ path: `${dir}/${pre}-${name}.png`, fullPage: true }); await sheet.close();
  await p.waitForTimeout(400);
}
console.log(JSON.stringify(report, null, 1));
console.log(errors.length ? 'errors: ' + errors.slice(0, 3).join(' | ') : 'ok');
await b.close();
