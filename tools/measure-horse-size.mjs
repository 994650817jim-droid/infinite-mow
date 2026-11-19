// 量一量：活骑兵图宽 / 倒下的身体图宽 / 放出的马宽（对 BASE 指向的服务；默认主工作区 5173）。截图存 assets/review/deathfx/horse-size.png
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const live = s.spawnEnemy('cavalry', s.player.x + 120, s.player.y - 60, 1, true), dying = s.spawnEnemy('cavalry', s.player.x + 120, s.player.y + 60, 1, true); live.speed = 0; dying.speed = 0; live.hp = live.maxHp = 9999;
  s.deathFx.warmHorse(); for (let i = 0; i < 150 && !s.deathFx.gallopReady; i++) await new Promise(r => setTimeout(r, 100));
  const liveW = Math.abs(live.sprite.displayWidth), dyW = Math.abs(dying.sprite.displayWidth); dying.hp = 0; dying.lastHitHeavy = false; dying.lastHitFromAlly = false; s.killEnemy(dying);
  const fx = s.deathFx, body = fx.pool.find(x => x.active), h = fx.horses.find(x => x.active);
  return { liveW, dyW, bodyW: Math.abs(body.img.displayWidth), horseW: h.img.displayWidth, ratioToBody: h.img.displayWidth / Math.abs(body.img.displayWidth), ratioToSprite: h.img.displayWidth / dyW, scaleX: dying.sprite.scaleX, scaleY: dying.sprite.scaleY, bodyScaleX: body.img.scaleX };
});
console.log(JSON.stringify(r)); await p.waitForTimeout(580); await p.screenshot({ path: 'assets/review/deathfx/horse-size.png', clip: { x: 560, y: 240, width: 420, height: 260 } }); await b.close();
