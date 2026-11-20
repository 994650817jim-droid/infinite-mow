// 兵器专职 24 个分支实战触发 + 卡面图标（wave-progression-redesign §4.7）。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-weapon-branches.mjs   截图在 assets/review/stage-phases/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/stage-phases'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 320) + (ok ? '' : ' … ' + JSON.stringify(d).slice(320, 900)) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(start) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); for (const [k, v] of Object.entries(st.reg ?? {})) s0.registry.set(k, v);
    s0.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, start);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > .5 && s.elapsed < 8; }, start.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; window.__banners = [];
    const sb = s.showWaveBanner.bind(s); s.showWaveBanner = (t, d, c) => { window.__banners.push(t + (c ? ' | ' + c : '')); return sb(t, d, c); };
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, start.key);
  return p;
}
const branchFire = async (hero, branches) => {
  const out = {};
  for (const br of branches) {
    const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2, character: hero } });
    await p.evaluate(br => { const s = window.__S; window.__calm(); const w = s.player.weapons[0]; w.level = 5; w.branch = br; w.over = 0; s.player.stats.cooldownMul = .5; if (br === 'lb_rende') s.legion.recruit('swordsman', 2, true); for (const a of s.allies) if (a.active) a.hp = Math.max(1, a.maxHp * .4); }, br); // 仁德：存档没部曲时先招两名，再打伤
    for (let k = 0; k < 4; k++) { await p.evaluate(() => { const s = window.__S; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; s.spawnEnemy(i % 3 ? 'infantry' : 'shield', s.player.x + Math.cos(a) * 110, s.player.y + Math.sin(a) * 110, 3, true); } if (s.player.sprite) s.player.sprite.x += 90; window.__calm(); }); await p.waitForTimeout(1400); }
    out[br] = await p.evaluate(() => { const r = window.__S.branchRt; return r ? { ...r.stats } : null; });
    if (br === 'gy_qinglong') await p.screenshot({ path: `${OUT}/branch-gy-qinglong.png` });
    await p.close();
  }
  return out;
};
{
  const heroes = { zhaoyun: ['zy_longdan', 'zy_bainiao'], guanyu: ['gy_qinglong', 'gy_danqi'], zhangfei: ['zf_duanqiao', 'zf_nuhou'], liubei: ['lb_rende', 'lb_sanying'], zhuge: ['zg_liaoyuan', 'zg_bazhen'], huangzhong: ['hz_chuanyang', 'hz_huoshi'], machao: ['mc_tieqi', 'mc_weishui'], weiyan: ['wy_ziwu', 'wy_hanzhong'], pangtong: ['pt_lianying', 'pt_lianhuan'], huangyueying: ['hy_liannu', 'hy_muniu'], sunshangxiang: ['ss_wanren', 'ss_benxi'], diaochan: ['dc_biyue', 'dc_meirenji'] };
  const r = {}; for (const [h, bs] of Object.entries(heroes)) Object.assign(r, await branchFire(h, bs));
  const noHit = ['zf_nuhou', 'lb_rende', 'wy_hanzhong'], bad = Object.entries(r).filter(([k, v]) => !v || v.procs < 1 || (!noHit.includes(k) && v.hits < 1)).map(([k]) => k);
  ck('24 个兵器专职分支在战斗里都会触发（12 名武将 × 2）', bad.length === 0 && Object.keys(r).length === 24, { bad, r });
}
// 卡面图标：24 枚都载入
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  const ic = await p.evaluate(async () => { const wb = await import('/src/data/weaponBranches.ts'); return wb.WEAPON_BRANCHES.filter(b => !window.__S.textures.exists(b.icon)).map(b => b.id); });
  ck('24 枚分支卡面图标都已载入（branch_icon_*）', ic.length === 0, ic);
  await p.close();
}
// 兵器专职面板（2026-11-20）：本命 Lv5 单独弹面板（暂停、两张大卡、立绘、契合印），不再混在三选一；先专职再三选一；选契合那条效果 +10%；构筑总览显示分支栏；进阶短演出
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2, character: 'zhaoyun' } });
  await p.evaluate(() => { const s = window.__S; window.__calm(); const w = s.player.weapons[0]; w.level = 5; delete w.branch; delete w.attuned; w.over = 0; s.pendingLevels = 1; s.lastPickAt = -1e9; s.openUpgrade(); });
  await p.waitForTimeout(1500);
  const pn = await p.evaluate(() => { const s = window.__S, root = s.children.getByName('branch-panel'); const texts = root ? root.list.filter(o => o.type === 'Text').map(o => o.text) : []; return { mode: s.mode, panel: !!root, cards: root ? root.list.filter(o => /^branch-card-/.test(o.name ?? '')).length : 0, fit: s.branchFitId, fitSeal: texts.includes('契合'), portrait: !!root?.getByName?.('branch-portrait') || !s.textures.exists('ink_hero_zhaoyun'), final: texts.some(t => /进阶形态「/.test(t)), lv6: texts.some(t => /Lv6（第四章开放）/.test(t)), lockText: texts.some(t => /选定即锁定 · 需行营「重整构筑」才能更换/.test(t)), pending: s.pendingLevels }; });
  await p.screenshot({ path: OUT + '/branch-panel.png' });
  ck('本命 Lv5：单独弹「兵器专职」面板（暂停、两张大卡、契合印、写 Lv6 / 进阶形态），三选一排在后面', pn.mode === 'branch' && pn.panel && pn.cards === 2 && pn.fitSeal && pn.final && pn.lv6 && pn.pending === 1 && pn.lockText, pn);
  const idx = await p.evaluate(() => { const s = window.__S; return s.branchOpts ? s.branchOpts.findIndex(b => b.id === s.branchFitId) : 0; });
  await p.keyboard.press(idx === 0 ? 'Digit1' : 'Digit2'); await p.waitForTimeout(600);
  const pk = await p.evaluate(() => { const s = window.__S, w = s.player.weapons[0]; return { branch: w.branch, attuned: w.attuned, mode: s.mode, panel: !!s.children.getByName('branch-panel'), opts: (s.upgradeOptions ?? []).map(o => o.id), banner: window.__banners.slice(-2) }; });
  ck('按键选契合那条：锁定分支、记「契合」（效果 +10%）、面板关；接着弹排队的三选一，里面不再有专职卡', pk.branch === pn.fit && pk.attuned === true && !pk.panel && pk.mode === 'levelup' && !pk.opts.some(id => id.startsWith('branch_')) && pk.banner.some(b => /兵器专职 · .*契合流派/.test(b)), pk);
  await p.evaluate(() => { const s = window.__S; window.__calm(); s.togglePause(); s.openBuildPanel(); }); await p.waitForTimeout(900);
  const ov = await p.evaluate(() => { const s = window.__S, all = []; const walk = l => { for (const o of l) { if (o.type === 'Text' && o.visible !== false) all.push({ n: o.name, t: o.text }); if (o.list) walk(o.list); } }; walk(s.children.list); return all.filter(x => /-branch/.test(x.n ?? '')).map(x => x.t); });
  await p.screenshot({ path: OUT + '/branch-overview.png' });
  ck('构筑总览：专职栏写分支名 + 契合、Lv6 / Lv7 进度、进阶条件（Lv7 + 本派 4 势）、「已锁定 · 需重整构筑才能更换」', ov.some(t => /契合/.test(t)) && ov.some(t => /Lv6 · （第四章）|Lv6 ·（第四章）|Lv6 .（第四章）/.test(t) || /Lv6/.test(t)) && ov.some(t => /进阶「/.test(t) && /4 势/.test(t)) && ov.some(t => t === '已锁定 · 需重整构筑才能更换'), ov);
  await p.evaluate(async () => { const s = window.__S, wb = await import('/src/data/weaponBranches.ts'); s.click?.('build-panel-back'); s.children.getByName('build-panel')?.destroy(); s.setMode('none'); s.branchFinalShow(wb.branchById(s.player.weapons[0].branch)); }); await p.waitForTimeout(300);
  const fin = await p.evaluate(() => ({ title: window.__S.children.getByName('branch-final-title')?.text }));
  // 锁定（2026-11-20 用户「选定一个转职之后就选不了另外一个了，除非去洗掉」）：另一条在三选一 / 新卡池 / 锦囊里都不出；面板不再开、不能改；跨关 / 存档读档后依然锁定
  const lock = await p.evaluate(async () => { const s = window.__S, U = await import('/src/data/upgrades.ts'), C = await import('/src/systems/Campaign.ts'), own = s.player.weapons[0], chosen = own.branch, other = s.branchOpts.find(b => b.id !== chosen).id;
    window.__calm(); const seen = new Set(); own.over = 0;
    for (let i = 0; i < 60; i++) { for (const o of U.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth, s.newCardSource())) seen.add(o.id + '|' + (o.desc ?? '')); }
    for (const o of s.newCardSource()?.draw(12) ?? []) seen.add(o.id + '|' + (o.desc ?? ''));
    const ids = [...seen], otherSeen = ids.some(x => x.includes(other)), branchCards = ids.filter(x => x.startsWith('branch_'));
    s.openBranch(); const reopened = !!s.branchPanel || s.mode === 'branch'; s.branchOpts = s.branchOpts.length ? s.branchOpts : []; const changed = s.chooseBranch(s.branchOpts.findIndex(b => b.id === other));
    const pack = C.packCampaign(s.runConfig.character, s.player, s.legion, s.followers), round = JSON.parse(JSON.stringify(pack)), w2 = round.player.weapons[0];
    return { chosen, other, otherSeen, branchCards, reopened, changed, still: own.branch, carried: { branch: w2.branch, attuned: w2.attuned }, need: s.needBranch() }; });
  ck('锁定：选定后另一条分支在三选一 / 新卡池 / 锦囊里都不出、没有专职卡；面板不再弹、也改不了', !lock.otherSeen && lock.branchCards.length === 0 && !lock.reopened && lock.changed === false && lock.still === lock.chosen && !lock.need, lock);
  ck('锁定跨关 / 存档读档：征程构筑打包（JSON 往返）后分支与契合原样', lock.carried.branch === lock.chosen && lock.carried.attuned === true, lock.carried);
  // HUD 专职行（被动栏下）：图标、分支名 + Lv、进阶进度；增益栏往下让
  const hud = await p.evaluate(() => { const s = window.__S; window.__calm(); s.click?.('build-panel-back'); s.children.getByName('build-panel')?.destroy(); s.setMode('none'); return null; });
  await p.waitForTimeout(500);
  const hr = await p.evaluate(() => { const s = window.__S, all = []; const walk = l => { for (const o of l) { if (o.name && /^passive-branch-/.test(o.name)) all.push({ n: o.name, t: o.text, v: o.visible }); if (o.list) walk(o.list); } }; walk(s.children.list); return { rows: all, buffY: s.buffHud?.root.y }; });
  await p.screenshot({ path: OUT + '/hud-branch.png', clip: { x: 0, y: 0, width: 520, height: 420 } });
  ck('HUD：被动栏下多一行专职（分支名 · Lv.5、进阶 x/4 势），增益栏往下让', hr.rows.some(r => r.n === 'passive-branch-name' && r.v && /龙胆 · 七进七出 · Lv\.5/.test(r.t)) && hr.rows.some(r => r.n === 'passive-branch-progress' && /进阶 \d\/4 势/.test(r.t)) && hr.buffY === 214, hr);
  // 七进七出（定案「冲进去再杀回原位」）：站定朝最近敌兵、在走沿走的方向；冲进去 150 再折返回出发点，往返无敌，回原位推开贴身敌兵
  const dz = await p.evaluate(() => { const s = window.__S, P = s.player, rt = s.branchRt; window.__calm();
    for (const e of s.enemies) if (e.active && e.kind !== 'boss') { e.hp = 0; s.killEnemy(e); }
    for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', P.x + 120 + (i % 3) * 22, P.y - 11 + Math.floor(i / 3) * 22, 3, true); rt.lastDash = null; rt.nextAt = 1e12; });
  await p.waitForTimeout(150);
  const dz2 = await p.evaluate(() => { const s = window.__S, P = s.player, rt = s.branchRt; rt.vx = 0; rt.vy = 0; const now = s.combatNow; rt.dash(); return { ...rt.lastDash, inv: P.invulnUntil - now }; });
  await p.waitForTimeout(110); await p.screenshot({ path: OUT + '/longdan-dash.png' });
  await p.waitForTimeout(700);
  const back = await p.evaluate(() => { const s = window.__S, d = s.branchRt.lastDash; return { d, at: { x: Math.round(s.player.x), y: Math.round(s.player.y) } }; });
  await p.evaluate(() => { const s = window.__S, P = s.player; for (let i = 0; i < 3; i++) s.spawnEnemy('infantry', P.x - 100, P.y - 20 + i * 20, 3, true); }); await p.waitForTimeout(150);
  const mv = await p.evaluate(() => { const s = window.__S, rt = s.branchRt; rt.vx = 0; rt.vy = 220; rt.dash(); return { ...rt.lastDash }; });
  ck('七进七出：站定时朝最近的敌兵冲进去，随即杀回出发点（误差 ≤ 24），往返全程无敌（≥ 0.4 秒）', dz2.mode === 'target' && dz2.ux > .9 && dz2.inv >= 400 && back.d?.back && Math.hypot(back.at.x - back.d.ox, back.at.y - back.d.oy) <= 24, { dz2, back });
  ck('七进七出：在走时沿走的方向冲（玩家控制）', mv.mode === 'move' && mv.uy === 1, mv);
  ck('进阶形态短演出：分支进阶名大字（+ BranchFinalFx 手绘爆发、本派觉醒光、震屏）', !!fin.title, fin);
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
