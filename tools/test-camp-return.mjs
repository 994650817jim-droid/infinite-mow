// 打完一关回营寨，营寨仍是手绘图（2026-11-18 用户：「打完一关之后再回去营寨没损失，这里回到营寨出现bug」——回营寨变成程序画占位）。
// 原因：进战斗时 BootScene 把「所有已载入的键」记成战斗图集（含营寨手绘图），回营寨时 CityScene 当战斗图集卸掉。
// 流程：营寨（手绘）→ 出征（BootScene 载战斗图集）→ 1-1 打赢 → 回营寨，检查全景底图 / 营寨建筑 / 营帐道具都用手绘纹理；顺带看天下地图。
// 电脑布局 960×540。用法：BASE=http://127.0.0.1:5173/ node tools/test-camp-return.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/camp-full';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); });
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, provisions: 800, tutorialSeen: true }); s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1'); });
const toCamp = async () => { await p.evaluate(() => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('CityScene'))); await p.waitForFunction(() => window.__game.scene.isActive('CityScene') && window.__game.scene.getScene('CityScene').pano, null, { timeout: 90000 }); await p.waitForTimeout(1800); };
const campArt = () => p.evaluate(() => {
  const c = window.__game.scene.getScene('CityScene'), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(c.pano.list);
  const keys = [...new Set(all.map(o => o.texture?.key).filter(Boolean))];
  return { keys, bg: keys.includes('city_bg_1'), hall: keys.some(k => k === 'city_camp_hall' || /^city_hall_\d$/.test(k)), props: keys.filter(k => /^camp_/.test(k)).length, missing: keys.includes('__MISSING'), placeholders: all.filter(o => o.type === 'Graphics').length };
});
await toCamp();
const first = await campArt();
await p.screenshot({ path: `${out}/return-1-first.png` });
ck('第一次进营寨：全景底图 / 主帐 / 营帐道具都是手绘图', first.bg && first.hall && first.props >= 3 && !first.missing, first);
// 出征：和营寨「出征备战」同一条路（loadBattle → BootScene 载战斗图集 → 主页），再进 1-1
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); c.registry.set('loadBattle', true); c.scene.start('BootScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 180000 }); await p.waitForTimeout(800);
const listed = await p.evaluate(() => { const k = window.__game.registry.get('battleTextureKeys') ?? []; return { n: k.length, camp: k.filter(x => /^city_|^camp_/.test(x)) }; });
ck('战斗图集清单里不含营寨的手绘图（city_* / camp_*）', listed.n > 0 && listed.camp.length === 0, listed);
await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); m.registry.set('heroConfirmed', true); m.pickChapter('huangjin', 1); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene')?.player && window.__game.scene.isActive('GameScene'), null, { timeout: 120000 }); await p.waitForTimeout(1500);
// 打赢：杀首领、选完升级、捡宝箱
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; s.spawnBoss(); s.hitEnemy(s.boss, 1e9, s.combatNow, 'melee', false, false);
  for (let t = 0; t < 80 && !s.over && s.mode !== 'rest'; t++) { for (let i = 0; i < 40 && s.mode === 'levelup'; i++) s.chooseUpgrade(0); s.collectBossChests?.(); await new Promise(r => setTimeout(r, 120)); } });
const won = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { over: s.over, victory: s.victory, mode: s.mode }; });
ck('1-1 打赢', won.victory !== false && (won.over || won.mode === 'rest'), won);
// 回天下地图看一眼，再回营寨
await p.evaluate(() => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('WorldMapScene')));
await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 90000 }); await p.waitForTimeout(1500);
const map = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m.children.list); const keys = [...new Set(all.map(o => o.texture?.key).filter(Boolean))]; return { missing: keys.includes('__MISSING'), n: keys.length }; });
ck('战后天下地图没有缺图（__MISSING）', !map.missing && map.n > 3, map);
await toCamp();
const back = await campArt();
await p.screenshot({ path: `${out}/return-2-after-battle.png` });
ck('打完一关回营寨：仍是手绘全景底图 / 主帐 / 营帐道具（不退回程序画占位）', back.bg && back.hall && back.props >= 3 && !back.missing && back.props >= first.props - 1, { first: { props: first.props }, back });
ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
