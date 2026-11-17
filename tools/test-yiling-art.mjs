// 第十章 v2 新图核对（画风会话，Gemini 出图）：陆逊本体（4×8 每格 288）、招式 / 倒地图集、解烦兵（行走 + 攻击图集）。电脑布局。
// 江东弓弩手、孙桓、朱然的正式图还没出（借图 / 换色过渡），这里不查。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-yiling-art.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/yiling';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('YilingGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('yilingStage', 3); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1500);
  // 招式 / 倒地图集：按需载入后核对尺寸
  await p.evaluate(S0 => { const s = eval(S0); s.load.spritesheet('yiling_luxun_moves', 'assets/bosses-v2/yiling_luxun_moves.png', { frameWidth: 288, frameHeight: 288 }); s.load.start(); }, S);
  await p.waitForTimeout(1500);
  const tex = await p.evaluate(S0 => { const s = eval(S0), t = k => s.textures.exists(k) ? { w: s.textures.get(k).getSourceImage().width, h: s.textures.get(k).getSourceImage().height, down0: s.textures.get(k).has('down_0'), n: s.textures.get(k).frameTotal } : null;
    return Object.fromEntries(['yiling_luxun', 'yiling_luxun_moves', 'boss_death_luxun', 'yiling_jiefan_walk_sheet', 'yiling_jiefan_attack_sheet'].map(k => [k, t(k)])); }, S);
  ck('陆逊本体为 v2 正式图（1152×2304）', tex.yiling_luxun?.w === 1152 && tex.yiling_luxun?.h === 2304, tex.yiling_luxun);
  ck('陆逊招式图集 1152×1152（4×4 每格 288）', tex.yiling_luxun_moves?.w === 1152 && tex.yiling_luxun_moves?.h === 1152 && tex.yiling_luxun_moves.n > 16, tex.yiling_luxun_moves);
  ck('解烦兵行走 / 攻击图集已载入并切帧', tex.yiling_jiefan_walk_sheet?.down0 && tex.yiling_jiefan_attack_sheet?.down0, tex);
  const sp = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = .02; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    const out = []; [-110, -40, 40, 110].forEach(dx => { const e = s.spawnEnemy('infantry', s.player.x + dx, s.player.y - 90, 1, true); out.push({ sheet: e?.walkSheet, atk: e?.attackSheet, tint: e?.sprite.tintTopLeft }); }); return out; }, S);
  ck('步兵用解烦兵图集、去掉换色', sp.every(e => e.sheet === 'yiling_jiefan_walk_sheet' && e.atk === 'yiling_jiefan_attack_sheet' && e.tint === 0xffffff), sp);
  await p.evaluate(S0 => eval(S0).spawnBoss(), S);
  await p.waitForFunction(S0 => eval(S0).boss?.active, S, { timeout: 60000 });
  await p.evaluate(S0 => { const s = eval(S0); if (s.boss.sprite) { s.boss.sprite.x = s.player.x + 140; s.boss.sprite.y = s.player.y; } s.devTimeScale = .02; }, S);
  await p.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) { await p.evaluate(S0 => eval(S0).__DEV_ACTIONS?.closePopup?.(), S); await p.waitForTimeout(300); }
  await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/art-v2-luxun-jiefan.png` });
  const boss = await p.evaluate(S0 => { const s = eval(S0); return { key: s.boss.sprite.texture.key, death: s.textures.exists('boss_death_luxun') ? s.textures.get('boss_death_luxun').getSourceImage().width : null }; }, S);
  ck('陆逊用 yiling_luxun 图', boss.key === 'yiling_luxun', boss);
  ck('陆逊倒地帧已预载（1152×288）', boss.death === 1152, boss);
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
