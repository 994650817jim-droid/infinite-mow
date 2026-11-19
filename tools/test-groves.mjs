// 自动树林（用户「树增加多点在不同适合的场景」；data/terrain.ts GROVES）：前后对比截图 + 检查。需要开发服务器。
// 每关：?groves=0（原样）与默认（加树林）各开一次：
//  - 全景截图（拉远镜头，以开局点为中心）：assets/review/groves/<关>-{before,after}.jpg；
//  - 游戏视角截图（主将走到一片树林边）：<关>-view.jpg；
//  - 检查：自动种的树数量 > 0；没有树种在中间十字通道（|x|、|y| < 280）里、开局点 600 内、障碍框里、关卡目标 / 补给 220 内；
//    跑 10 秒统计帧率（树多了不掉帧）、镜头外的树不画（drawn < 总数）。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-groves.mjs [--only 1-2,5-2]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/groves'; mkdirSync(OUT, { recursive: true });
const CH = {
  1: { key: 'GameScene', cfg: s => ({ chapter: 'huangjin', stage: s }) }, 2: { key: 'GameScene', cfg: s => ({ chapter: 'hulao', westStage: s }) },
  3: { key: 'ThirdGameScene', reg: 'thirdStage' }, 4: { key: 'GuanduGameScene', reg: 'guanduStage' }, 5: { key: 'ChibiGameScene', reg: 'chibiStage' },
  6: { key: 'JingnanGameScene', reg: 'jingnanStage' }, 8: { key: 'HanzhongGameScene', reg: 'hanzhongStage' }, 9: { key: 'XiangfanGameScene', reg: 'xiangfanStage' },
  10: { key: 'YilingGameScene', reg: 'yilingStage' }, 11: { key: 'NanzhengGameScene', reg: 'nanzhengStage' }, 12: { key: 'BeifaGameScene', reg: 'beifaStage' },
};
// 代表关：冀州平原、荥阳、河北官渡、赤壁江岸、汉水、南中泸水、陇右街亭、洛阳城外（城墙以南）
const list = arg('only', '1-2,2-2,4-1,5-2,8-3,11-1,12-1,2-3').split(',');
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const report = {};

async function open(id, groves) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await p.goto(BASE + `?dev=1&autostart=1&stage=1&layout=desktop&story=off${groves ? '' : '&groves=0'}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  const [chn, stn] = id.split('-').map(Number), C = CH[chn];
  await p.evaluate(([C, st, cfgv]) => {
    const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
    let cfg = cfgv ?? {}; if (C.reg) { s0.registry.set(C.reg, st); cfg = C.reg === 'guanduStage' ? {} : { thirdStage: st }; }
    s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); s0.scene.start(C.key);
  }, [{ reg: C.reg, key: C.key }, stn, C.cfg?.(stn)]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.terrainInit !== undefined; }, C.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); else break; } } }; }, C.key);
  for (let i = 0; i < 25; i++) { await p.evaluate(() => window.__calm()); await p.waitForTimeout(100); }
  await p.waitForTimeout(1500); await p.evaluate(() => window.__calm());
  return { p, errors };
}
// 拉远全景：停镜头跟随，地面平铺按拉远后的视野铺满
async function overview(p, file) {
  await p.evaluate(() => { const s = window.__S, cam = s.cameras.main; window.__z0 = cam.zoom; window.__ucam = s.updateCamera; window.__sg = s.syncGround; s.updateCamera = () => {};
    s.syncGround = () => { const v = cam.worldView, g = s.ground; g.setSize(v.width + 600, v.height + 600); const x = Math.floor(v.x / 256) * 256 - 256, y = Math.floor(v.y / 256) * 256 - 256; g.setPosition(x, y); g.setTilePosition(x / g.tileScaleX, y / g.tileScaleY); };
    for (const o of s.children.list) if (o.name === 'terrain-tree' || o.name === 'terrain-tree-auto') o.setVisible(true);
    cam.setZoom(.36); s.terrain && (s.terrain.cullAcc = -1e9); });
  for (let k = 0; k < 4; k++) { await p.waitForTimeout(120); await p.evaluate(() => { const s = window.__S, cam = s.cameras.main, v = cam.worldView, c = s.terrainStart ?? { x: 0, y: 0 }; cam.scrollX += c.x - (v.x + v.width / 2); cam.scrollY += c.y - (v.y + v.height / 2); }); }
  await p.waitForTimeout(300); await p.screenshot({ path: file, quality: 84 });
  await p.evaluate(() => { const s = window.__S; s.cameras.main.setZoom(window.__z0); s.updateCamera = window.__ucam; s.syncGround = window.__sg; s.terrain && (s.terrain.cullAcc = 1e9); });
}

for (const id of list) {
  // 原样
  { const { p } = await open(id, false); await overview(p, `${OUT}/${id}-before.jpg`);
    report[id] = { before: await p.evaluate(() => window.__S.terrain?.trees.length ?? 0) }; await p.close(); }
  // 加树林
  const { p, errors } = await open(id, true);
  await overview(p, `${OUT}/${id}-after.jpg`);
  const r = await p.evaluate(() => {
    const s = window.__S, t = s.terrain; if (!t) return null;
    const auto = t.trees.filter(x => x.auto), kinds = {};
    for (const x of auto) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
    const boxes = []; for (const k of Object.keys(s)) { const v = s[k]; if (!v || typeof v !== 'object' || v === t) continue; if (Array.isArray(v.footprints)) boxes.push(...v.footprints); if (v.obstacles && Array.isArray(v.obstacles.footprints)) boxes.push(...v.obstacles.footprints); }
    const pts = [...(s.objective?.points ?? []), ...s.enemies.filter(e => e.active && e.isSupplySlot).map(e => ({ x: e.x, y: e.y }))];
    const bad = auto.filter(x => (Math.abs(x.x) < 280 || Math.abs(x.y) < 280) || Math.hypot(x.x, x.y) < 600 || boxes.some(b => x.x > b.left - 20 && x.x < b.right + 20 && x.y > b.top - 20 && x.y < b.bottom + 20) || pts.some(q => Math.hypot(q.x - x.x, q.y - x.y) < 180)).map(x => [Math.round(x.x), Math.round(x.y), x.kind]);
    // 主将走到离开局点最近的一簇自动树林旁边
    const near = auto.slice().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (near) s.player.sprite.setPosition(near.x + (near.x > 0 ? -150 : 150), near.y + 60);
    return { total: t.trees.length, auto: auto.length, kinds, bad: bad.slice(0, 6), nBad: bad.length };
  });
  await p.waitForTimeout(900); await p.evaluate(() => window.__calm()); await p.screenshot({ path: `${OUT}/${id}-view.jpg`, quality: 84 });
  // 帧率：正常刷怪跑 8 秒
  const perf = await p.evaluate(async () => { const s = window.__S; s.player.sprite.setPosition(0, 0); let n = 0, worst = 0, last = performance.now(); const t0 = last;
    await new Promise(res => { const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++; window.__calm(); if (now - t0 < 8000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { fps: Math.round(n / 8), worstMs: Math.round(worst), enemies: s.enemies.filter(e => e.active).length, drawn: s.terrain?.stats.drawn ?? 0, trees: s.terrain?.trees.length ?? 0 }; });
  report[id] = { ...report[id], ...r, perf };
  ck(`${id} 自动树林：种了树、树种对地域`, !!r && r.auto > 10, r && { auto: r.auto, total: r.total, before: report[id].before, kinds: r.kinds });
  ck(`${id} 不挡打仗的地方（十字通道 / 开局点 / 障碍 / 目标 / 补给附近没有树）`, !!r && r.nBad === 0, r && { nBad: r.nBad, bad: r.bad });
  ck(`${id} 帧率不掉、镜头外的树不画`, perf.fps >= 45 && (perf.trees < 40 || perf.drawn < perf.trees), perf);
  ck(`${id} 无页面报错`, errors.length === 0, errors.slice(0, 3));
  await p.close();
}
writeFileSync(`${OUT}/groves.json`, JSON.stringify(report, null, 1));
await b.close();
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
