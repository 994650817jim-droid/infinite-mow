// 小兵行走平稳度（Enemy.updateWalkAnimation 的步伐表现）：脚底贴地不上下跳、身体起伏每循环两步且幅度小、
// 摆动幅度小、换帧速度与移速挂钩。v2 画风与 ?art=v1 各录一遍，连续帧存 assets/review/enemy-walk/<TAG>/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ TAG=after node tools/test-enemy-walk.mjs [--record-only]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', recordOnly = process.argv.includes('--record-only');
const out = `assets/review/enemy-walk/${tag}`; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const metrics = {};
for (const art of ['v2', 'v1']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(art + ' ' + e.message));
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop&art=${art}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  // 主将站定、不出手；右侧一排小兵（刀兵 / 盾兵 / 弓兵）从远处走向主将
  const kinds = await p.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.();
    g.loop.sleep(); window.__T = performance.now();
    s.player.damageImmune = true; s.player.weapons = []; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    const px = s.player.x, py = s.player.y; window.__units = [];
    for (const [i, k] of ['infantry', 'shield', 'archer'].entries()) { const e = s.spawnEnemy(k, px + 330 + i * 40, py - 60 + i * 60, 1, true); if (e) { e.hp = e.maxHp = 1e6; window.__units.push(e); } }
    window.__step = () => { window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); return window.__units.map(e => { const sp = e.sprite, k = sp.scaleY, fh = sp.frame.height;
      return { x: +e.x.toFixed(2), y: +e.y.toFixed(2), frame: String(sp.frame.name), tex: sp.texture.key, top: +(sp.y - sp.originY * fh * k).toFixed(2), bottom: +(sp.y + (1 - sp.originY) * fh * k).toFixed(2), rot: +sp.rotation.toFixed(4), sy: +sp.scaleY.toFixed(4) }; }); };
    window.__clip = () => { const c = g.canvas.getBoundingClientRect(), cam = s.cameras.main, kk = c.width / g.scale.gameSize.width * cam.zoom, wv = cam.worldView, e = window.__units[0]; return { x: c.left + (e.x - wv.x) * kk, y: c.top + (e.y - wv.y) * kk, k: kk }; };
    return window.__units.map(e => e.kind + ':' + e.walkSheet);
  });
  const rows = [];
  for (let i = 0; i < 90; i++) {
    rows.push(await p.evaluate(() => window.__step()));
    if (i >= 30 && i % 2 === 0) { const c = await p.evaluate(() => window.__clip()); const w = 150 * c.k, h = 120 * c.k; await p.screenshot({ path: `${out}/${art}-${String(i).padStart(3, '0')}.png`, clip: { x: c.x - w / 2, y: c.y - h * .7, width: w, height: h } }); }
  }
  metrics[art] = { kinds, rows };
  // 分析：每个单位稳定行走段（第 20 帧起）
  const res = kinds.map((kind, u) => {
    const all = rows.slice(20).map(x => x[u]);
    // 只看行走帧（弓兵会边走边出手，攻击帧格子大小不同，不计入）
    const r = rows.slice(20).map(x => x[u]).filter(x => /^(down|up|left|right)_\d$/.test(x.frame) && /walk/.test(x.tex));
    if (r.length < 30) return { kind, skipped: 'walk frames ' + r.length };
    const dist = Math.hypot(all.at(-1).x - all[0].x, all.at(-1).y - all[0].y), secs = all.length / 60;
    const changes = r.filter((x, i) => i && x.frame !== r[i - 1].frame).length;
    // 相对单位位置的头顶 / 纹理底边（世界像素）：底边跳动 = 整个人离地
    const top = r.map(x => x.top - x.y), bot = r.map(x => x.bottom - x.y);
    const range = a => +(Math.max(...a) - Math.min(...a)).toFixed(2);
    // 起伏次数：身体伸缩（scaleY）的局部最大值个数；同一帧格子内比较，避免换图集时的跳变
    const sy = r.map(x => x.sy), lo = Math.min(...sy), hi = Math.max(...sy);
    let peaks = 0; for (let i = 1; i < sy.length - 1; i++) if (sy[i] > sy[i - 1] && sy[i] >= sy[i + 1] && sy[i] > lo + (hi - lo) * .4) peaks++;
    const cycles = changes / 4;
    return { kind, speed: +(dist / secs).toFixed(1), framesPerSec: +(changes / (r.length / 60)).toFixed(1), headRange: range(top), footRange: range(bot), maxRot: +Math.max(...r.map(x => Math.abs(x.rot))).toFixed(3), bobsPerCycle: cycles ? +(peaks / cycles).toFixed(2) : 0 };
  });
  console.log(art, JSON.stringify(res));
  if (!recordOnly) for (const x of res.filter(x => !x.skipped)) {
    ck(`${art} ${x.kind}：脚底贴地（纹理底边上下跳动 ≤0.6px）`, x.footRange <= .6, x);
    ck(`${art} ${x.kind}：身体起伏小（头顶 ≤2.5px）、摆动 ≤0.025 弧度、每循环两次（跟步伐一致）`, x.headRange <= 2.5 && x.maxRot <= .025 && x.bobsPerCycle >= 1.5 && x.bobsPerCycle <= 2.6, x);
    ck(`${art} ${x.kind}：换帧速度与移速挂钩（每秒 ≥6 帧，且每帧位移 ≤14px）`, x.framesPerSec >= 6 && x.speed / x.framesPerSec <= 14, x);
  }
  await p.close();
}
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics));
if (!recordOnly) { ck('全程无 pageerror', errors.length === 0, errors.slice(0, 5)); console.log(`\n${pass} passed, ${fail} failed`); }
await b.close();
process.exit(fail ? 1 : 0);
