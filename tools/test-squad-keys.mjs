// 部曲开放前 E / F（护阵 / 出击快捷键）在实际游戏里无反应（2026-11-21 统筹：test-hud-resources 的那条是源码正则，这里用浏览器实按确认）。
// 新档 1-1（mech=real，部曲 1-2 才开放）：按 E、F 后 legion.order 不变、不弹面板；对照：1-1 打完（部曲开放）后按 E 会切换。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-squad-keys.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' · ' + JSON.stringify(d).slice(0, 300)); };
const fresh = { version: 10, yellowStages: 0, cleared: { huangjin: false, hulao: false }, worldAvailable: false, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'], tutorialDone: true };
const after11 = { ...fresh, yellowStages: 1 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = [];
const run = async world => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(w => { if (sessionStorage.getItem('i')) return; sessionStorage.setItem('i', '1'); localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_home_seen']) localStorage.setItem(k, '1'); }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off&mech=real', { timeout: 180000 });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.elapsed > 2; }, null, { timeout: 180000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS?.closePopup?.(); });
  await p.waitForTimeout(800); await p.mouse.click(640, 380);
  const read = () => p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); return { squad: M.mechOpen('squad'), order: s.legion.order, mode: s.mode }; });
  const r0 = await read();
  await p.keyboard.press('KeyE'); await p.waitForTimeout(250); const rE = await read();
  await p.keyboard.press('KeyF'); await p.waitForTimeout(250); const rF = await read();
  await p.close(); return { r0, rE, rF };
};
const a = await run(fresh);
ck('新档 1-1（部曲未开放）：按 E 无反应（护阵 / 出击不切、不弹面板）', !a.r0.squad && a.rE.order === a.r0.order && a.rE.mode === 'none', a);
ck('新档 1-1（部曲未开放）：按 F 无反应', !a.r0.squad && a.rF.order === a.r0.order && a.rF.mode === 'none', a);
const c = await run(after11);
ck('对照：1-1 打完（部曲开放）后按 E 会切换护阵 / 出击', c.r0.squad && c.rE.order !== c.r0.order, c);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
