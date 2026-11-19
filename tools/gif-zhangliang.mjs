// 1-1 张梁慢放（11-19 用户「张梁移动和动作有问题」）：逐帧推进，录 走近 → 人公冲阵（冲锋）→ 人公横斩（挥砍），
// 每 2 帧截一张（GIF 用），并记下每帧的贴图 / 帧名 / 位置，量出「位移了但帧不变」（滑步）、出手帧与命中时刻是否对上、走路 / 攻击图换贴图时脚底和身高有没有跳。
// 用法：BASE=http://127.0.0.1:5197/ TAG=before node tools/gif-zhangliang.mjs → assets/review/zhangliang-motion/<TAG>/f###.png + <TAG>-log.json
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'now', OUT = `assets/review/zhangliang-motion/${TAG}`;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } });
await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const G = "window.__game.scene.getScene('GameScene')";
await p.evaluate(G0 => { const s = eval(G0), g = window.__game; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9; s.readMove = () => new Phaser.Math.Vector2(0, 0);
  g.loop.sleep(); window.__T = performance.now(); window.__log = [];
  window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60);
    const bo = s.boss; if (bo?.active) { const sp = bo.sprite, mv = s.moveset; window.__log.push({ t: Math.round(s.combatNow), x: +bo.x.toFixed(1), y: +bo.y.toFixed(1), tex: sp.texture.key, f: sp.frame.name, h: Math.round(sp.displayHeight), foot: Math.round(sp.y + (1 - sp.originY) * sp.displayHeight - bo.y), st: mv?.state, move: mv?.cur?.name ?? '', hit: mv?.metrics?.playerHits ?? 0 }); } } }; }, G);
// 首领出场、摆到主将右边 260
await p.evaluate(G0 => { const s = eval(G0); if (!s.boss?.active) s.spawnBoss(); window.__step(30); const bo = s.boss, pl = s.player; bo.sprite.setPosition(pl.x + 300, pl.y); const mv = s.moveset; mv.cds?.clear?.(); mv.cur = null; mv.toIdle?.(s.combatNow, 99999); }, G);
let f = 0; const shot = async () => { const c = await p.evaluate(G0 => { const s = eval(G0), cam = s.cameras.main, W = window.innerWidth / s.scale.width, pl = s.player; return { x: (pl.x + 130 - cam.worldView.x) * cam.zoom * W, y: (pl.y - cam.worldView.y) * cam.zoom * W }; }, G); await p.screenshot({ path: `${OUT}/f${String(f++).padStart(3, '0')}.png`, clip: { x: Math.round(c.x - 300), y: Math.round(c.y - 200), width: 600, height: 300 } }); };
const run = async (frames, every = 2) => { for (let i = 0; i < frames; i += every) { await p.evaluate(n => window.__step(n), every); await shot(); } };
// ① 走近（约 1 秒）
await run(60);
// ② 人公冲阵：从右往左冲过主将
await p.evaluate(G0 => { const s = eval(G0), bo = s.boss, pl = s.player, mv = s.moveset; bo.sprite.setPosition(pl.x + 220, pl.y); const m = mv.phaseDef.moves.find(x => x.kind === 'charge'); mv.start(m, s.combatNow); window.__mark = { charge: window.__log.length }; }, G);
await run(110);
// ③ 人公横斩：贴身挥砍
await p.evaluate(G0 => { const s = eval(G0), bo = s.boss, pl = s.player, mv = s.moveset; mv.dash = null; bo.sprite.setPosition(pl.x + 90, pl.y); const m = mv.phaseDef.moves.find(x => x.kind === 'sweep'); mv.cur = null; mv.start(m, s.combatNow); window.__mark.sweep = window.__log.length; }, G);
await run(90);
const log = await p.evaluate(() => ({ log: window.__log, mark: window.__mark }));
writeFileSync(`${OUT}/../${TAG}-log.json`, JSON.stringify(log));
// 量：滑步（位移 > 3px/帧 连续 6 帧且帧名不变）、贴图切换时身高 / 脚底跳变
const L = log.log; let slide = 0, maxRun = 0, run0 = 0; for (let i = 1; i < L.length; i++) { const mvd = Math.hypot(L[i].x - L[i - 1].x, L[i].y - L[i - 1].y); if (mvd > 3 && L[i].f === L[i - 1].f && L[i].tex === L[i - 1].tex) { run0++; maxRun = Math.max(maxRun, run0); if (run0 === 6) slide++; } else run0 = 0; }
const pops = []; for (let i = 1; i < L.length; i++) if (L[i].tex !== L[i - 1].tex && (Math.abs(L[i].h - L[i - 1].h) > 3 || Math.abs(L[i].foot - L[i - 1].foot) > 3)) pops.push([L[i - 1].tex, L[i].tex, L[i - 1].h, L[i].h, L[i - 1].foot, L[i].foot]);
const sw = L.slice(log.mark.sweep); const atkFrames = sw.filter(z => /attack/.test(z.tex)).map(z => z.t); const swingStart = sw.find(z => z.st === 'attack');
console.log(JSON.stringify({ frames: L.length, slideRuns: slide, longestStill: maxRun, pops: pops.slice(0, 5), sweep: { firstAtk: atkFrames[0], lastAtk: atkFrames.at(-1), release: swingStart?.t, start: sw[0]?.t }, texes: [...new Set(L.map(z => z.tex))], errs }));
await b.close();
