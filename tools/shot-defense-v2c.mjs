// 守城 v2 试玩版 · c 段实机（dev 测试战斗 + ?defenseV2=1）：定宽场地（最左 / 正中城门 / 最右三张）、舆图整张图、
// 波次 + 喘息（补满、赏粮、Space 跳过）、按威胁自动增援、出城冲阵（开门 / 回门洞关门 / 时间到拉回）、背面冲车、门破 → 敌兵穿门洞 → 砍府衙 → 府衙失守、首次引导；不越界。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2c.mjs → assets/review/defense-v2/c-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-v2';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await unblock().catch(() => {}); await wait(250); } return false; };
const to = (x, y) => ev(([x, y]) => { window.__S.player.sprite.setPosition(x, y); }, [x, y]);
/** 免死主将杀得多会升级（三选一 / 专职 / 加点），每波开头还有「战斗支援」招兵面板——弹出来战斗就停了，测试里直接选第一个 / 关掉。 */
const unblock = () => ev(() => { const s = window.__S; if (!s) return ''; for (let i = 0; i < 6 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') { const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => x.name === 'recruit-close' && x.input?.enabled); if (o) { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); } else s.setMode('none'); } else if (s.mode === 'branch') s.chooseBranch?.(1); else if (['story', 'attributes', 'bossloot'].includes(s.mode)) s.setMode('none'); else break; } return s.mode; });
const wait2 = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await unblock(); await p.waitForTimeout(Math.min(400, ms - (Date.now() - t0))); } };
/** 场内检查：主将、部曲、敌兵（器械、首领除外）都在场地边界以内（容差 tol）；镜头不超出边界 + 边带。 */
const inBounds = () => ev(() => { const s = window.__S, B = s.defenseV2.g.bounds, tol = 24, out = [];
  const chk = (who, o) => { if (o.x < B.left - tol || o.x > B.right + tol || o.y < B.top - tol || o.y > B.bottom + tol) out.push(who + '@' + Math.round(o.x) + ',' + Math.round(o.y)); };
  chk('hero', s.player); for (const u of s.legion.units) if (u.active) chk('ally', u); for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') chk('enemy', e);
  const v = s.cameras.main.worldView, band = 220 + 2, cam = v.left >= B.left - band && v.right <= B.right + band && v.top >= B.top - band && v.bottom <= B.bottom + band;
  return { out: out.slice(0, 5), cam, view: [Math.round(v.left), Math.round(v.right), Math.round(v.top), Math.round(v.bottom)], B }; });
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.removeItem('im_defense_v2_guide_v1'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off&defenseV2=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 });
  await ev(() => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('siegeCity', 'chenliu'); g.registry.set('siegeMode', 'defense'); g.registry.set('runConfig', { character: 'zhaoyun' }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('SiegeGameScene'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && s.elapsed > .5 && s.defenseV2?.stats.built && s.defenseAssault && s.arena; }, null, { timeout: 120000 });
  const G = await ev(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true;
    for (const [k, n] of [['archer', 6], ['swordsman', 6], ['spearman', 6], ['rider', 2]]) s.legion.recruit(k, n, true);
    s.defenseV2.assignAll(true); const g = s.defenseV2.g; return { gx: g.gx, W: g.W, top: g.top, F: g.F, innerTop: g.innerTop, X0: g.X0, X1: g.X1, B: g.bounds, waves: s.chapter.waves.length, arena: s.arena.bounds }; });
  ck('定宽场地：StageArena 用的就是守城 v2 的场地边界；中城 ' + G.waves + ' 波', JSON.stringify(G.arena) === JSON.stringify(G.B) && G.waves === 4, { B: G.B, arena: G.arena });
  // ———— 三张：最左 / 正中城门 / 最右（墙铺满、两端角楼贴地图边、看不到墙外空地）
  for (const [name, x] of [['c-1-left', G.X0 + 50], ['c-2-center', G.gx], ['c-3-right', G.X1 - 50]]) {
    await to(x, G.W - 90); await wait2(1600); await p.screenshot({ path: OUT + '/' + name + '.png' });
    const ib = await inBounds(); ck(name + '：镜头夹在场地 + 边带以内、人都在场内', ib.cam && ib.out.length === 0, ib);
    if (name === 'c-1-left') { // 军师卡：逐字打出时字竖向居中在墨条上（c 段验收第 5 条：原来字飘在墨条上沿外、墨条下面空着）
      await ev(async () => { const B = await import('/src/ui/StoryBarkCard.ts'); B.showBarkCard(window.__S, { side: 'left', name: '简雍', text: '敌军从城外（下方）攻来，会架梯爬墙。我军已上墙守垛口、梯口；预备队会自己补到吃紧的那段，按 E 让预备队全体压到你这段。' }); }); await wait(900); // 打到一半时量
      await p.screenshot({ path: OUT + '/c-10-card.png' });
      const card = await ev(() => { const c = window.__S.children.list.filter(o => o.name === 'story-bark-card').pop(); if (!c) return null; const say = c.list.find(o => o.name === 'story-bark-card-text'), brush = c.list.filter(o => o.texture?.key === 'barkui_brush' && o.name !== 'story-bark-card-faction')[0];
        return say && brush ? { text: say.text, sayMid: Math.round(say.y + say.height * (0.5 - (say.originY ?? 0))), brushMid: Math.round(brush.y), brushH: Math.round(brush.displayHeight) } : null; });
      ck('军师卡：打出来的字在墨条中间（不飘在墨条上沿外）', !!card && Math.abs(card.sayMid - card.brushMid) <= 14 && card.text.length > 0, card);
    }
  }
  // 修门字签：门楼内侧（楼阁台基前）、小号字（c 段验收第 6 条）
  const lab = await ev(() => { const s = window.__S, g = s.defenseV2.g, o = s.children.getByName('defv2-gate-label'); return o ? { y: Math.round(o.y), want: g.top + 50, size: o.style.fontSize, x: Math.round(o.x - g.gx) } : null; });
  ck('「修门」字签挪到门楼内侧（楼阁台基前）、缩小', !!lab && Math.abs(lab.y - lab.want) <= 4 && lab.size === '11px' && lab.x === 0, lab);
  // ———— 舆图（M）：整张场地
  await to(G.gx - 300, G.W - 90); await wait2(400);
  await ev(() => window.__S.battleMap?.toggleBig()); await wait2(1200);
  await p.screenshot({ path: OUT + '/c-4-map.png' });
  const mapOk = await ev(() => { const s = window.__S; return { open: !!s.battleMap?.bigOpen, fort: !!s.mapFort(), center: s.mapCenter() }; });
  ck('舆图（M）展开：以整张场地为画心，带守城标记（四段 / 城门 / 府衙 / 器械）', mapOk.open && mapOk.fort && !!mapOk.center, mapOk);
  await ev(() => window.__S.battleMap?.toggleBig()); await wait2(800);
  // ———— 第 1 波：器械按波排进来；立梯后预备队按威胁自动增援
  await ev(() => { const s = window.__S; s.elapsed = Math.max(s.elapsed, 4); });
  const upOk = await until(() => window.__S.defenseAssault.snapshot().ladders.some(l => l.state !== 'drive'), 30000);
  if (!upOk) await ev(() => { const s = window.__S, A = s.defenseAssault; for (const l of A.ladders) l.cart.sprite.y = s.defenseV2.g.F + 90; }); // 车开得慢：挪到墙脚附近
  await until(() => window.__S.defenseAssault.snapshot().ladders.some(l => l.state === 'up'), 15000);
  const reinf = await until(() => window.__S.defenseV2.stats.autoSent > 0, 8000);
  ck('第 1 波：云梯车按波排进来、立梯；立梯那段的威胁让预备队自动增援过去（不按 E）', reinf, await ev(() => ({ wall: { ...window.__S.defenseV2.stats }, ladders: window.__S.defenseAssault.snapshot().ladders })));
  // ———— 喘息：结算赏粮、滚木 / 热油补满、状态行、Space 跳过
  const food0 = await ev(() => { const s = window.__S, A = s.defenseAssault; A.logs[0] = 0; A.oil.charges = 0; return s.legion.food; });
  await ev(() => { const s = window.__S; s.elapsed = 65.5; });
  const restOk = await until(() => window.__S.defenseAssault.phase === 'rest', 5000); await wait2(3700); // 第一次的完整横幅约 3 秒，出着时顶上状态行先让开
  const rest = await ev(() => { const s = window.__S, A = s.defenseAssault; return { phase: A.phase, logs: [...A.logs], oil: A.oil.charges, reward: A.stats.rewardFood, food: s.legion.food, status: A.status.visible ? A.status.text : '', banner: s.children.list.filter(o => o.name === 'combat-notice').map(o => o.text).join(' | ') }; });
  await p.screenshot({ path: OUT + '/c-5-rest.png' });
  ck('喘息：赏粮（守得干净有奖）、滚木 / 热油补满、顶上一行状态（喘息 N 秒 · 城门 · 府衙 · 还有几波 · Space 跳过）', restOk && rest.reward > 0 && rest.food >= food0 + rest.reward - 1 && rest.logs[0] === 2 && rest.oil === 3 && /喘息/.test(rest.status) && /Space/.test(rest.status), rest);
  await unblock(); await p.keyboard.press('Space'); await wait2(600);
  const skip = await ev(() => ({ phase: window.__S.defenseAssault.phase, wave: window.__S.defenseAssault.wave, el: Math.round(window.__S.elapsed) }));
  ck('Space 跳过喘息 → 第 2 波', skip.phase === 'attack' && skip.wave === 1, skip);
  // ———— 出城冲阵：攻城 20 秒后门楼内侧 F；E 不可用；回门洞关门；时间到拉回
  await ev(() => { const s = window.__S; s.elapsed = Math.max(s.elapsed, 85 + 21); });
  const gs = await ev(() => { const g = window.__S.defenseV2.g; return { x: g.gx, y: g.top + 72 }; });
  await to(gs.x, gs.y); await wait2(300);
  const sp = await ev(() => window.__S.defenseAssault.prompt.text);
  await ev(() => window.__S.interactOverride()); await wait2(900);
  const out = await ev(() => { const s = window.__S, g = s.defenseV2.g, called = s.defenseV2.stats.called; s.legionOrderOverride(); return { open: s.defenseAssault.sortieOpen, heroY: Math.round(s.player.y), F: g.F, eBlocked: s.defenseV2.stats.called === called, prompt: s.defenseAssault.prompt.text, status: s.defenseAssault.status.text }; });
  await wait2(500); await p.screenshot({ path: OUT + '/c-6-sortie.png' });
  ck('门楼内侧头顶「F · 出城冲阵」→ 开门出城（主将在墙脚外）；出城时 E 不可用；顶上一行倒计时', sp === 'F · 出城冲阵' && out.open && out.heroY > out.F && out.eBlocked && /出城冲阵/.test(out.status), { sp, ...out });
  const ibs = await inBounds(); ck('出城时：主将 / 镜头都还在场地以内', ibs.cam && ibs.out.length === 0, ibs);
  await to(G.gx, G.F + 30); await wait2(900);
  const back = await ev(() => { const s = window.__S, g = s.defenseV2.g; return { open: s.defenseAssault.sortieOpen, onWall: s.player.y < g.W && s.player.y > g.top }; });
  ck('回到门洞 → 关门，主将回到门楼内侧', !back.open && back.onWall, back);
  const once = await ev(() => { const s = window.__S; s.player.sprite.setPosition(s.defenseV2.g.gx, s.defenseV2.g.top + 72); return s.defenseAssault.prompt.text; });
  await wait2(200); const once2 = await ev(() => window.__S.defenseAssault.prompt.text);
  ck('每波只能出城一次（同一波再站门楼内侧不再亮「出城冲阵」）', once2 !== 'F · 出城冲阵', { once, once2 });
  // 时间到拉回：下一波的出城开着，直接把时间拨到点
  await ev(() => { const s = window.__S; s.elapsed = 170 + 21; }); await wait2(600);
  await to(gs.x, gs.y); await wait2(200); await ev(() => window.__S.interactOverride()); await wait2(400);
  await ev(() => { const s = window.__S; s.player.sprite.setPosition(s.defenseV2.g.gx - 500, s.defenseV2.g.F + 400); s.defenseAssault.sortie.until = s.combatNow + 50; }); await wait2(800);
  const pulled = await ev(() => { const s = window.__S, g = s.defenseV2.g; return { open: s.defenseAssault.sortieOpen, onWall: s.player.y < g.W && s.player.y > g.top, sorties: s.defenseAssault.stats.sorties }; });
  ck('出城 20 秒没回来 → 时间到直接拉回城门内（不关在外面）', !pulled.open && pulled.onWall && pulled.sorties === 2, pulled);
  // ———— 背面冲车：撞锤朝上朝城门开、行进颠、撞门前冲
  await ev(() => { const s = window.__S, A = s.defenseAssault; A.ramCutWave = -1; A.spawnRam(); for (const r of A.rams) { r.y = s.defenseV2.g.F + 160; } });
  const ramOk = await until(() => window.__S.defenseAssault.stats.ramHits > 0, 15000);
  await to(G.gx + 120, G.W - 60); await wait2(500); await p.screenshot({ path: OUT + '/c-7-ram.png' });
  const ram = await ev(() => { const A = window.__S.defenseAssault; return { tex: A.rams[0]?.e.sprite.texture.key, hits: A.stats.ramHits }; });
  ck('冲车换成背面图（defv2_ram_back），开到门前撞门', ramOk && ram.tex === 'defv2_ram_back', ram);
  // ———— 门破 → 敌兵穿门洞进城 → 砍府衙 → 府衙失守
  await to(G.gx + 60, G.W - 90);
  await ev(() => { const s = window.__S; s.defenseAssault.gate.hp = 0; }); await wait(700);
  await p.screenshot({ path: OUT + '/c-9-gate-broken.png' });
  const brk = await ev(() => { const s = window.__S, A = s.defenseAssault; const big = s.children.list.filter(o => o.name === 'combat-notice' && o.type === 'Container').flatMap(o => o.list).filter(o => o.type === 'Text').map(o => o.text);
    return { big, fires: s.children.list.filter(o => o.name === 'defv2-broken-fire').length, edge: A.guideTargets().find(t => t.key === 'gate')?.label ?? '', rams: A.rams.length }; });
  ck('破门那一刻做明显（c 段验收第 4 条）：全屏大横幅一次、门洞处持续的火光 / 尘土、屏边指示「城门已破 · 敌兵入城」；冲车退走不挡门洞', brk.big.some(t => /城门已破/.test(t)) && brk.fires >= 2 && brk.edge === '城门已破 · 敌兵入城' && brk.rams === 0, brk);
  await wait2(600);
  await ev(() => { const s = window.__S, g = s.defenseV2.g; for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', g.gx - 150 + i * 60, g.F + 120, 1, true); });
  const passOk = await until(() => window.__S.defenseAssault.stats.passed > 0, 15000);
  await to(gs.x, gs.y); await wait2(250);
  const down = await ev(() => window.__S.defenseAssault.prompt.text);
  await ev(() => window.__S.interactOverride()); await wait2(300);
  const inCity = await ev(() => { const s = window.__S; return s.player.y < s.defenseV2.g.innerTop; });
  await ev(() => { const s = window.__S; s.player.sprite.setPosition(s.defenseV2.g.gx + 700, s.defenseV2.g.innerTop - 80); }); // 离府衙远：敌兵去砍府衙
  const keepOk = await until(() => window.__S.defenseAssault.stats.keepHits > 0, 15000);
  await ev(() => { const s = window.__S; s.player.sprite.setPosition(s.defenseV2.g.gx + 260, s.defenseV2.g.keep.y + 120); }); await wait2(900);
  await p.screenshot({ path: OUT + '/c-8-keep.png' });
  ck('门破：城外的兵穿门洞进城、去砍府衙；门楼内侧「F · 下城守府衙」把主将送进城里', passOk && keepOk && down === 'F · 下城守府衙' && inCity, { passed: await ev(() => window.__S.defenseAssault.stats.passed), keepHits: await ev(() => window.__S.defenseAssault.stats.keepHits), down, inCity });
  const ibk = await inBounds(); ck('门破后：敌兵 / 主将都还在场地以内', ibk.cam && ibk.out.length === 0, ibk);
  // ———— 首次引导
  const guides = await ev(() => [...window.__S.v2GuideShown]);
  ck('首次引导：开局 / 立梯 / 能出城 / 喘息 / 冲车 / 门破的军师卡都出过（每张一次）', ['start', 'ladder', 'rest', 'sortie', 'ram', 'gate'].every(k => guides.includes(k)) && new Set(guides).size === guides.length, guides);
  // ———— 府衙失守结局
  await ev(() => { const s = window.__S; s.defenseAssault.keep.hp = 0; });
  const lostOk = await until(() => window.__S.over, 6000);
  const res = await ev(() => { const s = window.__S; return { over: s.over, alive: s.player.alive, sub: s.resultTexts?.subtitle?.text ?? '' }; });
  ck('府衙归零 → 「府衙失守」结局（主将还活着，不按阵亡）', lostOk && res.over && res.alive !== false && /守城失利/.test(res.sub), res);
  const perf = await ev(() => ({ fps: Math.round(window.__game.loop.actualFps), enemies: window.__S.enemies.filter(e => e.active && !e.isSupplySlot).length }));
  ck('帧率 > 20、同屏敌兵 ≤ 150', perf.fps > 20 && perf.enemies <= 150, perf);
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 400)); }
ck('控制台无报错', errors.length === 0, errors.slice(0, 3));
await b.close(); console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
