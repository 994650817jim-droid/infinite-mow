// 攻城场景截图（城墙 / 冲车路 / 城内建筑层次 / 顶部目标行），三档城各拍几处：城门前、营地看城墙、巷战入口。
// 用法：BASE=http://127.0.0.1:5197/ TAG=before node tools/shot-siege-scene.mjs   → assets/review/siege-wall/<TAG>-<档>-<处>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'shot', OUT = 'assets/review/siege-wall';
mkdirSync(OUT, { recursive: true });
const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'], ownedCities: ['xuchang', 'runan', 'guandu', 'chenliu', 'luoyang', 'wancheng', 'xiangyang'], eraSeen: 3, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 5 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
for (const tier of (process.env.TIERS ?? 'small,medium,large').split(',')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(tier + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(async tier => {
    const c = await import('/src/world/WorldCities.ts'), w = await import('/src/world/WorldStore.ts'), s = w.loadWorld();
    const id = c.CITIES.find(x => x.tier === tier && c.cityAttackable(x.id, s.ownedCities))?.id, g = window.__game;
    g.registry.set('siegeCity', id); g.registry.remove('siegeMode'); g.registry.set('runConfig', { character: 'zhaoyun' });
    for (const sc of g.scene.getScenes(true)) sc.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); g.scene.start('BootScene'); }
  }, tier);
  await p.waitForFunction(() => window.__game.scene.isActive('SiegeGameScene') && window.__game.scene.getScene('SiegeGameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game, s = g.scene.getScene('SiegeGameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; g.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0); window.__S = s;
    window.__go = (x, y, n = 40) => { s.player.sprite.setPosition(x, y); for (let i = 0; i < n; i++) { if (s.mode !== 'none' && !s.over) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'paused') s.setMode('none'); } window.__T += 1000 / 60; g.step(window.__T, 1000 / 60); } }; });
  const shot = async (name, x, y) => { await p.evaluate(([x, y]) => window.__go(x, y, 60), [x, y]); await p.screenshot({ path: `${OUT}/${TAG}-${tier}-${name}.png` }); };
  await shot('camp', 0, 120);      // 营地：冲车路 + 远处城墙
  await shot('wall', 0, -480);     // 城门前：城墙连续性、城后建筑
  await shot('wall-left', -420, -480);
  await shot('wall-right', 420, -480);
  // 大城：放下吊桥（v2 木桥横跨护城河）
  if (tier === 'large') { await p.evaluate(() => window.__S.siegeMid.lowerBridge()); await shot('bridge-down', 0, -330); }
  // 冲车毁了时的目标行（中 / 大城有冲车）
  const hasRam = await p.evaluate(() => { const M = window.__S.siegeMid; if (!M?.ramInfo) return false; M.ram.guardUntil = 0; M.damageRam(1e6); return true; });
  if (hasRam) await shot('goal-wreck', 0, -300);
  await p.close();
}
console.log(errors.length ? 'errors: ' + errors.slice(0, 4).join(' | ') : 'ok');
await b.close();
