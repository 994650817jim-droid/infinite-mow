// 主将脚下 HUD 排布（2026-11-20 用户「被动叠成数和马耐力条重叠一起」，2-1 汜水关骑马赵云）：
// 骑马时被动刻度（赵云龙鳞 / 各武将刻度）整排让到马蹄（原点下 30）下面，马的耐力条再让到刻度下面，互不重叠；步行时刻度位置不变。
// 每位武将骑马 / 步行各截一张脚下特写；TAG=before 时在页面里把 FOOT_HUD 改回旧值（mountDy 0、耐力条 34）拍改前图。
// 用法：BASE=http://127.0.0.1:5743/ [TAG=after] [HEROES=zhaoyun,guanyu,machao,lvbu] node tools/test-foot-hud.mjs → assets/review/foot-hud/<TAG>-<武将>-<骑/步>.png
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5743/', TAG = E.TAG ?? 'after', OUT = 'assets/review/foot-hud';
const HEROES = (E.HEROES ?? 'zhaoyun,guanyu,machao,diaochan,lvbu').split(',');
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = [];
const items = hero => ({ version: 2, bag: [], loadouts: {}, salvaged: 0, stable: { owned: ['grey_horse'], riders: { [hero]: 'grey_horse' }, announced: true }, pity: { sincePurple: 0, sinceOrange: 0 }, autoSalvageWhite: true, unseen: 0, legacy: [] });
try {
  for (const hero of HEROES) for (const ride of [true, false]) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await p.addInitScript(([h, it, ride]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_chapter1_cleared', 'true'); if (ride) localStorage.setItem('im_items_v2', JSON.stringify(it)); sessionStorage.setItem('seeded', '1'); } }, [hero, items(hero), ride]);
    await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 });
    await p.evaluate(h => { const s = window.__game.scene.getScene('GameScene'); if (s.runConfig?.character !== h) { s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: h, weapon: undefined }); s.scene.restart(); } }, hero);
    await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.__DEV_ACTIONS && s.passiveGauge; }, hero, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(async ([tag]) => {
      const s = window.__game.scene.getScene('GameScene'), pl = s.player;
      s.__DEV_ACTIONS.closePopup?.(); pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      const F = (await import('/src/data/passiveGauge.ts')).FOOT_HUD;
      if (tag === 'before') { F.mountDy = 0; F.barBelowGauge = 34; }
      pl.passive.stacks = Math.max(2, Math.floor((pl.passive.maxStacks ?? 6) / 2)); // 刻度点亮一半
      if (s.mount) s.mount.stamina = s.mount.maxStamina * .55;                         // 耐力条显示出来
      await new Promise(r => setTimeout(r, 400));
      const icons = s.children.list.filter(o => o.visible && /^(passive-gauge-|zhaoyun-scale-)/.test(o.name ?? ''));
      const top = Math.min(...icons.map(o => o.y - o.displayHeight / 2)) - pl.y, bottom = Math.max(...icons.map(o => o.y + o.displayHeight / 2)) - pl.y;
      const barY = s.mount ? (tag === 'before' ? 34 : (s.passiveGauge.showing ? F.barBelowGauge : F.bar)) : null;
      return { mounted: !!s.mount && pl.riseY > 0, icons: icons.length, top: Math.round(top), bottom: Math.round(bottom), barY, hoof: 30, showing: s.passiveGauge.showing };
    }, [TAG]);
    const pos = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), c = s.cameras.main; return { x: (s.player.x - c.worldView.x) * 1280 / c.worldView.width, y: (s.player.y - c.worldView.y) * 720 / c.worldView.height }; });
    await p.screenshot({ path: `${OUT}/${TAG}-${hero}-${ride ? 'ride' : 'walk'}.png`, clip: { x: Math.round(pos.x - 110), y: Math.round(pos.y - 120), width: 220, height: 220 } });
    if (TAG !== 'before') {
      if (ride) {
        ck(`${hero} 骑马：出征就骑上马`, r.mounted, r);
        if (r.icons) ck(`${hero} 骑马：被动刻度整排在马蹄下（不压马蹄）`, r.top >= r.hoof, r);
        ck(`${hero} 骑马：耐力条在刻度下面、不和刻度重叠`, !r.icons || r.barY >= r.bottom + 1, r);
      } else {
        ck(`${hero} 步行：没有耐力条，刻度在脚下原位（${r.icons} 枚）`, !r.mounted && (r.icons === 0 || (r.top < 30 && r.top > 10)), r);
      }
    } else console.log(hero, ride ? 'ride' : 'walk', JSON.stringify(r));
    await p.context().close();
  }
  if (TAG !== 'before') ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`\n${pass} pass / ${fail} fail`); process.exitCode = fail ? 1 : 0;
} finally { await b.close(); }
