// 张角（1-3 章末首领，systems/ZhangjiaoBoss.ts）不卡（用户 11-18「张角好像卡住不动了」）：
// 正式模式（从主菜单进 1-3，不带 ?dev=1）与 dev 模式各跑一次：一阶段、二阶段各 30 秒（实时），主将站着不动（最容易「站桩」的情形），每 0.5 秒取样。
// 每段要求：走过的路程 ≥ 120（二阶段几乎连着出招，≥ 50）、出招 ≥ 3 次、同一位置且同一帧连续不超过 3 秒、空闲时按方向换行走表的帧（修前一直朝下走：只用 down_0～3）、无页面报错。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-zhangjiao-alive.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const G = "window.__game.scene.getScene('GameScene')";

async function open(mode) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (mode === 'dev') {
    await p.goto(base + '?dev=1&autostart=1&stage=3&layout=desktop');
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 });
  } else {
    // 正式模式：从主菜单进第一章第三关
    // 存档：第一章已过 2 关（1-3 才解锁；新档从 1-1 起）
    await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify({ version: 10, yellowStages: 2, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: false, cleared: {}, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin'], ownedCities: [], eraSeen: 0, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 1 })); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('s', '1'); } });
    await p.goto(base + '?layout=desktop');
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    // 走玩家的路：主菜单「选章」→ 第一章第 3 关（MenuScene.pickChapter → startGame）
    await p.evaluate(() => window.__game.scene.getScene('MenuScene').pickChapter('huangjin', 3));
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 90000 });
  }
  await p.waitForTimeout(1500);
  const info = await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); s.player.damageImmune = true; if (!s.boss?.active) s.spawnBoss(); return { stage: s.chapter.stage, style: s.chapter.bossStyle, dev: !!s.__DEV_ACTIONS }; }, G);
  await p.waitForFunction(G0 => !!eval(G0).zhangjiao && eval(G0).boss?.active, G, { timeout: 30000 });
  return { p, errs, info };
}
// 实时跑 sec 秒，每 0.5 秒取样；保持血量在本阶段区间（一阶段 > 二阶段线，二阶段不被打死）
async function run(p, sec, phase2) {
  const rows = [];
  for (let i = 0; i < sec * 2; i++) {
    rows.push(await p.evaluate(([G0, phase2]) => { const s = eval(G0); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none' && s.mode !== 'result') { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); }
      const bo = s.boss, z = s.zhangjiao; if (!bo || !z) return { gone: true };
      if (!phase2 && bo.hp < bo.maxHp * .7) bo.hp = bo.maxHp * .95; if (phase2 && bo.hp < bo.maxHp * .2) bo.hp = bo.maxHp * .4;
      const m = z.metrics; return { x: bo.x, y: bo.y, frame: bo.sprite.texture.key + ':' + bo.sprite.frame.name, base: String(bo.sprite.frame.name), casts: m.rain + m.thunder + m.heaven + m.grid, p2: z.phase2, mode: s.mode, idle: z.beat.phase === 'idle' }; }, [G, phase2]));
    await p.waitForTimeout(500);
  }
  let path = 0, still = 0, maxStill = 0; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], c = rows[i]; if (a.gone || c.gone) continue; const d = Math.hypot(c.x - a.x, c.y - a.y); path += d; still = d < 1 && a.frame === c.frame ? still + .5 : 0; maxStill = Math.max(maxStill, still); }
  const ok = rows.filter(r => !r.gone), idleFrames = new Set(ok.filter(r => r.idle).map(r => r.base));
  return { path: Math.round(path), casts: ok.at(-1).casts - ok[0].casts, maxStill, idleFrames: [...idleFrames], p2: ok.at(-1).p2, gone: rows.some(r => r.gone), modes: [...new Set(ok.map(r => r.mode))] };
}
for (const mode of ['normal', 'dev']) {
  const { p, errs, info } = await open(mode);
  ck(`[${mode}] 进 1-3，张角出阵（重设计版控制器）`, info.stage === 3 && info.style === 'zhangjiao' && (mode === 'dev') === info.dev, info);
  const r1 = await run(p, 30, false);
  ck(`[${mode}] 一阶段 30 秒：在走动（路程 ≥120）、出招 ≥3、原地同帧不超过 3 秒、空闲时按方向换行走帧（不是一直朝下）`, !r1.gone && !r1.p2 && r1.path >= 120 && r1.casts >= 3 && r1.maxStill <= 3 && r1.idleFrames.some(f => /^(left|right|up)_/.test(f)), r1);
  await p.evaluate(G0 => { const s = eval(G0), bo = s.boss; bo.hp = Math.floor(bo.maxHp * .45); s.hitEnemy(bo, 1, s.combatNow, 'melee', false, false); }, G);
  await p.waitForTimeout(3500); // 二阶段转场（无敌、读条）
  const r2 = await run(p, 30, true);
  ck(`[${mode}] 二阶段 30 秒：在走动（二阶段几乎连着出招，路程 ≥50）、出招 ≥3、原地同帧不超过 3 秒、空闲时按方向换行走帧`, !r2.gone && r2.p2 && r2.path >= 50 && r2.casts >= 3 && r2.maxStill <= 3 && r2.idleFrames.some(f => /^(left|right|up)_/.test(f)), r2);
  ck(`[${mode}] 无页面报错`, errs.length === 0, errs.slice(0, 3));
  await p.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
