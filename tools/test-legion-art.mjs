import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true }), errors = [], warnings = [];
try {
 const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
 p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'warning' && /texture|frame/i.test(m.text())) warnings.push(m.text()); });
 await p.goto((process.env.BASE??'http://127.0.0.1:5173/')+'?autostart=1&chapter=hulao'); await p.waitForFunction(() => window.__IM);
 const result = await p.evaluate(() => {
   const s = window.__game.scene.getScene('GameScene'); s.scene.pause(); s.setMode('none'); s.player.sprite.setPosition(0, 225); s.legion.clear(); window.__IM.killAllEnemies(); window.__IM.clearWeapons();
   const kinds = ['medic', 'crossbowman', 'guardian', 'rider', 'halberdier'], directions = ['down', 'left', 'right', 'up'];
   for (const k of kinds) s.legion.recruit(k, 4, true);
   s.rebuildGrid(); s.legion.update(.25, s.combatNow, [], s.grid, () => {});
   const checks = [];
   for (const [column, kind] of kinds.entries()) {
     const units = s.allies.filter(u => u.active && u.kind === kind), expected = `legion_${kind}_walk`;
     for (let row = 0; row < 4; row++) {
       const u = units[row]; u.dir = directions[row]; u.setPosition(-180 + column * 90, -220 + row * 100);
       for (let frame = 0; frame < 4; frame++) { u.moving = true; u.walked = frame * 14; u.attackUntil = 0; u.render(500); checks.push({ name: `${kind}_${directions[row]}_${frame}`, ok: u.sprite.texture.key === expected && u.sprite.frame.name === `${directions[row]}_${frame}`, got: u.sprite.texture.key + ":" + u.sprite.frame.name }); }
       // 2026-11-15：医官 / 弩兵 / 戟兵后来有了专门的出手动作图（legion_<兵种>_action），其余兵种出手仍用行走图
       const hasAction = !!u.def.actionVisual, attackKey = hasAction ? `legion_${kind}_action` : expected;
       u.moving = false; u.attackStarted = 500; u.attackUntil = 1000; u.render(500); checks.push({ name: `${kind}_attack_keeps_new_art_${row}`, ok: u.sprite.texture.key === attackKey && u.sprite.frame.name.startsWith(directions[row] + '_'), got: u.sprite.texture.key + ":" + u.sprite.frame.name });
       // 脚底对齐：复位成站立帧后检查（动作图帧高不同）
       u.attackUntil = 0; u.render(500);
       // 2026-11-17：v2 兵种图集格子更大，脚底在帧底往上 7 像素（ArtStyle.v2TroopGround）；旧 96 格脚底在 84
       const fh = u.sprite.frame.height, footRow = fh === 96 ? 84 : fh - 7, foot = u.sprite.y + (footRow - u.sprite.originY * fh) * u.sprite.scaleY;
       checks.push({ name: `${kind}_feet_scale_${row}`, ok: Math.abs(foot - u.shadow.y) < .0001 && Math.abs(u.sprite.scaleX - u.sprite.scaleY) < .0001, got: [Math.round(foot * 100) / 100, Math.round(u.shadow.y * 100) / 100] });
       u.walked = 14; u.render(500);
     }
   }
   s.hudAcc = 1; s.updateHud();
   return checks;
 });
 await p.screenshot({ path: 'assets/review/legion-art/game-mobile.png' });
 const all = [...result, { name: 'no_page_errors', ok: !errors.length, errors }, { name: 'no_frame_warnings', ok: !warnings.length, warnings }];
 writeFileSync('assets/review/legion-art/checks.json', JSON.stringify(all, null, 2));
 console.log(`SUMMARY ${all.filter(c => c.ok).length}/${all.length}`); if (all.some(c => !c.ok)) { console.log(all.filter(c => !c.ok)); process.exitCode = 1; }
} finally { await browser.close(); }
