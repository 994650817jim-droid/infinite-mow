// 第十章 v2 新图核对：陆逊本体 / 招式 / 倒地、解烦兵（行走 + 攻击）。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-yiling-art.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/yiling';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('YilingGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ev = (p, fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
const wait = async (p, ms) => { for (let t = 0; t < ms; t += 200) { await ev(p, () => 0); await p.waitForTimeout(200); } };
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&art=v2');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.registry.set('yilingStage', 3); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); });
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1500);
  const tex = await ev(p, s => { const t = k => s.textures.exists(k) ? { w: s.textures.get(k).getSourceImage().width, down0: s.textures.get(k).has('down_0'), n: s.textures.get(k).frameTotal } : null; return Object.fromEntries(['yiling_luxun', 'yiling_luxun_moves', 'yiling_jiefan_walk_sheet', 'yiling_jiefan_attack_sheet'].map(k => [k, t(k)])); });
  ck('陆逊本体 v2（1152 宽）+ 招式图集（16 帧）', tex.yiling_luxun?.w === 1152 && tex.yiling_luxun_moves?.n >= 16, tex);
  ck('解烦兵行走 / 攻击图集已载入并切帧', tex.yiling_jiefan_walk_sheet?.down0 && tex.yiling_jiefan_attack_sheet?.down0, tex);
  const inf = await ev(p, s => { s.devTimeScale = .05; s.player.damageImmune = true; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); return [0, 1, 2].map(i => { const e = s.spawnEnemy('infantry', s.player.x - 80 + i * 80, s.player.y + 90, 1, true); return { sheet: e?.walkSheet, atk: e?.attackSheet, tint: e?.sprite.tintTopLeft }; }); });
  ck('步兵用解烦兵图集、去掉换色', inf.every(e => e.sheet === 'yiling_jiefan_walk_sheet' && e.atk === 'yiling_jiefan_attack_sheet' && e.tint === 0xffffff), inf);
  await wait(p, 1200); await p.screenshot({ path: `${OUT}/art-v2-jiefan.png` });
  await ev(p, s => { s.devTimeScale = 1; s.spawnBoss(); });
  await wait(p, 4000); // 等首领出场名牌过去
  // 逼出一招：看陆逊换到招式图集帧
  let mv = null;
  for (let i = 0; i < 25 && !mv; i++) { mv = await ev(p, s => { const b = s.boss; if (!b?.active) return null; b.sprite.x = s.player.x + 150; b.sprite.y = s.player.y; if (s.controller.state === 'approach') s.controller.forceSkill(s.combatNow); return b.sprite.texture.key === 'yiling_luxun_moves' && s.controller.state === 'attack' ? { key: b.sprite.texture.key, frame: b.sprite.frame.name, state: s.controller.state, vis: b.sprite.visible, a: b.sprite.alpha, x: Math.round(b.sprite.x - s.player.x) } : null; }); await p.waitForTimeout(200); }
  await p.screenshot({ path: `${OUT}/art-v2-luxun-move.png` });
  ck('陆逊出招时换到招式图集帧', !!mv, mv);
  const dk = await ev(p, s => s.textures.exists('boss_death_luxun') && s.textures.get('boss_death_luxun').frameTotal > 4);
  ck('陆逊倒地帧已预载', dk, dk);
  await ev(p, s => { s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, false); });
  await p.waitForTimeout(500);
  const fall = await ev(p, s => s.children.list.filter(o => o.texture?.key === 'boss_death_luxun').length);
  await p.screenshot({ path: `${OUT}/art-v2-luxun-fall.png` });
  ck('陆逊倒地播专属倒地帧', fall > 0, fall);
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
