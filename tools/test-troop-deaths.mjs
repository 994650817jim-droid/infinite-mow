// 我方士兵倒地帧（troop_deaths_a / _b，v2 画风）游戏内核对：在战场上依次摆出 8 个兵种的倒地动画，截图 + 检查帧数 / 缩放。电脑布局。
// 用法：BASE=http://127.0.0.1:5211/ node tools/test-troop-deaths.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/troop-deaths';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  const tex = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return ['troop_deaths_a', 'troop_deaths_b'].map(k => s.textures.exists(k) ? { k, w: s.textures.get(k).getSourceImage().width, n: s.textures.get(k).frameTotal } : null); });
  ck('两张倒地图集已载入（512 宽、4×4 = 16 帧）', tex.every(t => t && t.w === 512 && t.n >= 16), tex);
  // 关掉敌人和时间流动，避免干扰；在主将右侧摆 8 具倒地士兵（真实士兵精灵做身高参照）
  const info = await p.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene'); s.devTimeScale = 0.0001; if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true;
    for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    const ref = s.legion.units.find(u => u.active && u.view)?.view.sprite ?? s.player.sprite, kinds = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
    const now = s.combatNow, out = [];
    kinds.forEach((kind, i) => {
      const x = s.player.x - 210 + (i % 4) * 140, y = s.player.y - 40 + Math.floor(i / 4) * 120;
      const fake = { x, y, displayHeight: ref.displayHeight, frame: ref.frame, texture: ref.texture, scaleY: ref.scaleY, flipX: false };
      s.legion.corpses.spawn({ kind, x, y, facingX: i % 2 ? -1 : 1 }, fake, now - 2000);
    });
    s.legion.corpses.update(now);
    const live = s.legion.corpses.pool.filter(c => c.active);
    for (const c of live) out.push({ key: c.key, frame: c.image.frame.name, h: Math.round(c.image.displayHeight), fallback: c.fallback });
    return { refH: Math.round(ref.displayHeight), corpses: out };
  });
  ck('8 具倒地士兵都用图集帧（不是退回的程序侧倒）', info.corpses.length === 8 && info.corpses.every(c => !c.fallback && /troop_deaths_/.test(c.key)), info);
  ck('都停在最后一帧（静躺）', info.corpses.every(c => +c.frame % 4 === 3), info.corpses.map(c => c.frame));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/troop-deaths-v2.png` });
  // 中间帧截图：重新从第 0 帧播
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (const c of s.legion.corpses.pool) if (c.active) c.start = s.combatNow - 300; s.legion.corpses.update(s.combatNow); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/troop-deaths-v2-mid.png` });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
