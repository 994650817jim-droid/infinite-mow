// 3-2 宛城营栅边截图（StageArena 东西向营栅）。BASE=… PREFIX=after node tools/shot-sidewall.mjs
// 用法：BASE=http://127.0.0.1:5173/ PREFIX=before node tools/shot-river.mjs   → assets/review/sidewall-after/<PREFIX>-<关>-bridge.png / -bank.png
//       BASE=… PREFIX=after MODE=gif node tools/shot-river.mjs                  → 另出 assets/review/river/water.gif
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const E = process.env, base = E.BASE ?? 'http://127.0.0.1:5173/', PREFIX = E.PREFIX ?? 'after', OUT = 'assets/review/sidewall-after', GIF = E.MODE === 'gif';
mkdirSync(OUT, { recursive: true });
const save = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 3, yilingStages: 3, nanzhengStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: ['xuchang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 11, intelSeq: 1 };
const CASES = ['wancheng'];
const ALL = { wancheng: ['ThirdGameScene', 'thirdStage', 2, '3-2'] };
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
    const go = async (x, y) => { await p.evaluate(([x, y]) => { window.__S.player.sprite.setPosition(x, y); }, [x, y]); await p.evaluate(() => window.__step(40)); await p.waitForTimeout(400); };
    await go(-1250, -300); await p.screenshot({ path: `${OUT}/${PREFIX}-${tag}-palisade-west.png` });
    await go(-1250, 0); await p.screenshot({ path: `${OUT}/${PREFIX}-${tag}-palisade-gate.png` });
    await p.close();
  }
} finally { await b.close(); }
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
