// 第六章 v2 新图核对：首领图（4×8 每格 288）与山越弓手 / 藤牌兵（行走 + 攻击图集）是否加载并上身。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-jingnan-art.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/jingnan';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('JingnanGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('jingnanStage', 2); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 2 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('JingnanGameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1500);
  const tex = await p.evaluate(S0 => { const s = eval(S0), t = k => s.textures.exists(k) ? { w: s.textures.get(k).getSourceImage().width, down0: s.textures.get(k).has('down_0') } : null;
    return Object.fromEntries(['jingnan_liudu', 'jingnan_shanyue_archer_walk_sheet', 'jingnan_shanyue_archer_attack_sheet', 'jingnan_rattan_shield_walk_sheet', 'jingnan_rattan_shield_attack_sheet'].map(k => [k, t(k)])); }, S);
  ck('刘度首领图为 v2（1152 宽）', tex.jingnan_liudu?.w === 1152, tex);
  ck('山越弓手 / 藤牌兵四张图集已载入并切帧', ['jingnan_shanyue_archer_walk_sheet', 'jingnan_shanyue_archer_attack_sheet', 'jingnan_rattan_shield_walk_sheet', 'jingnan_rattan_shield_attack_sheet'].every(k => tex[k]?.down0), tex);
  const sp = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 0; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    const out = []; [['archer', -120, -60], ['archer', -60, -60], ['shield', 60, -60], ['shield', 120, -60]].forEach(([k, dx, dy]) => { const e = s.spawnEnemy(k, s.player.x + dx, s.player.y + dy, 1, true); out.push({ k, sheet: e?.walkSheet, atk: e?.attackSheet, tint: e?.sprite.tintTopLeft }); }); return out; }, S);
  ck('弓手用山越图集、盾兵用藤牌图集，去掉换色', sp.every(e => e.sheet === (e.k === 'archer' ? 'jingnan_shanyue_archer_walk_sheet' : 'jingnan_rattan_shield_walk_sheet') && e.atk?.startsWith('jingnan_') && e.tint === 0xffffff), sp);
  await p.evaluate(S0 => { const s = eval(S0); s.cameras.main.setZoom(2); }, S); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/troops-v2.png` });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
