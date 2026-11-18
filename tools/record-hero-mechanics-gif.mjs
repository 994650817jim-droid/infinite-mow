// 武将机制改动演示 GIF（2026-11-18，data/heroMechanics.ts）：黄忠命中积蓄势 → 神射；魏延被围积拒敌 → 谁敢杀我；刘备统御减伤；诸葛亮前期打首领。
// 输出 assets/review/hero-mechanics/<hero>.gif（裁上半屏 1280×470：被动面板 + 主将 + 目标，缩到 900 宽）。用法：BASE=http://127.0.0.1:5173/ node tools/record-hero-mechanics-gif.mjs <hero>
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', hero = process.argv[2] ?? 'huangzhong', out = 'assets/review/hero-mechanics', vid = `${out}/video-${hero}`;
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1000);
await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
await p.waitForTimeout(500);
await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40); }, G);
const t0 = Date.now();
await p.evaluate(async ([G0, hero]) => {
  const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  const mk = (x, y, o = {}) => { const e = s.spawnEnemy(o.kind ?? 'infantry', x, y, 1); if (e) { e.hp = e.maxHp = o.hp ?? 4000; if (o.stun !== false) e.stunUntil = 1e12; if (o.dmg !== undefined) e.def = { ...e.def, damage: o.dmg }; } return e; };
  pl.hp = pl.maxHp;
  if (hero === 'huangzhong') {
    // 远处一排敌人：重箭逐支命中积蓄势（左上被动面板 0→5），满层神射（金光、重箭爆裂）
    pl.damageImmune = true; pl.weapons[0].level = 3;
    for (let i = 0; i < 4; i++) mk(pl.x + 300 + (i % 2) * 26, pl.y - 60 + i * 40);
    const t = s.combatNow; while (!pl.passive.isSharpshooter(s.combatNow) && s.combatNow - t < 14000) await wait(50);
    await wait(2500);
    // 神射结束后被贴身挨打：蓄势一次只掉 1 层
    while (pl.passive.isSharpshooter(s.combatNow)) await wait(50);
    await wait(1200); pl.damageImmune = false; const biter = mk(pl.x - 8, pl.y, { stun: false, dmg: 3 }); await wait(1600); biter.deactivate(); pl.damageImmune = true; await wait(600);
  }
  if (hero === 'weiyan') {
    // 被 6 名敌人围住、不挨打：拒敌每秒 2 层（左上面板），满层下一刀「谁敢杀我」六向裂波；两轮
    pl.damageImmune = true;
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + round * .5; mk(pl.x + Math.cos(a) * 85, pl.y + Math.sin(a) * 70, { hp: 900 }); }
      const t = s.combatNow, tr = pl.passive.snapshot(s.combatNow).triggers; while (pl.passive.snapshot(s.combatNow).triggers === tr && s.combatNow - t < 8000) await wait(50);
      await wait(1800); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); await wait(500);
    }
  }
}, [G, hero]);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${hero}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=12,crop=1280:470:0:0,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${hero}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
