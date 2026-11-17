// 人物画风 v2 第 2 批：我方 8 个兵种 v1 / v2 对比（电脑布局，1920×1080 → 渲染 2 倍）。
// 每种画风：第 1 关招满 8 个兵种各 2 人 → 行军截图 → 放木桩让他们出手 → 截图；检查 v2 图集换上、帧格与脚底锚点正确。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5201/ OUTDIR=assets/review/artv2 node tools/artv2-troops.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', outDir = process.env.OUTDIR ?? 'assets/review/artv2';
mkdirSync(outDir, { recursive: true });
const KINDS = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const res = {};
for (const art of ['v1', 'v2']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(art + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(art + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop&hd=2&art=${art}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(([G0, kinds]) => {
    const g = window.__game, s = eval(G0); g.loop.sleep(); let T = performance.now();
    s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.();
    s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
    for (const k of kinds) s.legion.recruit(k, 2, true, true);
    const v = new Phaser.Math.Vector2(1, 0); s.readMove = () => v.clone(); window.__v = v;
    window.__step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; g.step(T, 1000 / 60); } };
    window.__step(150); v.set(0, 0); window.__step(40);
    // 取样前让所有兵停火两帧（连弩兵会对场上道具开火），保证量到的是行走帧
    for (const u of s.legion.units) { u.attackUntil = 0; u.cooldown = 99; } window.__step(2);
    const units = s.legion.units.filter(u => u.active);
    const rows = units.map(u => { const sp = u.view?.sprite; return sp ? { kind: u.kind, tex: sp.texture.key, frame: String(sp.frame.name), fh: sp.frame.height, dh: sp.displayHeight, oy: sp.originY, sy: sp.scaleY, y: sp.y, uy: u.y, r: u.radius } : { kind: u.kind, none: true }; });
    return { rows, px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, [G, KINDS]);
  const shot = async (name, i) => {
    const cx = (i.px - i.cam.x) * 2, cy = (i.py - i.cam.y) * 2, canvas = await p.$('canvas'), bb = await canvas.boundingBox(), k = bb.width / 1920;
    await p.screenshot({ path: `${outDir}/troops-${art}-${name}.png`, clip: { x: bb.x + Math.max(0, cx - 520) * k, y: bb.y + Math.max(0, cy - 300) * k, width: 1040 * k, height: 600 * k } });
  };
  await shot('march', info);
  const atk = await p.evaluate(G0 => {
    const s = eval(G0);
    for (let k = 0; k < 5; k++) { const e = s.spawnEnemy('infantry', s.player.x + 150, s.player.y + (k - 2) * 40, 1); if (e) { e.hp = e.maxHp = 1e9; e.speed = 0; } }
    for (const u of s.legion.units) u.cooldown = 0;
    const seen = {};
    for (let i = 0; i < 150; i++) { window.__step(1); for (const u of s.legion.units) if (u.active && u.view && u.view.sprite.texture.key !== '__MISSING') { const sp = u.view.sprite; if (!/walk/.test(sp.texture.key)) (seen[u.kind] ??= new Set()).add(sp.texture.key); } }
    return { seen: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]])), px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, G);
  await shot('attack', atk);
  res[art] = { ...info, seen: atk.seen };
  await p.close();
}
const v2 = res.v2;
for (const kind of KINDS) {
  const r = v2.rows.filter(x => x.kind === kind && !x.none);
  ck(`v2 ${kind}：行走用 v2 图集（格高 >96）`, r.length > 0 && r.every(x => x.fh > 96 && !x.tex.startsWith('readable_')), r.map(x => [x.tex, x.fh]));
  // 显示倍率 0.5 → 帧高 × 0.5。只看行走帧：出手瞬间代码会按设计做 ±7% 的伸缩（v1 同样）
  const rw = r.filter(x => /walk/.test(x.tex));
  ck(`v2 ${kind}：行走帧像素 1:1（显示高 = 帧高 × 0.5）`, rw.length > 0 && rw.every(x => Math.abs(x.dh - x.fh * .5) < 1.5), rw.map(x => [x.fh, +x.dh.toFixed(1)]));
  // 脚底（帧高 - 7 处）落在 单位 y + 半径 × 0.72 附近（与 v1 同一位置；行走起伏最多几像素）
  const footOff = x => (x.y + ((x.fh - 7) / x.fh - x.oy) * x.dh) - (x.uy + x.r * .72);
  ck(`v2 ${kind}：脚底锚点在单位脚下（偏差 ≤4.5px）`, r.length > 0 && r.every(x => Math.abs(footOff(x)) < 4.5), r.map(x => +footOff(x).toFixed(1)));
}
const want = { swordsman: 'shu_swordsman_attack_sheet', spearman: 'shu_spearman_attack_sheet', archer: 'shu_archer_attack_sheet', crossbowman: 'legion_crossbowman_action', halberdier: 'legion_halberdier_action', medic: 'legion_medic_action' };
for (const [kind, key] of Object.entries(want)) ck(`v2 ${kind}：出手用 ${key}`, (v2.seen[kind] ?? []).includes(key), v2.seen[kind] ?? []);
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed · 截图 ${outDir}/troops-{v1,v2}-{march,attack}.png`);
process.exit(fail ? 1 : 0);
