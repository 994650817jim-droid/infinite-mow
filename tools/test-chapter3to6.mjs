// 第 3–6 章逐关检查（统筹夜间任务 11-20；共享笔记 ch3-6-review.md，方法同 chapter2-review）：
// 每关：五段节奏 / 首领出场时间、副将专属形象、城墙（墙内只刷远程）、敌营 / 营帐持续刷兵 + 营寨攻坚、回血点、敌兵阵营外观、剧情卡、报错；开局 + 副将 / 首领截图。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-chapter3to6.mjs [3-1,3-2,…]   截图 assets/review/ch3-6/（全部）
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/ch3-6'; mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2]?.split(',') ?? ['3-1', '3-2', '3-3', '4-1', '4-2', '4-3', '5-1', '5-2', '5-3', '6-1', '6-2', '6-3'];
const CH = { 3: { key: 'ThirdGameScene', reg: 'thirdStage', arc: 'qunxiong' }, 4: { key: 'GuanduGameScene', reg: 'guanduStage', arc: 'guandu' }, 5: { key: 'ChibiGameScene', reg: 'chibiStage', arc: 'chibi' }, 6: { key: 'JingnanGameScene', reg: 'jingnanStage', arc: 'jingnan' } };
let fail = 0; const out = {};
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of ONLY) {
  const [chn, stn] = id.split('-').map(Number), C = CH[chn], errors = [];
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([C, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); s0.registry.set(C.reg, st); s0.registry.set('runConfig', { character: 'zhaoyun', ...(C.reg === 'guanduStage' ? {} : { thirdStage: st }) }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(C.key); }, [C, stn]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > 1 && s.elapsed < 10; }, C.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'branch') s.chooseBranch?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, C.key);
  const calm = async (n = 4) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(350); await p.evaluate(() => window.__calm()); } };
  const info = () => p.evaluate(async () => { const s = window.__S, G = await import('/src/data/gateSpawn.ts'), en = s.enemies.filter(e => e.active && !e.isSupplySlot && e.def.behavior !== 'supply' && e.kind !== 'boss');
    const wy = s.sishuiPass?.wallLine, behind = s.sishuiPass && !s.sishuiPass.gateOpen ? en.filter(e => s.behindClosedWall?.(e.x, e.y)) : [];
    return { stage: s.hardKey?.() + '.' + s.hardStage?.(), name: s.chapter.name, boss: s.chapter.bossName, phases: s.phasePlan?.phases.map(x => x.kind + '@' + x.start).join(' ') ?? null, bossAt: s.phasePlan?.bossAt ?? null, lt: s.phasePlan?.lieutenant ?? '',
      pass: s.sishuiPass ? { gate: s.sishuiPass.gateOpen, wall: Math.round(wy ?? 0), tents: s.sishuiPass.tents.length } : null, camps: s.enemyCamps?.camps.length ?? 0, siege: s.campSiege ? { ...s.campSiege.stats } : null,
      heal: s.battleHeal?.schedule?.map(e => (e.boss ? 'B' : '') + Math.round(e.at)).join(',') ?? null, objective: s.chapter.objective?.label ?? null,
      tex: [...new Set(en.map(e => (e.def.walkVisual?.texture ?? e.def.texture ?? '').replace(/^readable_/, '')))].slice(0, 12), n: en.length,
      behindMelee: behind.filter(e => !G.isRangedSpawn(e.kind, e.def)).map(e => e.kind), wallSpawn: s.wallSpawn ? { ...s.wallSpawn } : null,
      bossOn: s.boss?.active ? (s.boss.def.walkVisual?.texture ?? s.boss.def.texture) : null, cards: (s.data.get('__storyBarkCardLog') ?? []).slice(-12), elapsed: Math.round(s.elapsed), mode: s.mode, over: s.over }; });
  await calm(6);
  const a = await info();
  await p.screenshot({ path: `${OUT}/${id}-start.png` });
  // 中段（精锐 / 事件段）看配兵外观
  const plan = a.bossAt ?? 120;
  await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; window.__S.devTimeScale = 2; }, Math.max(60, Math.round(plan * .55)));
  await calm(8); await p.waitForTimeout(3000); await p.evaluate(() => window.__calm());
  const m = await info();
  // 副将（有的话）
  let lt = null;
  if (a.lt) {
    await p.waitForFunction(() => !!window.__S.phaseRunner?.ltArt(), null, { timeout: 15000 }).catch(() => {});
    const start = await p.evaluate(() => window.__S.phasePlan.phases.find(x => x.kind === 'lieutenant')?.start ?? null);
    if (start !== null) { await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; }, start + 1); await calm(5);
      lt = await p.evaluate(() => { const r = window.__S.phaseRunner, e = r?.lt?.e; if (e) window.__S.player.sprite.setPosition(e.x - 160, e.y + 60); return { name: r?.stats.lieutenant, tex: e?.def.walkVisual?.texture ?? null }; });
      await calm(2); await p.screenshot({ path: `${OUT}/${id}-lieutenant.png` }); }
  }
  // 首领
  await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; window.__S.devTimeScale = 1; }, (a.bossAt ?? plan) + 1);
  await calm(8);
  for (let i = 0; i < 20; i++) { const on = await p.evaluate(() => !!window.__S.boss?.active || !!window.__S.bossSpawned); if (on) break; await calm(2); }
  await p.evaluate(() => { const s = window.__S, bz = s.boss; if (bz?.active) s.player.sprite.setPosition(bz.x, bz.y + 260); }); await calm(3);
  const z = await info();
  await p.screenshot({ path: `${OUT}/${id}-boss.png` });
  out[id] = { start: a, mid: m, lt, boss: z, errors: errors.slice(0, 6) };
  const yellow = m.tex.filter(t => /^yellow_|^enemy_(infantry|shield|archer|cavalry)_walk$/.test(t));
  ck(`${id} ${a.name}：五段 ${a.phases ?? '（不分段）'}；首领 ${a.boss} ${z.bossOn ? '已出场' : '没出场'}`, !!z.bossOn || !!a.objective, { phases: a.phases, bossAt: a.bossAt, bossTex: z.bossOn, objective: a.objective });
  if (a.lt) ck(`${id} 副将 ${a.lt}：专属形象`, /^lt_/.test(lt?.tex ?? ''), lt);
  ck(`${id} 敌兵外观：没有黄巾 / 通用旧兵图`, yellow.length === 0, m.tex);
  if (a.pass) ck(`${id} 城墙：门没破前墙内没有近战`, m.behindMelee.length === 0 && z.behindMelee.length === 0, { pass: a.pass, mid: m.behindMelee, boss: z.behindMelee, wallSpawn: z.wallSpawn });
  ck(`${id} 无页面报错`, errors.length === 0, errors.slice(0, 4));
  console.log(`INFO ${id} ` + JSON.stringify({ camps: a.camps, siege: z.siege, heal: a.heal, objective: a.objective, n: m.n, tex: m.tex, cards: z.cards.slice(-6) }).slice(0, 900));
  await p.close();
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(out, null, 1));
console.log(`\n${fail} failed`);
await b.close();
