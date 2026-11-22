// 第八章 汉中之战冒烟：章头剧情 → 三关从头打到尾（4 倍速、真实波次、弹窗自动选、走过去捡宝箱）；
// 测夺高地（占领后伤害 / 射程提高、敌军反夺）、定军山黄忠斩夏侯渊加成、汉水曹操「鸡肋」两阶段与章末剧情。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-hanzhong-full.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/hanzhong';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('HanzhongGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { localStorage.removeItem('im_story_hanzhong_open_v1'); window.__game.scene.getScene('MenuScene').scene.start('HanzhongChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('HanzhongChapterScene'), null, { timeout: 90000 }); await p.waitForTimeout(800);
  ck('章节选关：第八章 + 章头剧情卷轴', await p.evaluate(() => !!window.__game.scene.getScene('HanzhongChapterScene').children.getByName('story-hanzhong-open')));
  await p.screenshot({ path: `${OUT}/chapter-open.png` });
  for (const stage of [1, 2, 3]) {
    const hero = stage === 2 ? 'huangzhong' : 'zhaoyun';
    await p.evaluate(([st, hero]) => { const g = window.__game; g.registry.set('hanzhongStage', st); g.registry.set('runConfig', { character: hero, thirdStage: st }); g.registry.remove('hanzhongTransfer'); const cur = g.scene.getScene('HanzhongGameScene'); if (cur && g.scene.isActive('HanzhongGameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('HanzhongGameScene'); } }, [stage, hero]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.hills; }, S, { timeout: 90000 }); await p.waitForTimeout(1000);
    const info = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 4; s.player.damageImmune = true; return { name: s.chapter.name, boss: s.chapter.bossName, hills: s.hills.hills.length, dmg: s.player.stats.damageMul }; }, S);
    ck(`8-${stage}：进入 ${info.name}，${info.hills} 处山头`, info.name.startsWith('8-' + stage) && info.hills === (stage === 1 ? 1 : 2), info);
    // 走上第一座山头读条
    let cap = null;
    for (let t = 0; t < 60 && !cap; t++) {
      const st = await p.evaluate(S0 => { const s = eval(S0); if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - s.hills.hills[0].x, e.y - s.hills.hills[0].y) < 140) e.deactivate(); const h = s.hills.hills[0]; s.player.sprite.setPosition(h.x, h.y); return { held: s.hills.held, dmg: s.player.stats.damageMul, range: s.legion.rangeMul }; }, S);
      if (st.held >= 1) cap = st; await p.waitForTimeout(200);
    }
    await p.screenshot({ path: `${OUT}/stage${stage}-hill.png` });
    ck(`8-${stage}：站上山头读条占领 → 伤害、射程 +20%`, cap && cap.dmg > info.dmg * 1.19 && cap.range > 1.19, { cap, before: info.dmg });
    let chest = false, end = null, sawEnd = false, bossSeen = false, hz = null;
    const deadline = Date.now() + 420000; // 按墙钟给 7 分钟（原 900 拍，机器忙时不够）
    for (let t = 0; Date.now() < deadline && !end; t++) {
      const st = await p.evaluate(S0 => {
        const s = eval(S0); if (!s) return { gone: true };
        if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.();
        // 残血劝降面板（宁死不降的也弹，只有「斩杀」可按）：游戏停在 mode 'parley' 等玩家点，这里按斩杀（2026-11-22：原脚本不点，8-2 夏侯渊 / 10-1 孙桓卡在面板上）
        if (s.children.getByName('parley-panel')) s.choose('execute');
        const end = s.children.getByName('story-hanzhong-end'); if (end && s.__endShot) (end.list.find(o => o.name === 'story-hanzhong-end-next' || o.name === 'story-hanzhong-end-confirm'))?.emit('pointerup');
        const c = s.bossChests?.find(c => !c.done && c.ready);
        if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 18); s.player.sprite.y += dy / d * Math.min(d, 18); }
        else if (s.boss?.active) { s.boss.hp -= s.boss.maxHp * .012; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); }
        else if (!s.bossSpawned) { s.devSetTime?.(Math.max(s.elapsed, 999)); }
        const j = s.snapshotHanzhong();
        return { over: s.over, victory: s.victory, rest: s.mode === 'rest', boss: !!s.boss?.active, chests: s.bossChests?.length ?? 0, endStory: !!end, j };
      }, S);
      if (st.gone) { end = { gone: true }; break; }
      if (st.boss) bossSeen = true;
      if (st.chests) chest = true;
      if (hz === null && st.boss && stage === 2) hz = await p.evaluate(S0 => { const s = eval(S0), hit = () => { const hp = s.boss.hp; s.hitEnemy(s.boss, 100, s.combatNow, 'melee', false, false); return hp - s.boss.hp; }; const team = s.huangzhongInTeam, on = hit(); Object.defineProperty(s, 'huangzhongInTeam', { value: false, configurable: true }); const off = hit(); delete s.huangzhongInTeam; return { team, on, off, ratio: +(on / off).toFixed(2) }; }, S);
      if (st.endStory && !sawEnd) { sawEnd = true; await p.screenshot({ path: `${OUT}/chapter-end-story.png` }); await p.evaluate(S0 => { eval(S0).__endShot = true; }, S); }
      if (st.over || st.rest) end = st;
      await p.waitForTimeout(200);
    }
    ck(`8-${stage}：首领出阵 → 倒地掉宝箱 → 捡完告捷`, bossSeen && chest && end && (end.victory || end.rest), { bossSeen, chest, end });
    if (stage === 2) ck('8-2：黄忠在队，夏侯渊受到的伤害提高（×1.5）', hz && hz.team && hz.ratio > 1.4 && hz.ratio < 1.6, hz);
    if (stage === 3) ck('8-3：曹操半血「鸡肋」转场、章末剧情 → 汉中之战告捷', end?.j?.jilei && sawEnd && end?.victory === true, { end, sawEnd });
    await p.screenshot({ path: `${OUT}/stage${stage}-end.png` });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
