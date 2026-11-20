// 七进七出（2026-11-20 改四段约 1.1 秒）录屏：步行 / 骑马各录一遍。开发倍速 0.25 慢放截帧，记下每帧的战斗时钟，
// 再按真实时长拼 GIF（tools 外用 PIL），所以 GIF 播放速度就是游戏里的速度。
// move：边走边触发（2026-11-20「返回的位置是移动的位置」）——冲阵期间一直按「下」，杀回落在跟着走的锚点。
// 用法：BASE=http://127.0.0.1:5743/ MODES=walk,ride,move node tools/record-longdan-gif.mjs → assets/review/longdan/<mode>/f###.png + frames.json
import { chromium } from 'playwright'; import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5743/', OUT = 'assets/review/longdan';
const items = { version: 2, bag: [], loadouts: {}, salvaged: 0, stable: { owned: ['grey_horse'], riders: { zhaoyun: 'grey_horse' }, announced: true }, pity: { sincePurple: 0, sinceOrange: 0 }, autoSalvageWhite: true, unseen: 0, legacy: [] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  for (const mode of (process.env.MODES ?? 'walk,ride,move').split(',')) {
    const ride = mode === 'ride', moving = mode === 'move', dir = `${OUT}/${mode}`; mkdirSync(dir, { recursive: true });
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await p.addInitScript(([it, ride]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); if (ride) localStorage.setItem('im_items_v2', JSON.stringify(it)); sessionStorage.setItem('seeded', '1'); } }, [items, ride]);
    await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), w = s.player.weapons[0]; s.__DEV_ACTIONS.closePopup?.(); w.level = 5; w.branch = 'zy_longdan'; w.over = 0; });
    await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene').branchRt, null, { timeout: 30000 });
    await p.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'), pl = s.player, w = pl.weapons[0];
      s.__DEV_ACTIONS.closePopup?.(); pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; pl.gainXp = () => 0;
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      w.level = 5; w.branch = 'zy_longdan'; w.over = 0; w.cooldownLeft = 1e9; s.branchRt.nextAt = 1e12;
      for (let i = 0; i < 9; i++) { const e = s.spawnEnemy('infantry', pl.x + 70 + (i % 3) * 45, pl.y - 40 + Math.floor(i / 3) * 40, 1, true); e.hp = e.maxHp = 9999; e.speed = 0; e.def = { ...e.def, speed: 0 }; }
    });
    await p.waitForTimeout(400);
    await p.evaluate(moving => { const s = window.__game.scene.getScene('GameScene'), P = s.player; if (moving) { const m0 = P.move; P.move = function (dt) { return m0.call(this, dt, 0, 220); }; } s.devTimeScale = .25; s.branchRt.vx = 0; s.branchRt.vy = 0; window.__t0 = s.combatNow; s.branchRt.dash(); }, moving);
    const frames = [];
    for (let i = 0; i < 400; i++) {
      const info = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), c = s.cameras.main; return { t: s.combatNow - window.__t0, x: (s.player.x - c.worldView.x) * 1280 / c.worldView.width, y: (s.player.y - c.worldView.y) * 720 / c.worldView.height, land: !!s.branchRt.lastDash?.back, anchor: s.branchRt.lastDash?.anchor ?? null }; });
      if (i === 0) frames.cx = Math.round(info.x), frames.cy = Math.round(info.y);
      await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, clip: { x: Math.max(0, frames.cx - 190), y: Math.max(0, frames.cy - 200), width: 560, height: moving ? 420 : 330 } });
      frames.push(Math.round(info.t));
      if (info.land && info.t > 1150 + 350) break;
    }
    writeFileSync(`${dir}/frames.json`, JSON.stringify(frames));
    console.log(mode, 'frames', frames.length, 'last t', frames[frames.length - 1]);
    await p.context().close();
  }
} finally { await b.close(); }
