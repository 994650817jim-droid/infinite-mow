// P3 第二批武将正式图接入后截图（2026-11-21）：主页（主将甘宁，彩绘立绘）、选将页（五人彩绘）、甘宁揭幕卡（水墨立轴）、孙权兵器专职面板（分支图标）。
// 用法：BASE=http://127.0.0.1:5743/ node tools/shot-p3-art.mjs → assets/review/p3/art-*.png；打印各处实际用的贴图键。
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5743/', OUT = 'assets/review/p3'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errors = [];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/Texture key already in use|favicon/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'ganning'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 }); await p.waitForTimeout(2500);
  const home = await p.evaluate(() => { const s = window.__game.scene.getScene('MenuScene'); const keys = []; const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.texture?.key && /epic_hero_|ink_hero_/.test(o.texture.key) && o.visible) keys.push(o.texture.key); if (o.list) q.push(...o.list); } return keys; });
  await p.screenshot({ path: `${OUT}/art-home-ganning.png` });
  await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'); s.heroPicker.open(17); /* 甘宁（CHARACTERS 第 18 位）那一页 */ }); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/art-picker.png` });
  await p.evaluate(() => { const s = window.__game.scene.getScene('MenuScene'); s.heroPicker.root.setVisible(false); });
  await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'), R = await import('/src/ui/HeroJoinReveal.ts'); R.showHeroJoin(s, 'ganning', () => {}); }); await p.waitForTimeout(2500);
  const reveal = await p.evaluate(() => { const r = window.__game.scene.getScene('MenuScene').children.getByName('hero-join-reveal'); return r?.getByName('hero-join-portrait')?.texture?.key ?? null; });
  await p.screenshot({ path: `${OUT}/art-reveal-ganning.png` });
  // 兵器专职面板：孙权本命升到 Lv5
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'sunquan', weapon: undefined }); s.scene.restart(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'sunquan' && s.__DEV_ACTIONS; }, null, { timeout: 60000 }); await p.waitForTimeout(1200);
  const panel = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), w = s.player.weapons[0]; s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); w.level = 4; s.gainWeaponLevel?.(w) ?? (w.level = 5); if (s.mode !== 'branch') s.openBranchPanel?.(); await new Promise(r => setTimeout(r, 1200)); const keys = []; const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.texture?.key && /branch_icon_|icon_guding/.test(o.texture.key) && o.visible) keys.push(o.texture.key); if (o.list) q.push(...o.list); } return { mode: s.mode, keys }; });
  await p.screenshot({ path: `${OUT}/art-branch-sunquan.png` });
  console.log(JSON.stringify({ home, reveal, panel, errors }));
} finally { await b.close(); }
