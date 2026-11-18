// 关墙前后对比截图：汜水关门 / 左侧箭楼与墙接缝 / 墙的左端（电脑布局）。
// 用法：BASE=http://127.0.0.1:5173/ OUT=assets/review/wall-seal/before node tools/shot-wall-seal.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.env.OUT ?? 'assets/review/wall-seal/after';
mkdirSync(OUT, { recursive: true });
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
await p.goto(BASE + '?dev=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.sishuiPass; }, S, { timeout: 90000 });
for (let t = 0; t < 2500; t += 250) { await ev(() => 0); await p.waitForTimeout(250); }
await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'tower') e.hp = 0; });
const wy = await ev(s => s.children.getByName('sishui-gate').y - 2);
const shots = [['1-gate-and-tower', 0, 150], ['2-left-wall-end', -1130, 120], ['3-right-wall-end', 1130, 120], ['4-beyond-left-end', -1300, 120]];
for (const [n, x, dy] of shots) {
  await ev((s, a) => { s.player.sprite.setPosition(a[0], a[1]); }, [x, wy + dy]);
  for (let t = 0; t < 1000; t += 250) { await ev(() => 0); await p.waitForTimeout(250); }
  const pos = await ev(s => [Math.round(s.player.x), Math.round(s.player.y)]);
  await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(n, 'player at', pos, 'wy', wy);
}
// 从场内贴着墙的左端往西北冲（原来能从墙端外侧绕过去）
await ev((s, a) => { s.player.sprite.setPosition(a[0], a[1]); }, [-1150, wy + 150]);
for (let i = 0; i < 40; i++) { await ev((s, a) => { s.player.sprite.y -= 10; s.player.sprite.x -= 10; s.sishuiObstacles.resolve(s.player, [], []); }, 0); }
const end = await ev(s => [Math.round(s.player.x), Math.round(s.player.y)]);
console.log('walk-northwest-from-x=-1150 end', end, 'wy', wy, end[1] < wy - 60 ? 'GOT PAST WALL LINE' : 'blocked');
await b.close();
