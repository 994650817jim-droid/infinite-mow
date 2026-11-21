// 军阵三期（共享笔记 formation-design.md §5；用户 11-20「全按推荐」）：敌方军阵框架 + 盾墙阵（阵眼、正面减伤、斩阵眼破阵、以锋矢破盾墙）、
// 第四章起才刷；曹仁八门金锁接破阵（从生门打满 N 下 → 八门停转、曹仁易伤）；守城「部曲守门」。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-enemy-formations.mjs   截图在 assets/review/formations/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { openBoss } from './boss-v2-open.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/formations'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = async () => { const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); }); return p; };

// ① 盾墙阵
{
  const p = await page();
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.enemyForms && window.__game.scene.getScene('GameScene').elapsed > .5, null, { timeout: 120000 });
  const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
  await p.waitForFunction(() => window.__game.scene.getScene('GameScene').textures.exists('formation_sigils'), null, { timeout: 30000 });
  const gate = await ev(s => { const F = s.enemyForms; s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; F.nextAt = 0; F.update(0, s.combatNow); const ch1 = F.squads.length; const ch = F.h.chapter; F.h.chapter = () => 4; F.nextAt = 0; F.update(0, s.combatNow); const ch4 = F.squads.length; F.h.chapter = ch; F.clear(); return { ch1, ch4, chapter: s.lootChapter() }; });
  ck('第四章起才刷盾墙阵（第一章不刷，第四章到点刷一队）', gate.ch1 === 0 && gate.ch4 === 1, gate);
  const sq = await ev(s => { const F = s.enemyForms, P = s.player; for (const e of s.enemies) if (e.active && e.kind !== 'boss') { e.active = false; e.sprite?.setVisible(false); }
    const q = F.spawn('shieldwall', s.combatNow, { x: P.x + 40, y: P.y - 250 }); window.__Q = q; q.eye.hp = q.eye.maxHp = 1e6; for (const m of q.members) m.e.hp = m.e.maxHp = 1e6; return { members: q.members.length, eye: q.eye.kind, tag: !!q.tag?.visible, sigil: !!q.sigil, log: s.data.get('__storyBarkCardLog') ?? [] }; });
  ck('刷一队盾墙阵：10 名盾兵 + 阵眼（精锐，头顶「阵眼」），脚下淡红阵纹；第一次斥候提醒「斩其阵眼」', sq.members === 10 && sq.eye === 'elite' && sq.tag && sq.sigil && /斩其阵眼/.test(sq.log.join('|')), sq);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/enemy-shieldwall.png` });
  const front = await ev(s => { const F = s.enemyForms, q = window.__Q, m = q.members.find(x => x.oy > 0)?.e, P = s.player;
    const a = F.damageMul(m, s.combatNow); const ox = P.x, oy = P.y; const fx = Math.cos(q.face), fy = Math.sin(q.face);
    P.sprite.setPosition(q.eye.x + fx * 300 * -1 - fy * 0, q.eye.y + fy * 300 * -1); const behind = F.damageMul(m, s.combatNow); P.sprite.setPosition(ox, oy);
    return { front: a, behind, eyeMul: F.damageMul(q.eye, s.combatNow) }; });
  ck('阵眼在：前排正面受伤 ×0.3，绕到背后 ×1；阵眼自己不减伤', Math.abs(front.front - .3) < 1e-6 && front.behind === 1 && front.eyeMul === 1, front);
  await ev(s => { s.killEnemy(window.__Q.eye); return 1; }); await p.waitForTimeout(300);
  const br = await ev(s => { const F = s.enemyForms, q = window.__Q, m = q.members[0]?.e; return { broken: q.broken, stunned: q.members.filter(x => x.e.stunUntil > s.combatNow).length, mul: m ? F.damageMul(m, s.combatNow) : null, countered: q.countered, banner: (() => { let n = 0; const w = l => { for (const o of l) { if (typeof o.text === 'string' && /破阵 · 盾墙阵/.test(o.text)) n++; if (o.list) w(o.list); } }; w(s.children.list); return n; })(), n: q.members.length }; });
  ck('斩阵眼 → 阵破：全队眩晕、受伤 ×1.3、横幅「破阵 · 盾墙阵」', br.broken && br.stunned >= Math.min(8, br.n) && Math.abs(br.mul - 1.3) < 1e-6 && br.banner >= 1, br);
  // 以锋矢破盾墙
  const ctr = await ev(s => { const F = s.enemyForms, r = s.formationRt, P = s.player; r.loadout = ['wedge', 'circle']; r.idx = 0; r.current = 'wedge'; r.settleUntil = 0; r.apply(); if (s.legion.order !== 'guard') s.legion.cycleOrder(); r.update(0, s.combatNow);
    const q = F.spawn('shieldwall', s.combatNow, { x: P.x + 300, y: P.y }); s.killEnemy(q.eye); F.update(.016, s.combatNow + 16); const m = q.members[0]?.e; return { countered: q.countered, mul: m ? F.damageMul(m, s.combatNow) : null, stats: F.stats }; });
  ck('护阵用锋矢破盾墙：受伤 ×1.5（相克）', ctr.countered && Math.abs(ctr.mul - 1.5) < 1e-6 && ctr.stats.countered === 1, ctr);
  await p.close();
}

// ② 曹仁八门金锁：从生门打满 10 下 → 破阵
{
  const p = await page();
  const { scene } = await openBoss(p, BASE, 'caoren');
  const ev = (fn, a) => p.evaluate(([g, f, a]) => { const s = window.__game.scene.getScene(g); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [scene, fn.toString(), a]);
  await ev(s => { s.player.damageImmune = true; s.player.hp = s.player.maxHp; return 1; });
  await p.waitForTimeout(2600);
  const cr = await ev(s => { const c = s.controller, b = s.boss; if (!c?.snapshot) return { none: true };
    // 把主将放进生门：找生门扇区，站在曹仁那一侧 200 像素
    const live = c.gates.indexOf('live'), a = -Math.PI + (live + .5) * Math.PI / 4 + Math.PI / 8; s.player.sprite.setPosition(c.cx + Math.cos(a) * 200, c.cy + Math.sin(a) * 200 * .8);
    c.beat.set(null, 'idle', s.combatNow, 0); c.next = s.combatNow + 99999; b.hp = b.maxHp;
    const before = c.snapshot(); for (let i = 0; i < 10; i++) s.hitEnemy(b, 5, s.combatNow, 'melee', false, false);
    const after = c.snapshot(); return { gate: before.playerGate, hits: before.breakHits, broken: after.broken, metrics: after.metrics, taken: c.takenMul() }; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/caoren-break.png` });
  ck('曹仁八门金锁：站生门打中 10 下 → 破阵（八门停转、曹仁受伤 ×1.3）', !cr.none && cr.gate === 'live' && cr.broken && cr.metrics?.broken === 1 && Math.abs(cr.taken - 1.3) < 1e-6, cr);
  const back = await ev(s => { const c = s.controller; c.brokenUntil = s.combatNow - 1; return 1; }).then(() => p.waitForTimeout(1200)).then(() => ev(s => { const c = s.controller; return { broken: c.broken, texts: c.texts.filter(t => t.visible).length }; }));
  ck('破阵时限过后重新布阵（门名回来）', !back.broken && back.texts === 8, back);
  await p.close();
}

// ③ 守城「部曲守门」
{
  const p = await page();
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed > 1; }, null, { timeout: 120000 });
  const d0 = await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'); s.player.damageImmune = true; for (const k of ['swordsman', 'spearman', 'archer']) s.legion.recruit(k, 3, true, true);
    for (let i = 0; i < 10 && s.mode !== 'none'; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); }
    const D = s.defend; s.player.sprite.setPosition(D.gatePos.x + 500, D.gatePos.y + 500); await new Promise(r => setTimeout(r, 4000));
    const A = s.legion.formation.anchor, us = s.legion.units.filter(u => u.active), near = us.filter(u => Math.hypot(u.x - D.gatePos.x, u.y - D.gatePos.y) < 260).length;
    return { anchor: A, gate: D.gatePos, guard: D.gateGuard, n: us.length, near };
  });
  await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), D = s.defend; s.player.sprite.setPosition(D.gatePos.x + 160, D.gatePos.y + 240); await new Promise(r => setTimeout(r, 1200)); });
  await p.screenshot({ path: `${OUT}/defense-gate-guard.png` });
  ck('守城开局部曲守城门：锚点在城门内、面朝城外；主将走远了部曲仍守在门边', d0.guard && !!d0.anchor && Math.abs(d0.anchor.x - d0.gate.x) < 1 && d0.anchor.y > d0.gate.y && d0.near >= Math.ceil(d0.n * .6), d0);
  const d1 = await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'); s.defend.setGateGuard(false); await new Promise(r => setTimeout(r, 300)); return { anchor: s.legion.formation.anchor }; });
  ck('改为随主将：锚点清掉', d1.anchor === null, d1);
  await p.close();
}
ck('无报错', !errors.length, errors.slice(0, 4));
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
