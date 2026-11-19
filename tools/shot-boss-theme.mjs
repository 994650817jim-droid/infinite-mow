// 首领主题特效的游戏内截图：刷出首领、逐招放出，在落下前后连截几张（落下那一刻前后各约 0.4 秒），存 assets/review/boss-theme/<id>-m<招号>-<n>.png（裁到首领周围）。
// 用法：BASE=http://127.0.0.1:5260/ IDS=lijue,zhangliang MOVES=0,1,2 node tools/shot-boss-theme.mjs        （默认 MOVES=全部一阶段招式）
// 慢放：SLOW=0.3（devTimeScale）；录视频：VIDEO=1（再用 ffmpeg 做 GIF）。需要开发服务器。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', OUT = E.OUT ?? 'assets/review/boss-theme', SLOW = +(E.SLOW ?? 1), STEP = +(E.STEP ?? 200), NSHOT = +(E.NSHOT ?? 12);
mkdirSync(OUT, { recursive: true });
const CASES = {
  zhangliang: { scene: 'GameScene', run: { chapter: 'huangjin', stage: 1 }, reg: {}, ctl: 'moveset' },
  zhangbao: { scene: 'GameScene', run: { chapter: 'huangjin', stage: 2 }, reg: {}, ctl: 'moveset' },
  lijue: { scene: 'ThirdGameScene', run: { thirdStage: 1 }, reg: { thirdStage: 1 }, ctl: 'controller' },
  zhangxiu: { scene: 'ThirdGameScene', run: { thirdStage: 2 }, reg: { thirdStage: 2 }, ctl: 'controller' },
  caochun: { scene: 'ChibiGameScene', run: { thirdStage: 1 }, reg: { chibiStage: 1 }, ctl: 'controller' },
  zhanghe: { scene: 'HanzhongGameScene', run: { thirdStage: 1 }, reg: { hanzhongStage: 1 }, ctl: 'controller' },
  xiahouyuan: { scene: 'HanzhongGameScene', run: { thirdStage: 2 }, reg: { hanzhongStage: 2 }, ctl: 'controller' },
  sunhuan: { scene: 'YilingGameScene', run: { thirdStage: 1 }, reg: { yilingStage: 1 }, ctl: 'controller' },
  mangyachang: { scene: 'NanzhengGameScene', run: { thirdStage: 1 }, reg: { nanzhengStage: 1 }, ctl: 'controller' },
  wutugu: { scene: 'NanzhengGameScene', run: { thirdStage: 2 }, reg: { nanzhengStage: 2 }, ctl: 'controller' },
  caocao: { scene: 'HanzhongGameScene', run: { thirdStage: 3 }, reg: { hanzhongStage: 3 }, ctl: 'controller' },
  lvmeng: { scene: 'XiangfanGameScene', run: { thirdStage: 3 }, reg: { xiangfanStage: 3 }, ctl: 'controller' },
  huangzhong: { scene: 'JingnanGameScene', run: { thirdStage: 3 }, reg: { jingnanStage: 3 }, ctl: 'controller' },
  liudu: { scene: 'JingnanGameScene', run: { thirdStage: 2 }, reg: { jingnanStage: 2 }, ctl: 'controller' },
  menghuo: { scene: 'NanzhengGameScene', run: { thirdStage: 3 }, reg: { nanzhengStage: 3 }, ctl: 'controller' },
};
const IDS = (E.IDS ?? 'lijue').split(',').filter(Boolean), MOVES = (E.MOVES ?? '').split(',').filter(Boolean).map(Number);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop&dual=0');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  for (const id of IDS) {
    const c = CASES[id]; if (!c) { console.log('unknown', id); continue; }
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.run, c.reg]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1000);
    await ev(s => { s.player.damageImmune = true; if (!s.boss?.active) { const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); } });
    let ctl = null;
    for (let i = 0; i < 150 && !ctl; i++) {
      ctl = await ev((s, [k, id0]) => { const o = s[k]; return o && s.boss?.active && o.def?.id === id0 ? true : null; }, [c.ctl, id]);
      if (!ctl) { await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (s.mode === 'parley') s.choose('persuade'); if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); }
    }
    if (!ctl) { console.log(id, '：首领没出来'); continue; }
    await p.waitForTimeout(3200);
    const names = await ev((s, k) => [...s[k].debug.moves], c.ctl), themed = await ev(s => s.textures.getTextureKeys().filter(k => k.startsWith('bossfxtheme_')));
    console.log(id, '招式', names.join('、'), '主题图', themed.join(',') || '无');
    await ev((s, sc) => { s.devTimeScale = sc; }, SLOW);
    for (const i of (MOVES.length ? MOVES : names.map((_, k) => k))) {
      await ev((s, [k, i0]) => { const b = s.boss; b.sprite.x = s.player.x + 200; b.sprite.y = s.player.y; s.player.damageImmune = true; s[k].debug.force(i0, s.combatNow); }, [c.ctl, i]);
      for (let n = 0; n < NSHOT; n++) { await p.waitForTimeout(Math.round(STEP / SLOW)); await p.screenshot({ path: `${OUT}/${id}-m${i}-${n}.png`, clip: { x: 300, y: 190, width: 700, height: 340 } }); }
      await p.waitForTimeout(1500 / SLOW);
    }
  }
  console.log('errors', errs.slice(0, 3));
} finally { await b.close(); }
