// 全面检查探针（2026-11-19）：首领倒地后有没有宝箱、捡完能不能告捷。用法：BASE=… node tools/_p/boss-chest-probe.mjs 7-1,7-2,12-1,12-2
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', list = (process.argv[2] ?? '12-1').split(',');
const CH = { 7: ['ShuGameScene', 'shuStage'], 12: ['BeifaGameScene', 'beifaStage'], 10: ['YilingGameScene', 'yilingStage'], 8: ['HanzhongGameScene', 'hanzhongStage'] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of list) {
  const [c, st] = id.split('-').map(Number), [key, reg] = CH[c];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([key, reg, st]) => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set(reg, st); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); s0.scene.start(key); }, [key, reg, st]);
  await p.waitForFunction(k => window.__game.scene.isActive(k) && window.__game.scene.getScene(k).player, key, { timeout: 120000 });
  const log = [];
  for (let t = 0; t < 400; t++) {
    const r = await p.evaluate(k => {
      const s = window.__game.scene.getScene(k); if (!s?.scene.isActive()) return { gone: true };
      s.player.damageImmune = true; for (let i = 0; i < 6 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode('none'); } }
      const c = s.bossChests?.find(c => !c.done && c.ready); if (c) { s.player.sprite.setPosition(c.x, c.y + 10); }
      else if (s.boss?.active) { if (!window.__hit) { window.__hit = 1; } s.hitEnemy(s.boss, s.boss.hp + 50, s.combatNow, 'melee', false, false); }
      else if (!s.bossSpawned) { if (s.siege?.gateAlive) s.siege.gate.deactivate?.(); s.devSetTime?.(Math.max(s.elapsed, 999)); }
      return { over: s.over, victory: s.victory, mode: s.mode, boss: !!s.boss?.active, bossHp: s.boss ? Math.round(s.boss.hp) : null, spawned: !!s.bossSpawned, chests: s.bossChests?.length ?? 0, ready: s.bossChests?.filter(c => c.ready).length ?? 0, done: s.bossChests?.filter(c => c.done).length ?? 0, elapsed: Math.round(s.elapsed), awaiting: !!s.awaitingChest };
    }, key);
    const sig = JSON.stringify(r); if (log[log.length - 1] !== sig) log.push(sig);
    if (r.gone || r.over || r.mode === 'rest' || r.mode === 'story') break;
    await p.waitForTimeout(250);
  }
  console.log(id, '\n  ' + log.slice(-8).join('\n  '), errs.length ? '\n  errors ' + errs.join(' | ') : '');
  await p.close();
}
await b.close();
