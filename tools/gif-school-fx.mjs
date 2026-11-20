// 六派战法 / 势档触发特效 改前 / 改后对比 GIF（2026-11-20「流派特效太小太快」）：每派设好战法 + 势档，围一圈不动的敌人，录 3.5 秒截帧，
// 三档对比：原版（orig）/ 上一版（prev）/ 现行（now），ffmpeg 左中右并排合成 GIF。需要开发服务器 + ffmpeg。
// 用法：BASE=http://127.0.0.1:5260/ SCHOOLS=fire,stratagem node tools/gif-school-fx.mjs     输出 assets/review/school-fx/gif/<派>.gif
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx/gif', TMP = 'assets/review/school-fx/gif/_frames'; mkdirSync(OUT, { recursive: true });
const FF = E.FFMPEG ?? 'ffmpeg';
const SETUP = {
  fire: { tactics: { ember: 3, spread: 2, hotwind: 2, napalm: 2 }, name: '火攻' }, stratagem: { tactics: { snare: 2, traction: 2, confinement: 2, gust: 2 }, name: '奇谋' },
  archery: { tactics: { eagle: 2, sunder: 2, reap: 2, concentration: 2 }, name: '弓弩' }, cavalry: { tactics: { windstep: 2, flank: 2, swift: 2, stored_edge: 2 }, name: '骑突' },
  warrior: { tactics: { chain: 2, pursuit: 2, momentum: 2, heavy_break: 2 }, name: '猛将' }, formation: { tactics: { coordination: 2, rally: 2, breakout: 2, watch: 2 }, name: '兵阵' },
};
const SCHOOLS = (E.SCHOOLS ?? Object.keys(SETUP).join(',')).split(',');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1500);
  const record = async (school, mode) => {
    const dir = `${TMP}/${school}-${mode}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await p.evaluate(async ([sc, setup, mode]) => {
      const V = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/BuildVfx.ts')) ?? '/src/systems/BuildVfx.ts'); V.vfxPreset(mode);
      const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); }
      const b = s.player.growth.build; b.tactics = { ...setup }; b.bonus = { fire: 0, stratagem: 0, archery: 0, cavalry: 0, warrior: 0, formation: 0, [sc]: 4 }; s.player.stats.cooldownMul = .5;
      window.__ring = () => { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .3, r = 95 + (i % 3) * 38; const e = s.spawnEnemy('infantry', s.player.x + Math.cos(a) * r, s.player.y + Math.sin(a) * r, 3, true); if (e) { e.speed = 0; e.hp = e.maxHp = 9e5; } } };
      window.__ring();
    }, [school, SETUP[school].tactics, mode]);
    for (let i = 0; i < 36; i++) {
      await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode !== 'none') s.__DEV_ACTIONS.closePopup?.(); if (s.enemies.filter(e => e.active && !e.isSupplySlot).length < 6) window.__ring(); const c = s.player; c.hp = c.maxHp; });
      await p.waitForTimeout(60); await p.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png`, clip: { x: 390, y: 180, width: 500, height: 330 } });
    }
    await p.evaluate(async () => { const V = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/BuildVfx.ts')) ?? '/src/systems/BuildVfx.ts'); V.vfxPreset('now'); });
  };
  for (const school of SCHOOLS) {
    for (const m of ['orig', 'prev', 'now']) await record(school, m);
    const d = `${TMP}/${school}`; 
    execFileSync(FF, ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${TMP}/${school}-orig/f%03d.png`, '-framerate', '12', '-i', `${TMP}/${school}-prev/f%03d.png`, '-framerate', '12', '-i', `${TMP}/${school}-now/f%03d.png`, '-filter_complex', '[0][1][2]hstack=inputs=3,scale=1080:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${OUT}/${school}.gif`]);
    console.log('gif', `${OUT}/${school}.gif`, d ? '' : '');
  }
  console.log('errors', errs.slice(0, 3));
} finally { await b.close(); }
