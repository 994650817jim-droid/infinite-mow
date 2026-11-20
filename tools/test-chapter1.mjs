// 第一章 v2（共享笔记 chapter1-redesign.md，用户 11-20 批准）：1-1 四段约 3.5 分、1-2 / 1-3 五段（第四段「大军压境」）、无副将无机缘；
// 每关至多一种新兵（1-1 刀盾、1-2 弓手、1-3 黄巾骑兵）；段落台词；大军压境刷兵更密。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-chapter1.mjs   截图在 assets/review/chapter1/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/chapter1'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const world = { version: 10, yellowStages: 2, cleared: { huangjin: false, hulao: false }, worldAvailable: false, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'], tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function stage(n) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(n => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: n });
    for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.restart(); }, n);
  await p.waitForFunction(n => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter?.stage === n && s.phasePlan && s.elapsed > .5 && s.elapsed < 8; }, n, { timeout: 120000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; });
  return p;
}
const plan = p => p.evaluate(() => { const s = window.__S; return { name: s.chapter.name, kinds: s.phasePlan.phases.map(x => x.kind + '@' + x.start + ':' + x.name).join(' / '), lt: s.phasePlan.lieutenant ?? '', fortunes: !!s.fortunes, bossHpMul: s.chapter.growth?.bossHp };});
// 兵种：在各时刻抽 400 次 pickEnemy（t 为刷怪时间轴，按 pace 换算）
const mix = (p, ts) => p.evaluate(ts => { const c = window.__S.chapter, out = {}; for (const t of ts) { const k = {}; for (let i = 0; i < 400; i++) { const e = c.pickEnemy(t * (c.pace ?? 1)); k[e] = (k[e] ?? 0) + 1; } out[t] = k; } return out; }, ts);
const jump = async (p, t) => { await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; }, t); await p.waitForTimeout(500); await p.evaluate(() => window.__calm()); await p.waitForTimeout(300); await p.evaluate(() => window.__calm()); };

{
  const p = await stage(1); const a = await plan(p), m = await mix(p, [20, 60, 170]);
  ck('1-1：四段 先锋 0 / 精锐 45 / 黄巾营寨 100 / 张梁 155，无副将、无机缘', a.kinds === 'vanguard@0:外围哨兵 / elite@45:刀盾阻路 / event@100:黄巾营寨 / boss@155:张梁迎战' && !a.lt && !a.fortunes, a);
  ck('1-1 兵种：开头只有流民，精锐段起刀盾（本关唯一新兵），没有弓手 / 骑兵', Object.keys(m[20]).join() === 'infantry' && m[60].shield > 0 && !m[60].archer && !m[170].archer && !m[170].cavalry, m);
  await jump(p, 101); const e = await p.evaluate(() => ({ phase: window.__S.waveIndex, ambush: window.__S.phaseRunner.stats.ambush, log: window.__S.data.get('__storyBarkCardLog') ?? [] }));
  const kinds = await p.evaluate(() => [...new Set(window.__S.enemies.filter(x => x.active).map(x => x.kind))]);
  ck('1-1 事件段「黄巾营寨」：伏兵只用步 / 盾；刘备台词「烧了他们的营帐…」', e.phase === 2 && e.ambush >= 8 && !kinds.includes('cavalry') && !kinds.includes('archer') && /烧了他们的营帐/.test(e.log.join('|')), { ...e, kinds });
  await p.close();
}
{
  const p = await stage(2); const a = await plan(p), m = await mix(p, [20, 80]);
  ck('1-2：五段 先锋 0 / 精锐 50 / 法坛伏兵 105 / 黄巾大军 160 / 张宝 215，无副将、无机缘', a.kinds === 'vanguard@0:营寨前锋 / elite@50:弓盾合击 / event@105:法坛伏兵 / surge@160:黄巾大军 / boss@215:张宝祭阵' && !a.lt && !a.fortunes, a);
  ck('1-2 兵种：弓手精锐段起（本关新兵），没有骑兵', !m[20].archer && m[80].archer > 0 && !m[20].cavalry && !m[80].cavalry, m);
  await jump(p, 161); await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({ phase: window.__S.waveIndex, kind: window.__S.phaseRunner.kind(), mul: window.__S.phaseRunner.intervalMul(), log: (window.__S.data.get('__storyBarkCardLog') ?? []).join('|') }));
  await p.screenshot({ path: OUT + '/surge-1-2.png' });
  ck('1-2「黄巾大军」：大军压境段，刷兵间隔 ×0.67、张飞台词', s.phase === 3 && s.kind === 'surge' && Math.abs(s.mul - 2 / 3) < .01 && /俺正杀得手顺/.test(s.log), s);
  await p.close();
}
{
  const p = await stage(3); const a = await plan(p), m = await mix(p, [30, 120]);
  ck('1-3：五段 0 / 55 / 120 / 185 / 245，第四段「城门死战」（原卜己副将）', a.kinds === 'vanguard@0:黄巾先锋 / elite@55:黄巾大军 / event@120:城下伏兵 / surge@185:城门死战 / boss@245:张角决战' && !a.lt, a);
  ck('1-3 兵种：黄巾骑兵精锐段起（本关新兵）', !m[30].cavalry && m[120].cavalry > 0, m);
  await p.close();
}
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
