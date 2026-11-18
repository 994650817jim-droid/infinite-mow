import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs=[]; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://127.0.0.1:5212/?dev=1&layout=desktop&art=v2', { waitUntil: 'commit', timeout: 120000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
const ONE = process.argv[2] ?? 'sunhuan'; for (const [id, stage] of [['sunhuan',1],['zhuran',2]].filter(x => x[0] === ONE)) {
  await p.evaluate(([st]) => { const g = window.__game; for (const k of ['campaignTransfer','thirdTransfer']) g.registry.remove(k); g.registry.set('yilingStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); }, [stage]);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('YilingGameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); s.player.damageImmune = true; const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length-1].start + 1 : 999); });
  for (let i=0;i<150;i++){ const ok = await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); if (s.mode==='story'||s.mode==='parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length-1].start + 1 : 999); } return !!s.boss?.active; }); if (ok) break; await p.waitForTimeout(200); }
  await p.waitForTimeout(3000);
  for (let k=0;k<5;k++){ await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); if (s.mode==='levelup'||s.mode==='recruit') s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; }); await p.waitForTimeout(400); }
  // 让首领落马步战（看身体图）：直接把坐骑摘掉
  const info = await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); for (const e of s.enemies) if (e.active && e.kind!=='boss') e.deactivate(); s.boss.hp = Math.ceil(s.boss.maxHp * 0.3); s.hitEnemy(s.boss, 1, s.combatNow, 'melee', false, false); const bs = s.boss.sprite; const cam=s.cameras.main, cv=s.game.canvas.getBoundingClientRect(), k=cv.width/cam.width; return { key: bs.texture.key, mounted: !!s.bossMount?.mounted, sx: Math.round(cv.left+(bs.x-cam.worldView.x)*cam.zoom*k), sy: Math.round(cv.top+(bs.y-cam.worldView.y)*cam.zoom*k) }; });
  console.log(id, JSON.stringify(info));
  await p.waitForTimeout(7000); for (let k=0;k<4;k++){ await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); if (s.mode==='levelup'||s.mode==='recruit') s.__DEV_ACTIONS?.closePopup?.(); s.player.damageImmune = true; s.boss.sprite.setPosition(s.player.x, s.player.y - 120); }); await p.waitForTimeout(500); }
  const inf2 = await p.evaluate(() => { const s = window.__game.scene.getScene('YilingGameScene'); const bs = s.boss.sprite, cam=s.cameras.main, cv=s.game.canvas.getBoundingClientRect(), k=cv.width/cam.width; return { key: bs.texture.key, sx: Math.round(cv.left+(bs.x-cam.worldView.x)*cam.zoom*k), sy: Math.round(cv.top+(bs.y-cam.worldView.y)*cam.zoom*k) }; }); console.log(JSON.stringify(inf2)); info.sx = inf2.sx; info.sy = inf2.sy;
  await p.screenshot({ path: `assets/review/boss-ride/${id}_body_v2.png`, clip: { x: Math.max(0, info.sx-170), y: Math.max(0, info.sy-210), width: 340, height: 340 } });
}
console.log(errs.slice(0,3)); await b.close();
