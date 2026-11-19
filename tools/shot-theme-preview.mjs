// 首领主题特效在真实地面上的预览：每个主题依次放 斩击 / 冲击带 / 落点爆 / 现身烟（按真实判定范围缩放），每种截 3 张（0.1 / 0.2 / 0.3 秒），存 assets/review/boss-theme/preview-<主题>-<形状>-<n>.png
// 用法：BASE=http://127.0.0.1:5260/ THEMES=blood,yellow node tools/shot-theme-preview.mjs   需要开发服务器
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/boss-theme', THEMES = (E.THEMES ?? 'blood,yellow,dust,quake').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, ''))); if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(async themes => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const m = await window.__mod('systems/BossThemeFx.ts'); window.__bt = m;
  await new Promise(res => { let n = 0; for (const t of themes) { if (!m.BOSS_THEME_READY.includes(t)) continue; s.load.spritesheet('bossfxtheme_' + t, m.BOSS_THEME_FILES[t], { frameWidth: 256, frameHeight: 256 }); n++; } if (!n) res(); else { s.load.once('complete', res); s.load.start(); } });
}, THEMES);
for (const t of THEMES) {
  for (const kind of ['sector', 'lane', 'circle', 'puff']) {
    await p.evaluate(([t, kind]) => { const s = window.__game.scene.getScene('GameScene'), m = window.__bt, px = s.player.x, py = s.player.y; s.player.sprite.setPosition(px, py);
      const x = px - 150, y = py + 10, shape = kind === 'sector' ? { kind, x, y, r: 150, angle: 0 } : kind === 'lane' ? { kind, x, y, angle: 0, len: 340, width: 66 } : kind === 'circle' ? { kind, x: px + 40, y, r: 110 } : { kind, x: px + 40, y, size: 150 };
      window.__ok = m.playThemeFx(s, t, shape, { ms: 900 }); }, [t, kind]);
    for (let n = 0; n < 3; n++) { await p.waitForTimeout(n ? 220 : 160); await p.screenshot({ path: `${OUT}/preview-${t}-${kind}-${n}.png`, clip: { x: 330, y: 200, width: 620, height: 310 } }); }
    await p.waitForTimeout(1200);
  }
}
console.log('errors', errs.slice(0, 3)); await b.close();
