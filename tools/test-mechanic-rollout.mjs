// 玩法逐章解锁（共享笔记 mechanic-rollout.md，用户 11-20「不用一次性把所有玩法都一次性在第一章加入」→ 批准；
// 11-20「第一章就可以开发背包，但是军需商人第二章才开，军医1-1打完就开，加入相应剧情」）：
// ?dev=1 默认全开；?dev=1&mech=real 按主线进度。
// ① 新档 1-1：只开行囊（首领掉第一件兵装、张飞一句后才出现按钮），其余都没开；行营里没有商人 / 军医页签（隐藏，不是灰掉）；
// ② 1-1 打完：军医开放，行营休整里郎中来投（简雍介绍）、初诊不收粮；商人仍没有；
// ③ 第一章通关 → 2-1：商人（张世平）开放，引子在天下地图 / 行营，不在开打时播；2-1 开打播机缘 / 锦囊；④ 不带 mech=real 全开。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-mechanic-rollout.mjs   截图在 assets/review/mechanic-rollout/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/mechanic-rollout'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const IDS = ['squad', 'atlas', 'jinnang', 'medic', 'gear', 'merchant', 'fortune', 'lieutenant', 'attributes', 'siege', 'parley', 'branch', 'combo'];
const fresh = { version: 10, yellowStages: 0, cleared: { huangjin: false, hulao: false }, worldAvailable: false, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'], tutorialDone: true };
const after11 = { ...fresh, yellowStages: 1 };
const ch1done = { ...fresh, yellowStages: 3, cleared: { huangjin: true, hulao: false }, worldAvailable: true, nodes: ['home', 'huangjin', 'hulao'], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(world, q) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1'); localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off' + q);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').elapsed > .3, null, { timeout: 120000 });
  await p.evaluate(() => { window.__find = (root, name) => { const list = root.list ?? root.getChildren?.() ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const r = window.__find(o, name); if (r) return r; } } return null; }; });
  return p;
}
const states = p => p.evaluate(async ids => { const M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); return Object.fromEntries(ids.map(i => [i, M.mechOpen(i)])); }, IDS);
/** 进行营休整（同打赢一关后的流程：resting + renderRecruit → campUI.open），读页签与人物气泡。 */
const rest = (p, key) => p.evaluate(async key => {
  const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.resting = true; s.setMode('rest'); s.campUI.open(key, '下一关');
  await new Promise(r => setTimeout(r, 5000)); s.campUI.render?.(); await new Promise(r => setTimeout(r, 200));
  const ui = s.campUI, f = n => window.__find(ui.root, n), tab = i => f('camp-tab-' + i)?.visible ?? null;
  return { tab: ui.tab, tabs: { recruit: tab(0), market: tab(2), build: tab(3), medic: tab(4) }, x2: f('camp-tab-2')?.x, x4: f('camp-tab-4')?.x, medicLine: f('camp-medic-art-line')?.text, shopLine: f('camp-merchant-art-line')?.text, notice: ui.detail?.text ?? '', intro: ui.intro?.id ?? null };
}, key);

// ① 新档 1-1（按进度）
{
  const p = await open(fresh, '&mech=real');
  const st = await states(p);
  const sc = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.waveIndex = Math.max(1, s.waveIndex); s.openRecruit(); const mode = s.mode; s.player.growth.unallocated = 3; s.updateHud?.(); const m = s.children.getByName('battle-map-scroll');
    return { mode, scroll: m ? m.visible : null, bag: s.hudTexts.bag.visible, points: s.pointsButton?.visible ?? null, branch: s.needBranch() }; });
  await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__game.scene.getScene('GameScene').mode);
  ck('新档 1-1：只开行囊；部曲 / 舆图 / 军医在 1-1 后，商人在第一章后，其余更晚', st.gear && IDS.filter(i => i !== 'gear').every(i => st[i] === false), st);
  ck('1-1：不弹战斗支援、舆图卷轴不显示且 M 无反应、加点按钮不出；还没掉兵装时行囊按钮不出现', sc.mode === 'none' && sc.scroll !== true && !sc.bag && sc.points !== true && after === 'none', { ...sc, afterM: after });
  // 11-21 制作人验收：1-1 开战右下就有「护阵 E」、左上「随军粮 0 · 兵力 0」——部曲 1-2 才开放
  await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  const sq = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), u = s.legionUI; return { hud: u?.hud?.visible ?? null, status: u?.status?.text ?? null, orderVis: u?.order?.visible ?? null, order: s.legion.order }; });
  await p.screenshot({ path: OUT + '/hud-1-1.png' });
  // 11-21 用户试玩「1-1 看不到自己军粮」：资源数字从 1-1 起就显示，只藏没开放的按钮
  ck('1-1：部曲没开放——左上只写「随军粮 N」（不写兵力），护阵 / 出击按钮不显示、按 E 无反应', sq.hud === true && /^随军粮 \d+$/.test(sq.status ?? '') && sq.orderVis === false && sq.order === 'guard', sq);
  // 称谓规则：刘备始终是义军之主，玩家是出战主将——三兄弟之外的主将，章头不叫「桃园结义」；简雍称「主公」时由刘备作答
  const lord = await p.evaluate(async () => { const St = await import('/src/systems/Story.ts'), H = (await import('/src/data/story/huangjin.ts')).HUANGJIN_STORY, ctx = l => ({ lord: l, team: () => [l], recruited: () => false });
    const camp2 = H.camp.find(n => n.id === 'huangjin.camp2');
    return { zy: St.nodeTitle(H.open, 'zhaoyun'), lb: St.nodeTitle(H.open, 'liubei'), zf: St.nodeTitle(H.open, 'zhangfei'), reply: St.resolveLines(camp2, ctx('zhaoyun'))[1]?.who, brief: St.resolveLines(H.stages[1].brief, ctx('zhaoyun')).map(l => l.who).join(',') }; });
  ck('称谓：赵云当主将时第一章章头是「涿郡投军」（刘备 / 张飞仍是「桃园结义」）；简雍喊「主公」由刘备作答；1-1 军情主将也说一句', lord.zy === '涿郡投军' && lord.lb === '桃园结义' && lord.zf === '桃园结义' && lord.reply === 'liubei' && /\{lord\}/.test(lord.brief), lord);
  // 首领掉第一件兵装：张飞一句 + 「新玩法 · 行囊」，行囊按钮出现
  const gear = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.itemDrops.collect(s.itemDrops.rollBossItem()); await new Promise(r => setTimeout(r, 1200)); s.updateHud?.();
    return { log: s.data.get('__storyBarkCardLog') ?? [], bag: s.hudTexts.bag.visible, seen: JSON.parse(localStorage.getItem('im_mech_seen') ?? '[]') }; });
  await p.screenshot({ path: OUT + '/gear-intro.png' });
  ck('1-1 首领掉第一件兵装：张飞「大哥，缴来的甲胄先穿上！」+「新玩法 · 行囊」（按 B 打开行囊），之后行囊按钮出现', /张飞大哥，缴来的甲胄先穿上/.test(gear.log.join('|')) && /新玩法 · 行囊按 B 打开行囊/.test(gear.log.join('|')) && gear.bag && gear.seen.includes('gear'), gear);
  const again = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const n = (s.data.get('__storyBarkCardLog') ?? []).length; s.itemDrops.collect(s.itemDrops.rollBossItem()); return (s.data.get('__storyBarkCardLog') ?? []).length - n; });
  ck('第二件兵装不再播', again === 0, again);
  const r = await rest(p, 'test-rest-11');
  ck('1-1 里进行营：没有军需商人、军医页签（隐藏，不是灰掉）；将帅帐也藏着', r.tabs.recruit && r.tabs.market === false && r.tabs.medic === false && r.tabs.build === false && !r.intro, r);
  await p.close();
}
// ② 1-1 打完 → 1-1 后的行营：军医郎中来投、初诊不收粮
{
  const p = await open(after11, '&mech=real');
  const st = await states(p);
  ck('1-1 打完：军医、部曲、舆图开放；军需商人仍未开', st.medic && st.squad && st.atlas && st.gear && !st.merchant && !st.jinnang, st);
  const sq2 = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 6 && s.mode !== 'none'; i++) { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } s.updateHud?.(); const u = s.legionUI; return { hud: u?.hud?.visible ?? null, status: u?.status?.text ?? null, orderVis: u?.order?.visible ?? null }; });
  ck('1-2（部曲开放）：护阵按钮出现，左上「随军粮 · 兵力」', sq2.hud === true && sq2.orderVis === true && /随军粮 \d+ · 兵力 \d+/.test(sq2.status ?? ''), sq2);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.hp = Math.round(s.player.maxHp * .5); });
  const r = await rest(p, 'test-rest-12');
  await p.screenshot({ path: OUT + '/medic-intro.png' });
  ck('行营休整：直接切到军医页，郎中「在下略通岐黄，愿随军效力。」，下方简雍介绍「伤会带到下一仗」；商人页签不出现，军医页签挨着招兵营', r.tab === 4 && r.intro === 'medic' && /略通岐黄/.test(r.medicLine ?? '') && /简雍/.test(r.notice) && /新玩法 · 军医/.test(r.notice) && r.tabs.market === false && r.tabs.medic && r.x4 < 300, r);
  const heal = await p.evaluate(() => { const ui = window.__game.scene.getScene('GameScene').campUI, st0 = ui.medicState(), food0 = ui.army.food; const ok = ui.heal('full'); const st1 = ui.medicState(); ui.player.hp = Math.round(ui.player.maxHp * .5); const st2 = ui.medicState();
    return { free0: st0.free, price0: st0.price.full, ok, spent: food0 - ui.army.food, hp: st1.hp, max: st1.maxHp, free1: st2.free, price2: st2.price.small }; });
  ck('初诊不收粮：第一次大治 0 粮回满，之后恢复原价', heal.free0 && heal.price0 === 0 && heal.ok && heal.spent === 0 && heal.hp === heal.max && !heal.free1 && heal.price2 > 0, heal);
  const r2 = await p.evaluate(async () => { const ui = window.__game.scene.getScene('GameScene').campUI; ui.open('test-rest-13', '下一关'); await new Promise(r => setTimeout(r, 300)); return { tab: ui.tab, intro: ui.intro }; });
  ck('下一次休整不再重播引子', r2.tab === 0 && !r2.intro, r2);
  await p.close();
}
// ③ 第一章通关 → 2-1（按进度）
{
  const p = await open(ch1done, '&mech=real');
  const st = await states(p);
  ck('第一章通关后：部曲 / 舆图 / 锦囊 / 军医 / 行囊 / 军需商人 / 机缘开放；副将（2-2）/ 四维（2-3）/ 攻城（第二章后）/ 劝降 / 专职（3-1）/ 合击（3-2）未开',
    ['squad', 'atlas', 'jinnang', 'medic', 'gear', 'merchant', 'fortune'].every(i => st[i]) && ['lieutenant', 'attributes', 'siege', 'parley', 'branch', 'combo'].every(i => !st[i]), st);
  const mapIds = await p.evaluate(async () => { const M = await import('/src/data/mechanicUnlocks.ts'); const ids = Object.keys(M.MECHANICS); return ids.filter(id => M.MECHANICS[id].when === 'after' && M.MECHANICS[id].chapter === 1); });
  ck('张世平（军需商人）走「第一章通关后」：在天下地图（2-1 前）播，不在 2-1 开打时播', mapIds.includes('merchant') && mapIds.includes('jinnang'), mapIds);
  await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 1 }); s0.scene.restart(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter?.id === 'hulao' && s.elapsed > 3.6; }, null, { timeout: 120000 });
  await p.waitForTimeout(700);
  const log = await p.evaluate(() => window.__game.scene.getScene('GameScene').data.get('__storyBarkCardLog') ?? []);
  await p.screenshot({ path: OUT + '/unlock-card.png' });
  const seen = await p.evaluate(() => JSON.parse(localStorage.getItem('im_mech_seen') ?? '[]'));
  ck('2-1 开打：播机缘 / 锦囊两张并记已看（一关最多 2 张）；商人 / 军医是行营引子、不在开打播；部曲、舆图顺延不记', /新玩法 · 战场机缘/.test(log.join('|')) && /新玩法 · 锦囊/.test(log.join('|')) && log.filter(x => x.startsWith('新玩法')).length === 2 && ['fortune', 'jinnang'].every(i => seen.includes(i)) && !seen.includes('merchant') && !seen.includes('medic') && !/张世平|新玩法 · 部曲/.test(log.join('|')), { log: log.slice(0, 8), seen });
  // 没在天下地图看过（测试直接进 2-1）：2-1 打完的行营补播张世平
  const r = await rest(p, 'test-rest-21');
  await p.screenshot({ path: OUT + '/merchant-intro.png' });
  ck('行营：军需商人页签出现；张世平「张某随军贩些兵甲，将军看看？」，下方刘备一句', r.tabs.market && r.tab === 2 && r.intro === 'merchant' && /张某随军/.test(r.shopLine ?? '') && /刘备/.test(r.notice), r);
  await p.close();
}
// ④ 开发期 ?dev=1 默认全开
{
  const p = await open(fresh, '');
  const st = await states(p);
  ck('?dev=1（不带 mech=real）：全部开放，测试不被锁', IDS.every(i => st[i]), st);
  await p.close();
}
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
