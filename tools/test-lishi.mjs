// 首领遗珍「黄巾力士」与敌方黄巾区分（2026-11-18 用户：「召唤的黄巾需要区分出来和普通黄巾」）：
// 召出后存在、是我方（敌我描边走我方颜色）、用专用纹理（lishi_walk / lishi_attack，不是敌方黄巾图）、
// 脚下符阵光圈 + 头顶「力」字符牌、符纸化出 / 化回符纸序列帧、到时消失、对象池复用；截一张和普通黄巾混在一起的对比图。
// 电脑布局 1280×720。用法：BASE=http://127.0.0.1:5173/ node tools/test-lishi.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/lishi';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_iff_outline', '1'); localStorage.setItem('im_items_v2', JSON.stringify({ version: 2, bag: [], loadouts: {}, autoSalvageWhite: false })); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const G = "window.__game.scene.getScene('GameScene')";

// 1) 穿上人公符水、身边一圈普通黄巾，拾 80 颗宝石召两个力士；刚召出时在放「符纸化出」
const born = await p.evaluate(async G0 => {
  const s = eval(G0), st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), pl = s.player;
  s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.damageImmune = true;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate?.(); }
  const r = it.rollRelic('relic_fushui'); st.addItems([r]); st.equipItem('zhaoyun', r.uid); s.refreshGear();
  // 一圈敌方黄巾（不动、血厚），混在力士周围
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * 95, pl.y + Math.sin(a) * 62, 1, true); e.speed = 0; e.hp = e.maxHp = 1e6; }
  for (let i = 0; i < 80; i++) s.relics.onGem(s.combatNow);
  const L = s.relics.lishiUnits(), v = s.relics.lishiPool;
  return { n: s.relics.metrics.lishi, units: L.length, fx: v.map(x => ({ vis: x.fx.visible, key: x.fx.texture.key, f: +x.fx.frame.name })), alpha: L.map(u => u.sprite.alpha) };
}, G);
ck('人公符水：拾 80 颗宝石召出 2 个力士', born.n === 2 && born.units === 2, born);
ck('出场：放「符纸化出」手绘序列帧（lishi_fx 第 6–11 帧），人物先不显形', born.fx.every(x => x.vis && x.key === 'lishi_fx' && x.f >= 6 && x.f <= 11) && born.alpha.every(a => a < .5), born);
await p.waitForTimeout(250); await p.screenshot({ path: `${out}/summon.png`, clip: { x: 440, y: 200, width: 400, height: 320 } });
await p.waitForTimeout(900);

// 2) 在场：专用纹理、我方、光圈 + 符牌、敌我描边我方色
await p.evaluate(async () => { window.__metrics = await window.__mod('systems/SpriteMetrics.ts'); });
const live = await p.evaluate(G0 => {
  const s = eval(G0), L = s.relics.lishiUnits(), v = s.relics.lishiPool, enemyKeys = s.enemies.filter(e => e.active && !e.isSupplySlot).map(e => e.sprite.texture.key);
  const iff = [...s.iffUnits()].filter(u => L.some(l => l.sprite === u.sprite)).map(u => ({ side: u.side, keep: !!u.keepColors }));
  const outline = L.map(l => s.iff?.overlayOf(l.sprite)?.tintTopLeft ?? null);
  // 人物实际身高：按图集实测身高（SpriteMetrics，和 test-hero-actions 同口径）× 显示倍率；力士按行走图量（攻击图举锤时更高）
  const fig = (sp, key) => (window.__metrics?.sheetFigureHeight(s, key ?? sp.texture.key) ?? sp.frame.height) * sp.scaleY;
  const en = s.enemies.find(e => e.active && !e.isSupplySlot);
  return { keys: L.map(l => l.sprite.texture.key), alpha: L.map(l => l.sprite.alpha), h: L.map(l => Math.round(fig(l.sprite, 'lishi_walk'))), enemyKeys: [...new Set(enemyKeys)], enemyH: Math.round(fig(en.sprite)),
    ring: v.map(x => ({ vis: x.ring.visible, key: x.ring.texture.key, f: +x.ring.frame.name, blend: x.ring.blendMode })), tag: v.map(x => ({ vis: x.tag.visible, key: x.tag.texture.key, above: x.tag.y < x.body.y - 40 })), fx: v.map(x => x.fx.visible), iff, outline };
}, G);
ck('在场：用专用纹理 lishi_walk / lishi_attack，不是敌方黄巾的行走图，完全显形', live.keys.every(k => k === 'lishi_walk' || k === 'lishi_attack') && live.keys.every(k => !live.enemyKeys.includes(k)) && live.alpha.every(a => a > .95), live);
ck('力士比普通黄巾高大（人物身高约 1.2–1.45 倍，含扛在肩上的锤头）', live.h.every(h => h >= live.enemyH * 1.15 && h <= live.enemyH * 1.5), { h: live.h, enemy: live.enemyH });
ck('脚下手绘符阵光圈循环（lishi_fx 第 0–5 帧，叠加混合）、头顶「力」字符牌，化符特效已收', live.ring.every(r => r.vis && r.key === 'lishi_fx' && r.f >= 0 && r.f <= 5 && r.blend === 1) && live.tag.every(t => t.vis && t.key === 'lishi_tag' && t.above) && live.fx.every(x => !x), live);
ck('敌我描边：力士算我方（保持原画），描边是我方青色', live.iff.length === 2 && live.iff.every(u => u.side === 'ally' && u.keep) && live.outline.every(c => c === 0x63e6ff), { iff: live.iff, outline: live.outline });
await p.screenshot({ path: `${out}/mixed-with-yellow.png`, clip: { x: 400, y: 170, width: 480, height: 380 } });
// 不开描边也要一眼分得出：关掉描边再截一张
await p.evaluate(G0 => { const s = eval(G0); if (s.iff) s.iff.mode.outline = false; }, G); await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/mixed-with-yellow-no-outline.png`, clip: { x: 400, y: 170, width: 480, height: 380 } });

// 3) 出手：贴近敌人时换攻击图（下砸）
const atk = await p.evaluate(async G0 => { const s = eval(G0), seen = new Set(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50)); for (const l of s.relics.lishiUnits()) seen.add(l.sprite.texture.key + ':' + l.sprite.frame.name); } return [...seen]; }, G);
ck('出手时换攻击图（lishi_attack 帧）', atk.some(k => k.startsWith('lishi_attack:')), atk.slice(0, 12));

// 4) 到时：化回符纸飘散，然后消失；再召复用对象池
const gone = await p.evaluate(async G0 => {
  const s = eval(G0); for (const l of s.relics.lishi) l.until = s.combatNow;
  await new Promise(r => setTimeout(r, 160));
  const mid = s.relics.lishiPool.map(x => ({ vis: x.fx.visible, f: +x.fx.frame.name }));
  await new Promise(r => setTimeout(r, 900));
  const after = { units: s.relics.lishiUnits().length, shown: s.relics.lishiPool.filter(x => x.body.visible || x.ring.visible || x.tag.visible || x.fx.visible).length, views: s.relics.metrics.lishiViews };
  for (let i = 0; i < 40; i++) s.relics.onGem(s.combatNow);
  return { mid, after, again: { units: s.relics.lishiUnits().length, views: s.relics.metrics.lishiViews, pool: s.relics.lishiPool.length } };
}, G);
ck('到时：放「化回符纸飘散」序列帧（第 12–17 帧）', gone.mid.every(x => x.vis && x.f >= 12 && x.f <= 17), gone.mid);
ck('散完后消失（不在场、显示对象全部收起）', gone.after.units === 0 && gone.after.shown === 0, gone.after);
ck('对象池复用：再召 1 个不新建显示对象（仍是 2 套）', gone.again.units === 1 && gone.again.views === 2 && gone.again.pool === 2, gone.again);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
