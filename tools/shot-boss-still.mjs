// 首领 v2 图游戏内静帧：在真实战斗场景里把指定首领图（4×8、每格 288）按游戏缩放摆在主将旁，截 3 个方向的行走帧 + 1 张攻击帧。
// 用法：BASE=http://127.0.0.1:5212/ ID=guosi KEY=third_guosi FILE=assets/bosses-v2/third_guosi.png SCENE=ThirdGameScene STAGE=1 node tools/shot-boss-still.mjs   → assets/review/boss-ride/<ID>_still.png
import { chromium } from 'playwright';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5173/', ID = E.ID, KEY = E.KEY, FILE = E.FILE, SCENE = E.SCENE ?? 'ThirdGameScene', STAGE = +(E.STAGE ?? 1);
if (!ID || !KEY || !FILE) { console.error('需要 ID / KEY / FILE'); process.exit(2); }
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(([key, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); g.registry.set(key, run); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: run }); for (const s of g.scene.getScenes(true)) s.scene.stop(); }, [SCENE === 'ThirdGameScene' ? 'thirdStage' : 'x', STAGE]);
  await p.evaluate(([scene]) => window.__game.scene.start(scene), [SCENE]);
  await p.waitForFunction(S => { const s = window.__game.scene.getScene(S); return s?.player && s.scene.isActive(); }, SCENE, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(async ([S, key, file]) => {
    const s = window.__game.scene.getScene(S); s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; window.__game.loop.sleep(); window.__T = performance.now();
    await new Promise(res => { s.load.spritesheet(key, file, { frameWidth: 288, frameHeight: 288 }); s.load.once('complete', res); s.load.start(); });
    window.__still = []; const px = s.player.x, py = s.player.y;
    // 行走：向下 / 向左 / 向右（第 1 帧）+ 攻击（右向第 2 帧）；游戏里首领显示 ×1.4，与 Enemy / BossPresence 的显示缩放一致，这里按 0.5 × 1.4 放
    const frames = [[0, -150, 'down'], [4, -50, 'left'], [8, 50, 'right'], [4 * 6 + 1, 150, 'atk']];
    for (const [f, dx] of frames) { const im = s.add.image(px + dx * 1.1, py - 90, key, f).setOrigin(.5, 256 / 288).setScale(.5 * 1.4).setDepth(99999); window.__still.push(im); }
    window.__go = n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; window.__game.step(window.__T, 1000 / 60); } }; window.__go(10);
  }, [SCENE, KEY, FILE]);
  const clip = await p.evaluate(S => { const s = window.__game.scene.getScene(S), cam = s.cameras.main, cv = s.game.canvas.getBoundingClientRect(), k = cv.width / cam.width; const px = s.player.x, py = s.player.y; return { x: Math.round(cv.left + (px - 260 - cam.worldView.x) * cam.zoom * k), y: Math.round(cv.top + (py - 240 - cam.worldView.y) * cam.zoom * k), w: Math.round(560 * cam.zoom * k), h: Math.round(330 * cam.zoom * k) }; }, SCENE);
  await p.screenshot({ path: `assets/review/boss-ride/${ID}_still.png`, clip: { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: Math.min(clip.w, 1280), height: Math.min(clip.h, 720) } });
  console.log('shot', ID, JSON.stringify(clip), errs.slice(0, 2));
} finally { await b.close(); }
