// 开场动画（2026-11-18 用户「开场动画播完再进游戏界面」「做好衔接和bgm和cg也要配上相应的字体」）：
// 四段分播 + 水墨晕染转场（手绘墨迹遮罩）+ 书法字幕 + 标识朱印；首次启动播放、跳过有效、播完进主页、设置（每次 / 首次 / 关闭）生效、重看入口。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-opening.mjs   截图在 assets/review/opening/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/opening';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use|opening_theme/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } });
const active = () => p.evaluate(() => window.__game?.scene.getScenes(true).map(s => s.scene.key) ?? []);
const go = async () => { await p.goto(base + '?layout=desktop&opening=auto'); await p.waitForFunction(() => { const g = window.__game; return g && (g.scene.isActive('OpeningScene') || g.scene.isActive('MenuScene')); }, null, { timeout: 120000 }); };
const O = "window.__game.scene.getScene('OpeningScene')";
const seek = t => p.evaluate(([O0, t0]) => eval(O0).seekTo(t0), [O, t]);

// ① 首次启动：播开场（第一段）
await go();
ck('首次启动先播开场动画（不是直接进主页）', (await active()).includes('OpeningScene'), await active());
await p.waitForFunction(O0 => eval(O0).clock > .8, O, { timeout: 15000 }).catch(() => {});
const v0 = await p.evaluate(O0 => { const s = eval(O0), v = s.segs[0].v; return { clock: s.clock, t: v.video?.currentTime, vis: v.visible, w: v.video?.videoWidth, segs: s.segs.length, skip: !!s.children.getByName('opening-skip'), ink: s.textures.exists('opening_ink_bloom') }; }, O);
ck('四段视频就绪，第一段在播（已裁角标版 1280×720）、右下角有「跳过」、墨迹遮罩图已载入', v0.t > 0 && v0.vis && v0.w === 1280 && v0.segs === 4 && v0.skip && v0.ink, v0);
await p.screenshot({ path: `${out}/opening-start-1280x720.png` });
await p.screenshot({ path: `${out}/opening-skip-button.png`, clip: { x: 1060, y: 630, width: 220, height: 90 } });
// ② 字幕：书法字逐字晕出（第一句 + 小字口号）
await p.waitForFunction(O0 => eval(O0).clock > 2.4, O, { timeout: 15000 }).catch(() => {});
const sub = await p.evaluate(O0 => { const s = eval(O0), cs = s.children.list.filter(o => o.name === 'opening-line-char'); return { n: cs.length, text: cs.map(c => c.text).join(''), font: cs[0]?.style.fontFamily, shown: cs.filter(c => c.alpha > .9).length }; }, O);
ck('字幕「中平元年 黄巾蜂起 / 苍天已死 黄天当立」用书法标题字、逐字晕出', sub.text === '中平元年黄巾蜂起苍天已死黄天当立' && /IMWarTitle/.test(sub.font ?? '') && sub.shown >= 8, sub);
await p.screenshot({ path: `${out}/opening-subtitle-1280x720.png` });
// ③ 水墨晕染转场：第二段 4.3 秒起，带墨迹遮罩与浓墨墨缘；0.8 秒后撤掉遮罩、停掉上一段
await seek(4.55); await p.waitForTimeout(250);
const tr = await p.evaluate(O0 => { const s = eval(O0), g = s.segs[1]; return { clock: s.clock, started: g.started, mask: !!g.v.mask, rim: !!g.rim, prevVis: s.segs[0].v.visible }; }, O);
ck('4.3 秒起第二段从墨迹中显出（手绘墨迹遮罩 + 墨缘），上一段仍在下面', tr.started && tr.mask && tr.rim && tr.prevVis, tr);
await p.screenshot({ path: `${out}/opening-ink-transition-1280x720.png` });
await p.waitForTimeout(900);
const tr2 = await p.evaluate(O0 => { const s = eval(O0), g = s.segs[1]; return { settled: g.settled, mask: !!g.v.mask, prevVis: s.segs[0].v.visible }; }, O);
ck('转场 0.8 秒后撤掉遮罩、停掉上一段', tr2.settled && !tr2.mask && !tr2.prevVis, tr2);
// ④ 第四段：14.5 秒标识淡入、朱印盖下
await seek(14.4); await p.waitForTimeout(2600);
const t1 = await p.evaluate(O0 => { const s = eval(O0); return { clock: s.clock, title: s.title?.alpha, seal: s.seal?.alpha, shown: s.titleShown, hit: s.hitDone, seg4: s.segs[3].settled }; }, O);
ck('13.2 秒重击、14.5 秒起上方留白处淡入水墨标识，朱印盖下', t1.shown && t1.hit && t1.title > .9 && t1.seal > .9 && t1.seg4, t1);
await p.screenshot({ path: `${out}/opening-title-1280x720.png` });
// ⑤ 播完进主页，记「已播过」
await seek(19.9);
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 15000 }).catch(() => {});
ck('20 秒播完自动进主页，并记已播过', (await active()).includes('MenuScene') && await p.evaluate(() => localStorage.getItem('im_opening_seen') === '1'), await active());
// ⑥ 默认「首次」：再启动直接进主页
await go();
ck('默认「首次」：第二次启动不再播', (await active()).includes('MenuScene') && !(await active()).includes('OpeningScene'), await active());
// ⑦ 主页设置改「每次」→ 每次启动都播；任意键跳过（画面淡出）
const set = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.openHomeSettings(); const panel = m.children.getByName('home-settings-panel'), row = panel.list.find(o => o.name === 'settings-opening'); const dec = panel.list.find(o => /^settings-row-\d+-dec$/.test(o.name) && Math.abs(o.y - row.y) < 2); const before = row.text; dec.emit('pointerdown'); return { before, after: row.text, stored: localStorage.getItem('im_opening'), replay: !!panel.list.find(o => o.name === 'settings-opening-replay') }; });
ck('主页设置有「开场动画」行（首次 → 每次）并存档；有「重看开场」', set.before === '首次' && set.after === '每次' && set.stored === 'every' && set.replay, set);
await go();
const every = await active();
await p.waitForTimeout(1200); await p.keyboard.press('Space');
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 10000 }).catch(() => {});
ck('「每次」：再启动又播；按任意键跳过进主页', every.includes('OpeningScene') && (await active()).includes('MenuScene'), { every, now: await active() });
// ⑧ 「重看开场」入口；点「跳过 ›」
await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.openHomeSettings(); m.children.getByName('home-settings-panel').list.find(o => o.name === 'settings-opening-replay').emit('pointerdown'); });
await p.waitForFunction(() => window.__game.scene.isActive('OpeningScene'), null, { timeout: 10000 }).catch(() => {});
const replay = (await active()).includes('OpeningScene');
await p.waitForTimeout(1200);
await p.evaluate(O0 => eval(O0).children.getByName('opening-skip').emit('pointerdown'), O);
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 10000 }).catch(() => {});
ck('设置里「重看开场」重播；点「跳过 ›」回主页', replay && (await active()).includes('MenuScene'), await active());
// ⑨ 「关闭」：不播；战斗内设置也有同一行
await p.evaluate(() => localStorage.setItem('im_opening', 'off'));
await go();
ck('「关闭」：启动不播', !(await active()).includes('OpeningScene'), await active());
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(800);
const bat = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.togglePause(); const t = s.pausePanel.list.find(o => o.name === 'settings-opening'); const before = t?.text; s.pausePanel.list.find(o => o.name === 'settings-opening-inc')?.emit('pointerdown'); return { before, after: t?.text, stored: localStorage.getItem('im_opening') }; });
ck('战斗内设置也有「开场动画」行，同一存档键', bat.before === '关闭' && bat.after === '每次' && bat.stored === 'every', bat);
await p.screenshot({ path: `${out}/battle-settings-opening-row.png` });
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
