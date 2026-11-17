// 第十章 夷陵之战冒烟：章头剧情 → 三关从头打到尾（4 倍速、真实波次、弹窗自动选、走过去捡宝箱）；
// 测猇亭军旗、连营拆营帐（营帐尽破朱然提前出营）、火烧连营（风向预警 → 起火 → 顺风蔓延 → 烧到主将与我军营帐）、陆逊半血火烧连营与章末剧情。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-yiling-full.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/yiling';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('YilingGameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { localStorage.removeItem('im_story_yiling_open_v1'); window.__game.scene.getScene('MenuScene').scene.start('YilingChapterScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('YilingChapterScene'), null, { timeout: 90000 }); await p.waitForTimeout(800);
  ck('章节选关：第十章 + 章头剧情卷轴', await p.evaluate(() => !!window.__game.scene.getScene('YilingChapterScene').children.getByName('story-yiling-open')));
  await p.screenshot({ path: `${OUT}/chapter-open.png` });
  for (const stage of [1, 2, 3]) {
    await p.evaluate(([st]) => { const g = window.__game; g.registry.set('yilingStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); g.registry.remove('yilingTransfer'); const cur = g.scene.getScene('YilingGameScene'); if (cur && g.scene.isActive('YilingGameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); } }, [stage]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.env; }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
    const info = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 4; s.player.damageImmune = true; return { name: s.chapter.name, boss: s.chapter.bossName, y: s.snapshotYiling() }; }, S);
    ck(`10-${stage}：进入 ${info.name}（${info.boss}）`, info.name.startsWith('10-' + stage) && info.y.camps === [0, 6, 12][stage - 1], info);
    let early = null;
    if (stage === 2) {
      // 拆营：逐顶打破（走 BattlefieldSupplies 的打破通路），营帐尽破 → 朱然提前出营
      for (let i = 0; i < 8 && !early; i++) {
        early = await p.evaluate(S0 => { const s = eval(S0); if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); const t = s.env.tents()[0]; if (t) { s.player.sprite.setPosition(t.x, t.y + 90); s.supplies.breakEnv(t); } const y = s.snapshotYiling(); return y.campsDown >= y.camps && s.boss?.active ? { ...y, elapsed: s.elapsed } : null; }, S);
        await p.waitForTimeout(400);
      }
      await p.screenshot({ path: `${OUT}/stage2-camps-down.png` });
      ck('10-2：拆掉 6 顶吴军营帐 → 朱然提前出营', early && early.elapsed < 200, early);
    }
    let fireInfo = null;
    if (stage === 3) {
      // 火烧连营：北风往北烧 → 起火点在主将南边，火烧过主将、烧到北面的我军营帐
      await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 1; s.fire.schedule(s.combatNow, -Math.PI / 2); }, S);
      const warn = await p.evaluate(S0 => { const s = eval(S0); return { pending: s.fire.snapshot().pending, hud: !!s.children.getByName('yiling-wind-hud') }; }, S);
      await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/stage3-warning.png` });
      ck('10-3：放火先预警（风向箭头 + 起火点）', warn.pending === 1 && warn.hud, warn);
      for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const f = await p.evaluate(S0 => { const s = eval(S0); if (s.mode !== 'none') s.__DEV_ACTIONS?.closePopup?.(); return s.fire.snapshot(); }, S); if (f.lit > 12 && i === 12) await p.screenshot({ path: `${OUT}/stage3-fire.png` }); fireInfo = f; }
      ck('10-3：火顺风蔓延（越烧越多、成灰不复燃）', fireInfo.metrics.ignited > 40 && fireInfo.ash > 0, fireInfo);
      // 掉血抽检：站进一格正在烧的火里，暂时关掉免伤
      await p.evaluate(S0 => { const s = eval(S0), C = 72; s.fire.igniteAt(s.player.x, s.player.y, s.combatNow); s.__hp0 = s.player.hp; s.player.damageImmune = false; s.player.invulnUntil = 0; }, S);
      await p.waitForTimeout(1200);
      const burn = await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; return { before: s.__hp0, after: s.player.hp, ticks: s.fire.snapshot().metrics.playerTicks }; }, S);
      ck('10-3：火烧到主将会掉血', burn.after < burn.before && burn.ticks > 0, burn);
      ck('10-3：火烧到我军营帐 → 营帐塌、一烧一片', fireInfo.metrics.tentsBurnt > 0, fireInfo.metrics);
      await p.screenshot({ path: `${OUT}/stage3-after-fire.png` });
      await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; s.devTimeScale = 4; }, S);
    }
    let chest = false, end = null, sawEnd = false, bossSeen = false;
    for (let t = 0; t < 900 && !end; t++) {
      const st = await p.evaluate(S0 => {
        const s = eval(S0); if (!s) return { gone: true };
        if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.();
        const end = s.children.getByName('story-yiling-end'); if (end && s.__endShot) (end.list.find(o => o.name === 'story-yiling-end-next' || o.name === 'story-yiling-end-confirm'))?.emit('pointerup');
        const c = s.bossChests?.find(c => !c.done && c.ready);
        if (c) { const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * Math.min(d, 18); s.player.sprite.y += dy / d * Math.min(d, 18); }
        else if (s.boss?.active) { s.boss.hp -= s.boss.maxHp * .012; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); }
        else if (!s.bossSpawned) { s.devSetTime?.(Math.max(s.elapsed, 999)); }
        return { over: s.over, victory: s.victory, rest: s.mode === 'rest', boss: !!s.boss?.active, chests: s.bossChests?.length ?? 0, endStory: !!end, y: s.snapshotYiling() };
      }, S);
      if (st.gone) { end = { gone: true }; break; }
      if (st.boss) bossSeen = true;
      if (st.chests) chest = true;
      if (st.endStory && !sawEnd) { sawEnd = true; await p.screenshot({ path: `${OUT}/chapter-end-story.png` }); await p.evaluate(S0 => { eval(S0).__endShot = true; }, S); }
      if (st.over || st.rest) end = st;
      await p.waitForTimeout(200);
    }
    ck(`10-${stage}：首领出阵 → 倒地掉宝箱 → 捡完告捷`, bossSeen && chest && end && (end.victory || end.rest), { bossSeen, chest, end });
    if (stage === 3) ck('10-3：陆逊半血「火烧连营」、章末剧情 → 夷陵之战终', end?.y?.rage && sawEnd && end?.victory === true, { end, sawEnd });
    await p.screenshot({ path: `${OUT}/stage${stage}-end.png` });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
