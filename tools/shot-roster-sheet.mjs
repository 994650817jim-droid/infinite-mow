// 新兵种比例 / 脚底总览（三批 40 种）：载入全部专属图，每种刷一个排成网格，每行开头放一个本章普通步兵作参照；
// 冻结场景后截图，并按行走表人物中位身高 × 显示缩放算出屏上身高（与普通步兵比）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/shot-roster-sheet.mjs   截图 assets/review/roster/roster-sheet.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/roster'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').traits, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const rows = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), T = s.traits, A = await import('/src/systems/ArtStyle.ts'), M = await import('/src/systems/SpriteMetrics.ts'), { ROSTER } = await import('/src/data/enemyRoster.ts');
  const keys = Object.values(ROSTER).flatMap(t => [t.art.walk, t.art.attack]);
  A.loadV2TroopSheets(s, keys); await new Promise(r => { if (!s.load.isLoading() && !s.load.list.size) return r(); s.load.once('complete', r); if (!s.load.isLoading()) s.load.start(); });
  s.updateSpawner = () => {}; T.pick = () => null; s.player.damageImmune = true;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const P = s.player, ids = Object.keys(ROSTER), perRow = 10, dx = 115, dy = 150, x0 = P.x - 4.5 * dx, y0 = P.y - 230, out = []; P.sprite.setPosition(P.x, P.y + 420); /* 主将挪到网格下面 */
  const fig = e => { const k = e.walkSheet || e.sprite.texture.key, h = M.sheetFigureHeight(s, k); return h ? Math.round(h * e.sprite.scaleY) : null; };
  for (let r = 0; r * perRow < ids.length; r++) {
    const ref = s.spawnEnemy('infantry', x0 - dx, y0 + r * dy, 1, true); ref.invulnerable = true; out.push({ id: '步兵(参照)', row: r, art: true, h: fig(ref), sheet: ref.walkSheet });
    s.add.text(ref.x, ref.y + 12, '步兵', { fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(.5, 0).setDepth(2000);
    ids.slice(r * perRow, r * perRow + perRow).forEach((id, i) => {
      const t = ROSTER[id], e = T.spawnOne(t, x0 + i * dx, y0 + r * dy); if (!e) return; e.invulnerable = true; e.sprite.setAlpha(1);
      const st = T.st.get(e); if (st) { st.hidden = false; st.disguised = false; for (const im of st.imgs ?? []) im.destroy?.(); st.imgs = []; }
      const art = A.isV2Texture(t.art.walk) && s.textures.exists(t.art.walk);
      out.push({ id, name: t.name, row: r, art, h: fig(e), sheet: e.walkSheet, scale: +e.sprite.scaleY.toFixed(3) });
      s.add.text(e.x, e.y + 12, t.name, { fontSize: '12px', color: art ? '#fff' : '#ff9', stroke: '#000', strokeThickness: 3 }).setOrigin(.5, 0).setDepth(2000);
    });
  }
  // 一帧让行走图套上，然后冻结
  await new Promise(r => setTimeout(r, 300)); s.scene.pause(); s.cameras.main.stopFollow?.(); s.cameras.main.setZoom(.82).centerOn(x0 + 4 * dx, y0 + 1.5 * dy);
  return out;
});
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/roster-sheet.png` });
const ref = rows.filter(r => r.id === '步兵(参照)').map(r => r.h).filter(Boolean), refH = ref.length ? ref[0] : 48;
console.log('参照步兵屏上身高', refH);
for (const r of rows.filter(r => r.id !== '步兵(参照)')) console.log(`${r.id.padEnd(10)} ${r.name ?? ''}\t${r.art ? '专属图' : '染色底图'}\th=${r.h}\t×${r.h && refH ? (r.h / refH).toFixed(2) : '?'}\tscale=${r.scale}\t${r.sheet}`);
await b.close();
