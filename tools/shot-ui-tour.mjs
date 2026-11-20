// 全游戏 UI 巡检截图（2026-11-20 夜间「整体 UI 审查 + 修」）：电脑布局 1280×720，逐个界面截图。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-ui-tour.mjs   （ONLY=menu,city,world,battle,rest,result 只跑部分）
// 每段开一个新页面（场景直接 start 会跳过 BootScene 的资源加载）。截图在 assets/review/night-ui/<TAG>-<界面>.png；同时打印可见顶层对象名。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'before', OUT = 'assets/review/night-ui';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
let p;
const fresh = async (q, readyScene) => {
  if (p) await p.close().catch(() => {});
  p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('tour-seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_city_intro_v3', '1'); localStorage.setItem('im_mount_guide_v1', '1'); sessionStorage.setItem('tour-seeded', '1'); } });
  await p.goto(BASE + q, { timeout: 180000 });
  await p.waitForFunction(k => window.__game?.scene.isActive(k), readyScene, { timeout: 180000 }); await p.waitForTimeout(1500);
};
const seedWorld = () => p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, tutorialSeen: true }); s.provisions = (s.provisions ?? 0) + 3000; s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); });
const hideDev = () => p.evaluate(() => { document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }); });
const shot = async (name, scene) => {
  await hideDev(); await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  const names = scene ? await p.evaluate(k => { const s = window.__game.scene.getScene(k); return s ? s.children.list.filter(o => o.visible && o.name).map(o => o.name).slice(0, 45) : []; }, scene).catch(() => []) : [];
  console.log('SHOT', name, names.join(','));
};
const go = async (key) => { await p.evaluate(k => { window.__game.scene.getScenes(true).forEach(sc => sc.scene.start(k)); }, key); await p.waitForFunction(k => window.__game.scene.isActive(k), key, { timeout: 60000 }); await p.waitForTimeout(2200); };
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log('ERR', label, String(e).slice(0, 200)); } };
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, arg) => p.evaluate(([S0, f, a]) => eval('(' + f + ')')(eval(S0), a), [G, String(fn), arg]);
const battle = async (stage = 1) => {
  await fresh(`?dev=1&autostart=1&stage=${stage}&layout=desktop&story=off`, 'GameScene');
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 120000 });
  await ev(s => { s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); });
};
const act = k => ev((s, k) => s.__DEV_ACTIONS[k]?.(), k);
const calm = () => ev(s => { if (s.mode === 'branch') s.chooseBranch?.(0); for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); if (s.mode === 'pause') s.togglePause(); if (s.mode !== 'none') s.setMode('none'); });

if (want('menu')) await step('menu', async () => { await fresh('?layout=desktop', 'MenuScene'); await shot('menu-home', 'MenuScene'); });
if (want('city')) await step('city', async () => {
  await fresh('?layout=desktop', 'MenuScene'); await seedWorld();
  await go('CityScene'); await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.mountGuide?.stop?.(); }); await shot('city', 'CityScene');
  for (const k of ['CityRecruitScene', 'TalentHallScene']) await step(k, async () => { await go(k); await shot(k, k); });
});
if (want('world')) for (const k of ['WorldMapScene', 'TownScene']) await step(k, async () => { await fresh('?layout=desktop', 'MenuScene'); await seedWorld(); await p.evaluate(k => window.__game.scene.getScene('MenuScene').scene.start(k), k); await p.waitForTimeout(5000); const act = await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key)); console.log('  active', k, act.join()); await shot(k, act[0]); });
if (want('battle')) {
  await step('hud', async () => { await battle(1); await p.waitForTimeout(2500); await shot('battle-hud', 'GameScene'); });
  await step('levelup', async () => { await ev(s => { s.player.xp = s.player.xpNext; }); await p.waitForTimeout(1200); await shot('battle-levelup', 'GameScene'); await calm(); });
  await step('attr', async () => { await act('attributes4'); await ev(s => { s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }); await p.waitForTimeout(500); await shot('battle-attributes', 'GameScene'); await calm(); });
  await step('pause', async () => { await ev(s => s.togglePause()); await p.waitForTimeout(500); await shot('battle-pause', 'GameScene'); await calm(); });
  await step('bag', async () => { await ev(s => s.openBattleBag()); await p.waitForTimeout(800); await shot('battle-bag', 'GameScene'); await calm(); });
  await step('map', async () => { await p.mouse.click(640, 400); await p.keyboard.press('KeyM'); await p.waitForTimeout(1500); await shot('battle-map', 'GameScene'); await p.keyboard.press('KeyM'); await p.waitForTimeout(1200); });
  await step('branch', async () => { await act('weaponNative5'); await p.waitForTimeout(500); await calm(); const ok = await ev(s => { if (s.needBranch?.()) { s.openBranch(); return true; } return false; }); await p.waitForTimeout(700); if (ok) await shot('battle-branch', 'GameScene'); await calm(); });
  await step('boss', async () => { await act('boss'); await p.waitForTimeout(3500); await calm(); await p.waitForTimeout(300); await shot('battle-boss', 'GameScene'); });
  await step('lose', async () => { await act('loseNow'); await p.waitForTimeout(3000); await shot('battle-defeat', 'GameScene'); });
}
if (want('rest')) await step('rest', async () => {
  await battle(1); await act('winNow'); await p.waitForTimeout(3500); await shot('rest-1', 'GameScene');
  const names = await ev(s => s.children.list.filter(o => o.visible).flatMap(o => [o, ...(o.list ?? [])]).filter(c => c.input?.enabled && c.name).map(c => c.name).slice(0, 50)); console.log('  rest buttons:', names.join(','));
});
if (want('result')) await step('win3', async () => { await battle(3); await act('winNow'); await p.waitForTimeout(4000); await shot('result-win', 'GameScene'); });
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await b.close();
