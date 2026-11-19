// 义军营寨全屏 + 平移（用户 2026-11-18：「义军营寨放多点帐篷和画面整个屏幕。现在无法移动看到营寨全幕」）：电脑布局 960×540 截图，
// 并（GIF=1）录一段平移：按住方向键扫一圈，逐帧截图后用 ffmpeg 合成 GIF。
// 用法：BASE=http://127.0.0.1:5173/ TAG=after [GIF=1] node tools/shot-camp-full.mjs   → assets/review/camp-full/<TAG>-*.png / pan.gif
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/camp-full';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errors = [];
p.on('pageerror', e => errors.push(e.message));
// 营寨档存档：第一章通关、未占城（主帐 Lv1），营中引导 / 坐骑引导看过
await p.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_city_intro_v3', '1'); localStorage.setItem('im_mount_guide_v1', '1'); sessionStorage.setItem('seeded', '1'); });
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, provisions: 800, tutorialSeen: true }); s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.removeItem('im_world_backup_v1');
  window.__game.scene.getScenes(true).forEach(sc => sc.scene.start('CityScene')); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(2500);
// 关掉可能弹出的介绍 / 引导
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); for (const o of [...c.children.list]) if ((o.depth ?? 0) >= 600 && o.type === 'Container') o.destroy(); c.mountGuide?.stop?.(); });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/${tag}-start.png` });
const info = await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'); return { k: c.k, vr: c.vr, sx: c.sx, sy: c.sy, max: { x: 1536 * c.k - c.vr.w, y: 1024 * c.k - c.vr.h } }; });
console.log(JSON.stringify(info));
// 对准主帐（默认开场视角；首次的马厩引导会把视角拉到马厩）
await p.evaluate(() => { const c = window.__game.scene.getScene('CityScene'), h = c.hits.find(x => x.name === 'bld-hall'); c.scrollTo(h.x - c.vr.w / 2, h.y - c.vr.h * .62, false); }); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tag}-hall.png` });
if (process.env.GIF) {
  const dir = `${out}/pan-frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let n = 0; const shot = async () => p.screenshot({ path: `${dir}/f${String(n++).padStart(3, '0')}.png` });
  // 一圈：左 → 上 → 右 → 下 → 回主帐（按住方向键，每 120ms 一帧）
  for (const [key, ms] of [['ArrowLeft', 1100], ['ArrowUp', 900], ['ArrowRight', 2000], ['ArrowDown', 1500], ['ArrowLeft', 900]]) {
    await p.keyboard.down(key); const t0 = Date.now(); while (Date.now() - t0 < ms) { await shot(); await p.waitForTimeout(80); } await p.keyboard.up(key);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '8', '-i', `${dir}/f%03d.png`, '-vf', 'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', `${out}/pan.gif`]);
  rmSync(dir, { recursive: true, force: true }); console.log('gif frames', n);
}
// 四角（拖到边界）各截一张，看全营
if (tag === 'after') for (const [name, x, y] of [['nw', 0, 0], ['ne', 1e4, 0], ['sw', 0, 1e4], ['se', 1e4, 1e4]]) { await p.evaluate(([x, y]) => window.__game.scene.getScene('CityScene').scrollTo(x, y), [x, y]); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${tag}-${name}.png` }); }
console.log('errors', JSON.stringify(errors.slice(0, 3)));
await b.close();
