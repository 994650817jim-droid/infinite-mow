// 第三章首领（ThirdBoss：李傕 / 张绣 / 郭汜）招式结算时补手绘主题特效：逐招 forceSkill，数「boss-theme-fx」对象出现过几次，并连截几张。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ STAGES=1,2 node tools/test-third-boss-fx.mjs     截图 assets/review/boss-theme/third-<阶段>-<n>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/boss-theme'; mkdirSync(OUT, { recursive: true });
const STAGES = (E.STAGES ?? '1').split(',').map(Number);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&dual=0');
  await p.waitForFunction(() => window.__game?.scene.getScenes(true).length > 0, null, { timeout: 120000, polling: 500 }); await p.waitForTimeout(3000);
  for (const st of STAGES) {
    await p.evaluate(stage => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); g.registry.set('thirdStage', stage); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: stage }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('ThirdGameScene'); }, st);
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return !!s?.player; }, null, { timeout: 90000, polling: 500 }); await p.waitForTimeout(1000);
    let ok = false;
    for (let i = 0; i < 150 && !ok; i++) {
      ok = await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdGameScene'); s.player.damageImmune = true; if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'story' || s.mode === 'parley') { for (const c of s.children.list) { const btn = c.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } return !!(s.boss?.active && s.controller); });
      if (!ok) await p.waitForTimeout(200);
    }
    ck(`阶段 ${st}：首领出场`, ok, null); if (!ok) continue;
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async st0 => {
      const s = window.__game.scene.getScene('ThirdGameScene'), seen = new Set(); let max = 0; const poll = setInterval(() => { const ims = s.children.list.filter(o => o.name === 'boss-theme-fx'); max = Math.max(max, ims.length); ims.forEach(o => seen.add(o)); }, 40);
      const themed = s.textures.getTextureKeys().filter(k => k.startsWith('bossfxtheme_'));
      for (let i = 0; i < 3; i++) { const b = s.boss; b.sprite.x = s.player.x + 200; b.sprite.y = s.player.y; s.player.damageImmune = true; s.controller.forceSkill(s.combatNow); await new Promise(r => setTimeout(r, 3600)); }
      clearInterval(poll); return { themed, drawn: seen.size, max };
    }, st);
    ck(`阶段 ${st}：三招结算时画出主题特效`, r.drawn >= 3, r);
    // 再放一招，落下前后连截
    await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdGameScene'), b = s.boss; b.sprite.x = s.player.x + 200; b.sprite.y = s.player.y; s.controller.forceSkill(s.combatNow); });
    for (let n = 0; n < 8; n++) { await p.waitForTimeout(260); if (n === 4 || n === 6 || n === 7) await p.screenshot({ path: `${OUT}/third-${st}-${n}.png`, clip: { x: 300, y: 190, width: 700, height: 340 } }); }
  }
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
