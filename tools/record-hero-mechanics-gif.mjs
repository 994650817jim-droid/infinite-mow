// 武将机制改动演示 GIF（2026-11-18，data/heroMechanics.ts）：黄忠命中积蓄势 → 神射；魏延被围积拒敌 → 谁敢杀我；刘备统御减伤；诸葛亮前期打首领。
// 输出 assets/review/hero-mechanics/<hero>.gif（裁上半屏 1280×470：被动面板 + 主将 + 目标，缩到 900 宽）。用法：BASE=http://127.0.0.1:5173/ node tools/record-hero-mechanics-gif.mjs <hero>
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', hero = process.argv[2] ?? 'huangzhong', SCENE = process.env.SCENE ?? '', tag = hero + (SCENE ? '-' + SCENE : ''), out = 'assets/review/hero-mechanics', vid = `${out}/video-${tag}`;
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
await p.evaluate(async ([G0, hero, SCENE]) => {
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
  if (hero === 'zhuge' && SCENE === 'crowd') {
    // 2026-11-18 天火打怪堆：没有首领 / 精锐时落进怪堆中心（溅射 90 内 40%）；同晚改：算无遗策（同一目标第 4 发）留下手绘星火焦土（半径 160），借东风火龙下面卷起手绘东风。
    // 怪堆血量给到 600；无首领时天火每发都积星象，第 4 发算无遗策留 4.5 秒星火焦土（谁都烧）；借东风火龙把怪堆顺风吹开
    pl.damageImmune = true; pl.weapons[0].level = 3; pl.growth.masteries.wildfire = 2; pl.growth.masteries.eight_trigrams = 3; // 八阵图 3 级：算无遗策处布阵，阵内每 0.5 秒受伤、阵纹每跳亮一下
    mk(pl.x + 60, pl.y - 190, { hp: 30000 });
    for (const [cx, cy] of [[260, -30], [-230, -10]]) /* 都放在上半屏（GIF 只裁上 470 像素） */ for (let i = 0; i < 9; i++) mk(pl.x + cx + (i % 3 - 1) * 34, pl.y + cy + (Math.floor(i / 3) - 1) * 30, { hp: 600 });
    await wait(16000); return;
  }
  if (hero === 'zhuge') {
    // 诸葛亮七星灯 · 天火（2026-11-18 重做）：星位 → 天火落下；同一目标第 4 发算无遗策 + 八阵图；每第 4 发东风火龙扫过路上的兵
    pl.damageImmune = true; pl.weapons[0].level = 3; pl.growth.masteries.wildfire = 2; pl.growth.masteries.eight_trigrams = 3;
    s.spawnBoss(); const boss = s.boss; if (boss) { boss.sprite.setPosition(pl.x + 300, pl.y); boss.stunUntil = 1e12; boss.hp = boss.maxHp = 1e6; }
    for (let i = 0; i < 6; i++) mk(pl.x + 90 + i * 34, pl.y + (i % 2 ? 18 : -18), { hp: 2000 });
    await wait(13000);
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
}, [G, hero, SCENE]);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${tag}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=12,crop=1280:470:0:0,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${tag}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
