// 第八章 v2 新图核对：三位首领图（4×8 每格 288）、青州兵 / 魏军强弩手（行走 + 攻击图集）、山头地块手绘图。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-hanzhong-art.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/hanzhong';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('HanzhongGameScene')";
const TROOPS = ['hanzhong_qingzhou_walk_sheet', 'hanzhong_qingzhou_attack_sheet', 'hanzhong_wei_crossbow_walk_sheet', 'hanzhong_wei_crossbow_attack_sheet'];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('hanzhongStage', 3); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('HanzhongGameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.hills; }, S, { timeout: 90000 }); await p.waitForTimeout(1500);
  const tex = await p.evaluate(([S0, T]) => { const s = eval(S0), t = k => s.textures.exists(k) ? { w: s.textures.get(k).getSourceImage().width, down0: s.textures.get(k).has('down_0') } : null;
    return Object.fromEntries(['hanzhong_zhanghe', 'hanzhong_xiahouyuan', 'hanzhong_caocao', ...T, 'hanzhong_hill_1', 'hanzhong_hill_4'].map(k => [k, t(k)])); }, [S, TROOPS]);
  ck('三位首领图为 v2（1152 宽）', ['hanzhong_zhanghe', 'hanzhong_xiahouyuan', 'hanzhong_caocao'].every(k => tex[k]?.w === 1152), tex);
  ck('青州兵 / 魏军强弩手四张图集已载入并切帧', TROOPS.every(k => tex[k]?.down0), tex);
  const hills = await p.evaluate(S0 => eval(S0).hills.hills.map(h => ({ type: h.mound.type, key: h.mound.texture?.key })), S);
  ck('山头用手绘地块图', hills.length === 2 && hills.every(h => h.type === 'Image' && h.key?.startsWith('hanzhong_hill_')), hills);
  const sp = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = .02; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    const h = s.hills.hills[0]; s.player.sprite.setPosition(h.x, h.y + 40);
    const out = []; [['infantry', -110, -30], ['infantry', -55, -30], ['archer', 55, -30], ['archer', 110, -30]].forEach(([k, dx, dy]) => { const e = s.spawnEnemy(k, h.x + dx, h.y + 90 + dy, 1, true); out.push({ k, sheet: e?.walkSheet, atk: e?.attackSheet, tint: e?.sprite.tintTopLeft }); }); return out; }, S);
  ck('步兵用青州兵图集、弓兵用强弩手图集，去掉换色', sp.every(e => e.sheet === (e.k === 'infantry' ? 'hanzhong_qingzhou_walk_sheet' : 'hanzhong_wei_crossbow_walk_sheet') && e.atk?.startsWith('hanzhong_') && e.tint === 0xffffff), sp);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/art-v2-troops-hill.png` });
  // 曹操出阵看一眼
  await p.evaluate(S0 => { const s = eval(S0); s.spawnBoss(); }, S);
  await p.waitForFunction(S0 => eval(S0).boss?.active, S, { timeout: 60000 });
  await p.evaluate(S0 => { const s = eval(S0); s.boss.setPosition?.(s.player.x + 140, s.player.y); if (s.boss.sprite) { s.boss.sprite.x = s.player.x + 140; s.boss.sprite.y = s.player.y; } s.devTimeScale = .02; }, S);
  await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/art-v2-caocao.png` });
  ck('曹操用 hanzhong_caocao 图', await p.evaluate(S0 => eval(S0).boss.sprite.texture.key === 'hanzhong_caocao', S));
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
