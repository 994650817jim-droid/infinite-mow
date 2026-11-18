// 过场动画系统（systems/Cutscene.ts + data/cutscenes/）· 第一段「吕布斩董卓」（2-3 董卓 20%）：
//  ① ?dev=1&cutscene=lubu_kills_dongzhuo 直接预览；过场中战斗暂停（story 模式）、HUD 藏起、上下黑边、镜头推近
//  ② 按顺序播完（台词 奉先……我儿 → 我姓吕，不姓董！；张飞不在队不喊三姓家奴）→ 董卓倒下、掉宝箱、战斗恢复、镜头复原、HUD 回来
//  ③ 跳过（Esc）→ 同样的结束状态   ④ 张飞为主将 → 喊「三姓家奴！」   ⑤ 剧情设置关闭 → 不播，董卓照样被吕布斩、掉宝箱
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-cutscene.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/cutscene';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
const open = async (q, story) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(v => { try { if (v) localStorage.setItem('im_story', v); else localStorage.removeItem('im_story'); } catch { } }, story ?? '');
  await p.goto(BASE + '?dev=1&layout=desktop&cutscene=lubu_kills_dongzhuo' + (q ?? ''));
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 });
  const ev = fn => p.evaluate(([S0, f]) => { const s = eval(S0); return eval('(' + f + ')')(s); }, [S, String(fn)]);
  return { p, ev };
};
const endState = s => ({ mode: s.mode, timePaused: s.time.paused, boss: !!s.boss?.active, killed: s.bossKilled, chests: s.bossChests.length, zoom: +(s.cameras.main.zoom / (s.cameras.main.width / 960)).toFixed(2), hud: s.hudTexts.wave.visible, overlays: s.children.list.filter(o => /^cutscene-(bar|veil|flash|subtitle|skip)$/.test(o.name)).length, lubuActor: s.children.list.filter(o => o.name === 'cutscene-actor').length, lying: s.children.list.some(o => o.name === 'cutscene-fall'), dz: s.dzLubu?.phase, log: s.lastCutscene ? { steps: s.lastCutscene.log.steps, lines: s.lastCutscene.log.lines, skipped: s.lastCutscene.skipped } : null });
try {
  // ①② 完整播放
  {
    const { p, ev } = await open();
    let st = null;
    for (let i = 0; i < 120 && !st; i++) { st = await ev(s => s.cutscene?.active ? { snap: s.cutscene.snapshot(), mode: s.mode, paused: s.time.paused } : null); if (!st) await p.waitForTimeout(150); }
    ck('预览：过场开播（战斗暂停 story 模式、HUD 藏起）', st && st.mode === 'story' && st.paused && st.snap.hidden > 3, st);
    const bark0 = await ev(s => s.heroBark?.count ?? 0);
    const t0 = Date.now(), shots = [[1500, '1-camera-gate'], [3200, '2-chitu-arrives'], [5200, '3-fengxian'], [6600, '4-slash'], [8600, '5-wo-xing-lv'], [10800, '6-ride-off']];
    for (const [at, name] of shots) { await p.waitForTimeout(Math.max(0, at - (Date.now() - t0))); const sn = await ev(s => s.cutscene?.snapshot() ?? null); await p.screenshot({ path: `${OUT}/${name}.png` }); if (name === '1-camera-gate') ck('黑边拉上、镜头推近到城门', sn && sn.bars > .9 && sn.zoom > 1.05, sn); if (name === '2-chitu-arrives') ck('吕布骑赤兔入场（演员在场）', sn && sn.actors.includes('lubu'), sn); }
    for (let i = 0; i < 100 && (await ev(s => !!s.cutscene)); i++) await p.waitForTimeout(150);
    const dur = Date.now() - t0;
    await p.waitForTimeout(400);
    const e = await ev(endState);
    await p.screenshot({ path: `${OUT}/7-after.png` });
    await p.waitForTimeout(2600);
    const bark = await ev(s => ({ count: s.heroBark?.count ?? 0, line: s.heroBark?.lastLine ?? '' }));
    ck('过场中与刚结束时主将不喊首领台词（来将通名！等）', bark.count === bark0 || !['来将通名！', '贼将休走！'].includes(bark.line), { bark0, bark });
    const seq = e.log?.steps ?? [];
    ck(`按顺序播完（${(dur / 1000).toFixed(1)} 秒，约 12–15 秒）`, e.log && !e.log.skipped && seq.every((v, i) => !i || v > seq[i - 1]) && seq.length >= 25 && dur > 9000 && dur < 20000, { dur, seq });
    ck('台词：奉先……我儿 → 我姓吕，不姓董！（赵云主将不喊三姓家奴）', e.log.lines[0]?.startsWith('奉先') && e.log.lines.includes('我姓吕，不姓董！') && !e.log.lines.includes('三姓家奴！'), e.log.lines);
    ck('结束：董卓倒下、掉宝箱，战斗恢复（none、计时器走）、镜头复原、HUD 回来、覆盖层清掉、吕布离场', !e.boss && e.killed && e.chests >= 1 && e.mode === 'none' && !e.timePaused && e.zoom === 1 && e.hud && e.overlays === 0 && e.lubuActor === 0 && e.dz === 'done', e);
    await p.close();
  }
  // ③ 跳过
  {
    const { p, ev } = await open();
    for (let i = 0; i < 120 && !(await ev(s => !!s.cutscene?.active)); i++) await p.waitForTimeout(150);
    await p.waitForTimeout(2500);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
    const e = await ev(endState);
    await p.screenshot({ path: `${OUT}/8-skipped.png` });
    ck('Esc 跳过 → 同样的结束状态（董卓倒地、宝箱、战斗恢复、镜头复原）', e.log?.skipped && !e.boss && e.killed && e.chests >= 1 && e.mode === 'none' && e.zoom === 1 && e.hud && e.overlays === 0 && e.lubuActor === 0 && e.lying, e);
    await p.close();
  }
  // ④ 张飞在队
  {
    const { p, ev } = await open('&hero=zhangfei');
    for (let i = 0; i < 200 && !(await ev(s => !!s.lastCutscene && !s.cutscene)); i++) await p.waitForTimeout(150);
    const e = await ev(endState);
    ck('张飞在队 → 喊「三姓家奴！」', e.log?.lines.includes('三姓家奴！'), e.log);
    await p.close();
  }
  // ⑤ 剧情设置关闭
  {
    const { p, ev } = await open('', 'off');
    let seen = false;
    for (let i = 0; i < 120; i++) { const r = await ev(s => ({ cs: !!s.cutscene, dz: s.dzLubu?.phase, killed: s.bossKilled })); if (r.cs) seen = true; if (r.killed) break; await p.waitForTimeout(150); }
    await p.waitForTimeout(600);
    const e = await ev(endState);
    ck('剧情「关闭」→ 不播过场，吕布照样斩董卓、掉宝箱', !seen && !e.log && e.killed && e.chests >= 1 && e.mode === 'none', { seen, e });
    await p.close();
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
