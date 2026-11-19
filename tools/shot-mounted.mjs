// 骑马比例 / 移速对比截图（11-18 用户「骑马整体的比例可以小点，和移速慢点」）：电脑布局 1280×720，逐帧推进（前后两次同一画面）。
// ① 主将骑赤兔、旁边一排步兵 ② 敌方骑兵一队 + 步兵对照 ③ 骑马首领（华雄一阶段）；另录主将骑马跑过步兵 / 骑兵的帧序列（GIF 用）。
// 并量出画面里骑马的高度 / 步兵高度、主将骑马移速。
// 用法：BASE=http://127.0.0.1:5197/ TAG=before node tools/shot-mounted.mjs → assets/review/mounted/<TAG>-*.png、<TAG>-gif/f###.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'shot', OUT = 'assets/review/mounted';
mkdirSync(`${OUT}/${TAG}-gif`, { recursive: true });
const world = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 3, mountHintDone: true };
const items = { version: 1, bag: [{ uid: 'm1', base: 'chitu', quality: 'orange', affixes: [{ id: 'move', value: .05 }] }], loadouts: { zhaoyun: { mount: 'm1' } }, salvaged: 0 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const G = "window.__game.scene.getScene('GameScene')";
async function open(run) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(([w, it]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_items_v1', JSON.stringify(it)); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); sessionStorage.setItem('seeded', '1'); } }, [world, items]);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(run => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...run }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, run);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(G0 => { const s = eval(G0), g = window.__game; s.__DEV_ACTIONS?.closePopup?.(); for (let i = 0; i < 6 && s.mode === 'levelup'; i++) s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9; g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } }; }, G);
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
const report = {};
// ① 主将骑马 + 步兵一排；② 敌骑一队 + 步兵
{
  const p = await open({ chapter: 'huangjin', stage: 1 });
  const m = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; const inf = [], cav = [];
    for (let i = 0; i < 3; i++) { const e = s.spawnEnemy('infantry', pl.x - 140 + i * 50, pl.y + 10, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; inf.push(e); }
    window.__step(20); const box = o => { const b = o.getBounds(); return Math.round(b.height); };
    return { mounted: !!s.mount?.mounted, horseH: box(s.children.getByName('hero-mount')), riderH: box(pl.sprite), infH: box(inf[0].sprite), mul: pl.mountSpeedMul }; }, G);
  await shot(p, 'hero'); report.hero = m;
  // 主将骑马移速：1 秒走多远
  const sp = await p.evaluate(G0 => { const s = eval(G0), pl = s.player, x0 = pl.x; s.readMove = () => new Phaser.Math.Vector2(1, 0); window.__step(60); s.readMove = () => new Phaser.Math.Vector2(0, 0); return Math.round(pl.x - x0); }, G); report.heroSpeed = sp;
  // GIF：主将骑马在步兵与骑兵之间来回跑
  await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.sprite.setPosition(pl.x - 120, pl.y);
    for (let i = 0; i < 3; i++) { const e = s.spawnEnemy('infantry', pl.x + 40 + i * 46, pl.y - 70, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; }
    for (let i = 0; i < 3; i++) { const e = s.spawnEnemy('cavalry', pl.x + 40 + i * 70, pl.y + 80, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; } window.__step(4); }, G);
  for (let f = 0; f < 36; f++) { await p.evaluate(([G0, f]) => { const s = eval(G0); s.readMove = () => new Phaser.Math.Vector2(f < 18 ? 1 : -1, 0); window.__step(4); }, [G, f]); await p.screenshot({ path: `${OUT}/${TAG}-gif/f${String(f).padStart(3, '0')}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } }); }
  // ② 敌骑一队 + 步兵对照（主将在右侧作参照）
  const c = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; s.readMove = () => new Phaser.Math.Vector2(0, 0); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); window.__step(30); const cx = pl.x - 90, cy = pl.y; const cav = [], inf = [];
    for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('cavalry', cx - 150 + i * 70, cy - 70, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; cav.push(e); }
    for (let i = 0; i < 3; i++) { const e = s.spawnEnemy('infantry', cx - 120 + i * 60, cy + 90, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; inf.push(e); }
    window.__step(6);
    return { cavH: Math.round(cav[0].sprite.getBounds().height), infH: Math.round(inf[0].sprite.getBounds().height), cavSpeed: Math.round(s.chapter.enemies.cavalry.speed), cavSpawnSpeed: Math.round(cav[0].def.speed === 0 ? -1 : cav[0].def.speed) }; }, G);
  await shot(p, 'cavalry'); report.cavalry = c;
  await p.close();
}
// ③ 骑马首领：华雄（第二章第一关，一阶段在马上）
{
  const p = await open({ chapter: 'hulao', westStage: 1 });
  await p.evaluate(G0 => { const s = eval(G0); if (!s.boss?.active) s.spawnBoss(); window.__step(60); }, G); await p.waitForTimeout(5000); // 等首领骑乘图 / 马图载完（主循环停着，载图靠浏览器回调）
  const r = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; window.__step(180); const bo = s.boss; if (!bo) return { boss: false }; bo.sprite.setPosition(pl.x + 110, pl.y + 10); window.__step(3); const e = s.spawnEnemy('infantry', pl.x - 90, pl.y + 10, 1, true); e.speed = 0; e.def = { ...e.def, speed: 0 }; window.__step(3);
    const m = s.bossMount ?? s.huaxiong?.mount; return { boss: true, mounted: !!m?.mounted, bossH: Math.round(bo.sprite.getBounds().height), horse: !!s.children.list.find(o => o.name === 'boss-horse' && o.visible), tex: bo.sprite.texture.key, ride: s.bossMount?.rideKey ?? null }; }, G);
  await shot(p, 'boss'); report.boss = r;
  await p.close();
}
console.log(JSON.stringify(report));
await b.close();
