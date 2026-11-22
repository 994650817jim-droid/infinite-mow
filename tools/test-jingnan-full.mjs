// 第六章 平定荆南冒烟：三关从头打到尾（4 倍速、真实波次、弹窗自动选、主将走过去捡宝箱），测劝降 / 斩杀、长沙先黄忠后韩玄、章头章末剧情。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-jingnan-full.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/jingnan';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('JingnanGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // 章节选关 + 章头剧情
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { localStorage.removeItem('im_story_jingnan_open_v1'); window.__game.scene.getScene('MenuScene').scene.start('JingnanChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('JingnanChapterScene'), null, { timeout: 90000 }); await p.waitForTimeout(800);
  const open = await p.evaluate(() => !!window.__game.scene.getScene('JingnanChapterScene').children.getByName('story-jingnan-open'));
  await p.screenshot({ path: `${OUT}/chapter-open.png` });
  ck('章节选关：第六章三关 + 章头剧情卷轴', open, { open });
  // 三关：1 劝降赵范，2 斩杀刘度，3 劝降黄忠 → 斩杀韩玄
  const plan = { 1: ['persuade'], 2: ['execute'], 3: ['persuade', 'execute'] };
  for (const stage of [1, 2, 3]) {
    await p.evaluate(st => { const g = window.__game; g.registry.set('jingnanStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); g.registry.remove('jingnanTransfer'); const cur = g.scene.getScene('JingnanGameScene'); if (cur && g.scene.isActive('JingnanGameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('JingnanGameScene'); } }, stage); await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
    const info = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 4; s.player.damageImmune = true; return { name: s.chapter.name, boss: s.chapter.bossName }; }, S);
    ck(`6-${stage}：进入 ${info.name}`, info.name.startsWith('6-' + stage), info);
    const choices = [...plan[stage]]; let sawEnd = false, parleys = 0, chest = false, end = null, sawBosses = [];
    // 按墙钟给 7 分钟（原 900 拍 ≈ 3~4 分钟：机器忙时帧率低、游戏时间走得慢，6-1 等赵范出阵 + 劝降收尾要约 300 游戏秒，主工作区并发跑时 900 拍不够，见共享笔记 chapter-softlock-1122.md）
    const deadline = Date.now() + 420000;
    for (let t = 0; Date.now() < deadline && !end; t++) {
      const st = await p.evaluate(S0 => {
        const s = eval(S0); if (!s) return { gone: true };
        if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.();
        const end = s.children.getByName('story-jingnan-end'); if (end && s.__endShot) { const btn = end.list.find(o => o.name === 'story-jingnan-end-next' || o.name === 'story-jingnan-end-confirm'); btn?.emit('pointerup'); }
        const c = s.bossChests?.find(c => !c.done && c.ready);
        if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 18); s.player.sprite.y += dy / d * Math.min(d, 18); }
        else if (s.boss?.active) { const dx = s.boss.x - s.player.x, dy = s.boss.y - s.player.y, d = Math.hypot(dx, dy) || 1; if (d > 120) { s.player.sprite.x += dx / d * 10; s.player.sprite.y += dy / d * 10; } s.boss.hp -= s.boss.maxHp * .01; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); }
        const j = s.snapshotJingnan();
        return { mode: s.mode, over: s.over, victory: s.victory, rest: s.mode === 'rest', boss: s.boss?.active ? s.chapter.bossName : null, parley: j.parley, panel: !!s.children.getByName('parley-panel'), chests: s.bossChests?.length ?? 0, endStory: !!end, j };
      }, S);
      if (st.gone) { end = { gone: true }; break; }
      if (st.boss && !sawBosses.includes(st.boss)) sawBosses.push(st.boss);
      if (st.panel) { parleys++; await p.screenshot({ path: `${OUT}/stage${stage}-parley${parleys}.png` }); const c = choices.shift() ?? 'execute'; await p.evaluate(([S0, c]) => eval(S0).choose(c), [S, c]); }
      if (st.chests && !chest) { chest = true; }
      if (st.endStory && !sawEnd) { sawEnd = true; await p.screenshot({ path: `${OUT}/chapter-end-story.png` }); await p.evaluate(S0 => { eval(S0).__endShot = true; }, S); }
      if (st.over || st.rest) end = st;
      await p.waitForTimeout(200);
    }
    const j = end?.j ?? {};
    if (stage === 1) ck('6-1：赵范残血弹「劝降 / 斩杀」，劝降后归降离场、关卡告捷', parleys === 1 && j.persuaded?.includes('赵范') && (end.victory || end.rest), { parleys, end });
    if (stage === 2) ck('6-2：刘度选斩杀 → 倒地掉宝箱 → 捡完告捷', parleys === 1 && j.executed?.includes('刘度') && chest && (end.victory || end.rest), { parleys, chest, end });
    if (stage === 3) {
      ck('6-3：先战黄忠（劝降）→ 韩玄出阵', sawBosses.includes('黄忠') && sawBosses.includes('韩玄') && j.persuaded?.includes('黄忠'), { sawBosses, j });
      // 2026-11-18 章末卷轴并进剧情系统（data/story/jingnan.ts）：测试默认不播剧情，章末抉择按默认写 weiyan_trust；播剧情时仍会看到章末卷轴
      const trust = await p.evaluate(() => JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.weiyan_trust ?? null);
      ck('6-3：韩玄不可劝降（只弹一次，为黄忠）、斩杀后宝箱 → 章末剧情（或剧情关闭时按默认写 weiyan_trust）→ 平定荆南告捷', parleys === 1 && chest && (sawEnd || trust === 'trusted') && end?.victory === true, { parleys, chest, sawEnd, trust, end });
    }
    await p.screenshot({ path: `${OUT}/stage${stage}-end.png` });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
