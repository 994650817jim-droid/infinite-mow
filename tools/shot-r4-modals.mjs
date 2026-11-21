// 总制作人第二轮试玩界面问题（2026-11-21）修后截图：天下地图「新玩法开放」/ 军情 / 攻城出征弹窗、营寨开场说明 / 建筑卡、招贤馆（人才 / 名将）、攻城战屏边目标指示。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-r4-modals.mjs   截图 assets/review/r4-fix/*.png；打印每屏水墨按钮数（NineSlice btn_ink）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/r4-fix';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; let p;
const fresh = async q => {
  if (p) await p.close().catch(() => {});
  p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('r4')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_mount_guide_v1', '1'); sessionStorage.setItem('r4', '1'); } });
  await p.goto(BASE + q, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.getScenes(true).length > 0, null, { timeout: 180000 }); await p.waitForTimeout(1500);
};
const seed = () => p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, tutorialSeen: true }); s.provisions = 600; s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); });
const go = async k => { await p.evaluate(k => window.__game.scene.getScenes(true).forEach(sc => sc.scene.start(k)), k); await p.waitForFunction(k => window.__game.scene.isActive(k), k, { timeout: 60000 }); await p.waitForTimeout(2200); };
const inks = k => p.evaluate(k => { const s = window.__game.scene.getScene(k); let n = 0; const walk = l => { for (const o of l) { if (o.visible && o.alpha > .1 && o.type === 'NineSlice' && /ink/.test(o.texture?.key ?? '')) n++; if (o.list && o.visible) walk(o.list); } }; walk(s.children.list); return n; }, k);
const shot = async (n, k) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('SHOT', n, 'ink', k ? await inks(k) : '-'); };
const step = async (l, fn) => { try { await fn(); } catch (e) { console.log('ERR', l, String(e).slice(0, 200)); } };

await step('map', async () => {
  await fresh('?layout=desktop'); await seed(); await go('WorldMapScene');
  const S = "window.__game.scene.getScene('WorldMapScene')";
  await p.evaluate(S0 => { const s = eval(S0); for (const o of [...s.children.list]) if (/modal/.test(o.name ?? '')) o.destroy(); s.siegeModal = undefined; s.showMechIntro(['jinnang', 'medic']); }, S); await shot('map-newmech', 'WorldMapScene');
  await p.evaluate(S0 => { const s = eval(S0); s.children.getByName('mech-intro-modal')?.destroy(); const e = s.intel[0] ?? { id: 'test', kind: 'bounty', city: 'luoyang', faction: 'dong', general: '郭汜', expires: 99 }; s.openIntel(e); }, S); await shot('map-intel', 'WorldMapScene');
  await p.evaluate(S0 => { const s = eval(S0); s.siegeModal?.destroy(); s.siegeModal = undefined; const W = window; }, S);
});
await step('city', async () => {
  await fresh('?layout=desktop'); await seed(); await go('CityScene');
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.openIntro(); }); await shot('city-intro', 'CityScene');
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); c.children.getByName('town-intro')?.destroy(); c.openCard('talent'); }); await shot('city-card-talent', 'CityScene');
  await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); const t = c.children.getByName('town-card'); const txt = []; const walk = l => { for (const o of l) { if (o.type === 'Text' && o.visible && o.text) txt.push(o.text); if (o.list) walk(o.list); } }; if (t) walk(t.list); console.log(JSON.stringify(txt)); });
});
await step('talent', async () => {
  await fresh('?layout=desktop'); await seed(); await go('TalentHallScene'); await shot('talent-offers', 'TalentHallScene');
  await p.evaluate(() => { const t = window.__game.scene.getScene('TalentHallScene'); t.tab = 'heroes'; t.page = 0; t.render(); }); await shot('talent-heroes', 'TalentHallScene');
  await p.evaluate(() => { const t = window.__game.scene.getScene('TalentHallScene'); t.children.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => o.name === 'talent-hall-up')?.emit('pointerup'); }); await shot('talent-upgrade-click', 'TalentHallScene');
});
// 攻城屏边指示见 tools/shot-siege-guide.mjs
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await b.close();
