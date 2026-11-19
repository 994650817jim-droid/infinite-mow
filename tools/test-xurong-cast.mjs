// 徐荣（第三章 荥阳）起手特效冒烟：刷出徐荣 → 等他第一次下令 → 起手时身上出现尘土蓄力光（boss-cast-aura），无页面报错。需要开发服务器（默认 5260）。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-xurong-cast.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }), p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(BASE + '?dev=1&layout=desktop&dual=0');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 2 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 90000 }); await p.waitForTimeout(1000);
const ev = fn => p.evaluate(fn);
await ev(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); });
let ready = false;
for (let i = 0; i < 150 && !ready; i++) { ready = await ev(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); return !!(s.xurong && s.boss?.active); }); if (!ready) await p.waitForTimeout(200); }
ck('徐荣出阵，控制器就位', ready, null);
if (ready) {
  await p.waitForTimeout(1500);
  // 等第一次下令（state=command）并在起手时看到蓄力光
  let seen = null;
  for (let i = 0; i < 80 && !seen; i++) { seen = await ev(() => { const s = window.__game.scene.getScene('GameScene'); if (s.xurong?.state === 'command') { const a = s.children.list.find(o => o.name === 'boss-cast-aura'); return { aura: !!a, tex: a?.texture?.key }; } return null; }); await p.waitForTimeout(100); }
  ck('徐荣起手：身上出现尘土蓄力光（boss-cast-aura，贴图 bossfxcast_dust）', seen?.aura && seen.tex === 'bossfxcast_dust', seen);
}
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); await b.close(); process.exit(rows.every(Boolean) ? 0 : 1);
