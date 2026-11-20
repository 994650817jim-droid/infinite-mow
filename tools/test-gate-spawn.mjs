// 城门没破之前墙内只刷远程（用户 11-20「还有没打破城门之前 墙内只会刷远程，检查所有关」；data/gateSpawn、GameScene.behindClosedWall）：
// 2-1 汜水关：关墙后面要刷的近战镜像到墙外；远程留在墙后一条带里（不进墙体）；墙内远程到上限后也镜像到墙外；
// 正常刷兵跑一阵，墙后只有远程；关门破了以后墙内才出近战。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-gate-spawn.mjs   截图 assets/review/gate-spawn/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/gate-spawn'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 1 }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.sishuiPass && s.sishuiPass.wallLine && s.elapsed < 8; }, null, { timeout: 120000 });
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, S = s.sishuiPass, L = S.wallLine, wait = ms => new Promise(r => setTimeout(r, ms));
  const R = await import('/src/data/gateSpawn.ts');
  const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
  clear(); P.damageImmune = true; P.weapons.forEach(w => { w.cooldownLeft = 1e9; }); S.tents.forEach(t => { t.at = 1e15; });
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const ox = S.gateImg?.x ?? P.x;
  // 1 直接在墙后要刷：近战 → 墙外；远程 → 墙后一条带
  const mel = s.spawnEnemy('infantry', ox + 120, L - 320, 1, true), arc = s.spawnEnemy('archer', ox - 160, L - 420, 1, true);
  const direct = { line: Math.round(L), melY: Math.round(mel.y - L), arcY: Math.round(arc.y - L) };
  // 2 墙内远程上限：再刷 14 个远程，多出来的镜像到墙外
  for (let i = 0; i < 14; i++) s.spawnEnemy('archer', ox - 500 + i * 70, L - 300, 1, true);
  const inside = s.enemies.filter(e => e.active && !e.isSupplySlot && e.y < L).length, cap = R.GATE_SPAWN.rangedCap;
  // 3 正常刷兵跑一阵（主将站在墙外 260），看墙后有没有近战
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  P.sprite.setPosition(ox, L + 260); s.devTimeScale = 3; const seenInside = {}; let n = 0; const t0 = performance.now();
  while (performance.now() - t0 < 14000) { clear(); P.sprite.setPosition(ox, L + 260); for (const e of s.enemies) { if (!e.active || e.isSupplySlot || e.kind === 'boss') continue; e.def = { ...e.def, speed: e.y < L ? 0 : e.def.speed }; if (e.y < L - 5) { const k = R.isRangedSpawn(e.kind, e.def) ? 'ranged' : 'melee:' + e.kind; seenInside[k] = (seenInside[k] ?? 0) + 1; } } n = s.wallSpawn.mirrored; await wait(150); }
  s.devTimeScale = 1; s.updateSpawner = () => {};
  // 截图：主将站墙外 70（城头在画面里），往墙后各要刷 6 个弓兵、6 个步兵——弓兵站墙后，步兵出现在墙外
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  P.sprite.setPosition(ox, L + 70); const shot = [];
  for (let i = 0; i < 6; i++) { shot.push(s.spawnEnemy('archer', ox - 330 + i * 130, L - 300, 1, true)); shot.push(s.spawnEnemy('infantry', ox - 300 + i * 120, L - 260, 1, true)); }
  for (const e of shot) if (e) e.def = { ...e.def, speed: 0, damage: 0 }; await wait(700);
  return { direct, band: R.GATE_SPAWN.band, inside, cap, seenInside, stats: { ...s.wallSpawn } };
});
await p.screenshot({ path: `${OUT}/gate-closed.png` });
ck('关门没破：墙后要刷的近战镜像到墙外，远程站在墙后一条带里（不进墙体）', r.direct.melY >= 80 && r.direct.arcY <= -r.band.near && r.direct.arcY >= -r.band.far, r.direct);
ck('墙内远程到上限（' + r.cap + '）后，多出来的也刷到墙外', r.inside === r.cap + 1 /* 上一步那个弓兵 + 上限内 */ || r.inside === r.cap, { inside: r.inside, cap: r.cap });
ck('正常刷兵跑一阵：墙后只有远程（近战都镜像到墙外）', Object.keys(r.seenInside).every(k => k === 'ranged') && r.stats.mirrored > 0, r);
const o = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), S = s.sishuiPass, L = S.wallLine, wait = ms => new Promise(r => setTimeout(r, ms));
  S.openGate(); await wait(300);
  const ox = S.gateImg?.x ?? s.player.x, e = s.spawnEnemy('infantry', ox + 150, L - 320, 1, true);
  return { open: S.gateOpen, melY: Math.round(e.y - L) };
});
ck('关门破了以后墙内才出近战', o.open && o.melY < -200, o);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
