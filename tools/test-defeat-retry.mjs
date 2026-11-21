// 第一章败走「再战此关」与入营战报（2026-11-21 总制作人验收退回）：电脑布局 1280×720。
// ① 1-1 告捷 → 行营：战报无大框；战报在时军医气泡 / 新玩法说明 / 营中闲话先收起，战报收起后再出；闲话条在右下、不压「军医」名牌。
// ② 率军出征进 1-2（带征程接力），阵亡 → 败走面板出来时阵亡台词卡已收掉；点「再战此关」（result-restart）→ 原地重开 1-2，等级 / 部曲同开局时。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-defeat-retry.mjs   截图 assets/review/defeat-retry/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defeat-retry';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('dr')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'on'); sessionStorage.setItem('dr', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop', { timeout: 180000 });
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, arg) => p.evaluate(([S0, f, a]) => eval('(' + f + ')')(eval(S0), a), [G, String(fn), arg]);
const hide = () => p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
const waitMode = async (m, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const cur = await ev(s => s?.mode).catch(() => null); if (cur === m) return true; await p.waitForTimeout(250); } return false; };
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 180000 });
await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); s.__DEV_ACTIONS.closePopup?.(); s.player.level = 4; s.player.hp = Math.round(s.player.maxHp * .4); /* 带伤入营：行营开在军医页（同制作人截图） */ });
// ① 1-1 告捷 → 行营
await ev(s => s.__DEV_ACTIONS.winNow());
for (let i = 0; i < 150 && !(await ev(s => s.mode === 'rest')); i++) { await ev(s => { if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode === 'bossloot' || s.mode === 'levelup') s.__DEV_ACTIONS?.closePopup?.(); const c = s.bossChests?.find(c => !c.done && c.ready); if (c) { s.player.sprite.x = c.x; s.player.sprite.y = c.y; } }); await p.waitForTimeout(200); } // 首领宝箱、三选一走完才入营
for (let i = 0; i < 60 && !(await ev(s => s.mode === 'rest' && s.campUI.root.visible && !s.children.getByName('rest-intro'))); i++) { await ev(s => { const t = s.children.list.find(o => /rest-intro|relic-notice|boss-relic/.test(o.name ?? '')); t?.emit?.('pointerdown'); }); await p.waitForTimeout(250); }
// 测试战斗（?dev=1）不发永久奖励、战报行为空：补上战报几行再放一次战报（正式模式下入营自动出）
await ev(s => { s.children.getByName('rest-summary')?.emit('pointerdown'); const tab = s.campUI.root.list.find(o => /^camp-tab-/.test(o.name ?? '') && s.campUI.root.list.some(x => x.type === 'Text' && x.text === '军医' && Math.abs(x.x - o.x) < 120 && Math.abs(x.y - o.y) < 40)); tab?.emit('pointerdown'); }); await p.waitForTimeout(600); // 切到军医页（有军医气泡，同制作人截图）
await ev(s => { { s.resultTexts.body.setText(['武将等级  Lv.1 → Lv.4', '本场战功  +12', '武学残卷  +8', '首次通关  经验 +42'].join(String.fromCharCode(10))); s.showRestSummary(); } });
let sum = null;
for (let i = 0; i < 40; i++) { sum = await ev(s => { const card = s.children.getByName('rest-summary-card'); if (!card) return null; const vis = []; const walk = l => { for (const o of l) { if (o.visible && /^(camp-(medic|merchant)-art-(bubble|line)|camp-talk)$/.test(o.name ?? '')) vis.push(o.name); if (o.list) walk(o.list); } }; walk(s.children.list); return { card: true, framed: false, shownUnder: vis, detail: s.campUI?.detail?.visible ?? null }; }); if (sum) break; await p.waitForTimeout(250); }
await hide(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/rest-summary.png` });
ck('入营战报出现时：军医气泡 / 新玩法说明 / 营中闲话都先收起', !!sum && sum.shownUnder.length === 0 && sum.detail !== true, sum);
// 不点：约 4 秒自己收起（2026-11-21 总制作人：原来压在卡片上不走、也没提示）
const tipShown = await ev(s => s.children.getByName('rest-summary-card')?.list.some(o => o.type === 'Text' && /点击任意处收起/.test(o.text)) ?? false);
await p.waitForTimeout(4400);
const gone = await ev(s => !s.children.getByName('rest-summary-card') && !s.children.getByName('rest-summary'));
ck('入营战报：有「点击任意处收起」提示，约 4 秒自己收起', tipShown && gone, { tipShown, gone });
await p.waitForTimeout(900);
const after = await ev(s => { const vis = []; const walk = l => { for (const o of l) { if (o.visible && /^(camp-(medic|merchant)-art-(bubble|line)|camp-talk)$/.test(o.name ?? '')) vis.push(o.name); if (o.list) walk(o.list); } }; walk(s.children.list); const t = s.children.getByName('camp-talk'); return { vis, detail: s.campUI?.detail?.visible ?? null, talkX: t ? Math.round(t.x) : null }; });
await hide(); await p.screenshot({ path: `${OUT}/rest-after-summary.png` });
ck('战报收起后：军医气泡 / 新玩法说明回来；闲话条（若有）在右下', after.vis.some(n => /bubble$/.test(n)) && (after.talkX === null || after.talkX > 600), after);
// ② 出征 1-2，记下开局等级；阵亡
await ev(s => s.campUI?.root?.getByName?.('camp-depart')?.emit?.('pointerdown') ?? s.continueCampaign?.());
await p.waitForTimeout(800);
await ev(s => { const d = s.children.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => o.name === 'camp-depart'); d?.emit('pointerdown'); d?.emit('pointerup'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); if (s?.mode === 'levelup' || s?.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); if (s?.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } return s?.player && s.chapter?.stage === 2 && s.mode === 'none'; }, null, { timeout: 120000, polling: 500 });
await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); s.__DEV_ACTIONS.closePopup?.(); });
const start12 = await ev(s => ({ stage: s.chapter.stage, level: s.player.level, troops: s.legion?.count ?? 0 }));
await ev(s => { s.player.damageImmune = false; s.player.hp = 1; s.finish(false, 'death'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s.resultPanel?.visible; }, null, { timeout: 20000 });
await p.waitForTimeout(1500);
const panel = await ev(s => ({ barks: s.children.list.filter(o => /^story-bark-card/.test(o.name ?? '') && o.visible).length, retry: s.resultPanel.getByName('result-restart')?.text, home: s.resultPanel.getByName('result-home-text')?.text, sub: s.resultTexts.subtitle.text }));
await hide(); await p.screenshot({ path: `${OUT}/defeat-panel.png` });
ck('败走面板出现时阵亡台词卡已收掉', panel.barks === 0, panel);
ck('败走面板：「再战此关」（result-restart）+「返回主菜单」', panel.retry === '再战此关' && panel.home === '返回主菜单', panel);
await ev(s => { const o = s.resultPanel.getByName('result-restart'); o.emit('pointerdown'); o.emit('pointerup'); });
await p.waitForTimeout(3500);
const re = await p.evaluate(() => { const g = window.__game; const s = g.scene.getScene('GameScene'); return { active: g.scene.getScenes(true).map(x => x.scene.key), stage: s?.chapter?.stage, level: s?.player?.level, troops: s?.legion?.count ?? 0, mode: s?.mode, elapsed: +(s?.elapsed ?? -1).toFixed(1) }; });
await hide(); await p.screenshot({ path: `${OUT}/after-retry.png` });
ck('点「再战此关」：直接重开 1-2（仍在战斗场景、不回主页）', re.active.includes('GameScene') && !re.active.includes('MenuScene') && re.stage === 2 && re.elapsed < 20, re);
ck('重开后：等级 / 部曲同 1-2 开局（征程接力带回）', re.level === start12.level && re.troops === start12.troops, { start12, re });
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
await b.close();
process.exit(fail ? 1 : 0);
