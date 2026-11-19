// 首领走路提速 / 追击（systems/BossPace，BALANCE.bossPace；2026-11-19 用户：「boss 移动速度都很慢，我在骑着马的时候打 boss」）。
// 1-1 张梁：主将站着不动，把首领放在 200 / 700 像素外，量 1 秒内朝主将走了多远，对比 def.speed。
// 用法：BASE=http://127.0.0.1:5195/ node tools/test-boss-pace.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'guanyu'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').bossPace, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
    s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none');
    pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    if (!s.boss?.active) s.spawnBoss?.();
    for (let i = 0; i < 40 && !s.boss?.active; i++) await wait(100);
    const bz = s.boss; if (!bz?.active) return { error: 'no boss' };
    bz.hp = bz.maxHp = 1e8; for (const w of pl.weapons) w.cooldownLeft = 1e9;
    const measure = async dist => {
      for (const w of pl.weapons) w.cooldownLeft = 1e9;
      const calm = () => { for (let k = 0; k < 6 && s.mode !== 'none'; k++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } };
      calm(); bz.sprite.setPosition(pl.x + dist, pl.y); const x0 = bz.x, t0 = s.combatNow; for (let i = 0; i < 10; i++) { await wait(100); calm(); }
      const sec = (s.combatNow - t0) / 1000, moved = x0 - bz.x; // 朝左（主将方向）为正
      return { dist, speed: +(moved / Math.max(.001, sec)).toFixed(0), sec: +sec.toFixed(2) };
    };
    const near = await measure(220), far = await measure(760);
    const P = (await import('/src/config.ts')).BALANCE.bossPace;
    return { base: bz.def.speed, near, far, P, steps: s.bossPace.stats.steps, mode: s.mode };
  });
  console.log(JSON.stringify(r));
  const ratioNear = r.near?.speed / r.base, ratioFar = r.far?.speed / r.base;
  ck('首领离主将 220 像素：走路约 ×walkMul（1.3）', ratioNear > r.P.walkMul * .8 && ratioNear < r.P.walkMul * 1.25, { ratioNear: +ratioNear.toFixed(2), r });
  ck('首领离主将 760 像素：追击约 ×walkMul×chaseMul（2.6）', ratioFar > r.P.walkMul * r.P.chaseMul * .75 && ratioFar < r.P.walkMul * r.P.chaseMul * 1.25, { ratioFar: +ratioFar.toFixed(2) });
  ck('放大的是首领朝主将走的那几步（stats.steps > 0）', r.steps > 0, r.steps);
} catch (e) { console.log('ERROR', String(e)); fail++; }
finally { await b.close(); }
ck('没有页面报错', errors.length === 0, errors.slice(0, 3));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
