// 讲武堂弹窗截图（2026-11-18：页签 / 研究行 / 随从操练行 / 翻页 / 返回都换成漆金按钮，一屏不留水墨按钮）。电脑布局 960×540。
// 用法：BASE=http://127.0.0.1:5173/ TAG=after node tools/shot-academy.mjs   → assets/review/camp-full/<TAG>-academy-{supply,drill}.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/camp-full';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); });
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, provisions: 1500, tutorialSeen: true }); s.cleared.huangjin = true; s.town.levels.academy = 1; localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1');
  window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('CityScene')); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(2000);
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.mountGuide?.stop?.(); });
const count = () => p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), m = c.children.getByName('town-tech'), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(m?.list ?? []);
  return { ink: all.filter(o => o.type === 'NineSlice' || (o.type === 'Image' && /command|btn_ink|cmd/.test(o.texture?.key ?? ''))).length, lacquerHits: all.filter(o => o.type === 'Rectangle' && o.input?.enabled).length }; });
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); if (c.techTab === 'drill') c.techTab = 'supply'; c.openTech(); }); await p.waitForTimeout(400);
const a = await count(); await p.screenshot({ path: `${out}/${tag}-academy-supply.png` });
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); c.children.getByName('town-tech')?.getByName('tech-tab-drill')?.emit('pointerdown'); }); await p.waitForTimeout(400);
const d = await count(); await p.screenshot({ path: `${out}/${tag}-academy-drill.png` });
console.log(JSON.stringify({ supply: a, drill: d, errors: errors.slice(0, 3) }));
await b.close();
