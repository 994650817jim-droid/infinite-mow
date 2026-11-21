// 第二章「讨伐董卓」全面检查（用户 11-20「开始检查第二章」；共享笔记 chapter2-review.md）：
// 2-1 汜水关 / 2-2 荥阳 / 2-3 洛阳 —— 五段节奏、首领出场、城墙城门（墙内只刷远程）、营帐 / 伏营、副将专属形象、西凉兵外观、
// 2-3 董卓城头打不到 / 营寨尽毁吕布跃下；玩法开放（?mech=real 按进度）：2-1 兵装 + 机缘、2-2 副将、四维 1-3（2026-11-21 从 2-3 提前）、第二章后攻城、劝降 3-1。
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
  const p = await stage(1); await p.waitForFunction(() => (window.__S.sishuiPass?.snapshot().towers ?? 0) > 0, null, { timeout: 15000 }).catch(() => {}); const a = await info(p); // 箭楼等关墙图载完才建
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
  await p.waitForFunction(() => !!window.__S.phaseRunner?.ltArt(), null, { timeout: 15000 }).catch(() => {}); // 正常打到 185 秒时副将图早已载好；测试直接跳时间，先等图
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
  const p = await stage(3); await p.waitForFunction(() => window.__S.luoyangLt?.lt, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800); await p.evaluate(() => window.__calm()); await p.waitForTimeout(400); await p.evaluate(() => window.__calm());
  const d0 = await p.evaluate(() => { const s = window.__S, z = s.dzLubu?.snapshot(); return { z, camps: s.objective?.standing.length, garrison: s.luoyangCamps?.stats.garrison, objective: s.chapter.objective?.label }; });
  await p.screenshot({ path: OUT + '/2-3-start.png' });
  ck('2-3：开局董卓、吕布在城头（董卓无敌），5 座营寨有守军', d0.z && d0.z.dzInv && ['perch', 'wall'].includes(d0.z.phase) && d0.camps === 5 && d0.garrison > 0, d0);
  const hit = await p.evaluate(() => { const s = window.__S, b = s.boss, hp = b.hp; s.hitEnemy(b, 500, s.combatNow, 'melee', false, false); return { before: Math.round(hp), after: Math.round(b.hp) }; });
  ck('2-3：董卓下城前打不动', hit.after === hit.before, hit);
  const lj = await p.evaluate(() => { const s = window.__S, r = s.luoyangLt, e = r?.lt?.e, c = s.luoyangCamps?.camps[4]; const tag = s.children.getByName('lieutenant-tag'); return { name: r?.stats.lieutenant, tex: e?.def.walkVisual?.texture ?? e?.def.texture, tag: tag?.text, inCamp: !!(e && c && Math.hypot(e.x - c.x, e.y - c.y) < 260), hp: Math.round(e?.maxHp ?? 0) }; });
  ck('2-3：正南大营有营寨守将李傕（名牌「营寨守将 · 李傕」、第二章副将专属形象、开局在营里）', lj.name === '李傕' && /^lt_hulao/.test(lj.tex ?? '') && lj.tag === '营寨守将 · 李傕' && lj.inCamp && lj.hp > 0, lj);
  await p.evaluate(() => { const s = window.__S, c = s.luoyangCamps.camps[4]; s.player.sprite.setPosition(c.x, c.y + 330); }); await p.waitForTimeout(900); await p.evaluate(() => window.__calm());
  await p.screenshot({ path: OUT + '/2-3-lijue.png' });
  const bn = await p.evaluate(() => { const s = window.__S; s.showWaveBanner('测试横幅', false, '测试小字'); const n = s.children.getByName('combat-notice'), o = s.objectiveText; const nb = n.list[0].getBounds(), ob = o.getBounds(); return { objective: o.visible, overlap: !(nb.bottom < ob.top || nb.top > ob.bottom || nb.right < ob.left || nb.left > ob.right), cap: Math.round(nb.top), obj: Math.round(ob.bottom) }; });
  ck('2-3：横幅小字不再与「目标 · 营寨」行重叠（有目标行时横幅下移一行）', bn.objective && !bn.overlap, bn);
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
  ck('2-1（第一章通关后）：兵装、机缘、四维（1-3 起）开放；劝降、攻城未开；新玩法卡一关不超过 2 张', g.fortune && g.gear && !g.parley && g.attributes && !g.siege && g.cards.length <= 2, g);
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
{
  const p = await stage(1, '', W(3, 2));
  await p.evaluate(() => { const g = window.__game; g.registry.set('mapFocusCity', 'luoyang'); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('WorldMapScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene') && window.__game.scene.getScene('WorldMapScene').cityMarkers?.length, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const m = window.__game.scene.getScene('WorldMapScene'), N = await import('/src/world/WorldNodes.ts'); m.selected = { kind: 'node', node: N.WORLD_NODES.find(n => n.id === 'hulao') }; m.refresh(); }); // 选中第二章才画关卡点
  await p.waitForFunction(() => { const F = (m, n) => { const q = [...m.children.list]; while (q.length) { const o = q.shift(); if (o.name === n) return o; if (o.list) q.push(...o.list); } return null; }; const m = window.__game.scene.getScene('WorldMapScene'); return window.__game.scene.isActive('WorldMapScene') && !!F(m, 'stage-pin-root-hulao-3'); }, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); for (const o of m.children.list) if (/modal/.test(o.name ?? '')) o.destroy(); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const F = (m, n) => { const q = [...m.children.list]; while (q.length) { const o = q.shift(); if (o.name === n) return o; if (o.list) q.push(...o.list); } return null; };
    const m = window.__game.scene.getScene('WorldMapScene'), pin = F(m, 'stage-pin-root-hulao-3'), mk = m.cityMarkers.find(c => c.city.id === 'luoyang');
    // 同在地图层里比：关卡点（印 + 下方关名）与城牌（城郭图 + 城名）各自按本地坐标算框
    const box = (root, kids) => kids.filter(c => c && c.visible !== false).map(c => { const w = c.displayWidth ?? c.width ?? 0, h = c.displayHeight ?? c.height ?? 0, ox = c.originX ?? .5, oy = c.originY ?? .5; return { l: root.x + c.x - w * ox, t: root.y + c.y - h * oy, r: root.x + c.x + w * (1 - ox), b: root.y + c.y + h * (1 - oy) }; }).filter(b => b.r > b.l && b.b > b.t);
    // 关卡点在屏幕坐标里摆（跟着地图挪），城牌在地图层里（随缩放）：城牌框换算到屏幕
    const z = m.zoom, L = m.layer, pb = box(pin, pin.list), cb = box(mk.root, mk.root.list).map(c => ({ l: L.x + c.l * z, t: L.y + c.t * z, r: L.x + c.r * z, b: L.y + c.b * z }));
    const hit = pb.some(a => cb.some(c => !(a.r < c.l || a.l > c.r || a.b < c.t || a.t > c.b)));
    return { pin: [Math.round(pin.x), Math.round(pin.y)], city: [mk.city.x, mk.city.y], hit, label: pin.getData('label')?.text }; });
  await p.screenshot({ path: OUT + '/map-ch2.png' });
  ck('天下地图：2-3 关卡点在洛阳城外、不压城牌，关名写全', !r.hit && /2-3 火烧洛阳/.test(r.label ?? ''), r);
  await p.close();
}
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
