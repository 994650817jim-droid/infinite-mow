// 第十二章 北伐（最终章）冒烟：章头剧情 → 三关打到底（4 倍速、真实波次、弹窗自动选、走过去捡宝箱）→ 结局卷轴 → 麒麟阁编年史。
// 测街亭汲水点（占住 / 断水掉血）、陈仓城门未破郝昭不出城 + 箭楼箭雨、五丈原司马懿三阶段（营垒减伤 → 出营三招 → 天象异变陨星）、结局分支。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-beifa-full.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/beifa';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('BeifaGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const tick = async (p, fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
/** 等待期间每 200ms 关一次升级 / 招募弹窗（弹窗会冻结战斗时钟）。 */
const wait = async (p, ms) => { for (let t = 0; t < ms; t += 200) { await tick(p, () => 0); await p.waitForTimeout(200); } };
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  // 结局判定与文字（纯函数）
  const end = await p.evaluate(async () => { const m = await import('/src/scenes/EndingScene.ts'); return { u: m.endingKind(20, 32), t: m.endingKind(5, 32), lb: m.endingLines('unify', 'liubei', 20, 32).title, zy: m.endingLines('unify', 'zhaoyun', 20, 32).lines.map(l => l.text).join('|') }; });
  ck('结局判定：占城过半天下一统、否则三分；主公不是刘备时改写', end.u === 'unify' && end.t === 'tripartite' && end.lb === '汉室复兴' && end.zy.includes('赵云') && !end.zy.includes('兴复汉室'), end);
  await p.evaluate(() => { localStorage.removeItem('im_story_beifa_open_v1'); window.__game.scene.getScene('MenuScene').scene.start('BeifaChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('BeifaChapterScene'), null, { timeout: 90000 }); await wait(p, 800);
  ck('章节选关：第十二章 + 章头剧情卷轴（出师表）', await p.evaluate(() => !!window.__game.scene.getScene('BeifaChapterScene').children.getByName('story-beifa-open')));
  await p.screenshot({ path: `${OUT}/chapter-open.png` });
  for (const stage of [1, 2, 3]) {
    await p.evaluate(([st]) => { const g = window.__game; g.registry.set('beifaStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); g.registry.remove('beifaTransfer'); const cur = g.scene.getScene('BeifaGameScene'); if (cur && g.scene.isActive('BeifaGameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('BeifaGameScene'); } }, [stage]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.strikes; }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
    const info = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 4; s.player.damageImmune = true; return { name: s.chapter.name, boss: s.chapter.bossName, y: s.snapshotBeifa() }; }, S);
    ck(`12-${stage}：进入 ${info.name}（${info.boss}）`, info.name.startsWith('12-' + stage), info);
    if (stage === 1) {
      let cap = null;
      for (let i = 0; i < 40 && !cap; i++) { cap = await tick(p, s => { const w = s.water.springs[0]; s.player.sprite.setPosition(w.x, w.y); return s.water.held >= 1 ? s.water.snapshot() : null; }); await p.waitForTimeout(200); }
      ck('12-1：站上汲水点读条占住', cap?.held >= 1, cap);
      await tick(p, s => { for (const w of s.water.springs) { w.owner = 'none'; w.take = 0; } s.water.graceUntil = 0; s.player.sprite.setPosition(s.player.x + 600, s.player.y + 400); s.player.damageImmune = false; s.devTimeScale = 1; });
      await wait(p, 2600);
      const dry = await tick(p, s => { s.player.damageImmune = true; s.devTimeScale = 4; return { ...s.water.snapshot(), hp: s.player.hp, max: s.player.maxHp }; });
      await p.screenshot({ path: `${OUT}/stage1-water.png` });
      ck('12-1：一处汲水点都没有 → 断水，主将掉血', dry.dry && dry.metrics.drainTicks > 0 && dry.hp < dry.max, dry);
    }
    if (stage === 2) {
      const s0 = await tick(p, s => s.snapshotBeifa().siege);
      ck('12-2：陈仓城门 + 两座箭楼', s0?.gate && s0.towers === 2, s0);
      await tick(p, s => { s.devSetTime?.(s.chapter.waves[s.chapter.waves.length - 1].start + 1); });
      await wait(p, 3000);
      const s1 = await tick(p, s => ({ boss: !!s.boss?.active, ...s.snapshotBeifa().siege, fired: s.strikes.metrics.fired }));
      await p.screenshot({ path: `${OUT}/stage2-siege.png` });
      ck('12-2：城门未破郝昭不出城；箭楼放箭雨', !s1.boss && s1.gate && s1.metrics.volleys > 0, s1);
      await tick(p, s => { s.siege.gate.deactivate(); });
      await wait(p, 800);
      ck('12-2：城门一破，郝昭出城', await tick(p, s => !!s.boss?.active), null);
    }
    if (stage === 3) {
      await tick(p, s => { s.devSetTime?.(999); });
      for (let i = 0; i < 150 && !(await tick(p, s => !!s.simayi)); i++) await p.waitForTimeout(200);
      const h0 = await tick(p, s => { const b = s.boss, hp = b.hp; s.hitEnemy(b, 100, s.combatNow, 'melee', false, false); return { ...s.simayi.snapshot(), lost: hp - b.hp }; });
      await wait(p, 2500);
      const h1 = await tick(p, s => s.simayi.snapshot());
      await p.screenshot({ path: `${OUT}/stage3-hold.png` });
      ck('12-3 ①：司马懿坚守不出——营垒 4 座、几乎不受伤、伏兵箭阵落下', h0.phase === 'hold' && h0.forts === 4 && h0.lost < 30 && h1.metrics.volleys > 0, { h0, h1 });
      await tick(p, s => { for (const f of s.simayi.forts) if (f.active) s.supplies.breakEnv(f); });
      await wait(p, 1500);
      const b0 = await tick(p, s => s.simayi.snapshot());
      ck('12-3 ②：营垒尽破 → 出营决战', b0.phase === 'battle', b0);
      for (const i of [0, 1, 2]) { await tick(p, (s, k) => { s.simayi.debug.force(k, s.combatNow); }, i); await wait(p, 2600); }
      const b1 = await tick(p, s => s.simayi.snapshot());
      await p.screenshot({ path: `${OUT}/stage3-battle.png` });
      ck('12-3 ②：调兵合围 / 假退诱敌 / 落雷阵都放出', b1.metrics.surround > 0 && b1.metrics.feint > 0 && b1.metrics.thunder > 0 && b1.strikes.fired > 0, b1);
      await tick(p, s => { s.boss.hp = s.boss.maxHp * .3; });
      await wait(p, 4500);
      const c1 = await tick(p, s => s.simayi.snapshot());
      await p.screenshot({ path: `${OUT}/stage3-omen.png` });
      ck('12-3 ③：天象异变——夜空、将星坠落（陨星）', c1.phase === 'omen' && c1.night && c1.metrics.meteors > 0, c1);
    }
    let chest = false, fin = null, sawEnd = false, bossSeen = false;
    for (let t = 0; t < 900 && !fin; t++) {
      const st = await p.evaluate(S0 => {
        const s = eval(S0); if (!s || !s.scene.isActive()) return { gone: true, ending: window.__game.scene.isActive('EndingScene') };
        if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.();
        if (s.mode === 'parley' && s.parley?.choose) s.parley.choose('execute'); // 首领 15% 劝降弹窗（surrender）：选斩杀，照原流程倒地掉宝箱
        const end = s.children.getByName('story-beifa-end'); if (end && s.__endShot) (end.list.find(o => o.name === 'story-beifa-end-next' || o.name === 'story-beifa-end-confirm'))?.emit('pointerup');
        const c = s.bossChests?.find(c => !c.done && c.ready);
        if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 18); s.player.sprite.y += dy / d * Math.min(d, 18); }
        else if (s.boss?.active) { for (const f of s.simayi?.forts ?? []) if (f.active) s.supplies.breakEnv(f); s.boss.hp -= s.boss.maxHp * .012; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); }
        else if (!s.bossSpawned) { if (s.siege?.gateAlive) s.siege.gate.deactivate(); s.devSetTime?.(Math.max(s.elapsed, 999)); }
        return { over: s.over, victory: s.victory, rest: s.mode === 'rest', boss: !!s.boss?.active, chests: s.bossChests?.length ?? 0, endStory: !!end };
      }, S);
      if (st.gone) { fin = st; break; }
      if (st.boss) bossSeen = true;
      if (st.chests) chest = true;
      if (st.endStory && !sawEnd) { sawEnd = true; await p.screenshot({ path: `${OUT}/chapter-end-story.png` }); await p.evaluate(S0 => { eval(S0).__endShot = true; }, S); }
      if ((st.over || st.rest) && stage < 3) fin = st;
      if (stage === 3 && st.over && st.victory) { fin = st; }
      await p.waitForTimeout(200);
    }
    ck(`12-${stage}：首领出阵 → 倒地掉宝箱 → 捡完告捷`, bossSeen && chest && fin && (fin.victory || fin.rest || fin.gone), { bossSeen, chest, fin });
    await p.screenshot({ path: `${OUT}/stage${stage}-end.png` });
    if (stage === 3) {
      ck('12-3：章末剧情（五丈原）', sawEnd, { sawEnd });
      await p.waitForFunction(() => window.__game.scene.isActive('EndingScene'), null, { timeout: 30000 }).catch(() => {});
      await wait(p, 800);
      const e1 = await p.evaluate(() => { const s = window.__game.scene.getScene('EndingScene'); return { active: window.__game.scene.isActive('EndingScene'), story: !!s?.children.getByName('ending-story'), kind: s?.kind }; });
      await p.screenshot({ path: `${OUT}/ending-story.png` });
      ck('结局：打赢五丈原 → 结局画卷（2026-11-21 重做：ending-story）', e1.active && e1.story, e1);
      await p.evaluate(() => { const s = window.__game.scene.getScene('EndingScene'); for (let i = 0; i < 3 && s.screen === 'story'; i++) s.children.getByName('ending-story')?.list.find(o => o.name === 'ending-continue')?.emit('pointerup'); }); // 第一次点先显出全部字，第二次进麒麟阁
      await p.waitForTimeout(600);
      const e2 = await p.evaluate(() => { const s = window.__game.scene.getScene('EndingScene'), pav = s.children.getByName('ending-pavilion'); return { pav: !!pav, rows: pav ? pav.list.filter(o => o.name?.startsWith('ending-chapter-')).length : 0 }; });
      await p.screenshot({ path: `${OUT}/ending-pavilion.png` });
      ck('结局：麒麟阁长卷（十二章逐章竖排）', e2.pav && e2.rows >= 10, e2);
      await p.keyboard.press('Escape'); await p.waitForTimeout(600);
      const e3 = await p.evaluate(() => { const s = window.__game.scene.getScene('EndingScene'); return { screen: s.screen, ret: !!s.children.getByName('ending-finale')?.list.find(o => o.name === 'ending-return') }; });
      ck('结局：Esc 跳到收尾一屏（感谢游玩 · 回到天下）', e3.screen === 'finale' && e3.ret, e3);
    }
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
