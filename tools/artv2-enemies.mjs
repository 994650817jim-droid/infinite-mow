// 人物画风 v2 第 3 批（一）：黄巾章小兵 v1 / v2 对比（电脑布局，1920×1080 → 渲染 2 倍）。
// 每种画风：第 1 关在主将右侧刷出 刀兵 / 盾兵 / 枪兵 / 符水道士 / 弓兵 各 2 个 → 走近截图 → 贴身出手截图；
// 检查 v2 图集换上、0.5 倍（像素 1:1）、脚底锚点在单位脚下、出手用 v2 攻击图。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5201/ OUTDIR=assets/review/artv2 node tools/artv2-enemies.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', outDir = process.env.OUTDIR ?? 'assets/review/artv2';
mkdirSync(outDir, { recursive: true });
const TYPES = {
  swordsman: { walk: 'yellow_swordsman-walk-v4', atk: 'yellow_swordsman-attack-v4' },
  shield: { walk: 'yellow_shield-walk-v4', atk: 'yellow_shield-attack-v4' },
  spear: { walk: 'yellow_spear-walk-v5', atk: 'yellow_spear-attack-v5' },
  shaman: { walk: 'yellow_shaman_walk', atk: 'yellow_shaman_cast' },
  archer: { walk: 'enemy_archer_walk_sheet', atk: 'enemy_archer_attack_sheet' },
};
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
  const info = await p.evaluate(([G0, types]) => {
    const g = window.__game, s = eval(G0); g.loop.sleep(); let T = performance.now();
    s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.();
    s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
    window.__step = n => { for (let i = 0; i < n; i++) { for (const w of s.player.weapons) w.cooldownLeft = 99; T += 1000 / 60; g.step(T, 1000 / 60); } };
    window.__step(5);
    const inf = s.chapter.enemies.infantry, defs = {
      swordsman: { ...inf, walkVisual: { texture: types.swordsman.walk, scale: .62, groundY: 88 / 96 }, attackVisual: types.swordsman.atk },
      shield: { ...s.chapter.enemies.shield, walkVisual: { texture: types.shield.walk, scale: .62, groundY: 88 / 96 }, attackVisual: types.shield.atk },
      spear: { ...inf, behavior: 'spear', walkVisual: { texture: types.spear.walk, scale: .57, groundY: 123 / 128, matched: true }, attackVisual: types.spear.atk },
      shaman: { ...inf, behavior: 'shaman', walkVisual: { texture: types.shaman.walk, scale: .72, groundY: 91 / 96 }, attackVisual: types.shaman.atk },
      archer: { ...s.chapter.enemies.archer, walkVisual: undefined, attackVisual: undefined },
    };
    const tag = new Map(); let i = 0;
    for (const [name, def] of Object.entries(defs)) for (let k = 0; k < 2; k++) {
      const e = s.spawnEnemy(def.kind, s.player.x + 230 + k * 70, s.player.y - 160 + i * 70, 1, true, def);
      if (e) { e.hp = e.maxHp = 1e9; tag.set(e, name); } i += .5;
    }
    window.__tag = tag;
    window.__step(70);
    const rows = [...tag].filter(([e]) => e.active).map(([e, name]) => { const sp = e.sprite; return { name, tex: sp.texture.key, fh: sp.frame.height, dh: sp.displayHeight, oy: sp.originY, y: sp.y, ey: e.y, r: e.def.radius }; });
    return { rows, px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, [G, TYPES]);
  const shot = async (name, i) => {
    const cx = (i.px - i.cam.x) * 2, cy = (i.py - i.cam.y) * 2, canvas = await p.$('canvas'), bb = await canvas.boundingBox(), k = bb.width / 1920;
    await p.screenshot({ path: `${outDir}/yellow-${art}-${name}.png`, clip: { x: bb.x + Math.max(0, cx - 300) * k, y: bb.y + Math.max(0, cy - 380) * k, width: 1000 * k, height: 640 * k } });
  };
  await shot('march', info);
  const atk = await p.evaluate(G0 => {
    const s = eval(G0), seen = {};
    for (let i = 0; i < 420; i++) { window.__step(1); for (const [e, name] of window.__tag) if (e.active) (seen[name] ??= new Set()).add(e.sprite.texture.key); }
    return { seen: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]])), px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, G);
  await shot('attack', atk);
  res[art] = { ...info, seen: atk.seen };
  await p.close();
}
const v2 = res.v2;
for (const [name, t] of Object.entries(TYPES)) {
  const r = v2.rows.filter(x => x.name === name), rw = r.filter(x => x.tex === t.walk);
  ck(`v2 ${name}：行走用 v2 图集 ${t.walk}`, rw.length > 0 && rw.every(x => x.fh > 96), r.map(x => [x.tex, x.fh]));
  ck(`v2 ${name}：像素 1:1（显示高 ≈ 帧高 × 0.5，含 ±5% 步伐伸缩）`, rw.length > 0 && rw.every(x => Math.abs(x.dh / (x.fh * .5) - 1) < .06), rw.map(x => [x.fh, +x.dh.toFixed(1)]));
  const off = x => (x.y + ((x.fh - 7) / x.fh - x.oy) * x.dh) - (x.ey + x.r * .72);
  ck(`v2 ${name}：脚底锚点在单位脚下（偏差 ≤4px，含步伐起伏）`, rw.length > 0 && rw.every(x => Math.abs(off(x)) <= 4), rw.map(x => +off(x).toFixed(1)));
  // 旧画风下同一场景也没出手（如黄巾刀兵只在贴身接触时挥刀）就跳过，不算美术问题
  const v1Atk = (res.v1.seen[name] ?? []).some(k => k.replace(/^readable_/, '') === t.atk);
  if (!v1Atk && !(v2.seen[name] ?? []).includes(t.atk)) console.log(`SKIP ${name}：旧画风同场景也未出手，跳过出手图检查`);
  else ck(`v2 ${name}：出手用 v2 攻击图 ${t.atk}`, (v2.seen[name] ?? []).includes(t.atk), v2.seen[name] ?? []);
}
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed · 截图 ${outDir}/yellow-{v1,v2}-{march,attack}.png`);
process.exit(fail ? 1 : 0);
