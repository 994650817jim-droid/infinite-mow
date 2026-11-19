// 首领「出招起手」特效在真实地面上的预览：每个主题依次放 蓄力光（套在一个站着的敌人身上）/ 脚下法阵 / 兵器闪光 / 狂暴爆发，每种截 1 张（约 0.35 秒处），存 assets/review/boss-theme/cast-<主题>-<种类>.png
// 用法：BASE=http://127.0.0.1:5260/ THEMES=blood,yellow node tools/shot-cast-preview.mjs   需要开发服务器
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/boss-theme', THEMES = (E.THEMES ?? 'blood').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, ''))); if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(async themes => {
  const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
  const m = await window.__mod('systems/BossThemeFx.ts'); window.__bt = m;
  await new Promise(res => { let n = 0; for (const t of themes) { if (!m.BOSS_CAST_READY.includes(t)) continue; s.load.spritesheet('bossfxcast_' + t, 'assets/boss-fx/cast/' + t + '.png', { frameWidth: 256, frameHeight: 256 }); n++; } if (!n) res(); else { s.load.once('complete', res); s.load.start(); } });
  // 一个站着的「首领」：用一个精英敌人定住不动
  const e = s.spawnEnemy('elite', s.player.x + 150, s.player.y - 10, 1, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9e5; window.__boss = e; }
}, THEMES);
for (const t of THEMES) {
  for (const kind of ['aura', 'sigil', 'glint', 'burst']) {
    await p.evaluate(([t, kind]) => { const s = window.__game.scene.getScene('GameScene'), m = window.__bt, e = window.__boss, bx = e.x, by = e.y;
      const follow = () => ({ x: e.x, y: e.y });
      if (kind === 'aura') m.playCastFx(s, t, 'aura', bx, by, 170, { ms: 900, follow });
      else if (kind === 'sigil') m.playCastFx(s, t, 'sigil', bx, by + 4, 150, { ms: 900, follow: () => ({ x: e.x, y: e.y + 4 }) });
      else if (kind === 'glint') m.playCastFx(s, t, 'glint', bx - 44, by - 30, 90, { ms: 900 });
      else m.playCastFx(s, t, 'burst', bx, by + 6, 300, { ms: 900 }); }, [t, kind]);
    await p.waitForTimeout(380); await p.screenshot({ path: `${OUT}/cast-${t}-${kind}.png`, clip: { x: 400, y: 190, width: 560, height: 300 } });
    await p.waitForTimeout(1100);
  }
}
console.log('errors', errs.slice(0, 3)); await b.close();
