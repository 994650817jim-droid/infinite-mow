// 人物画风 v1 / v2 对比截图（电脑布局 960×540，1920×1080 窗口 → 渲染 2 倍，与 PC 全屏一致）。
// 每种画风：进第 1 关，主将赵云边走边打 → 整屏截图 + 主将周围放大截图；并检查 v2 图集已换上、最近邻过滤、脚底锚点稳定。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5201/ OUTDIR=assets/review/artv2 node tools/artv2-compare.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', outDir = process.env.OUTDIR ?? 'assets/review/artv2';
const hero = process.env.HERO ?? 'zhaoyun', weapon = process.env.WEAPON ?? 'spear_orbit';
mkdirSync(outDir, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
for (const art of ['v1', 'v2']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(art + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(art + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop&hd=2&art=${art}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, hero, weapon]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 60000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); }, G);
  // 清场、停刷怪，接管时钟与移动输入
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); g.loop.sleep(); let T = performance.now();
    s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
    const v = new Phaser.Math.Vector2(1, 0); s.readMove = () => v.clone(); window.__v = v;
    window.__step = n => { for (let i = 0; i < n; i++) { T += 1000 / 60; g.step(T, 1000 / 60); } };
    const sp = s.player.sprite;
    window.__foot = () => { // v2 图集脚底行固定（行走原生 68 / 动作 88，×4 入库），换算成相对精灵中心的世界像素
      const fh = sp.frame.height, row = fh === 288 ? 68 : fh === 384 ? 88 : NaN;
      return ((row + 1) * fh / (fh === 288 ? 72 : 96) - sp.originY * fh) * sp.scaleY;
    };
  }, G);
  const shot = async (name, info) => {
    const cx = (info.px - info.cam.x) * 2, cy = (info.py - info.cam.y) * 2;
    const canvas = await p.$('canvas'), bb = await canvas.boundingBox(), k = bb.width / 1920;
    await p.screenshot({ path: `${outDir}/${art}-${name}.png`, clip: { x: bb.x + (cx - 240) * k, y: bb.y + (cy - 150) * k, width: 480 * k, height: 260 * k } });
  };
  // 1) 空场向右走：行走帧、显示尺寸、过滤方式、脚底
  const walk = await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0), sp = s.player.sprite; window.__step(50);
    const gl = g.renderer.gl, src = sp.texture.source[0]; gl.bindTexture(gl.TEXTURE_2D, src.glTexture?.webGLTexture ?? src.glTexture);
    const filter = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER) === gl.NEAREST ? 'nearest' : 'linear';
    const walkFoot = []; for (let i = 0; i < 20; i++) { window.__step(1); if (!s.player.currentAction) walkFoot.push(window.__foot()); }
    window.__step(3);
    return { tex: sp.texture.key, frame: sp.frame.name, filter, walkH: sp.displayHeight, walkFoot, tinted: sp.isTinted, px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, G);
  await p.screenshot({ path: `${outDir}/${art}-full.png` });
  await shot('walk', walk);
  // 2) 停下，放三个木桩让普攻出手，停在突刺最远那一帧截图
  const atk = await p.evaluate(G0 => {
    const s = eval(G0), sp = s.player.sprite; window.__v.set(0, 0); window.__step(10);
    for (let k = 0; k < 3; k++) { const e = s.spawnEnemy('infantry', s.player.x + 95, s.player.y + (k - 1) * 30, 1); if (e) { e.hp = e.maxHp = 1e9; e.speed = 0; } }
    for (const w of s.player.weapons) w.cooldownLeft = 0;
    const actFoot = []; let actTex = '', caught = false;
    for (let i = 0; i < 150 && !caught; i++) { window.__step(1); if (s.player.currentAction) { actTex = sp.texture.key; actFoot.push(window.__foot()); if (s.player.currentAction === 'attack' && ['10', '42'].includes(String(sp.frame.name))) caught = true; } }
    return { actTex, actFoot, frame: String(sp.frame.name), action: s.player.currentAction, tinted: sp.isTinted, px: s.player.x, py: s.player.y, cam: s.cameras.main.worldView };
  }, G);
  await shot('attack', atk);
  results[art] = { ...walk, actTex: atk.actTex, actFoot: atk.actFoot, atkFrame: atk.frame, atkAction: atk.action, atkTinted: atk.tinted };
  console.log(art, JSON.stringify({ walkFrame: walk.frame, walkTinted: walk.tinted, atkFrame: atk.frame, atkAction: atk.action, atkTinted: atk.tinted }));
  await p.close();
}
const v2 = results.v2, v1 = results.v1;
const spread = a => a.length ? Math.max(...a) - Math.min(...a) : 0;
ck('v1 仍用旧图集（线性过滤）', v1.tex === 'readable_hero_walk_sheet' || v1.tex === 'hero_walk_sheet', { tex: v1.tex, filter: v1.filter });
ck('v2 主将行走用 hero_walk_sheet 且最近邻过滤（不再套浅色描边派生图）', v2.tex === 'hero_walk_sheet' && v2.filter === 'nearest', { tex: v2.tex, filter: v2.filter });
ck('v2 行走整格按 1 美术像素 = 1 逻辑像素显示（72）', Math.abs(v2.walkH - 72) < 3.5, { walkH: v2.walkH });
ck('v2 普攻用 zhaoyun_actions 动作图集', v2.actTex === 'zhaoyun_actions', { actTex: v2.actTex, n: v2.actFoot.length });
const walkMed = [...v2.walkFoot].sort((a, b) => a - b)[v2.walkFoot.length >> 1] ?? 0;
ck('v2 出手时脚底与行走脚底同一高度（偏差 ≤4px）', v2.actFoot.length > 0 && v2.actFoot.every(f => Math.abs(f - walkMed) <= 4), { walkMed, act: [Math.min(...v2.actFoot), Math.max(...v2.actFoot)], walkSpread: spread(v2.walkFoot) });
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed · 截图在 ${outDir}/{v1,v2}-{full,walk,attack}.png`);
process.exit(fail ? 1 : 0);
