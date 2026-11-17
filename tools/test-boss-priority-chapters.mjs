// 回归测试（2026-11-16）：第 3~5 章 / 官渡 / 情报 / 攻城等关卡改写过 priorityWeaponTarget（营寨优先），
// 营寨不在射程时曾返回 null，把首领 / 精锐优先整个吃掉 → 黄忠宝雕弓在 3-3 袁术、5-3 曹仁有小兵时对首领 0 伤害。
// 本测试：3-3 正常刷怪 6 秒后放出首领，12 秒内黄忠的锁定目标应为首领，且首领确实掉血。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-boss-priority-chapters.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
await p.goto(base + '?dev=1&thirdStage=3&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.isActive('ThirdChapterScene'), null, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(800);
const scenes = await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key));
await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdChapterScene'); const o = s.children.getByName('third-deploy') ?? s.children.list.find(x => x.name && x.name.includes('deploy')); o?.emit('pointerup'); });
await p.waitForFunction(() => window.__game?.scene.isActive('ThirdGameScene') && window.__game.scene.getScene('ThirdGameScene').player, null, { timeout: 90000 });
await p.waitForTimeout(1200);
await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdGameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'huangzhong', weapon: undefined }); s.scene.restart(); });
await p.waitForTimeout(600);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return s?.player && s.runConfig?.character === 'huangzhong'; }, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('ThirdGameScene'), pl = s.player; pl.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none');
  const keep = () => { if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); }; s.events.on('postupdate', keep);
  await new Promise(r => setTimeout(r, 6000)); // 正常刷怪 6 秒
  s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 260, pl.y - 30);
  const hp0 = boss.hp, log = []; let shots = 0;
  const w = pl.weapons[0]; const origBehavior = null;
  const t0 = performance.now(); let lastCd = w.cooldownLeft;
  while (performance.now() - t0 < 12000) {
    await new Promise(r => setTimeout(r, 50));
    if (w.cooldownLeft > lastCd + .2) { shots++; const t = s.priorityWeaponTarget(600, false); log.push({ t: Math.round(performance.now() - t0), prio: t ? t.kind : null, bossDist: Math.round(Math.hypot(boss.x - pl.x, boss.y - pl.y)), bossActive: boss.active, inv: boss.invulnerable, bossHp: Math.round(boss.hp) }); }
    lastCd = w.cooldownLeft;
  }
  return { hp0: Math.round(hp0), hp1: Math.round(boss.hp), shots, log: log.slice(0, 8), enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, bossKind: boss.kind, bossRadius: boss.radius, inGrid: s.grid.query(boss.x, boss.y, 10).includes(boss) };
});
const ok = r.hp1 < r.hp0 && r.log.length > 0 && r.log.every(l => l.prio === 'boss') && errs.length === 0;
console.log((ok ? 'PASS ' : 'FAIL ') + '3-3 有小兵时黄忠锁定首领并造成伤害 · ' + JSON.stringify({ hp0: r.hp0, hp1: r.hp1, shots: r.shots, prio: r.log.map(l => l.prio), errs: errs.slice(0, 3) }));
await b.close(); process.exit(ok ? 0 : 1);
