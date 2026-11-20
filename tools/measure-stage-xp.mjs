// 实测一关的关内经验与升级次数（level-curve-redesign.md，2026-11-20）：4 倍速、主将免伤、军功宝石全吸（=「捡满」上限），
// 三选一自动选第 1 张，首领出阵 60 秒（关内时间）后直接斩杀。记：关内经验 runXp、关末奖励经验（首通）、等级变化、每次升级的关内时刻。
// 用法：BASE=http://127.0.0.1:5241/ node tools/measure-stage-xp.mjs   （CASES=2-2,5-2 选关）
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const ALL = {
  '2-2': { key: 'GameScene', reg: {}, run: { chapter: 'hulao', westStage: 2 } },
  '3-2': { key: 'ThirdGameScene', reg: { thirdStage: 2 }, run: { thirdStage: 2 } },
  '5-2': { key: 'ChibiGameScene', reg: { chibiStage: 2 }, run: {} },
  '8-2': { key: 'HanzhongGameScene', reg: { hanzhongStage: 2 }, run: {} },
};
const CASES = (process.env.CASES ?? '2-2,5-2').split(',');
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of CASES) {
  const c = ALL[id]; if (!c) continue;
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); for (const [k, v] of Object.entries(st.reg)) s0.registry.set(k, v); s0.registry.set('runConfig', { character: 'zhaoyun', ...st.run }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, c);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > .5 && s.elapsed < 8; }, c.key, { timeout: 120000 });
  await p.evaluate(([k, process_onCurve]) => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; s.devTimeScale = 4; window.__lv = []; window.__ss = []; const sug = s.stageSuggestedLevel?.() ?? s.player.level; if (process_onCurve) { s.player.level = Math.max(1, sug - 1); s.player.xp = 0; s.player.xpNext = s.player.needFor ? s.player.needFor(s.player.level) : s.player.xpNext; s.heroLv = s.player.level; } window.__lv0 = s.player.level; window.__sug = sug; const o = s.onHeroLevelUp.bind(s); s.onHeroLevelUp = n => { window.__lv.push([+s.elapsed.toFixed(0), s.player.level]); return o(n); }; if (s.onSmallStep) { const o2 = s.onSmallStep.bind(s); s.onSmallStep = n => { window.__ss.push(+s.elapsed.toFixed(0)); return o2(n); }; } }, [c.key, process.env.ONCURVE !== '0']);
  let bossAt = -1;
  for (let i = 0; i < 700; i++) {
    const r = await p.evaluate(() => { const s = window.__S; s.gemMagnetUntil = 1e15; s.devTimeScale = 4; for (let k = 0; k < 12 && s.mode !== 'none' && !s.over; k++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } }
      return { t: s.elapsed, boss: !!s.boss?.active, killed: s.bossKilled, over: s.over }; });
    if (r.boss && bossAt < 0) bossAt = r.t;
    if (bossAt >= 0 && r.t - bossAt > 60 && r.boss) await p.evaluate(() => { const s = window.__S; s.boss.invulnerable = false; s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee', false, false); s.parley?.choose?.('execute'); });
    if (r.killed || r.over) break;
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(1500);
  const out = await p.evaluate(() => { const s = window.__S; return { t: Math.round(s.elapsed), lv0: window.__lv0, lv: s.player.level, runXp: Math.round(s.player.runXp), bonus: s.heroXpBonus, kills: s.kills, levelUps: window.__lv, small: window.__ss, sug: window.__sug, xpNext: s.player.xpNext }; });
  console.log(id, JSON.stringify({ ...out, bossAt: Math.round(bossAt) }));
  await p.close();
}
await b.close();
