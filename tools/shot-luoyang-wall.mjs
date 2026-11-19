// 2-3 洛阳董卓城墙前后对比截图（城墙只在董卓上城那一段出现，wall-audit 拍不到）：城门两侧、左墙端、城外侧面。
// 用法：BASE=http://127.0.0.1:5173/ OUT=assets/review/luoyang-wall/before node tools/shot-luoyang-wall.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.env.OUT ?? 'assets/review/luoyang-wall/after';
mkdirSync(OUT, { recursive: true });
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
await p.goto(BASE + '?dev=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 });
for (let i = 0; i < 160; i++) {
  const ok = await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.dzLubu && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } return !!s.dzLubu && !!s.children.getByName('luoyang-gate') && s.mode === 'none'; });
  if (ok) break; await p.waitForTimeout(250);
}
await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate?.(); });
const g = await ev(s => { const gt = s.children.getByName('luoyang-gate'); return [gt.x, gt.y]; });
for (const [n, dx, dy] of [['1-gate', -160, 200], ['2-left-end', -850, 180], ['3-outside-left-flank', -1150, -300]]) {
  await ev((s, a) => { s.player.sprite.setPosition(a[0], a[1]); }, [g[0] + dx, g[1] + dy]);
  for (let t = 0; t < 1000; t += 250) { await ev(() => 0); await p.waitForTimeout(250); }
  await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(n, await ev(s => [Math.round(s.player.x), Math.round(s.player.y)]));
}
await b.close();
