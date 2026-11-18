// 军功信物（经验宝石）掉落 / 浮动 / 吸取手感（2026-11-18，data/gemFx.ts）：手绘图加载、抛物线落地 + 轻弹、落地浮动 + 光晕呼吸、
// 加速飞向主将 + 残影 + 拾取闪光、降级、缺图兜底、同屏 200 上限与对象池、200 个同时掉落的帧率。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-gem-drops.mjs   （SHOT=路径 时另存一张落地截图）
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const check = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS && window.__game.scene.getScene('GameScene').player, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9;
  for (const g of s.gems) { g.active = false; g.img.setVisible(false); g.glow?.setVisible(false); }
  setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); for (const w of s.player.weapons) w.cooldownLeft = 1e9; }, 30); }, G);
const H = `const s = ${G}, pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  const clear = () => { for (const g of s.gems) { g.active = false; g.img.setVisible(false); g.glow?.setVisible(false); g.ghost?.setVisible(false); } };
  const newest = () => s.gems.filter(g => g.active).sort((a, c) => c.at - a.at)[0];`;

// 1) 手绘图已加载
const r1 = await p.evaluate(`(() => { ${H} const t = k => s.textures.exists(k) ? s.textures.get(k).frameTotal - 1 : 0; return { small: t('gem_tok_small'), large: t('gem_tok_large'), fx: t('gem_fx') }; })()`);
check('手绘信物与光效图已加载（古钱 4 帧、令牌 4 帧、光效 8 帧）', r1.small === 4 && r1.large === 4 && r1.fx === 8, r1);

// 2) 掉落：抛物线落地 + 轻弹，0.3 秒内落定
const r2 = await p.evaluate(`(async () => { ${H} clear(); pl.stats.pickupRadius = 40; const x = pl.x + 300, y = pl.y;
  s.spawnGem(x, y, 1); const g = newest(), out = { tex: g.img.texture.key, size: Math.round(g.img.displayWidth), startY: Math.round(g.img.y - y), samples: [] };
  const t0 = s.combatNow; while (s.combatNow - t0 < 420) { await wait(16); out.samples.push({ t: Math.round(s.combatNow - t0), dy: +(g.img.y - g.ly).toFixed(1), ph: g.phase }); }
  const lin = out.samples.filter(q => q.t > 60 && q.t < 160); out.peak = Math.min(...lin.map(q => q.dy));
  out.restAt = (out.samples.find(q => q.ph === 'rest') || {}).t; out.landDist = Math.round(Math.hypot(g.lx - x, g.ly - y)); out.restMs = g.restMs;
  out.bounced = out.samples.some(q => q.t > 230 && q.t < 310 && q.dy < -1); out.glow = !!g.glow?.visible; out.samples = out.samples.length; return out; })()`);
check('掉落：小号用青铜古钱手绘图（约 17px 整帧）', r2.tex === 'gem_tok_small' && r2.size === 17, r2);
check('掉落：从敌人身上弹出，走抛物线（中途高于落点）', r2.startY < 0 && r2.peak < -15, r2);
check('掉落：落地后轻弹一下，0.3 秒内落定（restMs 归零）', r2.bounced && r2.restAt != null && r2.restAt <= 360 && r2.restMs === 0 && r2.landDist <= 40, r2);

// 3) 落地：上下浮动、光晕呼吸、高光扫过
const r3 = await p.evaluate(`(async () => { ${H} const g = newest(), ys = [], as = [], frames = new Set(); const t0 = s.combatNow;
  while (s.combatNow - t0 < 2600) { await wait(30); ys.push(g.img.y - g.ly); as.push(g.glow.alpha); frames.add(+g.img.frame.name); }
  return { phase: g.phase, bob: +(Math.max(...ys) - Math.min(...ys)).toFixed(2), glowMin: +Math.min(...as).toFixed(2), glowMax: +Math.max(...as).toFixed(2), glowTex: g.glow.texture.key, glowFrame: g.glow.frame.name, blend: g.glow.blendMode, frames: [...frames].sort() }; })()`);
check('落地：上下浮动约 4px（不飞走）', r3.phase === 'rest' && r3.bob >= 3 && r3.bob <= 4.5, r3);
check('落地：光晕用手绘图（gem_fx 帧 4、叠加混合）并呼吸', r3.glowTex === 'gem_fx' && r3.glowFrame === 4 && r3.blend === 1 && r3.glowMax - r3.glowMin > .15, r3);
check('落地：隔一会儿高光扫过（用到 4 帧）', r3.frames.length === 4, r3);

// 4) 吸取：加速飞向主将，残影，到达闪光，加军功，无音效
const r4 = await p.evaluate(`(async () => { ${H} const g = newest(), xp0 = pl.xp, lv0 = pl.level; const snd = []; const orig = s.sound.play.bind(s.sound); s.sound.play = (k, c) => { snd.push(k); return orig(k, c); };
  const ss = s.sfx; const sfx0 = ss && ss.play ? ss.play.bind(ss) : null; if (sfx0) ss.play = (...a) => { snd.push(a[0]); return sfx0(...a); };
  pl.stats.pickupRadius = 400; const out = { speeds: [] }; let t = 0;
  while (g.active && t < 2000) { await wait(16); t += 16; if (g.phase === 'fly') { out.speeds.push(Math.round(g.speed)); out.ghost = out.ghost || (g.ghost?.visible && g.ghost.alpha > .3 && Math.hypot(g.ghost.x - g.img.x, g.ghost.y - g.img.y) > 1); } }
  out.flyMs = t; out.active = g.active; out.xpGain = pl.level > lv0 || pl.xp > xp0;
  const sp = s.gemSparks.filter(q => q.img.visible); out.spark = sp.length; out.sparkTex = sp[0]?.img.texture.key; out.sparkNear = sp[0] ? Math.round(Math.hypot(sp[0].img.x - pl.x, sp[0].img.y - pl.y)) : -1;
  await wait(350); out.sparkGone = s.gemSparks.every(q => !q.img.visible); out.ghostHidden = !g.ghost?.visible; out.glowHidden = !g.glow?.visible;
  s.sound.play = orig; if (sfx0) ss.play = sfx0; out.sounds = snd; out.speeds = [out.speeds[0], out.speeds[out.speeds.length - 1], out.speeds.length]; pl.stats.pickupRadius = 40; return out; })()`);
check('吸取：进入范围后加速飞向主将（速度递增）', r4.speeds[2] >= 2 && r4.speeds[1] > r4.speeds[0], r4);
check('吸取：飞行中拉出残影', r4.ghost === true, r4);
check('吸取：到达后主将身上闪手绘光点，随后消失；信物 / 光晕 / 残影都收回', !r4.active && r4.spark >= 1 && r4.sparkTex === 'gem_fx' && r4.sparkNear < 30 && r4.sparkGone && r4.ghostHidden && r4.glowHidden, r4);
check('吸取：加军功、不播放音效', r4.xpGain && r4.sounds.length === 0, r4);

// 5) 大号令牌、缺图兜底
const r5 = await p.evaluate(`(async () => { ${H} clear(); s.spawnGem(pl.x + 300, pl.y, 12); const g = newest(); const out = { tex: g.img.texture.key, size: Math.round(g.img.displayWidth), glowFrame: g.glow?.frame.name };
  const ga = s.gemArt; s.gemArt = () => false; s.spawnGem(pl.x + 300, pl.y + 40, 1); const f = s.gems.find(q => q.active && q !== g); out.fallbackTex = f.img.texture.key; out.fallbackLite = f.lite; out.fallbackGlow = !!f.glow?.visible; s.gemArt = ga; clear(); return out; })()`);
check('大号（价值 ≥10）用金令牌手绘图，大号光晕', r5.tex === 'gem_tok_large' && r5.size === 26 && r5.glowFrame === 5, r5);
check('缺图时退回程序光团兜底（不画光晕）', r5.fallbackTex === 'gem_small' && r5.fallbackLite && !r5.fallbackGlow, r5);

// 6) 同屏上限 200 + 对象池 + 降级，200 个同时掉落的帧率
const r6 = await p.evaluate(`(async () => { ${H} clear(); pl.stats.pickupRadius = 40; const imgs0 = s.children.list.length;
  const frames = []; let last = performance.now(), run = true; const tick = () => { const n = performance.now(); frames.push(n - last); last = n; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  await wait(800); const base = frames.splice(0); const ug = s.updateGems.bind(s), cost = []; s.updateGems = dt => { const t = performance.now(); ug(dt); cost.push(performance.now() - t); };
  for (let i = 0; i < 250; i++) s.spawnGem(pl.x + 180 + (i % 25) * 18, pl.y - 200 + Math.floor(i / 25) * 40, i % 9 === 0 ? 12 : 1);
  const live = s.gems.filter(g => g.active).length, lite = s.gems.filter(g => g.active && g.lite).length, glows = s.gems.filter(g => g.active && g.glow?.visible).length;
  await wait(2500); run = false; const mass = frames.splice(0); s.updateGems = ug;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length, p95 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * .95)];
  const pool = s.gems.length; clear(); for (let i = 0; i < 200; i++) s.spawnGem(pl.x + 300, pl.y, 1); const poolAfter = s.gems.length, imgs1 = s.children.list.length; clear();
  return { live, lite, glows, pool, poolAfter, childGrowth: imgs1 - imgs0, baseFps: Math.round(1000 / avg(base)), massFps: Math.round(1000 / avg(mass)), massP95: Math.round(p95(mass)), massMax: Math.round(Math.max(...mass)), gemsMsAvg: +avg(cost).toFixed(3), gemsMsMax: +Math.max(...cost).toFixed(2) }; })()`);
check('同屏最多 200 个（多掉的丢弃），对象池不再新建', r6.live === 200 && r6.pool === 200 && r6.poolAfter === 200, r6);
check('同屏过多时新掉的降级（超过 120 个后不画光晕）', r6.lite >= 70 && r6.glows <= 130, r6);
check('200 个同时掉落与浮动不掉帧（平均 ≥ 55fps、95% 帧 ≤ 20ms、信物更新平均 < 1ms）', r6.massFps >= 55 && r6.massP95 <= 20 && r6.gemsMsAvg < 1, r6);

// 7) 手机布局降级
const r7 = await p.evaluate(async () => { const c = await import('/src/config.ts'); return { desktop: c.IS_DESKTOP }; });
check('电脑布局下不降级（手机布局由 IS_DESKTOP 关掉光晕 / 残影 / 闪光）', r7.desktop === true, r7);

if (process.env.SHOT) {
  await p.evaluate(`(async () => { ${H} clear(); pl.stats.pickupRadius = 40; for (let i = 0; i < 14; i++) s.spawnGem(pl.x + 90 + (i % 7) * 26, pl.y - 30 + Math.floor(i / 7) * 50, i % 4 === 0 ? 12 : 1); })()`);
  await p.waitForTimeout(1200); await p.screenshot({ path: process.env.SHOT });
}
check('无报错', errors.length === 0, errors.slice(0, 3));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
