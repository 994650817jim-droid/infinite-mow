// 三选一节奏测量：机器人自动打一章三关（赵云，免伤、自动走位捡经验球、三选一选第 1 张、招募直接关），
// 记录每关每次三选一的时刻（关内 分:秒）、来源（升级 / 军略）、是否与上一次连弹，以及关长。
// 用法：BASE=http://127.0.0.1:<端口>/ node tools/measure-levelup-pace.mjs [ch1 ch2 ch3 ch4] [--out=文件]
// 暂停时长按每次三选一平均思考 6 秒估算（DECIDE_SEC），机器人本身是瞬选。
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', DECIDE_SEC = 6;
const args = process.argv.slice(2), outArg = args.find(a => a.startsWith('--out='));
const want = args.filter(a => !a.startsWith('--')); const CH = want.length ? want : ['ch1', 'ch2', 'ch3', 'ch4'];
const out = outArg ? outArg.slice(6) : 'assets/review/levelup-pace/pace.json';
mkdirSync(out.replace(/[\\/][^\\/]*$/, ''), { recursive: true });
// 每章开打前的存档：已通关前面各章，武将从该章起始等级开打（每章打完约到上限：Lv10 / 15 / 20 / 25）
const W0 = { yellowStages: 0, dongzhuoStages: 0, warlordStages: 0, guanduStages: 0, worldAvailable: false, cleared: { huangjin: false, hulao: false }, provisions: 500 };
// 场景 chC-S：第 C 章第 S 关。前面的关都已打过，武将从该关大致的开打等级起（每章打完约到上限 Lv10 / 15 / 20 / 25）
const LV = { 1: [1, 5, 7], 2: [10, 12, 13], 3: [15, 16, 18], 4: [20, 21, 23] };
const SCEN = {};
for (const c of [1, 2, 3, 4]) for (const st of [1, 2, 3]) SCEN['ch' + c + '-' + st] = { c, st, level: LV[c][st - 1], world: {
  ...W0, yellowStages: c > 1 ? 3 : st - 1, dongzhuoStages: c > 2 ? 3 : c === 2 ? st - 1 : 0, warlordStages: c > 3 ? 3 : c === 3 ? st - 1 : 0, guanduStages: c === 4 ? st - 1 : 0,
  worldAvailable: c > 1, cleared: { huangjin: c > 1, hulao: c > 2 } } };
for (const c of [1, 2, 3, 4]) SCEN['ch' + c] = SCEN['ch' + c + '-1'];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const results = {};
const run = async ch => {
  const sc = SCEN[ch], p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(ch => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', ch); }, ch);
  await p.goto(base + '?layout=desktop', { timeout: 300000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(async ([lv, c, st, wv]) => {
    const h = await import('/src/systems/HeroProgress.ts'), w = await import('/src/world/WorldStore.ts');
    try { w.setTutorialSeen?.(); } catch { /* 旧版无此接口 */ }
    const sv = w.loadWorld(); Object.assign(sv, wv); sv.tutorialSeen = true; localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.removeItem('im_world_backup_v1');
    h.setHeroProgress('zhaoyun', lv, 0);
    const m = window.__game.scene.getScene('MenuScene');
    // 主页的「主公」提示框会挡住开打：先确认沿用
    const find = (l, n) => { for (const o of l) { if (o.name === n) return o; if (o.list) { const x = find(o.list, n); if (x) return x; } } };
    for (let i = 0; i < 3; i++) { const k = find(m.children.list, 'lord-keep'); if (!k) break; k.emit('pointerdown'); k.emit('pointerup'); await new Promise(r => setTimeout(r, 300)); }
    if (c === 1) m.pickChapter('huangjin', st); else if (c === 2) m.pickChapter('hulao', st);
    else if (c === 3) { m.registry.set('thirdStage', st); m.registry.set('runConfig', { character: 'zhaoyun' }); m.scene.start('ThirdGameScene'); }
    else m.pickChapter('guandu');
  }, [sc.level, sc.c, sc.st, sc.world]);
  if (sc.c === 4) { await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene'), null, { timeout: 60000 }); await p.waitForTimeout(800); await p.evaluate(st => { const g = window.__game.scene.getScene('GuanduChapterScene'); g.children.getByName('guandu-stage-' + st)?.emit('pointerdown'); g.children.getByName('guandu-deploy').emit('pointerup'); }, sc.st); }
  // 机器人：每 150ms 一拍
  const t0 = Date.now(); let done = false, stagesSeen = 0;
  while (!done && Date.now() - t0 < 30 * 60000) {
    await p.waitForTimeout(150);
    const st = await p.evaluate(() => {
      const g = window.__game, s = g.scene.getScenes(true).find(x => x.player && x.chapter); if (!s) return { none: true };
      if (!s.__bot) {
        s.__bot = true; const log = (window.__paceLog ??= { stages: {} }), rec = () => (log.stages[s.chapter.name] ??= { picks: [], start: Date.now(), lvStart: s.player.level, len: 0 });
        const choose = s.chooseUpgrade.bind(s); s.chooseUpgrade = (i) => { const r = rec(), mil = (s.militaryPending ?? 0) > 0; r.picks.push({ t: Math.round(s.elapsed), mil, lv: s.player.level }); return choose(i); };
        s.readMove = () => { const P = s.player, V = Phaser.Math.Vector2; const near = (list, max) => { let best = null, d0 = max; for (const o of list) { if (!o?.active) continue; const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < d0) { d0 = d; best = o; } } return best; };
          const chest = s.bossChests?.find(c => !c.done && c.snapshot?.().ready); if (chest) return new V(chest.x - P.x, chest.y - P.y).normalize();
          const gem = near(s.gems, 420); if (gem) return new V(gem.x - P.x, gem.y - P.y).normalize();
          const e = near(s.enemies.filter(e => !e.isSupplySlot), 2000); if (!e) return new V(0, 0); const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
          return d > 170 ? new V(dx / d, dy / d) : new V(-dy / d, dx / d); };
      }
      const P = s.player; if (P && !P.__inv) { P.__inv = true; P.takeDamage = () => false; }
      const r = (window.__paceLog.stages[s.chapter.name] ??= { picks: [], start: Date.now(), lvStart: P.level, len: 0 }); r.len = Math.max(r.len, Math.round(s.elapsed)); r.lvEnd = P.level;
      if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade(0);
      else if (s.mode === 'recruit') { s.recruitedWaves?.add(s.waveIndex); s.freeRecruit = false; s.pendingRecruit = false; s.resumePendingChoices?.(); if (s.mode === 'recruit') s.setMode('none'); }
      else if (s.mode === 'rest') { if (!s.__departAt) s.__departAt = Date.now() + 1500; else if (Date.now() > s.__departAt) { s.__departAt = 0; s.campUI?.root.getByName('camp-depart')?.emit('pointerdown'); } }
      else if (s.mode !== 'none' && s.mode !== 'result') { s.__DEV_ACTIONS?.closePopup?.(); }
      // 剧情 / 告捷弹窗：点确认
      for (const n of ['volunteers-confirm', 'story-merchant-horse-next', 'story-merchant-confirm']) { const f = l => { for (const o of l) { if (o.name === n) return o; if (o.list) { const x = f(o.list); if (x) return x; } } }; const o = f(s.children.list); if (o?.visible) { o.emit('pointerdown'); o.emit('pointerup'); } }
      return { stage: s.chapter.name, mode: s.mode, over: s.over, victory: s.victory, lv: P.level, el: Math.round(s.elapsed), stages: Object.keys(window.__paceLog.stages).length };
    }).catch(e => ({ err: String(e).slice(0, 200) }));
    if (st.none) continue;
    if (st.err) { errors.push(st.err); continue; }
    if (st.stages !== stagesSeen) { stagesSeen = st.stages; console.log(ch, '→', st.stage, 'Lv', st.lv); }
    if (st.mode === 'result' || (st.over && st.victory !== undefined)) done = true;
    // 离开战斗场景（第一章告捷进地图等）也算结束
    if (await p.evaluate(() => !window.__game.scene.getScenes(true).some(x => x.player && x.chapter))) { await p.waitForTimeout(1500); if (await p.evaluate(() => !window.__game.scene.getScenes(true).some(x => x.player && x.chapter))) done = true; }
  }
  const log = await p.evaluate(() => window.__paceLog);
  results[ch] = { level: sc.level, stages: log?.stages ?? {}, errors: errors.slice(0, 5), minutes: Math.round((Date.now() - t0) / 6000) / 10 };
  await p.close();
};
// 冷启动的开发服务器同时开 4 页会超时：错开 25 秒
// 最多 4 页同时跑（机器内存有限），开页错开 20 秒防冷启动超时
const queue = [...CH]; await Promise.all([0, 1, 2, 3].map(async k => { await new Promise(r => setTimeout(r, k * 20000)); while (queue.length) await run(queue.shift()); }));
await b.close();
// 汇总
const mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const rows = [];
for (const ch of CH) for (const [k, [name, r]] of Object.entries(results[ch].stages).entries()) {
  const ts = r.picks.map(x => x.t), gaps = ts.slice(1).map((t, i) => t - ts[i]), burst = gaps.filter(g => g <= 1).length;
  rows.push({ ch, chained: k > 0, stage: name, len: r.len, lv: `${r.lvStart}→${r.lvEnd}`, picks: r.picks.length, mil: r.picks.filter(x => x.mil).length, burst, minGap: gaps.filter(g => g > 1).length ? Math.min(...gaps.filter(g => g > 1)) : null, times: ts.map(mmss).join(' '), pauseSec: r.picks.length * DECIDE_SEC, pausePct: r.len ? Math.round(r.picks.length * DECIDE_SEC / (r.len + r.picks.length * DECIDE_SEC) * 100) : 0 });
}
writeFileSync(out, JSON.stringify({ rows, results }, null, 2));
console.log('\n（「接续」= 机器人没在 90 秒内打掉首领、战线推进到下一关后继续记录的那段）\n| 场景 | 关 | 关长 | 武将等级 | 三选一 | 其中军略 | 连弹 | 最短间隔(秒) | 时刻 | 估计暂停 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.ch}${r.chained ? ' 接续' : ''} | ${r.stage} | ${mmss(r.len)} | ${r.lv} | ${r.picks} | ${r.mil} | ${r.burst} | ${r.minGap ?? '—'} | ${r.times} | ${r.pauseSec}s（${r.pausePct}%）|`);
for (const ch of CH) if (results[ch].errors.length) console.log(ch, 'errors', results[ch].errors);
