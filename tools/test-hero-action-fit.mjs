// 武将动作帧与行走帧尺寸 / 脚线一致（用户 11-18「赵云攻击戳出去人物变小，戳完又变回来」；data/heroActionFit.ts 逐帧系数）：
// 12 位武将逐个进战场，比对「行走帧」与「待机 / 三向普攻 / 招牌 / 受伤 / 胜利 / 倒地」各帧在屏幕上的人物大小与脚线：
// - 大小：人物不透明像素面积的平方根 × 显示缩放（举兵器 / 下蹲时包围盒高矮会变，面积基本不变），按行走图同朝向归一；偏差 ≤ 5%；
// - 脚线：精灵世界坐标里人物最低不透明行的位置，与同朝向行走帧相差 ≤ 3 像素（倒地帧不比脚线：人已躺下）。
// 另录赵云「走 → 朝右戳 → 走」的前后对比帧（修前 = 把赵云系数临时置 1），存 assets/review/hero-action-fit/，再用 ffmpeg 拼成 GIF。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-hero-action-fit.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/hero-action-fit';
mkdirSync(`${OUT}/before`, { recursive: true }); mkdirSync(`${OUT}/after`, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const HEROES = (process.env.HEROES ?? 'zhaoyun,guanyu,zhangfei,huangzhong,zhuge,machao,weiyan,liubei,pangtong,huangyueying,sunshangxiang,diaochan').split(',');
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });

async function useHero(hero) {
  await p.evaluate(([G0, hero]) => { const s = eval(G0); window.__game.loop.wake(); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: hero }); s.scene.restart(); }, [G, hero]);
  await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.__DEV_ACTIONS; }, hero, { timeout: 60000 });
  await p.waitForTimeout(500);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const w of s.player.weapons) w.cooldownLeft = 1e9; window.__game.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0); }, G);
}
// 在页面里量当前精灵：人物面积平方根 × 缩放（世界像素）、人物最低不透明行的世界 y
const MEASURE = `(() => {
  const s = window.__game.scene.getScene('GameScene'), sp = s.player.sprite, fr = sp.frame, src = fr.source.image;
  const c = window.__mc ?? (window.__mc = document.createElement('canvas')); c.width = fr.cutWidth; c.height = fr.cutHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, c.width, c.height); g.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
  const d = g.getImageData(0, 0, c.width, c.height).data; let area = 0, bottom = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { area++; bottom = y; }
  const k = Math.abs(sp.scaleY), footWorld = sp.y + (bottom + 1 - sp.originY * fr.height) * k;
  return { tex: sp.texture.key, frame: String(fr.name), size: Math.sqrt(area) * k, foot: footWorld - sp.y, k, actionScale: s.player.actionScaleNow };
})()`;
const step = n => p.evaluate(n => { const g = window.__game; for (let i = 0; i < n; i++) { window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } }, n);
// 行走：走起来取 4 个不同步伐帧，取中位（与生成系数表时按 4 帧中位一致）
async function walkFrame(dir) {
  await p.evaluate(([G0, dir]) => { const s = eval(G0), pl = s.player; pl.action = null; pl.direction = dir; pl.facing = dir; s.readMove = () => new Phaser.Math.Vector2(dir === 'right' ? 1 : dir === 'left' ? -1 : 0, dir === 'down' ? 1 : dir === 'up' ? -1 : 0); }, [G, dir]);
  const seen = new Map(); for (let i = 0; i < 80 && seen.size < 4; i++) { await step(1); const m = await p.evaluate(MEASURE); if (!/_actions/.test(m.tex)) seen.set(m.frame, m); }
  await p.evaluate(G0 => { eval(G0).readMove = () => new Phaser.Math.Vector2(0, 0); }, G);
  const all = [...seen.values()], med = k => all.map(x => x[k]).sort((a, c) => a - c)[Math.floor(all.length / 2)];
  return { size: med('size'), foot: med('foot'), n: all.length };
}
// 只取该动作对应那一行的帧（动作播完回待机的帧不算）
const ROWFRAMES = { 'idle': [0, 1, 2, 3], 'attack-down': [4, 5, 6, 7], 'attack-right': [8, 9, 10, 11], 'attack-up': [12, 13, 14, 15], 'skill': [16, 17, 18, 19], 'hurt': [20, 21], 'win': [22, 23], 'die': [24] };
async function actionFrames(kind, dir) {
  // 播动作并逐帧取样（战斗时钟手动推进）；取每个不同帧的测量
  await p.evaluate(([G0, kind, dir]) => { const pl = eval(G0).player; pl.action = null; if (kind === 'attack') pl.playAction('attack', dir); else pl.playAction(kind); }, [G, kind, dir]);
  const seen = new Map();
  for (let i = 0; i < 70; i++) { const m = await p.evaluate(MEASURE); const row = ROWFRAMES[kind === 'attack' ? 'attack-' + dir : kind]; if (/_actions/.test(m.tex) && row.includes(+m.frame) && !seen.has(m.frame)) seen.set(m.frame, m); await step(1); }
  await p.evaluate(G0 => { const pl = eval(G0).player; pl.action = null; }, G);
  return [...seen.values()];
}
// 行走图同朝向面积比（侧面 / 背面本来就比正面窄），与生成系数表的口径一致
const ROW = [['idle', null, 'down'], ['attack', 'down', 'down'], ['attack', 'right', 'right'], ['attack', 'up', 'up'], ['skill', null, 'down'], ['hurt', null, 'down'], ['win', null, 'down'], ['die', null, 'down']];
const report = {};
for (const hero of HEROES) {
  await useHero(hero);
  const walk = {}; for (const d of ['down', 'right', 'up']) walk[d] = await walkFrame(d);
  const res = []; let idleSize = null;
  for (const [kind, dir, wdir] of ROW) {
    let frames;
    if (kind === 'idle') { await p.evaluate(G0 => { const pl = eval(G0).player; pl.action = null; pl.direction = pl.facing = 'down'; }, G); await step(30); frames = [await p.evaluate(MEASURE)]; if (!/_actions/.test(frames[0].tex)) frames = []; }
    else frames = await actionFrames(kind, dir ?? 'down');
    if (!frames.length) { res.push({ kind: kind + (dir ? '-' + dir : ''), missing: true }); continue; }
    const size = frames.map(f => f.size).sort((a, c) => a - c)[Math.floor(frames.length / 2)], foot = frames.map(f => f.foot);
    if (kind === 'idle') idleSize = size;
    // 归一：动作行人物大小 / 待机大小，对比行走同朝向 / 行走正面
    const rel = idleSize ? (size / idleSize) / (walk[wdir].size / walk.down.size) : 1;
    const footDiff = kind === 'die' ? 0 : Math.max(...foot.map(f => Math.abs(f - walk[wdir].foot)));
    res.push({ kind: kind + (dir ? '-' + dir : ''), rel: +rel.toFixed(3), footDiff: +footDiff.toFixed(1), frames: frames.map(f => f.frame).join(','), scale: frames[0].actionScale });
  }
  // 待机本身与行走正面比（整套比例的参照）
  const idleRow = res.find(r => r.kind === 'idle');
  const idleVsWalk = idleSize ? idleSize / walk.down.size : null;
  report[hero] = { idleVsWalk: idleVsWalk && +idleVsWalk.toFixed(3), rows: res };
  const bad = res.filter(r => !r.missing && (Math.abs(1 - r.rel) > .05 || r.footDiff > 3));
  // idleVsWalk 只作参考：待机行对行走图的整套比例由 Player.actionFitFor 按身高定（两张不同的图、姿势不同，面积口径不可靠）
  ck(`${hero}：攻击 / 招牌 / 受伤 / 胜利 / 倒地各行人物大小与行走同朝向相差 ≤5%（以待机为准）、脚线 ≤3px`, bad.length === 0 && !!idleRow, { idleVsWalk, bad, rows: res.map(r => `${r.kind}:${r.rel}/${r.footDiff}`) });
}
// 赵云前后对比帧：走 → 朝右戳 → 走（修前 = 把赵云系数临时置 1）
await useHero('zhaoyun');
const fitMod = '/src/data/heroActionFit.ts';
for (const tag of ['before', 'after']) {
  await p.evaluate(async ([url, tag]) => { const m = await import(url), t = m.HERO_ACTION_SCALE.zhaoyun_actions; window.__keep ??= [...t]; for (let i = 0; i < t.length; i++) t[i] = tag === 'before' ? 1 : window.__keep[i]; }, [fitMod, tag]);
  let n = 0; const shot = async () => { const box = await p.evaluate(G0 => { const s = eval(G0), cam = s.cameras.main, pl = s.player, z = cam.zoom, sx = (pl.x - cam.worldView.x) * z, sy = (pl.y - cam.worldView.y) * z, W = window.innerWidth / s.scale.width; return { x: sx * W, y: sy * W }; }, G); await p.screenshot({ path: `${OUT}/${tag}/f${String(n++).padStart(3, '0')}.png`, clip: { x: Math.max(0, box.x - 110), y: Math.max(0, box.y - 150), width: 220, height: 220 } }); };
  for (let cycle = 0; cycle < 2; cycle++) {
    await p.evaluate(G0 => { const s = eval(G0), pl = s.player; pl.action = null; pl.direction = pl.facing = 'right'; s.readMove = () => new Phaser.Math.Vector2(1, 0); }, G);
    for (let i = 0; i < 8; i++) { await step(4); await shot(); }
    await p.evaluate(G0 => { const s = eval(G0); s.readMove = () => new Phaser.Math.Vector2(0, 0); s.player.playAction('attack', 'right'); }, G);
    for (let i = 0; i < 8; i++) { await step(2); await shot(); }
  }
}
ck('赵云前后对比帧已录（修前 / 修后各 32 帧）', true);
ck('全程无 pageerror', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
