// 战斗内「设置」（原暂停，电脑 1280×720）：按钮开面板并暂停、Esc 开关、各项即时生效并保存、刷新后保持、与主页设置同步。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-battle-settings.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/ui-round16';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
const boot = async () => { await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').pausePanel, null, { timeout: 90000 }); await p.waitForTimeout(800); await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; }, G); };
const find = `const f = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = f(o, n); if (x) return x; } return null; };`;
const click = name => p.evaluate(([G0, n]) => { const s = eval(G0); const f = (r, nn) => { for (const o of r.list ?? []) { if (o.name === nn) return o; const x = f(o, nn); if (x) return x; } return null; }; const o = f(s.pausePanel, n); o?.emit('pointerdown'); return !!o; }, [G, name]);
const val = name => p.evaluate(([G0, n]) => { const s = eval(G0); const f = (r, nn) => { for (const o of r.list ?? []) { if (o.name === nn) return o; const x = f(o, nn); if (x) return x; } return null; }; return f(s.pausePanel, n)?.text; }, [G, name]);
await boot();
// 1) HUD
const hud = await p.evaluate(G0 => { const h = eval(G0).hudTexts; return { pause: h.pause.text, mute: h.mute.visible, music: h.music.visible, bag: h.bag.visible }; }, G);
ck('右上「暂停」改成「设置」，音效 / 音乐按钮不在 HUD 上（挪进面板）', hud.pause === '设置' && !hud.mute && !hud.music && hud.bag, hud);
// 2) 点「设置」开面板并暂停
await p.evaluate(G0 => eval(G0).hudTexts.pause.emit('pointerdown'), G); await p.waitForTimeout(250);
const open = await p.evaluate(G0 => { const s = eval(G0); return { mode: s.mode, vis: s.pausePanel.visible, title: s.pausePanel.list.find(o => o.text === '军中设置')?.text }; }, G);
ck('点「设置」打开军中设置并暂停战斗', open.mode === 'pause' && open.vis && open.title === '军中设置', open);
await p.screenshot({ path: `${out}/after-settings-1280x720.png` });
// 3) Esc 关 / 开
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
const closed = await p.evaluate(G0 => eval(G0).mode, G);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
const reopened = await p.evaluate(G0 => eval(G0).mode, G);
ck('Esc 关闭 / 再按打开', closed === 'none' && reopened === 'pause', { closed, reopened });
// 4) 敌我描边：关 → 仅敌人 → 敌我都描，即时作用到叠加层；粗细
await p.evaluate(() => localStorage.setItem('im_iff_outline', '0'));
await click('settings-outline-inc'); const o1 = await p.evaluate(G0 => ({ ls: localStorage.getItem('im_iff_outline'), mode: { ...eval(G0).iff?.mode } }), G);
await click('settings-outline-inc'); const o2 = await p.evaluate(G0 => ({ ls: localStorage.getItem('im_iff_outline'), mode: { ...eval(G0).iff?.mode } }), G);
ck('敌我描边：仅敌人 → 敌我都描，存档值与叠加层即时同步', o1.ls === 'enemy' && o1.mode.outline && o1.mode.enemyOnly && o2.ls === '1' && o2.mode.outline && !o2.mode.enemyOnly && (await val('settings-outline')) === '敌我都描', { o1, o2 });
await click('settings-outline-width-inc'); const w = await p.evaluate(G0 => ({ ls: localStorage.getItem('im_iff_outline_w'), thick: eval(G0).iff?.mode.thick }), G);
ck('描边粗细：粗，即时生效', w.ls === 'thick' && w.thick === true && (await val('settings-outline-width')) === '粗', w);
// 战场上真的描出来（回到战斗刷几个敌人）
await p.keyboard.press('Escape'); await p.evaluate(G0 => { const s = eval(G0); for (let i = 0; i < 6; i++) s.spawnAroundPlayer('infantry'); s.legion?.recruit?.('swordsman', 2, true, true); }, G); await p.waitForTimeout(1200);
const drawn = await p.evaluate(G0 => eval(G0).iff?.stats.outlines ?? 0, G);
ck('开描边后战场上敌我都有描边', drawn > 0, drawn);
await p.screenshot({ path: `${out}/after-outline-thick-1280x720.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
// 5) 伤害数字
const dmgCount = () => p.evaluate(G0 => { const s = eval(G0); const before = s.dmgFx.filter(f => f.active).length; const dx = (Math.random() - .5) * 400, dy = (Math.random() - .5) * 200; s.spawnDamageText(s.player.x + 60 + dx, s.player.y + dy, 12, false); s.spawnDamageText(s.player.x - 60 + dx, s.player.y - 90 + dy, 30, true); /* 随机位置：避免与上一次的飘字合并 */ return s.dmgFx.filter(f => f.active).length - before; }, G);
await p.evaluate(() => localStorage.removeItem('im_dmg_numbers'));
const all = await dmgCount();
await click('settings-damage-inc'); const crit = await dmgCount(); const critLabel = await val('settings-damage');
await click('settings-damage-inc'); const off = await dmgCount();
ck('伤害数字：全部 2 个 / 仅暴击 1 个 / 关 0 个', all === 2 && crit === 1 && off === 0 && critLabel === '仅暴击', { all, crit, off, critLabel });
await click('settings-damage-inc');
// 6) 震屏
const shook = () => p.evaluate(G0 => { const c = eval(G0).cameras.main; c.shakeEffect.reset?.(); c.shake(200, .01); return c.shakeEffect.isRunning; }, G);
await click('settings-shake-inc'); await click('settings-shake-inc'); const offLabel = await val('settings-shake'); const offRun = await shook();
await click('settings-shake-inc'); const strongLabel = await val('settings-shake'); const onRun = await shook();
ck('震屏：关时不震、强时照常震', offLabel === '关' && !offRun && strongLabel === '强' && onRun, { offLabel, offRun, strongLabel, onRun });
// 7) 画面清晰度：写入并提示刷新
await click('settings-render-scale-inc'); const rs = await p.evaluate(() => localStorage.getItem('im_render_scale'));
const note = await p.evaluate(G0 => eval(G0).pausePanel.list.some(o => o.text === '刷新后生效'), G);
ck('画面清晰度：写入 im_render_scale，提示刷新后生效', rs === '1' && note, { rs, note });
await p.evaluate(() => localStorage.removeItem('im_render_scale'));
// 8) 音量滑条、重看引导都在面板里
const misc = await p.evaluate(G0 => { const s = eval(G0); return { vol: s.pausePanel.list.filter(o => o.text === '音乐' || o.text === '音效').length, replay: !!s.pausePanel.list.find(o => o.name === 'settings-tutorial-replay') }; }, G);
ck('面板里有音乐 / 音效音量与「重看新手引导」', misc.vol === 2 && misc.replay, misc);
// 9) 刷新后保持；主页设置同步显示同一档
await boot();
const kept = await p.evaluate(G0 => ({ outline: localStorage.getItem('im_iff_outline'), w: localStorage.getItem('im_iff_outline_w'), mode: { ...eval(G0).iff?.mode } }), G);
ck('刷新后描边设置仍在并在开局生效', kept.outline === '1' && kept.w === 'thick' && kept.mode.outline && kept.mode.thick, kept);
await p.goto(`${base}?dev=1&layout=desktop`); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(600);
const home = await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.openHomeSettings(); const panel = m.children.getByName('home-settings-panel'); const t = panel.list.find(o => o.name === 'settings-iff-outline'); return t?.text; });
ck('主页「军中设置」显示同一档（敌我都描）', /敌我都描/.test(home ?? ''), home);
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
