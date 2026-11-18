// 首领骑乘截图：让首领骑着马在主将旁走动，分别截「朝镜头（向下走）」和「朝左」两个方向的近景（看「像站在马上」还是「坐在马上」）。电脑布局。
// 用法：BASE=http://127.0.0.1:5212/ TAG=after ONLY=lubu,huaxiong node tools/shot-boss-ride.mjs   → assets/review/boss-ride/<id>_<方向>_<TAG>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-ride', TAG = process.env.TAG ?? 'now';
mkdirSync(OUT, { recursive: true });
const CASES = [
  { id: 'lubu', scene: 'LubuGameScene', run: {}, reg: {} },
  { id: 'huaxiong', scene: 'GameScene', run: { chapter: 'hulao', westStage: 1 }, reg: {} },
  { id: 'zhangliang', scene: 'GameScene', run: { chapter: 'huangjin', stage: 1 }, reg: {} },
  { id: 'lijue', scene: 'ThirdGameScene', run: { thirdStage: 1 }, reg: { thirdStage: 1 } },
  { id: 'zhangxiu', scene: 'ThirdGameScene', run: { thirdStage: 2 }, reg: { thirdStage: 2 } },
  { id: 'yanliang', scene: 'GuanduGameScene', run: {}, reg: { guanduStage: 1 } },
  { id: 'wenchou', scene: 'GuanduGameScene', run: {}, reg: { guanduStage: 2 } },
  { id: 'caochun', scene: 'ChibiGameScene', run: { thirdStage: 1 }, reg: { chibiStage: 1 } },
  { id: 'huangzhong', scene: 'JingnanGameScene', run: { thirdStage: 3 }, reg: { jingnanStage: 3 } },
];
const VIEWS = [{ tag: 'down', face: 'down', dx: 0, dy: -50 }, { tag: 'left', face: 'left', dx: 170, dy: 20 }, { tag: 'right', face: 'right', dx: -170, dy: 20 }];
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.id))) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); }, [c.scene, c.run, c.reg]);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 120000 }); await p.waitForTimeout(1000);
    await ev(s => { s.player.damageImmune = true; if (!s.boss?.active) { const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); } });
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) { ok = await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { try { s.__DEV_ACTIONS?.closePopup?.(); } catch {} } return !!(s.boss?.active); }); if (!ok) await p.waitForTimeout(300); }
    if (!ok) { console.log('SKIP', c.id, '首领没出'); continue; }
    await p.waitForTimeout(3500); // 名牌 + 马图载入
    for (const v of VIEWS) {
      await ev((s, v) => { for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); s.devTimeScale = 0.0001; if (s.bossMount) s.bossMount.dir = v.face; const bx = s.player.x + v.dx, by = s.player.y + v.dy; s.boss.sprite.setPosition(bx, by); s.boss.x = bx; s.boss.y = by; }, v);
      await p.waitForTimeout(500);
      await ev((s, v) => { if (s.bossMount) { s.bossMount.dir = v.face; s.bossMount.frame = 0; } }, v);
      await p.waitForTimeout(400);
      const i2 = await ev(s => { const cam = s.cameras.main, bx = s.boss.sprite.x, by = s.boss.sprite.y, cv = s.game.canvas.getBoundingClientRect(), k = cv.width / cam.width; const m = s.bossMount; return { sx: Math.round(cv.left + (bx - cam.worldView.x) * cam.zoom * k), sy: Math.round(cv.top + (by - cam.worldView.y) * cam.zoom * k), key: s.boss.sprite.texture.key, dir: m?.dir, ride: !!m?.usesRideArt }; });
      const x = Math.max(0, i2.sx - 150), y = Math.max(0, i2.sy - 210);
      await p.screenshot({ path: `${OUT}/${c.id}_${v.tag}_${TAG}.png`, clip: { x, y, width: 300, height: 300 } });
      console.log('SHOT', c.id, v.tag, JSON.stringify(i2));
    }
  }
  if (errs.length) console.log('页面报错', errs.slice(0, 3));
} finally { await b.close(); }
