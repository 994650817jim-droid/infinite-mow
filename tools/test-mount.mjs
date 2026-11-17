// 骑马系统：坐骑槽有马即骑马、移速、践踏、耐力与落马、重新上马、的卢跃出、无马不骑。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-mount.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 3 };
const items = (base, hero = 'zhaoyun') => base ? { version: 1, bag: [{ uid: 'm1', base, quality: 'orange', affixes: [{ id: 'move', value: .05 }] }], loadouts: { [hero]: { mount: 'm1' } }, salvaged: 0 } : { version: 1, bag: [], loadouts: {}, salvaged: 0 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async (layout, horse, hero = 'zhaoyun', chapter = 'huangjin') => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(([w, it]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_items_v1', JSON.stringify(it)); sessionStorage.setItem('seeded', '1'); } }, [world, items(horse, hero)]);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
  await p.evaluate(([hero, chapter]) => { const g = window.__game; g.registry.set('runConfig', { character: hero, chapter, stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, [hero, chapter]);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); }, G);
  return p;
};
const walk = (p, dx, dy, ms) => p.evaluate(async ([G0, dx, dy, ms]) => { const s = eval(G0); s.readMove = () => ({ x: dx, y: dy }); await new Promise(r => setTimeout(r, ms)); delete s.readMove; }, [G, dx, dy, ms]);

for (const layout of ['mobile', 'desktop']) {
  const p = await open(layout, 'chitu');
  const m = await p.evaluate(G0 => { const s = eval(G0), m = s.mount, pl = s.player; return { has: !!m, mounted: m?.mounted, name: m?.name, mul: pl.mountSpeedMul, rise: pl.riseY, horse: !!s.children.getByName('hero-mount'), tint: s.children.getByName('hero-mount')?.tintTopLeft, tex: s.children.getByName('hero-mount')?.texture.key, crop: pl.sprite.isCropped }; }, G);
  // 人物画风 v2：赤兔是专门画的红马（不染色、骑者抬高 40）；v1 / 缺图时是通用马染赤色（抬高 36）
  const v2Horse = m.tex === 'horse_v2_chitu_walk';
  ck(`[${layout}] 穿赤兔出征：骑在马上（移速 ×1.45、骑者抬高、下半身裁掉、v2 赤兔图（朝镜头多抬一点）/ 旧马染赤色）`, m.has && m.mounted && m.name === '赤兔' && m.mul === 1.45 && m.horse && m.crop && (v2Horse ? m.rise >= 40 && m.tint === 0xffffff : m.rise === 36 && m.tint === 0xe0462e), m);
  for (const [dx, dy, dir] of [[1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left'], [0, -1, 'up']]) {
    await walk(p, dx, dy, 450);
    const f = await p.evaluate(G0 => { const s = eval(G0); return { dir: s.player.direction, frame: s.children.getByName('hero-mount').frame.name }; }, G);
    if (dir === 'right' || dir === 'down') await p.screenshot({ path: `${out}/${layout}-mount-${dir}.png` });
    ck(`[${layout}] 朝${dir}奔跑：马图同方向`, f.dir === dir && f.frame.startsWith(dir + '_'), f);
  }
  // 践踏：前方普通兵被撞开受伤
  const t = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player, e = s.spawnEnemy('infantry', pl.x + 50, pl.y, 1, true); e.speed = 0; const h0 = e.hp, x0 = e.x; s.readMove = () => ({ x: 1, y: 0 }); await new Promise(r => setTimeout(r, 500)); delete s.readMove; return { h0, h1: e.active ? e.hp : 0, pushed: !e.active || Math.abs(e.y - pl.y) > 4 || Math.abs(e.x - x0) > 4, n: s.mount.tramples }; }, G);
  ck(`[${layout}] 践踏：冲过普通兵把它撞开并造成伤害`, t.n >= 1 && t.h1 < t.h0 && t.pushed, t);
  // 受伤：马挡 15%，重击扣 ×3 耐力
  const g = await p.evaluate(G0 => { const s = eval(G0), pl = s.player, m = s.mount; pl.invulnUntil = 0; pl.hp = pl.maxHp; const hp0 = pl.hp, st0 = m.stamina; pl.takeDamage(20, s.combatNow); return { lost: hp0 - pl.hp, st: st0 - m.stamina, max: m.maxStamina }; }, G);
  ck(`[${layout}] 重击：骑者少受伤、马耐力按 ×3 扣（赵云马上名将耐力 140）`, g.st === 60 && g.lost < 20 && g.max === 140, g);
  // 再挨两下重击 → 落马
  const fall = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player, m = s.mount; for (let i = 0; i < 3 && m.mounted; i++) { pl.invulnUntil = 0; pl.hp = pl.maxHp; pl.takeDamage(20, s.combatNow); } await new Promise(r => setTimeout(r, 300)); return { mounted: m.mounted, mul: pl.mountSpeedMul, rise: pl.riseY, crop: pl.sprite.isCropped, falls: m.falls, label: m.label.text }; }, G);
  ck(`[${layout}] 耐力掉光落马：步行、恢复原速、显示「n 秒后上马」`, !fall.mounted && fall.mul === 1 && fall.rise === 0 && !fall.crop && fall.falls === 1 && /秒后上马/.test(fall.label), fall);
  if (layout === 'mobile') await p.screenshot({ path: `${out}/${layout}-mount-fallen.png` });
  const re = await p.evaluate(async G0 => { const s = eval(G0), m = s.mount; m.remountAt = s.combatNow; await new Promise(r => setTimeout(r, 400)); return { mounted: m.mounted, st: m.stamina, max: m.maxStamina, alpha: s.children.getByName('hero-mount').alpha }; }, G);
  ck(`[${layout}] 约 15 秒后重新上马、耐力回满`, re.mounted && re.st === re.max && re.alpha > .5, re);
  await p.close();
}
// 的卢：落马那一下免伤并跃出
{
  const p = await open('mobile', 'dilu', 'guanyu');
  const d = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player, m = s.mount; m.stamina = 1; pl.invulnUntil = 0; const hp0 = pl.hp, y0 = pl.y; pl.direction = 'down'; const ok = pl.takeDamage(30, s.combatNow); await new Promise(r => setTimeout(r, 500)); return { ok, lost: hp0 - pl.hp, mounted: m.mounted, moved: pl.y - y0, inv: pl.invulnUntil > s.combatNow }; }, G);
  ck('的卢：落马那一下不掉血、向前跃出、短暂无敌', d.ok === false && d.lost === 0 && !d.mounted && d.moved > 40, d);
  await p.close();
}
// 骡车：不践踏；诸葛亮（非马上名将）耐力 100 + 60
{
  const p = await open('desktop', 'mule', 'zhuge');
  const r = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player, e = s.spawnEnemy('infantry', pl.x + 50, pl.y, 1, true); e.speed = 0; s.readMove = () => ({ x: 1, y: 0 }); await new Promise(r => setTimeout(r, 500)); delete s.readMove; return { n: s.mount.tramples, max: s.mount.maxStamina, mul: pl.mountSpeedMul }; }, G);
  ck('骡车：不践踏、耐力 160、移速 ×1.15', r.n === 0 && r.max === 160 && r.mul === 1.15, r);
  await p.close();
}
// 没穿坐骑：步战
{
  const p = await open('mobile', null);
  const r = await p.evaluate(G0 => { const s = eval(G0); return { mount: s.mount, mul: s.player.mountSpeedMul, horse: !!s.children.getByName('hero-mount') }; }, G);
  ck('没穿坐骑：不骑马', r.mount === null && r.mul === 1 && !r.horse, r);
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
