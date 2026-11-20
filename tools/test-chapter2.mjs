// 第二章「讨伐董卓」全面检查（用户 11-20「开始检查第二章」；共享笔记 chapter2-review.md）：
// 2-1 汜水关 / 2-2 荥阳 / 2-3 洛阳 —— 五段节奏、首领出场、城墙城门（墙内只刷远程）、营帐 / 伏营、副将专属形象、西凉兵外观、
// 2-3 董卓城头打不到 / 营寨尽毁吕布跃下；玩法开放（?mech=real 按进度）：2-1 兵装 + 机缘、2-2 副将、2-3 四维、第二章后攻城、劝降 3-1。
// 截图 assets/review/chapter2/。用法：BASE=http://127.0.0.1:5241/ node tools/test-chapter2.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/chapter2'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 520) : '')); };
const W = (ys, ds) => ({ version: 10, yellowStages: ys, dongzhuoStages: ds, cleared: { huangjin: ys >= 3, hulao: ds >= 3 }, worldAvailable: ys >= 3, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, chapterSeen: 3, tutorialDone: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function stage(n, q = '', world = W(3, 2)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop' + q);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(n => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: n }); s0.scene.restart(); }, n);
  await p.waitForFunction(n => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter?.westStage === n && s.elapsed > 1 && s.elapsed < 8; }, n, { timeout: 120000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'branch') s.chooseBranch?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; });
  return p;
}
const jump = async (p, t) => { await p.evaluate(t => { window.__S.elapsed = t; window.__S.lastPickAt = -1e9; }, t); for (let i = 0; i < 4; i++) { await p.waitForTimeout(400); await p.evaluate(() => window.__calm()); } };
const info = p => p.evaluate(() => { const s = window.__S, en = s.enemies.filter(e => e.active && !e.isSupplySlot && e.def.behavior !== 'supply' && e.kind !== 'boss');
  return { name: s.chapter.name, kinds: s.phasePlan?.phases.map(x => x.kind + '@' + x.start + ':' + x.name).join(' / ') ?? null, lt: s.phasePlan?.lieutenant ?? '', fortunes: !!s.fortunes,
    pass: s.sishuiPass?.snapshot?.(), wallSpawn: { ...s.wallSpawn }, tex: [...new Set(en.map(e => e.def.walkVisual?.texture ?? e.def.texture))].slice(0, 8), boss: s.boss?.active ? { name: s.chapter.bossName, tex: s.boss.def.walkVisual?.texture ?? s.boss.def.texture } : null,
    theme: s.music?.battleTheme ?? s.music?.theme ?? null, elapsed: Math.round(s.elapsed) }; });

// ———— 2-1 汜水关 ————
{
  const p = await stage(1); await p.waitForTimeout(1500); const a = await info(p);
  await p.evaluate(() => { const s = window.__S, w = s.sishuiPass?.wallLine; window.__calm(); if (w !== undefined) s.player.sprite.setPosition(s.player.x, w + 260); }); await p.waitForTimeout(900); await p.evaluate(() => window.__calm());
  await p.screenshot({ path: OUT + '/2-1-start.png' });
  ck('2-1：五段 0/55/120/185/245，第四段「西凉大军」（副将 2-2 才登场）', a.kinds === 'vanguard@0:关外前哨 / elite@55:西凉列阵 / event@120:西凉铁骑冲阵 / surge@185:西凉大军 / boss@245:华雄出阵' && !a.lt, a);
  ck('2-1：关墙、关门关着、箭楼、营帐都在', a.pass && !a.pass.gateOpen && a.pass.towers > 0 && a.pass.tents > 0, a.pass);
  await jump(p, 60); await p.waitForTimeout(2500); const m = await info(p);
  const behind = await p.evaluate(async () => { const G = await import('/src/data/gateSpawn.ts'), s = window.__S, wy = s.sishuiPass?.wallLine ?? null; const ins = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss' && wy !== null && e.y < wy); return { wy, inside: ins.map(e => e.kind + (e.def.trait ? '/' + e.def.trait.kind : '')), melee: ins.filter(e => !G.isRangedSpawn(e.kind, e.def)).length }; });
  ck('2-1：城门没破前墙内只刷远程（弓手 / 羌胡骑射 / 滚石兵）', behind.melee === 0, { ...behind, wallSpawn: m.wallSpawn });
  ck('2-1：敌兵是西凉军外观（基础兵 xiliang_*，另有羌胡骑射等配兵特色兵），没有黄巾兵', m.tex.length > 0 && m.tex.some(t => /^xiliang_/.test(t)) && !m.tex.some(t => /^yellow_|^enemy_(infantry|shield|archer|cavalry)_walk$/.test(t)), m.tex);
  await jump(p, 246); await p.waitForTimeout(1500); const z = await info(p);
  await p.screenshot({ path: OUT + '/2-1-boss.png' });
  ck('2-1：245 秒华雄出阵（华雄专属图）', z.boss?.name === '华雄' && /huaxiong/.test(z.boss.tex), z.boss);
  await p.close();
}
// ———— 2-2 荥阳 ————
{
  const p = await stage(2); await p.waitForTimeout(1500); const a = await info(p);
  ck('2-2：五段，第四段副将李肃压阵（副将 2-2 开放）；四角伏兵营帐', a.kinds?.includes('lieutenant@185:李肃压阵') && a.pass?.tents === 4, a);
  await jump(p, 186); await p.waitForTimeout(1500);
  const lt = await p.evaluate(() => { const r = window.__S.phaseRunner, e = r?.lt?.e; return { name: r?.stats.lieutenant, tex: e?.def.walkVisual?.texture ?? e?.def.texture, art: !!r?.ltArt() }; });
  await p.evaluate(() => { const s = window.__S, e = s.phaseRunner?.lt?.e; if (e) s.player.sprite.setPosition(e.x - 150, e.y + 60); }); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/2-2-lieutenant.png' });
  ck('2-2：副将李肃用第二章副将专属形象（lt_hulao_*）', lt.name === '李肃' && /^lt_hulao/.test(lt.tex ?? '') && lt.art, lt);
  await jump(p, 246); await p.waitForTimeout(1500); const z = await info(p);
  await p.screenshot({ path: OUT + '/2-2-boss.png' });
  ck('2-2：245 秒徐荣出阵', z.boss?.name === '徐荣', z.boss);
  await p.close();
}
// ———— 2-3 洛阳 ————
{
  const p = await stage(3); await p.waitForTimeout(2500); await p.evaluate(() => window.__calm()); await p.waitForTimeout(400); await p.evaluate(() => window.__calm());
  const d0 = await p.evaluate(() => { const s = window.__S, z = s.dzLubu?.snapshot(); return { z, camps: s.objective?.standing.length, garrison: s.luoyangCamps?.stats.garrison, objective: s.chapter.objective?.label }; });
  await p.screenshot({ path: OUT + '/2-3-start.png' });
  ck('2-3：开局董卓、吕布在城头（董卓无敌），5 座营寨有守军', d0.z && d0.z.dzInv && ['perch', 'wall'].includes(d0.z.phase) && d0.camps === 5 && d0.garrison > 0, d0);
  const hit = await p.evaluate(() => { const s = window.__S, b = s.boss, hp = b.hp; s.hitEnemy(b, 500, s.combatNow, 'melee', false, false); return { before: Math.round(hp), after: Math.round(b.hp) }; });
  ck('2-3：董卓下城前打不动', hit.after === hit.before, hit);
  const lbl = await p.evaluate(async () => { const s = window.__S, D = await import('/src/data/chapters.ts'); const c = D.getBattleChapter('hulao', 1, 3); return { wave: s.hudTexts.wave.text, title: c.victoryTitle, text: c.victoryText }; });
  ck('2-3：不分波的关 HUD 不写「第 1/1 波」；告捷文字是「国贼伏诛 · 吕布斩董卓」（与流程一致）', lbl.wave === '洛阳城外' && lbl.title === '国贼伏诛' && /吕布斩董卓/.test(lbl.text), lbl);
  await p.evaluate(() => { const s = window.__S; for (const e of [...s.objective.standing]) { e.invulnerable = false; s.hitEnemy(e, 1e6, s.combatNow, 'melee', false, false); } });
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(400); await p.evaluate(() => window.__calm()); }
  const d1 = await p.evaluate(() => { const s = window.__S, z = s.dzLubu?.snapshot(); return { phase: z?.phase, lubu: z?.lubu, leaps: s.dzLubu?.metrics?.leaps }; });
  await p.evaluate(() => { const s = window.__S, l = s.dzLubu?.lubu; if (l) s.player.sprite.setPosition(l.x, l.y + 220); }); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/2-3-lubu.png' });
  ck('2-3：营寨尽毁 → 吕布跃下城头、可以打了', d1.leaps === 1 && d1.lubu?.active && !['perch', 'leaping'].includes(d1.phase), d1);
  await p.close();
}
// ———— 玩法开放（按进度，?mech=real）————
{
  const p = await stage(1, '&mech=real', W(3, 0)); await p.waitForTimeout(4500);
  const g = await p.evaluate(async () => { const M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); const s = window.__S; return { fortune: !!s.fortunes, gear: M.mechOpen('gear'), parley: M.mechOpen('parley'), lieutenant: M.mechOpen('lieutenant'), attributes: M.mechOpen('attributes'), siege: M.mechOpen('siege'), cards: (s.data.get('__storyBarkCardLog') ?? []).filter(x => x.startsWith('新玩法')) }; });
  await p.screenshot({ path: OUT + '/2-1-unlocks.png' });
  ck('2-1（第一章通关后）：兵装、机缘开放；劝降、四维、攻城未开；新玩法卡一关不超过 2 张', g.fortune && g.gear && !g.parley && !g.attributes && !g.siege && g.cards.length <= 2, g);
  await p.close();
  const q = await stage(2, '&mech=real', W(3, 1)); await q.waitForTimeout(1500);
  const h = await q.evaluate(async () => { const M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); return { lieutenant: M.mechOpen('lieutenant'), parley: M.mechOpen('parley'), lt: window.__S.phasePlan?.lieutenant }; });
  ck('2-2：副将开放（李肃）；徐荣第一遍劝不了（劝降 3-1 才开）', h.lieutenant && h.lt === '李肃' && !h.parley, h);
  await q.close();
  const r = await stage(3, '&mech=real', W(3, 2)); await r.waitForTimeout(1500);
  const k = await r.evaluate(async () => { const M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); return { attributes: M.mechOpen('attributes'), siege: M.mechOpen('siege') }; });
  ck('2-3：四维加点开放、攻城仍未开（第二章通关后）', k.attributes && !k.siege, k);
  await r.close();
}
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
