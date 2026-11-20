// 音效密度实测（音效审计用）：开一关、主将升满、身边持续刷一大圈杂兵割草 N 秒，统计每个音效键每秒触发 / 实际播放 / 被丢弃次数，
// 以及同时在响的音效总数峰值。无头浏览器静音（--mute-audio），允许自动播放（AudioContext 照常运行，只是听不到）。
// 用法：BASE=http://127.0.0.1:5213/ SECS=20 RUN=huangjin:1 node tools/audio-density.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', SECS = Number(process.env.SECS ?? 20);
const [chapter, stage] = (process.env.RUN ?? 'huangjin:1').split(':');
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(([c, st]) => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: 'guanyu', chapter: c, stage: +st, westStage: +st }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); }, [chapter, stage]);
  await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 });
  await p.waitForTimeout(1500);
  // 跳过剧情、升级 12 次（每次选第一张卡）
  for (let i = 0; i < 40; i++) {
    const done = await ev((s, i) => {
      if (s.mode === 'story') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } return false; }
      if (s.mode === 'levelup') { s.chooseUpgrade?.(0); return false; }
      if (i < 12) { s.devLevelUp?.(); return false; }
      return s.mode === 'none';
    }, i);
    if (done) break; await p.waitForTimeout(120);
  }
  await p.evaluate(v => { window.__onehit = v; }, !!process.env.ONEHIT);
  const unlocked = await ev(s => { s.sfx.unlock?.(); s.player.damageImmune = true; if (window.__onehit) s.devOneHit = true; s.sfx.stats = {}; window.__peak = 0; window.__sample = setInterval(() => { const a = Object.values(s.sfx.active ?? {}).reduce((x, y) => x + y, 0); if (a > window.__peak) window.__peak = a; }, 30); return s.sfx.ctx?.state; });
  for (let t = 0; t < SECS; t++) {
    await ev(s => { if (s.mode === 'levelup') s.chooseUpgrade?.(0); const p = s.player, n = s.enemies.filter(e => e.active && !e.isSupplySlot).length; for (let i = n; i < 90; i++) { const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 220; s.spawnEnemy('infantry', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, 1, true); } });
    await p.waitForTimeout(1000);
  }
  const r = await ev((s, secs) => { clearInterval(window.__sample); const st = s.sfx.getStats(); return { peak: window.__peak, kills: s.kills, rows: Object.entries(st).map(([k, v]) => ({ k, trig: +(v.triggered / secs).toFixed(1), play: +(v.played / secs).toFixed(1), drop: v.dropped })).sort((a, b) => b.play - a.play) }; }, SECS);
  console.log(`audio ctx: ${unlocked} · ${SECS}s · kills ${r.kills} · peak concurrent voices ${r.peak}`);
  console.log('key'.padEnd(20), 'trig/s'.padStart(7), 'play/s'.padStart(7), 'dropped'.padStart(8));
  for (const x of r.rows) console.log(x.k.padEnd(20), String(x.trig).padStart(7), String(x.play).padStart(7), String(x.drop).padStart(8));
} finally { await b.close(); }
