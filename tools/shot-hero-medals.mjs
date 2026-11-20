// 全员圆形头像对照图（2026-11-19 用户「这个头像优化一下」）：用游戏里同一个 drawHeroMedal + MEDAL_CROP（src/ui/HeroMedal.ts，
// 无依赖，node 直接载入），把 17 位可玩武将的头像排成一张；不需要开发服务器。
// 用法：TAG=after node tools/shot-hero-medals.mjs   → assets/review/hud-status/medals-<TAG>.png
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const tag = process.env.TAG ?? 'after', out = 'assets/review/hud-status';
mkdirSync(out, { recursive: true });
const M = await import('../src/ui/HeroMedal.ts');
const ids = [...readFileSync('src/data/characters.ts', 'utf8').matchAll(/^\s+id: '([a-z]+)',\s*$/gm)].map(m => m[1]);
const names = Object.fromEntries([...readFileSync('src/data/characters.ts', 'utf8').matchAll(/id: '([a-z]+)',\s*\n\s*name: '([^']+)'/g)].map(m => [m[1], m[2]]));
const imgs = Object.fromEntries(ids.map(id => [id, 'data:image/webp;base64,' + readFileSync(`public/assets/epic-home/${id}.webp`).toString('base64')]));
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1180, height: 560 } });
await p.setContent('<body style="margin:0;background:#1b120b"></body>');
await p.evaluate(async ([fnSrc, crop, ids, names, imgs]) => {
  const MEDAL_CROP = crop, MEDAL_SIZE = 160; const drawHeroMedal = eval('(' + fnSrc + ')');
  document.body.style.cssText = 'margin:0;background:#1b120b;display:flex;flex-wrap:wrap;gap:12px;padding:14px;font:14px "Microsoft YaHei";color:#f3d48a';
  for (const id of ids) {
    const img = new Image(); img.src = imgs[id]; await img.decode();
    const cell = document.createElement('div'); cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:112px';
    const cv = document.createElement('canvas'); cv.width = cv.height = 160; cv.style.cssText = 'width:96px;height:96px;border-radius:50%;box-shadow:0 0 0 3px #c9a35e,0 0 0 5px #1b120b,0 0 0 6px #f3d48a';
    drawHeroMedal(cv.getContext('2d'), img, id);
    const t = document.createElement('div'); t.textContent = (names[id] ?? '') + ' · ' + id; t.style.marginTop = '9px';
    cell.append(cv, t); document.body.append(cell);
  }
}, [M.drawHeroMedal.toString(), M.MEDAL_CROP, ids, names, imgs]);
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/medals-${tag}.png`, fullPage: true }); await b.close(); console.log('ok', ids.length);
