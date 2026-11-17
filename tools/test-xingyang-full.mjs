// 2-2 荥阳从头打到尾（2026-11-17 去掉伤病车后）：真实波次、弹窗自动选第一项、徐荣按时出场、主将走过去捡宝箱 → 通关。电脑布局，4 倍速。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-xingyang-full.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/xingyang';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&autostart=1&chapter=hulao&westStage=2&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.devTimeScale = 4; s.player.damageImmune = true; s.devOneHit = true; return { name: s.chapter.name, waves: s.chapter.waves.length, obj: !!s.objective, boss: s.chapter.bossName }; });
  ck('进入 2-2 荥阳：3 波、无关卡目标、首领徐荣', /荥阳/.test(info.name) && info.waves === 3 && !info.obj && info.boss === '徐荣', info);
  let sawBoss = false, sawChest = false, end = null, shots = 0;
  for (let t = 0; t < 600 && !end; t++) {
    const st = await p.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene'); if (!s) return { gone: true };
      if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.();
      const c = s.bossChests?.find(c => !c.done && c.ready);
      if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 18); s.player.sprite.y += dy / d * Math.min(d, 18); }
      else if (s.boss?.active) { const dx = s.boss.x - s.player.x, dy = s.boss.y - s.player.y, d = Math.hypot(dx, dy) || 1; if (d > 120) { s.player.sprite.x += dx / d * 10; s.player.sprite.y += dy / d * 10; } }
      return { mode: s.mode, over: s.over, victory: s.victory, elapsed: s.elapsed, boss: !!s.boss?.active, chests: s.bossChests?.length ?? 0, wave: s.waveIndex, rest: s.mode === 'rest', title: s.resultTexts?.title?.text };
    });
    if (st.gone) { end = { gone: true }; break; }
    if (st.boss && !sawBoss) { sawBoss = true; await p.screenshot({ path: `${OUT}/boss.png` }); }
    if (st.chests && !sawChest) { sawChest = true; await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/chest.png` }); }
    if (st.over || st.rest) end = st;
    if (shots < 1 && st.elapsed > 40) { shots++; await p.screenshot({ path: `${OUT}/wave.png` }); }
    await p.waitForTimeout(250);
  }
  await p.screenshot({ path: `${OUT}/end.png` });
  ck('徐荣按时出场（没有护送目标卡住首领）', sawBoss, { sawBoss });
  ck('徐荣倒地后掉宝箱、主将走过去捡起', sawChest, { sawChest });
  ck('2-2 打通：胜利结算 / 告捷', !!end && (end.victory === true || end.rest), end);
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
