// 玩法逐章解锁（共享笔记 mechanic-rollout.md，用户 11-20「不用一次性把所有玩法都一次性在第一章加入」→ 批准）：
// ?dev=1 默认全开；?dev=1&mech=real 按主线进度。① 新档 1-1：部曲 / 舆图 / 兵装 / 锦囊 / 机缘 / 四维 / 劝降 / 专职 / 合击 / 攻城都没开；
// ② 第一章通关后进 2-1：部曲 / 舆图 / 锦囊 / 军医 / 兵装 / 机缘开放，副将 / 四维 / 攻城 / 劝降 / 专职 / 合击未开，开打后播剧情引子卡；③ 不带 mech=real 全开。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-mechanic-rollout.mjs   截图在 assets/review/mechanic-rollout/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/mechanic-rollout'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const IDS = ['squad', 'atlas', 'jinnang', 'medic', 'gear', 'fortune', 'lieutenant', 'attributes', 'siege', 'parley', 'branch', 'combo'];
const fresh = { version: 10, yellowStages: 0, cleared: { huangjin: false, hulao: false }, worldAvailable: false, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'], tutorialDone: true };
const ch1done = { ...fresh, yellowStages: 3, cleared: { huangjin: true, hulao: false }, worldAvailable: true, nodes: ['home', 'huangjin', 'hulao'], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(world, q) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'full'); localStorage.setItem('im_home_seen', '1'); }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off' + q);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').elapsed > .3, null, { timeout: 120000 });
  return p;
}
const states = p => p.evaluate(async ids => { const M = await import('/src/data/mechanicUnlocks.ts'); M.mechRefresh(); return Object.fromEntries(ids.map(i => [i, M.mechOpen(i)])); }, IDS);

// ① 新档 1-1（按进度）
{
  const p = await open(fresh, '&mech=real');
  const st = await states(p);
  const sc = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.waveIndex = Math.max(1, s.waveIndex); s.openRecruit(); const mode = s.mode; s.player.growth.unallocated = 3; s.updateHud?.(); const m = s.children.getByName('battle-map-scroll');
    return { mode, scroll: m ? m.visible : null, bag: s.hudTexts.bag.visible, points: s.pointsButton?.visible ?? null, branch: s.needBranch() }; });
  await p.keyboard.press('KeyM'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__game.scene.getScene('GameScene').mode);
  ck('新档 1-1：所有后续玩法都没开（部曲 / 舆图在 1-2，其余更晚）', IDS.every(i => st[i] === false), st);
  ck('1-1：不弹战斗支援、舆图卷轴不显示且 M 无反应、行囊不显示、加点按钮不出', sc.mode === 'none' && sc.scroll !== true && !sc.bag && sc.points !== true && after === 'none', { ...sc, afterM: after });
  await p.close();
}
// ② 第一章通关 → 2-1（按进度）：开放 + 剧情引子卡
{
  const p = await open(ch1done, '&mech=real');
  const st = await states(p);
  ck('第一章通关后：部曲 / 舆图 / 锦囊 / 军医 / 兵装 / 机缘开放；副将（2-2）/ 四维（2-3）/ 攻城（第二章后）/ 劝降 / 专职（3-1）/ 合击（3-2）未开',
    ['squad', 'atlas', 'jinnang', 'medic', 'gear', 'fortune'].every(i => st[i]) && ['lieutenant', 'attributes', 'siege', 'parley', 'branch', 'combo'].every(i => !st[i]), st);
  await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 1 }); s0.scene.restart(); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter?.id === 'hulao' && s.elapsed > 3.6; }, null, { timeout: 120000 });
  await p.waitForTimeout(700);
  const log = await p.evaluate(() => window.__game.scene.getScene('GameScene').data.get('__storyBarkCardLog') ?? []);
  await p.screenshot({ path: OUT + '/unlock-card.png' });
  const seen = await p.evaluate(() => JSON.parse(localStorage.getItem('im_mech_seen') ?? '[]'));
  ck('2-1 开打：播剧情引子（张世平兵装 / 斥候机缘 / 诸葛亮锦囊…）并记已看；早开放的部曲 / 舆图静默记掉', /新玩法 · 兵装/.test(log.join('|')) && /张世平/.test(log.join('|')) && ['gear', 'fortune', 'jinnang', 'medic', 'squad', 'atlas'].every(i => seen.includes(i)) && !/新玩法 · 部曲/.test(log.join('|')), { log: log.slice(0, 8), seen });
  await p.close();
}
// ③ 开发期 ?dev=1 默认全开
{
  const p = await open(fresh, '');
  const st = await states(p);
  ck('?dev=1（不带 mech=real）：全部开放，测试不被锁', IDS.every(i => st[i]), st);
  await p.close();
}
ck('无报错', !errors.length, errors);
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
