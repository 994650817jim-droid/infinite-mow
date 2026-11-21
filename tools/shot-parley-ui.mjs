// 劝降面板 / 降将来投 / 锦囊 / 名将页 截图（2026-11-21 统筹：夜间 UI 审查没覆盖到的界面）。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/shot-parley-ui.mjs   → assets/review/night-ui/<TAG>-parley-*.png 等（ONLY=parley,defector,jinnang,talent）
// 劝降面板直接在 1-1 用场景的 makeParley 按招降表开（徐荣「难降」三按钮、张绣「可降」、华雄「宁死不降」），不必打到对应关。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'before', OUT = 'assets/review/night-ui/';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; let p;
const fresh = async q => {
  if (p) await p.close().catch(() => {});
  p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('s', '1'); } window.__IM_PARLEY_LIVE = true; });
  await p.goto(BASE + q, { timeout: 180000 });
};
const battle = async (run) => {
  await fresh('?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 1.5; }, null, { timeout: 180000 });
  if (run) {
    await p.evaluate(run => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('runConfig', { character: 'zhaoyun', ...run }); s0.scene.restart(); }, run);
    await p.waitForTimeout(800);
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 1.5; }, null, { timeout: 180000 });
  }
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup(); s.spawnTimer = s.eliteTimer = 1e9; });
};
const hide = () => p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
const shot = async n => { await hide(); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}${TAG}-${n}.png` }); console.log('SHOT', n); };
const step = async (l, fn) => { try { await fn(); } catch (e) { console.log('ERR', l, String(e).slice(0, 240)); } };

if (want('parley')) await step('parley', async () => {
  await battle();
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.spawnBoss(); });
  await p.waitForTimeout(3000);
  for (const key of ['hulao-2:xurong', 'qunxiong-2:zhangxiu', 'hulao-1:huaxiong']) {
    const r = await p.evaluate(async key => {
      const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup();
      const S = await import('/src/data/surrender.ts'); const def = S.surrenderDef(key); if (!def) return 'no def';
      window.__pz?.clear?.(); const pz = s.makeParley(() => s.boss, def); if (!pz) return 'no parley'; window.__pz = pz; pz.state = 'idle'; pz.open(); return s.mode;
    }, key);
    await p.waitForTimeout(700); await shot('parley-' + key.split(':')[1]); console.log('  ', key, r);
  }
  await p.evaluate(() => window.__pz?.clear?.());
});
if (want('defector')) await step('defector', async () => {
  await battle({ chapter: 'hulao', westStage: 1 });
  const ok = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (!s.fortunes) return 'no fortunes'; s.fortunes.force('defector'); const L = s.fortunes.live.find(x => x.kind === 'defector' && !x.done); if (!L) return 'no live'; s.player.sprite.setPosition(L.x - 230, L.y + 110); return 'ok'; });
  console.log('  defector', ok); await p.waitForTimeout(4500); await shot('defector-arrive');
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), D = s.fortunes?.defector; if (D) s.player.sprite.setPosition(D.x + 70, D.y + 10); });
  await p.waitForTimeout(1500); await shot('defector-duel');
});
if (want('jinnang')) await step('jinnang', async () => {
  await battle();
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.jinnang = 'fire'; s.paintJinnang(); });
  await p.waitForTimeout(600); await shot('jinnang-held');
  await p.mouse.click(640, 400); await p.keyboard.press('KeyR'); await p.waitForTimeout(500); await shot('jinnang-used');
});
if (want('talent')) await step('talent', async () => {
  await fresh('?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); Object.assign(s, { yellowStages: 3, worldAvailable: true, tutorialSeen: true }); s.provisions = 5000; s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); window.__game.scene.getScene('MenuScene').scene.start('TalentHallScene'); });
  await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const t = window.__game.scene.getScene('TalentHallScene'); const btn = t.children.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => /^talent-tab/.test(o.name ?? '') && /名将/.test(o.text ?? o.getData?.('label') ?? '')); (btn ?? t.children.list.flatMap(o => [o, ...(o.list ?? [])]).find(o => o.name === 'talent-tab-heroes'))?.emit('pointerdown'); t.tab = 'heroes'; t.page = 0; t.render(); });
  await p.waitForTimeout(800); await shot('talent-heroes');
  for (let i = 1; i < 4; i++) { const more = await p.evaluate(() => { const t = window.__game.scene.getScene('TalentHallScene'); const before = t.page; t.page++; t.render(); return t.page !== before; }); if (!more) break; await p.waitForTimeout(500); await shot('talent-heroes-p' + (i + 1)); }
});
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await b.close();
