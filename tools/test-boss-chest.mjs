// 首领倒地 → 掉宝箱 → 走过去捡遗物 → 才结算（用户 2026-11-17）。电脑布局，张角（通用倒地）/ 袁术（控制器自带倒地帧）/ 吕布挑战。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-chest.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { openBoss } from './boss-v2-open.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-chest';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  for (const boss of ['zhangjiao', 'yuanshu', 'lubu']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const { scene } = await openBoss(p, BASE, boss);
    const ev = (fn, arg) => p.evaluate(([g, f, a]) => { const s = window.__game.scene.getScene(g); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [scene, fn.toString(), arg]);
    if (boss !== 'yuanshu') await p.waitForFunction(id => window.__game.scene.getScenes(true).some(s => s.textures?.exists('boss_death_' + id)), boss, { timeout: 8000 }).catch(() => {});
    const k = await ev(s => { s.__letDie = true; s.player.damageImmune = true; s.boss.sprite.setPosition(s.player.x + 260, s.player.y - 40); const relics = s.player.relics.length, loot = s.itemDrops?.runLoot.length ?? 0; s.killEnemy(s.boss);
      return { relics, loot, chests: s.bossChests.length, fall: !!s.children.getByName('boss-fall') || !!s.children.getByName('boss-fall-frames'), frames: !!s.children.getByName('boss-fall-frames'), mode: s.mode, over: s.over }; });
    ck(`${boss}：首领倒地后掉一个宝箱，没有直接结算`, k.chests === 1 && !k.over && k.mode !== 'result', k);
    ck(`${boss}：倒地动画（${boss === 'yuanshu' ? '控制器自带倒地帧，不叠通用倒地' : '画风会话补的 4 帧倒地'}）`, boss === 'yuanshu' ? !k.fall : k.frames, k);
    await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${boss}-fall.png` });
    await p.waitForTimeout(1100);
    const w = await ev(s => { const c = s.bossChests[0]; s.player.sprite.setPosition(c.x - 360, c.y + 120); const n = s.enemies.filter(e => e.active && !e.isSupplySlot).length; return { ready: c.ready, n, over: s.over }; });
    await p.waitForTimeout(1500);
    const w2 = await ev(s => ({ arrow: s.children.getByName('boss-chest-arrow') && s.bossChests[0].snapshot(), n: s.enemies.filter(e => e.active && !e.isSupplySlot).length, over: s.over, mode: s.mode }));
    await p.screenshot({ path: `${OUT}/${boss}-chest-arrow.png` });
    ck(`${boss}：宝箱落地；主将不去捡就一直停着（不结算、不再刷兵）`, w.ready && !w2.over && w2.mode !== 'result' && w2.n <= w.n, { w, w2 });
    // 走过去
    await ev(s => { const c = s.bossChests[0]; s.player.sprite.setPosition(c.x - 20, c.y + 4); });
    await p.waitForTimeout(500);
    const o = await ev((s, k) => ({ opened: s.bossChests[0].snapshot().opened, popup: !!s.children.getByName('boss-chest-popup'), relics: s.player.relics.length - k.relics, loot: (s.itemDrops?.runLoot ?? []).slice(k.loot).map(i => i.base), text: s.children.getByName('boss-chest-popup')?.list.filter(o => o.type === 'Text').map(o => o.text).join(' | ') }), k);
    await p.screenshot({ path: `${OUT}/${boss}-popup.png` });
    ck(`${boss}：碰到宝箱就打开，弹出遗物名称和效果，本局遗物 +1`, o.opened && o.popup && o.relics === 1 && /获得遗物/.test(o.text), o);
    if (boss === 'zhangjiao') ck('张角：首领遗珍九节杖在捡宝箱时才给', o.loot.includes('relic_jiujie') && /九节杖/.test(o.text), o);
    await p.waitForTimeout(3800);
    const f = await ev(s => ({ over: s.over, mode: s.mode, victory: s.victory }));
    ck(`${boss}：捡完遗物才进下一阶段（结算 / 告捷 / 休整）`, (f.over || f.mode === 'rest' || f.mode === 'result') && f.victory !== false, f);
    ck(`${boss}：无页面报错`, !errs.length, errs);
    await p.close();
  }
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
