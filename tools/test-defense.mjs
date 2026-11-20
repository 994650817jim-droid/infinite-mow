// 守城战排查（2026-11-20 用户「守城战很多bug」）：正式模式从天下地图（告急 → 亲征 · 守城 → 出征守城）进。
// 查：守城模式、标签 / HUD、继承征程构筑（只读）、首领头像不再请求不存在的图、战败结算与退守、胜利解除告急并发军粮、无控制台报错。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-defense.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/defense'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu', 'chenliu'], eraSeen: 1, capturedEver: ['guandu', 'chenliu'], chapterSeen: 3, tutorialDone: true, alerts: [{ city: 'chenliu', attacker: 'caocao', cause: 'retaliate' }] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 160)); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const world = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('im_world_v1')); return { owned: w.ownedCities, alerts: (w.alerts ?? []).map(a => a.city), provisions: w.provisions }; });
const toMap = async () => { await p.evaluate(() => { const g = window.__game, m = g.scene.getScene('WorldMapScene'); if (m && g.scene.isActive('WorldMapScene')) { m.scene.restart(); return; } /* 已在地图上：同一帧 stop + start 同一场景会起不来，改 restart */ for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(1200); };
/** 天下地图（缺省 V1）：点告急的陈留 → 主按钮「亲征 · 守城」→ 弹窗「出征守城」。 */
const defend = async () => {
  await toMap();
  const m = await p.evaluate(M0 => { const s = eval(M0), mk = s.cityMarkers.find(x => x.city.id === 'chenliu'); mk.hit.emit('pointerup', { getDistance: () => 0 });
    return { chip: true, status: mk.root?.getData?.('status') ?? null, label: mk.label?.text ?? null, detail: s.detail?.text?.slice(0, 60) }; }, M);
  await p.waitForTimeout(300);
  const a = await p.evaluate(M0 => { const s = eval(M0); return s.action?.text?.text; }, M);
  await p.evaluate(M0 => { const s = eval(M0); s.action.image.emit('pointerup'); }, M); await p.waitForTimeout(400);
  const modal = await p.evaluate(M0 => { const s = eval(M0), md = s.children.getByName('siege-modal'), go = md?.getByName?.('siege-go'); const texts = []; const walk = l => { for (const o of l) { if (o.type === 'Text') texts.push(o.text); if (o.list) walk(o.list); } }; if (md) walk(md.list); go?.emit('pointerup'); return { open: !!md, go: !!go, texts: texts.slice(0, 14) }; }, M);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed < 5; }, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  return { m, action: a, modal };
};

// ⓪ 存一份征程构筑（追击 Lv2、本命 Lv4），看守城有没有带上
const e0 = await defend();
ck('天下地图：「告急」→ 选中陈留 → 主按钮「亲征 · 守城」→ 弹窗「出征守城」进守城', e0.m.chip && /守城/.test(e0.action ?? '') && e0.modal.open && e0.modal.go, e0);
await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), C = await import('/src/systems/Campaign.ts'), g = s.player.growth; g.build.learn('pursuit'); g.build.learn('pursuit'); s.player.weapons[0].level = 4; C.saveCampaignBuild('zhaoyun', C.packCampaign('zhaoyun', s.player, s.legion, null)); });
const camp0 = await p.evaluate(() => localStorage.getItem('im_campaign_v1'));

// ① 再进：守城模式、标签、HUD、构筑、首领头像
const e1 = await defend();
const st = await p.evaluate(G0 => { const s = eval(G0), g = s.player.growth; return { defense: s.defense, owner: s.owner, name: s.chapter.name, label: s.chapter.label, waves: s.chapter.waves.map(w => w.name), boss: s.chapter.bossName, hud: s.hudTexts.chapter.text, pursuit: g.build.level('pursuit'), weapon: s.player.weapons[0].level, loaded: s.campaignLoaded, replay: s.campaignReplay, allies: s.allies.filter(a => a.active).length, followers: s.followers?.members?.length ?? 0 }; }, G);
ck('守城模式：陈留 · 曹操来犯；HUD 写「守城 · 陈留」；波次名不再写云梯 / 冲车 / 叩关（场地没有城墙城门）', st.defense && st.owner === 'caocao' && st.name === '守城 · 陈留' && /曹操来犯/.test(st.label) && /守城 · 陈留/.test(st.hud) && !st.waves.some(w => /云梯|冲车|叩关/.test(w)), st);
ck('守城带上征程构筑（追击 Lv2、本命 Lv4；只读）', st.pursuit === 2 && st.weapon === 4 && st.loaded && st.replay, st);
await p.screenshot({ path: `${out}/defense-start-1280x720.png` });
// 首领出场：头像圈不再去请求不存在的 ink_cast_siege
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnBoss?.(); }, G); await p.waitForTimeout(2500);
const bossInfo = await p.evaluate(G0 => { const s = eval(G0); return { boss: !!s.boss?.active, tried: !!s.registry.get('bosshud_try_siege') }; }, G);
ck('守城首领出场：头像圈不请求不存在的 ink_cast_siege（画阵营印）', bossInfo.boss && !bossInfo.tried, bossInfo);
await p.screenshot({ path: `${out}/defense-boss-1280x720.png` });

// ② 战败：结算写「守城失利 · 陈留仍在告急」；退守；告急还在、城还在；构筑不写回（只按战败惩罚压生命）
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = false; s.finish(false, 'death'); }, G); await p.waitForTimeout(4500);
const lose = await p.evaluate(G0 => { const s = eval(G0), home = s.resultPanel?.getByName('result-home'); return { sub: s.resultTexts.subtitle.text, body: s.resultTexts.body.text.split('\n').slice(-3).join(' | '), home: home?.text, retreat: s.defeatRetreat?.name ?? null }; }, G);
const w1 = await world();
const coreOf = j => { const h = JSON.parse(j).heroes.zhaoyun.player; return JSON.stringify({ b: h.build, w: h.weapons.map(x => [x.id, x.level]) }); };
ck('守城战败：结算「守城失利 · 陈留仍在告急」，按钮写退守去处（最近的另一座我方城 / 营寨，不是陈留本身）；城还在、告急还在', /守城失利/.test(lose.sub) && /仍在告急/.test(lose.sub) && w1.owned.includes('chenliu') && w1.alerts.includes('chenliu') && !!lose.retreat && lose.retreat !== '陈留' && /退守/.test(lose.home ?? ''), { lose, w1 }); // 不退回刚没守住的陈留
const shown = await p.evaluate(G0 => { const n = eval(G0).resultPanel.getByName('result-notes'); return n?.visible ? n.text : ''; }, G);
ck('守城战败：结算面板显示「城池尚在；若改去别处出征，此城将失守」', /城池尚在/.test(shown), shown);
ck('守城战败：征程构筑内容不写回（战法 / 本命不变）', coreOf(await p.evaluate(() => localStorage.getItem('im_campaign_v1'))) === coreOf(camp0));
await p.screenshot({ path: `${out}/defense-lose-1280x720.png` });

// ②b 出征确认（守城重做 ②，用户 11-20 批准先做）：有告急时出征别处先弹窗；「先去守城」留在地图、城和告急都还在
await toMap();
const gd = await p.evaluate(async M0 => { const s = eval(M0), N = await import('/src/world/WorldNodes.ts'); s.registry.remove('sortieConfirmedAt'); s.selected = { kind: 'node', node: N.WORLD_NODES.find(n => n.id === 'qunxiong') }; s.refresh(); s.launch(false);
  const g = s.children.getByName('sortie-guard'); const texts = []; const walk = l => { for (const o of l) { if (o.type === 'Text') texts.push(o.text); if (o.list) walk(o.list); } }; if (g) walk(g.list); return { shown: !!g, go: !!g?.getByName('sortie-guard-go'), text: texts.join('|') }; }, M);
await p.screenshot({ path: out + '/sortie-guard.png' });
await p.evaluate(M0 => { const s = eval(M0), g = s.children.getByName('sortie-guard'); g?.getByName('sortie-guard-cancel')?.emit('pointerup'); }, M); await p.waitForTimeout(400);
const gd2 = { active: await p.evaluate(() => window.__game.scene.isActive('WorldMapScene')), guard: await p.evaluate(M0 => !!eval(M0).children.getByName('sortie-guard'), M), ...(await world()) };
ck('出征确认：有告急时从天下地图出征别处先弹窗（写明陈留将失守，两个按钮）；「先去守城」后留在地图，陈留与告急都还在', gd.shown && gd.go && /陈留/.test(gd.text) && /失守/.test(gd.text) && gd2.active && !gd2.guard && gd2.owned.includes('chenliu') && gd2.alerts.includes('chenliu'), { gd, gd2 });

// ③ 再守一次、打赢：告急解除、城还在、军粮增加
const before = await world();
await defend();
await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(1500);
const win = await p.evaluate(G0 => { const s = eval(G0); return { sub: s.resultTexts.subtitle.text, home: s.resultPanel?.getByName('result-home')?.text }; }, G);
const w2 = await world();
ck('守城胜利：「陈留守住了 · 告急解除」；告急没了、城还在、军粮增加；按钮回天下地图', /守住了/.test(win.sub) && !w2.alerts.includes('chenliu') && w2.owned.includes('chenliu') && w2.provisions > before.provisions && /天下地图/.test(win.home ?? ''), { win, before, w2 });

ck('无页面 / 控制台报错（含 ink_cast_siege 加载失败）', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
