// 河 / 桥截图：11-1 泸水、9-1 樊城、5-2 赤壁（1280×720 电脑布局），桥近景 + 一段无桥河岸；MODE=gif 另录水面 GIF（需要 ffmpeg）。
// 用法：BASE=http://127.0.0.1:5173/ PREFIX=before node tools/shot-river.mjs   → assets/review/river/<PREFIX>-<关>-bridge.png / -bank.png
//       BASE=… PREFIX=after MODE=gif node tools/shot-river.mjs                  → 另出 assets/review/river/water.gif
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const E = process.env, base = E.BASE ?? 'http://127.0.0.1:5173/', PREFIX = E.PREFIX ?? 'after', OUT = 'assets/review/river', GIF = E.MODE === 'gif';
mkdirSync(OUT, { recursive: true });
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 3, yilingStages: 3, nanzhengStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 11, intelSeq: 1 };
const CASES = (E.ONLY ? E.ONLY.split(',') : ['nanzheng', 'xiangfan', 'chibi']);
const ALL = { nanzheng: ['NanzhengGameScene', 'nanzhengStage', 1, '11-1'], xiangfan: ['XiangfanGameScene', 'xiangfanStage', 1, '9-1'], chibi: ['ChibiGameScene', 'chibiStage', 2, '5-2'] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
try {
  for (const id of CASES) {
    const [scene, key, st, tag] = ALL[id];
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => errors.push(`${id} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|ERR_/.test(m.text())) errors.push(`${id} ${m.text()}`); });
    await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
    await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    await p.evaluate(([scene, key, st]) => { const g = window.__game; g.registry.set(key, st); for (const k of ['xfNoStory', 'nzNoStory', 'shuNoStory', 'yilingNoStory']) g.registry.set(k, 'all'); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start(scene); }, [scene, key, st]);
    await p.waitForFunction(s => window.__game.scene.isActive(s) && window.__game.scene.getScene(s).player, scene, { timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.evaluate(sc => {
      const g = window.__game, s = g.scene.getScene(sc); window.__S = s; s.__DEV_ACTIONS?.closePopup?.();
      s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      if (s.chapter?.waves) for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves?.add(i); s.pendingRecruit = false;
      g.loop.sleep(); window.__T = performance.now(); window.__mv = [0, 0]; s.readMove = () => new Phaser.Math.Vector2(0, 0);
      window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && s.mode !== 'rest' && s.mode !== 'result' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } };
      for (const o of s.children.list) if (/hud|minimap/i.test(o.name ?? '')) o.setVisible?.(false);
    }, scene);
    await p.evaluate(() => window.__step(8));
    await p.waitForTimeout(800); // 新图载入
    const info = await p.evaluate(() => { const T = window.__S.terrain, br = T?.bridge(0), r = T?.rivers[0]; return { has: !!T, bridge: br && { x: Math.round(br.x), y: Math.round(br.y), ux: br.ux, uy: br.uy }, river: r && { w: r.spec.width, seg: r.segs[0] && { ax: r.segs[0].ax, ay: r.segs[0].ay, ux: r.segs[0].ux, uy: r.segs[0].uy } }, texN: Object.keys(window.__S.textures.list).filter(k => /^t[rb]_/.test(k)).length }; });
    console.log(id, JSON.stringify(info));
    if (!info.has || !info.bridge) { await p.close(); continue; }
    const go = async (x, y, n = 30) => { await p.evaluate(([x, y]) => { const s = window.__S; s.player.sprite.setPosition(x, y); }, [x, y]); await p.evaluate(n => window.__step(n), n); await p.waitForTimeout(200); };
    await go(info.bridge.x, info.bridge.y + 170);
    await p.screenshot({ path: `${OUT}/${PREFIX}-${tag}-bridge.png` });
    // 无桥河岸：沿河线离桥最远的一段中点
    const bank = await p.evaluate(() => { const T = window.__S.terrain, r = T.rivers[0], g = r.segs[0], bs = r.bridges; let best = null, bd = -1; for (let d = 200; d < g.len - 200; d += 60) { const x = g.ax + g.ux * d, y = g.ay + g.uy * d, m = Math.min(...bs.map(b => Math.hypot(b.x - x, b.y - y))); if (m > bd) { bd = m; best = { x, y }; } } return best; });
    await go(bank.x, bank.y + 150);
    await p.screenshot({ path: `${OUT}/${PREFIX}-${tag}-bank.png` });
    if (E.MODE === 'variants' && id === 'nanzheng') { // 石拱桥 + 断桥：在远处另建一条河
      await p.evaluate(() => { const s = window.__S, Tc = s.terrain.constructor; window.__T2 = new Tc(s, { rivers: [{ points: [{ x: -900, y: 2400 }, { x: 900, y: 2440 }], width: 260, bridges: [{ at: .25, width: 130, style: 'stone' }, { at: .75, width: 130 }] }] }); });
      await p.waitForTimeout(1500);
      const q = await p.evaluate(() => { const t = window.__T2, a = t.bridge(0), c = t.bridge(1); return { a: { x: a.x, y: a.y }, c: { x: c.x, y: c.y } }; });
      await go(q.a.x, q.a.y + 190); await p.screenshot({ path: `${OUT}/${PREFIX}-stone.png` });
      await go(q.c.x, q.c.y + 190); await p.screenshot({ path: `${OUT}/${PREFIX}-wood-intact.png` });
      await p.evaluate(() => window.__T2.setBridgeBroken(1, true)); await p.evaluate(() => window.__step(4)); await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/${PREFIX}-wood-broken.png` });
      const sw = await p.evaluate(() => { const t = window.__T2, b = t.bridge(1); return { onBroken: t.onBridge(b.x, b.y), inWaterBroken: t.inWater(b.x, b.y), broken: t.isBridgeBroken(1) }; });
      console.log('broken state', JSON.stringify(sw));
    }
    if (GIF && id === 'nanzheng') {
      await go(bank.x, bank.y + 150, 5); rmSync('.build-tmp/gif', { recursive: true, force: true }); mkdirSync('.build-tmp/gif', { recursive: true });
      for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__step(6)); await p.screenshot({ path: `.build-tmp/gif/f${String(i).padStart(3, '0')}.png`, clip: { x: 200, y: 160, width: 880, height: 400 } }); }
      execSync(`ffmpeg -y -loglevel error -framerate 12 -i .build-tmp/gif/f%03d.png -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" ${OUT}/water.gif`);
      console.log('gif done');
    }
    await p.close();
  }
} finally { await b.close(); }
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
