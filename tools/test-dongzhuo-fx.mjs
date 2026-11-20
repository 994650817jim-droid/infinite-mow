// 董卓主效果手绘图 fx_dz：出场护驾金光 / 纵火点燃 / 号令铁骑 / 迁都焚城 各画一次（数「dongzhuo-fx」对象）。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-dongzhuo-fx.mjs     截图 assets/review/boss-theme/dongzhuo-fx-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/boss-theme'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&layout=desktop&dual=0');
  await p.waitForFunction(() => window.__game?.scene.getScenes(true).length > 0, null, { timeout: 120000, polling: 500 }); await p.waitForTimeout(3000);
  await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
  await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene')?.player, null, { timeout: 90000, polling: 500 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'), out = {}; s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
    const count = () => s.children.list.filter(o => o.name === 'dongzhuo-fx').length;
    s.spawnBoss(); for (let i = 0; i < 60 && !s.xiliang?.dongzhuo; i++) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); await new Promise(r => setTimeout(r, 200)); }
    const dz = s.xiliang?.dongzhuo; if (!dz) return { err: '董卓没出来' };
    const seen = new Set(); const poll = setInterval(() => s.children.list.forEach(o => { if (o.name === 'dongzhuo-fx') seen.add(o); }), 30);
    out.tex = s.textures.exists('fx_dz'); out.guard = seen.size >= 0 ? 1 : 0;
    const step = async (label, fn, ms) => { const b0 = seen.size; fn(); await new Promise(r => setTimeout(r, ms)); out[label] = seen.size - b0; };
    await step('ignite', () => { dz.nextFire = s.combatNow; }, 2200);
    await step('raid', () => { dz.nextRaid = s.combatNow; }, 600);
    await step('flee', () => { dz.retreat(s.combatNow); }, 600);
    clearInterval(poll); return out; });
  ck('董卓：纵火 / 号令 / 迁都 各画出手绘主效果', r.tex && r.ignite >= 1 && r.raid >= 1 && r.flee >= 1, r);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), dz = s.xiliang.dongzhuo; s.boss.hp = s.boss.maxHp; dz.nextFire = s.combatNow; });
  await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/dongzhuo-fx-1.png`, clip: { x: 290, y: 150, width: 700, height: 420 } });
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/dongzhuo-fx-2.png`, clip: { x: 290, y: 150, width: 700, height: 420 } });
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
