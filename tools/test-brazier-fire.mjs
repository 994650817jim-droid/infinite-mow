// 火盆燃烧 / 打烂留火（用户 11-19「场景很多火盘也要做那种燃烧的动画，然后被打烂之后地上会有火」；data/fireProps、BattlefieldSupplies）：
// 1-1 开一局，主将身边放一个火盆、一个石圈篝火：都在播燃烧序列帧；打烂火盆 → 碎裂 → 地上留火，站在火里的敌兵掉血；8 秒后火灭。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-brazier-fire.mjs   截图 assets/review/brazier/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/brazier'; mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').supplies, null, { timeout: 120000 });
await p.waitForTimeout(1200);
const a = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), P = s.player, S = s.supplies, wait = ms => new Promise(r => setTimeout(r, ms));
  s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; P.damageImmune = true; s.player.weapons.forEach(w => { w.cooldownLeft = 1e9; });
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  const before = new Set(s.enemies.filter(e => e.active && e.isSupplySlot)); S.spawnForTest(35); S.spawnForTest(30);
  const mine = s.enemies.filter(e => e.active && e.isSupplySlot && !before.has(e)), br = mine.find(e => e.sprite.texture.key === 'brazier_burning'), pit = mine.find(e => e.sprite.texture.key === 'camp_firepit');
  const f0 = [br?.sprite.frame.name, pit?.sprite.frame.name]; await wait(500); const f1 = [br?.sprite.frame.name, pit?.sprite.frame.name];
  window.__br = br; return { br: !!br, pit: !!pit, brAnim: f0[0] !== f1[0], pitAnim: f0[1] !== f1[1], breakable: br?.breakable && pit?.breakable, at: br && [Math.round(br.x - P.x), Math.round(br.y - P.y)] };
});
await p.screenshot({ path: `${OUT}/burning.png` });
ck('战场火盆、石圈篝火都在播燃烧序列帧（可打）', a.br && a.pit && a.brAnim && a.pitAnim && a.breakable, a);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), br = window.__br, wait = ms => new Promise(r => setTimeout(r, ms));
  const x = br.x, y = br.y; s.hitEnemy(br, 1e6, s.combatNow, 'melee', false, false); await wait(200);
  const breaking = s.children.list.some(o => o.texture?.key === 'brazier_breaking' && o.visible);
  const foe = s.spawnEnemy('infantry', x, y - 6, 1, true); foe.hp = foe.maxHp = 1e6; foe.def = { ...foe.def, speed: 0, damage: 0 }; foe.invulnerable = false;
  const h0 = foe.hp; await wait(2800); const fireOn = s.children.list.some(o => o.texture?.key === 'ground_fire' && o.visible && Math.hypot(o.x - x, o.y - y) < 20);
  return { breaking, fireOn, foeHurt: Math.round(h0 - foe.hp), x, y };
});
await p.screenshot({ path: `${OUT}/after-break-ground-fire.png` });
ck('打烂火盆：播碎裂 → 地上留火，站在火里的敌兵掉血', r.breaking && r.fireOn && r.foeHurt > 0, r);
const end = await p.evaluate(async x => { const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)); await wait(3400); const at6 = s.children.list.some(o => o.texture?.key === 'ground_fire' && o.visible && Math.hypot(o.x - x.x, o.y - x.y) < 20); await wait(3000); const at9 = s.children.list.some(o => o.texture?.key === 'ground_fire' && o.visible && Math.hypot(o.x - x.x, o.y - x.y) < 20); return { at6, at9 }; }, { x: r.x, y: r.y });
ck('地火持续约 8 秒（6 秒还在、9 秒灭）', end.at6 && !end.at9, end);
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
