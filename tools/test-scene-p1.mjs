// 全场景审查 P1（scene-audit.md）：C 画面与碰撞对齐（3-3 / 4-3 不再画像木栅栏的木板道；9-2 四周看得见汉水；9-3 谷壁看得见）、
// F 刷兵避开障碍（9-3、7-2、4-1……）、5-2 赤壁有江（减速、浮桥、北岸水寨）。电脑布局 1280×720，截图在 assets/review/scene-p1/。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-scene-p1.mjs   （ONLY=road,flood,breakout,spawn,chibi）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/scene-p1';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); s.yellowStages = 3; s.worldAvailable = true; s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); });
  const S = k => `window.__game.scene.getScene('${k}')`;
  const open = async (key, reg, run = {}) => {
    await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('xfNoStory', true); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [key, reg, run]);
    await p.waitForTimeout(600);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(key), { timeout: 90000 });
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^(story|xf-)/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } return eval('(' + f + ')')(s, a); }, [S(key), String(fn), arg]);
    await ev(s => { s.player.damageImmune = true; });
    await p.waitForTimeout(1200); await ev(() => 0);
    return ev;
  };
  /** 主将站在若干位置各刷 n 个兵，数落在碰撞框里的。 */
  const spawnCheck = (ev, spots, n) => ev((s, a) => {
    const boxes = s.sishuiObstacles?.footprints ?? [], inBox = (x, y) => boxes.some(b => x > b.left && x < b.right && y > b.top && y < b.bottom);
    let total = 0, bad = 0; const ex = [];
    for (const [px, py] of a.spots) { s.player.sprite.x = px; s.player.sprite.y = py;
      for (let i = 0; i < a.n; i++) { for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); const e = s.spawnAroundPlayer(i % 3 ? 'infantry' : 'archer', true); if (!e) continue; total++; if (inBox(e.x, e.y)) { bad++; if (ex.length < 4) ex.push([Math.round(e.x), Math.round(e.y)]); } } }
    for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate();
    return { total, bad, ex, boxes: boxes.length };
  }, { spots, n });

  // C：3-3 / 4-3 横向营道不再用木板道（竖条木板横铺看着像木栅栏、却不挡人）
  if (want('road')) {
    for (const [name, key, reg, rk] of [['3-3 寿春', 'ThirdGameScene', { thirdStage: 3 }, 'third_road_3'], ['4-3 乌巢', 'GuanduGameScene', { guanduStage: 3 }, 'guandu_road_3']]) {
      const ev = await open(key, reg, key === 'ThirdGameScene' ? { thirdStage: 3 } : {});
      const r = await ev((s, rk) => ({ source: s.textures.exists(rk) ? s.textures.get(rk).customData?.source ?? null : null, strip: s.children.list.some(o => o.type === 'TileSprite' && Math.round(o.width) === 8192) }), rk);
      await ev(s => { s.player.sprite.y = -190; }); await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/road-${name.split(' ')[0]}.png` });
      ck(`${name}：横向营道改土路（不再像一道木栅栏）`, r.source === 'road_v2_dirt', r);
    }
  }
  // C：9-2 场地四周画出汉水（碰撞框外是江水 + 泥岸）
  if (want('flood')) {
    const ev = await open('XiangfanGameScene', { xiangfanStage: 2 }, { thirdStage: 2 });
    const r = await ev(s => { const a = { left: -900, right: 900, top: -700, bottom: 700 }; const water = s.children.list.filter(o => o.name === 'flood-river' && o.visible && o.alpha > .5);
      const covers = (x, y) => water.some(w => x >= w.x && x <= w.x + w.width && y >= w.y && y <= w.y + w.height);
      return { water: water.length, edges: [[a.left - 200, 0], [a.right + 200, 0], [0, a.top - 200], [0, a.bottom + 200]].map(([x, y]) => covers(x, y)), inside: covers(0, 0) }; });
    await ev(s => { s.player.sprite.x = 760; s.player.sprite.y = -560; }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/9-2-banks.png` });
    ck('9-2：场地四面框外都铺了江水（看得见边界），场内不铺', r.water >= 4 && r.edges.every(Boolean) && !r.inside, r);
  }
  // C + F：9-3 谷壁看得见；刷兵不落在谷壁里
  if (want('breakout')) {
    const ev = await open('XiangfanGameScene', { xiangfanStage: 3 }, { thirdStage: 3 });
    const r = await ev(s => { const cl = s.children.list.filter(o => o.type === 'Image' && (o.texture.key === 'shu_pass' || o.texture.key === 'yellow_props') && o.depth < 20); return { cliffs: cl.length, left: cl.filter(o => o.x < -420).length, right: cl.filter(o => o.x > 420).length }; });
    await ev(s => { s.player.sprite.x = -330; s.player.sprite.y = -2250; }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/9-3-exit.png` });
    await ev(s => { s.player.sprite.x = 300; s.player.sprite.y = -800; }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/9-3-walls.png` });
    ck('9-3：两侧谷壁、出口两旁、身后都立了山崖', r.cliffs >= 30 && r.left >= 10 && r.right >= 10, r);
    const sp = await spawnCheck(ev, [[0, 200], [0, -900], [0, -1800], [0, -2300], [300, -2380]], 60);
    ck(`9-3：刷兵不落在谷壁 / 出口两旁（${sp.total} 个）`, sp.total > 200 && sp.bad === 0, sp);
  }
  // F：其它有碰撞框的关
  if (want('spawn')) {
    for (const [name, key, reg, run, spots] of [
      ['4-1 白马营栅', 'GuanduGameScene', { guanduStage: 1 }, {}, [[0, 0], [0, -300], [600, -200]]],
      ['7-2 落凤坡山道', 'ShuGameScene', { shuStage: 2 }, { thirdStage: 2 }, [[0, 0], [0, -1500], [150, 800]]],
      ['9-2 水淹七军', 'XiangfanGameScene', { xiangfanStage: 2 }, { thirdStage: 2 }, [[0, 0], [700, 500], [-700, -500]]],
    ]) {
      const ev = await open(key, reg, run);
      const sp = await spawnCheck(ev, spots, 60);
      ck(`${name}：刷兵不落在碰撞框里（${sp.total} 个，框 ${sp.boxes}）`, sp.total > 100 && sp.bad === 0, sp);
    }
  }
  // 5-2 赤壁：北面大江（减速）、两座浮桥、北岸水寨；刷兵不落江里
  if (want('chibi')) {
    const ev = await open('ChibiGameScene', { chibiStage: 2 }, { thirdStage: 2 });
    for (let i = 0; i < 20 && !(await ev(s => !!s.terrain)); i++) await p.waitForTimeout(150);
    const r = await ev(s => { const t = s.terrain; const br = t?.bridge(0); return { info: t?.info, wet: t?.inWater(0, -700), dry: t?.inWater(0, 0), mul: t?.speedMul(0, -700), bridgeDry: br ? !t.inWater(br.x, br.y) : null, camp: s.children.list.filter(o => o.name === 'chibi-river-camp').length }; });
    ck('5-2：一条大江、两座浮桥；江里减速 ×0.6，桥上不减速', r.info?.rivers === 1 && r.info?.bridges === 2 && r.wet && !r.dry && Math.abs(r.mul - .6) < 1e-6 && r.bridgeDry, r);
    ck('5-2：北岸曹军水寨布景', r.camp >= 10, r.camp);
    const w = await ev(s => { let total = 0, wet = 0; s.player.sprite.x = 0; s.player.sprite.y = -300; for (let i = 0; i < 120; i++) { for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); const e = s.spawnAroundPlayer('infantry', true); if (!e) continue; total++; if (s.terrain.inWater(e.x, e.y)) wet++; } return { total, wet }; });
    ck('5-2：刷兵不落在江里', w.total > 80 && w.wet === 0, w);
    await ev(s => { s.player.sprite.x = 0; s.player.sprite.y = -420; }); await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/5-2-river.png` });
    const br = await ev(s => { const b = s.terrain.bridge(0); s.player.sprite.x = b.x; s.player.sprite.y = b.y + 60; return { x: b.x, y: b.y }; }); void br; await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/5-2-bridge.png` });
  }
  // P2（用户批准「可以补」）：关名地形——河（5-1、8-3、12-3）、山崖 / 林（6-2、8-2、11-2、12-1）、城（1-3、12-2）、10-1 营寨
  if (want('p2')) {
    const C = [
      ['5-1 长坂', 'ChibiGameScene', { chibiStage: 1 }, { thirdStage: 1 }, { rivers: 1, bridges: 1 }],
      ['8-3 汉水', 'HanzhongGameScene', { hanzhongStage: 3 }, { thirdStage: 3 }, { rivers: 1, bridges: 2 }],
      ['12-3 五丈原', 'BeifaGameScene', { beifaStage: 3 }, { thirdStage: 3 }, { rivers: 1, bridges: 2 }],
      ['6-2 零陵武陵', 'JingnanGameScene', { jingnanStage: 2 }, { thirdStage: 2 }, { cliffs: 4, trees: 10 }],
      ['8-2 定军山', 'HanzhongGameScene', { hanzhongStage: 2 }, { thirdStage: 2 }, { cliffs: 2, trees: 10 }],
      ['11-2 盘蛇谷', 'NanzhengGameScene', { nanzhengStage: 2 }, { thirdStage: 2 }, { cliffs: 2, trees: 8 }],
      ['12-1 街亭', 'BeifaGameScene', { beifaStage: 1 }, { thirdStage: 1 }, { cliffs: 1, trees: 8 }],
    ];
    for (const [name, key, reg, run, need] of C) {
      const ev = await open(key, reg, run);
      for (let i = 0; i < 20 && !(await ev(s => !!s.terrain)); i++) await p.waitForTimeout(150);
      await p.waitForTimeout(600);
      const r = await ev(s => { const t = s.terrain, boxes = s.sishuiObstacles?.footprints ?? []; return { info: t?.info, cliffImgs: s.children.list.filter(o => o.name === 'terrain-cliff').length, cliffBoxesInScene: (t?.cliffBoxes ?? []).every(c => boxes.includes(c)) }; });
      const ok = Object.entries(need).every(([k, v]) => (r.info?.[k] ?? 0) >= v) && (!need.cliffs || (r.cliffImgs >= need.cliffs * 3 && r.cliffBoxesInScene));
      ck(`${name}：地形 ${JSON.stringify(need)}${need.cliffs ? '（山崖有画、碰撞进场景障碍）' : ''}`, ok, r);
      const sp = await ev(s => {
        const boxes = s.sishuiObstacles?.footprints ?? [], t = s.terrain; let total = 0, bad = 0; const ex = [];
        for (const [px, py] of [[0, 0], [500, 300], [-500, -300]]) {
          s.player.sprite.x = px; s.player.sprite.y = py;
          for (let i = 0; i < 50; i++) {
            for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate();
            const e = s.spawnAroundPlayer('infantry', true); if (!e) continue; total++;
            const inBox = boxes.some(b => e.x > b.left && e.x < b.right && e.y > b.top && e.y < b.bottom), wet = !!t?.inWater(e.x, e.y);
            if (inBox || wet) { bad++; if (ex.length < 3) ex.push([Math.round(e.x), Math.round(e.y), inBox ? 'box' : 'water']); }
          }
        }
        for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate();
        s.player.sprite.x = 0; s.player.sprite.y = 0; return { total, bad, ex };
      });
      ck(`${name}：刷兵不落在山崖 / 江里（${sp.total} 个）`, sp.total > 80 && sp.bad === 0, sp);
      const look = need.rivers ? await ev(s => { const b = s.terrain.bridge(0); return b ? [b.x, b.y + 160] : [0, 0]; })
        : await ev(s => { const c = s.terrain.cliffBoxes[0]; return [Math.max(c.left - 200, Math.min(c.right + 200, 0)), Math.max(c.top - 200, Math.min(c.bottom + 200, 0))]; });
      await ev((s, xy) => { s.player.sprite.x = xy[0]; s.player.sprite.y = xy[1]; }, look); await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}/p2-${name.split(' ')[0]}.png` });
    }
    // 城：1-3 广宗城墙、12-2 陈仓城墙、10-1 猇亭营寨
    let ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 3 });
    let r = await ev(s => ({ walls: s.children.list.filter(o => o.name === 'guangzong-wall').length, gate: !!s.children.getByName('guangzong-gate'), boxes: s.sishuiObstacles?.footprints.length ?? 0 }));
    await ev(s => { s.player.sprite.y = -700; }); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/p2-1-3.png` });
    ck('1-3 广宗：北面城墙 + 紧闭城门（有碰撞）', r.walls >= 8 && r.gate && r.boxes >= 3, r);
    ev = await open('BeifaGameScene', { beifaStage: 2 }, { thirdStage: 2 });
    for (let i = 0; i < 20 && !(await ev(s => !!s.siege)); i++) await p.waitForTimeout(200);
    await p.waitForTimeout(800);
    r = await ev(s => ({ walls: s.children.list.filter(o => o.name === 'chencang-wall').length, boxes: s.sishuiObstacles?.footprints.length ?? 0, gate: !!s.siege?.gateAlive }));
    await ev(s => { s.player.sprite.x = 520; s.player.sprite.y = -200; }); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/p2-12-2.png` });
    ck('12-2 陈仓：城门两侧补上城墙（有碰撞），城门可攻破', r.walls >= 12 && r.boxes >= 2 && r.gate, r);
    await ev(s => { s.player.sprite.x = 700; s.player.sprite.y = -300; });
    for (let i = 0; i < 25; i++) { await ev(s => { s.player.sprite.y -= 12; }); await p.waitForTimeout(40); }
    const y2 = await ev(s => s.player.y);
    ck('12-2 陈仓：从城墙段往北走不过去（城门没破）', y2 > -420, { end: y2 });
    ev = await open('YilingGameScene', { yilingStage: 1 }, { thirdStage: 1 });
    r = await ev(s => ({ fort: s.fort?.kind, walls: s.children.list.filter(o => o.name === 'fort-wall').map(o => o.texture.key), towers: s.sishuiPass?.snapshot().towers }));
    await ev(s => { s.player.sprite.y = -420; }); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/p2-10-1.png` });
    ck('10-1 猇亭：营栅 + 辕门（不是砖城墙、无箭楼）', r.fort === 'camp' && r.walls.length >= 8 && r.walls.every(k => k === 'props_v2_cao') && r.towers === 0, { ...r, walls: [...new Set(r.walls)] });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 5));
} finally { await b.close(); }
const pass = rows.filter(Boolean).length; console.log(`SUMMARY: ${pass}/${rows.length} passed`); process.exit(pass === rows.length ? 0 : 1);
