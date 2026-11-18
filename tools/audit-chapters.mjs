// 全游戏缺口审计（2026-11-17，统筹）：12 章各打一关（默认第 1 关，可 --stage 3）走完「波次 → 首领 → 宝箱 → 结算」，看流程接不接得上。
// 主将无敌 + 秒杀（dev 面板同款 devOneHit），只验流程不验难度；同时记 FPS、页面错误、卡住（60 秒游戏时间没进展）。
// 另有 --fps：不秒杀、1 倍速、自然刷怪跑 --secs 秒，只量帧率（重关卡用）。
// 用法：BASE=http://127.0.0.1:5195/ node tools/audit-chapters.mjs [--chapters 1,2,…] [--stage 1] [--fps] [--secs 40] [--hero guanyu]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', stage = Number(arg('stage', 1)), fpsMode = args.includes('--fps'), secs = Number(arg('secs', 40)), hero = arg('hero', 'guanyu');
const CH = {
  1: { name: '黄巾', key: 'GameScene', cfg: s => ({ chapter: 'huangjin', stage: s }) },
  2: { name: '讨董', key: 'GameScene', cfg: s => ({ chapter: 'hulao', westStage: s }) },
  3: { name: '群雄', key: 'ThirdGameScene', reg: 'thirdStage' },
  4: { name: '官渡', key: 'GuanduGameScene', reg: 'guanduStage' },
  5: { name: '赤壁', key: 'ChibiGameScene', reg: 'chibiStage' },
  6: { name: '荆南', key: 'JingnanGameScene', reg: 'jingnanStage' },
  7: { name: '入蜀', key: 'ShuGameScene', reg: 'shuStage' },
  8: { name: '汉中', key: 'HanzhongGameScene', reg: 'hanzhongStage' },
  9: { name: '襄樊', key: 'XiangfanGameScene', reg: 'xiangfanStage' },
  10: { name: '夷陵', key: 'YilingGameScene', reg: 'yilingStage' },
  11: { name: '南征', key: 'NanzhengGameScene', reg: 'nanzhengStage' },
  12: { name: '北伐', key: 'BeifaGameScene', reg: 'beifaStage' },
  // 攻城（大城）：--chapters 101 = 洛阳、102 = 成都、103 = 邺城；小城 104 = 许都外的随便一座见 WorldCities
  101: { name: '攻城洛阳', key: 'SiegeGameScene', siege: 'luoyang' }, 102: { name: '攻城成都', key: 'SiegeGameScene', siege: 'chengdu' }, 103: { name: '攻城邺城', key: 'SiegeGameScene', siege: 'ye' },
};
const chapters = arg('chapters', '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number);
const out = 'assets/review/audit'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const rows = [];
for (const n of chapters) {
  const C = CH[n], p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text().slice(0, 160)); });
  const t0 = Date.now(); let r;
  try {
    await p.addInitScript(h => { try { localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 3, heroes: { [h]: { level: 20, xp: 0, attributes: { strength: 10, agility: 9, intellect: 0, command: 0 } } } })); } catch {} }, hero);
    await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 90000 });
    await p.evaluate(([C, h, st]) => {
      const s0 = window.__game.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
      const cfg = C.siege ? (s0.registry.set('siegeCity', C.siege), {}) : C.reg ? (s0.registry.set(C.reg, st), C.reg === 'guanduStage' ? {} : { thirdStage: st }) : C.cfgv;
      s0.registry.set('runConfig', { character: h, ...cfg }); s0.scene.start(C.key);
    }, [{ ...C, cfgv: C.cfg?.(stage) }, hero, stage]);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 5; }, C.key, { timeout: 90000 });
    await p.waitForTimeout(800);
    r = await p.evaluate(async ([key, fpsMode, secs]) => {
      const s = window.__game.scene.getScene(key), pl = s.player, B = { fps: [], stuck: false, modes: {} };
      pl.damageImmune = true; if (!fpsMode) s.devOneHit = true;
      s.devTimeScale = fpsMode ? 1 : 4;
      const tStart = performance.now(), wallMax = fpsMode ? secs * 1000 + 5000 : 240000;
      let lastProgress = s.elapsed, lastKills = s.kills, lastChange = performance.now(), a = 0, bossAt = null, bossKilledAt = null;
      while (performance.now() - tStart < wallMax) {
        if (s.over) break;
        B.modes[s.mode] = (B.modes[s.mode] ?? 0) + 1;
        if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0);
        else if (s.mode === 'recruit') { s.chooseRecruit?.(0); if (s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); }
        else if (s.mode !== 'none') { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); }
        if (s.awaitingChest) s.collectBossChests?.();
        if (s.bossSpawned && bossAt === null) bossAt = s.elapsed;
        if (s.bossKilled && bossKilledAt === null) bossKilledAt = s.elapsed;
        // 走位：绕最近敌人 / 首领转圈
        let tgt = s.boss?.active ? s.boss : null, best = 1e9; if (!tgt) for (const e of s.enemies) if (e.active) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < best) { best = d; tgt = e; } }
        if (tgt) { a += .15; const tx = tgt.x + Math.cos(a) * 90, ty = tgt.y + Math.sin(a) * 90, dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy) || 1; window.__IM.setMove(dx / d, dy / d); } else window.__IM.setMove(Math.cos(a += .05) * .5, Math.sin(a) * .5);
        if (s.mode === 'none') B.fps.push(s.game.loop.actualFps);
        if (s.elapsed !== lastProgress || s.kills !== lastKills) { if (s.kills !== lastKills || Math.abs(s.elapsed - lastProgress) > .5) lastChange = performance.now(); lastProgress = s.elapsed; lastKills = s.kills; }
        if (!fpsMode && performance.now() - lastChange > 45000) { B.stuck = true; break; }
        if (fpsMode && performance.now() - tStart > secs * 1000) break;
        await new Promise(r => setTimeout(r, 150));
      }
      window.__IM.setMove(0, 0);
      const f = B.fps.slice(5).sort((x, y) => x - y), avg = f.length ? f.reduce((x, y) => x + y, 0) / f.length : 0;
      return { over: s.over, victory: s.victory, bossName: s.chapter?.bossName, bossAt, bossKilledAt, elapsed: s.elapsed, kills: s.kills, stuck: B.stuck, mode: s.mode,
        fpsAvg: +avg.toFixed(0), fpsP5: f.length ? +f[Math.floor(f.length * .05)].toFixed(0) : 0, enemiesMax: s.enemies.filter(e => e.active).length, waves: s.chapter?.waves?.length, stageName: s.chapter?.name };
    }, [C.key, fpsMode, secs]);
    await p.screenshot({ path: `${out}/ch${n}-s${stage}${fpsMode ? '-fps' : ''}.png` });
  } catch (e) { r = { error: e.message.split('\n')[0].slice(0, 200) }; }
  const row = { ch: n, name: C.name, stage, wall: Math.round((Date.now() - t0) / 1000), ...r, errors: [...new Set(errors)].slice(0, 4) };
  rows.push(row);
  console.log(fpsMode
    ? `${n} ${C.name} ${stage} ${row.stageName ?? ''}：FPS 平均 ${row.fpsAvg} / 5% 低 ${row.fpsP5}${row.error ? ' 错误 ' + row.error : ''}${row.errors.length ? ' 页面错误 ' + row.errors[0] : ''}`
    : `${n} ${C.name} ${stage} ${row.stageName ?? ''}（${row.bossName ?? '?'}）：${row.error ? '打不开 ' + row.error : row.over ? (row.victory ? '通关' : '失败') : row.stuck ? '卡住(' + row.mode + ')' : '超时(' + row.mode + ')'} · 首领 ${row.bossAt?.toFixed?.(0) ?? '—'}s 登场 / ${row.bossKilledAt?.toFixed?.(0) ?? '—'}s 倒下 · 用时 ${row.elapsed?.toFixed?.(0)}s · FPS ${row.fpsAvg}/${row.fpsP5} · 墙钟 ${row.wall}s${row.errors.length ? ' · 页面错误 ' + row.errors.join(' | ') : ''}`);
  await p.close();
}
writeFileSync(`${out}/chapters-s${stage}${fpsMode ? '-fps' : ''}.json`, JSON.stringify(rows, null, 1));
await b.close();
