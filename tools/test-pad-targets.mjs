// 手柄锁定敌营 / 粮草（S2 缺口补齐）：官渡战场里 RB 由近到远轮流锁定、LB 取消；面板打开时 RB 不生效。
// 需要开发服务器 5173。用法：node tools/test-pad-targets.mjs
import { chromium } from 'playwright';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const save = { version: 6, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu'] };
const G = "window.__game.scene.getScene('GuanduGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(PADJS);
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('GuanduChapterScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(200);
await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').children.getByName('guandu-deploy').emit('pointerup'));
await p.waitForFunction(G0 => eval(G0)?.depots && eval(G0).mode === 'none', G, { timeout: 15000 }); await p.waitForTimeout(400);
// 把所有目标拉到主角附近，并设为无敌、停刷怪
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; }, G);
const list = await p.evaluate(G0 => { const s = eval(G0); return s.padTargets().map(t => Math.round(t.dist)); }, G);
const pad = padApi(p);
const sel = () => p.evaluate(G0 => { const s = eval(G0); return { camp: !!s.enemyCamps?.selected, depot: !!s.depots?.selected, pri: !!s.priorityWeaponTarget(1e4, true), cur: s.padTargets().findIndex(t => t.current) }; }, G);
if (!list.length) {
  // 目标都在 600 外：把主角移到最近目标旁
  await p.evaluate(G0 => { const s = eval(G0); const c = s.enemyCamps?.camps?.[0] ?? null, d = s.depots?.depots?.[0]; const pt = (c ?? d).point; s.player.sprite.setPosition(pt.x + 120, pt.y + 60); }, G);
  await p.waitForTimeout(200);
}
const all = await p.evaluate(G0 => eval(G0).padTargets().length, G);
ck('官渡战场：主角附近有可锁定的敌营 / 粮草', all >= 1, { all, list });
await pad.press('RB'); const s1 = await sel();
ck('RB 锁定最近目标（成为武器优先目标）', (s1.camp || s1.depot) && s1.pri && s1.cur >= 0, s1);
if (all >= 2) { await pad.press('RB'); const s2 = await sel(); ck('再按 RB 换下一个目标', s2.cur >= 0 && s2.cur !== s1.cur && (s2.camp !== s2.depot || s2.camp), { s1, s2 }); }
await pad.press('LB'); const s3 = await sel();
ck('LB 取消锁定', !s3.camp && !s3.depot && s3.cur < 0, s3);
await pad.press('START'); await pad.press('RB'); const s4 = await sel();
ck('暂停时 RB 不锁定', !s4.camp && !s4.depot && (await p.evaluate(G0 => eval(G0).mode, G)) === 'pause', s4);
const hint = await p.evaluate(G0 => { const s = eval(G0); s.refreshInputHints(); return s.hintText?.text; }, G);
ck('用手柄时开局提示含「RB 锁定敌营 / 粮草」', /RB 锁定敌营/.test(hint ?? ''), hint);
ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
