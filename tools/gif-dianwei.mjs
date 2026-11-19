// 3-2 典韦技能短片（11-19「典韦可以动和有自己技能」）：走位 → 掷戟 → 双戟旋风 → 恶来死战，按典韦在屏上的位置裁 520×380 截帧。
// 用法：BASE=http://127.0.0.1:5197/ node tools/gif-dianwei.mjs → assets/review/wancheng/gif/f###.png（再用 ffmpeg 合 GIF）
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/wancheng/gif';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(() => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set('thirdStage', 2); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 2 }); s0.scene.start('ThirdGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return window.__game.scene.isActive('ThirdGameScene') && s?.player && s.elapsed < 6; }, null, { timeout: 120000 });
const S = "window.__game.scene.getScene('ThirdGameScene')";
const clr = () => p.evaluate(S0 => { const s = eval(S0); for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } s.player.damageImmune = true; }, S);
for (let i = 0; i < 15; i++) { await clr(); await p.waitForTimeout(150); }
// 清场、主将站在典韦右边（入镜但不帮打）；敌人原地不动、血厚
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; s.spawnTimer = s.eliteTimer = 1e9; if (s.enemyCamps) s.enemyCamps.update = () => {}; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
  s.player.sprite.setPosition(d.home.x + 230, d.home.y + 60); for (const w of s.player.weapons) w.cooldownLeft = 1e9; s.player.weapons.forEach(w => { w.fire = () => {}; }); d.nextWhirl = d.nextThrow = 1e12;
  window.__still = (x, y) => { const e = s.spawnEnemy('infantry', x, y, 1, true); e.def = { ...e.def, speed: 0, damage: 1 }; e.speed = 0; e.hp = e.maxHp = 5000; return e; }; }, S);
let n = 0;
const frames = async k => { for (let i = 0; i < k; i++) { await clr(); await p.waitForTimeout(80); const c = await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei, cam = s.cameras.main; cam.stopFollow(); cam.centerOn(d.home.x + 20, d.home.y - 40); cam.preRender(); const W = window.innerWidth / s.scale.width; return { x: (d.home.x - cam.worldView.x) * cam.zoom * W, y: (d.home.y - cam.worldView.y) * cam.zoom * W }; }, S);
  await p.screenshot({ path: `${OUT}/f${String(n++).padStart(3, '0')}.png`, clip: { x: 366, y: 40, width: 560, height: 420 } /* 镜头钉在营门附近（场地下边界会顶住镜头，营门在屏幕偏下）*/ }); } };
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; window.__a = window.__still(d.home.x - 170, d.home.y + 10); }, S); await frames(16);           // 走位：走向左边的敌人
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; window.__a.deactivate(); window.__b = window.__still(d.home.x + 40, d.home.y - 190); d.nextThrow = 0; }, S); await frames(14);   // 掷戟
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; window.__b.deactivate(); d.nextThrow = 1e12; window.__r = [0, 1, 2, 3, 4].map(i => window.__still(d.x + Math.cos(i * 1.26) * 60, d.y + Math.sin(i * 1.26) * 46)); d.nextWhirl = 0; }, S); await frames(16); // 旋风
await p.evaluate(S0 => { const s = eval(S0), d = s.dianwei; for (const e of window.__r) e.active && e.deactivate(); d.hp = 1500 * .32; d.hurt(60, s.combatNow); }, S); await frames(14); // 死战
console.log('frames', n);
await b.close();
