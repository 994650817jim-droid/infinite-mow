// 武将行走动画录制与量化：逐帧步进游戏（game.step，固定 60 fps，不受机器负载影响），
// 记录每帧的行走帧名、位置、缩放、锚点、阴影，并截下主将周围的连续画面。
// 用法：BASE=http://127.0.0.1:5197/ TAG=before node tools/walk-anim-record.mjs [hero,...]
// 输出：assets/review/walk-anim/<TAG>/<hero>-<layout>-<段>-NNN.png 与 <TAG>/metrics.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'before';
const out = `assets/review/walk-anim/${tag}`; mkdirSync(out, { recursive: true });
const HEROES = (process.argv[2] ?? 'zhaoyun,guanyu,sunshangxiang,diaochan,weiyan').split(',');
const WEAPON = { zhaoyun: 'spear_orbit', guanyu: 'guandao', sunshangxiang: 'crossbow', diaochan: 'flame_banner', weiyan: 'zhenbei_blade' };
const LAYOUTS = (process.env.LAYOUTS ?? 'mobile,desktop').split(',');
const VIEW = { mobile: { width: 390, height: 844, deviceScaleFactor: 2 }, desktop: { width: 1280, height: 720, deviceScaleFactor: 1 } };
// 段：方向向量、步数（60fps）、每几步截一张
const SEGMENTS = [
  { name: 'right', v: [1, 0], steps: 60, shot: 2 },
  { name: 'stop-right', v: [0, 0], steps: 30, shot: 2 },
  { name: 'diag', v: [1, 1], steps: 60, shot: 2 },
  { name: 'up', v: [0, -1], steps: 45, shot: 0 },
  { name: 'down', v: [0, 1], steps: 60, shot: 2 },
  { name: 'left', v: [-1, 0], steps: 45, shot: 0 },
  { name: 'stop-left', v: [0, 0], steps: 30, shot: 0 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const metrics = {}; const errors = [];
for (const layout of LAYOUTS) for (const hero of HEROES) {
  const p = await b.newPage({ viewport: { width: VIEW[layout].width, height: VIEW[layout].height }, deviceScaleFactor: VIEW[layout].deviceScaleFactor });
  p.on('pageerror', e => errors.push(hero + ' ' + e.message));
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, hero, WEAPON[hero]]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 60000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(500);
  // 接管时钟：停掉 RAF，之后每次手动 step 16.67ms；移动输入由 __walkVec 决定
  await p.evaluate(G0 => { const g = window.__game, s = eval(G0); g.loop.sleep(); window.__T = performance.now(); window.__walkVec = new Phaser.Math.Vector2(0, 0); s.readMove = () => window.__walkVec.clone().normalize(); s.spawnTimer = s.eliteTimer = 1e9; }, G);
  const rows = [];
  for (const seg of SEGMENTS) {
    await p.evaluate(v => { window.__walkVec.set(v[0], v[1]); }, seg.v);
    for (let i = 0; i < seg.steps; i++) {
      const r = await p.evaluate(G0 => {
        const g = window.__game, s = eval(G0); window.__T += 1000 / 60; g.step(window.__T, 1000 / 60);
        for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
        const pl = s.player, sp = pl.sprite, cam = s.cameras.main, sh = pl.shadow;
        const footY = sp.y - sp.displayHeight * sp.originY + sp.displayHeight; // 纹理底边（世界）
        const c = g.canvas.getBoundingClientRect(), k = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView;
        return { t: Math.round(s.combatNow), x: +pl.x.toFixed(2), y: +pl.y.toFixed(2), frame: String(sp.frame.name), tex: sp.texture.key, sx: +sp.scaleX.toFixed(4), sy: +sp.scaleY.toFixed(4), oy: +sp.originY.toFixed(4), rot: +sp.rotation.toFixed(4), dh: +sp.displayHeight.toFixed(2), footY: +footY.toFixed(2), shW: +sh.displayWidth.toFixed(2), shH: +sh.displayHeight.toFixed(2), shA: +sh.alpha.toFixed(3), act: pl.currentAction, dir: pl.direction, speed: +pl.speed.toFixed(1),
          screen: { x: c.left + (pl.x - wv.x) * k, y: c.top + (pl.y - wv.y) * k, k } };
      }, G);
      r.seg = seg.name; rows.push(r);
      if (seg.shot && i % seg.shot === 0) {
        const k = r.screen.k, w = 110 * k, h = 120 * k;
        await p.screenshot({ path: `${out}/${hero}-${layout}-${seg.name}-${String(i).padStart(3, '0')}.png`, clip: { x: Math.max(0, r.screen.x - w / 2), y: Math.max(0, r.screen.y - h * .62), width: w, height: h } });
      }
    }
  }
  metrics[`${hero}-${layout}`] = rows;
  await p.close();
  console.log('recorded', hero, layout, rows.length);
}
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics));
console.log('errors', errors.length, errors.slice(0, 5));
await b.close();
