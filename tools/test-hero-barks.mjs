// 武将台词气泡（2026-11-17 用户：「各种武将被动触发之后会说台词」）：被动大招触发时头顶出气泡、同一武将间隔 12 秒、
// 第一次必说之后 50%、马超主将不弹（已有大字战吼）、首领登场专属台词（刘备对董卓）、战斗设置「武将台词」关掉后不说。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5195/ node tools/test-hero-barks.mjs（默认 5173）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-barks';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').heroBark, null, { timeout: 90000 });

async function startAs(hero, cfg = { chapter: 'huangjin', stage: 1 }) {
  await p.evaluate(([h, c]) => { const s = window.__game.scene.getScene('GameScene'); s.registry.remove('campaignTransfer'); s.registry.set('runConfig', { character: h, ...c }); s.scene.start('GameScene'); }, [hero, cfg]);
  await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.elapsed < 2 && s.heroBark; }, hero, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; if (s.mode !== 'none') s.setMode('none'); });
  await p.waitForTimeout(400);
}
// 让主将被动满层并放出一次大招（triggers +1），再跑一帧 heroBark.update；dt 毫秒后的时间点
const fire = (dt = 0, roll = 0) => p.evaluate(([dt, roll]) => {
  const s = window.__game.scene.getScene('GameScene'), pa = s.player.passive, w = s.player.weapons[0].id, r = Math.random;
  pa.stacks = pa.maxStacks; pa.beginCast(w); Math.random = () => roll;
  s.heroBark.update(s.barkSpeakers(), s.combatNow + dt, true); Math.random = r;
  const box = s.children.list.find(o => o.name === 'hero-bark' && o.active);
  const txt = box?.list.find(o => o.type === 'Text')?.text, bounds = s.player.sprite.getBounds();
  return { count: s.heroBark.count, line: s.heroBark.lastLine, shown: !!box, txt, above: box ? box.y < bounds.top : null };
}, [dt, roll]);

// 1) 赵云：第一次触发必说（几率掷 0.99 也说），气泡在头顶
await startAs('zhaoyun');
const z1 = await fire(0, .99);
ck('赵云被动大招触发：第一次必说「吾乃常山赵子龙也！」，气泡在头顶上方', z1.count === 1 && z1.txt === '吾乃常山赵子龙也！' && z1.above === true, z1);
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/zhaoyun.png` });
// 2) 间隔：5 秒后再触发（掷 0）不说；13 秒后掷 0 说第二句；再过 13 秒掷 0.99（> 50%）不说
const z2 = await fire(5000, 0), z3 = await fire(13000, 0), z4 = await fire(26500, .99);
ck('同一武将 12 秒内不再说', z2.count === 1, z2);
ck('过了 12 秒、掷中 50% 才说第二句「七进七出，谁可挡我！」', z3.count === 2 && z3.line === '七进七出，谁可挡我！', z3);
ck('第一次之后 50% 几率：没掷中不说', z4.count === 2, z4);
// 3) 设置关掉：设置面板「武将台词」一行切到「关」，之后触发不说
const off = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.setMode('pause'); await new Promise(r => setTimeout(r, 200));
  const all = s.pausePanel.list.flatMap(o => [o, ...(o.list ?? [])]), val = all.find(o => o.name === 'settings-hero-barks'), inc = all.find(o => o.name === 'settings-hero-barks-inc');
  const before = val?.text; inc?.emit('pointerdown'); const after = val?.text, stored = localStorage.getItem('im_hero_barks');
  s.setMode('none'); return { row: !!val, before, after, stored };
});
await p.screenshot({ path: `${out}/settings.png` }).catch(() => {});
const z5 = await fire(60000, 0);
ck('战斗设置有「武将台词」一行：开 → 关，写入 im_hero_barks', off.row && off.before === '开' && off.after === '关' && off.stored === 'off', off);
ck('关掉后被动触发不说', z5.count === 2 && !z5.shown, z5);
await p.evaluate(async () => (await window.__mod('/src/systems/BattleSettings.ts')).setHeroBarks('on'));
// 4) 马超主将：被动满层已有大字战吼，不再弹气泡
await startAs('machao');
const mc = await fire(0, 0);
ck('马超主将被动触发不弹气泡（已有大字战吼）', mc.count === 0 && !mc.shown, mc);
// 5) 首领登场专属台词：刘备对 2-3 董卓「国贼董卓，天下共讨！」（吕布只在吕布挑战关出现）
await startAs('liubei', { chapter: 'hulao' });
const zf = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); await new Promise(r => setTimeout(r, 400));
  const line = s.heroBark.lastLine; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none');
  return { line, boss: s.chapter.bossName, shown: !!s.children.list.find(o => o.name === 'hero-bark' && o.active) };
});
ck('刘备打董卓：首领登场说「国贼董卓，天下共讨！」', zf.line === '国贼董卓，天下共讨！' && zf.shown, zf);
await p.screenshot({ path: `${out}/liubei-vs-dongzhuo.png` });
// 6) 诸葛亮截图
await startAs('zhuge');
const zg = await fire(0, 0); await p.waitForTimeout(250);
ck('诸葛亮被动大招：「火攻之计，正在此时。」', zg.txt === '火攻之计，正在此时。', zg);
await p.screenshot({ path: `${out}/zhuge.png` });

ck('没有页面错误', errors.length === 0, errors.slice(0, 3));
console.log(`\n${pass} 通过，${fail} 失败`);
await b.close();
process.exit(fail ? 1 : 0);
